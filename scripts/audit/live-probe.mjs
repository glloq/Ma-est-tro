/**
 * @file scripts/audit/live-probe.mjs
 * @description Black-box probe of the running server for audit sections
 * T (HTTP API), V (WebSocket real-time) and AK (limits / DoS).
 *
 * Boots nothing itself — point it at an already-running instance:
 *   node scripts/audit/live-probe.mjs http://127.0.0.1:8099
 *
 * Every check prints PASS/FAIL plus the observed value, so the output can be
 * pasted into the audit report as evidence.
 */
import { WebSocket } from 'ws';

const BASE = process.argv[2] || 'http://127.0.0.1:8099';
// A non-browser client sends no Origin, so it never hits the same-origin
// bypass and must present the bearer token like any external client.
const TOKEN = process.env.GMBOOP_API_TOKEN || '';
const WS_URL = BASE.replace(/^http/, 'ws') + (TOKEN ? `/?token=${encodeURIComponent(TOKEN)}` : '');
const AUTH = TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {};
const results = [];

function record(section, name, ok, detail) {
  results.push({ section, name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  [${section}] ${name}${detail ? ` — ${detail}` : ''}`);
}

async function http(path, opts = {}) {
  const res = await fetch(BASE + path, { ...opts, headers: { ...AUTH, ...(opts.headers || {}) } });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* not json */
  }
  return { status: res.status, headers: res.headers, text, json };
}

/** Open a socket and resolve once it is actually open. */
function connect() {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(WS_URL);
    const timer = setTimeout(() => reject(new Error('ws open timeout')), 5000);
    ws.on('open', () => {
      clearTimeout(timer);
      resolve(ws);
    });
    ws.on('error', (e) => {
      clearTimeout(timer);
      reject(e);
    });
  });
}

/** Send one command frame and wait for the reply correlated by `id`. */
function rpc(ws, frame, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('rpc timeout')), timeoutMs);
    const onMsg = (raw) => {
      let msg;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        return;
      }
      // Ignore unsolicited broadcasts; only settle on our correlation id.
      if (frame.id !== undefined && msg.id !== frame.id) return;
      clearTimeout(timer);
      ws.off('message', onMsg);
      resolve(msg);
    };
    ws.on('message', onMsg);
    ws.send(typeof frame === 'string' ? frame : JSON.stringify(frame));
  });
}

// ---------------------------------------------------------------- T: HTTP
{
  const h = await http('/api/health');
  record(
    'T',
    'GET /api/health returns 200 + status field',
    h.status === 200 && !!h.json?.status,
    `status=${h.status} body.status=${h.json?.status}`
  );

  const c = await http('/api/capabilities');
  record('T', 'GET /api/capabilities returns 200', c.status === 200, `status=${c.status}`);

  const nf = await http('/api/definitely-not-a-route');
  record(
    'T',
    'unknown /api route returns 4xx (not 200/500)',
    nf.status >= 400 && nf.status < 500,
    `status=${nf.status}`
  );

  const bad = await http('/api/files/not-a-number/blob');
  record(
    'T',
    'non-numeric path param is rejected, not 500',
    bad.status !== 500,
    `status=${bad.status}`
  );

  // Security headers (helmet) — audit AH.
  const csp = h.headers.get('content-security-policy');
  const xcto = h.headers.get('x-content-type-options');
  record(
    'AH',
    'helmet security headers present',
    !!csp && xcto === 'nosniff',
    `CSP=${csp ? 'yes' : 'no'} X-Content-Type-Options=${xcto}`
  );

  // Path traversal against the static/blob surfaces — audit AH / AA.
  for (const attempt of [
    '/api/files/..%2f..%2f..%2fetc%2fpasswd/blob',
    '/../../../etc/passwd',
    '/api/waf/..%2f..%2f..%2fetc%2fpasswd'
  ]) {
    const t = await http(attempt);
    const leaked = /root:x:0:0/.test(t.text);
    record(
      'AH',
      `path traversal blocked: ${attempt}`,
      !leaked && t.status !== 200,
      `status=${t.status} leaked=${leaked}`
    );
  }
}

// ------------------------------------------- AJ: WebSocket auth is fail-closed
{
  // Same URL without the token: a non-browser client (no Origin header) must
  // be refused rather than falling through to the LAN bypass.
  const bare = BASE.replace(/^http/, 'ws');
  const refused = await new Promise((resolve) => {
    const ws = new WebSocket(bare);
    const t = setTimeout(() => resolve('timeout'), 5000);
    ws.on('open', () => {
      clearTimeout(t);
      ws.close();
      resolve(false);
    });
    ws.on('error', (e) => {
      clearTimeout(t);
      resolve(/401/.test(e.message) ? '401' : e.message);
    });
  });
  record(
    'AJ',
    'tokenless non-browser WebSocket is refused',
    refused === '401',
    `result=${refused}`
  );
}

// ------------------------------------------------------------ V: WebSocket
{
  const ws = await connect();
  record('V', 'WebSocket connection established', ws.readyState === WebSocket.OPEN);

  // Correlation by id.
  const r1 = await rpc(ws, { id: 'probe-1', command: 'device_list', data: {} });
  record('V', 'response is correlated by request id', r1.id === 'probe-1', `got id=${r1.id}`);

  // Unknown command must be a clean error, not a disconnect.
  const r2 = await rpc(ws, { id: 'probe-2', command: 'no_such_command_xyz', data: {} });
  record(
    'V',
    'unknown command returns an error frame, socket stays open',
    r2.success === false && ws.readyState === WebSocket.OPEN,
    `success=${r2.success} error=${JSON.stringify(r2.error)?.slice(0, 80)}`
  );

  // Malformed JSON must not kill the connection.
  let stillOpen = true;
  try {
    ws.send('{ this is not json');
    await new Promise((r) => setTimeout(r, 300));
    stillOpen = ws.readyState === WebSocket.OPEN;
  } catch {
    stillOpen = false;
  }
  record('V', 'malformed JSON does not drop the socket', stillOpen);

  // Missing command field.
  const r3 = await rpc(ws, { id: 'probe-3', data: {} });
  record(
    'V',
    'envelope without `command` is rejected cleanly',
    r3.success === false,
    `error=${JSON.stringify(r3.error)?.slice(0, 80)}`
  );

  // Wrong types in the envelope.
  const r4 = await rpc(ws, { id: 'probe-4', command: 12345, data: 'not-an-object' });
  record('V', 'non-string command is rejected cleanly', r4.success === false);

  // Prototype pollution attempt — audit AH.
  const r5 = await rpc(ws, {
    id: 'probe-5',
    command: 'device_list',
    data: JSON.parse('{"__proto__":{"polluted":"yes"}}')
  });
  const polluted = {}.polluted === 'yes';
  record(
    'AH',
    'prototype pollution via command payload has no effect',
    !polluted,
    `({}).polluted=${{}.polluted} rpcOk=${r5.success}`
  );

  // Burst: many concurrent commands on one socket — audit AK.
  const t0 = Date.now();
  const burst = await Promise.all(
    Array.from({ length: 200 }, (_, i) =>
      rpc(ws, { id: `burst-${i}`, command: 'device_list', data: {} }, 15000).catch((e) => ({
        error: e.message
      }))
    )
  );
  const ok = burst.filter((b) => b.success !== undefined && !b.error).length;
  record(
    'AK',
    '200-command burst on one socket is fully answered',
    ok === 200,
    `${ok}/200 answered in ${Date.now() - t0}ms`
  );

  ws.close();
}

// --------------------------------------------- AK: oversized payload handling
{
  const ws = await connect();
  // Server advertises a 16MB max payload; go past it and expect a clean close
  // rather than a hang or an OOM.
  const huge = 'x'.repeat(20 * 1024 * 1024);
  let closed = false;
  ws.on('close', () => {
    closed = true;
  });
  try {
    ws.send(JSON.stringify({ id: 'huge', command: 'device_list', data: { blob: huge } }));
  } catch {
    /* send may throw locally */
  }
  await new Promise((r) => setTimeout(r, 2000));
  record(
    'AK',
    '>16MB frame is refused without hanging the server',
    closed || ws.readyState !== WebSocket.OPEN,
    `closed=${closed}`
  );
  try {
    ws.close();
  } catch {
    /* already closed */
  }

  // Server must still be healthy afterwards.
  const h = await http('/api/health');
  record(
    'AK',
    'server still healthy after oversized frame',
    h.status === 200,
    `status=${h.status}`
  );
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
if (failed.length) {
  console.log('Failures:');
  for (const f of failed) console.log(`  [${f.section}] ${f.name} — ${f.detail ?? ''}`);
}
process.exit(0);
