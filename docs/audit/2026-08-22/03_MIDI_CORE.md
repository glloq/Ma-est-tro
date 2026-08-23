# 03 — MIDI core (plan §D01–D05, BK)

**State: PASS after one fix** · Level 1
**Suite added:** `tests/audit/midi-core-conformance.test.js` (13 tests)

---

## Where MIDI actually gets parsed

Before testing, the real topology had to be established, because it is not where it
appears to be:

| Path | Parser | Notes |
|---|---|---|
| USB (easymidi) | easymidi emits pre-parsed events | → `DeviceManager.handleMidiMessage()` |
| **BLE + Network** | **`DeviceManager.handleRawMidi()`** | raw bytes → typed event |
| **Serial / UART** | **`SerialMidiManager`** byte-stream parser | owns running-status reassembly |
| — | ~~`src/midi/messages/MidiMessage.js`~~ | **dead code, 0 importers** (see `01_ARCHITECTURE.md`) |

All paths converge on `DeviceManager.handleMidiMessage()`, which is the correct single
funnel — velocity-0 normalisation and SysEx identity parsing happen once, there.

---

## D01 — MIDI messages — PASS (was FAIL)

### Verified correct

Every assertion below is executed by the added suite, not inferred:

| Message | Result |
|---|---|
| Note On, **all 16 channels** | correct channel/note/velocity |
| Note On velocity 0 | **normalised to Note Off** ✔ (MIDI 1.0 §running status) |
| Note Off with release velocity | preserved |
| Note numbers 0 and 127 | intact at both boundaries |
| Control Change | correct controller/value |
| Program Change | correct |
| Poly Key Pressure | correct note/pressure |
| Channel Pressure | correct |
| **Pitch Bend** | full 14-bit range: `0x00 0x00`→0, `0x00 0x40`→8192, `0x7F 0x7F`→**16383** ✔ |
| Clock / Start / Continue / Stop / Active Sensing / Reset | all surfaced |
| SysEx `F0 7E 7F 09 01 F7` (GM reset) | forwarded whole, unmodified |
| `[]`, `null`, `undefined` input | ignored without throwing |

The velocity-0 rule is handled defensively **twice** — once in `handleRawMidi` and again
in `handleMidiMessage` — with a comment explaining that easymidi delivers `noteon`
velocity 0 verbatim, so normalising only in the raw path would leave USB notes hanging.
That is exactly the right instinct, and it is the kind of detail that prevents stuck
notes.

### F-08 — System Common was silently dropped — FIXED (was P2)

**Found:** `DeviceManager.handleRawMidi()` mapped only System *Real-Time*
(`0xF8/FA/FB/FC/FE/FF`). Every System *Common* message fell through the `switch` into a
`default` that matched nothing and returned silently:

| Byte | Message | Serial path | BLE/network path (before) |
|---|---|---|---|
| `0xF1` | MTC quarter frame | `mtc` | **dropped** |
| `0xF2` | **Song Position Pointer** | `position` | **dropped** |
| `0xF3` | Song Select | `select` | **dropped** |
| `0xF6` | Tune Request | `tune` | **dropped** |

`SerialMidiManager._emitSystemCommon()` already handled all four. The same wire bytes
therefore produced **different behaviour depending on which cable they arrived on** — a
BLE controller sending Song Position Pointer to locate the transport was ignored, while
the identical device over DIN worked.

**Reproduced** with a failing test before any change (4 red assertions), then fixed by
mirroring the serial parser's exact type names and `{bytes}` payload shape, so both
transports now emit identical events. Test now green; full suite re-run: 150 suites /
1875 tests pass.

```
src/midi/devices/DeviceManager.js — handleRawMidi() default branch
  + 0xf1 → 'mtc'     + 0xf2 → 'position'
  + 0xf3 → 'select'  + 0xf6 → 'tune'      payload { bytes: bytes.slice(1) }
```

### Not covered

`0xF4`/`0xF5` (undefined) and `0xF9`/`0xFD` (undefined real-time) are correctly ignored
by both parsers. `0xF7` as a standalone byte outside a SysEx frame is handled by the
serial parser but is not reachable through `handleRawMidi`, which receives
already-framed messages.

---

## D02 — Running status — PARTIAL (level 0)

Running status is owned by `SerialMidiManager`'s byte-stream parser, and by inspection
it is **correct on every point the plan lists**:

| Requirement | Implementation |
|---|---|
| Valid sequences | `0x80–0xEF` sets `state.runningStatus`; subsequent data bytes re-synthesise the frame |
| Status change | new status byte replaces the latch |
| Real-time bytes interleaved | `byte >= 0xf8` handled **before** buffering — does not disturb the latch ✔ |
| SysEx cancels running status | `state.runningStatus = 0` on `0xF0` ✔ |
| System Common cancels running status | `0xF1–0xF6` → `runningStatus = 0` ✔ (MIDI 1.0 requires this) |
| Incomplete messages | held in `state.buffer` until complete |

Correctly cancelling running status on System Common is a detail many implementations
get wrong; this one does not.

**Why only PARTIAL:** this is code review, not execution. The parser is pure JavaScript
and needs no hardware, yet there is **no byte-stream test** that feeds it a crafted
sequence (running-status run → interleaved `0xF8` → truncated message → resync). That
is the single highest-value hardware-free test still missing in the MIDI layer, and it
is listed in `TEST_MATRIX.md`.

---

## D03 — SysEx — PARTIAL

- Pass-through of complete frames: verified (`F0 7E 7F 09 01 F7`).
- Identity Reply parsing: covered by `tests/sysex-identity-mapping.test.js` and
  `docs/SYSEX_IDENTITY.md`.
- Partial-frame flushing on serial: covered by
  `tests/serial-sysex-partial-flush.test.js`.
- GM / GM2 / GS / XG resets and Master Volume are documented as supported in the README
  and appear in the playback path, but **no test asserts the exact byte sequences**.
- Device Inquiry, unknown-manufacturer SysEx and very long / fragmented messages:
  **NOT TESTED**.

---

## D04 — 16 channels — PASS

All 16 channels verified individually for Note On decoding. Channel is derived as
`status & 0x0f` uniformly, and the 0–15 internal convention holds throughout the
backend (§A05). Channel 10 percussion handling, multi-instrument-per-channel and
multi-channel-per-instrument are routing concerns — see `06_ROUTING.md`.

---

## D05 — Panic — PARTIAL, with one real gap

### The device layer is right — PASS

`DeviceManager` runs a per-device rate limiter, and **priority messages bypass it**
specifically so a panic burst cannot be partially dropped:

> *"Priority messages bypass the rate limiter so a silencing/panic burst is [never
> truncated] … Controllers 121, All Notes Off 123, Omni/Mono/Poly … panic and [reset]
> must not have the limiter drop part of a panic burst (audit P2)."*
> — `DeviceManager.js:991–997`

`MidiPlayer` sends All Notes Off (CC 123) on every channel of every routed device,
including channels absent from `channelRouting` via an omni fallback. `MidiRouter`
clears note-ownership bookkeeping on panic, with a comment noting that failing to do so
"leaves a phantom voice that permanently gates a channel". Both show the failure mode
was understood and handled.

### F-07 — the WebSocket layer has no such exemption — FAIL (P2)

`WebSocketServer` applies its own, separate limiter — **60 messages per 1000 ms per
connection** (`RATE_LIMIT_MAX_MESSAGES = 60`, `RATE_LIMIT_WINDOW_MS = 1000`), plus a
32 MB/s byte budget.

That limiter runs on the **raw frame, before the JSON is parsed** — so it cannot know
whether the frame it is dropping is a panic. There is structurally no way for it to
exempt one:

```js
rl.bytes += data.length || 0;
if (++rl.count > RATE_LIMIT_MAX_MESSAGES || rl.bytes > RATE_LIMIT_MAX_BYTES) {
  ws.send(JSON.stringify({ type:'error', error:'Rate limit exceeded', timestamp: now }));
  return;                       // ← frame never parsed, never dispatched
}
```

**Measured live** (`scripts/audit/live-probe.mjs`), per connection:

| Sent in one burst | Answered | Rejected |
|---|---|---|
| 10 | 10 | 0 |
| 50 | 50 | 0 |
| 100 | 60 | 40 |
| 200 | 60 | 140 |
| 500 | 60 | 440 |

Exactly 60 get through, the rest receive an error frame. As DoS protection this is
**correct behaviour** — it degrades cleanly rather than stalling the event loop (§AK
PASS). The problem is what it does to *musical* traffic sharing the same socket.

### The concrete risk

The virtual keyboard sends **one WebSocket command per note event** — `sendNoteOn` and
`sendNoteOff` at `KeyboardEvents.js:497,524` → `midi_send_note`. So:

- 30 note-on/note-off pairs per second saturates the budget, and the whole UI
  (device polling, meters, editor traffic) shares it.
- Beyond that, frames are dropped **before dispatch**. If the dropped frame is a
  **note-off**, the note keeps sounding.
- A UI-initiated panic during that same burst is itself dropped.

That is the exact scenario §D05 says must never happen — *"Aucune note ne doit rester
bloquée"* — reached without any hardware fault, just fast playing.

**Honesty about evidence level:** the rate limit, the drop behaviour and the
one-command-per-note design are all **verified**. The resulting stuck note is
**inferred**, not observed — it needs a real output device to demonstrate, so it is
`HW REQUIRED` to confirm. The mechanism, however, does not depend on hardware.

### Recommended fix

1. Parse the frame *before* the limiter, or pre-scan for a small allow-list
   (`midi_panic`, `playback_stop`, and CC 120/121/123 inside `midi_send_cc`) that is
   never dropped — mirroring what the device layer already does.
2. Coalesce keyboard note traffic client-side into a batched `midi_send_notes` command
   so a chord costs one frame, not ten.
3. Track outstanding note-ons per connection and emit note-offs for them on
   disconnect / rate-limit recovery, as a backstop.

See also F-06 in `10_API_WEBSOCKET.md`: the rate-limit error frame carries no `id`, so
the client cannot even tell *which* command was dropped.

---

## BK — Protocol conformance (MIDI 1.0)

| Requirement | State |
|---|---|
| Channel voice messages, all 16 channels | PASS |
| Data-byte range 0–127 respected | PASS |
| 14-bit pitch bend assembly (`msb<<7 \| lsb`) | PASS |
| Velocity-0 Note On ≡ Note Off | PASS |
| Running status incl. real-time interleave | PARTIAL (correct by inspection, untested) |
| System Real-Time | PASS |
| System Common | PASS *(after F-08 fix; previously transport-dependent)* |
| SysEx framing | PASS |
| MIDI Clock stability / drift | HW REQUIRED |

---

## Recommendations

| Pri | Action |
|---|---|
| P2 | Exempt panic/silence commands from the WebSocket rate limiter (F-07). |
| P2 | Batch virtual-keyboard note traffic into one frame per chord. |
| P2 | Add a byte-stream test for `SerialMidiManager`: running status, interleaved real-time, truncation, resync. No hardware needed. |
| P3 | Add byte-exact tests for GM/GM2/GS/XG reset and Master Volume SysEx. |
| P3 | Delete the dead `MidiMessage.js`, which disguised F-08. |
