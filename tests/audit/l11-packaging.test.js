// tests/audit/l11-packaging.test.js
//
// Lot L11 — §B04 (Docker) et §B03 (PM2/systemd). Tests de CARACTÉRISATION :
// ils décrivent l'état PROUVÉ du packaging à HEAD. `Dockerfile`,
// `docker-compose.yml` et `ecosystem.config.cjs` sont des fichiers partagés :
// L11 propose les diffs, il ne les applique pas.
//
// Preuves d'exécution (docker 29.3.1, 2026-09-07, journaux dans le bac à
// sable du lot) :
//   1. `docker build .`                       -> ERROR "/locales": not found
//   2. + COPY corrigé                          -> conteneur Exited(1) :
//        Cannot find module '/app/shared/BinaryFrameCodec.js'
//   3. + COPY shared/ assets/ scripts/ config.json -> Exited(1) :
//        better-sqlite3 « Could not locate the bindings file »
//        (conséquence directe de `npm ci --ignore-scripts`)
//   4. + `npm rebuild better-sqlite3`          -> Up, GET /api/health = 200
//      image 456 MB, build 11 s à chaud / ~75 s à froid.

import { describe, test, expect } from '@jest/globals';
import { readFileSync, existsSync } from 'fs';
import { dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../..');
const dockerfile = readFileSync(join(ROOT, 'Dockerfile'), 'utf8');

/** Chemins sources de chaque `COPY <src> <dst>` hors `COPY --from=`. */
function copySources(text) {
  const out = [];
  for (const line of text.split('\n')) {
    const m = line.match(/^COPY\s+(?!--from=)(\S+)\s+\S+\s*$/);
    if (m) out.push(m[1]);
  }
  return out;
}

describe('L11 §B04 — le Dockerfile ne se construit pas', () => {
  const sources = copySources(dockerfile);

  test('COPY locales/ désigne un répertoire qui n\'existe pas (build FAIL, F-118)', () => {
    expect(sources).toContain('locales/');
    // Les locales vivent sous public/locales/ — déjà copiées par COPY public/.
    expect(existsSync(join(ROOT, 'locales'))).toBe(false);
    expect(existsSync(join(ROOT, 'public/locales'))).toBe(true);
    // À INVERSER après correctif : plus aucun COPY ne doit pointer dans le vide.
  });

  test('shared/ est importé par le runtime mais jamais copié (crash au boot, F-118)', () => {
    const wsQueue = readFileSync(join(ROOT, 'src/api/WsOutputQueue.js'), 'utf8');
    expect(wsQueue).toMatch(/from '\.\.\/\.\.\/shared\/BinaryFrameCodec\.js'/);
    expect(existsSync(join(ROOT, 'shared/BinaryFrameCodec.js'))).toBe(true);
    expect(sources).not.toContain('shared/');
  });

  test('assets/ (soundfont), scripts/ (update.sh, hotspot.sh) et config.json ne sont pas copiés', () => {
    expect(sources).not.toContain('assets/');
    expect(sources).not.toContain('scripts/');
    expect(sources).not.toContain('config.json');
    // Conséquences : pas de soundfont par défaut, `system_update` renvoie
    // « Update script not found », `hotspot.sh` absent, et la configuration
    // livrée est silencieusement remplacée par getDefaultConfig().
    const sysCmds = readFileSync(join(ROOT, 'src/api/commands/SystemCommands.js'), 'utf8');
    expect(sysCmds).toMatch(/Update script not found or not executable/);
  });

  test('`npm ci --ignore-scripts` prive l\'image des bindings better-sqlite3 (F-119)', () => {
    expect(dockerfile).toMatch(/npm ci --omit=dev --ignore-scripts/);
    // Aucune étape ne recompile ni ne télécharge le binding ensuite.
    expect(dockerfile).not.toMatch(/npm rebuild/);
    expect(dockerfile).not.toMatch(/prebuild-install/);
    // Et le paquet est bien une dépendance de production obligatoire.
    const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
    expect(pkg.dependencies['better-sqlite3']).toBeDefined();
  });

  test("l'étage runtime installe libasound2 alors qu'aucun module natif MIDI n'est compilé", () => {
    expect(dockerfile).toMatch(/libasound2/);
    // libasound2 (runtime) est inutile sans le module `midi`, qui n'est jamais
    // bâti à cause de --ignore-scripts : ~30 Mo de couche pour rien.
  });
});

describe('L11 §B04 — cohérence docker-compose ↔ Dockerfile', () => {
  const compose = readFileSync(join(ROOT, 'docker-compose.yml'), 'utf8');

  test('la limite mémoire du conteneur égale le plafond de tas V8 (F-120)', () => {
    expect(compose).toMatch(/memory:\s*512M/);
    expect(dockerfile).toMatch(/ENV NODE_HEAP_MB=512/);
    // 512 Mo de tas V8 DANS 512 Mo de conteneur : RSS = tas + heap natif +
    // buffers + code. L'OOM-killer arrive avant la limite V8.
  });

  test('aucun volume ne persiste dist/ ni public/lib : le repli CDN survit aux redémarrages', () => {
    expect(compose).toMatch(/gmboop-data:\/app\/data/);
    expect(compose).not.toMatch(/\/app\/public\/lib/);
    expect(compose).not.toMatch(/\/app\/dist/);
  });
});

describe('L11 §B03 — PM2 et systemd divergent', () => {
  const eco = readFileSync(join(ROOT, 'ecosystem.config.cjs'), 'utf8');
  const install = readFileSync(join(ROOT, 'scripts/Install.sh'), 'utf8');

  test('Install.sh installe un service systemd, jamais PM2 sur Linux (F-124)', () => {
    // PM2 est installé globalement (étape 3) puis n'est utilisé que sur macOS.
    expect(install).toMatch(/sudo npm install -g pm2/);
    expect(install).toMatch(/\/etc\/systemd\/system\/gmboop\.service/);
    const macosBlock = install.slice(install.indexOf('elif [ "$OS" == "macos" ]', install.indexOf('print_step "8.')));
    expect(macosBlock).toMatch(/pm2 start ecosystem\.config\.cjs/);
  });

  test("l'unité systemd n'applique aucun des réglages mémoire d'ecosystem.config.cjs (F-124)", () => {
    expect(eco).toMatch(/--max-old-space-size=\$\{HEAP_MB\}/);
    expect(eco).toMatch(/max_memory_restart/);
    // L'unité écrite par Install.sh est un `ExecStart=$NODE_PATH server.js`
    // nu : ni --max-old-space-size, ni --expose-gc, ni EnvironmentFile=.env.
    const unit = install.slice(install.indexOf('[Unit]'), install.indexOf('[Install]'));
    expect(unit).toMatch(/ExecStart=\$NODE_PATH \$WORKING_DIR\/server\.js/);
    expect(unit).not.toMatch(/max-old-space-size/);
    expect(unit).not.toMatch(/EnvironmentFile/);
  });

  test('update.sh sait redémarrer PM2 ET systemd, mais suppose un sudo sans mot de passe non installé (F-123)', () => {
    const update = readFileSync(join(ROOT, 'scripts/update.sh'), 'utf8');
    expect(update).toMatch(/sudo -n systemctl restart gmboop/);
    // Install.sh n'écrit AUCUNE règle sudoers pour systemctl : seules
    // hciconfig/rfkill (bluetooth) et hotspot.sh sont autorisées sans mot
    // de passe. Le redémarrage systemd d'une mise à jour échoue donc, et
    // le script retombe sur le chemin « kill par port + node nu ».
    expect(install).toMatch(/NOPASSWD: \/usr\/bin\/hciconfig hci0 up/);
    expect(install).toMatch(/NOPASSWD: \$HOTSPOT_SCRIPT/);
    expect(install).not.toMatch(/NOPASSWD:.*systemctl/);
  });
});
