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
    options: WriterOptions = {},
  ): Promise<StreamingWriterSession> {
    const indent = options.jsonIndent ?? 0;

    if (!Number.isInteger(indent) || indent < 0 || indent > 10) {
      throw new RangeError(
        'JSON indentation must be an integer from 0 to 10.',
      );
    }

    const pretty = indent > 0;
    const outerIndent = ' '.repeat(indent);

    let closed = false;
    let firstRecord = true;

    return {
      async write(rows: StreamingRecord[]): Promise<void> {
        if (closed) {
          throw new Error('JSON writer is already closed');
        }

        if (rows.length === 0) return;

        const serialized = rows.map((row) =>
          JSON.stringify(row, null, indent)
        );

        if (serialized.some((value) => value === undefined)) {
          throw new TypeError('JSON records must be serializable values.');
        }

        const records = pretty
          ? serialized.map((value) =>
              value.replace(/\n/g, `\n${outerIndent}`)
            )
          : serialized;

        const output = pretty
          ? firstRecord
            ? `[\n${outerIndent}${records.join(`,\n${outerIndent}`)}`
            : `,\n${outerIndent}${records.join(`,\n${outerIndent}`)}`
          : firstRecord
            ? `[${records.join(',')}`
            : `,${records.join(',')}`;

        await sink.write(output);
        firstRecord = false;
      },

      async close(): Promise<void> {
        if (closed) return;

        await sink.write(
          firstRecord ? '[]' : pretty ? '\n]' : ']',
        );
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
