# 15 — Lighting (plan §AB, AC)

**State: FAIL — the single largest untested subsystem** · Level 0
**Finding F-13 (P1)**

---

## The finding

**Every lighting file has zero test coverage.**

| Statements | File | Coverage |
|---|---|---|
| 519 | `src/lighting/LightingManager.js` | **0 %** |
| 313 | `src/api/commands/LightingCommands.js` | **0 %** |
| 123 | `src/lighting/SacnDriver.js` | **0 %** |
| 98 | `src/lighting/ArtNetDriver.js` | **0 %** |
| 98 | `src/lighting/HttpLightDriver.js` | **0 %** |
| 93 | `src/lighting/MqttLightDriver.js` | **0 %** |
| 83 | `src/lighting/GpioStripDriver.js` | **0 %** |
| 69 | `src/lighting/OscLightDriver.js` | **0 %** |
| — | `SerialLedDriver.js`, `GpioLedDriver.js`, `LightingEffectsEngine.js`, `DmxFixtureProfiles.js` | **0 %** |
| 49 | `src/api/commands/InstrumentLightCommands.js` | **0 %** |

≈ **1 380 statements of production code with no test at all** — the largest contiguous
untested area in the repository.

Two partial exceptions, both adjacent rather than central:
`src/lighting/instrument` (instrument-attached lights) is at **84.9 %** with
`instrument-light-manager` and `instrument-light-protocol` suites, and
`lighting-effects-guard.test.js` covers one guard. The **rule engine and every network
driver** are untouched.

### Why this is P1 rather than P3

1. **It drives physical output.** Six of the drivers emit to a network (Art-Net, sACN,
   OSC, HTTP/WLED, MQTT) or to GPIO. A defect is not a wrong pixel on screen; it is
   traffic on a DMX universe or current through an LED strip.
2. **It shares the MIDI hot path.** `LightingManager` subscribes to the `midi_message`
   EventBus event (`LightingManager.js:210`) and evaluates rules **synchronously on
   every MIDI message**. An unbounded loop, a slow driver write or a throw in rule
   evaluation lands directly on the timing-critical path that §F03 is about. Nothing
   tests that rule evaluation is bounded, and nothing tests that a driver failure is
   isolated from the emitting path.
3. **It is the least-validated command surface.** 31 of 38 `LightingCommands` have no
   payload schema (F-03) — so the subsystem with no tests also has the weakest input
   validation. Those two gaps compound: an arbitrary payload reaches untested code that
   writes to a network socket.
4. **It is a headline feature.** The README advertises *"Lighting control synced to
   playback, from simple LED strips to professional DMX."*

### Architecture is sound — which makes this cheap to fix

Drivers are loaded through a `DRIVER_MODULES` map with dynamic `import()` and all extend
`BaseLightingDriver`. That is a clean, testable seam: a `FakeLightingDriver` can be
registered and asserted against with no hardware whatsoever. The absence of tests is not
a structural obstacle — it is simply work not yet done.

---

## AB01 — Rule engine — NOT TESTED

`LightingManager._evaluateWildcardEvent()` / `_executeAction()`. Per the plan:
note triggers, velocity, CC, ranges, MIDI learn — none asserted.

Priority tests, all hardware-free:

- a note rule fires exactly once per matching Note On, and not on Note Off;
- velocity thresholds and range boundaries are inclusive/exclusive as documented;
- a CC rule does not fire on a different controller;
- MIDI learn binds the intended message and nothing else;
- **rule evaluation is bounded** — N rules × M messages does not grow superlinearly;
- **a throwing or hanging driver cannot propagate into the MIDI path.**

## AB02–AB07 — Drivers — NOT TESTED

| § | Driver | Transport | State |
|---|---|---|---|
| AB02 | `GpioStripDriver`, `GpioLedDriver`, `SerialLedDriver` | GPIO / WS2812 / serial | NOT TESTED (GPIO also HW REQUIRED) |
| AB03 | `ArtNetDriver` | UDP | NOT TESTED |
| AB04 | `SacnDriver` | UDP multicast (E1.31) | NOT TESTED |
| AB05 | `OscLightDriver` | UDP | NOT TESTED |
| AB06 | `HttpLightDriver` | HTTP/WLED | NOT TESTED |
| AB07 | `MqttLightDriver` | MQTT | NOT TESTED |

For each, the plan asks: connection, reconnection, rate, saturation, timeout, network
loss, shutdown. **None is covered for any driver.**

The four UDP/HTTP/MQTT drivers are fully testable in-process against a local socket or a
stub server — no lighting hardware needed. Only the GPIO drivers genuinely require a Pi.

Specific risks worth targeting first, given zero coverage:
- **Rate/saturation.** Art-Net and sACN are typically driven at 40 Hz per universe. No
  test establishes that the send rate is bounded, so a dense MIDI passage mapping to
  many rules could flood the network from inside the MIDI callback.
- **Reconnection and timeout.** An unreachable WLED endpoint or MQTT broker must not
  block or accumulate pending writes.
- **Shutdown.** The plan's §C02 requires lights return to a safe state on shutdown.
  Untested — a crash could leave fixtures at full output.

## AC — MIDI ↔ lighting synchronisation — HW REQUIRED

Measuring the real offset between a musical event and its light event needs a
high-speed camera or a photodiode plus a MIDI capture on a common time base. Not
attempted.

Note the dependency: this measurement is meaningless until AB01/AB02–07 establish that
the pipeline is correct at all.

---

## Recommendations

| Pri | Action |
|---|---|
| **P1** | Rule-engine test suite via a `FakeLightingDriver`: note/velocity/CC/range/MIDI-learn semantics, bounded evaluation, and **failure isolation from the MIDI path**. No hardware. |
| **P1** | Driver test suite for Art-Net / sACN / OSC / HTTP / MQTT against local sockets or stub servers: connect, reconnect, timeout, rate cap, network loss, clean shutdown. No hardware. |
| P1 | Payload schemas for the 31 unschema'd `LightingCommands` (part of F-03). |
| P2 | Assert lights return to a safe state on `Application.stop()` (§C02). |
| P2 | Bound the per-message rule-evaluation cost and cap driver send rate; assert both. |
| HW | AB02 GPIO/WS2812 on a Pi; AC synchronisation measurement. |
