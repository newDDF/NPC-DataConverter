import type {
  StreamingOutputSink,
  StreamingReader,
  StreamingWriter,
  StreamingWriterSession,
} from './contracts';
import type {
  StreamingFormat,
  StreamingProgress,
} from '../types';

import { CsvReader } from '../readers/csv-reader';
import { JsonReader } from '../readers/json-reader';
import { XmlReader } from '../readers/xml-reader';
import { XlsxReader } from '../readers/xlsx-reader';

import { CsvWriter } from '../writers/csv-writer';
import { JsonWriter } from '../writers/json-writer';
import { XmlWriter } from '../writers/xml-writer';
import { XlsxWriter } from '../writers/xlsx-writer';
import { SqlWriter } from '../writers/sql-writer';

export type StreamingPipelineOptions = {
  file: File;
  inputFormat: StreamingFormat;
  outputFormat: StreamingFormat;
  sink: StreamingOutputSink;
  batchSize?: number;
  signal?: AbortSignal;
  selectedFields?: string[];
  fieldRenames?: Record<string, string>;
  jsonIndent?: number;
  sqlMode?: 'insert' | 'update' | 'create';
  tableName?: string;
  keyColumns?: string[];
  onProgress?: (progress: StreamingProgress) => void;
};

export type StreamingPipelineResult = StreamingProgress;

const readers: Partial<Record<StreamingFormat, () => StreamingReader>> = {
  csv: () => new CsvReader(),
  json: () => new JsonReader(),
  xml: () => new XmlReader(),
  excel: () => new XlsxReader(),
};

const writers: Partial<Record<StreamingFormat, () => StreamingWriter>> = {
  csv: () => new CsvWriter(),
  json: () => new JsonWriter(),
  xml: () => new XmlWriter(),
  excel: () => new XlsxWriter(),
  sql: () => new SqlWriter(),
};

function createAbortError(): DOMException {
  return new DOMException('The operation was aborted.', 'AbortError');
}

function getReader(format: StreamingFormat): StreamingReader {
  const factory = readers[format];

  if (!factory) {
    throw new Error(`Streaming input format is not supported: ${format}`);
  }

  return factory();
}

function getWriter(format: StreamingFormat): StreamingWriter {
  const factory = writers[format];

  if (!factory) {
    throw new Error(`Streaming output format is not supported: ${format}`);
  }

  return factory();
}

export type StreamingInspection = {
  fields: string[];
  previewRows: Record<string, unknown>[];
  rowsInspected: number;
  previewTruncated: boolean;
};

export type StreamingInspectionOptions = {
  maxRows?: number;
  maxPreviewRows?: number;
  maxPreviewBytes?: number;
};

export async function inspectStreamingFile(
  file: File,
  inputFormat: StreamingFormat,
  options: StreamingInspectionOptions = {},
): Promise<StreamingInspection> {
  const maxRows = options.maxRows ?? 100;
  const maxPreviewRows = options.maxPreviewRows ?? 20;
  const maxPreviewBytes = options.maxPreviewBytes ?? 256 * 1024;

  if (!Number.isInteger(maxRows) || maxRows <= 0) {
    throw new RangeError('maxRows must be a positive integer.');
  }

  if (!Number.isInteger(maxPreviewRows) || maxPreviewRows <= 0) {
    throw new RangeError('maxPreviewRows must be a positive integer.');
  }

  if (!Number.isInteger(maxPreviewBytes) || maxPreviewBytes <= 0) {
    throw new RangeError('maxPreviewBytes must be a positive integer.');
  }

  const reader = getReader(inputFormat);
  const iterator = reader.read(file, { batchSize: maxRows })[Symbol.asyncIterator]();
  const fields = new Set<string>();
  const previewRows: Record<string, unknown>[] = [];
  const encoder = new TextEncoder();

  let rowsInspected = 0;
  let previewBytes = 0;
  let previewTruncated = false;

  try {
    const result = await iterator.next();

    if (result.done) {
      return {
        fields: [],
        previewRows: [],
        rowsInspected: 0,
        previewTruncated: false,
      };
    }

    const rows = result.value.rows.slice(0, maxRows);
    rowsInspected = rows.length;

    for (const row of rows) {
      for (const field of Object.keys(row)) {
        fields.add(field);
      }
    }

    for (const row of rows) {
      if (previewRows.length >= maxPreviewRows) {
        previewTruncated = true;
        break;
      }

      const rowBytes = encoder.encode(JSON.stringify(row)).byteLength;

      if (previewBytes + rowBytes > maxPreviewBytes) {
        previewTruncated = true;
        break;
      }

      previewRows.push(row);
      previewBytes += rowBytes;
    }

    if (rows.length > previewRows.length) {
      previewTruncated = true;
    }

    return {
      fields: [...fields],
      previewRows,
      rowsInspected,
      previewTruncated,
    };
  } finally {
    await iterator.return?.();
  }
}

export async function convertStreamingFile(
  options: StreamingPipelineOptions,
): Promise<StreamingPipelineResult> {
  const {
    file,
    inputFormat,
    outputFormat,
    sink,
    batchSize,
    signal,
    selectedFields,
    fieldRenames,
    jsonIndent,
    onProgress,
  } = options;

  let outputBytes = 0;
  let chunks = 0;
  let rows = 0;
  let parseErrors = 0;
  let processedBytes = 0;

  let session: StreamingWriterSession | null = null;
  let completed = false;

  const countingSink: StreamingOutputSink = {
    async write(data) {
      await sink.write(data);

      outputBytes +=
        typeof data === 'string'
          ? new TextEncoder().encode(data).byteLength
          : data.byteLength;
    },

    async close() {
      await sink.close();
    },

    async abort(reason) {
      await sink.abort(reason);
    },
  };

  const reportProgress = () => {
    onProgress?.({
      chunks,
      rows,
      parseErrors,
      processedBytes,
      totalBytes: file.size,
      outputBytes,
    });
  };

  try {
    if (signal?.aborted) {
      throw createAbortError();
    }

    const reader = getReader(inputFormat);
    const writer = getWriter(outputFormat);

    session = await writer.create(countingSink, {
      jsonIndent,
      sqlMode: options.sqlMode,
      tableName: options.tableName,
      keyColumns: options.keyColumns,
    });

    for await (const batch of reader.read(file, {
      batchSize,
      signal,
    })) {
      if (signal?.aborted) {
        throw createAbortError();
      }

      const outputRows = selectedFields === undefined
        ? batch.rows
        : batch.rows.map((row) => {
            const output: Record<string, unknown> = {};
            const outputFields = new Set<string>();

            for (const field of selectedFields) {
              if (Object.prototype.hasOwnProperty.call(row, field)) {
                const outputField = fieldRenames?.[field] ?? field;

                if (outputFields.has(outputField)) {
                  throw new Error(
                    `Duplicate output field name: ${outputField}`,
                  );
                }

                outputFields.add(outputField);
                output[outputField] = row[field];
              }
            }

            return output;
          });

      await session.write(outputRows);

      chunks += 1;
      rows += batch.rows.length;
      parseErrors += batch.parseErrors;
      processedBytes += batch.processedBytes;

      reportProgress();
    }

    if (signal?.aborted) {
      throw createAbortError();
    }

    await session.close();
    completed = true;

    reportProgress();

    return {
      chunks,
      rows,
      parseErrors,
      processedBytes,
      totalBytes: file.size,
      outputBytes,
    };
  } catch (error) {
    if (!completed) {
      try {
        if (session) {
          await session.abort(error);
        } else {
          await countingSink.abort(error);
        }
      } catch {
        // Preserve the original conversion error.
      }
    }

    throw error;
  }
}
