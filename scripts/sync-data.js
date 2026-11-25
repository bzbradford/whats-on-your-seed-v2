// Copy the published catalog files from the legacy pipeline output into public/data/.
// Temporary bridge: in Phase 2 the pipeline will write to public/data/ directly and
// this script goes away. See PLAN.md.
import { copyFileSync, mkdirSync } from 'node:fs';

const SRC = 'seed-treatment-database/static';
const DEST = 'public/data';
const FILES = ['catalog.json', 'sync-status.json', 'update-history.json', 'epa-import-audit.json'];

mkdirSync(DEST, { recursive: true });
for (const f of FILES) copyFileSync(`${SRC}/${f}`, `${DEST}/${f}`);
console.log(`sync-data: copied ${FILES.length} files from ${SRC} to ${DEST}`);
