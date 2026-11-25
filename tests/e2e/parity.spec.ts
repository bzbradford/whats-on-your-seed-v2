// Visual parity: the legacy reference (legacy/static, the Oct 19 UI, upstream 435c0bf)
// and the new app are opened side by side with the same catalog, clock and viewport,
// driven through the same steps, and their screenshots compared pixel by pixel
// (legacy = expected).
//
// What is hidden or masked, and why (all listed in PLAN.md Phase 3b):
// - Removed by user decision, so hidden in the reference only: the decorative hero art
//   (.hero-art), the state registration UI (filter, matrix selector, matrix rows,
//   dialog panel, coverage panel).
// - Intentional deviations, masked in both when they keep their size, hidden in both
//   when they don't: the hero data line (#hero-mode: "EPA data as of"), the notice
//   (catalog last changed instead of a check time), the footer (master-era disclaimer),
//   the no-results note (no state filter to point at), the matrix's last section title,
//   and the Sources & updates panels that were replaced, reworded or brought forward.

import { test, type Page } from '@playwright/test';
import {
  VIEWPORTS,
  expectSameImage,
  openApp,
  shoot,
  type App,
  type ShotOptions,
} from './parity-helpers';

/** Hidden in the reference only: features the port deliberately leaves out. */
const LEGACY_REMOVED = [
  '.hero-art',
  '.state-filters',
  '.matrix-controls > label:has(#matrix-state)',
  // statePanel(p): the only dialog panel with an inline margin style
  '#dialog-body > section.panel[style]',
];

/** Hidden in both apps: deviations whose size differs from the reference. */
const BOTH_HIDDEN = ['#notice', 'footer.disclaimer'];

const STATE_MATRIX_ROWS = [
  'State-authority registration reports',
  'Provider availability reports: Yes',
  'Selected state / jurisdiction',
  'State evidence sources',
];

async function prepare(page: Page, app: App, extraHidden: string[] = []) {
  const hidden = [...BOTH_HIDDEN, ...extraHidden, ...(app === 'legacy' ? LEGACY_REMOVED : [])];
  // #hero-mode's text differs (masked); a fixed width keeps the masked boxes the same size.
  await page.addStyleTag({
    content: `${hidden.join(',\n')} { display: none !important; }
      #hero-mode { width: 16rem; }`,
  });
}

/** The reference's matrix has a state-evidence row group; drop those rows before shooting. */
async function removeLegacyStateRows(page: Page) {
  await page.evaluate((labels) => {
    for (const th of document.querySelectorAll('.matrix-table tbody th[scope=row]'))
      if (labels.includes(th.textContent ?? '')) th.closest('tr')?.remove();
  }, STATE_MATRIX_ROWS);
}

interface Scenario {
  name: string;
  steps?: (page: Page, app: App) => Promise<void>;
  shot?: ShotOptions;
  /** Extra selectors hidden in both apps for this state. */
  hide?: string[];
  catalogUnavailable?: boolean;
  /** Viewports to check (default: both). */
  only?: (keyof typeof VIEWPORTS)[];
}

const heroMask = (page: Page) => [page.locator('#hero-mode')];

async function search(page: Page, text: string) {
  await page.locator('#query').fill(text);
}

async function selectForComparison(page: Page, registration: string) {
  await search(page, registration);
  await page.locator(`[data-select="${registration}"]`).check();
}

async function openTab(page: Page, id: string) {
  await page.locator(`#tab-${id}`).click();
}

const scenarios: Scenario[] = [
  { name: 'products-initial', shot: { mask: heroMask } },
  {
    name: 'catalog-unavailable',
    catalogUnavailable: true,
    hide: ['#results .empty p'],
    only: ['desktop'],
  },
  {
    name: 'products-search',
    steps: (page) => search(page, 'metalaxyl'),
    shot: { mask: heroMask },
  },
  {
    name: 'products-filtered',
    steps: async (page) => {
      // The filter panel is a drawer only at mobile widths.
      if (await page.locator('#mobile-filter').isVisible())
        await page.locator('#mobile-filter').click();
      await page.locator('.site-picker summary').click();
      await page.getByRole('checkbox', { name: 'Soybeans (seed treatment)', exact: true }).check();
      await page.locator('#purpose').selectOption('Nematicide');
      await page.locator('#technology').selectOption('Conventional Chemical');
      await page.locator('.record-filters summary').click();
    },
    shot: { mask: heroMask },
  },
  {
    name: 'products-no-results',
    steps: (page) => search(page, 'no-such-product-xyz'),
    hide: ['#results .empty p.small'],
    shot: { mask: heroMask },
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
    steps: async (page, app) => {
      await selectForComparison(page, '100-1648');
      await selectForComparison(page, '7969-441');
      await page.locator('#compare').click();
      await page.locator('#matrix-body .matrix-table').waitFor();
      if (app === 'legacy') await removeLegacyStateRows(page);
    },
    // Legacy titles the last row group "State evidence & provenance"; without the state
    // rows it is "Sources & provenance" here.
    shot: {
      mask: (page) => [...heroMask(page), page.locator('.matrix-section th').last()],
    },
  },
  {
    name: 'matrix-empty',
    steps: (page) => openTab(page, 'matrix'),
    shot: { mask: heroMask },
    only: ['desktop'],
  },
  {
    name: 'ingredient-guide',
    steps: (page) => openTab(page, 'ingredients'),
    shot: { mask: heroMask },
  },
  {
    name: 'ingredient-search',
    steps: async (page) => {
      await openTab(page, 'ingredients');
      await page.locator('#ingredient-search').fill('metalaxyl');
    },
    shot: { mask: heroMask },
    only: ['desktop'],
  },
  {
    name: 'treatment-guide',
    steps: (page) => openTab(page, 'guide'),
    shot: { mask: heroMask },
  },
];

// Sources & updates. Hidden in both: the data-currency panel (replaces "Automatic source
// checks"), "Automatic EPA updates" (weekly wording), and the brought-forward About and
// citation panels (new here). Hidden in the reference: its state coverage panel. In
// "Source dates & connections" the "Latest official retrieval" row became "Catalog last
// changed" (masked), and its "Automatic updates" value uses the master-era wording (masked).
const DATA_HIDDEN: Record<App, string[]> = {
  legacy: [1, 5, 8].map((n) => `#data-grid > article:nth-child(${n})`),
  current: [1, 2, 8, 10].map((n) => `#data-grid > article:nth-child(${n})`),
};

for (const [viewport, size] of Object.entries(VIEWPORTS) as [
  keyof typeof VIEWPORTS,
  { width: number; height: number },
][]) {
  test.describe(`parity ${viewport}`, () => {
    test.use({ viewport: size });

    for (const s of scenarios.filter((x) => !x.only || x.only.includes(viewport))) {
      test(s.name, async ({ browser }, testInfo) => {
        const shots = {} as Record<App, Buffer>;
        for (const app of ['legacy', 'current'] as App[]) {
          const context = await browser.newContext({ viewport: size });
          const page = await context.newPage();
          await openApp(page, app, { catalogUnavailable: s.catalogUnavailable });
          await prepare(page, app, s.hide);
          await s.steps?.(page, app);
          shots[app] = await shoot(page, s.shot);
          await context.close();
        }
        await expectSameImage(testInfo, `${viewport}-${s.name}`, shots.legacy, shots.current);
      });
    }

    test('sources-and-updates', async ({ browser }, testInfo) => {
      const shots = {} as Record<App, Buffer>;
      for (const app of ['legacy', 'current'] as App[]) {
        const context = await browser.newContext({ viewport: size });
        const page = await context.newPage();
        await openApp(page, app);
        await prepare(page, app, DATA_HIDDEN[app]);
        await openTab(page, 'data');
        const dates = page.locator('#data-grid > article:visible').nth(1);
        shots[app] = await shoot(page, {
          mask: (p) => [
            ...heroMask(p),
            dates.locator('dt').nth(3),
            dates.locator('dd').nth(3),
            dates.locator('dd').nth(6),
          ],
        });
        await context.close();
      }
      await expectSameImage(
        testInfo,
        `${viewport}-sources-and-updates`,
        shots.legacy,
        shots.current,
      );
    });
  });
}
