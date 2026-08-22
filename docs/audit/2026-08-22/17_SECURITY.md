# 17 — Backend security & authorization (plan §AH, AJ)

**State: PARTIAL — strong posture, one systemic gap** · Level 3

---

## Summary

The security design is thoughtful and, in several places, better than typical for a
hobby-adjacent appliance: fail-closed WebSocket auth, argv-based subprocess invocation,
timing-safe token comparison, byte-and-message rate limiting, and an explicit,
*documented* threat model for the LAN bypass. Prototype pollution and path traversal
were probed live and both held.

The systemic gap is input validation (F-03): 68 % of the command surface is
unvalidated because the validator fails open.

---

## AJ / auth — PASS (verified live)

| Check | Result |
|---|---|
| Tokenless non-browser WebSocket | **refused, 401** |
| Token auto-generated on first boot into `.env` | yes |
| Token comparison | `timingSafeEqual`, with a length check first |
| HTTP bearer on `/api/*` | enforced |
| Public exceptions | `/api/health`, `/api/update-status` only — both documented, both deliberate |

**The same-origin bypass is well reasoned.** `verifyClient` accepts a connection when
`Origin` matches the inbound `Host` (or is loopback on the server port), because the box
binds `0.0.0.0` and its LAN address cannot be pre-enumerated. The code comments the
threat model explicitly:

> *"Both headers are browser-set, so JS in a third-party page cannot forge them —
> XSS-style attacks therefore still hit the token gate below. A determined attacker with
> a custom HTTP client can match both, but at that point they can also just include the
> token, so the bypass adds no extra surface."*

That reasoning is correct. The IPv6 `Host` parsing bug it references (`split(':')`
mangling `[::1]:8080`) was already fixed via `new URL()`.

`GMBOOP_SECURITY_MODE=secure` removes the LAN/same-origin bypass entirely for
untrusted networks. With **no token configured, external connections fail closed** —
the right default.

### Sensitive-command authorization

The plan asks whether config / filesystem / update / hotspot / shutdown / device / DB
commands can be reached without authorization. **They cannot** — all `system_*`,
`hotspot_*`, `file_*` and device commands travel over the authenticated WebSocket, and
there is no unauthenticated path to any of them. There is, however, **no
privilege tiering**: any authenticated client can call `system_shutdown` or
`system_update`. For a single-user appliance that is a defensible model, but it should
be a stated decision, since `trusted-lan` mode means *anyone on the LAN* is that user.

---

## AH — Backend security checklist

| Item | State | Evidence |
|---|---|---|
| API token | PASS | auto-generated, `timingSafeEqual` |
| LAN bypass | PASS (documented) | reasoning sound; `secure` mode available |
| WebSocket auth | PASS | 401 verified live |
| **Payload validation** | **FAIL** | **F-03 — 184/270 commands unvalidated, fails open** |
| SQL injection | PASS (by construction) | `better-sqlite3` prepared statements throughout; no string-built SQL found |
| Path traversal | PASS | `blobstore-path-guard` test + live probes → 400, no leak |
| File upload | PARTIAL | base64 pre-check, size caps; content-type/extension policy not audited |
| Command injection | PASS | `execFile(cmd, [args])` everywhere — **no `exec`/shell with user data** |
| Shell execution | PASS | only `arecord` (fixed args), `sudo -n scripts/hotspot.sh` (argv), `git rev-parse` (constant) |
| Update system | NOT TESTED | see `16_SYSTEM_PI.md` |
| Hotspot configuration | PASS | schema + argv + script-side re-validation |
| Secrets | PASS | token in `.env`, `.gitignore`d; not logged |
| Logs | PASS | `logger-safe-stringify` handles circular payloads without throwing |
| CORS | PASS | same-origin/localhost allowlist |
| Helmet | PARTIAL | active (`X-Content-Type-Options: nosniff`) but **CSP disabled** — F-11 |
| DoS | PASS | 60 msg/s + 32 MB/s per connection, 16 MB frame cap, 10 client cap — verified |
| Prototype pollution | PASS | `{"__proto__":{"polluted":"yes"}}` had no effect — verified live |
| **npm dependencies** | **PARTIAL** | **F-16 — 8 high-severity advisories, one in a direct runtime dep** |
| **Install-time asset integrity** | **PARTIAL** | **F-15 — executable JS fetched with no checksum** |

---

## F-03 — validation fails open (P1)

Detailed in `10_API_WEBSOCKET.md`. Security-relevant summary: `validateByCommand`
returns `{valid:true}` for any command without a registered schema, so 184 commands
accept arbitrary payloads at the dispatch layer.

The highest-risk surfaces were checked individually and are **safe on their own merits**
(hotspot is schema'd + argv-invoked; `system_*` commands are largely parameterless).
The exposure is that the *default* is permissive: 31 unvalidated `LightingCommands`
drive network and GPIO output from untested code (F-13). The fix is to invert the
default — fail closed except for an explicit parameterless allow-list.

## F-11 — CSP disabled (P3, accepted risk)

No `Content-Security-Policy` header. This is **deliberate and documented** at
`HttpServer.js:9-10`:

> *"helmet security headers (CSP/CORP/COEP intentionally relaxed — embedded SPA with
> inline scripts, accessed over LAN by IP)"*

With 193 inline-ish script tags and inline event handlers in generated markup, a strict
CSP would require real refactoring. Recorded as an **accepted risk**, not a defect —
but it does remove the defence-in-depth layer that would contain an XSS, and §AI found
no XSS *by static analysis only*. If the inline-handler pattern is ever cleaned up
(see `11_FRONTEND.md`), enabling CSP becomes cheap and should be done then.

## F-15 — install-time assets have no integrity verification (P2)

`scripts/install-default-sf2.js` downloads two runtime assets from third-party mirrors:

| Asset | Sources |
|---|---|
| `assets/sf2/default.sf2` | `raw.githubusercontent.com` (2 mirrors), `schristiancollins.com` |
| `public/lib/WebAudioFontPlayer.js` | `surikov.github.io`, `cdn.jsdelivr.net` |

Verification is **format sanity only** — RIFF/`sfbk` magic bytes and a minimum size
(`MIN_PLAYER_SIZE = 50 KB`, `MIN_SF2_SIZE = 1 MB`, described in-code as catching "an
error page"). **There is no SHA-256 or subresource-integrity check.**

Those checks catch a mirror serving an HTML 404. They do not catch a mirror serving
*different valid content*. And `WebAudioFontPlayer.js` is **executed as JavaScript in
the SPA**, so a changed or compromised mirror is arbitrary code execution in the
operator's browser, on a box that also exposes `system_shutdown` and `system_update`.

Mitigations that do exist: HTTPS, multiple mirrors, and `GMBOOP_SF2_URL` /
`GMBOOP_WAF_PLAYER_URL` overrides. The code even comments *"Mirrors die over time"* —
so mirror instability is a known, accepted condition.

**Fix:** pin a SHA-256 for each asset and refuse a mismatch. Better still, commit
`WebAudioFontPlayer.js` (~100 KB) — it is a fixed vendored library, and committing it
also closes F-14 (offline boot).

This also makes builds non-reproducible — see §BR in `22_HARDWARE_VALIDATION.md`.

## F-16 — dependency advisories (P2)

`npm audit`: **15 vulnerabilities — 0 critical, 8 high, 6 moderate, 1 low.**

| Package | Severity | Kind | Advisory |
|---|---|---|---|
| **`ws`** | **high** | **direct runtime dep** | **uninitialized memory disclosure** (installed `8.20.0`; affected `8.0.0 – 8.20.1`; **fix available**) |
| `undici` | high | transitive | TLS certificate validation bypass |
| `vite` | high | direct **dev** dep | `launch-editor` NTLMv2 disclosure (Windows-only; not relevant to a Pi) |
| `postcss`, `nanoid`, `js-yaml`, `brace-expansion`, `ip-address` | high | transitive (build/dev) | file read, DoS, XSS in an HTML helper |

**`ws` is the one that matters.** It is the WebSocket server itself — the project's
primary API surface — and an uninitialized-memory-disclosure bug there can leak process
memory to a connected client. A fix is available; `npm audit fix` should resolve it
within the `^8.14.2` range already declared in `package.json`.

The rest are predominantly build-chain packages that never run on the appliance.

---

## Recommendations

| Pri | Action |
|---|---|
| **P1** | F-03: invert schema defaults to fail closed; backfill schemas (lighting first). |
| P2 | F-16: `npm audit fix` — upgrade `ws` past 8.20.1. Runtime-facing. |
| P2 | F-15: pin SHA-256 for install-time downloads, or commit the vendored player. |
| P3 | Document that `trusted-lan` grants every LAN client full privileges including shutdown/update; recommend `secure` mode for shared networks. |
| P3 | Add `--` before user arguments in `HotspotManager._runScript()`. |
| P3 | Revisit CSP (F-11) once inline handlers are removed. |
| P3 | Audit the upload content-type/extension policy. |
