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

  it('filters, renames, and reorders fields before writing each batch', async () => {
    const file = createFile(
      ['[{"id":1,"name":"Alpha","score":10},{"id":2,"name":"Beta","score":20}]'],
      'records.json',
    );
    const sink = new MemorySink();

    await convertStreamingFile({
      file,
      inputFormat: 'json',
      outputFormat: 'json',
      sink,
      batchSize: 1,
      selectedFields: ['score', 'name'],
      fieldRenames: {
        score: 'points',
        name: 'label',
      },
    });

    expect(JSON.parse(sink.output)).toEqual([
      { points: 10, label: 'Alpha' },
      { points: 20, label: 'Beta' },
    ]);
    expect(sink.closed).toBe(true);
  });

  it('writes empty records when no fields are selected', async () => {
    const file = createFile(
      ['[{"id":1,"name":"Alpha"}]'],
      'records.json',
    );
    const sink = new MemorySink();

    await convertStreamingFile({
      file,
      inputFormat: 'json',
      outputFormat: 'json',
      sink,
      selectedFields: [],
    });

    expect(JSON.parse(sink.output)).toEqual([{}]);
  });

  it('rejects duplicate output field names', async () => {
    const file = createFile(
      ['[{"first":"Alpha","second":"Beta"}]'],
      'records.json',
    );
    const sink = new MemorySink();

    await expect(
      convertStreamingFile({
        file,
        inputFormat: 'json',
        outputFormat: 'json',
        sink,
        selectedFields: ['first', 'second'],
        fieldRenames: {
          first: 'label',
          second: 'label',
        },
      }),
    ).rejects.toThrow('Duplicate output field name: label');

    expect(sink.aborted).toBe(true);
    expect(sink.closed).toBe(false);
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

  it('converts JSON to SQL INSERT across multiple batches', async () => {
    const file = createFile(
      ['[{"id":1,"name":"Alice"},{"id":2,"name":"Bob"},{"id":3,"name":"Carol"}]'],
      'people.json',
    );
    const sink = new MemorySink();

    const result = await convertStreamingFile({
      file,
      inputFormat: 'json',
      outputFormat: 'sql',
      sink,
      batchSize: 1,
      tableName: 'people',
      sqlMode: 'insert',
    });

    expect(sink.output).toBe(
      'INSERT INTO `people` (`id`, `name`)\nVALUES\n' +
      "(1, 'Alice'),\n(2, 'Bob'),\n(3, 'Carol');\n"
    );
    expect(result.rows).toBe(3);
    expect(sink.closed).toBe(true);
  });

  it('converts JSON to SQL UPDATE using key columns', async () => {
    const file = createFile(
      ['[{"id":1,"name":"Alice"},{"id":2,"name":"Bob"}]'],
      'people.json',
    );
    const sink = new MemorySink();

    const result = await convertStreamingFile({
      file,
      inputFormat: 'json',
      outputFormat: 'sql',
      sink,
      batchSize: 1,
      tableName: 'people',
      sqlMode: 'update',
      keyColumns: ['id'],
    });

    expect(sink.output).toBe(
      "UPDATE `people`\nSET\n  `name` = 'Alice'\nWHERE `id` = 1;\n" +
      "UPDATE `people`\nSET\n  `name` = 'Bob'\nWHERE `id` = 2;\n"
    );
    expect(result.rows).toBe(2);
    expect(sink.closed).toBe(true);
  });

  it('converts JSON to SQL CREATE TABLE with inferred types and primary key', async () => {
    const file = createFile(
      ['[{"id":1,"name":"Alice"},{"id":2,"name":"Bob"}]'],
      'people.json',
    );
    const sink = new MemorySink();

    const result = await convertStreamingFile({
      file,
      inputFormat: 'json',
      outputFormat: 'sql',
      sink,
      batchSize: 1,
      tableName: 'people',
      sqlMode: 'create',
      keyColumns: ['id'],
    });

    expect(sink.output).toBe(
      'CREATE TABLE `people` (\n' +
      '  `id` BIGINT,\n' +
      '  `name` VARCHAR(5),\n' +
      '  PRIMARY KEY (`id`)\n' +
      ');\n'
    );
    expect(result.rows).toBe(2);
    expect(sink.closed).toBe(true);
  });

});