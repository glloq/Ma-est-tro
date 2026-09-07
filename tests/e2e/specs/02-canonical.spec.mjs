/**
 * @file tests/e2e/specs/02-canonical.spec.mjs
 * @description The plan's canonical end-to-end journey, one recorded step each:
 *
 *   boot → virtual instrument → import MIDI → assign → adapt → play
 *        → edit in the MIDI editor → save → reload → verify it survived
 *
 * Every step is a `ctx.step()`, so a break at step 7 still reports steps 1-6 as
 * passed and names exactly where the journey stops. Nothing here is skipped to
 * keep the scenario green.
 */
import { suite, test, expect } from '../lib/runner.mjs';
import { newInstrumentedPage, shoot } from '../lib/browser.mjs';
import { AppPage } from '../lib/app.mjs';
import { writeFixtures } from '../fixtures/make-midi.mjs';

suite('02 · canonical scenario', () => {
  test('boot → instrument → import → assign → adapt → play → edit → save → reload → verify', async (ctx, deps) => {
    const { page, rec } = await newInstrumentedPage(deps.browser);
    const app = new AppPage(page, rec, deps.server.baseUrl);
    const fx = writeFixtures();
    const filename = 'e2e-two-channel.mid';

    try {
      // ── 1. boot ────────────────────────────────────────────────────────────
      await ctx.step('1 · boot the SPA', async () => {
        await app.open();
        // Virtual instruments are gated by a localStorage setting; enabling it
        // needs a reload for the management page to render the add button.
        await app.enableVirtualInstruments();
        await app.open();
      });

      // ── 2. virtual instrument ──────────────────────────────────────────────
      await ctx.step('2 · create a virtual instrument through the UI', async () => {
        await app.openInstruments();
        await app.createVirtualInstrumentViaUi({ preset: 'piano' });
        await page.waitForTimeout(1500);
        const devices = await app.listDevices();
        ctx.evidenceAdd('devices after creation', devices.map((d) => `${d.id} · ${d.name} · ${d.type}`));
        expect(devices.length).toBeGreaterThan(0);
        expect(devices.some((d) => d.type === 'virtual')).toBeTruthy('a virtual device is registered');
        ctx.state.deviceId = devices.find((d) => d.type === 'virtual').id;
      });
      await ctx.step('2b · the instrument page closes and stops intercepting clicks', async () => {
        await app.closeInstruments();
        expect(await page.locator('.inst-mgmt-modal').count()).toBe(0);
      });

      // ── 3. import ──────────────────────────────────────────────────────────
      await ctx.step('3 · import a MIDI file through the drop-zone input', async () => {
        await app.importMidiViaUi(fx.twoChannel);
        ctx.state.fileId = await app.waitForFileInList(filename);
        ctx.evidenceAdd('imported file id', ctx.state.fileId);
        const files = await app.filesInList();
        ctx.evidenceAdd('file list', files);
        expect(files.some((f) => f.name === filename)).toBeTruthy();
      });
      ctx.evidenceAdd('screenshot after import', await shoot(page, deps.artifactsDir, '02-03-imported'));

      // ── 4. assign ──────────────────────────────────────────────────────────
      await ctx.step('4 · open the routing page and auto-assign every channel', async () => {
        await app.fileAction(filename, 'route');
        await page.waitForSelector('#routingSummaryModal', { timeout: 30000 });
        await page.waitForTimeout(2500);

        const before = await readAssignments(page);
        ctx.evidenceAdd('assignments before auto-routing', before);
        expect(before.length).toBeGreaterThan(0);

        await page.click('#rsAutoRoutingBtn');
        await page.waitForTimeout(4000);

        const after = await readAssignments(page);
        ctx.evidenceAdd('assignments after auto-routing', after);
        expect(after.every((a) => a.value !== 'ignore')).toBeTruthy(
          `every channel is assigned (got ${JSON.stringify(after)})`
        );
        ctx.state.score = (await page.textContent('#rsScoreBtn').catch(() => '')).replace(/\s+/g, ' ').trim();
        ctx.evidenceAdd('feasibility score', ctx.state.score);
      });
      ctx.evidenceAdd('screenshot after assign', await shoot(page, deps.artifactsDir, '02-04-assigned'));

      // ── 5. adapt ───────────────────────────────────────────────────────────
      await ctx.step('5 · adaptation is engaged for the assignment', async () => {
        const cls = await page.getAttribute('#rsAutoAdaptToggle', 'class');
        ctx.evidenceAdd('adaptation toggle class', cls);
        // The toggle carries `active` when auto-adaptation will be baked in.
        if (!/\bactive\b/.test(cls || '')) {
          await page.click('#rsAutoAdaptToggle');
          await page.waitForTimeout(2500);
        }
        const now = await page.getAttribute('#rsAutoAdaptToggle', 'class');
        expect(/\bactive\b/.test(now || '')).toBeTruthy('adaptation is ON before applying');
      });

      await ctx.step('5b · apply the routing', async () => {
        await page.click('#rsSummaryApply');
        await page.waitForSelector('#routingSummaryModal', { state: 'detached', timeout: 30000 });
        await page.waitForTimeout(2500);
        const status = await app.command('file_routing_status', { fileId: ctx.state.fileId });
        ctx.evidenceAdd('file_routing_status after apply', status);
        expect(status.routedCount).toBeGreaterThan(0);
      });

      // ── 6. play ────────────────────────────────────────────────────────────
      await ctx.step('6 · play the file to the virtual instrument', async () => {
        await app.fileAction(filename, 'play');
        await page.waitForTimeout(2500);
        const st = await app.playbackStatus();
        ctx.evidenceAdd('playback_status while playing', st);
        expect(st.playing).toBeTruthy('backend reports playback in progress');
        expect(st.outputDevice).toBeTruthy('playback targets a device');
        expect(st.events).toBeGreaterThan(0);
        const header = await app.transportState();
        ctx.evidenceAdd('header transport while playing', header);
      });
      ctx.evidenceAdd('screenshot while playing', await shoot(page, deps.artifactsDir, '02-06-playing'));

      await ctx.step('6b · stop returns the transport to an idle state', async () => {
        await page.click('#headerStopBtn');
        await page.waitForTimeout(2000);
        const st = await app.playbackStatus();
        ctx.evidenceAdd('playback_status after stop', st);
        expect(st.playing).toBeFalsy('backend playback is stopped');
        const header = await app.transportState();
        ctx.evidenceAdd('header transport after stop', header);
        expect(header.stopDisabled).toBeTruthy('the Stop button is disabled again when nothing plays');
      });

      // ── 7. edit ────────────────────────────────────────────────────────────
      await ctx.step('7 · open the MIDI editor on the file', async () => {
        await app.fileAction(filename, 'edit');
        await page.waitForSelector('.midi-editor-modal', { timeout: 45000 });
        await page.waitForSelector('.piano-roll-canvas', { timeout: 30000 });
        await page.waitForTimeout(3500);
        const shape = await page.evaluate(() => ({
          channels: document.querySelectorAll('.midi-editor-modal .channel-chip, .midi-editor-modal [class*="channel-chip"]').length,
          canvases: document.querySelectorAll('.midi-editor-modal canvas').length,
          tempo: document.querySelector('#tempo-input')?.value,
          hasSave: !!document.querySelector('#save-btn')
        }));
        ctx.evidenceAdd('editor shape', shape);
        expect(shape.hasSave).toBeTruthy('the editor exposes a Save button');
        ctx.state.tempoBefore = shape.tempo;
      });
      ctx.evidenceAdd('screenshot of the editor', await shoot(page, deps.artifactsDir, '02-07-editor'));

      await ctx.step('7b · change the tempo in the editor header', async () => {
        // Capture the modal instance so the effect of the edit can be read from
        // the component's own state, not only from the input's displayed value
        // (a native <input> shows the typed value whether or not the app reacted).
        await page.evaluate(() => {
          const p = window.MidiEditorModal && window.MidiEditorModal.prototype;
          if (p && !p.__e2ePatched) {
            const orig = p.log;
            p.log = function (...a) {
              window.__midiEditorInstance = this;
              return orig.apply(this, a);
            };
            p.__e2ePatched = true;
          }
        });
        await page.fill('#tempo-input', '96');
        await page.dispatchEvent('#tempo-input', 'input');
        await page.dispatchEvent('#tempo-input', 'change');
        await page.waitForTimeout(1500);

        const shown = await page.inputValue('#tempo-input');
        ctx.evidenceAdd('tempo input shows', shown);
        const uncaught = rec.pageErrors.map((e) => e.message);
        ctx.evidenceAdd('uncaught page errors after the tempo edit', uncaught);
        expect(uncaught.filter((m) => /setTempo/.test(m)).length).toBe(0);
      });

      // ── 8. save ────────────────────────────────────────────────────────────
      await ctx.step('8 · save from the editor', async () => {
        ctx.state.bytesBefore = await fileBytes(app, ctx.state.fileId);
        await page.click('#save-btn');
        await page.waitForTimeout(4000);
        ctx.state.bytesAfter = await fileBytes(app, ctx.state.fileId);
        ctx.evidenceAdd('file size before/after save', [ctx.state.bytesBefore, ctx.state.bytesAfter]);
        expect(ctx.state.bytesAfter).toBeGreaterThan(0);
      });
      ctx.evidenceAdd('screenshot after save', await shoot(page, deps.artifactsDir, '02-08-saved'));

      // ── 9. reload ──────────────────────────────────────────────────────────
      await ctx.step('9 · reload the page', async () => {
        await app.open();
      });

      // ── 10. verify ─────────────────────────────────────────────────────────
      await ctx.step('10a · the virtual instrument survived the reload', async () => {
        const devices = await app.listDevices();
        ctx.evidenceAdd('devices after reload', devices.map((d) => `${d.id} · ${d.name}`));
        expect(devices.some((d) => d.id === ctx.state.deviceId)).toBeTruthy(
          'the virtual instrument created in step 2 is still registered'
        );
      });

      await ctx.step('10b · the imported file survived the reload', async () => {
        const files = await app.filesInList();
        ctx.evidenceAdd('file list after reload', files);
        expect(files.some((f) => f.name === filename)).toBeTruthy();
      });

      await ctx.step('10c · the routing survived the reload', async () => {
        const status = await app.command('file_routing_status', { fileId: ctx.state.fileId });
        ctx.evidenceAdd('file_routing_status after reload', status);
        expect(status.routedCount).toBeGreaterThan(0);
      });

      await ctx.step('10d · the edit survived the reload (tempo is 96 BPM)', async () => {
        await app.fileAction(filename, 'edit');
        await page.waitForSelector('#tempo-input', { timeout: 45000 });
        await page.waitForTimeout(3000);
        const tempo = await page.inputValue('#tempo-input');
        ctx.evidenceAdd('tempo after reload', tempo);
        ctx.evidenceAdd('screenshot after reload', await shoot(page, deps.artifactsDir, '02-10-reloaded'));
        expect(tempo).toBe('96');
      });
    } finally {
      ctx.evidenceAdd('console errors over the whole journey',
        rec.errors().map((e) => `[${e.type}] ${e.text.slice(0, 250)}`));
      ctx.evidenceAdd('uncaught page errors over the whole journey',
        rec.pageErrors.map((e) => e.message));
      await shoot(page, deps.artifactsDir, '02-final').catch(() => {});
      await page.context().close();
    }
  }, { timeoutMs: 420000 });
});

/** @param {any} page @returns {Promise<Array<{value:string,text:string}>>} */
function readAssignments(page) {
  return page.$$eval('#routingSummaryModal select.rs-instrument-select', (sels) =>
    sels.map((s) => ({ value: s.value, text: (s.selectedOptions[0] || {}).textContent?.trim() }))
  );
}

/** @param {AppPage} app @param {string} fileId @returns {Promise<number>} */
async function fileBytes(app, fileId) {
  const res = await app.command('file_read', { fileId });
  const payload = res?.midiData ?? res?.data ?? res?.content ?? '';
  if (Array.isArray(payload)) return payload.length;
  return String(payload).length;
}
