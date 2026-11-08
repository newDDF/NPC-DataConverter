'use client';

import { useMemo, useState } from 'react';
import {
  Check,
  Pencil,
  X,
  ChevronDown,
  ChevronRight,
  FolderOpen,
  ListTree,
} from 'lucide-react';
import type { Dictionary } from '@/i18n/types';
import type {
  JsonFieldNode,
  JsonFieldSelection,
} from '@/lib/json-fields';
import {
  isJsonFieldEffectivelySelected,
  setJsonFieldSelected,
  setJsonLevelSelection,
  reorderJsonFieldNodes,
} from '@/lib/json-fields';

interface Props {
  labels: Dictionary["jsonFields"] & {
    fieldNameEmpty: string;
    duplicateFieldName: string;
  };
  nodes: JsonFieldNode[];
  selection: JsonFieldSelection;
  onSelectionChange: (value: JsonFieldSelection) => void;
  onNodesChange: (value: JsonFieldNode[]) => void;
  fieldRenames: Record<string, string>;
  onFieldRename: (path: string, name: string) => void;
}

export default function JsonFieldManager({
  labels,
  nodes,
  selection,
  onSelectionChange,
  onNodesChange,
  fieldRenames,
  onFieldRename,
}: Props) {
  const [focusPath, setFocusPath] = useState('');
  const [expanded, setExpanded] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [dragPath, setDragPath] = useState('');
  const [dragPosition, setDragPosition] = useState<{ x: number; y: number } | null>(null);
  const [editingPath, setEditingPath] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [renameError, setRenameError] = useState('');

  const currentNodes = useMemo(() => {
    if (!focusPath) return nodes;

    const find = (items: JsonFieldNode[]): JsonFieldNode | undefined => {
      for (const item of items) {
        if (item.path === focusPath) return item;
        const nested = find(item.children);
        if (nested) return nested;
      }
    };

    return find(nodes)?.children ?? [];
  }, [nodes, focusPath]);

  const currentLabel = focusPath.split('.').pop()?.replace('[]', '') || labels.root;
  const visibleNodes = currentNodes.filter((node) => {
    const displayName = fieldRenames[node.path] ?? node.key;
    const query = search.toLowerCase();
    return (
      node.key.toLowerCase().includes(query) ||
      displayName.toLowerCase().includes(query) ||
      node.path.toLowerCase().includes(query)
    );
  });

  const toggleExpanded = (path: string) => {
    setExpanded((previous) =>
      previous.includes(path)
        ? previous.filter((item) => item !== path)
        : [...previous, path]
    );
  };

  const updateNodeOrder = (
    sourcePath: string,
    targetPath: string,
    after: boolean
  ) => {
    const update = (items: JsonFieldNode[]): JsonFieldNode[] => {
      if (
        items.some((item) => item.path === sourcePath) &&
        items.some((item) => item.path === targetPath)
      ) {
        return reorderJsonFieldNodes(items, sourcePath, targetPath, after);
      }

      return items.map((item) => ({
        ...item,
        children: update(item.children),
      }));
    };

    onNodesChange(update(nodes));
  };

  const handleNodePointerDown = (
    event: React.PointerEvent<HTMLSpanElement>,
    path: string
  ) => {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragPath(path);
    setDragPosition({ x: event.clientX, y: event.clientY });
  };

  const handleNodePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragPath) return;

    setDragPosition({ x: event.clientX, y: event.clientY });

    const element = document.elementFromPoint(event.clientX, event.clientY);
    const targetRow = element?.closest<HTMLElement>('[data-json-field-path]');
    const targetPath = targetRow?.dataset.jsonFieldPath;

    if (!targetPath || targetPath === dragPath || !targetRow) return;

    const rect = targetRow.getBoundingClientRect();
    updateNodeOrder(
      dragPath,
      targetPath,
      event.clientY > rect.top + rect.height / 2
    );
  };

  const handleNodePointerUp = () => {
    setDragPath('');
    setDragPosition(null);
  };

  const renderTree = (items: JsonFieldNode[], depth = 0): React.ReactNode =>
    items.map((node) => {
      const checked = isJsonFieldEffectivelySelected(selection, node.path);
      const isExpanded = expanded.includes(node.path);
      const hasChildren = node.children.length > 0;

      return (
        <div key={node.path}>
          <div
            data-json-field-path={node.path}
            className={`group flex items-center gap-1 rounded-xl border px-2 py-2 transition-all ${
              dragPath === node.path
                ? 'border-dashed border-[#ff6be4] opacity-30'
                : checked
                  ? 'border-pink-300 bg-pink-50/80 text-[#ff6be4] shadow-sm dark:border-pink-900 dark:bg-pink-950/40'
                  : 'border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-700 dark:bg-slate-800/80'
            }`}
            style={{ marginLeft: `${depth * 14}px` }}
          >
            <span
              title={labels.dragToReorder}
              onPointerDown={(event) => handleNodePointerDown(event, node.path)}
              className="cursor-grab select-none touch-none font-mono text-slate-400 active:cursor-grabbing"
            >
              ⠿
            </span>

            {hasChildren ? (
              <button
                type="button"
                onClick={() => toggleExpanded(node.path)}
                className="p-0.5 text-slate-400"
                aria-label={isExpanded ? labels.collapseField : labels.expandField}
              >
                {isExpanded
                  ? <ChevronDown className="h-3.5 w-3.5" />
                  : <ChevronRight className="h-3.5 w-3.5" />}
              </button>
            ) : (
              <span className="w-4" />
            )}

            <button
              type="button"
              onClick={() => onSelectionChange(
                setJsonFieldSelected(selection, node.path, !checked)
              )}
              className="flex min-w-0 flex-1 items-center gap-2 text-left"
            >
              {checked
                ? <Check className="h-3.5 w-3.5 shrink-0 text-[#ff6be4]" />
                : <span className="h-3.5 w-3.5 shrink-0 rounded border border-slate-300 dark:border-slate-600" />}
              <span className="truncate text-[11px] font-mono">
                {fieldRenames[node.path] ?? node.key}
              </span>
              <span className="ml-auto shrink-0 text-[9px] text-slate-400">
                {node.type}
              </span>
            </button>

            {editingPath === node.path ? (
              <div className="flex min-w-0 items-center gap-1">
                <input
                  autoFocus
                  value={editingName}
                  onChange={(event) => {
                    setEditingName(event.target.value);
                    setRenameError('');
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      const nextName = editingName.trim();
                      if (!nextName) {
                        setRenameError(labels.fieldNameEmpty);
                        return;
                      }
                      const duplicate = items.some((other) =>
                        other.path !== node.path &&
                        (fieldRenames[other.path] ?? other.key).toLowerCase() === nextName.toLowerCase()
                      );
                      if (duplicate) {
                        setRenameError(labels.duplicateFieldName);
                        return;
                      }
                      onFieldRename(node.path, nextName);
                      setEditingPath(null);
                      setRenameError('');
                    }
                    if (event.key === 'Escape') {
                      setEditingPath(null);
                      setRenameError('');
                    }
                  }}
                  className="w-28 min-w-0 rounded border border-[#ff6be4] bg-white px-1.5 py-1 text-[10px] font-mono text-slate-800 outline-none dark:bg-slate-900 dark:text-slate-100"
                  aria-label={labels.newFieldName}
                />
                <button
                  type="button"
                  onClick={() => {
                    const nextName = editingName.trim();
                    if (!nextName) {
                      setRenameError(labels.fieldNameEmpty);
                      return;
                    }
                    const duplicate = items.some((other) =>
                      other.path !== node.path &&
                      (fieldRenames[other.path] ?? other.key).toLowerCase() === nextName.toLowerCase()
                    );
                    if (duplicate) {
                      setRenameError(labels.duplicateFieldName);
                      return;
                    }
                    onFieldRename(node.path, nextName);
                    setEditingPath(null);
                    setRenameError('');
                  }}
                  className="rounded p-1 text-[#ff6be4]"
                  title={labels.saveFieldName}
                >
                  <Check className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditingPath(null);
                    setRenameError('');
                  }}
                  className="rounded p-1 text-slate-400"
                  title={labels.cancelRename}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setEditingPath(node.path);
                  setEditingName(fieldRenames[node.path] ?? node.key);
                  setRenameError('');
                }}
                className="rounded p-1 text-slate-400 hover:text-[#ff6be4]"
                title={labels.renameField}
                aria-label={labels.renameField}
              >
                <Pencil className="h-3 w-3" />
              </button>
            )}

            {hasChildren && (
              <button
                type="button"
                onClick={() => setFocusPath(node.path)}
                title={labels.focusLevel}
                className="rounded p-1 text-slate-400 hover:text-[#ff6be4]"
              >
                <FolderOpen className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {editingPath === node.path && renameError && (
            <p className="ml-8 mt-1 text-[10px] text-rose-500">{renameError}</p>
          )}

          {hasChildren && isExpanded && (
            <div className="mt-1 space-y-1">
              {renderTree(node.children, depth + 1)}
            </div>
          )}
        </div>
      );
    });

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex items-center gap-2 border-b border-slate-100 pb-2 dark:border-slate-800">
        <ListTree className="h-4 w-4 text-[#ff6be4]" />
        <span className="text-xs font-bold uppercase tracking-wide text-slate-800 dark:text-slate-200">
          {labels.title} ({labels.dragToReorder})
        </span>
        <span className="ml-auto rounded-full bg-pink-500/10 px-2 py-0.5 text-[10px] font-medium text-[#ff6be4]">
          {Object.values(selection).filter(Boolean).length}/{Object.keys(selection).length}
        </span>
      </div>

      <div className="flex items-center gap-2 text-[10px]">
        <button
          type="button"
          onClick={() => setFocusPath('')}
          className={!focusPath ? 'font-semibold text-[#ff6be4]' : 'text-slate-500'}
        >
          {labels.root}
        </button>
        {focusPath && (
          <>
            <span className="text-slate-400">/</span>
            <span className="truncate font-semibold text-[#ff6be4]">{currentLabel}</span>
            <button
              type="button"
              onClick={() => {
                const parts = focusPath.split('.');
                parts.pop();
                setFocusPath(parts.join('.'));
              }}
              className="ml-auto rounded-lg border border-slate-200 px-2 py-1 text-slate-500 dark:border-slate-700"
            >
              {labels.back}
            </button>
          </>
        )}
      </div>

      <div className="relative">
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={labels.searchFields}
          className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs outline-none focus:border-[#ff6be4] dark:border-slate-700 dark:bg-slate-800"
        />
      </div>

      <div className="flex items-center justify-between gap-1">
        <button
          type="button"
          onClick={() => onSelectionChange(
            setJsonLevelSelection(selection, currentNodes, true)
          )}
          className="flex-1 rounded-lg border border-slate-200 bg-slate-100 py-1 text-[10px] font-medium text-slate-700 hover:bg-pink-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
        >
          {labels.selectAll}
        </button>
        <button
          type="button"
          onClick={() => onSelectionChange(
            setJsonLevelSelection(selection, currentNodes, false)
          )}
          className="flex-1 rounded-lg border border-slate-200 bg-slate-100 py-1 text-[10px] font-medium text-slate-700 hover:bg-rose-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
        >
          {labels.deselectAll}
        </button>
      </div>

      <div
        className="relative flex-1 min-h-0 space-y-1.5 overflow-y-auto overscroll-contain p-0.5"
        onPointerMove={handleNodePointerMove}
        onPointerUp={handleNodePointerUp}
        onPointerCancel={handleNodePointerUp}
      >
        {renderTree(visibleNodes)}
        {visibleNodes.length === 0 && (
          <p className="py-6 text-center text-xs text-slate-400">
            {labels.noFieldsFound}
          </p>
        )}
        {dragPath && dragPosition && (
          <div
            aria-hidden="true"
            className="pointer-events-none fixed z-[9999] flex items-center gap-2 rounded-xl border border-[#ff6be4] bg-white/95 px-3 py-2 text-xs font-medium text-[#ff6be4] shadow-2xl dark:bg-slate-900/95 scale-[1.03]"
            style={{
              left: dragPosition.x,
              top: dragPosition.y,
              transform: 'translate(-50%, -50%)',
              minWidth: '150px',
            }}
          >
            <span className="font-mono text-slate-400">⠿</span>
            <span className="truncate">{dragPath.split('.').pop() || dragPath}</span>
          </div>
        )}
      </div>
    </div>
  );
}
