// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';
import {
  calculateCrc32,
  readZipDirectory,
  readZipEntry,
  ZipStoreWriter,
} from '../xlsx/zip';

describe('ZIP utilities', () => {
  it('calculates CRC32', () => {
    expect(
      calculateCrc32(new TextEncoder().encode('123456789')),
    ).toBe(0xcbf43926);
  });

  it('writes and reads multiple STORE entries', async () => {
    const chunks: Uint8Array[] = [];

    const writer = new ZipStoreWriter(async (chunk) => {
      chunks.push(chunk.slice());
    });

    await writer.addEntry('[Content_Types].xml', '<Types/>');
    await writer.addEntry(
      'xl/workbook.xml',
      new TextEncoder().encode('<workbook/>'),
    );
    await writer.close();

    const size = chunks.reduce(
      (total, chunk) => total + chunk.byteLength,
      0,
    );
    const output = new Uint8Array(size);
    let offset = 0;

    for (const chunk of chunks) {
      output.set(chunk, offset);
      offset += chunk.byteLength;
    }

    const file = new File([output], 'test.xlsx');
    const entries = await readZipDirectory(file);

    expect(entries.map((entry) => entry.name)).toEqual([
      '[Content_Types].xml',
      'xl/workbook.xml',
    ]);

    const workbook = entries.find(
      (entry) => entry.name === 'xl/workbook.xml',
    );

    expect(workbook).toBeDefined();

    const result: Uint8Array[] = [];

    for await (const chunk of readZipEntry(file, workbook!)) {
      result.push(chunk);
    }

    const text = new TextDecoder().decode(
      result.reduce(
        (all, chunk) => {
          const merged = new Uint8Array(all.length + chunk.length);
          merged.set(all);
          merged.set(chunk, all.length);
          return merged;
        },
        new Uint8Array(),
      ),
    );

    expect(text).toBe('<workbook/>');
  });

  it('rejects a corrupted entry using CRC32', async () => {
    const chunks: Uint8Array[] = [];
    const writer = new ZipStoreWriter(async (chunk) => {
      chunks.push(chunk.slice());
    });

    await writer.addEntry('data.txt', 'original');
    await writer.close();

    const size = chunks.reduce(
      (total, chunk) => total + chunk.byteLength,
      0,
    );
    const output = new Uint8Array(size);
    let offset = 0;

    for (const chunk of chunks) {
      output.set(chunk, offset);
      offset += chunk.byteLength;
    }

    output[38] ^= 0x01;

    const file = new File([output], 'corrupted.zip');
    const entries = await readZipDirectory(file);

    await expect(async () => {
      for await (const chunk of readZipEntry(file, entries[0])) {
        void chunk;
      }
    }).rejects.toThrow('CRC32 mismatch');
  });

  it('rejects entries that exceed the configured uncompressed size limit', async () => {
    const chunks: Uint8Array[] = [];
    const writer = new ZipStoreWriter(async (chunk) => {
      chunks.push(chunk.slice());
    });

    await writer.addEntry('data.txt', '123456789');
    await writer.close();

    const size = chunks.reduce((total, chunk) => total + chunk.byteLength, 0);
    const output = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      output.set(chunk, offset);
      offset += chunk.byteLength;
    }

    const file = new File([output], 'limited.zip');
    const entries = await readZipDirectory(file);

    await expect(async () => {
      for await (const chunk of readZipEntry(file, entries[0], undefined, 4)) {
        void chunk;
      }
    }).rejects.toThrow('configured uncompressed size limit');
  });

  it('rejects invalid ZIP data', async () => {
    const file = new File(['not a zip file'], 'invalid.xlsx');

    await expect(readZipDirectory(file)).rejects.toThrow(
      'end of central directory',
    );
  });
});
