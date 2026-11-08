import { describe, expect, it } from 'vitest';
import type { StreamingOutputSink } from '../core/contracts';
import { JsonWriter } from '../writers/json-writer';

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

describe('JsonWriter', () => {
  it('writes compact JSON by default', async () => {
    const sink = new MemorySink();
    const writer = new JsonWriter();
    const session = await writer.create(sink);

    await session.write([{ id: 1 }, { id: 2 }]);
    await session.close();

    expect(sink.output).toBe('[{"id":1},{"id":2}]');
    expect(sink.closed).toBe(true);
  });

  it('writes pretty JSON across multiple batches', async () => {
    const sink = new MemorySink();
    const writer = new JsonWriter();
    const session = await writer.create(sink, { jsonIndent: 2 });

    await session.write([{ id: 1, nested: { active: true } }]);
    await session.write([{ id: 2 }]);
    await session.close();

    expect(sink.output).toBe(
      '[\n' +
      '  {\n' +
      '    "id": 1,\n' +
      '    "nested": {\n' +
      '      "active": true\n' +
      '    }\n' +
      '  },\n' +
      '  {\n' +
      '    "id": 2\n' +
      '  }\n' +
      ']',
    );
    expect(JSON.parse(sink.output)).toEqual([
      { id: 1, nested: { active: true } },
      { id: 2 },
    ]);
  });

  it('writes an empty array in pretty mode', async () => {
    const sink = new MemorySink();
    const writer = new JsonWriter();
    const session = await writer.create(sink, { jsonIndent: 4 });

    await session.close();

    expect(sink.output).toBe('[]');
  });

  it('rejects indentation outside the supported range', async () => {
    const sink = new MemorySink();
    const writer = new JsonWriter();

    await expect(
      writer.create(sink, { jsonIndent: 11 }),
    ).rejects.toThrow('JSON indentation must be an integer from 0 to 10.');
  });
});
