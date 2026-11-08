import { SaxesParser } from 'saxes';
import type {
  ReaderBatch,
  ReaderOptions,
  StreamingReader,
  StreamingRecord,
} from '../core/contracts';
import { readZipDirectory, readZipEntry } from '../xlsx/zip';

const MAX_XLSX_TOTAL_UNCOMPRESSED_BYTES = 512 * 1024 * 1024;
const MAX_SHARED_STRING_COUNT = 2_000_000;
const MAX_SHARED_STRING_TOTAL_CHARS = 128 * 1024 * 1024;
const MAX_SHARED_STRING_LENGTH = 4 * 1024 * 1024;

type XmlHandlers = {
  opentag?: (name: string, attributes: Record<string, string>) => void;
  text?: (value: string) => void;
  closetag?: (name: string) => void;
};

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new DOMException('The operation was aborted.', 'AbortError');
  }
}

function normalizePath(path: string): string {
  const parts: string[] = [];

  for (const part of path.replace(/\\/g, '/').split('/')) {
    if (!part || part === '.') continue;
    if (part === '..') {
      parts.pop();
    } else {
      parts.push(part);
    }
  }

  return parts.join('/');
}

function resolveWorksheetPath(target: string): string {
  if (target.startsWith('/')) {
    return normalizePath(target);
  }

  return normalizePath(
    target.startsWith('xl/') ? target : `xl/${target}`,
  );
}

async function parseXmlEntry(
  file: File,
  entryName: string,
  entries: Awaited<ReturnType<typeof readZipDirectory>>,
  signal: AbortSignal | undefined,
  handlers: XmlHandlers,
): Promise<number> {
  const entry = entries.find((item) => item.name === entryName);

  if (!entry) {
    throw new Error(`Required XLSX entry not found: ${entryName}`);
  }

  const parser = new SaxesParser({ xmlns: false });
  let parserError: Error | null = null;
  let processedBytes = 0;

  parser.on('opentag', (tag) => {
    handlers.opentag?.(
      tag.name,
      tag.attributes as Record<string, string>,
    );
  });

  parser.on('text', (value) => handlers.text?.(value));
  parser.on('cdata', (value) => handlers.text?.(value));
  parser.on('closetag', (tag) => handlers.closetag?.(tag.name));
  parser.on('error', (error) => {
    parserError ??= error;
  });

  const textDecoder = new TextDecoder('utf-8');

  for await (const chunk of readZipEntry(file, entry, signal)) {
    throwIfAborted(signal);
    processedBytes += chunk.byteLength;

    parser.write(textDecoder.decode(chunk, { stream: true }));

    if (parserError) {
      throw parserError;
    }
  }

  parser.write(textDecoder.decode());
  parser.close();

  if (parserError) {
    throw parserError;
  }

  return processedBytes;
}

async function readWorkbookSheet(
  file: File,
  entries: Awaited<ReturnType<typeof readZipDirectory>>,
  signal?: AbortSignal,
): Promise<string> {
  let relationshipId = '';

  await parseXmlEntry(
    file,
    'xl/workbook.xml',
    entries,
    signal,
    {
      opentag(name, attributes) {
        if (name === 'sheet' && !relationshipId) {
          relationshipId = attributes['r:id'] ?? '';
        }
      },
    },
  );

  if (!relationshipId) {
    throw new Error('XLSX workbook does not contain a worksheet.');
  }

  let worksheetTarget = '';

  await parseXmlEntry(
    file,
    'xl/_rels/workbook.xml.rels',
    entries,
    signal,
    {
      opentag(name, attributes) {
        if (
          name === 'Relationship' &&
          attributes.Id === relationshipId
        ) {
          worksheetTarget = attributes.Target ?? '';
          if (attributes.TargetMode === 'External') {
            throw new Error('External XLSX worksheets are not supported.');
          }
        }
      },
    },
  );

  if (!worksheetTarget) {
    throw new Error('Unable to resolve the XLSX worksheet path.');
  }

  const path = resolveWorksheetPath(worksheetTarget);

  if (!entries.some((entry) => entry.name === path)) {
    throw new Error(`XLSX worksheet entry not found: ${path}`);
  }

  return path;
}

async function readSharedStrings(
  file: File,
  entries: Awaited<ReturnType<typeof readZipDirectory>>,
  signal?: AbortSignal,
): Promise<{ values: string[]; processedBytes: number }> {
  if (!entries.some((entry) => entry.name === 'xl/sharedStrings.xml')) {
    return { values: [], processedBytes: 0 };
  }

  const values: string[] = [];
  let inString = false;
  let inText = false;
  let current = '';
  let totalCharacters = 0;

  const processedBytes = await parseXmlEntry(
    file,
    'xl/sharedStrings.xml',
    entries,
    signal,
    {
      opentag(name) {
        if (name === 'si') {
          inString = true;
          current = '';
        } else if (name === 't' && inString) {
          inText = true;
        }
      },
      text(value) {
        if (inString && inText) {
          if (current.length + value.length > MAX_SHARED_STRING_LENGTH) {
            throw new Error('XLSX shared string exceeds the configured size limit.');
          }
          current += value;
        }
      },
      closetag(name) {
        if (name === 't') {
          inText = false;
        } else if (name === 'si') {
          if (values.length >= MAX_SHARED_STRING_COUNT) {
            throw new Error('XLSX shared string count exceeds the configured limit.');
          }
          totalCharacters += current.length;
          if (totalCharacters > MAX_SHARED_STRING_TOTAL_CHARS) {
            throw new Error('XLSX shared strings exceed the configured total size limit.');
          }
          values.push(current);
          inString = false;
          inText = false;
        }
      },
    },
  );

  return { values, processedBytes };
}

function columnIndex(reference: string): number {
  const match = /^([A-Z]{1,3})([1-9]\d*)$/i.exec(reference);

  if (!match) {
    throw new Error(`Invalid XLSX cell reference: ${reference}`);
  }

  let result = 0;

  for (const character of match[1].toUpperCase()) {
    result = result * 26 + character.charCodeAt(0) - 64;
  }

  const row = Number(match[2]);

  if (result < 1 || result > 16_384 || row > 1_048_576) {
    throw new Error(`XLSX cell reference is outside worksheet limits: ${reference}`);
  }

  return result - 1;
}

function parseCellValue(
  value: string,
  type: string,
  sharedStrings: string[],
): unknown {
  switch (type) {
    case 's': {
      const index = Number(value);

      if (
        !Number.isInteger(index) ||
        index < 0 ||
        index >= sharedStrings.length
      ) {
        throw new Error(`Invalid XLSX shared string index: ${value}`);
      }

      return sharedStrings[index];
    }
    case 'inlineStr':
    case 'str':
      return value;
    case 'b':
      return value === '1';
    case 'e':
      return value;
    case 'n':
    case '':
    default: {
      if (value === '') return null;
      const number = Number(value);
      return Number.isFinite(number) ? number : value;
    }
  }
}

function createHeaders(values: unknown[]): string[] {
  const used = new Map<string, number>();

  return values.map((value, index) => {
    const base = String(value ?? '').trim() || `column_${index + 1}`;
    const count = used.get(base) ?? 0;
    used.set(base, count + 1);

    return count === 0 ? base : `${base}_${count + 1}`;
  });
}

export class XlsxReader implements StreamingReader {
  readonly format = 'excel' as const;

  async *read(
    file: File,
    options: ReaderOptions = {},
  ): AsyncIterable<ReaderBatch> {
    const batchSize = options.batchSize ?? 1000;
    const signal = options.signal;

    if (!Number.isInteger(batchSize) || batchSize <= 0) {
      throw new RangeError('batchSize must be a positive integer.');
    }

    throwIfAborted(signal);

    const entries = await readZipDirectory(file);
    const totalUncompressedBytes = entries.reduce(
      (total, entry) => total + entry.uncompressedSize,
      0,
    );

    if (totalUncompressedBytes > MAX_XLSX_TOTAL_UNCOMPRESSED_BYTES) {
      throw new Error('XLSX archive exceeds the configured total uncompressed size limit.');
    }

    const worksheetPath = await readWorkbookSheet(
      file,
      entries,
      signal,
    );
    const shared = await readSharedStrings(file, entries, signal);

    let processedBytes = shared.processedBytes;
    let pendingBytes = 0;
    let headers: string[] | null = null;
    let currentRow: unknown[] | null = null;
    let currentCell: {
      reference: string;
      type: string;
      value: string;
    } | null = null;
    let capture: 'value' | 'text' | null = null;
    const inlineText = '';
    let cellValue = '';
    let cellText = '';
    let rowNumber = 0;

    const pendingRows: StreamingRecord[] = [];

    const parser = new SaxesParser({ xmlns: false });
    let parserError: Error | null = null;

    parser.on('error', (error) => {
      parserError ??= error;
    });

    parser.on('opentag', (tag) => {
      const attributes = tag.attributes as Record<string, string>;

      if (tag.name === 'row') {
        currentRow = [];
      } else if (tag.name === 'c' && currentRow) {
        currentCell = {
          reference: attributes.r ?? '',
          type: attributes.t ?? 'n',
          value: '',
        };
        cellValue = '';
        cellText = '';
      } else if (
        currentCell &&
        (tag.name === 'v' || tag.name === 't')
      ) {
        capture = tag.name === 'v' ? 'value' : 'text';
      }
    });

    const appendText = (value: string) => {
      if (capture === 'value') {
        cellValue += value;
      } else if (capture === 'text') {
        cellText += value;
      }
    };

    parser.on('text', appendText);
    parser.on('cdata', appendText);

    parser.on('closetag', (tag) => {
      const name = tag.name;

      if (name === 'v' || name === 't') {
        capture = null;
        return;
      }

      if (name === 'c' && currentCell && currentRow) {
        const index = columnIndex(currentCell.reference);
        let value: unknown;

        if (currentCell.type === 'inlineStr') {
          value = cellText;
        } else {
          value = parseCellValue(
            cellValue,
            currentCell.type,
            shared.values,
          );
        }

        currentRow[index] = value;
        currentCell = null;
        return;
      }

      if (name === 'row' && currentRow) {
        rowNumber += 1;

        if (!headers) {
          headers = createHeaders(currentRow);
        } else {
          const record: StreamingRecord = {};

          for (let index = 0; index < headers.length; index += 1) {
            Object.defineProperty(record, headers[index], {
              configurable: true,
              enumerable: true,
              writable: true,
              value: currentRow[index] ?? null,
            });
          }

          pendingRows.push(record);
        }

        currentRow = null;
      }
    });

    const textDecoder = new TextDecoder('utf-8');
    let streamFinished = false;

    try {
      const worksheet = entries.find(
        (entry) => entry.name === worksheetPath,
      );

      if (!worksheet) {
        throw new Error(`XLSX worksheet entry not found: ${worksheetPath}`);
      }

      for await (const chunk of readZipEntry(file, worksheet, signal)) {
        throwIfAborted(signal);

        processedBytes += chunk.byteLength;
        pendingBytes += chunk.byteLength;

        parser.write(textDecoder.decode(chunk, { stream: true }));

        if (parserError) {
          throw parserError;
        }

        while (pendingRows.length >= batchSize) {
          throwIfAborted(signal);

          yield {
            rows: pendingRows.splice(0, batchSize),
            parseErrors: 0,
            processedBytes: pendingBytes,
          };

          pendingBytes = 0;
        }
      }

      parser.write(textDecoder.decode());
      parser.close();

      if (parserError) {
        throw parserError;
      }

      throwIfAborted(signal);

      while (pendingRows.length > 0) {
        yield {
          rows: pendingRows.splice(0, batchSize),
          parseErrors: 0,
          processedBytes: pendingBytes,
        };

        pendingBytes = 0;
      }

      streamFinished = true;
    } finally {
      if (!streamFinished) {
        pendingRows.length = 0;
      }
    }

    void rowNumber;
    void inlineText;
    void processedBytes;
  }
}
