import { useMemo, useState } from 'react';
import { BookOpen, ChevronDown, ChevronRight, ExternalLink, FilePlus2, X } from 'lucide-react';
import { clsx } from 'clsx';
import { COURSE_REFERENCE, COURSE_BASE, searchReference, type RefEntry } from '@/course/reference';
import { useTranslate } from '@/hooks/useTranslate';
import { useAppStore } from '@/store/app-store';
import { IconButton, inputClass } from './ui';
import { workspace } from '@/runtime/workspace';

export function CourseReferencePanel({ onInsert }: { onInsert: (code: string) => void }) {
  const { t, lang } = useTranslate();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<Record<string, boolean>>({ basics: true });
  const results = useMemo(() => (q.trim() ? searchReference(q) : null), [q]);

  return (
    <div className="flex h-full min-h-0 flex-col border-s border-line bg-surface" data-testid="reference-panel">
      <div className="flex items-center gap-1 border-b border-line bg-surface-2 px-2 py-1">
        <BookOpen size={15} className="text-ink-3" />
        <span className="text-[13px] font-semibold text-ink-2">{t('reference')}</span>
        <div className="ms-auto">
          <IconButton label={t('hidePanel')} onClick={() => void workspace.setSetting('showReference', false)} className="h-8 w-8 min-h-0 min-w-0"><X size={15} /></IconButton>
        </div>
      </div>
      <div className="p-2">
        <input className={clsx(inputClass, 'h-9')} placeholder={t('searchFunctions')} value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto scroll-thin px-2 pb-2">
        {results ? (
          <>
            <div className="mb-1 text-xs text-ink-3">{t('resultsCount', { n: results.length })}</div>
            {results.map((e) => <Entry key={e.fn + e.unit} e={e} onInsert={onInsert} lang={lang} />)}
          </>
        ) : (
          COURSE_REFERENCE.map((topic) => (
            <div key={topic.id} className="mb-1">
              <button type="button" className="tap flex w-full items-center gap-1 text-start text-sm font-semibold" onClick={() => setOpen((s) => ({ ...s, [topic.id]: !s[topic.id] }))}>
                {open[topic.id] ? <ChevronDown size={16} /> : <ChevronRight size={16} className="rtl:rotate-180" />}
                {lang === 'he' ? topic.titleHe : topic.titleEn}
                <span className="ms-auto text-xs font-normal text-ink-3">{t('week')} {topic.week}+</span>
              </button>
              {open[topic.id] && topic.entries.map((e) => <Entry key={e.fn + e.unit} e={e} onInsert={onInsert} lang={lang} />)}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function Entry({ e, onInsert, lang }: { e: RefEntry; onInsert: (code: string) => void; lang: 'he' | 'en' }) {
  const { t } = useTranslate();
  const [open, setOpen] = useState(false);
  const toast = useAppStore((s) => s.toast);
  return (
    <div className="mb-1 rounded-md border border-line/70">
      <button type="button" className="flex w-full items-center gap-2 px-2 py-2 text-start" onClick={() => setOpen((o) => !o)}>
        <code className="font-mono text-[13px] text-accent ltr-code">{e.fn}</code>
        <span className="ms-auto text-[11px] text-ink-3">{e.unit}</span>
      </button>
      {open && (
        <div className="space-y-1.5 border-t border-line/70 px-2 py-2 text-[13px]">
          <p>{lang === 'he' ? e.he : e.en}</p>
          <div className="text-xs text-ink-3">{t('syntax')}</div>
          <pre className="console-pre ltr-code rounded bg-surface-2 p-1.5 text-xs">{e.syntax}</pre>
          <div className="text-xs text-ink-3">{t('example')}</div>
          <pre className="console-pre ltr-code rounded bg-surface-2 p-1.5 text-xs">{e.example}</pre>
          {e.note && <p className="text-xs text-warn">{t('note')}: {e.note}</p>}
          <div className="flex flex-wrap gap-1 pt-1">
            <button type="button" className="tap inline-flex items-center gap-1 rounded-md bg-accent-soft px-2 text-xs text-accent" onClick={() => { onInsert(e.example); toast('success', t('insertExample'), 1500); }}>
              <FilePlus2 size={14} /> {t('insertExample')}
            </button>
            <a className="tap inline-flex items-center gap-1 rounded-md px-2 text-xs text-ink-2 hover:bg-surface-3" href={COURSE_BASE + e.link} target="_blank" rel="noopener noreferrer">
              <ExternalLink size={14} /> {t('openCourse')} · {t('week')} {e.week}
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
