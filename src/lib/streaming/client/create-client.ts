import type { StreamingFormat } from '../types';
import type {
  StreamingClient,
  StreamingClientConfig,
  StreamingClientProgress,
  StreamingClientResult,
  StreamingPreview,
  StreamingInspection,
} from './types';

const OUTPUT_EXTENSIONS: Record<StreamingFormat, string> = {
  csv: 'csv',
  json: 'json',
  xml: 'xml',
  excel: 'xlsx',
  sql: '.sql',
};

const DEFAULT_PREVIEW_BYTES = 5 * 1024 * 1024;

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

function createAbortError(): DOMException {
  return new DOMException('The operation was aborted.', 'AbortError');
}

function createOutputFileName(format: StreamingFormat): string {
  return `stream-${crypto.randomUUID()}.${OUTPUT_EXTENSIONS[format]}`;
}

async function getOutputHandle(fileName: string) {
  const root = await navigator.storage.getDirectory();
  return root.getFileHandle(fileName);
}

export function inspectStreamingFile(
  file: File,
  inputFormat: StreamingFormat,
  options: {
    maxRows?: number;
    maxPreviewRows?: number;
    maxPreviewBytes?: number;
  } = {},
): Promise<StreamingInspection> {
  type InspectionMessage =
    | {
        status: 'inspected';
        fields: string[];
        previewRows: Record<string, unknown>[];
        rowsInspected: number;
        previewTruncated: boolean;
      }
    | { status: 'error'; message: string };

  return new Promise((resolve, reject) => {
    const worker = new Worker(
      new URL('../../../workers/streaming.worker.ts', import.meta.url),
      { type: 'module' },
    );

    let settled = false;

    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      worker.terminate();
      callback();
    };

    worker.onmessage = (event: MessageEvent<InspectionMessage>) => {
      const message = event.data;

      if (message.status === 'inspected') {
        finish(() => {
          resolve({
            fields: message.fields,
            previewRows: message.previewRows,
            rowsInspected: message.rowsInspected,
            previewTruncated: message.previewTruncated,
          });
        });
        return;
      }

      if (message.status === 'error') {
        finish(() => reject(new Error(message.message)));
      }
    };

    worker.onerror = () => {
      finish(() => {
        reject(
          new Error('The background worker encountered an unexpected error.'),
        );
      });
    };

    try {
      worker.postMessage({
        type: 'INSPECT_FILE',
        payload: {
          file,
          inputFormat,
          options,
        },
      });
    } catch (error) {
      finish(() => reject(error));
    }
  });
}

export function createStreamingClient(
  config: StreamingClientConfig,
): StreamingClient {
  const {
    file,
    inputFormat,
    outputFormat,
    selectedFields,
    fieldRenames,
    jsonIndent,
    sqlMode,
    tableName,
    keyColumns,
    onProgress,
  } = config;
  const fileName = createOutputFileName(outputFormat);

  const worker = new Worker(
    new URL('../../../workers/streaming.worker.ts', import.meta.url),
    { type: 'module' },
  );

  let started = false;
  let cancelRequested = false;
  let cancelSent = false;
  let settled = false;

  let resolvePromise!: (result: StreamingClientResult) => void;
  let rejectPromise!: (error: unknown) => void;

  const promise = new Promise<StreamingClientResult>((resolve, reject) => {
    resolvePromise = resolve;
    rejectPromise = reject;
  });

  const terminate = () => {
    if (settled) return;
    settled = true;
    worker.terminate();
  };

  const sendCancel = () => {
    if (!started || cancelSent || settled) return;

    cancelSent = true;
    worker.postMessage({ type: 'CANCEL' });
  };

  worker.onmessage = (event: MessageEvent<WorkerMessage>) => {
    const message = event.data;

    if (message.status === 'started') {
      started = true;

      if (cancelRequested) {
        sendCancel();
      }

      return;
    }

    if (message.status === 'chunk') {
      const progress: StreamingClientProgress = {
        chunks: message.chunkIndex,
        rows: message.totalRows,
        parseErrors: message.parseErrors,
      };

      onProgress?.(progress);
      return;
    }

    if (message.status === 'completed') {
      const result: StreamingClientResult = {
        fileName: message.fileName,
        outputFormat,
        chunks: message.chunkIndex,
        rows: message.totalRows,
        parseErrors: message.parseErrors,
      };

      onProgress?.({
        chunks: result.chunks,
        rows: result.rows,
        parseErrors: result.parseErrors,
      });

      terminate();
      resolvePromise(result);
      return;
    }

    if (message.status === 'cancelled') {
      terminate();
      rejectPromise(createAbortError());
      return;
    }

    if (message.status === 'error') {
      terminate();
      rejectPromise(new Error(message.message));
    }
  };

  worker.onerror = () => {
    terminate();
    rejectPromise(
      new Error('The background worker encountered an unexpected error.'),
    );
  };

  try {
    worker.postMessage({
      type: 'START_CONVERT',
      payload: {
        file,
        inputFormat,
        outputFormat,
        fileName,
        selectedFields,
        fieldRenames,
        jsonIndent,
        sqlMode,
        tableName,
        keyColumns,
      },
    });
  } catch (error) {
    terminate();
    rejectPromise(error);
  }

  const getOutputFile = async (): Promise<File> => {
    const handle = await getOutputHandle(fileName);
    return handle.getFile();
  };

  const readPreview = async (
    maxBytes = DEFAULT_PREVIEW_BYTES,
  ): Promise<StreamingPreview> => {
    if (outputFormat === 'excel') {
      throw new Error('Binary XLSX output cannot be displayed as text.');
    }

    const outputFile = await getOutputFile();
    const previewFile = outputFile.slice(0, maxBytes);

    return {
      text: await previewFile.text(),
      truncated: outputFile.size > maxBytes,
      size: outputFile.size,
    };
  };

  const download = async (): Promise<void> => {
    const outputFile = await getOutputFile();
    const url = URL.createObjectURL(outputFile);
    const anchor = document.createElement('a');

    anchor.href = url;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();

    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const removeOutput = async (): Promise<void> => {
    const root = await navigator.storage.getDirectory();

    try {
      await root.removeEntry(fileName);
    } catch (error) {
      if (
        error instanceof DOMException &&
        error.name === 'NotFoundError'
      ) {
        return;
      }

      throw error;
    }
  };

  return {
    promise,
    cancel: () => {
      if (settled || cancelRequested) return;

      cancelRequested = true;
      sendCancel();
    },
    getOutputFile,
    readPreview,
    download,
    removeOutput,
  };
}
