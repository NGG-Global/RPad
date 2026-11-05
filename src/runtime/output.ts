import type { OutputChunk } from '@/types';

/** Maximum characters retained per execution to keep the console responsive. */
export const MAX_OUTPUT_CHARS = 200_000;

/**
 * Format an R condition the way the R console prints it.
 * `call` is the deparsed call or an empty string.
 */
export function formatCondition(kind: 'error' | 'warning' | 'message', message: string, call: string): string {
  const msg = message.replace(/\n$/, '');
  if (kind === 'message') return msg;
  const where = call && call !== 'NULL' ? ` in ${call}` : '';
  if (kind === 'error') return `Error${where} : ${msg}`.replace('Error : ', 'Error: ');
  return `Warning message:\n${call && call !== 'NULL' ? `In ${call} : ` : ''}${msg}`;
}

/** Merge adjacent chunks of the same kind to reduce React nodes. */
export function coalesce(chunks: OutputChunk[]): OutputChunk[] {
  const out: OutputChunk[] = [];
  for (const c of chunks) {
    const last = out[out.length - 1];
    if (last && last.kind === c.kind && (c.kind === 'stdout' || c.kind === 'stderr')) {
      last.text += (last.text.endsWith('\n') || last.text === '' ? '' : '\n') + c.text;
    } else {
      out.push({ ...c });
    }
  }
  return out;
}

/** Truncate output text beyond the limit, marking truncation. */
export function truncateOutput(chunks: OutputChunk[], limit = MAX_OUTPUT_CHARS): { chunks: OutputChunk[]; truncated: boolean } {
  let total = 0;
  const out: OutputChunk[] = [];
  for (const c of chunks) {
    if (total >= limit) return { chunks: out, truncated: true };
    const remaining = limit - total;
    if (c.text.length > remaining) {
      out.push({ kind: c.kind, text: c.text.slice(0, remaining) + '\n… [output truncated]' });
      return { chunks: out, truncated: true };
    }
    total += c.text.length;
    out.push(c);
  }
  return { chunks: out, truncated: false };
}

export function outputToText(chunks: OutputChunk[]): string {
  return chunks.map((c) => c.text).join('\n');
}

export function hasError(chunks: OutputChunk[]): boolean {
  return chunks.some((c) => c.kind === 'error');
}
