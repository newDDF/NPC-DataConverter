import Papa from 'papaparse';
import type {
  StreamingOutputSink,
  StreamingRecord,
  StreamingWriter,
  StreamingWriterSession,
  WriterOptions,
} from '../core/contracts';

export class CsvWriter implements StreamingWriter {
  readonly format = 'csv' as const;

  async create(
    sink: StreamingOutputSink,
    _options: WriterOptions = {},
  ): Promise<StreamingWriterSession> {
    let columns: string[] | null = null;
    let firstBatch = true;
    let closed = false;

    return {
      async write(rows: StreamingRecord[]): Promise<void> {
        if (closed) {
          throw new Error('CSV writer is already closed');
        }

        if (rows.length === 0) return;

        if (columns === null) {
          columns = Array.from(
            new Set(rows.flatMap((row) => Object.keys(row))),
          );
        } else {
          const knownColumns = new Set(columns);

          for (const row of rows) {
            for (const column of Object.keys(row)) {
              if (!knownColumns.has(column)) {
                throw new Error(`Unexpected CSV column: ${column}`);
              }
            }
          }
        }

        const data = rows.map((row) =>
          columns!.map((column) => {
            const value = row[column];

            if (value === null || value === undefined) {
              return '';
            }

            if (typeof value === 'object') {
              return JSON.stringify(value);
            }

            return value;
          }),
        );

        const output = Papa.unparse(
          {
            fields: columns,
            data,
          },
          {
            header: firstBatch,
            newline: '\r\n',
          },
        );

        if (output.length > 0) {
          await sink.write(
            firstBatch ? `${output}\r\n` : `${output}\r\n`,
          );
        }

        firstBatch = false;
      },

      async close(): Promise<void> {
        if (closed) return;
        closed = true;

        if (columns === null) {
          await sink.write('');
        }

        await sink.close();
      },

      async abort(reason?: unknown): Promise<void> {
        if (closed) return;
        closed = true;
        await sink.abort(reason);
      },
    };
  }
}
