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
- **Règle de versions des contrats WS** :
  - compatibilité backward par défaut ;
  - en cas de rupture nécessaire, introduire une commande/route `v2` de manière **additive** ;
  - dépréciation annoncée dans le changelog avec date cible de retrait.
- **Règle ADR** : toute décision structurante (choix Repository, frontières de service, ports/adapters ciblés, introduction d'un pattern) fait l'objet d'une note `docs/adr/ADR-00X-<titre>.md` (voir §12).

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

## 10. Garde-fous d'exécution

### 10.1 Périmètre IN / OUT par phase (anti-dérive)

Chaque PR de refactor doit expliciter ce qui est autorisé et ce qui est interdit :

- **IN (autorisé)**
  - extraction, déplacement, renommage de modules ;
  - factorisation de logique existante ;
  - ajout de tests de contrat / non-régression ;
  - amélioration de la documentation technique.
- **OUT (interdit)**
  - changement fonctionnel observable ;
  - changement de schéma SQL (sauf exception validée, voir §7) ;
  - changement de protocole WebSocket côté client sans versionnement explicite ;
  - introduction d'une dépendance npm / d'un nouveau pattern sans ADR.

### 10.2 Definition of Ready / Definition of Done

**DoR (avant de commencer un lot)** :
- contrats d'API concernés identifiés (snapshot payload existant) ;
- cas nominaux et cas d'erreur listés ;
- stratégie de test minimale définie (contrat + intégration si persistance touchée).

**DoD (lot considéré terminé)** :
- snapshots de contrats WS inchangés (ou changement documenté et approuvé) ;
- logs opérationnels inchangés sur le parcours critique ;
- rollback simple possible (revert PR sans migration) ;
- ADR mise à jour si la décision a bougé.

### 10.3 Stratégie de test par niveaux

Hiérarchie des tests à couvrir, dans l'ordre de priorité :

1. **Tests de contrat WS** (payload in/out) — priorité absolue, bloquant P0.
2. **Tests de services domaine** — sans WS ni DB réelle, via mocks/stubs (Jest).
3. **Tests d'intégration persistence** — SQLite réel sur scénarios split / no-split / overwrite.
4. **Tests de performance ciblés** — temps de traitement, mémoire, latence sur les flux playback/adaptation (s'appuyer sur `tests/performance/benchmark.js`).

### 10.4 KPI chiffrés de pilotage

Cibles mesurables pour suivre la valeur produite :

| KPI | Cible | Source |
|---|---|---|
| Réduction taille des god files P0 | **-40 % minimum** | `wc -l` sur fichiers §2 |
| Couverture zones P0/P1 | **+15 points** (baseline ~20 %) | `npm run test:coverage` |
| Commandes WS critiques couvertes par tests de contrat | **≥ 90 %** | Inventaire `docs/refactor/contracts/` |
| PR refactor sans incident post-merge (14 j) | **≥ 95 %** | Suivi incidents |

## 11. Protocole de découpage des modules frontend massifs

Pour éviter les refactors frontend « esthétiques » sans gain structurel, appliquer systématiquement ce protocole en 5 étapes aux composants > 1000 LOC (`RoutingSummaryPage.js`, `MidiEditorCCPanel.js`, `MidiEditorTablature.js`, `MidiSynthesizer.js`, `CCPitchbendEditor.js`) :

1. extraire les constantes / configuration ;
2. extraire les accès API (vers `shared/api`) ;
3. extraire la logique d'état ;
4. extraire le rendu UI en sous-composants ;
5. conserver un orchestrateur léger au-dessus.

## 12. Matrice des dépendances critiques

À produire en Phase 0 puis mettre à jour à chaque sprint. Objectif : objectiver la baisse de couplage.

Modules à tracer :

**Backend** — `PlaybackCommands`, `MidiPlayer`, `InstrumentMatcher`, `Database`, `MidiRouter`.
**Frontend** — `RoutingSummaryPage`, `MidiEditorCCPanel`, `MidiEditorTablature`, `MidiSynthesizer`.

Format (par module) : *dépendances directes* → *dépendances à réduire* → *cible en fin de phase*.

Livré sous `docs/refactor/dependency-matrix.md`.

## 13. Architecture Decision Records (ADR)

Chaque décision structurante produit une note ADR courte sous `docs/adr/ADR-00X-<titre>.md`, format :

- **Contexte** — pourquoi la décision se pose maintenant ;
- **Options considérées** — 2 à 4 alternatives réalistes ;
- **Décision** — l'option retenue ;
- **Impacts / compromis** — ce qu'on gagne, ce qu'on sacrifie ;
- **Plan de rollback** — comment revenir en arrière si besoin.

ADR attendus dès le début du chantier :
- `ADR-001-refactor-strategy.md` — décision officielle hybride V2→V3.
- `ADR-002-repository-layer.md` — choix du pattern Repository au-dessus des sub-DBs existantes.
- `ADR-003-ws-contract-versioning.md` — règles de versionnement des contrats WebSocket.

## 14. Ordonnancement opérationnel indicatif (12 semaines)

| Semaines | Phase | Contenu |
|---|---|---|
| S1–S2 | Phase 0 | Baseline contrats WS, checklist, instrumentation minimale, matrice dépendances v1 |
| S3–S5 | Phase 1 | Playback + cluster MIDI adaptation (Tablature, Drum, Channel, Matcher, Transposer) |
| S6–S7 | Phase 2 | Repositories au-dessus des sub-DBs existantes (pas de migration SQL) |
| S8–S9 | Phase 3 | Validation déclarative + erreurs normalisées |
| S10–S12 | Phase 4 | Domaines étendus + ports/adapters ciblés (drivers hardware, transport WS) |

Cadence : lots de **2–5 jours max**, PR petites et auditées. Ne **pas lancer deux lots à haut risque production en parallèle**.

## 15. Priorisation des lots

Quand plusieurs lots sont candidats, prioriser selon :

```
Priorité = (Risque production × Impact utilisateur × Fréquence de changement) / Effort
```

Chaque facteur noté 1–5. Le lot avec le score le plus élevé passe en premier, sauf si le backlog contient déjà un lot à haut risque actif.

## 16. Plan de rollback type par lot

Chaque PR de refactor inclut, dans la description :

1. **Commande(s) / parcours à surveiller post-merge** (ex. `playback.start`, assignations).
2. **Indicateurs d'alerte** : erreurs WS, temps de réponse, logs d'exception via `src/core/Logger.js`.
3. **Procédure de rollback en une étape** : `git revert <sha>` + redéploiement ; aucune migration à défaire.
4. **Vérification post-rollback** : re-jouer les tests de contrat critiques concernés.

## 17. Livrables documentaires de la prochaine itération

Une fois ce plan validé comme référence d'équipe, les trois livrables suivants sont produits avant la Phase 0 :

1. `docs/refactor/contracts/README.md` — méthode de génération des snapshots WS (outil, format, revue).
2. `docs/refactor/batch-plan.md` — backlog priorisé des lots S1→S12, avec owner estimé par lot.
3. `docs/adr/ADR-001-refactor-strategy.md` — décision officielle : hybride V2→V3, principes V4 sur zones à couplage infra fort.

## 18. Prochaines actions immédiates

1. Valider ce document comme référence d'équipe.
2. Ouvrir une issue *« Phase 0 — Baseline sécurité »* (contrats WS + tests + checklist).
3. Produire `ADR-001-refactor-strategy.md`.
4. Préparer un premier lot *« Playback : découpage par sous-modules »* — **sans changement fonctionnel**.
