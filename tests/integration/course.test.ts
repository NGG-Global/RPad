import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { startR, text } from './helpers';
import type { WebRService } from '@/runtime/webr-service';

/**
 * Course assignment fixtures (weeks 1–3) executed as real R scripts, with
 * results checked against known R behaviour. The same scripts are used by
 * the browser end-to-end tests.
 */
let r: WebRService;
const fixture = (n: number) => readFileSync(`tests/fixtures/week${n}.R`, 'utf8');

describe('course assignments in R', () => {
  beforeAll(async () => {
    r = await startR();
    await r.setwd('/home/web_user/projects/course');
  });
  afterAll(() => r.close());

  it('week 1: six-subject data frame saved as CSV', async () => {
    const res = await r.run(fixture(1), { captureGraphics: false });
    expect(res.errored).toBe(false);
    const out = text(res.output);
    expect(out).toContain('  subject gender age depression');
    expect(out).toContain('1       1   male  15          0');
    expect(out).toContain('[1] 6 4');
    expect(out).toContain('"week1_data.csv"');
    const csv = new TextDecoder().decode(await r.readFile('/home/web_user/projects/course/week1_data.csv'));
    expect(csv.split('\n')[0]).toBe('"subject","gender","age","depression"');
    expect(csv.split('\n')[1]).toBe('1,"male",15,0');
    const env = await r.getEnvironment();
    expect(env.find((o) => o.name === 'df')?.dims).toBe('6 × 4');
  });

  it('week 2: simulated dataset with descriptive statistics', async () => {
    const res = await r.run(fixture(2), { captureGraphics: false });
    expect(res.errored).toBe(false);
    const out = text(res.output);
    // Values derived from the data itself, checked against R.
    const checks = await r.evalStrings(`c(
      nrow(df), ncol(df), min(df$age), max(df$age), all(df$age == round(df$age)),
      all(df$gender %in% c("male","female")), all(df$depression %in% c(0,1)),
      min(df$anxiety) >= 0 && max(df$anxiety) <= 100, abs(mean(df$iq) - 100) < 6,
      format(mean(df$age), digits = 7), format(sd(df$age), digits = 7), median(df$age)
    )`);
    expect(checks.slice(0, 9)).toEqual(['100', '6', '15', '40', 'TRUE', 'TRUE', 'TRUE', 'TRUE', 'TRUE']);
    expect(out).toContain(`[1] ${checks[9]}`);
    expect(out).toContain(`[1] ${checks[10]}`);
    expect(out).toContain(`[1] ${checks[11]}`);
    expect(out).toMatch(/Min\.\s+:/);
    expect(out).toMatch(/subject\s+age\s+gender\s+iq\s+depression\s+anxiety/);
    const files = await r.listFiles();
    expect(files.map((f) => f.name)).toContain('week2_data.csv');
    // Base-R histogram works through the png device (canvas device needs a browser).
    const h = await r.run('png("age_hist.png"); hist(df$age, xlab = "age"); dev.off()', { captureGraphics: false });
    expect(h.errored).toBe(false);
    expect((await r.readFile('/home/web_user/projects/course/age_hist.png')).length).toBeGreaterThan(1000);
  });

  it('week 3: editing, indexing, factors, dplyr and ggplot2', async () => {
    const res = await r.run(fixture(3), { captureGraphics: false });
    const out = text(res.output);
    expect(res.errored, out).toBe(false);
    expect(out).toContain('[1] 98  5');
    expect(out).toContain('[1] 99');
    expect(out).toContain('[1] "female" "male"');
    expect(out).toContain('# A tibble: 2');
    expect(out).toMatch(/gender\s+n mean_age sd_age/);
    expect(out).toContain('"anxiety_by_gender.png"');
    const checks = await r.evalStrings(`c(
      "depression" %in% names(df), nrow(df), df[10, "age"], class(df$gender), is.logical(df$iq_group),
      sum(df$iq_group) , nrow(df_high_iq_female), all(df_high_iq_female$gender == "female"), all(df_high_iq_female$iq > median(df$iq))
    )`);
    expect(checks[0]).toBe('FALSE');
    expect(checks[1]).toBe('98');
    expect(checks[2]).toBe('99');
    expect(checks[3]).toBe('factor');
    expect(checks[4]).toBe('TRUE');
    expect(Number(checks[5])).toBe(49);
    expect(checks[7]).toBe('TRUE');
    expect(checks[8]).toBe('TRUE');
    const png = await r.readFile('/home/web_user/projects/course/anxiety_by_gender.png');
    expect(png[0]).toBe(0x89);
    expect(png.length).toBeGreaterThan(5000);
  });

  it('week 3 data viewer: factor labels and sorted paging from the real object', async () => {
    const meta = await r.getDataFrameMeta({ kind: 'global', name: 'df' });
    expect(meta.columns.find((c) => c.name === 'gender')?.levels).toEqual(['female', 'male']);
    const page = await r.getDataFramePage({ kind: 'global', name: 'df' }, { name: 'df', offset: 0, limit: 5, sortColumn: 'iq', sortDesc: true });
    const iqs = page.cells[meta.columns.findIndex((c) => c.name === 'iq')].map(Number);
    expect([...iqs].sort((a, b) => b - a)).toEqual(iqs);
    const expected = await r.evalStrings('format(head(sort(df$iq, decreasing = TRUE), 5), digits = 7, trim = TRUE, drop0trailing = TRUE)');
    expect(page.cells[meta.columns.findIndex((c) => c.name === 'iq')]).toEqual(expected);
  });
});
