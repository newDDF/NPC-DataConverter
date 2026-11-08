import { SaxesParser } from 'saxes';
import type {
  ReaderBatch,
  ReaderOptions,
  StreamingReader,
  StreamingRecord,
} from '../core/contracts';
import { normalizeRecords } from '../core/records';

type XmlFrame = {
  name: string;
  attributes: Record<string, string>;
  children: Record<string, unknown>;
  text: string;
};

const MAX_TEXT_CHUNK = 64 * 1024;

function setOwn(
  target: Record<string, unknown>,
  key: string,
  value: unknown,
): void {
  Object.defineProperty(target, key, {
    configurable: true,
    enumerable: true,
    writable: true,
    value,
  });
}

function appendChild(
  target: Record<string, unknown>,
  name: string,
  value: unknown,
): void {
  if (!Object.prototype.hasOwnProperty.call(target, name)) {
    setOwn(target, name, value);
    return;
  }

  const current = target[name];

  if (Array.isArray(current)) {
    current.push(value);
  } else {
    setOwn(target, name, [current, value]);
  }
}

function createFrame(
  name: string,
  attributes: Record<string, string>,
): XmlFrame {
  return {
    name,
    attributes,
    children: {},
    text: '',
  };
}

function frameToValue(frame: XmlFrame): unknown {
  const keys = Object.keys(frame.attributes);
  const childKeys = Object.keys(frame.children);

  if (keys.length === 0 && childKeys.length === 0) {
    return frame.text;
  }

  const result: Record<string, unknown> = {};

  for (const [name, value] of Object.entries(frame.attributes)) {
    setOwn(result, `@${name}`, value);
  }

  for (const [name, value] of Object.entries(frame.children)) {
    setOwn(result, name, value);
  }

  if (frame.text.trim().length > 0) {
    setOwn(result, '#text', frame.text);
  }

  return result;
}

function createAbortError(): DOMException {
  return new DOMException('The operation was aborted.', 'AbortError');
}

export class XmlReader implements StreamingReader {
  readonly format = 'xml' as const;

  async *read(
    file: File,
    options: ReaderOptions = {},
  ): AsyncIterable<ReaderBatch> {
    const batchSize = options.batchSize ?? 1000;

    if (!Number.isInteger(batchSize) || batchSize <= 0) {
      throw new RangeError('batchSize must be a positive integer.');
    }

    const signal = options.signal;
    const streamReader = file.stream().getReader();
    const decoder = new TextDecoder('utf-8');
    const parser = new SaxesParser({ xmlns: false });

    const stack: XmlFrame[] = [];
    const pendingRows: StreamingRecord[] = [];

    let parserError: Error | null = null;
        let pendingBytes = 0;
    let streamFinished = false;

    parser.on('error', (error) => {
      parserError ??= error;
    });

    parser.on('opentag', (tag) => {
      const attributes: Record<string, string> = {};

      for (const [name, value] of Object.entries(tag.attributes)) {
        setOwn(attributes, name, value);
      }

      stack.push(createFrame(tag.name, attributes));
    });

    const appendText = (value: string) => {
      const frame = stack[stack.length - 1];

      if (frame) {
        frame.text += value;
      }
    };

    parser.on('text', appendText);
    parser.on('cdata', appendText);

    parser.on('closetag', () => {
      const frame = stack.pop();

      if (!frame) {
        return;
      }

      if (stack.length === 0) {
        return;
      }

      const value = frameToValue(frame);
      const parent = stack[stack.length - 1];

      appendChild(parent.children, frame.name, value);

      if (stack.length === 1) {
        pendingRows.push(...normalizeRecords(value));
      }
    });

    const throwIfAborted = () => {
      if (signal?.aborted) {
        throw createAbortError();
      }
    };

    const throwParserError = () => {
      if (parserError) {
        throw parserError;
      }
    };

    try {
      const processText = async function* (
        text: string,
      ): AsyncGenerator<ReaderBatch> {
        for (let offset = 0; offset < text.length;) {
          throwIfAborted();

          let end = Math.min(offset + MAX_TEXT_CHUNK, text.length);

          if (
            end < text.length &&
            end > offset &&
            text.charCodeAt(end - 1) >= 0xd800 &&
            text.charCodeAt(end - 1) <= 0xdbff
          ) {
            end -= 1;
          }

          parser.write(text.slice(offset, end));
          throwParserError();
          offset = end;

          while (pendingRows.length >= batchSize) {
            throwIfAborted();

            const rows = pendingRows.splice(0, batchSize);
            const bytes = pendingBytes;
            pendingBytes = 0;

            yield {
              rows,
              parseErrors: 0,
              processedBytes: bytes,
            };
          }
        }
      };

      while (true) {
        throwIfAborted();

        const result = await streamReader.read();

        if (result.done) {
          streamFinished = true;
          break;
        }

                pendingBytes += result.value.byteLength;

        const text = decoder.decode(result.value, { stream: true });

        for await (const batch of processText(text)) {
          yield batch;
        }
      }

      const remainingText = decoder.decode();

      for await (const batch of processText(remainingText)) {
        yield batch;
      }

      throwIfAborted();
      parser.close();
      throwParserError();

      while (pendingRows.length > 0) {
        throwIfAborted();

        const rows = pendingRows.splice(0, batchSize);
        const bytes = pendingBytes;
        pendingBytes = 0;

        yield {
          rows,
          parseErrors: 0,
          processedBytes: bytes,
        };
      }
    } finally {
      if (!streamFinished) {
        try {
          await streamReader.cancel();
        } catch {
          // The stream may already be closed or errored.
        }
      }

      streamReader.releaseLock();
    }
  }
}
