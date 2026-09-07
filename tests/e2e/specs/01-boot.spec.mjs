/**
 * @file tests/e2e/specs/01-boot.spec.mjs
 * @description Boot of the SPA: how long, how clean, and what happens on a Pi
 * with no internet.
 *
 * Covers plan sections §AM (UI inventory), §AU (frontend perf) and provides the
 * browser-side proof for finding F-14 (`document.write` to a CDN in
 * `public/index.html`).
 */
import { suite, test, expect } from '../lib/runner.mjs';
import { newInstrumentedPage, shoot } from '../lib/browser.mjs';
import { AppPage } from '../lib/app.mjs';

/** The CDN `index.html` falls back to when the vendored player is missing. */
const CDN_URL = 'https://surikov.github.io/webaudiofont/npm/dist/WebAudioFontPlayer.js';

suite('01 · boot', () => {
  test('the SPA boots, connects, and reaches an interactive state', async (ctx, deps) => {
    const { page, rec } = await newInstrumentedPage(deps.browser);
    const app = new AppPage(page, rec, deps.server.baseUrl);
    try {
      const ms = await ctx.step('navigate and wait for #app + WebSocket', () => app.open());
      ctx.evidenceAdd('time to interactive (ms)', ms);

      await ctx.step('the splash is gone and the file panel is present', async () => {
        expect(await page.locator('#app:not(.hidden)').count()).toBe(1);
        expect(await page.locator('#fileList').count()).toBe(1);
      });

      await ctx.step('the WebSocket is OPEN', async () => {
        expect(await app.wsReadyState()).toBe(1);
      });

      ctx.evidenceAdd('screenshot', await shoot(page, deps.artifactsDir, '01-boot-home'));

      // The console is recorded, not asserted clean: the point of the harness is
      // to *report* what the browser saw. The assertion below is deliberately
      // limited to "nothing threw an uncaught exception in application code".
      const errs = rec.errors();
      ctx.evidenceAdd('console errors at boot', errs.map((e) => `[${e.type}] ${e.text.slice(0, 220)}`));
      ctx.evidenceAdd('failed requests at boot', rec.requestFailures.map((f) => `${f.url} :: ${f.error}`));
      ctx.evidenceAdd('http >=400 at boot', rec.httpErrors.map((h) => `${h.status} ${h.url}`));

      await ctx.softStep('no uncaught page exception during boot', () => {
        const pe = rec.pageErrors.map((e) => e.message);
        if (pe.length) throw new Error(`uncaught: ${pe.join(' | ')}`);
      });
    } finally {
      await page.context().close();
    }
  });

  test('the vendored WebAudioFont player is served (F-14 precondition)', async (ctx, deps) => {
    const res = await fetch(`${deps.server.baseUrl}/lib/WebAudioFontPlayer.js`);
    const ct = res.headers.get('content-type') || '';
    const body = await res.text();
    ctx.evidenceAdd('GET /lib/WebAudioFontPlayer.js', `${res.status} ${ct} ${body.length} bytes`);
    // A missing vendored player is not a 404: the SPA catch-all returns the
    // index page with text/html, which the browser then refuses to execute.
    expect(ct.includes('javascript') || ct.includes('ecmascript')).toBeTruthy(
      `expected a JS content-type, got "${ct}" (status ${res.status}) — the vendored ` +
        'player is absent and the SPA fallback served index.html instead'
    );
  });

  test('boot with the CDN unreachable — measures the real blocking time (F-14)', async (ctx, deps) => {
    const stallMs = Number(process.env.E2E_CDN_STALL_MS || 8000);
    const { page, rec } = await newInstrumentedPage(deps.browser);
    const app = new AppPage(page, rec, deps.server.baseUrl);
    try {
      // A Pi with no route to the internet does not get a fast refusal: the
      // request hangs until DNS/TCP times out. Emulate that with a stall, so
      // the measurement reflects an offline Pi rather than this container's
      // proxy answering ERR_TUNNEL_CONNECTION_FAILED in ~30 ms.
      let cdnRequested = 0;
      let cdnAt = 0;
      await page.route(CDN_URL, async (route) => {
        cdnRequested++;
        cdnAt = Date.now();
        await new Promise((r) => setTimeout(r, stallMs));
        await route.abort('connectionfailed');
      });

      const t0 = Date.now();
      await page.goto(deps.server.baseUrl + '/', { waitUntil: 'commit', timeout: 90000 });

      // When does the *document* finish parsing? `document.write` of a
      // parser-blocking script suspends the parser until the script settles, so
      // DOMContentLoaded is the honest measure of the user-visible stall.
      const domContentLoadedMs = await page
        .waitForFunction(() => document.readyState !== 'loading', null, { timeout: 90000 })
        .then(() => Date.now() - t0);

      const readyMs = await app
        .waitReady({ timeoutMs: 90000 })
        .then(() => Date.now() - t0)
        .catch((e) => `NOT READY: ${e.message}`);

      ctx.evidenceAdd('CDN stall injected (ms)', stallMs);
      ctx.evidenceAdd('CDN request intercepted', cdnRequested);
      ctx.evidenceAdd('DOMContentLoaded (ms)', domContentLoadedMs);
      ctx.evidenceAdd('time to interactive (ms)', readyMs);
      ctx.evidenceAdd('screenshot', await shoot(page, deps.artifactsDir, '01-boot-offline'));

      await ctx.step('the CDN fallback did fire (document.write path is live)', () => {
        expect(cdnRequested).toBeGreaterThan(0);
      });

      await ctx.step('WebAudioFontPlayer is undefined once the CDN fails', async () => {
        const t = await page.evaluate(() => typeof window.WebAudioFontPlayer);
        ctx.evidenceAdd('typeof WebAudioFontPlayer', t);
        expect(t).toBe('undefined');
      });

      // The finding: parsing is blocked for as long as the CDN takes to fail.
      await ctx.step(`document parsing is not blocked by the unreachable CDN (< ${stallMs}ms)`, () => {
        expect(domContentLoadedMs).toBeLessThan(stallMs);
      });
    } finally {
      await page.context().close();
    }
  });
});
