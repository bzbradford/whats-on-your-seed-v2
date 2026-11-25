import { describe, expect, it } from 'vitest';
import {
  RESULTS_HEADERS,
  exportToasts,
  csvCell,
  labelLinksCsv,
  matrixCsv,
  resultsCsv,
  toCsv,
} from '../../src/lib/csv';
import { comparisonProducts } from '../../src/lib/compare';
import { FIXTURE_TODAY, fixtureCatalog, publishedCatalog } from './fixtures';

const catalog = fixtureCatalog();
const lines = (csv: string) => csv.split('\r\n');

describe('csvCell (formula-injection safety)', () => {
  it.each([
    ['=1+1', `"'=1+1"`],
    ['+SUM(A1)', `"'+SUM(A1)"`],
    ['-2', `"'-2"`],
    ['@cmd', `"'@cmd"`],
    ['  =1', `"'  =1"`],
    ['a "quote"', '"a ""quote"""'],
    [null, '""'],
    [undefined, '""'],
    [1.04, '"1.04"'],
    ['plain', '"plain"'],
  ])('%j -> %s', (value, expected) => {
    expect(csvCell(value)).toBe(expected);
  });

  it('writes a BOM and CRLF rows', () => {
    expect(toCsv([['a'], ['b']])).toBe('﻿"a"\r\n"b"');
  });
});

describe('results CSV (ported from legacy logic_test)', () => {
  it('has one row per ingredient for every filtered product, across all pages', () => {
    const csv = resultsCsv(catalog, catalog.products);
    expect(lines(csv)).toHaveLength(
      1 + catalog.products.reduce((n, p) => n + Math.max(1, p.ingredients.length), 0),
    );
    for (const header of [
      'Workbook created',
      'Technology type',
      'FRAC fungicide group',
      'Signal word data state',
      'Warning basis',
      'Data-use notice',
    ])
      expect(RESULTS_HEADERS).toContain(header);
    expect(csv).not.toContain('State evidence sources and dates');
  });

  it('writes "Unknown" for a product without ingredients', () => {
    const missing = catalog.products.find((p) => !p.ingredients.length)!;
    expect(resultsCsv(catalog, [missing])).toContain('"Unknown"');
  });
});

describe('label links CSV', () => {
  it('covers every product and neutralises formulas', () => {
    expect(lines(labelLinksCsv(catalog.products))).toHaveLength(catalog.products.length + 1);
    expect(labelLinksCsv([{ ...catalog.products[0], name: '=1+1' }])).toContain(`'=1+1`);
  });

  it('marks distributor records as lookups with the full number', () => {
    const dp = catalog.products.find((p) => p.id === '5905-491-38167')!;
    const csv = labelLinksCsv([dp]);
    expect(csv).toContain('Lookup required');
    expect(csv).toContain('5905-491-38167');
  });
});

describe('matrix CSV', () => {
  it('has the products, notes, sources and label extract values, without efficacy', () => {
    const ps = comparisonProducts(catalog, ['100-1648', '7969-441', '352-937', '100-1508']);
    const csv = matrixCsv(catalog, ps, FIXTURE_TODAY);
    expect(csv).toContain('First EPA registration date');
    expect(csv).toContain('0.25 fl oz');
    expect(csv).toContain('https://www3.epa.gov/');
    expect(csv).toContain('EPA 352-937');
    expect(lines(csv)[1]).toBe(
      `"Prepared","${FIXTURE_TODAY}","${FIXTURE_TODAY}","${FIXTURE_TODAY}","${FIXTURE_TODAY}"`,
    );
    expect(csv).not.toMatch(/efficacy/i);
  });

  it('includes the current catalog products it compares', () => {
    const current = publishedCatalog();
    const ps = current.products.slice(0, 4);
    const csv = matrixCsv(current, ps);
    for (const p of ps) expect(csv).toContain(p.registration_number);
  });
});

describe('export toasts', () => {
  it('pluralise correctly', () => {
    expect(exportToasts.results(1)).toBe('1 product exported with source and quality fields.');
    expect(exportToasts.results(880)).toBe('880 products exported with source and quality fields.');
    expect(exportToasts.labels(1)).toMatch(/^1 product exported in the label-link CSV/);
  });
});
