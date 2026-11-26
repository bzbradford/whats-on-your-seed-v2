// Per-product derived facts: ingredient classification lookup, FRAC/IRAC grouping,
// EPA signal word / restricted-use classification and ingredient-data quality.
// Ported from the legacy script; wording is part of the parity target.

import { count, norm } from './format';
import type { Ingredient, IngredientReference, Product } from './types';

export type ReferenceMap = Record<string, IngredientReference>;

/** Reviewed classification for an ingredient, or the "Awaiting review" placeholder. */
export function ref(reference: ReferenceMap, ai: { name: string }): IngredientReference {
  return (
    reference[norm(ai.name)] || {
      name: ai.name,
      purpose: 'Unclassified',
      group: 'Not classified',
      classification: 'Awaiting review',
      explanation: 'This ingredient has not yet been assigned a reviewed classification.',
    }
  );
}

export type Scheme = 'frac' | 'irac';

/** Distinct FRAC or IRAC codes across a product's ingredients, in numeric-aware order. */
export function moaGroups(reference: ReferenceMap, p: Product, scheme: Scheme): string[] {
  const codes = p.ingredients
    .map((a) => ref(reference, a)[`${scheme}_code`])
    .filter((x): x is string => Boolean(x));
  return [...new Set(codes)].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

export function unmappedCount(reference: ReferenceMap, p: Product): number {
  return p.ingredients.filter((a) => !ref(reference, a).frac_code && !ref(reference, a).irac_code)
    .length;
}

export function groupText(reference: ReferenceMap, p: Product, scheme: Scheme): string {
  const groups = moaGroups(reference, p, scheme);
  return groups.length ? groups.join(', ') : 'No reviewed assignment';
}

export function coverageText(reference: ReferenceMap, p: Product): string {
  if (!p.ingredients.length) return 'Ingredients missing; groups unknown';
  const n = unmappedCount(reference, p);
  return n
    ? `${count(n, 'ingredient')} without a reviewed FRAC/IRAC assignment`
    : 'All listed ingredients have a reviewed FRAC/IRAC assignment';
}

/** Signal word key; a missing word is 'NOT_SUPPLIED', which differs from an explicit 'NONE'. */
export type SignalKey = 'DANGER' | 'WARNING' | 'CAUTION' | 'NONE' | 'NOT_SUPPLIED';

export function signalKey(p: Product): SignalKey {
  return (p.safety?.signal_word as SignalKey | null | undefined) || 'NOT_SUPPLIED';
}

export function signalText(p: Product): string {
  const k = signalKey(p);
  return k === 'NONE' ? 'None reported by EPA' : k === 'NOT_SUPPLIED' ? 'Not supplied' : k;
}

/** CSS modifier for the signal badge: DANGER and WARNING are emphasised. */
export function signalClass(p: Product): '' | 'danger' | 'warning' {
  const k = signalKey(p);
  return k === 'DANGER' ? 'danger' : k === 'WARNING' ? 'warning' : '';
}

export function rupText(p: Product): string {
  const r = p.safety?.restricted_use;
  return r === true ? 'Yes' : r === false ? 'No' : 'Not supplied';
}

/** Short description of the ingredient evidence for a record. */
export function quality(p: Product): string {
  if (p.ingredient_quality === 'base-linked')
    return 'Related base formulation · check distributor label';
  if (p.ingredient_quality === 'missing') return 'Ingredients missing · exclusion check incomplete';
  if (p.ingredient_quality === 'partial') return 'EPA ingredient percentage missing';
  return p.epa_verified
    ? 'EPA source formulation'
    : p.ingredient_quality === 'label-reviewed'
      ? 'Label ingredients reviewed'
      : 'Source example';
}

/** Eyebrow above the ingredient list on a product card. */
export function ingredientsEyebrow(p: Product): string {
  return p.ingredient_quality === 'base-linked'
    ? 'Related base product ingredients'
    : p.ingredient_quality === 'partial'
      ? 'Ingredients · percentage missing'
      : 'Active ingredients listed';
}

export function recordTypeText(recordType: string, short = false): string {
  return recordType === 'DP'
    ? 'Distributor product'
    : recordType === 'Sec3'
      ? short
        ? 'Section 3'
        : 'Section 3 registration'
      : recordType;
}

/** Products listing an ingredient (by normalised name). */
export function productsWithIngredient(products: Product[], name: string): Product[] {
  const n = norm(name);
  return products.filter((p) => p.ingredients.some((i: Ingredient) => norm(i.name) === n));
}

/** Warning shown at the top of the product dialog. */
export function detailWarning(p: Product): string {
  let warning = p.notes || '';
  if (!p.epa_verified)
    warning = 'EPA active status and exact approved uses have not been verified. ' + warning;
  return warning;
}

/**
 * How many ingredients a card or list row shows: all of them up to four; longer lists
 * (mostly stacked Bt traits) show three and count the rest, which the dialog lists.
 */
export function shownIngredientCount(total: number): number {
  return total > 4 ? 3 : total;
}
