import type {
  StreamingOutputSink,
  StreamingRecord,
  StreamingWriter,
  StreamingWriterSession,
} from '../core/contracts';

const ROOT_NAME = 'records';
const RECORD_NAME = 'record';

function isXmlNameStartChar(code: number): boolean {
  return (
    code === 0x3a ||
    code === 0x5f ||
    (code >= 0x41 && code <= 0x5a) ||
    (code >= 0x61 && code <= 0x7a) ||
    (code >= 0xc0 && code <= 0xd6) ||
    (code >= 0xd8 && code <= 0xf6) ||
    (code >= 0xf8 && code <= 0x2ff) ||
    (code >= 0x370 && code <= 0x37d) ||
    (code >= 0x37f && code <= 0x1fff) ||
    (code >= 0x200c && code <= 0x200d) ||
    (code >= 0x2070 && code <= 0x218f) ||
    (code >= 0x2c00 && code <= 0x2fef) ||
    (code >= 0x3001 && code <= 0xd7ff) ||
    (code >= 0xf900 && code <= 0xfdcf) ||
    (code >= 0xfdf0 && code <= 0xfffd) ||
    (code >= 0x10000 && code <= 0xeffff)
  );
}

function isXmlNameChar(code: number): boolean {
  return (
    isXmlNameStartChar(code) ||
    code === 0x2d ||
    code === 0x2e ||
    (code >= 0x30 && code <= 0x39) ||
    code === 0xb7 ||
    (code >= 0x300 && code <= 0x36f) ||
    (code >= 0x203f && code <= 0x2040)
  );
}

function isValidXmlName(name: string): boolean {
  if (name.length === 0) {
    return false;
  }

  let first = true;

  for (const character of name) {
    const code = character.codePointAt(0)!;

    if (first ? !isXmlNameStartChar(code) : !isXmlNameChar(code)) {
      return false;
    }

    first = false;
  }

  return true;
}

function validateXmlCharacters(value: string): void {
  for (const character of value) {
    const code = character.codePointAt(0)!;

    if (
      code !== 0x09 &&
      code !== 0x0a &&
      code !== 0x0d &&
      (code < 0x20 ||
        (code >= 0xd800 && code <= 0xdfff) ||
        code > 0x10ffff ||
        (code >= 0xfffe && code <= 0xffff))
    ) {
      throw new TypeError('Value contains an invalid XML character.');
    }
  }
}

function escapeText(value: string): string {
  validateXmlCharacters(value);

  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\r/g, '&#13;');
}

function escapeAttribute(value: string): string {
  validateXmlCharacters(value);

  return escapeText(value)
    .replace(/"/g, '&quot;')
    .replace(/\t/g, '&#9;')
    .replace(/\n/g, '&#10;');
}

function toScalarString(value: unknown): string {
  if (
    value === null ||
    value === undefined ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return value == null ? '' : String(value);
  }

  throw new TypeError(
    'XML attributes and text values must be strings, numbers, booleans, or null.',
  );
}

function serializeElement(
  name: string,
  value: unknown,
  ancestors: WeakSet<object>,
): string {
  if (!isValidXmlName(name)) {
    throw new TypeError(`Invalid XML element name: ${name}`);
  }

  if (Array.isArray(value)) {
    let output = '';

    for (const item of value) {
      output += serializeElement(name, item, ancestors);
    }

    return output;
  }

  if (value === null || value === undefined) {
    return `<${name}/>`;
  }

  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return `<${name}>${escapeText(String(value))}</${name}>`;
  }

  if (typeof value !== 'object') {
    throw new TypeError(`Unsupported XML value for element: ${name}`);
  }

  if (ancestors.has(value)) {
    throw new TypeError('Cannot serialize circular data as XML.');
  }

  ancestors.add(value);

  try {
    const entries = Object.entries(value);
    const attributes: string[] = [];
    const body: string[] = [];

    for (const [key, child] of entries) {
      if (key.startsWith('@')) {
        const attributeName = key.slice(1);

        if (!isValidXmlName(attributeName)) {
          throw new TypeError(`Invalid XML attribute name: ${attributeName}`);
        }

        if (child === undefined) {
          continue;
        }

        const attributeValue = escapeAttribute(toScalarString(child));
        attributes.push(` ${attributeName}="${attributeValue}"`);
        continue;
      }

      if (key === '#text') {
        if (child === null || child === undefined) {
          continue;
        }

        body.push(escapeText(toScalarString(child)));
        continue;
      }

      body.push(serializeElement(key, child, ancestors));
    }

    const openingTag = `<${name}${attributes.join('')}`;

    if (body.length === 0) {
      return `${openingTag}/>`;
    }

    return `${openingTag}>${body.join('')}</${name}>`;
  } finally {
    ancestors.delete(value);
  }
}

function serializeRecord(row: StreamingRecord): string {
  if (row === null || typeof row !== 'object' || Array.isArray(row)) {
    throw new TypeError('Each XML record must be an object.');
  }

  const ancestors = new WeakSet<object>();
  ancestors.add(row);

  try {
    const entries = Object.entries(row);
    const attributes: string[] = [];
    const body: string[] = [];

    for (const [key, value] of entries) {
      if (key.startsWith('@')) {
        const name = key.slice(1);

        if (!isValidXmlName(name)) {
          throw new TypeError(`Invalid XML attribute name: ${name}`);
        }

        if (value === undefined) {
          continue;
        }

        attributes.push(
          ` ${name}="${escapeAttribute(toScalarString(value))}"`,
        );
        continue;
      }

      if (key === '#text') {
        if (value !== null && value !== undefined) {
          body.push(escapeText(toScalarString(value)));
        }
        continue;
      }

      body.push(serializeElement(key, value, ancestors));
    }

    const openingTag = `<${RECORD_NAME}${attributes.join('')}`;

    if (body.length === 0) {
      return `${openingTag}/>`;
    }

    return `${openingTag}>${body.join('')}</${RECORD_NAME}>`;
  } finally {
    ancestors.delete(row);
  }
}

export class XmlWriter implements StreamingWriter {
  readonly format = 'xml' as const;

  async create(
    sink: StreamingOutputSink,
  ): Promise<StreamingWriterSession> {
    let closed = false;
    let rootClosed = false;

    await sink.write(
      '<?xml version="1.0" encoding="UTF-8"?>\n' +
        `<${ROOT_NAME}>`,
    );

    return {
      async write(rows: StreamingRecord[]): Promise<void> {
        if (closed || rootClosed) {
          throw new Error('XML writer is already closed');
        }

        if (rows.length === 0) {
          return;
        }

        const output = rows.map(serializeRecord).join('');

        if (output.length > 0) {
          await sink.write(output);
        }
      },

      async close(): Promise<void> {
        if (closed) {
          return;
        }

        if (!rootClosed) {
          await sink.write(`</${ROOT_NAME}>`);
          rootClosed = true;
        }

        await sink.close();
        closed = true;
      },

      async abort(reason?: unknown): Promise<void> {
        if (closed) {
          return;
        }

        closed = true;
        await sink.abort(reason);
      },
    };
  }
}
