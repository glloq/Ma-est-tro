/**
 * @file scripts/audit/dead-modules.mjs
 * @description Finds modules that nothing imports (audit A01 / A04:
 * "code inaccessible ou obsolète", "fonctionnalités abandonnées").
 *
 * A module counts as reachable when some other file imports it by path via
 * `import ... from '<path>'`, `import('<path>')` or `require('<path>')`.
 * Matching is done on the resolved path, so a substring collision between an
 * identifier (`handleMidiMessage`) and a filename (`MidiMessage.js`) cannot
 * make a dead module look alive.
 *
 * Entry points (server.js, the SPA bootstraps, anything referenced from HTML
 * or a config) are seeded as roots so they are never reported.
 *
 * Two loading conventions in this codebase would otherwise produce false
 * "dead" verdicts, so both are handled explicitly:
 *   1. `src/api/commands/*.js` are auto-discovered at runtime by
 *      `CommandRegistry.loadCommandModules()` (readdirSync + import) — there
 *      is deliberately no static import of them anywhere.
 *   2. Lighting drivers are reached through the `DRIVER_MODULES` map in
 *      LightingManager.js, i.e. a quoted relative path in an object literal
 *      rather than an import statement. Any quoted relative `.js` path in a
 *      source file therefore counts as a reference.
 *
 * Usage: node scripts/audit/dead-modules.mjs [--json]
 */
import { readdirSync, readFileSync, existsSync } from 'fs';
import { join, dirname, resolve, relative } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

function walk(dir, acc = []) {
  if (!existsSync(dir)) return acc;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, e.name);
    if (e.isDirectory()) {
      if (!['node_modules', 'coverage', '.git'].includes(e.name)) walk(full, acc);
    } else if (full.endsWith('.js') || full.endsWith('.mjs')) acc.push(full);
  }
  return acc;
}

const files = [...walk(join(ROOT, 'src')), ...walk(join(ROOT, 'public/js'))];

// Every path referenced by an import/require/dynamic-import anywhere in the
// repo (including tests, scripts and HTML script tags).
const referenced = new Set();
const scanned = [
  ...files,
  ...walk(join(ROOT, 'tests')),
  ...walk(join(ROOT, 'scripts')),
  join(ROOT, 'server.js'),
  join(ROOT, 'vite.config.js')
];

for (const f of scanned) {
  if (!existsSync(f)) continue;
  const src = readFileSync(f, 'utf8');
  // Any quoted relative `.js` path counts — this catches import statements,
  // dynamic import() and dynamic-module maps such as LightingManager's
  // DRIVER_MODULES, where the path only ever appears as an object value.
  const specs = [...src.matchAll(/['"](\.{1,2}\/[^'"]+\.js)['"]/g)].map((m) => m[1]);
  for (const spec of specs) {
    if (!spec.startsWith('.') && !spec.startsWith('/')) continue;
    referenced.add(resolve(dirname(f), spec));
  }
}

// Script tags and module preloads in HTML.
for (const html of readdirSync(join(ROOT, 'public')).filter((f) => f.endsWith('.html'))) {
  const src = readFileSync(join(ROOT, 'public', html), 'utf8');
  for (const m of src.matchAll(/(?:src|href)=["']([^"']+\.js)["']/g)) {
    referenced.add(resolve(join(ROOT, 'public'), m[1].replace(/^\//, '')));
  }
}

const ENTRY = /(server\.js|main\.js|app\.js|index\.js|bootstrap\.js)$/;
/** Auto-discovered by CommandRegistry.loadCommandModules() — never statically imported. */
const CONVENTION_LOADED = /src\/api\/commands\/[^/]+\.js$/;

const orphans = files
  .filter((f) => !referenced.has(f) && !ENTRY.test(f) && !CONVENTION_LOADED.test(f))
  .map((f) => {
    const src = readFileSync(f, 'utf8');
    return {
      file: relative(ROOT, f),
      lines: src.split('\n').length,
      exportsDefault: /export\s+default/.test(src)
    };
  })
  .sort((a, b) => b.lines - a.lines);

if (process.argv.includes('--json')) {
  console.log(JSON.stringify(orphans, null, 2));
} else {
  const total = orphans.reduce((a, o) => a + o.lines, 0);
  console.log(`Unreferenced modules: ${orphans.length} (${total} lines)\n`);
  for (const o of orphans) {
    console.log(`  ${String(o.lines).padStart(5)} lines  ${o.file}`);
  }
}
