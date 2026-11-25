// Ingredient guide: every ingredient named in the catalog with its reviewed
// classification and the number of products listing it.

import { norm, s } from './format';
import { productsWithIngredient, ref } from './product-facts';
import type { Catalog, IngredientReference } from './types';

export interface IngredientEntry {
  /** Ingredient name as written in product records (unique key). */
  key: string;
  info: IngredientReference;
  count: number;
}

export function ingredientNames(catalog: Catalog): string[] {
  return [...new Set(catalog.products.flatMap((p) => p.ingredients.map((a) => a.name)))].sort();
}

export function ingredientGuide(catalog: Catalog, query: string): IngredientEntry[] {
  const reference = catalog.ingredient_reference || {};
  const q = norm(query);
  return ingredientNames(catalog)
    .map((key) => ({ key, info: ref(reference, { name: key }) }))
    .filter(({ info }) => norm(info.name + ' ' + info.group + ' ' + info.purpose).includes(q))
    .map((x) => ({ ...x, count: productsWithIngredient(catalog.products, x.info.name).length }));
}

export function ingredientCountText(n: number): string {
  return `${n} ingredient${s(n)}`;
}
