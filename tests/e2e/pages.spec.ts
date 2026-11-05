import { test, expect } from '@playwright/test';

/**
 * GitHub Pages scenario: the site is served under a sub-path by a static server
 * that sends no COOP/COEP headers. The service worker injects the headers and
 * the app reloads once, after which R runs on the SharedArrayBuffer channel.
 */
test('becomes cross-origin isolated on a header-less host and can interrupt R', async ({ page }) => {
  test.setTimeout(300_000);
  await page.goto('/RPad/');
  expect(await page.evaluate(() => crossOriginIsolated)).toBe(false);
  await page.waitForFunction(() => crossOriginIsolated === true, null, { timeout: 30_000 });
  expect(page.url()).toContain('/RPad/');

  const start = page.getByTestId('first-run-start');
  await expect(start).toBeVisible();
  await start.click();
  await expect(page.getByTestId('runtime-status')).toHaveAttribute('data-status', 'ready', { timeout: 180_000 });
  expect(await page.getByTestId('runtime-status').getAttribute('title')).toContain('SharedArrayBuffer');

  await page.getByTestId('console-input').fill('png("a.png"); plot(1:3); dev.off(); hist(rnorm(30)); "pages ok"');
  await page.getByTestId('console-input').press('Enter');
  const exec = page.getByTestId('execution').last();
  await expect(exec).toHaveAttribute('data-status', 'done', { timeout: 120_000 });
  await expect(exec.getByTestId('exec-output')).toContainText('"pages ok"');
  await expect(exec.locator('img')).toHaveCount(2);

  await page.getByTestId('console-input').fill('Sys.sleep(30)');
  await page.getByTestId('console-input').press('Enter');
  await page.getByTestId('stop-button').click();
  await expect(page.getByTestId('runtime-status')).toHaveAttribute('data-status', 'ready', { timeout: 30_000 });
  await expect(page.getByTestId('execution').last().getByTestId('exec-output')).toContainText('Execution interrupted');
});
