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

Legacy baseline (passes as of 2026-11-25):

```bash
python3 seed-treatment-database/test_project.py --require-node
```

New commands will be added here as the scaffold lands.
