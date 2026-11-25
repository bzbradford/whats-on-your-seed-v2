// Product label access. Ported from legacy `labelAccess` with its identity guards:
// only link an EPA PPLS PDF whose filename matches this exact Section 3 registration
// (never an inferred distributor label or a URL built from a registration/date).

import { fmt } from './format';
import type { Product } from './types';

export const EPA_LABEL_SEARCH = 'https://ordspub.epa.gov/ords/pesticides/f?p=PPLS:1';

export interface LabelAccess {
  /** Direct EPA PDF of the newest full label for this exact registration, or null. */
  pdf: string | null;
  /** YYYY-MM-DD from the PDF filename. */
  date: string | null;
  /** Newer supplemental-only EPA files for this registration, newest first (same guards). */
  supplemental: { url: string; date: string; description: string }[];
  /** EPA PPLS lookup for this registration (or the generic search for distributors). */
  lookup: string;
  distributor: boolean;
  note: string;
}

const PPLS_PATH = /^\/pesticides\/chem_search\/ppls\/(\d{6})-(\d{5})-(\d{8})\.pdf$/;

/**
 * An EPA PPLS PDF URL for exactly this Section 3 registration, with the date from its
 * filename; null for anything else (other hosts, query strings, mismatched numbers, or a
 * filename date that disagrees with `expectedDate`).
 */
function pplsFile(
  url: unknown,
  registration: string,
  expectedDate?: string | null,
): { url: string; date: string } | null {
  const parts = registration.split('-');
  if (!/^\d+-\d+$/.test(registration)) return null;
  try {
    const u = new URL(url as string);
    const m = u.pathname.match(PPLS_PATH);
    if (
      u.origin !== 'https://www3.epa.gov' ||
      u.username ||
      u.password ||
      u.search ||
      u.hash ||
      !m ||
      Number(m[1]) !== Number(parts[0]) ||
      Number(m[2]) !== Number(parts[1])
    )
      return null;
    const date = m[3].slice(0, 4) + '-' + m[3].slice(4, 6) + '-' + m[3].slice(6, 8);
    if (expectedDate && expectedDate !== date) return null;
    return { url: u.href, date };
  } catch {
    return null;
  }
}

export function labelAccess(p: Product): LabelAccess {
  const registration = String(p.registration_number || '');
  const distributor = p.record_type === 'DP' || registration.split('-').length === 3;
  const file = distributor
    ? null
    : pplsFile(p.safety?.label_url, registration, p.safety?.label_date);
  const supplemental = distributor
    ? []
    : (p.safety?.supplemental_labels ?? []).flatMap((s) => {
        const f = pplsFile(s?.url, registration, s?.date);
        return f ? [{ ...f, description: String(s.description || 'Supplemental labeling') }] : [];
      });
  const pdf = file?.url ?? null;
  const date = file?.date ?? null;
  const lookup =
    !distributor && /^\d+-\d+$/.test(registration)
      ? 'https://ordspub.epa.gov/ords/pesticides/f?p=PPLS:102:::NO::P102_REG_NUM:' +
        encodeURIComponent(registration)
      : EPA_LABEL_SEARCH;
  const note = pdf
    ? 'EPA-accepted label, filed ' +
      fmt(date) +
      '. The PDF opens with EPA’s acceptance letter; the label follows it. This is EPA’s master label, which can differ from the label on the container.' +
      (supplemental.length ? ' Newer supplemental labeling is listed separately.' : '')
    : supplemental.length
      ? 'Only supplemental labeling is available as a direct EPA file. Search EPA label records for the full label.'
      : distributor
        ? 'No direct distributor PDF in this catalog. Search the full EPA number ' +
          registration +
          '; request the marketed label from the registrant if needed.'
        : 'No direct PDF in this catalog. Search EPA label records for ' + registration + '.';
  return { pdf, date, supplemental, lookup, distributor, note };
}

/** Visible text and accessible name for a product's label link. */
export function labelActionText(p: Product, access: LabelAccess = labelAccess(p)) {
  const title = access.pdf ? 'EPA-accepted label (PDF)' : 'Find product label';
  return {
    title,
    href: access.pdf || access.lookup,
    ariaLabel: `${title} for ${p.name}, EPA ${p.registration_number} (opens in a new tab)`,
  };
}

/**
 * The workbook's label file for the dialog's safety panel, only when it passes the same
 * identity guards as the label buttons (exact Section 3 registration, EPA PPLS file,
 * matching date). Legacy linked `safety.label_url` here unchecked while calling it an
 * "Exact registration match".
 */
export function workbookLabelFile(p: Product): { url: string; date: string | null } | null {
  const x = labelAccess(p);
  return x.pdf ? { url: x.pdf, date: x.date } : null;
}
