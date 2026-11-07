import type {
  StreamingOutputSink,
  StreamingRecord,
  StreamingWriter,
  StreamingWriterSession,
  WriterOptions,
} from '../core/contracts';

export class JsonWriter implements StreamingWriter {
  readonly format = 'json' as const;

  async create(
    sink: StreamingOutputSink,
    _options: WriterOptions = {},
  ): Promise<StreamingWriterSession> {
    let closed = false;
    let firstRecord = true;

    return {
      async write(rows: StreamingRecord[]): Promise<void> {
        if (closed) {
          throw new Error('JSON writer is already closed');
        }

        if (rows.length === 0) return;

        const serialized = rows.map((row) => JSON.stringify(row));

        if (serialized.some((value) => value === undefined)) {
          throw new TypeError('JSON records must be serializable values.');
        }

        const output = firstRecord
          ? `[${serialized.join(',')}`
          : `,${serialized.join(',')}`;

        await sink.write(output);
        firstRecord = false;
      },

      async close(): Promise<void> {
        if (closed) return;

        await sink.write(firstRecord ? '[]' : ']');
        await sink.close();
        closed = true;
      },

      async abort(reason?: unknown): Promise<void> {
        if (closed) return;

        closed = true;
        await sink.abort(reason);
      },
    };
  }
}
