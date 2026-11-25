import type { Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';

const root = (path: string) => fileURLToPath(new URL('../../' + path, import.meta.url));

/** The frozen 2026-10-19 pipeline fixture the legacy UI tests used (stable counts). */
export function fixtureCatalog() {
  const c = JSON.parse(
    gunzipSync(readFileSync(root('pipeline/tests/fixtures/catalog-2026-10-19.json.gz'))).toString(),
  );
  c.mode = 'live';
  return c as {
    mode: string;
    products: {
      id: string;
      name: string;
      registration_number: string;
      record_type: string;
      safety: { label_url?: string | null };
    }[];
    meta: Record<string, unknown>;
  };
}

export function publishedJson(file: string): unknown {
  return JSON.parse(readFileSync(root('public/data/' + file), 'utf8'));
}

/** Freeze the clock (legacy ui_test used 2026-10-19 noon UTC). */
export async function freezeClock(page: Page, now = '2026-10-19T12:00:00Z') {
  await page.addInitScript((iso) => {
    const RealDate = Date;
    // @ts-expect-error -- replace the global Date with a frozen-clock subclass
    globalThis.Date = class extends RealDate {
      constructor(...args: ConstructorParameters<typeof Date>) {
        super(...((args.length ? args : [iso]) as [string]));
      }
      static now() {
        return new RealDate(iso).getTime();
      }
    };
  }, now);
}

/** Serve the fixture catalog plus the current status/history to the Pages build. */
export async function serveFixture(page: Page, catalog: unknown = fixtureCatalog()) {
  await page.route('**/data/catalog.json', (route) =>
    route.fulfill({ contentType: 'application/json', body: JSON.stringify(catalog) }),
  );
}
