import { describe, expect, it, vi } from 'vitest';
import {
  CatalogError,
  dataBase,
  fetchCatalog,
  fetchJson,
  parseCatalog,
  parseSyncStatus,
  parseUpdateHistory,
} from '../../src/lib/catalog';
import { fixtureCatalog, publishedCatalog, publishedHistory, publishedStatus } from './fixtures';

const minimal = () => ({
  mode: 'live',
  products: [
    {
      id: '1-1',
      registration_number: '1-1',
      name: 'A',
      registrant: 'R',
      sites: ['s'],
      purposes: [],
      ingredients: [{ name: 'x' }],
    },
  ],
  meta: { last_successful_sync: '2026-11-25T18:03:05Z', source_snapshot_date: '2026-09-21' },
  scope: { sites: ['s'] },
  ingredient_reference: {},
});

describe('parseCatalog (legacy published-catalog validation)', () => {
  it('accepts the current published catalog and the frozen fixture', () => {
    expect(parseCatalog(publishedCatalog()).products.length).toBeGreaterThan(0);
    expect(parseCatalog(fixtureCatalog()).products).toHaveLength(880);
  });

  it('accepts a minimal valid catalog', () => {
    const c = minimal();
    expect(parseCatalog(c)).toBe(c);
  });

  it.each<[string, (c: ReturnType<typeof minimal>) => unknown]>([
    ['null', () => null],
    ['an unknown mode', (c) => ({ ...c, mode: 'preview' })],
    ['no products', (c) => ({ ...c, products: [] })],
    ['an invalid sync time', (c) => ({ ...c, meta: { ...c.meta, last_successful_sync: 'soon' } })],
    ['no scope sites', (c) => ({ ...c, scope: { sites: [] } })],
    ['no ingredient reference', (c) => ({ ...c, ingredient_reference: null })],
    [
      'a product without ingredients',
      (c) => ({ ...c, products: [{ ...c.products[0], ingredients: undefined }] }),
    ],
    ['a product with a numeric name', (c) => ({ ...c, products: [{ ...c.products[0], name: 1 }] })],
    ['duplicate ids', (c) => ({ ...c, products: [c.products[0], c.products[0]] })],
  ])('rejects %s', (_label, mutate) => {
    expect(() => parseCatalog(mutate(minimal()))).toThrow(CatalogError);
  });
});

describe('sync status and history', () => {
  it('accepts the published files', () => {
    expect(parseSyncStatus(publishedStatus()).state).toBe('success');
    expect(Array.isArray(parseUpdateHistory(publishedHistory()).updates)).toBe(true);
  });

  it('rejects a status without an EPA source or with a bad check time', () => {
    expect(() => parseSyncStatus({ state: 'success' })).toThrow(CatalogError);
    expect(() => parseSyncStatus({ state: 'unknown', sources: { EPA: {} } })).toThrow(CatalogError);
    expect(() =>
      parseSyncStatus({ state: 'success', sources: { EPA: { checked_at: 'yesterday' } } }),
    ).toThrow(CatalogError);
    expect(parseSyncStatus({ state: 'failed', sources: { EPA: { checked_at: null } } }).state).toBe(
      'failed',
    );
  });

  it('rejects history without updates', () => {
    expect(() => parseUpdateHistory({})).toThrow(CatalogError);
  });
});

describe('fetching', () => {
  it('revalidates (no-cache) and parses a successful response', async () => {
    const fetchFn = vi.fn(async () => Response.json(minimal()));
    await expect(fetchCatalog('data/catalog.json', fetchFn)).resolves.toEqual(minimal());
    expect(fetchFn).toHaveBeenCalledWith(
      'data/catalog.json',
      expect.objectContaining({ cache: 'no-cache' }),
    );
  });

  it('throws on an HTTP error', async () => {
    const fetchFn = vi.fn(async () => new Response('nope', { status: 404 }));
    await expect(fetchJson('x', fetchFn)).rejects.toThrow(/404/);
  });

  it('times out', async () => {
    const fetchFn = vi.fn(
      (_url: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) =>
          init?.signal?.addEventListener('abort', () => reject(new Error('aborted'))),
        ),
    );
    await expect(fetchJson('x', fetchFn as typeof fetch, 5)).rejects.toThrow('aborted');
  });

  it('reads data/ relatively on Pages and the published URL in the standalone file', () => {
    expect(dataBase(false, 'https://example.org/data/', './')).toBe('./data/');
    expect(dataBase(true, 'https://example.org/data/', './')).toBe('https://example.org/data/');
  });
});
