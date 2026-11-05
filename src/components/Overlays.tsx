import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { clsx } from 'clsx';
import { useAppStore } from '@/store/app-store';
import { useTranslate } from '@/hooks/useTranslate';
import { Button, Dialog } from './ui';
import { workspace } from '@/runtime/workspace';

export function Toasts() {
  const toasts = useAppStore((s) => s.toasts);
  const dismiss = useAppStore((s) => s.dismissToast);
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-16 z-[60] flex flex-col items-center gap-2 px-3" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} role="status" className={clsx('pointer-events-auto flex max-w-md items-center gap-2 rounded-lg border px-3 py-2 text-sm shadow-lg', t.kind === 'success' && 'border-ok/40 bg-surface text-ok', t.kind === 'error' && 'border-err/40 bg-surface text-err', t.kind === 'warning' && 'border-warn/40 bg-surface text-warn', t.kind === 'info' && 'border-line bg-surface text-ink')} data-testid="toast" data-kind={t.kind}>
          <span className="flex-1">{t.text}</span>
          <button type="button" onClick={() => dismiss(t.id)} aria-label="dismiss"><X size={14} /></button>
        </div>
      ))}
    </div>
  );
}

export function ConfirmDialog() {
  const { t } = useTranslate();
  const req = useAppStore((s) => s.confirm);
  if (!req) return null;
  return (
    <Dialog
      open
      onClose={() => req.resolve(false)}
      title={req.title}
      footer={
        <>
          <Button onClick={() => req.resolve(false)}>{req.cancelLabel ?? t('cancel')}</Button>
          <Button variant={req.danger ? 'danger' : 'primary'} onClick={() => req.resolve(true)} data-testid="confirm-ok">{req.confirmLabel ?? t('confirm')}</Button>
        </>
      }
    >
      {req.body && <p className="text-sm">{req.body}</p>}
    </Dialog>
  );
}

export function SnapshotRestorePrompt() {
  const { t, lang } = useTranslate();
  const snap = useAppStore((s) => s.pendingSnapshotRestore);
  const set = useAppStore((s) => s.set);
  if (!snap) return null;
  return (
    <div className="flex items-center gap-2 border-b border-line bg-accent-soft px-3 py-1.5 text-sm" data-testid="snapshot-prompt">
      <span className="min-w-0 flex-1 truncate">{t('restoreLastSnapshot', { when: new Date(snap.createdAt).toLocaleString(lang === 'he' ? 'he-IL' : 'en-GB') })}</span>
      <Button size="sm" variant="primary" onClick={() => void workspace.restoreSnapshot(snap)}>{t('restore')}</Button>
      <Button size="sm" onClick={() => set({ pendingSnapshotRestore: null })}>{t('skip')}</Button>
    </div>
  );
}

export function FirstRunScreen() {
  const { t } = useTranslate();
  const status = useAppStore((s) => s.runtimeStatus);
  const progress = useAppStore((s) => s.runtimeProgress);
  const error = useAppStore((s) => s.runtimeError);
  const firstRunDone = useAppStore((s) => s.firstRunDone);
  if (firstRunDone && status !== 'error') return null;
  if (status === 'loading' && firstRunDone) return null;
  const pct = progress?.phase === 'download' && progress.total ? Math.round(((progress.loaded ?? 0) / progress.total) * 100) : null;
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-surface/95 p-4" data-testid="first-run">
      <div className="w-full max-w-md rounded-xl border border-line bg-surface p-6 shadow-xl">
        <h1 className="text-xl font-semibold">{t('firstRunTitle')}</h1>
        <p className="mt-2 text-sm text-ink-2">{t('firstRunBody')}</p>
        {status === 'error' && <p className="mt-3 rounded-md bg-err/10 p-2 text-sm text-err">{t('errorEngine', { detail: error ?? '' })}</p>}
        {status === 'loading' && (
          <div className="mt-4">
            <div className="h-2 overflow-hidden rounded bg-surface-3"><div className="h-full bg-accent transition-all" style={{ width: `${pct ?? 30}%` }} /></div>
            <div className="mt-1 text-xs text-ink-3">{progress?.phase === 'download' ? t('loadingEngine') : progress?.phase === 'prelude' ? t('preparingEngine') : t('startingEngine')}</div>
          </div>
        )}
        {status !== 'loading' && (
          <Button variant="primary" className="mt-4 w-full" onClick={() => void workspace.startRuntime()} data-testid="first-run-start">
            {status === 'error' ? t('retry') : t('firstRunStart')}
          </Button>
        )}
      </div>
    </div>
  );
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
}

export function InstallPrompt() {
  const { t } = useTranslate();
  const [evt, setEvt] = useState<BeforeInstallPromptEvent | null>(null);
  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setEvt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);
  if (!evt) return null;
  return (
    <div className="flex items-center gap-2 border-b border-line bg-surface-2 px-3 py-1.5 text-sm">
      <span className="flex-1">{t('installPrompt')}</span>
      <Button size="sm" variant="primary" onClick={async () => { await evt.prompt(); setEvt(null); }}>{t('install')}</Button>
      <Button size="sm" onClick={() => setEvt(null)}>{t('later')}</Button>
    </div>
  );
}
