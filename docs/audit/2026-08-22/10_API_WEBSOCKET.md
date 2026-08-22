# 10 — HTTP API & WebSocket (plan §T, U, V, AK)

**State: U = FAIL · T = PARTIAL · V = PASS · AK = PASS** · Level 3
**Tools added:** `scripts/audit/command-inventory.mjs`, `scripts/audit/live-probe.mjs`

---

## T — HTTP API inventory

The HTTP surface is deliberately small — nearly everything goes over WebSocket.

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/api/health` | **public** | capabilities block; verified 200 |
| GET | `/api/capabilities` | token | verified 200 |
| GET | `/api/status` | token | |
| GET | `/api/metrics` | token | |
| GET | `/api/update-status` | **public** | public so the dashboard can poll mid-update |
| POST | `/api/files` | token | upload |
| GET | `/api/files/:id/blob` | token | verified: non-numeric id → **400**, not 500 |
| GET | `/api/files/:id/text-events` | token | |
| — | `/api/sf2/*` (mount) | token | `GET /`, `DELETE /:id`, `PATCH /:id`, `GET /:id/kits`, `GET /:id/preset/melodic/:program`, `GET /:id/preset/drum/:kit/:note` |
| — | `/api/waf/*` (mount) | token | `GET /:filename` |

Two endpoints are intentionally public and the reason is documented — `/api/health` and
`/api/update-status`, the latter so the SPA can keep polling while the server restarts
during an in-place update. That is a deliberate, sound exception.

### Verified live

| Check | Result |
|---|---|
| `/api/health` → 200 with `status` | PASS |
| `/api/capabilities` → 200 | PASS |
| Non-numeric path param → 400 (not 500) | PASS |
| Path traversal on `/api/files/:id/blob` | PASS — 400, no leak |
| Path traversal on `/api/waf/:filename` | PASS — 400, no leak |
| `X-Content-Type-Options: nosniff` | PASS |
| Content-Security-Policy | absent — **deliberate**, see F-11 in `17_SECURITY.md` |

### F-10 — unknown `/api/*` returns 200 + SPA HTML — FAIL (P3)

`GET /api/definitely-not-a-route` → **200** with the SPA `index.html`, because the
SPA fallback catches it. An API client cannot distinguish "no such endpoint" from "here
is your page", and a typo'd path silently returns HTML where JSON was expected.

**Fix:** register a 404 JSON handler for unmatched `/api/*` *before* the SPA fallback.
One route, no behaviour change for the SPA.

**Not tested:** huge HTTP payloads, per-route auth matrix, every 4xx/5xx shape.

---

## U — WebSocket commands — **FAIL (P1)**

`scripts/audit/command-inventory.mjs` builds the matrix the plan asks for by **actually
loading `CommandRegistry` and its auto-discovered modules**, so the command list cannot
drift from runtime behaviour (the server confirms it: *"CommandRegistry initialized with
270 commands"*).

```
Registered commands        : 270
  with payload schema      :  86 (31.9 %)
  schema wired to validator:  86 (31.9 %)
  called by frontend       : 147 (54.4 %)
  mentioned in tests       :  63 (23.3 %)
  documented in API.md     : 187 (69.3 %)
Orphan schemas (no command):   0
Phantom frontend calls     :   0
Schema files not wired     : (none)
```

### What is healthy

**Zero orphan schemas, zero phantom frontend calls, all 14 schema files wired.** The
declarative-schema mechanism (ADR-004) works: adding a schema entry is sufficient, there
is no central map to forget. Nothing is mis-wired — the schemas that exist are all
active, and the frontend never calls a command that does not exist.

### F-03 — 68 % of commands have no schema, and validation fails open — FAIL (P1)

```js
// src/utils/JsonValidator.js:250
static validateByCommand(command, data) {
  const compiled = COMPILED_SCHEMAS[command];
  if (!compiled) return { valid: true, errors: [] };   // ← fails OPEN
  return _run(compiled, data);
}
```

184 of 270 commands therefore accept **any** payload at the dispatch layer. Handlers
self-validate inconsistently — some throw `ValidationError`, many index straight into
`data.foo`.

| Module | Missing / total |
|---|---|
| `LightingCommands` | **31 / 38** |
| `FileCommands` | 16 / 23 |
| `PlaylistCommands` | **15 / 15** |
| `StringInstrumentCommands` | **15 / 15** |
| `RoutingCommands` | 13 / 21 |
| `LatencyCommands` | 12 / 16 |
| `InstrumentSettingsCommands` | **11 / 11** |
| `SystemCommands` | 10 / 11 |
| `BluetoothCommands` | 7 / 9 |
| `HotspotCommands` | 7 / 10 |
| `InstrumentLightCommands`, `SerialCommands`, `PlaybackRoutingCommands` | 6 / 6 each |
| `InstrumentVoiceCommands` | 5 / 5 |
| `DeviceSettingsCommands` | 2 / 2 |

The plan's target is *"tendre vers 100 %"*. Current: 31.9 %.

**Severity reasoning.** This is P1 rather than P0 because the two highest-risk
surfaces are individually safe on inspection:

- **Hotspot** — the sensitive fields *do* have schemas (`hotspot_update_config`,
  `wifi_connect`, `wifi_forget` constrain SSID 1–32, WPA2 password 8–63, band `a|bg`,
  channel 0–196), `HotspotManager` uses `execFile('sudo', ['-n', SCRIPT, ...args])`
  with an **argv array — no shell interpolation**, and `scripts/hotspot.sh`
  re-validates `band` itself. Defence in depth, correctly built.
- **System** — 10 of 11 `system_*` commands (including `system_reboot`,
  `system_shutdown`, `system_update`, `system_restore`) have no schema, but they are
  largely parameterless.

The exposure is therefore mostly *robustness* — a malformed payload reaching a handler
that assumes shape — rather than a direct RCE path. But it is a standing invitation:
the next command added to an unschema'd module inherits zero validation by default, and
`LightingCommands` (31 unvalidated commands driving network and GPIO output) is exactly
where that goes wrong first.

**Fix:** invert the default. Keep the fail-open behaviour only for an explicit
allow-list of parameterless commands, and make an unknown command with a payload a
validation error. Then backfill schemas module by module, `LightingCommands` first.

### Frontend / test / doc coverage

- **123 commands never called by the frontend (45.6 %).** Some are legitimately
  server-side or future API; this list should be triaged — every command that no client
  calls and no test covers is a maintenance liability and an attack surface.
- **207 commands (76.7 %) are not mentioned in any test.**
- **83 commands (30.7 %) are absent from `docs/API.md`** — this is the §BD deliverable;
  the inventory tool emits the exact list with `--json`.

---

## V — WebSocket real-time — PASS

The envelope contract is clean and consistent. Captured live:

```jsonc
// success
{"id":"a","type":"response","command":"device_list","version":1,
 "data":{"devices":[]},"timestamp":1787407948582,"duration":0}

// unknown command
{"id":"b","type":"error","command":"no_such_command_xyz",
 "error":"command with id 'no_such_command_xyz' not found","code":"ERR_NOT_FOUND",...}

// bad envelope
{"id":"c","type":"error",
 "error":"Invalid message: Command field is required and must be a string",
 "code":"ERR_VALIDATION",...}
```

| Check | Result |
|---|---|
| Connection established | PASS |
| Response correlated by `id` | PASS |
| Unknown command → error frame, socket stays open | PASS (`ERR_NOT_FOUND`) |
| Malformed JSON → socket survives | PASS |
| Missing `command` → clean error | PASS (`ERR_VALIDATION`) |
| Non-string `command`, non-object `data` → clean error | PASS (both reported in one message) |
| Broadcast events (`type:'event'`) distinct from responses | PASS |
| Machine-readable error `code` | PASS |

Reconnection, heartbeat/timeout, multiple clients, abrupt disconnect and intermittent
networks were **not** tested.

### F-06 — rate-limit rejections are uncorrelated — FAIL (P2)

When the limiter fires, the server replies:

```js
ws.send(JSON.stringify({ type:'error', error:'Rate limit exceeded', timestamp: now }));
```

**No `id`.** So the client's pending-request map — keyed by `id` — cannot resolve the
throttled request. Consequences:

1. The specific `await api.sendCommand(...)` hangs until its own 10 s timeout, blocking
   whatever UI flow awaited it.
2. The client cannot know *which* command died, so it cannot retry it.

`BackendAPIClient` already surfaces a **global** `error` event for uncorrelated frames
(a fix from a previous audit, "audit C N2", with a comment explaining it), so the user
is no longer left with silence — but the per-request hang remains.

**Fix:** parse enough of the frame to echo its `id` back in the rate-limit error. The
frame is already in memory; extracting `id` before rejecting costs one `JSON.parse` on
the rejection path only.

---

## AK — Limits and DoS — PASS

The plan's bar is *"dégrader proprement plutôt que bloquer la boucle Node"*. It does.

| Limit | Value | Verified behaviour |
|---|---|---|
| Messages | **60 / 1000 ms / connection** | exact; excess gets an error frame |
| Inbound bytes | 32 MB / 1000 ms / connection | counted before parse |
| Max frame | 16 MB | 20 MB frame → clean close, **server stays healthy** |
| Max clients | 10 | from boot log |

Burst measurement, one connection:

| Sent | Answered | Rejected |
|---|---|---|
| 10 | 10 | 0 |
| 50 | 50 | 0 |
| 100 | 60 | 40 |
| 200 | 60 | 140 |
| 500 | 60 | 440 |

Counting **bytes as well as messages** is the right design — the code comment explains
that message-counting alone would let 60 × 16 MB frames through and stall MIDI timing on
`JSON.parse`. That is a threat someone actually thought about.

**But see F-07 (`03_MIDI_CORE.md`):** the limiter runs on the raw frame before parsing,
so it cannot exempt a panic or `playback_stop`. Combined with the virtual keyboard
sending one frame per note event, a dense passage can consume the whole budget and drop
a note-off. Correct as DoS protection; a hazard for musical traffic.

Not tested: many simultaneous clients, sustained flood over minutes, MIDI-input flood,
lighting flood.

---

## Recommendations

| Pri | Action |
|---|---|
| **P1** | Invert schema defaults: fail closed except for an explicit parameterless allow-list; backfill schemas starting with `LightingCommands` (31), `PlaylistCommands` (15), `StringInstrumentCommands` (15), `InstrumentSettingsCommands` (11). |
| P2 | Echo the request `id` in rate-limit error frames (F-06). |
| P2 | Exempt panic / stop commands from the WS limiter (F-07). |
| P2 | Wire `command-inventory.mjs` into CI with a ratchet: schema coverage may not decrease. |
| P3 | JSON 404 for unmatched `/api/*` before the SPA fallback (F-10). |
| P3 | Triage the 123 frontend-uncalled commands: document, test, or delete. |
| P3 | Close the 83-command gap in `docs/API.md` (§BD). |
