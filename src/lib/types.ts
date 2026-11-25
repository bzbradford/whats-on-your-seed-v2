// Catalog schema as published by the pipeline (seed-treatment-database/catalog.py).
// Partial for now: fields are added as features are ported. Full typing is a
// Phase 2 task in PLAN.md.

export interface Ingredient {
  name: string;
  percent: number | null;
  pc_code: string | null;
  cas: string | null;
}

export interface Product {
  id: string;
  registration_number: string;
  name: string;
  registrant: string;
  sites: string[];
  ingredients: Ingredient[];
}

export interface CatalogMeta {
  last_successful_sync: string;
  source_snapshot_date: string;
}

export interface Catalog {
  products: Product[];
  meta: CatalogMeta;
}
