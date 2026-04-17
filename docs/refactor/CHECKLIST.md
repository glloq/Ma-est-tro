# Checklist de refactor — Ma-est-tro

> Checklist obligatoire pour chaque lot de refactorisation.
>
> Référence plan : [`REFACTORING_PLAN.md`](../REFACTORING_PLAN.md) §10
> (garde-fous d'exécution).
> À lire conjointement avec [`AGENT_ROUTINE.md`](./AGENT_ROUTINE.md).

## Règle d'or

**No behavior change, payload stable, logs stables.**

Si un point de la checklist ne peut pas être coché, **ne pas committer**.
Soit le lot est trop large (le découper), soit une décision structurante
est nécessaire (produire un ADR — plan §13).

---

## 1. Avant de démarrer (Definition of Ready)

- [ ] Le lot est identifié par un ID (`P0-X.Y`) et référencé dans
      [`PROGRESS.md`](./PROGRESS.md) §Todos.
- [ ] Le périmètre IN (ce qui bouge) est listé, en une ligne par fichier.
- [ ] Le périmètre OUT (ce qui ne bouge pas) est explicite — aucun
      « nettoyage » opportuniste hors lot.
- [ ] Les contrats des commandes WS impactées existent dans
      `docs/refactor/contracts/` (ou le premier livrable du lot est de
      les produire).
- [ ] Les cas nominaux et les cas d'erreur sont listés.
- [ ] La stratégie de test est décidée : contrat WS, service domaine,
      intégration DB (plan §10.3).
- [ ] Le lot tient dans **2–5 jours de travail**. Sinon → le découper.

## 2. Pendant l'exécution (règles IN/OUT du plan §10.1)

### Autorisé (IN)

- [ ] Extraction / déplacement / renommage de modules existants.
- [ ] Factorisation de logique déjà présente.
- [ ] Ajout de tests de contrat ou de non-régression.
- [ ] Amélioration de la documentation technique.

### Interdit (OUT) sans ADR validé

- [ ] **Aucun** changement fonctionnel observable côté client.
- [ ] **Aucune** nouvelle migration SQL (plan §7, freeze actif).
- [ ] **Aucune** nouvelle dépendance npm.
- [ ] **Aucun** nouveau pattern (DI décorateurs, schema validator externe,
      etc.) sans ADR préalable.
- [ ] **Aucun** changement de protocole WebSocket côté client sans
      versionnement explicite (`v2:command`).

### Réutilisation avant création (plan §2)

- [ ] Vérifier que le besoin n'est pas déjà couvert par :
    - `src/core/errors/index.js` (`ValidationError`, `NotFoundError`,
      `ConfigurationError`, `MidiError`, etc.)
    - `src/utils/JsonValidator.js` (validation des commandes WS)
    - `src/core/ServiceContainer.js` (DI)
    - `src/core/EventBus.js` (pub/sub)
    - `src/core/Logger.js` (logs structurés)
    - `src/storage/*` (sub-DBs : MidiDatabase, RoutingPersistenceDB,
      InstrumentDatabase, InstrumentSettingsDB, DeviceSettingsDB,
      LightingDatabase, StringInstrumentDatabase)
- [ ] Si un helper similaire existe, l'étendre plutôt que d'en créer un
      nouveau.

## 3. Tests (plan §10.3)

Niveaux de tests à respecter dans l'ordre de priorité :

- [ ] **Contrat WS** (bloquant P0) : si le lot touche à une commande WS,
      un snapshot `.contract.json` existe et un test Jest le vérifie dans
      `tests/contracts/<domaine>.contract.test.js`.
- [ ] **Service domaine** : si le lot extrait un service, un test unitaire
      le couvre avec des mocks/stubs (Jest).
- [ ] **Intégration persistance** : si le lot touche la persistance,
      un test d'intégration SQLite couvre les scénarios split / no-split
      / overwrite.
- [ ] **Performance** : si le lot touche un chemin chaud
      (playback tick, scheduling, routing), un benchmark existe ou est
      ajouté (`tests/performance/benchmark.js`).

Commandes :
- [ ] `npm test` passe localement (ou scope ciblé si compilation native
      indisponible).
- [ ] `npm run lint` passe (si configuré pour le projet).
- [ ] Pas de warning nouveau introduit dans la console au démarrage.

## 4. Payload / comportement stable

- [ ] **Snapshots WS verts** : aucun diff inattendu dans les `.contract.json`.
- [ ] Si un snapshot doit évoluer, le changement est **additif** (nouveau
      champ) ; jamais suppression/renommage sans ADR + versionnement.
- [ ] **Logs du parcours critique inchangés** : mêmes niveaux, mêmes
      messages, même ordre (`src/core/Logger.js`).
- [ ] **Codes d'erreur inchangés** : mêmes `ERR_VALIDATION`,
      `ERR_NOT_FOUND`, etc. (réutiliser `src/core/errors/index.js`).

## 5. Documentation (plan §7 gouvernance)

- [ ] `docs/ARCHITECTURE.md` reflète toute nouvelle structure introduite.
- [ ] Si une décision est structurante → nouvel ADR
      `docs/adr/ADR-00X-<titre>.md` (plan §13).
- [ ] Si la matrice de dépendances bouge → `docs/refactor/dependency-matrix.md`
      mise à jour en fin de phase.
- [ ] Si un contrat WS évolue → `docs/refactor/contracts/` mis à jour
      **dans le même commit** que le code.

## 6. PROGRESS.md

- [ ] Todo(s) du lot coché(s) `[x]`.
- [ ] Ligne ajoutée dans §Journal (date, agent, lot, résumé, fichiers,
      commit SHA, notes).
- [ ] Nouveaux todos découverts pendant le lot ajoutés.
- [ ] Si décision, blocage, ou écart → note dans §Remarques.
- [ ] §État courant mis à jour : dernier lot, prochain lot suggéré, date,
      agent.
- [ ] Si une métrique LOC ou couverture est mesurable → §Métriques mise
      à jour.

## 7. Commit (plan §16 rollback)

- [ ] Un seul commit pour le lot (pas de mélange avec un autre sujet).
- [ ] Format du message :
      `refactor(<zone>): <résumé bref du lot>  [P0-X.Y]`
- [ ] Description détaillée :
    - Pourquoi (lien vers §Todos / §Remarques de PROGRESS.md).
    - Liste IN (ce qui a changé).
    - Mention explicite **« comportement observable inchangé »**.
    - Tests ajoutés / mis à jour.
- [ ] Rollback simple : `git revert <sha>` seul doit suffire — aucune
      migration à défaire, aucun état externe à remettre.
- [ ] Branche courante respectée (ne pas pousser sur `main`).

## 8. Post-merge (Definition of Done)

- [ ] Snapshots de contrats WS verts en CI.
- [ ] Logs opérationnels inchangés sur le parcours critique (surveiller
      les commandes listées dans le commit).
- [ ] Aucune régression remontée dans les 14 jours → entre dans le KPI
      « PR refactor sans incident » (plan §10.4).
- [ ] Si régression : `git revert <sha>` + re-jouer les tests de contrat
      critiques → plan §16.

---

## Sur quoi s'appuyer en cas de doute

| Question | Référence |
|---|---|
| Quelle phase, quels fichiers ? | [`REFACTORING_PLAN.md`](../REFACTORING_PLAN.md) §4, §5 |
| Est-ce dans IN ou OUT ? | [`REFACTORING_PLAN.md`](../REFACTORING_PLAN.md) §10.1 |
| Stratégie de test ? | [`REFACTORING_PLAN.md`](../REFACTORING_PLAN.md) §10.3 |
| Comment capturer un snapshot WS ? | [`contracts/README.md`](./contracts/README.md) |
| Quelle routine d'agent ? | [`AGENT_ROUTINE.md`](./AGENT_ROUTINE.md) |
| État courant et prochains lots ? | [`PROGRESS.md`](./PROGRESS.md) §État courant, §Todos |
| Décision de fond ? | [`ADR-001-refactor-strategy.md`](../adr/ADR-001-refactor-strategy.md) |
| Module fortement couplé ? | [`dependency-matrix.md`](./dependency-matrix.md) |

## En résumé

> Un lot de refactor est **comportement-neutre, réversible, auditable**.
> Si une case de cette checklist ne peut pas être cochée, **ne pas
> committer**. Soit découper le lot, soit produire un ADR.
