// Visual parity: the legacy app (legacy/static, the reference) and the new app are
// opened side by side with the same catalog, clock and viewport, driven through the
// same steps, and their screenshots compared pixel by pixel (legacy = expected).
//
// Masked regions are intentional deviations (PLAN.md Phase 3, "Data currency"):
// the catalog summary shows "EPA data as of" / "Catalog last changed" instead of
// legacy's "Catalog updated" / "EPA workbook created" labels.

import { test, type Page } from '@playwright/test';
import {
  VIEWPORTS,
  expectSameImage,
  openApp,
  shoot,
  type App,
  type ShotOptions,
} from './parity-helpers';

interface Scenario {
  name: string;
  steps?: (page: Page, app: App) => Promise<void>;
  shot?: ShotOptions;
  catalogUnavailable?: boolean;
  /** Viewports to check (default: both). */
  only?: (keyof typeof VIEWPORTS)[];
}

const summaryMask = (page: Page) => [page.locator('#catalog-summary')];

async function search(page: Page, text: string) {
  await page.locator('#query').fill(text);
}

async function selectForComparison(page: Page, registration: string) {
  await search(page, registration);
  await page.locator(`[data-select="${registration}"]`).check();
}

async function openDetails(page: Page, id: string) {
  await page.locator(`#${id} > summary`).click();
}

const scenarios: Scenario[] = [
  { name: 'products-initial', shot: { mask: summaryMask } },
  { name: 'catalog-unavailable', catalogUnavailable: true, only: ['desktop'] },
  {
    name: 'products-search',
    steps: (page) => search(page, 'metalaxyl'),
    shot: { mask: summaryMask },
  },
  {
    name: 'products-filtered',
    steps: async (page) => {
      await page.locator('.site-picker summary').click();
      await page.getByRole('checkbox', { name: 'Soybeans (seed treatment)', exact: true }).check();
      await page.locator('#purpose').selectOption('Nematicide');
      await page.locator('#mobile-filter').click();
      await page.locator('#technology').selectOption('Conventional Chemical');
    },
    shot: { mask: summaryMask },
  },
  {
    name: 'products-no-results',
    steps: (page) => search(page, 'no-such-product-xyz'),
    shot: { mask: summaryMask },
    only: ['desktop'],
  },
  {
    name: 'product-dialog',
    steps: async (page) => {
      await search(page, '100-1508');
      await page.locator('[data-detail="100-1508"]').click();
      await page.locator('#dialog[open]').waitFor();
    },
    shot: { fullPage: false },
  },
  {
    name: 'ingredient-dialog',
    steps: async (page) => {
      await search(page, '100-1508');
      await page.locator('.ingredient-pill[data-ingredient="Sedaxane"]').click();
      await page.locator('#dialog[open]').waitFor();
    },
    shot: { fullPage: false },
    only: ['desktop'],
  },
  {
    name: 'compare-bar',
    steps: async (page) => {
      await selectForComparison(page, '100-1648');
      await selectForComparison(page, '7969-441');
      await search(page, '');
    },
    shot: { fullPage: false },
  },
  {
    name: 'matrix-two-products',
    steps: async (page) => {
      await selectForComparison(page, '100-1648');
      await selectForComparison(page, '7969-441');
      await page.locator('#compare').click();
      await page.locator('#matrix-body .matrix-table').waitFor();
    },
    shot: { mask: summaryMask },
  },
  {
    name: 'matrix-empty',
    steps: (page) => page.locator('#tab-matrix').click(),
    shot: { mask: summaryMask },
    only: ['desktop'],
  },
  {
    name: 'ingredient-guide',
    steps: async (page) => {
      await page.locator('#tab-resources').click();
      await openDetails(page, 'ingredient-guide');
    },
    shot: { mask: summaryMask },
  },
  {
    name: 'guides',
    steps: async (page) => {
      await page.locator('#tab-resources').click();
      for (const id of [
        'seed-abbreviations',
        'treatment-guide',
        'warning-guide',
        'handling-guide',
        'guide-references',
      ])
        await openDetails(page, id);
      await openDetails(page, 'tool-disclaimer');
    },
    shot: { mask: summaryMask },
  },
];

// Sources, coverage & updates: the first panel ("Automatic source checks" in legacy,
// "Data currency & update history" now) and the "Automatic EPA updates" panel
// (daily -> weekly schedule wording) are intentional deviations. Both are hidden in
// both apps so the remaining panels line up, then the grid is compared as one image.
// In "Source dates & connections" legacy's "Latest official retrieval" row became
// "Catalog last changed" (masked).
const DEVIATED_PANELS = '#data-grid > article:nth-child(1), #data-grid > article:nth-child(7)';

for (const [viewport, size] of Object.entries(VIEWPORTS) as [
  keyof typeof VIEWPORTS,
  { width: number; height: number },
][]) {
  test.describe(`parity ${viewport}`, () => {
    test.use({ viewport: size });

    for (const s of scenarios.filter((x) => !x.only || x.only.includes(viewport))) {
      test(s.name, async ({ browser }, testInfo) => {
        const shots: Record<App, Buffer> = {} as Record<App, Buffer>;
        for (const app of ['legacy', 'current'] as App[]) {
          const context = await browser.newContext({ viewport: size });
          const page = await context.newPage();
          await openApp(page, app, { catalogUnavailable: s.catalogUnavailable });
          await s.steps?.(page, app);
          shots[app] = await shoot(page, s.shot);
          await context.close();
        }
        await expectSameImage(testInfo, `${viewport}-${s.name}`, shots.legacy, shots.current);
      });
    }

    test('sources panels', async ({ browser }, testInfo) => {
      const shots = {} as Record<App, Buffer>;
      for (const app of ['legacy', 'current'] as App[]) {
        const context = await browser.newContext({ viewport: size });
        const page = await context.newPage();
        await openApp(page, app);
        await page.locator('#tab-resources').click();
        await openDetails(page, 'source-guide');
        await page.addStyleTag({ content: `${DEVIATED_PANELS} { display: none !important; }` });
        const dates = page.locator('#data-grid > article').nth(2);
        shots[app] = await shoot(page, {
          target: (p) => p.locator('#data-grid'),
          mask: () => [dates.locator('dt').nth(3), dates.locator('dd').nth(3)],
        });
        await context.close();
      }
      await expectSameImage(testInfo, `${viewport}-sources-panels`, shots.legacy, shots.current);
    });
  });
}
