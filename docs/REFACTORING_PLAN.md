# Plan de refactorisation — Ma-est-tro

> Fichier de référence versionné pour piloter la refactorisation du code.
> Complète `docs/ARCHITECTURE.md` (architecture cible) en décrivant le chemin
> incrémental pour y arriver à partir de l'existant.

## 1. Contexte et objectifs

Ma-est-tro est en production et fonctionne, mais plusieurs modules sont devenus
des "god files" où se mélangent transport API, orchestration métier, adaptation
MIDI et persistance. Cette dette structurelle augmente le risque de régression
et ralentit la roadmap produit.

Objectifs :
- réduire le risque de régression en refactorisant **progressivement** ;
- clarifier les responsabilités pour accélérer les futures évolutions ;
- conserver **100 % des fonctionnalités actuelles** (aucun changement de
  comportement observable) ;
- rendre testable chaque bloc métier critique.

Contraintes :
- pas de réécriture big-bang ;
- priorité à la robustesse et à la simplicité ;
- chaque étape doit être livrable indépendamment ;
- **freeze du schéma SQL** pendant tout le chantier (voir §7).

## 2. État actuel du code

Une partie importante de l'infrastructure transverse est **déjà en place** et
doit être **réutilisée** — pas recréée :

| Brique existante | Fichier / dossier | Usage dans le refactor |
|---|---|---|
| Hiérarchie d'erreurs typée | `src/core/errors/index.js` | Référence unique pour la normalisation des erreurs (Phase 3) |
| Validation centralisée | `src/utils/JsonValidator.js` (447 LOC) | Base à étendre vers des schémas déclaratifs par commande (Phase 3) |
| Container DI | `src/core/ServiceContainer.js` | Composition root déjà existante (`Application.js`) |
| Bus d'événements | `src/core/EventBus.js` | Couplage lâche entre domaines, à réutiliser |
| Dispatch API | `src/api/CommandRegistry.js`, `src/api/CommandHandler.js` | Auto-discovery des modules de commandes |
| Sub-DBs par domaine | `src/storage/{MidiDatabase, RoutingPersistenceDB, InstrumentDatabase, InstrumentSettingsDB, DeviceSettingsDB, LightingDatabase, StringInstrumentDatabase}.js` | Socle pour la consolidation en Repositories (Phase 2) |
| Logger structuré | `src/core/Logger.js` | Base pour l'observabilité métier (Phase 4) |
| Docs d'architecture | `docs/ARCHITECTURE.md` | Reflète la cible ; ce document décrit le chemin |
| Outillage tests | Jest (backend) + Vitest (frontend) + Husky | Support de la baseline (Phase 0) |

**Points de friction identifiés** (mesures à titre indicatif) :

Backend — god files :
- `src/api/commands/PlaybackCommands.js` — ~1124 LOC (20+ handlers dans un seul fichier)
- `src/midi/MidiPlayer.js` — ~1312 LOC (scheduling + routing + tous les modes de lecture)
- `src/midi/InstrumentMatcher.js` — ~1178 LOC (algorithme de matching)
- `src/midi/TablatureConverter.js` — ~1250 LOC
- `src/midi/DrumNoteMapper.js` — ~947 LOC
- `src/midi/ChannelSplitter.js` — ~871 LOC
- `src/storage/Database.js` — ~1009 LOC (40 migrations)

Frontend — poids lourds :
- `public/js/views/components/auto-assign/RoutingSummaryPage.js` — ~4748 LOC
- `public/js/views/components/midi-editor/MidiEditorCCPanel.js` — ~1329 LOC
- `public/js/views/components/midi-editor/MidiEditorTablature.js` — ~1307 LOC
- `public/js/audio/MidiSynthesizer.js` — ~1192 LOC
- MIDI editor composé via un pattern **mixins** (`MidiEditorModal` + ~12 mixins)

Couverture de tests actuelle estimée : ~15–20 % des fichiers source.

## 3. Stratégie retenue

**Hybride progressif** : stabilisation ciblée des modules critiques
(approche "V2"), puis découpage par capacités métier (approche "V3"), avec
application de principes **ports/adapters** uniquement sur les zones les plus
couplées à l'infrastructure (DB, WS, drivers hardware).

Justification : meilleur équilibre délai/risque/valeur, compatible avec
l'existant, gains immédiats sans bloquer la roadmap.

Principes directeurs :
- **règle de dépendance** : `api → domain → infra`, jamais l'inverse ;
- **pas d'accès direct DB** depuis `api/commands` ;
- les handlers API ne font que : **validation → appel service → mapping réponse** ;
- chaque PR de refactor est **comportement-neutre** (tests de contrat prouvent l'absence de régression).

## 4. Cartographie priorisée

### P0 — Immédiat

1. **PlaybackCommands** (`src/api/commands/PlaybackCommands.js`)
   - Symptômes : responsabilités multiples (play/pause/seek/loop, analyse, assignations, validation routing).
   - Risque : régressions silencieuses à chaque changement.

2. **Cluster MIDI adaptation**
   - Fichiers : `src/midi/{TablatureConverter, DrumNoteMapper, ChannelSplitter, InstrumentMatcher, Transposer}.js`.
   - Sous-domaine distinct à isoler comme service métier cohérent (`MidiAdaptationService`).

3. **Frontière API ↔ métier**
   - Symptômes : logique métier dans les handlers, duplications entre commandes.
   - Cible : handlers minces, services appelables indépendamment de WebSocket.

4. **Persistance routings / assignations**
   - Règles de persistance disséminées entre handlers, `MidiRouter`, `RoutingPersistenceDB`.
   - Risque : incohérences de données.

### P1 — Court terme

5. **Validation** — extension de `JsonValidator` vers des schémas déclaratifs par commande ; suppression des validations ad hoc dans les handlers.
6. **Erreurs** — normalisation des usages de `ApplicationError` (`src/core/errors/`) : mêmes codes, mêmes messages, mêmes champs exposés côté client.
7. **Découplage via interfaces de services** — réduire les dépendances directes à `app.*` en faveur d'injection explicite.

### P2 — Moyen terme

8. **Frontend feature-based** — démarrer par `RoutingSummaryPage.js` (~4748 LOC) et la famille MIDI editor (`MidiEditorCCPanel`, `MidiEditorTablature`, mixins `MidiEditorModal`).
9. **Tests de contrat** — snapshots des payloads WS + non-régression des réponses critiques.
10. **Observabilité métier** — logs corrélés par commande/session + métriques sur flux playback/routing, via `Logger` et `EventBus` existants.

## 5. Structure cible

### Backend — évolution à partir du layout réel

Plutôt qu'un déplacement big-bang vers `src/domain/` et `src/infra/`, le
refactor loge progressivement le domaine métier **sous les modules existants** :

```text
src/
  api/
    commands/
      playback/        # ex-PlaybackCommands.js éclaté
        PlaybackCommandHandlers.js
        PlaybackValidators.js
      routing/
      devices/
      files/
    CommandRegistry.js
    CommandHandler.js

  midi/
    domain/            # services métier extraits des god files
      playback/
        PlaybackService.js
        PlaybackRoutingService.js
        AssignmentService.js
        MidiAdaptationService.js
      routing/
        RoutingService.js
        RoutingPolicy.js
      instruments/
        InstrumentCapabilityService.js
    # fichiers bas niveau existants conservés (MidiPlayer, DeviceManager, etc.)

  storage/
    repositories/      # consolidation progressive des sub-DBs
      FileRepository.js       # s'appuie sur MidiDatabase
      RoutingRepository.js    # s'appuie sur RoutingPersistenceDB + MidiRouter
      InstrumentRepository.js # s'appuie sur InstrumentDatabase + InstrumentSettingsDB
    # sub-DBs existantes conservées comme back-end des repositories

  core/                # inchangé : errors, EventBus, Logger, ServiceContainer
  utils/               # JsonValidator étendu
```

### Frontend — évolution progressive vers feature-based

```text
public/js/
  features/
    playback/
    routing/           # accueille la décomposition de RoutingSummaryPage
    instruments/
    midi-editor/       # recompose les mixins actuels en modules explicites
  core/                # BaseView/BaseController/BaseModal/EventBus (existant)
  shared/
    api/               # BackendAPIClient mutualisé (existant)
    utils/
```

Règles :
- composants orientés feature ;
- pas de dépendance circulaire entre features ;
- clients API mutualisés sous `shared/api/`.

## 6. Plan phasé exécutable

### Phase 0 — Baseline sécurité (1 sprint)

- Figer les signatures des commandes WS critiques (contrats entrée/sortie).
- Ajouter des tests de non-régression sur playback / routing / assignation en s'appuyant sur l'outillage existant (Jest backend, Vitest frontend).
- Checklist de refactor : *no behavior change, payload stable, logs stables*.

**Livrables** : dossier `docs/refactor/contracts/` avec snapshots de payloads, tests Jest/Vitest de contrat.

### Phase 1 — Stabilisation Playback + MIDI adaptation (1–2 sprints)

- Découper `PlaybackCommands.js` en sous-modules :
  - *playback control* (start/stop/seek/loop) ;
  - *analysis / suggestions* ;
  - *assignment apply* ;
  - *routing validation*.
- Extraire le **cluster MIDI adaptation** (Tablature / Drum / Channel / Matcher / Transposer) vers `src/midi/domain/playback/MidiAdaptationService.js` et services voisins.
- Garder un adaptateur mince côté `api/commands`.

**Critères d'acceptation** :
- aucune modification de payload de réponse ;
- parcours critiques couverts (start / stop / apply assignments / validate routing) ;
- réduction de taille du module initial **> 40 %**.

### Phase 2 — Persistance : consolidation en Repositories (1 sprint)

- Introduire `FileRepository`, `RoutingRepository`, `InstrumentRepository` **au-dessus** des sub-DBs existantes (`MidiDatabase`, `RoutingPersistenceDB`, `InstrumentDatabase`, `InstrumentSettingsDB`).
- Centraliser les transactions et rollbacks dans la couche de persistance.
- Supprimer la logique SQL/DB disséminée dans les handlers.

**Critères d'acceptation** :
- toutes les écritures de routing passent par un repository unique ;
- tests d'intégration DB couvrant split / no-split / overwrite ;
- **aucune nouvelle migration SQL** (voir §7 — freeze schéma).

### Phase 3 — Validation et erreurs (1 sprint)

- Étendre `JsonValidator` vers des **schémas déclaratifs** par commande.
- Normaliser les erreurs remontées par les handlers sur la hiérarchie de `src/core/errors/index.js` (mêmes codes, mêmes messages).
- Garantir des messages stables et exploitables côté UI.

**Critères d'acceptation** :
- format d'erreur homogène sur toutes les commandes ;
- disparition des validations ad hoc redondantes.

### Phase 4 — Domaines + ports/adapters ciblés (2+ sprints)

- Généraliser le découpage par domaines (routing, devices, files, instruments).
- Appliquer **ports/adapters** uniquement là où le couplage infra est le plus fort (drivers MIDI série/BLE, LightingManager, NetworkManager).
- Documenter l'ownership de chaque domaine dans `docs/ARCHITECTURE.md`.

**Critères d'acceptation** :
- réduction nette des imports transverses ;
- temps moyen de modification d'une feature en baisse ;
- baisse des incidents de régression sur commandes critiques.

## 7. Gouvernance

- **Règle PR** : une PR = un bloc cohérent (pas de mélange backend/frontend/DB sans nécessité).
- **Règle tests** : toute extraction doit être couverte au minimum par un test de contrat (payload in / payload out).
- **Règle doc** : toute nouvelle structure est reflétée dans `docs/ARCHITECTURE.md`.
- **Règle migration / freeze schéma** : pendant toute la durée du refactor, **pas de nouvelle migration SQL** (`migrations/001…040` existants) sauf justification explicite documentée en PR. Les repositories s'adaptent au schéma actuel.
- **Règle comportement** : pas de changement de comportement observable sans feature flag ou décision explicite et documentée.
- **Règle réutilisation** : avant d'introduire un nouveau helper, vérifier l'absence d'équivalent dans `src/core/`, `src/utils/`, `src/storage/`.

## 8. Risques et mitigation

1. **Régression fonctionnelle** — mitigation : tests de contrat (Phase 0) + déploiement progressif.
2. **Ralentissement roadmap** — mitigation : lots courts (2–5 jours) avec valeur visible.
3. **Big-bang de layout** (déplacements massifs de fichiers) — mitigation : déplacements incrémentaux, domaines logés sous les modules existants avant toute réorganisation transverse.
4. **Divergence backend/frontend** — mitigation : versionner les contrats WS dans `docs/refactor/contracts/` et valider côté CI.
5. **Recréation accidentelle de briques existantes** (validation, erreurs, DI) — mitigation : §2 "État actuel du code" + revue PR explicite.

## 9. Définition de succès

Le plan est considéré réussi si, à l'issue des phases 0–4 :
- les god files listés au §2 sont décomposés, aucun fichier métier > ~600 LOC dans les zones P0 ;
- les commandes WS gardent les mêmes comportements observables (snapshots de contrats verts) ;
- la couverture de tests sur les zones P0/P1 dépasse nettement l'état initial (~15–20 %) ;
- ajouter une feature playback/routing demande moins de temps et comporte moins de risque qu'avant le chantier.
