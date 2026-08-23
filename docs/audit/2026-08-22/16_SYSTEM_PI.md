# 16 — Raspberry Pi, install, hotspot, update, offline-first (plan §B, AD, AE, AF, AG)

**State: HW REQUIRED (Pi) / PARTIAL (offline-first — one real gap)** · Level 0–1
`src/system` — **5.61 % statement coverage, 0 % branches, 0 % functions.**

---

## B — Build, installation, deployment

| § | Item | State |
|---|---|---|
| B01 | Clean install on Pi OS Bookworm Lite/Desktop, Pi 3B+/4/5 | **HW REQUIRED** |
| B02 | `npm install` / `npm ci` / `--ignore-scripts` / native deps | PARTIAL |
| B03 | `npm start` / `npm run dev` / PM2 / systemd / reboot / crash-restart | PARTIAL |
| B04 | Docker: build, volumes, USB, ALSA, shutdown | **NOT TESTED** |
| B05 | Config layering: defaults → `config.json` → `.env` → `GMBOOP_*` | PARTIAL |

### B02 — verified in this container

| Dependency | Result |
|---|---|
| `npm install --ignore-scripts` | works, all JS tooling functional |
| `better-sqlite3` | prebuilt binding **absent**; `npm rebuild --build-from-source` **succeeds** (gcc/g++/make/python3 present) |
| `serialport` | loads |
| `midi` (via `easymidi`) | **cannot build** — requires `libasound2-dev`, unavailable here |
| `pigpio`, `rpi-ws281x-native` | optional deps, not attempted |

The `--ignore-scripts` path documented in `CLAUDE.md` works exactly as described, and
`DeviceManager` substitutes a no-op MIDI stub so the app still boots. Good design — but
see F-01: the health endpoint then reports `usb: ready` anyway.

### B03 — verified

`npm start` boots cleanly (full sequence in `20_RESILIENCE_SOAK.md`). PM2
(`ecosystem.config.cjs`), systemd, boot-time autostart, crash-restart and reboot were
**not** tested — all need the target machine.

### B05 — the layering is tested (`tests/config.test.js`) but not fuzzed. Invalid values
(a port of `"abc"`, a negative latency, a malformed `config.json`) were not exercised.

---

## AD — Raspberry Pi system — HW REQUIRED

CPU, temperature, RAM, disk, network, ALSA, Bluetooth, GPIO, permissions, users,
services, NTP and reboot: **none assessed.** No Pi.

`src/system` at 5.61 % coverage is the least-tested backend module, and it is precisely
the code that touches the machine. `scripts/pi-rt-tune.sh` and
`scripts/check-rt-setup.sh` exist, indicating RT tuning has been considered.

## AE — WiFi hotspot — NOT TESTED (but the security shape is good)

`HotspotManager` + `scripts/hotspot.sh` + `captive-portal-dnsmasq.conf`.

Not testable here (no wireless interface). What **was** verified is the injection
surface, and it is sound:

- `execFile('sudo', ['-n', SCRIPT_PATH, ...args])` — an **argv array, no shell**, so
  SSID/password cannot inject a command.
- `-n` prevents hanging on a sudo password prompt, with a specific error hint when sudo
  is not configured.
- The sensitive fields **do** carry schemas: SSID 1–32 chars, WPA2 password 8–63, band
  `a|bg`, channel 0–196.
- `scripts/hotspot.sh` re-validates `band` independently.

Defence in depth, correctly built. Residual note: an SSID beginning with `-` could in
principle be read as an option by the script; positional `$1`-style handling makes this
unlikely, but a `--` separator before user arguments would close it definitively.

Untested: activation, deactivation, captive portal, reconnection, reboot persistence,
and conflict with an existing WiFi connection.

## AF — Update system — NOT TESTED

`scripts/update.sh`, `system_update`, `system_check_update`, and a public
`/api/update-status` endpoint so the SPA can poll while the server restarts.

The plan's scenarios — normal update, no update, git error, conflict, network loss,
`npm install` failure, insufficient disk, reboot, rollback — are **all untested**, and
`src/system` is at 5.61 % coverage.

The plan's requirement is *"Une mise à jour ne doit jamais rendre l'installation
irrécupérable."* On an appliance a user cannot easily reflash, a failed update is the
worst realistic outcome in this whole audit. It is untested, and it is 10/11
unschema'd commands (F-03). This deserves priority disproportionate to its code size.

---

## AG — Offline-first — PARTIAL, with one real gap

### Runtime: clean

An exhaustive scan of `public/**` (`.html`, `.js`, `.css`) for external URLs returns
only three, and two are placeholders:

| URL | Context |
|---|---|
| `http://192.168.1.100` | example IP in UI help text |
| `http://wled-ip` | placeholder in WLED driver config |
| `https://surikov.github.io` | **real CDN fallback** — see below |

**No web fonts, no CDN stylesheets, no analytics, no external API calls.** For a 105 kLOC
SPA that is a genuinely disciplined result, and it means the offline promise holds at
runtime once the box is installed.

### F-14 — the offline promise depends on install-time downloads — PARTIAL (P2)

Two runtime assets are **not committed** and are fetched from the internet at install
time by `scripts/install-default-sf2.js` (`postinstall`):

| Asset | Sources | In git? |
|---|---|---|
| `assets/sf2/default.sf2` | GitHub raw mirrors, `schristiancollins.com` | no (`.gitignore:64-66`) |
| `public/lib/WebAudioFontPlayer.js` | `surikov.github.io`, `cdn.jsdelivr.net` | no (`.gitignore:70`) |

If the vendored player is missing, `public/index.html:6011` executes:

```js
if (typeof WebAudioFontPlayer === 'undefined') {
  document.write('<scr'+'ipt src="https://surikov.github.io/…/WebAudioFontPlayer.js"><'+'/scr'+'ipt>');
}
```

The comment states the intent plainly: *"a synchronous CDN fallback so installs that
never ran the postinstall still get audio."*

That is a reasonable goal with a poor failure mode **on an offline-first appliance**:

- `--ignore-scripts` is the install path the project's own `CLAUDE.md` documents for
  containers/CI, and it skips `postinstall` entirely.
- `document.write` of a `<script>` is **render-blocking and synchronous** — every
  subsequent script depends on the global being defined.
- On a Pi with no internet, that request cannot succeed; the page stalls until the
  network stack gives up, then loads with a broken audio subsystem.

The graceful outcome would be "no audio preview, everything else works". The current
outcome is "boot blocks on a request that will never complete".

**Fix:** commit the vendored player (it is ~100 KB), or replace the blocking
`document.write` with an async load plus an explicit "audio preview unavailable —
run `npm run install-default-sf2`" notice.

See also **F-15** in `17_SECURITY.md`: these downloads are verified only by magic bytes
and minimum size, with **no checksum** — and the player is executed as JavaScript.

### Not tested

The plan's core exercise — *install fully, then cut the internet and test every promised
feature* — was not performed. It needs the target hardware.

---

## Recommendations

| Pri | Action |
|---|---|
| P2 | Commit `public/lib/WebAudioFontPlayer.js`, or make the fallback async and fail visibly instead of blocking (F-14). |
| P2 | Test the update system's failure paths — especially interrupted update and rollback. Highest consequence-per-line in the repo. |
| P2 | Add schemas to the `system_*` commands (F-03). |
| P3 | Add `--` before user-supplied arguments in `HotspotManager._runScript()`. |
| P3 | Fuzz configuration values (invalid port, malformed `config.json`, out-of-range latency). |
| HW | B01/B03/B04, AD, AE, AF and the real §AG cut-the-internet exercise, on Pi 3B+/4/5. |
