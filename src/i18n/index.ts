import { he } from './he';
import { en } from './en';

export type Lang = 'he' | 'en';
export type Dict = typeof he;
export type TKey = keyof Dict;

const dicts: Record<Lang, Dict> = { he, en: en as Dict };

export function translate(lang: Lang, key: TKey, vars?: Record<string, string | number>): string {
  let s: string = dicts[lang][key] ?? dicts.he[key] ?? key;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
  return s;
}

export function dirFor(lang: Lang): 'rtl' | 'ltr' {
  return lang === 'he' ? 'rtl' : 'ltr';
}
