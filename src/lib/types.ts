// Catalog schema as published by the pipeline (pipeline/catalog.py `publish()`),
// plus sync-status.json and update-history.json. tests/unit/types.test.ts checks
// these shapes against the committed public/data files and the pipeline fixture.

export interface Ingredient {
  name: string;
  /** EPA-reported percentage; not an application rate. */
  percent: number | null;
  pc_code: string | null;
  cas: string | null;
}

export type SignalWord = 'DANGER' | 'WARNING' | 'CAUTION' | 'NONE';

export interface Safety {
  signal_word?: SignalWord | null;
  signal_word_raw?: string;
  signal_word_state?: 'reported' | 'reported-none' | 'missing' | 'unrecognized';
  restricted_use?: boolean | null;
  restricted_use_raw?: string;
  restricted_use_reason?: string;
  basis?: string;
  label_url?: string | null;
  label_date?: string | null;
  label_basis?: string;
}

export interface ProviderDocument {
  type: 'sds' | 'supplemental_label' | 'specimen_label' | string;
  url: string;
  revision?: string | null;
  date?: string | null;
}

/** Saved Greenbook / CDMS reference (not live feeds). */
export interface ProviderReference {
  name?: string;
  source_url: string;
  source_updated?: string | null;
  retrieved_at?: string | null;
  documents?: ProviderDocument[];
  warnings?: string[];
  state?: string;
}

export type IngredientQuality = 'verified' | 'base-linked' | 'missing' | 'partial' | string;

export interface Product {
  id: string;
  registration_number: string;
  name: string;
  registrant: string;
  aliases: string[];
  alternate_names_raw: string;
  /** 'Sec3' | 'DP' in current data. */
  record_type: string;
  sites: string[];
  ingredients: Ingredient[];
  purposes: string[];
  pest_categories: string[];
  pesticide_type: string;
  use_type: string;
  purpose_basis: string;
  ingredient_basis: string;
  base_registration: string | null;
  base_product_name: string | null;
  base_source_row: number | null;
  base_status_group: string | null;
  base_product_ingredients: Ingredient[] | null;
  status: string;
  epa_status: string;
  epa_status_description: string;
  status_date: string;
  first_registration_date: string;
  target_pests_raw: string;
  target_pests_basis: string;
  physical_form: string;
  use_pattern: string;
  epa_verified: boolean;
  ingredient_quality: IngredientQuality;
  notes: string;
  source: string;
  source_url: string;
  source_updated: string | null;
  latest_label_date: string | null;
  source_snapshot_date: string;
  retrieved_at: string | null;
  imported_at: string;
  source_row: number;
  source_sites_note: string;
  greenbook: ProviderReference | null;
  cdms: ProviderReference | null;
  safety: Safety;
  /** Only in older or hand-made records; read by the legacy UI when present. */
  ingredient_source_url?: string;
  ingredient_source?: string;
}

export interface IngredientReference {
  name: string;
  purpose: string;
  group: string;
  classification: string;
  explanation: string;
  frac_code?: string | null;
  irac_code?: string | null;
  source_url?: string;
  source_version?: string;
  reviewed_on?: string;
  synonyms?: string[];
  identity_source_url?: string;
}

export interface Scope {
  status_group: string;
  status_date_start: string | null;
  status_date_end: string;
  timezone: string;
  sites: string[];
  excluded_ingredient_names: string[];
  excluded_cas: string[];
  excluded_pc_codes: string[];
  notes: string;
}

export interface EducationSource {
  id: string;
  title: string;
  url: string;
}

export interface Education {
  reviewed_on: string;
  status: string;
  classification_note: string;
  resistance_note: string;
  technology_note: string;
  signal_note: string;
  data_note: string;
  treatments: {
    type: string;
    purpose: string;
    compare: string;
    limit: string;
    source_ids: string[];
  }[];
  signals: { word: string; meaning: string; note: string }[];
  bmps: { title: string; text: string; source_ids: string[] }[];
  sources: EducationSource[];
}

export interface LabelSpecRecord {
  registration_number: string;
  source_product_name: string;
  crop: string;
  composition: { pc_code: string; percent: number }[];
  source_url: string;
  label_date: string;
  reviewed_on: string;
  review_due: string;
  pages: string;
  targets: string;
  rate: string;
  application: string;
  rei: string;
  ppe: string;
  restrictions: string;
}

export interface LabelSpecs {
  schema_version: number;
  note: string;
  records: LabelSpecRecord[];
}

export interface ExcludedRecord {
  registration_number: string;
  name: string;
  reason: string;
  source_row: number;
}

export interface Audit {
  sheet?: string;
  workbook_created_at?: string;
  sha256?: string;
  source_url?: string;
  row_count?: number;
  status_group_counts?: Record<string, number>;
  published_products?: number;
  excluded_records?: ExcludedRecord[];
  record_type_counts?: Record<string, number>;
  counts_by_site?: Record<string, number>;
  base_linked_formulations?: number;
  missing_formulation_products?: number;
  missing_percent_products?: number;
  distinct_ingredients?: number;
  signal_word_counts?: Record<string, number>;
  restricted_use_products?: number;
  exact_registration_label_links?: number;
  currency_note?: string;
  [key: string]: unknown;
}

export interface SourceUpdate {
  state?: string;
  checked_at?: string | null;
  attempted_at?: string | null;
  workbook_created?: string;
  source_url?: string;
  retrieved_on?: string | null;
}

export interface CatalogMeta {
  last_successful_sync: string;
  source_checked?: string;
  status_date_end?: string;
  automation?: string;
  complete?: boolean;
  epa?: string;
  greenbook?: { state: string; matched: number };
  cdms?: { state: string; matched: number };
  coverage_note?: string;
  imported_at?: string;
  source_snapshot_date: string;
  source_acquisition?: string;
  audit?: Audit;
  last_update_summary?: UpdateCounts;
  source_updates?: Record<string, SourceUpdate>;
}

export interface Catalog {
  /** 'live' from the pipeline. The legacy standalone rewrote it to 'snapshot'. */
  mode: string;
  scope: Scope;
  ingredient_reference: Record<string, IngredientReference>;
  education?: Education;
  label_specs?: LabelSpecs;
  products: Product[];
  meta: CatalogMeta;
}

export interface UpdateCounts {
  added: number;
  changed: number;
  removed: number;
}

/** public/data/sync-status.json. Rewritten only when the catalog changes. */
export interface SyncStatus {
  state: 'success' | 'failed';
  outcome?: string;
  publication_reasons?: string[];
  /** When the current catalog was produced (not the last check; see CLAUDE.md). */
  checked_at?: string;
  last_publication_at?: string;
  message?: string;
  scheduler?: { kind: string; cron: string; timezone: string; workflow_url: string };
  sources: Record<string, SourceUpdate>;
  workbook_sha256?: string;
  changes?: UpdateCounts;
}

export interface UpdateHistoryEntry {
  checked_at: string;
  published_at?: string;
  outcome?: string;
  publication_reasons?: string[];
  message?: string;
  workbook_created?: string;
  workbook_sha256?: string;
  counts: UpdateCounts;
  records: {
    registration_number: string;
    action: 'added' | 'changed' | 'removed';
    fields: string[];
  }[];
}

/** public/data/update-history.json */
export interface UpdateHistory {
  schema_version: number;
  updates: UpdateHistoryEntry[];
}
