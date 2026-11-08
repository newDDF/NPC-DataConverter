import type {
  StreamingOutputSink,
  StreamingRecord,
  StreamingWriter,
  StreamingWriterSession,
  WriterOptions,
} from '../core/contracts';

type SqlMode = 'insert' | 'update' | 'create';

type ColumnStats = {
  seen: number;
  allBoolean: boolean;
  allNumberOrBoolean: boolean;
  allString: boolean;
  allDate: boolean;
  allDateTime: boolean;
  hasNonFinite: boolean;
  hasExponent: boolean;
  maxStringLength: number;
  maxIntegerDigits: number;
  maxScale: number;
  allInteger: boolean;
  allSafeInteger: boolean;
};

const quoteIdentifier = (value: string): string => {
  const identifier = value.trim();

  if (!identifier) {
    throw new Error('SQL table and column names cannot be empty.');
  }

  return `\`${identifier.replace(/`/g, '``')}\``;
};

const quoteTableName = (value: string): string => {
  const parts = value.split('.').map((part) => part.trim());

  if (parts.some((part) => !part)) {
    throw new Error('SQL table name contains an empty identifier.');
  }

  return parts.map(quoteIdentifier).join('.');
};

const quoteValue = (value: unknown): string => {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'boolean') return value ? '1' : '0';
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new Error('Cannot export non-finite numbers to SQL.');
    }
    return String(value);
  }
  if (typeof value === 'object' || typeof value === 'function') {
    throw new Error('Nested objects and arrays must be flattened before SQL export.');
  }
  return `'${String(value).replace(/\\/g, '\\\\').replace(/'/g, "''")}'`;
};

const createStats = (): ColumnStats => ({
  seen: 0,
  allBoolean: true,
  allNumberOrBoolean: true,
  allString: true,
  allDate: true,
  allDateTime: true,
  hasNonFinite: false,
  hasExponent: false,
  maxStringLength: 0,
  maxIntegerDigits: 1,
  maxScale: 0,
  allInteger: true,
  allSafeInteger: true,
});

const addValue = (stats: ColumnStats, value: unknown): void => {
  if (value === null || value === undefined) return;
  stats.seen += 1;

  if (typeof value === 'object' || typeof value === 'function') {
    throw new Error('Nested objects and arrays must be flattened before SQL export.');
  }

  stats.allBoolean &&= typeof value === 'boolean';
  stats.allNumberOrBoolean &&= typeof value === 'number' || typeof value === 'boolean';
  stats.allString &&= typeof value === 'string';

  if (typeof value === 'number' || typeof value === 'boolean') {
    const number = typeof value === 'boolean' ? Number(value) : value;

    if (!Number.isFinite(number)) {
      stats.hasNonFinite = true;
      return;
    }

    stats.allInteger &&= Number.isInteger(number);
    stats.allSafeInteger &&= Number.isSafeInteger(number);

    const text = String(number);
    if (/[eE]/.test(text)) {
      stats.hasExponent = true;
    } else {
      const parts = text.replace(/^-/, '').split('.');
      const integerDigits = Math.max(1, parts[0].replace(/^0+/, '').length);
      const scale = parts[1]?.length ?? 0;
      stats.maxIntegerDigits = Math.max(stats.maxIntegerDigits, integerDigits);
      stats.maxScale = Math.max(stats.maxScale, scale);
    }
  }

  if (typeof value === 'string') {
    stats.maxStringLength = Math.max(stats.maxStringLength, value.length);
    stats.allDate &&= /^\d{4}-\d{2}-\d{2}$/.test(value);
    stats.allDateTime &&= /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(?:\.\d+)?$/.test(value);
  }
};

const inferType = (stats: ColumnStats): string => {
  if (stats.seen === 0) return 'TEXT';
  if (stats.allBoolean) return 'TINYINT(1)';

  if (stats.allNumberOrBoolean) {
    if (stats.hasNonFinite) {
      throw new Error('Cannot infer a SQL type from non-finite numbers.');
    }
    if (stats.allInteger) {
      return stats.allSafeInteger ? 'BIGINT' : 'DECIMAL(20,0)';
    }
    if (stats.hasExponent) return 'DOUBLE';

    const scale = Math.min(30, stats.maxScale);
    const precision = Math.min(65, Math.max(1, stats.maxIntegerDigits) + scale);
    return `DECIMAL(${Math.max(precision, scale + 1)},${scale})`;
  }

  if (stats.allString) {
    if (stats.allDate) return 'DATE';
    if (stats.allDateTime) return 'DATETIME(3)';
    if (stats.maxStringLength <= 255) return `VARCHAR(${Math.max(1, stats.maxStringLength)})`;
    if (stats.maxStringLength <= 65535) return 'TEXT';
    if (stats.maxStringLength <= 16777215) return 'MEDIUMTEXT';
    return 'LONGTEXT';
  }

  return 'TEXT';
};

export class SqlWriter implements StreamingWriter {
  readonly format = 'sql' as const;

  async create(
    sink: StreamingOutputSink,
    options: WriterOptions = {},
  ): Promise<StreamingWriterSession> {
    const mode: SqlMode = options.sqlMode ?? 'insert';
    const tableName = options.tableName?.trim() || 'data';
    const table = quoteTableName(tableName);
    const keys = Array.from(new Set(options.keyColumns ?? []));

    let columns: string[] | undefined;
    let rowCount = 0;
    let firstInsertBatch = true;
    let closed = false;
    let aborted = false;
    let closing = false;
    const stats = new Map<string, ColumnStats>();

    const writeText = (text: string) => sink.write(text);

    const session: StreamingWriterSession = {
      write: async (rows: StreamingRecord[]) => {
        if (closed || aborted || closing) {
          throw new Error('SQL writer session is no longer active.');
        }
        if (rows.length === 0) return;

        for (const row of rows) {
          const rowColumns = Object.keys(row);
          if (!columns) {
            columns = rowColumns;
            if (columns.length === 0) throw new Error('There are no columns to export to SQL.');
            if (new Set(columns).size !== columns.length) {
              throw new Error('Duplicate column names are not supported.');
            }
            columns.forEach(quoteIdentifier);
            for (const column of columns) stats.set(column, createStats());
          } else if (rowColumns.some((column) => !columns!.includes(column))) {
            throw new Error('The input contains fields that were not present in the first record.');
          }

          for (const column of columns) {
            addValue(stats.get(column)!, row[column]);
          }
        }

        if (mode === 'create') {
          rowCount += rows.length;
          return;
        }

        if (mode === 'update') {
          if (keys.length === 0) {
            throw new Error('Select at least one primary key field for UPDATE.');
          }
          const missing = keys.filter((key) => !columns!.includes(key));
          if (missing.length) {
            throw new Error(`Primary key field(s) are unavailable: ${missing.join(', ')}.`);
          }
          const updateColumns = columns!.filter((column) => !keys.includes(column));
          if (updateColumns.length === 0) {
            throw new Error('No fields are available to update after excluding primary keys.');
          }

          const statements = rows.map((row, index) => {
            const where = keys.map((key) => {
              const value = row[key];
              if (
                !Object.prototype.hasOwnProperty.call(row, key) ||
                value === null ||
                value === undefined ||
                (typeof value === 'string' && value.trim() === '')
              ) {
                throw new Error(`Missing or empty primary key "${key}" in record ${rowCount + index + 1}.`);
              }
              return `${quoteIdentifier(key)} = ${quoteValue(value)}`;
            }).join(' AND ');

            const set = updateColumns
              .map((column) => `${quoteIdentifier(column)} = ${quoteValue(row[column])}`)
              .join(',\n  ');

            return `UPDATE ${table}\nSET\n  ${set}\nWHERE ${where};`;
          });

          await writeText(statements.join('\n') + '\n');
          rowCount += rows.length;
          return;
        }

        const header = `INSERT INTO ${table} (${columns!.map(quoteIdentifier).join(', ')})`;
        const values = rows.map((row) =>
          `(${columns!.map((column) => quoteValue(row[column])).join(', ')})`
        );

        if (firstInsertBatch) {
          await writeText(`${header}\nVALUES\n`);
          firstInsertBatch = false;
        } else {
          await writeText(',\n');
        }

        await writeText(values.join(',\n'));
        rowCount += rows.length;
      },

      close: async () => {
        if (closed || aborted || closing) return;
        closing = true;

        try {
          if (!columns || rowCount === 0 && mode !== 'insert') {
            throw new Error('There are no records to export to SQL.');
          }

          if (mode === 'create') {
            const missing = keys.filter((key) => !columns!.includes(key));
            if (missing.length) {
              throw new Error(`Primary key field(s) are unavailable: ${missing.join(', ')}.`);
            }

            const definitions = columns.map((column) =>
              `  ${quoteIdentifier(column)} ${inferType(stats.get(column)!)}`
            );

            if (keys.length) {
              definitions.push(`  PRIMARY KEY (${keys.map(quoteIdentifier).join(', ')})`);
            }

            await writeText(
              `CREATE TABLE ${table} (\n${definitions.join(',\n')}\n);\n`
            );
          } else if (mode === 'insert' && rowCount === 0) {
            throw new Error('There are no records to export to SQL.');
          }

          if (mode === 'insert' && rowCount > 0) {
            await writeText(';\n');
          }

          await sink.close();
          closed = true;
        } catch (error) {
          aborted = true;
          try {
            await sink.abort(error);
          } catch {
            // Preserve the original close error.
          }
          throw error;
        }
      },

      abort: async (reason?: unknown) => {
        if (closed || aborted) return;
        aborted = true;
        await sink.abort(reason);
      },
    };

    return session;
  }
}
