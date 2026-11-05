/** Static knowledge about R packages relevant to the course. */

/** Packages that ship with base R and never need installation. */
export const BASE_PACKAGES = new Set([
  'base', 'stats', 'utils', 'graphics', 'grDevices', 'methods', 'datasets', 'tools', 'grid', 'splines',
  'stats4', 'tcltk', 'compiler', 'parallel', 'webr',
]);

/**
 * Detect package names referenced by R code through library(), require(),
 * requireNamespace(), loadNamespace() or the pkg:: operator. Comments and
 * strings are intentionally not parsed with a full R parser: this is only a
 * hint used to pre-install packages with a progress indicator. Anything missed
 * is still handled by webr's install shim at library() time.
 */
export function detectPackages(code: string): string[] {
  const found = new Set<string>();
  const stripped = code.replace(/#[^\n]*/g, '');
  const callRe = /\b(?:library|require|requireNamespace|loadNamespace)\s*\(\s*["']?([A-Za-z][A-Za-z0-9.]*)["']?\s*[,)]/g;
  let m: RegExpExecArray | null;
  while ((m = callRe.exec(stripped))) found.add(m[1]);
  const nsRe = /\b([A-Za-z][A-Za-z0-9.]*)::/g;
  while ((m = nsRe.exec(stripped))) found.add(m[1]);
  return [...found].filter((p) => !BASE_PACKAGES.has(p));
}

export const PACKAGE_NOTES: Record<string, string> = {
  dplyr: 'Data manipulation (filter, select, mutate, summarise, group_by).',
  ggplot2: 'Grammar of graphics plotting.',
  tidyverse: 'Meta-package. In WebR, load the packages you need individually (dplyr, ggplot2, tidyr, readr).',
};
