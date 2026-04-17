# Matrice des dépendances critiques — v1

> Snapshot de l'état de couplage au début du chantier de refactorisation
> (2026-04-17). Ce document objective la baisse de couplage attendue à
> chaque phase.
>
> Portée : 5 modules backend + 4 modules frontend cités au
> [`REFACTORING_PLAN.md`](../REFACTORING_PLAN.md) §12.
>
> Format par module : **dépendances directes actuelles → dépendances à
> réduire → cible en fin de phase ciblée**.

## Légende

- **Static imports** : `import ... from ...`, dépendances déclarées en tête de fichier.
- **Runtime deps** : accès via `app.xxx` (locator) ou `this.xxx` (injection constructeur).
- **Implicit globals** (frontend) : accès `window.X` ou `typeof X !== 'undefined'`.
- **Criticité** : H = haute (chemin chaud production), M = moyenne, L = basse.

---

## Backend

### 1. `src/api/commands/PlaybackCommands.js` (1124 LOC, criticité H)

**Static imports (6)** :
- `midi-file` (`parseMidi`) — librairie tierce
- `../../midi/MidiTransposer.js`
- `../../storage/JsonMidiConverter.js`
- `../../midi/InstrumentCapabilitiesValidator.js`
- `../../midi/ScoringConfig.js`
- `../../core/errors/index.js` (4 classes d'erreur)

**Runtime deps (via `app`)** : **74 accès** répartis sur ≥ 6 services :
- `app.midiPlayer` (load/start/stop/pause/seek/routing/split/mute…)
- `app.database` (getFile, getRoutingsByFile, insertRouting, getInstrumentsWithCapabilities, getInstrument, updateInstrument, getFiles, insertFile, updateFile, insertSplitRoutings…)
- `app.deviceManager` (getDeviceList)
- `app.autoAssigner` (analyzeChannel, generateSuggestions)
- `app.fileManager` (extractMetadata, extractInstrumentMetadata)
- `app.logger`

**Dépendances à réduire** : toutes les références directes à
`app.database.*` et `app.midiPlayer.*` dans ce module doivent passer
par des **services domaine** (PlaybackService, AssignmentService,
RoutingService) à introduire en Phase 1/2.

**Cible fin Phase 1 (P0-1.x)** :
- Module scindé en ≤ 4 sous-modules, chacun < 300 LOC.
- Imports services explicites : PlaybackService, AssignmentService,
  RoutingValidationService.
- Plus aucun accès direct à `app.database.*` depuis les handlers.

**Cible fin Phase 2 (P0-2.x)** :
- Persistance uniquement via FileRepository / RoutingRepository.
- Tests de contrat verts, aucun regression WS.

---

### 2. `src/midi/MidiPlayer.js` (1312 LOC, criticité H)

**Static imports (3)** :
- `midi-file` (`parseMidi`)
- `perf_hooks` (`performance`)
- `./PlaybackScheduler.js`

**Runtime deps (via `this`)** : ≥ 49 accès sur ≥ 3 services :
- `this.database` (getFile, etc. — injection constructeur)
- `this.logger`
- `this.scheduler` (PlaybackScheduler)
- champs d'état multiples : `channelRouting`, `channels`, `tracks`,
  `events`, `position`, `duration`, `tempo`, `loop`, `ppq`,
  `_overlapCounters`, `_segmentNoteCounts`, `_alternateCounters`,
  `_overlapNoteAssign`, `outputDevice`, `disconnectedPolicy`…

**Dépendances à réduire** :
- Concentration de plusieurs responsabilités (chargement MIDI,
  scheduling, routing simple, routing split, état lecture) dans un
  seul objet.
- Accès direct à `this.database` → devrait passer par FileRepository
  après Phase 2.

**Cible fin Phase 1 (P0-1.x)** :
- Extraction du cluster MIDI adaptation vers `src/midi/domain/playback/MidiAdaptationService.js`.
- `MidiPlayer` garde scheduling + état ; la logique de split (counters,
  segment assignment) peut être isolée en PlaybackRoutingService.

**Cible fin Phase 2 (P0-2.x)** :
- Plus d'accès direct `this.database` → FileRepository injecté.

---

### 3. `src/midi/InstrumentMatcher.js` (1178 LOC, criticité M)

**Static imports (4)** :
- `../utils/MidiUtils.js`
- `./ScoringConfig.js`
- `./DrumNoteMapper.js`
- `./InstrumentTypeConfig.js`

**Runtime deps** : classe pure (scoring), pas de services injectés.
Reçoit instruments/channels en paramètres.

**Observations** :
- Module déjà bien isolé côté dépendances.
- Le couplage interne est en algorithme de scoring (monolithique).

**Dépendances à réduire** :
- Les 4 imports statiques sont légitimes et restent (config + utils).
- Le vrai gain est à l'intérieur (découper l'algo en stratégies).

**Cible fin Phase 1 (P0-1.6)** :
- Intégration dans `MidiAdaptationService` comme une stratégie parmi
  d'autres (matching) ; API publique stable.

**Cible fin Phase 4** :
- Possibilité d'extraire en sous-classes de stratégie
  (`NoteRangeMatcher`, `ProgramMatcher`, etc.) sans changer les imports
  publics.

---

### 4. `src/storage/Database.js` (1009 LOC, criticité H)

**Static imports (6 locaux + 5 natifs)** :
- `better-sqlite3` (lib tierce)
- `fs`, `path`, `url` (natifs)
- `./MidiDatabase.js`
- `./InstrumentDatabase.js`
- `./LightingDatabase.js`
- `./StringInstrumentDatabase.js`
- `./DeviceSettingsDB.js`
- `./dbHelpers.js`

**Runtime deps** : agrégat — expose 5 sub-databases + 40 migrations +
helpers de build SQL.

**Observations** :
- Sert de façade centrale, utilisé partout (tous les handlers via
  `app.database`).
- Les sub-DBs existent déjà : le refactor doit les **consolider en
  Repositories**, pas les recréer (§2 du plan).

**Dépendances à réduire** :
- Méthodes exposées à tout le monde sans abstraction métier.
- Logique SQL dispersée côté appelants (`insertRouting` depuis les
  handlers, par ex.).

**Cible fin Phase 2 (P0-2.x)** :
- FileRepository / RoutingRepository / InstrumentRepository introduits
  **au-dessus** des sub-DBs existantes.
- Les handlers API n'appellent plus `app.database.*` directement.
- Aucune nouvelle migration SQL (freeze, §7).

**Hors périmètre refactor** : le fichier `Database.js` reste gros tant
que les migrations ne sont pas consolidées (Phase ultérieure, hors
Phase 0–4).

---

### 5. `src/midi/MidiRouter.js` (criticité H)

**Static imports (1)** :
- `../constants.js` (`TIMING`)

**Runtime deps (constructeur)** : injection explicite (deviceManager,
logger, eventBus).

**Observations** :
- Imports très propres — l'un des modules les plus découplés du backend.
- Le gros du couplage est via EventBus (inputs, routage, monitoring).

**Dépendances à réduire** :
- Aucune au niveau imports ; la simplification concerne l'intérieur.

**Cible fin Phase 4** :
- Intégration dans un domaine `routing` avec interface publique
  explicite.
- Séparation éventuelle entre routage (logique) et monitoring
  (observabilité).

---

## Frontend

Le frontend n'utilise **pas** ES modules (pas de `import`) : les
dépendances transitent via `window.X` ou `typeof X !== 'undefined'`.
Cela rend le graphe implicite et non auditable statiquement — un des
objectifs de la Phase 2-frontend est de passer en modules ES explicites.

### 6. `public/js/views/components/auto-assign/RoutingSummaryPage.js` (4748 LOC, criticité H)

**Static imports** : aucun (IIFE).

**Globals implicites utilisés** :
- `i18n` (testé via `typeof`) — internationalisation.
- probablement : `BackendAPIClient`, `AutoAssignModal` et autres
  mixins voisins (non audité exhaustivement à v1 — cible P2-F.2).

**Dépendances à réduire (protocole §11 du plan)** :
1. constantes & configuration (P2-F.1)
2. accès API (vers `shared/api/`) (P2-F.2)
3. logique d'état (P2-F.3)
4. rendu UI en sous-composants (P2-F.4)
5. orchestrateur léger (P2-F.5)

**Cible fin Phase 2-frontend** : ≤ 2850 LOC (–40 %) distribués sur
plusieurs fichiers sous `public/js/features/routing/`.

---

### 7. `public/js/views/components/midi-editor/MidiEditorCCPanel.js` (1329 LOC, criticité M)

**Static imports** : aucun (IIFE).

**Globals implicites** :
- `MidiEditorCCPanel` exposé sur `window`.
- Dépendances transversales dans le pattern mixins de `MidiEditorModal`
  (MidiEditorCC, MidiEditorCCPicker, etc. — ~12 mixins).

**Dépendances à réduire** : idem protocole §11 + clarification du pattern
mixins (P2-F.10).

**Cible fin Phase 2-frontend (P2-F.6)** : découpage en modules explicites,
< 800 LOC par fichier, dépendances nommées.

---

### 8. `public/js/views/components/midi-editor/MidiEditorTablature.js` (1307 LOC, criticité M)

**Static imports** : aucun (IIFE).

**Globals implicites** :
- `MidiEditorChannelPanel`, `WindInstrumentDatabase` (testés via `typeof`).
- `MidiEditorTablatureMixin` exposé sur `window`.

**Dépendances à réduire** :
- Accès `typeof X !== 'undefined'` révèle un couplage implicite :
  cible P2-F.7 = expliciter chaque dépendance.

**Cible fin Phase 2-frontend (P2-F.7)** : modules ES, dépendances
injectées, < 800 LOC par fichier.

---

### 9. `public/js/audio/MidiSynthesizer.js` (1192 LOC, criticité M)

**Static imports** : aucun (IIFE).

**Globals implicites** :
- `window.AudioContext || window.webkitAudioContext` — Web Audio API
  (légitime).
- `window.MidiSynthesizer` exposé.

**Dépendances à réduire** :
- Contient à la fois la synthèse audio (WebAudio), la gestion des
  voix, et l'interface MIDI — candidate pour découpage par
  responsabilité (synthèse / gestion des voix / adaptation MIDI).

**Cible fin Phase 2-frontend (P2-F.8)** : < 700 LOC par fichier,
séparation claire audio vs. MIDI.

---

## Synthèse du couplage à réduire

| Zone | Symptôme | Phase cible |
|---|---|---|
| Handlers `api/commands` → `app.database.*` | accès SQL dispersés | Phase 2 (Repositories) |
| Handlers `api/commands` → `app.midiPlayer.*` | logique métier dans les handlers | Phase 1 (services playback) |
| `app.*` locator pattern | dépendances implicites non testables | Phase 3 (injection explicite) |
| Frontend `typeof X !== 'undefined'` | graphe de dépendances invisible | Phase 2-frontend (modules ES) |
| Mixins de `MidiEditorModal` | composition implicite | P2-F.10 (modules explicites) |
| `Database.js` migrations | 40 migrations + base64→BLOB | hors scope 0–4 (à consolider plus tard) |

## Mise à jour

Ce document est **vivant** : chaque fin de phase met à jour les colonnes
« dépendances à réduire » et « cible atteinte » pour chaque module,
et mesure la réduction du couplage (nombre d'accès `app.*`, taille
LOC, imports transverses).

Prochaine mise à jour prévue : fin de Phase 1 (après lot P0-1.x),
avec comparaison avant/après.
