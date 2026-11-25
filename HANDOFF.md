# Handoff

_Last updated: 2026-11-25_

## Where things stand

- Repo: `bzbradford/whats-on-your-seed-v2`, a fork of `danieham-97/crop-protection-network` (remote `upstream`, reference only; we won't merge back). Default branch is `main`.
- **Phase 1 scaffold is in place**: Svelte/Vite/TS/Tailwind app at the repo root, with Vitest and Playwright. It loads the catalog and renders a bare product list in both build modes (Pages and standalone single file) and in `?embed` view. `pnpm verify` and `pnpm test:e2e` pass locally.
- The legacy app and pipeline in `seed-treatment-database/` are unchanged, and their test suite still passes. The new app reads their published JSON via `scripts/sync-data.js` for now.
- Next: confirm the first Pages deploy, then Phase 2 (pipeline to uv/pytest, writing into `public/data/`).

## Things to know

- **Actions on the fork:** the daily `seed-database-update.yml` would commit catalog updates to `main`. Keep that workflow disabled until the pipeline writes to the new layout, even once Actions are enabled for CI/Pages.
- The legacy app fetches updates from the hard-coded `PUBLISHED_DATA_URL` (danieham-97's raw GitHub URL, `static/index.html` line ~515). Repoint it during the port.
- Label PDFs are **not** in the repo. Products link to EPA PPLS PDFs (630 of 880 have one). The only committed PDF is the CPN fact sheet.
- `CPN_Seed_Treatment_Preview.html` (3.2 MB) is the legacy standalone build; our replacement is `pnpm build:standalone`.
- See CLAUDE.md "Gotchas" for TS version pinning and the Playwright webServer quirk.
