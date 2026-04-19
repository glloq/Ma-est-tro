#!/usr/bin/env node
// scripts/rename-project.js
// One-shot rebrand tool: Ma-est-tro / Maestro / MidiMind -> Général Midi Boop / gmboop.
// Run `node scripts/rename-project.js` for dry-run, `--yes` to write.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const EXCLUDED_DIRS = new Set([
  '.git', 'node_modules', 'data', 'logs', 'backups', 'dist', 'build', 'coverage', '.cache', '.vite'
]);

const EXCLUDED_FILES = new Set([
  'package-lock.json',
  path.basename(fileURLToPath(import.meta.url)),
]);

const TEXT_EXTENSIONS = new Set([
  '.js', '.cjs', '.mjs', '.ts', '.tsx', '.jsx',
  '.json', '.md', '.yml', '.yaml', '.toml',
  '.sh', '.bash', '.zsh',
  '.sql', '.css', '.html', '.htm', '.xml', '.svg',
  '.env', '.example', '.conf', '.config', '.service', '.ini', '.properties',
  '.txt'
]);

const EXTENSIONLESS_ALLOWED = new Set([
  'Dockerfile', 'Makefile', '.env.example', 'CHANGELOG', 'README', 'LICENSE'
]);

// Ordered replacements: most specific first to avoid cascading substitutions.
const REPLACEMENTS = [
  ['github.com/glloq/Ma-est-tro', 'github.com/glloq/General-Midi-Boop'],
  ['cd ~/Ma-est-tro', 'cd ~/General-Midi-Boop'],
  ['cd Ma-est-tro', 'cd General-Midi-Boop'],
  ['Ma-est-tro/', 'General-Midi-Boop/'],
  ["source_name || 'Ma-est-tro'", "source_name || 'GeneralMidiBoop'"],
  ['Ma-est-tro', 'Général Midi Boop'],
  ['MidiMind Manufacturer', 'GMB Manufacturer'],
  ['MidiMind Block 1', 'GMB Block 1'],
  ['MidiMind', 'GeneralMidiBoop'],
  ['midimind-', 'gmboop-'],
  ['midimind.service', 'gmboop.service'],
  ['midimind.db', 'gmboop.db'],
  ['midimind.log', 'gmboop.log'],
  ['midimind', 'gmboop'],
  ['MAESTRO_', 'GMBOOP_'],
  ['maestro_settings', 'gmboop_settings'],
  ['maestro_filter_sections', 'gmboop_filter_sections'],
  ['maestro_locale', 'gmboop_locale'],
  ['maestro_update_completed', 'gmboop_update_completed'],
  ['maestro_uptime_seconds', 'gmboop_uptime_seconds'],
  ['maestro_websocket_clients', 'gmboop_websocket_clients'],
  ['maestro_memory_heap_used_bytes', 'gmboop_memory_heap_used_bytes'],
  ['maestro_memory_rss_bytes', 'gmboop_memory_rss_bytes'],
  ['maestro_info', 'gmboop_info'],
  ['maestro-data', 'gmboop-data'],
  ['maestro-logs', 'gmboop-logs'],
  ['maestro-backups', 'gmboop-backups'],
  ['maestro-routing-test-', 'gmboop-routing-test-'],
  ['wled/maestro', 'wled/gmboop'],
  ['maestro/light', 'gmboop/light'],
  ['Maestro', 'GeneralMidiBoop'],
  ['maestro', 'gmboop'],
];

const args = new Set(process.argv.slice(2));
const DRY_RUN = !args.has('--yes');

function isTextFile(filePath) {
  const base = path.basename(filePath);
  if (EXTENSIONLESS_ALLOWED.has(base)) return true;
  if (base.startsWith('.env')) return true;
  const ext = path.extname(filePath).toLowerCase();
  return TEXT_EXTENSIONS.has(ext);
}

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (EXCLUDED_DIRS.has(entry.name)) continue;
      walk(full, files);
    } else if (entry.isFile()) {
      if (EXCLUDED_FILES.has(entry.name)) continue;
      if (!isTextFile(full)) continue;
      files.push(full);
    }
  }
  return files;
}

function replaceAll(input) {
  let out = input;
  for (const [from, to] of REPLACEMENTS) {
    if (!out.includes(from)) continue;
    out = out.split(from).join(to);
  }
  return out;
}

function countHits(input) {
  let total = 0;
  for (const [from] of REPLACEMENTS) {
    let idx = 0;
    while ((idx = input.indexOf(from, idx)) !== -1) {
      total++;
      idx += from.length;
    }
  }
  return total;
}

function processFile(filePath) {
  const original = fs.readFileSync(filePath, 'utf8');
  const replaced = replaceAll(original);
  if (replaced === original) return 0;
  const hits = countHits(original);
  if (!DRY_RUN) {
    fs.writeFileSync(filePath, replaced, 'utf8');
  }
  return hits;
}

function postProcessPackageJson() {
  const pkgPath = path.join(ROOT, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  pkg.name = 'gmboop';
  pkg.version = '0.7.0';
  if (!DRY_RUN) {
    fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');
  }
  return { name: pkg.name, version: pkg.version };
}

function postProcessBaselineSql() {
  const sqlPath = path.join(ROOT, 'migrations/001_baseline.sql');
  if (!fs.existsSync(sqlPath)) return false;
  const original = fs.readFileSync(sqlPath, 'utf8');
  const patched = original.replace(/Version:\s*6\.0\.0/g, 'Version: 0.7.0');
  if (patched === original) return false;
  if (!DRY_RUN) {
    fs.writeFileSync(sqlPath, patched, 'utf8');
  }
  return true;
}

function removePackageLock() {
  const lockPath = path.join(ROOT, 'package-lock.json');
  if (!fs.existsSync(lockPath)) return false;
  if (!DRY_RUN) {
    fs.unlinkSync(lockPath);
  }
  return true;
}

function main() {
  console.log(`=== Rebrand Ma-est-tro -> Général Midi Boop (${DRY_RUN ? 'DRY-RUN' : 'WRITE'}) ===\n`);
  const files = walk(ROOT);
  let totalHits = 0;
  let changedFiles = 0;
  const perFile = [];
  for (const file of files) {
    const hits = processFile(file);
    if (hits > 0) {
      changedFiles++;
      totalHits += hits;
      perFile.push([path.relative(ROOT, file), hits]);
    }
  }
  perFile.sort((a, b) => b[1] - a[1]);
  for (const [rel, hits] of perFile) {
    console.log(`  ${String(hits).padStart(4)}  ${rel}`);
  }

  const pkgInfo = postProcessPackageJson();
  const sqlPatched = postProcessBaselineSql();
  const lockRemoved = removePackageLock();

  console.log(`\n${changedFiles} files touched, ${totalHits} replacements.`);
  console.log(`package.json: name=${pkgInfo.name}, version=${pkgInfo.version}`);
  console.log(`migrations/001_baseline.sql version header ${sqlPatched ? 'patched' : 'unchanged'}.`);
  console.log(`package-lock.json ${lockRemoved ? 'removed (run npm install to regenerate)' : 'not present'}.`);
  if (DRY_RUN) {
    console.log('\nDry-run only. Re-run with --yes to write changes.');
  }
}

main();
