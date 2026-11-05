import { test, expect } from '@playwright/test';
import { bootApp, runConsole } from './helpers';

/**
 * Offline verification: after one online session that used dplyr and the png
 * device, the app must boot the R engine and run the same features with the
 * network disabled (service worker runtime caches).
 */
test('runs R, dplyr and plotting offline after one online session', async ({ page, context }) => {
  test.setTimeout(400_000);
  await bootApp(page);
  const online = await runConsole(page, 'library(dplyr); png("x.png"); hist(rnorm(10)); dev.off(); hist(rnorm(20)); "online ok"');
  await expect(online.getByTestId('exec-output')).toContainText('"online ok"');
  // Let the service worker take control and warm the runtime cache.
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null, null, { timeout: 30_000 });
  await page.waitForFunction(async () => (await (await caches.open('rpad-webr-runtime')).keys()).length >= 30, null, { timeout: 60_000 });

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByTestId('runtime-status')).toHaveAttribute('data-status', 'ready', { timeout: 120_000 });
  const offline = await runConsole(page, 'library(dplyr); df <- data.frame(g = c("a", "b", "a"), v = 1:3); df |> group_by(g) |> summarise(n = n()); png("y.png"); hist(rnorm(10)); dev.off(); hist(rnorm(5)); "offline ok"');
  await expect(offline).toHaveAttribute('data-status', 'done');
  await expect(offline.getByTestId('exec-output')).toContainText('# A tibble: 2');
  await expect(offline.getByTestId('exec-output')).toContainText('"offline ok"');
  await expect(offline.locator('img')).toHaveCount(2);
  await context.setOffline(false);
});
