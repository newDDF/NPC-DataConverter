import { describe, expect, it } from 'vitest';
import {
  parseSQL,
  serializeSQL,
  serializeSQLCreate,
  serializeSQLCreateTable,
  serializeSQLFormatted,
  serializeSQLUpdate,
} from '../sql';

describe('MySQL SQL serialization', () => {
  it('uses backticks for table and column identifiers', () => {
    const sql = serializeSQLCreate(
      [{ id: 1, name: 'Alice' }],
      ['id', 'name'],
      'app.users'
    );

    expect(sql).toContain('INSERT INTO `app`.`users`');
    expect(sql).toContain('`id`');
    expect(sql).toContain('`name`');
  });

  it('escapes backticks in identifiers', () => {
    const sql = serializeSQLCreate(
      [{ value: 'test' }],
      ['field`name'],
      'table`name'
    );

    expect(sql).toContain('`table``name`');
    expect(sql).toContain('`field``name`');
  });

  it('serializes null, booleans and numbers', () => {
    const sql = serializeSQLCreate(
      [{ a: null, b: true, c: false, d: 12.5 }],
      ['a', 'b', 'c', 'd']
    );

    expect(sql).toContain('(NULL, 1, 0, 12.5)');
  });

  it('escapes MySQL string values', () => {
    const value = "O'Reilly\\docs\nnext\rline\tend\0";
    const sql = serializeSQLCreate([{ value }], ['value']);

    expect(sql).toContain("'O''Reilly\\\\docs\\nnext\\rline\\tend\\0'");
  });

  it('creates multiple rows in one INSERT statement', () => {
    const sql = serializeSQLCreate(
      [{ id: 1 }, { id: 2 }, { id: 3 }],
      ['id']
    );

    expect(sql.match(/INSERT INTO/g)).toHaveLength(1);
    expect(sql).toContain('(1),\n  (2),\n  (3)');
  });

  it('splits large output into batches', () => {
    const rows = Array.from({ length: 5 }, (_, index) => ({
      id: index + 1,
    }));

    const sql = serializeSQLCreate(rows, ['id'], 'data', 2);

    expect(sql.match(/INSERT INTO/g)).toHaveLength(3);
    expect(sql).toContain('(1),\n  (2)');
    expect(sql).toContain('(3),\n  (4)');
    expect(sql).toContain('(5)');
  });

  it('rejects invalid input', () => {
    expect(() => serializeSQLCreate([], ['id'])).toThrow(
      'There are no records to export to SQL.'
    );

    expect(() => serializeSQLCreate([{ id: 1 }], [])).toThrow(
      'There are no columns to export to SQL.'
    );

    expect(() =>
      serializeSQLCreate([{ id: 1 }], ['id'], 'data', 0)
    ).toThrow('SQL batch size must be a positive integer.');

    expect(() =>
      serializeSQLCreate([{ value: {} }], ['value'])
    ).toThrow('Nested objects and arrays must be flattened before SQL export.');
  });

  it('keeps the existing serializer exports compatible', () => {
    const rows = [{ id: 1 }, { id: 2 }];

    expect(serializeSQLFormatted(rows, ['id'])).toBe(
      serializeSQLCreate(rows, ['id'])
    );

    expect(serializeSQL(rows, ['id'])).toContain(
      'INSERT INTO `data` (`id`) VALUES (1);'
    );
  });

  it('generates one UPDATE statement per record', () => {
    const sql = serializeSQLUpdate(
      [
        { id: 1, name: 'Alice', age: 25 },
        { id: 2, name: 'Bob', age: 30 },
      ],
      ['id', 'name', 'age'],
      ['id']
    );

    expect(sql).toContain('UPDATE `data`');
    expect(sql).toContain('`name` = \'Alice\'');
    expect(sql).toContain('`age` = 25');
    expect(sql).toContain('WHERE `id` = 1;');
    expect(sql).toContain('WHERE `id` = 2;');
    expect(sql.match(/UPDATE `data`/g)).toHaveLength(2);
    expect(sql).not.toMatch(/SET[\\s\\S]*?`id` =/);
  });

  it('supports composite primary keys', () => {
    const sql = serializeSQLUpdate(
      [{ region: 'west', id: 7, name: 'Updated' }],
      ['region', 'id', 'name'],
      ['region', 'id']
    );

    expect(sql).toContain("WHERE `region` = 'west' AND `id` = 7;");
    expect(sql).toContain("SET\n  `name` = 'Updated'");
  });

  it('rejects missing or empty primary key values', () => {
    expect(() =>
      serializeSQLUpdate([{ id: null, name: 'Alice' }], ['id', 'name'], ['id'])
    ).toThrow('Missing or empty primary key "id" in record 1.');

    expect(() =>
      serializeSQLUpdate([{ id: '', name: 'Alice' }], ['id', 'name'], ['id'])
    ).toThrow('Missing or empty primary key "id" in record 1.');

    expect(() =>
      serializeSQLUpdate([{ name: 'Alice' }], ['id', 'name'], ['id'])
    ).toThrow('Missing or empty primary key "id" in record 1.');
  });

  it('rejects unsafe UPDATE configurations', () => {
    expect(() =>
      serializeSQLUpdate([{ id: 1, name: 'Alice' }], ['id', 'name'], [])
    ).toThrow('Select at least one primary key field for UPDATE.');

    expect(() =>
      serializeSQLUpdate([{ id: 1 }], ['id'], ['id'])
    ).toThrow('No fields are available to update after excluding primary keys.');
  });

  it('can parse generated CREATE output with the existing INSERT parser', () => {
    const rows = [
      { id: 1, name: "O'Reilly" },
      { id: 2, name: 'Second row' },
    ];

    const sql = serializeSQLCreate(rows, ['id', 'name']);

    expect(parseSQL(sql)).toEqual(rows);
  });

  it('generates a MySQL CREATE TABLE statement with inferred types', () => {
    const sql = serializeSQLCreateTable(
      [
        { id: 1, name: 'Alice', active: true, score: 12.5, joined: '2026-01-15' },
        { id: 2, name: 'Bob', active: false, score: 18.25, joined: '2026-02-20' },
      ],
      ['id', 'name', 'active', 'score', 'joined'],
      'app.users'
    );

    expect(sql).toContain('CREATE TABLE `app`.`users`');
    expect(sql).toContain('`id` BIGINT');
    expect(sql).toContain('`name` VARCHAR(5)');
    expect(sql).toContain('`active` TINYINT(1)');
    expect(sql).toContain('`score` DECIMAL(4,2)');
    expect(sql).toContain('`joined` DATE');
    expect(sql).not.toContain('INSERT INTO');
  });

  it('supports optional composite primary keys in CREATE TABLE', () => {
    const sql = serializeSQLCreateTable(
      [{ region: 'west', item: 1, name: 'Sample' }],
      ['region', 'item', 'name'],
      'inventory',
      ['region', 'item']
    );

    expect(sql).toContain('PRIMARY KEY (`region`, `item`)');
  });

  it('does not assume an id column is a primary key', () => {
    const sql = serializeSQLCreateTable(
      [{ id: 1, name: 'Sample' }],
      ['id', 'name']
    );

    expect(sql).not.toContain('PRIMARY KEY');
    expect(sql).not.toContain('AUTO_INCREMENT');
  });

  it('rejects invalid CREATE TABLE input and nested values', () => {
    expect(() => serializeSQLCreateTable([], ['id'])).toThrow(
      'There are no records to export to SQL.'
    );

    expect(() => serializeSQLCreateTable([{ id: 1 }], [])).toThrow(
      'There are no columns to export to SQL.'
    );

    expect(() =>
      serializeSQLCreateTable([{ id: 1 }], ['id'], 'data', ['missing'])
    ).toThrow('Primary key field(s) are unavailable: missing.');

    expect(() =>
      serializeSQLCreateTable([{ value: { nested: true } }], ['value'])
    ).toThrow('Nested objects and arrays must be flattened before SQL export.');
  });

});
