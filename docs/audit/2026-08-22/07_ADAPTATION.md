# 07 — Musical adaptation & mechanical feasibility (plan §H01–H06, J01–J05)

**State: PARTIAL — the best-covered subsystem** · Level 1
`src/midi/adaptation` — 3 559 statements, **78.7 % coverage** (highest in the backend).

---

## Overall assessment

This is where the project's engineering attention has clearly gone, and it shows. The
adaptation layer is the largest backend module, the best covered, and carries the most
regression tests naming specific historical defects. For a system whose entire value
proposition is *"adapt any MIDI file to what each instrument can physically play"*,
having the adaptation engine as the best-tested component is the right allocation.

The gap is not in coverage of *code paths* — it is that almost every test asserts a
**property** (no double transpose, collisions resolved, CC injected once) and almost
none asserts a **result** (given this input and this instrument, the output is exactly
this). That distinction is the whole of §BM (musical quality) and §BN (determinism),
and it is why this section is PARTIAL rather than PASS.

---

## H01 — Range adaptation — PARTIAL

Implemented in `MidiTransposer` (1 017 lines) and `PlaybackScheduler` range folding.
Covered: `playback-scheduler-range-fold`, `midi-router-capability-clamp`,
`note-enforcement`.

| Plan case | State |
|---|---|
| Note too low / too high | covered |
| Several octaves out of range | PARTIAL |
| Very narrow range | PARTIAL |
| Single-note instruments | NOT TESTED |

## H02 — Transposition — PARTIAL

`MidiTransposer.transposeChannels()` (306 lines) plus `ScaleSnapper`.
Covered: `midi-transposer-compression-collisions`,
`midi-transposer-suggest-feasibility`, `playback-scheduler-channel-transposition`,
`playback-scheduler-scale-snap`, `scale-snapper`,
`apply-assignments-no-double-transpose`.

Musical-structure preservation, pitch classes, collisions and the 0–127 clamp are all
addressed in code and touched by tests. **Whether the result is musically good is not
assessed** — see §BM.

## H03 — Polyphony reduction — PARTIAL

`VoiceSelector` + `tests/voice-selector.test.js`. Mono, 2-voice and 4-voice cases are
represented; dense chords, rapid repetitions and voice-priority rules are only partly
covered. No test pins which voice survives a reduction for a given chord — again a
property/result gap.

## H04 — Percussion — PARTIAL

`DrumNoteMapper` (1 050 lines), GM mapping, channel 10, SoundFont drum banks.
Covered: `sf2-converter-drum-tuning`, `sf2-preset-service-drum-fallback`,
`verify-drum-banks.js`, `descriptor-*` suites.
Substitution behaviour for absent notes and per-kit differences are represented but not
exhaustively enumerated against the GM percussion map.

## H05 — Instrument matcher — **NOT TESTED as specified**

The plan is explicit: *"Créer une base de fichiers de référence dont le meilleur
instrument attendu est connu. Vérifier automatiquement le scoring."*

**No such reference corpus exists.** `InstrumentMatcher.calculateCompatibility()` is 257
lines of scoring logic exercised by edge-case tests (`scoring-edge-cases-t6`,
`instrument-matcher-hand-feasibility`) but never by a "this file should pick that
instrument" fixture. This is the single most valuable missing test in the adaptation
area: it is hardware-free, it directly measures the product's core promise, and it would
catch scoring regressions that every current test would pass.

## H06 — AutoAssigner — PARTIAL

Covered: `hand-assigner`, `hand-assigner-n-hands`,
`playback-assignment-hand-warnings`, `routing-save-hand-overrides`.
Untested branches from the plan: instruments insufficient, identical instruments,
overlapping ranges, drum/non-drum mixing, offline instruments.

---

## J01–J05 — Hands, fingers, mechanical feasibility

| § | Component | State | Tests |
|---|---|---|---|
| J01 | `HandPositionPlanner.plan()` (294 lines) | PARTIAL | `hand-position-planner` |
| J02 | `LongitudinalPlanner.plan()` (241 lines) | PARTIAL | `longitudinal-planner` |
| J03 | Physical constraints | PARTIAL | `instrument-capabilities-validator-hands`, `-n-hands`, `validate-routing-feasibility`, `routing-persistence-feasibility` |
| J04 | Position CC generation / bake / playback / export | PARTIAL | `midi-player-hand-injection`, `midi-player-hand-cc-double-inject`, `apply-assignments-bake-adapted-hand-cc`, `playback-scheduler-hand-cc-exempt`, `playback-scheduler-hand-shift` |
| J05 | `independent_fingers` | **EXPERIMENTAL** | — |

`InstrumentCapabilitiesValidator` (987 lines) contains two ~290-line validators
(`_validateSemitonesHandsConfig`, `_validateFretsHandsConfig`) — the densest logic in
the codebase. Both are covered by dedicated suites.

J04 is notably well-handled: there is a specific test for CC *double* injection, which
is exactly the bug this design invites (inject at bake time and again at playback).

### J05 — `independent_fingers`

The plan says: *"Ne pas considérer `independent_fingers` comme validé tant que son
implémentation reste incomplète."*

Confirmed — it is treated as incomplete in the codebase and has no dedicated test.
**State: EXPERIMENTAL.** It must not be advertised as a supported capability, and no
release checklist should mark it validated.

---

## The systemic gap: property tests without golden results

Concretely, today's adaptation suite would pass unchanged if someone altered the
transposition tie-breaking rule, the voice-priority order, or the drum substitution
table — as long as the invariants still held. The music would change; the tests would
not notice.

**What closes it** (hardware-free, high value):

1. A `tests/fixtures/golden/` corpus: 8–12 source MIDI files spanning the instrument
   families, a fixed instrument set, and the expected adapted output committed
   alongside.
2. A runner that executes `analyse → assign → adapt → bake` and diffs against the
   golden file.
3. Regenerating goldens becomes a deliberate, reviewable act — a diff in a PR shows
   exactly which notes moved.

This one corpus simultaneously satisfies §H05 (matcher scoring), §E05 (adapted MIDI),
§BN (determinism) and gives §BM (musical quality) something concrete to listen to.

---

## Recommendations

| Pri | Action |
|---|---|
| P1 | Golden-file corpus + runner (covers H05, E05, BN, and anchors BM). |
| P2 | Enumerate the untested H06 branches: insufficient / identical / overlapping / offline instruments. |
| P2 | Single-note and very-narrow-range instrument cases for H01. |
| P3 | Assert the GM percussion substitution table explicitly (H04). |
| — | Keep `independent_fingers` marked EXPERIMENTAL until implemented and tested. |
