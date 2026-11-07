import type { StreamingRecord } from './contracts';

const setOwnProperty = (
  target: StreamingRecord,
  key: string,
  value: unknown,
): void => {
  Object.defineProperty(target, key, {
    value,
    enumerable: true,
    configurable: true,
    writable: true,
  });
};

export const normalizeRecords = (value: unknown): StreamingRecord[] => {
  if (value === null || value === undefined) {
    return [];
  }

  const values = Array.isArray(value) ? value : [value];

  return values.map((item): StreamingRecord => {
    if (
      item !== null &&
      typeof item === 'object' &&
      !Array.isArray(item)
    ) {
      return item as StreamingRecord;
    }

    return { value: item };
  });
};

export const flattenRecord = (
  record: StreamingRecord,
  prefix = '',
): StreamingRecord => {
  const result: StreamingRecord = {};

  const ancestors = new WeakSet<object>([record]);

  const stack: Array<{
    record: StreamingRecord;
    prefix: string;
    keys: string[];
    index: number;
  }> = [
    {
      record,
      prefix,
      keys: Object.keys(record),
      index: 0,
    },
  ];

  while (stack.length > 0) {
    const frame = stack[stack.length - 1];

    if (frame.index >= frame.keys.length) {
      stack.pop();
      ancestors.delete(frame.record);
      continue;
    }

    const key = frame.keys[frame.index];
    frame.index += 1;

    const path = frame.prefix ? `${frame.prefix}.${key}` : key;
    const value = frame.record[key];

    if (
      value !== null &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      !(value instanceof Date)
    ) {
      const nestedRecord = value as StreamingRecord;

      if (ancestors.has(nestedRecord)) {
        throw new TypeError('Cannot flatten circular record structure.');
      }

      ancestors.add(nestedRecord);

      stack.push({
        record: nestedRecord,
        prefix: path,
        keys: Object.keys(nestedRecord),
        index: 0,
      });
    } else if (Array.isArray(value)) {
      setOwnProperty(result, path, JSON.stringify(value));
    } else {
      setOwnProperty(result, path, value);
    }
  }

  return result;
};
