# 12 — MIDI editors, loops, virtual keyboards (plan §Q, R, S)

**State: PARTIAL (unit) / NOT TESTED (interaction)** · Level 1

---

## Q — MIDI editor

The editor is a large multi-view modal under `public/js/features/midi-editor/`,
documented in `docs/MIDI_EDITOR.md`, with dedicated renderers
(`CanvasPianoRollRenderer.js` — 2 027 lines, `DrumGridRenderer.js` — 1 098,
`WindMelodyRenderer.js` — 980, `TablatureEditor.js` — 1 231).

The frontend Vitest suite (81 files / 1 488 tests) covers a substantial part of the
editor's *logic*. What it cannot cover is *interaction* — drag, resize, marquee select,
pinch-zoom, pan — because those are pointer-event sequences against a canvas, and there
is no browser harness (§BI).

| § | View | State | Notes |
|---|---|---|---|
| Q01 | Piano roll | PARTIAL | add / delete / velocity / channel / snap logic unit-tested; **move, resize, multi-select, zoom, pan, copy/paste, undo/redo not verified** |
| Q02 | Tablature | PARTIAL | `tablature-converter.test.js` covers MIDI↔tab and string/fret; impossible positions covered by the feasibility validators |
| Q03 | Drum editor | PARTIAL | grid/quantize/velocity logic present; GM mapping tested via drum-bank suites |
| Q04 | Wind editor | PARTIAL | renderer present; articulation and breath/CC handling not asserted |
| Q05 | Cross-editor coherence | **NOT TESTED** | |

### Q05 is the one that matters

The plan's requirement — *"Modifier dans une vue puis passer dans une autre. La même
séquence MIDI doit rester la source de vérité"* — is the editor's central invariant.
Four views render and mutate one underlying sequence; if any view writes back a
lossy projection of its own representation (e.g. the tablature view collapsing an
overlapping note, the drum grid quantising on read), edits silently corrupt the source.

Nothing tests this today, and it is **testable without a browser**: build a sequence,
apply an edit through each view's model layer, round-trip through the others, and assert
the underlying event list is unchanged except for the intended edit. This is the highest
-value missing frontend test.

Recent commit history (`fix(midi-editor): keep program-change state consistent`,
`handle multi-program channels (detect, preserve, split)`) shows exactly this class of
bug occurring in practice — which is an argument for the invariant test, not against it.

---

## R — Loop manager — PARTIAL

Four sub-features: Library, Pad, Live, Arranger
(`LoopEditorModal.js` 1 940 lines, `LoopManagerArrangerView.js`,
`LoopManagerLiveFeature.js`, `LoopCreatorModalEvents.js`), backed by four tables
(`loops`, `loop_arrangements`, `loop_arrangement_tracks`, `loop_arrangement_blocks`)
and 16 commands (`LoopCommands` 5, `LoopArrangementCommands` 11).

Positive signal: loop commands are **the best-schema'd group in the whole API** — 4/5
and 10/11 have payload schemas, against a 31.9 % project average. Someone applied the
schema discipline properly here.

| Concern | State |
|---|---|
| Create / duplicate / delete | PARTIAL — commands + schemas exist |
| Trigger | NOT TESTED |
| Tempo / sync / transitions | NOT TESTED |
| Multi-track arrangements | PARTIAL |
| Save / reload round-trip | NOT TESTED |
| Library / Pad / Live / Arranger as separate suites | NOT TESTED |

`docs/audit/AUDIT_LOOP_ARRANGER_SPLIT.md` exists from a prior audit and should be
reconciled with this one.

---

## S — Virtual keyboards — NOT TESTED

15 layouts (`public/js/features/keyboard/views/`): Piano, PianoSlider, Fretboard,
DrumPad, PercussionPad, Harp, Accordion, Harmonica, Kalimba, Mallet, SteelDrum,
Bagpipe, MusicBox, Theremin, List.

Mouse, touch and **multitouch** behaviour cannot be assessed without real devices —
multitouch in particular (a chord on a piano layout, a drum roll on pads) is exactly
what a jsdom test cannot simulate faithfully.

### The finding that *is* verifiable

`KeyboardEvents.js:497,524` sends **one WebSocket command per note event**
(`sendNoteOn` / `sendNoteOff` → `midi_send_note`). That traffic shares the 60 msg/s
per-connection rate limit with all other UI activity (see F-07, `03_MIDI_CORE.md`).

30 note-on/off pairs per second saturates it. A two-handed chord tremolo, a glissando
across a fretboard, or a fast drum-pad roll will exceed it — and an over-budget frame is
dropped **before dispatch**, so a dropped note-off leaves a note sounding.

This is a design-level interaction between §S and §AK that no single-section test would
have found. It needs either client-side batching (one frame per chord) or a
priority lane for note-offs.

---

## Recommendations

| Pri | Action |
|---|---|
| P2 | Q05 invariant test: edit through each view's model, round-trip, assert the shared sequence is the single source of truth. No browser required. |
| P2 | Batch virtual-keyboard note traffic into one frame per chord (also fixes part of F-07). |
| P2 | Loop save/reload round-trip test for all four sub-features. |
| P3 | Add a browser harness (§BI) and cover piano-roll drag / resize / marquee / zoom / undo-redo. |
| HW | Multitouch on real phone and tablet — the plan's §AP. |
