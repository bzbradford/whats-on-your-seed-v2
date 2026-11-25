import { describe, expect, it } from 'vitest';
import {
  MAX_COMPARE,
  STORAGE_KEY,
  comparisonProducts,
  loadSelection,
  matrixMatches,
  matrixMatchesText,
  pickerValue,
  saveSelection,
  selectedInCatalogOrder,
  setSelection,
} from '../../src/lib/compare';
import { fixtureCatalog } from './fixtures';

const catalog = fixtureCatalog();
const ids = ['100-1648', '7969-441', '352-937', '100-1508'];

function memoryStorage(initial: Record<string, string> = {}): Storage {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
    clear: () => data.clear(),
    key: () => null,
    get length() {
      return data.size;
    },
  };
}

describe('comparison selection (ported from legacy logic_test)', () => {
  it('caps at four and keeps selection order', () => {
    let selected: string[] = [];
    for (const id of ids) {
      const r = setSelection(selected, catalog.products, id, true);
      expect(r.result).toBe('ok');
      selected = r.selected;
    }
    expect(selected).toHaveLength(MAX_COMPARE);
    const fifth = setSelection(selected, catalog.products, catalog.products[0].id, true);
    expect(fifth).toEqual({ selected, result: 'full' });
    expect(comparisonProducts(catalog, selected).map((p) => p.id)).toEqual(ids);
    // Re-adding a selected product is a no-op, not a refusal.
    expect(setSelection(selected, catalog.products, '100-1648', true)).toEqual({
      selected,
      result: 'ok',
    });
  });

  it('removes while preserving the order of the rest', () => {
    const r = setSelection(ids, catalog.products, '7969-441', false);
    expect(r.selected).toEqual(['100-1648', '352-937', '100-1508']);
  });

  it('refuses unknown products', () => {
    expect(setSelection([], catalog.products, 'nope', true).result).toBe('unknown');
  });

  it('lists the compare bar in catalog order', () => {
    const order = catalog.products.map((p) => p.id);
    const bar = selectedInCatalogOrder(catalog, ids).map((p) => p.id);
    expect(bar).toEqual([...ids].sort((a, b) => order.indexOf(a) - order.indexOf(b)));
  });
});

describe('saved selection', () => {
  it('round-trips through storage, dropping unknown ids and capping at four', () => {
    const storage = memoryStorage({ [STORAGE_KEY]: JSON.stringify(['gone', ...ids, '100-1585']) });
    expect(loadSelection(catalog.products, storage)).toEqual(ids);
    saveSelection(['100-1508'], storage);
    expect(storage.getItem(STORAGE_KEY)).toBe('["100-1508"]');
  });

  it('survives blocked or broken storage (cross-origin iframes)', () => {
    const throwing = {
      getItem() {
        throw new Error('SecurityError');
      },
      setItem() {
        throw new Error('SecurityError');
      },
    } as unknown as Storage;
    expect(loadSelection(catalog.products, throwing)).toEqual([]);
    expect(() => saveSelection(ids, throwing)).not.toThrow();
    expect(loadSelection(catalog.products, memoryStorage({ [STORAGE_KEY]: '{not json' }))).toEqual(
      [],
    );
    expect(loadSelection(catalog.products, null)).toEqual([]);
  });
});

describe('matrix picker', () => {
  it('searches names, alternate names and registration numbers, excluding selected', () => {
    expect(matrixMatches(catalog, [], 'Ilevo').map((p) => p.id)).toContain('7969-441');
    expect(matrixMatches(catalog, ['7969-441'], 'Ilevo').map((p) => p.id)).not.toContain(
      '7969-441',
    );
    expect(matrixMatches(catalog, [], 'no-such-product-xyz')).toHaveLength(0);
    expect(matrixMatches(catalog, ids, '')).toHaveLength(catalog.products.length - 4);
  });

  it('describes matches and the cap', () => {
    expect(matrixMatchesText(3, 1)).toBe(
      '3 available matches. Search names, ingredients, alternate names or EPA numbers.',
    );
    expect(matrixMatchesText(1, 1)).toMatch(/^1 available match\. /);
    expect(matrixMatchesText(3, 4)).toBe('Four formulations selected. Remove one to add another.');
  });

  it('keeps the picked product while it still matches', () => {
    const matches = catalog.products.slice(0, 3);
    expect(pickerValue(matches, matches[1].id)).toBe(matches[1].id);
    expect(pickerValue(matches, 'gone')).toBe(matches[0].id);
    expect(pickerValue([], 'gone')).toBe('');
  });
});
