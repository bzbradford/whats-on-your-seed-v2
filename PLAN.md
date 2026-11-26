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

### 3. Port the UI with exact visual parity — done (merged to `main` in PR #1, 2026-11-25)

The legacy look and behaviour are the target: replicate first, iterate after.

**Reference changed (3b).** The first port (`phase-3-ui`) targeted upstream's streamlined master UI. The user's chosen look is the earlier **Oct 19 version** (upstream `435c0bf`): cream hero, five tabs, sidebar filters, card layout, inline SVG icons, Roboto Condensed headings. `legacy/static/` now holds that version (`legacy/REFERENCE.md`); the master-era page is `git show 9b45623:legacy/static/index.html`. Branch `phase-3b-ui` re-ports onto it, reusing the `src/lib/` logic and tests.

- [x] Oct 19 `<style>` lifted verbatim into `src/styles/legacy.css`; its `@font-face` line moved to `src/styles/fonts.css` so Vite can resolve the font. DOM, ids and classes follow Oct 19. Tailwind without preflight.
- [x] Assets: CPN logo and Roboto Condensed (`src/assets`, OFL licence alongside; bundled on Pages, inlined in the standalone file); fact sheet from `public/assets` (inlined in the standalone). The hero art `seed-botanical.webp` is **not** shipped (user decision); the treated-corn photo is no longer used.
- [x] Visual parity vs the Oct 19 reference (`tests/e2e/parity.spec.ts`, now retired): both apps get `public/data/*.json` and a frozen clock; pixelmatch, budget 25 px. Desktop 1280×900 and mobile 390×844: products initial, search, filters (drawer open on mobile, record filters open), product dialog, compare bar, matrix with 2 products, ingredient guide, treatment guide, Sources & updates; desktop only: catalog unavailable, no results, ingredient dialog, empty matrix, ingredient search. **All 23 at 0 differing pixels.** What's hidden or masked is listed in the spec header and below.
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

**Parity tests retired (user sign-off, 2026-11-25).** The Oct 19 look was matched at 0 differing pixels in 23 states, then `parity.spec.ts`, its helpers, `pixelmatch`/`pngjs` and the legacy `webServer` were removed. That also keeps screenshot comparisons out of the weekly data job, which runs `pnpm test:e2e`. The deviations below are history: from here on the design may change.

**Future: state registration** (separate project; data first, then UI). The user wants a "pick your state, show products registered there" selector. Findings: there is no national bulk source of state pesticide registrations. NPIRS (Purdue) has state registration data, but it's search-based, with paid subscriptions that universities can get. Kelly Registration Systems covers about 39 states, search only. Some states offer bulk downloads, e.g. New York (NYSPAD) and California DPR. A data-sourcing decision must come before any UI. The Oct 19 state UI was not ported: its data was 3 products of CDMS search snippets with zero state-agency records, and the pipeline no longer produces it. The filter model (`src/lib/filters.ts` `Filters` / `matchesFilters`, `appliedFilters`) and the matrix rows (`src/lib/matrix.ts`) are where a state filter and state rows would plug in.

Port order: catalog load → shell/header/tabs → product list/search/filters/pager → product detail dialog → comparison matrix → ingredient guide → guides & sources → exports/print → sync/update status. Feature checklist below.

### 3c. Post-parity fixes — done (merged in PR #1)

After sign-off, parity was retired and these landed one commit each, with tests:

- [x] Screenshot parity tests removed (spec, helpers, `pixelmatch`/`pngjs`, legacy `webServer`). The weekly data job's `pnpm test:e2e` is behaviour-only.
- [x] Hero uses the full width without the art (scoped style in `App.svelte`): single grid column, heading uncapped (also on mobile, where Oct 19 capped it at 66%), paragraph measure 740px (the legacy base hero cap). e2e checks widths at 1280 and 390 px.
- [x] Brought forward: the abbreviations guide (23 terms) as a panel in the **Treatment guide**, before References; **Print this view** buttons in the products toolbar and the Ingredient guide, Treatment guide and Sources & updates headers. Oct 19's print CSS hid the workspace, grids and footer; scoped print rules now show the current view and the disclaimer (opened while printing). A print icon was added to the sprite.
- [x] Oct 19 oddities fixed:
  - Treatment guide no longer scrolls sideways on phones (`1fr` grid tracks → `minmax(0, 1fr)`); e2e: no tab overflows at 390 or 320 px.
  - Safety panel's workbook label link uses the label buttons' identity guards (`workbookLabelFile()` in `labels.ts`); no link or "Exact registration match" claim otherwise. (Label URL logic unchanged pending the separate investigation into EPA PDFs that are letters rather than labels.)
  - Hero source line: "EPA APPRIL data · saved Greenbook & CDMS references".
  - Plurals everywhere (`count()` in `format.ts`): export toasts, coverage text, matrix matches, notice, source panels.
  - Restricted-use chip uses the option labels (Yes / No / Not supplied).
  - Applied-filter summary includes the search and a non-default status-date range; every chip is a button that removes its filter.
  - Before the catalog loads: pager hidden, export buttons disabled.
  - Polling fetches `sync-status.json` (+ history) and re-downloads `catalog.json` only when the publication changed (`publicationChanged()` in `sync.ts`). Also fixed: an invalid status file was thrown rather than treated as a failed check.
  - CPN logo link opens in a new tab (`rel="noopener noreferrer"`).
- **Not changed (decision): "Needs review / missing fields" still includes base-linked distributor records.** The pipeline (`appril_workbook.py`) sets `ingredient_quality` to `missing` (no ingredients), `base-linked` (ingredients from the related base registration, `ingredient_basis: Related EPA base registration`), `partial` (a percentage missing) or `verified` (complete EPA product row). Base-linked records are not missing fields, but every part of the UI flags them for review ("Related base formulation · check distributor label"; "Distributor use claims can be narrower; verify the distributor label"), the option set reads as "complete EPA row" vs "base formulation" vs "everything that needs a second look", and the legacy logic tests assert `needs-review = not verified`. So it's a defensible, intended meaning, not clearly a bug. If the user wants "missing fields" only, it's a one-line change (`missing` or `partial`) plus relabelling; current data: 3 such records vs 188 today.

### 4a. Layout and density (agreed 2026-11-25; build agent on branch `layout-density`)

Goal: make the products view scannable and the page less tall, keep the Oct 19 character, and introduce Bits UI where it improves controls. Now that parity is retired, styling changes go in scoped component styles on top of `legacy.css`.

1. [x] **Card / List view pill.** A segmented pill toggle (Bits UI `ToggleGroup`) switches between:
   - **List:** dense rows with sortable column headers in a sticky header row. Columns: product (name; registrant · EPA no.), active ingredients with %, purpose badges, signal word / RUP, FRAC/IRAC codes when assigned, crops (short), and label + compare actions. Clicking a row opens the existing detail dialog. On phones, rows stack compactly.
   - **Card:** the friendlier view, slimmed down.

   Both must show the most relevant facts per product. Remember the choice (localStorage in try/catch; the URL comes with 4b).

   Done: `ViewToggle` (Bits `ToggleGroup`, radios), `ProductList` (table with sticky headers; Product, Active ingredient, Purpose and Signal word sort both ways with `aria-sort`; the name button is the keyboard path to the dialog, a click elsewhere on the row is a mouse shortcut; phones get compact stacked rows and sort with the Sort menu). Rows list up to four ingredients (longer Bt stacks show three and "+N more"), crop families (exact sites in the tooltip and dialog), FRAC/IRAC when assigned, the label link and supplemental labeling, and Compare. Preference in `src/lib/preferences.ts` (`cpn-seed-view`). Sort keys gained reverse orders, registrant and signal severity (`SORTS` in `filters.ts`).

2. [x] **Cut per-product boilerplate:**
   - the label-PDF explanation appears once, in the help text above the results
   - FRAC/IRAC lines only when assigned
   - the "N ingredients without a reviewed assignment" coverage line moves to the dialog
   - the quality / status-date footer line is condensed

   Done: one label explanation above the results (`#label-help`, covering the EPA-accepted PDF, the lookup, distributors and supplemental labeling); the per-product note stays in the dialog's label panel. Cards show FRAC/IRAC only when assigned, no coverage line, "quality · Status date" footer, tighter spacing (scoped styles in `ProductCard`).

3. [x] **Sticky filter sidebar** on desktop (sticky, internal scroll if taller than the viewport). On phones, the "Show filters" button is pinned to the bottom of the screen. Done (scoped styles in `ProductsTab`): the sidebar keeps clear of the compare tray; the pinned button sits above it.
4. [x] **Hero:**
   - the title "What's on your seed?" on one line, with the hero shortened
   - remove the 01/02/03 step strip (it duplicates the tabs)
   - in `?embed`, the hero becomes a slim banner
   - on phones, the tab bar becomes a single sideways-scrolling row

   Done (scoped styles in `App.svelte`): one-line title, less hero padding, strip removed, `?embed` banner with the title and data line, sideways-scrolling tab row on phones (the active tab is scrolled into view).

5. [x] **"EPA workbook loaded" notice → info, not a warning.** A short line by the result count ("880 products · EPA data as of …"), full details in the footer and the Sources tab. The "N records lack ingredients" warning becomes a flag on those records. Done: `#notice` only carries loading, failures and warnings (otherwise an empty, visually collapsed live region); "· EPA data as of …" sits by the count; the full "EPA workbook loaded" details are the first footer paragraph (`#catalog-details`), and the Sources tab keeps its dates panel; `RecordFlag` marks records without ingredients in both views.
6. [x] **Bits UI** (`bits-ui`, as in the v1 project) where it fits: `Select` for sort and the single-choice filters, `ToggleGroup` for the view pill, `Accordion`/`Collapsible` for the filter groups, possibly a `Combobox`/`Popover` multi-select for crop sites, `Tooltip` for terse labels. Keep native elements where they work better (e.g. print). Keyboard and screen-reader behaviour must stay at least as good. The standalone single file must stay self-contained.

   Done: `FilterSelect` (Bits `Select`) for sort and the eight single-choice filters ("All …" maps to an internal sentinel because Bits treats `''` as no selection); Bits `Accordion` for the three collapsible filter groups; `HeaderTip` (Bits `Tooltip`) on the List's Signal / RUP and FRAC / IRAC headers. Kept native: the crop-site checkbox list (14 options; a checkbox group is already the clearest multi-select), date inputs (native pickers), print, the compare checkboxes, the dialog (native `<dialog>`). e2e covers the accordion keys, select keyboard use (open, End, Enter, Escape, focus return) and tooltips on focus.

7. [x] **Before/after screenshots** at 1440 and 390 px for the user's review, plus updated e2e coverage for both views.

   Done: screenshots in the session scratchpad (`layout-review/before-*.png` from `main`, `after-*.png`), at 1440 and 390 px: products top, products scrolled (both views), a product dialog, `?embed`. Page height for 25 results (current catalog): 1440 px cards 14,597 → 11,372, list 4,253; 390 px cards 23,268 → 16,860, list 9,292. e2e covers both views (pill, rows, sorting, sticky headers, phone stacking, flags).

### 4a follow-up (user review, 2026-11-25; branch `layout-density`)

1. [x] Products column order: heading and intro, the label explanation, the search directly above the results, then one results toolbar row (count · "EPA data as of …" · Cards/List pill · Sort · Download menu), then the results.
2. [x] The label explanation becomes a collapsed "About label links" disclosure under the intro (closed by default at all widths, open in print). A native `<details>`: "Print this view" opens it; a browser print of a closed disclosure leaves it closed (Chrome can't show closed `<details>` content from CSS).
3. [ ] Export and print become one compact "Download ▾" menu (Bits `DropdownMenu`) in the toolbar row.
4. [ ] Sticky stack instead of an inner scroll panel: the tab bar pins as a thinner header once scrolled past; the search and toolbar row pin under it on desktop; the filter sidebar sits below both; on phones only the tab bar pins; about 110 px pinned on desktop; anchors and focus land below the pinned header. In `?embed` only, the results may scroll inside a panel sized to the iframe.
5. [ ] Card view caps ingredients like the List (first three + "N more"; all in the dialog).
6. [ ] List view: the Purpose column wraps at slashes or spaces, never mid-word.
7. [ ] Review screenshots (`after2-*.png`) and e2e checks for the pinned header (desktop) and tab-bar-only pinning (390 px).

### 4b. Shareable state and filtering (next batch)

- Search, filters, sort, view mode and tab in the URL (shareable links, back button, pre-filtered embeds such as `?embed&crop=soybeans`)
- Counts next to filter options (e.g. "Soybeans (412)")
- Clicking an ingredient filters products to it

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

## Labels: EPA-accepted vs manufacturer labels (investigated 2026-11-25)

**What we link (updated 2026-11-25):** `safety.label_url` is the newest PPLS file for the exact Section 3 registration that holds a **full** label. A PPLS file is EPA's stamped-label package: a 1–3 page EPA acceptance letter, then the EPA-accepted master label (bracketed optional text, alternate brand names and reviewer notes included, so not the marketed container label). The UI calls it "EPA-accepted label (PDF)" and says the PDF opens with EPA's letter.

**Supplemental-only files:** a full survey of the newest file for all 628 products (pypdf text, 2026-11-25) found only 3 products whose newest file is supplemental labeling without the full label: 264-968 Gaucho 600 (current, expires 2029), 62719-412 Laredo EC and 62719-493 Laredo EW (2007–08). Supplemental labeling that _includes_ the full label (e.g. 100-1648 Saltro, supplemental pages then the master label) is fine as is. 505 files had all four full-label sections; most of the rest are plant-incorporated-protectant (Bt trait) labels, which legitimately lack First Aid, plus 5 files with no extractable text. These files are listed in `pipeline/reference/label-files.json` (hand-reviewed); the pipeline links the newest full label and publishes newer supplemental-only files as `safety.supplemental_labels`, shown next to the label link. New supplemental-only files are **not** detected automatically; parsing every PDF weekly isn't worth it for ~0.5% of products. Add entries when one is found.

**Manufacturer (specimen) label sources:**

- **TELUS Agronomy** (formerly Agrian) and **CDMS**, both now TELUS. Labels are manufacturer-approved. Licensable through the **TELUS Label API (formerly the CDMS API)** for ag-tech use; no public pricing. Agrian's terms: database content is for general information and doesn't replace the manufacturer's label.
- **Greenbook** (Agworld/Semios): API by request, licensed commercially. Its terms (§9) restrict labels to individual non-commercial use and forbid giving third parties access or building a database from it; `/search` is disallowed in robots.txt.
- **Manufacturer websites:** no common structure (some behind sign-up); scraping would be brittle and is not planned. Retailers (e.g. FBN) also host specimen labels.
- **Plain link-outs** (search by reg number, no data copied) could not be verified: the Agrian/TELUS pages return 403 to automated fetches, CDMS search is JavaScript-only with no verified URL pattern, and Greenbook search is robots-disallowed.

## Backlog

- [ ] **Ask TELUS about the Label API** (formerly the CDMS API) for manufacturer specimen labels: terms for a non-commercial extension/university tool, and whether CPN's member universities already have a TELUS/CDMS relationship. If licensed: add a "Manufacturer label" link next to the EPA-accepted label, refreshed by the weekly job. Owner: the user / CPN. See "Labels" above.
- [ ] **"Widely used" ranking (sort option and/or badge).** No free product-level usage data was found (2026-11-25):
  - USGS county estimates are by active ingredient and [stopped including seed treatments in 2015](https://www.usgs.gov/data/estimated-annual-agricultural-pesticide-use-counties-conterminous-united-states-2013-17-ver-20).
  - NASS chemical-use surveys and EPA usage estimates are also by active ingredient.
  - Product-level data comes from Kynetec (paid; e.g. its dealer-applied corn seed treatment study).
  - In-catalog proxies don't work: distributor-record counts rank only Bt traits (MON 810: 174), while CruiserMaxx, Poncho and Gaucho score 0.

  Options:
  - (a) A CPN-specialist-curated list per crop in `pipeline/reference/` (honest: "Widely used, per CPN specialists").
  - (b) Kynetec data. Ruled out by the user (2026-11-25): far too expensive.
  - (c) **Our own popularity signal from usage analytics.** Log searches and product views (the v1 project already sends GA4 custom events `search`, `filter_change`, `view_product` from `src/lib/analytics.ts`). The pipeline would pull aggregated counts (e.g. product views over the last 90 days) through the GA4 Data API, using a service-account key as a GitHub secret, and publish a per-product score.
    - Caveats: low traffic makes the ranking noisy, so set a minimum threshold and show it only once there's enough data. A "most viewed" default sort feeds on itself, so offer it as an opt-in sort or a badge rather than the default. It measures interest among this tool's users, not field use, so label it "Most viewed here". GA's cookies in a cross-origin iframe need `SameSite=None;Secure`, as v1 does, and privacy-blocking browsers undercount.
    - A cheap first step: add the analytics events now (decide on the GA property: reuse v1's or a new one), let data accumulate, and decide on the ranking once there's a few months of traffic.

  Decide on the source before building any ranking.

- [ ] State registration selector: parked until a data source exists (see "Future: state registration").

## Open decisions

- Embed mode: query param vs separate `embed.html` entry (leaning query param, one build)
- Catalog size strategy (see Phase 2)
- What to do about fact sheet generation (`build_fact_sheet.py`, reportlab)

## Follow-ups noticed

- [x] Removed the unused JSON-feed import path (`catalog.sync` / `filter_products` / `snapshot_validate`, `EPA_FEED_URL`) and the throwaway per-run SQLite DB. The rollback and 30%-loss guards now compare against the published catalog JSON. A forced real run produced byte-identical output.
- `pipeline/sources.py` (EPA PPIS fixed-width parser, Greenbook page scraper) is a manual research tool that no job uses; its output is "review material". Keep or drop: undecided.
