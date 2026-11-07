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

import { CsvWriter } from '../writers/csv-writer';
import { JsonWriter } from '../writers/json-writer';
import { XmlWriter } from '../writers/xml-writer';

export type StreamingPipelineOptions = {
  file: File;
  inputFormat: StreamingFormat;
  outputFormat: StreamingFormat;
  sink: StreamingOutputSink;
  batchSize?: number;
  signal?: AbortSignal;
  onProgress?: (progress: StreamingProgress) => void;
};

export type StreamingPipelineResult = StreamingProgress;

const readers: Partial<Record<StreamingFormat, () => StreamingReader>> = {
  csv: () => new CsvReader(),
  json: () => new JsonReader(),
  xml: () => new XmlReader(),
};

const writers: Partial<Record<StreamingFormat, () => StreamingWriter>> = {
  csv: () => new CsvWriter(),
  json: () => new JsonWriter(),
  xml: () => new XmlWriter(),
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

    session = await writer.create(countingSink);

    for await (const batch of reader.read(file, {
      batchSize,
      signal,
    })) {
      if (signal?.aborted) {
        throw createAbortError();
      }

      await session.write(batch.rows);

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
