# Rapport de Préparation d'Audit Système - Ma-est-tro v5.0.0

| Champ | Valeur |
|-------|--------|
| **Projet** | Ma-est-tro - Système d'Orchestration MIDI |
| **Version** | 5.0.0 |
| **Date** | 2026-03-24 |
| **Type d'audit** | Conformité & Bonnes Pratiques |
| **Standards** | 12-Factor App, Clean Architecture, SOLID, DRY, KISS, OWASP Top 10 |
| **Périmètre** | Backend (67 fichiers ~20 834 lignes), Frontend (48 fichiers), 22 migrations, 15 modules de commandes |

---

## Résumé Exécutif

Ma-est-tro est un système d'orchestration MIDI temps réel conçu pour Raspberry Pi, basé sur Node.js/Express avec une base SQLite et une interface web SPA en vanilla JavaScript. Ce rapport évalue la conformité du projet aux bonnes pratiques industrielles selon trois domaines.

### Scores Globaux

| Domaine | Score | Statut |
|---------|-------|--------|
| Architecture & Code | 2.1 / 4 | ORANGE |
| Infrastructure & Déploiement | 0.9 / 4 | ROUGE |
| Tests & Qualité | 0.8 / 4 | ROUGE |

### Top 5 des Constats Critiques

1. **Aucun pipeline CI/CD** — Pas de GitHub Actions, pas de vérification automatique sur PR, pas de déploiement automatisé
2. **Couverture de tests à ~4.5%** — 3 suites de tests sur 67 fichiers backend, 0 tests frontend, pas de rapport de couverture configuré
3. **Aucune authentification** — Ni HTTP ni WebSocket ne sont protégés ; `systemRestart` et `systemShutdown` accessibles à tout le réseau
4. **Configuration non conforme 12-Factor** — `config.json` commité dans le dépôt, `dotenv` installé mais jamais importé, aucune variable d'environnement utilisée
5. **ESLint installé sans configuration** — Aucun fichier `.eslintrc.*` ni `eslint.config.*`, linting totalement inopérant

---

## Domaine 1 : Architecture & Code

**Score global : 2.1 / 4 — ORANGE**

### 1.1 Structure & Organisation du Projet

**État actuel :** Le projet présente une séparation de domaines propre sous `/src/` avec des répertoires dédiés : `midi/`, `managers/`, `storage/`, `api/`, `core/`, `lighting/`, `audio/`, `config/`, `utils/`. Les 15 modules de commandes sont auto-découverts par `CommandRegistry.js`. Le frontend SPA est organisé sous `/public/js/` avec `core/`, `views/`, `api/`, `utils/`.

**Conformité :** Bon alignement avec Clean Architecture (séparation par domaine). Violation partielle : pas de distinction claire entre couches `domain/` et `application/`.

**Écarts identifiés :**
- Aucune règle d'import enforçant les frontières entre couches — tout module peut importer n'importe quel autre
- `Database.js` (574 lignes) est un God Object délégant vers des sous-modules mais exposant 50+ méthodes publiques

**Fichiers clés :** `src/core/Application.js` (composition root), `src/api/CommandRegistry.js` (auto-discovery)

**Recommandation [P2] :** Extraire la façade Database en repositories spécifiques par domaine. Ajouter des règles de linting d'imports pour enforcer les frontières entre couches.

### 1.2 Design Patterns & Principes SOLID

**État actuel :** Le projet utilise plusieurs patterns reconnus :
- **Command Pattern** : `CommandRegistry` + 15 modules auto-découverts
- **Observer Pattern** : `EventBus` (74 lignes, minimal et propre)
- **DI Container** : `ServiceContainer` avec résolution lazy et détection de dépendances circulaires
- **Facade** : `DatabaseManager` délégant vers des modules spécialisés

**Évaluation SOLID :**

| Principe | Score | Détail |
|----------|-------|--------|
| **S** — Single Responsibility | Partiel | `Application.js` (350 lignes) cumule composition root, service locator, câblage d'événements et cycle de vie. Les modules de commandes ont un bon SRP (un par domaine). |
| **O** — Open/Closed | Bon | Les modules de commandes sont auto-découverts, on peut en ajouter sans modifier `CommandRegistry`. |
| **L** — Liskov Substitution | N/A | Pas de hiérarchie d'héritage backend. Frontend `BaseView`/`BaseModal` fournissent des contrats corrects. |
| **I** — Interface Segregation | Violé | `DatabaseManager` expose 50+ méthodes à tous les consommateurs. Les services reçoivent l'objet `app` entier plutôt que leurs dépendances spécifiques. |
| **D** — Dependency Inversion | Partiel | `ServiceContainer` existe avec `resolve()`/`inject()` mais `Application.js` crée encore toutes les instances directement. Commentaire ligne 27 : *"new code should use container.resolve() instead of this.xxx"* — migration incomplète. |

**Fichiers clés :** `src/core/ServiceContainer.js` (lignes 1-14, intention bien documentée), `src/core/Application.js` (lignes 72-124, tous les services reçoivent encore `this`)

**Recommandation [P2] :** Compléter la migration DI pour que les services reçoivent leurs dépendances explicites via `container.inject()` au lieu de l'objet Application entier.

### 1.3 Injection de Dépendances & Service Locator

**État actuel :** Approche hybride. `ServiceContainer` supporte la résolution lazy par factory et la détection de dépendances circulaires. Mais `_registerService()` dans `Application.js` enregistre dans `this` ET dans le container pour la rétrocompatibilité. Les 15+ services sont construits avec `new Foo(this)` passant l'Application entière.

**Écart :** C'est l'anti-pattern Service Locator — chaque service peut atteindre n'importe quel autre service via `app.*`.

**Recommandation [P2] :** Refactorer les services pour déclarer explicitement leurs dépendances. Utiliser le pattern `container.inject('logger', 'database')` déjà supporté par `ServiceContainer`.

### 1.4 Gestion des Erreurs & Résilience

**État actuel :** Try-catch dans tous les handlers de commandes. `Application.js` capture `uncaughtException` et `unhandledRejection` (lignes 329-342). `EventBus.emit()` wrappe les callbacks dans des try-catch (ligne 48). Les services optionnels (Bluetooth, Serial, Lighting) échouent gracieusement avec des warnings.

**Écarts identifiés :**
- Pas de types d'erreur structurés (tous des `Error` simples)
- Pas de codes d'erreur pour les réponses API
- Les opérations base de données lancent des erreurs brutes avec uniquement des messages de log
- Pas de logique de retry pour les erreurs transitoires

**Recommandation [P3] :** Créer une hiérarchie d'erreurs (`ApplicationError`, `ValidationError`, `NotFoundError`) avec codes d'erreur. Ajouter un middleware d'erreur.

### 1.5 Configuration Management (Conformité 12-Factor)

**État actuel :** Configuration basée sur fichier `config.json`. `Config.js` charge depuis le système de fichiers avec des valeurs par défaut en fallback. `dotenv` est installé comme dépendance mais **JAMAIS importé ni utilisé** dans `/src/`. PM2 définit `NODE_ENV=production` et `PORT=8080` mais `Config.js` ignore totalement les variables d'environnement.

**Violations 12-Factor :**
- **Factor III (Config)** : Configuration stockée dans un fichier commité dans le repo, pas dans l'environnement. Pas de surcharges par environnement.
- **Factor X (Dev/prod parity)** : Un seul `config.json` pour tous les environnements.
- **Factor XI (Logs)** : Logging custom basé fichier au lieu de stdout.

**Fichiers clés :** `src/config/Config.js` (aucun usage de `process.env`), `config.json` (commité avec valeurs en dur)

**Recommandation [P1] :** Implémenter les surcharges par variables d'environnement dans `Config.js` (ex: `process.env.PORT || config.server.port`). Utiliser le package `dotenv` déjà installé. Ajouter un template `.env.example`.

### 1.6 Qualité de Code — DRY / KISS

**État actuel :** Style ES6 module cohérent sur l'ensemble du projet. Les méthodes CRUD de la base de données suivent un pattern répétitif (try-catch + log + throw) sur 500+ lignes.

**Violations DRY :**
- Les méthodes `updateRoute`, `updateSession` dans `Database.js` partagent un pattern identique de mise à jour dynamique de champs — extractible en helper générique
- Le calcul `__filename`/`__dirname` répété dans au moins 5 fichiers

**KISS :** Généralement bon. Le pattern Command garde les handlers individuels simples. `EventBus` est minimal (74 lignes).

**Recommandation [P3] :** Extraire un helper générique `dynamicUpdate(table, id, updates, allowedFields)`. Créer un utilitaire partagé pour les chemins ESM.

### 1.7 Typage & Documentation du Code

**État actuel :** Pas de TypeScript. JSDoc présent dans `ServiceContainer` (bien documenté) et `Config.js`. La plupart des fichiers manquent de JSDoc. Aucune annotation `@typedef` ou `@param` dans `Database.js` malgré 50+ méthodes publiques.

**Écart :** Aucune vérification de type. JavaScript sans filet de sécurité pour le refactoring.

**Recommandation [P3] :** Ajouter JSDoc avec `@ts-check` comme étape incrémentale. Considérer une migration TypeScript pour le nouveau code.

### 1.8 Architecture Frontend

**État actuel :** SPA vanilla JS avec framework custom : `BaseView`, `BaseModal`, `BaseCanvasEditor`, `BaseController`, `AppRegistry`, `EventBus` frontend. Commentaires en français dans le source (ligne 3 de `BaseView.js` : *"Fichier: frontend/js/core/BaseView.js"*). `BackendAPIClient` gère le WebSocket avec logique de reconnexion (max 10 tentatives, backoff exponentiel).

**Écarts identifiés :**
- Pas d'étape de build, pas de bundling, pas de minification
- Pas de tests frontend
- État global via `window.eventBus`, `window.logger`, `window.app`
- Code chargé comme modules ES bruts par le navigateur

**Recommandation [P2] :** Ajouter une étape de build (Vite ou esbuild). Standardiser la langue des commentaires (mélange français/anglais).

### 1.9 Design API & Pattern Command

**État actuel :** Toute la communication API via WebSocket avec messages JSON et matching request/response par ID. Pas d'API REST au-delà de `/api/health` et `/api/status`. 15 modules de commandes auto-découverts. `JsonValidator` valide la structure des messages.

**Écarts identifiés :**
- Pas de versioning API
- Pas de rate limiting
- Pas d'authentification/autorisation
- Pas de documentation OpenAPI/Swagger

**Recommandation [P1] :** Ajouter une authentification pour les connexions WebSocket. Ajouter du rate limiting. Documenter les commandes API.

---

## Domaine 2 : Infrastructure & Déploiement

**Score global : 0.9 / 4 — ROUGE**

### 2.1 Gestion de Processus

**État actuel :** PM2 en mode fork, limite mémoire 500 MB, auto-restart (max 10 tentatives), uptime minimum 10 s, kill timeout 5 s. Arrêt gracieux implémenté dans `Application.js` (fermeture des connexions DB, serveurs HTTP/WebSocket).

**Conformité :** Adéquat pour un déploiement mono-instance sur Raspberry Pi.

**Écarts :**
- Mode fork uniquement (pas de cluster)
- Pas de configuration PM2 par environnement (dev/staging/prod)

**Fichier clé :** `ecosystem.config.cjs`

**Recommandation [P3] :** Ajouter des configurations PM2 spécifiques par environnement.

### 2.2 Containerisation & Reproductibilité

**État actuel :** Aucun `Dockerfile`, aucun `docker-compose.yml`, aucun support de conteneurs. L'installation se fait via le script shell `scripts/Install.sh`.

**Écart majeur :** Problème critique de reproductibilité. `Install.sh` est spécifique à la plateforme. Aucune garantie d'environnements cohérents entre machines.

**Recommandation [P2] :** Créer un `Dockerfile` et `docker-compose.yml`. Build multi-stage pour l'image de production.

### 2.3 Pipeline CI/CD

**État actuel :** Zéro automatisation. Pas de répertoire `.github/`, pas de GitHub Actions, pas de hooks pre-commit.

**Écart critique :** Aucun test automatisé sur PR, aucun enforcement de linting, aucune automatisation de déploiement.

**Recommandation [P1] :** Créer un workflow GitHub Actions avec étapes lint, test, build. Ajouter des règles de protection de branche.

### 2.4 Gestion de Base de Données & Migrations

**État actuel :** 22 fichiers de migration SQL, exécutés automatiquement au démarrage dans des transactions. Suivi de version via une table `migrations`. `ROLLBACK` manuel en cas d'échec. Mode WAL et clés étrangères activés. `ensureInstrumentCapabilitiesColumns()` comme filet de sécurité pour les échecs partiels.

**Conformité :** Bon pattern de migration. Transactionnel avec rollback.

**Écarts :**
- Pas de migrations descendantes (rollback de schéma)
- Pas de test des migrations
- Exécution directe via `db.exec(sql)` de fichiers entiers — une erreur de syntaxe SQL en milieu de fichier pourrait laisser un état partiel malgré la transaction

**Fichiers clés :** `src/storage/Database.js`, `migrations/`

**Recommandation [P3] :** Ajouter le support des migrations descendantes. Tester les migrations contre une DB fraîche en CI.

### 2.5 Logging & Observabilité

**État actuel :** `Logger.js` custom (106 lignes) avec 4 niveaux, sortie fichier + console, console colorée. Écritures asynchrones via `fs.appendFile`.

**Écarts identifiés :**
- Pas de rotation de logs (fichiers croissent sans limite)
- Pas de logging structuré (pas de format JSON)
- Pas d'IDs de corrélation pour le traçage des requêtes
- Pas d'intégration monitoring (pas de Sentry, Prometheus, Datadog)
- Pas de health check au-delà d'un simple `/api/health`

**Fichier clé :** `src/core/Logger.js` — `fs.appendFile` sur chaque ligne de log, aucune rotation

**Recommandation [P1] :** Ajouter la rotation de logs (winston ou pino avec rotation fichier). Ajouter le logging JSON structuré. Envisager un endpoint Prometheus pour les métriques.

### 2.6 Sauvegarde & Reprise d'Activité

**État actuel :** La méthode `Database.backup(path)` existe, utilisant le backup natif de better-sqlite3. Aucune planification automatique malgré `node-schedule` installé comme dépendance. Le répertoire `backups/` est dans `.gitignore` mais aucune automatisation n'y crée de fichiers.

**Écarts :**
- Sauvegardes manuelles uniquement
- Pas de politique de rétention
- Pas de sauvegarde hors-site

**Recommandation [P2] :** Implémenter des sauvegardes planifiées avec `node-schedule` (déjà installé). Ajouter une politique de rétention (garder les N dernières).

### 2.7 Posture de Sécurité

**État actuel :** Aucune authentification sur HTTP ou WebSocket. Le serveur écoute sur `0.0.0.0` (toutes les interfaces). Pas de configuration CORS. Pas de Helmet.js. Pas de sanitization d'input au-delà de `JsonValidator`. Express sert les fichiers statiques sans headers de cache pour la production. `config.json` commité dans le dépôt.

**Écarts OWASP :**
- **A07 (Identification & Authentication Failures)** : Aucune authentification
- **A03 (Injection)** : Pas de validation d'input au-delà de la structure JSON
- **Défauts par défaut non sécurisés** : `SystemCommands.js` expose `systemRestart` et `systemShutdown` — n'importe qui sur le réseau peut redémarrer ou arrêter l'application

**Recommandation [P1] :** Ajouter au minimum une authentification par token. Ajouter Helmet.js. Restreindre les commandes système dangereuses. Ajouter une politique CORS.

### 2.8 Scalabilité & Performance

**État actuel :** Instance unique, processus unique. SQLite (single-writer). PM2 en mode fork.

**Conformité :** Acceptable pour la cible Raspberry Pi. Le mode WAL de SQLite est correct pour les workloads orientés lecture.

**Écarts :**
- Pas de chemin de scaling horizontal
- Pas de couche de cache
- Pas de connection pooling (non nécessaire pour SQLite)

**Recommandation [P4] :** Documenter les limitations de scalabilité. Envisager un chemin de migration PostgreSQL pour les scénarios multi-instances.

---

## Domaine 3 : Tests & Qualité

**Score global : 0.8 / 4 — ROUGE**

### 3.1 Couverture & Stratégie de Tests

**État actuel :** Jest 29.7.0 avec `--experimental-vm-modules` pour le support ESM. 3 suites de tests :
- `midi-filter.test.js` — requêtes de filtres DB
- `midi-adaptation.test.js` — adaptation de fichiers MIDI
- `audit-i18n.test.js` — complétude i18n

Les tests utilisent SQLite en mémoire avec un logger mocké.

**Couverture :**
- 3 suites sur 67 fichiers backend = **~4.5% de couverture fichier**
- 0 tests frontend sur 48 fichiers
- Pas de rapport de couverture configuré (pas de flag `--coverage`, `coverage/` dans `.gitignore` mais jamais généré)

**Écarts — Modules non testés :**
- Handlers de commandes (15 modules, 3 553 lignes)
- Serveur WebSocket et HTTP
- EventBus, ServiceContainer, Config
- Cycle de vie de l'Application
- Tout le traitement MIDI core
- Tous les managers

**Fichier de référence :** `tests/midi-filter.test.js` (bon pattern à suivre : DB en mémoire, mock logger)

**Recommandation [P1] :** Ajouter le rapport de couverture (`--coverage`). Cibler les chemins critiques en premier : `CommandRegistry.handle()`, `ServiceContainer`, `Config.js`, `EventBus`. Réutiliser les patterns de mock existants.

### 3.2 Linting & Formatage de Code

**État actuel :** ESLint 8.55.0 dans `devDependencies` mais **AUCUN fichier de configuration** (`.eslintrc.*`, `eslint.config.*`). Pas de Prettier. Pas d'EditorConfig.

**Écart :** ESLint installé mais totalement non fonctionnel sans configuration. Zéro enforcement de style de code.

**Recommandation [P1] :** Créer `.eslintrc.json` avec `eslint:recommended` + `env: { node: true, es2022: true, browser: true }`. Ajouter Prettier. Ajouter `.editorconfig`.

### 3.3 Hooks Pre-commit & Automatisation

**État actuel :** Aucun Husky, aucun lint-staged, aucun hook pre-commit d'aucune sorte.

**Écart :** Rien n'empêche du code cassé d'être commité.

**Recommandation [P1] :** Installer Husky + lint-staged. Exécuter ESLint et les tests sur pre-commit.

### 3.4 Documentation

**État actuel :** 15+ documents dans `/docs/` couvrant des fonctionnalités spécifiques (système d'assignation, câblage GPIO, installation, guides MIDI). `README.md` présent. Plusieurs documents d'audit existent déjà à la racine (`AUDIT_REPORT.md`, `MUSIC_EDITORS_AUDIT.md`).

**Conformité :** Bonne documentation des fonctionnalités.

**Manquants :**
- Vue d'ensemble de l'architecture
- Référence API
- Guide de contribution
- Changelog

**Recommandation [P3] :** Ajouter `ARCHITECTURE.md`, `API.md`, `CONTRIBUTING.md`, `CHANGELOG.md`.

### 3.5 Gestion des Dépendances

**État actuel :** 9 dépendances de production, 2 optionnelles, 3 de développement. Champ `engines` spécifiant Node >= 18. `package-lock.json` présent.

**Écarts :**
- `dotenv` installé mais inutilisé
- Express 4.18.2 potentiellement ancien avec des vulnérabilités connues
- Pas d'audit `npm audit` en CI

**Recommandation [P2] :** Exécuter `npm audit`. Supprimer `dotenv` inutilisé ou l'utiliser réellement. Mettre à jour Express vers la dernière 4.x. Envisager `npm-check-updates` en CI.

---

## Matrice de Conformité

Échelle : **0** = Absent | **1** = Ébauche | **2** = Partiel | **3** = Adéquat | **4** = Excellent

| # | Sous-section | Standard de référence | Score actuel | Score cible | Priorité |
|---|-------------|----------------------|:------------:|:-----------:|:--------:|
| 1.1 | Structure & Organisation | Clean Architecture | 3 | 4 | P3 |
| 1.2 | Patterns & SOLID | SOLID Principles | 2 | 4 | P2 |
| 1.3 | Injection de Dépendances | DIP / Clean Architecture | 1 | 3 | P2 |
| 1.4 | Gestion des Erreurs | Resilience Patterns | 2 | 3 | P3 |
| 1.5 | Configuration | 12-Factor App (III, X, XI) | 0 | 3 | P1 |
| 1.6 | Qualité DRY/KISS | DRY / KISS | 2 | 3 | P3 |
| 1.7 | Typage & Documentation | TypeScript / JSDoc | 1 | 3 | P3 |
| 1.8 | Architecture Frontend | SPA Best Practices | 2 | 3 | P2 |
| 1.9 | Design API | REST/WS Best Practices | 1 | 3 | P1 |
| 2.1 | Gestion de Processus | PM2 / Process Management | 3 | 3 | P3 |
| 2.2 | Containerisation | Docker / OCI | 0 | 3 | P2 |
| 2.3 | Pipeline CI/CD | GitHub Actions / CI Best Practices | 0 | 3 | P1 |
| 2.4 | Base de Données & Migrations | Migration Best Practices | 2 | 3 | P3 |
| 2.5 | Logging & Observabilité | 12-Factor (XI) / Structured Logging | 1 | 3 | P1 |
| 2.6 | Sauvegarde & Reprise | Backup & DR | 1 | 3 | P2 |
| 2.7 | Posture de Sécurité | OWASP Top 10 | 0 | 3 | P1 |
| 2.8 | Scalabilité & Performance | Performance Best Practices | 2 | 3 | P4 |
| 3.1 | Couverture de Tests | Test Pyramid / Coverage | 1 | 3 | P1 |
| 3.2 | Linting & Formatage | ESLint / Prettier | 0 | 3 | P1 |
| 3.3 | Hooks Pre-commit | Husky / lint-staged | 0 | 3 | P1 |
| 3.4 | Documentation | Documentation Standards | 2 | 3 | P3 |
| 3.5 | Gestion des Dépendances | npm audit / Dependency Hygiene | 1 | 3 | P2 |

**Score moyen global : 1.3 / 4**

---

## Plan d'Action Priorisé

### Phase 1 — Quick Wins (1-2 semaines) `[P1]`

| # | Action | Fichiers impactés |
|---|--------|-------------------|
| 1 | Créer `.eslintrc.json` avec `eslint:recommended` et corriger les violations | `.eslintrc.json` (nouveau) |
| 2 | Ajouter Prettier + `.editorconfig` | `.prettierrc`, `.editorconfig` (nouveaux) |
| 3 | Installer Husky + lint-staged pour hooks pre-commit | `package.json`, `.husky/` (nouveau) |
| 4 | Ajouter `npm test -- --coverage` et établir une baseline | `package.json` |
| 5 | Créer un workflow GitHub Actions CI (lint + test) | `.github/workflows/ci.yml` (nouveau) |
| 6 | Implémenter les surcharges env-vars dans Config.js, utiliser dotenv | `src/config/Config.js` |
| 7 | Ajouter une authentification basique au WebSocket/HTTP | `src/api/WebSocketServer.js`, `src/api/HttpServer.js` |
| 8 | Ajouter Helmet.js pour les headers de sécurité | `src/api/HttpServer.js` |
| 9 | Ajouter la rotation de logs dans Logger.js | `src/core/Logger.js` |

### Phase 2 — Fondations (2-4 semaines) `[P2]`

| # | Action | Fichiers impactés |
|---|--------|-------------------|
| 10 | Compléter la migration DI (supprimer le passthrough `app`) | `src/core/Application.js`, tous les services |
| 11 | Ajouter des tests pour ServiceContainer, Config, EventBus, CommandRegistry | `tests/` (nouveaux fichiers) |
| 12 | Créer Dockerfile + docker-compose.yml | `Dockerfile`, `docker-compose.yml` (nouveaux) |
| 13 | Implémenter les sauvegardes automatiques avec node-schedule | `src/storage/Database.js` ou nouveau module |
| 14 | Ajouter la documentation API pour les 15 modules de commandes | `docs/API.md` (nouveau) |
| 15 | Ajouter une étape de build frontend (Vite) | `vite.config.js` (nouveau), `package.json` |
| 16 | Exécuter npm audit et mettre à jour les dépendances | `package.json`, `package-lock.json` |

### Phase 3 — Maturité (1-2 mois) `[P3]`

| # | Action | Fichiers impactés |
|---|--------|-------------------|
| 17 | Ajouter une hiérarchie d'erreurs structurée | `src/core/errors/` (nouveau répertoire) |
| 18 | Ajouter le logging JSON structuré | `src/core/Logger.js` |
| 19 | Extraire le helper générique de mise à jour DB (DRY) | `src/storage/` |
| 20 | Ajouter JSDoc + `@ts-check` sur le codebase | Tous les fichiers `.js` |
| 21 | Ajouter le support des migrations descendantes | `src/storage/Database.js`, `migrations/` |
| 22 | Ajouter la documentation d'architecture | `ARCHITECTURE.md` (nouveau) |
| 23 | Ajouter une suite de tests E2E | `tests/e2e/` (nouveau) |
| 24 | Ajouter un endpoint Prometheus pour les métriques | `src/api/HttpServer.js` |

### Phase 4 — Excellence (3+ mois) `[P4]`

| # | Action | Fichiers impactés |
|---|--------|-------------------|
| 25 | Migration TypeScript pour les nouveaux modules | `tsconfig.json` (nouveau), fichiers `.ts` |
| 26 | Framework de tests frontend (Playwright ou Vitest) | `tests/frontend/` (nouveau) |
| 27 | Versioning API | `src/api/` |
| 28 | Documentation du chemin de migration PostgreSQL | `docs/` |
| 29 | Load testing et benchmarks de performance | `tests/performance/` (nouveau) |

---

*Rapport généré le 2026-03-24 — Ma-est-tro v5.0.0*
