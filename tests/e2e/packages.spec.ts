import { test, expect } from '@playwright/test';
import { bootApp, runConsole } from './helpers';

test('installing is not loading: missing-function hint offers library(), settings install loads the package', async ({ page }) => {
  test.setTimeout(300_000);
  await bootApp(page);
  const exec = await runConsole(page, 'df <- data.frame(g = c("a", "b", "a"), v = 1:3); summarise(df, n = n())');
  await expect(exec).toHaveAttribute('data-status', 'error');
  await expect(exec.getByTestId('exec-output')).toContainText('could not find function "summarise"');
  const hint = exec.getByTestId('package-hint');
  await expect(hint).toContainText('dplyr');
  await hint.getByRole('button', { name: 'library(dplyr)' }).click();
  await expect(page.getByTestId('execution').last()).toHaveAttribute('data-status', 'done', { timeout: 180_000 });
  const again = await runConsole(page, 'summarise(df, n = n())');
  await expect(again.getByTestId('exec-output')).toContainText('1 3');

  // Settings → install package runs library(ggplot2) through the console.
  await page.getByTestId('settings-button').click();
  await page.getByPlaceholder('dplyr').fill('ggplot2');
  await page.getByRole('button', { name: 'התקן חבילה' }).click();
  const lib = page.getByTestId('execution').filter({ hasText: 'library(ggplot2)' });
  await expect(lib).toHaveAttribute('data-status', 'done', { timeout: 180_000 });
  const plot = await runConsole(page, 'ggplot(df, aes(g, v)) + geom_point()');
  await expect(plot).toHaveAttribute('data-status', 'done');
  await expect(plot.locator('img')).toHaveCount(1);
});
