// Comparison matrix rows (screen and CSV share one definition) and the reviewed
// label-extract guards. Ported from legacy `labelSpec` / `matrixRows`.
// The matrix deliberately carries no efficacy content.

import { fmt, localDate, shortSite } from './format';
import { labelAccess, type LabelAccess } from './labels';
import {
  coverageText,
  groupText,
  quality,
  recordTypeText,
  ref,
  rupText,
  signalText,
} from './product-facts';
import type { Catalog, IngredientReference, LabelSpecRecord, Product } from './types';

export interface LabelSpecResult {
  record: LabelSpecRecord | null;
  ready: boolean;
  reason: string;
}

const signature = (ais: { pc_code: string | null; percent: number | null }[]) =>
  ais
    .map((a) => `${a.pc_code}:${a.percent}`)
    .sort()
    .join('|');

/**
 * The reviewed label extract for a product, if it still applies: same composition,
 * same EPA label reference, and a current review.
 */
export function labelSpec(catalog: Catalog, p: Product, today = localDate()): LabelSpecResult {
  const r = catalog.label_specs?.records?.find(
    (x) => x.registration_number === p.registration_number,
  );
  if (!r) return { record: null, ready: false, reason: 'No reviewed label extract loaded' };
  if (signature(p.ingredients) !== signature(r.composition))
    return {
      record: r,
      ready: false,
      reason: 'Review required: formulation differs from the reviewed label',
    };
  if (
    (p.latest_label_date && p.latest_label_date > r.label_date) ||
    (p.safety?.label_date && p.safety.label_date !== r.label_date) ||
    (p.safety?.label_url && p.safety.label_url !== r.source_url)
  )
    return { record: r, ready: false, reason: 'Review required: EPA label reference has changed' };
  if (r.reviewed_on > today || r.review_due < today)
    return { record: r, ready: false, reason: 'Label extract review is due' };
  return {
    record: r,
    ready: true,
    reason: `Reviewed extract for ${shortSite(r.crop)}; other uses not summarized`,
  };
}

export interface CellLink {
  url: string;
  label: string;
}

/** How a cell renders on screen. `text` on the cell is the CSV value. */
export type CellView =
  | { kind: 'text'; text: string }
  | { kind: 'links'; links: CellLink[]; empty: string }
  | { kind: 'pests'; pests: string | null }
  | { kind: 'label'; product: Product; access: LabelAccess };

export interface MatrixCell {
  text: string;
  view: CellView;
}

export type MatrixRow =
  { section: string } | { section?: undefined; label: string; get: (p: Product) => MatrixCell };

export const MATRIX_NOTE =
  'Dates are separate: first registration, status change and label version. EPA percentages are not application rates. The EPA pest index spans the whole product, not a specific crop use. Label extracts cover only their stated crop and label version; consult the current container label and seed tag. Missing information means not reviewed or not supplied. Provider availability does not establish state approval.';

const textCell = (text: string | null | undefined): MatrixCell => {
  const t = String(text ?? 'Not supplied');
  return { text: t, view: { kind: 'text', text: t } };
};

export function matrixRows(catalog: Catalog, today = localDate()): MatrixRow[] {
  const reference = catalog.ingredient_reference || {};
  const rows: MatrixRow[] = [];
  const section = (label: string) => rows.push({ section: label });
  const row = (label: string, get: (p: Product) => MatrixCell) => rows.push({ label, get });
  const plain = (label: string, get: (p: Product) => string | null | undefined) =>
    row(label, (p) => textCell(get(p) || 'Not supplied'));
  const spec =
    (field: 'targets' | 'rate' | 'application' | 'rei' | 'ppe' | 'restrictions') =>
    (p: Product) => {
      const x = labelSpec(catalog, p, today);
      return x.ready && x.record
        ? shortSite(x.record.crop) + ': ' + x.record[field]
        : x.reason + '; consult the full product label.';
    };

  section('Registration & formulation');
  plain(
    'EPA registration / record type',
    (p) => p.registration_number + ' · ' + recordTypeText(p.record_type, true),
  );
  plain('Registrant / manufacturer', (p) => p.registrant);
  plain('First EPA registration date', (p) => fmt(p.first_registration_date));
  plain(
    'EPA status date',
    (p) => fmt(p.status_date) + ' · ' + (p.epa_status_description || p.status),
  );
  plain('Latest label date in EPA export', (p) => fmt(p.latest_label_date));
  plain('Active ingredients / EPA percentages', (p) =>
    p.ingredients.length
      ? p.ingredients
          .map(
            (a) =>
              a.name +
              ' · ' +
              (a.percent == null ? 'Percentage not supplied' : a.percent + '%') +
              ' · EPA PC ' +
              (a.pc_code || 'not supplied'),
          )
          .join('\n')
      : 'Ingredients not supplied',
  );
  plain(
    'Ingredient evidence',
    (p) =>
      (p.ingredient_basis || quality(p)) +
      (p.base_registration ? ' · Base EPA ' + p.base_registration : '') +
      '\n' +
      quality(p),
  );
  plain('EPA product categories', (p) => p.purposes.join('; '));
  plain('Formulation / physical form', (p) => p.physical_form);
  plain('FRAC fungicide groups', (p) => groupText(reference, p, 'frac'));
  plain('IRAC insecticide groups', (p) => groupText(reference, p, 'irac'));
  plain('Ingredient mode of action', (p) =>
    p.ingredients
      .map(
        (a) => a.name + ': ' + ref(reference, a).group + ' — ' + ref(reference, a).classification,
      )
      .join('\n'),
  );
  plain('Group review coverage', (p) => coverageText(reference, p));
  row('Classification sources', (p) => {
    const refs = [
      ...new Map(
        p.ingredients
          .map((a) => ref(reference, a))
          .filter((a): a is IngredientReference & { source_url: string } => Boolean(a.source_url))
          .map((a) => [a.source_url, a]),
      ).values(),
    ];
    const empty = 'No reviewed classification source';
    return {
      text:
        refs
          .map((a) => `${a.source_version} | reviewed ${a.reviewed_on} | ${a.source_url}`)
          .join('\n') || empty,
      view: {
        kind: 'links',
        links: refs.map((a) => ({
          url: a.source_url,
          label: a.source_version + ' · reviewed ' + fmt(a.reviewed_on),
        })),
        empty,
      },
    };
  });

  section('Crops & target pests');
  plain('Matching seed-treatment sites', (p) => p.sites.join('\n'));
  plain('Crop-specific labeled targets — reviewed extract', spec('targets'));
  row('EPA product-wide pest index', (p) => {
    const text = p.target_pests_raw || 'Not supplied';
    return {
      text:
        text +
        '\nProduct-wide index; not specific to a seed-treatment crop. Verify crop and pest on the label.',
      view: { kind: 'pests', pests: p.target_pests_raw || null },
    };
  });

  section('Label specifications & warnings');
  plain('Label extract coverage', (p) => labelSpec(catalog, p, today).reason);
  plain('Application rate / units', spec('rate'));
  plain('Application method / equipment', spec('application'));
  plain('Restricted-entry interval (REI)', spec('rei'));
  plain('Personal protective equipment (PPE)', spec('ppe'));
  plain('Selected label restrictions', spec('restrictions'));
  plain('EPA signal word', (p) => signalText(p) + '\n' + (p.safety?.basis || 'EPA source row'));
  plain(
    'EPA restricted-use flag',
    (p) =>
      rupText(p) + (p.safety?.restricted_use_reason ? ' · ' + p.safety.restricted_use_reason : ''),
  );
  row('Reviewed label source / version', (p) => {
    const x = labelSpec(catalog, p, today);
    const r = x.record;
    if (!r) return textCell('No reviewed label extract loaded');
    const label = `${r.source_product_name} · label ${fmt(r.label_date)} · ${r.pages} · reviewed ${fmt(r.reviewed_on)} · review due ${fmt(r.review_due)}${x.ready ? '' : ' · ' + x.reason}`;
    return {
      text: label + ' | ' + r.source_url,
      view: { kind: 'links', links: [{ url: r.source_url, label }], empty: '' },
    };
  });
  row('Product label download / lookup', (p) => {
    const x = labelAccess(p);
    return {
      text:
        (x.pdf ? 'EPA PDF | ' + x.pdf + ' | ' + fmt(x.date) + '\n' : '') +
        'EPA lookup | ' +
        x.lookup +
        '\n' +
        x.note,
      view: { kind: 'label', product: p, access: x },
    };
  });

  section('Sources & provenance');
  plain('EPA workbook created', (p) => fmt(p.source_snapshot_date));
  plain('Catalog import date', (p) => fmt(p.imported_at || p.retrieved_at));
  row('Product source links', (p) => {
    const rs: [string, string][] = [
      [p.source_url, p.source],
      ...(p.greenbook ? [[p.greenbook.source_url, 'Greenbook'] as [string, string]] : []),
      ...(p.cdms ? [[p.cdms.source_url, 'CDMS / labels / SDS'] as [string, string]] : []),
    ];
    return {
      text: rs.map(([url, name]) => name + ' | ' + url).join('\n'),
      view: { kind: 'links', links: rs.map(([url, label]) => ({ url, label })), empty: '' },
    };
  });
  return rows;
}

/** Matrix row groups: one per section, each with its rows (for <tbody> grouping). */
export function matrixSections(rows: MatrixRow[]) {
  const sections: { title: string; rows: Extract<MatrixRow, { label: string }>[] }[] = [];
  for (const r of rows) {
    if (r.section !== undefined) sections.push({ title: r.section, rows: [] });
    else sections[sections.length - 1]?.rows.push(r);
  }
  return sections;
}
