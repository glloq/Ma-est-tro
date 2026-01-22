# Étude : Système de Filtres pour la Recherche MIDI

## Vue d'ensemble

Ajout d'un système de filtres avancés pour permettre aux utilisateurs de filtrer les fichiers MIDI par :
- Type(s) d'instrument
- Nombre d'instruments/canaux
- Durée
- Tempo
- Nombre de pistes
- Dossier
- Date d'upload
- Fichiers routés vs non-routés
- Fichiers originaux vs adaptés

---

## 1. Architecture Générale

### 1.1 Approche Hybride (Client + Serveur)

**Principe** : Combiner filtrage côté client (rapide) et côté serveur (puissant)

```
┌─────────────────────────────────────────────────────────┐
│                    INTERFACE UTILISATEUR                 │
│  [Panneau de Filtres] → [Liste des Fichiers Filtrée]   │
└────────────────┬────────────────────────────────────────┘
                 │
                 ├─→ FILTRES SIMPLES (Client-side)
                 │   • Nom de fichier (déjà implémenté)
                 │   • Durée (min-max)
                 │   • Tempo (min-max)
                 │   • Nombre de pistes (min-max)
                 │   • Dossier
                 │   • Date d'upload
                 │
                 └─→ FILTRES COMPLEXES (Server-side)
                     • Types d'instruments
                     • Nombre d'instruments assignés
                     • Canaux MIDI utilisés
                     • Fichiers avec/sans routing
                     • Qualité d'auto-assignment
```

### 1.2 Deux Modes de Fonctionnement

**Mode 1 : Filtrage Client** (pour filtres simples)
- Données déjà chargées en mémoire
- Filtrage instantané
- Pas de requête réseau
- Limité aux données de base (nom, durée, tempo, pistes)

**Mode 2 : Filtrage Serveur** (pour filtres avancés)
- Requête SQL avec WHERE clauses
- JOIN avec tables d'instruments et routages
- Retourne seulement les fichiers correspondants
- Nécessaire pour analyses MIDI complexes

---

## 2. Types de Filtres Détaillés

### 2.1 Filtres de Base (Client-side)

#### A. Filtre par Nom
- **Déjà implémenté** : `#fileSearchInput`
- **Logique** : Recherche substring case-insensitive
- **Amélioration possible** : Regex ou recherche floue (fuzzy)

#### B. Filtre par Durée
```
[Min: __:__] ─────────────── [Max: __:__]
     ↓                              ↓
   Slider ou Input numérique
```
- **Données disponibles** : `duration` (secondes) en DB
- **Logique** : `file.duration >= minDuration && file.duration <= maxDuration`
- **UI** : Range slider avec affichage MM:SS

#### C. Filtre par Tempo
```
[Min: ___ BPM] ────────── [Max: ___ BPM]
```
- **Données disponibles** : `tempo` en DB
- **Logique** : `file.tempo >= minTempo && file.tempo <= maxTempo`
- **Presets** : Lent (<80), Modéré (80-120), Rapide (>120)

#### D. Filtre par Nombre de Pistes
```
[Min: __] ────────── [Max: __]
```
- **Données disponibles** : `tracks` en DB
- **Logique** : `file.tracks >= minTracks && file.tracks <= maxTracks`
- **Cas d'usage** : Trouver fichiers simples (1-3 pistes) vs complexes (>10 pistes)

#### E. Filtre par Dossier
```
☑ Tous
☐ / (Racine)
☐ /Jazz
☐ /Rock
☐ /Classical
```
- **Données disponibles** : `folder` en DB
- **Logique** : `file.folder === selectedFolder` ou `startsWith` pour sous-dossiers
- **Options** :
  - Inclure sous-dossiers (checkbox)
  - Multi-sélection de dossiers

#### F. Filtre par Date
```
Du: [Date Picker] ─── Au: [Date Picker]
```
- **Données disponibles** : `uploaded_at` (ISO timestamp) en DB
- **Logique** : `file.uploadedAt >= startDate && file.uploadedAt <= endDate`
- **Presets** : Aujourd'hui, Cette semaine, Ce mois, Cette année

---

### 2.2 Filtres Avancés (Server-side)

#### A. Filtre par Type(s) d'Instrument

**Problème** : Les types d'instruments ne sont pas stockés directement en DB

**Solution 1 : Enrichir la Table `midi_files`**
```sql
ALTER TABLE midi_files ADD COLUMN instrument_types TEXT;
-- JSON array: ["Piano", "Drums", "Bass", "Strings"]
```

**Extraction lors de l'upload** :
1. Parser le MIDI avec `ChannelAnalyzer`
2. Pour chaque canal, détecter le type via `estimatedType`
3. Stocker tableau unique de types
4. Indexer pour recherche rapide

**Solution 2 : Analyse à la Demande (Cache)**
```
Requête Filtre → Cache Hit? → Oui → Retourner résultat
                      ↓ Non
                 Analyser MIDI → Stocker cache → Retourner
```

**UI Proposée** :
```
Types d'instruments (multi-select) :
☑ Piano / Clavier
☑ Guitare / Basse
☐ Drums / Percussion
☐ Cordes (Strings)
☐ Vents (Brass/Woodwind)
☐ Synthé / Pad
☐ Lead / Solo

Mode: [○ AU MOINS UN] [○ TOUS] [○ EXACTEMENT]
```

**Logique de Filtrage** :
```
Mode "AU MOINS UN" (OR) :
  → Fichier contient Piano OU Drums OU ...

Mode "TOUS" (AND) :
  → Fichier contient Piano ET Drums ET ...

Mode "EXACTEMENT" :
  → Fichier contient SEULEMENT Piano, Drums (pas d'autres)
```

**Requête SQL** (exemple pour "AU MOINS UN") :
```sql
SELECT * FROM midi_files
WHERE instrument_types LIKE '%Piano%'
   OR instrument_types LIKE '%Drums%';
```

#### B. Filtre par Nombre d'Instruments

**Données disponibles** :
- `tracks` (nombre de pistes) - déjà en DB
- Canaux MIDI utilisés - nécessite parsing (via `getFileMetadata`)

**Deux interprétations** :

**Option 1 : Nombre de canaux MIDI utilisés**
```
Nombre de canaux: [Min: __] ─── [Max: __]
```
- Logique : Compter canaux uniques dans events MIDI
- Stockage : Nouveau champ `channel_count` en DB
- Extraction : Lors de l'upload via `ChannelAnalyzer.analyzeAllChannels()`

**Option 2 : Nombre d'instruments routés**
```
Nombre d'instruments assignés: [Min: __] ─── [Max: __]
```
- Logique : JOIN avec `midi_instrument_routings`, COUNT distinct instruments
- Cas d'usage : Fichiers prêts à jouer (tous canaux routés)

**Requête SQL** :
```sql
SELECT mf.*, COUNT(DISTINCT mir.instrument_id) as instrument_count
FROM midi_files mf
LEFT JOIN midi_instrument_routings mir ON mf.id = mir.midi_file_id
GROUP BY mf.id
HAVING instrument_count >= minCount AND instrument_count <= maxCount;
```

#### C. Filtre par Statut de Routing

**UI** :
```
Statut d'assignation :
☑ Tous
☐ Routés (prêts à jouer)
☐ Non routés (nécessitent configuration)
☐ Partiellement routés
```

**Logique** :
```
Routé complet :
  → Tous les canaux utilisés ont un routing dans la table

Non routé :
  → Aucun routing dans la table

Partiellement routé :
  → Certains canaux ont routing, d'autres non
```

**Requête SQL** :
```sql
-- Fichiers routés
SELECT mf.* FROM midi_files mf
INNER JOIN midi_instrument_routings mir ON mf.id = mir.midi_file_id
GROUP BY mf.id;

-- Fichiers non routés
SELECT mf.* FROM midi_files mf
LEFT JOIN midi_instrument_routings mir ON mf.id = mir.midi_file_id
WHERE mir.id IS NULL;
```

#### D. Filtre par Qualité d'Auto-Assignment

**Données disponibles** : `compatibility_score` dans `midi_instrument_routings`

**UI** :
```
Qualité d'auto-assignment :
☐ Excellent (90-100%)
☐ Bon (70-89%)
☐ Acceptable (50-69%)
☐ Faible (<50%)
```

**Logique** :
- Calculer score moyen par fichier
- Filtrer par seuil de qualité

**Requête SQL** :
```sql
SELECT mf.*, AVG(mir.compatibility_score) as avg_score
FROM midi_files mf
INNER JOIN midi_instrument_routings mir ON mf.id = mir.midi_file_id
GROUP BY mf.id
HAVING avg_score >= minScore AND avg_score <= maxScore;
```

#### E. Filtre Original vs Adapté

**Données disponibles** : `is_original`, `parent_file_id` en DB

**UI** :
```
Type de fichier :
☑ Originaux
☑ Adaptés/Transposés
☐ Uniquement fichiers sources (sans dérivés)
```

**Logique** :
```sql
-- Originaux uniquement
SELECT * FROM midi_files WHERE is_original = 1;

-- Adaptés uniquement
SELECT * FROM midi_files WHERE is_original = 0;

-- Fichiers sources (qui ont des dérivés)
SELECT DISTINCT mf.* FROM midi_files mf
INNER JOIN midi_files derived ON derived.parent_file_id = mf.id;
```

---

## 3. Interface Utilisateur

### 3.1 Panneau de Filtres

**Position** : Barre latérale gauche ou modal popup

**Structure** :
```
┌─────────────────────────────────────┐
│  🔍 FILTRES DE RECHERCHE            │
├─────────────────────────────────────┤
│                                     │
│ 📝 Nom de fichier                   │
│ [_________________________]         │
│                                     │
│ ⏱ Durée                             │
│ Min: [__:__] Max: [__:__]           │
│ ├─────────○──────────────┤ Slider  │
│                                     │
│ 🎵 Tempo (BPM)                       │
│ Min: [___] Max: [___]               │
│                                     │
│ 🎹 Types d'instruments               │
│ ☑ Piano    ☐ Drums                  │
│ ☐ Guitare  ☐ Cordes                 │
│ Mode: [○ Au moins 1] [○ Tous]       │
│                                     │
│ 🎚 Nombre d'instruments              │
│ Min: [_] Max: [_]                   │
│                                     │
│ 📁 Dossiers                          │
│ [Dropdown multi-select]             │
│                                     │
│ 📅 Date d'upload                     │
│ Du: [____] Au: [____]               │
│                                     │
│ ⚙️ Statut                            │
│ ☑ Routés  ☐ Non routés              │
│                                     │
│ [🗑 Réinitialiser] [✓ Appliquer]    │
└─────────────────────────────────────┘
```

### 3.2 Indicateurs Visuels

**Compteur de résultats** :
```
Résultats : 47 fichiers sur 152 total (3 filtres actifs)
```

**Badges de filtres actifs** :
```
[⏱ Durée: 2-5 min ×] [🎹 Piano+Drums ×] [📁 Jazz ×]
```
- Cliquable pour retirer le filtre
- Position : Au-dessus de la liste de fichiers

**État de chargement** :
```
⏳ Application des filtres...
```
- Pour filtres serveur (requête en cours)

---

## 4. Logique de Filtrage

### 4.1 Flux de Filtrage

```
USER CHANGE FILTRE
       ↓
Déterminer type filtre (Client ou Serveur)
       ↓
┌──────┴──────┐
│             │
CLIENT        SERVEUR
│             │
│             ├→ Construire requête SQL
│             ├→ Envoyer à backend
│             ├→ Recevoir résultats filtrés
│             └→ Mettre à jour UI
│
├→ Filtrer tableau en mémoire
├→ Masquer éléments non-matching
└→ Mettre à jour compteur
       ↓
Appliquer TRI actuel
       ↓
AFFICHER RÉSULTATS
```

### 4.2 Combinaison de Filtres

**Opérateur logique** : AND entre différents types de filtres

```javascript
Logique Pseudo-Code :

fichierCorrespond = true

// Filtre nom
if (nomFiltre !== "") {
  fichierCorrespond = fichierCorrespond &&
    fichier.nom.toLowerCase().includes(nomFiltre.toLowerCase())
}

// Filtre durée
if (dureeMin || dureeMax) {
  fichierCorrespond = fichierCorrespond &&
    (fichier.duration >= dureeMin) &&
    (fichier.duration <= dureeMax)
}

// Filtre tempo
if (tempoMin || tempoMax) {
  fichierCorrespond = fichierCorrespond &&
    (fichier.tempo >= tempoMin) &&
    (fichier.tempo <= tempoMax)
}

// Filtre instruments (OR interne, AND global)
if (instrumentsSelectionnés.length > 0) {
  if (mode === "AU_MOINS_UN") {
    correspondInstrument = instrumentsSelectionnés.some(
      inst => fichier.instrumentTypes.includes(inst)
    )
  } else if (mode === "TOUS") {
    correspondInstrument = instrumentsSelectionnés.every(
      inst => fichier.instrumentTypes.includes(inst)
    )
  }
  fichierCorrespond = fichierCorrespond && correspondInstrument
}

// ... autres filtres

return fichierCorrespond
```

### 4.3 Optimisation des Filtres

**Ordre d'exécution** (du plus restrictif au moins restrictif) :

1. Filtres simples (nom, dossier) - éliminent beaucoup de fichiers rapidement
2. Filtres numériques (durée, tempo, pistes) - comparaisons rapides
3. Filtres complexes (instruments) - nécessitent parsing/lookup

**Cache des résultats** :

```javascript
const filterCache = {
  "duration:120-300,tempo:80-120": [file1, file2, ...],
  "instruments:Piano,Drums": [file3, file4, ...]
}

Clé de cache = Hash des paramètres de filtres
```

**Debouncing** pour inputs texte :
- Attendre 300ms après dernière frappe avant de filtrer
- Évite de filtrer à chaque caractère

---

## 5. Stockage et Extraction des Données

### 5.1 Nouvelles Colonnes en Base de Données

**Table `midi_files` - Ajouts proposés** :

```sql
-- Types d'instruments détectés (JSON array)
instrument_types TEXT DEFAULT '[]'

-- Nombre de canaux MIDI utilisés
channel_count INTEGER DEFAULT 0

-- Plage de notes (min-max)
note_range_min INTEGER
note_range_max INTEGER

-- Indicateurs booléens pour filtrage rapide
has_drums BOOLEAN DEFAULT 0
has_melody BOOLEAN DEFAULT 0
has_bass BOOLEAN DEFAULT 0

-- Index pour recherche rapide
CREATE INDEX idx_instrument_types ON midi_files(instrument_types);
CREATE INDEX idx_channel_count ON midi_files(channel_count);
CREATE INDEX idx_has_drums ON midi_files(has_drums);
```

**Migration** : Peupler colonnes pour fichiers existants
```
Pour chaque fichier existant :
  1. Charger MIDI
  2. Analyser avec ChannelAnalyzer
  3. Extraire types d'instruments
  4. UPDATE midi_files SET ...
```

### 5.2 Extraction lors de l'Upload

**Modifier `FileManager.uploadFile()`** :

```
Flow actuel :
  1. Valider fichier
  2. Parser MIDI
  3. Extraire métadonnées de base (tempo, duration, tracks)
  4. Insérer en DB

Flow enrichi :
  1. Valider fichier
  2. Parser MIDI
  3. Extraire métadonnées de base
  4. [NOUVEAU] Analyser tous canaux avec ChannelAnalyzer
  5. [NOUVEAU] Extraire instrument_types, channel_count, note_range
  6. [NOUVEAU] Détecter has_drums, has_melody, has_bass
  7. Insérer en DB avec toutes métadonnées
```

**Méthode d'extraction** :

```javascript
Pseudo-code :

function extractInstrumentMetadata(midiData) {
  const analysis = ChannelAnalyzer.analyzeAllChannels(midiData)

  const instrumentTypes = new Set()
  let hasDrums = false
  let hasMelody = false
  let hasBass = false
  let noteMin = 127
  let noteMax = 0

  for (const channelAnalysis of analysis) {
    // Type d'instrument
    instrumentTypes.add(channelAnalysis.estimatedType)

    // Indicateurs booléens
    if (channelAnalysis.estimatedType === 'drums') hasDrums = true
    if (channelAnalysis.estimatedType === 'melody') hasMelody = true
    if (channelAnalysis.estimatedType === 'bass') hasBass = true

    // Plage de notes
    noteMin = Math.min(noteMin, channelAnalysis.noteRange.min)
    noteMax = Math.max(noteMax, channelAnalysis.noteRange.max)
  }

  return {
    instrument_types: JSON.stringify([...instrumentTypes]),
    channel_count: analysis.length,
    has_drums: hasDrums,
    has_melody: hasMelody,
    has_bass: hasBass,
    note_range_min: noteMin,
    note_range_max: noteMax
  }
}
```

### 5.3 Cache Frontend pour Métadonnées Enrichies

**Problème** : Métadonnées détaillées pas toujours chargées

**Solution** : Chargement progressif

```
Au chargement page :
  1. Charger liste basique (id, nom, durée, tempo, pistes)
  2. Afficher liste

Quand utilisateur active filtre avancé :
  1. Si metadata_cache vide → Fetch métadonnées enrichies en batch
  2. Stocker en cache
  3. Appliquer filtre

Requête batch :
  GET /api/files/metadata?ids=1,2,3,4,5,...
  → Retourne instrument_types, channel_count, etc. pour tous fichiers
```

---

## 6. API Backend - Nouveaux Endpoints

### 6.1 Endpoint de Filtrage Avancé

**Command** : `file_filter`

**Paramètres** :
```javascript
{
  // Filtres simples
  filename: string,           // Substring search
  folder: string,             // Exact ou startsWith
  durationMin: number,        // Secondes
  durationMax: number,
  tempoMin: number,           // BPM
  tempoMax: number,
  tracksMin: number,
  tracksMax: number,
  uploadedAfter: string,      // ISO timestamp
  uploadedBefore: string,

  // Filtres avancés
  instrumentTypes: string[],  // ["Piano", "Drums"]
  instrumentMode: string,     // "ANY" | "ALL" | "EXACT"
  channelCountMin: number,
  channelCountMax: number,
  hasRouting: boolean,        // true | false | null (tous)
  isOriginal: boolean,        // true | false | null (tous)

  // Tri et pagination
  sortBy: string,             // "name" | "date" | "duration" | ...
  sortOrder: string,          // "asc" | "desc"
  limit: number,              // Pagination
  offset: number
}
```

**Réponse** :
```javascript
{
  success: true,
  files: [...],              // Fichiers filtrés
  total: 47,                 // Total résultats
  filters_applied: {         // Echo des filtres actifs
    duration: "120-300s",
    instruments: "Piano, Drums (mode: ANY)"
  }
}
```

### 6.2 Construction de Requête SQL Dynamique

**Logique** :

```javascript
Pseudo-code :

function buildFilterQuery(filters) {
  let query = "SELECT * FROM midi_files mf"
  let joins = []
  let wheres = []
  let params = []

  // JOIN si filtre routing
  if (filters.hasRouting !== null) {
    joins.push("LEFT JOIN midi_instrument_routings mir ON mf.id = mir.midi_file_id")
  }

  // WHERE clauses
  if (filters.filename) {
    wheres.push("mf.filename LIKE ?")
    params.push(`%${filters.filename}%`)
  }

  if (filters.durationMin) {
    wheres.push("mf.duration >= ?")
    params.push(filters.durationMin)
  }

  if (filters.durationMax) {
    wheres.push("mf.duration <= ?")
    params.push(filters.durationMax)
  }

  if (filters.instrumentTypes && filters.instrumentTypes.length > 0) {
    if (filters.instrumentMode === "ANY") {
      const orClauses = filters.instrumentTypes.map(() =>
        "mf.instrument_types LIKE ?"
      )
      wheres.push(`(${orClauses.join(" OR ")})`)
      params.push(...filters.instrumentTypes.map(t => `%${t}%`))
    }
    else if (filters.instrumentMode === "ALL") {
      filters.instrumentTypes.forEach(type => {
        wheres.push("mf.instrument_types LIKE ?")
        params.push(`%${type}%`)
      })
    }
  }

  // Assembler requête
  if (joins.length > 0) query += " " + joins.join(" ")
  if (wheres.length > 0) query += " WHERE " + wheres.join(" AND ")

  // ORDER BY
  query += ` ORDER BY mf.${filters.sortBy} ${filters.sortOrder}`

  // LIMIT OFFSET
  if (filters.limit) {
    query += ` LIMIT ? OFFSET ?`
    params.push(filters.limit, filters.offset || 0)
  }

  return { query, params }
}
```

---

## 7. Performance et Optimisation

### 7.1 Stratégies de Performance

**1. Indexation Database**
```sql
-- Index composites pour filtres fréquents
CREATE INDEX idx_duration_tempo ON midi_files(duration, tempo);
CREATE INDEX idx_folder_date ON midi_files(folder, uploaded_at);
```

**2. Chargement Lazy des Métadonnées**
- Liste initiale : données basiques uniquement
- Métadonnées enrichies : chargées à la demande

**3. Pagination**
- Limiter résultats à 50-100 fichiers par page
- Scroll infini ou pagination classique

**4. Cache Multi-Niveaux**
```
Frontend Cache (Map) → Backend Cache (LRU) → Database
     ↑ 100 fichiers        ↑ 1000 fichiers      ↑ Tous
```

**5. Requêtes Parallèles**
- Filtres client + Compteur serveur en parallèle
- Précharger page suivante en arrière-plan

### 7.2 Benchmarks Estimés

**Sans filtres** :
- Chargement 500 fichiers : ~200-500ms
- Affichage : instantané

**Avec filtres simples (client)** :
- Filtrage 500 fichiers : <10ms
- Réaffichage : <50ms

**Avec filtres avancés (serveur)** :
- Requête SQL : 50-200ms (selon index)
- Chargement résultats : 100-300ms
- Total : ~200-500ms

**Optimisation cible** : <500ms pour tout filtre

---

## 8. Expérience Utilisateur

### 8.1 Presets de Filtres

**Filtres prédéfinis sauvegardables** :

```
Mes Filtres :
  📌 Fichiers courts pour tests (< 1 min)
  📌 Jazz complet (dossier Jazz, Piano+Bass+Drums)
  📌 Non routés récents (cette semaine, sans routing)

[+ Sauvegarder filtre actuel]
```

**Stockage** : localStorage frontend
```javascript
{
  "filter_presets": [
    {
      "name": "Fichiers courts",
      "filters": { "durationMax": 60 }
    },
    ...
  ]
}
```

### 8.2 Filtres Rapides (Quick Filters)

**Boutons one-click au-dessus de la liste** :

```
[🔥 Récents] [⚡ Courts] [🎹 Avec Piano] [✓ Routés] [📁 Dossier actuel]
```

- Application immédiate
- Combinables avec panneau de filtres
- Badges visuels quand actifs

### 8.3 Réinitialisation

**Boutons** :
- "Réinitialiser" : Vide tous les filtres
- "Réinitialiser ce filtre" : Bouton × sur chaque section

**Comportement** :
- Confirmation si beaucoup de filtres actifs
- Animation de transition douce

### 8.4 Feedback Visuel

**Pendant filtrage** :
```
⏳ Application des filtres... (0.3s)
✓ 47 résultats trouvés
```

**Si aucun résultat** :
```
😕 Aucun fichier ne correspond aux filtres

Suggestions :
  • Élargir la plage de durée
  • Retirer certains types d'instruments
  • Vérifier le dossier sélectionné

[Réinitialiser les filtres]
```

---

## 9. Cas d'Usage Concrets

### Cas 1 : Trouver Morceaux Courts pour Test
```
Filtre : Durée max 1 minute
Résultat : Fichiers MIDI courts pour tester rapidement routing
```

### Cas 2 : Chercher Fichiers Jazz Complets
```
Filtres :
  • Dossier = /Jazz
  • Instruments = Piano + Bass + Drums (mode TOUS)
  • Routés = Oui
Résultat : Fichiers jazz prêts à jouer avec formation complète
```

### Cas 3 : Identifier Fichiers à Router
```
Filtres :
  • Routés = Non
  • Date = Cette semaine
Résultat : Nouveaux fichiers uploadés nécessitant configuration
```

### Cas 4 : Morceaux Solo Piano
```
Filtres :
  • Instruments = Piano (mode EXACT)
  • Canaux = 1
Résultat : Pièces piano solo
```

### Cas 5 : Fichiers Adaptés d'un Original
```
Filtres :
  • Original = Non
  • Parent File ID = 42
Résultat : Toutes les versions transposées du fichier #42
```

---

## 10. Plan d'Intégration au Code Actuel

### Phase 1 : Backend (Données + API)

**1.1 Migration Database**
- Ajouter colonnes : `instrument_types`, `channel_count`, `has_drums`, etc.
- Créer indexes
- Script migration pour fichiers existants

**1.2 Enrichir Extraction Métadonnées**
- Modifier `FileManager.uploadFile()`
- Utiliser `ChannelAnalyzer.analyzeAllChannels()`
- Peupler nouvelles colonnes

**1.3 Nouveau Endpoint API**
- Command `file_filter` dans `CommandHandler.js`
- Méthode `MidiDatabase.filterFiles(filters)`
- Construction requête SQL dynamique

**1.4 Cache Backend**
- Utiliser `AnalysisCache` existant
- Clés de cache basées sur hash de filtres

---

### Phase 2 : Frontend (UI + Logique)

**2.1 Composant Panneau de Filtres**
- HTML : Modal ou sidebar
- CSS : Styles cohérents avec UI actuelle
- JavaScript : Gestion état des filtres

**2.2 Gestionnaire de Filtres**
```javascript
const FilterManager = {
  filters: {
    filename: "",
    durationMin: null,
    durationMax: null,
    instrumentTypes: [],
    // ...
  },

  applyFilters() {
    // Déterminer si client ou serveur
    // Appeler logique appropriée
  },

  resetFilters() { ... },
  savePreset(name) { ... },
  loadPreset(name) { ... }
}
```

**2.3 Intégration avec Liste Existante**
- Modifier `refreshFileList()` pour accepter filtres
- Appliquer filtres avant affichage
- Conserver tri actuel

**2.4 Indicateurs Visuels**
- Compteur de résultats
- Badges filtres actifs
- État de chargement

---

### Phase 3 : Optimisations

**3.1 Cache Frontend**
- Stocker résultats filtrés
- Invalider sur changement de filtres

**3.2 Debouncing**
- Inputs texte : 300ms
- Sliders : 150ms

**3.3 Pagination**
- Implémenter si >100 fichiers
- Scroll infini ou boutons page

**3.4 Presets**
- Sauvegarder dans localStorage
- UI de gestion des presets

---

## 11. Points d'Attention

### 11.1 Compatibilité Ascendante
- Fichiers existants sans métadonnées enrichies
- Fallback gracieux si `instrument_types` null
- Migration progressive (analyse à la demande si besoin)

### 11.2 Performance avec Gros Volumes
- Si >1000 fichiers : Pagination obligatoire
- Index database critiques
- Cache agressif

### 11.3 Synchronisation Cache
- Invalider cache après upload/suppression
- Timestamp de dernière modification

### 11.4 Accessibilité
- Labels ARIA pour lecteurs d'écran
- Navigation clavier
- Contraste couleurs

### 11.5 Mobile-Friendly
- Panneau filtres adaptable (collapse sur mobile)
- Inputs tactiles (sliders larges)
- Modal plein écran sur petits écrans

---

## 12. Extensions Futures Possibles

### 12.1 Filtres Avancés Supplémentaires
- **Vélocité** : Dynamique (soft/loud)
- **Polyphonie** : Nombre de notes simultanées
- **Complexité rythmique** : Variété des durées de notes
- **Gamme/Tonalité** : Détection de clé (C major, Am, etc.)
- **Signature temporelle** : 4/4, 3/4, 6/8, etc.
- **Controllers utilisés** : Modulation, Expression, Sustain

### 12.2 Recherche Sémantique
```
"Trouve-moi des morceaux calmes avec piano"
  → Filtre auto : Tempo < 80, Instruments = Piano
```

### 12.3 Filtres par Similarité
```
Trouver fichiers similaires à [fichier X]
  → Comparaison tempo, instruments, durée, tonalité
```

### 12.4 Tags Personnalisés
```
Permettre ajout tags custom : "Ballad", "Workout", "Relax"
Filtrer par tags
```

### 12.5 Historique de Filtres
```
Derniers filtres utilisés :
  1. Piano + Drums, 2-4 min
  2. Dossier Jazz, routés
  3. Uploadés cette semaine
```

---

## 13. Résumé de l'Architecture Recommandée

### Choix Techniques

✅ **Approche Hybride** : Client pour filtres simples, Serveur pour filtres complexes
✅ **Enrichissement DB** : Nouvelles colonnes avec métadonnées instrumentales
✅ **Extraction à l'Upload** : Analyse complète lors de l'ajout du fichier
✅ **Cache Multi-Niveaux** : Frontend Map + Backend LRU + DB indexes
✅ **API RESTful** : Endpoint `file_filter` avec paramètres flexibles
✅ **UI Progressive** : Quick filters + Panneau avancé + Presets

### Avantages

- **Performance** : Filtres simples instantanés (client-side)
- **Puissance** : Filtres complexes via SQL optimisé
- **Évolutivité** : Architecture extensible pour nouveaux filtres
- **UX** : Interface intuitive avec feedback visuel
- **Compatibilité** : Intégration douce avec code existant

### Points Clés

1. **Pas de refonte majeure** : Extension du système actuel
2. **Migration progressive** : Fichiers existants analysés à la demande ou en batch
3. **Fallback gracieux** : Fonctionne même si métadonnées incomplètes
4. **Performance garantie** : Indexes DB + Cache + Pagination

---

## 14. Estimation de Complexité

### Complexité par Feature

| Feature | Complexité | Justification |
|---------|-----------|---------------|
| Filtres base (durée, tempo, pistes) | ⭐⭐ Faible | Données déjà en DB, logique simple |
| Filtre par nom/dossier | ⭐ Très faible | Déjà implémenté, amélioration mineure |
| Filtre instruments | ⭐⭐⭐⭐ Élevée | Nécessite extraction, stockage, UI complexe |
| Filtre nombre d'instruments | ⭐⭐⭐ Moyenne | Analyse MIDI + COUNT SQL |
| Filtre routing | ⭐⭐ Faible | JOIN simple avec table existante |
| UI Panneau filtres | ⭐⭐⭐ Moyenne | Design + interactions + état |
| Cache et optimisation | ⭐⭐⭐ Moyenne | Stratégie multi-niveaux |
| Migration DB | ⭐⭐ Faible | Script d'analyse batch |

### Temps Estimé (Développement)

- **Phase 1 (Backend)** : 8-12h
- **Phase 2 (Frontend)** : 10-15h
- **Phase 3 (Optimisations)** : 5-8h
- **Tests + Ajustements** : 5-7h

**Total** : ~30-40h de développement

---

## Conclusion

Le système de filtres proposé s'intègre naturellement au code existant en :

1. **Enrichissant** la base de données avec métadonnées instrumentales
2. **Étendant** l'API avec un endpoint de filtrage flexible
3. **Ajoutant** une UI de filtres progressive et intuitive
4. **Optimisant** via cache multi-niveaux et indexes

L'architecture hybride (client + serveur) garantit :
- Performance pour filtres simples (instantané)
- Puissance pour filtres complexes (SQL optimisé)
- Évolutivité pour futures extensions

Le système reste compatible avec l'existant grâce à :
- Migration progressive des fichiers
- Fallback gracieux si métadonnées manquantes
- Pas de modification des composants critiques
