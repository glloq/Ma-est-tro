# 04 — MIDI files (plan §E01–E05)

**State: PASS (parsing/robustness) / PARTIAL (round-trip)** · Level 1
**Suite added:** `tests/audit/midi-file-robustness.test.js` (14 tests)

---

## E01 — Parsing — PASS

Parsing is delegated to the `midi-file` package and wrapped by
`MidiFileParser.parse()`, which re-throws as `Invalid MIDI file: <reason>`.
`MidiFileParser` then extracts metadata (tempo, duration, PPQ), a per-channel summary
via `ChannelAnalyzer`, aggregate instrument metadata (`has_drums`, `has_melody`,
`has_bass`), text events and a tempo map.

| Item | State | Evidence |
|---|---|---|
| SMF format 0 | PASS | verified: header format/numTracks/ticksPerBeat parsed correctly |
| SMF format 1, multiple tracks | PARTIAL | exercised by existing suites, not re-derived here |
| Single tempo | PASS | `extractMetadata` |
| Variable tempo | PARTIAL | `extractTempoMap()` + `tests/midi-baker-tempo-map.test.js` |
| Time-signature changes | NOT TESTED | |
| Meta events | PARTIAL | `extractTextEvents()` + `tests/midi-file-text-events` path |
| SysEx in file | PARTIAL | preserved through the bake path |
| Empty tracks | PASS | tolerated (verified via the minimal 1-track fixture) |
| Very large files | NOT TESTED | no multi-MB fixture exercised |

## E02 — Deliberate rejections — PASS

Both documented rejections are real, explicit and correctly placed:

**Format 2** — `MidiPlayer.loadFile()` refuses with a clear message:
> *"is SMF format 2 (independent sequences), which is not supported for playback"*

**SMPTE timing** — also refused at load. The implementation comment records a genuine
past bug worth noting, because it shows the check is deliberate rather than incidental:

> *"The `midi-file` parser encodes SMPTE division as `framesPerSecond` + `ticksPerFrame`
> [rather than a negative division], so the previous `ticksPerBeat < 0` guard never
> fired and SMPTE files were [played with the wrong chronology]."*

The current guard tests the parser's actual representation. `MidiFileParser` separately
notes that for **metadata only** it falls back to a heuristic PPQ 480 for SMPTE files,
while playback still rejects them — a defensible split (you can list the file, you
cannot play it wrong).

This matches the README's promise exactly: format 0 and 1 with PPQ timing supported;
format 2 and SMPTE *"explicitly rejected rather than played with an incorrect
chronology."* Documentation and behaviour agree.

## E03 — Invalid files — PASS

This was tested aggressively, because a MIDI file is untrusted input arriving over an
upload endpoint.

**Contract asserted:** for *any* byte sequence, `parse()` must either return a
structurally sane object (`{header, tracks[]}`) or throw a real `Error` with a non-empty
message. It must never hang, never blow the stack, and never throw a non-`Error` —
that last one matters because `CommandRegistry` maps non-`ApplicationError` throws to a
generic "Internal server error", so a thrown string would reach the client with no
diagnostics at all.

### Hand-built malformed inputs — 11/11 pass

| Case | Result |
|---|---|
| empty buffer | clean `Error` |
| single zero byte | clean `Error` |
| truncated `MThd` magic | clean `Error` |
| header declares length 6 but is cut short | clean `Error` |
| bogus chunk type where `MThd` expected | clean `Error` |
| valid header, truncated track chunk | clean `Error` |
| `MTrk` length far longer than the data present | clean `Error` |
| `numTracks` claims 500, one present | clean `Error` |
| unterminated running-status data | clean `Error` |
| 64 bytes of `0xFF` | clean `Error` |
| plain UTF-8 text | clean `Error` |

### Deterministic fuzz — pass

Seeded `mulberry32` PRNG (no `Math.random()`, so any failure is reproducible from the
seed):

- **200 single-byte mutations** of a valid SMF → 0 failures.
- **180 random buffers** across lengths 1, 2, 7, 13, 14, 22, 64, 257, 1024 → 0 failures.

No hangs, no non-`Error` throws, no malformed success objects. **The parser is robust.**

> Caveat: this fuzzes `MidiFileParser.parse()`, i.e. header/chunk handling. It does not
> fuzz the downstream consumers (`extractMetadata`, `ChannelAnalyzer`, the baker) with
> *structurally valid but semantically hostile* files — e.g. 10 000 tracks, a tempo of
> 0, 200 000 note-ons on one channel, deeply nested meta events. That is the next
> layer and is **NOT TESTED**; see the recommendation below.

## E04 — Import / export round-trip — NOT TESTED

The plan asks for:
`original → import → modify → save → reload → export → re-import`, with no unintended
loss.

Not exercised in this audit. The pieces exist (`file_read`, `file_write`,
`file_duplicate`, `MidiBaker`, blob storage) and `tests/midi-baker-merge.test.js` /
`tests/filemanager-adapted-persist.test.js` cover fragments, but **no test walks the
full loop and diffs the result against the source**.

This is a high-value, hardware-free test: parse → serialise → parse again and assert
event-level equality (modulo intentional normalisations, which should be enumerated
explicitly rather than tolerated implicitly).

## E05 — Adapted MIDI — PARTIAL

`source → analyse → assignment → adaptation → bake → save → reload` is covered
piecewise by a substantial set of existing suites — `apply-assignments-bake-adapted-hand-cc`,
`apply-assignments-no-double-transpose`, `midi-baker-merge`, `midi-baker-tempo-map`,
`filemanager-adapted-persist`, `playback-fidelity` — and `src/midi/adaptation` is the
best-covered backend module at **78.7 %**.

What is missing is the plan's actual request: a **golden-file comparison** against a
known-expected result. Today's tests assert properties (no double transpose, CC injected
once); none pins the complete adapted output byte-for-byte. Without that, a subtle
change in adaptation ordering can pass every test while changing the music.

See also §BN (determinism) — untested.

---

## Recommendations

| Pri | Action |
|---|---|
| P2 | Add the E04 round-trip test (parse → write → parse, event-level diff), enumerating every intentional normalisation. |
| P2 | Golden-file corpus for E05/BN: a handful of source MIDI files + fixed instrument set + expected adapted output, compared byte-for-byte. Also gives determinism coverage for free. |
| P3 | Extend fuzzing past the header into the semantic consumers (0 tempo, 10 000 tracks, huge note counts, absurd delta-times). |
| P3 | Add an explicit oversized-file test at the upload boundary (§AK). |
