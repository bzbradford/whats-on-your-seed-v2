// Browser behaviour of the Pages build, ported from the legacy ui_test.cjs (the Oct 19
// version, upstream 435c0bf, and the later one in legacy/tests/).
// Uses the frozen 2026-10-19 fixture and clock so counts stay stable.

import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fixtureCatalog, freezeClock, serveFixture } from './fixture';

const fixture = fixtureCatalog();
const labelProduct = fixture.products.find((p) => p.safety?.label_url)!;

async function open(page: Page, url = './') {
  await freezeClock(page);
  await serveFixture(page);
  await page.goto(url);
  await page.locator('.product').first().waitFor();
}

/** Pick an option in a Bits UI Select (a combobox button and a listbox). */
async function choose(page: Page, id: string, option: string) {
  await page.locator('#' + id).click();
  await page.getByRole('option', { name: option, exact: true }).click();
  await expect(page.getByRole('listbox')).toHaveCount(0);
}

/** Open the products toolbar's Download menu. */
async function openDownloads(page: Page) {
  await page.locator('#download-menu').click();
  await expect(page.getByRole('menu')).toBeVisible();
}

/** Close an open menu with Escape. */
async function closeMenu(page: Page) {
  await page.keyboard.press('Escape');
  await expect(page.getByRole('menu')).toHaveCount(0);
}

const isFocused = (page: Page, selector: string) =>
  page.locator(selector).evaluate((e) => e === document.activeElement);

async function downloadText(page: Page, click: () => Promise<void>) {
  const download = page.waitForEvent('download');
  await click();
  const path = await (await download).path();
  return readFileSync(path!, 'utf8');
}

test.describe('products', () => {
  test.beforeEach(async ({ page }) => open(page));

  test('pages 25 products, each with label access', async ({ page }) => {
    await expect(page.locator('.product')).toHaveCount(25);
    await expect(page.locator('.product .label-action')).toHaveCount(25);
    await expect(page.locator('#count')).toHaveText('880 products');
    await expect(page.locator('#page-label')).toHaveText('1–25 of 880 · Page 1 of 36');
    await page.locator('#page-next').click();
    await expect(page.locator('#page-label')).toContainText('Page 2');
    await expect(page.locator('#count')).toBeFocused();
    await page.locator('#query').fill('fludioxonil');
    await expect(page.locator('#page-label')).toContainText('Page 1');
  });

  test('keyboard: skip link and tab navigation', async ({ page }) => {
    await expect(page.locator('[role="tab"][tabindex="0"]')).toHaveCount(1);
    await page.keyboard.press('Tab');
    expect(await isFocused(page, '.jump')).toBe(true);
    await page.keyboard.press('Enter');
    expect(await isFocused(page, '#main')).toBe(true);
    await page.locator('#tab-products').focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('#tab-matrix')).toBeFocused();
    await expect(page.locator('#tab-matrix')).toHaveAttribute('aria-selected', 'true');
    await page.keyboard.press('End');
    await expect(page.locator('#tab-data')).toBeFocused();
    await page.keyboard.press('Home');
    await expect(page.locator('#tab-products')).toBeFocused();
    await expect(page.locator('[role="tab"]')).toHaveCount(5);
  });

  test('filters: exact crop, technology, provenance, signal words, restricted use', async ({
    page,
  }) => {
    await expect(page.locator('#filters')).toBeVisible();
    await expect(page.locator('#filters details[open]')).toHaveCount(0);
    await page.locator('.site-picker summary').click();
    await page.getByRole('checkbox', { name: 'Barley (seed treatment)', exact: true }).check();
    await expect(page.locator('#count')).toHaveText('299 products');
    await expect(page.locator('#site-summary')).toHaveText('1 site selected');
    await expect(page.locator('#applied .chip')).toHaveText(['Barley×']);
    await page.locator('#reset').click();
    await expect(page.locator('#count')).toHaveText('880 products');
    await choose(page, 'technology', 'Plant-Incorp. Protectant');
    await expect(page.locator('#count')).toHaveText('85 products');
    await page.locator('#reset').click();
    await page.getByRole('button', { name: 'Company & ingredient evidence' }).click();
    await choose(page, 'quality', 'Related base formulation');
    await expect(page.locator('#count')).toHaveText('185 products');
    await page.locator('#reset').click();
    await page.getByText('Groups & EPA hazards', { exact: true }).click();
    await choose(page, 'signal', 'None reported by EPA');
    await expect(page.locator('#count')).toHaveText('25 products');
    await choose(page, 'signal', 'Not supplied / needs review');
    await expect(page.locator('#count')).toHaveText('187 products');
    await page.locator('#reset').click();
    await choose(page, 'rup', 'Yes');
    await expect(page.locator('#count')).toHaveText('19 products');
    // Oct 19 cards show a restricted-use badge only when the flag is Yes.
    await expect(page.locator('.product').first().locator('.safety-badge.warning')).toHaveText(
      'Restricted-use flag: Yes',
    );
    await choose(page, 'rup', 'No');
    await expect(page.locator('.product .safety-badge', { hasText: 'Restricted-use' })).toHaveCount(
      0,
    );
    // User decision: no state registration UI.
    await expect(page.locator('#state, #state-status, #state-help, #matrix-state')).toHaveCount(0);
  });

  test('applied filters include search and dates, and each chip removes its filter', async ({
    page,
  }) => {
    await page.locator('#query').fill('fludioxonil');
    await page.getByText('Groups & EPA hazards', { exact: true }).click();
    await choose(page, 'rup', 'No');
    await page.getByText('Registration status & dates', { exact: true }).click();
    await page.locator('#start').fill('2020-01-01');
    await expect(page.locator('#applied .chip')).toHaveText([
      'Search: “fludioxonil”×',
      'Restricted-use flag: No×',
      'Status date: Jan 1, 2020 – Oct 19, 2026×',
    ]);
    const before = await page.locator('#count').textContent();
    await page.getByRole('button', { name: 'Remove filter: Search: “fludioxonil”' }).click();
    await expect(page.locator('#query')).toHaveValue('');
    await expect(page.locator('#count')).not.toHaveText(before!);
    await expect(page.locator('#applied .chip').first()).toBeFocused();
    await page.getByRole('button', { name: /Remove filter: Status date/ }).click();
    await expect(page.locator('#start')).toHaveValue('');
    await expect(page.locator('#end')).toHaveValue('2026-10-19');
    await page.getByRole('button', { name: /Remove filter: Restricted-use/ }).click();
    await expect(page.locator('#applied .chip')).toHaveCount(0);
    await expect(page.locator('#count')).toBeFocused();
    await expect(page.locator('#count')).toHaveText('880 products');
  });

  test('date range validation', async ({ page }) => {
    await page.getByText('Registration status & dates', { exact: true }).click();
    await expect(page.locator('#end')).toHaveValue('2026-10-19');
    await page.locator('#start').fill('2099-01-01');
    await expect(page.locator('#count')).toHaveText('Check your dates');
    await expect(page.locator('#date-error')).toHaveText(
      'Start date must be on or before the end date.',
    );
    await expect(page.locator('#start')).toHaveAttribute('aria-invalid', 'true');
    await expect(page.locator('#results')).toContainText('Start date is after end date.');
    await expect(page.locator('#pager')).toBeHidden();
    await openDownloads(page);
    await expect(page.locator('#export-labels')).toBeDisabled();
    await closeMenu(page);
    await expect(page.locator('#a11y-alert')).toHaveText(
      'Start date must be on or before the end date.',
    );
    await page.locator('#start').fill('2026-01-01');
    await expect(page.locator('#date-error')).toBeHidden();
    await expect(page.locator('#start')).not.toHaveAttribute('aria-invalid');
  });

  test('empty results', async ({ page }) => {
    await page.locator('#query').fill('no-product-matches-xyz');
    await expect(page.locator('#count')).toHaveText('0 products');
    await expect(page.locator('#results')).toContainText('No matching products.');
    await openDownloads(page);
    await expect(page.locator('#export-labels')).toBeDisabled();
    await closeMenu(page);
    await page.locator('[data-reset]').click();
    await expect(page.locator('#count')).toHaveText('880 products');
    await expect(page.locator('#query')).toBeFocused();
  });

  test('cards: FRAC/IRAC only when assigned, coverage in the dialog', async ({ page }) => {
    await page.locator('#query').fill('100-1508');
    const card = page.locator('.product');
    await expect(card.locator('.groups')).toHaveText('FRAC 4, 7, 12 · IRAC 4A');
    await expect(card).not.toContainText('reviewed FRAC/IRAC assignment');
    await expect(card).not.toContainText('No reviewed assignment');
    await expect(card.locator('.product-bottom')).toContainText('· Status ');
    await page.locator('#query').fill('5905-491-38167');
    await expect(page.locator('.product .groups')).toHaveCount(0);
    await page.locator('.product-name').click();
    await expect(page.locator('#dialog-body')).toContainText('Ingredients missing; groups unknown');
    await page.keyboard.press('Escape');
  });

  test('cards show at most three of a long ingredient list, plus a count', async ({ page }) => {
    // Many stacked Bt-trait products list more than four ingredients.
    const card = page
      .locator('.product')
      .filter({ has: page.locator('.more-ingredients') })
      .first();
    await expect(card.locator('.ingredient-pill')).toHaveCount(3);
    const more = card.locator('.more-ingredients');
    const extra = Number((await more.textContent())!.match(/\d+/)![0]);
    await more.click();
    await expect(page.locator('#dialog-body table tbody tr')).toHaveCount(3 + extra);
    await page.keyboard.press('Escape');
    await expect(more).toBeFocused();
    await page.locator('#query').fill('100-1508');
    await expect(page.locator('.product .ingredient-pill')).toHaveCount(4);
    await expect(page.locator('.product .more-ingredients')).toHaveCount(0);
  });

  test('records without ingredients carry their own flag, in both views', async ({ page }) => {
    await page.locator('#query').fill('5905-491-38167');
    await expect(page.locator('.product .record-flag')).toHaveText(
      'Ingredients missing · deltamethrin exclusion not confirmed',
    );
    await page.getByRole('radio', { name: 'List' }).click();
    await expect(page.locator('.product-row .record-flag')).toBeVisible();
    await page.locator('#query').fill('100-1508');
    await expect(page.locator('.record-flag')).toHaveCount(0);
  });

  test('label links: exact EPA PDF and distributor lookup', async ({ page, context }) => {
    await page.locator('#query').fill(labelProduct.id);
    const link = page.locator('.product .label-action');
    await expect(link).toHaveAttribute('href', labelProduct.safety.label_url!);
    await expect(link).toHaveAttribute('target', '_blank');
    expect(await link.getAttribute('aria-label')).toContain(labelProduct.registration_number);
    await context.route('https://www3.epa.gov/**', (route) =>
      route.fulfill({ contentType: 'text/html', body: '<h1>EPA document fixture</h1>' }),
    );
    const popup = page.waitForEvent('popup');
    await link.focus();
    await page.keyboard.press('Enter');
    const opened = await popup;
    await opened.waitForLoadState();
    expect(opened.url()).toBe(labelProduct.safety.label_url);
    await opened.close();
    await page.locator('#query').fill('5905-491-38167');
    await expect(page.locator('.product .label-action')).toContainText('Find product label');
    // The per-product note is in the dialog; the cards share one explanation.
    await expect(page.locator('.product .label-meta')).toHaveCount(0);
    await expect(page.locator('#label-help')).toBeHidden();
    await page.getByText('About label links', { exact: true }).click();
    await expect(page.locator('#label-help')).toContainText('acceptance letter');
    await page.locator('.product-name').click();
    await expect(page.locator('#dialog-body .label-panel')).toContainText('5905-491-38167');
    await page.keyboard.press('Escape');
  });

  test('exports: label links (filtered and all) and results CSV', async ({ page }) => {
    await page.locator('#query').fill('5905-491-38167');
    await openDownloads(page);
    await expect(page.locator('#export')).toContainText('Results (CSV)');
    await expect(page.locator('#export-labels')).toContainText('Label links (CSV)');
    await expect(page.locator('#print-results')).toHaveText('Print this view');
    const filtered = await downloadText(page, () => page.locator('#export-labels').click());
    expect(filtered.split('\r\n')).toHaveLength(2);
    expect(filtered).toContain('Lookup required');
    await expect(page.locator('#toast')).toContainText('1 product exported in the label-link CSV');
    await page.locator('#reset').click();
    await openDownloads(page);
    const all = await downloadText(page, () => page.locator('#export-labels').click());
    expect(all.split('\r\n')).toHaveLength(fixture.products.length + 1);
    await openDownloads(page);
    const results = await downloadText(page, () => page.locator('#export').click());
    expect(results.charCodeAt(0)).toBe(0xfeff);
    expect(results).toContain('Workbook created');
  });

  test('product dialog: formulation, label panel, focus handling', async ({ page }) => {
    await page.locator('#query').fill('100-1508');
    await expect(page.locator('.product')).toHaveCount(1);
    await page.locator('.product-name').click();
    await expect(page.locator('#dialog-body')).toContainText('Metalaxyl-M');
    await expect(page.locator('#dialog-body')).toContainText('Workbook created');
    await expect(page.locator('#dialog-body .label-panel .label-action')).toBeVisible();
    await expect(page.locator('#dialog-title')).toBeFocused();
    await expect(page.locator('#dialog-note')).toHaveText(
      'EPA workbook created Sep 21, 2026. Follow the current product label.',
    );
    await expect(page.locator('#dialog-body .safety-panel')).toContainText(
      'Exact registration match',
    );
    await page.keyboard.press('Tab');
    await expect(page.locator('#close-dialog')).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(page.locator('#dialog')).toBeHidden();
    await expect(page.locator('.product-name')).toBeFocused();
  });

  test('ingredient dialog links to products', async ({ page }) => {
    await page.locator('#query').fill('100-1508');
    await page.locator('.ingredient-pill[data-ingredient="Sedaxane"]').click();
    await expect(page.locator('#dialog-title')).toHaveText('Sedaxane');
    await expect(page.locator('#dialog-body')).toContainText('catalog product');
    await page.locator('#dialog-body [data-detail="100-1508"]').click();
    await expect(page.locator('#dialog-title')).toHaveText('Cruisermaxx Vibrance');
    await page.locator('#close-dialog').click();
    await expect(page.locator('.ingredient-pill[data-ingredient="Sedaxane"]')).toBeFocused();
  });

  test('disclosures for missing formulations and signal words', async ({ page }) => {
    await page.locator('#query').fill('5905-491-38167');
    await page.locator('.product-name').click();
    await expect(page.locator('#dialog-body')).toContainText(
      'exclusion cannot be independently confirmed',
    );
    await expect(page.locator('#dialog-body')).toContainText('EPA signal: Not supplied');
    // A distributor never gets the workbook-file link or its "exact match" claim.
    await expect(page.locator('#dialog-body .safety-panel')).not.toContainText(
      'Exact registration match',
    );
    await page.keyboard.press('Escape');
  });
});

test.describe('filters stay at hand', () => {
  test('desktop: the sidebar stays in view while scrolling the results', async ({ page }) => {
    await open(page);
    await page.evaluate(() => window.scrollTo(0, 4000));
    // It sits just below the pinned tab bar and search + toolbar row.
    const box = await page.locator('#filters').boundingBox();
    const head = await page.locator('.results-head').boundingBox();
    expect(box!.y).toBeGreaterThanOrEqual(head!.y + head!.height);
    expect(box!.y).toBeLessThan(140);
    expect(await page.locator('#filters').evaluate((e) => getComputedStyle(e).position)).toBe(
      'sticky',
    );
  });

  test('phones: Show filters is pinned to the bottom, above the compare tray', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await open(page);
    await page.evaluate(() => window.scrollTo(0, 3000));
    const button = page.locator('#mobile-filter');
    const box = await button.boundingBox();
    expect(box!.y + box!.height).toBeGreaterThan(844 - 80);
    expect(box!.y + box!.height).toBeLessThanOrEqual(844);
    await page.locator('[data-select]').first().check();
    await expect(page.locator('#comparebar')).toBeVisible();
    await expect
      .poll(async () => {
        const b = (await button.boundingBox())!;
        const bar = (await page.locator('#comparebar').boundingBox())!;
        return b.y + b.height <= bar.y;
      })
      .toBe(true);
    await button.click();
    await expect(page.locator('#filters')).toBeVisible();
    await expect(page.locator('#filter-title')).toBeFocused();
    await expect(button).toHaveText('Hide filters');
  });
});

test.describe('filter controls: keyboard and screen readers', () => {
  test.beforeEach(async ({ page }) => open(page));

  test('filter groups are accordion buttons with aria-expanded', async ({ page }) => {
    const trigger = page.getByRole('button', { name: 'Groups & EPA hazards' });
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await trigger.focus();
    await page.keyboard.press('Enter');
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByRole('combobox', { name: 'EPA signal word' })).toBeVisible();
    await page.keyboard.press('Space');
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });

  test('selects are labelled comboboxes operable from the keyboard', async ({ page }) => {
    await page.getByRole('button', { name: 'Groups & EPA hazards' }).click();
    const signal = page.getByRole('combobox', { name: 'EPA signal word' });
    await expect(signal).toHaveText('All signal words');
    await signal.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('listbox')).toBeVisible();
    await page.keyboard.press('End');
    await page.keyboard.press('Enter');
    await expect(page.getByRole('listbox')).toHaveCount(0);
    await expect(signal).toHaveText('Not supplied / needs review');
    await expect(signal).toBeFocused();
    await expect(page.locator('#count')).toHaveText('187 products');
    // Escape closes without changing the choice.
    await page.keyboard.press('ArrowDown');
    await expect(page.getByRole('listbox')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('listbox')).toHaveCount(0);
    await expect(signal).toBeFocused();
    await expect(page.locator('#count')).toHaveText('187 products');
    // Choosing "All signal words" clears the filter again.
    await choose(page, 'signal', 'All signal words');
    await expect(page.locator('#count')).toHaveText('880 products');
  });

  test('the sort menu offers every order, including the list columns', async ({ page }) => {
    const sort = page.getByRole('combobox', { name: 'Sort' });
    await sort.click();
    await expect(page.getByRole('option')).toHaveCount(12);
    await page.getByRole('option', { name: 'Signal word, most severe first' }).click();
    await page.getByRole('radio', { name: 'List' }).click();
    await expect(page.locator('thead th.col-signal')).toHaveAttribute('aria-sort', 'descending');
  });

  test('the Download menu works from the keyboard', async ({ page }) => {
    const trigger = page.getByRole('button', { name: 'Download' });
    await expect(trigger).toHaveAttribute('aria-haspopup', 'menu');
    await trigger.focus();
    await page.keyboard.press('Enter');
    const menu = page.getByRole('menu');
    await expect(menu).toBeVisible();
    await expect(menu.getByRole('menuitem')).toHaveCount(3);
    await page.keyboard.press('ArrowDown');
    await expect(page.locator('#export-labels')).toHaveAttribute('data-highlighted', '');
    const download = page.waitForEvent('download');
    await page.keyboard.press('Enter');
    expect((await download).suggestedFilename()).toMatch(/^CPN-label-links-/);
    await expect(menu).toHaveCount(0);
    await expect(trigger).toBeFocused();
  });

  test('terse list headers explain themselves on focus', async ({ page }) => {
    await page.getByRole('radio', { name: 'List' }).click();
    await page.locator('thead th.col-groups [tabindex="0"]').focus();
    await expect(page.locator('.header-tip')).toContainText('resistance-group codes');
    await page.keyboard.press('Escape');
    await expect(page.locator('.header-tip')).toHaveCount(0);
  });
});

test.describe('sticky stack (4a follow-up 4)', () => {
  const rect = (page: Page, sel: string) =>
    page.locator(sel).evaluate((e) => {
      const r = e.getBoundingClientRect();
      return { top: r.top, bottom: r.bottom, height: r.height };
    });

  test('desktop: the tab bar and the search + toolbar row stay pinned', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await open(page);
    for (const view of ['Cards', 'List']) {
      await page.getByRole('radio', { name: view }).click();
      // Mid-page (the List is short; at its end the sidebar's container pushes it up).
      await page.evaluate(() => window.scrollTo(0, 1200));
      await expect(page.locator('.tabs')).toHaveClass(/stuck/);
      await expect(page.locator('.results-head')).toHaveClass(/pinned/);
      const tabs = await rect(page, '.tabs');
      const head = await rect(page, '.results-head');
      const filters = await rect(page, '#filters');
      expect(tabs.top).toBe(0);
      expect(head.top).toBeCloseTo(tabs.bottom, 0);
      expect(head.bottom).toBeLessThanOrEqual(120);
      expect(filters.top).toBeGreaterThanOrEqual(head.bottom);
      await expect(page.locator('#query')).toBeInViewport();
      await expect(page.locator('#download-menu')).toBeInViewport();
      await expect(page.getByRole('tab', { name: 'Treatment guide' })).toBeInViewport();
      await page.evaluate(() => window.scrollTo(0, 0));
    }
  });

  test('phones: only the tab bar is pinned', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await open(page);
    await page.evaluate(() => window.scrollTo(0, 3000));
    await expect(page.locator('.tabs')).toHaveClass(/stuck/);
    expect((await rect(page, '.tabs')).top).toBe(0);
    await expect(page.locator('.results-head')).not.toHaveClass(/pinned/);
    await expect(page.locator('#query')).not.toBeInViewport();
    await expect(page.locator('#mobile-filter')).toBeInViewport();
  });

  test('focus returns below the pinned header', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await open(page);
    const button = page.locator('.product-name').nth(12);
    await button.click();
    await expect(page.locator('#dialog[open]')).toBeVisible();
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.keyboard.press('Escape');
    await expect(button).toBeFocused();
    const pinned = (await rect(page, '.results-head')).bottom;
    expect((await button.boundingBox())!.y).toBeGreaterThanOrEqual(pinned);
  });
});

test.describe('list view', () => {
  test.beforeEach(async ({ page }) => open(page));

  test('the Cards / List pill switches views and is remembered', async ({ page }) => {
    const pill = page.getByRole('group', { name: 'Results view' });
    await expect(pill.getByRole('radio', { name: 'Cards' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    await pill.getByRole('radio', { name: 'List' }).click();
    await expect(page.locator('.product-row')).toHaveCount(25);
    await expect(page.locator('.product')).toHaveCount(0);
    // Keyboard: arrow keys move between the two radios.
    await pill.getByRole('radio', { name: 'List' }).focus();
    await page.keyboard.press('ArrowLeft');
    await expect(pill.getByRole('radio', { name: 'Cards' })).toBeFocused();
    await page.reload();
    await page.locator('.product-row').first().waitFor();
    await expect(pill.getByRole('radio', { name: 'List' })).toHaveAttribute('aria-checked', 'true');
  });

  test('rows show the key facts, open the dialog, and compare', async ({ page }) => {
    await page.getByRole('radio', { name: 'List' }).click();
    await page.locator('#query').fill('100-1508');
    const row = page.locator('.product-row');
    await expect(row).toHaveCount(1);
    for (const text of [
      'Cruisermaxx Vibrance',
      'EPA 100-1508',
      'Thiamethoxam',
      '20.8%',
      'Fungicide',
      'CAUTION',
      'IRAC 4A',
      'Corn',
    ])
      await expect(row).toContainText(text);
    await expect(row.locator('.label-action')).toHaveAttribute('target', '_blank');
    await row.locator('.col-crops').click();
    await expect(page.locator('#dialog-title')).toHaveText('Cruisermaxx Vibrance');
    await page.keyboard.press('Escape');
    // Keyboard path: the name button.
    await row.locator('[data-detail="100-1508"]').focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('#dialog-title')).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(row.locator('[data-detail="100-1508"]')).toBeFocused();
    await row.locator('[data-select="100-1508"]').check();
    await expect(page.locator('#dialog')).toBeHidden();
    await expect(page.locator('#selected-count')).toHaveText('1 of 4 products selected');
  });

  test('column headers sort, with aria-sort, and stick to the top', async ({ page }) => {
    await page.getByRole('radio', { name: 'List' }).click();
    const header = page.locator('thead th.col-product');
    await expect(header).toHaveAttribute('aria-sort', 'ascending');
    await header.getByRole('button').click();
    await expect(header).toHaveAttribute('aria-sort', 'descending');
    const names = await page.locator('.row-name').allTextContents();
    expect(names).toEqual([...names].sort((a, b) => b.localeCompare(a)));
    await page.locator('thead th.col-signal button').click();
    await expect(page.locator('thead th.col-signal')).toHaveAttribute('aria-sort', 'descending');
    await expect(page.locator('.row-signal').first()).toHaveText('DANGER');
    expect(
      await page
        .locator('thead th')
        .first()
        .evaluate((e) => getComputedStyle(e).position),
    ).toBe('sticky');
  });

  test('purposes wrap at spaces or slashes, never mid-word', async ({ page }) => {
    await page.getByRole('radio', { name: 'List' }).click();
    await page.locator('#query').fill('Smartstax Pro Enlist');
    const purpose = page.locator('.product-row .row-purpose').first();
    await expect(purpose).toHaveText('Nonviable Microbial/Transgenic Plant');
    expect(await purpose.locator('wbr').count()).toBe(1);
    // Every line break falls at a space or right after "/".
    const breaksMidWord = await purpose.evaluate((el) => {
      const text = el.textContent!;
      const range = document.createRange();
      let lastTop = -1;
      let offset = 0;
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        for (let i = 0; i < node.textContent!.length; i++, offset++) {
          range.setStart(node, i);
          range.setEnd(node, i + 1);
          const top = Math.round(range.getBoundingClientRect().top);
          if (lastTop >= 0 && top > lastTop) {
            const before = text[offset - 1];
            if (before !== ' ' && before !== '/' && text[offset] !== ' ') return true;
          }
          lastTop = top;
        }
      }
      return false;
    });
    expect(breaksMidWord).toBe(false);
  });

  test('phones: rows stack without sideways scrolling', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole('radio', { name: 'List' }).click();
    await expect(page.locator('.product-row').first()).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      390,
    );
    await expect(page.locator('.product-list thead')).toBeHidden();
  });
});

test.describe('comparison', () => {
  test.beforeEach(async ({ page }) => open(page));

  test('select from products, fill the matrix to four, export and print', async ({ page }) => {
    for (const reg of ['100-1648', '7969-441']) {
      await page.locator('#query').fill(reg);
      await page.locator('.comparecheck input').focus();
      await page.keyboard.press('Space');
      await expect(page.locator('.comparecheck input')).toBeChecked();
      await expect(page.locator('.comparecheck input')).toBeFocused();
    }
    await expect(page.locator('#comparebar')).toBeVisible();
    await expect(page.locator('#selected-count')).toHaveText('2 of 4 products selected');
    await page.locator('#compare').click();
    await expect(page.locator('#matrix-title')).toBeFocused();
    await expect(page.locator('#comparebar')).toBeHidden();
    await expect(page.locator('#matrix-body')).toContainText('FRAC fungicide groups');
    await expect(page.locator('#dialog')).toBeHidden();
    for (const reg of ['352-937', '100-1508']) {
      await page.locator('#matrix-search').fill(reg);
      await page.locator('#matrix-add').click();
    }
    await expect(page.locator('#matrix-count')).toHaveText('4 of 4 formulations selected');
    await expect(page.locator('#matrix-body .label-action')).toHaveCount(4);
    await expect(page.locator('#matrix-add')).toBeDisabled();
    await expect(page.locator('#matrix-matches')).toHaveText(
      'Four formulations selected. Remove one to add another.',
    );
    expect(await page.locator('#matrix').innerText()).not.toMatch(/efficacy/i);
    await expect(page.locator('#matrix-body')).toContainText('0.25 fl oz');
    await expect(page.locator('.matrix-table tbody')).toHaveCount(4);
    expect(
      await page.locator('.matrix-table td').evaluateAll((cells) =>
        cells.every((cell) => {
          const ids = (cell.getAttribute('headers') || '').split(' ').filter(Boolean);
          return ids.length === 3 && ids.every((id) => document.getElementById(id));
        }),
      ),
    ).toBe(true);
    const csv = await downloadText(page, () => page.locator('#matrix-export').click());
    expect(csv).toContain('First EPA registration date');
    expect(csv).toContain('EPA 352-937');
    expect(csv).not.toMatch(/efficacy/i);

    // Mobile: the page never scrolls sideways; the matrix scrolls internally.
    await page.setViewportSize({ width: 390, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(
      false,
    );
    expect(
      await page.locator('.matrix-scroll').evaluate((e) => e.scrollWidth > e.clientWidth),
    ).toBe(true);
    await page.setViewportSize({ width: 320, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(
      false,
    );
    await page.setViewportSize({ width: 1440, height: 1100 });

    // Print: no clipping, pest lists expanded during printing only.
    await page.emulateMedia({ media: 'print' });
    expect(
      await page.locator('.matrix-scroll').evaluate((e) => getComputedStyle(e).maxHeight),
    ).toBe('none');
    await expect(page.locator('#matrix-body')).toBeVisible();
    const openedDuringPrint = await page.evaluate(() => {
      let opened = false;
      window.print = () => {
        opened = [...document.querySelectorAll('#matrix-body details')].every(
          (d) => (d as HTMLDetailsElement).open,
        );
      };
      (document.getElementById('matrix-print') as HTMLButtonElement).click();
      return opened;
    });
    expect(openedDuringPrint).toBe(true);
    expect(await page.locator('#matrix-body details[open]').count()).toBe(0);
    await page.emulateMedia({ media: 'screen' });

    await page.locator('[data-matrix-remove="352-937"]').click();
    await expect(page.locator('#matrix-count')).toHaveText('3 of 4 formulations selected');
    await expect(page.locator('#matrix-search')).toBeFocused();
    await page.locator('#matrix-clear').click();
    await expect(page.locator('#matrix-body')).toContainText('Build your side-by-side comparison.');
    await expect(page.locator('#matrix-export')).toBeDisabled();
  });

  test('a fifth product is refused from the product list', async ({ page }) => {
    for (const reg of ['100-1648', '7969-441', '352-937', '100-1508']) {
      await page.locator('#query').fill(reg);
      await page.locator(`[data-select="${reg}"]`).check();
    }
    await page.locator('#query').fill('42750-75');
    await page.locator('[data-select="42750-75"]').click();
    await expect(page.locator('[data-select="42750-75"]')).not.toBeChecked();
    await expect(page.locator('#toast')).toHaveText(
      'Compare up to four formulations. Remove one to add another.',
    );
  });

  test('the selection is remembered across reloads', async ({ page }) => {
    await page.locator('#query').fill('100-1508');
    await page.locator('[data-select="100-1508"]').check();
    await page.reload();
    await page.locator('.product').first().waitFor();
    await expect(page.locator('#selected-names')).toHaveText('Cruisermaxx Vibrance');
  });
});

test.describe('guides and sources', () => {
  test.beforeEach(async ({ page }) => open(page));

  test('the hero names EPA as the live source and the others as saved references', async ({
    page,
  }) => {
    await expect(page.locator('.hero-bottom')).toContainText(
      'EPA APPRIL data · saved Greenbook & CDMS references',
    );
  });

  test('hero shortcuts focus the product and ingredient searches', async ({ page }) => {
    await expect(page.locator('.hero-art')).toHaveCount(0);
    await page.locator('[data-start="ingredients"]').click();
    await expect(page.locator('#tab-ingredients')).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('#ingredient-search')).toBeFocused();
    await page.locator('[data-start="products"]').click();
    await expect(page.locator('#query')).toBeFocused();
  });

  test('ingredient guide search', async ({ page }) => {
    await page.locator('#tab-ingredients').click();
    await expect(page.locator('#ingredient-count')).toHaveText(/^\d+ ingredients$/);
    await page.locator('#ingredient-search').fill('metalaxyl');
    expect(await page.locator('#ingredient-grid .ingredient-card').count()).toBeGreaterThan(0);
    await expect(page.locator('#a11y-status')).toContainText('found.');
    await page.locator('#ingredient-grid [data-ingredient]').first().click();
    await expect(page.locator('#dialog-body')).toContainText('catalog product');
  });

  test('treatment guide, its links and the fact sheet', async ({ page }) => {
    await page.locator('#tab-guide').click();
    for (const text of ['Best management practices', 'FRAC Code List 2026', 'EPA signal words'])
      await expect(page.locator('#guide')).toContainText(text);
    for (const term of ['DANGER', 'WARNING', 'CAUTION', 'Not supplied'])
      await expect(page.locator('#guide')).toContainText(term);
    await expect(page.locator('#guide')).toContainText('Keep treated seed out of food');
    const download = page.waitForEvent('download');
    await page.locator('#guide a.guide-action').click();
    const path = await (await download).path();
    expect(readFileSync(path!).subarray(0, 4).toString()).toBe('%PDF');
    await page.locator('#guide [data-tab="ingredients"]').click();
    await expect(page.locator('#tab-ingredients')).toBeFocused();
    await expect(page.locator('#ingredients')).toBeVisible();
  });

  test('abbreviations guide (brought forward) sits in the treatment guide', async ({ page }) => {
    await page.locator('#tab-guide').click();
    await expect(page.locator('#guide #abbreviations h3')).toHaveText('Abbreviations & terms');
    await expect(page.locator('#abbreviations dt')).toHaveCount(23);
    for (const term of ['PPE', 'SDS', 'RUP'])
      await expect(page.locator('#abbreviations dt', { hasText: term })).toHaveCount(1);
  });

  for (const view of ['products', 'ingredients', 'guide', 'data'])
    test(`Print this view prints the ${view} tab with the disclaimer`, async ({ page }) => {
      await page.locator(`#tab-${view}`).click();
      // What is open at the moment of printing (then restored).
      await page.evaluate(() => {
        window.print = () => {
          (window as unknown as { printState: unknown }).printState = {
            disclaimerOpen: (document.getElementById('tool-disclaimer') as HTMLDetailsElement).open,
            labelAboutOpen: (document.querySelector('.label-about') as HTMLDetailsElement).open,
          };
        };
      });
      // Products: the Download menu; the other tabs keep a small Print this view button.
      if (view === 'products') {
        await openDownloads(page);
        await page.locator('#print-results').click();
      } else await page.locator(`#${view} .print-view`).click();
      expect(
        await page.evaluate(() => (window as unknown as { printState: unknown }).printState),
      ).toEqual({ disclaimerOpen: true, labelAboutOpen: view === 'products' });
      expect(
        await page.locator('#tool-disclaimer').evaluate((e) => (e as HTMLDetailsElement).open),
      ).toBe(false);
      // The print layout shows this view's content and hides the controls.
      await page.emulateMedia({ media: 'print' });
      const shown = (sel: string) =>
        page.evaluate((s) => {
          const el = document.querySelector(s);
          return !!el && getComputedStyle(el).display !== 'none';
        }, sel);
      const content = {
        products: '.workspace',
        ingredients: '.ingredient-grid',
        guide: '.guide-grid',
        data: '.data-grid',
      }[view]!;
      expect(await shown(`#${view}`)).toBe(true);
      expect(await shown(content)).toBe(true);
      expect(await shown('#filters')).toBe(false);
      expect(await shown('footer.disclaimer')).toBe(true);
      expect(await shown(view === 'products' ? '.download' : `#${view} .print-view`)).toBe(false);
      await page.emulateMedia({ media: 'screen' });
    });

  test('the dialog links to the treatment guide', async ({ page }) => {
    await page.locator('#query').fill('100-1508');
    await page.locator('.product-name').click();
    await page.locator('#dialog-body [data-tab="guide"]').click();
    await expect(page.locator('#dialog')).toBeHidden();
    await expect(page.locator('#guide')).toBeVisible();
    await expect(page.locator('#tab-guide')).toBeFocused();
  });

  test('data currency: EPA data date, last change and update history (no check time)', async ({
    page,
  }) => {
    await expect(page.locator('#hero-mode')).toHaveText('EPA data as of Sep 21, 2026');
    // 4a.5: no notice when all is well; the date sits by the count, details in the footer.
    await expect(page.locator('#notice')).toHaveText('');
    await expect(page.locator('#notice')).toHaveClass(/quiet-notice/);
    await expect(page.locator('.result-meta')).toHaveText('· EPA data as of Sep 21, 2026');
    await expect(page.locator('#catalog-details')).toContainText('EPA workbook loaded');
    await expect(page.locator('#catalog-details')).toContainText('Catalog last changed');
    await expect(page.locator('#catalog-details')).not.toContainText('retrieval');
    await page.locator('#tab-data').click();
    const panels = page.locator('#data-grid > article');
    await expect(panels.nth(1).locator('h3')).toHaveText('Data currency & update history');
    expect(await panels.nth(1).locator('tbody tr').count()).toBeGreaterThan(0);
    await expect(panels.nth(1)).toContainText('weekly, on Mondays at 6:30 a.m.');
    await expect(page.locator('#data')).not.toContainText('Latest official retrieval');
    await expect(page.locator('#data')).not.toContainText('daily');
    await expect(page.locator('#data')).not.toContainText('State registration');
  });

  test('about, citation and draft disclaimer (brought forward)', async ({ page }) => {
    await page.locator('#tab-data').click();
    await expect(page.locator('#data-grid > article').first().locator('h3')).toHaveText(
      'About this tool and how to use it',
    );
    await expect(page.locator('#tool-citation')).toContainText('Catalog imported Oct 19, 2026');
    await expect(page.locator('#tool-citation')).toContainText('bzbradford/whats-on-your-seed-v2');
    await expect(page.locator('footer.disclaimer')).toContainText('Educational reference only.');
    await page.locator('#tool-disclaimer > summary').click();
    await expect(page.locator('#tool-disclaimer')).toContainText('pending CPN legal review');
  });
});

test.describe('mobile', () => {
  test.use({ viewport: { width: 390, height: 844 } });
  test.beforeEach(async ({ page }) => open(page));

  test('filter drawer, focus and reflow', async ({ page }) => {
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(
      false,
    );
    await expect(page.locator('#filters')).toBeHidden();
    await page.locator('#mobile-filter').click();
    await expect(page.locator('#filters')).toBeVisible();
    await expect(page.locator('#mobile-filter')).toHaveText('Hide filters');
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(
      false,
    );
    await expect(page.locator('#filter-title')).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(page.locator('#mobile-filter')).toBeFocused();
    await expect(page.locator('#mobile-filter')).toHaveAttribute('aria-expanded', 'false');
    await page.locator('#mobile-filter').click();
    await page.locator('#apply-filters').click();
    await expect(page.locator('#count')).toBeFocused();
    await expect(page.locator('#download-menu')).toBeVisible();
    await expect(page.locator('.crop-text').first()).toBeVisible();
    await expect(page.locator('.product .label-action').first()).toBeVisible();
    await page.setViewportSize({ width: 320, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(
      false,
    );
  });

  for (const width of [390, 320])
    test(`no tab scrolls sideways at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 844 });
      for (const tab of ['products', 'matrix', 'ingredients', 'guide', 'data']) {
        await page.locator(`#tab-${tab}`).click();
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth),
          `${tab} tab page width`,
        ).toBeLessThanOrEqual(width);
      }
    });

  test('respects reduced motion', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    expect(
      await page
        .locator('.product')
        .first()
        .evaluate((e) => getComputedStyle(e).transitionDuration),
    ).toBe('0s');
  });
});

test.describe('before the catalog loads', () => {
  test('pager is hidden and exports are disabled', async ({ page }) => {
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    await freezeClock(page);
    await page.route('**/data/catalog.json', async (route) => {
      await gate;
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify(fixtureCatalog()),
      });
    });
    await page.goto('./');
    await expect(page.locator('#notice')).toHaveText('Loading the database…');
    await expect(page.locator('#pager')).toBeHidden();
    await openDownloads(page);
    await expect(page.locator('#export')).toBeDisabled();
    await expect(page.locator('#export-labels')).toBeDisabled();
    await closeMenu(page);
    release();
    await expect(page.locator('#count')).toHaveText('880 products');
    await expect(page.locator('#pager')).toBeVisible();
    await openDownloads(page);
    await expect(page.locator('#export')).toBeEnabled();
    await closeMenu(page);
  });
});

test.describe('hero and tabs (4a.4)', () => {
  test('the title is on one line and the step strip is gone', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await open(page);
    await expect(page.locator('.start-strip')).toHaveCount(0);
    const lines = await page.locator('.hero h1').evaluate((h) => {
      const r = document.createRange();
      r.selectNodeContents(h);
      return new Set([...r.getClientRects()].map((x) => Math.round(x.top))).size;
    });
    expect(lines).toBe(1);
    expect((await page.locator('.hero').boundingBox())!.height).toBeLessThan(360);
  });

  test('phones: the tabs are one row that scrolls sideways', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await open(page);
    const tops = await page
      .locator('[role=tab]')
      .evaluateAll(
        (tabs) => new Set(tabs.map((t) => Math.round(t.getBoundingClientRect().top))).size,
      );
    expect(tops).toBe(1);
    expect(await page.locator('.tabs').evaluate((e) => e.scrollWidth > e.clientWidth)).toBe(true);
    await page.locator('#tab-data').click();
    const box = (await page.locator('#tab-data').boundingBox())!;
    expect(box.x + box.width).toBeLessThanOrEqual(390);
  });

  test('?embed shows a slim banner instead of the full hero', async ({ page }) => {
    await open(page, './?embed');
    await expect(page.locator('.hero h1')).toBeVisible();
    await expect(page.locator('.hero p')).toBeHidden();
    await expect(page.locator('.hero-actions')).toBeHidden();
    expect((await page.locator('.hero').boundingBox())!.height).toBeLessThan(90);
  });
});

test.describe('hero', () => {
  for (const width of [1280, 390])
    test(`uses the full width without the removed art (${width}px)`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await open(page);
      const sizes = await page.evaluate(() => {
        const box = (s: string) => document.querySelector(s)!.getBoundingClientRect().width;
        const shell = document.querySelector('.hero .shell')!;
        const style = getComputedStyle(shell);
        return {
          inner:
            box('.hero .shell') - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight),
          copy: box('.hero-copy'),
          h1: box('.hero h1'),
        };
      });
      expect(sizes.copy).toBeCloseTo(sizes.inner, 0);
      expect(sizes.h1).toBeCloseTo(sizes.inner, 0);
    });
});

test.describe('embedding', () => {
  test('?embed hides the page header', async ({ page }) => {
    await open(page, './?embed');
    await expect(page.locator('header')).toBeHidden();
    await expect(page.locator('#count')).toHaveText('880 products');
  });

  test('works with storage blocked (cross-origin iframe)', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(window, 'localStorage', {
        get() {
          throw new DOMException('blocked', 'SecurityError');
        },
      });
    });
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await open(page);
    await page.locator('#query').fill('100-1508');
    await page.locator('[data-select="100-1508"]').check();
    await expect(page.locator('#selected-count')).toHaveText('1 of 4 products selected');
    expect(errors).toEqual([]);
  });

  test('outbound links open in a new tab', async ({ page }) => {
    await open(page);
    const sameTab = await page
      .locator('a[href^="http"]')
      .evaluateAll((links) =>
        links
          .filter((a) => a.getAttribute('target') !== '_blank')
          .map((a) => a.getAttribute('href')),
      );
    expect(sameTab).toEqual([]);
    await expect(page.locator('a.brand')).toHaveAttribute('rel', /noopener/);
  });
});

test('newer supplemental-only labeling is linked next to the full label', async ({ page }) => {
  const catalog = fixtureCatalog();
  const product = catalog.products.find((p) => p.id === labelProduct.id)!;
  const [a, b] = product.registration_number.split('-');
  const url = `https://www3.epa.gov/pesticides/chem_search/ppls/${a.padStart(6, '0')}-${b.padStart(5, '0')}-20260101.pdf`;
  Object.assign(product.safety, {
    supplemental_labels: [{ url, date: '2026-01-01', description: 'Supplemental label: new use' }],
  });
  await freezeClock(page);
  await serveFixture(page, catalog);
  await page.goto('./');
  await page.locator('#query').fill(product.id);
  await expect(page.locator('.product')).toHaveCount(1);
  const card = page.locator('.product .label-supplemental a');
  await expect(card).toHaveAttribute('href', url);
  await expect(card).toContainText('Supplemental labeling');
  await expect(page.locator('.product .label-action')).toHaveAttribute(
    'href',
    product.safety.label_url!,
  );
  await page.locator('.product-name').click();
  await expect(page.locator('#dialog-body .label-panel')).toContainText('acceptance letter');
  const item = page.locator('#dialog-body .label-supplemental-list a');
  await expect(item).toHaveAttribute('href', url);
  await expect(item).toContainText('Supplemental label: new use');
});
