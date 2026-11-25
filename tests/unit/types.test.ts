// Spot-check src/lib/types.ts against the real data: the committed public/data
// files and the pipeline's frozen fixture. TypeScript can't check JSON at runtime,
// so this asserts the field types the UI relies on.
import { describe, expect, it } from 'vitest';
import type { Catalog, Product } from '../../src/lib/types';
import { fixtureCatalog, publishedCatalog, publishedHistory, publishedStatus } from './fixtures';

const nullable = (type: string) => (v: unknown) => v === null || typeof v === type;
const PRODUCT_FIELDS: Record<keyof Product, (v: unknown) => boolean> = {
  id: (v) => typeof v === 'string',
  registration_number: (v) => typeof v === 'string',
  name: (v) => typeof v === 'string',
  registrant: (v) => typeof v === 'string',
  aliases: Array.isArray,
  alternate_names_raw: (v) => typeof v === 'string',
  record_type: (v) => typeof v === 'string',
  sites: Array.isArray,
  ingredients: Array.isArray,
  purposes: Array.isArray,
  pest_categories: Array.isArray,
  pesticide_type: (v) => typeof v === 'string',
  use_type: (v) => typeof v === 'string',
  purpose_basis: (v) => typeof v === 'string',
  ingredient_basis: (v) => typeof v === 'string',
  base_registration: nullable('string'),
  base_product_name: nullable('string'),
  base_source_row: nullable('number'),
  base_status_group: nullable('string'),
  base_product_ingredients: (v) => v === null || Array.isArray(v),
  status: (v) => typeof v === 'string',
  epa_status: (v) => typeof v === 'string',
  epa_status_description: (v) => typeof v === 'string',
  status_date: (v) => typeof v === 'string',
  first_registration_date: (v) => typeof v === 'string',
  target_pests_raw: (v) => typeof v === 'string',
  target_pests_basis: (v) => typeof v === 'string',
  physical_form: (v) => typeof v === 'string',
  use_pattern: (v) => typeof v === 'string',
  epa_verified: (v) => typeof v === 'boolean',
  ingredient_quality: (v) => typeof v === 'string',
  notes: (v) => typeof v === 'string',
  source: (v) => typeof v === 'string',
  source_url: (v) => typeof v === 'string',
  source_updated: nullable('string'),
  latest_label_date: nullable('string'),
  source_snapshot_date: (v) => typeof v === 'string',
  retrieved_at: nullable('string'),
  imported_at: (v) => typeof v === 'string',
  source_row: (v) => typeof v === 'number',
  source_sites_note: (v) => typeof v === 'string',
  greenbook: (v) =>
    v === null ||
    (typeof v === 'object' && typeof (v as { source_url: unknown }).source_url === 'string'),
  cdms: (v) =>
    v === null ||
    (typeof v === 'object' && typeof (v as { source_url: unknown }).source_url === 'string'),
  safety: (v) => typeof v === 'object' && v !== null,
  ingredient_source_url: (v) => v === undefined || typeof v === 'string',
  ingredient_source: (v) => v === undefined || typeof v === 'string',
};
const OPTIONAL = new Set(['ingredient_source_url', 'ingredient_source']);

describe.each([
  ['public/data/catalog.json', publishedCatalog()],
  ['pipeline fixture 2026-10-19', fixtureCatalog()],
] as [string, Catalog][])('%s matches the Catalog types', (_name, catalog) => {
  it('has the top-level sections', () => {
    expect(['live', 'snapshot']).toContain(catalog.mode);
    expect(catalog.scope.sites).toHaveLength(14);
    expect(typeof catalog.meta.source_snapshot_date).toBe('string');
    expect(typeof catalog.meta.last_successful_sync).toBe('string');
    expect(catalog.education?.treatments.length).toBeGreaterThan(0);
    expect(catalog.label_specs?.records.length).toBeGreaterThan(0);
  });

  it('every product has exactly the typed fields with the right types', () => {
    const typed = new Set(Object.keys(PRODUCT_FIELDS));
    for (const p of catalog.products) {
      for (const key of Object.keys(p))
        expect(typed, `unexpected product field ${key}`).toContain(key);
      for (const [key, check] of Object.entries(PRODUCT_FIELDS)) {
        if (OPTIONAL.has(key) && !(key in p)) continue;
        expect(check((p as unknown as Record<string, unknown>)[key]), `${p.id}.${key}`).toBe(true);
      }
      for (const a of p.ingredients) {
        expect(typeof a.name).toBe('string');
        expect(a.percent === null || typeof a.percent === 'number').toBe(true);
      }
      expect(['DANGER', 'WARNING', 'CAUTION', 'NONE', null, undefined]).toContain(
        p.safety.signal_word,
      );
    }
  });

  it('ingredient references have the classification fields', () => {
    for (const r of Object.values(catalog.ingredient_reference)) {
      expect(typeof r.name).toBe('string');
      expect(typeof r.group).toBe('string');
      expect(r.frac_code === null || typeof r.frac_code === 'string').toBe(true);
      expect(r.irac_code === null || typeof r.irac_code === 'string').toBe(true);
    }
  });
});

describe('sync-status.json and update-history.json match their types', () => {
  it('status', () => {
    const s = publishedStatus();
    expect(['success', 'failed']).toContain(s.state);
    expect(typeof s.last_publication_at).toBe('string');
    expect(typeof s.scheduler?.workflow_url).toBe('string');
    expect(s.sources.EPA).toBeTruthy();
  });

  it('history', () => {
    const h = publishedHistory();
    expect(h.schema_version).toBe(1);
    for (const u of h.updates) {
      expect(typeof u.checked_at).toBe('string');
      expect(Object.keys(u.counts).sort()).toEqual(['added', 'changed', 'removed']);
      for (const r of u.records) expect(['added', 'changed', 'removed']).toContain(r.action);
    }
  });
});
