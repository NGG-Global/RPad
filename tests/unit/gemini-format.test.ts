import { describe, it, expect } from 'vitest';
import { formatGeminiContext, formatCodeAndOutput, formatTranscript, relevantObjects } from '@/gemini/format';
import type { ExecutionRecord, REnvObject } from '@/types';

const exec = (over: Partial<ExecutionRecord> = {}): ExecutionRecord => ({
  id: 'e1', projectId: 'p', source: 'script', code: 'mean(df$age)', startedAt: 0, status: 'done',
  output: [{ kind: 'stdout', text: '[1] 27.4' }], plotIds: [], changedFiles: [], ...over,
});

describe('Gemini context formatting', () => {
  it('produces the documented clipboard format with verbatim output', () => {
    const text = formatGeminiContext(exec());
    expect(text).toBe('R code executed:\n\nmean(df$age)\n\nActual R output:\n\n[1] 27.4\n\nRequest:\nPlease evaluate my code based on these actual R results.');
  });

  it('includes errors and warnings verbatim without explanations', () => {
    const text = formatGeminiContext(exec({ output: [{ kind: 'warning', text: 'Warning message:\nNAs introduced by coercion' }, { kind: 'error', text: 'Error: object \'x\' not found' }] }));
    expect(text).toContain('Warnings:\n\nWarning message:\nNAs introduced by coercion');
    expect(text).toContain("Error:\n\nError: object 'x' not found");
    expect(text).toContain('Actual R output:\n\n(no output)');
  });

  it('mentions relevant objects only', () => {
    const env: REnvObject[] = [
      { name: 'df', className: 'data.frame', typeName: 'list', dims: '100 × 6', preview: 'id, age', isDataFrame: true, isFunction: false },
      { name: 'other', className: 'numeric', typeName: 'double', dims: '[3]', preview: '1 2 3', isDataFrame: false, isFunction: false },
    ];
    const objs = relevantObjects('mean(df$age)', env);
    expect(objs.map((o) => o.name)).toEqual(['df']);
    expect(formatGeminiContext(exec(), { objects: objs })).toContain('- df: data.frame 100 × 6 — id, age');
  });

  it('formats code + output and bounded transcripts', () => {
    expect(formatCodeAndOutput(exec())).toContain('R code executed:');
    const many = Array.from({ length: 50 }, (_, i) => exec({ id: `e${i}`, code: `x${i} <- ${i}`, output: [{ kind: 'stdout', text: 'y'.repeat(2000) }] }));
    const { text, truncated, included } = formatTranscript(many, 10_000);
    expect(truncated).toBe(true);
    expect(included).toBeLessThan(50);
    expect(text.length).toBeLessThanOrEqual(10_000);
    expect(text.endsWith('x49 <- 49\n' + 'y'.repeat(2000) + '\n')).toBe(true);
  });
});
