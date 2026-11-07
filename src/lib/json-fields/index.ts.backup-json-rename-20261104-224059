export type JsonFieldType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'null'
  | 'object'
  | 'array'
  | 'mixed';

export interface JsonFieldNode {
  key: string;
  path: string;
  type: JsonFieldType;
  children: JsonFieldNode[];
  order: number;
}

export type JsonFieldSelection = Record<string, boolean>;

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' &&
  value !== null &&
  !Array.isArray(value);

const getValueType = (value: unknown): JsonFieldType => {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  if (isPlainObject(value)) return 'object';
  if (typeof value === 'string') return 'string';
  if (typeof value === 'number') return 'number';
  if (typeof value === 'boolean') return 'boolean';
  return 'mixed';
};

const mergeTypes = (values: unknown[]): JsonFieldType => {
  const types = new Set(values.map(getValueType));
  return types.size === 1 ? [...types][0] : 'mixed';
};

const collectChildren = (
  values: unknown[],
  prefix: string
): JsonFieldNode[] => {
  const objects: Record<string, unknown>[] = [];

  values.forEach((value) => {
    if (isPlainObject(value)) {
      objects.push(value);
    } else if (Array.isArray(value)) {
      value.forEach((item) => {
        if (isPlainObject(item)) objects.push(item);
      });
    }
  });

  const keys = new Set<string>();
  objects.forEach((object) => {
    Object.keys(object).forEach((key) => keys.add(key));
  });

  return [...keys].map((key, order) => {
    const fieldValues = objects
      .filter((object) => Object.prototype.hasOwnProperty.call(object, key))
      .map((object) => object[key]);

    const path = prefix ? `${prefix}.${key}` : key;
    const hasArray = fieldValues.some(Array.isArray);
    const childPrefix = `${path}${hasArray ? '[]' : ''}`;

    return {
      key,
      path,
      type: mergeTypes(fieldValues),
      children: collectChildren(fieldValues, childPrefix),
      order,
    };
  });
};

/**
 * Analyze records and build a merged field tree.
 * Fields found in any record or array element are included.
 */
export const buildJsonFieldTree = (
  rows: Record<string, unknown>[]
): JsonFieldNode[] => collectChildren(rows, '');

/**
 * Create an independent selection state.
 * All fields are selected by default.
 */
export const createJsonFieldSelection = (
  nodes: JsonFieldNode[],
  initialValue = true
): JsonFieldSelection => {
  const selection: JsonFieldSelection = {};

  const visit = (items: JsonFieldNode[]) => {
    items.forEach((node) => {
      selection[node.path] = initialValue;
      visit(node.children);
    });
  };

  visit(nodes);
  return selection;
};

/**
 * Change only the specified field's own selection.
 * Descendant preferences are intentionally preserved.
 */
export const setJsonFieldSelected = (
  selection: JsonFieldSelection,
  path: string,
  selected: boolean
): JsonFieldSelection => ({
  ...selection,
  [path]: selected,
});

/**
 * Determine whether a field is effectively selected.
 * Every ancestor must also be selected.
 */
export const isJsonFieldEffectivelySelected = (
  selection: JsonFieldSelection,
  path: string
): boolean => {
  const segments = path.split('.');
  let current = '';

  for (const segment of segments) {
    current = current ? `${current}.${segment}` : segment;
    const lookupPath = current.endsWith('[]')
      ? current.slice(0, -2)
      : current;

    if (selection[lookupPath] === false) return false;
  }

  return true;
};

/**
 * Reorder siblings without changing their paths or selection state.
 */
export const reorderJsonFieldNodes = (
  nodes: JsonFieldNode[],
  sourcePath: string,
  targetPath: string,
  insertAfter = false
): JsonFieldNode[] => {
  const sourceIndex = nodes.findIndex((node) => node.path === sourcePath);
  const targetIndex = nodes.findIndex((node) => node.path === targetPath);

  if (
    sourceIndex < 0 ||
    targetIndex < 0 ||
    sourceIndex === targetIndex
  ) {
    return nodes;
  }

  const result = [...nodes];
  const [moved] = result.splice(sourceIndex, 1);
  const adjustedTarget = result.findIndex(
    (node) => node.path === targetPath
  );

  result.splice(adjustedTarget + (insertAfter ? 1 : 0), 0, moved);

  return result.map((node, order) => ({ ...node, order }));
};

/**
 * Select or deselect every field within one level.
 * This does not modify fields in other branches.
 */
export const setJsonLevelSelection = (
  selection: JsonFieldSelection,
  nodes: JsonFieldNode[],
  selected: boolean
): JsonFieldSelection => {
  const result = { ...selection };

  nodes.forEach((node) => {
    result[node.path] = selected;
  });

  return result;
};

const filterObject = (
  value: Record<string, unknown>,
  nodes: JsonFieldNode[],
  selection: JsonFieldSelection
): Record<string, unknown> => {
  const result: Record<string, unknown> = {};

  nodes.forEach((node) => {
    if (
      selection[node.path] === false ||
      !Object.prototype.hasOwnProperty.call(value, node.key)
    ) {
      return;
    }

    const fieldValue = value[node.key];
    result[node.key] = filterValue(fieldValue, node.children, selection);
  });

  return result;
};

const filterValue = (
  value: unknown,
  children: JsonFieldNode[],
  selection: JsonFieldSelection
): unknown => {
  if (Array.isArray(value)) {
    return value.map((item) => {
      if (isPlainObject(item)) {
        return filterObject(item, children, selection);
      }

      if (Array.isArray(item)) {
        return filterValue(item, children, selection);
      }

      return item;
    });
  }

  if (isPlainObject(value)) {
    return filterObject(value, children, selection);
  }

  return value;
};

/**
 * Apply field selection recursively while preserving JSON nesting.
 * The input data is never mutated.
 */
export const filterJsonRows = (
  rows: Record<string, unknown>[],
  nodes: JsonFieldNode[],
  selection: JsonFieldSelection
): Record<string, unknown>[] =>
  rows.map((row) => filterObject(row, nodes, selection));

/**
 * Count fields at the current level only.
 */
export const countJsonLevelFields = (
  nodes: JsonFieldNode[]
): number => nodes.length;

/**
 * Count all fields recursively.
 */
export const countJsonFields = (
  nodes: JsonFieldNode[]
): number =>
  nodes.reduce(
    (total, node) => total + 1 + countJsonFields(node.children),
    0
  );
