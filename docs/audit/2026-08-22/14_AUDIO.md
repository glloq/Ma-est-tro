# 14 — Audio, preview & latency compensation (plan §O, P)

**State: NOT TESTED (requires audio hardware and a browser)** · Level 0–1
`src/audio` — 469 statements, **24.1 % coverage** (lowest backend module).

---

## O — Latency compensation — NOT TESTED

`LatencyCompensator` + `DelayCalibrator` (1 121 lines). Calibration spawns `arecord`
(ALSA) to capture audio and measure the round-trip delay between an emitted note and its
acoustic arrival; results are stored per device in the `instruments_latency` table
(*"Loaded 0 latency profiles from database"* in the verified boot log). `config.json`
sets `latency.defaultIterations = 5` and `latency.recalibrationDays = 7`.

Unit-tested: `latency-compensator-shift`, `playback-scheduler-hand-shift`.

Nothing else in this section can be assessed without a microphone and real instruments.
Untested: manual value, automatic measurement, microphone calibration, repeated
measurements, variance, outlier rejection, DB storage round-trip, recalibration, and the
plan's headline scenario — **16 instruments with different latencies**.

### The criterion the plan sets is the right one

> *"les événements doivent arriver acoustiquement ensemble et pas seulement être envoyés
> ensemble."*

This cannot be self-measured. Software timestamps prove only what the scheduler
*intended*. Validating it requires a microphone (or contact pickups) recording the
ensemble and measuring onset alignment across instruments — the §BJ bench.

**Design observation (level 0):** compensation shifts events *earlier* by each device's
measured latency, which means the scheduler's lookahead (`playback.lookahead = 100 ms`)
must exceed the largest per-device latency, or the compensation cannot be applied in
time. Mechanical instruments — solenoid pianos, plucking mechanisms — routinely exceed
100 ms. Nothing was found that validates `maxDeviceLatency < lookahead` or warns when it
is violated. That check is cheap, hardware-free, and would turn a silent mis-timing into
an explicit configuration error. **Recommended.**

---

## P — Audio / preview — NOT TESTED

Browser-side synthesis: `public/js/audio/MidiSynthesizer.js` (2 371 lines) over
WebAudioFont, with SF2 support served by the backend
(`GET /api/sf2/:id/preset/melodic/:program`, `/preset/drum/:kit/:note`).

| § | Item | State |
|---|---|---|
| P01 | Browser synth: note on/off, polyphony, volume, program change, pitch, drums | NOT TESTED (needs a browser) |
| P02 | SoundFonts: load, error, bank, program, drums, fallback, custom SF2, change during playback | PARTIAL — backend side well covered |
| P03 | Original vs adapted preview use the expected data | **NOT TESTED** |
| P04 | Audio memory over many song/SoundFont changes | **NOT TESTED** |

**P02 backend coverage is genuinely good** — `sf2-preset-codec`,
`sf2-preset-service-lru`, `sf2-preset-service-drum-fallback`, `sf2-instance-cache`,
`sf2-structure-validate`, `sf2-quota-sentinel`, `sf2-converter-drum-tuning`,
`install-default-sf2`. The LRU cache, quota sentinel and drum fallback all have
dedicated tests. The untested half is the browser side.

**P03 deserves attention.** "Original vs adapted preview" is a correctness claim the
user relies on to judge adaptation quality — if the adapted preview silently renders the
original data (or vice versa), every judgement made from it is wrong, and nothing would
look broken. This is testable at the model layer without audio: assert the preview path
requests the adapted event list when in adapted mode. Currently unverified.

**P04** (memory growth across repeated SoundFont/song changes) is a classic WebAudio
leak scenario — `AudioBuffer`s and `AudioNode`s retained by a cache. An LRU and a quota
sentinel exist backend-side; the browser-side lifetime is unmeasured.

---

## Offline-first interaction (see also §AG in `16_SYSTEM_PI.md`)

The audio stack is where the project's offline promise is thinnest. Both runtime assets
are **downloaded at install time**, not committed:

- `assets/sf2/default.sf2` — from GitHub raw mirrors / schristiancollins.com
- `public/lib/WebAudioFontPlayer.js` — from `surikov.github.io` or jsDelivr

Neither is in git (`.gitignore` lines 64–70), and if `public/lib/WebAudioFontPlayer.js`
is missing, `public/index.html:6011` falls back to a **synchronous, render-blocking
`document.write` of the CDN script** — which on an offline Pi cannot succeed. Details
and severity in `16_SYSTEM_PI.md` (F-14) and `17_SECURITY.md` (F-15).

---

## Recommendations

| Pri | Action |
|---|---|
| P2 | Assert `max(device latency) < playback.lookahead`, or warn loudly at calibration time. Hardware-free. |
| P2 | P03: assert at the model layer that adapted preview consumes adapted data and original preview consumes original data. |
| P3 | P04: heap-diff across 100 song/SoundFont changes once a browser harness exists. |
| HW | O: full calibration validation with a microphone; then 16 instruments with differing latencies, measuring **acoustic** onset alignment. |
