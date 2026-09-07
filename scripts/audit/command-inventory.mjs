/**
 * @file scripts/audit/command-inventory.mjs
 * @description Builds the authoritative WebSocket command cross-reference
 * matrix required by audit sections U (commandes WebSocket) and BD
 * (documentation <-> code).
 *
 * For every command it answers five questions:
 *   registered? / has schema? / called by the frontend? / covered by a test? /
 *   documented in docs/API.md?
 *
 * The registered-command list is obtained by actually loading
 * `CommandRegistry` and its auto-discovered modules (not by grepping), so the
 * result cannot drift from runtime behaviour. Dependencies are supplied by a
 * permissive Proxy because `register()` only *binds* handlers — it never
 * resolves `app.*` until a command is dispatched.
 *
 * Usage: node scripts/audit/command-inventory.mjs [--json]
 */
import { readdirSync, readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');

/** Recursively collect files matching a predicate. */
function walk(dir, pred, acc = []) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return acc;
  }
  for (const e of entries) {
    const full = join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name !== 'node_modules') walk(full, pred, acc);
    } else if (pred(full)) {
      acc.push(full);
    }
  }
  return acc;
}

/** A dependency bag that never throws, whatever a module touches. */
function makeStubDeps() {
  const noop = () => undefined;
  const target = {
    logger: { info: noop, warn: noop, error: noop, debug: noop },
    eventBus: { emit: noop, on: noop, off: noop }
  };
  return new Proxy(target, {
    get(t, prop) {
      if (prop in t) return t[prop];
      if (typeof prop === 'symbol') return undefined;
      // Return a permissive stub for anything a module reaches for.
      return new Proxy(noop, {
        get: () => noop,
        apply: () => undefined
      });
    },
    has: () => true
  });
}

async function collectRegisteredCommands() {
  const { default: CommandRegistry } = await import(join(ROOT, 'src/api/CommandRegistry.js'));
  const registry = new CommandRegistry(makeStubDeps());
  await registry.loadCommandModules();
  return Object.keys(registry.handlers).sort();
}

/** Map command -> the module file that registers it (static scan). */
function collectRegistrationSites() {
  const dir = join(ROOT, 'src/api/commands');
  const map = new Map();
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.js'))) {
    const src = readFileSync(join(dir, f), 'utf8');
    for (const m of src.matchAll(/registry\.register\(\s*['"]([a-zA-Z0-9_]+)['"]/g)) {
      map.set(m[1], f);
    }
  }
  // Commands registered from helper modules outside src/api/commands.
  for (const f of walk(join(ROOT, 'src/midi/playback/commands'), (p) => p.endsWith('.js'))) {
    const src = readFileSync(f, 'utf8');
    for (const m of src.matchAll(/registry\.register\(\s*['"]([a-zA-Z0-9_]+)['"]/g)) {
      if (!map.has(m[1])) map.set(m[1], f.slice(ROOT.length + 1));
    }
  }
  return map;
}

async function collectSchemas() {
  const dir = join(ROOT, 'src/api/commands/schemas');
  const byCommand = new Map();
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.schemas.js'))) {
    const mod = await import(join(dir, f));
    const bag = mod.default ?? {};
    for (const key of Object.keys(bag)) byCommand.set(key, f);
  }
  return byCommand;
}

/** Which schema files are actually wired into JsonValidator. */
function collectWiredSchemaFiles() {
  const src = readFileSync(join(ROOT, 'src/utils/JsonValidator.js'), 'utf8');
  return new Set([...src.matchAll(/schemas\/([a-z_]+\.schemas\.js)/g)].map((m) => m[1]));
}

function collectFrontendCalls() {
  // AUDIT L01 (2026-09-07): `public/index.html` carries ~14.5k lines of inline
  // SPA script with 75 `sendCommand(...)` call sites. Scanning only
  // `public/js/**.js` therefore over-reported orphan commands by a wide margin
  // (the 2026-08-22 figure of "123 never called by the frontend" was inflated).
  // Every `public/**` .js AND .html file is now scanned.
  const files = walk(join(ROOT, 'public'), (p) => p.endsWith('.js') || p.endsWith('.html'));
  const map = new Map();
  const add = (cmd, f) => {
    if (!map.has(cmd)) map.set(cmd, []);
    const rel = f.slice(ROOT.length + 1);
    if (!map.get(cmd).includes(rel)) map.get(cmd).push(rel);
  };
  for (const f of files) {
    const src = readFileSync(f, 'utf8');
    // Direct call with a literal name (quote or backtick).
    for (const m of src.matchAll(
      /(?:sendCommand|sendCommandWithRetry)\(\s*['"`]([a-zA-Z0-9_]+)['"`]/g
    )) {
      add(m[1], f);
    }
    // Dispatch-table style: { command: 'x' } / command = 'x'
    for (const m of src.matchAll(/command:\s*['"`]([a-zA-Z0-9_]+)['"`]/g)) {
      add(m[1], f);
    }
  }
  return map;
}

/**
 * Weaker signal: the command name appears as a bare quoted string anywhere in
 * `public/**` without matching a call pattern (dynamic dispatch, a name held in
 * a constant, a label in a table). Used only to split "orphan" into
 * "plausibly reachable" vs "no trace at all in the frontend".
 */
function collectFrontendMentions() {
  const files = walk(join(ROOT, 'public'), (p) => p.endsWith('.js') || p.endsWith('.html'));
  const blobs = files.map((f) => ({ f: f.slice(ROOT.length + 1), src: readFileSync(f, 'utf8') }));
  return (cmd) => {
    const needle = new RegExp(`['"\`]${cmd}['"\`]`);
    return blobs.filter((b) => needle.test(b.src)).map((b) => b.f);
  };
}

function collectTestMentions() {
  const files = walk(join(ROOT, 'tests'), (p) => p.endsWith('.js'));
  const blobs = files.map((f) => ({ f: f.slice(ROOT.length + 1), src: readFileSync(f, 'utf8') }));
  return (cmd) => {
    const needle = new RegExp(`['"\`]${cmd}['"\`]`);
    return blobs.filter((b) => needle.test(b.src)).map((b) => b.f);
  };
}

function collectDocumented() {
  const p = join(ROOT, 'docs/API.md');
  if (!existsSync(p)) return new Set();
  const src = readFileSync(p, 'utf8');
  return new Set([...src.matchAll(/`([a-z][a-z0-9_]{2,})`/g)].map((m) => m[1]));
}

const registered = await collectRegisteredCommands();
const sites = collectRegistrationSites();
const schemas = await collectSchemas();
const wiredFiles = collectWiredSchemaFiles();
const feCalls = collectFrontendCalls();
const feMentions = collectFrontendMentions();
const testsFor = collectTestMentions();
const documented = collectDocumented();

const rows = registered.map((cmd) => {
  const schemaFile = schemas.get(cmd) ?? null;
  return {
    command: cmd,
    module: sites.get(cmd) ?? '(dynamic)',
    schema: schemaFile,
    schemaWired: schemaFile ? wiredFiles.has(schemaFile) : false,
    frontend: feCalls.get(cmd)?.length ?? 0,
    frontendFiles: feCalls.get(cmd) ?? [],
    // Bare-string occurrence in public/** without a matched call site.
    frontendMentionOnly: (feCalls.get(cmd)?.length ?? 0) === 0 ? feMentions(cmd) : [],
    tests: testsFor(cmd).length,
    documented: documented.has(cmd)
  };
});

// Schemas that describe a command nobody registers.
const orphanSchemas = [...schemas.keys()].filter((k) => !registered.includes(k)).sort();
// Frontend calls that hit no registered command.
const phantomCalls = [...feCalls.keys()].filter((k) => !registered.includes(k)).sort();

const summary = {
  registered: registered.length,
  withSchema: rows.filter((r) => r.schema).length,
  withWiredSchema: rows.filter((r) => r.schemaWired).length,
  schemaFileNotWired: [
    ...new Set(rows.filter((r) => r.schema && !r.schemaWired).map((r) => r.schema))
  ],
  calledByFrontend: rows.filter((r) => r.frontend > 0).length,
  neverCalledByFrontend: rows.filter((r) => r.frontend === 0).map((r) => r.command),
  // Orphans split by strength of evidence (audit L01).
  orphanMentionedOnly: rows
    .filter((r) => r.frontend === 0 && r.frontendMentionOnly.length > 0)
    .map((r) => r.command),
  orphanNoTrace: rows
    .filter((r) => r.frontend === 0 && r.frontendMentionOnly.length === 0)
    .map((r) => r.command),
  withTests: rows.filter((r) => r.tests > 0).length,
  withoutTests: rows.filter((r) => r.tests === 0).map((r) => r.command),
  documented: rows.filter((r) => r.documented).length,
  undocumented: rows.filter((r) => !r.documented).map((r) => r.command),
  orphanSchemas,
  phantomFrontendCalls: phantomCalls
};

if (process.argv.includes('--json')) {
  console.log(JSON.stringify({ summary, rows }, null, 2));
} else {
  const pct = (n) => `${((n / summary.registered) * 100).toFixed(1)}%`;
  console.log(`Registered commands       : ${summary.registered}`);
  console.log(`  with payload schema     : ${summary.withSchema} (${pct(summary.withSchema)})`);
  console.log(
    `  schema wired to validator: ${summary.withWiredSchema} (${pct(summary.withWiredSchema)})`
  );
  console.log(
    `  called by frontend      : ${summary.calledByFrontend} (${pct(summary.calledByFrontend)})`
  );
  console.log(`  mentioned in tests      : ${summary.withTests} (${pct(summary.withTests)})`);
  console.log(`  documented in API.md    : ${summary.documented} (${pct(summary.documented)})`);
  console.log(
    `  orphan: mentioned only  : ${summary.orphanMentionedOnly.length} / no trace in public/: ${summary.orphanNoTrace.length}`
  );
  console.log(`Orphan schemas (no command): ${orphanSchemas.length} ${orphanSchemas.join(', ')}`);
  console.log(`Phantom frontend calls     : ${phantomCalls.length} ${phantomCalls.join(', ')}`);
  console.log(`Schema files not wired     : ${summary.schemaFileNotWired.join(', ') || '(none)'}`);
}
