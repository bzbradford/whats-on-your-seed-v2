import { expect, type Locator, type Page, type TestInfo } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';
export const LEGACY_URL = 'http://127.0.0.1:8081/';

const dataDir = fileURLToPath(new URL('../../public/data/', import.meta.url));
const data = (file: string) => readFileSync(dataDir + file, 'utf8');

/** A fixed "now" so date defaults, captions and status checks match in both apps. */
export const FROZEN_NOW = '2026-11-26T15:00:00Z';

export const VIEWPORTS = {
  desktop: { width: 1280, height: 900 },
  mobile: { width: 390, height: 844 },
} as const;

export type App = 'legacy' | 'current';

/**
 * Open one of the two apps with the same data (public/data/*.json), a frozen
 * clock and no saved comparison. Legacy reads catalog.json / sync-status.json
 * next to its page; the new app reads data/*.json.
 */
export async function openApp(
  page: Page,
  app: App,
  opts: { catalogUnavailable?: boolean } = {},
): Promise<void> {
  await page.addInitScript((now) => {
    const RealDate = Date;
    // @ts-expect-error -- replace the global Date with a frozen-clock subclass
    globalThis.Date = class extends RealDate {
      constructor(...args: ConstructorParameters<typeof Date>) {
        super(...((args.length ? args : [now]) as [string]));
      }
      static now() {
        return new RealDate(now).getTime();
      }
    };
    try {
      localStorage.removeItem('cpn-seed-compare');
    } catch {
      /* storage blocked */
    }
  }, FROZEN_NOW);
  for (const file of ['catalog.json', 'sync-status.json', 'update-history.json']) {
    await page.route(`**/${file}`, (route) =>
      opts.catalogUnavailable && file === 'catalog.json'
        ? route.fulfill({ status: 404, body: 'Not found' })
        : route.fulfill({ contentType: 'application/json', body: data(file) }),
    );
  }
  await page.goto(app === 'legacy' ? LEGACY_URL : '/');
  await page
    .locator(opts.catalogUnavailable ? '#results .empty' : '.product')
    .first()
    .waitFor();
}

export interface ShotOptions {
  /** Element to capture instead of the full page. */
  target?: (page: Page) => Locator;
  /** Regions painted over in both screenshots (intentional deviations). */
  mask?: (page: Page) => Locator[];
  fullPage?: boolean;
}

export async function shoot(page: Page, opts: ShotOptions = {}): Promise<Buffer> {
  // Let fonts, images and the 250 ms announcement debounce settle.
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);
  const mask = opts.mask?.(page) ?? [];
  const common = {
    animations: 'disabled' as const,
    caret: 'hide' as const,
    mask,
    maskColor: '#ff00ff',
  };
  return opts.target
    ? opts.target(page).screenshot(common)
    : page.screenshot({ ...common, fullPage: opts.fullPage ?? true });
}

/**
 * Compare legacy (expected) and current screenshots pixel by pixel. Both images and
 * a diff are attached to the report. Fails if the sizes differ or more than
 * `maxDiffPixels` pixels differ beyond pixelmatch's colour threshold (an absolute
 * count, so a stray glyph on a tall page still fails).
 */
export async function expectSameImage(
  testInfo: TestInfo,
  name: string,
  legacy: Buffer,
  current: Buffer,
  maxDiffPixels = 25,
): Promise<void> {
  // Also keep the files next to the test output for quick inspection.
  writeFileSync(testInfo.outputPath(`${name}-legacy.png`), legacy);
  writeFileSync(testInfo.outputPath(`${name}-current.png`), current);
  const a = PNG.sync.read(legacy);
  const b = PNG.sync.read(current);
  await testInfo.attach(`${name}-legacy.png`, { body: legacy, contentType: 'image/png' });
  await testInfo.attach(`${name}-current.png`, { body: current, contentType: 'image/png' });
  expect
    .soft({ width: b.width, height: b.height }, `${name}: image size`)
    .toEqual({ width: a.width, height: a.height });
  if (a.width !== b.width || a.height !== b.height) return;
  const diff = new PNG({ width: a.width, height: a.height });
  const changed = pixelmatch(a.data, b.data, diff.data, a.width, a.height, { threshold: 0.1 });
  const diffPng = PNG.sync.write(diff);
  writeFileSync(testInfo.outputPath(`${name}-diff.png`), diffPng);
  await testInfo.attach(`${name}-diff.png`, { body: diffPng, contentType: 'image/png' });
  writeFileSync(testInfo.outputPath(`${name}-diff.txt`), `${changed} ${a.width}x${a.height}\n`);
  expect.soft(changed, `${name}: differing pixels`).toBeLessThanOrEqual(maxDiffPixels);
}
