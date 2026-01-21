# Étude d'amélioration - Page de gestion des fichiers MIDI

**Date**: 2026-01-21
**Version**: MidiMind 5.0
**Contexte**: Analyse de la page principale (`public/index.html`) pour améliorer l'organisation et la facilité d'utilisation

---

## 📋 Table des matières

1. [État actuel](#état-actuel)
2. [Points forts](#points-forts)
3. [Problèmes identifiés](#problèmes-identifiés)
4. [Améliorations recommandées](#améliorations-recommandées)
5. [Priorisation](#priorisation)
6. [Détails techniques](#détails-techniques)

---

## 1. État actuel

### Architecture actuelle

**Format d'affichage:**
- Liste verticale simple (`<ul class="file-list">`)
- Hauteur maximum: 400px avec défilement
- Organisation par dossiers (1 niveau uniquement)
- Actions: ✏️ Éditer | 🔀 Router | ▶️ Jouer | 🗑️ Supprimer

**Gestion des dossiers:**
```
📁 Dossier 1                           [▼][🗑️]
  - fichier1.mid                       [✏️][🔀][▶️][🗑️]
  - fichier2.mid                       [✏️][🔀][▶️][🗑️]
📁 Dossier 2                           [▼][🗑️]
fichier-racine.mid                     [✏️][🔀][▶️][🗑️]
```

**Stockage:**
- Structure des dossiers: `localStorage['midi_folders']`
- Configuration de routage: `localStorage['midi_file_routing']`
- Métadonnées: récupérées du backend à chaque chargement

**Opérations disponibles:**
- ✅ Upload multiple de fichiers MIDI
- ✅ Création de dossiers
- ✅ Glisser-déposer fichiers dans dossiers
- ✅ Suppression fichiers/dossiers
- ✅ Édition via modal
- ✅ Configuration routage canaux MIDI
- ✅ Lecture avec vérification routage

---

## 2. Points forts

### ✅ Interface utilisateur
- **Émojis intuitifs**: Reconnaissance universelle des actions
- **Feedback visuel clair**:
  - Bordure verte (fichier routé)
  - Badge ✓ (routage configuré)
  - Avertissement ⚠️ (routage manquant)
- **Glisser-déposer fonctionnel**: Déplacement facile vers dossiers/racine
- **État persistant**: Dossiers et routage sauvegardés localement

### ✅ Organisation
- **Dossiers simples**: Système de base fonctionnel
- **Distinction visuelle**: Couleurs différentes (dossier jaune, fichier gris)
- **Nettoyage automatique**: Références orphelines supprimées

### ✅ Workflow
- **Vérification routage**: Empêche la lecture sans configuration
- **Confirmation actions**: Dialogue avant suppression
- **Gestion périphérique virtuel**: Instrument logiciel intégré

---

## 3. Problèmes identifiés

### 🔴 Critiques (Bloquants pour grandes collections)

#### 3.1 Absence de recherche
**Problème**: Impossible de trouver un fichier dans une liste de >50 fichiers
**Impact**: Utilisateur doit faire défiler manuellement
**Cas d'usage**: "Je cherche 'beethoven-symphony.mid' parmi 200 fichiers"

#### 3.2 Pas de métadonnées visibles
**Problème**: Aucune information affichée sur les fichiers
**Informations manquantes**:
- Durée (3:45)
- Taille (128 KB)
- Nombre de canaux (16)
- Instruments utilisés (Piano, Strings, Drums)
- Tempo (120 BPM)
- Date de modification

**Impact**: Impossible de différencier les fichiers sans les ouvrir

#### 3.3 Impossibilité de renommer
**Problème**: Nom du fichier fixe après upload
**Impact**: Organisation difficile, doit réuploader pour changer le nom
**Cas d'usage**: "J'ai uploadé 'track1.mid' mais je veux le renommer 'Piano Solo.mid'"

---

### 🟠 Importants (Frictions dans le workflow)

#### 3.4 Pas d'opérations par lots
**Problèmes**:
- ❌ Impossible de supprimer plusieurs fichiers à la fois
- ❌ Impossible de déplacer plusieurs fichiers vers un dossier
- ❌ Impossible de sélectionner avec Ctrl/Shift+clic
- ❌ Impossible de "Tout sélectionner"

**Impact**: Opérations répétitives et chronophages

#### 3.5 Pas d'historique / Annulation
**Problème**: Suppression permanente sans retour arrière
**Impact**: Risque de perte de données accidentelle
**Cas d'usage**: "J'ai supprimé le mauvais fichier, je ne peux pas récupérer"

#### 3.6 Hiérarchie limitée (1 niveau)
**Problème**: Impossible de créer des dossiers dans des dossiers
**Structure souhaitée impossible**:
```
📁 Projet A
  📁 Versions
    - v1.mid
    - v2.mid
  📁 Exports
    - final.mid
```

**Impact**: Organisation complexe impossible

#### 3.7 Feedback upload limité
**Problème**: Aucune barre de progression, confirmation seulement dans console
**Impact**: Utilisateur ne sait pas si l'upload est en cours/réussi

---

### 🟡 Moyens (Améliorations UX)

#### 3.8 Pas de tri
**Problème**: Fichiers affichés dans l'ordre de création
**Tris souhaités**:
- Alphabétique (A-Z, Z-A)
- Date (plus récent, plus ancien)
- Taille (plus grand, plus petit)
- Durée (plus long, plus court)

#### 3.9 Avertissement routage confus
**Problème**: Bouton ▶️ avec ⚠️ reste cliquable
**Comportement attendu**: Désactivé ou tooltip explicatif
**Message suggéré**: "Configurez le routage MIDI avant la lecture"

#### 3.10 Pas de raccourcis clavier
**Raccourcis manquants**:
- `Suppr` / `Delete` - Supprimer fichier sélectionné
- `Entrée` / `Enter` - Lire fichier sélectionné
- `F2` - Renommer fichier
- `Ctrl+A` - Tout sélectionner
- `Échap` / `Escape` - Annuler sélection
- `Espace` - Lecture/Pause

#### 3.11 Pas d'export fichier modifié
**Problème**: Édition écrase l'original sans sauvegarde séparée
**Cas d'usage**: "J'ai modifié le fichier mais je veux garder l'original"
**Solution souhaitée**: "Sauvegarder sous..." / "Exporter en tant que..."

#### 3.12 Gestion dossiers rigide
**Problèmes**:
- ❌ Impossible de renommer un dossier
- ❌ Impossible de supprimer dossier avec contenu (doit vider manuellement)
- ❌ Pas d'action "Vider le dossier"
- ❌ Dossiers vides restent après suppression de tous les fichiers

---

### 🔵 Mineurs (Nice-to-have)

#### 3.13 Vue unique (liste seulement)
**Problème**: Pas d'alternative visuelle
**Vues souhaitées**:
- 📋 Liste (actuel)
- 🗂️ Grille / Cartes
- 📊 Tableau détaillé avec colonnes

#### 3.14 Pas de favoris / Accès rapide
**Cas d'usage**: "Je travaille souvent sur les mêmes 5 fichiers"
**Solution**: Étoile ⭐ pour marquer favoris, section dédiée

#### 3.15 Pas de tags / catégories
**Problème**: Organisation limitée aux dossiers
**Cas d'usage**: "Je veux taguer un fichier 'Jazz, Piano, Démo'"

#### 3.16 Pas de prévisualisation
**Problème**: Impossible de visualiser le contenu sans ouvrir
**Solutions possibles**:
- Graphique minimaliste (mini piano roll)
- Liste des instruments utilisés
- Aperçu des premières mesures

---

## 4. Améliorations recommandées

### 🎯 Priorité 1 - Critique (Impact immédiat)

#### A. Barre de recherche / filtre
**Description**: Champ de recherche en temps réel au-dessus de la liste

**Interface suggérée**:
```
┌─────────────────────────────────────────────┐
│ 🔍 Rechercher...                       [×]  │
└─────────────────────────────────────────────┘
```

**Fonctionnalités**:
- Recherche instantanée (pas de bouton)
- Recherche dans nom de fichier
- Highlight des résultats
- Compteur: "8 résultats sur 156 fichiers"
- Bouton effacer [×]

**Effort**: Faible (1-2h)
**Valeur**: Très élevée

---

#### B. Affichage métadonnées
**Description**: Afficher informations clés dans la liste

**Design suggéré**:
```
┌─────────────────────────────────────────────────────────┐
│ 🎵 beethoven-symphony.mid                    ✓         │
│    ⏱ 4:32  •  💾 256 KB  •  🎹 16 canaux  •  ♩ 120 BPM│
│                                    [✏️][🔀][▶️][🗑️]   │
└─────────────────────────────────────────────────────────┘
```

**Informations à afficher**:
- ⏱ Durée (MM:SS)
- 💾 Taille fichier
- 🎹 Nombre de canaux utilisés
- ♩ Tempo (BPM)
- 📅 Date upload/modification
- 🎼 Format MIDI (0, 1, 2)

**Effort**: Moyen (3-4h - récupération backend)
**Valeur**: Très élevée

---

#### C. Renommer fichiers
**Description**: Double-clic ou bouton F2 pour renommer

**Interface**:
```
┌─────────────────────────────────────────┐
│  Renommer le fichier                    │
├─────────────────────────────────────────┤
│  Ancien nom: track1.mid                 │
│                                          │
│  Nouveau nom:                            │
│  ┌────────────────────────────────────┐ │
│  │ Piano Solo.mid                     │ │
│  └────────────────────────────────────┘ │
│                                          │
│              [Annuler]  [Renommer]      │
└─────────────────────────────────────────┘
```

**Validation**:
- ✅ Vérifier extension `.mid` ou `.midi`
- ✅ Vérifier nom unique dans le dossier
- ✅ Interdire caractères spéciaux: `/ \ : * ? " < > |`

**Effort**: Faible (2-3h)
**Valeur**: Élevée

---

### 🎯 Priorité 2 - Important (Workflow improvement)

#### D. Sélection multiple + opérations par lots
**Description**: Sélection avec Ctrl/Shift + actions groupées

**Interface**:
```
[✓] beethoven.mid
[✓] mozart.mid
[ ] chopin.mid

[Sélectionner tout] [Désélectionner]
[🗑️ Supprimer (2)] [📁 Déplacer vers...] [⭐ Favoris]
```

**Fonctionnalités**:
- Checkbox sur chaque fichier (affiché au survol)
- Ctrl+clic pour sélection multiple
- Shift+clic pour sélection plage
- Barre d'actions apparaît si sélection > 0
- Actions: Supprimer, Déplacer, Copier, Télécharger

**Effort**: Moyen (4-6h)
**Valeur**: Élevée

---

#### E. Historique / Annulation
**Description**: Stack d'actions avec possibilité d'annuler

**Interface**:
```
┌─────────────────────────────────────────┐
│ 🔙 Annuler: Suppression de "track1.mid"│
└─────────────────────────────────────────┘
```

**Fonctionnalités**:
- Bouton "Annuler" (Ctrl+Z) dans header
- Toast notification avec action
- Historique dernières 10 opérations
- Actions annulables:
  - Suppression fichier/dossier
  - Déplacement
  - Renommage

**Implémentation**:
- Stack en mémoire (pas persisté)
- Timer 30s pour annulation
- Suppression définitive après 30s

**Effort**: Moyen (5-7h)
**Valeur**: Élevée

---

#### F. Amélioration feedback upload
**Description**: Barre de progression et notifications claires

**Interface**:
```
┌─────────────────────────────────────────────┐
│ 📤 Upload en cours... (3/5)                │
│ ▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░  60%                 │
│ symphony.mid (256 KB / 512 KB)             │
└─────────────────────────────────────────────┘

✅ 5 fichiers uploadés avec succès
   • beethoven.mid (512 KB)
   • mozart.mid (384 KB)
   • ...
```

**Fonctionnalités**:
- Barre de progression globale
- Détail par fichier
- Notification succès/erreur
- Bouton annuler pendant upload

**Effort**: Moyen (4-5h)
**Valeur**: Moyenne-élevée

---

#### G. Dossiers imbriqués (multi-niveaux)
**Description**: Support de hiérarchie complète

**Exemple structure**:
```
📁 Projets
  📁 Projet A
    📁 Brouillons
      - draft1.mid
      - draft2.mid
    📁 Finaux
      - final.mid
  📁 Projet B
    - projet-b-v1.mid
```

**Fonctionnalités**:
- Création sous-dossiers
- Fil d'Ariane: `Projets > Projet A > Brouillons`
- Glisser-déposer multi-niveaux
- Expansion/collapse récursive

**Implémentation technique**:
```javascript
folderStructure = {
  'Projets': {
    parent: null,
    children: ['Projet A', 'Projet B'],  // 🆕 Enfants dossiers
    files: [],
    open: true
  },
  'Projet A': {
    parent: 'Projets',                    // 🆕 Parent non-null
    children: ['Brouillons', 'Finaux'],
    files: [],
    open: false
  },
  // ...
}
```

**Effort**: Élevé (8-10h - refonte structure)
**Valeur**: Moyenne (utile pour gros projets)

---

### 🎯 Priorité 3 - Moyen (Polish & UX)

#### H. Tri et filtres avancés
**Description**: Options de tri multiples

**Interface**:
```
Trier par: [Nom ▼] [A-Z ▼]

Options:
• Nom (A-Z / Z-A)
• Date (Plus récent / Plus ancien)
• Taille (Plus grand / Plus petit)
• Durée (Plus long / Plus court)
• Statut routage (Routés en premier)
```

**Effort**: Moyen (3-4h)
**Valeur**: Moyenne

---

#### I. Raccourcis clavier
**Description**: Raccourcis pour actions fréquentes

**Liste**:
| Raccourci | Action |
|-----------|--------|
| `Espace` | Lecture/Pause fichier sélectionné |
| `Entrée` | Ouvrir éditeur fichier sélectionné |
| `Suppr` | Supprimer fichier(s) sélectionné(s) |
| `F2` | Renommer fichier sélectionné |
| `Ctrl+A` | Tout sélectionner |
| `Ctrl+D` | Désélectionner tout |
| `Ctrl+Z` | Annuler dernière action |
| `Ctrl+F` | Focus barre de recherche |
| `Échap` | Fermer modals, annuler sélection |
| `↑/↓` | Naviguer dans liste |

**Effort**: Moyen (3-4h)
**Valeur**: Moyenne (power users)

---

#### J. Export fichier modifié
**Description**: Sauvegarder copie après édition

**Interface éditeur**:
```
[💾 Sauvegarder] [💾 Sauvegarder sous...] [❌ Annuler]
```

**Modal "Sauvegarder sous"**:
```
┌─────────────────────────────────────────┐
│  Sauvegarder sous                       │
├─────────────────────────────────────────┤
│  Nom:                                    │
│  ┌────────────────────────────────────┐ │
│  │ beethoven-symphony-edit.mid        │ │
│  └────────────────────────────────────┘ │
│                                          │
│  Dossier:                                │
│  ┌────────────────────────────────────┐ │
│  │ Projets / Éditions          [▼]   │ │
│  └────────────────────────────────────┘ │
│                                          │
│  ☐ Créer lien vers fichier original    │
│                                          │
│              [Annuler]  [Sauvegarder]   │
└─────────────────────────────────────────┘
```

**Effort**: Moyen (4-5h)
**Valeur**: Moyenne

---

#### K. Amélioration gestion dossiers
**Description**: Actions supplémentaires pour dossiers

**Nouvelles fonctionnalités**:
- ✏️ **Renommer dossier** (même UX que renommer fichier)
- 🗑️ **Supprimer dossier + contenu** (avec confirmation)
- 🧹 **Vider dossier** (supprimer tous les fichiers)
- 🔄 **Déplacer dossier** (glisser-déposer entre dossiers)
- 📊 **Statistiques dossier** (X fichiers, Y MB total)

**Menu contextuel dossier**:
```
┌─────────────────────────┐
│ ✏️  Renommer           │
│ 📂 Nouveau sous-dossier│
│ 🔄 Déplacer vers...    │
│ 🧹 Vider le dossier    │
│ ────────────────────   │
│ 🗑️  Supprimer          │
└─────────────────────────┘
```

**Effort**: Moyen (3-5h)
**Valeur**: Moyenne

---

### 🎯 Priorité 4 - Nice-to-have (Fonctionnalités avancées)

#### L. Vues alternatives (Grille / Tableau)
**Description**: Modes d'affichage supplémentaires

**Vue Grille**:
```
┌────────┐ ┌────────┐ ┌────────┐
│ 🎵     │ │ 🎵     │ │ 🎵     │
│ Song 1 │ │ Song 2 │ │ Song 3 │
│ 3:45   │ │ 2:30   │ │ 5:12   │
│ ✓      │ │        │ │ ✓      │
└────────┘ └────────┘ └────────┘
```

**Vue Tableau**:
```
| Nom              | Durée | Taille | Canaux | Routage | Actions |
|------------------|-------|--------|--------|---------|---------|
| beethoven.mid    | 4:32  | 256 KB | 16     | ✓       | [...] |
| mozart.mid       | 3:15  | 128 KB | 8      |         | [...] |
```

**Effort**: Élevé (6-8h)
**Valeur**: Faible-moyenne

---

#### M. Favoris / Accès rapide
**Description**: Section pour fichiers fréquemment utilisés

**Interface**:
```
⭐ Favoris (3)
  - main-project.mid
  - demo-song.mid
  - test-file.mid

📁 Tous les fichiers (156)
  ...
```

**Fonctionnalités**:
- Bouton étoile ⭐ sur chaque fichier
- Section favoris toujours visible en haut
- Limite 20 favoris max
- Tri manuel par glisser-déposer

**Effort**: Moyen (4-5h)
**Valeur**: Faible-moyenne

---

#### N. Tags / Métadonnées personnalisées
**Description**: Système de tags pour organisation flexible

**Interface**:
```
┌─────────────────────────────────────────┐
│  beethoven-symphony.mid                 │
│  Tags: [Jazz] [Piano] [Démo] [+]       │
└─────────────────────────────────────────┘

Filtrer par tag: [Jazz (12)] [Piano (24)] [Démo (8)]
```

**Fonctionnalités**:
- Tags couleur personnalisables
- Auto-complétion lors de la saisie
- Filtrage multi-tags (ET / OU)
- Badge compteur sur chaque tag

**Effort**: Élevé (8-10h)
**Valeur**: Faible (cas d'usage avancé)

---

#### O. Prévisualisation visuelle
**Description**: Aperçu graphique du contenu MIDI

**Options**:
1. **Mini piano-roll** (5 premières mesures)
2. **Graphique activité par canal** (bars par canal)
3. **Liste instruments** (texte)
4. **Graphique densité notes** (timeline)

**Interface**:
```
┌─────────────────────────────────────────┐
│ beethoven.mid                           │
│ ┌─────────────────────────────────────┐│
│ │ ████ ▓▓▓▓░░░░  ████ ▓▓▓▓░░░░ ████ ││  (mini piano-roll)
│ │ ▓▓▓▓ ████░░░░  ▓▓▓▓ ████░░░░ ▓▓▓▓ ││
│ └─────────────────────────────────────┘│
│ Instruments: Piano, Strings, Drums      │
└─────────────────────────────────────────┘
```

**Effort**: Très élevé (12-15h)
**Valeur**: Faible (nice-to-have visuel)

---

#### P. Profils de routage
**Description**: Templates de configuration réutilisables

**Cas d'usage**: "J'ai toujours la même configuration: Piano → Device1, Drums → Device2"

**Interface**:
```
┌─────────────────────────────────────────┐
│  Appliquer profil de routage            │
├─────────────────────────────────────────┤
│  ○ Profil Studio                        │
│     • Piano → Yamaha P-125              │
│     • Drums → Roland TR-8S              │
│     • Strings → Virtual Instrument      │
│                                          │
│  ○ Profil Live                          │
│     • Tout → Korg Minilogue            │
│                                          │
│  ○ Configuration personnalisée          │
│                                          │
│  [💾 Sauvegarder profil actuel]        │
│                                          │
│              [Annuler]  [Appliquer]     │
└─────────────────────────────────────────┘
```

**Effort**: Élevé (7-9h)
**Valeur**: Faible-moyenne (power users)

---

## 5. Priorisation

### Roadmap suggérée

#### Phase 1 - Quick Wins (1-2 semaines)
**Focus**: Fonctionnalités critiques, effort faible/moyen

| Amélioration | Effort | Valeur | Priorité |
|--------------|--------|--------|----------|
| A. Recherche/filtre | 1-2h | ⭐⭐⭐⭐⭐ | 🔴 Critique |
| C. Renommer fichiers | 2-3h | ⭐⭐⭐⭐ | 🔴 Critique |
| B. Métadonnées | 3-4h | ⭐⭐⭐⭐⭐ | 🔴 Critique |
| H. Tri | 3-4h | ⭐⭐⭐ | 🟡 Moyen |
| I. Raccourcis clavier | 3-4h | ⭐⭐⭐ | 🟡 Moyen |

**Total effort**: ~15-20h
**Impact**: Amélioration UX immédiate pour tous les utilisateurs

---

#### Phase 2 - Workflow (2-4 semaines)
**Focus**: Opérations par lots, historique, feedback

| Amélioration | Effort | Valeur | Priorité |
|--------------|--------|--------|----------|
| D. Sélection multiple | 4-6h | ⭐⭐⭐⭐ | 🟠 Important |
| E. Historique/Annulation | 5-7h | ⭐⭐⭐⭐ | 🟠 Important |
| F. Feedback upload | 4-5h | ⭐⭐⭐ | 🟠 Important |
| J. Export fichier modifié | 4-5h | ⭐⭐⭐ | 🟡 Moyen |
| K. Gestion dossiers | 3-5h | ⭐⭐⭐ | 🟡 Moyen |

**Total effort**: ~20-28h
**Impact**: Workflow plus fluide, réduction friction

---

#### Phase 3 - Organisation avancée (4-6 semaines)
**Focus**: Hiérarchie, favoris, vues

| Amélioration | Effort | Valeur | Priorité |
|--------------|--------|--------|----------|
| G. Dossiers imbriqués | 8-10h | ⭐⭐⭐ | 🟠 Important |
| L. Vues alternatives | 6-8h | ⭐⭐ | 🔵 Nice-to-have |
| M. Favoris | 4-5h | ⭐⭐ | 🔵 Nice-to-have |

**Total effort**: ~18-23h
**Impact**: Organisation complexe possible

---

#### Phase 4 - Fonctionnalités premium (6+ semaines)
**Focus**: Tags, prévisualisation, profils

| Amélioration | Effort | Valeur | Priorité |
|--------------|--------|--------|----------|
| N. Tags | 8-10h | ⭐⭐ | 🔵 Nice-to-have |
| O. Prévisualisation | 12-15h | ⭐ | 🔵 Nice-to-have |
| P. Profils routage | 7-9h | ⭐⭐ | 🔵 Nice-to-have |

**Total effort**: ~27-34h
**Impact**: Fonctionnalités avancées, pas essentielles

---

### Matrice Effort / Valeur

```
Valeur
  ↑
5 │ B ● A
4 │ C ●   D ●
3 │ H,I ●   E,F,J,K ●   G ●
2 │         M ●   L,N,P ●
1 │                 O ●
  └──────────────────────────→ Effort
    1-3h  4-6h  7-10h  12-15h

Légende:
A = Recherche          H = Tri              N = Tags
B = Métadonnées        I = Raccourcis       O = Prévisualisation
C = Renommer           J = Export           P = Profils routage
D = Sélection multiple K = Gestion dossiers
E = Historique         L = Vues alternatives
F = Feedback upload    M = Favoris
G = Dossiers imbriqués
```

---

## 6. Détails techniques

### 6.1 Architecture actuelle (index.html)

**Stockage**:
```javascript
// localStorage['midi_folders']
{
  'FolderName': {
    parent: null,           // ⚠️ Toujours null (pas de hiérarchie)
    files: ['id1', 'id2'],  // Array de string IDs
    open: true              // État UI
  }
}

// localStorage['midi_file_routing']
{
  'fileId': {
    channels: { '0': 'deviceId1', '9': 'deviceId2' },
    configured: true,
    lastModified: timestamp
  }
}
```

**Limitations techniques**:
1. **Incohérence types**: `id` peut être `number` ou `string` (conversions multiples)
2. **Pas de cache métadonnées**: Fetched à chaque chargement
3. **localStorage limité**: ~5-10MB max (peut overflow avec beaucoup de fichiers)
4. **Structure plate**: `parent: null` toujours → pas de support hiérarchie
5. **Pas de résolution conflits**: Opérations simultanées peuvent créer doublons

---

### 6.2 Impacts des améliorations prioritaires

#### A. Recherche (Priorité 1)
**Implémentation suggérée**:
```javascript
// Ajout dans index.html (ligne ~1815)
<div class="search-bar">
  <input
    type="text"
    id="fileSearchInput"
    placeholder="🔍 Rechercher un fichier..."
    autocomplete="off"
  />
  <button id="clearSearchBtn" style="display: none;">×</button>
</div>

// JavaScript
const searchInput = document.getElementById('fileSearchInput');
searchInput.addEventListener('input', (e) => {
  const query = e.target.value.toLowerCase();
  const allFiles = document.querySelectorAll('.file-item');

  let visibleCount = 0;
  allFiles.forEach(file => {
    const filename = file.dataset.filename.toLowerCase();
    const matches = filename.includes(query);

    file.style.display = matches ? 'flex' : 'none';
    if (matches) visibleCount++;
  });

  // Afficher compteur
  document.getElementById('searchCount').textContent =
    `${visibleCount} résultat(s)`;
});
```

**Changements requis**:
- ✅ Ajout `<div>` barre de recherche avant `<ul class="file-list">`
- ✅ Ajout attribut `data-filename` sur chaque `<li class="file-item">`
- ✅ Event listener sur input
- ✅ CSS pour barre de recherche

**Complexité**: Faible
**Risques**: Aucun

---

#### B. Métadonnées (Priorité 1)
**Implémentation suggérée**:

**Backend** - Nouvelle commande API:
```javascript
// src/api/CommandHandler.js
'get_file_metadata': async (data) => {
  const { fileId } = data;
  const file = await this.fileManager.getFile(fileId);
  const midiData = await this.midiParser.parse(file.path);

  return {
    success: true,
    metadata: {
      duration: midiData.duration,        // Secondes
      sizeBytes: file.sizeBytes,
      channelCount: midiData.channelsUsed.length,
      tempo: midiData.tempo,
      format: midiData.format,            // 0, 1, ou 2
      noteCount: midiData.totalNotes,
      programs: midiData.programsUsed     // [0, 1, 9, 48]
    }
  };
}
```

**Frontend** - Affichage enrichi:
```javascript
// Récupération métadonnées lors du rendu
async function renderFileItem(file) {
  const metadata = await api.sendCommand('get_file_metadata', {
    fileId: file.id
  });

  const metaHTML = `
    <div class="file-metadata">
      <span>⏱ ${formatDuration(metadata.duration)}</span>
      <span>💾 ${formatSize(metadata.sizeBytes)}</span>
      <span>🎹 ${metadata.channelCount} canaux</span>
      <span>♩ ${metadata.tempo} BPM</span>
    </div>
  `;

  // Insérer dans file-item
  li.querySelector('.file-info').innerHTML += metaHTML;
}
```

**Optimisation - Cache**:
```javascript
// Cache métadonnées pour éviter requêtes répétées
const metadataCache = new Map();

async function getFileMetadata(fileId) {
  if (metadataCache.has(fileId)) {
    return metadataCache.get(fileId);
  }

  const metadata = await api.sendCommand('get_file_metadata', { fileId });
  metadataCache.set(fileId, metadata);

  return metadata;
}
```

**Changements requis**:
- ✅ Nouvelle commande API backend
- ✅ Parsing MIDI pour extraire métadonnées
- ✅ Modification rendu frontend (fonction `loadFiles()`)
- ✅ CSS pour affichage métadonnées
- ✅ Cache en mémoire

**Complexité**: Moyenne
**Risques**: Performance (si beaucoup de fichiers, fetch séquentiel)
**Solution**: Batch request ou lazy loading

---

#### C. Renommer fichiers (Priorité 1)
**Implémentation suggérée**:

**Backend**:
```javascript
// src/api/CommandHandler.js
'rename_file': async (data) => {
  const { fileId, newName } = data;

  // Validation
  if (!/^[\w\s\-\.]+\.(mid|midi)$/i.test(newName)) {
    throw new Error('Nom invalide');
  }

  const success = await this.fileManager.renameFile(fileId, newName);
  return { success };
}
```

**Frontend**:
```javascript
// Double-clic sur nom fichier ou bouton F2
function showRenameModal(fileId, currentName) {
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.innerHTML = `
    <div class="modal-content">
      <h3>Renommer le fichier</h3>
      <p>Ancien nom: <strong>${currentName}</strong></p>
      <input type="text" id="newNameInput" value="${currentName}" />
      <div class="modal-actions">
        <button id="cancelRenameBtn">Annuler</button>
        <button id="confirmRenameBtn">Renommer</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // Event listeners
  document.getElementById('confirmRenameBtn').onclick = async () => {
    const newName = document.getElementById('newNameInput').value;

    const response = await api.sendCommand('rename_file', {
      fileId,
      newName
    });

    if (response.success) {
      // Rafraîchir liste
      loadFiles();
      modal.remove();
    }
  };
}
```

**Changements requis**:
- ✅ Méthode `renameFile()` dans `FileManager`
- ✅ Commande API `rename_file`
- ✅ Modal frontend renommage
- ✅ Event listener double-clic + F2
- ✅ Validation nom fichier

**Complexité**: Faible
**Risques**: Conflits si nom existe déjà (validation nécessaire)

---

### 6.3 Recommandations d'architecture

#### Pour Phase 1 (Quick Wins):
- ✅ **Modifications incrémentales**: Pas de refonte majeure
- ✅ **Rétro-compatibilité**: Maintenir structure localStorage actuelle
- ✅ **Cache client**: Métadonnées en mémoire pour performance

#### Pour Phase 2 (Workflow):
- ⚠️ **Refonte structure dossiers**: Préparer hiérarchie multi-niveaux
- ⚠️ **Stack historique**: Ajouter système undo/redo
- ✅ **Batch API**: Commandes groupées (delete_files, move_files)

#### Pour Phase 3+ (Avancé):
- 🔄 **Migration vers IndexedDB**: localStorage insuffisant à long terme
- 🔄 **Synchronisation backend**: Métadonnées stockées en DB
- 🔄 **WebWorker**: Parsing MIDI en background pour UI réactive

---

## 7. Conclusion

### État actuel
La page de gestion des fichiers MIDI est **fonctionnelle mais minimaliste**. Elle convient pour:
- ✅ Collections petites/moyennes (<50 fichiers)
- ✅ Utilisateurs occasionnels
- ✅ Workflow simple (upload → routage → lecture)

Elle devient **problématique** pour:
- ❌ Collections importantes (>100 fichiers)
- ❌ Utilisateurs power (multi-projets, organisation complexe)
- ❌ Workflows avancés (édition, versioning, export)

---

### Recommandation finale

**Implémenter en priorité (Phase 1)**:
1. 🔍 **Recherche** - Impact immédiat, effort minimal
2. 📊 **Métadonnées** - Information essentielle, effort raisonnable
3. ✏️ **Renommer** - Feature de base manquante, effort minimal

Ces 3 améliorations transformeront l'expérience utilisateur pour un investissement de ~10-15h.

**Ensuite (Phase 2)**:
- Opérations par lots (sélection multiple)
- Historique/Annulation (sécurité utilisateur)
- Feedback upload (confiance utilisateur)

**Vision long terme**:
- Migration vers IndexedDB pour scalabilité
- API batch pour performance
- Système de tags pour organisation flexible
- Vues multiples pour différents workflows

---

**Total estimé Phase 1**: 10-15h développement
**Impact utilisateur**: ⭐⭐⭐⭐⭐ Très élevé
**ROI**: Excellent (quick wins essentiels)
