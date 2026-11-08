'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChangeEvent, DragEvent } from 'react';
import type { StreamingFormat } from '@/lib/streaming/types';

type Status =
  | 'idle'
  | 'starting'
  | 'processing'
  | 'cancelling'
  | 'completed'
  | 'cancelled'
  | 'error';

type WorkerMessage =
  | { status: 'started' }
  | {
      status: 'chunk';
      chunkIndex: number;
      totalRows: number;
      parseErrors: number;
    }
  | {
      status: 'completed';
      fileName: string;
      chunkIndex: number;
      totalRows: number;
      parseErrors: number;
    }
  | { status: 'cancelled' }
  | { status: 'error'; message: string };

const INPUT_FORMATS: Exclude<StreamingFormat, 'sql'>[] = ['csv', 'json', 'excel', 'xml'];
const OUTPUT_FORMATS: StreamingFormat[] = [...INPUT_FORMATS, 'sql'];

const FORMAT_ACCEPT: Record<Exclude<StreamingFormat, 'sql'>, string> = {
  csv: '.csv,text/csv',
  json: '.json,application/json',
  xml: '.xml,application/xml,text/xml',
  excel: '.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

const formatBytes = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

const FORMAT_EXTENSIONS: Record<StreamingFormat, string> = {
  csv: 'csv',
  json: 'json',
  excel: 'xlsx',
  xml: 'xml',
  sql: '.sql',
};

function formatLabel(format: StreamingFormat): string {
  return format === 'excel' ? 'XLSX' : format.toUpperCase();
}

function hasExpectedExtension(file: File, format: StreamingFormat) {
  return file.name.toLowerCase().endsWith(`.${FORMAT_EXTENSIONS[format]}`);
}

export default function StreamingWorkspace() {
  const inputRef = useRef<HTMLInputElement>(null);
  const workerRef = useRef<Worker | null>(null);
  const activeRef = useRef(false);
  const unmountingRef = useRef(false);
  const pendingFileRef = useRef<File | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [inputFormat, setInputFormat] = useState<StreamingFormat>('csv');
  const [outputFormat, setOutputFormat] = useState<StreamingFormat>('json');
  const [sqlMode, setSqlMode] = useState<'insert' | 'update' | 'create'>('insert');
  const [sqlTableName, setSqlTableName] = useState('data');
  const [sqlKeyColumns, setSqlKeyColumns] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [chunks, setChunks] = useState(0);
  const [rows, setRows] = useState(0);
  const [parseErrors, setParseErrors] = useState(0);
  const [outputFileName, setOutputFileName] = useState('');
  const [error, setError] = useState('');
  const [dragging, setDragging] = useState(false);

  const resetResults = useCallback(() => {
    setChunks(0);
    setRows(0);
    setParseErrors(0);
    setOutputFileName('');
    setError('');
  }, []);

  const applyFile = useCallback((selectedFile: File) => {
    setFile(selectedFile);
    setStatus('idle');
    resetResults();
  }, [resetResults]);

  useEffect(() => {
    unmountingRef.current = false;

    const worker = new Worker(
      new URL('../../workers/streaming.worker.ts', import.meta.url),
      { type: 'module' },
    );

    workerRef.current = worker;

    worker.onmessage = (event: MessageEvent<WorkerMessage>) => {
      const message = event.data;

      if (unmountingRef.current) {
        if (
          message.status === 'completed' ||
          message.status === 'cancelled' ||
          message.status === 'error'
        ) {
          activeRef.current = false;
          worker.terminate();
        }
        return;
      }

      if (message.status === 'started') {
        setStatus('processing');
        return;
      }

      if (message.status === 'chunk') {
        setChunks(message.chunkIndex);
        setRows(message.totalRows);
        setParseErrors(message.parseErrors);
        return;
      }

      if (message.status === 'completed') {
        activeRef.current = false;

        const pendingFile = pendingFileRef.current;
        pendingFileRef.current = null;

        if (pendingFile) {
          applyFile(pendingFile);
          return;
        }

        setChunks(message.chunkIndex);
        setRows(message.totalRows);
        setParseErrors(message.parseErrors);
        setOutputFileName(message.fileName);
        setStatus('completed');
        return;
      }

      if (message.status === 'cancelled') {
        activeRef.current = false;

        const pendingFile = pendingFileRef.current;
        pendingFileRef.current = null;

        if (pendingFile) {
          applyFile(pendingFile);
        } else {
          setStatus('cancelled');
        }
        return;
      }

      if (message.status === 'error') {
        activeRef.current = false;

        const pendingFile = pendingFileRef.current;
        pendingFileRef.current = null;

        if (pendingFile) {
          applyFile(pendingFile);
          return;
        }

        setError(message.message);
        setStatus('error');
      }
    };

    worker.onerror = () => {
      activeRef.current = false;

      if (unmountingRef.current) {
        worker.terminate();
        return;
      }

      setError('The background worker encountered an unexpected error.');
      setStatus('error');
    };

    return () => {
      unmountingRef.current = true;
      pendingFileRef.current = null;

      if (activeRef.current) {
        worker.postMessage({ type: 'CANCEL' });
      } else {
        worker.terminate();
      }

      workerRef.current = null;
    };
  }, [applyFile]);

  const selectFile = (selectedFile?: File) => {
    if (!selectedFile) return;

    if (!hasExpectedExtension(selectedFile, inputFormat)) {
      setError(`Please select a .${FORMAT_EXTENSIONS[inputFormat]} file.`);
      setStatus('error');
      return;
    }

    if (activeRef.current) {
      pendingFileRef.current = selectedFile;
      setStatus('cancelling');
      workerRef.current?.postMessage({ type: 'CANCEL' });
      return;
    }

    applyFile(selectedFile);
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    selectFile(event.target.files?.[0]);
    event.target.value = '';
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    selectFile(event.dataTransfer.files?.[0]);
  };

  const changeInputFormat = (value: string) => {
    const nextFormat = value as StreamingFormat;
    setInputFormat(nextFormat);

    if (file && !hasExpectedExtension(file, nextFormat)) {
      setFile(null);
      setStatus('idle');
      resetResults();
    } else {
      setError('');
    }
  };

  const startConversion = () => {
    if (!file || activeRef.current || !workerRef.current) return;

    resetResults();
    setStatus('starting');
    activeRef.current = true;

    const baseName = file.name.replace(/\.[^/.]+$/, '');
    const outputName = `converted_${Date.now()}_${baseName}.${FORMAT_EXTENSIONS[outputFormat]}`;

    try {
      workerRef.current.postMessage({
        type: 'START_CONVERT',
        payload: {
          file,
          inputFormat,
          outputFormat,
          fileName: outputName,
          sqlMode,
          tableName: sqlTableName,
          keyColumns: sqlKeyColumns.split(',').map((key) => key.trim()).filter(Boolean),
        },
      });
    } catch (startError) {
      activeRef.current = false;
      setError(
        startError instanceof Error
          ? startError.message
          : 'Unable to start the conversion.',
      );
      setStatus('error');
    }
  };

  const cancelConversion = () => {
    if (!activeRef.current || status === 'cancelling') return;

    setStatus('cancelling');

    const worker = workerRef.current;
    if (!worker) return;

    worker.postMessage({ type: 'CANCEL' });
  };

  const downloadOutput = async () => {
    if (!outputFileName) return;

    try {
      const rootDir = await navigator.storage.getDirectory();
      const fileHandle = await rootDir.getFileHandle(outputFileName);
      const outputFile = await fileHandle.getFile();
      const url = URL.createObjectURL(outputFile);
      const anchor = document.createElement('a');

      anchor.href = url;
      anchor.download = outputFileName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();

      window.setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (downloadError) {
      setError(
        downloadError instanceof Error
          ? downloadError.message
          : 'Unable to download the converted file.',
      );
      setStatus('error');
    }
  };

  const isBusy =
    status === 'starting' ||
    status === 'processing' ||
    status === 'cancelling';

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-12 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <div className="mx-auto max-w-3xl space-y-8">
        <header className="space-y-2">
          <p className="text-sm font-semibold uppercase tracking-wider text-pink-500">
            Streaming Converter
          </p>
          <h1 className="text-3xl font-bold">Streaming File Converter</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Incremental parsing and local file output.
          </p>
        </header>

        <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-2 text-sm font-medium">
              <span>Input format</span>
              <select
                value={inputFormat}
                onChange={(event) => changeInputFormat(event.target.value)}
                disabled={isBusy}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 dark:border-slate-700 dark:bg-slate-800"
              >
                {INPUT_FORMATS.map((format) => (
                  <option key={format} value={format}>
                    {formatLabel(format)}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2 text-sm font-medium">
              <span>Output format</span>
              <select
                value={outputFormat}
                onChange={(event) => setOutputFormat(event.target.value as StreamingFormat)}
                disabled={isBusy}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 dark:border-slate-700 dark:bg-slate-800"
              >
                {OUTPUT_FORMATS.map((format) => (
                  <option key={format} value={format}>
                    {formatLabel(format)}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {outputFormat === 'sql' && (
            <div className="grid gap-4 rounded-xl border border-pink-200 bg-pink-50/50 p-4 dark:border-pink-900 dark:bg-pink-950/20 sm:grid-cols-2">
              <label className="space-y-2 text-sm font-medium">
                <span>SQL mode</span>
                <select value={sqlMode} onChange={(event) => setSqlMode(event.target.value as typeof sqlMode)} disabled={isBusy} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 dark:border-slate-700 dark:bg-slate-800">
                  <option value="insert">INSERT</option>
                  <option value="create">CREATE TABLE</option>
                  <option value="update">UPDATE</option>
                </select>
              </label>
              <label className="space-y-2 text-sm font-medium">
                <span>Table name</span>
                <input value={sqlTableName} onChange={(event) => setSqlTableName(event.target.value)} disabled={isBusy} placeholder="data" className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 dark:border-slate-700 dark:bg-slate-800" />
              </label>
              {sqlMode !== 'insert' && (
                <label className="space-y-2 text-sm font-medium sm:col-span-2">
                  <span>{sqlMode === 'create' ? 'Primary key columns (optional)' : 'Key columns (required)'}</span>
                  <input value={sqlKeyColumns} onChange={(event) => setSqlKeyColumns(event.target.value)} disabled={isBusy} placeholder="id, code" className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 dark:border-slate-700 dark:bg-slate-800" />
                  <span className="text-xs font-normal text-slate-500">Separate column names with commas.</span>
                </label>
              )}
            </div>
          )}

          <div
            role="button"
            tabIndex={0}
            aria-label={`Select or drop a ${inputFormat.toUpperCase()} file`}
            onClick={() => inputRef.current?.click()}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                inputRef.current?.click();
              }
            }}
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget as Node)) {
                setDragging(false);
              }
            }}
            onDrop={handleDrop}
            className={`cursor-pointer rounded-xl border-2 border-dashed p-10 text-center transition-colors ${
              dragging
                ? 'border-pink-500 bg-pink-50 dark:bg-pink-950/20'
                : 'border-slate-300 hover:border-pink-400 dark:border-slate-700'
            }`}
          >
            <p className="text-lg font-medium">
              Drop a {inputFormat.toUpperCase()} file here or browse
            </p>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              Select a file to begin
            </p>

            {file && (
              <p className="mt-4 break-all text-sm font-medium text-pink-500">
                {file.name} · {formatBytes(file.size)}
              </p>
            )}

            {isBusy && (
              <p className="mt-2 text-xs text-slate-500">
                Selecting another file will cancel the current conversion first.
              </p>
            )}
          </div>

          <input
            ref={inputRef}
            type="file"
            accept={FORMAT_ACCEPT[inputFormat as Exclude<StreamingFormat, 'sql'>]}
            onChange={handleFileChange}
            className="hidden"
          />

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={startConversion}
              disabled={!file || isBusy}
              className="rounded-lg bg-pink-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-pink-600 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Start Conversion
            </button>

            {isBusy && (
              <button
                type="button"
                onClick={cancelConversion}
                disabled={status === 'cancelling'}
                className="rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-medium transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:hover:bg-slate-800"
              >
                {status === 'cancelling' ? 'Cancelling...' : 'Cancel'}
              </button>
            )}
          </div>

          {isBusy && (
            <div className="space-y-2">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {status === 'cancelling'
                  ? 'Waiting for the worker to finish cleanup...'
                  : status === 'starting'
                    ? 'Preparing conversion...'
                    : `Processing ${inputFormat.toUpperCase()} in chunks...`}
              </p>

              {status !== 'cancelling' && (
                <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                  <div className="h-full w-1/3 animate-pulse rounded-full bg-pink-500" />
                </div>
              )}
            </div>
          )}

          {(status === 'processing' || status === 'completed') && (
            <div className="space-y-1 rounded-lg bg-slate-50 p-4 text-sm dark:bg-slate-800">
              <p>Parsed rows: {rows.toLocaleString()}</p>
              <p>Chunks processed: {chunks.toLocaleString()}</p>
              <p>Parse errors: {parseErrors.toLocaleString()}</p>
            </div>
          )}

          {status === 'completed' && (
            <div className="space-y-3">
              <p className="text-sm text-emerald-600">
                {outputFormat.toUpperCase()} file created successfully.
              </p>
              <button
                type="button"
                onClick={downloadOutput}
                className="rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700"
              >
                Download {outputFormat.toUpperCase()}
              </button>
            </div>
          )}

          {status === 'cancelled' && (
            <p className="text-sm text-amber-600">
              Conversion cancelled. Temporary output has been cleaned up.
            </p>
          )}

          {status === 'error' && (
            <p className="rounded-lg bg-red-50 p-4 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-300">
              {error}
            </p>
          )}
        </section>
      </div>
    </main>
  );
}
