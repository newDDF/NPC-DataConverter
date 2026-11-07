// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest';
import type { StreamingOutputSink } from '../core/contracts';
import { convertStreamingFile } from '../core/pipeline';


function createFile(content: string | BlobPart[], name: string): File {
  const parts = Array.isArray(content) ? content : [content];
  const file = new File(parts, name, {
    type: 'application/octet-stream',
  });

  Object.defineProperty(file, 'stream', {
    configurable: true,
    value: () => {
      let consumed = false;

      return new ReadableStream<Uint8Array>({
        pull(controller) {
          if (consumed) return;
          consumed = true;

          const reader = new FileReader();

          reader.onload = () => {
            controller.enqueue(
              new Uint8Array(reader.result as ArrayBuffer),
            );
            controller.close();
          };

          reader.onerror = () => {
            controller.error(reader.error);
          };

          reader.readAsArrayBuffer(file);
        },
      });
    },
  });

  return file;
}

class MemorySink implements StreamingOutputSink {
  output = '';
  closed = false;
  aborted = false;

  async write(data: string | Uint8Array): Promise<void> {
    this.output += typeof data === 'string'
      ? data
      : new TextDecoder().decode(data);
  }

  async close(): Promise<void> {
    this.closed = true;
  }

  async abort(): Promise<void> {
    this.aborted = true;
  }
}

describe('Streaming Pipeline', () => {
  it('converts CSV to JSON', async () => {
    const file = createFile(
      ['id,name\n1,Alice\n2,Bob\n3,Carol\n'],
      'people.csv',
    );
    const sink = new MemorySink();

    const result = await convertStreamingFile({
      file,
      inputFormat: 'csv',
      outputFormat: 'json',
      sink,
      batchSize: 2,
    });

    expect(JSON.parse(sink.output)).toEqual([
      { id: 1, name: 'Alice' },
      { id: 2, name: 'Bob' },
      { id: 3, name: 'Carol' },
    ]);
    expect(result.rows).toBe(3);
    expect(sink.closed).toBe(true);
    expect(sink.aborted).toBe(false);
  });

  it('converts JSON to XML', async () => {
    const file = createFile(
      ['[{"id":1,"name":"Alice"},{"id":2,"name":"Bob"}]'],
      'people.json',
    );
    const sink = new MemorySink();

    const result = await convertStreamingFile({
      file,
      inputFormat: 'json',
      outputFormat: 'xml',
      sink,
      batchSize: 1,
    });

    expect(sink.output).toContain('<records>');
    expect(sink.output).toContain('<id>1</id>');
    expect(sink.output).toContain('<name>Alice</name>');
    expect(sink.output).toContain('<id>2</id>');
    expect(sink.output).toContain('</records>');
    expect(result.rows).toBe(2);
    expect(sink.closed).toBe(true);
  });

  it('converts XML to CSV', async () => {
    const file = createFile(
      ['<records><item id="1"><name>Alice</name></item><item id="2"><name>Bob</name></item></records>'],
      'people.xml',
    );
    const sink = new MemorySink();

    const result = await convertStreamingFile({
      file,
      inputFormat: 'xml',
      outputFormat: 'csv',
      sink,
    });

    expect(sink.output).toContain('@id');
    expect(sink.output).toContain('Alice');
    expect(sink.output).toContain('Bob');
    expect(result.rows).toBe(2);
    expect(sink.closed).toBe(true);
  });

  it('reports conversion progress and output bytes', async () => {
    const file = createFile(['[{"id":1}]'], 'data.json');
    const sink = new MemorySink();
    const onProgress = vi.fn();

    const result = await convertStreamingFile({
      file,
      inputFormat: 'json',
      outputFormat: 'json',
      sink,
      onProgress,
    });

    expect(onProgress).toHaveBeenCalled();
    expect(result.processedBytes).toBe(file.size);
    expect(result.totalBytes).toBe(file.size);
    expect(result.outputBytes).toBe(
      new TextEncoder().encode(sink.output).byteLength,
    );
  });

  it('aborts output when parsing fails', async () => {
    const file = createFile(
      ['<records><item></records>'],
      'broken.xml',
    );
    const sink = new MemorySink();

    await expect(
      convertStreamingFile({
        file,
        inputFormat: 'xml',
        outputFormat: 'json',
        sink,
      }),
    ).rejects.toThrow();

    expect(sink.aborted).toBe(true);
    expect(sink.closed).toBe(false);
  });

  it('rejects unsupported formats and aborts output', async () => {
    const file = createFile(['{}'], 'data.json');
    const sink = new MemorySink();

    await expect(
      convertStreamingFile({
        file,
        inputFormat: 'excel',
        outputFormat: 'json',
        sink,
      }),
    ).rejects.toThrow();

    expect(sink.aborted).toBe(true);
  });

  it('rejects an already aborted signal', async () => {
    const file = createFile(['[]'], 'data.json');
    const sink = new MemorySink();
    const controller = new AbortController();
    controller.abort();

    await expect(
      convertStreamingFile({
        file,
        inputFormat: 'json',
        outputFormat: 'xml',
        sink,
        signal: controller.signal,
      }),
    ).rejects.toMatchObject({ name: 'AbortError' });

    expect(sink.aborted).toBe(true);
  });

  it('aborts output when the progress callback throws', async () => {
    const file = createFile(['[{"id":1}]'], 'data.json');
    const sink = new MemorySink();

    await expect(
      convertStreamingFile({
        file,
        inputFormat: 'json',
        outputFormat: 'json',
        sink,
        onProgress: () => {
          throw new Error('Progress callback failed');
        },
      }),
    ).rejects.toThrow('Progress callback failed');

    expect(sink.aborted).toBe(true);
    expect(sink.closed).toBe(false);
  });
});
