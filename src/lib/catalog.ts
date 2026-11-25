import type { Catalog, SyncStatus, UpdateHistory } from './types';

export class CatalogError extends Error {}

const strings = (values: unknown): values is string[] =>
  Array.isArray(values) && values.every((x) => typeof x === 'string');
const isObject = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null;
const validDate = (x: unknown) => typeof x === 'string' && Number.isFinite(Date.parse(x));

/**
 * Validate a published catalog before it can replace the displayed one (the
 * legacy `publishedCatalog` checks): known mode, non-empty products with the
 * fields the UI relies on, unique ids, scope sites and an ingredient reference.
 */
export function parseCatalog(raw: unknown): Catalog {
  if (!isObject(raw)) throw new CatalogError('Catalog is not an object');
  const c = raw;
  const meta = c.meta;
  const scope = c.scope;
  if (
    !['live', 'snapshot'].includes(c.mode as string) ||
    !Array.isArray(c.products) ||
    !c.products.length ||
    !isObject(meta) ||
    !validDate(meta.last_successful_sync) ||
    !isObject(scope) ||
    !strings(scope.sites) ||
    !scope.sites.length ||
    !isObject(c.ingredient_reference)
  )
    throw new CatalogError('Invalid published catalog');
  const products = c.products as unknown[];
  if (
    !products.every(
      (p) =>
        isObject(p) &&
        ['id', 'registration_number', 'name', 'registrant'].every(
          (key) => typeof p[key] === 'string',
        ) &&
        strings(p.sites) &&
        strings(p.purposes) &&
        Array.isArray(p.ingredients) &&
        p.ingredients.every((a: unknown) => isObject(a) && typeof a.name === 'string'),
    ) ||
    new Set(products.map((p) => (p as { id: string }).id)).size !== products.length
  )
    throw new CatalogError('Invalid published products');
  return raw as unknown as Catalog;
}

/** Validate sync-status.json (legacy `refreshSyncStatus` checks). */
export function parseSyncStatus(raw: unknown): SyncStatus {
  if (
    !isObject(raw) ||
    !['success', 'failed'].includes(raw.state as string) ||
    !isObject(raw.sources) ||
    !raw.sources.EPA ||
    ['EPA', 'Greenbook', 'CDMS'].some((name) => {
      const value = (raw.sources as Record<string, { checked_at?: unknown } | undefined>)[name]
        ?.checked_at;
      return value != null && !validDate(value);
    })
  )
    throw new CatalogError('Invalid update status');
  return raw as unknown as SyncStatus;
}

export function parseUpdateHistory(raw: unknown): UpdateHistory {
  if (!isObject(raw) || !Array.isArray(raw.updates))
    throw new CatalogError('Invalid update history');
  return raw as unknown as UpdateHistory;
}

/** Fetch JSON with a 15 s timeout. `no-cache` revalidates, so unchanged files cost a 304. */
export async function fetchJson(
  url: string,
  fetchFn: typeof fetch = fetch,
  timeoutMs = 15000,
): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchFn(url, { cache: 'no-cache', signal: controller.signal });
    if (!res.ok) throw new CatalogError(`Request failed: ${res.status} ${res.statusText}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

/** Fetch and validate a catalog JSON file. `fetchFn` is injectable for tests. */
export async function fetchCatalog(url: string, fetchFn: typeof fetch = fetch): Promise<Catalog> {
  return parseCatalog(await fetchJson(url, fetchFn));
}

export interface EmbeddedData {
  catalog: Catalog;
  status: SyncStatus | null;
  history: UpdateHistory | null;
}

/**
 * The snapshot built into the standalone file. MODE is replaced at build time, so
 * the Pages bundle drops this branch and doesn't contain the data.
 */
export async function loadEmbedded(): Promise<EmbeddedData | null> {
  if (import.meta.env.MODE !== 'standalone') return null;
  const [catalog, status, history] = await Promise.all([
    import('$data/catalog.json?raw'),
    import('$data/sync-status.json?raw'),
    import('$data/update-history.json?raw'),
  ]);
  const data = parseCatalog(JSON.parse(catalog.default));
  // As in the legacy download: mark the embedded copy as a snapshot.
  data.mode = 'snapshot';
  return {
    catalog: data,
    status: parseSyncStatus(JSON.parse(status.default)),
    history: parseUpdateHistory(JSON.parse(history.default)),
  };
}

/** Base URL of the published data files for this build. */
export function dataBase(standalone: boolean, publishedUrl: string, baseUrl: string): string {
  return standalone ? publishedUrl : `${baseUrl}data/`;
}
