import { describe, expect, it } from 'vitest';
import { MATRIX_NOTE, labelSpec, matrixRows, matrixSections } from '../../src/lib/matrix';
import { FIXTURE_TODAY, fixtureCatalog } from './fixtures';

const catalog = fixtureCatalog();
const saltro = catalog.products.find((p) => p.id === '100-1648')!;
const lumitreo = catalog.products.find((p) => p.id === '352-937')!;

describe('labelSpec guards (ported from legacy logic_test)', () => {
  it('uses a reviewed extract that still matches', () => {
    const x = labelSpec(catalog, saltro, FIXTURE_TODAY);
    expect(x.ready).toBe(true);
    expect(x.reason).toBe('Reviewed extract for Soybeans; other uses not summarized');
  });

  it('has nothing for products without an extract', () => {
    expect(
      labelSpec(catalog, { ...saltro, registration_number: '100-1648-999' }, FIXTURE_TODAY),
    ).toEqual({
      record: null,
      ready: false,
      reason: 'No reviewed label extract loaded',
    });
  });

  it('blocks a newer EPA label, a changed composition and an overdue review', () => {
    expect(
      labelSpec(catalog, { ...saltro, latest_label_date: '2026-10-01' }, FIXTURE_TODAY).reason,
    ).toBe('Review required: EPA label reference has changed');
    expect(
      labelSpec(
        catalog,
        { ...saltro, ingredients: [{ name: 'x', pc_code: '090110', percent: 40, cas: null }] },
        FIXTURE_TODAY,
      ).reason,
    ).toBe('Review required: formulation differs from the reviewed label');
    expect(labelSpec(catalog, saltro, '2028-01-01').reason).toBe('Label extract review is due');
    expect(labelSpec(catalog, saltro, '2026-01-01').ready).toBe(false);
  });
});

describe('matrixRows', () => {
  const rows = matrixRows(catalog, FIXTURE_TODAY);
  const row = (label: string) => {
    const r = rows.find((x) => x.section === undefined && x.label === label);
    if (!r || r.section !== undefined) throw new Error('missing row ' + label);
    return r;
  };

  it('has four sections in order', () => {
    expect(matrixSections(rows).map((s) => s.title)).toEqual([
      'Registration & formulation',
      'Crops & target pests',
      'Label specifications & warnings',
      'Sources & provenance',
    ]);
  });

  it('includes registration dates, groups, signal word and restricted-use flag', () => {
    for (const label of [
      'First EPA registration date',
      'FRAC fungicide groups',
      'IRAC insecticide groups',
      'EPA signal word',
      'EPA restricted-use flag',
    ])
      expect(row(label)).toBeTruthy();
  });

  it('shows reviewed label extract values and the product-wide pest index', () => {
    expect(row('Application rate / units').get(lumitreo).text).toContain('0.25 fl oz');
    const pests = row('EPA product-wide pest index').get(saltro);
    expect(pests.text).toMatch(/product-wide index/i);
    expect(pests.view.kind).toBe('pests');
  });

  it('says when no reviewed extract exists', () => {
    const other = catalog.products.find((p) => p.id === '100-1508')!;
    expect(row('Label extract coverage').get(other).text).toBe('No reviewed label extract loaded');
    expect(row('Reviewed label source / version').get(other).text).toBe(
      'No reviewed label extract loaded',
    );
  });

  it('never mentions efficacy', () => {
    const texts = rows.flatMap((r) =>
      r.section !== undefined
        ? [r.section]
        : [r.label, ...catalog.products.slice(0, 50).map((p) => r.get(p).text)],
    );
    expect(texts.join('\n')).not.toMatch(/efficacy/i);
    expect(MATRIX_NOTE).not.toMatch(/efficacy/i);
  });

  it('only links https sources', () => {
    const links = row('Product source links').get(saltro);
    expect(links.view.kind).toBe('links');
    if (links.view.kind === 'links')
      expect(links.view.links.every((l) => l.url.startsWith('https://'))).toBe(true);
  });
});
