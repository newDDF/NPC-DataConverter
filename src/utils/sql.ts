type DataRow = Record<string, unknown>;

const isIdentifierStart = (char: string) => /[A-Za-z_$]/.test(char);
const isIdentifierPart = (char: string) => /[A-Za-z0-9_$]/.test(char);

class SQLReader {
  private index = 0;

  constructor(private readonly source: string) {}

  private skipWhitespace() {
    while (this.index < this.source.length && /\s/.test(this.source[this.index])) {
      this.index++;
    }
  }

  private expect(value: string) {
    this.skipWhitespace();
    if (this.source.slice(this.index, this.index + value.length).toUpperCase() !== value.toUpperCase()) {
      throw new Error(`Expected "${value}" at position ${this.index + 1}.`);
    }
    this.index += value.length;
  }

  private readIdentifier(): string {
    this.skipWhitespace();
    const start = this.index;
    const first = this.source[this.index];

    if (first === '`' || first === '"' || first === '[') {
      const closing = first === '[' ? ']' : first;
      this.index++;
      let result = '';

      while (this.index < this.source.length) {
        const char = this.source[this.index++];

        if (char === closing) {
          if (this.source[this.index] === closing && closing !== ']') {
            result += closing;
            this.index++;
            continue;
          }
          return result;
        }

        result += char;
      }

      throw new Error('Unterminated quoted SQL identifier.');
    }

    if (!isIdentifierStart(first ?? '')) {
      throw new Error(`Invalid SQL identifier at position ${start + 1}.`);
    }

    this.index++;
    while (this.index < this.source.length && isIdentifierPart(this.source[this.index])) {
      this.index++;
    }

    return this.source.slice(start, this.index);
  }

  private readValue(): unknown {
    this.skipWhitespace();
    const char = this.source[this.index];

    if (char === "'") {
      this.index++;
      let result = '';

      while (this.index < this.source.length) {
        const current = this.source[this.index++];

        if (current === "'") {
          if (this.source[this.index] === "'") {
            result += "'";
            this.index++;
            continue;
          }
          return result;
        }

        if (current === '\\' && this.index < this.source.length) {
          const escaped = this.source[this.index++];
          const escapes: Record<string, string> = {
            n: '\n',
            r: '\r',
            t: '\t',
            '0': '\0',
            '\\': '\\',
            "'": "'",
          };
          result += escapes[escaped] ?? escaped;
        } else {
          result += current;
        }
      }

      throw new Error('Unterminated SQL string literal.');
    }

    const remaining = this.source.slice(this.index);
    const token = remaining.match(/^(NULL|TRUE|FALSE)\b/i);

    if (token) {
      this.index += token[0].length;
      switch (token[0].toUpperCase()) {
        case 'NULL': return null;
        case 'TRUE': return true;
        case 'FALSE': return false;
      }
    }

    const number = remaining.match(/^-?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/);
    if (number) {
      this.index += number[0].length;
      const value = Number(number[0]);
      if (!Number.isFinite(value)) throw new Error('Invalid numeric SQL literal.');
      return value;
    }

    throw new Error(`Unsupported SQL value at position ${this.index + 1}.`);
  }

  private readTuple(): unknown[] {
    this.expect('(');
    const values: unknown[] = [];

    this.skipWhitespace();
    if (this.source[this.index] === ')') {
      this.index++;
      return values;
    }

    while (true) {
      values.push(this.readValue());
      this.skipWhitespace();

      if (this.source[this.index] === ')') {
        this.index++;
        return values;
      }

      this.expect(',');
    }
  }

  parse(): DataRow[] {
    const rows: DataRow[] = [];
    let expectedColumns: string[] | null = null;

    while (true) {
      this.skipWhitespace();

      while (this.source[this.index] === ';') {
        this.index++;
        this.skipWhitespace();
      }

      if (this.index >= this.source.length) break;

      this.expect('INSERT');
      this.expect('INTO');

      this.readIdentifier();
      while (true) {
        this.skipWhitespace();
        if (this.source[this.index] !== '.') break;
        this.index++;
        this.readIdentifier();
      }

      let columns: string[] | null = null;
      this.skipWhitespace();

      if (this.source[this.index] === '(') {
        this.index++;
        columns = [];

        while (true) {
          columns.push(this.readIdentifier());
          this.skipWhitespace();

          if (this.source[this.index] === ')') {
            this.index++;
            break;
          }

          this.expect(',');
        }

        if (new Set(columns).size !== columns.length) {
          throw new Error('Duplicate column names are not supported.');
        }
      }

      this.expect('VALUES');

      const statementRows: unknown[][] = [];

      while (true) {
        statementRows.push(this.readTuple());
        this.skipWhitespace();

        if (this.source[this.index] !== ',') break;
        this.index++;
      }

      if (!columns) {
        throw new Error('INSERT statements must include an explicit column list.');
      }

      if (expectedColumns && (
        expectedColumns.length !== columns.length ||
        expectedColumns.some((column, index) => column !== columns![index])
      )) {
        throw new Error('Multiple INSERT statements must use the same table columns.');
      }

      expectedColumns ??= columns;

      for (const values of statementRows) {
        if (values.length !== columns.length) {
          throw new Error(`Column count mismatch: expected ${columns.length}, received ${values.length}.`);
        }

        rows.push(
          Object.fromEntries(columns.map((column, index) => [column, values[index]]))
        );
      }

      this.skipWhitespace();
      if (this.source[this.index] === ';') this.index++;
      else if (this.index < this.source.length) {
        throw new Error(`Unexpected SQL content at position ${this.index + 1}.`);
      }
    }

    if (rows.length === 0) {
      throw new Error('No supported INSERT INTO ... VALUES statements were found.');
    }

    return rows;
  }
}

export const parseSQL = (source: string): DataRow[] => {
  const cleaned = source.trim();

  if (!cleaned) return [];

  if (/--|\/\*|\*\//.test(cleaned)) {
    throw new Error('SQL comments are not supported in this version.');
  }

  return new SQLReader(cleaned).parse();
};

const quoteIdentifier = (identifier: string): string => {
  const value = identifier.trim();

  if (!value) {
    throw new Error('SQL table and column names cannot be empty.');
  }

  return `\`${value.replace(/`/g, '``')}\``;
};

const quoteTableName = (tableName: string): string => {
  const parts = tableName.split('.').map((part) => part.trim());

  if (parts.length === 0 || parts.some((part) => !part)) {
    throw new Error('SQL table name contains an empty identifier.');
  }

  return parts.map(quoteIdentifier).join('.');
};

const quoteValue = (value: unknown): string => {
  if (value === null || value === undefined) return 'NULL';

  if (value instanceof Date) {
    if (!Number.isFinite(value.getTime())) {
      throw new Error('Cannot serialize an invalid date to SQL.');
    }
    return quoteValue(value.toISOString());
  }

  if (typeof value === 'boolean') {
    return value ? '1' : '0';
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new Error('Cannot serialize a non-finite number to SQL.');
    }

    return String(value);
  }

  if (typeof value === 'string') {
    const escaped = value.replace(/[\\'\0\n\r\t\u001a]/g, (char) => {
      const escapes: Record<string, string> = {
        '\\': '\\\\',
        "'": "''",
        '\0': '\\0',
        '\n': '\\n',
        '\r': '\\r',
        '\t': '\\t',
        '\u001a': '\\Z',
      };

      return escapes[char];
    });

    return `'${escaped}'`;
  }

  throw new Error('Nested objects and arrays must be flattened before SQL export.');
};

const DEFAULT_SQL_BATCH_SIZE = 500;

const buildSQLHeader = (columns: string[], tableName: string): string => {
  if (columns.length === 0) {
    throw new Error('There are no columns to export to SQL.');
  }

  const columnList = columns.map(quoteIdentifier).join(', ');

  return `INSERT INTO ${quoteTableName(tableName)} (${columnList})`;
};

export const serializeSQL = (
  rows: DataRow[],
  columns: string[],
  tableName = 'data'
): string => {
  if (rows.length === 0) {
    throw new Error('There are no records to export to SQL.');
  }

  const header = buildSQLHeader(columns, tableName);

  return rows.map((row) => {
    const values = columns.map((column) => quoteValue(row[column])).join(', ');
    return `${header} VALUES (${values});`;
  }).join('\n');
};

export const serializeSQLCreate = (
  rows: DataRow[],
  columns: string[],
  tableName = 'data',
  batchSize = DEFAULT_SQL_BATCH_SIZE
): string => {
  if (rows.length === 0) {
    throw new Error('There are no records to export to SQL.');
  }

  if (!Number.isInteger(batchSize) || batchSize < 1) {
    throw new Error('SQL batch size must be a positive integer.');
  }

  const header = buildSQLHeader(columns, tableName);

  const statements: string[] = [];

  for (let offset = 0; offset < rows.length; offset += batchSize) {
    const chunk = rows.slice(offset, offset + batchSize);

    const valuesList = chunk.map((row) => {
      const values = columns.map((column) => quoteValue(row[column])).join(', ');
      return `  (${values})`;
    }).join(',\n');

    statements.push(`${header}\nVALUES\n${valuesList};`);
  }

  return statements.join('\n\n');
};

export const serializeSQLUpdate = (
  rows: DataRow[],
  columns: string[],
  keyColumns: string[],
  tableName = 'data'
): string => {
  if (rows.length === 0) {
    throw new Error('There are no records to export to SQL.');
  }

  if (columns.length === 0) {
    throw new Error('There are no columns to export to SQL.');
  }

  const keys = Array.from(new Set(keyColumns));

  if (keys.length === 0) {
    throw new Error('Select at least one primary key field for UPDATE.');
  }

  const missingKeys = keys.filter((key) => !columns.includes(key));
  if (missingKeys.length > 0) {
    throw new Error(`Primary key field(s) are unavailable: ${missingKeys.join(', ')}.`);
  }

  const updateColumns = columns.filter((column) => !keys.includes(column));
  if (updateColumns.length === 0) {
    throw new Error('No fields are available to update after excluding primary keys.');
  }

  return rows.map((row, index) => {
    const where = keys.map((key) => {
      const value = row[key];

      if (
        !Object.prototype.hasOwnProperty.call(row, key) ||
        value === null ||
        value === undefined ||
        (typeof value === 'string' && value.trim() === '')
      ) {
        throw new Error(
          `Missing or empty primary key "${key}" in record ${index + 1}.`
        );
      }

      return `${quoteIdentifier(key)} = ${quoteValue(value)}`;
    }).join(' AND ');

    const set = updateColumns
      .map((column) => `${quoteIdentifier(column)} = ${quoteValue(row[column])}`)
      .join(',\n  ');

    return `UPDATE ${quoteTableName(tableName)}\nSET\n  ${set}\nWHERE ${where};`;
  }).join('\n\n');
};


const inferSQLColumnType = (values: unknown[]): string => {
  const present = values.filter((value) => value !== null && value !== undefined);

  if (present.length === 0) return 'TEXT';

  if (present.every((value) => value instanceof Date)) {
    if (present.some((value) => !Number.isFinite((value as Date).getTime()))) {
      throw new Error('Cannot infer a SQL type from invalid dates.');
    }
    return 'DATETIME';
  }

  if (present.some((value) =>
    (typeof value === 'object' && !(value instanceof Date)) ||
    typeof value === 'function'
  )) {
    throw new Error('Nested objects and arrays must be flattened before SQL export.');
  }

  if (present.every((value) => typeof value === 'boolean')) {
    return 'TINYINT(1)';
  }

  const numericValues = present.filter(
    (value) => typeof value === 'number' || typeof value === 'boolean'
  );

  if (numericValues.length === present.length) {
    const numbers = numericValues.map((value) =>
      typeof value === 'boolean' ? Number(value) : value as number
    );

    if (!numbers.every(Number.isFinite)) {
      throw new Error('Cannot infer a SQL type from non-finite numbers.');
    }

    if (numbers.every(Number.isInteger)) {
      return numbers.every(Number.isSafeInteger) ? 'BIGINT' : 'DECIMAL(20,0)';
    }

    const decimalParts = numbers.map((value) => {
      const text = String(value);
      if (/[eE]/.test(text)) return null;
      const parts = text.replace(/^-/, '').split('.');
      return {
        precision: parts[0].replace(/^0+/, '').length + (parts[1]?.length ?? 0),
        scale: parts[1]?.length ?? 0,
      };
    });

    if (decimalParts.some((part) => part === null)) return 'DOUBLE';

    const scale = Math.min(
      30,
      Math.max(...decimalParts.map((part) => part!.scale))
    );
    const integerDigits = Math.max(
      1,
      ...decimalParts.map((part) => part!.precision - part!.scale)
    );
    const precision = Math.min(65, integerDigits + scale);

    return `DECIMAL(${Math.max(precision, scale + 1)},${scale})`;
  }

  if (present.every((value) => typeof value === 'string')) {
    const strings = present as string[];

    if (strings.every((value) => /^\d{4}-\d{2}-\d{2}$/.test(value))) {
      return 'DATE';
    }

    if (strings.every((value) =>
      /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(?:\.\d+)?$/.test(value)
    )) {
      return 'DATETIME(3)';
    }

    const maxLength = Math.max(1, ...strings.map((value) => value.length));

    if (maxLength <= 255) return `VARCHAR(${maxLength})`;
    if (maxLength <= 65535) return 'TEXT';
    if (maxLength <= 16777215) return 'MEDIUMTEXT';
    return 'LONGTEXT';
  }

  const maxLength = Math.max(
    1,
    ...present.map((value) => String(value).length)
  );

  if (maxLength <= 255) return `VARCHAR(${maxLength})`;
  if (maxLength <= 65535) return 'TEXT';
  if (maxLength <= 16777215) return 'MEDIUMTEXT';
  return 'LONGTEXT';
};

export const serializeSQLCreateTable = (
  rows: DataRow[],
  columns: string[],
  tableName = 'data',
  primaryKeyColumns: string[] = []
): string => {
  if (rows.length === 0) {
    throw new Error('There are no records to export to SQL.');
  }

  if (columns.length === 0) {
    throw new Error('There are no columns to export to SQL.');
  }

  if (new Set(columns).size !== columns.length) {
    throw new Error('Duplicate column names are not supported.');
  }

  const primaryKeys = Array.from(new Set(primaryKeyColumns));
  const missingKeys = primaryKeys.filter((key) => !columns.includes(key));

  if (missingKeys.length > 0) {
    throw new Error(`Primary key field(s) are unavailable: ${missingKeys.join(', ')}.`);
  }

  const definitions = columns.map((column) => {
    const type = inferSQLColumnType(rows.map((row) => row[column]));
    return `  ${quoteIdentifier(column)} ${type}`;
  });

  if (primaryKeys.length > 0) {
    definitions.push(
      `  PRIMARY KEY (${primaryKeys.map(quoteIdentifier).join(', ')})`
    );
  }

  return `CREATE TABLE ${quoteTableName(tableName)} (\n${definitions.join(',\n')}\n);`;
};

export const serializeSQLFormatted = (
  rows: DataRow[],
  columns: string[],
  tableName = 'data'
): string => serializeSQLCreate(rows, columns, tableName);
