// @vitest-environment node

import { describe, expect, it } from 'vitest';
import { JsonReader } from '../readers/json-reader';

const collectRows = async (file: File, batchSize?: number) => {
  const reader = new JsonReader();
  const rows: Record<string, unknown>[] = [];

  for await (const batch of reader.read(file, { batchSize })) {
    rows.push(...batch.rows);
  }

  return rows;
};

describe('JsonReader', () => {
  it('reads top-level arrays as individual records', async () => {
    const file = new File(
      ['[{"id":1},{"id":2},{"id":3}]'],
      'records.json',
    );

    expect(await collectRows(file)).toEqual([
      { id: 1 },
      { id: 2 },
      { id: 3 },
    ]);
  });

  it('reads a top-level object as one record', async () => {
    const file = new File(
      ['{"id":1,"name":"Alice"}'],
      'record.json',
    );

    expect(await collectRows(file)).toEqual([
      { id: 1, name: 'Alice' },
    ]);
  });

  it('wraps top-level primitive values', async () => {
    const cases = [
      ['123', { value: 123 }],
      ['"hello"', { value: 'hello' }],
      ['true', { value: true }],
    ];

    for (const [content, expected] of cases) {
      const file = new File([content as string], 'value.json');
      expect(await collectRows(file)).toEqual([expected]);
    }

    const nullFile = new File(['null'], 'null.json');
    expect(await collectRows(nullFile)).toEqual([]);
  });

  it('preserves nested objects and arrays', async () => {
    const file = new File(
      ['[{"id":1,"profile":{"city":"Tokyo"},"tags":["a","b"]}]'],
      'nested.json',
    );

    expect(await collectRows(file)).toEqual([
      {
        id: 1,
        profile: { city: 'Tokyo' },
        tags: ['a', 'b'],
      },
    ]);
  });

  it('splits output into configured batch sizes', async () => {
    const records = Array.from(
      { length: 5 },
      (_, id) => ({ id }),
    );

    const file = new File(
      [JSON.stringify(records)],
      'batch.json',
    );

    const reader = new JsonReader();
    const sizes: number[] = [];

    for await (const batch of reader.read(file, { batchSize: 2 })) {
      sizes.push(batch.rows.length);
    }

    expect(sizes).toEqual([2, 2, 1]);
  });

  it('rejects invalid batch sizes', async () => {
    const file = new File(['[{"id":1}]'], 'records.json');

    for (const batchSize of [0, -1, 1.5]) {
      await expect(
        collectRows(file, batchSize),
      ).rejects.toThrow('batchSize must be a positive integer');
    }
  });

  it('decodes UTF-8 characters split across stream chunks', async () => {
    const content = '{"name":"東京","city":"北京"}';
    const bytes = new TextEncoder().encode(content);
    const splitAt = bytes.findIndex((byte) => byte >= 0xE0) + 1;

    const firstChunk = bytes.slice(0, splitAt);
    const secondChunk = bytes.slice(splitAt);

    const file = new File([], 'utf8.json');

    Object.defineProperty(file, 'stream', {
      value: () =>
        new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(firstChunk);
            controller.enqueue(secondChunk);
            controller.close();
          },
        }),
    });

    expect(await collectRows(file)).toEqual([
      { name: '東京', city: '北京' },
    ]);
  });

  it('handles more than 64 KiB of leading whitespace', async () => {
    const file = new File(
      [`${' '.repeat(65536)}[{"id":1}]`],
      'leading-whitespace.json',
    );

    expect(await collectRows(file)).toEqual([{ id: 1 }]);
  });

  it('preserves emoji across the 64 KiB parser segment boundary', async () => {
    const value = `${'a'.repeat(65533)}😀`;
    const file = new File(
      [`["${value}"]`],
      'segment-boundary.json',
    );

    const rows = await collectRows(file);

    expect(rows).toHaveLength(1);
    expect(rows[0].value).toBe(value);
  });

  it('rejects invalid JSON', async () => {
    const file = new File(
      ['[{"id":1}, invalid]'],
      'invalid.json',
    );

    await expect(collectRows(file)).rejects.toThrow();
  });

  it('rejects truncated JSON', async () => {
    const file = new File(
      ['[{"id":1},'],
      'truncated.json',
    );

    await expect(collectRows(file)).rejects.toThrow();
  });

  it('rejects an already aborted signal', async () => {
    const file = new File(['[{"id":1}]'], 'records.json');
    const controller = new AbortController();
    controller.abort();

    const reader = new JsonReader();

    await expect(async () => {
      for await (const batch of reader.read(file, {
        signal: controller.signal,
      })) {
        void batch;
      }
    }).rejects.toMatchObject({
      name: 'AbortError',
    });
  });

  it('stops after cancellation between batches', async () => {
    const file = new File(
      [JSON.stringify(
        Array.from({ length: 10000 }, (_, id) => ({ id })),
      )],
      'large.json',
    );

    const controller = new AbortController();
    const reader = new JsonReader();
    const iterator = reader.read(file, {
      signal: controller.signal,
      batchSize: 10,
    })[Symbol.asyncIterator]();

    const first = await iterator.next();

    expect(first.done).toBe(false);
    expect(first.value?.rows).toHaveLength(10);

    controller.abort();

    await expect(iterator.next()).rejects.toMatchObject({
      name: 'AbortError',
    });
  });

  it('allows the consumer to exit early', async () => {
    const file = new File(
      [JSON.stringify(
        Array.from({ length: 10000 }, (_, id) => ({ id })),
      )],
      'early-exit.json',
    );

    const reader = new JsonReader();
    const iterator = reader.read(file, {
      batchSize: 10,
    })[Symbol.asyncIterator]();

    const first = await iterator.next();

    expect(first.done).toBe(false);
    expect(first.value?.rows).toHaveLength(10);

    await expect(iterator.return?.()).resolves.toMatchObject({
      done: true,
    });
  });
});
