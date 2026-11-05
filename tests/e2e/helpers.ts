import { expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

export const fixture = (n: number) => readFileSync(`tests/fixtures/week${n}.R`, 'utf8');

/** Open the app in a fresh browser context and wait for the R engine. */
export async function bootApp(page: Page) {
  await page.goto('/');
  const start = page.getByTestId('first-run-start');
  const status = page.getByTestId('runtime-status');
  // Fresh profiles show the first-run screen; returning users start automatically.
  for (let i = 0; i < 100; i++) {
    if (await start.isVisible()) {
      await start.click();
      break;
    }
    const st = await status.getAttribute('data-status').catch(() => null);
    if (st && st !== 'idle') break;
    await page.waitForTimeout(200);
  }
  await expect(page.getByTestId('runtime-status')).toHaveAttribute('data-status', 'ready', { timeout: 180_000 });
}

/** Load code into a new editor tab through the app's own script API. */
export async function loadScript(page: Page, name: string, code: string) {
  await page.evaluate(async ({ name, code }) => {
    const ws = (globalThis as unknown as { __rpad: { createScript: (n: string, c: string) => Promise<unknown> } }).__rpad;
    await ws.createScript(name, code);
  }, { name, code });
  await expect(page.getByRole('tab', { name, exact: false })).toHaveAttribute('aria-selected', 'true');
}

export async function runAll(page: Page) {
  const before = await page.getByTestId('execution').count();
  await page.getByTestId('run-all').click();
  const exec = page.getByTestId('execution').nth(before);
  await expect(exec).toHaveAttribute('data-status', /done|error/, { timeout: 180_000 });
  return exec;
}

export async function runConsole(page: Page, code: string) {
  // Wait for anything still queued (e.g. an import started by a dialog) to settle first.
  await waitForIdle(page);
  const before = await page.getByTestId('execution').count();
  await page.getByTestId('console-input').fill(code);
  await page.getByTestId('console-input').press('Enter');
  await expect(page.getByTestId('execution')).toHaveCount(before + 1, { timeout: 60_000 });
  const exec = page.getByTestId('execution').last();
  await expect(exec).toHaveAttribute('data-status', /done|error/, { timeout: 180_000 });
  return exec;
}

export async function waitForIdle(page: Page) {
  await expect(page.getByTestId('runtime-status')).toHaveAttribute('data-status', 'ready', { timeout: 180_000 });
}
