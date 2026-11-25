import type { Catalog } from './types';

export class CatalogError extends Error {}

/** Check the minimum structure the app relies on and return a typed catalog. */
export function parseCatalog(raw: unknown): Catalog {
  if (typeof raw !== 'object' || raw === null) throw new CatalogError('Catalog is not an object');
  const c = raw as Record<string, unknown>;
  if (!Array.isArray(c.products)) throw new CatalogError('Catalog has no products array');
  if (typeof c.meta !== 'object' || c.meta === null) throw new CatalogError('Catalog has no meta');
  return raw as Catalog;
}

/** Fetch and parse a catalog JSON file. `fetchFn` is injectable for tests. */
export async function fetchCatalog(url: string, fetchFn: typeof fetch = fetch): Promise<Catalog> {
  const res = await fetchFn(url, { cache: 'no-cache' });
  if (!res.ok) throw new CatalogError(`Catalog request failed: ${res.status} ${res.statusText}`);
  return parseCatalog(await res.json());
}

/**
 * Load the catalog for the current build. The standalone build inlines the JSON
 * (MODE is replaced at build time, so the Pages build drops this branch and the
 * Pages bundle doesn't contain the data).
 */
export async function loadCatalog(): Promise<Catalog> {
  if (import.meta.env.MODE === 'standalone') {
    const { default: text } = await import('$data/catalog.json?raw');
    return parseCatalog(JSON.parse(text));
  }
  return fetchCatalog(`${import.meta.env.BASE_URL}data/catalog.json`);
}
