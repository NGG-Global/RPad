import { test, expect } from '@playwright/test';
import { bootApp, runConsole } from './helpers';

test('portrait layout uses bottom tabs and never scrolls horizontally', async ({ page }) => {
  await bootApp(page);
  await expect(page.getByTestId('portrait-tabs')).toBeVisible();
  await expect(page.getByTestId('editor-panel')).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(overflow).toBe(false);
  await page.getByTestId('tab-console').click();
  const exec = await runConsole(page, 'df <- data.frame(id = 1:3, v = c(1.5, NA, 3)); hist(c(1, 2, 2, 3))');
  await expect(exec).toHaveAttribute('data-status', 'done');
  await page.getByTestId('tab-data').click();
  await page.locator('[data-testid="env-object"][data-name="df"] button').nth(1).click();
  await expect(page.getByTestId('df-row')).toHaveCount(3);
  await expect(page.getByTestId('df-row').nth(1)).toContainText('NA');
  await page.getByTestId('tab-plots').click();
  await expect(page.getByTestId('plot-image')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
});
