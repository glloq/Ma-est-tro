# 02 — Code quality, types, tests & coverage (plan §A02, A03, A04, BE, BF, BG)

**State: PASS (static) / PARTIAL (coverage)** · Level 1

---

## A02 — Static JavaScript analysis — PASS

```
npm run lint   →  0 errors, 203 warnings
```

| Rule | Count | Assessment |
|---|---|---|
| `no-console` | 183 | Almost all in `scripts/` (CLI tooling — correct there). Backend logging goes through `Logger.js`. |
| `no-control-regex` | 4 | Deliberate `\x00-\x1f` filters in filename sanitisation. Correct code; the rule is the wrong shape for it. |
| `no-unused-vars` | 16 | Unused test imports (`jest`, `beforeAll`, `beforeEach`) and a few unused constants. |

No unreachable branches, no floating promises, no implicit-conversion errors and no
accidental mutations were reported. `no-empty` is configured with `allowEmptyCatch`,
and the empty catches reviewed are genuine best-effort cleanups with explanatory
comments.

**Timers and listeners.** ESLint cannot see these. Reviewed by hand at the lifecycle
boundaries: `Application.stop()` clears the hot-plug interval, the backup schedule and
the event-loop monitor; `setupShutdownHandlers()` explicitly removes prior handlers
before re-registering so they cannot accumulate across restarts. `LightingManager`
removes its `midi_message` EventBus listener on teardown. No leak found by inspection —
but this is level 0 evidence, and a real soak test (§AX) has not been run.

## A03 — Type safety — PASS

```
npm run typecheck   →  exit 0, clean
```

JS is checked via JSDoc plus ambient definitions in `src/types/`. Command handlers,
MIDI message shapes and DB row types carry JSDoc annotations. `tsc` passing cleanly
over a 61 kLOC untyped-by-default codebase is a real result.

**Reservation.** `tsc --noEmit` on JSDoc-annotated JS is far weaker than TypeScript:
an un-annotated parameter is `any`, and `any` silences everything downstream. The clean
result means *no contradictions were found*, not *everything is typed*. The
frontend/backend WS message contract in particular is not shared — `public/js` and
`src/api` describe the same envelope independently, so a divergence would not be caught
by either side's types. A single shared `shared/ws-contract.d.ts` consumed by both would
close that.

---

## BE — Assessment of the existing test suite — PASS

```
Backend  (Jest)    150 suites / 1875 tests   all pass   ~7 s
Frontend (Vitest)   81 files  / 1488 tests   all pass  ~32 s
                   ------------------------
                   3363 tests
```
*(150/1875 includes the 2 suites / 27 tests added by this audit; the pre-existing
baseline is 148 suites / 1848 tests.)*

**Quality is high.** Sampling across `tests/`, the suites are behaviour-focused rather
than implementation-coupled: they assert on routed MIDI output, on persisted rows, on
scheduler decisions. Many are explicit regression tests naming the audit finding they
lock down (`adaptation-audit-fixes-2026-08-06`, `midi-player-hand-cc-double-inject`,
`playback-scheduler-split-disconnect`). That is the §BO workflow already in practice.

Contract tests with JSON fixtures (`tests/contracts/`) pin WS error messages
byte-for-byte, which is the right way to keep a client/server error contract stable.

No flaky tests observed: five consecutive full runs, identical results.

### F-04 — 10 suites skip silently — FAIL (P3)

`jest.config.cjs` probes for working `better-sqlite3` bindings and, when absent,
auto-appends every SQLite-dependent suite to `testPathIgnorePatterns`. The mechanism
itself is good design — it is self-maintaining and keeps the pure-JS suites runnable in
a bare container.

The problem is that it is **silent**:

| Environment | Jest reports | Actually ran |
|---|---|---|
| `npm install --ignore-scripts` (no binding) | `138 passed, 138 total` · *"Ran all test suites"* | 138 |
| after `npm rebuild better-sqlite3 --build-from-source` | `148 passed, 148 total` | 148 |

**335 tests — 18 % of the backend suite — vanish with no warning**, and the run still
prints *"Ran all test suites."* The dropped suites are exactly the ones covering the
data you cannot afford to get wrong: `migrations-fresh-install`,
`database-restore-reopen`, `repository-delegations`, `routing-integration`,
`filemanager-adapted-persist`, `bluetooth-persistence-reconnect`, `midi-filter`,
`harmonica-config-db`, `instrument-scale-root-db`, `sysex-identity-mapping`.

**This project's CI is configured correctly** — the `test` job installs
`build-essential python3 libasound2-dev` and runs `npm ci` *with* scripts, so all 148
suites do run there. The risk is therefore latent rather than active: if that apt step
ever degrades (a mirror outage for one package, a runner-image change, a future
`--ignore-scripts` optimisation), 335 tests disappear and the job still reports green,
with nothing in the output to distinguish a healthy run from a gutted one.

**Fix:** print a prominent warning listing the skipped suites, and fail the run (or
enforce a minimum suite count) when the skip list is non-empty. The mechanism should be
loud, not merely correct in the happy path.

---

## BF — Coverage

Measured two ways, because the difference is itself the finding:

| Scope | Stmts | Branches | Funcs | Lines |
|---|---|---|---|---|
| Files *touched by tests* (Jest default) | 51.40 % | 50.16 % | 46.48 % | 52.24 % |
| **All `src/**/*.js`** (`--collectCoverageFrom`) | **44.57 %** | **44.11 %** | **38.82 %** | **45.47 %** |

Because `jest.config.cjs` sets no `collectCoverageFrom`, only files imported by a test
are instrumented. The default reporter therefore flatters the project by ~7 points and,
worse, **makes 34 completely untested files invisible** — they contribute nothing to
either numerator or denominator.

**Recommendation:** set `collectCoverageFrom: ['src/**/*.js']` in `jest.config.cjs` so
the number reflects reality.

### Statement coverage by module

| Coverage | Stmts | Module |
|---|---|---|
| 24.1 % | 469 | `src/audio` |
| 27.3 % | 618 | `src/persistence` |
| 30.0 % | 716 | `src/api` |
| 30.1 % | 1 584 | `src/persistence/tables` |
| 34.0 % | 1 078 | `src/midi/devices` |
| 41.9 % | 582 | `src/core` |
| 42.8 % | 1 427 | `src/transports` |
| 46.2 % | 2 699 | `src/midi/playback` |
| 46.4 % | 1 741 | `src/api/commands` |
| 51.8 % | 1 488 | `src/files` |
| 72.4 % | 174 | `src/repositories` |
| 74.3 % | 966 | `src/midi/routing` |
| **78.7 %** | 3 559 | `src/midi/adaptation` |
| 87.8 % | 304 | `src/midi/instrument` |

The shape is encouraging: **the musical brain is the best-tested part of the system.**
Adaptation (78.7 %) and routing (74.3 %) — the two subsystems where a bug produces
wrong *music* rather than a stack trace — carry the most coverage. That is the correct
priority, and it was clearly deliberate.

### Zero-coverage files — 34 of 176

| Stmts | File |
|---|---|
| 519 | `src/lighting/LightingManager.js` |
| 313 | `src/api/commands/LightingCommands.js` |
| 201 | `src/midi/messages/MidiMessage.js` *(dead — delete instead)* |
| 153 | `src/api/commands/LatencyCommands.js` |
| 149 | `src/api/commands/StringInstrumentCommands.js` |
| 123 | `src/lighting/SacnDriver.js` |
| 110 | `src/api/commands/PlaylistCommands.js` |
| 98 | `src/lighting/ArtNetDriver.js` |
| 98 | `src/lighting/HttpLightDriver.js` |
| 93 | `src/lighting/MqttLightDriver.js` |
| 92 | `src/api/commands/InstrumentVoiceCommands.js` |
| 85 | `src/api/commands/VirtualInstrumentCommands.js` |
| 83 | `src/lighting/GpioStripDriver.js` |
| 81 | `src/api/commands/HotspotCommands.js` |
| 78 | `src/api/commands/SessionCommands.js` |
| 74 | `src/api/commands/DeviceCommands.js` |
| 69 | `src/lighting/OscLightDriver.js` |
| 63 | `src/api/commands/MidiCommands.js` |
| 53 | `src/api/commands/BluetoothCommands.js` |
| 49 | `src/api/commands/InstrumentLightCommands.js` |

Two clusters, and they are the same two gaps found independently elsewhere in this
audit:

1. **Lighting — every single file.** Manager plus all seven drivers: ~1 380 statements
   with no test at all. See `15_LIGHTING.md` (F-13, P1).
2. **Command modules.** Consistent with F-03: the command layer is both the least
   validated *and* the least tested. Only 63 of 270 commands are even mentioned in a
   test file.

---

## BG — Missing unit tests

The module × function × gap matrix is maintained separately in `TEST_MATRIX.md`.

Highest-value additions, ranked by (risk × absence):

| Pri | Target | Why |
|---|---|---|
| P1 | `LightingManager` rule evaluation (note / velocity / CC / range / MIDI-learn) | 519 stmts, 0 %; drives real hardware output. |
| P1 | Each lighting driver's connect / reconnect / timeout / shutdown path | 7 drivers, 0 %; all do network or GPIO I/O. |
| P2 | Payload-schema tests for the 184 unschema'd commands | Locks F-03 shut once fixed. |
| P2 | `DeviceManager` hot-plug add/remove/rename state machine | 34 % coverage on the module that owns device identity. |
| P2 | `SerialMidiManager` byte-stream parser: running status, interleaved real-time, mid-SysEx interruption, resync | Pure-JS and fully testable **without** hardware — the parser is the part of §M that does not need a Pi. |
| P3 | `Application.getCapabilityStatus()` for the real-failure cases | Would have caught F-01 and F-02. |
