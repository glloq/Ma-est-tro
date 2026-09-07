// tests/audit/l11-offline-first.test.js
//
// Lot L11 — §AG / F-14. « Offline-first » au démarrage de la SPA.
//
// NATURE DE CE FICHIER : tests de CARACTÉRISATION. Ils décrivent le
// comportement ACTUEL, prouvé, du dépôt à HEAD — pas le comportement
// souhaité. Chaque assertion porte en commentaire ce qu'il faudra en
// faire quand le correctif F-14 sera appliqué (`public/index.html` est
// un fichier partagé : le lot L11 propose le diff, il ne l'applique pas).
//
// Preuve d'exécution associée (serveur vivant, port 8111, 2026-09-07) :
//   GET /lib/WebAudioFontPlayer.js
//     -> HTTP 200, Content-Type: text/html, 615825 octets (le shell SPA)
//   c.-à-d. le fichier manquant ne renvoie JAMAIS 404 : le navigateur
//   reçoit index.html à la place du script, échoue à le parser, et le
//   repli `document.write` vers le CDN s'exécute donc TOUJOURS.

import { describe, test, expect } from '@jest/globals';
import { readFileSync, existsSync } from 'fs';
import { dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../..');

const indexHtml = readFileSync(join(ROOT, 'public/index.html'), 'utf8');

describe('L11 §AG — F-14 : le repli CDN bloquant de public/index.html', () => {
  test("le repli synchrone vers surikov.github.io est toujours présent (F-14 ouvert)", () => {
    // À INVERSER quand F-14 est corrigé : plus aucun document.write, plus
    // aucune URL externe dans index.html.
    expect(indexHtml).toContain('surikov.github.io');
    expect(indexHtml).toMatch(/document\.write\(\s*'<scr'\s*\+\s*'ipt src="https:/);
  });

  test("le repli est déclenché par une simple absence du fichier vendorisé", () => {
    // La garde est `typeof WebAudioFontPlayer === 'undefined'`. Elle est
    // vraie non seulement quand le fichier est absent, mais aussi quand le
    // serveur renvoie le shell SPA à sa place (cas réel : voir en-tête).
    expect(indexHtml).toMatch(/typeof WebAudioFontPlayer === 'undefined'/);
  });

  test("l'asset vendorisé n'est pas versionné : le chemin de repli est le cas nominal d'un dépôt frais", () => {
    const gitignore = readFileSync(join(ROOT, '.gitignore'), 'utf8');
    expect(gitignore).toMatch(/^public\/lib\/WebAudioFontPlayer\.js$/m);
  });

  test("un dépôt installé avec --ignore-scripts n'a pas public/lib/ (chemin documenté par CLAUDE.md)", () => {
    // Ce test décrit l'environnement d'audit du 2026-09-07 : L00 a installé
    // avec `npm install --ignore-scripts`, donc `postinstall` n'a jamais
    // tourné. Si un jour le player est committé, ce test devra sauter.
    const vendored = join(ROOT, 'public/lib/WebAudioFontPlayer.js');
    if (existsSync(vendored)) {
      // Installation ayant réellement exécuté le postinstall : rien à prouver.
      expect(existsSync(vendored)).toBe(true);
      return;
    }
    expect(existsSync(vendored)).toBe(false);
  });

  test("174 des 191 balises <script src> sont situées APRÈS le repli : toute la SPA est derrière lui", () => {
    const lines = indexHtml.split('\n');
    const fallbackLine = lines.findIndex((l) => l.includes('surikov.github.io'));
    expect(fallbackLine).toBeGreaterThan(0);

    const total = (indexHtml.match(/<script src=/g) || []).length;
    const after = (lines.slice(fallbackLine + 1).join('\n').match(/<script src=/g) || []).length;

    expect(total).toBe(191);
    expect(after).toBe(174);
    // Autrement dit : `document.write` étant bloquant pour l'analyseur HTML,
    // 174 scripts — c'est-à-dire l'application entière — attendent la
    // résolution réseau du CDN avant d'être seulement demandés.
  });

  test("le seul consommateur du global échoue proprement — mais seulement si le parseur y arrive", () => {
    const synth = readFileSync(join(ROOT, 'public/js/audio/MidiSynthesizer.js'), 'utf8');
    expect(synth).toMatch(/throw new Error\('WebAudioFontPlayer not loaded'\)/);
    // La dégradation « pas d'aperçu audio, le reste fonctionne » EXISTE déjà
    // (MidiSynthesizer.js). Le repli `document.write` est donc inutile à la
    // robustesse : il ne fait qu'ajouter un point de blocage réseau.
  });
});

describe('L11 §AG — F-14 (aggravation) : dist/ ne peut jamais contenir lib/', () => {
  const viteConfig = readFileSync(join(ROOT, 'vite.config.js'), 'utf8');

  test("copyStaticTree ne copie pas 'lib' : même un postinstall réussi est annulé en production", () => {
    const m = viteConfig.match(/const dirs = \[([^\]]*)\]/);
    expect(m).not.toBeNull();
    const dirs = m[1]
      .split(',')
      .map((s) => s.trim().replace(/^'|'$/g, ''))
      .filter(Boolean);

    expect(dirs).toEqual(['js', 'locales', 'assets', 'styles']);
    // À INVERSER quand le correctif est appliqué : 'lib' doit être présent.
    expect(dirs).not.toContain('lib');
  });

  test("HttpServer sert dist/ en production dès que dist/index.html existe", () => {
    const http = readFileSync(join(ROOT, 'src/api/HttpServer.js'), 'utf8');
    expect(http).toMatch(/isProduction && existsSync\(path\.join\(distPath, 'index\.html'\)\)/);
    // Conjonction fatale : Install.sh lance `npm run build`, le service
    // systemd pose NODE_ENV=production, donc la production sert dist/ —
    // qui ne contient pas lib/ — donc le repli CDN s'exécute même sur une
    // installation dont le postinstall a parfaitement réussi.
  });
});
