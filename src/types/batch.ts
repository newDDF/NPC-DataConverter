import type { DataFormat } from '@/types/converter';

export type BatchTaskStatus = 'waiting' | 'processing' | 'completed' | 'failed';

export interface BatchTask {
  id: string;
  file: File;
  name: string;
  size: number;
  sourceFormat: DataFormat | null;
  outputFormat: DataFormat | null;
  status: BatchTaskStatus;
  sourcePreview: string;
  sourceData?: string;
  outputText: string;
  outputBlob: Blob | null;
  error: string;
  recordCount: number;
}
