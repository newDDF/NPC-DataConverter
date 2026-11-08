export type StreamingFormat = 'csv' | 'json' | 'excel' | 'xml' | 'sql';

export type StreamingTaskState =
  | 'queued'
  | 'active'
  | 'cancelling'
  | 'completing'
  | 'failing'
  | 'completed'
  | 'cancelled'
  | 'error';

export type StreamingWorkerRequest =
  | {
      type: 'START_CONVERT';
      payload: {
        file: File;
        inputFormat: StreamingFormat;
        outputFormat: StreamingFormat;
        fileName: string;
        sqlMode?: 'insert' | 'update' | 'create';
        tableName?: string;
        keyColumns?: string[];

      };
    }
  | {
      type: 'CANCEL';
    };

export type StreamingWorkerResponse =
  | {
      type: 'started';
      inputFormat: StreamingFormat;
      outputFormat: StreamingFormat;
      fileName: string;
    }
  | {
      type: 'progress';
      chunks: number;
      rows: number;
      parseErrors: number;
      processedBytes: number;
      totalBytes: number;
      outputBytes: number;
    }
  | {
      type: 'completed';
      chunks: number;
      rows: number;
      parseErrors: number;
      processedBytes: number;
      outputBytes: number;
      fileName: string;
      outputFormat: StreamingFormat;
    }
  | {
      type: 'cancelled';
    }
  | {
      type: 'error';
      message: string;
    };

export type StreamingConversionConfig = {
  inputFormat: StreamingFormat;
  outputFormat: StreamingFormat;
  file: File;
  outputFileName: string;
  sqlMode?: 'insert' | 'update' | 'create';
  tableName?: string;
  keyColumns?: string[];

};

export type StreamingProgress = {
  chunks: number;
  rows: number;
  parseErrors: number;
  processedBytes: number;
  totalBytes: number;
  outputBytes: number;
};
