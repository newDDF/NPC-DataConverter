import type { StreamingFormat } from '../types';

export type StreamingRecord = Record<string, unknown>;

export type ReaderOptions = {
  signal?: AbortSignal;
  batchSize?: number;
};

export type ReaderBatch = {
  rows: StreamingRecord[];
  parseErrors: number;
  processedBytes: number;
};

export interface StreamingReader {
  readonly format: StreamingFormat;

  read(
    file: File,
    options?: ReaderOptions,
  ): AsyncIterable<ReaderBatch>;
}

export interface StreamingOutputSink {
  write(data: string | Uint8Array): Promise<void>;
  close(): Promise<void>;
  abort(reason?: unknown): Promise<void>;
}

export type WriterOptions = {
  fileName?: string;
  jsonIndent?: number;
  sqlMode?: 'insert' | 'update' | 'create';
  tableName?: string;
  keyColumns?: string[];
};

export interface StreamingWriterSession {
  write(rows: StreamingRecord[]): Promise<void>;
  close(): Promise<void>;
  abort(reason?: unknown): Promise<void>;
}

export interface StreamingWriter {
  readonly format: StreamingFormat;

  create(
    sink: StreamingOutputSink,
    options?: WriterOptions,
  ): Promise<StreamingWriterSession>;
}
