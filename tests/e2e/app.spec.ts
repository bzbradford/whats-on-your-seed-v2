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
    await expect(page.locator('#applied')).toHaveText('Barley');
    await page.locator('#reset').click();
    await expect(page.locator('#count')).toHaveText('880 products');
    await page.locator('#technology').selectOption('Plant-Incorp. Protectant');
    await expect(page.locator('#count')).toHaveText('85 products');
    await page.locator('#reset').click();
    await page.locator('.record-filters summary').click();
    await page.locator('#quality').selectOption('base-linked');
    await expect(page.locator('#count')).toHaveText('185 products');
    await page.locator('#reset').click();
    await page.getByText('Groups & EPA hazards', { exact: true }).click();
    await page.locator('#signal').selectOption('NONE');
    await expect(page.locator('#count')).toHaveText('25 products');
    await page.locator('#signal').selectOption('NOT_SUPPLIED');
    await expect(page.locator('#count')).toHaveText('187 products');
    await page.locator('#reset').click();
    await page.locator('#rup').selectOption('yes');
    await expect(page.locator('#count')).toHaveText('19 products');
    // Oct 19 cards show a restricted-use badge only when the flag is Yes.
    await expect(page.locator('.product').first().locator('.safety-badge.warning')).toHaveText(
      'Restricted-use flag: Yes',
    );
    await page.locator('#rup').selectOption('no');
    await expect(page.locator('.product .safety-badge', { hasText: 'Restricted-use' })).toHaveCount(
      0,
    );
    // User decision: no state registration UI.
    await expect(page.locator('#state, #state-status, #state-help, #matrix-state')).toHaveCount(0);
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
    await expect(page.locator('#export-labels')).toBeDisabled();
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
    await expect(page.locator('#export-labels')).toBeDisabled();
    await page.locator('[data-reset]').click();
    await expect(page.locator('#count')).toHaveText('880 products');
    await expect(page.locator('#query')).toBeFocused();
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
    await expect(page.locator('.product .label-meta')).toContainText('5905-491-38167');
  });

  test('exports: label links (filtered and all) and results CSV', async ({ page }) => {
    await page.locator('#query').fill('5905-491-38167');
    await expect(page.locator('#export')).toHaveText('Export results');
    await expect(page.locator('#export-labels')).toHaveText('Export label links');
    const filtered = await downloadText(page, () => page.locator('#export-labels').click());
    expect(filtered.split('\r\n')).toHaveLength(2);
    expect(filtered).toContain('Lookup required');
    await expect(page.locator('#toast')).toContainText('1 products exported in the label-link CSV');
    await page.locator('#reset').click();
    const all = await downloadText(page, () => page.locator('#export-labels').click());
    expect(all.split('\r\n')).toHaveLength(fixture.products.length + 1);
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
      await page.emulateMedia({ media: 'print' });
      const printed = await page.evaluate((id) => {
        let state: Record<string, unknown> = {};
        const shown = (sel: string) => {
          const el = document.querySelector(sel);
          return !!el && getComputedStyle(el).display !== 'none';
        };
        window.print = () => {
          state = {
            panel: shown(`#${id}`),
            content: shown(
              {
                products: '.workspace',
                ingredients: '.ingredient-grid',
                guide: '.guide-grid',
                data: '.data-grid',
              }[id]!,
            ),
            filters: shown('#filters'),
            footer: shown('footer.disclaimer'),
            disclaimerOpen: (document.getElementById('tool-disclaimer') as HTMLDetailsElement).open,
            button: shown(`#${id} .print-view`),
          };
        };
        (document.querySelector(`#${id} .print-view`) as HTMLButtonElement).click();
        return state;
      }, view);
      expect(printed).toEqual({
        panel: true,
        content: true,
        filters: false,
        footer: true,
        disclaimerOpen: true,
        button: false,
      });
      expect(
        await page.locator('#tool-disclaimer').evaluate((e) => (e as HTMLDetailsElement).open),
      ).toBe(false);
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
    await expect(page.locator('#notice')).toContainText('EPA workbook loaded');
    await expect(page.locator('#notice')).toContainText('Catalog last changed');
    await expect(page.locator('#notice')).not.toContainText('retrieval');
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
    await expect(page.locator('#export')).toBeVisible();
    await expect(page.locator('#export-labels')).toBeVisible();
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
  test('?embed hides the page header and hero', async ({ page }) => {
    await open(page, './?embed');
    await expect(page.locator('header')).toBeHidden();
    await expect(page.locator('.hero')).toBeHidden();
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
    // The CPN logo link in the page header (hidden in ?embed) is the one exception, as in legacy.
    expect(sameTab).toEqual(['https://cropprotectionnetwork.org/']);
  });
});
