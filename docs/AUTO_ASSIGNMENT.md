# Documentation Complète : Auto-Assignation des Canaux MIDI

## Table des Matières

1. [Vue d'Ensemble](#vue-densemble)
2. [Concepts Fondamentaux](#concepts-fondamentaux)
3. [Architecture du Système](#architecture-du-système)
4. [Capacités des Instruments](#capacités-des-instruments)
5. [Algorithme de Scoring](#algorithme-de-scoring)
6. [Transposition et Adaptation](#transposition-et-adaptation)
7. [Octave Wrapping](#octave-wrapping)
8. [Guide d'Utilisation](#guide-dutilisation)
9. [Exemples Pratiques](#exemples-pratiques)
10. [Référence Technique](#référence-technique)

---

## Vue d'Ensemble

### Qu'est-ce que l'Auto-Assignation ?

L'auto-assignation est un système intelligent qui analyse les canaux MIDI d'un fichier et propose automatiquement les meilleurs instruments connectés pour jouer chaque canal, en tenant compte de :

- **Type d'instrument** (piano, drums, bass, strings, etc.)
- **Plage de notes jouables** (note_range_min/max)
- **Capacités polyphoniques** (nombre de notes simultanées)
- **Control Changes supportés** (CC7, CC11, CC64, etc.)
- **Modes de jeu** (continu vs discret pour les drums)

### Objectifs du Système

1. **Automatisation** : Réduire le travail manuel d'assignation canal par canal
2. **Qualité** : Maximiser la compatibilité entre canaux MIDI et instruments
3. **Préservation** : Garder la mélodie originale autant que possible (transpositions par octaves)
4. **Flexibilité** : Offrir plusieurs choix par canal avec scores de compatibilité
5. **Non-Destructif** : Créer des fichiers adaptés sans modifier l'original

---

## Concepts Fondamentaux

### Canaux MIDI (0-15)

Un fichier MIDI standard peut contenir jusqu'à 16 canaux (0-15). Chaque canal représente généralement une partie instrumentale :

- **Canal 9 (MIDI 10)** : Traditionnellement réservé aux drums
- **Canaux 0-8, 10-15** : Instruments mélodiques/harmoniques

### General MIDI (GM) Programs

Le standard General MIDI définit 128 programmes (0-127) organisés en catégories :

| Plage | Catégorie | Exemples |
|-------|-----------|----------|
| 0-7 | Piano | Acoustic Grand Piano, Electric Piano |
| 8-15 | Chromatic Percussion | Celesta, Glockenspiel, Vibraphone |
| 16-23 | Organ | Drawbar Organ, Church Organ |
| 24-31 | Guitar | Acoustic Guitar, Electric Guitar |
| 32-39 | Bass | Acoustic Bass, Electric Bass, Synth Bass |
| 40-47 | Strings | Violin, Viola, Cello, Orchestra Strings |
| 48-55 | Ensemble | String Ensemble, Choir, Orchestra Hit |
| 56-63 | Brass | Trumpet, Trombone, French Horn |
| 64-71 | Reed | Saxophone, Oboe, Clarinet |
| 72-79 | Pipe | Flute, Recorder, Pan Flute |
| 80-87 | Synth Lead | Square Lead, Sawtooth Lead |
| 88-95 | Synth Pad | Warm Pad, Poly Synth Pad |
| 96-103 | Synth Effects | Rain, Soundtrack, Crystal |
| 104-111 | Ethnic | Sitar, Banjo, Shamisen |
| 112-119 | Percussive | Tinkle Bell, Steel Drums |
| 120-127 | Sound Effects | Guitar Fret Noise, Seashore, Helicopter |

### Analyse de Canal

Avant d'assigner un instrument, le système analyse chaque canal pour extraire :

```javascript
{
  channel: 0,                    // Numéro du canal (0-15)
  noteRange: { min: 48, max: 84 }, // Plage de notes utilisées
  polyphony: { max: 6, avg: 3.2 }, // Polyphonie max et moyenne
  usedCCs: [7, 11, 64, 71],      // Control Changes utilisés
  programs: [0],                  // Programmes MIDI utilisés
  density: 8.5,                   // Notes par beat en moyenne
  estimatedType: {                // Type estimé
    type: 'piano',
    confidence: 85,
    scores: {
      piano: 85,
      strings: 60,
      organ: 40,
      // ...
    }
  }
}
```

### Types d'Instruments Détectés

Le système peut détecter automatiquement :

- **drums** : Canal 9, haute densité, plage étroite, programmes 0-127 sur canal 9
- **bass** : Notes basses (< 48), faible polyphonie (1-2), programmes 32-39
- **piano** : Large plage, haute polyphonie (> 4), programmes 0-7
- **strings** : Moyenne polyphonie (3-6), programmes 40-55
- **organ** : Haute polyphonie, sustain CC64, programmes 16-23
- **lead** : Faible polyphonie (1-2), notes hautes, programmes 80-87
- **pad** : Haute polyphonie, longues notes, programmes 88-95
- **brass** : Moyenne polyphonie, programmes 56-63
- **percussive** : Faible polyphonie, notes courtes, programmes 112-119

---

## Architecture du Système

### Composants Principaux

```
┌─────────────────────────────────────────────────────────────┐
│                     AutoAssignModal.js                       │
│                   (Interface Utilisateur)                    │
└────────────┬────────────────────────────────────────────────┘
             │
             ├─► Affichage des suggestions
             ├─► Sélection manuelle
             ├─► Preview audio
             └─► Application finale
                        │
        ┌───────────────┴───────────────┐
        │                               │
        ▼                               ▼
┌─────────────────┐            ┌──────────────────┐
│  AutoAssigner   │            │  AudioPreview    │
└────────┬────────┘            └──────────────────┘
         │
         ├─► ChannelAnalyzer (analyse canaux MIDI)
         ├─► InstrumentMatcher (calcul compatibilité)
         └─► MidiTransposer (adaptation du fichier)
```

### Flux de Traitement

```
1. Sélection fichier MIDI
        │
        ▼
2. Analyse de chaque canal
   ├─► Extraction plage de notes
   ├─► Calcul polyphonie
   ├─► Détection CCs utilisés
   ├─► Estimation type d'instrument
   └─► Calcul densité de notes
        │
        ▼
3. Génération de suggestions
   ├─► Pour chaque canal :
   │   └─► Pour chaque instrument :
   │       ├─► Calcul score de compatibilité
   │       ├─► Calcul transposition optimale
   │       └─► Détection octave wrapping
   │
   ├─► Tri par score (meilleur en premier)
   └─► Sélection top-N (défaut: 5)
        │
        ▼
4. Présentation à l'utilisateur
   ├─► Affichage des options par canal
   ├─► Mise en surbrillance du recommandé
   └─► Options de preview audio
        │
        ▼
5. Sélection et application
   ├─► Utilisateur sélectionne ou accepte auto
   ├─► Preview optionnel (original vs adapté)
   ├─► Application des transpositions
   ├─► Création fichier adapté
   └─► Sauvegarde des routings
```

### Fichiers Source

| Fichier | Rôle | Lignes |
|---------|------|--------|
| `src/midi/ChannelAnalyzer.js` | Analyse des canaux MIDI | ~520 |
| `src/midi/InstrumentMatcher.js` | Scoring de compatibilité | ~450 |
| `src/midi/AutoAssigner.js` | Orchestration générale | ~290 |
| `src/midi/MidiTransposer.js` | Application des transpositions | ~200 |
| `src/midi/AnalysisCache.js` | Cache LRU pour performances | ~180 |
| `src/midi/ScoringConfig.js` | Configuration des poids | ~150 |
| `public/js/views/components/AutoAssignModal.js` | Interface utilisateur | ~650 |
| `public/js/audio/AudioPreview.js` | Preview audio | ~240 |

---

## Capacités des Instruments

### Définition des Capacités

Chaque instrument dans la base de données possède des propriétés définissant ses capacités :

```javascript
{
  id: 1,
  device_id: "device_abc123",
  name: "Yamaha PSR-E373",
  custom_name: "Mon Clavier Principal",

  // Capacités MIDI
  gm_program: 0,              // Programme GM (0 = Acoustic Grand Piano)
  note_range_min: 21,         // Note la plus basse (A0)
  note_range_max: 108,        // Note la plus haute (C8)
  polyphony: 48,              // Nombre max de notes simultanées

  // Mode de jeu
  mode: "continuous",         // "continuous" ou "discrete"
  selected_notes: null,       // Pour mode discrete: [36, 38, 42, ...]

  // Control Changes supportés
  supported_ccs: [1, 7, 10, 11, 64, 71, 72, 73, 74, 91, 93],

  // Metadata
  type: "keyboard",
  manufacturer: "Yamaha",
  // ...
}
```

### Mode Continu vs Discret

#### Mode Continu (`continuous`)

Pour les instruments mélodiques/harmoniques qui peuvent jouer n'importe quelle note dans leur plage :

- **Pianos**, **Guitares**, **Synthés**, **Strings**
- Plage définie par `note_range_min` et `note_range_max`
- Toutes les notes MIDI entre min et max sont jouables

#### Mode Discret (`discrete`)

Pour les instruments qui ne peuvent jouer que des notes spécifiques :

- **Drums** : Chaque pad correspond à un son spécifique
- **Sample Pads** : Notes assignées à des samples
- Plage définie par `selected_notes` (array de numéros MIDI)

Exemple de batterie électronique :
```javascript
{
  mode: "discrete",
  selected_notes: [
    36,  // Kick (Bass Drum)
    38,  // Snare
    42,  // Closed Hi-Hat
    44,  // Pedal Hi-Hat
    46,  // Open Hi-Hat
    48,  // Tom 1
    50,  // Tom 2
    // ...
  ]
}
```

### Control Changes (CCs)

Les Control Changes permettent de contrôler des paramètres expressifs :

| CC | Nom | Usage |
|----|-----|-------|
| 1 | Modulation | Vibrato, tremolo |
| 7 | Volume | Volume du canal |
| 10 | Pan | Position stéréo |
| 11 | Expression | Nuances dynamiques |
| 64 | Sustain Pedal | Pédale de sustain (piano) |
| 71 | Resonance | Filtre résonance (synth) |
| 72 | Release Time | Temps de release |
| 73 | Attack Time | Temps d'attack |
| 74 | Brightness | Brillance du timbre |
| 91 | Reverb Depth | Niveau de réverbération |
| 93 | Chorus Depth | Niveau de chorus |

Un instrument qui supporte plus de CCs aura un score bonus si le canal MIDI les utilise.

---

## Algorithme de Scoring

### Vue d'Ensemble du Score

Le score de compatibilité est calculé sur **100 points** avec 6 critères pondérés :

```
Score Total = Score_Program (30pts)
            + Score_NoteRange (25pts)
            + Score_Polyphony (15pts)
            + Score_CCs (15pts)
            + Score_Type (10pts)
            + Score_ChannelSpecial (5pts)
```

### 1. Score Program Match (30 points max)

Compare le programme MIDI du canal avec celui de l'instrument :

```javascript
// Match parfait (même programme GM)
if (channelProgram === instrumentProgram) {
  score = 30;
}
// Même catégorie GM (ex: tous les deux des pianos)
else if (sameCategory(channelProgram, instrumentProgram)) {
  score = 20;
}
// Catégories différentes
else {
  score = 0;
}
```

**Exemples** :
- Canal utilise program 0 (Acoustic Grand Piano), Instrument gm_program = 0 → **30 pts**
- Canal utilise program 1 (Bright Acoustic Piano), Instrument gm_program = 2 (Electric Grand Piano) → **20 pts** (même catégorie Piano)
- Canal utilise program 0 (Piano), Instrument gm_program = 40 (Violin) → **0 pt**

### 2. Score Note Range (25 points max)

Évalue si les notes du canal rentrent dans la plage de l'instrument :

```javascript
// Mode Discrete (drums)
if (instrument.mode === 'discrete') {
  const supportRatio = notesSupported / totalNotesInChannel;

  if (supportRatio === 1.0) {
    score = 25;  // Toutes les notes supportées
  } else if (supportRatio >= 0.7) {
    score = 20;  // 70%+ des notes supportées
  } else if (supportRatio > 0) {
    score = Math.round(supportRatio * 15);  // Partiel
  } else {
    score = 0;   // Incompatible
  }
}

// Mode Continuous
else {
  const octaveShift = calculateOptimalOctaveShift(channel, instrument);

  if (octaveShift.compatible === false) {
    score = 0;  // Impossible de fitter
  }
  else if (octaveShift.octaves === 0) {
    score = 25;  // Parfait, pas de transposition
  }
  else {
    // Pénalité de 3 pts par octave de transposition
    score = Math.max(0, 20 - Math.abs(octaveShift.octaves) * 3);
  }
}
```

**Exemples** :
- Canal: 48-72 (C3-C5), Instrument: 21-108 (A0-C8), Transposition: 0 octave → **25 pts**
- Canal: 60-84, Instrument: 48-84, Transposition: -1 octave → **17 pts** (20 - 3)
- Canal: 24-48, Instrument: 48-84, Transposition: +2 octaves → **14 pts** (20 - 6)

### 3. Score Polyphony (15 points max)

Compare la polyphonie requise par le canal avec celle de l'instrument :

```javascript
const channelMaxPolyphony = channel.polyphony.max;  // Ex: 6 notes simultanées
const instrumentPolyphony = instrument.polyphony;    // Ex: 48

if (instrumentPolyphony >= channelMaxPolyphony) {
  // Instrument peut gérer toute la polyphonie
  score = 15;
}
else {
  // Polyphonie insuffisante (pénalité)
  const ratio = instrumentPolyphony / channelMaxPolyphony;
  score = Math.round(ratio * 15);

  // Note: créera un warning dans la compatibilité
}
```

**Exemples** :
- Canal max poly: 4, Instrument poly: 48 → **15 pts**
- Canal max poly: 6, Instrument poly: 8 → **15 pts**
- Canal max poly: 8, Instrument poly: 4 → **7 pts** (4/8 * 15) + Warning

### 4. Score Control Changes (15 points max)

Vérifie combien de CCs utilisés par le canal sont supportés par l'instrument :

```javascript
const channelCCs = [7, 11, 64, 71];  // CCs utilisés par le canal
const instrumentCCs = [1, 7, 10, 11, 64, 71, 91, 93];  // CCs supportés

const supported = channelCCs.filter(cc => instrumentCCs.includes(cc));
const ratio = supported.length / channelCCs.length;

score = Math.round(ratio * 15);
```

**Exemples** :
- Canal CCs: [7, 11, 64], Instrument CCs: [7, 10, 11, 64, 71] → **15 pts** (3/3 = 100%)
- Canal CCs: [7, 11, 64, 71], Instrument CCs: [7, 11] → **7 pts** (2/4 = 50%)
- Canal CCs: [], Instrument CCs: [...] → **15 pts** (pas de CCs requis = compatible)

### 5. Score Instrument Type (10 points max)

Compare le type estimé du canal avec le type de l'instrument :

```javascript
const channelType = channel.estimatedType.type;        // Ex: "piano"
const channelConfidence = channel.estimatedType.confidence; // Ex: 85
const instrumentType = instrument.type;                // Ex: "keyboard"

// Mapping des types similaires
const typeMapping = {
  'piano': ['keyboard', 'piano'],
  'drums': ['drums', 'percussion'],
  'bass': ['bass', 'keyboard'],
  'strings': ['strings', 'keyboard'],
  // ...
};

if (typeMapping[channelType]?.includes(instrumentType)) {
  // Match de type, score basé sur la confiance
  score = Math.round((channelConfidence / 100) * 10);
}
else {
  score = 0;
}
```

**Exemples** :
- Canal type: "piano" (conf: 90%), Instrument: "keyboard" → **9 pts**
- Canal type: "drums" (conf: 95%), Instrument: "drums" → **9 pts**
- Canal type: "piano" (conf: 85%), Instrument: "strings" → **0 pt**

### 6. Score Channel Special (5 points max)

Bonus pour les correspondances spéciales :

```javascript
// Canal 9 (drums) avec instrument drums
if (channel.number === 9 && instrument.type === 'drums') {
  score = 5;
}
// Instrument avec gm_program correspondant exactement
else if (channel.programs[0] === instrument.gm_program) {
  score = 5;
}
else {
  score = 0;
}
```

### Calcul du Score Final

```javascript
const totalScore =
  programScore +      // 0-30
  noteRangeScore +    // 0-25
  polyphonyScore +    // 0-15
  ccScore +           // 0-15
  typeScore +         // 0-10
  channelSpecialScore; // 0-5

// Total max: 100 points
```

### Interprétation des Scores

| Score | Évaluation | Signification |
|-------|------------|---------------|
| 90-100 | ⭐⭐⭐⭐⭐ Excellent | Match quasi-parfait |
| 70-89 | ⭐⭐⭐⭐ Très Bon | Très compatible, recommandé |
| 50-69 | ⭐⭐⭐ Bon | Compatible, utilisable |
| 30-49 | ⭐⭐ Acceptable | Possible mais sous-optimal |
| 0-29 | ⭐ Faible | Peu compatible, à éviter |

---

## Transposition et Adaptation

### Principe de la Transposition par Octaves

Le système privilégie les **transpositions par octaves complètes** (multiples de 12 semitones) pour préserver la mélodie :

```
Octave = 12 semitones
+1 octave = +12 semitones (monter d'une octave)
-1 octave = -12 semitones (descendre d'une octave)
+2 octaves = +24 semitones
-2 octaves = -24 semitones
```

### Calcul de la Transposition Optimale

```javascript
// 1. Calculer les centres de plage
const channelCenter = (channel.noteRange.min + channel.noteRange.max) / 2;
const instrumentCenter = (instrument.note_range_min + instrument.note_range_max) / 2;

// 2. Différence brute
const rawShift = instrumentCenter - channelCenter;

// 3. Arrondir au multiple de 12 le plus proche
const octaves = Math.round(rawShift / 12);
const semitones = octaves * 12;

// 4. Vérifier que toutes les notes rentrent
const newMin = channel.noteRange.min + semitones;
const newMax = channel.noteRange.max + semitones;

if (newMin >= instrument.note_range_min &&
    newMax <= instrument.note_range_max) {
  // Transposition valide
  return { semitones, octaves, compatible: true };
}

// 5. Si échec, essayer ±1 octave
for (offset of [-1, 1]) {
  const altOctaves = octaves + offset;
  const altSemitones = altOctaves * 12;
  // ... test de validation
}
```

### Exemples de Transposition

#### Exemple 1 : Piano vers Piano (pas de transposition)

```
Canal MIDI:
  - Plage: C3 (48) → C5 (72)
  - Centre: 60 (C4)

Instrument:
  - Plage: A0 (21) → C8 (108)
  - Centre: 64.5

Calcul:
  rawShift = 64.5 - 60 = 4.5
  octaves = round(4.5 / 12) = 0
  semitones = 0

Résultat: Pas de transposition nécessaire ✓
```

#### Exemple 2 : Piano Aigu vers Piano (descendre)

```
Canal MIDI:
  - Plage: C5 (72) → C7 (96)
  - Centre: 84

Instrument:
  - Plage: C2 (36) → C6 (84)
  - Centre: 60

Calcul:
  rawShift = 60 - 84 = -24
  octaves = round(-24 / 12) = -2
  semitones = -24

Vérification:
  newMin = 72 + (-24) = 48 ✓ (>= 36)
  newMax = 96 + (-24) = 72 ✓ (<= 84)

Résultat: -2 octaves (descendre de 2 octaves) ✓
```

#### Exemple 3 : Bass vers Piano (monter)

```
Canal MIDI:
  - Plage: E1 (28) → E3 (52)
  - Centre: 40

Instrument:
  - Plage: C3 (48) → C6 (84)
  - Centre: 66

Calcul:
  rawShift = 66 - 40 = 26
  octaves = round(26 / 12) = 2
  semitones = 24

Vérification:
  newMin = 28 + 24 = 52 ✓ (>= 48)
  newMax = 52 + 24 = 76 ✓ (<= 84)

Résultat: +2 octaves (monter de 2 octaves) ✓
```

### Note Remapping (Drums)

Pour les instruments en mode `discrete` (drums), les notes sont mappées individuellement :

```javascript
// Canal drums utilise: [36, 38, 42, 46, 48, 50]
// Instrument supporte: [36, 38, 42, 45, 47, 49, 51]

const noteRemapping = {
  46: 45,  // Open Hi-Hat → Tom 1 (note la plus proche)
  48: 47,  // Tom 1 → Tom 2
  50: 49,  // Tom 2 → Crash
  // Notes 36, 38, 42 sont supportées directement (pas de mapping)
};
```

Le mapping utilise la **note disponible la plus proche** :

```javascript
function findClosestNote(targetNote, availableNotes) {
  let closest = availableNotes[0];
  let minDistance = Math.abs(targetNote - closest);

  for (const note of availableNotes) {
    const distance = Math.abs(targetNote - note);
    if (distance < minDistance) {
      minDistance = distance;
      closest = note;
    }
  }

  return closest;
}
```

### Application de la Transposition

Le `MidiTransposer` applique les transpositions en deux étapes :

```javascript
// 1. Transposition par semitones (octaves)
if (transposition.semitones !== 0) {
  currentNote = originalNote + transposition.semitones;
  currentNote = clamp(currentNote, 0, 127);  // Limiter à la plage MIDI valide
}

// 2. Note remapping (drums + octave wrapping)
if (transposition.noteRemapping[currentNote] !== undefined) {
  currentNote = transposition.noteRemapping[currentNote];
}

// Mise à jour de l'événement MIDI
event.note = currentNote;
```

Cette approche garantit que :
1. La mélodie est préservée (transposition par octaves)
2. Les notes hors plage sont gérées (remapping)
3. Les notes invalides sont clampées (0-127)

---

## Octave Wrapping

### Concept

L'**octave wrapping** permet d'étendre la compatibilité des instruments avec des plages limitées en "repliant" les notes qui dépassent :

- **Notes en dessous** de la plage → **+12 semitones** (montées d'une octave)
- **Notes au dessus** de la plage → **-12 semitones** (descendues d'une octave)

C'est une option **activable manuellement** par l'utilisateur pour chaque canal.

### Quand Utiliser l'Octave Wrapping ?

#### Cas d'Usage Typiques

1. **Instrument avec plage limitée** jouant un canal large
   ```
   Canal: C2 (36) → C6 (84)
   Instrument: C3 (48) → C5 (72)

   Transposition optimale: +12 semitones
   Résultat: 48-96, mais max = 72

   → Notes 73-84 dépassent
   → Avec wrapping: 73-84 → 61-72 (descendre d'une octave)
   ```

2. **Préserver plus de notes** dans la plage cible
   ```
   Canal drums: Notes 24, 28, 36, 38, 48, 50, 60
   Instrument: 36-60

   Sans wrapping: Notes 24, 28 perdues
   Avec wrapping: 24 → 36, 28 → 40 (montées)
   ```

3. **Éviter les coupures** de notes extrêmes
   ```
   Passage orchestral avec notes très graves et très aiguës
   Instrument ne couvre pas toute la plage

   → Wrapping permet de garder toutes les notes
   ```

### Calcul du Wrapping

```javascript
function calculateOctaveWrapping(channelRange, instrumentCaps, baseSemitones) {
  const mapping = {};
  let notesBelow = 0;
  let notesAbove = 0;

  // Pour chaque note du canal
  for (let note = channelRange.min; note <= channelRange.max; note++) {
    const transposedNote = note + baseSemitones;

    // Note trop basse → monter d'une octave
    if (transposedNote < instrumentCaps.min) {
      const wrappedNote = transposedNote + 12;

      // Vérifier que c'est maintenant dans la plage
      if (wrappedNote >= instrumentCaps.min &&
          wrappedNote <= instrumentCaps.max) {
        mapping[transposedNote] = wrappedNote;
        notesBelow++;
      }
    }

    // Note trop haute → descendre d'une octave
    else if (transposedNote > instrumentCaps.max) {
      const wrappedNote = transposedNote - 12;

      if (wrappedNote >= instrumentCaps.min &&
          wrappedNote <= instrumentCaps.max) {
        mapping[transposedNote] = wrappedNote;
        notesAbove++;
      }
    }
  }

  return {
    hasWrapping: notesBelow > 0 || notesAbove > 0,
    mapping: Object.keys(mapping).length > 0 ? mapping : null,
    info: `${notesBelow} note(s) wrapped up, ${notesAbove} note(s) wrapped down`,
    notesBelow,
    notesAbove
  };
}
```

### Exemple Détaillé

```
Configuration:
  Canal MIDI: E2 (40) → E5 (76)
  Instrument: C3 (48) → C5 (72)

Étape 1 - Transposition optimale:
  Centre canal: 58
  Centre instrument: 60
  Shift optimal: +0 octave (0 semitones)

  Mais: 40 < 48 (notes trop basses)
        76 > 72 (notes trop hautes)

Étape 2 - Essai transposition +1 octave:
  Shift: +12 semitones
  Nouvelle plage: 52-88

  52 >= 48 ✓
  88 > 72 ✗ (notes 73-88 dépassent)

Étape 3 - Octave Wrapping:
  Notes qui dépassent: 73, 74, 75, 76, 77, 78, 79, 80, 81, 82, 83, 84, 85, 86, 87, 88

  Mapping wrapping:
    73 → 61 (-12)
    74 → 62
    75 → 63
    76 → 64
    77 → 65
    78 → 66
    79 → 67
    80 → 68
    81 → 69
    82 → 70
    83 → 71
    84 → 72
    85 → 73  ✗ (> 72, on ne wrap pas deux fois)
    86 → 74  ✗
    87 → 75  ✗
    88 → 76  ✗

Résultat:
  - 12 notes wrappées avec succès
  - 4 notes toujours hors plage (abandonnées)
  - Info: "12 note(s) wrapped down"
```

### Limitations

1. **Pas de wrapping multiple** : Une note n'est wrappée qu'une seule fois
2. **Vérification de plage** : La note wrappée doit être dans la plage de l'instrument
3. **Perte possible** : Si le wrapping ne fonctionne pas, la note est perdue
4. **Harmonies altérées** : Le wrapping peut créer des collisions harmoniques

### Interface Utilisateur

Quand le wrapping est disponible, une checkbox apparaît :

```
┌─────────────────────────────────────────────────────┐
│ 🔄 Enable Octave Wrapping                           │
│                                                      │
│ Octave wrapping available: 5 note(s) wrapped up,    │
│ 8 note(s) wrapped down                              │
└─────────────────────────────────────────────────────┘
```

L'utilisateur peut :
- ✅ Activer le wrapping → notes wrappées appliquées
- ❌ Désactiver le wrapping → notes hors plage perdues/clampées

---

## Guide d'Utilisation

### Étape 1 : Ouvrir l'Auto-Assignation

1. Sélectionner un fichier MIDI dans la liste
2. Cliquer sur le bouton **"✏ Edit"** pour ouvrir l'éditeur MIDI
3. Dans l'éditeur, cliquer sur **"🎯 Auto-Assign Instruments"**

### Étape 2 : Analyse Automatique

Le système analyse automatiquement :

```
┌─────────────────────────────────────────┐
│ Analyzing MIDI file...                  │
│ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░ 90%              │
│                                         │
│ ✓ Analyzed 8 channels                  │
│ ✓ Found 156 instruments                │
│ ✓ Generated 40 suggestions              │
└─────────────────────────────────────────┘
```

### Étape 3 : Revue des Suggestions

Pour chaque canal actif, le système affiche :

```
┌─────────────────────────────────────────────────────────────────┐
│ Channel 1                                                        │
│                                                                  │
│ 📊 Stats: C3-C5 (48-72) • Poly: 6 • Type: piano (85%)          │
│ ├─────────────────────────────────────────────────────────────┤│
│                                                                  │
│ ┌───────────────────────────────────────────────────────────┐  │
│ │ ✓ Yamaha PSR-E373                                95 ⭐⭐⭐⭐⭐│  │
│ │   Piano • C2-C6 • Poly: 48                               │  │
│ │   ✓ Perfect program match • No transposition             │  │
│ │                                                 RECOMMENDED│  │
│ └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│ ┌───────────────────────────────────────────────────────────┐  │
│ │   Roland FP-30                                  88 ⭐⭐⭐⭐⭐│  │
│ │   Piano • A0-C8 • Poly: 128                              │  │
│ │   ✓ Perfect program match • No transposition             │  │
│ └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│ ┌───────────────────────────────────────────────────────────┐  │
│ │   Korg Minilogue XD                             62 ⭐⭐⭐   │  │
│ │   Synth • C2-C6 • Poly: 4                                │  │
│ │   ⚠ Different program category                           │  │
│ │   ⚠ Insufficient polyphony (4 vs 6 required)             │  │
│ └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│ 🔄 Enable Octave Wrapping                                       │
│    Octave wrapping available: 3 note(s) wrapped down           │
│                                                                  │
│ [🔊 Preview Channel 1]                                          │
└─────────────────────────────────────────────────────────────────┘
```

### Étape 4 : Sélection Manuelle (Optionnel)

- Cliquer sur une option pour la sélectionner (surlignée en vert)
- Le premier choix est automatiquement sélectionné
- Vous pouvez changer la sélection pour n'importe quel canal

### Étape 5 : Activer/Désactiver Octave Wrapping

Si disponible :

- ☑️ Cocher pour activer le wrapping → plus de notes jouées
- ☐ Décocher pour désactiver → notes hors plage perdues

### Étape 6 : Preview Audio (Optionnel)

Trois options de preview :

1. **🎵 Preview Original** : Écouter le fichier MIDI original (sans modifications)
2. **🎵 Preview Adapted** : Écouter avec toutes les transpositions/wrapping appliqués
3. **🔊 Preview Channel X** : Écouter un canal spécifique isolé

```
[🎵 Preview Original] [🎵 Preview Adapted] [⏹ Stop]
```

Le preview joue **15 secondes** depuis le début du fichier.

### Étape 7 : Application

Deux options pour appliquer :

#### Option A : Apply Assignments (Standard)

```
[Apply Assignments]
```

- Applique les sélections manuelles
- Demande confirmation
- Affiche un résumé :

```
┌─────────────────────────────────────────┐
│ Summary                                  │
│                                         │
│ Channels to assign: 8                   │
│ • 5 with transposition                  │
│ • 2 with note remapping                 │
│ • 3 with octave wrapping                │
│                                         │
│ This will create:                       │
│ • 1 adapted MIDI file                   │
│ • 8 instrument routings                 │
│                                         │
│ Continue?                               │
│                                         │
│        [Cancel]  [Confirm]              │
└─────────────────────────────────────────┘
```

#### Option B : Quick Assign & Apply

```
[⚡ Quick Assign & Apply]
```

- Utilise automatiquement les recommandations (premier choix)
- Pas de sélection manuelle requise
- Application immédiate après confirmation

### Étape 8 : Résultat

Après application :

```
✓ Adapted file created: song_adapted.mid
✓ 8 instrument routings saved
✓ File ready to play

┌─────────────────────────────────────────┐
│ Assignments Summary:                     │
│                                         │
│ Ch 1: Yamaha PSR-E373 (0 semitones)    │
│ Ch 2: Roland FP-30 (-12 semitones)     │
│ Ch 3: Alesis V49 (+24 semitones)       │
│ Ch 9: Alesis Nitro Mesh (drums)        │
│ ...                                     │
└─────────────────────────────────────────┘
```

Le fichier adapté est maintenant disponible dans la liste et peut être joué immédiatement.

---

## Exemples Pratiques

### Exemple 1 : Fichier Piano Solo

**Contexte** :
- 1 canal MIDI (canal 0)
- Programme: 0 (Acoustic Grand Piano)
- Plage: C2 (36) → C6 (84)
- Polyphonie max: 8 notes simultanées
- CCs: 7 (volume), 11 (expression), 64 (sustain)

**Instruments Disponibles** :
1. Yamaha P-125 (piano numérique, poly 192, plage A0-C8)
2. Casio CDP-S100 (piano compact, poly 48, plage A0-C8)
3. Korg SV-2 (stage piano, poly 128, plage A0-C8)

**Résultat Auto-Assignation** :

```
Channel 0 - Suggestions:

1. Yamaha P-125                    Score: 100 ⭐⭐⭐⭐⭐ [RECOMMENDED]
   ✓ Perfect program match (Piano)
   ✓ Perfect note range fit (no transposition)
   ✓ Polyphony 192 > 8 required
   ✓ All CCs supported
   ✓ Type match: piano

2. Korg SV-2                       Score: 100 ⭐⭐⭐⭐⭐
   (Identique)

3. Casio CDP-S100                  Score: 100 ⭐⭐⭐⭐⭐
   (Identique)
```

**Décision** : N'importe lequel des trois est parfait. L'utilisateur choisit selon ses préférences.

---

### Exemple 2 : Fichier Drums + Bass + Piano

**Contexte** :
- Canal 9 : Drums (GM Drum Kit)
- Canal 1 : Bass (programme 33, Electric Bass Finger)
- Canal 0 : Piano (programme 0)

**Instruments Disponibles** :
1. Yamaha PSR-E373 (clavier arrangeur, poly 48, C2-C6)
2. Alesis Nitro Mesh (batterie électronique, pads: 36,38,42,46,48,50,51)
3. Korg Volca Bass (bass synth, poly 3, C1-C4)
4. Roland FP-30 (piano, poly 128, A0-C8)

**Résultat Auto-Assignation** :

```
Channel 9 (Drums) - Suggestions:

1. Alesis Nitro Mesh               Score: 95 ⭐⭐⭐⭐⭐ [RECOMMENDED]
   ✓ Channel 9 drums match
   ✓ Type: drums
   ✓ 85% notes supported
   ⚠ 15% notes will be remapped

2. Yamaha PSR-E373                 Score: 45 ⭐⭐
   ⚠ Not a drums instrument
   ⚠ Different program category


Channel 1 (Bass) - Suggestions:

1. Korg Volca Bass                 Score: 82 ⭐⭐⭐⭐ [RECOMMENDED]
   ✓ Program category match (Bass)
   ✓ Type: bass
   ✓ Transposition: +1 octave (bass range fits)
   ⚠ Polyphony 3 (bass uses 1-2, OK)

2. Yamaha PSR-E373                 Score: 70 ⭐⭐⭐⭐
   ✓ Can play bass program
   ✓ Transposition: +2 octaves
   ⚠ Not a dedicated bass instrument


Channel 0 (Piano) - Suggestions:

1. Roland FP-30                    Score: 100 ⭐⭐⭐⭐⭐ [RECOMMENDED]
   ✓ Perfect program match
   ✓ No transposition
   ✓ High polyphony

2. Yamaha PSR-E373                 Score: 95 ⭐⭐⭐⭐⭐
   ✓ Perfect program match
   ✓ No transposition
   ✓ Adequate polyphony
```

**Application** :
- Canal 9 → Alesis Nitro Mesh (drums)
- Canal 1 → Korg Volca Bass (+12 semitones)
- Canal 0 → Roland FP-30 (0 semitones)

---

### Exemple 3 : Fichier Orchestral Complexe

**Contexte** :
- Canal 0 : Strings (programme 48, C3-C6)
- Canal 1 : Brass (programme 56, C3-C5)
- Canal 2 : Flute (programme 73, C4-C7)
- Canal 3 : Timpani (programme 47, C2-C3)

**Instruments Disponibles** :
1. Yamaha PSR-E373 (clavier, C2-C6, poly 48)
2. Roland Juno-DS (synth, A0-C8, poly 128)
3. Korg Minilogue (synth, C2-C6, poly 4)

**Problème** : Pas d'instruments spécialisés (strings, brass, etc.)

**Résultat Auto-Assignation** :

```
Channel 0 (Strings) - Suggestions:

1. Roland Juno-DS                  Score: 65 ⭐⭐⭐ [RECOMMENDED]
   ⚠ Different program (synth vs strings)
   ✓ Note range fits (no transposition)
   ✓ High polyphony (good for strings)
   ✓ Can emulate strings with synth pad

2. Yamaha PSR-E373                 Score: 60 ⭐⭐⭐
   ⚠ Different program
   ✓ Note range fits
   ✓ Has string sounds built-in


Channel 1 (Brass) - Suggestions:

1. Roland Juno-DS                  Score: 62 ⭐⭐⭐ [RECOMMENDED]
   ⚠ Different program category
   ✓ Note range fits
   ✓ Polyphony adequate

(Déjà assigné à canal 0, conflit possible)


Channel 2 (Flute) - Suggestions:

1. Roland Juno-DS                  Score: 58 ⭐⭐⭐ [RECOMMENDED]
   ⚠ Different program
   ✓ Transposition: -1 octave
   ✓ Low polyphony OK (flute = 1 note)

2. Yamaha PSR-E373                 Score: 55 ⭐⭐⭐
   ⚠ Different program
   ✓ Transposition: -1 octave


Channel 3 (Timpani) - Suggestions:

1. Korg Minilogue                  Score: 48 ⭐⭐ [RECOMMENDED]
   ⚠ Very different program
   ✓ Transposition: +1 octave
   ⚠ Low polyphony (but timpani uses 1-2)

2. Yamaha PSR-E373                 Score: 45 ⭐⭐
   ⚠ Different program
   ✓ Note range fits after +1 octave
```

**Commentaire** :
- Scores plus faibles (45-65) car pas d'instruments orchestraux dédiés
- Le système fait de son mieux avec les synthés disponibles
- Utilisateur peut accepter ou chercher de meilleurs instruments

---

## Référence Technique

### Configuration des Poids (ScoringConfig.js)

```javascript
const config = {
  weights: {
    programMatch: 30,      // Correspondance de programme GM
    noteRange: 25,         // Compatibilité de plage de notes
    polyphony: 15,         // Capacité polyphonique
    ccSupport: 15,         // Support des Control Changes
    instrumentType: 10,    // Correspondance de type
    channelSpecial: 5      // Bonus canal spécial (drums)
  },

  bonuses: {
    perfectProgramMatch: 30,     // Programme exact
    sameCategoryMatch: 20,       // Même catégorie GM
    perfectNoteRangeFit: 25,     // Plage parfaite
    allCCsSupported: 15,         // Tous les CCs disponibles
    typeConfidenceHigh: 10,      // Confiance type > 80%
    channel9Drums: 5             // Canal 9 + drums
  },

  penalties: {
    transpositionPerOctave: 3,   // -3pts par octave
    polyphonyInsufficient: 10,   // Polyphonie < requise
    partialNoteSupport: 5,       // Support partiel (< 70%)
    ccMismatch: 5                // CCs manquants
  },

  thresholds: {
    excellentScore: 90,          // ⭐⭐⭐⭐⭐
    veryGoodScore: 70,           // ⭐⭐⭐⭐
    goodScore: 50,               // ⭐⭐⭐
    acceptableScore: 30,         // ⭐⭐
    minCompatibleScore: 10       // ⭐
  }
};
```

### Cache de Performance (AnalysisCache.js)

Le système utilise un cache LRU pour optimiser les performances :

```javascript
const cache = new AnalysisCache({
  maxSize: 100,        // 100 entrées max
  ttl: 600000         // 10 minutes de validité
});

// Clé: fileId + channel
cache.set(fileId, channel, analysisData);
const cached = cache.get(fileId, channel);

// Invalidation
cache.invalidateFile(fileId);  // Supprimer toutes les analyses d'un fichier
cache.cleanup();               // Nettoyer les entrées expirées
```

**Gains de performance** :
- Première analyse : ~50ms par canal
- Avec cache : ~0.5ms par canal (100x plus rapide)

### Commandes API

#### `analyze_channel`

Analyse un canal spécifique d'un fichier MIDI.

```javascript
const result = await apiClient.sendCommand('analyze_channel', {
  fileId: 123,
  channel: 0
});

// Résultat:
{
  channel: 0,
  noteRange: { min: 48, max: 84 },
  polyphony: { max: 6, avg: 3.2 },
  usedCCs: [7, 11, 64],
  programs: [0],
  density: 5.3,
  estimatedType: {
    type: 'piano',
    confidence: 85,
    scores: { piano: 85, strings: 60, ... }
  }
}
```

#### `generate_assignment_suggestions`

Génère les suggestions d'assignation pour tous les canaux.

```javascript
const result = await apiClient.sendCommand('generate_assignment_suggestions', {
  fileId: 123,
  options: {
    topN: 5,                    // Top-N suggestions par canal
    minScore: 10,               // Score minimum
    allowConflicts: false       // Éviter d'assigner le même instrument 2x
  }
});

// Résultat:
{
  suggestions: {
    0: [
      {
        instrument: { id: 1, name: 'Yamaha PSR-E373', ... },
        compatibility: {
          score: 95,
          transposition: { semitones: 0, octaves: 0 },
          octaveWrapping: null,
          issues: [],
          info: ['Perfect program match', 'No transposition']
        }
      },
      // ... 4 autres suggestions
    ],
    1: [ ... ],
    // ... autres canaux
  },
  autoSelection: {
    0: 'device_abc123',   // Meilleur instrument par canal
    1: 'device_def456',
    // ...
  },
  confidence: 'high'      // 'high', 'medium', 'low'
}
```

#### `apply_assignments`

Applique les assignations et crée le fichier adapté.

```javascript
const result = await apiClient.sendCommand('apply_assignments', {
  originalFileId: 123,
  assignments: {
    0: {
      deviceId: 'device_abc123',
      instrumentId: 1,
      transposition: { semitones: 0, octaves: 0 },
      noteRemapping: null,
      octaveWrappingEnabled: false
    },
    1: {
      deviceId: 'device_def456',
      instrumentId: 2,
      transposition: { semitones: 12, octaves: 1 },
      noteRemapping: null,
      octaveWrappingEnabled: false
    },
    // ...
  },
  createAdaptedFile: true    // true = créer fichier adapté
});

// Résultat:
{
  success: true,
  adaptedFileId: 456,
  routingsCreated: 8,
  stats: {
    channelsModified: 5,
    notesTransposed: 1247,
    notesRemapped: 0
  }
}
```

### Structure de la Base de Données

#### Table `midi_files`

```sql
CREATE TABLE midi_files (
  id INTEGER PRIMARY KEY,
  filename TEXT NOT NULL,
  data BLOB NOT NULL,
  format INTEGER,
  tracks INTEGER,
  ppq INTEGER,
  created_at TIMESTAMP,

  -- Adaptation support
  is_original BOOLEAN DEFAULT 1,
  parent_file_id INTEGER REFERENCES midi_files(id),
  adaptation_metadata TEXT  -- JSON: { assignments, transpositions, stats }
);
```

#### Table `midi_instrument_routings`

```sql
CREATE TABLE midi_instrument_routings (
  id INTEGER PRIMARY KEY,
  midi_file_id INTEGER NOT NULL REFERENCES midi_files(id),
  midi_channel INTEGER NOT NULL,
  instrument_id INTEGER NOT NULL REFERENCES instruments(id),

  -- Auto-assignment data
  compatibility_score INTEGER,
  transposition_applied INTEGER,  -- Semitones
  auto_assigned BOOLEAN DEFAULT 0,
  assignment_reason TEXT,
  note_remapping TEXT,  -- JSON: { 36: 38, 42: 45, ... }

  UNIQUE(midi_file_id, midi_channel)
);
```

### Format JSON d'Adaptation

```json
{
  "adapted_from": 123,
  "adapted_at": "2026-01-20T23:45:12Z",
  "assignments": {
    "0": {
      "deviceId": "device_abc123",
      "instrumentName": "Yamaha PSR-E373",
      "score": 95,
      "transposition": { "semitones": 0, "octaves": 0 },
      "noteRemapping": null,
      "octaveWrappingEnabled": false
    },
    "1": {
      "deviceId": "device_def456",
      "instrumentName": "Korg Volca Bass",
      "score": 82,
      "transposition": { "semitones": 12, "octaves": 1 },
      "noteRemapping": null,
      "octaveWrappingEnabled": false
    },
    "9": {
      "deviceId": "device_ghi789",
      "instrumentName": "Alesis Nitro Mesh",
      "score": 90,
      "transposition": { "semitones": 0, "octaves": 0 },
      "noteRemapping": {
        "46": "45",
        "48": "47",
        "50": "49"
      },
      "octaveWrappingEnabled": false
    }
  },
  "stats": {
    "channelsModified": 3,
    "notesTransposed": 856,
    "notesRemapped": 124
  }
}
```

---

## Conclusion

Le système d'auto-assignation des canaux MIDI offre une solution intelligente et flexible pour connecter automatiquement des fichiers MIDI aux instruments disponibles. En combinant :

- **Analyse approfondie** des caractéristiques MIDI
- **Scoring multi-critères** pondéré
- **Transposition par octaves** préservant la mélodie
- **Octave wrapping** pour étendre la compatibilité
- **Interface intuitive** avec preview audio
- **Optimisations de performance** (cache LRU)

Le système permet de réduire considérablement le temps de configuration tout en maximisant la qualité du résultat musical.

### Ressources Additionnelles

- **Code source** : `src/midi/` et `public/js/views/components/`
- **Migrations** : `migrations/016_auto_assignment_support.sql`
- **Tests** : (À venir)
- **Exemples** : `examples/auto-assignment/`

### Support

Pour toute question ou problème :
- Ouvrir une issue sur GitHub
- Consulter les logs du système
- Activer le mode debug dans les Settings

---

**Version** : 1.0.0
**Dernière mise à jour** : 2026-01-20
**Auteur** : MidiMind Development Team
