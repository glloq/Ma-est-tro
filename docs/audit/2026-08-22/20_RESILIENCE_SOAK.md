# 20 — Lifecycle, resilience, observability, health (plan §C02, C03, W, AZ, BA, BB)

**State: BB = FAIL (2 defects reproduced) · C01 = PASS · rest PARTIAL/NOT TESTED** · Level 3

---

## C01 — Initialisation — PASS (verified live)

Booted in a deliberately hostile environment — no native MIDI, no D-Bus, no serial
hardware, empty database — and observed the full sequence:

```
Database initialized
WARN  DeviceManager initialized WITHOUT hardware MIDI support (native library not available)
Loaded 0/0 routes from database          → MidiRouter initialized
Loaded 0 latency profiles                → LatencyCompensator initialized
MidiPlayer initialized · FileManager initialized
BluetoothManager initialized (port-based)
NetworkManager initialized with RTP-MIDI support
ERROR Failed to initialize Bluetooth: D-Bus system bus not available
SerialMidiManager: disabled in config
LightingManager initialized: 0 device(s), 0 rule(s), 0 group(s)
InstrumentLightManager initialized: 0 state(s) loaded
HTTP security mode: trusted-lan
API token authentication enabled (same-origin/LAN bypass for SPA)
HttpServer initialized · WebSocketServer initialized
Application initialized → Starting application...
Scan complete: 0 device(s) found
Starting hot-plug monitoring (check every 5000ms)
CommandRegistry initialized with 270 commands
HTTP server listening on http://0.0.0.0:8099
WebSocket server attached (max clients: 10, max payload: 16MB)
Backup scheduler started (cron: 0 3 * * *, keep: 7)
=== GeneralMidiBoop 0.8.1 Running ===
```

Order matches the plan's requirement exactly: config → DB → migrations → services →
transports → MIDI → API → WebSocket → scheduled tasks. Every optional subsystem that
could not initialise was caught and logged without aborting the boot. **This is exactly
the behaviour an offline-first appliance needs.**

---

## BB — Health / capabilities — **FAIL (two defects, both reproduced)**

Live response from the same boot:

```json
{"status":"ok","version":"0.8.1","capabilitiesOverall":"degraded",
 "capabilities":{
   "database":{"status":"ready"},
   "playback":{"status":"ready"},
   "usb":{"status":"ready"},          ← WRONG
   "ble":{"status":"ready"},          ← WRONG
   "network":{"status":"degraded","detail":"RTP-MIDI is a simplified AppleMIDI implementation…"},
   "serial":{"status":"ready"},
   "lighting":{"status":"ready"}}}
```

The plan requires each subsystem to report `ready` / `degraded` / `failed` / `disabled`
correctly, and — explicitly — *"Puis provoquer réellement chaque état."* Two states were
provoked and both were reported wrong.

### F-01 — `usb: ready` with no MIDI support at all (P2)

```js
// src/core/Application.js:717
usb: this.deviceManager ? { status: 'ready' } : { status: 'failed' },
```

`DeviceManager` **always** constructs. When `import('easymidi')` fails, the module
catches it, logs a warning and substitutes a no-op stub whose `Input`/`Output`
constructors throw, setting a module-local `midiAvailable = false`
(`DeviceManager.js:35-55`).

So the check `this.deviceManager ?` can never be false in practice. The same boot that
logged *"DeviceManager initialized WITHOUT hardware MIDI support"* and *"MIDI scan
skipped: native MIDI library not available"* reports **`usb: ready`**.

An operator diagnosing "why does nothing play?" is told the USB subsystem is fine. The
information needed to answer correctly (`midiAvailable`) already exists — it is simply
not exported.

**Fix:** expose `midiAvailable` from `DeviceManager` and map it:
`ready` when true, `failed` (or `degraded`) when false.

### F-02 — `ble: ready` after BLE initialisation actually failed (P2)

```js
const optional = (service, key, {degraded, degradedDetail} = {}) => {
  if (service) return degraded ? {status:'degraded', detail:degradedDetail} : {status:'ready'};
  return errored(key) ? {status:'failed', detail:errored(key)} : {status:'disabled'};
};
```

`optional()` distinguishes only whether the **constructor** threw —
`Application.js:280-286` sets `_capabilityErrors.ble` in that case. But BLE fails
*later*, inside `BluetoothManager.initialize()`, which logs
`Failed to initialize Bluetooth: D-Bus system bus not available`
(`BluetoothManager.js:236`) and swallows the error.

Result: constructor succeeded → object is truthy → **`ble: ready`**, on a host with no
Bluetooth stack whatsoever. Verified live.

**Fix:** have `initialize()` record its failure into `_capabilityErrors.ble` (or expose
a `ready` flag the resolver consults), so a runtime init failure is distinguishable from
a healthy transport.

### What is right

- `network` is reported **`degraded` even when it loads successfully**, with an honest
  detail string, because the AppleMIDI implementation is non-conformant. Deliberately
  down-reporting your own working subsystem is the correct call and is rare — see
  `13_TRANSPORTS.md` §N02.
- `serial: ready` when disabled in config is arguably wrong too (`disabled` would be
  more accurate), but that is cosmetic beside F-01/F-02.
- `overall` correctly aggregates to `degraded`.

### Test-coverage note

`tests/capability-status.test.js` exercises `getCapabilityStatus()` — but only against a
**hand-built `this`** with services set to `{}` or `null`. It therefore tests the
*mapping function*, never the *real predicates*. Both F-01 and F-02 pass that suite,
because the suite asks "does a truthy service map to ready?" (yes) rather than "does a
broken subsystem report broken?" (no). A good illustration of a test that is green and
still misses the defect.

---

## C02 — Shutdown — PARTIAL

`setupShutdownHandlers()` routes SIGINT/SIGTERM/uncaughtException through a single
idempotent `shutdown()`: a `shuttingDown` guard prevents concurrent runs, prior handlers
are removed before re-registration so they cannot accumulate across restarts, and
`logger.close()` is called **only** at exit (never inside `stop()`, which `restart()`
reuses) so the final lines reach disk. The design is careful and the comments cite the
audit finding that produced it.

**Not verified in this audit:** actual SIGTERM/SIGINT delivery, PM2 restart, system
reboot, poweroff. Nor the plan's specific checklist — MIDI notes cut, timers stopped,
ports closed, DB closed, WS closed, BLE stopped, UART closed, **lights returned to a
safe state**. That last one is completely untested (see `15_LIGHTING.md`) and is the one
with a physical consequence.

## C03 — Crash recovery — NOT TESTED

Unhandled exception, unhandled rejection, SQLite error, hardware disconnect, network
loss, corrupted file. `uncaughtException` is routed into the shutdown path, so the
process exits rather than continuing in an undefined state — which is the right choice
for an appliance under a supervisor, but it means the plan's requirement (*"L'application
ne doit pas rester dans un état MIDI dangereux"*) depends entirely on `stop()` emitting
panic before exit. **Unverified.**

## W — Concurrency — NOT TESTED

Playback + upload + UI + monitoring + DB + BLE + lighting simultaneously. Not exercised.
Two structural risks worth flagging for whoever does test this:

1. **`better-sqlite3` is synchronous** — every query blocks the event loop, including
   the MIDI scheduler. A slow query during playback is a timing fault, not just latency.
2. **`LightingManager` evaluates rules synchronously on every `midi_message`** — so
   lighting work also lands on the MIDI hot path, from code with 0 % test coverage.

## AZ — Fault injection — PARTIAL

Covered in `19_PERFORMANCE.md`. Four faults injected (no MIDI lib, no D-Bus, no serial,
oversized frame); all handled correctly. The plan's main list is untested, though
several items (lock the DB, fill the disk, delete a file in use) need no hardware.

## BA — Observability — PARTIAL

| Item | State |
|---|---|
| Log levels | PASS — debug/info/warn/error, configurable |
| Timestamps | PASS — ISO 8601 |
| Stack traces | PASS |
| Device/channel context | PARTIAL — present in device logs |
| Rotation | PASS — configured |
| JSON logs | PARTIAL |
| Critical events | PASS |
| No spam | PASS — the observed boot is informative without being noisy |
| Robustness | PASS — `logger-safe-stringify` degrades a circular payload to `[unserializable log payload: …]` instead of throwing |

The circular-payload guard is a nice detail: a logger that throws while logging an error
turns a recoverable fault into a crash, and this one does not.

**Gap:** logs are the only observability surface. `/api/metrics` exists but event-loop
lag and command durations are not exposed through it, despite both being measured
internally (see `19_PERFORMANCE.md`).

---

## Recommendations

| Pri | Action |
|---|---|
| P2 | **F-01** — derive `usb` from `DeviceManager.midiAvailable`, not from object existence. |
| P2 | **F-02** — record transport `initialize()` failures into `_capabilityErrors`. |
| P2 | Extend `capability-status.test.js` to assert the *real* predicates: no MIDI library → not `ready`; failed BLE init → `failed`. |
| P2 | Assert §C02's checklist in a test: panic sent, timers cleared, ports closed, **lights safe** on `stop()`. |
| P2 | Report `serial: disabled` when disabled in config, rather than `ready`. |
| P3 | Surface event-loop lag and command-duration percentiles on `/api/metrics`. |
| HW | C02 under real SIGTERM/PM2/reboot; C03 crash scenarios; W concurrency on a Pi. |
