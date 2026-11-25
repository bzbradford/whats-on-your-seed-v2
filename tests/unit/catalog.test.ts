import { describe, expect, it, vi } from 'vitest';
import { CatalogError, fetchCatalog, parseCatalog } from '../../src/lib/catalog';

const minimal = { products: [], meta: { last_successful_sync: '', source_snapshot_date: '' } };

describe('parseCatalog', () => {
  it('accepts a catalog with products and meta', () => {
    expect(parseCatalog(minimal)).toBe(minimal);
  });

  it.each([
    ['null', null],
    ['an array', []],
    ['missing products', { meta: {} }],
    ['missing meta', { products: [] }],
  ])('rejects %s', (_label, raw) => {
    expect(() => parseCatalog(raw)).toThrow(CatalogError);
  });
});

describe('fetchCatalog', () => {
  it('parses a successful response', async () => {
    const fetchFn = vi.fn(async () => Response.json(minimal));
    await expect(fetchCatalog('data/catalog.json', fetchFn)).resolves.toEqual(minimal);
    expect(fetchFn).toHaveBeenCalledWith('data/catalog.json', { cache: 'no-cache' });
  });

  it('throws on an HTTP error', async () => {
    const fetchFn = vi.fn(async () => new Response('nope', { status: 404 }));
    await expect(fetchCatalog('x', fetchFn)).rejects.toThrow(/404/);
  });
});
