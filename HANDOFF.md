# Handoff

_Last updated: 2026-11-25_

## Where things stand

- Repo: `bzbradford/whats-on-your-seed-v2`, a fork of `danieham-97/crop-protection-network` (remote `upstream`, reference only; we won't merge back). Default branch is `main`.
- Nothing has been ported yet. The legacy app and pipeline in `seed-treatment-database/` are untouched, and their test suite passes.
- Stack and plan are agreed: see `CLAUDE.md` (architecture) and `PLAN.md` (phases and parity checklist).
- Next step: Phase 1 scaffold.

## Things to know

- **GitHub Actions are off on the fork** (GitHub's default for forks). The daily `seed-database-update.yml` job would commit catalog updates. Leave it off until the pipeline writes to the new layout.
- The legacy app fetches updates from the hard-coded `PUBLISHED_DATA_URL` (danieham-97's raw GitHub URL, `static/index.html` line ~515). Repoint it during the port.
- Label PDFs are **not** in the repo. Products link to EPA PPLS PDFs (630 of 880 have one). The only committed PDF is the CPN fact sheet.
- `CPN_Seed_Treatment_Preview.html` (3.2 MB) is a generated standalone build with the data embedded; `test_project.py` regenerates it.
- The root `.gitignore` is a stock Visual Studio template; `tmp/` was added for local session logs.
