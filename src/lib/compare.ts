// Comparison selection (max four, insertion order) and the matrix picker search.

import { norm } from './format';
import { ref } from './product-facts';
import type { Catalog, Product } from './types';

export const MAX_COMPARE = 4;
export const STORAGE_KEY = 'cpn-seed-compare';
export const CAP_MESSAGE = 'Compare up to four formulations. Remove one to add another.';

export type SelectResult = 'ok' | 'unknown' | 'full';

/**
 * Add or remove a product id. Returns the new selection and an outcome; 'full'
 * means a fifth product was refused and the selection is unchanged.
 */
export function setSelection(
  selected: readonly string[],
  products: readonly Product[],
  id: string,
  checked: boolean,
): { selected: string[]; result: SelectResult } {
  if (!products.some((p) => p.id === id)) return { selected: [...selected], result: 'unknown' };
  const has = selected.includes(id);
  if (checked && !has && selected.length >= MAX_COMPARE)
    return { selected: [...selected], result: 'full' };
  if (checked) return { selected: has ? [...selected] : [...selected, id], result: 'ok' };
  return { selected: selected.filter((x) => x !== id), result: 'ok' };
}

/** Selected products in selection order (the matrix column order). */
export function comparisonProducts(catalog: Catalog, selected: readonly string[]): Product[] {
  return selected
    .map((id) => catalog.products.find((p) => p.id === id))
    .filter((p): p is Product => Boolean(p))
    .slice(0, MAX_COMPARE);
}

/** Selected products in catalog order (the compare bar and tab count). */
export function selectedInCatalogOrder(catalog: Catalog, selected: readonly string[]): Product[] {
  const set = new Set(selected);
  return catalog.products.filter((p) => set.has(p.id));
}

/** Keep only ids present in the catalog, capped at four. */
export function sanitizeSelection(ids: unknown, products: readonly Product[]): string[] {
  if (!Array.isArray(ids)) return [];
  return ids.filter((id): id is string => products.some((p) => p.id === id)).slice(0, MAX_COMPARE);
}

/** Read the saved selection. Storage may be unavailable in a cross-origin iframe. */
export function loadSelection(products: readonly Product[], storage?: Storage | null): string[] {
  try {
    const store = storage === undefined ? globalThis.localStorage : storage;
    return sanitizeSelection(JSON.parse(store?.getItem(STORAGE_KEY) || '[]'), products);
  } catch {
    return [];
  }
}

export function saveSelection(selected: readonly string[], storage?: Storage | null): void {
  try {
    const store = storage === undefined ? globalThis.localStorage : storage;
    store?.setItem(STORAGE_KEY, JSON.stringify(selected));
  } catch {
    // Storage blocked: the selection simply isn't remembered.
  }
}

/** Unselected products matching every term of the matrix search. */
export function matrixMatches(
  catalog: Catalog,
  selected: readonly string[],
  query: string,
): Product[] {
  const reference = catalog.ingredient_reference || {};
  const terms = norm(query).split(/\s+/);
  const set = new Set(selected);
  return catalog.products.filter((p) => {
    if (set.has(p.id)) return false;
    const hay = norm(
      [
        p.name,
        p.registration_number,
        p.registrant,
        p.alternate_names_raw,
        ...(p.aliases || []),
        ...p.ingredients.flatMap((a) => [a.name, ...(ref(reference, a).synonyms || [])]),
      ].join(' '),
    );
    return terms.every((t) => hay.includes(t));
  });
}

export function matrixMatchesText(count: number, selectedCount: number): string {
  return selectedCount >= MAX_COMPARE
    ? 'Four formulations selected. Remove one to add another.'
    : `${count} available matches. Search names, ingredients, alternate names or EPA numbers.`;
}

/** Keep the picked id if it is still a match, else the first match, else ''. */
export function pickerValue(matches: readonly Product[], before: string): string {
  return matches.some((p) => p.id === before) ? before : matches[0]?.id || '';
}
