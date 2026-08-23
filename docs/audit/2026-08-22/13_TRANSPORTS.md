# 13 — Transports: USB, BLE, UART, RTP-MIDI (plan §K, L, M, N)

**State: HW REQUIRED for all four; codecs PARTIAL at unit level** · Level 1
`src/transports` — 1 427 statements, **42.8 %** coverage.

---

## Honest scope statement

Sections K, L, M and N are, by nature, hardware validation. No USB MIDI device, no BLE
radio, no D-Bus, no UART at 31 250 baud and no AppleMIDI peer were available. **Nothing
in this section is marked PASS at the transport level.** What *can* be assessed — the
pure-JS codecs and parsers, and the failure behaviour when hardware is absent — is
assessed below.

Verified live: with no MIDI library, no D-Bus and no serial port, the server boots and
every transport degrades without crashing:

```
WARN  DeviceManager initialized WITHOUT hardware MIDI support (native library not available)
ERROR Failed to initialize Bluetooth: D-Bus system bus not available
INFO  SerialMidiManager: disabled in config
INFO  NetworkManager initialized with RTP-MIDI support
```

That is correct graceful degradation — with the caveat that the health endpoint then
*lies* about it (F-01, F-02, see `20_RESILIENCE_SOAK.md`).

---

## K — USB MIDI — HW REQUIRED

`DeviceManager` (1 995 lines, **34 % coverage** — the lowest of the MIDI modules) owns
enumeration, identity, hot-plug (5 s poll), deduplication and descriptor exchange.

Tested at unit level: auto-identity, change notification, descriptor fetch, descriptor
revision skip, state pruning, easymidi boundary handling, velocity-0 note-off.

Untestable here: detection, multiple devices, **devices with identical names**,
reconnection, port changes, bidirectional I/O, saturation.

**Hardware-free improvement available:** `DeviceManager` already tolerates an injected
enumerator (that is how the missing `easymidi` is absorbed). The add/remove/rename state
machine can therefore be driven by a fake enumerator in a unit test — covering the
identical-names and port-change cases without any device. Given 34 % coverage on the
module that owns device identity, this is the best return available in §K.

## L — BLE MIDI — HW REQUIRED

`BluetoothManager` (port-based) + `NobleBleAdapter` / `InMemoryBleAdapter`. The
`InMemoryBleAdapter` is a good sign: the abstraction was built to be testable.

Unit-tested: `ble-midi-encode`, `ble-midi-decode`, `noble-ble-connect-teardown`,
`bluetooth-persistence-reconnect`, `transports/bluetooth-manager`.
So the **BLE-MIDI packet codec — including the 13-bit timestamp header/low-byte
scheme — is covered**, which is the part most likely to be subtly wrong.

Untestable here: scan, pairing, reconnection, notifications, multiple peripherals,
radio loss, latency, jitter.

Note: inbound BLE bytes reach `DeviceManager.handleRawMidi()`, which is where **F-08**
(System Common dropped) lived. That is now fixed, so a BLE peer sending Song Position
Pointer is no longer ignored.

## M — MIDI UART / GPIO — HW REQUIRED

`SerialMidiManager` (912 lines) at 31 250 baud, multiple UARTs, Running Status, SysEx,
and a bounded back-pressured write queue.

**The parser is the strongest-looking transport code in the project.** By inspection it
handles every case the plan lists (see `03_MIDI_CORE.md` §D02): running-status latching,
real-time bytes interleaved without disturbing the latch, SysEx cancelling running
status, System Common cancelling running status, and incomplete-message buffering.

Unit-tested: `serial-sysex-partial-flush`.

**The gap is that it is pure JavaScript and still has no byte-stream test.** Feeding it
a crafted `Uint8Array` needs no UART, no Pi and no oscilloscope. This is the single
highest-value hardware-free test in the whole transport area:

```
0x90 0x3C 0x40   0x3E 0x40   0xF8   0x40 0x40   0xF0 … 0xF7   0x3C 0x00
└ note on ┘ └running┘ └clock┘ └running┘ └ sysex ┘ └ must NOT use running status ┘
```

…asserting: three note-ons decoded, clock passed through without breaking the latch,
SysEx cancels running status, and the trailing bytes are *not* interpreted as a
running-status note.

Untestable here: real baud timing, full duplex, saturation, back-pressure under load,
byte corruption, multiple simultaneous UARTs. An oscilloscope/logic-analyser session
remains required for §M sign-off.

## N — RTP-MIDI / AppleMIDI

### N01 — current implementation — PARTIAL

`NetworkManager` (1 077 lines). Unit-tested: `apple-midi-codec`,
`rtp-midi-handshake`, `rtp-midi-parser-fixes`, `rtp-midi-running-status`.

### N02 — AppleMIDI conformance — EXPERIMENTAL (correctly declared)

**This is handled exactly as the plan demands.** The project does not overclaim:

- `/api/health` reports `network: degraded` with the detail
  *"RTP-MIDI is a simplified AppleMIDI implementation (no IN/OK, CK sync or journal)"* —
  **verified live**.
- The README says the same in prose: *"a simplified, not-yet-conformant AppleMIDI
  implementation (no invitation handshake, clock synchronisation or journal/recovery)
  and is not guaranteed to interoperate with macOS Network MIDI."*
- `Application.getCapabilityStatus()` hardcodes `degraded: true` for the network
  capability **even when it loads successfully**, with a comment: *"report it as degraded
  even when loaded so operators aren't misled."*

Deliberately reporting your own subsystem as degraded when it works but is not
conformant is the correct engineering call, and it is rare. The plan's requirement —
*"Tant que ces éléments ne sont pas implémentés, le transport doit rester explicitement
experimental/degraded"* — is **met**.

Not tested: invitation, session, CK sync, sequence numbers, RTP header conformance,
journal/recovery, packet loss, reordering, macOS/iOS/rtpmidi interoperability. All
require a peer.

---

## Recommendations

| Pri | Action |
|---|---|
| P2 | Byte-stream test for `SerialMidiManager` (running status / interleaved real-time / truncation / resync). **No hardware needed.** |
| P2 | Drive `DeviceManager` hot-plug from a fake enumerator: identical names, port change, rename. **No hardware needed.** |
| P3 | Keep RTP-MIDI marked degraded until CK sync, invitation and journal exist. |
| HW | K/L/M/N per the plan, on the bench described in `22_HARDWARE_VALIDATION.md`. |
