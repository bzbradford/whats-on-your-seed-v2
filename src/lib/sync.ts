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
