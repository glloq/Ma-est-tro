# AUDIT_MASTER — Général Midi Boop

**Date:** 2026-08-22 · **Commit:** `1e98176` · **Version:** 0.8.1
**Auditor environment:** Linux x86_64 container, Node v22.22.2, no Raspberry Pi, no MIDI
hardware, no audio device, no D-Bus/Bluetooth, no GPIO.

This document is the single source of authority for the audit. The specialised
reports (`01_*` … `22_*`) feed the synthesis table below.

---

## 0. How to read this report

Every audited item carries exactly one state:

| State | Meaning |
|---|---|
| **PASS** | Verified working, with evidence recorded in this audit. |
| **PARTIAL** | Works, but coverage is incomplete or bounded by a caveat. |
| **FAIL** | Reproducible defect. |
| **NOT TESTED** | Not exercised in this audit. |
| **HW REQUIRED** | Cannot be validated without physical hardware. |
| **BLOCKED** | Depends on another fix first. |
| **EXPERIMENTAL** | Deliberately not guaranteed by the project. |

Validation levels (a hardware feature is only *VALIDATED* at level 4–5):

| Level | Scope | Reached in this audit? |
|---|---|---|
| 0 | Code read and coherent | yes |
| 1 | Unit | yes |
| 2 | Integration | partially |
| 3 | E2E (full app simulated) | partially (live server, no browser) |
| 4 | Hardware-in-the-loop | **no** |
| 5 | Real orchestra, prolonged | **no** |

> **Scope honesty.** This audit reached **level 3 at best**. Everything touching real
> MIDI hardware, BLE radio, UART at 31 250 baud, audio latency, the Raspberry Pi
> platform, real browsers, touch devices and human users is **not validated here** and
> is labelled `HW REQUIRED` or `NOT TESTED` — not `PASS`. Sections K, L, M, N02, O, AC,
> AD, AE, AP, AQ, BJ, BL, BT, BU and BX are essentially untouched by necessity.

---

## 1. Executive summary

The engine is in **markedly better shape than a project of this size usually is**.
Static analysis is clean, the test suite is large and entirely green, the MIDI file
parser survived a fuzz campaign without a single non-`Error` failure, the frontend's
HTML-escaping discipline holds up under targeted review, and backup/restore actually
round-trips. Prior audits in `docs/audit/` have clearly been acted on — several
hardening comments in the code cite earlier findings by number.

The weaknesses are concentrated in four places:

1. **Input validation at the WebSocket boundary is the biggest real gap.** 184 of 270
   commands (68 %) have no payload schema, and the validator **fails open** for them.
2. **The health endpoint over-reports readiness.** Two capabilities report `ready` on a
   host where they demonstrably do not work. An operator cannot trust `/api/health`.
3. **Whole subsystems are untested.** Lighting (manager + all seven drivers) is at 0 %
   coverage; true backend statement coverage is 44.6 %, not the ~51 % a naive run
   suggests.
4. **Two runtime assets are fetched from third-party mirrors at install with no
   checksum**, one of which is executed as JavaScript in the browser — and if the fetch
   never happened, the SPA blocks on a CDN request that an offline Pi cannot complete.

Nothing found is a P0. Two findings are P1.

> **On the four late findings (F-14…F-17).** These surfaced while writing up, from
> checking the offline-first claim and the dependency/CI state. They are recorded with
> the same evidence standard as the rest.

### Headline numbers (all measured, not estimated)

| Metric | Value |
|---|---|
| ESLint | **0 errors**, 203 warnings (183 = `no-console`, nearly all in `scripts/`) |
| `tsc --noEmit` | **clean** |
| Backend tests | **150 suites / 1875 tests, all pass** (~7 s) |
| Frontend tests | **81 files / 1488 tests, all pass** (~32 s) |
| Backend coverage (all `src/**`) | **44.57 % stmt · 44.11 % branch · 38.82 % func · 45.47 % line** |
| Source files with zero coverage | **34 / 176** |
| WebSocket commands registered | **270** |
| …with a payload schema | **86 (31.9 %)** |
| HTTP routes | 15 (+2 mounts) |
| i18n | 2737 keys × 28 locales, **0 missing / 0 extra**, 70–89 % actually translated |
| Migrations | 34, verified idempotent; WAL on; foreign keys on |
| Dead modules | **1** (`MidiMessage.js`, 468 lines) |
| HTML sinks reviewed | 257 — **0 confirmed XSS** |

---

## 2. Findings

Severity: **P0** critical · **P1** high · **P2** medium · **P3** low.

| # | Sev | Section | Finding | State |
|---|---|---|---|---|
| F-03 | **P1** | U, AH | 184/270 WS commands have no schema; `validateByCommand` fails open | FAIL |
| F-13 | **P1** | AB, BF | Lighting manager + all 7 drivers at 0 % coverage (1 380 stmts untested) | FAIL |
| F-01 | P2 | BB | `usb` reports `ready` with no MIDI library present | FAIL |
| F-02 | P2 | BB | `ble` reports `ready` after BLE runtime init failed | FAIL |
| F-06 | P2 | V, AK | Rate-limit error frame carries no `id`; throttled command hangs 10 s | FAIL |
| F-07 | P2 | D05, AK | WS rate limiter has no panic exemption (the device limiter has one) | FAIL |
| F-08 | P2 | D01, BK | System Common (0xF1/F2/F3/F6) dropped on BLE/network path | **FIXED** |
| F-12 | P2 | AS | "28 languages" is structurally true but 11–30 % of strings are untranslated | PARTIAL |
| F-04 | P3 | BE, BP | 10 persistence suites silently skip; Jest still prints "Ran all test suites" | FAIL |
| F-05 | P3 | AI | `showConfirmModal` escapes `title` but treats `message` as raw HTML | PARTIAL |
| F-09 | P3 | A04 | `src/midi/messages/MidiMessage.js` is dead code (468 lines, 0 importers) | FAIL |
| F-10 | P3 | T | Unknown `/api/*` returns 200 + SPA HTML instead of 404 | FAIL |
| F-11 | P3 | AH | CSP disabled — *documented deliberate trade-off*, recorded as accepted risk | PARTIAL |
| F-14 | P2 | AG | Offline boot depends on install-time downloads; missing WAF player triggers a render-blocking CDN `document.write` | FAIL |
| F-15 | P2 | AH, BR | Install-time assets fetched from third-party mirrors with **no checksum**; the player is executed as JS | FAIL |
| F-16 | P2 | AH | 8 high npm advisories, incl. `ws` (direct runtime dep, uninitialized memory disclosure); CI gate is critical-only | FAIL |
| F-17 | P3 | BP | `npm run format:check` fails at HEAD on 13 untouched files — CI `lint` job is red on `main` | FAIL |

Full detail, evidence and reproduction for each: see the numbered reports and
`REMEDIATION_ROADMAP.md`.

### What was verified as genuinely good

These are **PASS with evidence**, not assumptions:

- **MIDI file parser robustness (E03).** 11 hand-built malformed files + 200 seeded
  single-byte mutations + 180 random-garbage buffers: every one either parsed to a
  structurally sane object or threw a real `Error`. No hang, no stack overflow, no
  non-`Error` throw. Suite: `tests/audit/midi-file-robustness.test.js`.
- **Channel-voice MIDI decoding (D01).** All 16 channels, note/velocity boundaries
  0 and 127, 14-bit pitch bend 0/8192/16383, velocity-0→Note Off normalisation, SysEx
  pass-through, and defensive handling of empty/null input all behave correctly.
  Suite: `tests/audit/midi-core-conformance.test.js`.
- **XSS discipline (AI).** 257 HTML sinks scanned; 27 flagged by heuristic; all 27
  manually inspected and cleared. The `t()` vs `tHtml()` rule from `CLAUDE.md` is
  actually followed.
- **WebSocket auth is fail-closed (AJ).** A tokenless non-browser client is refused
  with 401. The same-origin bypass keys on browser-set `Origin`/`Host`, which page JS
  cannot forge.
- **Prototype pollution (AH).** `{"__proto__":{...}}` in a command payload does not
  pollute `Object.prototype`.
- **Oversized frames (AK).** A 20 MB frame against a 16 MB cap closes the socket
  cleanly; the server stays healthy.
- **Backup/restore (Z).** Canary row survives backup → delete → restore;
  `PRAGMA integrity_check` returns `ok`; all 33 tables intact.
- **Migrations (Y).** 34 migrations, re-running the runner is idempotent
  (33 tables / 80 indexes stable). WAL enabled, foreign keys enforced.
- **Boot & graceful degradation (C01).** Clean boot with no MIDI library, no D-Bus and
  no serial: every optional transport is caught and the app still serves.
- **Command wiring integrity (U).** 0 orphan schemas, 0 phantom frontend calls, all 14
  schema files wired into the validator.

---

## 3. Synthesis table (audit plan A → BX)

| § | Area | State | Level | Notes |
|---|---|---|---|---|
| A01 | Architecture | PASS | 0–1 | Clear composition root, DI order documented and honoured. 1 dead module. |
| A02 | Static JS | PASS | 1 | 0 ESLint errors. |
| A03 | Type safety | PASS | 1 | `tsc --noEmit` clean. |
| A04 | Technical debt | PARTIAL | 0 | 36 files >1000 lines; only 5 TODOs in code. |
| A05 | Conventions | PASS | 0 | Consistent; channel 0–15 internally, 1–16 at UI edge. |
| B01 | Clean install on Pi | HW REQUIRED | — | No Pi available. |
| B02 | npm install / ci | PARTIAL | 1 | `--ignore-scripts` path works; `midi` needs ALSA headers. |
| B03 | Startup | PARTIAL | 3 | `npm start` verified; PM2/systemd/reboot NOT TESTED. |
| B04 | Docker | NOT TESTED | — | Dockerfile present, not built. |
| B05 | Configuration | PARTIAL | 1 | Layering verified by existing tests; not fuzzed. |
| C01 | Initialisation | PASS | 3 | Verified live, including degraded hosts. |
| C02 | Shutdown | PARTIAL | 1 | Single-path handler verified by code+tests; not signal-tested here. |
| C03 | Crash recovery | NOT TESTED | — | |
| D01 | MIDI messages | PASS | 1 | Was FAIL for System Common → **fixed**, test added. |
| D02 | Running status | PARTIAL | 0 | Serial parser correct by inspection; not byte-stream tested. |
| D03 | SysEx | PARTIAL | 1 | Pass-through + identity reply covered; GS/XG not exhaustively. |
| D04 | 16 channels | PASS | 1 | All 16 verified. |
| D05 | Panic | PARTIAL | 1 | Device layer exempts panic; **WS layer does not** (F-07). |
| E01 | SMF parsing | PASS | 1 | |
| E02 | Deliberate rejects | PASS | 0–1 | Format 2 and SMPTE rejected explicitly. |
| E03 | Invalid files | PASS | 1 | Fuzzed; see above. |
| E04 | Import/export | NOT TESTED | — | |
| E05 | Adapted MIDI | PARTIAL | 1 | Covered by existing suites, not re-derived here. |
| F01–F02 | Playback chronology / transport | PARTIAL | 1 | Strong existing suites; no real-time verification. |
| F03 | Real timing | HW REQUIRED | — | Needs a Pi. |
| F04 | Polyphonic load | NOT TESTED | — | |
| F05 | MIDI clock | HW REQUIRED | — | |
| G01–G03 | Routing / auto-routing / split | PARTIAL | 1 | 74.3 % coverage on `midi/routing`. |
| G04 | Hot-plug during playback | HW REQUIRED | — | |
| H01–H06 | Adaptation | PARTIAL | 1 | Best-covered area: 78.7 % on `midi/adaptation`. |
| I01–I08 | Instrument families | PARTIAL | 1 | Per-family suites exist; no per-family completeness matrix. |
| J01–J05 | Hands / feasibility | PARTIAL | 1 | Planner suites exist; `independent_fingers` remains EXPERIMENTAL. |
| K | USB MIDI | HW REQUIRED | — | |
| L | BLE MIDI | HW REQUIRED | — | Codec unit-tested; radio untested. |
| M | UART/GPIO | HW REQUIRED | — | Parser reviewed; 31 250 baud untested. |
| N01 | RTP-MIDI as-built | PARTIAL | 1 | |
| N02 | AppleMIDI conformance | EXPERIMENTAL | — | Correctly self-declared `degraded`. |
| O | Latency compensation | NOT TESTED | — | Needs audio hardware. |
| P01–P04 | Audio / preview | NOT TESTED | — | Browser audio. |
| Q01–Q05 | MIDI editors | PARTIAL | 1 | Large Vitest coverage; no browser E2E. |
| R | Loop manager | PARTIAL | 1 | |
| S | Virtual keyboards | NOT TESTED | — | Needs real touch devices. |
| T | HTTP API | PARTIAL | 3 | Probed live; F-10. |
| U | WS commands | **FAIL** | 3 | F-03. Inventory tool delivered. |
| V | WS real-time | PASS | 3 | Contract clean; F-06 on the throttle path. |
| W | Concurrency | NOT TESTED | — | |
| X01–X05 | SQLite persistence | PARTIAL | 2 | WAL + FK verified; concurrency untested. |
| Y | Migrations | PASS | 2 | Idempotency verified. |
| Z | Backups | PASS | 2 | Restore verified with a canary. |
| AA | FileManager / blobstore | PARTIAL | 1 | Path guards unit-tested; traversal probes blocked. |
| AB01–AB07 | Lighting | **FAIL** | 0 | 0 % coverage across manager + 7 drivers (F-13). |
| AC | MIDI↔light sync | HW REQUIRED | — | |
| AD | Raspberry Pi system | HW REQUIRED | — | |
| AE | WiFi hotspot | NOT TESTED | — | Command surface reviewed; `execFile` argv is safe. |
| AF | Update system | NOT TESTED | — | |
| AG | Offline-first | PARTIAL | 0 | No CDN/external asset references found in `public/`. |
| AH | Backend security | PARTIAL | 3 | Strong; F-03 is the gap. F-11 accepted. |
| AI | Frontend XSS | PASS | 1 | 0 confirmed. Scanner delivered. |
| AJ | Authorization | PASS | 3 | Fail-closed verified. |
| AK | Limits / DoS | PASS | 3 | 60 msg/s·conn, 32 MB/s, 16 MB frame cap — degrades cleanly. |
| AL | Frontend boot | HW REQUIRED | — | Needs a Pi + browser. |
| AM–AN | UI / UX | NOT TESTED | — | |
| AO–AQ | Responsive / touch / cross-browser | NOT TESTED | — | |
| AR | Accessibility | NOT TESTED | — | |
| AS | i18n | PARTIAL | 1 | Structure perfect; translation 70–89 % (F-12). |
| AT | CSS | NOT TESTED | — | |
| AU–AV | Frontend perf / memory | NOT TESTED | — | |
| AW | Backend perf | NOT TESTED | — | Bench harness exists (`npm run bench`). |
| AX | Soak | NOT TESTED | — | |
| AY | Stress | PARTIAL | 3 | WS burst ceiling measured. |
| AZ | Fault injection | PARTIAL | 3 | Degraded-host boot + oversized frame only. |
| BA | Observability | PARTIAL | 0 | Structured logger, levels, rotation present. |
| BB | Health / capabilities | **FAIL** | 3 | F-01, F-02 — both reproduced live. |
| BC–BD | Documentation ↔ code | PARTIAL | 1 | 69.3 % of commands appear in `docs/API.md`. |
| BE | Existing tests | PARTIAL | 1 | Good quality; F-04 silent-skip issue. |
| BF | Coverage | PARTIAL | 1 | 44.6 % true statement coverage. |
| BG | Missing unit tests | PARTIAL | 1 | Matrix in `TEST_MATRIX.md`. |
| BH | Integration | PARTIAL | 2 | |
| BI | Browser E2E | NOT TESTED | — | No Playwright suite exists. |
| BJ | Hardware-in-the-loop | HW REQUIRED | — | |
| BK | Protocol conformance | PARTIAL | 1 | MIDI 1.0 channel-voice + System Common now consistent. |
| BL | Real instrument matrix | HW REQUIRED | — | |
| BM | Musical quality | NOT TESTED | — | Needs listening. |
| BN | Determinism | NOT TESTED | — | |
| BO | Regression workflow | PASS | 1 | Applied once end-to-end for F-08. |
| BP | CI | PARTIAL | 0 | See `19_PERFORMANCE.md` / roadmap for the missing stages. |
| BQ–BT | Release / reproducibility / licences / HW regression | NOT TESTED | — | |
| BU–BV | User acceptance / zero-doc journey | NOT TESTED | — | Needs humans. |
| BW | Global coherence | PARTIAL | 3 | UI→WS→command→service→DB verified; transport→instrument not. |
| BX | Orchestra validation | HW REQUIRED | — | The real system test; not attempted. |

---

## 4. Reproducing this audit

Tooling added under `scripts/audit/` (all runnable offline, no hardware):

```bash
npm install --ignore-scripts
npm rebuild better-sqlite3 --build-from-source   # otherwise 10 suites silently skip

npm run lint && npm run typecheck
npm test && npm run test:frontend

node scripts/audit/command-inventory.mjs         # §U / §BD command matrix
node scripts/audit/xss-sinks.mjs                 # §AI HTML sink scan
node scripts/audit/dead-modules.mjs              # §A01 / §A04 orphan modules

# §T / §V / §AK / §AH / §AJ — needs a running server
GMBOOP_SERVER_PORT=8099 node server.js &
GMBOOP_API_TOKEN=$(grep '^GMBOOP_API_TOKEN=' .env | cut -d= -f2-) \
  node scripts/audit/live-probe.mjs http://127.0.0.1:8099
```

Audit test suites added: `tests/audit/midi-core-conformance.test.js`,
`tests/audit/midi-file-robustness.test.js`.

---

## 5. Specialised reports

| File | Covers |
|---|---|
| `01_ARCHITECTURE.md` | A01, A04, A05 |
| `02_CODE_QUALITY.md` | A02, A03, A04, BE, BF |
| `03_MIDI_CORE.md` | D01–D05, BK |
| `04_MIDI_FILES.md` | E01–E05 |
| `05_PLAYBACK_TIMING.md` | F01–F05 |
| `06_ROUTING.md` | G01–G04 |
| `07_ADAPTATION.md` | H01–H06, J01–J05 |
| `08_INSTRUMENT_FAMILIES.md` | I01–I08 |
| `09_PERSISTENCE.md` | X, Y, Z, AA |
| `10_API_WEBSOCKET.md` | T, U, V, AK |
| `11_FRONTEND.md` | AI, AL, AM, AT, AU, AV |
| `12_MIDI_EDITORS.md` | Q, R, S |
| `13_TRANSPORTS.md` | K, L, M, N |
| `14_AUDIO.md` | O, P |
| `15_LIGHTING.md` | AB, AC |
| `16_SYSTEM_PI.md` | AD, AE, AF, AG, B |
| `17_SECURITY.md` | AH, AJ |
| `18_UX_ACCESSIBILITY_I18N.md` | AN, AO, AP, AQ, AR, AS, BU, BV |
| `19_PERFORMANCE.md` | AW, AX, AY, BP |
| `20_RESILIENCE_SOAK.md` | C02, C03, AZ, BA, BB, W |
| `21_E2E.md` | BH, BI, BW |
| `22_HARDWARE_VALIDATION.md` | BJ, BL, BM, BN, BT, BX |
| `TEST_MATRIX.md` | Module × critical function × test × gap |
| `REMEDIATION_ROADMAP.md` | Prioritised fixes |
