import { describe, expect, it } from 'vitest';
import { SORTS, ariaSort, columnSort, sortProducts, type SortKey } from '../../src/lib/filters';
import { signalKey } from '../../src/lib/product-facts';
import { VIEW_KEY, loadView, saveView } from '../../src/lib/preferences';
import { fixtureCatalog } from './fixtures';

const products = fixtureCatalog().products;
const sorted = (key: SortKey) => sortProducts([...products], key);
const RANK = ['DANGER', 'WARNING', 'CAUTION', 'NONE', 'NOT_SUPPLIED'];

describe('result orders', () => {
  it('every sort key keeps all products', () => {
    for (const key of Object.keys(SORTS) as SortKey[])
      expect(sorted(key)).toHaveLength(products.length);
  });

  it('sorts names both ways', () => {
    const names = sorted('name').map((p) => p.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
    expect(sorted('name-desc').map((p) => p.name)).toEqual([...names].reverse());
  });

  it('sorts by signal-word severity, most severe first, and back', () => {
    const ranks = sorted('signal').map((p) => RANK.indexOf(signalKey(p)));
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
    const reversed = sorted('signal-asc').map((p) => RANK.indexOf(signalKey(p)));
    expect(reversed).toEqual([...reversed].sort((a, b) => b - a));
  });

  it('puts products without ingredients last in ingredient order (both ways)', () => {
    for (const key of ['ingredient', 'ingredient-desc'] as SortKey[]) {
      const list = sorted(key);
      const firstEmpty = list.findIndex((p) => !p.ingredients.length);
      expect(list.slice(firstEmpty).every((p) => !p.ingredients.length)).toBe(true);
    }
  });

  it('sorts status dates newest first and oldest first', () => {
    const newest = sorted('updated').map((p) => p.status_date);
    expect(newest).toEqual([...newest].sort().reverse());
    const oldest = sorted('updated-asc').map((p) => p.status_date);
    expect(oldest).toEqual([...oldest].sort());
  });

  it('column headers toggle direction and report aria-sort', () => {
    expect(columnSort('updated', 'name')).toBe('name');
    expect(columnSort('name', 'name')).toBe('name-desc');
    expect(columnSort('name-desc', 'name')).toBe('name');
    expect(columnSort('name', 'signal')).toBe('signal');
    expect(columnSort('signal', 'signal')).toBe('signal-asc');
    expect(ariaSort('name', 'name')).toBe('ascending');
    expect(ariaSort('name-desc', 'name')).toBe('descending');
    expect(ariaSort('signal', 'signal')).toBe('descending');
    expect(ariaSort('signal-asc', 'signal')).toBe('ascending');
    expect(ariaSort('updated', 'name')).toBe('none');
  });
});

describe('view preference', () => {
  function memory(initial: Record<string, string> = {}): Storage {
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

  it('defaults to cards and remembers list', () => {
    const storage = memory();
    expect(loadView(storage)).toBe('cards');
    saveView('list', storage);
    expect(storage.getItem(VIEW_KEY)).toBe('list');
    expect(loadView(storage)).toBe('list');
    expect(loadView(memory({ [VIEW_KEY]: 'nonsense' }))).toBe('cards');
  });

  it('survives blocked storage', () => {
    const blocked = {
      getItem() {
        throw new Error('SecurityError');
      },
      setItem() {
        throw new Error('SecurityError');
      },
    } as unknown as Storage;
    expect(loadView(blocked)).toBe('cards');
    expect(() => saveView('list', blocked)).not.toThrow();
  });
});
