# What's on Your Seed v2 — Claude guidance

## Project status

**Mid-conversion.** This repo is a fork of `danieham-97/crop-protection-network` (git remote `upstream`), a seed treatment database for the Crop Protection Network (CPN), originally generated with AI agents as one monolithic HTML page. We are rebuilding the frontend as a Svelte app with tests while keeping the Python EPA/APPRIL data pipeline.

- `PLAN.md` — roadmap, feature inventory (the parity checklist), open decisions. Check it before starting work; tick items as they land.
- `HANDOFF.md` — current state for the next session or person: what works, what's in progress, gotchas. Update it at the end of every working session.
- `tmp/session-log.md` — untracked, gitignored running log of each session (what was done, commands run, dead ends). Append to it as you work; never commit it.
- The predecessor project, `../whats-on-your-seed`, is the style reference: same stack, and its CLAUDE.md conventions apply here unless this file says otherwise.

Until the port is complete, `seed-treatment-database/` holds the **legacy** app and pipeline. Don't add features to `seed-treatment-database/static/index.html`; port them instead.

## Target architecture

- **Frontend:** Svelte 5 (runes only) + Vite + TypeScript (strict) + Tailwind v4, pnpm. Static output only, no backend.
- **Deploy:** GitHub Pages from `main`. We don't plan to merge back to `upstream` (a personal account); it's a reference only.
- **Build targets** (one codebase):
  1. Pages site: full-page view by default; `?embed` (or similar) gives a compact layout for iframing.
  2. Standalone single-file HTML (`vite-plugin-singlefile`) with the catalog embedded for offline use. It may poll the published Pages JSON for updates.
- **Tests:** Vitest for pure logic (filter/search/compare/CSV in `src/lib/`, framework-free TS), Playwright for browser/e2e, pytest for the pipeline.
- **Pipeline:** Python managed with uv, run by the daily GitHub Actions job. It writes validated JSON that the frontend loads at runtime (Pages) or embeds at build time (single-file).

## Conventions

- Keep business logic out of `.svelte` files: put it in typed `src/lib/*.ts` modules with Vitest coverage. Components render state and dispatch.
- Use relative/`import.meta.env.BASE_URL` paths, never root-absolute URLs (Pages serves under a subpath).
- No CDN resources; the bundle and single-file build must be self-contained (fonts/logos included).
- The app must work in a cross-origin iframe: `localStorage` is optional (wrap in try/catch), outbound links use `target="_blank"`.
- Never hand-edit generated data JSON; change the pipeline or its reference inputs.
- Content correctness matters (pesticide registration data): preserve the legacy app's disclaimers, provenance and "missing/unreviewed" flags when porting.

## Commands

```bash
pnpm install            # pnpm only; version pinned via packageManager
pnpm dev                # copy data into public/data/, start Vite dev server
pnpm build              # Pages build -> dist/
pnpm build:standalone   # offline single file -> dist-standalone/index.html (catalog inlined)
pnpm preview            # serve dist/
pnpm test               # Vitest unit tests (tests/unit/)
pnpm test:e2e           # build, then Playwright against vite preview (tests/e2e/)
pnpm lint / pnpm format # Prettier + ESLint (lint runs as the pre-commit hook)
pnpm check              # svelte-check, fails on any warning
pnpm verify             # lint + check + unit tests + both builds (CI also runs e2e)
python3 seed-treatment-database/test_project.py --require-node   # legacy suite
```

## Key files

- `src/lib/catalog.ts` — catalog validation, fetch, and `loadCatalog()` (fetch on Pages; inlined `?raw` import when `MODE === 'standalone'`, dead-code-eliminated from the Pages bundle)
- `src/lib/view-mode.ts` — `?embed` → compact layout
- `src/lib/types.ts` — catalog types (partial; grow as features are ported)
- `scripts/sync-data.js` — **temporary**: copies legacy `seed-treatment-database/static/*.json` into gitignored `public/data/` before dev/build. Goes away when the pipeline writes there (Phase 2).
- `vite.config.js` — both build modes, `$data` alias, Vitest config
- `.github/workflows/deploy.yaml` — CI (lint, check, unit, builds, e2e) and Pages deploy from `main`

## Gotchas

- `gh` defaults to the `upstream` remote when one exists. `gh repo set-default` has been set to the fork locally; pass `-R bzbradford/whats-on-your-seed-v2` in fresh clones.
- TypeScript is pinned to 6.0.x: typescript-eslint and svelte-check don't support TS 7 yet.
- Playwright's `webServer` must invoke `vite preview` directly, not through `pnpm`, or the server is orphaned and Playwright hangs on exit.
- Don't `import` the catalog JSON as a module (TS would infer a type from 2.8 MB of JSON). Use `?raw` + `JSON.parse` + `parseCatalog`.
