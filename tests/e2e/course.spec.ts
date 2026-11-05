import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { bootApp, loadScript, runAll, runConsole, waitForIdle, fixture } from './helpers';

test.describe.configure({ mode: 'serial' });

test.describe('RPad course workflow (real WebR)', () => {
  test('boots cross-origin isolated with the SharedArrayBuffer channel', async ({ page }) => {
    await bootApp(page);
    expect(await page.evaluate(() => crossOriginIsolated)).toBe(true);
    const title = await page.getByTestId('runtime-status').getAttribute('title');
    expect(title).toContain('WebR 0.6.0');
    expect(title).toContain('SharedArrayBuffer');
    expect(await page.evaluate(() => document.documentElement.dir)).toBe('rtl');
  });

  test('week 1: data frame → console → environment → viewer → CSV download', async ({ page }) => {
    await bootApp(page);
    await loadScript(page, 'week1', fixture(1));
    const exec = await runAll(page);
    await expect(exec).toHaveAttribute('data-status', 'done');
    const out = await exec.getByTestId('exec-output').innerText();
    expect(out).toContain('subject gender age depression');
    expect(out).toContain('[1] 6 4');
    expect(out).toContain('"week1_data.csv"');

    // Environment panel refreshed automatically
    const df = page.locator('[data-testid="env-object"][data-name="df"]');
    await expect(df).toBeVisible();
    await expect(df).toContainText('data.frame');
    await expect(df).toContainText('6 × 4');

    // Data viewer: sort, filter, NA-free cells, export
    await df.locator('button').nth(1).click();
    const viewer = page.getByTestId('data-viewer');
    await expect(viewer).toBeVisible();
    await expect(page.getByTestId('df-row')).toHaveCount(6);
    await expect(viewer).toContainText('6 שורות × 4 עמודות');
    await page.getByTestId('df-col-header').filter({ hasText: 'age' }).click(); // asc
    await page.getByTestId('df-col-header').filter({ hasText: 'age' }).click(); // desc
    await expect(page.getByTestId('df-row').first()).toContainText('35');
    await page.getByTestId('df-filter').fill('female');
    await expect(page.getByTestId('df-row')).toHaveCount(3, { timeout: 20_000 });
    const [csvDownload] = await Promise.all([page.waitForEvent('download'), page.getByTestId('df-export').click()]);
    expect(csvDownload.suggestedFilename()).toBe('df.csv');
    const csvPath = await csvDownload.path();
    const csvText = readFileSync(csvPath!, 'utf8');
    expect(csvText).toContain('"subject","gender","age","depression"');
    await page.getByTestId('df-close').click();

    // Files panel shows the CSV written by write.csv() and downloads it
    await page.getByTestId('side-tab-files').click();
    const file = page.locator('[data-testid="vfs-file"][data-name="week1_data.csv"]');
    await expect(file).toBeVisible();
    const [dl] = await Promise.all([page.waitForEvent('download'), file.getByTestId('download-file').click()]);
    expect(dl.suggestedFilename()).toBe('week1_data.csv');
    expect(readFileSync((await dl.path())!, 'utf8').split('\n')[1]).toBe('1,"male",15,0');
  });

  test('week 2: simulated data, statistics, histogram, Gemini clipboard', async ({ page }) => {
    await bootApp(page);
    await loadScript(page, 'week2', fixture(2));
    const exec = await runAll(page);
    await expect(exec).toHaveAttribute('data-status', 'done');
    const out = await exec.getByTestId('exec-output').innerText();
    expect(out).toMatch(/Min\.\s+:/);
    expect(out).toMatch(/subject\s+age\s+gender\s+iq\s+depression\s+anxiety/);

    // Real plot rendered from the canvas device
    await expect(exec.locator('img')).toHaveCount(1);
    await page.getByTestId('side-tab-plots').click();
    const img = page.getByTestId('plot-image');
    await expect(img).toBeVisible();
    const size = await img.evaluate((el: HTMLImageElement) => ({ w: el.naturalWidth, h: el.naturalHeight }));
    expect(size.w).toBe(1344); // 672 device px at 2x
    expect(size.h).toBe(896);
    const [pngDl] = await Promise.all([page.waitForEvent('download'), page.getByTestId('plot-download').click()]);
    expect(pngDl.suggestedFilename()).toMatch(/\.png$/);
    const bytes = readFileSync((await pngDl.path())!);
    expect(bytes[0]).toBe(0x89);
    expect(bytes.length).toBeGreaterThan(5000);

    // Copy for Gemini: latest execution, formatted context
    await page.getByTestId('gemini-menu').click();
    await page.getByRole('menuitem').first().click();
    await expect(page.getByTestId('toast').first()).toContainText('הועתק');
    const clip = await page.evaluate(() => navigator.clipboard.readText());
    expect(clip.startsWith('R code executed:\n\n# R course for beginners\n# Week 2')).toBe(true);
    expect(clip).toContain('Actual R output:');
    expect(clip).toContain('Min.   :');
    expect(clip).toContain('Plots produced: 1');
    expect(clip).toContain('- df: data.frame 100 × 6');
    expect(clip.endsWith('Request:\nPlease evaluate my code based on these actual R results.')).toBe(true);
  });

  test('week 3: indexing, factors, dplyr, ggplot2 and ggsave through the virtual filesystem', async ({ page }) => {
    test.setTimeout(400_000);
    await bootApp(page);
    // The assignment starts from last week's CSV, so create it first (fresh browser profile).
    await loadScript(page, 'week2', fixture(2));
    await expect(await runAll(page)).toHaveAttribute('data-status', 'done');
    await loadScript(page, 'week3', fixture(3));
    const exec = await runAll(page);
    const out = await exec.getByTestId('exec-output').innerText();
    expect(out, out).not.toContain('Error');
    expect(out).toContain('[1] 98  5');
    expect(out).toContain('[1] 99');
    expect(out).toContain('[1] "female" "male"');
    expect(out).toContain('# A tibble: 2');
    expect(out).toContain('"anxiety_by_gender.png"');
    await expect(exec).toHaveAttribute('data-status', 'done');

    // The ggplot page from the canvas device plus the ggsave() file both land in the gallery
    await expect(exec.locator('img')).toHaveCount(2);
    await page.getByTestId('side-tab-files').click();
    await expect(page.locator('[data-testid="vfs-file"][data-name="anxiety_by_gender.png"]')).toBeVisible();
    await expect(page.locator('[data-testid="vfs-file"][data-name="week2_data.csv"]')).toBeVisible();

    // Environment reflects the edited objects
    await page.getByTestId('side-tab-environment').click();
    await expect(page.locator('[data-testid="env-object"][data-name="df"]')).toContainText('98 × 6');
    await expect(page.locator('[data-testid="env-object"][data-name="df_high_iq_female"]')).toBeVisible();

    // Factor labels in the viewer
    await page.locator('[data-testid="env-object"][data-name="df"] button').nth(1).click();
    await expect(page.getByTestId('data-viewer')).toContainText('factor (2)');
    await page.getByTestId('df-close').click();
  });

  test('console semantics: errors, warnings, state, run-current-expression, View() bridge', async ({ page }) => {
    await bootApp(page);
    let exec = await runConsole(page, 'x <- 1:10; x[x > 8]');
    await expect(exec.getByTestId('exec-output')).toHaveText('[1]  9 10');
    exec = await runConsole(page, 'log(-1)\nstop("my error")');
    await expect(exec).toHaveAttribute('data-status', 'error');
    await expect(exec.getByTestId('exec-output')).toContainText('Warning message:');
    await expect(exec.getByTestId('exec-output')).toContainText('Error: my error');
    exec = await runConsole(page, 'x * 2');
    await expect(exec.getByTestId('exec-output')).toHaveText('[1]  2  4  6  8 10 12 14 16 18 20');

    // Run current expression spanning several lines with Ctrl+Enter
    await loadScript(page, 'multi', 'total <- sum(\n  1,\n  2,\n  3\n)\ntotal');
    await page.locator('.cm-content').click({ position: { x: 10, y: 8 } });
    await page.keyboard.press('Control+Home');
    const before = await page.getByTestId('execution').count();
    await page.keyboard.press('Control+Enter');
    const multi = page.getByTestId('execution').nth(before);
    await expect(multi).toHaveAttribute('data-status', 'done', { timeout: 60_000 });
    await expect(multi.getByTestId('exec-code')).toContainText('+ )');
    await page.keyboard.press('Shift+Enter'); // runs the same expression and advances
    await page.keyboard.press('Control+Enter'); // now "total"
    const last = page.getByTestId('execution').last();
    await expect(last.getByTestId('exec-output')).toHaveText('[1] 6', { timeout: 60_000 });

    // View(df) opens the viewer
    await runConsole(page, 'df <- data.frame(a = 1:3, b = c("x", NA, "z")); View(df)');
    await expect(page.getByTestId('data-viewer')).toBeVisible();
    await expect(page.getByTestId('df-row').nth(1)).toContainText('NA');
    await page.getByTestId('df-close').click();

    // Stop button is visible while running and the session survives an interrupt
    await page.getByTestId('console-input').fill('Sys.sleep(30)');
    await page.getByTestId('console-input').press('Enter');
    await expect(page.getByTestId('stop-button')).toBeVisible({ timeout: 10_000 });
    await page.getByTestId('stop-button').click();
    await waitForIdle(page);
    exec = await runConsole(page, '"alive"');
    await expect(exec.getByTestId('exec-output')).toHaveText('[1] "alive"');
  });

  test('persistence: scripts survive reload, snapshot restores the R environment, CSV import with Hebrew', async ({ page }) => {
    await bootApp(page);
    await loadScript(page, 'persist', 'answer <- 42\nanswer');
    await runAll(page);
    await expect(page.locator('[data-testid="env-object"][data-name="answer"]')).toBeVisible();
    await page.getByTestId('project-button').click();
    await page.getByTestId('save-snapshot').click();
    await expect(page.getByTestId('toast').first()).toContainText('תמונת המצב נשמרה');
    await page.keyboard.press('Escape');

    await page.reload();
    await bootApp(page);
    await expect(page.getByRole('tab', { name: 'persist' })).toBeVisible();
    await expect(page.locator('.cm-content')).toContainText('answer <- 42');
    await expect(page.locator('[data-testid="env-object"][data-name="answer"]')).toHaveCount(0);
    await expect(page.getByTestId('snapshot-prompt')).toBeVisible();
    await page.getByTestId('snapshot-prompt').getByRole('button', { name: 'שחזר' }).click();
    await expect(page.locator('[data-testid="env-object"][data-name="answer"]')).toBeVisible({ timeout: 60_000 });
    const exec = await runConsole(page, 'answer + 1');
    await expect(exec.getByTestId('exec-output')).toHaveText('[1] 43');

    // CSV import through the file picker, Hebrew preserved
    await page.getByTestId('side-tab-files').click();
    await page.getByTestId('file-input').setInputFiles({ name: 'participants.csv', mimeType: 'text/csv', buffer: Buffer.from('﻿name;score\nדנה;90\nיוסי;85\n', 'utf8') });
    await expect(page.getByTestId('csv-object-name')).toHaveValue('participants');
    await expect(page.getByText('df <- read.csv', { exact: false }).or(page.getByText('participants <- read.csv'))).toBeVisible();
    await page.getByTestId('csv-import-run').click();
    const imp = page.getByTestId('execution').filter({ hasText: 'participants <- read.csv' });
    await expect(imp).toHaveAttribute('data-status', 'done', { timeout: 60_000 });
    const check = await runConsole(page, 'participants$name[1]; nrow(participants)');
    await expect(check.getByTestId('exec-output')).toContainText('"דנה"');
    await expect(check.getByTestId('exec-output')).toContainText('[1] 2');
  });
});
