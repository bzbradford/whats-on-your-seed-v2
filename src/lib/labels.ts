// Product label access. Ported from legacy `labelAccess` with its identity guards:
// only link an EPA PPLS PDF whose filename matches this exact Section 3 registration
// (never an inferred distributor label or a URL built from a registration/date).

import { fmt } from './format';
import type { Product } from './types';

export const EPA_LABEL_SEARCH = 'https://ordspub.epa.gov/ords/pesticides/f?p=PPLS:1';

export interface LabelAccess {
  /** Direct EPA PDF for this exact registration, or null. */
  pdf: string | null;
  /** YYYY-MM-DD from the PDF filename. */
  date: string | null;
  /** EPA PPLS lookup for this registration (or the generic search for distributors). */
  lookup: string;
  distributor: boolean;
  note: string;
}

const PPLS_PATH = /^\/pesticides\/chem_search\/ppls\/(\d{6})-(\d{5})-(\d{8})\.pdf$/;

export function labelAccess(p: Product): LabelAccess {
  const registration = String(p.registration_number || '');
  const parts = registration.split('-');
  const distributor = p.record_type === 'DP' || parts.length === 3;
  let pdf: string | null = null;
  let date: string | null = null;
  try {
    const u = new URL(p.safety?.label_url as string);
    const m = u.pathname.match(PPLS_PATH);
    if (
      !distributor &&
      /^\d+-\d+$/.test(registration) &&
      u.origin === 'https://www3.epa.gov' &&
      !u.username &&
      !u.password &&
      !u.search &&
      !u.hash &&
      m &&
      Number(m[1]) === Number(parts[0]) &&
      Number(m[2]) === Number(parts[1])
    ) {
      const stamped = m[3].slice(0, 4) + '-' + m[3].slice(4, 6) + '-' + m[3].slice(6, 8);
      if (!p.safety.label_date || p.safety.label_date === stamped) {
        pdf = u.href;
        date = stamped;
      }
    }
  } catch {
    // No usable label URL: fall back to a lookup.
  }
  const lookup =
    !distributor && /^\d+-\d+$/.test(registration)
      ? 'https://ordspub.epa.gov/ords/pesticides/f?p=PPLS:102:::NO::P102_REG_NUM:' +
        encodeURIComponent(registration)
      : EPA_LABEL_SEARCH;
  const note = pdf
    ? 'EPA file dated ' + fmt(date) + '. Use the PDF viewer’s download or save control.'
    : distributor
      ? 'No direct distributor PDF in this catalog. Search the full EPA number ' +
        registration +
        '; request the marketed label from the registrant if needed.'
      : 'No direct PDF in this catalog. Search EPA label records for ' + registration + '.';
  return { pdf, date, lookup, distributor, note };
}

/** Visible text and accessible name for a product's label link. */
export function labelActionText(p: Product, access: LabelAccess = labelAccess(p)) {
  const title = access.pdf ? 'Open / download label (PDF)' : 'Find product label';
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
