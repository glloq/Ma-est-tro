# REMEDIATION_ROADMAP

**Date:** 2026-08-22 · **Commit:** `1e98176` · **Version:** 0.8.1

Ordered by (severity × confidence × effort). Every item traces to a finding in
`AUDIT_MASTER.md`. Effort is a rough engineering estimate, not a commitment.

**No P0 findings.** Nothing found causes corruption, crash, hardware danger or a
critical security hole.

---

## Already fixed in this audit

| # | Fix | Evidence |
|---|---|---|
| F-08 | System Common (`0xF1/F2/F3/F6`) was silently dropped on the BLE/network path while UART handled it. Now mirrors the serial parser's type names and `{bytes}` payload, so the same wire bytes behave identically on every transport. | `tests/audit/midi-core-conformance.test.js` — red before, green after; full suite 150/1875 pass |

Also delivered: four reusable audit tools (`scripts/audit/`) and two test suites
(`tests/audit/`). See `AUDIT_MASTER.md` §4.

---

## Wave 1 — P1 (do first)

### R1 · Make WebSocket payload validation fail closed — F-03
**Effort: M · Risk if skipped: high**

`JsonValidator.validateByCommand()` returns `{valid:true}` for any command with no
schema, so **184 of 270 commands accept arbitrary payloads**.

1. Invert the default: an unknown command carrying a payload is a validation error.
   Keep an explicit allow-list for genuinely parameterless commands.
2. Backfill schemas in risk order: `LightingCommands` (31 — untested code driving
   network/GPIO), `PlaylistCommands` (15), `StringInstrumentCommands` (15),
   `InstrumentSettingsCommands` (11), `SystemCommands` (10 — update/reboot/restore),
   `RoutingCommands` (13), `FileCommands` (16), `LatencyCommands` (12).
3. Add `scripts/audit/command-inventory.mjs` to CI with a **ratchet**: schema coverage
   may not decrease.

*Done when:* schema coverage ≥ 90 % and CI blocks regressions.

### R2 · Test the lighting subsystem — F-13
**Effort: L · Risk if skipped: high**

≈1 380 statements at **0 %**, driving real network and GPIO output, evaluated
**synchronously on every MIDI message**.

1. `FakeLightingDriver` against `BaseLightingDriver`; the existing `DRIVER_MODULES`
   dynamic-import map is already a clean seam.
2. Rule-engine suite: note / velocity / CC / range / MIDI-learn semantics, **bounded
   evaluation cost**, and — most important — **driver failure isolated from the MIDI
   path**.
3. Driver suites for Art-Net, sACN, OSC, HTTP/WLED, MQTT against local sockets or stub
   servers: connect, reconnect, timeout, rate cap, network loss, clean shutdown.
   **No lighting hardware required.**
4. Assert lights return to a safe state on `Application.stop()` (§C02).

*Done when:* lighting statement coverage ≥ 70 % and a hung driver provably cannot stall
MIDI dispatch.

### R3 · Add a browser E2E harness — §BI
**Effort: M · Leverage: highest in the audit**

No Playwright/Puppeteer/Cypress exists. Adding one converts roughly seven currently
unanswerable sections (§Q01, AM, AN, AO, AR, AU, AV, plus automated §AI payloads) into
testable ones. Conditions are favourable: the server boots headlessly in seconds,
virtual instruments remove the hardware dependency, and the WS contract is stable.

Start with the plan's canonical scenario:
`launch → configure virtual instrument → import MIDI → assign → adapt → play → edit → save → reload → verify`.

---

## Wave 2 — P2 (next)

### R4 · Tell the truth on `/api/health` — F-01, F-02
**Effort: S · Confidence: certain (both reproduced live)**

- `usb` is `deviceManager ? ready : failed`, but `DeviceManager` **always** constructs
  (no-op stub when `easymidi` is missing). Export `midiAvailable` and map it.
- `ble` reflects only whether the *constructor* threw; the real failure happens in
  `initialize()` and is swallowed. Record it into `_capabilityErrors.ble`.
- Report `serial: disabled` when disabled in config, not `ready`.
- Extend `capability-status.test.js` to assert the **real predicates**, not just the
  mapping function — the current suite passes with both defects present.

### R5 · Fix the WebSocket throttle's two musical hazards — F-06, F-07
**Effort: M**

- **F-06:** rate-limit error frames carry no `id`, so the throttled request hangs for
  its full 10 s timeout and cannot be retried. Parse enough of the frame to echo `id`.
- **F-07:** the limiter runs pre-parse and so cannot exempt a panic. Add a small
  pre-scan allow-list (`midi_panic`, `playback_stop`, CC 120/121/123) — the device-level
  limiter already does exactly this.
- Batch virtual-keyboard notes: `KeyboardEvents.js` sends **one frame per note event**,
  so 30 note pairs/s saturates the 60 msg/s budget and a dropped note-off leaves a note
  sounding. One frame per chord.

*Done when:* a 200-note/s passage produces no dropped note-off and panic always lands.

### R6 · Upgrade `ws` and tighten the CI audit gate — F-16
**Effort: S**

`ws@8.20.0` is a **direct runtime dependency** with a high-severity uninitialized-memory
-disclosure advisory (affected `8.0.0–8.20.1`, fix available within the declared
`^8.14.2`). CI uses `--audit-level=critical`, so 8 high advisories pass silently.

`npm audit fix`, then set `--audit-level=high`.

### R7 · Golden-file corpus for adaptation — §H05, E05, BN, BM
**Effort: M · Unblocks four sections at once**

8–12 source MIDI files spanning the instrument families + a fixed instrument set +
committed expected output. A runner executes `analyse → assign → adapt → bake` and diffs.

This simultaneously provides: matcher scoring validation (§H05), adapted-MIDI comparison
(§E05), determinism (§BN), and a stable artefact for listening sessions (§BM).

Cheap precursor, do it immediately: **run the pipeline twice in one process and assert
deep equality** — catches unstable sorts in `calculateCompatibility()` with ~20 lines.

### R8 · Close the offline/supply-chain gap — F-14, F-15
**Effort: S**

`public/lib/WebAudioFontPlayer.js` and `assets/sf2/default.sf2` are downloaded at
install from third-party mirrors, verified only by magic bytes and minimum size — **no
checksum** — and the player is **executed as JavaScript**. If the player is missing,
`index.html:6011` falls back to a **render-blocking `document.write` of a CDN script**,
which on an offline Pi cannot succeed.

- Commit the player (~100 KB) — fixes both findings at once.
- Pin a SHA-256 for the SF2 and refuse a mismatch.
- Make any remaining fallback async and fail visibly ("audio preview unavailable").

### R9 · Hardware-free tests currently mis-filed as needing hardware
**Effort: M · High value per line**

- `SerialMidiManager` byte-stream parser: running status, interleaved real-time,
  truncation, resync. Pure JS.
- `DeviceManager` hot-plug via a fake enumerator: identical names, port change, rename.
- MIDI round-trip (§E04): parse → write → parse, event-level diff.
- Cross-editor coherence (§Q05): edit via each view's model, assert the shared sequence
  stays the source of truth.
- Adapted-vs-original preview (§P03): assert which event list the preview requests.
- Fault injection: lock the DB, fill the disk, delete a file in use.

### R10 · Make skipped test suites loud — F-04
**Effort: S**

`jest.config.cjs` silently drops 10 SQLite suites (335 tests, 18 % of the backend) when
bindings are missing, and still prints *"Ran all test suites."* CI is currently
configured correctly, so this is latent — but a degraded run is indistinguishable from a
healthy one. Print the skip list; fail when it is non-empty.

Also: set `collectCoverageFrom: ['src/**/*.js']` so coverage reflects reality
(44.6 %, not 51.4 %), and add a CI coverage ratchet.

### R11 · Test the update system's failure paths — §AF
**Effort: M**

`src/system` is at **5.61 %** coverage and `system_*` commands are 10/11 unschema'd. On
an appliance a user cannot easily reflash, *"une mise à jour ne doit jamais rendre
l'installation irrécupérable"* is the highest-consequence untested claim in the project.
Cover: git error, conflict, network loss mid-update, `npm install` failure, disk full,
interruption, rollback.

---

## Wave 3 — P3 (cleanup)

| # | Action | Ref |
|---|---|---|
| R12 | Delete `src/midi/messages/MidiMessage.js` — 468 dead lines that disguised F-08 | F-09 |
| R12b | Run `npm run format` — `format:check` fails at HEAD on 13 untouched files, so CI's `lint` job is red on `main`. One commit. | F-17 |
| R13 | JSON 404 for unmatched `/api/*` before the SPA fallback | F-10 |
| R14 | Fix the asymmetric escaping contract (`showConfirmModal(title, message)`) — rename to `messageHtml` or escape both | F-05 |
| R15 | Split `Application.initialize()` (265 lines) into ordered phase functions; make the DI facade throw on unknown names | §A01 |
| R16 | Add an i18n *completeness* metric with a ratchet (70–89 % translated today, structure is perfect) | F-12 |
| R17 | Add a `build` job to CI (`npm run build` never runs there) | §BP |
| R18 | `npx license-checker --summary`; confirm GeneralUser GS redistribution terms | §BS |
| R19 | `--` before user arguments in `HotspotManager._runScript()` | §AH |
| R20 | Document that `trusted-lan` grants every LAN client shutdown/update rights | §AJ |
| R21 | Refresh `docs/ARCHITECTURE.md` for `transports/` and `features/`; close the 83-command gap in `docs/API.md` | §BC, BD |
| R22 | Reduce `!important` (685 occurrences) and inline `style=` in generated markup; revisit CSP afterwards | §AT, F-11 |
| R23 | Assert `max(device latency) < playback.lookahead` (100 ms) — mechanical instruments routinely exceed it | §O |

---

## Wave 4 — hardware (levels 4–5)

Nothing below can be closed without the bench, and **no hardware feature should be
marked VALIDATED until it is**.

| # | Action | Unlocks |
|---|---|---|
| R24 | **Minimum bench: Pi 4 + USB loopback + UART loopback.** One afternoon of wiring. | §K, §M, §F03, §D05 |
| R25 | Real timing measurement: scheduled vs emitted, externally captured, p95/p99/jitter | §F03 |
| R26 | Add ESP32 BLE-MIDI + a commercial instrument | §L, §BL |
| R27 | Microphone + audio interface: latency calibration, then 16 instruments measured for **acoustic** onset alignment | §O |
| R28 | Soak on a Pi: 1 h / 8 h / 24 h / 72 h continuous playback | §AX |
| R29 | Pi 3B+ / 4 / 5 regression — the 3B+ is the binding constraint | §BT |
| R30 | **§BX orchestra test.** Watch specifically for F-07 (stuck notes under dense passages, unresponsive panic) and F-13 (timing degradation once lighting rules are enabled). | §BX |

---

## Suggested sequencing

```
Sprint 1   R4  R6  R10  R12  R12b  R13    small, certain, immediate value
Sprint 2   R1  R5                        the P1 validation gap + the musical hazards
Sprint 3   R2                            lighting: the biggest coverage hole
Sprint 4   R3  R9                        E2E harness + the mis-filed hardware-free tests
Sprint 5   R7  R8  R11                   golden corpus, supply chain, update safety
Ongoing    Wave 3 cleanup
Gated      Wave 4 once the bench exists
```

`R4`, `R6`, `R10`, `R12` and `R13` are each under a day and all five are certain — that
is the right first sprint. `R1` and `R2` are the two that actually change the project's
risk profile.
