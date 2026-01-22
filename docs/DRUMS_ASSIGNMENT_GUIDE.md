# Guide Pratique : Assignement et Adaptation des Drums MIDI

**Version**: 1.0
**Date**: 2026-01-22
**Audience**: Utilisateurs et développeurs

> **📖 Documentation Technique Complète** : [DRUMS_NOTE_MAPPING_STUDY.md](./DRUMS_NOTE_MAPPING_STUDY.md)

---

## 📋 Table des Matières

1. [Introduction](#introduction)
2. [Pourquoi les Drums sont Différents](#pourquoi-les-drums-sont-différents)
3. [Système de Mapping Intelligent](#système-de-mapping-intelligent)
4. [Configuration des Drum Kits](#configuration-des-drum-kits)
5. [Cas d'Usage Pratiques](#cas-dusage-pratiques)
6. [Optimisation et Best Practices](#optimisation-et-best-practices)
7. [Dépannage](#dépannage)

---

## 🎯 Introduction

Les **drums** (percussions) sont un cas particulier en MIDI qui nécessite un traitement spécialisé. Contrairement aux instruments mélodiques (piano, guitare, etc.), chaque note MIDI représente **un son de percussion différent**, pas une hauteur.

### Problématique

```
Fichier MIDI de drums utilise 15 sons différents
Votre batterie électronique n'en supporte que 8

❌ Mapping simpliste: 7 sons perdus !
✅ Mapping intelligent: Sons essentiels préservés, substitutions intelligentes
```

### Solution : DrumNoteMapper

Le système **DrumNoteMapper** analyse la **fonction musicale** de chaque son et trouve les meilleures substitutions possibles.

---

## 🥁 Pourquoi les Drums sont Différents

### MIDI Drums vs Instruments Mélodiques

| Aspect | Instruments Mélodiques | Drums |
|--------|----------------------|-------|
| **Note MIDI** | Hauteur (do, ré, mi...) | Type de son (kick, snare, hi-hat...) |
| **Transposition** | Possible (+12 = +1 octave) | Impossible (kick ≠ snare !) |
| **Mapping** | Par plage continue | Par notes discrètes |
| **Canal MIDI** | 0-8, 10-15 | **9** (MIDI Channel 10) |
| **Standard** | General MIDI Programs | General MIDI Drum Map |

### General MIDI Drum Map (Extrait)

| Note MIDI | Nom GM | Catégorie |
|-----------|--------|-----------|
| 36 | Bass Drum 1 (Kick) | Kick |
| 38 | Acoustic Snare | Snare |
| 40 | Electric Snare | Snare |
| 42 | Closed Hi-Hat | Hi-Hat |
| 44 | Pedal Hi-Hat | Hi-Hat |
| 46 | Open Hi-Hat | Hi-Hat |
| 49 | Crash Cymbal 1 | Crash |
| 51 | Ride Cymbal 1 | Ride |
| 47 | Low-Mid Tom | Tom |
| 48 | Hi-Mid Tom | Tom |
| 50 | High Tom | Tom |

**Total GM Drums** : 47 notes (35-81)

**📖 Carte complète** : [DRUMS_NOTE_MAPPING_STUDY.md - Section GM Drum Map](./DRUMS_NOTE_MAPPING_STUDY.md#carte-complète-des-drums-general-midi)

### Exemple de Problème

```
Fichier MIDI rock.mid utilise :
  36 - Kick
  38 - Snare
  40 - Electric Snare (variation)
  42 - Closed HH
  44 - Pedal HH (variation)
  46 - Open HH
  49 - Crash
  51 - Ride
  47, 48, 50 - Toms

Kit électronique Roland TD-1KV supporte :
  36 - Kick
  38 - Snare
  42 - Closed HH
  46 - Open HH
  49 - Crash
  51 - Ride

PROBLÈME :
  40 (Electric Snare) → PAS SUPPORTÉ
  44 (Pedal HH) → PAS SUPPORTÉ
  47, 48, 50 (Toms) → PAS SUPPORTÉS

❌ Mapping naïf "closest note" :
  40 → 38 (OK musicalement, mais aléatoire)
  44 → 42 ou 46 (aléatoire)
  47 → 46 ou 49 (incohérent !)

✅ Mapping intelligent DrumNoteMapper :
  40 → 38 (substitution snare cohérente)
  44 → 42 (Pedal HH → Closed HH, même type)
  47, 48, 50 → omis ou mappés sur crash/ride selon contexte
```

---

## 🧠 Système de Mapping Intelligent

### Principe : Fonction Musicale > Proximité Numérique

Le **DrumNoteMapper** ne regarde pas seulement la distance entre notes, mais leur **rôle musical** :

```
Note 40 (Electric Snare)
  ↓
Catégorie : SNARE
  ↓
Table de substitution prioritaire :
  1. 38 (Snare Acoustique) ⭐⭐⭐⭐⭐
  2. 37 (Side Stick)      ⭐⭐⭐
  3. 39 (Hand Clap)       ⭐⭐
  4. 54 (Tambourine)      ⭐
  ↓
Sélection : 38 (premier disponible)
```

### Catégories de Drums

Le système groupe les sons par **fonction musicale** :

| Catégorie | Notes GM | Fonction Musicale |
|-----------|----------|-------------------|
| **Kicks** | 35, 36 | Grosse caisse (fondation) |
| **Snares** | 37, 38, 40 | Caisse claire (backbeat) |
| **Hi-Hats** | 42, 44, 46 | Charleston (timing) |
| **Toms** | 41, 43, 45, 47, 48, 50 | Toms (fills, breaks) |
| **Crashes** | 49, 55, 57 | Cymbales crash (accents) |
| **Rides** | 51, 53, 59 | Cymbales ride (rythme) |
| **Latin** | 60-68 | Percussions latines |
| **Misc** | Autres | Effets divers |

**📖 Détails complets** : [DRUMS_NOTE_MAPPING_STUDY.md - Section Catégories](./DRUMS_NOTE_MAPPING_STUDY.md#catégorisation-par-fonction-musicale)

### Algorithme en 4 Niveaux

```
1. ESSENTIEL (Priorité maximale)
   - Kick (36 ou 35)
   - Snare (38 ou 40)
   - Closed Hi-Hat (42)
   - Crash (49)
   → Ces sons DOIVENT être mappés

2. IMPORTANT
   - Open Hi-Hat (46)
   - Toms
   - Ride (51)
   → Mappés si possible

3. OPTIONNEL
   - Variations (Electric Snare, Pedal HH, etc.)
   - Latin percussion
   → Mappés ou substitués

4. RESTANT
   - Effets sonores
   - Percussion exotique
   → Omis si nécessaire
```

### Score de Qualité (0-100)

Le système calcule un **score de qualité** du mapping :

```
Score = 40% Essential + 30% Important + 15% Optional + 10% Coverage + 5% Accuracy

Exemple :
  Essential : 100% (kick, snare, HH, crash préservés)
  Important : 80% (ride OK, 1 tom manquant)
  Optional : 50% (quelques variations perdues)
  Coverage : 90% (9/10 notes mappées)
  Accuracy : 95% (très peu de substitutions)

  Score = 40×1.0 + 30×0.8 + 15×0.5 + 10×0.9 + 5×0.95
        = 40 + 24 + 7.5 + 9 + 4.75
        = 85.25 / 100 ⭐⭐⭐⭐
```

**📖 Algorithme complet** : [DRUMS_NOTE_MAPPING_STUDY.md - Section Algorithme](./DRUMS_NOTE_MAPPING_STUDY.md#algorithme-de-mapping-intelligent)

---

## ⚙️ Configuration des Drum Kits

### Étape 1 : Définir le Mode "Discrete"

Dans l'interface de capabilities :

```
Mode de notes : ● Discrete (pads/drums)
                ○ Range (continu)
```

**Pourquoi** : Indique que chaque note est un son distinct, pas une hauteur.

### Étape 2 : Sélectionner les Notes Supportées

**Interface** : Clavier visuel MIDI avec notes 35-81

```
[✓] 36 - Kick
[✓] 38 - Snare
[ ] 40 - Electric Snare
[✓] 42 - Closed HH
[ ] 44 - Pedal HH
[✓] 46 - Open HH
[✓] 49 - Crash
[✓] 51 - Ride
```

**Conseil** : Sélectionner **au minimum** :
- 1 Kick (36 ou 35)
- 1 Snare (38 ou 40)
- 1 Hi-Hat (42)
- 1 Crash (49)

= Kit minimal **jouable**

### Kits Recommandés par Scénario

#### Kit Minimal (6-8 sons)

**Priorité** : Éléments essentiels uniquement

```
Obligatoire :
  36 - Kick
  38 - Snare
  42 - Closed HH
  46 - Open HH
  49 - Crash

Recommandé :
  35 - Kick alternatif
  51 - Ride
  48 - Tom (au moins 1)

Total : 8 sons
Score attendu : 60-75%
```

#### Kit Standard (10-15 sons)

**Priorité** : Rock, Pop

```
Kit minimal +
  35 - Kick 2
  40 - Electric Snare
  44 - Pedal HH
  47, 48, 50 - Toms (3)
  51 - Ride
  55 - Splash

Total : 13 sons
Score attendu : 75-90%
```

#### Kit Complet (20+ sons)

**Priorité** : Jazz, Orchestral, Latin

```
Kit standard +
  37, 39 - Variations snare
  53, 59 - Variations ride
  41, 43, 45 - Toms supplémentaires
  57 - Crash 2
  60-68 - Latin percussion

Total : 25+ sons
Score attendu : 90-100%
```

**📖 Scénarios détaillés** : [DRUMS_NOTE_MAPPING_STUDY.md - Section Scénarios](./DRUMS_NOTE_MAPPING_STUDY.md#scénarios-dadaptation)

---

## 🎬 Cas d'Usage Pratiques

### Cas 1 : Kit Complet → Parfait Match

**Configuration** :
- Fichier MIDI : 12 sons (rock standard)
- Kit Roland TD-17 : 25 sons GM complets

**Résultat** :
```
✅ Score : 100/100
✅ 12/12 sons mappés exactement
✅ Aucune substitution
✅ Tous éléments préservés

Mapping :
  36 → 36 (exact)
  38 → 38 (exact)
  40 → 40 (exact)
  ...

✨ Configuration idéale !
```

### Cas 2 : Kit Réduit → Substitutions Intelligentes

**Configuration** :
- Fichier MIDI : 15 sons (jazz complet)
- Kit Alesis Nitro : 8 sons basiques

**Résultat** :
```
⚠️ Score : 72/100
✅ 15/15 sons mappés
⚠️ 7 substitutions intelligentes
✅ Essentiels 100% préservés

Mapping intelligent :
  36 → 36 (exact, kick)
  38 → 38 (exact, snare)
  40 → 38 (substitution snare)      ⭐
  42 → 42 (exact, closed HH)
  44 → 42 (substitution HH)          ⭐
  46 → 46 (exact, open HH)
  49 → 49 (exact, crash)
  51 → 51 (exact, ride)
  47 → 49 (substitution tom→crash)   ⭐
  48 → 49 (substitution tom→crash)   ⭐
  50 → 51 (substitution tom→ride)    ⭐
  53 → 51 (substitution ride var)    ⭐
  59 → 49 (substitution crash var)   ⭐

Rapport :
  Essential : 100%
  Important : 80%
  Optional : 50%

✔️ Jouable avec qualité acceptable
```

### Cas 3 : Pad Controller → Omissions Nécessaires

**Configuration** :
- Fichier MIDI : 20 sons (orchestral)
- Pad Akai MPD218 : 4 pads configurés (36, 38, 42, 49)

**Résultat** :
```
❌ Score : 35/100
⚠️ 4/20 sons mappés
❌ 16 sons omis
✅ Essentiels partiels (kick, snare, HH, crash)

Mapping :
  36 → 36 (exact, kick)
  38 → 38 (exact, snare)
  40 → 38 (substitution snare)
  42 → 42 (exact, closed HH)
  44 → 42 (substitution HH)
  46 → 42 (substitution HH)
  49 → 49 (exact, crash)
  51 → 49 (substitution crash)
  47, 48, 50 → OMIS
  55, 57, 59 → OMIS
  60-68 → OMIS

Rapport :
  Essential : 75% (pas de ride)
  Important : 25%
  Optional : 0%

⚠️ Jouable mais très limité
Recommandation : Ajouter pads ou choisir fichier plus simple
```

### Cas 4 : Drums sur Canal Non-9

**Configuration** :
- Fichier MIDI : Drums sur canal 3 (non-standard)
- Kit disponible : Roland TD-25

**Problème** :
```
❌ Système ne détecte pas automatiquement comme drums
→ Utilise mapping "closest note" basique
→ Résultat médiocre
```

**Solution** :
1. Éditer fichier MIDI → déplacer drums vers canal 9
2. OU : Forcer mode "discrete" pour l'instrument ciblé

**Résultat après correction** :
```
✅ Score : 95/100
✅ DrumNoteMapper activé
✅ Mapping intelligent appliqué
```

---

## 🎯 Optimisation et Best Practices

### Pour les Créateurs de Fichiers MIDI

#### ✅ DO

1. **Utiliser canal 9** pour les drums
2. **Respecter GM Drum Map** (notes 35-81)
3. **Privilégier notes standards** :
   - 36 (Kick), pas 35
   - 38 (Snare), pas 40
   - 42 (Closed HH), pas 44
4. **Documenter** les sons utilisés dans metadata

#### ❌ DON'T

1. **Éviter notes non-GM** (<35 ou >81)
2. **Ne pas mélanger** drums mélodiques sur même canal
3. **Éviter percussion exotique** si targeting kit basique

### Pour les Configurateurs de Kits

#### ✅ DO

1. **Prioriser essentiels** :
   - Kick (36)
   - Snare (38)
   - Closed HH (42)
   - Crash (49)

2. **Ajouter variations courantes** :
   - Open HH (46)
   - Ride (51)
   - 1-3 Toms

3. **Tester avec fichiers réels** avant validation

4. **Documenter** le kit (nom, nombre de pads, layout)

#### ❌ DON'T

1. **Ne pas oublier** les notes "évidentes" (36, 38, 42)
2. **Ne pas configurer** en mode "range" pour drums
3. **Éviter configurations incomplètes** (validation forcera à compléter)

### Pour les Utilisateurs Finaux

#### Avant Auto-Assignement

1. ✅ Vérifier que kit est **allumé et connecté**
2. ✅ **Compléter capabilities** si demandé
3. ✅ **Tester manuellement** quelques notes MIDI

#### Pendant Sélection

1. ✅ **Regarder le score** : >70 = bon, <50 = problématique
2. ✅ **Lire les issues/warnings** dans les suggestions
3. ✅ **Utiliser Preview** pour valider le résultat

#### Après Application

1. ✅ **Tester lecture** complète
2. ✅ **Ajuster volume** si certains sons trop forts/faibles
3. ✅ Si insatisfait : **ré-assigner manuellement** dans modal

---

## 🛠️ Dépannage

### Problème : Score Très Bas (<30%)

**Symptôme** :
```
Roland Drums : 25/100 ❌
  - Low drum mapping quality
  - Many notes will be omitted
```

**Causes possibles** :
1. Kit trop limité pour le fichier
2. Capabilities mal configurées
3. Fichier utilise percussion non-standard

**Solutions** :

**A) Vérifier capabilities** :
```
1. Ouvrir Instrument Capabilities Modal
2. Vérifier mode "Discrete" activé
3. Compter notes sélectionnées (minimum 6 recommandé)
4. Ajouter notes manquantes si possible
5. Sauvegarder et ré-tester
```

**B) Simplifier le fichier MIDI** :
```
1. Ouvrir MIDI editor
2. Identifier notes les plus utilisées
3. Supprimer percussion secondaire
4. Ré-assigner
```

**C) Accepter la limitation** :
```
Si kit vraiment minimal (4 pads) :
  - Accepter score bas
  - Sélectionner fichiers MIDI plus simples à l'avenir
  - Considérer upgrade matériel
```

### Problème : Certains Sons Ne Jouent Pas

**Symptôme** : Kick et snare OK, mais hi-hats muets

**Causes** :
1. **Notes mal mappées** : Vérifier mapping dans rapport
2. **Volume pad** : Certains pads peuvent être mutés sur kit
3. **MIDI channel** : Vérifier que routing pointe vers bon canal

**Diagnostic** :
```
1. Ouvrir rapport de mapping (dans UI suggestions)
2. Chercher ligne pour hi-hat (42, 44, 46)
3. Vérifier :
   42 → 42 (exact) ✅
   44 → 42 (subst) ✅
   46 → 46 (exact) ✅

Si mapping OK mais pas de son :
   → Problème hardware (pad muté, câble, etc.)
```

### Problème : Substitutions Sonnent Mal

**Symptôme** : Toms mappés sur crash → résultat bizarre

**Explication** :
```
Kit minimal sans toms disponibles
→ DrumNoteMapper cherche alternatives
→ Trouve crash/ride (seuls disponibles)
→ Résultat musicalement incorrect
```

**Solutions** :

**A) Ajouter des toms au kit** (si possible)
```
Capabilities → Ajouter notes 47, 48, 50
Score devrait augmenter significativement
```

**B) Éditer mapping manuellement** (avancé)
```
Créer routing personnalisé :
  47 (Low Tom) → omit (mieux que crash)
  48 (Mid Tom) → omit
  50 (High Tom) → omit
```

**C) Utiliser fichier différent**
```
Chercher fichier MIDI avec moins de toms
Filtrer par "has_drums" + "channel_count < 8"
```

### Problème : Fichier Drums pas Détecté Comme Drums

**Symptôme** : Drums traités comme instrument mélodique

**Cause** : Drums sur canal ≠ 9

**Diagnostic** :
```
1. Ouvrir ChannelAnalyzer dans dev tools
2. Vérifier analysis.channel
   - Si channel !== 9 → pas détecté drums
3. Vérifier estimatedType
   - Si !== "drums" → mapping simple appliqué
```

**Solutions** :

**A) Forcer mode discrete sur instrument** :
```
Même si canal ≠ 9, si instrument en mode discrete
→ Mapping intelligent sera tenté
```

**B) Éditer fichier MIDI** (recommandé) :
```
1. Ouvrir dans séquenceur (Reaper, Logic, etc.)
2. Déplacer track drums vers canal 10 (MIDI channel 10 = canal 9 en 0-index)
3. Sauvegarder
4. Re-uploader
```

---

## 📊 Résumé des Scores

### Interprétation des Scores

| Score | Qualité | Signification |
|-------|---------|---------------|
| 90-100 | ⭐⭐⭐⭐⭐ Excellent | Quasi-parfait, tous sons préservés |
| 75-89 | ⭐⭐⭐⭐ Très Bon | Essentiels OK, quelques substitutions |
| 60-74 | ⭐⭐⭐ Bon | Jouable, substitutions notables |
| 40-59 | ⭐⭐ Acceptable | Limité, beaucoup de compromis |
| <40 | ⭐ Faible | Très limité, considérer alternatives |

### Éléments du Score

```
Score = 40% Essential
      + 30% Important
      + 15% Optional
      + 10% Coverage (% notes mappées)
      + 5% Accuracy (% exact matches)
```

**Essential** (40%) :
- Kick préservé ?
- Snare préservé ?
- Hi-Hat préservé ?
- Crash préservé ?

**Important** (30%) :
- Ride disponible ?
- Open HH disponible ?
- Toms disponibles ?

**Optional** (15%) :
- Variations (Electric Snare, Pedal HH, etc.)
- Latin percussion

**Coverage** (10%) :
- Combien de notes du fichier sont mappées (vs omises) ?

**Accuracy** (5%) :
- Combien de matches exacts (vs substitutions) ?

---

## 🔗 Ressources

### Documentation Technique

- **📖 [DRUMS_NOTE_MAPPING_STUDY.md](./DRUMS_NOTE_MAPPING_STUDY.md)** - Étude complète du système (1020 lignes)
  - Carte GM complète
  - Tables de substitution
  - Algorithme détaillé
  - Scénarios d'adaptation
  - Formules de scoring

- **📖 [MIDI_ASSIGNMENT_ADAPTATION_GUIDE.md](./MIDI_ASSIGNMENT_ADAPTATION_GUIDE.md)** - Guide général assignement
  - Architecture complète
  - Tous types d'instruments
  - API et interface

- **📖 [ASSIGNMENT_SYSTEM_AUDIT.md](./ASSIGNMENT_SYSTEM_AUDIT.md)** - Audit technique
  - Points forts/faibles
  - Bugs identifiés
  - Recommandations

### Fichiers Sources

- **Backend** :
  - `src/midi/DrumNoteMapper.js` (807 lignes)
  - `src/midi/InstrumentMatcher.js` (intégration)
  - `src/midi/AutoAssigner.js` (orchestration)

- **Frontend** :
  - `public/js/views/components/AutoAssignModal.js`
  - `public/js/views/components/InstrumentCapabilitiesModal.js`

### Ressources Externes

- **MIDI.org** : Spécifications General MIDI
- **GM Drum Map Reference** : [midi.org/specifications](https://www.midi.org/specifications)

---

## 🎓 Conclusion

Le système **DrumNoteMapper** transforme un problème complexe (mapper N sons vers M pads disponibles) en une solution **musicalement cohérente** :

✅ **Analyse** la fonction musicale des sons
✅ **Préserve** les éléments essentiels (kick, snare, hi-hat)
✅ **Substitue** intelligemment les sons similaires
✅ **Omet** uniquement le moins important
✅ **Score** la qualité du résultat (0-100)

**Résultat** : Fichier MIDI drums → batterie électronique jouable, même avec kits limités ! 🥁

---

**Besoin d'aide ?** Consulter la [documentation technique complète](./DRUMS_NOTE_MAPPING_STUDY.md) ou l'[audit système](./ASSIGNMENT_SYSTEM_AUDIT.md).
