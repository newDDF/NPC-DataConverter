import type { DataFormat } from '@/types/converter';
import {
  parseTextData,
  parseExcelBuffer,
  serializeRows,
  createExcelBlob,
  flattenObject,
} from '@/utils/parsers';

const EXTENSION_FORMATS: Record<string, DataFormat> = {
  json: 'json',
  csv: 'csv',
  xml: 'xml',
  yaml: 'yaml',
  yml: 'yaml',
  md: 'md',
  sql: 'sql',
  xlsx: 'excel',
  xls: 'excel',
};

export const getBatchSourceFormat = (fileName: string): DataFormat | null => {
  const extension = fileName.split('.').pop()?.toLowerCase() ?? '';
  return EXTENSION_FORMATS[extension] ?? null;
};

export const readBatchSource = async (
  file: File,
  format: DataFormat
): Promise<{ rows: Record<string, unknown>[]; preview: string }> => {
  if (format === 'excel') {
    const rows = parseExcelBuffer(await file.arrayBuffer());
    return {
      rows,
      preview: JSON.stringify(rows.slice(0, 20), null, 2),
    };
  }

  const text = await file.text();
  return {
    rows: parseTextData(text, format),
    preview: text.slice(0, 30000),
  };
};

export const convertBatchRows = (
  rows: Record<string, unknown>[],
  format: DataFormat,
  columns?: string[],
  tableName = 'data'
): { text: string; blob: Blob | null } => {
  const sourceRows = format === 'sql'
    ? rows.map((row) => flattenObject(row))
    : rows;

  const effectiveColumns = format === 'sql' && columns
    ? Array.from(new Set(sourceRows.flatMap((row) => Object.keys(row))))
        .filter((key) =>
          columns.some((column) =>
            key === column || key.startsWith(`${column}.`)
          )
        )
    : columns;

  const orderedRows = effectiveColumns === undefined
    ? sourceRows
    : sourceRows.map((row) =>
        Object.fromEntries(
          effectiveColumns
            .filter((key) => Object.prototype.hasOwnProperty.call(row, key))
            .map((key) => [key, row[key]])
        )
      );

  if (format === 'excel') {
    return {
      text: `Excel workbook ready. ${orderedRows.length} record(s) will be exported.`,
      blob: createExcelBlob(orderedRows),
    };
  }

  if (format === 'sql') {
    const sqlColumns = columns?.length
      ? columns.filter((key) => Object.prototype.hasOwnProperty.call(orderedRows[0] ?? {}, key))
      : Object.keys(orderedRows[0] ?? {});

    return {
      text: serializeRows(orderedRows, format, sqlColumns).replace(
        /INSERT INTO ([^ (]+) \(/g,
        `INSERT INTO ${tableName} (`
      ),
      blob: null,
    };
  }

  return {
    text: serializeRows(orderedRows, format, columns),
    blob: null,
  };
};

export const getBatchOutputExtension = (format: DataFormat): string =>
  format === 'excel' ? 'xlsx' : format;
