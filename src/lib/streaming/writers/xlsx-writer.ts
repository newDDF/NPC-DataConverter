import type {
  StreamingOutputSink,
  StreamingRecord,
  StreamingWriter,
  StreamingWriterSession,
} from '../core/contracts';
import { ZipStoreWriter } from '../xlsx/zip';

const encoder = new TextEncoder();

const MAX_COLUMNS = 16_384;
const MAX_ROWS = 1_048_576;

class AsyncByteQueue implements AsyncIterable<Uint8Array> {
  private chunks: Uint8Array[] = [];
  private readWaiters: Array<() => void> = [];
  private capacityWaiters: Array<() => void> = [];
  private ended = false;
  private failure: unknown;

  async push(value: Uint8Array): Promise<void> {
    while (this.chunks.length > 0 && !this.ended) {
      await new Promise<void>((resolve) => {
        this.capacityWaiters.push(resolve);
      });
    }

    if (this.failure !== undefined) {
      throw this.failure;
    }

    if (this.ended) {
      throw new Error('Cannot write to a closed XLSX output queue.');
    }

    this.chunks.push(value);
    this.wake(this.readWaiters);
  }

  end(): void {
    this.ended = true;
    this.wake(this.readWaiters);
    this.wake(this.capacityWaiters);
  }

  fail(reason: unknown): void {
    this.failure = reason ?? new Error('XLSX output was aborted.');
    this.ended = true;
    this.wake(this.readWaiters);
    this.wake(this.capacityWaiters);
  }

  async *[Symbol.asyncIterator](): AsyncGenerator<Uint8Array> {
    while (true) {
      if (this.chunks.length > 0) {
        const chunk = this.chunks.shift()!;
        this.wake(this.capacityWaiters);
        yield chunk;
        continue;
      }

      if (this.failure !== undefined) {
        throw this.failure;
      }

      if (this.ended) {
        return;
      }

      await new Promise<void>((resolve) => {
        this.readWaiters.push(resolve);
      });
    }
  }

  private wake(waiters: Array<() => void>): void {
    const pending = waiters.splice(0);
    for (const resolve of pending) {
      resolve();
    }
  }
}

const INVALID_XML_10_CHARACTERS =
  /[^\u0009\u000A\u000D\u0020-\uD7FF\uE000-\uFFFD\u{10000}-\u{10FFFF}]/u;

function escapeXml(value: string): string {
  if (INVALID_XML_10_CHARACTERS.test(value)) {
    throw new Error('Cell values contain characters that are invalid in XML.');
  }

  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
    .replace(/\r/g, '&#13;');
}

function columnName(index: number): string {
  let value = index + 1;
  let result = '';

  while (value > 0) {
    const remainder = (value - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    value = Math.floor((value - 1) / 26);
  }

  return result;
}

function serializeCell(reference: string, value: unknown): string {
  if (value === null || value === undefined) {
    return `<c r="${reference}"/>`;
  }

  if (typeof value === 'boolean') {
    return `<c r="${reference}" t="b"><v>${value ? 1 : 0}</v></c>`;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return `<c r="${reference}"><v>${String(value)}</v></c>`;
  }

  let text: string;

  if (typeof value === 'string') {
    text = value;
  } else if (typeof value === 'object') {
    const serialized = JSON.stringify(value);
    text = serialized === undefined ? String(value) : serialized;
  } else {
    text = String(value);
  }

  return `<c r="${reference}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(text)}</t></is></c>`;
}

function serializeRow(
  rowNumber: number,
  values: unknown[],
): string {
  const cells = values
    .map((value, index) =>
      serializeCell(`${columnName(index)}${rowNumber}`, value),
    )
    .join('');

  return `<row r="${rowNumber}">${cells}</row>`;
}

const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
</Types>`;

const ROOT_RELATIONSHIPS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;

const WORKBOOK = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="Sheet1" sheetId="1" r:id="rId1"/>
  </sheets>
</workbook>`;

const WORKBOOK_RELATIONSHIPS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
</Relationships>`;

const WORKSHEET_PREFIX = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetData>`;

const WORKSHEET_SUFFIX = `</sheetData>
</worksheet>`;

export class XlsxWriter implements StreamingWriter {
  readonly format = 'excel' as const;

  async create(
    sink: StreamingOutputSink,
  ): Promise<StreamingWriterSession> {
    const zip = new ZipStoreWriter((chunk) => sink.write(chunk));

    try {
      await zip.addEntry('[Content_Types].xml', CONTENT_TYPES);
      await zip.addEntry('_rels/.rels', ROOT_RELATIONSHIPS);
      await zip.addEntry('xl/workbook.xml', WORKBOOK);
      await zip.addEntry(
        'xl/_rels/workbook.xml.rels',
        WORKBOOK_RELATIONSHIPS,
      );
    } catch (error) {
      await sink.abort(error);
      throw error;
    }

    const queue = new AsyncByteQueue();
    let zipError: unknown;
    const worksheetTask = zip
      .addEntry('xl/worksheets/sheet1.xml', queue)
      .catch((error: unknown) => {
        zipError = error;
        queue.fail(error);
      });

    try {
      await queue.push(encoder.encode(WORKSHEET_PREFIX));
    } catch (error) {
      queue.fail(error);
      await worksheetTask;
      await sink.abort(error);
      throw error;
    }

    let closed = false;
    let headers: string[] | undefined;
    let rowCount = 0;

    const abortSink = async (reason?: unknown): Promise<void> => {
      queue.fail(reason);
      await worksheetTask;
      await sink.abort(reason);
    };

    return {
      write: async (rows: StreamingRecord[]): Promise<void> => {
        if (closed) {
          throw new Error('Cannot write to a closed XLSX writer.');
        }

        if (zipError !== undefined) {
          throw zipError;
        }

        if (rows.length === 0) {
          return;
        }

        try {
          if (!headers) {
            headers = Object.keys(rows[0]);

            if (headers.length > MAX_COLUMNS) {
              throw new Error(
                `XLSX worksheets support up to ${MAX_COLUMNS} columns.`,
              );
            }

            rowCount = 1;
            await queue.push(
              encoder.encode(serializeRow(rowCount, headers)),
            );
          }

          for (const record of rows) {
            if (rowCount >= MAX_ROWS) {
              throw new Error(
                `XLSX worksheets support up to ${MAX_ROWS} rows, including the header.`,
              );
            }

            rowCount += 1;
            const values = headers.map((header) => record[header]);
            await queue.push(
              encoder.encode(serializeRow(rowCount, values)),
            );
          }
        } catch (error) {
          queue.fail(error);
          throw error;
        }
      },

      close: async (): Promise<void> => {
        if (closed) {
          return;
        }

        closed = true;

        try {
          if (zipError !== undefined) {
            throw zipError;
          }

          await queue.push(encoder.encode(WORKSHEET_SUFFIX));
          queue.end();
          await worksheetTask;

          if (zipError !== undefined) {
            throw zipError;
          }

          await zip.close();
          await sink.close();
        } catch (error) {
          await abortSink(error);
          throw error;
        }
      },

      abort: async (reason?: unknown): Promise<void> => {
        if (closed) {
          return;
        }

        closed = true;
        await abortSink(reason);
      },
    };
  }
}
