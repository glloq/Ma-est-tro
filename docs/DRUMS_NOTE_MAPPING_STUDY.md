# Étude : Adaptation Intelligente des Notes de Percussions (Drums)

## 📋 Objectif

Améliorer le système d'auto-assignement pour les percussions (canal 10 / canal 9 en index 0) en créant un mapping intelligent qui :
1. Identifie les notes similaires et interchangeables
2. Adapte les notes MIDI aux capacités réelles de l'instrument de percussion
3. Maximise le nombre de notes jouables
4. Préserve l'intention musicale autant que possible

## 🎵 General MIDI Drum Map (Standard)

### Mapping Complet des Percussions GM (Notes 35-81)

| Note | Nom Technique | Catégorie | Description Française |
|------|--------------|-----------|----------------------|
| **35** | Acoustic Bass Drum | Kick | Grosse caisse acoustique |
| **36** | Bass Drum 1 | Kick | Grosse caisse 1 (standard) |
| **37** | Side Stick | Snare Var | Rim shot / cross stick |
| **38** | Acoustic Snare | Snare | Caisse claire acoustique |
| **39** | Hand Clap | Perc | Clap de mains |
| **40** | Electric Snare | Snare | Caisse claire électronique |
| **41** | Low Floor Tom | Tom | Tom basse au sol |
| **42** | Closed Hi-Hat | HH | Charleston fermé |
| **43** | High Floor Tom | Tom | Tom moyen au sol |
| **44** | Pedal Hi-Hat | HH | Charleston pédale |
| **45** | Low Tom | Tom | Tom basse |
| **46** | Open Hi-Hat | HH | Charleston ouvert |
| **47** | Low-Mid Tom | Tom | Tom médium-bas |
| **48** | Hi-Mid Tom | Tom | Tom médium-haut |
| **49** | Crash Cymbal 1 | Cymbal | Cymbale crash 1 |
| **50** | High Tom | Tom | Tom aigu |
| **51** | Ride Cymbal 1 | Cymbal | Cymbale ride 1 |
| **52** | Chinese Cymbal | Cymbal | Cymbale chinoise |
| **53** | Ride Bell | Cymbal | Cloche de ride |
| **54** | Tambourine | Perc | Tambourin |
| **55** | Splash Cymbal | Cymbal | Cymbale splash |
| **56** | Cowbell | Perc | Cloche |
| **57** | Crash Cymbal 2 | Cymbal | Cymbale crash 2 |
| **58** | Vibraslap | Perc | Vibraslap |
| **59** | Ride Cymbal 2 | Cymbal | Cymbale ride 2 |
| **60** | Hi Bongo | Perc | Bongo aigu |
| **61** | Low Bongo | Perc | Bongo grave |
| **62** | Mute Hi Conga | Perc | Conga aiguë étouffée |
| **63** | Open Hi Conga | Perc | Conga aiguë ouverte |
| **64** | Low Conga | Perc | Conga grave |
| **65** | High Timbale | Perc | Timbale aiguë |
| **66** | Low Timbale | Perc | Timbale grave |
| **67** | High Agogo | Perc | Agogo aigu |
| **68** | Low Agogo | Perc | Agogo grave |
| **69** | Cabasa | Perc | Cabasa |
| **70** | Maracas | Perc | Maracas |
| **71** | Short Whistle | Perc | Sifflet court |
| **72** | Long Whistle | Perc | Sifflet long |
| **73** | Short Guiro | Perc | Guiro court |
| **74** | Long Guiro | Perc | Guiro long |
| **75** | Claves | Perc | Claves |
| **76** | Hi Wood Block | Perc | Wood block aigu |
| **77** | Low Wood Block | Perc | Wood block grave |
| **78** | Mute Cuica | Perc | Cuica étouffée |
| **79** | Open Cuica | Perc | Cuica ouverte |
| **80** | Mute Triangle | Perc | Triangle étouffé |
| **81** | Open Triangle | Perc | Triangle ouvert |

## 🎯 Catégorisation par Fonction Musicale

### 1. Kick / Grosse Caisse
**Notes principales :** 35, 36

**Fonction :** Base rythmique, temps forts, fondation du beat

**Substitutions acceptables (ordre de préférence) :**
1. **36 → 35** (ou inverse) - Kicks interchangeables
2. **→ 41, 43** - Tom grave si pas de kick (conserve la fonction basse)
3. **→ 64** - Low Conga (dernier recours, conserve l'attaque grave)

**Stratégie :** Toujours préserver au moins un kick drum. Essentiel pour la structure rythmique.

---

### 2. Snare / Caisse Claire
**Notes principales :** 38, 40, 37

**Fonction :** Contre-temps, backbeat, articulation rythmique

**Substitutions acceptables (ordre de préférence) :**
1. **38 ↔ 40** - Acoustique / Électrique (très interchangeables)
2. **→ 37** - Side stick / rim shot (garde l'articulation)
3. **→ 39** - Hand clap (similaire en attaque)
4. **→ 54** - Tambourine (garde le rôle rythmique)
5. **→ 70** - Maracas (dernier recours pour le contre-temps)

**Stratégie :** Snare est critique. Minimum 1 snare + 1 variante recommandé.

---

### 3. Hi-Hat / Charleston
**Notes principales :** 42, 44, 46

**Fonction :** Subdivision rythmique, groove constant

**Substitutions acceptables (ordre de préférence) :**
1. **42 ↔ 44** - Closed ↔ Pedal (très similaires)
2. **46 → 42** - Open → Closed (fonction similaire)
3. **42 ↔ 46** - Alternance fermé/ouvert (garde le pattern)
4. **→ 54** - Tambourine (subdivision alternative)
5. **→ 70** - Maracas (garde la subdivision)
6. **→ 53** - Ride Bell (son métallique aigu)
7. **→ 75** - Claves (attaque sèche)

**Stratégie :** Hi-hat est essentiel pour le groove. Conserver au moins closed HH (42).

---

### 4. Toms
**Notes principales :** 41, 43, 45, 47, 48, 50

**Organisation par hauteur :**
- **Graves :** 41 (Low Floor), 43 (High Floor), 45 (Low)
- **Médiums :** 47 (Low-Mid), 48 (Hi-Mid)
- **Aigus :** 50 (High)

**Substitutions acceptables (ordre de préférence) :**
1. **Tom adjacent** - Décaler d'un tom (41→43, 47→48, etc.)
2. **Compression de range** - Mapper tous sur toms disponibles
   - Si 3 toms dispo : mapper 6 toms → 3 en groupant par paires
   - Si 2 toms dispo : graves→low, aigus→high
   - Si 1 tom dispo : tous→ce tom (dernier recours)
3. **→ Congas/Bongos** (60-64) - Timbres percussifs similaires
4. **→ Timbales** (65-66) - Sons métalliques/percussifs

**Stratégie :** Les fills de toms sont importants. Conserver au moins 2-3 toms avec espacement de hauteur.

---

### 5. Cymbales (Crash)
**Notes principales :** 49, 57, 55

**Fonction :** Accents, débuts de sections, climax

**Substitutions acceptables (ordre de préférence) :**
1. **49 ↔ 57** - Crash 1 ↔ Crash 2 (interchangeables)
2. **55 → 49** - Splash → Crash (similaire mais plus court)
3. **→ 52** - Chinese cymbal (effet proche)
4. **→ 46** - Open hi-hat (accent alternatif)
5. **→ 51, 59** - Ride (moins percutant mais garde l'accent)

**Stratégie :** Au moins 1 crash essentiel pour les accents. Splash optionnel.

---

### 6. Cymbales (Ride)
**Notes principales :** 51, 59, 53

**Fonction :** Pattern rythmique soutenu, alternative au hi-hat

**Substitutions acceptables (ordre de préférence) :**
1. **51 ↔ 59** - Ride 1 ↔ Ride 2 (interchangeables)
2. **53 → 51** - Bell → Ride (même cymbale, zone différente)
3. **→ 42** - Closed hi-hat (garde le pattern rythmique)
4. **→ 49** - Crash (moins approprié mais garde l'attaque)

**Stratégie :** Ride peut être remplacé par HH pour patterns. Bell est spécialisé.

---

### 7. Percussions Latines (Congas, Bongos, Timbales)
**Notes principales :** 60-68

**Fonction :** Couleur, rythmes latins, ornementation

**Substitutions :**
- **Entre elles** - Très interchangeables dans la même catégorie
  - Bongos (60-61) ↔ Congas (62-64)
  - High ↔ Low dans chaque paire
- **→ Toms** - Si pas de percu latines, mapper sur toms
- **→ Claves/Woodblocks** (75-77) - Garder l'articulation

**Stratégie :** Moins critiques que la batterie de base. Peuvent être omises ou remplacées par toms.

---

### 8. Percussions Diverses
**Notes principales :** 39, 54, 69-81

**Fonction :** Effets spéciaux, ornementation, couleur

**Groupes fonctionnels :**
- **Attaque main :** 39 (Clap), 54 (Tambourine), 70 (Maracas)
- **Attaque bois :** 75 (Claves), 76-77 (Wood Blocks)
- **Métalliques :** 80-81 (Triangle), 56 (Cowbell)
- **Effets :** 58 (Vibraslap), 69 (Cabasa), 71-74 (Whistles/Guiro), 78-79 (Cuica)

**Substitutions :**
- Dans chaque groupe, interchangeables
- Métalliques ↔ Hi-hat/Cymbales si nécessaire
- Effets → omettables si non disponibles

---

## 🔄 Matrice de Compatibilité et Priorités

### Priorité 1 : Éléments Essentiels (MUST HAVE)
Ces éléments doivent être préservés en priorité :

```
Kick (36 ou 35)     → Score priorité : 100
Snare (38 ou 40)    → Score priorité : 100
Closed HH (42)      → Score priorité : 90
Crash (49 ou 57)    → Score priorité : 70
```

### Priorité 2 : Éléments Importants (SHOULD HAVE)
```
Open HH (46)        → Score priorité : 60
Tom Low (41/45)     → Score priorité : 50
Tom High (48/50)    → Score priorité : 50
Ride (51)           → Score priorité : 40
```

### Priorité 3 : Éléments Optionnels (NICE TO HAVE)
```
Tom Mid (43/47)     → Score priorité : 30
Rim Shot (37)       → Score priorité : 25
Hand Clap (39)      → Score priorité : 20
Percu Latines       → Score priorité : 15
Autres percussions  → Score priorité : 10
```

---

## 🎼 Stratégies d'Adaptation par Scénario

### Scénario A : Kit de Batterie Complet (20+ pads)
**Exemple :** Roland TD-27, Yamaha DTX10K, Alesis Strike Pro

**Capacités typiques :**
- 3+ kicks, 2+ snares, 3 HH positions
- 4-6 toms, 3+ crashes, 2 rides, splash, china
- Divers: cowbell, tambourine, effets

**Stratégie :** Mapping 1:1 presque complet
- Pas de transposition nécessaire
- Mapper les doublons (ex: 2 crashes GM → crashes disponibles)
- Utiliser les zones alternées pour variantes (rim, edge, bow)

---

### Scénario B : Kit de Batterie Standard (12-15 pads)
**Exemple :** Roland TD-17, Yamaha DTX6K, Alesis Nitro Mesh

**Capacités typiques :**
- 1 kick, 1 snare, 3 HH (closed/pedal/open)
- 3-4 toms, 2 crashes, 1 ride
- Limité: splash, china optionnel

**Stratégie :** Consolidation intelligente
```
Kicks:
  35, 36 → Kick unique

Snares:
  38, 40 → Snare (head)
  37 → Snare (rim)

Hi-Hats:
  42, 44 → Closed HH
  46 → Open HH

Toms: (si 4 toms: 41, 45, 48, 50)
  41 → Tom 1 (low floor)
  43, 45 → Tom 2 (floor/low)
  47 → Tom 3 (mid)
  48, 50 → Tom 4 (high)

Cymbales:
  49 → Crash 1
  57, 55 → Crash 2
  51, 53, 59 → Ride
  52 → Ride ou Crash 2

Percussions:
  39 → Snare (rim) ou omis
  54, 70 → HH ou omis
  60-81 → Toms ou omis
```

---

### Scénario C : Kit Minimal (8-10 pads)
**Exemple :** Roland TD-1K, Yamaha DTX402, entrée de gamme

**Capacités typiques :**
- 1 kick, 1 snare, 1 HH (2 positions)
- 3 toms, 1-2 crashes, 1 ride

**Stratégie :** Compression maximale + omissions
```
Kicks:
  35, 36 → Kick unique

Snares:
  37, 38, 40 → Snare unique
  39 → Snare rim ou omis

Hi-Hats:
  42, 44 → Closed HH
  46 → Open HH

Toms: (grouper par tiers de gamme)
  41, 43 → Tom 1 (grave)
  45, 47 → Tom 2 (médium)
  48, 50 → Tom 3 (aigu)

Cymbales:
  49, 55, 57 → Crash unique
  51, 53, 59 → Ride unique
  52 → Crash

Percussions latines/diverses:
  60-81 → OMIS ou mappé sur toms/HH selon contexte
```

---

### Scénario D : Pad Controller Compact (16-25 pads libres)
**Exemple :** Akai MPD226, Native Instruments Maschine, Novation Launchpad

**Capacités typiques :**
- Grid de pads (4x4, 4x8, etc.)
- Notes configurables mais limitées en nombre
- Pas de structure de batterie standard

**Stratégie :** Kit essentiel + chromatique
```
Configuration optimale pour 16 pads:

Rangée 1 (Temps forts):
  36 - Kick
  38 - Snare
  42 - Closed HH
  46 - Open HH

Rangée 2 (Accents):
  49 - Crash
  51 - Ride
  37 - Rim/Side stick
  54 - Tambourine

Rangée 3 (Toms):
  41 - Tom Low
  45 - Tom Mid
  48 - Tom High
  50 - Tom Highest

Rangée 4 (Percussions):
  39 - Clap
  56 - Cowbell
  60 - Hi Bongo
  70 - Maracas

Mapping des autres notes:
  35 → 36 (kick)
  40 → 38 (snare)
  43, 47 → Toms adjacents
  55, 57 → 49 (crash)
  59 → 51 (ride)
  61-81 → Percu dispo ou OMIS
```

---

### Scénario E : Clavier avec Drum Pads (< 8 pads)
**Exemple :** Akai MPK Mini, M-Audio Oxygen, certains synthés

**Capacités typiques :**
- 4-8 pads dédiés percussion
- Notes très limitées

**Stratégie :** Strict minimum
```
Configuration 8 pads (base absolue):
  36 - Kick
  38 - Snare
  42 - Closed HH
  46 - Open HH
  41 - Tom Low
  48 - Tom High
  49 - Crash
  51 - Ride

Mapping:
  35 → 36
  37, 39, 40 → 38
  43, 44, 45, 47, 50 → Toms disponibles
  52, 55, 57 → 49
  53, 59 → 51
  54, 60-81 → OMIS ou → HH/Snare selon contexte musical
```

---

## 🧠 Algorithme d'Adaptation Intelligent

### Étape 1 : Analyse de l'Instrument Cible
```javascript
function analyzeInstrumentCapabilities(instrument) {
  const availableNotes = instrument.selected_notes; // Array de notes MIDI

  return {
    hasKick: availableNotes.some(n => [35, 36].includes(n)),
    hasSnare: availableNotes.some(n => [37, 38, 40].includes(n)),
    hasHiHat: availableNotes.some(n => [42, 44, 46].includes(n)),
    hasCrash: availableNotes.some(n => [49, 55, 57].includes(n)),
    hasRide: availableNotes.some(n => [51, 53, 59].includes(n)),
    tomCount: availableNotes.filter(n => [41,43,45,47,48,50].includes(n)).length,
    latinPercCount: availableNotes.filter(n => n >= 60 && n <= 68).length,
    miscPercCount: availableNotes.filter(n => n >= 69 && n <= 81).length,
    totalNotes: availableNotes.length
  };
}
```

### Étape 2 : Classification des Notes du Fichier MIDI
```javascript
function classifyDrumNotes(midiChannel) {
  const usage = {};

  // Parcourir tous les événements Note On du canal drums
  for (const event of midiChannel.events) {
    if (event.type === 'noteOn' && event.velocity > 0) {
      usage[event.note] = (usage[event.note] || 0) + 1;
    }
  }

  // Trier par fréquence d'utilisation
  const sortedNotes = Object.entries(usage)
    .sort((a, b) => b[1] - a[1])
    .map(([note, count]) => ({ note: parseInt(note), count }));

  return {
    usedNotes: sortedNotes,
    mostUsed: sortedNotes.slice(0, 10), // Top 10
    categories: categorizeDrumNotes(sortedNotes.map(n => n.note))
  };
}

function categorizeDrumNotes(notes) {
  return {
    kicks: notes.filter(n => [35, 36].includes(n)),
    snares: notes.filter(n => [37, 38, 40].includes(n)),
    hiHats: notes.filter(n => [42, 44, 46].includes(n)),
    toms: notes.filter(n => [41, 43, 45, 47, 48, 50].includes(n)),
    crashes: notes.filter(n => [49, 55, 57].includes(n)),
    rides: notes.filter(n => [51, 53, 59].includes(n)),
    latin: notes.filter(n => n >= 60 && n <= 68),
    misc: notes.filter(n => (n >= 39 && n <= 39) || (n >= 54 && n <= 56) || (n >= 69 && n <= 81))
  };
}
```

### Étape 3 : Génération du Mapping
```javascript
function generateDrumMapping(midiNotes, instrumentNotes) {
  const mapping = {}; // source_note → target_note
  const used = new Set(); // Notes déjà assignées

  // Priorité 1: Éléments essentiels
  mapping = assignEssentialNotes(midiNotes, instrumentNotes, used);

  // Priorité 2: Éléments importants
  mapping = assignImportantNotes(midiNotes, instrumentNotes, used, mapping);

  // Priorité 3: Éléments optionnels
  mapping = assignOptionalNotes(midiNotes, instrumentNotes, used, mapping);

  // Priorité 4: Notes non mappées → closest match ou omission
  mapping = assignRemainingNotes(midiNotes, instrumentNotes, used, mapping);

  return mapping;
}
```

### Étape 4 : Assignation par Priorité

#### A. Notes Essentielles
```javascript
function assignEssentialNotes(midiNotes, instrNotes, used) {
  const mapping = {};
  const categories = midiNotes.categories;

  // KICK (priorité absolue)
  if (categories.kicks.length > 0) {
    // Préférence: 36 > 35
    const targetKick = instrNotes.find(n => n === 36) ||
                       instrNotes.find(n => n === 35) ||
                       instrNotes.find(n => [41, 43, 45].includes(n)); // Fallback: tom grave

    if (targetKick) {
      categories.kicks.forEach(sourceKick => {
        mapping[sourceKick] = targetKick;
      });
      used.add(targetKick);
    }
  }

  // SNARE (priorité absolue)
  if (categories.snares.length > 0) {
    // Préférence: 38 > 40 > 37
    const targetSnare = instrNotes.find(n => n === 38) ||
                        instrNotes.find(n => n === 40) ||
                        instrNotes.find(n => n === 37) ||
                        instrNotes.find(n => n === 39); // Fallback: clap

    if (targetSnare) {
      // Snare principale
      if (categories.snares.includes(38)) {
        mapping[38] = targetSnare;
      }
      if (categories.snares.includes(40)) {
        mapping[40] = targetSnare;
      }

      // Side stick → rim si disponible
      if (categories.snares.includes(37)) {
        const rimNote = instrNotes.find(n => n === 37 && !used.has(n));
        mapping[37] = rimNote || targetSnare;
        if (rimNote) used.add(rimNote);
      }

      used.add(targetSnare);
    }
  }

  // HI-HAT CLOSED (très important)
  if (categories.hiHats.length > 0) {
    const targetHH = instrNotes.find(n => n === 42) ||
                     instrNotes.find(n => n === 44) ||
                     instrNotes.find(n => [54, 70, 75].includes(n)); // Fallback: tambourine/maracas/claves

    if (targetHH) {
      [42, 44].forEach(hhNote => {
        if (categories.hiHats.includes(hhNote)) {
          mapping[hhNote] = targetHH;
        }
      });
      used.add(targetHH);
    }
  }

  // CRASH (important pour accents)
  if (categories.crashes.length > 0) {
    const targetCrash = instrNotes.find(n => n === 49) ||
                        instrNotes.find(n => n === 57) ||
                        instrNotes.find(n => [51, 55, 52].includes(n)); // Fallback: ride/splash/china

    if (targetCrash) {
      categories.crashes.forEach(crashNote => {
        mapping[crashNote] = targetCrash;
      });
      used.add(targetCrash);
    }
  }

  return mapping;
}
```

#### B. Notes Importantes
```javascript
function assignImportantNotes(midiNotes, instrNotes, used, mapping) {
  const categories = midiNotes.categories;

  // OPEN HI-HAT (si closed existe)
  if (categories.hiHats.includes(46) && !mapping[46]) {
    const targetOpenHH = instrNotes.find(n => n === 46 && !used.has(n)) ||
                         instrNotes.find(n => n === 42 && !used.has(n)) || // Même closed si pas d'open
                         mapping[42]; // Ou partager le closed déjà mappé

    if (targetOpenHH) {
      mapping[46] = targetOpenHH;
      if (!used.has(targetOpenHH)) used.add(targetOpenHH);
    }
  }

  // TOMS (regrouper selon disponibilité)
  if (categories.toms.length > 0) {
    const availableToms = instrNotes.filter(n =>
      [41, 43, 45, 47, 48, 50].includes(n) && !used.has(n)
    ).sort((a, b) => a - b); // Trier par hauteur

    if (availableToms.length > 0) {
      // Distribuer les toms du MIDI sur les toms disponibles
      const midiToms = categories.toms.sort((a, b) => a - b);

      if (availableToms.length >= midiToms.length) {
        // Assez de toms: mapping 1:1
        midiToms.forEach((midiTom, idx) => {
          mapping[midiTom] = availableToms[idx];
          used.add(availableToms[idx]);
        });
      } else {
        // Pas assez de toms: grouper
        const groupSize = Math.ceil(midiToms.length / availableToms.length);
        midiToms.forEach((midiTom, idx) => {
          const targetIdx = Math.min(
            Math.floor(idx / groupSize),
            availableToms.length - 1
          );
          mapping[midiTom] = availableToms[targetIdx];
        });
        availableToms.forEach(t => used.add(t));
      }
    }
  }

  // RIDE (si pas de crash ou en plus)
  if (categories.rides.length > 0) {
    const targetRide = instrNotes.find(n => n === 51 && !used.has(n)) ||
                       instrNotes.find(n => n === 59 && !used.has(n)) ||
                       instrNotes.find(n => n === 53 && !used.has(n)) ||
                       mapping[49]; // Fallback: partager le crash

    if (targetRide) {
      categories.rides.forEach(rideNote => {
        mapping[rideNote] = targetRide;
      });
      if (!used.has(targetRide)) used.add(targetRide);
    }
  }

  return mapping;
}
```

#### C. Notes Optionnelles
```javascript
function assignOptionalNotes(midiNotes, instrNotes, used, mapping) {
  const categories = midiNotes.categories;

  // PERCUSSIONS LATINES
  if (categories.latin.length > 0) {
    // Essayer de mapper sur percu latines si disponibles
    const availableLatin = instrNotes.filter(n =>
      n >= 60 && n <= 68 && !used.has(n)
    );

    if (availableLatin.length > 0) {
      categories.latin.forEach(latinNote => {
        // Trouver la note la plus proche
        const closest = findClosestNote(latinNote, availableLatin);
        mapping[latinNote] = closest;
      });
      availableLatin.forEach(n => used.add(n));
    } else {
      // Fallback: mapper sur toms ou omis
      categories.latin.forEach(latinNote => {
        const tomFallback = instrNotes.find(n =>
          [41, 43, 45, 47, 48, 50].includes(n) && !used.has(n)
        );
        if (tomFallback) {
          mapping[latinNote] = tomFallback;
        }
        // Sinon: omis (pas de mapping)
      });
    }
  }

  // MISC PERCUSSION (clap, tambourine, cowbell, etc.)
  if (categories.misc.length > 0) {
    categories.misc.forEach(miscNote => {
      if (!mapping[miscNote]) {
        // Hand clap (39) → Snare rim ou snare
        if (miscNote === 39) {
          mapping[39] = mapping[37] || mapping[38] || mapping[40];
        }
        // Tambourine (54), Maracas (70) → HH ou disponible
        else if ([54, 70].includes(miscNote)) {
          const target = instrNotes.find(n => [54, 70].includes(n) && !used.has(n)) ||
                         mapping[42] || mapping[46];
          if (target) mapping[miscNote] = target;
        }
        // Cowbell (56) → disponible ou omis
        else if (miscNote === 56) {
          const target = instrNotes.find(n => n === 56 && !used.has(n));
          if (target) {
            mapping[56] = target;
            used.add(target);
          }
        }
        // Autres → Omis ou note la plus proche
        else {
          const closest = findClosestNote(miscNote,
            instrNotes.filter(n => !used.has(n))
          );
          if (closest) {
            mapping[miscNote] = closest;
          }
        }
      }
    });
  }

  return mapping;
}
```

#### D. Notes Restantes
```javascript
function assignRemainingNotes(midiNotes, instrNotes, used, mapping) {
  // Pour toutes les notes MIDI non encore mappées
  midiNotes.usedNotes.forEach(({ note }) => {
    if (!mapping[note]) {
      // Chercher la note la plus proche disponible
      const closest = findClosestNote(note,
        instrNotes.filter(n => !used.has(n))
      );

      if (closest) {
        mapping[note] = closest;
        // Ne pas marquer comme "used" pour permettre le partage
      } else {
        // Dernière tentative: réutiliser une note déjà mappée
        const reusable = instrNotes.find(n => used.has(n));
        if (reusable) {
          mapping[note] = reusable;
        }
        // Sinon: note omise (pas de mapping)
      }
    }
  });

  return mapping;
}

function findClosestNote(targetNote, availableNotes) {
  if (availableNotes.length === 0) return null;

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

---

## 📊 Métriques de Qualité du Mapping

### Score de Compatibilité (0-100)

```javascript
function calculateMappingQuality(mapping, midiNotes, instrNotes) {
  let score = 0;
  const weights = {
    essentialPreserved: 40,    // Kick, Snare, HH, Crash
    importantPreserved: 30,    // Toms, Ride, Open HH
    optionalPreserved: 15,     // Latin, Misc
    coverageRatio: 10,         // % de notes mappées
    accuracyRatio: 5           // % de mappings exacts (pas de substitution)
  };

  // 1. Notes essentielles préservées
  const essentialScore = scoreEssentialNotes(mapping, midiNotes);
  score += (essentialScore / 100) * weights.essentialPreserved;

  // 2. Notes importantes préservées
  const importantScore = scoreImportantNotes(mapping, midiNotes);
  score += (importantScore / 100) * weights.importantPreserved;

  // 3. Notes optionnelles préservées
  const optionalScore = scoreOptionalNotes(mapping, midiNotes);
  score += (optionalScore / 100) * weights.optionalPreserved;

  // 4. Couverture (combien de notes MIDI sont mappées)
  const mappedCount = Object.keys(mapping).length;
  const totalCount = midiNotes.usedNotes.length;
  const coverageRatio = mappedCount / totalCount;
  score += coverageRatio * weights.coverageRatio;

  // 5. Précision (combien de mappings sont exacts)
  const exactCount = Object.entries(mapping)
    .filter(([src, tgt]) => parseInt(src) === tgt)
    .length;
  const accuracyRatio = exactCount / mappedCount;
  score += accuracyRatio * weights.accuracyRatio;

  return Math.round(score);
}

function scoreEssentialNotes(mapping, midiNotes) {
  const categories = midiNotes.categories;
  let score = 0;
  let total = 0;

  // Kick
  if (categories.kicks.length > 0) {
    total += 25;
    if (categories.kicks.some(k => mapping[k] && [35, 36].includes(mapping[k]))) {
      score += 25; // Mapping exact
    } else if (categories.kicks.some(k => mapping[k])) {
      score += 15; // Mapping de substitution
    }
  }

  // Snare
  if (categories.snares.length > 0) {
    total += 25;
    if (categories.snares.some(s => mapping[s] && [37, 38, 40].includes(mapping[s]))) {
      score += 25;
    } else if (categories.snares.some(s => mapping[s])) {
      score += 15;
    }
  }

  // Hi-Hat
  if (categories.hiHats.length > 0) {
    total += 25;
    if (categories.hiHats.some(h => mapping[h] && [42, 44, 46].includes(mapping[h]))) {
      score += 25;
    } else if (categories.hiHats.some(h => mapping[h])) {
      score += 15;
    }
  }

  // Crash
  if (categories.crashes.length > 0) {
    total += 25;
    if (categories.crashes.some(c => mapping[c] && [49, 55, 57].includes(mapping[c]))) {
      score += 25;
    } else if (categories.crashes.some(c => mapping[c])) {
      score += 15;
    }
  }

  return total > 0 ? (score / total) * 100 : 100;
}
```

---

## 🎛️ Configuration et Paramètres

### Options de Mapping
```javascript
const DRUM_MAPPING_OPTIONS = {
  // Mode de mapping
  mode: 'intelligent', // 'intelligent', 'closest', 'strict'

  // Tolérance
  allowSubstitution: true,        // Autoriser les substitutions
  allowSharing: true,              // Plusieurs notes MIDI → même note instrument
  allowOmission: true,             // Omettre les notes non critiques si pas de match

  // Priorités
  preserveEssentials: true,        // Toujours préserver kick/snare/HH
  preferExactMatch: true,          // Préférer match exact vs substitution

  // Seuils
  minQualityScore: 50,             // Score minimum acceptable (0-100)
  minEssentialCoverage: 0.75,      // 75% des éléments essentiels requis

  // Comportement
  warnOnLowQuality: true,          // Avertir si score < seuil
  suggestAlternatives: true        // Proposer d'autres instruments si score faible
};
```

---

## 🚀 Implémentation Recommandée

### Phase 1 : Infrastructure
1. Créer `DrumNoteMapper.js` avec:
   - Tables de catégorisation des notes
   - Tables de substitution par priorité
   - Fonctions de scoring

2. Étendre `InstrumentMatcher.js`:
   - Ajouter détection spécifique drums
   - Intégrer DrumNoteMapper pour mode discrete
   - Remplacer simple "closest note" par mapping intelligent

### Phase 2 : Algorithme de Mapping
1. Implémenter les 4 niveaux de priorité
2. Système de scoring de qualité
3. Génération de rapport détaillé (notes mappées, omises, substituées)

### Phase 3 : Interface Utilisateur
1. Visualisation du mapping dans AutoAssignModal
2. Édition manuelle du mapping si nécessaire
3. Preview audio avant validation

### Phase 4 : Optimisations
1. Apprentissage des préférences utilisateur
2. Templates de mapping par genre musical
3. Cache des mappings courants

---

## 📈 Bénéfices Attendus

### Quantitatifs
- **+30-50%** de notes drums jouables en moyenne
- **Score de compatibilité** passant de 60% → 85%+
- **Réduction du nombre de notes omises** de 40% → 10%

### Qualitatifs
- Préservation de l'intention musicale
- Meilleure expérience d'auto-assignement
- Réduction des ajustements manuels nécessaires
- Utilisable avec instruments limités (8-16 pads)

---

## 🔬 Cas d'Usage Réels

### Exemple 1 : Fichier MIDI Rock Standard
**Contenu :** Kick, Snare, HH (fermé/ouvert), 3 toms, 2 crashes, ride

**Instrument :** Kit 12 pads (Roland TD-17)

**Résultat attendu :**
- ✅ Kick, Snare, HH : mapping 1:1
- ✅ Toms : 3 sur 3 mappés
- ✅ Crashes : 2→1 (partagé)
- ✅ Ride : mapping 1:1
- **Score : 95/100**

---

### Exemple 2 : Fichier MIDI Latin Jazz
**Contenu :** Kick, Snare, HH, Congas (3), Bongos (2), Timbales (2), Cowbell, Maracas

**Instrument :** Kit 10 pads minimal

**Résultat attendu :**
- ✅ Kick, Snare, HH : mapping 1:1
- ⚠️ Congas → Toms (3→2, regroupés)
- ⚠️ Bongos → Toms ou Congas
- ⚠️ Timbales → Toms
- ❌ Cowbell, Maracas → omis ou HH
- **Score : 65/100** (acceptable, éléments essentiels préservés)

---

### Exemple 3 : Fichier MIDI Électro
**Contenu :** Kicks (2 types), Snare électro, Clap, HH (fermé/ouvert), Cymbals (crash + ride), Percu électronique diverse

**Instrument :** Pad controller 16 pads

**Résultat attendu :**
- ✅ Kicks → 1 pad (partagés)
- ✅ Snare électro → pad snare
- ✅ Clap → pad séparé ou snare
- ✅ HH → 2 pads (fermé/ouvert)
- ✅ Cymbals → 2 pads
- ⚠️ Percu diverse → pads restants (8-9) selon priorité
- **Score : 80/100**

---

## ✅ Conclusion

Cette étude propose un système complet d'adaptation intelligente des notes de percussions qui :

1. **Analyse** les capacités réelles de l'instrument
2. **Catégorise** les notes par fonction musicale
3. **Priorise** les éléments essentiels (kick, snare, HH)
4. **Mappe intelligemment** en fonction des substitutions acceptables
5. **Évalue** la qualité du mapping résultant

Le système doit être **flexible** (s'adapter à différents types d'instruments), **intelligent** (comprendre le contexte musical), et **transparent** (expliquer les choix faits à l'utilisateur).

---

## 📚 Annexes

### A. Référence Complète GM Drums (Notes 27-87)
Notes étendues parfois utilisées :

| Note | Nom |
|------|-----|
| 27 | High Q |
| 28 | Slap |
| 29 | Scratch Push |
| 30 | Scratch Pull |
| 31 | Sticks |
| 32 | Square Click |
| 33 | Metronome Click |
| 34 | Metronome Bell |
| 82 | Shaker |
| 83 | Jingle Bell |
| 84 | Bell Tree |
| 85 | Castanets |
| 86 | Mute Surdo |
| 87 | Open Surdo |

### B. Zones de Pads Multi-Zones
Certains pads supportent plusieurs zones (head/rim, bow/edge/bell) :

- **Snare :** Head (38), Rim (37), Cross-stick (37)
- **Toms :** Head (41, 43, 45, 47, 48, 50), Rim (même note + CC ou note adjacente)
- **Cymbales :** Bow (51), Edge (51 + velocity), Bell (53)
- **Hi-Hat :** Fermé (42), Semi-ouvert (variable), Ouvert (46), Pédale (44)

Ces zones peuvent être exploitées pour mapper plusieurs notes GM sur un seul pad physique.

---

**Auteur :** Système d'étude Ma-est-tro
**Date :** 2026-01-21
**Version :** 1.0
