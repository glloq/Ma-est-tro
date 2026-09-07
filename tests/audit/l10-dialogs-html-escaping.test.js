/**
 * @file tests/audit/l10-dialogs-html-escaping.test.js
 * @description Audit L10 (sécurité) — échappement HTML dans
 * `MidiEditorDialogs`.
 *
 * Contexte : `showConfirmModal()` construit son markup par `innerHTML`. Le
 * champ `details` est **volontairement** un fragment HTML brut (rangées
 * `_detailRow`, blocs `confirm-choice-info`), donc tout ce qui y est injecté
 * doit être échappé par l'appelant — soit via `tHtml()`, soit explicitement.
 *
 * Ce fichier fige trois propriétés :
 *   1. `message` est échappé (finding F-05 du 2026-08-22, ré-instruit : déjà
 *      corrigé à HEAD — ce test empêche la régression).
 *   2. `title`, `cancelText`, `confirmText` et les `extraButtons` sont échappés.
 *   3. `showChangeInstrumentModal()` échappe les noms d'instruments avant de
 *      les poser dans `details` (correctif L10 / F-111).
 *
 * Le module est un IIFE navigateur : on l'évalue dans un JSDOM, avec le vrai
 * `public/js/utils/escapeHtml.js`, pour tester le code réellement livré.
 */
import { describe, test, expect, beforeAll } from '@jest/globals';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { JSDOM } from 'jsdom';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const PAYLOAD = '"><img src=x onerror="window.__L10_DIALOG_XSS=1">';

let dom;
let MidiEditorDialogs;

/** Fausse modale : uniquement ce que MidiEditorDialogs consomme. */
function makeModal(overrides = {}) {
  return {
    t: (k, p) => (p ? `${k}:${JSON.stringify(p)}` : k),
    tHtml: (k, p) => (p ? `${k}:${JSON.stringify(p)}` : k),
    channels: [],
    selectedInstrument: 0,
    getInstrumentName: (i) => `GM ${i}`,
    ...overrides
  };
}

/** Rend le markup d'une modale de confirmation et renvoie son hôte DOM. */
function renderConfirm(dialogs, options) {
  const before = new Set(dom.window.document.querySelectorAll('.confirm-modal-overlay'));
  dialogs.showConfirmModal(options);
  const all = [...dom.window.document.querySelectorAll('.confirm-modal-overlay')];
  return all.find((el) => !before.has(el));
}

beforeAll(() => {
  dom = new JSDOM('<!doctype html><html><body></body></html>', {
    runScripts: 'outside-only',
    pretendToBeVisual: true
  });
  // Le vrai utilitaire d'échappement du projet, pas une réimplémentation.
  dom.window.eval(readFileSync(join(ROOT, 'public/js/utils/escapeHtml.js'), 'utf8'));
  dom.window.eval(
    readFileSync(join(ROOT, 'public/js/features/midi-editor/MidiEditorDialogs.js'), 'utf8')
  );
  MidiEditorDialogs = dom.window.MidiEditorDialogs;
});

describe('L10 — MidiEditorDialogs.showConfirmModal escaping', () => {
  test('le module se charge et expose la classe', () => {
    expect(typeof MidiEditorDialogs).toBe('function');
  });

  test('F-05 (ré-instruit) : `message` est échappé, pas interprété comme du HTML', () => {
    const dialogs = new MidiEditorDialogs(makeModal());
    const host = renderConfirm(dialogs, { title: 'T', message: PAYLOAD });
    expect(host).toBeTruthy();
    expect(host.querySelector('img')).toBeNull();
    expect(host.querySelector('.confirm-modal-message').textContent).toContain('<img src=x');
  });

  test('`title`, `confirmText`, `cancelText` et `extraButtons` sont échappés', () => {
    const dialogs = new MidiEditorDialogs(makeModal());
    const host = renderConfirm(dialogs, {
      title: PAYLOAD,
      message: 'ok',
      confirmText: PAYLOAD,
      cancelText: PAYLOAD,
      extraButtons: [{ text: PAYLOAD, value: PAYLOAD, class: 'primary' }]
    });
    expect(host.querySelectorAll('img').length).toBe(0);
    expect(host.querySelector('.confirm-modal-title').textContent).toContain('<img src=x');
    const extra = host.querySelector('[data-action="extra"]');
    expect(extra.getAttribute('data-value')).toBe(PAYLOAD);
  });
});

describe('L10 — MidiEditorDialogs.showChangeInstrumentModal escaping (F-111)', () => {
  test('les noms d’instruments n’injectent pas de HTML dans `details`', async () => {
    const dialogs = new MidiEditorDialogs(makeModal());
    const before = new Set(dom.window.document.querySelectorAll('.confirm-modal-overlay'));
    dialogs.showChangeInstrumentModal({
      noteCount: 0,
      channelNoteCount: 3,
      channel: 0,
      currentInstrument: PAYLOAD,
      newInstrument: PAYLOAD,
      hasSelection: false
    });
    const host = [...dom.window.document.querySelectorAll('.confirm-modal-overlay')].find(
      (el) => !before.has(el)
    );
    expect(host).toBeTruthy();
    const details = host.querySelector('.confirm-modal-details');
    expect(details).toBeTruthy();
    // Aucun élément injecté : la charge doit rester du texte.
    expect(details.querySelectorAll('img').length).toBe(0);
    expect(details.textContent).toContain('<img src=x');
  });
});
