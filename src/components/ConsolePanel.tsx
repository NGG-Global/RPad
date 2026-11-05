import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { clsx } from 'clsx';
import { AlertTriangle, ChevronDown, ChevronUp, ClipboardCopy, Eraser, Image as ImageIcon, MoreHorizontal, Send, Sparkles, Square, CheckSquare, XCircle, Loader2 } from 'lucide-react';
import { useAppStore } from '@/store/app-store';
import { workspace } from '@/runtime/workspace';
import { useTranslate } from '@/hooks/useTranslate';
import { IconButton, Menu, MenuItem, MenuSeparator, EmptyState } from './ui';
import { useGeminiActions } from './GeminiMenu';
import type { ExecutionRecord, OutputChunk } from '@/types';

const COLLAPSE_LINES = 40;

function chunkClass(kind: OutputChunk['kind']): string {
  switch (kind) {
    case 'error': return 'text-err';
    case 'warning': return 'text-warn';
    case 'message': return 'text-ink-2';
    case 'stderr': return 'text-ink-2';
    default: return 'text-ink';
  }
}

const ExecutionView = memo(function ExecutionView({ exec, selected, onToggleSelect }: { exec: ExecutionRecord; selected: boolean; onToggleSelect: () => void }) {
  const { t } = useTranslate();
  const actions = useGeminiActions();
  const [expanded, setExpanded] = useState(false);
  const plots = useAppStore((s) => s.plots);
  const set = useAppStore((s) => s.set);
  const lines = useMemo(() => exec.output.reduce((n, c) => n + c.text.split('\n').length, 0), [exec.output]);
  const collapsible = lines > COLLAPSE_LINES;
  const hasError = exec.output.some((c) => c.kind === 'error');
  const hasWarning = exec.output.some((c) => c.kind === 'warning');
  const execPlots = plots.filter((p) => exec.plotIds.includes(p.id));

  return (
    <div className={clsx('group border-b border-line/70 px-2 py-1.5', selected && 'bg-accent-soft/60')} data-testid="execution" data-status={exec.status}>
      <div className="flex items-start gap-1">
        <button type="button" className="tap -ms-1 shrink-0 text-ink-3 hover:text-ink" onClick={onToggleSelect} aria-label={t('selectExecution')}>
          {selected ? <CheckSquare size={16} className="text-accent" /> : <Square size={16} />}
        </button>
        <div className="min-w-0 flex-1">
          <pre className="console-pre ltr-code text-accent" data-testid="exec-code">
            {exec.code.split('\n').map((l, i) => `${i === 0 ? '> ' : '+ '}${l}`).join('\n')}
          </pre>
          {exec.status === 'queued' && <div className="text-xs text-ink-3">{t('queued')}</div>}
          {exec.status === 'running' && <div className="flex items-center gap-1 text-xs text-ink-3"><Loader2 size={12} className="animate-spin" /> {t('busy')}</div>}
          {exec.status === 'cancelled' && <div className="text-xs text-ink-3">{t('executionCancelled')}</div>}
          <div className={clsx('relative', collapsible && !expanded && 'max-h-[28rem] overflow-hidden')} data-testid="exec-output">
            {exec.output.map((c, i) => (
              <pre key={i} className={clsx('console-pre ltr-code', chunkClass(c.kind))}>{c.text}</pre>
            ))}
            {collapsible && !expanded && <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-surface to-transparent" />}
          </div>
          {collapsible && (
            <button type="button" className="mt-1 flex items-center gap-1 text-xs text-accent" onClick={() => setExpanded((e) => !e)}>
              {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              {expanded ? t('collapse') : t('moreLines', { n: lines - COLLAPSE_LINES })}
            </button>
          )}
          {execPlots.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-2" dir="ltr">
              {execPlots.map((p) => (
                <button key={p.id} type="button" className="overflow-hidden rounded-md border border-line bg-white" onClick={() => set({ activePlotId: p.id, sidePanel: 'plots', portraitTab: 'plots' })} title={t('plots')}>
                  <img src={p.url} alt="R plot" className="h-28 w-auto object-contain" loading="lazy" />
                </button>
              ))}
            </div>
          )}
          {exec.changedFiles.length > 0 && <div className="mt-1 text-[11px] text-ink-3 ltr-code">{t('changedFiles', { files: exec.changedFiles.join(', ') })}</div>}
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          {hasError && <XCircle size={14} className="text-err" aria-label={t('errorsInOutput')} />}
          {!hasError && hasWarning && <AlertTriangle size={14} className="text-warn" aria-label={t('warningsInOutput')} />}
          {execPlots.length > 0 && <ImageIcon size={14} className="text-ink-3" />}
          {(exec.status === 'done' || exec.status === 'error') && (
            <Menu
              align="end"
              trigger={(open) => <IconButton label={t('copy')} onClick={open} className="h-8 w-8 min-h-0 min-w-0"><MoreHorizontal size={16} /></IconButton>}
            >
              {(close) => (
                <>
                  <MenuItem icon={<Sparkles size={16} />} onClick={() => (close(), actions.copyGemini(exec))}>{t('copyGeminiContext')}</MenuItem>
                  <MenuSeparator />
                  <MenuItem icon={<ClipboardCopy size={16} />} onClick={() => (close(), actions.copyCode(exec))}>{t('copyCode')}</MenuItem>
                  <MenuItem icon={<ClipboardCopy size={16} />} onClick={() => (close(), actions.copyOutput(exec))}>{t('copyOutput')}</MenuItem>
                  <MenuItem icon={<ClipboardCopy size={16} />} onClick={() => (close(), actions.copyBoth(exec))}>{t('copyBoth')}</MenuItem>
                </>
              )}
            </Menu>
          )}
        </div>
      </div>
    </div>
  );
});

export function ConsolePanel() {
  const { t } = useTranslate();
  const executions = useAppStore((s) => s.executions);
  const selected = useAppStore((s) => s.selectedExecutionIds);
  const history = useAppStore((s) => s.consoleHistory);
  const runtimeStatus = useAppStore((s) => s.runtimeStatus);
  const set = useAppStore((s) => s.set);
  const [input, setInput] = useState('');
  const [histIdx, setHistIdx] = useState<number | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const stickToBottom = useRef(true);
  const actions = useGeminiActions();

  useEffect(() => {
    const el = listRef.current;
    if (el && stickToBottom.current) el.scrollTop = el.scrollHeight;
  }, [executions]);

  const onScroll = () => {
    const el = listRef.current;
    if (!el) return;
    stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
  };

  const submit = () => {
    const code = input.trim();
    if (!code) return;
    workspace.runCode(code, 'console');
    setInput('');
    setHistIdx(null);
    stickToBottom.current = true;
    inputRef.current?.focus();
  };

  const onKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    } else if (e.key === 'ArrowUp' && (histIdx !== null || !input)) {
      e.preventDefault();
      const idx = histIdx === null ? history.length - 1 : Math.max(0, histIdx - 1);
      if (history[idx] !== undefined) {
        setHistIdx(idx);
        setInput(history[idx]);
      }
    } else if (e.key === 'ArrowDown' && histIdx !== null) {
      e.preventDefault();
      const idx = histIdx + 1;
      if (idx >= history.length) {
        setHistIdx(null);
        setInput('');
      } else {
        setHistIdx(idx);
        setInput(history[idx]);
      }
    }
  };

  const toggleSelect = (id: string) => set({ selectedExecutionIds: selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id] });
  const selectedExecs = executions.filter((e) => selected.includes(e.id));

  return (
    <div className="flex h-full min-h-0 flex-col bg-surface" data-testid="console-panel">
      <div className="flex items-center gap-1 border-b border-line bg-surface-2 px-2 py-1">
        <span className="text-[13px] font-semibold text-ink-2">{t('console')}</span>
        {selected.length > 0 && (
          <>
            <span className="text-xs text-ink-3">· {t('selected')} {selected.length}</span>
            <IconButton label={t('copySelection')} onClick={() => void actions.copyMany(selectedExecs)} className="h-8 w-8 min-h-0 min-w-0"><ClipboardCopy size={15} /></IconButton>
            <button type="button" className="text-xs text-accent" onClick={() => set({ selectedExecutionIds: [] })}>{t('deselect')}</button>
          </>
        )}
        <div className="ms-auto flex items-center gap-0.5">
          <IconButton label={t('clearConsole')} onClick={() => void workspace.clearConsole()} className="h-8 w-8 min-h-0 min-w-0"><Eraser size={16} /></IconButton>
        </div>
      </div>
      <div ref={listRef} onScroll={onScroll} className="min-h-0 flex-1 overflow-y-auto scroll-thin" data-testid="console-list">
        {executions.length === 0 ? (
          <EmptyState>{t('noExecutions')}</EmptyState>
        ) : (
          executions.map((e) => <ExecutionView key={e.id} exec={e} selected={selected.includes(e.id)} onToggleSelect={() => toggleSelect(e.id)} />)
        )}
      </div>
      <div className="flex items-end gap-1 border-t border-line px-2 py-1.5" dir="ltr">
        <span className="pb-2 font-mono text-sm text-accent">&gt;</span>
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKey}
          rows={1}
          placeholder={t('consolePlaceholder')}
          aria-label={t('console')}
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          className="console-pre ltr-code max-h-32 min-h-[40px] flex-1 resize-none rounded-md border border-line bg-surface px-2 py-2 focus:border-accent focus:outline-none"
          data-testid="console-input"
        />
        <IconButton label="run" onClick={submit} disabled={!input.trim() || runtimeStatus === 'error'} className="text-accent" data-testid="console-submit"><Send size={18} /></IconButton>
      </div>
    </div>
  );
}
