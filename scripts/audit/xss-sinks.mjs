/**
 * @file scripts/audit/xss-sinks.mjs
 * @description Frontend HTML-injection sink scanner for audit section AI.
 *
 * The project's documented rule (CLAUDE.md) is:
 *   - `t(key, params)` does NOT escape its params -> safe only for
 *     textContent / .title / .value / .placeholder / setAttribute sinks.
 *   - `tHtml(key, params)` escapes each param -> required whenever the
 *     result reaches innerHTML / insertAdjacentHTML / outerHTML.
 *
 * This scanner finds HTML sinks and classifies each one:
 *   CLEAN    - static string, no interpolation.
 *   T_UNSAFE - an unescaped `t(...)` call with params feeds an HTML sink.
 *   RISKY    - an interpolation of a user-controlled-looking value (file
 *              name, instrument name, error message, MIDI text event...)
 *              reaches an HTML sink without passing through an escaper.
 *   DYNAMIC  - some other `${...}` interpolation feeds an HTML sink;
 *              needs manual review for whether the value is attacker-controlled.
 *
 * Note on shadowing: several modules define a *local* fallback helper
 * `const t = (key, fallback) => i18n.t(key) || fallback`. There the second
 * argument is a default string, not an interpolated param, so such files are
 * exempt from the T_UNSAFE rule — flagging them produces false positives.
 *
 * Usage: node scripts/audit/xss-sinks.mjs [--json] [--only=T_UNSAFE|RISKY]
 */
import { readdirSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

function walk(dir, acc = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name !== 'node_modules') walk(full, acc);
    } else if (full.endsWith('.js')) acc.push(full);
  }
  return acc;
}

/** Sinks that parse their argument as HTML. */
const SINK_RE =
  /\.(innerHTML|outerHTML)\s*(?:\+?=)|\.(insertAdjacentHTML)\s*\(|\.(write|writeln)\s*\(/;

/**
 * Extract the expression assigned to / passed into an HTML sink, following
 * template literals across lines (renderers routinely span 50+ lines).
 */
function extractSinkExpression(lines, startIdx) {
  let depth = 0;
  let inTemplate = false;
  let expr = '';
  for (let i = startIdx; i < Math.min(lines.length, startIdx + 200); i++) {
    const line = lines[i];
    expr += line + '\n';
    for (const ch of line) {
      if (ch === '`') inTemplate = !inTemplate;
      if (inTemplate) continue;
      if (ch === '(' || ch === '{' || ch === '[') depth++;
      if (ch === ')' || ch === '}' || ch === ']') depth--;
    }
    // Statement finished: balanced and not inside a template literal.
    if (!inTemplate && depth <= 0 && /[;)]\s*$/.test(line.trim())) {
      return { expr, endLine: i };
    }
  }
  return { expr, endLine: startIdx };
}

/** Identifiers whose value can carry attacker-supplied text. */
const RISKY_IDENT =
  /\b(fileName|filename|file_name|displayName|customName|deviceName|instrumentName|trackName|presetName|loopName|playlistName|ssid|title|label|message|errorMessage|err|error|text|lyric|marker|comment)\b/;
/**
 * Anything that neutralises HTML before it reaches the sink. Includes the
 * short aliases the codebase actually uses (`esc(`, `_esc(`) and the
 * escaping i18n helper (`tHtml` / `_tHtml`), otherwise correctly-escaped
 * call sites are reported as risky.
 */
const ESCAPER =
  /(escapeHtml|_escape|\b_?esc\(|\b_?tHtml\(|encodeURIComponent|sanitiz|textContent)/i;

const findings = [];
for (const file of walk(join(ROOT, 'public/js'))) {
  const src = readFileSync(file, 'utf8');
  const lines = src.split('\n');
  const rel = file.slice(ROOT.length + 1);
  // Does this module shadow `t` with a local (key, fallback) helper?
  const shadowsT = /(?:const|let|var)\s+t\s*=\s*\(\s*key/.test(src);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim().startsWith('*') || line.trim().startsWith('//')) continue;
    if (!SINK_RE.test(line)) continue;

    const { expr } = extractSinkExpression(lines, i);
    const sink = line.match(SINK_RE)?.[0]?.replace(/[\s(+=]+$/, '') ?? 'sink';

    const hasInterpolation = /\$\{/.test(expr);
    // `t(` but not `tHtml(` — word boundary avoids matching `format(`, `.at(`.
    const unescapedT = /(?<![A-Za-z0-9_$.])t\(\s*['"`]/.test(expr);
    const tHasParams = /(?<![A-Za-z0-9_$.])t\(\s*['"`][^'"`]+['"`]\s*,/.test(expr);

    // Look at each `${...}` separately: an escaped one must not mask an
    // unescaped sibling in the same template.
    const interpolations = [...expr.matchAll(/\$\{([^}]*)\}/g)].map((m) => m[1]);
    const riskyUnescaped = interpolations.filter((x) => RISKY_IDENT.test(x) && !ESCAPER.test(x));

    let verdict;
    if (!hasInterpolation) verdict = 'CLEAN';
    else if (unescapedT && tHasParams && !shadowsT) verdict = 'T_UNSAFE';
    else if (riskyUnescaped.length) verdict = 'RISKY';
    else verdict = 'DYNAMIC';

    findings.push({
      file: rel,
      line: i + 1,
      sink,
      verdict,
      ...(riskyUnescaped.length ? { values: [...new Set(riskyUnescaped)].slice(0, 4) } : {})
    });
  }
}

const only = process.argv.find((a) => a.startsWith('--only='))?.split('=')[1];
const shown = only ? findings.filter((f) => f.verdict === only) : findings;

if (process.argv.includes('--json')) {
  console.log(JSON.stringify(shown, null, 2));
} else {
  const counts = findings.reduce((a, f) => ((a[f.verdict] = (a[f.verdict] || 0) + 1), a), {});
  console.log('HTML sinks in public/js:', findings.length);
  for (const [k, v] of Object.entries(counts).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${k.padEnd(10)} ${v}`);
  }
  if (only) {
    console.log(`\n--- ${only} ---`);
    for (const f of shown) console.log(`  ${f.file}:${f.line}  (${f.sink})`);
  } else {
    const byFile = {};
    for (const f of findings.filter((x) => x.verdict !== 'CLEAN')) {
      byFile[f.file] = (byFile[f.file] || 0) + 1;
    }
    console.log('\nTop files by non-CLEAN sinks:');
    Object.entries(byFile)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .forEach(([f, n]) => console.log(`  ${String(n).padStart(3)}  ${f}`));
  }
}
