'use client';

import {
  Layers, Download, Trash2, ChevronDown,
  Clock3, LoaderCircle, CheckCircle2, AlertCircle,
} from 'lucide-react';
import type { BatchTask } from '@/types/batch';

function sizeLabel(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

function Status({ task }: { task: BatchTask }) {
  if (task.status === 'completed') return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />;
  if (task.status === 'processing') return <LoaderCircle className="w-3.5 h-3.5 animate-spin text-blue-500" />;
  if (task.status === 'failed') return <AlertCircle className="w-3.5 h-3.5 text-rose-500" />;
  return <Clock3 className="w-3.5 h-3.5 text-slate-400" />;
}

interface SharedProps {
  tasks: BatchTask[];
  activeTaskId: string | null;
  onSelect: (id: string) => void;
  onRemove: (id: string) => void;
  onDownload: (task: BatchTask) => void;
}

interface InputProps extends Omit<SharedProps, 'onDownload'> {
  open: boolean;
  onToggle: () => void;
  completedCount: number;
  onClearCompleted: () => void;
}

export function BatchInputPanel({
  open, onToggle, tasks, activeTaskId, onSelect, onRemove,
  completedCount, onClearCompleted,
}: InputProps) {
  return (
    <div className="border-b border-slate-200 dark:border-slate-800">
      <button
        type="button"
        onClick={onToggle}
        className="w-full px-4 py-2.5 flex items-center justify-between text-xs hover:bg-slate-50 dark:hover:bg-slate-800/50"
      >
        <span className="flex items-center gap-2 font-semibold text-slate-600 dark:text-slate-300">
          <Layers className="w-3.5 h-3.5 text-[#ff6be4]" />
          Batch files
          <span className="text-slate-400 font-normal">{tasks.length} files</span>
        </span>
        <span className="flex items-center gap-3">
          <span
            role="button"
            onClick={(event) => {
              event.stopPropagation();
              onClearCompleted();
            }}
            className={`text-[11px] font-medium ${completedCount ? 'text-rose-400 hover:text-rose-500' : 'text-slate-400 opacity-40'}`}
          >
            Clear completed
          </span>
          <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
        </span>
      </button>

      {open && (
        <div className="px-3 pb-3 space-y-1 bg-slate-50/70 dark:bg-slate-950/30">
          <div className="grid grid-cols-[minmax(0,1fr)_75px_65px] gap-2 px-2 py-1 text-[10px] uppercase tracking-wide text-slate-400 font-semibold">
            <span>Data</span><span>Size</span><span>Records</span>
          </div>

          <div className="max-h-56 overflow-y-auto space-y-1">
            {tasks.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-3">No batch files added.</p>
            ) : tasks.map((task) => (
              <div
                key={task.id}
                className={`grid grid-cols-[minmax(0,1fr)_75px_65px] gap-2 items-center rounded-lg px-2 py-2 text-xs ${
                  activeTaskId === task.id
                    ? 'bg-pink-50 dark:bg-pink-950/30 border border-pink-200 dark:border-pink-900'
                    : 'hover:bg-white dark:hover:bg-slate-800 border border-transparent'
                }`}
              >
                <button type="button" onClick={() => onSelect(task.id)} className="min-w-0 flex items-center gap-2 text-left">
                  <Status task={task} />
                  <span className="truncate text-slate-700 dark:text-slate-200">{task.name}</span>
                </button>
                <span className="text-slate-400">{sizeLabel(task.size)}</span>
                <span className="flex items-center justify-between gap-1 text-slate-500">
                  {task.recordCount || '—'}
                  <button type="button" onClick={() => onRemove(task.id)} title="Remove file" className="text-slate-400 hover:text-rose-500">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

interface OutputProps extends SharedProps {
  open: boolean;
  onToggle: () => void;
}

export function BatchOutputPanel({
  open, onToggle, tasks, onSelect, onDownload,
}: OutputProps) {
  const completed = tasks.filter((task) => task.status === 'completed').length;

  return (
    <div className="border-b border-slate-200 dark:border-slate-800">
      <button
        type="button"
        onClick={onToggle}
        className="w-full px-4 py-2.5 flex items-center justify-between text-xs hover:bg-slate-50 dark:hover:bg-slate-800/50"
      >
        <span className="flex items-center gap-2 font-semibold text-slate-600 dark:text-slate-300">
          <Layers className="w-3.5 h-3.5 text-[#ff6be4]" />
          Batch output
          <span className="text-slate-400 font-normal">{completed}/{tasks.length} completed</span>
        </span>
        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="px-3 pb-3 max-h-56 overflow-y-auto space-y-1 bg-slate-50/70 dark:bg-slate-950/30">
          {tasks.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-3">Batch output status will appear here.</p>
          ) : tasks.map((task) => (
            <div key={task.id} className="flex items-center justify-between gap-2 px-2 py-2 rounded-lg hover:bg-white dark:hover:bg-slate-800">
              <button type="button" onClick={() => onSelect(task.id)} className="min-w-0 flex items-center gap-2 text-left">
                <Status task={task} />
                <span className="truncate text-xs text-slate-700 dark:text-slate-200">{task.name}</span>
                <span className="text-[10px] text-slate-400 shrink-0">
                  {task.status === 'completed' ? `→ ${task.outputFormat?.toUpperCase()}` : task.status}
                </span>
              </button>
              {task.status === 'completed' && (
                <button type="button" onClick={() => onDownload(task)} className="shrink-0 px-2 py-1.5 rounded-md text-xs text-[#e34ac8] hover:bg-pink-50 dark:hover:bg-pink-950/40 flex items-center gap-1">
                  <Download className="w-3.5 h-3.5" /> Download
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
