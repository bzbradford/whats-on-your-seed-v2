import { describe, expect, it } from 'vitest';
import {
  PAGE_SIZE,
  appliedFilters,
  clearChip,
  categoryOptions,
  countText,
  filterProducts,
  invalidDateRange,
  keepValidSelections,
  pageInfo,
  resetFilters,
  siteSummary,
  type Filters,
} from '../../src/lib/filters';
import { norm } from '../../src/lib/format';
import { signalKey } from '../../src/lib/product-facts';
import type { Product } from '../../src/lib/types';
import { FIXTURE_TODAY, fixtureCatalog } from './fixtures';

const catalog = fixtureCatalog();
const all = catalog.products;
const base = (): Filters => ({
  ...resetFilters({ sort: 'name' }, catalog, FIXTURE_TODAY),
  end: '',
});
const run = (patch: Partial<Filters>) => filterProducts(catalog, { ...base(), ...patch }).products;
const count = (test: (p: Product) => boolean) => all.filter(test).length;
const refCode = (name: string, scheme: 'frac_code' | 'irac_code') =>
  catalog.ingredient_reference[norm(name)]?.[scheme];

describe('filterProducts (ported from legacy logic_test)', () => {
  it('shows every product with no filters', () => {
    expect(run({})).toHaveLength(all.length);
  });

  it('finds a product by its id / registration number', () => {
    const sample = all.find((p) => p.ingredients.length)!;
    expect(run({ query: sample.id }).some((p) => p.id === sample.id)).toBe(true);
    expect(run({ query: '100-1508' }).map((p) => p.id)).toEqual(['100-1508']);
  });

  it('searches ingredients and their synonyms (mefenoxam = metalaxyl-M)', () => {
    expect(run({ query: 'mefenoxam' })).toHaveLength(
      count(
        (p) =>
          p.ingredients.some((a) => a.pc_code === '113502') ||
          [p.name, p.registrant, p.alternate_names_raw || '']
            .join(' ')
            .toLowerCase()
            .includes('mefenoxam'),
      ),
    );
  });

  it('requires every search term', () => {
    const both = run({ query: 'fludioxonil thiamethoxam' });
    expect(both.length).toBeGreaterThan(0);
    expect(both.length).toBeLessThan(run({ query: 'fludioxonil' }).length);
    expect(run({ query: 'no-such-product-xyz' })).toHaveLength(0);
  });

  it('matches crop sites exactly, without expanding groups', () => {
    expect(run({ sites: ['Barley (seed treatment)'] })).toHaveLength(299);
    expect(run({ sites: ['Barley (seed treatment)'] })).toHaveLength(
      count((p) => p.sites.includes('Barley (seed treatment)')),
    );
    expect(run({ sites: ['Barley (seed treatment)', 'Wheat (seed treatment)'] })).toHaveLength(
      count(
        (p) =>
          p.sites.includes('Barley (seed treatment)') || p.sites.includes('Wheat (seed treatment)'),
      ),
    );
  });

  it('filters by technology, purpose and manufacturer', () => {
    expect(run({ technology: 'Plant-Incorp. Protectant' })).toHaveLength(85);
    expect(run({ purpose: 'Herbicide' })).toHaveLength(
      count((p) => p.purposes.includes('Herbicide')),
    );
    const registrant = all[0].registrant;
    expect(run({ manufacturer: registrant })).toHaveLength(
      count((p) => p.registrant === registrant),
    );
  });

  it.each([
    ['verified', (p: Product) => p.ingredient_quality === 'verified'],
    ['base-linked', (p: Product) => p.ingredient_quality === 'base-linked'],
    ['needs-review', (p: Product) => p.ingredient_quality !== 'verified'],
  ] as const)('filters ingredient data quality %s', (quality, test) => {
    expect(run({ quality })).toHaveLength(count(test));
  });

  it('has 185 base-linked distributor records in the fixture', () => {
    expect(run({ quality: 'base-linked' })).toHaveLength(185);
  });

  it('filters FRAC and IRAC groups via the reviewed reference', () => {
    expect(run({ frac: '4' })).toHaveLength(
      count((p) => p.ingredients.some((a) => refCode(a.name, 'frac_code') === '4')),
    );
    expect(run({ irac: '4A' })).toHaveLength(
      count((p) => p.ingredients.some((a) => refCode(a.name, 'irac_code') === '4A')),
    );
  });

  it('separates "None reported" from "Not supplied" signal words', () => {
    expect(run({ signal: 'NONE' })).toHaveLength(count((p) => p.safety?.signal_word === 'NONE'));
    expect(run({ signal: 'NONE' })).toHaveLength(25);
    expect(run({ signal: 'NOT_SUPPLIED' })).toHaveLength(count((p) => !p.safety?.signal_word));
    expect(run({ signal: 'NOT_SUPPLIED' })).toHaveLength(187);
    expect(run({ signal: 'DANGER' }).every((p) => signalKey(p) === 'DANGER')).toBe(true);
  });

  it('filters the restricted-use flag', () => {
    expect(run({ rup: 'yes' })).toHaveLength(19);
    expect(run({ rup: 'no' })).toHaveLength(count((p) => p.safety?.restricted_use === false));
    expect(run({ rup: 'unknown' })).toHaveLength(count((p) => p.safety?.restricted_use == null));
  });

  it('filters by status date range', () => {
    expect(run({ start: '2026-01-01' })).toHaveLength(count((p) => p.status_date >= '2026-01-01'));
    expect(run({ end: '2000-01-01' })).toHaveLength(count((p) => p.status_date <= '2000-01-01'));
  });

  it('rejects a start date after the end date', () => {
    const result = filterProducts(catalog, { ...base(), start: '2099-01-01', end: '2026-01-01' });
    expect(result).toEqual({ invalidDates: true, products: [] });
    expect(countText(result)).toBe('Check your dates');
    expect(invalidDateRange({ start: '2026-01-01', end: '2026-01-01' })).toBe(false);
    expect(invalidDateRange({ start: '2026-01-02', end: '' })).toBe(false);
  });

  it('sorts by name or by newest status date', () => {
    const byName = run({}).map((p) => p.name);
    expect(byName).toEqual([...byName].sort((a, b) => a.localeCompare(b)));
    const byDate = run({ sort: 'updated' }).map((p) => p.status_date);
    expect(byDate).toEqual([...byDate].sort().reverse());
  });
});

describe('result summary', () => {
  it('counts products', () => {
    expect(countText({ invalidDates: false, products: all.slice(0, 1) })).toBe('1 product');
    expect(countText({ invalidDates: false, products: all })).toBe('880 products');
  });

  it('paginates 25 per page', () => {
    expect(PAGE_SIZE).toBe(25);
    expect(pageInfo(880, 1).label).toBe('1–25 of 880 · Page 1 of 36');
    expect(pageInfo(880, 2).label).toBe('26–50 of 880 · Page 2 of 36');
    expect(pageInfo(880, 99).page).toBe(36);
    expect(pageInfo(880, 36).label).toBe('876–880 of 880 · Page 36 of 36');
    expect(pageInfo(0, 1)).toMatchObject({ page: 1, pages: 1 });
  });

  it('summarises the site picker', () => {
    expect(siteSummary([])).toBe('All 14 seed-treatment sites');
    expect(siteSummary(['a'])).toBe('1 site selected');
    expect(siteSummary(['a', 'b'])).toBe('2 sites selected');
  });

  it('lists applied filters in display order with readable labels', () => {
    const chips = appliedFilters(
      {
        ...base(),
        query: '  fludioxonil ',
        sites: ['Corn (seed treatment)'],
        purpose: 'Fungicide',
        technology: 'Conventional Chemical',
        manufacturer: 'Bayer',
        frac: '4',
        irac: '4A',
        signal: 'NONE',
        rup: 'unknown',
        quality: 'needs-review',
        start: '2020-01-01',
        end: '2026-10-19',
      },
      '2026-10-19',
    );
    expect(chips.map((c) => c.label)).toEqual([
      'Search: “fludioxonil”',
      'Corn',
      'Fungicide',
      'Conventional Chemical',
      'Bayer',
      'FRAC 4',
      'IRAC 4A',
      'Signal: None reported',
      'Restricted-use flag: Not supplied',
      'Needs review',
      'Status date: Jan 1, 2020 – Oct 19, 2026',
    ]);
  });

  it('labels the restricted-use chip like the filter options', () => {
    const label = (rup: Filters['rup']) => appliedFilters({ ...base(), rup }, '')[0].label;
    expect(label('yes')).toBe('Restricted-use flag: Yes');
    expect(label('no')).toBe('Restricted-use flag: No');
    expect(label('unknown')).toBe('Restricted-use flag: Not supplied');
  });

  it('shows the date range only when it differs from the default', () => {
    const defaults = { ...base(), end: '2026-10-19' };
    expect(appliedFilters(defaults, '2026-10-19')).toEqual([]);
    expect(appliedFilters({ ...defaults, end: '2026-01-01' }, '2026-10-19')[0].label).toBe(
      'Status date: to Jan 1, 2026',
    );
    expect(
      appliedFilters({ ...defaults, end: '', start: '2026-01-01' }, '2026-10-19')[0].label,
    ).toBe('Status date: from Jan 1, 2026');
    expect(appliedFilters({ ...defaults, end: '' }, '2026-10-19')[0].label).toBe(
      'Status date: no end date',
    );
  });

  it('clears exactly the filter behind a chip', () => {
    const f = {
      ...base(),
      query: 'x',
      sites: ['Corn (seed treatment)', 'Wheat (seed treatment)'],
      rup: 'yes' as const,
      start: '2020-01-01',
      end: '2021-01-01',
    };
    const chips = appliedFilters(f, '2026-10-19');
    const byLabel = (l: string) => chips.find((c) => c.label.startsWith(l))!.key;
    expect(clearChip(f, byLabel('Search'), '2026-10-19').query).toBe('');
    expect(clearChip(f, byLabel('Corn'), '2026-10-19').sites).toEqual(['Wheat (seed treatment)']);
    expect(clearChip(f, byLabel('Restricted'), '2026-10-19').rup).toBe('');
    expect(clearChip(f, byLabel('Status date'), '2026-10-19')).toMatchObject({
      start: '',
      end: '2026-10-19',
      query: 'x',
    });
  });
});

describe('reset and options', () => {
  it('reset clears everything except sort and sets the end to the import cutoff', () => {
    const f = resetFilters({ sort: 'updated' }, catalog, '2030-01-01');
    expect(f).toMatchObject({
      query: '',
      sites: [],
      start: '',
      sort: 'updated',
      end: '2026-10-19',
    });
    expect(
      resetFilters(
        { sort: 'name' },
        { meta: { ...catalog.meta, status_date_end: undefined } },
        '2030-01-01',
      ).end,
    ).toBe('2030-01-01');
  });

  it('builds sorted, de-duplicated select options from the catalog', () => {
    const o = categoryOptions(catalog);
    expect(o.manufacturer).toEqual([...new Set(all.map((p) => p.registrant))].sort());
    expect(o.technology).toContain('Plant-Incorp. Protectant');
    expect(o.irac).toContain('4A');
  });

  it('drops select values that no longer exist after a catalog update', () => {
    const o = categoryOptions(catalog);
    const kept = keepValidSelections({ ...base(), purpose: 'Gone', frac: '4', query: 'x' }, o);
    expect(kept).toMatchObject({ purpose: '', frac: '4', query: 'x' });
  });
});
