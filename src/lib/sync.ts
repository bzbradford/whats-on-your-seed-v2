// Refreshing the published catalog (initial load on Pages, and the five-minute poll
// in both builds, as legacy did). Framework-free; app-state applies the results.

import { fetchJson, parseCatalog, parseSyncStatus, parseUpdateHistory } from './catalog';
import { sanitizeSelection } from './compare';
import { categoryOptions, keepValidSelections, type Filters } from './filters';
import { localDate } from './format';
import type { Catalog, SyncStatus, UpdateHistory } from './types';

export interface PollResult {
  /** Validated published catalog, or null if it couldn't be fetched/validated. */
  catalog: Catalog | null;
  status: SyncStatus | null;
  history: UpdateHistory | null;
}

/** Fetch catalog, status and history; each fails independently. */
export async function fetchPublished(
  base: string,
  fetchFn: typeof fetch = fetch,
): Promise<PollResult> {
  const settle = async <T>(file: string, parse: (raw: unknown) => T): Promise<T | null> => {
    try {
      return parse(await fetchJson(base + file, fetchFn));
    } catch {
      return null;
    }
  };
  const [catalog, status, history] = await Promise.all([
    settle('catalog.json', parseCatalog),
    settle('sync-status.json', parseSyncStatus),
    settle('update-history.json', parseUpdateHistory),
  ]);
  return { catalog, status, history };
}

/** Fetch the small status and history files only (the regular poll). */
export async function fetchStatus(
  base: string,
  fetchFn: typeof fetch = fetch,
): Promise<Pick<PollResult, 'status' | 'history'>> {
  const [status, history] = await Promise.all([
    fetchJson(base + 'sync-status.json', fetchFn)
      .then(parseSyncStatus)
      .catch(() => null),
    fetchJson(base + 'update-history.json', fetchFn)
      .then(parseUpdateHistory)
      .catch(() => null),
  ]);
  return { status, history };
}

/** Fetch and validate the catalog alone, or null. */
export async function fetchCatalogOrNull(
  base: string,
  fetchFn: typeof fetch = fetch,
): Promise<Catalog | null> {
  try {
    return parseCatalog(await fetchJson(base + 'catalog.json', fetchFn));
  } catch {
    return null;
  }
}

/**
 * Whether `next` describes a different publication than the one the displayed catalog
 * came from (`known`; null when unknown). The pipeline rewrites sync-status.json
 * whenever it publishes a catalog, so an unchanged status means an unchanged catalog.
 */
export function publicationChanged(known: SyncStatus | null, next: SyncStatus): boolean {
  return (
    !known ||
    next.last_publication_at !== known.last_publication_at ||
    next.workbook_sha256 !== known.workbook_sha256 ||
    next.checked_at !== known.checked_at
  );
}

/** A different catalog version: new sync time or new workbook hash. */
export function catalogChanged(current: Catalog | null, next: Catalog): boolean {
  return (
    !current?.products.length ||
    next.meta.last_successful_sync !== current.meta.last_successful_sync ||
    next.meta.audit?.sha256 !== current.meta.audit?.sha256
  );
}

/**
 * Carry the user's filters and comparison over to a newer catalog: an end date
 * that was following the import cutoff moves to today, select values that no
 * longer exist are cleared, and removed products leave the comparison.
 */
export function carryOver(
  previous: Catalog,
  next: Catalog,
  filters: Filters,
  selected: readonly string[],
  today = localDate(),
): { filters: Filters; selected: string[] } {
  const followToday = filters.end === previous.meta.status_date_end;
  const kept = keepValidSelections(filters, categoryOptions(next));
  return {
    filters: { ...kept, end: followToday ? today : filters.end },
    selected: sanitizeSelection([...selected], next.products),
  };
}
