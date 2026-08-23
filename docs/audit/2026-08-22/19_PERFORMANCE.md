# 19 — Performance, soak, stress, CI (plan §AW, AX, AY, BP)

**State: AY = PARTIAL (measured) · AW/AX = NOT TESTED · BP = PARTIAL** · Level 3

---

## AW — Backend performance — NOT TESTED

Event-loop lag, CPU, RAM, GC, DB latency, MIDI scheduler cost, WebSocket throughput and
serialisation cost were not measured. Numbers from an x86 container would not transfer
to a Raspberry Pi, so producing them would be misleading rather than useful.

**The instrumentation already exists**, which makes this cheap to do properly on
hardware:

- an `eventLoopMonitor` service is registered in the DI container;
- `GET /api/metrics` is exposed;
- `npm run bench` → `tests/performance/benchmark.js`;
- `npm run perf:load` → `node --expose-gc tests/performance/load-soak.js`;
- every command response carries a `duration` field (verified live: `"duration":0`),
  and `CommandRegistry` emits a `ws.command.completed` metric on the EventBus.

Per-command `duration` plus an EventBus metric is genuinely good groundwork — the data
needed for §AW is already being produced, it simply is not being collected or surfaced.

**Recommendation:** expose event-loop lag and command-duration percentiles through
`/api/metrics`, then run the existing harnesses on a Pi 3B+, 4 and 5.

## AX — Soak / endurance — NOT TESTED

The plan asks for 1 h / 8 h / 24 h / 72 h of continuous playback, tracking RAM, handles,
listeners, DB size, CPU, temperature, jitter, reconnects and log errors.

**Nothing of the sort was run.** For a machine meant to conduct an orchestra unattended,
this is one of the most consequential untested areas — leaks and drift only appear on
this timescale, and static analysis cannot substitute.

Positive signals from code review (level 0 only): `Application.stop()` clears the
hot-plug interval, backup schedule and event-loop monitor; `setupShutdownHandlers()`
removes prior handlers before re-registering so they cannot accumulate;
`LightingManager` detaches its `midi_message` listener on teardown. No leak was found by
inspection — but inspection is not a soak test, and `load-soak.js` already exists to run
one.

## AY — Stress — PARTIAL (one real ceiling measured)

The only limit actually measured in this audit, on a live server:

| Limit | Value | Behaviour at the ceiling |
|---|---|---|
| WebSocket messages | **60 / s / connection** | excess rejected with an error frame; socket stays open |
| WebSocket bytes | 32 MB / s / connection | counted pre-parse |
| Max frame size | 16 MB | 20 MB frame → clean close, **server stays healthy** |
| Max WS clients | 10 | configured |

Burst results (one connection): 10→10, 50→50, 100→60, 200→60, 500→60 answered.

**The system degrades cleanly rather than blocking the Node event loop**, which is
exactly the plan's criterion for §AK/§AY. Counting bytes as well as messages is a
deliberate defence against 60 × 16 MB frames stalling `JSON.parse` on the MIDI thread —
the code says so.

Not determined: maximum instrument count, sustainable MIDI events/s, number of
simultaneous WS clients under real load, maximum MIDI file size, lighting driver
saturation, minimum viable RAM.

> Caveat worth repeating from `03_MIDI_CORE.md`: the 60 msg/s ceiling is shared between
> UI traffic and live note traffic from the virtual keyboard, which sends one frame per
> note event. That is a *functional* ceiling, not just a stress-test number.

## AZ — Fault injection — PARTIAL

Only two faults were injected, both incidental:

| Fault | Result |
|---|---|
| No native MIDI library | boots, degrades, keeps serving |
| No D-Bus (BLE unavailable) | caught, logged, keeps serving |
| No serial hardware | disabled cleanly |
| 20 MB oversized WS frame | socket closed, **server healthy afterwards** |

The plan's real list — pull USB mid-playback, kill Bluetooth, cut WiFi, kill ALSA, lock
the DB, fill the disk, delete a file in use, restart the service, send malformed RTP —
is **untested**. Several of these (lock the DB, fill the disk, delete a file in use) need
no Pi and could be scripted today.

---

## BP — CI — PARTIAL

`.github/workflows/ci.yml` has five jobs:

| Job | Steps |
|---|---|
| `lint` | `npm ci --ignore-scripts` → `npm run lint` → `npm run format:check` |
| `typecheck` | → `npm run typecheck` |
| `audit` | → `npm audit --omit=dev --audit-level=critical` |
| `frontend-smoke` | `--ignore-scripts` install → lint → `npm run test:frontend` (explicit "no native deps" reproducer) |
| `test` | installs `build-essential python3 libasound2-dev`, `npm ci`, `npm run test:coverage`, `npm run test:frontend`, uploads coverage |

**This is a well-built CI for its size.** The `frontend-smoke` job deliberately
reproduces the no-native-deps environment — someone thought about the container case.
The `test` job installs ALSA headers so the SQLite suites genuinely run.

### Against the plan's required stages

| Stage | Present? |
|---|---|
| lint | ✅ |
| format | ✅ |
| typecheck | ✅ |
| unit-backend | ✅ |
| unit-frontend | ✅ |
| security | ⚠️ **critical-only** |
| coverage | ⚠️ collected and uploaded, **no threshold enforced** |
| integration | ❌ |
| build | ❌ (`npm run build` never runs in CI) |
| E2E | ❌ |
| migration | ⚠️ implicitly, inside `test` |
| performance-smoke | ❌ |

### Three concrete CI gaps

1. **`--audit-level=critical` is too permissive.** The project currently has **8 high**
   advisories and 0 critical, including `ws` — a *direct runtime dependency* with an
   uninitialized-memory-disclosure bug (F-16). CI passes. Setting `--audit-level=high`
   would have surfaced it.
2. **`npm run build` is never exercised.** A Vite build failure reaches users rather
   than CI, and `HttpServer` serves `dist/` in production — so a broken build is a
   production-only failure mode.
3. **F-17 — `npm run format:check` fails at HEAD (P3).** The `lint` job runs
   `format:check`, and at commit `1e98176` Prettier reports **13 files** that need
   reformatting:

   ```
   public/js/features/SystemAdminModal.js
   public/js/features/auto-assign/HandPositionFeasibility.js
   src/api/commands/FileCommands.js
   src/midi/adaptation/NoteEnforcement.js
   src/midi/adaptation/VoiceSelector.js
   src/midi/instrument/CapabilityResolver.js
   src/midi/playback/PlaybackScheduler.js
   src/midi/routing/MidiRouter.js
   tests/ble-midi-decode.test.js
   tests/capability-resolver.test.js
   tests/playback-schemas-t5-4.test.js
   tests/scoring-edge-cases-t6.test.js
   tests/voice-selector.test.js
   ```

   None of these were touched by this audit — verified against pristine HEAD. So the
   `lint` job is currently **red on `main`**, which also means the Husky pre-commit hook
   (`lint-staged` → `prettier --check`) is being bypassed on some commits. A red CI that
   stays red trains everyone to ignore it, so this is worth clearing even though it is
   cosmetic: `npm run format` fixes all 13 in one commit.

---

## Recommendations

| Pri | Action |
|---|---|
| P2 | CI: `--audit-level=high`, and add a `build` job running `npm run build`. |
| P2 | CI: enforce a coverage floor (start at the current 44.6 % statements) with a ratchet so it can only rise. |
| P2 | Script the hardware-free fault injections: lock the DB, fill the disk, delete a file in use, restart mid-write. |
| P2 | Surface event-loop lag and command-duration percentiles via `/api/metrics`. |
| P3 | Add `command-inventory.mjs` to CI with a schema-coverage ratchet (§U). |
| HW | AW and AX on Pi 3B+/4/5: run `perf:load` for 1 h / 8 h / 24 h / 72 h, tracking RAM, handles, temperature and jitter. |
| HW | AY: find the real ceilings — instruments, events/s, clients, file size. |
