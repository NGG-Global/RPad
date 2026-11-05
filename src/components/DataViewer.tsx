import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { clsx } from 'clsx';
import { ArrowDown, ArrowUp, ClipboardCopy, Download, Info, X } from 'lucide-react';
import { useAppStore } from '@/store/app-store';
import { workspace } from '@/runtime/workspace';
import type { DfRef } from '@/runtime/webr-service';
import { useTranslate } from '@/hooks/useTranslate';
import { IconButton, Spinner, Button } from './ui';
import { copyText } from '@/utils/clipboard';
import { downloadBlob } from '@/utils/download';
import type { DataFrameMeta, DataFramePage } from '@/types';

const PAGE = 200;
const ROW_H = 32;

interface PageCache {
  [pageIndex: number]: DataFramePage | 'loading';
}

/**
 * Spreadsheet-like viewer. Rows are fetched from R in pages of 200 on demand,
 * sorted and filtered inside R, and rendered through a virtualizer.
 */
export function DataViewer({ dfRef, onClose }: { dfRef: DfRef; onClose: () => void }) {
  const { t } = useTranslate();
  const toast = useAppStore((s) => s.toast);
  const executions = useAppStore((s) => s.executions);
  const [meta, setMeta] = useState<DataFrameMeta | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sort, setSort] = useState<{ col: string; desc: boolean } | null>(null);
  const [filter, setFilter] = useState('');
  const [debouncedFilter, setDebouncedFilter] = useState('');
  const [pages, setPages] = useState<PageCache>({});
  const [filteredRows, setFilteredRows] = useState<number | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [summary, setSummary] = useState<{ col: string; text: string } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const generation = useRef(0);
  const lastExecCount = useRef(executions.length);

  useEffect(() => {
    const id = setTimeout(() => setDebouncedFilter(filter), 300);
    return () => clearTimeout(id);
  }, [filter]);

  const reload = useCallback(async () => {
    const gen = ++generation.current;
    setPages({});
    setFilteredRows(null);
    setSelected(new Set());
    try {
      const m = await workspace.getDataFrameMeta(dfRef);
      if (gen !== generation.current) return;
      setMeta(m);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [dfRef]);

  // Initial load and reload whenever the sort/filter changes or new code has run.
  useEffect(() => {
    void reload();
  }, [reload, sort, debouncedFilter]);

  useEffect(() => {
    if (executions.length !== lastExecCount.current) {
      lastExecCount.current = executions.length;
      const last = executions[executions.length - 1];
      if (last && (last.status === 'done' || last.status === 'error')) void reload();
    }
  }, [executions, reload]);

  const ensurePage = useCallback(
    (pageIndex: number) => {
      if (!meta) return;
      setPages((p) => {
        if (p[pageIndex]) return p;
        const gen = generation.current;
        void workspace
          .getDataFramePage(dfRef, { name: dfRef.name, offset: pageIndex * PAGE, limit: PAGE, sortColumn: sort?.col, sortDesc: sort?.desc, filterText: debouncedFilter })
          .then((page) => {
            if (gen !== generation.current) return;
            setPages((q) => ({ ...q, [pageIndex]: page }));
            setFilteredRows(page.filteredRows);
          })
          .catch((e) => setError((e as Error).message));
        return { ...p, [pageIndex]: 'loading' };
      });
    },
    [meta, dfRef, sort, debouncedFilter],
  );

  useEffect(() => {
    if (meta) ensurePage(0);
  }, [meta, ensurePage]);

  const totalRows = filteredRows ?? meta?.nrow ?? 0;
  const virtualizer = useVirtualizer({ count: totalRows, getScrollElement: () => scrollRef.current, estimateSize: () => ROW_H, overscan: 20 });
  const items = virtualizer.getVirtualItems();

  useEffect(() => {
    if (!items.length) return;
    const first = Math.floor(items[0].index / PAGE);
    const last = Math.floor(items[items.length - 1].index / PAGE);
    for (let p = first; p <= last; p++) ensurePage(p);
  }, [items, ensurePage]);

  const cell = (row: number, col: number): { text: string | null; loaded: boolean; rowIndex?: number } => {
    const page = pages[Math.floor(row / PAGE)];
    if (!page || page === 'loading') return { text: '', loaded: false };
    const i = row % PAGE;
    return { text: page.cells[col]?.[i] ?? null, loaded: true, rowIndex: page.rowIndex[i] };
  };

  const firstPage = pages[0];
  const colWidths = useMemo(() => {
    if (!meta) return [];
    return meta.columns.map((c, i) => {
      let longest = c.name.length;
      if (firstPage && firstPage !== 'loading') for (const v of firstPage.cells[i] ?? []) if (v && v.length > longest) longest = v.length;
      return Math.min(320, Math.max(96, longest * 8.5 + 28));
    });
  }, [meta, firstPage]);

  const toggleSort = (col: string) => setSort((s) => (s?.col !== col ? { col, desc: false } : s.desc ? null : { col, desc: true }));

  const toggleRow = (row: number) => setSelected((s) => { const n = new Set(s); n.has(row) ? n.delete(row) : n.add(row); return n; });

  const copySelected = async () => {
    if (!meta) return;
    const rows = [...selected].sort((a, b) => a - b);
    const header = meta.columns.map((c) => c.name).join('\t');
    const lines = rows.map((r) => meta.columns.map((_, c) => cell(r, c).text ?? 'NA').join('\t'));
    const ok = await copyText([header, ...lines].join('\n'));
    toast(ok ? 'success' : 'error', ok ? t('copied') : t('copyFailed'));
  };

  const copyCell = async (text: string | null) => {
    const ok = await copyText(text ?? 'NA');
    toast(ok ? 'success' : 'error', ok ? t('copied') : t('copyFailed'), 1200);
  };

  const exportCsv = async () => {
    try {
      const blob = await workspace.exportDataFrameCsv(dfRef);
      downloadBlob(blob, `${dfRef.name.replace(/[^A-Za-z0-9_.-]+/g, '_')}.csv`);
    } catch (e) {
      toast('error', (e as Error).message);
    }
  };

  const showSummary = async (col: string) => {
    try {
      setSummary({ col, text: await workspace.getColumnSummary(dfRef, col) });
    } catch (e) {
      toast('error', (e as Error).message);
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-surface" data-testid="data-viewer">
      <div className="flex flex-wrap items-center gap-2 border-b border-line bg-surface-2 px-2 py-1">
        <span className="font-mono text-sm font-semibold ltr-code">{dfRef.name}</span>
        {meta && <span className="text-xs text-ink-3">{meta.nrow} {t('rows')} × {meta.ncol} {t('columns')}</span>}
        {meta && filteredRows !== null && filteredRows !== meta.nrow && <span className="text-xs text-accent">{t('showing', { shown: filteredRows, total: meta.nrow })}</span>}
        <input className="h-9 w-44 rounded-md border border-line bg-surface px-3 text-sm focus:border-accent focus:outline-none" placeholder={t('filterRows')} value={filter} onChange={(e) => setFilter(e.target.value)} data-testid="df-filter" />
        {selected.size > 0 && (
          <Button size="sm" onClick={() => void copySelected()}><ClipboardCopy size={14} /> {t('copyRows')} ({selected.size})</Button>
        )}
        <div className="ms-auto flex items-center">
          {sort && <Button size="sm" variant="ghost" onClick={() => setSort(null)}>{t('clearSort')}</Button>}
          <IconButton label={t('exportCsv')} onClick={() => void exportCsv()} className="h-8 w-8 min-h-0 min-w-0" data-testid="df-export"><Download size={16} /></IconButton>
          <IconButton label={t('close')} onClick={onClose} className="h-8 w-8 min-h-0 min-w-0" data-testid="df-close"><X size={16} /></IconButton>
        </div>
      </div>
      {error && <div className="p-3 text-sm text-err">{error}</div>}
      {!meta && !error && <div className="flex items-center gap-2 p-4 text-sm text-ink-3"><Spinner /> {t('loadingData')}</div>}
      {meta && (
        <div ref={scrollRef} className="min-h-0 flex-1 overflow-auto scroll-thin" dir="ltr">
          <div style={{ width: 56 + colWidths.reduce((a, b) => a + b, 0) }}>
            <div className="sticky top-0 z-10 flex border-b border-line bg-surface-2 text-xs font-semibold" style={{ height: ROW_H + 10 }}>
              <div className="sticky left-0 z-20 flex w-14 shrink-0 items-center justify-center border-r border-line bg-surface-2 text-ink-3">{t('rowNumber')}</div>
              {meta.columns.map((c, i) => (
                <div key={c.name} className="flex shrink-0 flex-col justify-center border-r border-line/60 px-1" style={{ width: colWidths[i] }}>
                  <button type="button" className="flex items-center gap-1 truncate text-start font-mono" onClick={() => toggleSort(c.name)} title={t('sortAsc')} data-testid="df-col-header">
                    <span className="truncate">{c.name}</span>
                    {sort?.col === c.name && (sort.desc ? <ArrowDown size={12} /> : <ArrowUp size={12} />)}
                  </button>
                  <div className="flex items-center gap-1 text-[10px] font-normal text-ink-3">
                    <span className="truncate">{c.className}{c.levels ? ` (${c.levels.length})` : ''}</span>
                    <button type="button" className="ms-auto text-ink-3 hover:text-accent" onClick={() => void showSummary(c.name)} aria-label={t('columnSummary')}><Info size={12} /></button>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
              {items.map((vi) => {
                const row = vi.index;
                const first = cell(row, 0);
                const isSel = selected.has(row);
                return (
                  <div key={vi.key} className={clsx('absolute left-0 flex border-b border-line/50 text-[13px]', isSel ? 'bg-accent-soft' : row % 2 ? 'bg-surface-2/50' : 'bg-surface')} style={{ top: vi.start, height: ROW_H, width: '100%' }} data-testid="df-row">
                    <button type="button" onClick={() => toggleRow(row)} className={clsx('sticky left-0 z-[5] flex w-14 shrink-0 items-center justify-center border-r border-line font-mono text-xs text-ink-3', isSel ? 'bg-accent-soft' : 'bg-surface-2')}>
                      {first.loaded ? first.rowIndex : '…'}
                    </button>
                    {meta.columns.map((c, ci) => {
                      const v = cell(row, ci);
                      return (
                        <div
                          key={c.name}
                          className={clsx('shrink-0 truncate border-r border-line/40 px-2 leading-8 font-mono', v.text === null && v.loaded && 'italic text-ink-3', /numeric|integer|double/.test(c.className) && 'text-right')}
                          style={{ width: colWidths[ci] }}
                          onDoubleClick={() => v.loaded && void copyCell(v.text)}
                          title={v.text ?? (v.loaded ? 'NA' : '')}
                        >
                          {v.loaded ? (v.text ?? t('naValue')) : ''}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
      {summary && (
        <div className="border-t border-line bg-surface-2 px-3 py-2" dir="ltr">
          <div className="flex items-center text-xs text-ink-3"><span className="font-mono">{t('columnSummary')}: {summary.col}</span><button type="button" className="ms-auto" onClick={() => setSummary(null)}><X size={14} /></button></div>
          <pre className="console-pre text-xs">{summary.text}</pre>
        </div>
      )}
    </div>
  );
}
