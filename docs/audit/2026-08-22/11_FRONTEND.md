# 11 — Frontend (plan §AI, AL, AM, AT, AU, AV)

**State: AI = PASS · AL/AM/AT/AU/AV = NOT TESTED or PARTIAL** · Level 1
**Tool added:** `scripts/audit/xss-sinks.mjs`

Frontend scale: **190 modules, 104 761 lines, 4.3 MB** of JavaScript, 29 CSS files,
no framework.

---

## AI — XSS — PASS (0 confirmed)

This was the section with the highest prior probability of a real finding: 105 kLOC of
vanilla JS building HTML by string concatenation, rendering file names, instrument
names, device names and MIDI text events.

**Method.** `scripts/audit/xss-sinks.mjs` locates every `innerHTML` / `outerHTML` /
`insertAdjacentHTML` / `document.write` sink, follows the assigned expression across
multi-line template literals, and classifies each interpolation.

```
HTML sinks in public/js : 257
  CLEAN   (no interpolation)   114
  DYNAMIC (interpolated, benign) 116
  flagged for manual review      27
```

**All 27 flagged sinks were inspected by hand. Every one is safe.** They fall into
three groups:

1. **Param-less `t('key')`** against a trusted locale template — the heuristic matched
   the *word* "title"/"message" inside the key literal, not a variable.
2. **Hardcoded fallbacks** — `_t(key, 'Default text')` where the second argument is a
   literal, not user data.
3. **Already escaped** — `escapeHtml(...)`, `esc(...)`, `_escapeHtml(...)` or
   `tHtml(...)`.

Specifically checked, because they carry *remote* data:

| Sink | Data source | Verdict |
|---|---|---|
| `BluetoothScanModal.js:866` | BLE device name (hostile peer can set it) | safe — the only caller builds the string with `_tHtml`, which escapes params |
| `NetworkScanModal.js:511` | RTP-MIDI peer name | safe — `escapeHtml(deviceName)` |
| `LightingDeviceUI.js:258` | driver error text | safe — `_escapeHtml(error.message)` |
| `Toast.js:83,108` | every error message in the app | safe — `esc(message)` |
| `PlaylistEditorModal.js:246,308` | user file names | safe — `this.escape(...)` |

**Conclusion:** the `t()` vs `tHtml()` discipline documented in `CLAUDE.md` is genuinely
followed. That is unusual in a codebase this size and deserves to be stated plainly.

### F-05 — asymmetric escaping contract — PARTIAL (P3)

`BluetoothScanModal.showConfirmModal(title, message, onConfirm)` escapes `title` but
interpolates `message` as **raw HTML**:

```js
<h2>${escapeHtml(title)}</h2>
...
<p>${message}</p>          // ← raw
```

Not exploitable today (its single caller pre-escapes via `_tHtml`). But a helper where
one parameter is escaped and its sibling is not is a trap for the next caller. Same
shape in `auto-assign/HandEditorShared.js:178`.

**Fix:** rename to `messageHtml`, or escape both and give callers an explicit
`{html: …}` opt-in.

> **Scanner caveat.** This is static analysis with manual confirmation, not a runtime
> XSS test. The plan also asks for *"payloads XSS automatisés"* — injecting
> `<img src=x onerror=…>` as a file name, instrument name and MIDI track name through
> the real UI. That requires a browser and is **NOT TESTED**. Given the escaping
> discipline observed, expectations should be low, but it is the only way to cover
> attribute-context and event-handler-context injection, which a sink scanner cannot
> reason about.

---

## AL — Frontend boot performance — NOT TESTED (needs a Pi + browser)

One measurable fact stands out without a browser:

**`public/index.html` contains 193 `<script>` tags.**

Served unbundled, that is 193 sequential HTTP requests before the app is interactive.
On a Raspberry Pi serving a tablet over WiFi, this is very likely the dominant term in
time-to-interactive. A Vite build exists (`npm run build` → `dist/`) and `HttpServer`
serves `dist/` in production and `public/` otherwise, so production *should* be
bundled — but that split means **the dev/LAN path most users actually hit during setup
is the unbundled one**, and it was not measured here.

Not measured: First Paint, DOMContentLoaded, TTI, memory, bundle size, JS parse time.
All require the target hardware.

---

## AM — UI functional inventory — NOT TESTED

The plan asks for a full inventory of pages / buttons / menus / modals / toggles /
fields / sliders / drag-drop / touch actions, each traced
`action → event → backend → result → feedback`.

Not attempted — it requires driving the real UI. The backend half of that chain is
partly mapped: `scripts/audit/command-inventory.mjs` shows **147 of 270 commands are
called from the frontend**, and which files call them. That is the raw material for the
inventory, but it does not cover controls that never reach the backend.

---

## AT — CSS — PARTIAL (one measurement)

29 CSS files. **685 occurrences of `!important`.**

That density (roughly one every 40 lines of CSS on average) indicates specificity wars
— typically the symptom of a stylesheet that grew by overriding rather than by
restructuring. It makes theming and responsive work progressively harder, and it is
consistent with the `style="…"` inline attributes seen throughout the rendered HTML in
`DeviceSettingsModal`, `LightingDeviceUI` and others.

Not assessed: z-index layering, modal stacking, dark/light parity, dead selectors,
duplication.

---

## AU / AV — Frontend performance & memory — NOT TESTED

Requires a browser profiler. The plan's memory scenario (open/close modal ×100, change
file ×100, open editor ×100, play/stop ×100, then diff the heap) is the right test and
is completely unaddressed. Given a 4.3 MB JS surface with a canvas piano roll, a
WebAudio synthesiser and many modals, detached-DOM and AudioNode leaks are plausible and
should not be assumed absent.

Worth noting as a positive: `BaseModal`/`BaseView` give the codebase a single place to
enforce listener teardown, which makes this tractable to fix if leaks are found.

---

## Recommendations

| Pri | Action |
|---|---|
| P2 | Measure AL on a real Pi; if the unbundled path is what users hit, serve the built bundle by default. |
| P3 | Fix the asymmetric escaping contract (F-05) — rename to `messageHtml` or escape both. |
| P3 | Run automated XSS payloads through the real UI (file/instrument/track names) once a browser harness exists (§BI). |
| P3 | Budget `!important` down; start by removing inline `style="…"` from generated HTML. |
| P3 | Run the AV memory scenario and diff the heap. |
