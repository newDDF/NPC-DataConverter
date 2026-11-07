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

export default function CodePreview({
  value,
  language,
  editable = false,
  onChange,
  placeholder = '',
}: CodePreviewProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const preRef = useRef<HTMLPreElement>(null);

  const prismLanguage = languageMap[language];

  const highlightedCode = useMemo(() => {
    if (!value) return '';

    const grammar = Prism.languages[prismLanguage];

    if (!grammar) return Prism.util.encode(value) as string;

    return Prism.highlight(value, grammar, prismLanguage);
  }, [value, prismLanguage]);

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
    </div>
  );
}
