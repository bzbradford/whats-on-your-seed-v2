import { describe, expect, it } from 'vitest';
import { ingredientCountText, ingredientGuide, ingredientNames } from '../../src/lib/ingredients';
import { fixtureCatalog } from './fixtures';

const catalog = fixtureCatalog();

describe('ingredient guide', () => {
  it('lists every ingredient named in the catalog', () => {
    const names = ingredientNames(catalog);
    expect(names).toEqual([...new Set(names)]);
    expect(ingredientGuide(catalog, '')).toHaveLength(names.length);
  });

  it('searches names, groups and purposes', () => {
    expect(ingredientGuide(catalog, 'metalaxyl').length).toBeGreaterThan(0);
    expect(ingredientGuide(catalog, 'IRAC 4A').every((e) => e.info.group.includes('4A'))).toBe(
      true,
    );
    expect(ingredientGuide(catalog, 'zzz-none')).toHaveLength(0);
  });

  it('counts the products listing each ingredient', () => {
    const entry = ingredientGuide(catalog, 'thiamethoxam')[0];
    expect(entry.count).toBe(
      catalog.products.filter((p) =>
        p.ingredients.some((a) => a.name.toLowerCase() === 'thiamethoxam'),
      ).length,
    );
    expect(ingredientCountText(1)).toBe('1 ingredient');
    expect(ingredientCountText(2)).toBe('2 ingredients');
  });
});
