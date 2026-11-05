import { useCallback } from 'react';
import { useAppStore } from '@/store/app-store';
import { translate, type TKey } from '@/i18n';

export function useTranslate() {
  const lang = useAppStore((s) => s.lang);
  const t = useCallback((key: TKey, vars?: Record<string, string | number>) => translate(lang, key, vars), [lang]);
  return { t, lang };
}
