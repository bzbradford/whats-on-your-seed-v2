# What's on Your Seed v2 — Claude guidance

## Project status

**Mid-conversion.** This repo is a fork of `danieham-97/crop-protection-network` (git remote `upstream`), a seed treatment database for the Crop Protection Network (CPN), originally generated with AI agents as one monolithic HTML page. We are rebuilding the frontend as a Svelte app with tests while keeping the Python EPA/APPRIL data pipeline.

- `PLAN.md` — roadmap, feature inventory (the port checklist), open decisions. Check it before starting work; tick items as they land.
- `HANDOFF.md` — current state for the next session or person: what works, what's in progress, gotchas. Update it at the end of every working session.
- `tmp/session-log.md` — untracked, gitignored running log of each session (what was done, commands run, dead ends). Append to it as you work; never commit it.
- The predecessor project, `../whats-on-your-seed`, is the style reference: same stack, and its CLAUDE.md conventions apply here unless this file says otherwise.

## Layout

- repo root: the Svelte app (`src/`, `tests/`, `public/`)
- `public/data/` — **pipeline output, committed**: `catalog.json`, `sync-status.json`, `update-history.json`, `epa-import-audit.json`. The weekly job commits here, only when the catalog changes.
- `pipeline/` — Python (uv). `reference/` holds the hand-curated inputs (scope, ingredient FRAC/IRAC reference, education text, label specs, source references).
- `legacy/` — the original app, **frozen** as the visual/behaviour reference for the port. `static/` is the **Oct 19 UI** (upstream `435c0bf`, see `legacy/REFERENCE.md`), the look the user chose; the later streamlined master UI is `git show 9b45623:legacy/static/index.html`. The other files in `legacy/` (docs, `.cjs` tests) are from the later version. Don't edit it; delete it at cutover.

**Port goal:** the legacy Oct 19 UI was replicated exactly (signed off by the user; pixel parity tests are retired). Design now iterates from that base. See PLAN.md Phase 3.

## Target architecture

- **Frontend:** Svelte 5 (runes only) + Vite + TypeScript (strict) + Tailwind v4, pnpm. Static output only, no backend.
- **Deploy:** GitHub Pages from `main`. We don't plan to merge back to `upstream` (a personal account); it's a reference only.
- **Build targets** (one codebase):
  1. Pages site: full-page view by default; `?embed` (or similar) gives a compact layout for iframing.
  2. Standalone single-file HTML (`vite-plugin-singlefile`) with the catalog embedded for offline use. It may poll the published Pages JSON for updates.
- **Tests:** Vitest for pure logic (filter/search/compare/CSV in `src/lib/`, framework-free TS), Playwright for browser/e2e, pytest for the pipeline.
- **Pipeline:** Python managed with uv, run by the weekly GitHub Actions job. It writes validated JSON that the frontend loads at runtime (Pages) or embeds at build time (single-file).

## Conventions

- Keep business logic out of `.svelte` files: put it in typed `src/lib/*.ts` modules with Vitest coverage. Components render state and dispatch.
- Use relative/`import.meta.env.BASE_URL` paths, never root-absolute URLs (Pages serves under a subpath).
- No CDN resources; the bundle and single-file build must be self-contained (fonts/logos included).
- The app must work in a cross-origin iframe: `localStorage` is optional (wrap in try/catch), outbound links use `target="_blank"`.
- Never hand-edit generated data JSON; change the pipeline or its reference inputs.
- **Styling:** `src/styles/legacy.css` is the Oct 19 `<style>` block (global, prettier-ignored; its `@font-face` lives in `src/styles/fonts.css`) and stays the base: components keep the legacy DOM, ids and class names it targets. Don't edit `legacy.css` for new work. Put new or changed styles in a scoped `<style>` block in the component, as in the predecessor (`@reference '../app.css';` plus semantic class names, `@apply` where Tailwind utilities help). Scoped rules win over the global legacy rules only with enough specificity, so target the component's own class (e.g. `.hero .shell`) rather than restating legacy selectors. Tailwind is loaded without preflight (`src/app.css`) so it can't disturb the legacy base.
- Business rules (search, filters, labels, safety, matrix, CSV, currency, sync) live in framework-free `src/lib/*.ts` with Vitest tests. `src/lib/app-state.svelte.ts` is the only runes module: thin glue that calls them. Components read `getApp()` (context) and render.
- Content correctness matters (pesticide registration data): preserve the legacy app's disclaimers, provenance and "missing/unreviewed" flags when porting.

## Commands

```bash
pnpm install            # pnpm only; version pinned via packageManager
pnpm dev                # Vite dev server
pnpm build              # Pages build -> dist/
pnpm build:standalone   # offline single file -> dist-standalone/index.html (catalog inlined)
pnpm preview            # serve dist/
pnpm test               # Vitest unit tests (tests/unit/)
pnpm test:e2e           # both builds, then Playwright against vite preview (4173) and the file:// standalone
python3 legacy/serve.py --port 8081 --no-browser  # view the legacy reference app (not used by tests)
pnpm lint / pnpm format # Prettier + ESLint (lint runs as the pre-commit hook)
pnpm check              # svelte-check, fails on any warning
pnpm verify             # lint + check + unit tests + both builds (CI also runs e2e)

cd pipeline
uv run pytest           # pipeline tests, incl. checks on the committed public/data/catalog.json
uv run ruff check . && uv run ruff format .
uv run python scheduled_update.py            # check EPA; writes public/data/ only if the catalog changed
uv run python scheduled_update.py --force    # download even if EPA's headers are unchanged
uv run python scheduled_update.py --output /tmp/out/catalog.json  # dry run (copy public/data/*.json there first)
```

## Key files

- `src/App.svelte` — page shell (icon sprite, header, hero with `#hero-mode`, start strip, five tabs, notice, footer); mounts into `<body>` (legacy print CSS selects `body > header`/`body > main`)
- `src/components/` — one per tab: `ProductsTab` (+ `ProductCard`), `MatrixTab` (+ `MatrixCellView`), `IngredientsTab`, `GuideTab` (+ `GuideContent`), `DataTab` (+ `DataGrid`, which also holds the brought-forward About, data-currency and citation panels); `DetailDialog` (+ `ProductDetail`, `IngredientDetail`), `CompareBar`, `Disclaimer` (master-era footer); small `Icon`/`IconSprite` (legacy `#icon-*` set), `PurposeBadge`, `ExtLink`, `LabelAction`, `SafetyBadges`, `SourceLinks`
- `src/styles/legacy.css` — Oct 19 CSS, verbatim; `fonts.css` — Roboto Condensed `@font-face`; `embed.css` — minimal `?embed` rules
- `src/lib/app-state.svelte.ts` — `AppState`: catalog/status/history, filters, page, selection, view, dialog, toast, live regions; `start()` / `poll()` (five-minute refresh, both builds)
- `src/lib/filters.ts` (search/filters/sort/pager/applied chips), `product-facts.ts` (reference lookup, FRAC/IRAC, signal word, RUP, quality), `labels.ts` (EPA label PDF identity guards), `compare.ts` (selection cap/order, localStorage, matrix picker), `matrix.ts` (label-extract guards, matrix rows), `csv.ts` (exports, injection-safe cells), `ingredients.ts`, `currency.ts` (data dates, warnings, citation, history), `sync.ts` (fetch published files, carry filters over), `announcer.ts`, `print.ts`, `format.ts`
- `src/lib/catalog.ts` — catalog/status/history validation (legacy's published-catalog checks), fetch with timeout, and `loadEmbedded()` (standalone only: catalog, sync-status and update-history inlined via `?raw`, dead-code-eliminated from the Pages bundle)
- `src/lib/types.ts` — full catalog, sync-status and update-history types; `tests/unit/types.test.ts` checks them against `public/data` and the pipeline fixture
- `src/lib/assets.ts` — fact sheet URL: `public/assets/` on Pages, an inlined `data:` URL in the standalone file
- `tests/unit/` — Vitest; legacy `logic_test.cjs` cases run against the frozen `pipeline/tests/fixtures/catalog-2026-10-19.json.gz`
- `tests/e2e/app.spec.ts` (legacy `ui_test.cjs` behaviours, Oct 19 and later, plus overflow checks), `standalone.spec.ts` (file://, offline/online/outage)
- `vite.config.js` — both build modes, `$data` alias, Vitest config
- `.github/workflows/deploy.yaml` — CI (web: lint, check, unit, builds, e2e; pipeline: ruff, pytest) and Pages deploy from `main`
- `.github/workflows/data-update.yml` — weekly, Mondays 06:30 America/Chicago (manual run has a `force` option): HEAD-check EPA → download only if changed → if `public/data/` changed, validate everything → commit → dispatch `deploy.yaml`. Unchanged weeks commit nothing; failures fail the job (GitHub emails) and write nothing.
- `pipeline/scheduled_update.py` — entry point for the weekly job (its docstring explains the write rules); `sync-status.json` holds EPA's last-seen `source_headers`; `catalog.py` holds scope/reference data, validation helpers, provider-feed `enrich()` and `publish()` (catalog assembly + loss guard vs the previous catalog); `refresh_epa.py` downloads/imports a workbook (also usable directly with `--workbook` for a local file); `appril_workbook.py` parses the EPA xlsx with stdlib only

## Gotchas

- `sync-status.json` is only rewritten when the catalog changes, so its `checked_at` is when the current catalog was produced, not the last check. Don't build a "last checked" UI on it; the Actions run history is the record of checks.
- Scheduled cron times avoid `:00` on purpose: GitHub delays or drops scheduled runs at the top of the hour under load.
- Pushes made with `GITHUB_TOKEN` don't trigger workflows, which is why `data-update.yml` dispatches the deploy explicitly.
- `pipeline/tests/test_published_catalog.py` checks the committed `public/data/` files, so a bad data commit fails CI.
- `gh` defaults to the `upstream` remote when one exists. `gh repo set-default` has been set to the fork locally; pass `-R bzbradford/whats-on-your-seed-v2` in fresh clones.
- TypeScript is pinned to 6.0.x: typescript-eslint and svelte-check don't support TS 7 yet.
- Playwright's `webServer` must invoke `vite preview` directly, not through `pnpm`, or the server is orphaned and Playwright hangs on exit.
- Don't `import` the catalog JSON as a module (TS would infer a type from 2.8 MB of JSON). Use `?raw` + `JSON.parse` + `parseCatalog`.
- `catalog.json` is loaded with `$state.raw` (never deep-proxied). Filter haystacks are cached per product object in a WeakMap.
- The Oct 19 reference really uses Roboto Condensed for headings (`--font-heading`), so `src/assets/roboto-condensed.ttf` is bundled (inlined in the standalone file; OFL licence in `src/assets/`). `legacy/BRANDING.md` says it's unused: that describes the later master UI, not `legacy/static/`.
