// The single-file build (dist-standalone/index.html) opened from file://, as a user
// would open a download. Ported from legacy ui_test's "standalone online refresh".
// It embeds a snapshot and polls the published Pages data every five minutes.

import { expect, test, type Page } from '@playwright/test';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { fixtureCatalog, publishedJson } from './fixture';

const FILE = fileURLToPath(new URL('../../dist-standalone/index.html', import.meta.url));
const PUBLISHED = 'https://bzbradford.github.io/whats-on-your-seed-v2/data/';
const FIVE_MINUTES = 5 * 60 * 1000;

test.skip(!existsSync(FILE), 'run `pnpm build:standalone` first (pnpm test:e2e does)');

interface Remote {
  available: boolean;
  catalog: unknown;
  status: Record<string, unknown>;
  requests: string[];
}

async function serveRemote(page: Page, remote: Remote) {
  await page.route(PUBLISHED + '*', (route) => {
    const url = route.request().url();
    remote.requests.push(url);
    if (!remote.available) return route.abort();
    const file = url.slice(PUBLISHED.length);
    const body =
      file === 'catalog.json'
        ? remote.catalog
        : file === 'sync-status.json'
          ? remote.status
          : file === 'update-history.json'
            ? publishedJson('update-history.json')
            : null;
    if (!body) return route.abort();
    return route.fulfill({
      contentType: 'application/json',
      headers: { 'access-control-allow-origin': '*' },
      body: JSON.stringify(body),
    });
  });
}

test('is one self-contained file', async ({ page }) => {
  const external: string[] = [];
  page.on('request', (r) => {
    if (!r.url().startsWith('file:') && !r.url().startsWith('data:')) external.push(r.url());
  });
  await page.route('**/*', (route) =>
    route.request().url().startsWith('file:') ? route.continue() : route.abort(),
  );
  await page.goto('file://' + FILE);
  await page.locator('.product').first().waitFor();
  expect(await page.locator('.brand-logo').evaluate((e) => (e as HTMLImageElement).src)).toMatch(
    /^data:image\/png/,
  );
  expect(
    await page.locator('.seed-photo img').evaluate((e) => (e as HTMLImageElement).naturalWidth),
  ).toBeGreaterThan(0);
  // Only the published-data poll leaves the file.
  expect(external.every((url) => url.startsWith(PUBLISHED))).toBe(true);
});

test('offline: shows the embedded snapshot and says so', async ({ page }) => {
  const remote: Remote = { available: false, catalog: null, status: {}, requests: [] };
  await serveRemote(page, remote);
  await page.goto('file://' + FILE);
  await page.locator('.product').first().waitFor();
  await expect(page.locator('#notice')).toContainText('Offline snapshot displayed.');
  await expect(page.locator('#count')).toHaveText(/^\d+ products$/);
  await page.locator('#tab-resources').click();
  await page.locator('#source-guide > summary').click();
  await expect(page.locator('#data')).toContainText('Embedded snapshot; online checks enabled');
  await page.locator('#guide-references > summary').click();
  expect(await page.locator('#guide .guide-action').getAttribute('href')).toMatch(
    /^data:application\/pdf;base64,/,
  );
  expect(remote.requests).toContain(PUBLISHED + 'catalog.json');
});

test('online: loads the published catalog, survives an outage, recovers', async ({ page }) => {
  const catalog = fixtureCatalog();
  catalog.products[0].name = 'Browser online refresh fixture';
  catalog.meta.last_successful_sync = '2026-10-30T12:01:00Z';
  const status = {
    ...(publishedJson('sync-status.json') as object),
    message: 'Browser published status fixture.',
  };
  const remote: Remote = { available: true, catalog, status, requests: [] };
  await page.clock.install({ time: new Date('2026-10-30T14:00:00Z') });
  await serveRemote(page, remote);
  await page.goto('file://' + FILE);
  const id = catalog.products[0].id;
  await page.locator('#query').fill(id);
  await expect(page.locator('.product').first()).toContainText('Browser online refresh fixture');
  await expect(page.locator('#notice')).toContainText('Data note:');
  await expect(page.locator('#notice')).not.toContainText('embedded snapshot');
  await page.locator(`[data-select="${id}"]`).check();
  for (const file of ['catalog.json', 'sync-status.json', 'update-history.json'])
    expect(remote.requests).toContain(PUBLISHED + file);

  // Outage: the newer data, search and selection stay; the notice says so.
  remote.available = false;
  await page.clock.runFor(FIVE_MINUTES);
  await expect(page.locator('#notice')).toContainText('Published updates unavailable.');
  await expect(page.locator('.product').first()).toContainText('Browser online refresh fixture');
  await expect(page.locator('#query')).toHaveValue(id);
  await expect(page.locator(`[data-select="${id}"]`)).toBeChecked();

  // Recovery clears the warning and refreshes the status panel.
  remote.available = true;
  remote.status = { ...status, message: 'Browser recovered status fixture.' };
  await page.clock.runFor(FIVE_MINUTES);
  await expect(page.locator('#notice')).toContainText('Data note:');
  await page.locator('#tab-resources').click();
  await page.locator('#source-guide > summary').click();
  await expect(page.locator('#data')).toContainText('Browser recovered status fixture.');
  await expect(page.locator('#data')).toContainText('Online catalog; checks every five minutes');

  // A newer catalog replaces the data, keeps the search, and announces it.
  const newer = structuredClone(catalog);
  newer.products[0].name = 'Second refresh fixture';
  newer.meta.last_successful_sync = '2026-10-30T13:01:00Z';
  remote.catalog = newer;
  await page.locator('#tab-products').click();
  await page.clock.runFor(FIVE_MINUTES);
  await expect(page.locator('#toast')).toHaveText('The published catalog has been updated.');
  await expect(page.locator('.product').first()).toContainText('Second refresh fixture');
  await expect(page.locator('#query')).toHaveValue(id);
});
