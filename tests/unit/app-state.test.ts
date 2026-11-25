// AppState glue: initial load, five-minute refresh, failure handling, and that a
// refresh keeps the user's filters, page and comparison (legacy logic_test's
// refresh harness). Runs the real runes-based class with a stubbed fetch.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushSync } from 'svelte';
import { AppState } from '../../src/lib/app-state.svelte';
import type { Catalog, SyncStatus } from '../../src/lib/types';
import { fixtureCatalog, publishedHistory } from './fixtures';

let files: Record<string, unknown>;
const requests: string[] = [];
const status = (
  state: 'success' | 'failed' = 'success',
  message = 'Fixture status.',
): SyncStatus => ({
  state,
  message,
  last_publication_at: '2026-10-19T12:00:00Z',
  sources: { EPA: { state: 'checked', checked_at: '2026-10-19T11:00:00Z' } },
});

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setInterval', 'setTimeout', 'clearTimeout'] });
  requests.length = 0;
  const current = fixtureCatalog();
  current.mode = 'live';
  files = {
    'catalog.json': current,
    'sync-status.json': status(),
    'update-history.json': publishedHistory(),
  };
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      requests.push(url);
      const value = files[url.split('/').pop()!];
      if (value === undefined) throw new TypeError('Failed to fetch');
      return Response.json(structuredClone(value));
    }),
  );
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

async function started() {
  const app = new AppState({ standalone: false, baseUrl: './' });
  await app.load();
  flushSync();
  return app;
}

describe('AppState loading and refresh', () => {
  it('loads data/ relatively and polls every five minutes', async () => {
    const app = await started();
    expect(app.loadState).toBe('ready');
    expect(requests).toContain('./data/catalog.json');
    expect(app.result.products).toHaveLength(880);
    expect(app.filters.end).toBe('2026-10-19');
    expect(app.status?.message).toBe('Fixture status.');
    requests.length = 0;
    await vi.advanceTimersByTimeAsync(5 * 60 * 1000);
    expect(requests).toContain('./data/catalog.json');
  });

  it('shows the unavailable state, then recovers on the next poll', async () => {
    delete files['catalog.json'];
    const app = await started();
    expect(app.loadState).toBe('unavailable');
    expect(app.flags.catalogPollFailed).toBe(true);
    files['catalog.json'] = fixtureCatalog();
    (files['catalog.json'] as Catalog).mode = 'live';
    await app.poll();
    expect(app.loadState).toBe('ready');
    expect(app.flags.catalogPollFailed).toBe(false);
  });

  it('keeps search, page and comparison through a status-only refresh', async () => {
    const app = await started();
    app.filters.query = 'fludioxonil';
    flushSync();
    app.page = 2;
    app.setComparison('100-1508', true);
    files['sync-status.json'] = status('failed', 'Source check failed fixture.');
    await app.poll();
    flushSync();
    expect(app.status?.state).toBe('failed');
    expect(app.filters.query).toBe('fludioxonil');
    expect(app.page).toBe(2);
    expect(app.selected).toEqual(['100-1508']);
  });

  it('flags failed status and catalog fetches but keeps the displayed catalog', async () => {
    const app = await started();
    files['sync-status.json'] = { state: 'success' };
    await app.poll();
    expect(app.flags.statusPollFailed).toBe(true);
    const malformed = structuredClone(files['catalog.json']) as {
      products: Record<string, unknown>[];
    };
    delete malformed.products[0].ingredients;
    files['catalog.json'] = malformed;
    await app.poll();
    expect(app.flags.catalogPollFailed).toBe(true);
    expect(app.catalog.products[0].ingredients).toBeDefined();
  });

  it('replaces a changed catalog, keeping filters and selection, and says so', async () => {
    const app = await started();
    app.filters.query = '100-1508';
    app.filters.start = '2020-01-01';
    app.filters.end = '2026-10-01';
    app.setComparison('100-1508', true);
    const newer = structuredClone(files['catalog.json']) as Catalog;
    newer.meta.last_successful_sync = '2026-10-19T11:30:00Z';
    newer.products.find((p) => p.id === '100-1508')!.name = 'Updated fixture product';
    files['catalog.json'] = newer;
    await app.poll();
    flushSync();
    expect(app.catalog.products.find((p) => p.id === '100-1508')?.name).toBe(
      'Updated fixture product',
    );
    expect(app.filters).toMatchObject({
      query: '100-1508',
      start: '2020-01-01',
      end: '2026-10-01',
    });
    expect(app.selected).toEqual(['100-1508']);
    expect(app.toast).toEqual({
      message: 'The published catalog has been updated.',
      visible: true,
    });
  });
});

describe('AppState comparison and filters', () => {
  it('refuses a fifth product with a toast', async () => {
    const app = await started();
    for (const id of ['100-1648', '7969-441', '352-937', '100-1508'])
      expect(app.setComparison(id, true)).toBe(true);
    expect(app.setComparison(app.catalog.products[0].id, true)).toBe(false);
    expect(app.toast.message).toBe('Compare up to four formulations. Remove one to add another.');
    expect(app.comparison.map((p) => p.id)).toEqual([
      '100-1648',
      '7969-441',
      '352-937',
      '100-1508',
    ]);
  });

  it('returns to page 1 when a filter changes', async () => {
    const app = await started();
    app.page = 3;
    flushSync();
    expect(app.page).toBe(3);
    app.filters.purpose = 'Fungicide';
    flushSync();
    expect(app.page).toBe(1);
  });

  it('reset restores the defaults', async () => {
    const app = await started();
    app.filters.query = 'x';
    app.filters.start = '2099-01-01';
    flushSync();
    expect(app.count).toBe('Check your dates');
    app.reset();
    flushSync();
    expect(app.count).toBe('880 products');
    expect(app.filters.end).toBe('2026-10-19');
  });
});
