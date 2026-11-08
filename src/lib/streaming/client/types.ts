import type { StreamingFormat } from '../types';

export type StreamingInspection = {
  fields: string[];
  previewRows: Record<string, unknown>[];
  rowsInspected: number;
  previewTruncated: boolean;
};

export type StreamingClientProgress = {
  chunks: number;
  rows: number;
  parseErrors: number;
};

export type StreamingClientConfig = {
  file: File;
  inputFormat: StreamingFormat;
  outputFormat: StreamingFormat;
  selectedFields?: string[];
  fieldRenames?: Record<string, string>;
  jsonIndent?: number;
  sqlMode?: 'insert' | 'update' | 'create';
  tableName?: string;
  keyColumns?: string[];
  onProgress?: (progress: StreamingClientProgress) => void;
};

export type StreamingClientResult = StreamingClientProgress & {
  fileName: string;
  outputFormat: StreamingFormat;
};

export type StreamingPreview = {
  text: string;
  truncated: boolean;
  size: number;
};

export type StreamingClient = {
  promise: Promise<StreamingClientResult>;
  cancel: () => void;
  getOutputFile: () => Promise<File>;
  readPreview: (maxBytes?: number) => Promise<StreamingPreview>;
  download: () => Promise<void>;
  removeOutput: () => Promise<void>;
};
