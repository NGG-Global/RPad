import { useState } from 'react';
import { ChevronDown, ChevronRight, RefreshCw, Table2 } from 'lucide-react';
import { clsx } from 'clsx';
import { useAppStore } from '@/store/app-store';
import { workspace } from '@/runtime/workspace';
import { useTranslate } from '@/hooks/useTranslate';
import { IconButton, EmptyState } from './ui';

export function EnvironmentPanel() {
  const { t } = useTranslate();
  const env = useAppStore((s) => s.env);
  const set = useAppStore((s) => s.set);
  const runtimeStatus = useAppStore((s) => s.runtimeStatus);
  const [open, setOpen] = useState<Record<string, boolean>>({});

  return (
    <div className="flex h-full min-h-0 flex-col" data-testid="environment-panel">
      <div className="flex items-center gap-1 border-b border-line bg-surface-2 px-2 py-1">
        <span className="text-[13px] font-semibold text-ink-2">{t('environment')}</span>
        <span className="text-xs text-ink-3">· {env.length}</span>
        <div className="ms-auto">
          <IconButton label={t('refresh')} onClick={() => void workspace.refreshEnvironmentQueued()} disabled={runtimeStatus === 'loading' || runtimeStatus === 'idle'} className="h-8 w-8 min-h-0 min-w-0"><RefreshCw size={15} /></IconButton>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto scroll-thin">
        {env.length === 0 ? (
          <EmptyState>{t('noObjects')}</EmptyState>
        ) : (
          <ul>
            {env.map((o) => (
              <li key={o.name} className="border-b border-line/60" data-testid="env-object" data-name={o.name}>
                <div className="flex items-center gap-1 px-1.5">
                  <button type="button" className="tap shrink-0 text-ink-3" onClick={() => setOpen((s) => ({ ...s, [o.name]: !s[o.name] }))} aria-label={t('expand')}>
                    {open[o.name] ? <ChevronDown size={16} /> : <ChevronRight size={16} className="rtl:rotate-180" />}
                  </button>
                  <button
                    type="button"
                    className={clsx('flex min-h-[40px] min-w-0 flex-1 items-center gap-2 text-start', o.isDataFrame && 'cursor-pointer')}
                    onClick={() => (o.isDataFrame ? set({ dataViewer: { kind: 'global', name: o.name }, portraitTab: 'data' }) : setOpen((s) => ({ ...s, [o.name]: !s[o.name] })))}
                    title={o.isDataFrame ? t('viewData') : undefined}
                  >
                    <span className="min-w-0 truncate font-mono text-[13px] font-semibold ltr-code">{o.name}</span>
                    <span className="truncate text-xs text-ink-3 ltr-code">{o.className}</span>
                    <span className="ms-auto shrink-0 text-xs text-ink-2 ltr-code">{o.dims}</span>
                    {o.isDataFrame && <Table2 size={15} className="shrink-0 text-accent" />}
                  </button>
                </div>
                {open[o.name] && (
                  <div className="px-3 pb-2 text-xs">
                    <div className="text-ink-3">{t('type')}: <span className="font-mono ltr-code">{o.typeName}</span></div>
                    <pre className="console-pre ltr-code mt-1 max-h-32 overflow-auto rounded bg-surface-2 p-1.5">{o.preview || '—'}</pre>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
