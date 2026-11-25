import { describe, expect, it, vi } from 'vitest';
import { resetFilters } from '../../src/lib/filters';
import {
  carryOver,
  catalogChanged,
  fetchPublished,
  fetchStatus,
  publicationChanged,
} from '../../src/lib/sync';
import { fixtureCatalog, publishedHistory, publishedStatus } from './fixtures';

function fakeFetch(files: Record<string, unknown>) {
  return vi.fn(async (url: RequestInfo | URL) => {
    const name = String(url).split('/').pop()!;
    const value = files[name];
    if (value === undefined) throw new TypeError('Failed to fetch');
    if (value === 404) return new Response('', { status: 404 });
    return Response.json(value);
  }) as unknown as typeof fetch;
}

describe('fetchPublished', () => {
  const catalog = fixtureCatalog();
  catalog.mode = 'live';

  it('requests the three published files from the given base', async () => {
    const fetchFn = fakeFetch({
      'catalog.json': catalog,
      'sync-status.json': publishedStatus(),
      'update-history.json': publishedHistory(),
    });
    const r = await fetchPublished('https://example.org/data/', fetchFn);
    expect(r.catalog?.products).toHaveLength(880);
    expect(r.status?.state).toBe('success');
    expect(r.history?.updates.length).toBeGreaterThan(0);
    expect(vi.mocked(fetchFn).mock.calls.map((c) => String(c[0]))).toEqual([
      'https://example.org/data/catalog.json',
      'https://example.org/data/sync-status.json',
      'https://example.org/data/update-history.json',
    ]);
  });

  it('fails each file independently, including malformed catalogs', async () => {
    const malformed = structuredClone(catalog) as unknown as {
      products: Record<string, unknown>[];
    };
    delete malformed.products[0].ingredients;
    const r = await fetchPublished(
      'x/',
      fakeFetch({ 'catalog.json': malformed, 'sync-status.json': { state: 'success' } }),
    );
    expect(r).toEqual({ catalog: null, status: null, history: null });
    const r2 = await fetchPublished(
      'x/',
      fakeFetch({ 'catalog.json': 404, 'sync-status.json': publishedStatus() }),
    );
    expect(r2.catalog).toBeNull();
    expect(r2.status).not.toBeNull();
  });
});

describe('catalog refresh', () => {
  const current = fixtureCatalog();

  it('detects a new version by sync time or workbook hash', () => {
    expect(catalogChanged(current, fixtureCatalog())).toBe(false);
    const newer = fixtureCatalog();
    newer.meta.last_successful_sync = '2026-10-19T11:30:00Z';
    expect(catalogChanged(current, newer)).toBe(true);
    const rehashed = fixtureCatalog();
    rehashed.meta.audit = { ...rehashed.meta.audit, sha256: 'other' };
    expect(catalogChanged(current, rehashed)).toBe(true);
    expect(catalogChanged(null, current)).toBe(true);
  });

  it('keeps search, dates and comparison; an end date following the cutoff moves to today', () => {
    const next = fixtureCatalog();
    next.products = next.products.filter((p) => p.id !== '352-937');
    const filters = {
      ...resetFilters({ sort: 'name' }, current, '2026-10-19'),
      query: '100-1508',
      start: '2020-01-01',
    };
    const kept = carryOver(current, next, filters, ['100-1508', '352-937'], '2026-10-20');
    expect(kept.filters).toMatchObject({
      query: '100-1508',
      start: '2020-01-01',
      end: '2026-10-20',
    });
    expect(kept.selected).toEqual(['100-1508']);
  });

  it('keeps a user-chosen end date', () => {
    const filters = { ...resetFilters({ sort: 'name' }, current, '2026-10-19'), end: '2026-10-01' };
    expect(carryOver(current, fixtureCatalog(), filters, [], '2026-10-20').filters.end).toBe(
      '2026-10-01',
    );
  });
});

describe('status-first polling', () => {
  const known = publishedStatus();

  it('detects a new publication from the status alone', () => {
    expect(publicationChanged(known, { ...known })).toBe(false);
    expect(publicationChanged(null, known)).toBe(true);
    expect(
      publicationChanged(known, { ...known, last_publication_at: '2030-01-01T00:00:00Z' }),
    ).toBe(true);
    expect(publicationChanged(known, { ...known, workbook_sha256: 'other' })).toBe(true);
    expect(publicationChanged(known, { ...known, checked_at: '2030-01-01T00:00:00Z' })).toBe(true);
  });

  it('fetches only the status and history files', async () => {
    const fetchFn = fakeFetch({
      'sync-status.json': known,
      'update-history.json': publishedHistory(),
    });
    const r = await fetchStatus('x/', fetchFn);
    expect(r.status?.state).toBe('success');
    expect(vi.mocked(fetchFn).mock.calls.map((c) => String(c[0]))).toEqual([
      'x/sync-status.json',
      'x/update-history.json',
    ]);
    expect(await fetchStatus('x/', fakeFetch({}))).toEqual({ status: null, history: null });
    // An invalid file is a failed check, not an exception.
    expect(
      await fetchStatus(
        'x/',
        fakeFetch({ 'sync-status.json': { state: 'success' }, 'update-history.json': {} }),
      ),
    ).toEqual({ status: null, history: null });
  });
});
