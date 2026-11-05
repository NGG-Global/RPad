import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startR, text } from './helpers';
import type { WebRService } from '@/runtime/webr-service';

let r: WebRService;

describe('WebR runtime service (real R engine)', () => {
  beforeAll(async () => {
    r = await startR();
  });
  afterAll(() => r.close());

  it('reports versions and auto-prints like the R console', async () => {
    expect(r.info.webrVersion).toBe('0.6.0');
    expect(r.info.rVersion.startsWith('4.')).toBe(true);
    const res = await r.run('x <- c(1, 2, 3)\nx * 2\nmean(x)\ninvisible(5)', { captureGraphics: false });
    expect(res.errored).toBe(false);
    expect(text(res.output)).toBe('[1] 2 4 6\n[1] 2');
  });

  it('keeps state between executions', async () => {
    await r.run('y <- 41', { captureGraphics: false });
    const res = await r.run('y + 1', { captureGraphics: false });
    expect(text(res.output)).toBe('[1] 42');
  });

  it('formats errors and warnings like R and keeps earlier output', async () => {
    const res = await r.run('print("before")\nwarning("careful")\nlog(-1)\nstop("boom")\nprint("after")', { captureGraphics: false });
    expect(res.errored).toBe(true);
    const out = text(res.output);
    expect(out).toContain('[1] "before"');
    expect(out).toContain('Warning message:\ncareful');
    expect(out).toContain('NaNs produced');
    expect(out).toContain('Error: boom');
    expect(out).not.toContain('after');
  });

  it('reports syntax errors as R errors without crashing the session', async () => {
    const res = await r.run('x <- (1 + ', { captureGraphics: false });
    expect(res.errored).toBe(true);
    expect(text(res.output)).toMatch(/unexpected|end of input/i);
    const again = await r.run('1 + 1', { captureGraphics: false });
    expect(text(again.output)).toBe('[1] 2');
  });

  it('inspects the environment', async () => {
    await r.run('rm(list = ls())\ndf <- data.frame(id = 1:6, gender = c("m","m","f","f","f","m"), age = c(15,29,31,28,20,35))\nf <- function(a) a + 1\nv <- 1:10\ng <- factor(c("a","b"))', { captureGraphics: false });
    const env = await r.getEnvironment();
    const byName = Object.fromEntries(env.map((o) => [o.name, o]));
    expect(byName.df.isDataFrame).toBe(true);
    expect(byName.df.nrow).toBe(6);
    expect(byName.df.ncol).toBe(3);
    expect(byName.df.dims).toBe('6 × 3');
    expect(byName.f.isFunction).toBe(true);
    expect(byName.v.length).toBe(10);
    expect(byName.v.preview).toContain('1 2 3');
    expect(byName.g.className).toBe('factor');
    expect(byName.g.preview).toContain('levels: a, b');
  });

  it('pages, sorts and filters data frames from R', async () => {
    const meta = await r.getDataFrameMeta({ kind: 'global', name: 'df' });
    expect(meta.nrow).toBe(6);
    expect(meta.columns.map((c) => c.name)).toEqual(['id', 'gender', 'age']);
    expect(meta.columns[2].className).toBe('numeric');
    const page = await r.getDataFramePage({ kind: 'global', name: 'df' }, { name: 'df', offset: 0, limit: 3, sortColumn: 'age', sortDesc: true });
    expect(page.filteredRows).toBe(6);
    expect(page.rowIndex).toEqual([6, 3, 2]);
    expect(page.cells[2]).toEqual(['35', '31', '29']);
    const filtered = await r.getDataFramePage({ kind: 'global', name: 'df' }, { name: 'df', offset: 0, limit: 10, filterText: 'f' });
    expect(filtered.filteredRows).toBe(3);
    expect(filtered.cells[1]).toEqual(['f', 'f', 'f']);
  });

  it('represents NA distinctly and factors by label', async () => {
    await r.run('na_df <- data.frame(x = c(1.5, NA, 3), g = factor(c("low", NA, "high")))', { captureGraphics: false });
    const page = await r.getDataFramePage({ kind: 'global', name: 'na_df' }, { name: 'na_df', offset: 0, limit: 10 });
    expect(page.cells[0]).toEqual(['1.5', null, '3']);
    expect(page.cells[1]).toEqual(['low', null, 'high']);
    const meta = await r.getDataFrameMeta({ kind: 'global', name: 'na_df' });
    expect(meta.columns[1].levels).toEqual(['high', 'low']);
  });

  it('bridges View() to the data viewer', async () => {
    const res = await r.run('View(df)\nView(head(df, 2))', { captureGraphics: false });
    expect(res.views).toEqual(['global:df', 'view:head(df, 2)']);
    const meta = await r.getDataFrameMeta({ kind: 'view', name: 'head(df, 2)' });
    expect(meta.nrow).toBe(2);
  });

  it('works with files in the working directory', async () => {
    await r.setwd('/home/web_user/projects/test');
    expect(await r.getwd()).toBe('/home/web_user/projects/test');
    await r.run('write.csv(df, "data.csv", row.names = FALSE)', { captureGraphics: false });
    const files = await r.listFiles();
    expect(files.map((f) => f.name)).toContain('data.csv');
    const bytes = await r.readFile('/home/web_user/projects/test/data.csv');
    expect(new TextDecoder().decode(bytes)).toContain('"id","gender","age"');
    const res = await r.run('df2 <- read.csv("data.csv")\nnrow(df2)\ndir()', { captureGraphics: false });
    expect(text(res.output)).toContain('[1] 6');
    expect(text(res.output)).toContain('"data.csv"');
  });

  it('preserves Hebrew strings through CSV round trips', async () => {
    const res = await r.run('h <- data.frame(name = c("דנה", "יוסי"), score = c(1, 2))\nwrite.csv(h, "hebrew.csv", row.names = FALSE, fileEncoding = "UTF-8")\nh2 <- read.csv("hebrew.csv", fileEncoding = "UTF-8")\nh2$name', { captureGraphics: false });
    expect(text(res.output)).toContain('"דנה"');
  });

  it('saves and restores a workspace snapshot with native R serialisation', async () => {
    const names = await r.saveWorkspace('/home/web_user/projects/test/snap.RData');
    expect(names).toContain('df');
    const bytes = await r.readFile('/home/web_user/projects/test/snap.RData');
    expect(bytes.length).toBeGreaterThan(100);
    await r.run('rm(list = ls())', { captureGraphics: false });
    expect(await r.getEnvironment()).toHaveLength(0);
    await r.writeFile('/home/web_user/projects/test/snap2.RData', bytes);
    const loaded = await r.loadWorkspace('/home/web_user/projects/test/snap2.RData');
    expect(loaded).toContain('df');
    const res = await r.run('nrow(df)', { captureGraphics: false });
    expect(text(res.output)).toBe('[1] 6');
  });

  it('finds the extent of a complete expression for run-current-line', async () => {
    expect(await r.completeExpressionLength(['df <- data.frame(', '  a = 1,', '  b = 2', ')', 'print(df)'])).toBe(4);
    expect(await r.completeExpressionLength(['x <- 1', 'y <- 2'])).toBe(1);
    expect(await r.completeExpressionLength(['df |>', '  filter(a > 1) |>', '  summary()'])).toBe(3);
  });

  it('writes plots through the Cairo png device into the VFS', async () => {
    const res = await r.run('png("hist.png", width = 400, height = 300)\nhist(rnorm(100))\ndev.off()', { captureGraphics: false });
    expect(res.errored).toBe(false);
    const bytes = await r.readFile('/home/web_user/projects/test/hist.png');
    expect(bytes[0]).toBe(0x89);
    expect(bytes[1]).toBe(0x50);
  });

  it('installs dplyr and ggplot2 from the WebR package repository', async () => {
    const lines: string[] = [];
    const d = await r.installPackage('dplyr', (l) => lines.push(l));
    expect(d.ok).toBe(true);
    const g = await r.installPackage('ggplot2', (l) => lines.push(l));
    expect(g.ok).toBe(true);
    const res = await r.run('library(dplyr)\ndf |> group_by(gender) |> summarise(n = n(), mean_age = mean(age))', { captureGraphics: false });
    expect(res.errored).toBe(false);
    expect(text(res.output)).toContain('# A tibble: 2');
    const gg = await r.run('library(ggplot2)\np <- ggplot(df, aes(x = gender, y = age)) + geom_boxplot()\nggsave("box.png", p, width = 5, height = 4, dpi = 100)', { captureGraphics: false });
    expect(gg.errored).toBe(false);
    const files = await r.listFiles();
    expect(files.map((f) => f.name)).toContain('box.png');
  });

  it('reports packages missing from the repository honestly', async () => {
    const res = await r.installPackage('definitelyNotARealPackage12345');
    expect(res.ok).toBe(false);
  });
});
