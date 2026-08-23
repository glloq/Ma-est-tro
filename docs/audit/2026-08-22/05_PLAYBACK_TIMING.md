# 05 — Playback engine & timing (plan §F01–F05)

**State: PARTIAL (logic) / HW REQUIRED (timing)** · Level 1

---

## Scope note

Timing is the one area where **an audit in a container is close to worthless**. Every
number that matters — jitter, p95/p99 latency, drift under load — is a property of the
Raspberry Pi, its kernel, its scheduler and the physical transport. Nothing measured on
an x86 container carries over. This report therefore separates *logic that can be
verified here* from *timing that cannot*, and does not dress the second up as the first.

`src/midi/playback` is 2 699 statements at **46.2 %** coverage.

---

## F01 — Chronology — PARTIAL (level 1)

Verified present and covered by existing suites:

| Concern | State | Evidence |
|---|---|---|
| PPQ handling | PASS | rejects SMPTE; PPQ carried from header |
| Tempo | PASS | `defaultTempo` config, per-file tempo |
| Tempo changes mid-file | PARTIAL | `extractTempoMap()`, `tests/midi-baker-tempo-map.test.js` |
| Delta-times | PARTIAL | covered indirectly by the scheduler suites |
| Ordering of simultaneous events | PARTIAL | `tests/playback-scheduler-discrete-notes.test.js` |
| Note Off before Note On when required | PARTIAL | note-gate logic in `MidiRouter`; `tests/midi-router-notegate-reset.test.js` |
| CC / Program Change / SysEx in stream | PARTIAL | `tests/playback-scheduler-*` family |

The scheduler suite is genuinely broad — 20+ dedicated files covering channel
transposition, range folding, scale snapping, note remapping, hand-shift CC injection,
split disconnect, tickless operation and snapshotting. This is not a thin area.

**What is missing:** none of it asserts *ordering under simultaneity* in the general
case. `playback-scheduler-discrete-notes` covers a specific scenario. There is no test
that takes a file with many events on the same tick and pins the emitted order.

## F02 — Transport controls — PARTIAL (level 1)

| Control | Coverage |
|---|---|
| Play / Stop | existing suites |
| Pause / Resume | `tests/midi-player-seek-pause.test.js` |
| Seek | `tests/midi-player-seek-pause.test.js` |
| Stop during scheduler advance | `tests/midi-player-stop-during-advance.test.js` — a real race, explicitly tested |
| Restart / song change | NOT TESTED |
| Loop | partially, via the loop suites |
| Tempo change during playback | NOT TESTED |

`midi-player-stop-during-advance` is a good sign: someone thought about the
stop-mid-tick race and locked it down.

## F03 — Real timing — HW REQUIRED

**Not measured. No Raspberry Pi available.**

The plan asks for mean / min / max / p95 / p99 / jitter between the scheduled instant
and actual emission. To do this properly on the target:

```bash
# On the Pi, with a real MIDI output attached:
npm run bench                 # existing micro-benchmarks
node --expose-gc tests/performance/load-soak.js
```

…plus an external capture (MIDI monitor with hardware timestamps, or a logic analyser
on the UART line) to measure *emission*, not *intent*. Software self-timing measures
the scheduler's own clock and will under-report.

Relevant context that *is* known:
- `config.json` sets `playback.lookahead = 100` ms — a lookahead scheduler design, which
  is the right architecture for this problem.
- `docs/realtime-pi.md` and `scripts/pi-rt-tune.sh` / `scripts/check-rt-setup.sh` exist,
  so RT tuning has been considered.
- An `eventLoopMonitor` service is registered, so event-loop lag is already
  instrumented — that instrumentation should be the basis of the F03 measurement.

## F04 — Polyphonic load — NOT TESTED

1/4/8/16 instruments × 100/500/1 000/5 000 events per second: not attempted. A
container cannot produce a meaningful answer, and no synthetic harness for this exists
in `tests/performance/` beyond the general soak script.

## F05 — MIDI Clock — HW REQUIRED

Clock generation exists (per-device `midi_clock_enabled` setting is persisted). Its
stability, drift and jitter, and the behaviour of slaved devices, cannot be assessed
without hardware.

---

## Cross-reference: the timing risk that *was* found

Not a `src/midi/playback` defect, but it lands on playback: the **WebSocket rate limiter
(60 msg/s per connection) has no priority exemption**, so a UI-initiated `playback_stop`
or panic issued during a burst of keyboard traffic is dropped before dispatch. See
F-07 in `03_MIDI_CORE.md`.

---

## Recommendations

| Pri | Action |
|---|---|
| P1 (on Pi) | Build the F03 harness: timestamp at schedule vs. at emission, on a real Pi, captured externally. Report mean/min/max/p95/p99/jitter. Without it, "real-time" is an unverified claim. |
| P2 | Add an ordering test for many events on one tick (hardware-free). |
| P2 | Add tempo-change-during-playback and song-change-during-playback tests (hardware-free). |
| P3 | Feed `eventLoopMonitor` output into the health endpoint so lag is observable in production, not just in a benchmark. |
