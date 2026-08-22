# 06 — MIDI routing (plan §G01–G04)

**State: PARTIAL** · Level 1
`src/midi/routing` — 966 statements, **74.3 % coverage** (second-best backend module).

---

## G01 — Manual routing — PARTIAL

`MidiRouter` (877 lines) owns `input → channel → instrument → output`. Routes are
persisted (`routes` table, loaded at boot: *"Loaded 0/0 routes from database"* in the
verified boot log) and manipulated through 21 `route_*` / `filter_*` / `channel_map` /
`monitor_*` commands.

Covered by existing suites: capability clamping
(`midi-router-capability-clamp`), note-gate reset (`midi-router-notegate-reset`),
transport input routing (`transport-input-routing`), routing persistence and
feasibility (`routing-persistence-feasibility`, `validate-routing-feasibility`),
integration (`repositories/routing-integration`).

**Not done:** the plan asks for *"toutes les combinaisons"* of input × channel ×
instrument × output. There is no combinatorial or property-based test. Given 16
channels × N devices × filter/map options, an exhaustive matrix is infeasible, but a
property-based test (random route sets, assert every note reaches exactly one
destination and every Note On has a matching Note Off) is very feasible and would be
worth more than more example tests.

**Validation gap.** 13 of the 21 routing commands have no payload schema (see F-03).
`route_create` validates only that `source` and `destination` are truthy — the schema
does not constrain their *shape*, so a malformed destination reaches `MidiRouter`.

## G02 — Auto-routing — PARTIAL

Driven by `InstrumentMatcher` (1 584 lines) and `ChannelAnalyzer` (768 lines), with
role classification (melody / bass / harmony / drums) and polyphonic vs monophonic
handling. `docs/AUTO_ASSIGNMENT.md` documents the scoring.

Covered: `instrument-matcher-hand-feasibility`, `scoring-edge-cases-t6`,
`hand-assigner`, `hand-assigner-n-hands`, `voice-selector`, plus the adaptation audit
regression suites.

**Not done — the plan's §H05 request specifically:** *"Créer une base de fichiers de
référence dont le meilleur instrument attendu est connu. Vérifier automatiquement le
scoring."* There is no such reference corpus. Today's tests assert scoring *properties*
and edge cases; none asserts "for this file and this instrument set, the winner is X".
That is the difference between "the scorer does not crash" and "the scorer is right",
and only the second answers the question the plan asks.

Untested branches called out by the plan: instrument unavailable, several equally good
candidates (tie-breaking), no candidate at all.

## G03 — Channel split — PARTIAL

Sharing one channel across several instruments is implemented, with note-ownership
tracking so a Note Off is delivered to whichever instrument received the Note On.
`MidiRouter` explicitly clears ownership bookkeeping on panic, with a comment noting
that failing to do so *"leaves a phantom voice that permanently gates a channel"* —
evidence the ownership model was reasoned about, not assumed.

`tests/playback-scheduler-split-disconnect.test.js` covers a split instrument
disconnecting mid-stream.

**Not verified here:** no duplication and no lost notes under a split, as distinct
assertions across a full file. This is the natural target for the property-based test
suggested under G01: for any route configuration, `count(NoteOn) == count(NoteOff)` per
(device, channel, note) and no note is delivered twice.

## G04 — Hot-plug during playback — HW REQUIRED

Hot-plug monitoring runs every 5 000 ms (confirmed in the boot log: *"Starting hot-plug
monitoring (check every 5000ms)"*). `DeviceManager` carries dedicated logic for identity
(`devicemanager-auto-identity`), change notification, descriptor fetch/revision and
state pruning, each with a test.

Physically unplugging a device mid-playback and observing detection, re-route and — the
part that matters — **no stuck notes**, requires hardware. `src/midi/devices` is at
**34 % coverage**, the lowest of the MIDI modules, and it is also the one whose failure
modes are most physical.

A hardware-free improvement is possible: `DeviceManager` accepts an injectable device
enumerator (that is how the easymidi absence is handled), so the add/remove/rename state
machine can be driven by a fake enumerator in a unit test without any device. That would
lift the riskiest untested logic without a Pi.

---

## Recommendations

| Pri | Action |
|---|---|
| P2 | Property-based routing test: random route sets → assert exactly-once delivery and Note On/Off balance per (device, channel, note). Covers G01 and G03 far better than more examples. |
| P2 | Reference corpus for auto-assignment scoring (§H05): known files + known expected winner. |
| P2 | Drive the `DeviceManager` hot-plug state machine from a fake enumerator (no hardware needed). |
| P2 | Add payload schemas for the 13 unschema'd routing commands, constraining `source`/`destination` shape. |
| HW | G04 proper: unplug/replug under load on a Pi, assert no stuck notes. |
