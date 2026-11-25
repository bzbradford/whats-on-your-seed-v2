import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import type { Catalog, SyncStatus, UpdateHistory } from '../../src/lib/types';

const root = (path: string) => fileURLToPath(new URL('../../' + path, import.meta.url));

/**
 * The frozen pipeline fixture the legacy logic tests used (2026-10-19), so edge
 * cases stay stable as the weekly catalog changes. Returns a fresh copy each call.
 */
export function fixtureCatalog(): Catalog {
  return JSON.parse(
    gunzipSync(readFileSync(root('pipeline/tests/fixtures/catalog-2026-10-19.json.gz'))).toString(),
  ) as Catalog;
}

/** The committed, current published data. */
export function publishedCatalog(): Catalog {
  return JSON.parse(readFileSync(root('public/data/catalog.json'), 'utf8')) as Catalog;
}
export function publishedStatus(): SyncStatus {
  return JSON.parse(readFileSync(root('public/data/sync-status.json'), 'utf8')) as SyncStatus;
}
export function publishedHistory(): UpdateHistory {
  return JSON.parse(readFileSync(root('public/data/update-history.json'), 'utf8')) as UpdateHistory;
}

/** Fixture "today", matching the legacy tests' frozen clock. */
export const FIXTURE_TODAY = '2026-10-19';
