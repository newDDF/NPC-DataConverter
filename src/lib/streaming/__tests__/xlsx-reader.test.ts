// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';
import { XlsxReader } from '../readers/xlsx-reader';
import { ZipStoreWriter } from '../xlsx/zip';

async function createXlsxFile(
  worksheet: string,
  sharedStrings = '',
): Promise<File> {
  const chunks: Uint8Array[] = [];
  const writer = new ZipStoreWriter(async (chunk) => {
    chunks.push(chunk.slice());
  });

  await writer.addEntry(
    'xl/workbook.xml',
    '<?xml version="1.0"?><workbook xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Sheet1" sheetId="1" r:id="rId1"/></sheets></workbook>',
  );

  await writer.addEntry(
    'xl/_rels/workbook.xml.rels',
    '<?xml version="1.0"?><Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml" Type="worksheet"/></Relationships>',
  );

  if (sharedStrings) {
    await writer.addEntry('xl/sharedStrings.xml', sharedStrings);
  }

  await writer.addEntry('xl/worksheets/sheet1.xml', worksheet);
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

  return new File([output], 'test.xlsx');
}

async function collectRows(
  file: File,
  batchSize?: number,
): Promise<{ rows: Record<string, unknown>[]; batches: number[] }> {
  const reader = new XlsxReader();
  const rows: Record<string, unknown>[] = [];
  const batches: number[] = [];

  for await (const batch of reader.read(file, { batchSize })) {
    rows.push(...batch.rows);
    batches.push(batch.rows.length);
  }

  return { rows, batches };
}

describe('XlsxReader', () => {
  it('reads shared strings, numbers, booleans and cached formula values', async () => {
    const file = await createXlsxFile(
      `<worksheet><sheetData>
        <row r="1">
          <c r="A1" t="s"><v>0</v></c>
          <c r="B1" t="s"><v>1</v></c>
          <c r="C1" t="s"><v>2</v></c>
          <c r="D1" t="s"><v>3</v></c>
        </row>
        <row r="2">
          <c r="A2" t="s"><v>4</v></c>
          <c r="B2"><v>42.5</v></c>
          <c r="C2" t="b"><v>1</v></c>
          <c r="D2"><f>40+2</f><v>42</v></c>
        </row>
      </sheetData></worksheet>`,
      `<sst>
        <si><t>Name</t></si>
        <si><t>Score</t></si>
        <si><t>Active</t></si>
        <si><t>Calculated</t></si>
        <si><t>Alice</t></si>
      </sst>`,
    );

    const result = await collectRows(file);

    expect(result.rows).toEqual([
      {
        Name: 'Alice',
        Score: 42.5,
        Active: true,
        Calculated: 42,
      },
    ]);
  });

  it('reads inline strings and preserves empty cells', async () => {
    const file = await createXlsxFile(
      `<worksheet><sheetData>
        <row>
          <c r="A1" t="inlineStr"><is><t>Name</t></is></c>
          <c r="B1" t="inlineStr"><is><t>Note</t></is></c>
          <c r="C1"/>
        </row>
        <row>
          <c r="A2" t="inlineStr"><is><t>Bob</t></is></c>
          <c r="C2"><v>12</v></c>
        </row>
      </sheetData></worksheet>`,
    );

    const result = await collectRows(file);

    expect(result.rows).toEqual([
      {
        Name: 'Bob',
        Note: null,
        column_3: 12,
      },
    ]);
  });

  it('creates unique names for duplicate headers', async () => {
    const file = await createXlsxFile(
      `<worksheet><sheetData>
        <row>
          <c r="A1" t="inlineStr"><is><t>Value</t></is></c>
          <c r="B1" t="inlineStr"><is><t>Value</t></is></c>
          <c r="C1" t="inlineStr"><is><t>Value</t></is></c>
        </row>
        <row>
          <c r="A2"><v>1</v></c>
          <c r="B2"><v>2</v></c>
          <c r="C2"><v>3</v></c>
        </row>
      </sheetData></worksheet>`,
    );

    const result = await collectRows(file);

    expect(result.rows).toEqual([
      {
        Value: 1,
        Value_2: 2,
        Value_3: 3,
      },
    ]);
  });

  it('emits rows in configured batch sizes', async () => {
    const file = await createXlsxFile(
      `<worksheet><sheetData>
        <row><c r="A1" t="inlineStr"><is><t>ID</t></is></c></row>
        <row><c r="A2"><v>1</v></c></row>
        <row><c r="A3"><v>2</v></c></row>
        <row><c r="A4"><v>3</v></c></row>
      </sheetData></worksheet>`,
    );

    const result = await collectRows(file, 2);

    expect(result.rows).toHaveLength(3);
    expect(result.batches).toEqual([2, 1]);
  });

  it('rejects cell references outside Excel worksheet limits', async () => {
    const invalidReferences = ['XFE1', 'A1048577', 'AAAA1', 'A0'];

    for (const reference of invalidReferences) {
      const file = await createXlsxFile(
        `<worksheet><sheetData><row r="1"><c r="${reference}" t="inlineStr"><is><t>Header</t></is></c></row></sheetData></worksheet>`,
      );

      await expect(collectRows(file)).rejects.toThrow(/XLSX cell reference|Invalid XLSX cell reference/);
    }
  });

  it('rejects an already aborted signal', async () => {
    const file = await createXlsxFile(
      '<worksheet><sheetData/></worksheet>',
    );
    const controller = new AbortController();
    controller.abort();

    const reader = new XlsxReader();

    await expect(async () => {
      for await (const batch of reader.read(file, {
        signal: controller.signal,
      })) {
        void batch;
      }
    }).rejects.toThrow('aborted');
  });

  it('rejects invalid batch sizes', async () => {
    const file = await createXlsxFile(
      '<worksheet><sheetData/></worksheet>',
    );
    const reader = new XlsxReader();

    await expect(async () => {
      for await (const batch of reader.read(file, { batchSize: 0 })) {
        void batch;
      }
    }).rejects.toThrow('batchSize');
  });
});
