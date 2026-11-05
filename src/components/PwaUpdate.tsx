import { useRegisterSW } from 'virtual:pwa-register/react';
import { useTranslate } from '@/hooks/useTranslate';
import { Button } from './ui';

export function PwaUpdate() {
  const { t } = useTranslate();
  const { needRefresh: [needRefresh, setNeedRefresh], updateServiceWorker } = useRegisterSW({ onRegisterError: (e) => console.warn('SW registration failed', e) });
  if (!needRefresh) return null;
  return (
    <div className="flex items-center gap-2 border-b border-line bg-surface-2 px-3 py-1.5 text-sm">
      <span className="flex-1">{t('updateAvailable')}</span>
      <Button size="sm" variant="primary" onClick={() => void updateServiceWorker(true)}>{t('reload')}</Button>
      <Button size="sm" onClick={() => setNeedRefresh(false)}>{t('later')}</Button>
    </div>
  );
}
