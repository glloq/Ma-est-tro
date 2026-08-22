# 08 — Instrument families (plan §I01–I08)

**State: PARTIAL — coverage is uneven and unmeasured per family** · Level 1

---

## What exists

The project supports **15 distinct instrument layouts**, each with its own frontend
view:

```
public/js/features/keyboard/views/
  PianoView  PianoSliderView  FretboardView  DrumPadView  PercussionPadView
  HarpView   AccordionView    HarmonicaView  KalimbaView  MalletView
  SteelDrumView  BagpipeView  MusicBoxView   ThereminView  ListView
```

Backend capability modelling lives in `src/midi/instrument/`
(`CapabilityResolver`, `DescriptorProtocol`, `DescriptorService` — **87.8 % coverage**,
the best-covered backend module) plus `InstrumentCapabilitiesValidator`,
`InstrumentTypeConfig` and the per-family persistence tables
(`StringInstrumentDatabase`, `harmonica_config`, `instrument_specific_configs`).

## The finding: no per-family test suites

The plan is explicit — *"Chaque famille doit posséder sa propre suite."*
**That does not exist.** Family-relevant backend tests are:

| Test | Families touched |
|---|---|
| `tablature-converter.test.js` | guitar / bass / bowed strings |
| `string-instrument-scale-length.test.js` | strings |
| `descriptor-strings.test.js` | strings |
| `harmonica-config-db.test.js` | harmonica |
| `sf2-converter-drum-tuning.test.js`, `sf2-preset-service-drum-fallback.test.js` | percussion |
| `instrument-scale-root-db.test.js` | scale-based (kalimba, steel drum, mallets) |

So **strings, harmonica and percussion have real coverage; the rest do not.** There is
no backend suite specific to piano/keyboard, harp, accordion, wind/brass, mallets,
kalimba, steel drum, bagpipe, music box or theremin. Their constraints are expressed
through the generic capability model, which is well tested in the abstract — but no test
asserts, for example, that a harp's available-strings mapping rejects a note that no
string can produce, or that a wind instrument is held monophonic.

## Per-family verdicts

| § | Family | Backend tests | State |
|---|---|---|---|
| I01 | Piano / keyboard | generic only | PARTIAL |
| I02 | Guitar / ukulele / bass | `tablature-converter`, `string-instrument-scale-length`, `descriptor-strings` | PARTIAL — best covered family |
| I03 | Bowed strings | shared string suites; bow-direction migration (`021_string_bow_direction.sql`) | PARTIAL |
| I04 | Harp | none | NOT TESTED |
| I05 | Percussion | drum bank / tuning / fallback suites | PARTIAL |
| I06 | Accordion | none | NOT TESTED |
| I07 | Wind / brass | none — **monophony not asserted anywhere** | NOT TESTED |
| I08 | Mallets / kalimba / steel drum / harmonica | harmonica + scale-root only | PARTIAL |

Frontend views are exercised by the Vitest suite (81 files / 1 488 tests), which
includes hand-position, fretboard and harmonica rendering tests — but rendering a
layout is not the same as validating that family's *musical constraints*.

## Why I07 (wind) is the one to fix first

A wind instrument that is not held monophonic will receive overlapping Note Ons. On a
mechanical instrument that is not a wrong note — it is a valve or solenoid receiving
contradictory commands. The polyphony-reduction machinery exists (`VoiceSelector`,
covered), but nothing asserts that the *wind family specifically* is wired to it. That
is a cheap test with a physical consequence if wrong.

## Structural note

`INSTRUMENT_FAMILY_REFACTOR_ROADMAP.md` (19 kB, at repo root) indicates a family
refactor is already planned. Per-family suites should be written **as part of** that
refactor rather than against the current shape, or they will need rewriting — but the
constraint assertions themselves (monophony, available notes, physical reachability) are
refactor-independent and can be written now.

---

## Recommendations

| Pri | Action |
|---|---|
| P2 | One suite per family asserting that family's *constraints* — available notes, polyphony ceiling, physical reachability — not its rendering. |
| P2 | Start with wind (I07): assert monophony enforcement end-to-end. |
| P2 | Harp (I04) and accordion (I06): assert note→string / note→button mapping rejects unreachable notes. |
| P3 | Add a family × capability coverage matrix to CI so a new family cannot ship untested. |
| P3 | Fold this into `INSTRUMENT_FAMILY_REFACTOR_ROADMAP.md` so the refactor lands with tests. |
