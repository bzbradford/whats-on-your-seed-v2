import { describe, expect, it } from 'vitest';
import {
  PUBLISHED_DATA_URL,
  aboutDatesText,
  aboutUpdateModeText,
  automaticUpdatesText,
  catalogLastChanged,
  citationText,
  dataNote,
  epaDataAsOf,
  historyRows,
  updateWarning,
  type SyncFlags,
} from '../../src/lib/currency';
import type { SyncStatus } from '../../src/lib/types';
import { publishedCatalog, publishedHistory, publishedStatus } from './fixtures';

const catalog = publishedCatalog();
const status = publishedStatus();
const ok: SyncFlags = {
  usingEmbeddedSnapshot: false,
  catalogPollFailed: false,
  statusPollFailed: false,
};

describe('update warnings (legacy updateWarning, minus the check-age warnings)', () => {
  it('is quiet when the published data loaded', () => {
    expect(updateWarning(ok, status)).toBeNull();
  });

  it('never warns about check age: an old check date is fine', () => {
    const old: SyncStatus = {
      ...status,
      checked_at: '2020-01-01T00:00:00Z',
      sources: { EPA: { checked_at: '2020-01-01T00:00:00Z' } },
    };
    expect(updateWarning(ok, old)).toBeNull();
    expect(updateWarning(ok, null)).toBeNull();
  });

  it('reports an offline standalone snapshot only when the fetch failed', () => {
    expect(updateWarning({ ...ok, usingEmbeddedSnapshot: true }, null)).toBeNull();
    expect(
      updateWarning({ ...ok, usingEmbeddedSnapshot: true, catalogPollFailed: true }, null)?.title,
    ).toBe('Offline snapshot displayed.');
  });

  it('names what could not be retrieved', () => {
    expect(updateWarning({ ...ok, catalogPollFailed: true }, status)?.message).toContain(
      'latest catalog could not',
    );
    expect(updateWarning({ ...ok, statusPollFailed: true }, status)?.message).toContain(
      'latest update status',
    );
    expect(
      updateWarning({ ...ok, catalogPollFailed: true, statusPollFailed: true }, status)?.message,
    ).toContain('catalog and update status');
  });

  it('reports a failed EPA update', () => {
    expect(updateWarning(ok, { ...status, state: 'failed' })?.title).toBe('EPA update failed.');
  });
});

describe('dates and wording', () => {
  it('shows EPA data as of the workbook date and when the catalog last changed', () => {
    expect(epaDataAsOf(catalog)).toBe(catalog.meta.source_snapshot_date);
    expect(catalogLastChanged(catalog, status)).toBe(status.last_publication_at);
    expect(catalogLastChanged(catalog, null)).toBe(catalog.meta.imported_at);
    const text = aboutDatesText(catalog, status);
    expect(text).toContain(`${catalog.products.length} active registrations`);
    expect(text).not.toMatch(/retrieval|checked/i);
  });

  it('describes the weekly schedule and the five-minute refresh', () => {
    expect(aboutUpdateModeText(false)).toContain('weekly, on Mondays at 6:30 a.m. America/Chicago');
    expect(aboutUpdateModeText(false)).not.toContain('daily');
    expect(aboutUpdateModeText(true)).toContain('every five minutes');
  });

  it('cites this repository with the catalog dates', () => {
    const c = citationText(catalog);
    expect(c).toContain('github.com/bzbradford/whats-on-your-seed-v2');
    expect(c).not.toContain('danieham');
    expect(c).toMatch(/^Crop Protection Network\. \d{4}\./);
  });

  it('mentions missing formulations and the embedded snapshot in the data note', () => {
    const note = dataNote(catalog, true);
    expect(note).toContain('records lack ingredients');
    expect(note).toContain('embedded snapshot');
    expect(note).toMatch(/not efficacy or safety rankings\.$/);
  });

  it('describes automatic updates per build', () => {
    expect(automaticUpdatesText(catalog, true, true)).toBe(
      'Embedded snapshot; online checks enabled',
    );
    expect(automaticUpdatesText(catalog, true, false)).toBe(
      'Online catalog; checks every five minutes',
    );
    expect(automaticUpdatesText(catalog, false, false)).toBe(catalog.meta.automation);
  });

  it('polls the fork’s Pages data from the standalone file', () => {
    expect(PUBLISHED_DATA_URL).toBe('https://bzbradford.github.io/whats-on-your-seed-v2/data/');
  });
});

describe('update history', () => {
  it('formats newest-first rows with counts, falling back to the check date', () => {
    const rows = historyRows(publishedHistory().updates);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0].counts).toMatch(/^\d+ added · \d+ changed · \d+ removed$/);
    const legacyEntry = historyRows([
      {
        checked_at: '2026-10-19T17:09:19Z',
        counts: { added: 1, changed: 2, removed: 3 },
        records: [],
      },
    ])[0];
    expect(legacyEntry).toMatchObject({
      date: 'Oct 19, 2026',
      outcome: 'Catalog published.',
      workbook: 'Not supplied',
    });
  });
});
