# Legacy reference

`static/` is the **visual baseline** for the Svelte port: the app as of upstream
commit `435c0bf` (2026-10-19, "Add product label downloads, EPA lookups and
label-link exports"). It's the version the user was shown, as
`CPN_Seed_Treatment_Preview.html`, and chose as the target look.

Upstream later streamlined this UI on `master` (Oct 21–30: 5 tabs → 3, About
section, citation, draft disclaimer, state data removed, online refresh). That
version is still in git history if you need its content:

    git show 9b45623:legacy/static/index.html

The other files in `legacy/` (docs, preview builders, `.cjs` tests, `serve.py`)
come from that later version. Read the docs as background, not as a spec for
`static/`.

Run the reference: `python3 legacy/serve.py --port 8081 --no-browser`
