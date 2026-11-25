import { describe, expect, it } from 'vitest';
import { labelAccess, labelActionText, workbookLabelFile } from '../../src/lib/labels';
import { fixtureCatalog, publishedCatalog } from './fixtures';

const catalog = fixtureCatalog();
const labelProduct = catalog.products.find((p) => p.safety?.label_url)!;
const distributor = catalog.products.find((p) => p.record_type === 'DP')!;

describe('labelAccess (ported from legacy logic_test)', () => {
  it('links the exact-registration EPA PDF', () => {
    const x = labelAccess(labelProduct);
    expect(x.pdf).toBe(labelProduct.safety.label_url);
    expect(x.note).toMatch(/^EPA-accepted label, filed /);
    expect(x.note).toContain('acceptance letter');
    expect(x.supplemental).toEqual([]);
    expect(labelActionText(labelProduct).title).toBe('EPA-accepted label (PDF)');
  });

  it('never gives a distributor a PDF, and keeps its full number in the note', () => {
    expect(labelAccess(distributor).pdf).toBeNull();
    expect(labelAccess(distributor).note).toContain(distributor.registration_number);
    expect(labelAccess({ ...distributor, safety: labelProduct.safety }).pdf).toBeNull();
  });

  it('rejects mismatched registrations, other hosts, unsafe schemes and stale dates', () => {
    const s = labelProduct.safety;
    expect(labelAccess({ ...labelProduct, registration_number: '999999-99999' }).pdf).toBeNull();
    expect(
      labelAccess({ ...labelProduct, safety: { ...s, label_url: 'javascript:alert(1)' } }).pdf,
    ).toBeNull();
    expect(
      labelAccess({
        ...labelProduct,
        safety: { ...s, label_url: s.label_url!.replace('www3.epa.gov', 'example.com') },
      }).pdf,
    ).toBeNull();
    expect(
      labelAccess({ ...labelProduct, safety: { ...s, label_url: s.label_url + '?x=1' } }).pdf,
    ).toBeNull();
    expect(
      labelAccess({ ...labelProduct, safety: { ...s, label_date: '2000-01-01' } }).pdf,
    ).toBeNull();
  });

  it('falls back to an EPA lookup for the registration', () => {
    const x = labelAccess({ ...labelProduct, safety: {} });
    expect(x.lookup.endsWith(labelProduct.registration_number)).toBe(true);
    expect(labelActionText({ ...labelProduct, safety: {} }).title).toBe('Find product label');
  });

  it('has the legacy count of direct PDFs in the fixture (628)', () => {
    expect(catalog.products.filter((p) => labelAccess(p).pdf)).toHaveLength(628);
  });

  it('gives every current product a PDF or lookup, and no distributor a PDF', () => {
    const current = publishedCatalog();
    expect(current.products.every((p) => labelAccess(p).pdf || labelAccess(p).lookup)).toBe(true);
    expect(
      current.products.filter((p) => p.record_type === 'DP').every((p) => !labelAccess(p).pdf),
    ).toBe(true);
    expect(current.products.filter((p) => labelAccess(p).pdf).length).toBe(
      current.products.filter((p) => p.safety?.label_url).length,
    );
  });

  it('names the product in the accessible label', () => {
    expect(labelActionText(labelProduct).ariaLabel).toContain(labelProduct.registration_number);
  });
});

describe('workbookLabelFile (safety panel link)', () => {
  it('links the workbook file only when it passes the identity guards', () => {
    expect(workbookLabelFile(labelProduct)).toEqual({
      url: labelProduct.safety.label_url,
      date: labelAccess(labelProduct).date,
    });
    expect(workbookLabelFile({ ...distributor, safety: labelProduct.safety })).toBeNull();
    expect(
      workbookLabelFile({
        ...labelProduct,
        safety: { ...labelProduct.safety, label_date: '2000-01-01' },
      }),
    ).toBeNull();
    expect(workbookLabelFile({ ...labelProduct, safety: {} })).toBeNull();
  });
});

describe('supplemental-only labeling', () => {
  const reg = labelProduct.registration_number;
  const [a, b] = reg.split('-').map(Number);
  const file = (date: string) =>
    `https://www3.epa.gov/pesticides/chem_search/ppls/${String(a).padStart(6, '0')}-${String(b).padStart(5, '0')}-${date.replaceAll('-', '')}.pdf`;
  const withSupplemental = (list: unknown[]) => ({
    ...labelProduct,
    safety: { ...labelProduct.safety, supplemental_labels: list as never },
  });

  it('lists guarded supplemental files and says so in the note', () => {
    const x = labelAccess(
      withSupplemental([{ url: file('2099-01-02'), date: '2099-01-02', description: 'New use' }]),
    );
    expect(x.pdf).toBe(labelProduct.safety.label_url);
    expect(x.supplemental).toEqual([
      { url: file('2099-01-02'), date: '2099-01-02', description: 'New use' },
    ]);
    expect(x.note).toContain('Newer supplemental labeling is listed separately');
  });

  it('drops supplemental files that fail the identity guards', () => {
    const x = labelAccess(
      withSupplemental([
        { url: 'https://example.com/x.pdf', date: '2099-01-02', description: 'Other host' },
        { url: file('2099-01-02'), date: '2099-01-03', description: 'Date mismatch' },
        {
          url: file('2099-01-02').replace(/\d{6}-/, '999999-'),
          date: '2099-01-02',
          description: 'Wrong reg',
        },
      ]),
    );
    expect(x.supplemental).toEqual([]);
  });

  it('never lists supplemental files for a distributor record', () => {
    const x = labelAccess({
      ...withSupplemental([
        { url: file('2099-01-02'), date: '2099-01-02', description: 'New use' },
      ]),
      record_type: 'DP',
    });
    expect(x.supplemental).toEqual([]);
  });
});
