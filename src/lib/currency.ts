// Data currency: catalog dates, update history, status notices and citation text.
//
// Intentional deviation from legacy (PLAN.md Phase 3): the weekly job commits only
// when the catalog changes, so there is no record of the last EPA *check*. We show
// "EPA data as of" (workbook creation date) and "catalog last changed"
// (sync-status `last_publication_at`) plus the update history, and drop legacy's
// "last EPA retrieval" date and its "EPA check not verified" / 48-hour overdue warnings.

import { fmt } from './format';
import type { Catalog, SyncStatus, UpdateHistoryEntry } from './types';

export const REPOSITORY_URL = 'https://github.com/bzbradford/whats-on-your-seed-v2';
export const UPDATE_WORKFLOW_URL = REPOSITORY_URL + '/actions/workflows/data-update.yml';
/** Published data the standalone file polls (the Pages build reads its own data/). */
export const PUBLISHED_DATA_URL = 'https://bzbradford.github.io/whats-on-your-seed-v2/data/';
export const POLL_INTERVAL_MS = 5 * 60 * 1000;

export interface SyncFlags {
  /** Standalone file showing its built-in snapshot (no published catalog loaded yet). */
  usingEmbeddedSnapshot: boolean;
  catalogPollFailed: boolean;
  statusPollFailed: boolean;
}

export interface Warning {
  title: string;
  message: string;
}

/** Notice shown instead of the data note when published data couldn't be refreshed. */
export function updateWarning(flags: SyncFlags, status: SyncStatus | null): Warning | null {
  if (flags.usingEmbeddedSnapshot)
    return flags.catalogPollFailed
      ? {
          title: 'Offline snapshot displayed.',
          message:
            'The published catalog could not be retrieved. This file is showing its embedded snapshot and will retry automatically when online.',
        }
      : null;
  if (flags.catalogPollFailed || flags.statusPollFailed)
    return {
      title: 'Published updates unavailable.',
      message:
        'The latest ' +
        (flags.catalogPollFailed && flags.statusPollFailed
          ? 'catalog and update status'
          : flags.catalogPollFailed
            ? 'catalog'
            : 'update status') +
        ' could not be retrieved. The displayed catalog is retained; the tool will retry automatically.',
    };
  if (status?.state === 'failed')
    return {
      title: 'EPA update failed.',
      message:
        'The last successfully imported catalog is retained. See Guides & sources for update details.',
    };
  return null;
}

/** Date the EPA data describes: the APPRIL workbook's creation date. */
export function epaDataAsOf(catalog: Catalog): string | undefined {
  return catalog.meta.source_snapshot_date;
}

/** When the published catalog last changed (falls back to the catalog's own import time). */
export function catalogLastChanged(
  catalog: Catalog,
  status: SyncStatus | null,
): string | undefined {
  return (
    status?.last_publication_at || catalog.meta.imported_at || catalog.meta.last_successful_sync
  );
}

export function importedAt(catalog: Catalog): string | undefined {
  return catalog.meta.imported_at || catalog.meta.last_successful_sync;
}

/**
 * The Oct 19 "EPA workbook loaded" notice. Deviation: legacy's "Last official workbook
 * retrieval" sentence (a check time) is replaced by when the catalog last changed, and
 * the standalone's "fixed snapshot" sentence by the master-era embedded-snapshot note.
 */
export function loadedNotice(
  catalog: Catalog,
  status: SyncStatus | null,
  usingEmbeddedSnapshot: boolean,
): Warning {
  const m = catalog.meta;
  const missing = m.audit?.missing_formulation_products;
  return {
    title: 'EPA workbook loaded',
    message:
      `${catalog.products.length.toLocaleString()} active registrations from the supplied export, created ${fmt(m.source_snapshot_date)}. Imported ${fmt(importedAt(catalog))}. ` +
      `Catalog last changed ${fmt(catalogLastChanged(catalog, status))}. ` +
      (usingEmbeddedSnapshot ? 'This file is showing its embedded snapshot. ' : '') +
      (missing ? missing + ' records lack ingredients and need an exclusion check.' : ''),
  };
}

/** The hero's data line (`#hero-mode`). Deviation: "EPA data as of" replaces "EPA workbook created". */
export function heroModeText(
  loadState: 'loading' | 'ready' | 'unavailable',
  catalog: Catalog,
): string {
  return loadState === 'loading'
    ? 'Connecting to catalog…'
    : loadState === 'unavailable'
      ? 'Live data not connected'
      : 'EPA data as of ' + fmt(epaDataAsOf(catalog));
}

export function aboutDatesText(catalog: Catalog, status: SyncStatus | null): string {
  const n = catalog.products.length.toLocaleString();
  return `This catalog contains ${n} active registrations from the EPA workbook created ${fmt(epaDataAsOf(catalog))} (EPA data as of that date). The catalog last changed ${fmt(catalogLastChanged(catalog, status))}. Workbook creation and catalog changes describe different events.`;
}

export function aboutUpdateModeText(standalone: boolean): string {
  return standalone
    ? 'This download checks the published catalog when opened online and every five minutes while open. If the connection is unavailable, it retains the displayed catalog; its embedded snapshot is available offline. Older downloaded versions do not gain this feature automatically.'
    : 'The repository checks EPA’s published export weekly, on Mondays at 6:30 a.m. America/Chicago, and publishes a new catalog only when it has changed. This hosted interface checks its published catalog every five minutes.';
}

export function citationText(catalog: Catalog): string {
  const m = catalog.meta;
  const imported = importedAt(catalog);
  const year = String(imported || m.source_snapshot_date || 'n.d.').slice(0, 4);
  return `Crop Protection Network. ${year}. What’s on Your Seed? Seed treatment database, repository version. Catalog imported ${fmt(imported)}; EPA APPRIL workbook created ${fmt(m.source_snapshot_date)}. ${REPOSITORY_URL}. Accessed [date].`;
}

export function automaticUpdatesText(
  catalog: Catalog,
  standalone: boolean,
  usingEmbeddedSnapshot: boolean,
): string {
  if (standalone)
    return usingEmbeddedSnapshot
      ? 'Embedded snapshot; online checks enabled'
      : 'Online catalog; checks every five minutes';
  return catalog.meta.automation || 'Not activated';
}

export interface HistoryRow {
  key: string;
  date: string;
  outcome: string;
  workbook: string;
  counts: string;
}

/** Update history for display, newest first (the file is already newest first). */
export function historyRows(updates: UpdateHistoryEntry[]): HistoryRow[] {
  return updates.map((u, i) => ({
    key: `${u.published_at || u.checked_at}-${i}`,
    date: fmt(u.published_at || u.checked_at),
    outcome: u.message || 'Catalog published.',
    workbook: fmt(u.workbook_created),
    counts: `${u.counts.added} added · ${u.counts.changed} changed · ${u.counts.removed} removed`,
  }));
}
