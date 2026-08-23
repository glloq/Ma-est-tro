# 01 — Architecture (plan §A01, A04, A05)

**State: PASS with reservations** · Level 0–1

---

## A01 — General architecture

### Measured

| Metric | Value | Tool |
|---|---|---|
| Backend modules (`src/**/*.js`) | 176 | — |
| Internal import edges | 247 | `scripts/audit/dead-modules.mjs` graph |
| **Import cycles** | **0** | Tarjan DFS over the resolved graph |
| Unreferenced modules | **1** | `scripts/audit/dead-modules.mjs` |
| Frontend modules (`public/js/**`) | 190 (104 761 lines) | — |

**Zero circular dependencies** across 176 modules is the single strongest architectural
signal in this codebase. It is not an accident — the composition root pattern forces
dependencies to flow one way.

### Ownership and layering — PASS

Responsibilities are cleanly separated and each has an obvious owner:

```
server.js
  └── src/core/Application.js          ← the single composition root
        ├── ServiceContainer (DI)      ← name → instance
        ├── EventBus                   ← internal pub/sub, also drives WS broadcasts
        ├── src/persistence/           ← Database → per-table managers
        ├── src/repositories/          ← business-named wrappers over Database
        ├── src/midi/                  ← devices | routing | playback | adaptation
        ├── src/transports/            ← BLE | Network(RTP) | Serial  (all optional)
        ├── src/lighting/              ← manager + 7 pluggable drivers
        ├── src/audio/                 ← SF2, delay calibration
        └── src/api/                   ← HttpServer | WebSocketServer | CommandRegistry
```

The MIDI / transport / persistence / audio / lighting split the plan asks about is real
and respected. Transports are behind a uniform `sendMidiMessage(target, type, data)`
surface, so `DeviceManager` does not know whether a device is USB, BLE, network or
serial.

### Dependency injection — PASS

`Application.initialize()` constructs every long-lived service and registers it in a
`ServiceContainer`. Services receive an **app-facade Proxy** that resolves names from
the container, falling back to the `Application` instance.

The documented hard contract — *"a service that captures `deps.foo` into `this.foo` in
its constructor freezes that reference, so `foo` must be registered before its
consumer"* — is genuinely load-bearing, and the codebase respects it: genuinely
late-bound services (`wsServer`, `eventLoopMonitor`, `backupScheduler`) are accessed via
`this._deps.X` or a getter rather than captured eagerly. This is covered by a dedicated
regression suite (`tests/application-di-late-binding.test.js`).

**Reservation.** The contract is enforced by convention and one test, not by the
container. A newly added service that eagerly captures a not-yet-registered dependency
fails at runtime with `undefined`, not at construction. A cheap guard — have the facade
Proxy throw on a `get` for a name that is neither registered nor an `Application`
property — would turn a silent `undefined` into an immediate, obvious error.

### Optional subsystem loading — PASS

Bluetooth / Network / Serial / Lighting load inside `try/catch` and are absent on hosts
without their native dependencies; call sites use `?.` throughout. Verified live: the
server boots cleanly in a container with no MIDI library, no D-Bus and no serial
hardware (see `20_RESILIENCE_SOAK.md` §C01).

### Frontend globals and singletons — PARTIAL

The SPA is deliberately framework-free with shared base classes (`BaseView`,
`BaseModal`, `EventBus`) under `public/js/core/`. Cross-module access still happens via
window globals in places — e.g. `LightingDeviceUI.js` emits inline
`onclick="lightingControlPageInstance._addScannedDevice(...)"` into `innerHTML`, which
couples a rendered string to a global singleton and to a private method name. This is
not a security issue (the payload is an array index, not user text) but it is a
refactor hazard: renaming the private method breaks the markup silently.

### Dead code — FAIL (P3)

`src/midi/messages/MidiMessage.js` — **468 lines, 201 statements, zero importers.**

Verified three ways: no `from '…/MidiMessage.js'`, no `require`, no dynamic-import map
entry, and 0 % coverage. The 13 apparent "mentions" elsewhere are substring collisions
with the unrelated identifiers `handleMidiMessage`, `sendMidiMessage` and
`_onMidiMessage`.

This matters beyond the line count: the file presents itself as *the* MIDI message
abstraction (`parse`, `parseBytes`, `parseSystemMessage`, `toBytes`, `validate`,
`clone`). An engineer — or an auditor — reasonably assumes it is the message layer. The
real inbound parsing lives in `DeviceManager.handleRawMidi()` and
`SerialMidiManager`'s byte-stream parser. Deleting it removes a false map of the system.

> Note the second-order effect: because `MidiMessage.parseSystemMessage()` *does* handle
> System Common, its presence disguised the fact that the live path did not (finding
> F-08, now fixed).

---

## A04 — Technical debt

| Signal | Count |
|---|---|
| Files > 500 lines | 111 (`src` + `public/js`) |
| Files > 700 lines | 68 |
| Files > 1000 lines | **36** |
| Functions > 100 lines | **54** |
| `TODO` markers in code | 5 |
| `FIXME` / `HACK` / `XXX` | **0** |
| `@deprecated` | 1 |

### Largest units

| Lines | File |
|---|---|
| 3 550 | `public/js/features/auto-assign/RoutingSummaryPage.js` |
| 3 028 | `public/js/features/instrument-settings/ISMSections.js` |
| 3 024 | `src/midi/playback/MidiPlayer.js` |
| 2 773 | `public/js/features/instrument-settings/ISMListeners.js` |
| 2 371 | `public/js/audio/MidiSynthesizer.js` |
| 1 995 | `src/midi/devices/DeviceManager.js` |

| Lines | Function |
|---|---|
| 409 | `MidiDatabase.filterFiles()` |
| 306 | `MidiTransposer.transposeChannels()` |
| 294 | `HandPositionPlanner.plan()` |
| 291 | `InstrumentCapabilitiesValidator._validateSemitonesHandsConfig()` |
| 265 | `Application.initialize()` |
| 257 | `InstrumentMatcher.calculateCompatibility()` |

**Assessment.** The near-total absence of `FIXME`/`HACK` markers alongside 36
thousand-line files is worth reading correctly: debt here is **structural (size), not
rotten (patched-over)**. The large files are large because they are feature-complete,
not because they accumulated workarounds. Comments consistently cite prior audit
findings by number, which indicates maintained rather than abandoned code.

`Application.initialize()` at 265 lines is the one worth splitting on risk grounds
rather than aesthetics: registration order is a documented hard contract, and a single
265-line function is where an ordering mistake is easiest to make and hardest to see.
Splitting it into ordered phase functions (`_registerCore()`, `_registerMidi()`,
`_registerTransports()`, `_registerApi()`) would make the contract structural.

---

## A05 — Convention consistency — PASS

Verified consistent across the tree:

- **Naming / file organisation** — features under `public/js/features/<feature>/`,
  backend domains under `src/<domain>/`. Matches `CLAUDE.md`.
- **Error handling** — `ApplicationError` subclasses in `src/core/errors/` surface to
  the client verbatim; anything else is masked as "Internal server error". Applied
  uniformly by `CommandRegistry`, verified live (an unknown command returns
  `code: "ERR_NOT_FOUND"`, a bad envelope returns `code: "ERR_VALIDATION"`).
- **Async conventions** — handlers are `async (data) => result`; no floating promises
  found by ESLint.
- **Logging** — all backend logging goes through `src/core/Logger.js`; the 183
  `no-console` warnings are almost entirely in `scripts/`, which is correct for CLI
  tooling.
- **MIDI channel convention** — internally 0–15 everywhere (`status & 0x0f`), converted
  to 1–16 only at the UI edge. No mixed usage found in the paths reviewed.
- **Units** — milliseconds throughout the playback and latency paths; ticks are always
  named `ticks`/`totalTicks`; no ambiguous bare numbers found in the code read.

### Documentation drift

`docs/ARCHITECTURE.md` predates the `managers/`→`transports/` and
`views/components/`→`features/` renames — already flagged in `CLAUDE.md`, still true.
See `BC` in `AUDIT_MASTER.md`.

---

## Recommendations

| Pri | Action |
|---|---|
| P3 | Delete `src/midi/messages/MidiMessage.js` (dead, and actively misleading). |
| P3 | Split `Application.initialize()` into ordered phase functions to make the DI ordering contract structural. |
| P3 | Make the DI facade Proxy throw on unknown names instead of returning `undefined`. |
| P3 | Replace inline `onclick="globalSingleton._privateMethod(...)"` markup with delegated listeners. |
| P3 | Refresh `docs/ARCHITECTURE.md` for the `transports/` and `features/` layout. |
