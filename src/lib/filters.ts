// Products tab: search, filters, sort, pagination, applied-filter summary.
// Ported from legacy `render()`; semantics (token search over a haystack, exact
// site matching, signal "None reported" vs "Not supplied", date range) unchanged.

import { fmt, localDate, norm, s, shortSite } from './format';
import { moaGroups, ref, signalKey, type ReferenceMap } from './product-facts';
import type { Catalog, Product } from './types';

export const PAGE_SIZE = 25;

export type SortKey = 'name' | 'updated';
export type RupFilter = '' | 'yes' | 'no' | 'unknown';
export type QualityFilter = '' | 'verified' | 'base-linked' | 'needs-review';

export interface Filters {
  query: string;
  sites: string[];
  purpose: string;
  technology: string;
  manufacturer: string;
  quality: QualityFilter;
  frac: string;
  irac: string;
  /** '' | 'DANGER' | 'WARNING' | 'CAUTION' | 'NONE' | 'NOT_SUPPLIED' */
  signal: string;
  rup: RupFilter;
  /** YYYY-MM-DD or '' */
  start: string;
  end: string;
  sort: SortKey;
}

/** Default end date: the catalog's import cutoff, else today (America/Chicago). */
export function defaultEnd(catalog: Pick<Catalog, 'meta'>, today = localDate()): string {
  return catalog.meta.status_date_end || today;
}

/** Filters after "Clear filters": everything blank except the end date. Sort is kept. */
export function resetFilters(
  current: Pick<Filters, 'sort'>,
  catalog: Pick<Catalog, 'meta'>,
  today = localDate(),
): Filters {
  return {
    query: '',
    sites: [],
    purpose: '',
    technology: '',
    manufacturer: '',
    quality: '',
    frac: '',
    irac: '',
    signal: '',
    rup: '',
    start: '',
    end: defaultEnd(catalog, today),
    sort: current.sort,
  };
}

export function emptyFilters(): Filters {
  return resetFilters({ sort: 'name' }, { meta: {} as Catalog['meta'] }, '');
}

/** Start after end is invalid (both must be set). */
export function invalidDateRange(f: Pick<Filters, 'start' | 'end'>): boolean {
  return !!(f.start && f.end && f.start > f.end);
}

export const DATE_ERROR = 'Start date must be on or before the end date.';

const haystacks = new WeakMap<Product, string>();

/** Lowercased text searched by the product search box. */
export function haystack(reference: ReferenceMap, p: Product): string {
  let hay = haystacks.get(p);
  if (hay === undefined) {
    hay = [
      p.name,
      p.registration_number,
      p.registrant,
      p.alternate_names_raw || '',
      ...(p.aliases || []),
      ...p.ingredients.flatMap((a) => [a.name, ...(ref(reference, a).synonyms || [])]),
      ...p.ingredients.map((a) => ref(reference, a).group),
    ]
      .join(' ')
      .toLowerCase();
    haystacks.set(p, hay);
  }
  return hay;
}

/** Every whitespace-separated term of the (normalised) query must appear in the haystack. */
export function matchesQuery(hay: string, query: string): boolean {
  const q = norm(query);
  return !q || q.split(/\s+/).every((t) => hay.includes(t));
}

export function matchesFilters(catalog: Catalog, p: Product, f: Filters): boolean {
  const reference = catalog.ingredient_reference || {};
  const { frac, irac, signal, rup, sites, purpose, technology, manufacturer, start, end } = f;
  const q = f.quality;
  return (
    (!frac || moaGroups(reference, p, 'frac').includes(frac)) &&
    (!irac || moaGroups(reference, p, 'irac').includes(irac)) &&
    (!signal || signalKey(p) === signal) &&
    (!rup ||
      (rup === 'yes'
        ? p.safety?.restricted_use === true
        : rup === 'no'
          ? p.safety?.restricted_use === false
          : p.safety?.restricted_use == null)) &&
    matchesQuery(haystack(reference, p), f.query) &&
    (!sites.length || sites.some((site) => p.sites.includes(site))) &&
    (!purpose || p.purposes.includes(purpose)) &&
    (!technology || p.pesticide_type === technology) &&
    (!manufacturer || p.registrant === manufacturer) &&
    // "Needs review / missing fields" deliberately matches every record whose ingredients
    // are not a complete EPA product row: missing, partial, and base-linked distributor
    // records (ingredients taken from the base registration; the UI says "check
    // distributor label"). The legacy logic tests encode this; see PLAN.md Phase 3.
    (!q ||
      (q === 'verified'
        ? p.ingredient_quality === 'verified'
        : q === 'base-linked'
          ? p.ingredient_quality === 'base-linked'
          : p.ingredient_quality !== 'verified')) &&
    (!start || !!(p.status_date && p.status_date >= start)) &&
    (!end || !!(p.status_date && p.status_date <= end))
  );
}

export function sortProducts(products: Product[], sort: SortKey): Product[] {
  return products.sort(
    sort === 'updated'
      ? (a, b) => (b.status_date || '').localeCompare(a.status_date || '')
      : (a, b) => a.name.localeCompare(b.name),
  );
}

export interface FilterResult {
  invalidDates: boolean;
  products: Product[];
}

/** Filter and sort the catalog. An invalid date range yields no products. */
export function filterProducts(catalog: Catalog, f: Filters): FilterResult {
  if (invalidDateRange(f)) return { invalidDates: true, products: [] };
  const products = catalog.products.filter((p) => matchesFilters(catalog, p, f));
  return { invalidDates: false, products: sortProducts(products, f.sort) };
}

export function countText(result: FilterResult): string {
  if (result.invalidDates) return 'Check your dates';
  const n = result.products.length;
  return `${n} product${s(n)}`;
}

export function siteSummary(sites: string[]): string {
  return sites.length
    ? `${sites.length} site${s(sites.length)} selected`
    : 'All 14 seed-treatment sites';
}

export const QUALITY_LABELS: Record<Exclude<QualityFilter, ''>, string> = {
  verified: 'EPA row · complete percentages',
  'base-linked': 'Related base formulation',
  'needs-review': 'Needs review',
};

/** Option labels of the restricted-use filter, reused by its chip. */
export const RUP_LABELS: Record<Exclude<RupFilter, ''>, string> = {
  yes: 'Yes',
  no: 'No',
  unknown: 'Not supplied',
};

/** Which filter a chip clears: a field, one site, or the date range. */
export type ChipKey =
  | {
      field:
        | 'query'
        | 'purpose'
        | 'technology'
        | 'manufacturer'
        | 'frac'
        | 'irac'
        | 'signal'
        | 'rup'
        | 'quality';
    }
  | { site: string }
  | { dates: true };

export interface AppliedChip {
  label: string;
  key: ChipKey;
}

/**
 * Applied-filter summary, in display order: search, sites, then the select filters,
 * then the date range (only when it differs from the default: blank start, end at the
 * import cutoff `defaultEndDate`).
 */
export function appliedFilters(f: Filters, defaultEndDate = ''): AppliedChip[] {
  const chips: AppliedChip[] = [];
  const add = (label: string, key: ChipKey) => label && chips.push({ label, key });
  const q = f.query.trim();
  if (q) add(`Search: “${q}”`, { field: 'query' });
  for (const site of f.sites) add(shortSite(site), { site });
  add(f.purpose, { field: 'purpose' });
  add(f.technology, { field: 'technology' });
  add(f.manufacturer, { field: 'manufacturer' });
  if (f.frac) add('FRAC ' + f.frac, { field: 'frac' });
  if (f.irac) add('IRAC ' + f.irac, { field: 'irac' });
  if (f.signal)
    add(
      'Signal: ' +
        (f.signal === 'NONE'
          ? 'None reported'
          : f.signal === 'NOT_SUPPLIED'
            ? 'Not supplied'
            : f.signal),
      { field: 'signal' },
    );
  if (f.rup) add('Restricted-use flag: ' + RUP_LABELS[f.rup], { field: 'rup' });
  if (f.quality) add(QUALITY_LABELS[f.quality], { field: 'quality' });
  const endChanged = f.end !== defaultEndDate;
  if (f.start || endChanged) {
    const label =
      f.start && f.end
        ? `Status date: ${fmt(f.start)} – ${fmt(f.end)}`
        : f.start
          ? `Status date: from ${fmt(f.start)}`
          : f.end
            ? `Status date: to ${fmt(f.end)}`
            : 'Status date: no end date';
    add(label, { dates: true });
  }
  return chips;
}

/** Filters with one chip's filter cleared (dates go back to their defaults). */
export function clearChip(f: Filters, key: ChipKey, defaultEndDate: string): Filters {
  if ('site' in key) return { ...f, sites: f.sites.filter((x) => x !== key.site) };
  if ('dates' in key) return { ...f, start: '', end: defaultEndDate };
  return { ...f, [key.field]: '' };
}

export interface PageInfo {
  page: number;
  pages: number;
  start: number;
  end: number;
  label: string;
}

/** Clamp the page to the available range and describe it. */
export function pageInfo(total: number, requested: number): PageInfo {
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(requested, pages);
  const start = (page - 1) * PAGE_SIZE;
  const end = Math.min(page * PAGE_SIZE, total);
  return {
    page,
    pages,
    start,
    end,
    label: `${start + 1}–${end} of ${total} · Page ${page} of ${pages}`,
  };
}

export interface CategoryOptions {
  purpose: string[];
  technology: string[];
  frac: string[];
  irac: string[];
  manufacturer: string[];
}

/** Select options derived from the catalog (default string sort, as legacy). */
export function categoryOptions(catalog: Catalog): CategoryOptions {
  const reference = catalog.ingredient_reference || {};
  const uniq = (values: string[]) => [...new Set(values)].sort();
  return {
    purpose: uniq(catalog.products.flatMap((p) => p.purposes)),
    technology: uniq(catalog.products.map((p) => p.pesticide_type).filter(Boolean)),
    frac: uniq(catalog.products.flatMap((p) => moaGroups(reference, p, 'frac'))),
    irac: uniq(catalog.products.flatMap((p) => moaGroups(reference, p, 'irac'))),
    manufacturer: uniq(catalog.products.map((p) => p.registrant)),
  };
}

/**
 * After the catalog is replaced, drop select values that no longer exist (the
 * legacy select lost them when its options were rebuilt).
 */
export function keepValidSelections(f: Filters, options: CategoryOptions): Filters {
  const keep = (value: string, list: string[]) => (list.includes(value) ? value : '');
  return {
    ...f,
    purpose: keep(f.purpose, options.purpose),
    technology: keep(f.technology, options.technology),
    frac: keep(f.frac, options.frac),
    irac: keep(f.irac, options.irac),
    manufacturer: keep(f.manufacturer, options.manufacturer),
  };
}
