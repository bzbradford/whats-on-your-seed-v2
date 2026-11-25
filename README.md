# What's on Your Seed? v2

A searchable database of EPA-registered field crop seed treatments for the [Crop Protection Network](https://cropprotectionnetwork.org/). The data is updated automatically every day from EPA's APPRIL database.

**Live site:** https://bzbradford.github.io/whats-on-your-seed-v2/

- Compact layout for embedding in an iframe: [`?embed`](https://bzbradford.github.io/whats-on-your-seed-v2/?embed)
- Offline single-file version: [whats-on-your-seed-standalone.html](https://bzbradford.github.io/whats-on-your-seed-v2/whats-on-your-seed-standalone.html)

> **Work in progress.** This is a rebuild, as a maintainable Svelte app, of a seed treatment database originally developed in [danieham-97/crop-protection-network](https://github.com/danieham-97/crop-protection-network). Until the port is complete, the original app is kept unchanged in [`legacy/`](legacy/) as the reference. See [PLAN.md](PLAN.md) for progress.

## How it works

1. **Pipeline** ([`pipeline/`](pipeline/), Python). A weekly GitHub Actions job ([`data-update.yml`](.github/workflows/data-update.yml)) asks EPA whether its APPRIL workbook has changed. If it has, the job downloads it, keeps the 14 seed-treatment sites in scope, and writes validated JSON to [`public/data/`](public/data/). It commits only when the catalog actually changes, so the git history of `public/data/` is the change log.
2. **Web app** (Svelte, at the repo root). The app loads that JSON. It is built and deployed to GitHub Pages on every push to `main` and after each data update.

There is no server: everything is static files.

## Development

Requires Node 24+ with pnpm, and [uv](https://docs.astral.sh/uv/) for the pipeline.

```bash
pnpm install
pnpm dev                 # local dev server
pnpm verify              # lint, type check, unit tests, both builds
pnpm test:e2e            # browser tests (first time: pnpm exec playwright install chromium)

cd pipeline
uv run pytest            # pipeline tests, including checks on the committed catalog
uv run python scheduled_update.py   # check EPA; update public/data/ if the workbook changed
```

## Limitations

The catalog reports federal EPA registration information. Federal registration does not establish state approval or confirm that a particular use is permitted. Always check the current product label, seed tag, and state requirements.
