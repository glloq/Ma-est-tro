# TEST_MATRIX — module × critical function × coverage × gap

**Date:** 2026-08-22 · **Commit:** `1e98176`
Coverage measured with `--collectCoverageFrom='src/**/*.js'` (the *true* figure — see
`02_CODE_QUALITY.md` for why the default reporter reads ~7 points higher).

```
Backend total:  44.57 % stmt · 44.11 % branch · 38.82 % func · 45.47 % line
Zero-coverage files: 34 / 176
Backend tests: 150 suites / 1875 tests   Frontend: 81 files / 1488 tests
```

Legend — **Test?** ✅ has dedicated tests · ⚠️ partial/indirect · ❌ none
**Level** — the highest validation level reached (see `AUDIT_MASTER.md` §0).

---

## 1. Lowest-coverage significant modules (≥ 80 statements)

Sorted worst-first. This is the work queue.

| stmt% | br% | fn% | stmts | Module | Test? | Priority |
|---|---|---|---|---|---|---|
| **0** | 0 | 0 | 519 | `lighting/LightingManager.js` | ❌ | **P1** |
| **0** | 0 | 0 | 313 | `api/commands/LightingCommands.js` | ❌ | **P1** |
| **0** | 0 | 0 | 201 | `midi/messages/MidiMessage.js` | ❌ | **delete — dead code** |
| **0** | 0 | 0 | 153 | `api/commands/LatencyCommands.js` | ❌ | P2 |
| **0** | 0 | 0 | 149 | `api/commands/StringInstrumentCommands.js` | ❌ | P2 |
| **0** | 0 | 0 | 123 | `lighting/SacnDriver.js` | ❌ | **P1** |
| **0** | 0 | 0 | 110 | `api/commands/PlaylistCommands.js` | ❌ | P2 |
| **0** | 0 | 0 | 98 | `lighting/ArtNetDriver.js` | ❌ | **P1** |
| **0** | 0 | 0 | 98 | `lighting/HttpLightDriver.js` | ❌ | **P1** |
| **0** | 0 | 0 | 93 | `lighting/MqttLightDriver.js` | ❌ | **P1** |
| **0** | 0 | 0 | 92 | `api/commands/InstrumentVoiceCommands.js` | ❌ | P2 |
| **0** | 0 | 0 | 85 | `api/commands/VirtualInstrumentCommands.js` | ❌ | P2 |
| **0** | 0 | 0 | 83 | `lighting/GpioStripDriver.js` | ❌ | P2 (GPIO = HW) |
| **0** | 0 | 0 | 81 | `api/commands/HotspotCommands.js` | ❌ | P2 |
| 0.25 | 0 | 0 | 393 | `transports/NetworkManager.js` | ⚠️ codec only | P2 |
| 0.5 | 0 | 0 | 198 | `midi/playback/MidiClockGenerator.js` | ❌ | P2 |
| 1.7 | 0 | 3 | 117 | `persistence/tables/LightingDatabase.js` | ❌ | P2 |
| 1.98 | 0 | 0 | 101 | `api/HttpServer.js` | ⚠️ probed live | P2 |
| 2.08 | 0 | 5 | 96 | `persistence/tables/LoopArrangementsDB.js` | ❌ | P2 |
| 3.94 | 0 | 8 | 279 | `midi/devices/DeviceDiscovery.js` | ❌ | **P2 — fake enumerator, no HW needed** |
| 5.3 | 25 | 8 | 283 | `core/Application.js` | ⚠️ DI + capability only | P2 |
| 5.61 | 0 | 0 | 89 | `system/HotspotManager.js` | ❌ | P2 |
| 6.14 | 6 | 16 | 228 | `persistence/tables/StringInstrumentDatabase.js` | ⚠️ | P3 |
| 6.48 | 0 | 0 | 108 | `api/apiRoutes.js` | ⚠️ probed live | P2 |
| 8.51 | 3 | 4 | 141 | `api/WebSocketServer.js` | ⚠️ probed live | **P2 — rate limiter untested** |
| 16.5 | 35 | 29 | 188 | `persistence/tables/InstrumentSettingsDB.js` | ⚠️ | P3 |
| 16.5 | 19 | 27 | 97 | `persistence/BackupScheduler.js` | ⚠️ GC floor only | P3 |
| 17.3 | 15 | 12 | 352 | `transports/SerialMidiManager.js` | ⚠️ SysEx flush only | **P2 — parser is pure JS** |
| 19.2 | 15 | 9 | 276 | `api/commands/SystemCommands.js` | ⚠️ | **P2 — update path** |
| 19.3 | 6 | 38 | 254 | `files/MidiBaker.js` | ⚠️ merge + tempo map | P2 |
| 21.8 | 13 | 20 | 124 | `api/sf2Routes.js` | ⚠️ | P3 |
| 23.5 | 0 | 25 | 85 | `persistence/tables/InstrumentDatabase.js` | ⚠️ | P3 |

## 2. Best-covered modules (for contrast)

| stmt% | Module | Note |
|---|---|---|
| 87.8 % | `midi/instrument` | descriptor protocol / capability resolver |
| 84.9 % | `lighting/instrument` | the *only* well-tested lighting code |
| 78.7 % | `midi/adaptation` | 3 559 stmts — the musical brain, correctly prioritised |
| 74.3 % | `midi/routing` | |
| 72.4 % | `repositories` | |

---

## 3. Critical-function matrix

| Module | Critical function | Test? | Edge cases covered | Missing |
|---|---|---|---|---|
| `DeviceManager` | `handleRawMidi()` | ✅ **new** | all 16 ch, 0/127, 14-bit bend, vel-0, SysEx, null input, System Common | interleaved real-time |
| `DeviceManager` | hot-plug add/remove/rename | ⚠️ | identity, descriptor, pruning | **identical names, port change** — fake enumerator |
| `SerialMidiManager` | byte-stream parser | ❌ | SysEx partial flush only | **running status, real-time interleave, truncation, resync** |
| `MidiFileParser` | `parse()` | ✅ **new** | 11 malformed + 380 fuzz cases | semantic fuzz (0 tempo, 10 k tracks) |
| `MidiPlayer` | format-2 / SMPTE reject | ✅ | both | |
| `MidiPlayer` | `_panicChannel()` / all-notes-off | ⚠️ | omni fallback present | assert no note survives panic |
| `MidiRouter` | note ownership on split | ⚠️ | split disconnect | **no duplication / no loss over a full file** |
| `MidiTransposer` | `transposeChannels()` | ✅ | collisions, no double transpose | golden output |
| `InstrumentMatcher` | `calculateCompatibility()` | ⚠️ | edge cases, hand feasibility | **reference corpus (§H05)** |
| `HandPositionPlanner` | `plan()` | ✅ | | impossible-position enumeration |
| `LightingManager` | rule evaluation | ❌ | — | **everything (F-13)** |
| every lighting driver | connect/reconnect/timeout/shutdown | ❌ | — | **everything (F-13)** |
| `WebSocketServer` | `verifyClient()` auth | ⚠️ | probed live | unit tests for Origin/Host edge cases |
| `WebSocketServer` | rate limiter | ❌ | measured live | **unit test; panic exemption (F-07)** |
| `CommandRegistry` | dispatch + error mapping | ✅ | contract fixtures | |
| `JsonValidator` | `validateByCommand()` | ⚠️ | compiler tested | **184 commands have no schema (F-03)** |
| `Application` | `getCapabilityStatus()` | ⚠️ | mapping only | **real predicates (F-01, F-02)** |
| `Application` | `stop()` / shutdown | ⚠️ | DI late-binding | **panic sent, lights safe, ports closed** |
| `Database` | backup / restore | ✅ | verified with canary | rotation, disk full, corrupt backup |
| `Database` | migrations | ✅ | fresh, uniqueness, idempotent | **per-version upgrade fixtures**, interruption |
| `FileManager` | blob path guard | ✅ | traversal blocked | **orphan / missing blob consistency** |
| `MidiBaker` | bake | ⚠️ | merge, tempo map | full round-trip (§E04) |

---

## 4. Hardware-free work currently mis-filed as "needs hardware"

These are commonly assumed to need the bench. They do not:

| Item | Why it is testable now |
|---|---|
| `SerialMidiManager` byte-stream parsing | feed a `Uint8Array`; no UART |
| `DeviceManager` hot-plug state machine | inject a fake enumerator (the easymidi stub proves the seam exists) |
| Art-Net / sACN / OSC / HTTP / MQTT drivers | local sockets or a stub server |
| Lighting rule engine | `FakeLightingDriver` |
| Determinism (§BN) | run the pipeline twice, assert deep equality |
| MIDI round-trip (§E04) | parse → write → parse, diff events |
| Cross-editor coherence (§Q05) | exercise view model layers, assert the shared sequence |
| Adapted-vs-original preview (§P03) | assert which event list the preview path requests |

## 5. Genuinely hardware-gated

§F03 real timing · §F05 MIDI clock · §K USB · §L BLE radio · §M UART at 31 250 baud ·
§N02 AppleMIDI interop · §O acoustic latency · §AC MIDI↔light offset · §AD Pi system ·
§AE hotspot · §AL frontend boot on Pi · §AP touch · §AQ cross-browser · §AX soak ·
§BJ bench · §BL instrument matrix · §BM listening · §BT Pi 3/4/5 · §BX orchestra.

---

## 6. Suggested coverage targets

| Milestone | Statements | Gate |
|---|---|---|
| Today | 44.6 % | — |
| After lighting suite (F-13) | ~52 % | CI floor at 50 % |
| After command schemas + tests (F-03) | ~60 % | CI floor at 58 % |
| After transport parser + hot-plug tests | ~65 % | CI floor at 63 % |

Enforce with a **ratchet** (coverage may not decrease) rather than a fixed target — it
is the only mechanism that survives contact with a real backlog.
