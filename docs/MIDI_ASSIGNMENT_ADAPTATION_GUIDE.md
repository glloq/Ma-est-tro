# Guide Complet : Assignement et Adaptation MIDI

**Version**: 2.0
**Date**: 2026-01-22
**Auteur**: MidiMind Team

---

## 📋 Table des Matières

1. [Vue d'ensemble](#vue-densemble)
2. [Architecture du système](#architecture-du-système)
3. [Analyse des canaux MIDI](#analyse-des-canaux-midi)
4. [Système de scoring](#système-de-scoring)
5. [Adaptations MIDI](#adaptations-midi)
6. [Auto-Assignement](#auto-assignement)
7. [Interface utilisateur](#interface-utilisateur)
8. [Cas d'usage](#cas-dusage)
9. [Dépannage](#dépannage)

---

## 🎯 Vue d'ensemble

### Qu'est-ce que l'assignement MIDI ?

L'**assignement MIDI** est le processus de routing des canaux MIDI d'un fichier vers les instruments physiques ou virtuels disponibles. Le système analyse automatiquement la compatibilité et propose les meilleurs appairages.

### Problématiques Résolues

1. **Compatibilité de plage de notes** : Un piano MIDI (88 notes) vs un clavier 61 touches
2. **Polyphonie limitée** : Un fichier avec 12 notes simultanées vs un instrument 8 voix
3. **Programmes MIDI différents** : Un son de piano dans le fichier vs instruments disponibles
4. **Percussions spécifiques** : Mapping GM Drums vers kits incomplets
5. **Multi-canal** : Plusieurs canaux MIDI vers un nombre limité d'instruments

### Flux Global

```
Fichier MIDI
    ↓
Analyse Canaux (ChannelAnalyzer)
    ↓
Instruments Disponibles
    ↓
Scoring Compatibilité (InstrumentMatcher)
    ↓
Sélection Automatique (AutoAssigner)
    ↓
Adaptations (Transposition, Mapping)
    ↓
Application Routing
```

---

## 🏗️ Architecture du Système

### Modules Principaux

```
┌─────────────────────────────────────────────────┐
│              AutoAssigner                        │
│  • Orchestration générale                       │
│  • Cache LRU (100 entrées, 10 min TTL)         │
│  • Sélection sans conflits                      │
└──────────────┬──────────────────────────────────┘
               │
    ┌──────────┼──────────┐
    │          │          │
┌───▼────┐ ┌──▼───────┐ ┌▼────────────┐
│Channel │ │Instrument│ │ DrumNote    │
│Analyzer│ │Matcher   │ │ Mapper      │
└────────┘ └──────────┘ └─────────────┘
```

### Fichiers Sources

| Fichier | Responsabilité | Lignes |
|---------|---------------|--------|
| `src/midi/AutoAssigner.js` | Orchestrateur principal | 300 |
| `src/midi/ChannelAnalyzer.js` | Analyse canaux MIDI | 500 |
| `src/midi/InstrumentMatcher.js` | Scoring compatibilité | 650 |
| `src/midi/DrumNoteMapper.js` | Mapping intelligent drums | 807 |
| `src/midi/ScoringConfig.js` | Configuration scores | 50 |
| `src/midi/AnalysisCache.js` | Cache LRU | 100 |

---

## 🔍 Analyse des Canaux MIDI

### Qu'est-ce qui est Analysé ?

Pour chaque canal actif (0-15), le `ChannelAnalyzer` extrait :

#### 1. Plage de Notes

```javascript
noteRange: {
  min: 36,  // Note la plus basse (C1)
  max: 96   // Note la plus haute (C6)
}
```

**Utilité** : Déterminer si l'instrument peut jouer toutes les notes.

#### 2. Distribution des Notes

```javascript
noteDistribution: {
  36: 15,  // Note 36 jouée 15 fois
  40: 8,   // Note 40 jouée 8 fois
  // ...
}
```

**Utilité** : Identifier les notes importantes pour le mapping.

#### 3. Polyphonie

```javascript
polyphony: {
  max: 8,      // 8 notes simultanées max
  avg: 3.2,    // Moyenne 3.2 notes
  positions: [/* timestamped */]
}
```

**Utilité** : Vérifier que l'instrument a assez de voix.

#### 4. Contrôleurs MIDI Utilisés

```javascript
usedCCs: [1, 7, 10, 64, 91]
// 1  = Modulation
// 7  = Volume
// 10 = Pan
// 64 = Sustain Pedal
// 91 = Reverb
```

**Utilité** : Vérifier support des effets et contrôles.

#### 5. Programme MIDI (GM)

```javascript
primaryProgram: 0  // Acoustic Grand Piano (GM Program 0)
```

**Utilité** : Matcher le type d'instrument.

#### 6. Type d'Instrument Estimé

```javascript
estimatedType: "melody"  // ou "drums", "bass", "harmony", "percussive"
typeConfidence: 85       // Confiance à 85%
```

**Algorithme** :
- Canal 9 → toujours "drums"
- Programme MIDI → catégorie GM
- Plage de notes → bass si notes < 48
- Polyphonie → harmony si >4 voix
- Densité → percussive si beaucoup de notes courtes

#### 7. Density (Notes/Seconde)

```javascript
density: 2.5  // 2.5 notes par seconde en moyenne
```

**Utilité** : Distinguer mélodie (faible densité) vs percussion (haute densité).

### Exemple Complet

```javascript
// Canal 0 analysé
{
  channel: 0,
  noteRange: { min: 48, max: 84 },
  noteDistribution: { 60: 25, 64: 18, 67: 15, ... },
  totalNotes: 450,
  polyphony: { max: 6, avg: 2.8 },
  usedCCs: [1, 7, 64],
  usesPitchBend: true,
  programs: [0],
  primaryProgram: 0,
  trackNames: ["Piano"],
  density: 3.2,
  estimatedType: "melody",
  typeConfidence: 92,
  noteEvents: [/* array of note events */]
}
```

---

## 🎯 Système de Scoring

### Vue d'Ensemble

Le scoring évalue la **compatibilité** entre un canal MIDI et un instrument sur une échelle de **0 à 100 points**.

### Critères de Scoring (Total: 100 points)

| Critère | Points Max | Description |
|---------|-----------|-------------|
| **Programme MIDI** | 30 | Match du programme GM |
| **Notes** | 25 | Compatibilité plage de notes |
| **Polyphonie** | 15 | Nombre de voix suffisant |
| **Contrôleurs** | 15 | Support des CCs utilisés |
| **Type** | 10 | Correspondance de type |
| **Canal Drums** | 5 | Bonus pour canal 9 drums |

### 1. Score Programme MIDI (+30 points max)

#### Match Exact

```javascript
// Canal utilise Program 0 (Acoustic Grand Piano)
// Instrument configuré avec GM Program 0
→ Score: 30 points
→ Info: "Perfect program match: Acoustic Grand Piano (0)"
```

#### Match de Catégorie

```javascript
// Canal utilise Program 1 (Bright Acoustic Piano)
// Instrument configuré avec Program 0 (Acoustic Grand Piano)
// Les deux sont dans la catégorie "piano" (0-7)
→ Score: 15 points
→ Info: "Same GM category: piano"
```

#### Aucun Match

```javascript
// Canal utilise Program 0 (Piano)
// Instrument configuré avec Program 40 (Violin)
→ Score: 0 points
```

#### Catégories GM

```javascript
const GM_CATEGORIES = {
  piano: [0-7],
  chromatic: [8-15],
  organ: [16-23],
  guitar: [24-31],
  bass: [32-39],
  strings: [40-47],
  ensemble: [48-55],
  brass: [56-63],
  reed: [64-71],
  pipe: [72-79],
  synth_lead: [80-87],
  synth_pad: [88-95],
  synth_effects: [96-103],
  ethnic: [104-111],
  percussive: [112-119],
  sound_effects: [120-127]
}
```

### 2. Score Notes (+25 points max)

#### Mode Range (Instruments Continus)

**Cas 1 : Fit Parfait (25 points)**

```
Canal: 60-84 (2 octaves, C4-C6)
Instrument: 21-108 (88 notes, A0-C8)
→ Toutes les notes du canal rentrent
→ Pas de transposition nécessaire
→ Score: 25 points
→ Info: "Perfect note range fit (no transposition)"
```

**Cas 2 : Transposition Nécessaire (20-25 points)**

```
Canal: 36-60 (C2-C4)
Instrument: 48-72 (C3-C5)

Algorithme :
1. Calculer centres:
   - Centre canal = (36+60)/2 = 48
   - Centre instrument = (48+72)/2 = 60
2. Décalage = 60-48 = 12 semitones (1 octave)
3. Transposition: +12 semitones
4. Nouvelles notes: 48-72 ✅ (rentrent parfaitement)

→ Score: 25 points
→ Transposition: { semitones: 12, octaves: 1 }
→ Info: "Transposition: 1 octave(s) up"
```

**Cas 3 : Transposition avec Octave Wrapping (15-20 points)**

```
Canal: 36-84 (4 octaves)
Instrument: 48-72 (2 octaves)

Span canal (48) > Span instrument (24)
→ Incompatible si wrapping désactivé
→ Compatible avec wrapping:
   - Notes 36-47 → wrap +12 → 48-59 ✅
   - Notes 48-72 → pas de wrapping ✅
   - Notes 73-84 → wrap -12 → 61-72 ✅

→ Score: 18 points (pénalité légère)
→ octaveWrapping: { 36: 48, 37: 49, ..., 73: 61, ... }
→ Info: "Octave wrapping available: 12 note(s) wrapped up, 12 note(s) wrapped down"
```

**Cas 4 : Incompatible (0 points)**

```
Canal: 36-108 (6 octaves)
Instrument: 60-72 (1 octave)

Span canal (72) > Span instrument (12) × 2 (wrapping max)
→ Impossible de fit même avec wrapping

→ Score: 0 points
→ compatible: false
→ Issue: "Note span too wide (72 vs 12 semitones)"
```

#### Mode Discrete (Drums, Pads)

**Instruments en mode discrete** : Liste de notes spécifiques jouables

**Exemple : Drum Kit**
```javascript
selectedNotes: [36, 38, 42, 46, 49, 51]
// 36 = Kick
// 38 = Snare
// 42 = Closed Hi-Hat
// 46 = Open Hi-Hat
// 49 = Crash
// 51 = Ride
```

**Scoring pour Drums (Canal 9)** :

Utilise le **DrumNoteMapper** intelligent (voir [DRUMS_NOTE_MAPPING_STUDY.md](./DRUMS_NOTE_MAPPING_STUDY.md))

```javascript
// Fichier MIDI utilise: 36, 38, 40, 42, 44, 49, 51
// Instrument supporte: 36, 38, 42, 46, 49, 51

DrumNoteMapper :
  1. Classifier notes MIDI (kicks, snares, hi-hats, ...)
  2. Générer mapping intelligent
     - 36 (Kick) → 36 (exact match)
     - 38 (Snare) → 38 (exact match)
     - 40 (Electric Snare) → 38 (substitution snare)
     - 42 (Closed HH) → 42 (exact match)
     - 44 (Pedal HH) → 42 (substitution HH)
     - 49 (Crash) → 49 (exact match)
     - 51 (Ride) → 51 (exact match)
  3. Calculer qualité: 85/100
     - Essentials préservés: 100%
     - Important préservés: 90%
     - Substitutions intelligentes: 2

→ Score: 21/25 points (85% × 25)
→ noteRemapping: { 40: 38, 44: 42 }
→ Info: "Intelligent drum mapping: 85/100 quality, 7/7 notes mapped, 2 intelligent substitutions"
```

**Scoring pour Pads Non-Drums** :

Mapping simple "closest note"

```javascript
// Canal utilise: 60, 62, 64, 65, 67
// Instrument supporte: 60, 64, 67, 72

Mapping :
  60 → 60 (exact)
  62 → 60 (closest, -2 semitones)
  64 → 64 (exact)
  65 → 64 (closest, -1 semitone)
  67 → 67 (exact)

Support ratio = 3/5 = 60%

→ Score: 15/25 points (60% × 25)
→ noteRemapping: { 62: 60, 65: 64 }
→ Info: "60% of notes supported"
```

### 3. Score Polyphonie (+15 points max)

```javascript
// Canal polyphony max = 6 voix
// Instrument polyphony = 16 voix

Marge = 16 - 6 = 10 voix

if (marge >= 8) → 15 points ("Excellent polyphony")
else if (marge >= 4) → 10 points ("Good polyphony")
else if (marge >= 0) → 5 points ("Sufficient polyphony")
else → 0 points + warning ("Insufficient polyphony")
```

**Exemple** :
```javascript
Canal: max 6 voix
Instrument: 8 voix
Marge = 2 voix

→ Score: 5/15 points
→ Info: "Sufficient polyphony (8 available, 6 needed)"
```

### 4. Score Contrôleurs MIDI (+15 points max)

```javascript
// Canal utilise: [1, 7, 10, 64, 91]
// Instrument supporte: [1, 7, 10, 11, 64]

Supportés = [1, 7, 10, 64] = 4/5 = 80%

→ Score: 12/15 points (80% × 15)
→ Info: "Most CCs supported (4/5)"
→ Issue (warning): "Unsupported CCs: 91 (Reverb)"
```

**Cas spéciaux** :
- Canal n'utilise aucun CC → 15 points (pas de problème)
- Instrument supporte tous les CCs → 15 points

### 5. Score Type d'Instrument (+10 points max)

```javascript
// Canal estimatedType = "melody"
// Instrument type = "keyboard"

Mapping type instrument :
  drums → "drums"
  piano/keyboard → "melody"
  bass → "bass"
  strings → "melody"
  etc.

Match "melody" == "melody" → 10 points
```

### 6. Bonus Canal 9 Drums (+5 points)

```javascript
if (canal === 9 && instrument est drums) {
  score += 5
  info.push("MIDI channel 10 (drums) match")
}
```

### Score Total

```javascript
// Exemple complet:
Programme MIDI: 30 (perfect match)
Notes: 25 (perfect fit)
Polyphonie: 15 (excellent)
CCs: 12 (80% supportés)
Type: 10 (match)
Bonus drums: 0 (pas de drums)
---
TOTAL: 92/100 ⭐⭐⭐⭐⭐
```

---

## 🔧 Adaptations MIDI

### Types d'Adaptations

Le système applique automatiquement des adaptations pour maximiser la compatibilité :

#### 1. Transposition par Octaves

**Principe** : Décaler toutes les notes de ±12 semitones (octaves)

```javascript
Transposition: +12 semitones (1 octave up)

Note originale 60 (C4) → 72 (C5)
Note originale 64 (E4) → 76 (E5)
Note originale 67 (G4) → 79 (G5)
```

**Cas d'usage** : Piano enregistré trop bas pour clavier 61 touches

**Limitation** : Seulement par octaves entières (pas de ±1 semitone)

#### 2. Octave Wrapping

**Principe** : Ramener notes hors plage dans la plage en décalant de ±12

```javascript
Instrument range: 48-72

Note MIDI 36 (trop basse)
→ Wrap up: 36 + 12 = 48 ✅

Note MIDI 84 (trop haute)
→ Wrap down: 84 - 12 = 72 ✅
```

**Toggle utilisateur** : Peut être activé/désactivé dans l'UI

**Avantage** : Permet de jouer des notes hors plage
**Inconvénient** : Change l'octave → peut sonner différent

#### 3. Note Remapping (Discrete Mode)

**Principe** : Mapper notes non supportées vers notes similaires

##### Drums (Intelligent)

```javascript
Mapping intelligent via DrumNoteMapper :

Note 40 (Electric Snare) pas disponible
→ Table substitution : [38 (Snare), 37 (Rim), 54 (Tambourine)]
→ Sélection : 38 (Snare) car fonction similaire

Note 44 (Pedal HH) pas disponible
→ Table substitution : [42 (Closed HH), 46 (Open HH)]
→ Sélection : 42 (Closed HH) car même type
```

**Documentation complète** : [DRUMS_NOTE_MAPPING_STUDY.md](./DRUMS_NOTE_MAPPING_STUDY.md)

##### Pads (Simple)

```javascript
Mapping simple "closest note" :

Note 62 pas disponible
Available: [60, 64, 67, 72]
Distances: [2, 2, 5, 10]
→ Sélection : 60 ou 64 (égalité → choisir le premier)

mapping = { 62: 60 }
```

#### 4. Velocity Scaling (Futur)

**Principe** : Adapter les vélocités à la plage optimale de l'instrument

```javascript
// Non implémenté actuellement
Canal velocities: 10-127
Instrument optimal: 40-127

Scaling :
  velocity < 40 → map to 40
  velocity >= 40 → unchanged

Mapping: { 10: 40, 20: 40, 35: 40, 50: 50, ... }
```

### Application des Adaptations

Les adaptations sont appliquées **lors du routing**, pas sur le fichier original :

```javascript
// Fichier MIDI original reste intact
// Adaptations appliquées en temps réel pendant lecture

Routing: {
  fileId: 123,
  channel: 0,
  deviceId: "keyboard_yamaha",
  transposition: 12,  // +1 octave
  noteRemapping: { 40: 38, 44: 42 },
  octaveWrappingEnabled: true
}
```

**Avantages** :
- Fichier original préservé
- Peut tester différentes adaptations
- Réversible

---

## 🤖 Auto-Assignement

### Algorithme de Sélection

#### Étape 1 : Génération des Suggestions

Pour chaque canal actif :

```javascript
generateSuggestions(midiData, { topN: 5, minScore: 30 }) :
  1. Analyser tous canaux actifs → channelAnalyses[]
  2. Pour chaque canal :
     - Pour chaque instrument disponible :
       * Calculer compatibilité → score 0-100
       * Si score >= minScore (30) → ajouter à suggestions
     - Trier par score décroissant
     - Garder top 5
  3. Retourner suggestions{channel: [options]}
```

**Exemple** :
```javascript
suggestions = {
  0: [  // Canal 0 (Piano)
    { instrument: "Yamaha Piano", score: 92 },
    { instrument: "Roland Keys", score: 78 },
    { instrument: "Synth Pad", score: 45 },
    // ... top 5
  ],
  9: [  // Canal 9 (Drums)
    { instrument: "Roland Drums", score: 88 },
    { instrument: "Alesis Kit", score: 65 },
    // ...
  ]
}
```

#### Étape 2 : Sélection Automatique

**Objectif** : 1 instrument par canal, éviter conflits

```javascript
selectBestAssignments(suggestions) :
  1. Créer liste canaux triée par priorité :
     - Canal 9 (drums) en premier
     - Puis par meilleur score décroissant

  2. Pour chaque canal (dans l'ordre de priorité) :
     a. Chercher instrument non encore assigné avec meilleur score
     b. Si tous assignés → réutiliser le meilleur (multi-canal)
     c. Assigner l'instrument au canal

  3. Retourner autoSelection{}
```

**Exemple** :
```javascript
// 3 canaux, 2 instruments disponibles

Canaux triés :
  - Canal 9 (drums, meilleur score = 88)
  - Canal 0 (piano, meilleur score = 92)
  - Canal 1 (strings, meilleur score = 75)

Assignement :
  1. Canal 9 → "Roland Drums" (score 88) ✅
  2. Canal 0 → "Yamaha Piano" (score 92) ✅
  3. Canal 1 → "Yamaha Piano" (score 65, réutilisé) ⚠️

autoSelection = {
  9: { deviceId: "roland_drums", score: 88, ... },
  0: { deviceId: "yamaha_piano", score: 92, ... },
  1: { deviceId: "yamaha_piano", score: 65, reused: true, ... }
}
```

#### Étape 3 : Calcul de Confiance Globale

```javascript
calculateConfidence(autoSelection, totalChannels) :
  - Moyenne scores des canaux assignés
  - Taux de réussite (combien assignés / total)
  - Formule: avgScore × successRate

Exemple :
  8 canaux actifs
  8 canaux assignés (100% réussite)
  Scores: [92, 88, 85, 78, 72, 68, 65, 58]
  Moyenne: 75.75

  Confiance = 75.75 × 1.0 = 76/100 ⭐⭐⭐⭐
```

### Cache et Performance

#### Cache LRU

```javascript
AnalysisCache :
  - Capacité: 100 entrées
  - TTL: 10 minutes
  - Clé: (fileId, channel)
  - Cleanup automatique toutes les 5 minutes
```

**Avantage** : Évite de réanalyser les mêmes canaux lors de changements d'instruments

**Invalidation** : Cache vidé quand fichier MIDI modifié

---

## 🖥️ Interface Utilisateur

### Modal d'Auto-Assignement

#### 1. Header

```
Auto-Assign Instruments                              [×]
```

#### 2. Score de Confiance Global

```
┌──────────────────────────────────────────────┐
│ Confidence Score: 76/100 ⭐⭐⭐⭐              │
│ 8 channel(s) detected                        │
└──────────────────────────────────────────────┘
```

#### 3. Liste des Canaux

**Pour chaque canal** :

```
┌─ Channel 1 ───────────────────────────────────┐
│                                                │
│ [Stats du canal]                               │
│ 📝 Note Range: 48-84 (36 semitones)           │
│ 🎵 Polyphony: Max 6 | Avg: 3.2                │
│ 🎹 Type: melody (92% confidence)              │
│ [━━━━━━━━━━━━━━━━━━━━━] 48 → 84               │
│                                                │
│ [Suggestions d'instruments]                    │
│                                                │
│ ┌─ Yamaha Piano ───────────────── 92 ─┐       │
│ │ GM Program 0 | Transposition: none  │       │
│ │ ✓ Perfect program match            │       │
│ │ ✓ Perfect note range fit           │       │
│ │ RECOMMENDED                        │       │
│ └────────────────────────────────────┘       │
│                                                │
│ ┌─ Roland Keys ────────────────── 78 ─┐       │
│ │ GM Program 0 | Transposition: +12   │       │
│ │ ✓ Same GM category: piano          │       │
│ │ ⚠ Transposition: 1 octave up       │       │
│ └────────────────────────────────────┘       │
│                                                │
│ [...] (top 5 max)                              │
│                                                │
│ [🔊 Preview Channel 1]                         │
└────────────────────────────────────────────────┘
```

#### 4. Contrôles

```
[Cancel]   [🎵 Preview Original] [🎵 Preview Adapted]   [⚡ Quick Assign] [Apply Assignments]
```

### Interactions

#### Sélection d'Instrument

- **Click** sur une option → sélectionne cet instrument pour le canal
- **Border verte** → instrument actuellement sélectionné
- **Score en gros** → visibilité immédiate

#### Octave Wrapping Toggle

Si disponible pour un instrument :

```
☐ Enable Octave Wrapping
  12 note(s) wrapped up, 5 note(s) wrapped down
```

**Check** → active le wrapping
**Uncheck** → désactive (peut rendre incompatible)

#### Preview

**Preview Original** : Joue le fichier MIDI original (sans adaptations)
**Preview Adapted** : Joue avec transpositions/remappings appliqués
**Preview Channel X** : Joue uniquement le canal X (solo)

**Bouton Stop** apparaît pendant lecture

#### Quick Assign & Apply

**Quick Assign** :
1. Utilise auto-sélection (meilleurs scores)
2. Applique immédiatement
3. Ferme le modal
4. Saute l'étape de révision manuelle

**Apply Assignments** :
1. Applique les sélections manuelles de l'utilisateur
2. Crée les routings dans la base de données
3. Ferme le modal
4. Prêt à jouer

### Validation des Capabilities

Avant l'auto-assignement :

```
Vérification:
  instrument_1 → capabilities complètes ✅
  instrument_2 → note_range_min manquant ❌
  instrument_3 → capabilities complètes ✅

→ Ouvre modal "Instrument Capabilities"
→ Demande à l'utilisateur de compléter
→ Continue auto-assignement après
```

**Avantage** : Garantit que le scoring a toutes les infos nécessaires

---

## 🎬 Cas d'Usage

### Cas 1 : Piano Simple

**Fichier** : piano_solo.mid
- 1 canal (0)
- Programme 0 (Acoustic Grand Piano)
- Notes: 36-96 (5 octaves)
- Polyphonie max: 10

**Instruments disponibles** :
- Yamaha P-125 (88 notes, polyphony 192)
- Roland FP-30 (88 notes, polyphony 128)

**Résultat** :
```
Yamaha P-125: 100/100
  - Perfect program match (0)
  - Perfect note range fit
  - Excellent polyphony
  - All CCs supported

Roland FP-30: 100/100
  - Identique

Auto-sélection: Yamaha P-125 (premier dans la liste)
Confiance: 100/100 ⭐⭐⭐⭐⭐
```

### Cas 2 : Drum Kit Incomplet

**Fichier** : rock_drums.mid
- Canal 9 (drums)
- Notes utilisées: 36, 38, 40, 42, 44, 46, 49, 51, 55, 57

**Instrument disponible** :
- Roland TD-1KV (kit réduit)
- Notes supportées: 36, 38, 42, 46, 49, 51

**Résultat** :
```
Roland TD-1KV: 68/100
  - Drum mapping quality: 68/100
  - 10/10 notes mapped
  - 4 intelligent substitutions:
    * 40 (Electric Snare) → 38 (Snare)
    * 44 (Pedal HH) → 42 (Closed HH)
    * 55 (Splash) → 49 (Crash)
    * 57 (Crash 2) → 49 (Crash)
  - Essential elements preserved: 100%

⚠️ Some notes will be substituted

Auto-sélection: Roland TD-1KV
Confiance: 68/100 ⭐⭐⭐
```

### Cas 3 : Multi-Canal Orchestre

**Fichier** : orchestra.mid
- 16 canaux actifs
- Programmes: Piano, Strings, Brass, Flute, etc.

**Instruments disponibles** :
- 3 instruments seulement

**Résultat** :
```
Canal 0 (Piano) → Yamaha Piano (95)
Canal 1 (Strings) → Roland Synth (78)
Canal 2 (Brass) → Roland Synth (68, réutilisé)
Canal 3 (Flute) → Yamaha Piano (45, réutilisé)
...
Canaux 4-15 → Yamaha Piano ou Roland Synth (réutilisés)

Auto-sélection: 16/16 canaux assignés
Mais confiance basse car beaucoup de réutilisations

Confiance: 42/100 ⭐⭐
```

**Message** : "Consider connecting more instruments for better quality"

### Cas 4 : Transposition Nécessaire

**Fichier** : bass_line.mid
- Canal 0
- Programme 33 (Electric Bass)
- Notes: 28-52 (très graves)

**Instrument disponible** :
- Clavier 61 touches (notes 36-96)

**Résultat** :
```
Clavier 61 touches: 78/100
  - Same GM category: bass
  - Transposition: +12 semitones (1 octave up)
  - Notes après transposition: 40-64 ✅
  - ⚠️ Transposition changes the timbre

Auto-sélection: Clavier 61 touches
Confiance: 78/100 ⭐⭐⭐⭐

Note: Bass will sound one octave higher
```

---

## 🛠️ Dépannage

### Problème : Score Très Bas (<30)

**Cause possible** :
- Plage de notes incompatible
- Programme MIDI très différent
- Polyphonie insuffisante

**Solution** :
1. Vérifier capabilities instrument
2. Essayer octave wrapping
3. Chercher instrument plus adapté
4. Accepter transposition/remapping

### Problème : Tous les Canaux sur le Même Instrument

**Cause** : Pas assez d'instruments disponibles

**Solution** :
1. Connecter plus d'instruments
2. Accepter multi-canal (certains instruments le supportent)
3. Désactiver canaux moins importants

### Problème : Drums Sonnent Mal

**Cause** :
- Kit incomplet
- Mauvaises substitutions
- Instrument pas configuré en mode drums

**Solution** :
1. Vérifier que instrument est en mode "discrete"
2. Ajouter toutes les notes GM Drums essentielles (36, 38, 42, 46, 49, 51)
3. Consulter [DRUMS_NOTE_MAPPING_STUDY.md](./DRUMS_NOTE_MAPPING_STUDY.md)

### Problème : Capabilities Manquantes

**Symptôme** : Modal capabilities s'ouvre avant auto-assign

**Solution** :
1. Compléter les informations demandées :
   - Note range (min-max)
   - Polyphony
   - Mode (range ou discrete)
   - Selected notes (si discrete)
2. Sauvegarder
3. Auto-assignement reprend automatiquement

### Problème : Preview Ne Fonctionne Pas

**Causes possibles** :
- Instruments non connectés/allumés
- Problème MIDI output
- Fichier MIDI corrompu

**Solution** :
1. Vérifier connexions physiques
2. Tester avec "Test MIDI" dans settings
3. Recharger la page

---

## 📚 Références

### Documentation Associée

- [DRUMS_NOTE_MAPPING_STUDY.md](./DRUMS_NOTE_MAPPING_STUDY.md) - Guide complet mapping drums
- [ASSIGNMENT_SYSTEM_AUDIT.md](./ASSIGNMENT_SYSTEM_AUDIT.md) - Audit technique du système
- [INSTALLATION_VERIFICATION.md](./INSTALLATION_VERIFICATION.md) - Vérification installation

### Fichiers Sources

- **Backend** :
  - `src/midi/AutoAssigner.js`
  - `src/midi/InstrumentMatcher.js`
  - `src/midi/DrumNoteMapper.js`
  - `src/midi/ChannelAnalyzer.js`

- **Frontend** :
  - `public/js/views/components/AutoAssignModal.js`
  - `public/js/views/components/InstrumentCapabilitiesModal.js`

### API Commands

```javascript
// Générer suggestions
await api.sendCommand('generate_assignment_suggestions', {
  fileId: 123,
  topN: 5,
  minScore: 30
})

// Analyser un canal
await api.sendCommand('analyze_channel', {
  fileId: 123,
  channel: 0
})

// Appliquer assignments
await api.sendCommand('apply_assignments', {
  fileId: 123,
  assignments: { ... }
})

// Valider capabilities
await api.sendCommand('validate_instrument_capabilities', {})
```

---

## 🎯 Conclusion

Le système d'assignement et d'adaptation MIDI est conçu pour :

✅ **Automatiser** l'appairage canaux MIDI ↔ instruments
✅ **Optimiser** via scoring multi-critères sophistiqué
✅ **Adapter** avec transpositions, wrapping, remapping
✅ **Gérer** les cas complexes (drums, multi-canal, plages limitées)
✅ **Informer** l'utilisateur avec feedback clair et visuel

**Résultat** : Conversion fichier MIDI → musique jouable en quelques clicks ! 🎵
