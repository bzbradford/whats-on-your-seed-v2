import { describe, expect, it } from 'vitest';
import {
  coverageText,
  groupText,
  moaGroups,
  quality,
  ref,
  shownIngredientCount,
  rupText,
  signalClass,
  signalKey,
  signalText,
} from '../../src/lib/product-facts';
import type { Product } from '../../src/lib/types';
import { fixtureCatalog } from './fixtures';

const catalog = fixtureCatalog();
const reference = catalog.ingredient_reference;
const product = (id: string) => catalog.products.find((p) => p.id === id)!;
const withSafety = (safety: Product['safety']) => ({ ...product('100-1508'), safety }) as Product;

describe('ingredient classification', () => {
  it('looks up the reviewed reference by normalised name', () => {
    expect(ref(reference, { name: '  THIABENDAZOLE ' }).frac_code).toBe('1');
  });

  it('falls back to an unclassified placeholder', () => {
    const r = ref(reference, { name: 'Unknown thing' });
    expect(r).toMatchObject({ purpose: 'Unclassified', group: 'Not classified' });
    expect(r.classification).toBe('Awaiting review');
  });

  it('groups FRAC and IRAC codes per product, numeric-aware and de-duplicated', () => {
    const p = product('100-1508');
    const frac = moaGroups(reference, p, 'frac');
    expect(frac).toEqual([...new Set(frac)]);
    expect(frac).toEqual(
      [...frac].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })),
    );
    expect(moaGroups(reference, p, 'irac')).toEqual(['4A']);
    expect(groupText(reference, { ...p, ingredients: [] }, 'frac')).toBe('No reviewed assignment');
  });

  it('describes FRAC/IRAC coverage, including missing ingredients', () => {
    expect(coverageText(reference, { ...product('100-1508'), ingredients: [] })).toBe(
      'Ingredients missing; groups unknown',
    );
    const unknown = { name: 'Unknown thing', percent: 1, pc_code: null, cas: null };
    expect(coverageText(reference, { ...product('100-1508'), ingredients: [unknown] })).toBe(
      '1 ingredient without a reviewed FRAC/IRAC assignment',
    );
  });
});

describe('EPA signal word and restricted use', () => {
  it('distinguishes an explicit NONE from a missing signal word', () => {
    expect(signalKey(withSafety({ signal_word: 'NONE' }))).toBe('NONE');
    expect(signalText(withSafety({ signal_word: 'NONE' }))).toBe('None reported by EPA');
    expect(signalKey(withSafety({ signal_word: null }))).toBe('NOT_SUPPLIED');
    expect(signalText(withSafety({}))).toBe('Not supplied');
    expect(signalText(withSafety({ signal_word: 'CAUTION' }))).toBe('CAUTION');
  });

  it('emphasises DANGER and WARNING only', () => {
    expect(signalClass(withSafety({ signal_word: 'DANGER' }))).toBe('danger');
    expect(signalClass(withSafety({ signal_word: 'WARNING' }))).toBe('warning');
    expect(signalClass(withSafety({ signal_word: 'CAUTION' }))).toBe('');
  });

  it('reports the restricted-use flag as Yes / No / Not supplied', () => {
    expect(rupText(withSafety({ restricted_use: true }))).toBe('Yes');
    expect(rupText(withSafety({ restricted_use: false }))).toBe('No');
    expect(rupText(withSafety({}))).toBe('Not supplied');
  });
});

describe('ingredient-data quality', () => {
  it.each([
    ['base-linked', true, 'Related base formulation · check distributor label'],
    ['missing', false, 'Ingredients missing · exclusion check incomplete'],
    ['partial', true, 'EPA ingredient percentage missing'],
    ['verified', true, 'EPA source formulation'],
    ['label-reviewed', false, 'Label ingredients reviewed'],
    ['other', false, 'Source example'],
  ])('%s -> %s', (q, verified, text) => {
    expect(quality({ ...product('100-1508'), ingredient_quality: q, epa_verified: verified })).toBe(
      text,
    );
  });
});

describe('shownIngredientCount', () => {
  it('shows up to four, otherwise three and counts the rest', () => {
    expect([0, 1, 4, 5, 9].map(shownIngredientCount)).toEqual([0, 1, 4, 3, 3]);
  });
});
