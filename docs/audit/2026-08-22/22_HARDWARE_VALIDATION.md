# 22 — Hardware validation, musical quality, determinism, release (plan §BJ, BL, BM, BN, BQ, BR, BS, BT, BX)

**State: HW REQUIRED / NOT TESTED throughout** · Level 0

This report specifies what must be done rather than reporting results, because none of
it could be executed here. It is written so it can be picked up directly.

---

## BJ — Hardware-in-the-loop bench — HW REQUIRED

Nothing in this audit ran on real hardware. The bench the plan describes does not exist
yet, and building it is the gate for levels 4–5.

**Minimum viable bench:**

| Component | Purpose | Notes |
|---|---|---|
| Raspberry Pi 4 (and 3B+, 5 for §BT) | target platform | Pi OS Bookworm |
| USB MIDI loopback | §K without a real instrument | a cheap USB-MIDI interface with DIN in↔out looped |
| UART loopback (GPIO TX↔RX) | §M at real 31 250 baud | plus a logic analyser for byte-level timing |
| ESP32 running BLE-MIDI | §L | also the natural DIY-instrument stand-in |
| One commercial MIDI instrument | §BL reference | known-good behaviour |
| Audio interface + microphone | §O acoustic alignment, §BM listening | the only way to validate latency compensation |
| Photodiode or high-speed camera | §AC MIDI↔light offset | |

**Highest-value first slice:** USB + UART loopback on a Pi 4. That alone unlocks §K,
§M, §F03 (real timing) and §D05 (stuck notes under load) — four sections, one afternoon
of wiring, no exotic equipment.

### Note: some "hardware" work needs no hardware

Three items currently blocked on the bench are in fact pure-JS and testable today. They
are listed in the roadmap and repeated here because they are easy to mis-file:

- `SerialMidiManager` byte-stream parsing (running status, interleaved real-time,
  truncation, resync) — feed it a `Uint8Array`.
- `DeviceManager` hot-plug state machine — inject a fake enumerator.
- Lighting drivers over UDP/HTTP/MQTT — point them at a local socket or stub server.

---

## BL — Real-instrument compatibility matrix — HW REQUIRED

To be filled on the bench; empty today.

| Class | USB | BLE | DIN/UART | RTP |
|---|---|---|---|---|
| Commercial instrument | — | — | — | — |
| ESP32 DIY | — | — | — | — |
| Arduino MIDI | — | n/a | — | n/a |
| Mechanical GMB instrument | — | — | — | opt |

## BM — Musical quality — NOT TESTED

The plan's point is the sharpest in the document: *"L'application peut être
techniquement correcte mais musicalement mauvaise."* Correct — and nothing in this audit
addresses it. Melody preservation, bass preservation, rhythm, harmony, voice leading,
collisions, transposition sanity and note loss all require listening.

The golden-file corpus proposed in `07_ADAPTATION.md` is the prerequisite: it fixes
*what* the adaptation produces, so listening sessions evaluate a stable, reviewable
artefact rather than a moving target. Suggested protocol: for each corpus file render
source and adapted side by side, and score the seven criteria above 1–5 with at least
two listeners.

## BN — Determinism — NOT TESTED

Same MIDI + same instruments + same configuration must yield the same auto-assignment
and adaptation. **Not verified, and not currently verifiable** — there is no
golden-output artefact to compare against.

Two concrete risks to check when this is tested, both visible in the code:

- Any use of `Map`/`Set` iteration order over data built from object keys is stable in
  JS, but any sort that is not **total** (ties broken by an unstable comparator) can
  reorder equal-scoring instruments between runs. `InstrumentMatcher.calculateCompatibility()`
  produces scores that will frequently tie across similar instruments.
- Any `Date.now()` or `Math.random()` on the assignment path would break determinism
  outright.

**Cheapest possible test:** run the full assignment+adaptation pipeline twice in one
process and assert deep equality. That catches unstable sorts immediately and needs no
corpus.

## BQ — Release checklist — NOT TESTED

Clean install, upgrade from the previous version, migrations, tests, build, changelog,
version bump, docs, backup/restore, rollback.

Partial evidence from this audit: **migrations are idempotent** and **backup/restore
round-trips** (`09_PERSISTENCE.md`), and `CHANGELOG.md` is maintained. `npm run build` is
**never exercised in CI** (`19_PERFORMANCE.md`), which is a gap for any release process.

## BR — Reproducibility — **PARTIAL, with a real finding**

A given git tag does **not** reproduce an identical installation.

| Factor | State |
|---|---|
| `package-lock.json` | ✅ committed (354 kB), `npm ci` used in CI |
| Node version | ✅ `engines: >=20`, CI pins 20 |
| System dependencies | ⚠️ documented but unpinned (`libasound2-dev` etc.) |
| Install scripts | ✅ committed |
| **External assets** | ❌ **fetched at install from third-party mirrors, no checksum** |

`assets/sf2/default.sf2` and `public/lib/WebAudioFontPlayer.js` are downloaded at
`postinstall` from GitHub raw, jsDelivr and `schristiancollins.com`, and are validated
only by magic bytes and a minimum size — **no SHA-256** (see F-15 in `17_SECURITY.md`).
The installer's own comment acknowledges *"Mirrors die over time."*

So two runtime artefacts — one of them **executed as JavaScript in the browser** — are
not pinned, not committed and not verified. Reproducibility and supply-chain integrity
fail together here, and one fix addresses both: commit the player and pin a checksum for
the SF2.

## BS — Licences — NOT TESTED

Project is MIT. Not audited: npm dependency licences (no `license-checker` run),
SoundFont licensing (**GeneralUser GS has its own licence terms and is downloaded at
install** — worth confirming redistribution conditions are met), samples, images,
documentation.

This is quick to close: `npx license-checker --summary` plus a note on the
GeneralUser GS terms in `assets/sf2/README`.

## BT — Hardware regression across Pi models — HW REQUIRED

Pi 3B+ / 4 / 5 after every significant change. The plan's rule — *"Une optimisation Pi 5
ne doit pas rendre Pi 3 inutilisable"* — implies the Pi 3B+ is the binding constraint and
should be the CI-of-record for performance work. Nothing measured.

## BX — Orchestra validation — HW REQUIRED

The real system test: 8–16 instruments, USB + BLE + UART mixed, several families, a
complex MIDI file, automatic adaptation, latency compensation, lighting, web monitoring,
a connected tablet, prolonged playback — measuring lost / doubled / stuck notes, timing,
jitter, CPU, RAM, temperature, WebSocket health, lighting and errors.

**Not attempted.** This remains the only test that validates the product as a whole, and
until it is run the system is unproven at level 5 regardless of how green the unit
suites are.

Two findings from this audit should be explicitly watched for during §BX, because both
predict failures that would first appear there:

- **F-07** — the 60 msg/s WebSocket ceiling has no panic exemption and the virtual
  keyboard sends one frame per note. Watch for stuck notes during dense passages and for
  an unresponsive panic button.
- **F-13** — lighting rule evaluation runs synchronously on the MIDI hot path from
  untested code. Watch for timing degradation once lighting rules are enabled.

---

## Recommendations

| Pri | Action |
|---|---|
| **P1** | Build the minimum bench: Pi 4 + USB loopback + UART loopback. Unlocks §K, §M, §F03, §D05. |
| P2 | Determinism smoke test (run the pipeline twice, assert deep equality) — no hardware, do it now. |
| P2 | Commit the vendored WAF player and pin a SHA-256 for the SF2 (fixes §BR and F-15 together). |
| P3 | `npx license-checker --summary`; confirm GeneralUser GS redistribution terms. |
| P3 | Add `npm run build` to CI as a release prerequisite (§BQ). |
| HW | §BL matrix, §BM listening sessions, §BT three-model regression, §BX orchestra test. |
