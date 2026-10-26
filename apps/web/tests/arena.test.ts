import { expect, test } from '@playwright/test';

// The whole public loop against the simulated cage (playwright.config sets
// KAEFIG_RUNNER=sim): submit a plain document, watch the trace, see it held,
// and find the attempt in the protocol.
test('an attempt runs, holds and lands in the protocol', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Glaskasten');
  await expect(page.getByText('Kopfgeld-Topf')).toBeVisible();

  await page.getByRole('link', { name: /Versuch starten/ }).click();
  await expect(page).toHaveURL(/\/versuch$/);
  // The sample document is prefilled
  await expect(page.locator('textarea')).not.toBeEmpty();

  await page.getByRole('button', { name: /In den Käfig schicken/ }).click();

  // The live trace streams in, then the cage holds
  await expect(page.getByText(/microVM gestartet/)).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(/Gehalten/)).toBeVisible({ timeout: 15_000 });

  await page.goto('/protokoll');
  await expect(page.getByText('attempt.created').first()).toBeVisible({ timeout: 15_000 });
});

test('the rules page is reachable and public', async ({ page }) => {
  await page.goto('/regeln');
  await expect(page.getByRole('heading', { name: 'Regeln' })).toBeVisible();
});
