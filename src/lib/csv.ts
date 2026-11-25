// CSV exports: results (one row per ingredient), label links, comparison matrix.
// Cells are always quoted, and values starting with = + - @ (after optional
// whitespace) get a leading apostrophe so spreadsheets don't run them as formulas.

import { count, localDate } from './format';
import { labelAccess } from './labels';
import { MATRIX_NOTE, matrixRows } from './matrix';
import { quality, ref, rupText, signalText } from './product-facts';
import type { Catalog, Product } from './types';

export function csvCell(value: unknown): string {
  let v = String(value ?? '');
  if (/^[\s]*[=+\-@]/.test(v)) v = "'" + v;
  return '"' + v.replace(/"/g, '""') + '"';
}

/** UTF-8 BOM (for Excel) + CRLF rows. */
export function toCsv(rows: unknown[][]): string {
  return '﻿' + rows.map((r) => r.map(csvCell).join(',')).join('\r\n');
}

export const DATA_USE_NOTICE =
  'Educational reference only. Data may be incomplete, inaccurate or out of date. Verify current labels, federal/state registration and applicable restrictions before use.';

export const RESULTS_HEADERS = [
  'Product',
  'EPA registration',
  'Registrant',
  'Sites in scope',
  'Ingredient',
  'EPA reported percent; see source for basis',
  'Purpose',
  'Mode-of-action group',
  'Data quality',
  'EPA status in supplied export',
  'EPA status date',
  'Workbook created',
  'Imported',
  'Source URL',
  'Ingredient evidence URL',
  'CDMS URL',
  'Notes',
  'Ingredient basis',
  'Base EPA registration',
  'Source sheet row',
  'EPA ingredient code',
  'Technology type',
  'FRAC fungicide group',
  'IRAC insecticide group',
  'Classification reference version',
  'Classification reviewed',
  'EPA signal word',
  'Signal word data state',
  'EPA restricted-use flag',
  'EPA restricted-use reason',
  'EPA label URL from workbook',
  'Warning basis',
  'Data-use notice',
];

/** All filtered products (every page), one row per ingredient. */
export function resultsCsv(catalog: Catalog, products: Product[]): string {
  const reference = catalog.ingredient_reference || {};
  const rows: unknown[][] = [RESULTS_HEADERS];
  for (const p of products) {
    const ingredients = p.ingredients.length
      ? p.ingredients
      : [{ name: 'Unknown', percent: null, pc_code: undefined }];
    for (const a of ingredients) {
      const r = ref(reference, a);
      rows.push([
        p.name,
        p.registration_number,
        p.registrant,
        p.sites.join('; '),
        a.name,
        a.percent,
        r.purpose,
        r.group,
        quality(p),
        p.epa_verified ? 'Yes' : 'No',
        p.status_date,
        p.source_snapshot_date,
        p.imported_at || p.retrieved_at,
        p.source_url,
        p.ingredient_source_url || p.source_url,
        p.cdms?.source_url || '',
        p.notes,
        p.ingredient_basis,
        p.base_registration,
        p.source_row,
        a.pc_code,
        p.pesticide_type,
        r.frac_code || 'Not reviewed',
        r.irac_code || 'Not reviewed',
        r.source_version,
        r.reviewed_on,
        signalText(p),
        p.safety?.signal_word_state || 'missing',
        rupText(p),
        p.safety?.restricted_use_reason,
        p.safety?.label_url,
        p.safety?.basis || 'Not supplied',
        DATA_USE_NOTICE,
      ]);
    }
  }
  return toCsv(rows);
}

export function labelLinksCsv(products: Product[]): string {
  const rows: unknown[][] = [
    [
      'Product',
      'EPA registration',
      'Registrant',
      'Record type',
      'Label access',
      'EPA PDF URL',
      'EPA file date',
      'EPA label lookup URL',
      'Instructions',
      'Workbook created',
      'Label use note',
      'Data-use notice',
    ],
  ];
  for (const p of products) {
    const x = labelAccess(p);
    rows.push([
      p.name,
      p.registration_number,
      p.registrant,
      p.record_type,
      x.pdf ? 'Direct EPA PDF' : 'Lookup required',
      x.pdf || '',
      x.date || '',
      x.lookup,
      x.note,
      p.source_snapshot_date,
      'Check the current container label, seed tag and state requirements. EPA files may include master, supplemental or historical labeling.',
      'Educational reference only; data may be incomplete, inaccurate or out of date. Verify current federal and state registration and use requirements.',
    ]);
  }
  return toCsv(rows);
}

export function matrixCsv(catalog: Catalog, products: Product[], today = localDate()): string {
  const rows: unknown[][] = [
    ['Comparison field', ...products.map((p) => p.name + ' | EPA ' + p.registration_number)],
    ['Prepared', ...products.map(() => today)],
    ['Comparison notes', ...products.map(() => MATRIX_NOTE)],
  ];
  for (const r of matrixRows(catalog, today))
    rows.push(
      r.section !== undefined
        ? [r.section, ...products.map(() => '')]
        : [r.label, ...products.map((p) => r.get(p).text)],
    );
  return toCsv(rows);
}

/** Toasts after an export (legacy wording, correctly pluralised). */
export const exportToasts = {
  results: (n: number) => `${count(n, 'product')} exported with source and quality fields.`,
  labels: (n: number) =>
    `${count(n, 'product')} exported in the label-link CSV. PDF documents are opened separately.`,
};

export const exportFileNames = {
  results: (today = localDate()) => 'CPN-seed-treatment-' + today + '.csv',
  labels: (today = localDate()) => 'CPN-label-links-' + today + '.csv',
  matrix: (today = localDate()) => 'CPN-seed-treatment-comparison-' + today + '.csv',
};

/** Trigger a browser download of CSV text. */
export function downloadCsv(text: string, filename: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
