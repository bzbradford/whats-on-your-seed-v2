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
- [x] E2E test for the standalone file opened from `file://`

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

### 3. Port the UI with exact visual parity — done (branch `phase-3-ui`, awaiting review)

The legacy look and behaviour are the target: replicate first, iterate after.

- [x] Lift the legacy `<style>` verbatim into `src/styles/legacy.css` (global) and keep its class names and DOM structure in the Svelte components. Tailwind stays available (theme + utilities, **no preflight**) but nothing is restyled until parity is reached.
- [x] Assets: CPN logo and treated-corn photo in `src/assets` (inlined into the standalone file); fact sheet PDF stays in `public/assets` (pipeline output) and is inlined as a `data:` URL only in the standalone build. Roboto Condensed is not used: legacy's final CSS sets headings to Arial (`legacy/BRANDING.md`).
- [x] Visual parity tests (`tests/e2e/parity.spec.ts`): Playwright serves `legacy/static/` (port 8081) and the new app, routes both to `public/data/*.json` with a frozen clock, and pixel-compares (pixelmatch, legacy = expected, budget 25 px). Desktop 1280×900 and mobile 390×844: products initial, search, filters + drawer, no results, catalog unavailable, product dialog, ingredient dialog, compare bar, matrix (2 products), empty matrix, ingredient guide, guides (all sections + disclaimer), sources panels. **All at 0 differing pixels.** Masked: the catalog summary line (deviation below); in the sources grid the two deviated panels are hidden in both apps and the "Latest official retrieval" → "Catalog last changed" row is masked.
- [x] Port the legacy `.cjs` logic/UI test cases (`legacy/tests/`) to Vitest/Playwright: `logic_test` + `live_catalog_test` → `tests/unit/*` (fixture `catalog-2026-10-19.json.gz` and current data); `ui_test` → `tests/e2e/app.spec.ts` and `standalone.spec.ts`
- [x] Full TypeScript types for the catalog schema, sync-status and update-history, checked against `public/data` and the pipeline fixture (`tests/unit/types.test.ts`)
- [x] Standalone build polls `https://bzbradford.github.io/whats-on-your-seed-v2/data/` every 5 min (catalog, sync-status, update-history; all three also embedded), offline fallback, keeps filters/selection on refresh. The Pages build polls its own `data/` relatively, as legacy's hosted page did.

Port order: catalog load → shell/header/tabs → product list/search/filters/pager → product detail dialog → comparison matrix → ingredient guide → guides & sources → exports/print → sync/update status. Feature checklist below.

**Intentional deviations from legacy** (all user-visible ones are masked or excluded in the parity test):

- Data currency (agreed): no "last EPA check"/"Latest official retrieval" date and no "EPA check not verified" / 48-hour overdue warnings. Shown instead: "EPA data as of" (`meta.source_snapshot_date`), "Catalog last changed" (`sync-status.json` `last_publication_at`) in the catalog summary, About text and source panels, plus an update-history table in a new "Data currency & update history" panel (replaces "Automatic source checks").
- Schedule wording: legacy said "daily at 6:37 a.m."; now "weekly, on Mondays at 6:30 a.m." (About, the currency panel and "Automatic EPA updates").
- URLs that pointed at `danieham-97/crop-protection-network`: the standalone poll URL, the "View source update runs" link (now `sync-status.json` `scheduler.workflow_url`), and the suggested citation's repository URL now point at this fork.
- Fetches use `cache: 'no-cache'` (revalidate; a 304 when unchanged) instead of `no-store`. Same data, much less transfer on the five-minute poll.
- The standalone file also embeds `sync-status.json` and `update-history.json`, so an offline copy shows its update history.
- Legacy's `catalog.mode === 'preview'` branches ("example products", no date filter) were not ported; the pipeline never emits that mode.

**Legacy behaviour replicated but worth revisiting** (post-parity):

- Hosted page re-downloads the 2.8 MB catalog every five minutes (now revalidated). Polling `sync-status.json` first and fetching the catalog only when `last_publication_at` changes would avoid most of that.
- The product dialog's safety panel links `safety.label_url` as "Exact registration match" without `labelAccess()`'s identity guards (which the label buttons use). No distributor record currently has a `label_url`, so no wrong link is shown today.
- Export toasts say "1 products exported…"; the applied-filter chip shows the raw value ("Restricted-use flag: unknown"); search/date filters aren't listed among applied filters.
- Before the catalog loads, the pager and export buttons are visible and enabled (clicking export then produces a header-only CSV).
- "Needs review / missing fields" matches every non-`verified` record, including base-linked distributor records.
- The CPN logo link in the header has no `target="_blank"` (the header is hidden in `?embed`).

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

- [x] Load catalog (products, scope, ingredient_reference, education, label_specs, meta)
- [x] Single-file mode: embedded snapshot, poll the published catalog every 5 min, offline fallback, keep filters/selection on refresh
- [x] Data currency display: "EPA data as of" (workbook date) and "catalog last changed" (`last_publication_at`), plus update history. **Intentional deviation:** no "last EPA check" time or 48-hour staleness warning, since checks no longer commit (see Phase 2)
- [x] Notice/warning banners, toast, screen-reader announcements

**Products tab**

- [x] Text search (name, registration number, synonyms/aliases)
- [x] Filters: 14 seed-treatment sites, purpose, manufacturer, technology, FRAC group, IRAC group, signal word (incl. "None reported" vs missing), RUP flag, data quality, registration date range (with start > end validation)
- [x] Sort, pagination (25/page), result count, applied-filter summary, reset
- [x] Mobile filter drawer
- [x] Product detail dialog: ingredients (%), PC code/CAS, registration status and dates, base formulation/distributor records, safety (signal word, RUP), label PDF link (EPA PPLS) and distributor fallback, EPA pest list, provenance (as in legacy, PC codes and the EPA pest list appear in the matrix and CSV exports, not the dialog; CAS numbers are not shown anywhere)
- [x] Compare checkboxes (max 4, persisted to localStorage), compare bar

**Comparison matrix tab**

- [x] Picker with search/add, selection cap and order, clear
- [x] Side-by-side rows: dates, ingredients, FRAC/IRAC, target pests, label specs, warnings, sources; label-version/composition guards; no efficacy content
- [x] Matrix CSV export, print / save PDF

**Ingredient guide**

- [x] Ingredient search, grid, per-ingredient details and product counts

**Guides & sources tab**

- [x] Treatment types, FRAC/IRAC, signal words and warnings, BMPs/handling, abbreviations
- [x] Sources, coverage and update details, 14-site counts, citation, draft disclaimer
- [x] Fact sheet PDF download

**Exports & print**

- [x] Results CSV (all filtered rows across pages, provenance, CSV-injection-safe cells)
- [x] Label links CSV
- [x] Print current view / results / guides

## Open decisions

- Embed mode: query param vs separate `embed.html` entry (leaning query param, one build)
- Catalog size strategy (see Phase 2)
- What to do about fact sheet generation (`build_fact_sheet.py`, reportlab)

## Follow-ups noticed

- [x] Removed the unused JSON-feed import path (`catalog.sync` / `filter_products` / `snapshot_validate`, `EPA_FEED_URL`) and the throwaway per-run SQLite DB. The rollback and 30%-loss guards now compare against the published catalog JSON. A forced real run produced byte-identical output.
- `pipeline/sources.py` (EPA PPIS fixed-width parser, Greenbook page scraper) is a manual research tool that no job uses; its output is "review material". Keep or drop: undecided.
