// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';
import type { StreamingOutputSink } from '../core/contracts';
import { readZipDirectory, readZipEntry } from '../xlsx/zip';
import { XlsxWriter } from '../writers/xlsx-writer';

class MemorySink implements StreamingOutputSink {
  readonly chunks: Uint8Array[] = [];
  closed = false;
  aborted = false;

  async write(data: string | Uint8Array): Promise<void> {
    this.chunks.push(
      typeof data === 'string' ? new TextEncoder().encode(data) : new Uint8Array(data),
    );
  }

  async close(): Promise<void> {
    this.closed = true;
  }

  async abort(): Promise<void> {
    this.aborted = true;
  }

  toFile(): File {
    const length = this.chunks.reduce(
      (total, chunk) => total + chunk.byteLength,
      0,
    );
    const buffer = new ArrayBuffer(length);
    const output = new Uint8Array(buffer);
    let offset = 0;

    for (const chunk of this.chunks) {
      output.set(chunk, offset);
      offset += chunk.byteLength;
    }

    return new File([buffer], 'result.xlsx');
  }
}

async function readEntryText(file: File, name: string): Promise<string> {
  const entries = await readZipDirectory(file);
  const entry = entries.find((item) => item.name === name);

  if (!entry) {
    throw new Error(`Missing ZIP entry: ${name}`);
  }

  const decoder = new TextDecoder();
  let result = '';

  for await (const chunk of readZipEntry(file, entry)) {
    result += decoder.decode(chunk, { stream: true });
  }

  return result + decoder.decode();
}

describe('XlsxWriter', () => {
  it('writes records from multiple batches into a valid XLSX archive', async () => {
    const sink = new MemorySink();
    const session = await new XlsxWriter().create(sink);

    await session.write([
      { name: 'Alpha', score: 10, active: true },
      { name: 'Beta', score: 20, active: false },
    ]);
    await session.write([
      { name: 'Gamma', score: 30, active: true },
    ]);
    await session.close();

    expect(sink.closed).toBe(true);
    expect(sink.aborted).toBe(false);

    const file = sink.toFile();
    const entries = await readZipDirectory(file);
    const names = entries.map((entry) => entry.name);

    expect(names).toContain('[Content_Types].xml');
    expect(names).toContain('_rels/.rels');
    expect(names).toContain('xl/workbook.xml');
    expect(names).toContain('xl/_rels/workbook.xml.rels');
    expect(names).toContain('xl/worksheets/sheet1.xml');

    const worksheet = await readEntryText(file, 'xl/worksheets/sheet1.xml');

    expect(worksheet).toContain('>name</t>');
    expect(worksheet).toContain('>score</t>');
    expect(worksheet).toContain('>active</t>');
    expect(worksheet).toContain('>Alpha</t>');
    expect(worksheet).toContain('>Beta</t>');
    expect(worksheet).toContain('>Gamma</t>');
    expect(worksheet).toContain('<v>10</v>');
    expect(worksheet).toContain('<v>20</v>');
    expect(worksheet).toContain('<v>30</v>');
    expect(worksheet).toContain('t="b"><v>1</v>');
    expect(worksheet).toContain('t="b"><v>0</v>');
    expect(worksheet).toContain('<row r="4">');
    expect(worksheet).toContain('</sheetData>');
  });

  it('creates an empty worksheet when no records are written', async () => {
    const sink = new MemorySink();
    const session = await new XlsxWriter().create(sink);

    await session.close();

    expect(sink.closed).toBe(true);

    const worksheet = await readEntryText(
      sink.toFile(),
      'xl/worksheets/sheet1.xml',
    );

    expect(worksheet).toContain('<sheetData>');
    expect(worksheet).toContain('</sheetData>');
    expect(worksheet).not.toContain('<row ');
  });

  it('serializes null values and nested objects', async () => {
    const sink = new MemorySink();
    const session = await new XlsxWriter().create(sink);

    await session.write([
      { empty: null, details: { level: 2, tags: ['one', 'two'] } },
    ]);
    await session.close();

    const worksheet = await readEntryText(
      sink.toFile(),
      'xl/worksheets/sheet1.xml',
    );

    expect(worksheet).toContain('<c r="A2"/>');
    expect(worksheet).toContain(
      '{&quot;level&quot;:2,&quot;tags&quot;:[&quot;one&quot;,&quot;two&quot;]}',
    );
  });

  it('escapes XML special characters', async () => {
    const sink = new MemorySink();
    const session = await new XlsxWriter().create(sink);

    await session.write([{ value: 'A & B < C > D "quoted"' }]);
    await session.close();

    const worksheet = await readEntryText(
      sink.toFile(),
      'xl/worksheets/sheet1.xml',
    );

    expect(worksheet).toContain(
      'A &amp; B &lt; C &gt; D &quot;quoted&quot;',
    );
  });

  it('rejects invalid XML characters', async () => {
    const sink = new MemorySink();
    const session = await new XlsxWriter().create(sink);

    await expect(
      session.write([{ value: 'invalid\u0001value' }]),
    ).rejects.toThrow('invalid in XML');

    await session.abort('test cleanup');

    expect(sink.aborted).toBe(true);
    expect(sink.closed).toBe(false);
  });

  it('rejects XML 1.0 forbidden Unicode characters', async () => {
    for (const invalidCharacter of ['\uFFFE', '\uFFFF', '\uD800']) {
      const sink = new MemorySink();
      const session = await new XlsxWriter().create(sink);

      await expect(
        session.write([{ value: `invalid${invalidCharacter}value` }]),
      ).rejects.toThrow('invalid in XML');

      await session.abort('test cleanup');
      expect(sink.aborted).toBe(true);
      expect(sink.closed).toBe(false);
    }
  });

  it('aborts the output sink when cancelled', async () => {
    const sink = new MemorySink();
    const session = await new XlsxWriter().create(sink);

    await session.write([{ name: 'Alpha' }]);
    await session.abort('cancelled');

    expect(sink.aborted).toBe(true);
    expect(sink.closed).toBe(false);
  });

  it('rejects writes after the session is closed', async () => {
    const sink = new MemorySink();
    const session = await new XlsxWriter().create(sink);

    await session.close();

    await expect(
      session.write([{ value: 'late' }]),
    ).rejects.toThrow('closed XLSX writer');
  });
});
