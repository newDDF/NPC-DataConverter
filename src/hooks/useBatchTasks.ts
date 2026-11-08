'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import type { DataFormat, SQLMode } from '@/types/converter';
import type { BatchTask } from '@/types/batch';
import {
  convertBatchRows,
  getBatchOutputExtension,
  getBatchSourceFormat,
  readBatchSource,
} from '@/lib/batch/convert';
import { serializeSQLCreate, serializeSQLCreateTable, serializeSQLUpdate } from '@/utils/sql';

const createTaskId = () =>
  `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

export function useBatchTasks() {
  const [tasks, setTasks] = useState<BatchTask[]>([]);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [targetFormat, setTargetFormat] = useState<DataFormat>('json');
  const [isRunning, setIsRunning] = useState(false);
  const isRunningRef = useRef(false);

  const activeTask = useMemo(
    () => tasks.find((task) => task.id === activeTaskId) ?? null,
    [tasks, activeTaskId]
  );

  const completedCount = useMemo(
    () => tasks.filter((task) => task.status === 'completed').length,
    [tasks]
  );

  const updateTask = useCallback((id: string, updates: Partial<BatchTask>) => {
    setTasks((current) =>
      current.map((task) => task.id === id ? { ...task, ...updates } : task)
    );
  }, []);

  const loadTaskSource = useCallback(async (task: BatchTask) => {
    if (!task.sourceFormat) return;

    try {
      const source = await readBatchSource(task.file, task.sourceFormat);
      const sourceData = source.preview;

      updateTask(task.id, {
        sourceData,
        sourcePreview: source.preview,
        recordCount: source.rows.length,
        error: '',
      });
    } catch (error) {
      updateTask(task.id, {
        error: error instanceof Error ? error.message : 'Unable to read file.',
      });
    }
  }, [updateTask]);

  const selectTask = useCallback(async (id: string) => {
    setActiveTaskId(id);
    const task = tasks.find((item) => item.id === id);
    if (task && task.sourceFormat && task.sourceData === undefined) {
      await loadTaskSource(task);
    }
  }, [tasks, loadTaskSource]);

  const addFiles = useCallback((files: FileList | File[]) => {
    const incoming = Array.from(files);
    const newTasks: BatchTask[] = incoming.map((file) => {
      const sourceFormat = getBatchSourceFormat(file.name);
      return {
        id: createTaskId(),
        file,
        name: file.name,
        size: file.size,
        sourceFormat,
        outputFormat: null,
        status: sourceFormat ? 'waiting' : 'failed',
        sourcePreview: '',
        sourceData: undefined,
        outputText: '',
        outputBlob: null,
        error: sourceFormat ? '' : 'Unsupported file type.',
        recordCount: 0,
      };
    });

    setTasks((current) => [...current, ...newTasks]);

    if (newTasks.length > 0) {
      setActiveTaskId(newTasks[0].id);
      void loadTaskSource(newTasks[0]);
    }
  }, [loadTaskSource]);

  const removeTask = useCallback((id: string) => {
    setTasks((current) => {
      const next = current.filter((task) => task.id !== id);
      if (activeTaskId === id) {
        const nextActive = next[0] ?? null;
        setActiveTaskId(nextActive?.id ?? null);
        if (nextActive && nextActive.sourceData === undefined) {
          void loadTaskSource(nextActive);
        }
      }
      return next;
    });
  }, [activeTaskId, loadTaskSource]);

  const clearCompleted = useCallback(() => {
    setTasks((current) => {
      const next = current.filter((task) => task.status !== 'completed');
      if (activeTask?.status === 'completed') {
        const nextActive = next[0] ?? null;
        setActiveTaskId(nextActive?.id ?? null);
        if (nextActive && nextActive.sourceData === undefined) {
          void loadTaskSource(nextActive);
        }
      }
      return next;
    });
  }, [activeTask, loadTaskSource]);

  const processTask = useCallback(async (
    task: BatchTask,
    format: DataFormat,
    columns?: string[],
    tableName = 'data',
    sqlMode: SQLMode = 'insert',
    keyColumns: string[] = []
  ) => {
    if (!task.sourceFormat || task.status === 'processing' || task.status === 'completed') {
      return;
    }

    updateTask(task.id, {
      status: 'processing',
      outputFormat: null,
      error: '',
      outputText: '',
      outputBlob: null,
    });

    try {
      const source = await readBatchSource(task.file, task.sourceFormat);
      let outputText: string;
      let outputBlob: Blob | null = null;

      if (format === 'sql') {
        const availableColumns = Array.from(
          new Set(source.rows.flatMap((row) => Object.keys(row)))
        );
        const sqlColumns = columns?.length
          ? columns.filter((column) => availableColumns.includes(column))
          : availableColumns;

        if (sqlColumns.length === 0) {
          throw new Error('No valid fields are selected for SQL output.');
        }

        const inputColumns = sqlMode === 'update' || sqlMode === 'create'
          ? Array.from(new Set([...sqlColumns, ...keyColumns]))
          : sqlColumns;

        const orderedRows = source.rows.map((row) =>
          Object.fromEntries(
            inputColumns
              .filter((column) => Object.prototype.hasOwnProperty.call(row, column))
              .map((column) => [column, row[column]])
          )
        );

        outputText = sqlMode === 'update'
          ? serializeSQLUpdate(orderedRows, inputColumns, keyColumns, tableName)
          : sqlMode === 'create'
            ? serializeSQLCreateTable(orderedRows, inputColumns, tableName, keyColumns)
            : serializeSQLCreate(orderedRows, sqlColumns, tableName);
      } else {
        const result = convertBatchRows(source.rows, format, columns, tableName);
        outputText = result.text;
        outputBlob = result.blob;
      }

      updateTask(task.id, {
        status: 'completed',
        outputFormat: format,
        sourcePreview: source.preview,
        sourceData: source.preview,
        outputText,
        outputBlob,
        recordCount: source.rows.length,
        error: '',
      });
    } catch (error) {
      updateTask(task.id, {
        status: 'failed',
        error: error instanceof Error ? error.message : 'Conversion failed.',
      });
    }
  }, [updateTask]);

  const startAll = useCallback(async (
    format: DataFormat = targetFormat,
    columns?: string[],
    tableName = 'data',
    sqlMode: SQLMode = 'insert',
    keyColumns: string[] = []
  ) => {
    if (isRunningRef.current) return;

    const pending = tasks.filter(
      (task) =>
        task.sourceFormat !== null &&
        (task.status === 'waiting' || task.status === 'failed')
    );

    if (pending.length === 0) return;

    isRunningRef.current = true;
    setIsRunning(true);

    try {
      for (const task of pending) {
        await processTask(task, format, columns, tableName, sqlMode, keyColumns);
      }
    } finally {
      isRunningRef.current = false;
      setIsRunning(false);
    }
  }, [tasks, targetFormat, processTask]);

  const formatSQLTask = useCallback(async (
    id: string,
    columns: string[],
    tableName = 'data',
    sqlMode: SQLMode = 'insert',
    keyColumns: string[] = []
  ) => {
    const task = tasks.find((item) => item.id === id);
    if (!task || task.status !== 'completed' || !task.sourceFormat) return;

    try {
      const source = await readBatchSource(task.file, task.sourceFormat);
      const availableColumns = Array.from(
        new Set(source.rows.flatMap((row) => Object.keys(row)))
      );
      const sqlColumns = columns.length
        ? columns.filter((column) => availableColumns.includes(column))
        : availableColumns;

      if (sqlColumns.length === 0) {
        throw new Error('No valid fields are selected for SQL output.');
      }

      const inputColumns = sqlMode === 'update' || sqlMode === 'create'
        ? Array.from(new Set([...sqlColumns, ...keyColumns]))
        : sqlColumns;

      const orderedRows = source.rows.map((row) =>
        Object.fromEntries(
          inputColumns
            .filter((column) => Object.prototype.hasOwnProperty.call(row, column))
            .map((column) => [column, row[column]])
        )
      );

      const outputText = sqlMode === 'update'
        ? serializeSQLUpdate(orderedRows, inputColumns, keyColumns, tableName)
        : sqlMode === 'create'
          ? serializeSQLCreateTable(orderedRows, inputColumns, tableName, keyColumns)
          : serializeSQLCreate(orderedRows, sqlColumns, tableName);

      updateTask(id, {
        outputFormat: 'sql',
        outputText,
        outputBlob: null,
        error: '',
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'SQL formatting failed.';
      updateTask(id, {
        error: message,
        outputText: `SQL formatting error: ${message}`,
        outputBlob: null,
      });
    }
  }, [tasks, updateTask]);

  const downloadTask = useCallback((task: BatchTask) => {
    if (task.status !== 'completed' || !task.outputFormat) return;

    const blob = task.outputBlob ?? new Blob(
      [task.outputText],
      { type: 'text/plain;charset=utf-8' }
    );
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    const baseName = task.name.replace(/\.[^.]+$/, '');

    anchor.href = url;
    anchor.download = `${baseName}.${getBatchOutputExtension(task.outputFormat)}`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, []);

  return {
    tasks,
    activeTask,
    activeTaskId,
    targetFormat,
    setTargetFormat,
    isRunning,
    completedCount,
    addFiles,
    selectTask,
    removeTask,
    clearCompleted,
    startAll,
    formatSQLTask,
    downloadTask,
  };
}
