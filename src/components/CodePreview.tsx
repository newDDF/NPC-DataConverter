'use client';

import React, { useMemo, useRef, useCallback } from 'react';
import Prism from 'prismjs';
import 'prismjs/components/prism-sql';

import 'prismjs/components/prism-json';
import 'prismjs/components/prism-yaml';
import 'prismjs/components/prism-markup';
import 'prismjs/components/prism-markdown';

type CodeFormat = 'json' | 'csv' | 'excel' | 'xml' | 'yaml' | 'md' | 'sql';

interface CodePreviewProps {
  value: string;
  language: CodeFormat;
  editable?: boolean;
  onChange?: (value: string) => void;
  placeholder?: string;
  maxPreviewLength?: number;
}

if (!Prism.languages.csv) {
  Prism.languages.csv = {
    string: /"(?:[^"]|"")*"/,
    number: /\b\d+(?:\.\d+)?\b/,
    punctuation: /,/,
  };
}

const languageMap: Record<CodeFormat, string> = {
  json: 'json',
  csv: 'csv',
  excel: 'plain',
  xml: 'markup',
  yaml: 'yaml',
  md: 'markdown',
  sql: 'sql',
};

const DEFAULT_MAX_PREVIEW_LENGTH = 100 * 1024;
const MAX_HIGHLIGHT_LENGTH = 256 * 1024;

export default function CodePreview({
  value,
  language,
  editable = false,
  onChange,
  placeholder = '',
  maxPreviewLength = DEFAULT_MAX_PREVIEW_LENGTH,
}: CodePreviewProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const preRef = useRef<HTMLPreElement>(null);

  const prismLanguage = languageMap[language];

  const isTruncated =
    !editable &&
    maxPreviewLength > 0 &&
    value.length > maxPreviewLength;

  const previewValue = isTruncated
    ? value.slice(0, maxPreviewLength)
    : value;

  const highlightedCode = useMemo(() => {
    if (!value) return '';

    const source = editable ? value : previewValue;

    if (source.length > MAX_HIGHLIGHT_LENGTH) {
      return Prism.util.encode(source) as string;
    }

    const grammar = Prism.languages[prismLanguage];

    if (!grammar) return Prism.util.encode(source) as string;

    return Prism.highlight(source, grammar, prismLanguage);
  }, [value, previewValue, editable, prismLanguage]);

  const handleScroll = useCallback(() => {
    if (!textareaRef.current || !preRef.current) return;

    preRef.current.scrollTop = textareaRef.current.scrollTop;
    preRef.current.scrollLeft = textareaRef.current.scrollLeft;
  }, []);

  const codeStyle =
    'm-0 w-full p-3 font-mono text-xs leading-5 whitespace-pre-wrap [overflow-wrap:anywhere] [tab-size:2]';

  return (
    <div className="code-preview relative w-full flex-1 min-h-0 overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
      {editable && (
        <pre
          ref={preRef}
          aria-hidden="true"
          className={`${codeStyle} absolute inset-0 overflow-hidden pointer-events-none text-slate-700 dark:text-slate-200`}
        >
          <code dangerouslySetInnerHTML={{ __html: highlightedCode || ' ' }} />
        </pre>
      )}

      {!editable && value && (
        <pre
          className={`${codeStyle} absolute inset-0 overflow-auto text-slate-700 dark:text-slate-200`}
        >
          <code dangerouslySetInnerHTML={{ __html: highlightedCode }} />
        </pre>
      )}

      {!editable && !value && placeholder && (
        <div className="absolute inset-0 p-3 font-mono text-xs leading-5 text-slate-400 pointer-events-none">
          {placeholder}
        </div>
      )}

      {editable && (
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(event) => onChange?.(event.target.value)}
          onScroll={handleScroll}
          placeholder={placeholder}
          spellCheck={false}
          autoCapitalize="off"
          autoComplete="off"
          autoCorrect="off"
          wrap="soft"
          aria-label="Editable source code preview"
          className={`${codeStyle} absolute inset-0 h-full resize-none overflow-auto rounded-xl border-0 bg-transparent text-transparent caret-slate-900 dark:caret-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[#ff6be4] selection:bg-pink-300/40 dark:selection:bg-pink-400/30`}
        />
      )}

      {isTruncated && (
        <div className="absolute bottom-0 left-0 right-0 z-10 border-t border-pink-200 dark:border-pink-900 bg-pink-50/95 dark:bg-slate-900/95 px-3 py-2 text-xs text-slate-600 dark:text-slate-300">
          Preview limited to the first {maxPreviewLength.toLocaleString()} characters.
          The complete converted data is preserved for download.
        </div>
      )}
    </div>
  );
}
