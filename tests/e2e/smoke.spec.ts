import { expect, test } from '@playwright/test';

test('loads the catalog and lists products', async ({ page }) => {
  await page.goto('./');
  await expect(page.getByRole('heading', { name: "What's on Your Seed?" })).toBeVisible();
  await expect(page.getByTestId('product-count')).toContainText(/\d+ products/);
  await expect(page.getByRole('listitem').first()).toBeVisible();
});

test('embed mode hides the page title', async ({ page }) => {
  await page.goto('./?embed');
  await expect(page.getByTestId('product-count')).toBeVisible();
  await expect(page.getByRole('heading', { name: "What's on Your Seed?" })).toHaveCount(0);
});
