import { describe, it, expect } from 'vitest';
import { detectPackages } from '@/runtime/packages';
import { formatCondition, coalesce, truncateOutput } from '@/runtime/output';
import { detectSeparator, decodeText, toRName, buildReadCsvCode, previewRows } from '@/runtime/csv';
import { ExecutionQueue } from '@/runtime/execution-queue';
import { courseTemplate } from '@/course/template';
import { searchReference, COURSE_REFERENCE } from '@/course/reference';

describe('package detection', () => {
  it('finds library/require/:: references and ignores base packages and comments', () => {
    expect(detectPackages('library(dplyr)\nrequire("ggplot2")\nx <- stats::sd(1:3)\n# library(fake)\ntidyr::pivot_longer(df)')).toEqual(['dplyr', 'ggplot2', 'tidyr']);
    expect(detectPackages('library(utils); library(stats)')).toEqual([]);
  });
});

describe('condition formatting', () => {
  it('mimics the R console', () => {
    expect(formatCondition('error', 'boom', '')).toBe('Error: boom');
    expect(formatCondition('error', 'boom', 'f(x)')).toBe('Error in f(x) : boom');
    expect(formatCondition('warning', 'NaNs produced', 'log(-1)')).toBe('Warning message:\nIn log(-1) : NaNs produced');
    expect(formatCondition('warning', 'careful', 'NULL')).toBe('Warning message:\ncareful');
    expect(formatCondition('message', 'hello\n', '')).toBe('hello');
  });
  it('coalesces and truncates output', () => {
    const merged = coalesce([{ kind: 'stdout', text: 'a' }, { kind: 'stdout', text: 'b' }, { kind: 'error', text: 'e' }]);
    expect(merged).toEqual([{ kind: 'stdout', text: 'a\nb' }, { kind: 'error', text: 'e' }]);
    const { chunks, truncated } = truncateOutput([{ kind: 'stdout', text: 'x'.repeat(100) }], 10);
    expect(truncated).toBe(true);
    expect(chunks[0].text.startsWith('xxxxxxxxxx')).toBe(true);
  });
});

describe('csv helpers', () => {
  it('detects separators and decodes Hebrew', () => {
    expect(detectSeparator('a,b,c\n1,2,3\n')).toBe(',');
    expect(detectSeparator('a;b;c\n1;2;3\n')).toBe(';');
    expect(detectSeparator('a\tb\n1\t2\n')).toBe('\t');
    const utf8 = new TextEncoder().encode('﻿שם,ציון\nדנה,90');
    const d = decodeText(utf8);
    expect(d.encoding).toBe('utf-8');
    expect(d.text.startsWith('שם')).toBe(true);
    expect(previewRows('a,"b,c",d\n1,2,3', ',')).toEqual([['a', 'b,c', 'd'], ['1', '2', '3']]);
  });
  it('builds valid R names and read.csv calls', () => {
    expect(toRName('My Data (2026).csv')).toBe('my_data_2026');
    expect(toRName('123.csv')).toBe('df_123');
    expect(buildReadCsvCode('df', 'data.csv', ',', true, 'utf-8')).toBe('df <- read.csv("data.csv", header = TRUE, fileEncoding = "UTF-8")');
    expect(buildReadCsvCode('df', 'data.csv', ';', false, 'CP1255')).toBe('df <- read.csv("data.csv", sep = ";", header = FALSE, fileEncoding = "CP1255")');
  });
});

describe('execution queue', () => {
  it('runs tasks strictly in order and supports cancellation of pending tasks', async () => {
    const q = new ExecutionQueue();
    const order: string[] = [];
    const a = q.enqueue('a', async () => { await new Promise((r) => setTimeout(r, 20)); order.push('a'); return 1; });
    const b = q.enqueue('b', async () => { order.push('b'); return 2; });
    const c = q.enqueue('c', async () => { order.push('c'); return 3; });
    expect(q.cancel(c.taskId)).toBe(true);
    await expect(c).rejects.toThrow('cancelled');
    expect(await a).toBe(1);
    expect(await b).toBe(2);
    expect(order).toEqual(['a', 'b']);
  });
});

describe('course content', () => {
  it('template follows the course header conventions', () => {
    const t = courseTemplate({ week: 2, student: 'Dana Levi' });
    expect(t.startsWith('# R course for beginners\n# Week 2\n# assignment by Dana Levi')).toBe(true);
    expect(t).toContain('#### CREATE DATA ####');
    expect(t).toMatch(/# 1\. Generate variables/);
    expect(t).not.toMatch(/\b\d{9}\b/);
  });
  it('reference search finds functions and every entry links to the course site', () => {
    expect(searchReference('filter').map((e) => e.fn)).toContain('filter()');
    for (const topic of COURSE_REFERENCE) for (const e of topic.entries) expect(e.link).toMatch(/^(week-\d\.html|book\.html#ch\d+)$/);
  });
});
