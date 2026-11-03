'use client';

import { useState } from 'react';

type InspectorTab = 'overview' | 'preview' | 'fields' | 'diagnostics';

interface InspectorDrawerProps {
  title: string;
  format: string;
  sizeLabel: string;
  recordCount: number;
  fields: string[];
  preview: string;
  diagnostic: string;
  hasError?: boolean;
}

const TABS: { id: InspectorTab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'preview', label: 'Data Preview' },
  { id: 'fields', label: 'Fields' },
  { id: 'diagnostics', label: 'Diagnostics' },
];

export default function InspectorDrawer({
  title,
  format,
  sizeLabel,
  recordCount,
  fields,
  preview,
  diagnostic,
  hasError = false,
}: InspectorDrawerProps) {
  const [activeTab, setActiveTab] = useState<InspectorTab>('overview');

  return (
    <details className="group relative z-20 shrink-0 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/30">
      <summary className="cursor-pointer list-none px-4 py-3 flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300 hover:text-[#ff6be4]">
        <span>{title}</span>
        <span className="flex items-center gap-3 text-slate-400 font-normal">
          <span>Overview · Preview · Fields · Diagnostics</span>
          <span className="transition-transform group-open:rotate-180">⌄</span>
        </span>
      </summary>

      <div className="absolute left-0 right-0 top-full z-30 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl">
        <div className="flex items-center gap-1 overflow-x-auto border-b border-slate-200 dark:border-slate-800 px-3 py-2">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`shrink-0 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
                activeTab === tab.id
                  ? 'bg-[#ff6be4]/10 text-[#ff6be4]'
                  : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 dark:text-slate-400'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="max-h-[260px] overflow-y-auto p-4 text-xs">
          {activeTab === 'overview' && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="rounded-xl bg-slate-50 dark:bg-slate-800 p-3">
                <div className="text-slate-400 mb-1">Format</div>
                <div className="font-semibold text-slate-800 dark:text-slate-200 uppercase">{format}</div>
              </div>
              <div className="rounded-xl bg-slate-50 dark:bg-slate-800 p-3">
                <div className="text-slate-400 mb-1">Data Size</div>
                <div className="font-semibold text-slate-800 dark:text-slate-200">{sizeLabel}</div>
              </div>
              <div className="rounded-xl bg-slate-50 dark:bg-slate-800 p-3">
                <div className="text-slate-400 mb-1">Records</div>
                <div className="font-semibold text-slate-800 dark:text-slate-200">{recordCount.toLocaleString()}</div>
              </div>
              <div className="rounded-xl bg-slate-50 dark:bg-slate-800 p-3">
                <div className="text-slate-400 mb-1">Fields</div>
                <div className="font-semibold text-slate-800 dark:text-slate-200">{fields.length}</div>
              </div>
            </div>
          )}

          {activeTab === 'preview' && (
            <pre className="whitespace-pre-wrap break-words font-mono text-[11px] leading-5 text-slate-600 dark:text-slate-300">
              {preview ? preview.slice(0, 12000) : 'No preview data available.'}
              {preview.length > 12000 ? '\n\nPreview truncated.' : ''}
            </pre>
          )}

          {activeTab === 'fields' && (
            <div className="flex flex-wrap gap-2">
              {fields.length > 0 ? fields.map((field) => (
                <span
                  key={field}
                  className="rounded-md bg-slate-100 dark:bg-slate-800 px-2.5 py-1.5 text-slate-600 dark:text-slate-300"
                >
                  {field}
                </span>
              )) : (
                <span className="text-slate-400">No fields detected.</span>
              )}
            </div>
          )}

          {activeTab === 'diagnostics' && (
            <div className={`rounded-xl p-3 ${
              hasError
                ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-300'
                : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300'
            }`}>
              {diagnostic}
            </div>
          )}
        </div>
      </div>
    </details>
  );
}
