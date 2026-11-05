/** Lightweight CSV inspection used by the import dialog (preview only; R does the real parsing). */

export type Separator = ',' | ';' | '\t' | '|';

export function detectSeparator(sample: string): Separator {
  const lines = sample.split(/\r?\n/).filter((l) => l.trim().length > 0).slice(0, 10);
  const candidates: Separator[] = [',', ';', '\t', '|'];
  let best: Separator = ',';
  let bestScore = -1;
  for (const sep of candidates) {
    const counts = lines.map((l) => l.split(sep).length - 1);
    if (counts.length === 0) continue;
    const min = Math.min(...counts);
    const max = Math.max(...counts);
    const score = min > 0 && min === max ? min * 10 : min;
    if (score > bestScore) {
      bestScore = score;
      best = sep;
    }
  }
  return best;
}

/** Decode bytes as UTF-8 (with BOM handling) and fall back to windows-1255 (Hebrew) when the text is not valid UTF-8. */
export function decodeText(bytes: Uint8Array): { text: string; encoding: 'utf-8' | 'windows-1255' } {
  try {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    return { text: text.replace(/^﻿/, ''), encoding: 'utf-8' };
  } catch {
    try {
      return { text: new TextDecoder('windows-1255').decode(bytes), encoding: 'windows-1255' };
    } catch {
      return { text: new TextDecoder('utf-8').decode(bytes), encoding: 'utf-8' };
    }
  }
}

export function previewRows(text: string, sep: Separator, max = 8): string[][] {
  return text
    .split(/\r?\n/)
    .filter((l) => l.length > 0)
    .slice(0, max)
    .map((l) => splitLine(l, sep));
}

function splitLine(line: string, sep: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQ && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else inQ = !inQ;
    } else if (ch === sep && !inQ) {
      out.push(cur);
      cur = '';
    } else cur += ch;
  }
  out.push(cur);
  return out;
}

/** Make a valid R object name from a file name. */
export function toRName(fileName: string): string {
  let base = fileName.replace(/\.[^.]+$/, '').replace(/[^A-Za-z0-9_.]+/g, '_').replace(/^_+|_+$/g, '');
  if (!base || !/^[A-Za-z.]/.test(base)) base = `df_${base}`;
  return base.toLowerCase();
}

/** Build the R import call that will actually be executed. */
export function buildReadCsvCode(objectName: string, fileName: string, sep: Separator, header: boolean, encoding: string): string {
  const sepArg = sep === ',' ? '' : `, sep = ${JSON.stringify(sep === '\t' ? '\t' : sep)}`;
  const encArg = encoding === 'utf-8' ? ', fileEncoding = "UTF-8"' : `, fileEncoding = "${encoding}"`;
  return `${objectName} <- read.csv(${JSON.stringify(fileName)}${sepArg}, header = ${header ? 'TRUE' : 'FALSE'}${encArg})`;
}
