# Conversion plan

Goal: rebuild the legacy monolithic `legacy/static/index.html` (~125 KB, one inline script, ~60 functions) as a maintainable, tested Svelte app deployable to GitHub Pages, while keeping the automated EPA APPRIL pipeline.

## Phases

### 0. Setup — done

- [x] Fork to `bzbradford`, rename to `whats-on-your-seed-v2`, add `upstream` remote
- [x] Baseline: legacy test suite passes
- [x] Working docs: CLAUDE.md, HANDOFF.md, PLAN.md, `tmp/` session log
- [x] Default branch renamed `master` → `main` (workflow refs updated)

### 1. Scaffold

- [x] Replace the root `.gitignore` (stock Visual Studio template) with one for this stack
- [x] Svelte 5 + Vite + TS + Tailwind v4 at repo root (pnpm, eslint, prettier, svelte-check, simple-git-hooks), mirroring `../whats-on-your-seed`
- [x] Vitest + Playwright installed and running (catalog loader, view mode, smoke e2e)
- [x] `pnpm verify` = lint + check + unit tests + both builds
- [x] Two build modes: Pages (fetches `data/catalog.json`) and single-file (`vite-plugin-singlefile`, catalog inlined)
- [x] `?embed` view mode stub (hides title, fixed-height scroll)
- [x] GitHub Actions: CI on PR/push; Pages deploy from `main`; standalone published as `whats-on-your-seed-standalone.html`
- [x] First Pages deploy live at https://bzbradford.github.io/whats-on-your-seed-v2/
- [ ] E2E test for the standalone file opened from `file://`

### 2. Pipeline

- [x] Move Python to `pipeline/` with `pyproject.toml` (uv, Python 3.12), unittest suite runs under pytest, ruff format + lint
- [x] Reference inputs moved `data/` → `pipeline/reference/`; output goes to committed `public/data/`; `scripts/sync-data.js` removed
- [x] Legacy app frozen under `legacy/` (with its own catalog snapshot) as the parity reference
- [x] `data-update.yml` (replaces `seed-database-update.yml`): refresh → pytest + `pnpm verify` + e2e → commit `public/data/` → dispatch Pages deploy (GITHUB_TOKEN pushes don't trigger workflows)
- [x] Update job redesign (2026-11-25), replacing the legacy daily, always-commit setup:
  - Weekly (Mondays 06:30 Central) plus a manual run with `force`
  - HEAD request first: EPA's ETag/Last-Modified/Content-Length are compared with `sync-status.json` `source_headers`; unchanged means no download (0.3 s vs ~90 s)
  - Writes and commits only when catalog content changes (or headers only, if EPA re-uploads an identical file). No timestamp-only commits; failures write nothing and fail the job
  - Removed the persistent SQLite store (`record_store.py`) and its 90-day Actions artifact. Git history of `public/data/` is the change log; previously published registrations still get out-of-scope status observations via the current catalog
- [x] CI runs the pipeline job (ruff + pytest) alongside the web build; deploy needs both
- [x] First manual `data-update` run succeeded on GitHub (run 45663835699): bot commit → dispatched deploy → live `sync-status.json` updated
- **Catalog split: deferred.** The 2.8 MB file is ~287 KB gzipped as served by Pages. Moving `target_pests_raw` (used only by the comparison matrix) to a lazy file would cut that to ~126 KB, but adds lazy-loading to compare, CSV export and the standalone build. Revisit after parity if load time matters.

### 3. Port the UI with exact visual parity

The legacy look and behaviour are the target: replicate first, iterate after.

- [ ] Lift the legacy `<style>` verbatim into `src/styles/legacy.css` (global) and keep its class names and DOM structure in the Svelte components. Tailwind stays available but nothing is restyled until parity is reached.
- [ ] Assets: Roboto Condensed font, CPN logo, hero images, fact sheet PDF (in `src/assets` / `public/assets`; standalone must inline what it needs)
- [ ] Visual parity tests: Playwright serves `legacy/static/` and the new app side by side on the same catalog snapshot and compares screenshots of key states at desktop and mobile widths
- [ ] Port the legacy `.cjs` logic/UI test cases (`legacy/tests/`) to Vitest/Playwright as each feature lands
- [ ] Full TypeScript types for the catalog schema, checked against the pipeline test fixture
- [ ] Standalone build polls the published Pages `data/catalog.json` (legacy pointed at danieham-97's raw GitHub URL)

Port order: catalog load → shell/header/tabs → product list/search/filters/pager → product detail dialog → comparison matrix → ingredient guide → guides & sources → exports/print → sync/update status. Feature checklist below.

### 4. Embed and polish

- [ ] Compact embed layout (`?embed`), test inside an iframe on a page from a different origin
- [ ] Accessibility pass (the legacy app has live regions `a11y-alert`/`a11y-status`, focus restore)
- [ ] Iterate on design beyond the legacy look (only after parity)
- [ ] Prune or consolidate the ~15 legacy markdown docs

### 5. Cutover

- [ ] Parity check against the legacy app using the "Try these checks" table in `legacy/README-upstream.md`
- [ ] Delete `legacy/` (keep anything still useful from its docs)

## Feature inventory (parity checklist)

Taken from the legacy `static/index.html`. Tick items when ported **and** tested.

**Data & sync**

- [ ] Load catalog (products, scope, ingredient_reference, education, label_specs, meta)
- [ ] Single-file mode: embedded snapshot, poll the published catalog every 5 min, offline fallback, keep filters/selection on refresh
- [ ] Data currency display: "EPA data as of" (workbook date) and "catalog last changed" (`last_publication_at`), plus update history. **Intentional deviation:** no "last EPA check" time or 48-hour staleness warning, since checks no longer commit (see Phase 2)
- [ ] Notice/warning banners, toast, screen-reader announcements

**Products tab**

- [ ] Text search (name, registration number, synonyms/aliases)
- [ ] Filters: 14 seed-treatment sites, purpose, manufacturer, technology, FRAC group, IRAC group, signal word (incl. "None reported" vs missing), RUP flag, data quality, registration date range (with start > end validation)
- [ ] Sort, pagination (25/page), result count, applied-filter summary, reset
- [ ] Mobile filter drawer
- [ ] Product detail dialog: ingredients (%), PC code/CAS, registration status and dates, base formulation/distributor records, safety (signal word, RUP), label PDF link (EPA PPLS) and distributor fallback, EPA pest list, provenance
- [ ] Compare checkboxes (max 4, persisted to localStorage), compare bar

**Comparison matrix tab**

- [ ] Picker with search/add, selection cap and order, clear
- [ ] Side-by-side rows: dates, ingredients, FRAC/IRAC, target pests, label specs, warnings, sources; label-version/composition guards; no efficacy content
- [ ] Matrix CSV export, print / save PDF

**Ingredient guide**

- [ ] Ingredient search, grid, per-ingredient details and product counts

**Guides & sources tab**

- [ ] Treatment types, FRAC/IRAC, signal words and warnings, BMPs/handling, abbreviations
- [ ] Sources, coverage and update details, 14-site counts, citation, draft disclaimer
- [ ] Fact sheet PDF download

**Exports & print**

- [ ] Results CSV (all filtered rows across pages, provenance, CSV-injection-safe cells)
- [ ] Label links CSV
- [ ] Print current view / results / guides

## Open decisions

- Embed mode: query param vs separate `embed.html` entry (leaning query param, one build)
- Catalog size strategy (see Phase 2)
- What to do about fact sheet generation (`build_fact_sheet.py`, reportlab)

## Follow-ups noticed

- [x] Removed the unused JSON-feed import path (`catalog.sync` / `filter_products` / `snapshot_validate`, `EPA_FEED_URL`) and the throwaway per-run SQLite DB. The rollback and 30%-loss guards now compare against the published catalog JSON. A forced real run produced byte-identical output.
- `pipeline/sources.py` (EPA PPIS fixed-width parser, Greenbook page scraper) is a manual research tool that no job uses; its output is "review material". Keep or drop: undecided.
