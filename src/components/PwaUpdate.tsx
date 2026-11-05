import { useEffect } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { useTranslate } from '@/hooks/useTranslate';
import { useAppStore } from '@/store/app-store';
import { Button } from './ui';

const RELOAD_KEY = 'rpad.coi-reload';

/**
 * Service-worker registration, update banner, and the cross-origin isolation
 * bootstrap for hosts without custom headers (GitHub Pages): the worker adds
 * COOP/COEP to the responses it serves, so once it controls the page we reload
 * a single time before the R engine starts to obtain an isolated page.
 */
export function PwaUpdate() {
  const { t } = useTranslate();
  const { needRefresh: [needRefresh, setNeedRefresh], updateServiceWorker } = useRegisterSW({ onRegisterError: (e) => console.warn('SW registration failed', e) });

  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
    if (crossOriginIsolated) return;
    const maybeReload = () => {
      if (crossOriginIsolated || !navigator.serviceWorker.controller) return;
      const status = useAppStore.getState().runtimeStatus;
      if (status !== 'idle') return; // never interrupt an engine that is already starting
      try {
        if (sessionStorage.getItem(RELOAD_KEY)) return; // one attempt per session
        sessionStorage.setItem(RELOAD_KEY, '1');
      } catch {
        return;
      }
      location.reload();
    };
    navigator.serviceWorker.addEventListener('controllerchange', maybeReload);
    // The page may already be controlled by a worker that injects the headers but
    // was loaded before it (e.g. right after an update).
    if (navigator.serviceWorker.controller) maybeReload();
    return () => navigator.serviceWorker.removeEventListener('controllerchange', maybeReload);
  }, []);

  if (!needRefresh) return null;
  return (
    <div className="flex items-center gap-2 border-b border-line bg-surface-2 px-3 py-1.5 text-sm">
      <span className="flex-1">{t('updateAvailable')}</span>
      <Button size="sm" variant="primary" onClick={() => void updateServiceWorker(true)}>{t('reload')}</Button>
      <Button size="sm" onClick={() => setNeedRefresh(false)}>{t('later')}</Button>
    </div>
  );
}
