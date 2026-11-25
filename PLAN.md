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

### 3. Port the UI with exact visual parity — done (branch `phase-3b-ui`, awaiting review)

The legacy look and behaviour are the target: replicate first, iterate after.

**Reference changed (3b).** The first port (`phase-3-ui`) targeted upstream's streamlined master UI. The user's chosen look is the earlier **Oct 19 version** (upstream `435c0bf`): cream hero, five tabs, sidebar filters, card layout, inline SVG icons, Roboto Condensed headings. `legacy/static/` now holds that version (`legacy/REFERENCE.md`); the master-era page is `git show 9b45623:legacy/static/index.html`. Branch `phase-3b-ui` re-ports onto it, reusing the `src/lib/` logic and tests.

- [x] Oct 19 `<style>` lifted verbatim into `src/styles/legacy.css`; its `@font-face` line moved to `src/styles/fonts.css` so Vite can resolve the font. DOM, ids and classes follow Oct 19. Tailwind without preflight.
- [x] Assets: CPN logo and Roboto Condensed (`src/assets`, OFL licence alongside; bundled on Pages, inlined in the standalone file); fact sheet from `public/assets` (inlined in the standalone). The hero art `seed-botanical.webp` is **not** shipped (user decision); the treated-corn photo is no longer used.
- [x] Visual parity vs the Oct 19 reference (`tests/e2e/parity.spec.ts`): both apps get `public/data/*.json` and a frozen clock; pixelmatch, budget 25 px. Desktop 1280×900 and mobile 390×844: products initial, search, filters (drawer open on mobile, record filters open), product dialog, compare bar, matrix with 2 products, ingredient guide, treatment guide, Sources & updates; desktop only: catalog unavailable, no results, ingredient dialog, empty matrix, ingredient search. **All 23 at 0 differing pixels.** What's hidden or masked is listed in the spec header and below.
- [x] Behaviour tests (`tests/e2e/app.spec.ts`) follow the Oct 19 `ui_test.cjs` (hero shortcuts focus the searches, five tabs, guide links, mobile drawer) plus the later checks; `standalone.spec.ts` covers the file:// build; unit tests (`tests/unit/`) carry the legacy logic tests.
- [x] Full TypeScript types for catalog, sync-status and update-history, checked against `public/data` and the pipeline fixture.
- [x] Standalone polls `https://bzbradford.github.io/whats-on-your-seed-v2/data/` every 5 min with offline fallback (master-era behaviour, brought forward; Oct 19's standalone was a fixed snapshot). The Pages build polls its own `data/`.

**User decisions on top of the Oct 19 reference** (hidden in the reference or masked in parity):

1. No hero art (`img.hero-art`). The CSS is verbatim, so the hero grid keeps its (now empty) second column on desktop and the mobile `h1` keeps `max-width:66%`; nothing was restyled to "close up" the space. Hidden in the reference for parity.
2. No state registration UI: the state filter (`#state`, `#state-status`, `#state-help`), the matrix's state selector and its four state rows, the dialog's state panel, and the "State registration & availability coverage" panel are left out (hidden/removed in the reference for parity). Consequences: the matrix's last row group is titled "Sources & provenance" (master-era name) instead of "State evidence & provenance" (masked); the no-results note no longer points at the state filter (master-era sentence; hidden in parity); CSV exports have no state columns. The filter group keeps Oct 19's "Crop & location" legend. See "Future: state registration" below.
3. Brought forward from the master-era UI, placed in the Oct 19 layout:
   - **Sources & updates tab:** a new first panel "About this tool and how to use it" (what it is, how it works, how to use it; the steps are reworded for the Oct 19 tabs and controls); "Data currency & update history" replaces "Automatic source checks" and carries the "Dates and updates" text; "How to cite this version" is the last panel (cites this fork). All hidden in parity.
   - **Footer:** the master-era wording ("Educational reference only…") and the draft disclaimer (`#tool-disclaimer`) replace the Oct 19 footer text (newer wording wins; hidden in parity).
   - **Data currency:** the hero line `#hero-mode` reads "EPA data as of …" (Oct 19: "EPA workbook created …"; masked); the notice keeps Oct 19's "EPA workbook loaded" form but says "Catalog last changed …" instead of "Last official workbook retrieval …", and uses master-era warnings (offline snapshot, published updates unavailable, EPA update failed) instead of Oct 19's "Update failed" (hidden in parity). No last-check time, no 48-hour warning.
   - **Schedule wording:** weekly, Mondays 6:30 a.m. (Oct 19 said daily 6:37) in the currency and "Automatic EPA updates" panels; the latter uses the master-era text about online refresh (hidden in parity). "Source dates & connections": "Latest official retrieval" → "Catalog last changed", "Automatic updates" uses master-era wording (both masked).
   - **Label-link identity guards:** same `labelAccess()` in both versions; label-links CSV keeps the master-era "Data-use notice" column.
   - **Standalone online refresh** with offline fallback, validated catalogs (Oct 19's hosted poll didn't validate).
   - Catalog-unavailable messages use the master-era wording ("…will retry automatically"; "Connect and validate the EPA source…"); masked/hidden in parity.
4. Roboto Condensed is used (Oct 19 really loads it) and bundled.

**Other deviations:** fetches revalidate (`no-cache`) instead of `no-store`; the standalone also embeds `sync-status.json` and `update-history.json`; legacy `catalog.mode === 'preview'` branches not ported. Not brought forward (not in the list; decide later): the master-era abbreviations guide, the "Print this view" / "Print guides & sources" buttons (browser print still works; matrix and dialog print are kept), and the treated-corn photo.

**Oct 19 behaviour replicated but worth revisiting:**

- At 390 px the Treatment guide page scrolls sideways (the page is 727 px wide in both apps): a guide table escapes its scroll wrapper.
- The hero lists "EPA · Greenbook · CDMS", but Greenbook and CDMS are saved references only (no feeds).
- Escape closes the filter panel only at mobile widths (by design in Oct 19, where it's a drawer).
- The product dialog's safety panel links `safety.label_url` as "Exact registration match" without `labelAccess()`'s identity guards (no distributor has one today).
- Export toasts say "1 products exported…"; the restricted-use chip shows the raw value ("Restricted-use flag: unknown"); search and dates aren't in the applied-filter chips.
- Before the catalog loads, the pager and export buttons are visible and enabled.
- "Needs review / missing fields" matches every non-`verified` record, including base-linked distributor records.
- The hosted page re-downloads the catalog every five minutes (now revalidated); polling `sync-status.json` first would avoid most of it.
- The CPN logo link opens in the same tab (hidden in `?embed`).

**Pending (needs the user):** keep the screenshot comparison out of the weekly data job. Proposed: add `"test:e2e:data": "pnpm build && pnpm build:standalone && playwright test --grep-invert parity"` to `package.json` and call it instead of `pnpm test:e2e` in `.github/workflows/data-update.yml` (normal CI keeps running parity). An agent's attempt to edit the workflow was blocked by the permission classifier as weakening a check, so it's left for the user to apply or approve. Until then, a rendering change triggered by new EPA data could block publishing.

**Future: state registration** (separate project; data first, then UI). The user wants a "pick your state, show products registered there" selector. Findings: there is no national bulk source of state pesticide registrations. NPIRS (Purdue) has state registration data, but it's search-based, with paid subscriptions that universities can get. Kelly Registration Systems covers about 39 states, search only. Some states offer bulk downloads, e.g. New York (NYSPAD) and California DPR. A data-sourcing decision must come before any UI. The Oct 19 state UI was not ported: its data was 3 products of CDMS search snippets with zero state-agency records, and the pipeline no longer produces it. The filter model (`src/lib/filters.ts` `Filters` / `matchesFilters`, `appliedFilters`) and the matrix rows (`src/lib/matrix.ts`) are where a state filter and state rows would plug in.

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

**Treatment guide and Sources & updates tabs**

- [x] Treatment types, FRAC/IRAC, signal words and warnings, BMPs/handling (the master-era abbreviations guide is not in the Oct 19 UI and was not brought forward)
- [x] Sources, coverage and update details, 14-site counts, About and citation (Sources & updates), draft disclaimer (footer)
- [x] Fact sheet PDF download

**Exports & print**

- [x] Results CSV (all filtered rows across pages, provenance, CSV-injection-safe cells)
- [x] Label links CSV
- [x] Print: comparison matrix and product dialog (Oct 19). The master-era "Print this view" buttons were not brought forward

## Open decisions

- Embed mode: query param vs separate `embed.html` entry (leaning query param, one build)
- Catalog size strategy (see Phase 2)
- What to do about fact sheet generation (`build_fact_sheet.py`, reportlab)

## Follow-ups noticed

- [x] Removed the unused JSON-feed import path (`catalog.sync` / `filter_products` / `snapshot_validate`, `EPA_FEED_URL`) and the throwaway per-run SQLite DB. The rollback and 30%-loss guards now compare against the published catalog JSON. A forced real run produced byte-identical output.
- `pipeline/sources.py` (EPA PPIS fixed-width parser, Greenbook page scraper) is a manual research tool that no job uses; its output is "review material". Keep or drop: undecided.
