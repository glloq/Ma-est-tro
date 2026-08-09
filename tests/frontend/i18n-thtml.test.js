// tests/frontend/i18n-thtml.test.js
//
// i18n hardening: t(key, params) substitutes params into a locale template
// WITHOUT escaping them, which is unsafe when the result feeds innerHTML. The
// new tHtml() escapes each param value (templates stay trusted) so innerHTML
// sinks are safe; t() is left unescaped for textContent/attribute sinks (where
// escaping would double-escape).

import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

let i18n;

beforeAll(() => {
  // tHtml prefers window.escapeHtml — load the shared escaper first.
  new Function(readFileSync(resolve(__dirname, '../../public/js/utils/escapeHtml.js'), 'utf8'))();
  new Function(readFileSync(resolve(__dirname, '../../public/js/i18n/I18n.js'), 'utf8'))();
  i18n = globalThis.window.i18n;
  i18n.translations = {
    greeting: 'Fichier "{name}" enregistré',
    plain: 'no params here',
    count: '{n} éléments'
  };
  i18n.fallbackTranslations = i18n.translations;
  i18n._translationCache = null; // avoid cache interference across cases
});

describe('I18n.tHtml escapes interpolation params', () => {
  it('escapes an HTML-bearing param value (innerHTML-safe)', () => {
    const out = i18n.tHtml('greeting', { name: '<img src=x onerror=alert(1)>' });
    expect(out).toBe('Fichier "&lt;img src=x onerror=alert(1)&gt;" enregistré');
    expect(out).not.toContain('<img');
  });

  it('t() does NOT escape (control — that path must target textContent)', () => {
    expect(i18n.t('greeting', { name: '<b>x</b>' })).toContain('<b>x</b>');
  });

  it('escapes the full quote/ampersand set (attribute-safe)', () => {
    expect(i18n.tHtml('greeting', { name: `a"&'b` })).toBe(
      'Fichier "a&quot;&amp;&#39;b" enregistré'
    );
  });

  it('leaves the trusted template markup intact (only params are escaped)', () => {
    // The literal quotes around {name} come from the template and stay raw.
    expect(i18n.tHtml('greeting', { name: 'song' })).toBe('Fichier "song" enregistré');
  });

  it('a parameterless call behaves like t()', () => {
    expect(i18n.tHtml('plain')).toBe('no params here');
  });

  it('coerces numeric params unchanged', () => {
    expect(i18n.tHtml('count', { n: 3 })).toBe('3 éléments');
  });

  it('a missing key returns the key without throwing', () => {
    expect(i18n.tHtml('nope.missing', { x: '<i>' })).toBe('nope.missing');
  });
});
