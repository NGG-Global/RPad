import type { ExecutionRecord, REnvObject } from '@/types';
import { outputToText } from '@/runtime/output';

export const GEMINI_URL = 'https://gemini.google.com/app';
/** Upper bound for a single clipboard transcript (characters). */
export const TRANSCRIPT_CHAR_LIMIT = 60_000;

export interface GeminiContextOptions {
  /** Optional list of relevant objects in the environment to mention. */
  objects?: REnvObject[];
  /** The request text appended at the end. */
  request?: string;
  language?: 'he' | 'en';
}

const DEFAULT_REQUEST = {
  en: 'Please evaluate my code based on these actual R results.',
  he: 'Please evaluate my code based on these actual R results.',
};

function section(title: string, body: string): string {
  return `${title}\n\n${body.trim() ? body : '(no output)'}\n`;
}

export function formatCode(exec: ExecutionRecord): string {
  return exec.code;
}

export function formatOutput(exec: ExecutionRecord): string {
  return outputToText(exec.output);
}

export function formatCodeAndOutput(exec: ExecutionRecord): string {
  return `${section('R code executed:', exec.code)}\n${section('Actual R output:', formatOutput(exec))}`;
}

/** Clipboard-ready context message for the Gemini course tutor. Nothing here is fabricated: output is copied verbatim. */
export function formatGeminiContext(exec: ExecutionRecord, opts: GeminiContextOptions = {}): string {
  const normal = exec.output.filter((c) => c.kind === 'stdout' || c.kind === 'stderr' || c.kind === 'message').map((c) => c.text).join('\n');
  const warnings = exec.output.filter((c) => c.kind === 'warning').map((c) => c.text).join('\n');
  const errors = exec.output.filter((c) => c.kind === 'error').map((c) => c.text).join('\n');
  const parts: string[] = [section('R code executed:', exec.code)];
  parts.push(section('Actual R output:', normal));
  if (warnings) parts.push(section('Warnings:', warnings));
  if (errors) parts.push(section('Error:', errors));
  if (exec.plotIds.length > 0) parts.push(`Plots produced: ${exec.plotIds.length} (image not included; attach separately if needed)\n`);
  if (opts.objects && opts.objects.length > 0) {
    const lines = opts.objects.map((o) => `- ${o.name}: ${o.className} ${o.dims}${o.preview ? ` — ${o.preview}` : ''}`);
    parts.push(section('Relevant objects in the R environment:', lines.join('\n')));
  }
  const request = opts.request ?? DEFAULT_REQUEST[opts.language ?? 'en'];
  parts.push(`Request:\n${request}`);
  return parts.join('\n');
}

export function formatTranscript(execs: ExecutionRecord[], limit = TRANSCRIPT_CHAR_LIMIT): { text: string; truncated: boolean; included: number } {
  const blocks: string[] = [];
  let total = 0;
  let included = 0;
  // Include the most recent executions first, then restore chronological order.
  for (let i = execs.length - 1; i >= 0; i--) {
    const e = execs[i];
    const block = `> ${e.code.split('\n').join('\n> ')}\n${formatOutput(e)}\n`;
    if (total + block.length > limit) break;
    blocks.unshift(block);
    total += block.length;
    included++;
  }
  return { text: blocks.join('\n'), truncated: included < execs.length, included };
}

/** Select the environment objects referenced by the executed code. */
export function relevantObjects(code: string, env: REnvObject[]): REnvObject[] {
  const ids = new Set(code.match(/[A-Za-z.][A-Za-z0-9._]*/g) ?? []);
  return env.filter((o) => ids.has(o.name)).slice(0, 8);
}
