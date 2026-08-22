# 18 — UX, accessibility, i18n (plan §AN, AO, AP, AQ, AR, AS, BU, BV)

**State: AS = PARTIAL (measured) · everything else NOT TESTED** · Level 1

---

## AS — Internationalisation — PARTIAL (the one section here with hard data)

### Structural integrity — PASS

28 locales against a **2 737-key** English reference:

```
locales          : 28   (bn cs da de el en eo es fi fr hi hu id it ja ko
                         nl no pl pt ru sv th tl tr uk vi zh-CN)
missing keys     : 0    in every one of the 27 non-English locales
extra keys       : 0    in every one of the 27 non-English locales
```

**Zero structural drift across 27 locales is an excellent result** and is actively
enforced: `tests/audit-i18n.test.js` runs 138 assertions over the locale set and passes.
Placeholder consistency and fallback behaviour are covered there too.

### Translation completeness — PARTIAL

Structural completeness is not the same as being translated. Counting keys whose value
is byte-identical to English (excluding strings ≤ 3 characters):

| Locale | Identical to English | Translated |
|---|---|---|
| fr | 304 | **88.9 %** |
| bn | 336 | 87.7 % |
| th | 350 | 87.2 % |
| eo | 355 | 87.0 % |
| es | 465 | 83.0 % |
| de | 487 | 82.2 % |
| it | 536 | 80.4 % |
| vi | 614 | 77.6 % |
| id | 638 | 76.7 % |
| uk | 653 | 76.1 % |
| ja / ko / zh-CN | 660 | 75.9 % |
| ru | 663 | 75.8 % |
| pl | 666 | 75.7 % |
| cs | 672 | 75.4 % |
| pt | 674 | 75.4 % |
| sv | 675 | 75.3 % |
| fi | 680 | 75.2 % |
| no / hu / el | 683–685 | 75.0 % |
| nl | 688 | 74.9 % |
| tr | 695 | 74.6 % |
| da | 700 | 74.4 % |
| hi | 784 | 71.4 % |
| **tl** | **823** | **69.9 %** |

> **Measurement caveat, stated plainly:** "identical to English" is a heuristic. Some
> strings *should* match — GM instrument names, "MIDI", "OK", "Art-Net", proper nouns,
> units. The `> 3 characters` filter removes the worst noise but not all of it. Treat
> these as a **lower bound on translation coverage**, accurate to a few points, not as
> exact figures.

**Assessment.** The README's *"28 languages"* claim is structurally true and not
misleading — every locale loads, every key resolves, nothing renders as a raw key. But
in most locales roughly a quarter of the interface is still English. Recent commit
history (`i18n(it)`, `i18n(de,es)`, `i18n(vi)`, `i18n(id)`, `i18n(tl)` — all in the last
few commits) shows this is actively being worked through, which matches the data:
the recently-touched locales are not yet the best-covered ones, so the effort is
ongoing rather than finished.

Untested: text overflow with longer translations, Unicode edge cases, RTL (none of the
28 locales is RTL, so this is moot), and hot language switching.

---

## AN — UX journeys — NOT TESTED

The plan's ten beginner journeys (install → open UI → connect first instrument →
configure → import MIDI → auto-assign → adapt → preview → play → fix an error → build a
loop), measured by click count, ambiguity, possible errors, missing information and
jargon.

**Not attempted.** This requires driving the real UI and, properly, watching real
people. Click-counting can be approximated from code, but "ambiguity" and "jargon"
cannot be measured statically without producing false confidence.

One structural observation that *is* available: the SPA exposes **147 distinct backend
commands** from the frontend across a large modal surface (`InstrumentSettingsModal`
1 633 lines, `RoutingSummaryPage` 3 550 lines, `LoopEditorModal` 1 940 lines). That is a
wide feature surface for a product whose stated audience is *"beginners building DIY
MIDI instruments"*. Whether it is navigable is exactly what §AN and §BV must answer, and
neither can be answered from here.

## AO — Responsive — NOT TESTED
320 / 375 / 390 / 430 / 768 / 1024 / 1366 / 1920 px, portrait and landscape. Needs a
browser. 29 CSS files with 685 `!important` (see `11_FRONTEND.md`) suggests responsive
overrides may be fragile, but that is an inference, not a finding.

## AP — Touch — NOT TESTED
Needs real phones and tablets. Multitouch on the virtual keyboards is the critical case
(see `12_MIDI_EDITORS.md` §S) and cannot be faithfully simulated in jsdom.

## AQ — Cross-browser — NOT TESTED
Chromium on Pi, Chrome/Firefox on Android, Safari on iOS/iPadOS, desktop Chrome/Firefox/
Edge. Safari is the notable risk: the app leans on WebAudio, and Safari's autoplay and
`AudioContext` unlock rules differ materially from Chromium's.

## AR — Accessibility (WCAG 2.2) — NOT TESTED

Not assessed. Some positive signals exist in the code — `Toast.js` sets
`role="alert"`/`role="status"` with matching `aria-live` values, and modals carry
`role="dialog" aria-modal="true"`. So ARIA is not absent.

But keyboard-only operation, tab order, focus visibility, Escape/Enter/Space handling,
contrast, 200 %/400 % zoom, reduced-motion, screen readers, touch-target sizes and
form-error handling are all unverified. For an interface built largely from canvas
(piano roll, fretboard, drum grid), keyboard and screen-reader access is likely the
weakest area, and canvas-based editors are hard to make accessible retroactively.

## BU / BV — User acceptance & zero-documentation journey — NOT TESTED

Requires the three human profiles the plan describes (MIDI beginner, MIDI-literate
musician, mechanical-instrument builder), observed without guidance. No substitute
exists.

---

## Recommendations

| Pri | Action |
|---|---|
| P2 | Add an i18n *completeness* metric (not just structural parity) to `tests/audit-i18n.test.js`, with a ratchet so coverage cannot regress. |
| P2 | Once a browser harness exists (§BI), run an automated accessibility pass (axe-core) as the cheapest first slice of §AR. |
| P3 | Refine the untranslated-string heuristic with an allow-list of legitimately-identical keys (GM names, protocol names, units) so the metric is exact. |
| P3 | Prioritise translating the interface-critical key subset over raw key count — 25 % untranslated is far worse if it lands on primary navigation than on tooltips. |
| — | §AN, AO, AP, AQ, AR, BU, BV need real devices and real users; no static substitute. |
