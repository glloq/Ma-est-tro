# Vérification de l'Installation et des Mises à Jour

## ✅ Vérification Post-Installation/Update

Ce document permet de vérifier que toutes les nouvelles fonctionnalités sont correctement installées.

---

## 📦 Nouveaux Fichiers Ajoutés

### Documentation

#### 1. `docs/MIDI_FILES_PAGE_IMPROVEMENTS.md`
**Description :** Étude complète des améliorations de l'interface de gestion des fichiers MIDI

**Vérification :**
```bash
ls -lh docs/MIDI_FILES_PAGE_IMPROVEMENTS.md
```

**Contient :**
- Analyse de l'état actuel
- 16 améliorations identifiées (11 implémentées)
- Mockups et exemples de code
- Roadmap par phases

---

#### 2. `docs/DRUMS_NOTE_MAPPING_STUDY.md`
**Description :** Étude complète du mapping intelligent des notes de percussion

**Vérification :**
```bash
ls -lh docs/DRUMS_NOTE_MAPPING_STUDY.md
wc -l docs/DRUMS_NOTE_MAPPING_STUDY.md  # Devrait afficher ~1020 lignes
```

**Contient :**
- Mapping complet GM Drums (notes 35-81)
- Tables de substitution intelligentes
- Stratégies d'adaptation par scénario
- Algorithme de mapping avec priorités
- Métriques de qualité

---

### Code Source Backend

#### 3. `src/midi/DrumNoteMapper.js`
**Description :** Module de mapping intelligent des percussions

**Vérification :**
```bash
ls -lh src/midi/DrumNoteMapper.js
wc -l src/midi/DrumNoteMapper.js  # Devrait afficher ~807 lignes
node -e "const DrumNoteMapper = require('./src/midi/DrumNoteMapper.js'); console.log('✓ DrumNoteMapper loaded successfully');"
```

**Fonctionnalités :**
- Catégorisation complète GM Drums
- Tables de substitution par priorité
- Algorithme de mapping 4 niveaux
- Scoring de qualité (0-100)
- Rapports détaillés

**Classes et Méthodes Principales :**
```javascript
class DrumNoteMapper {
  analyzeInstrumentCapabilities(availableNotes)
  classifyDrumNotes(noteEvents)
  generateMapping(midiNotes, instrumentNotes, options)
  assignEssentialNotes()
  assignImportantNotes()
  assignOptionalNotes()
  assignRemainingNotes()
  calculateMappingQuality()
  getMappingReport()
}
```

---

### Modifications de Fichiers Existants

#### 4. `src/midi/InstrumentMatcher.js`
**Description :** Intégration du DrumNoteMapper pour mode discrete

**Vérification :**
```bash
grep -n "DrumNoteMapper" src/midi/InstrumentMatcher.js
grep -n "scoreDiscreteDrumsIntelligent" src/midi/InstrumentMatcher.js
```

**Modifications :**
- Import de DrumNoteMapper (ligne 5)
- Initialisation dans constructor (ligne 22)
- Nouvelle méthode `scoreDiscreteDrumsIntelligent()` (ligne 429-493)
- Détection automatique canal 9 (drums) (ligne 384-386)
- Passage du channelAnalysis complet (ligne 70, 183)

**Vérification du Code :**
```bash
# Vérifier l'import
grep "const DrumNoteMapper = require" src/midi/InstrumentMatcher.js

# Vérifier l'initialisation
grep "this.drumMapper = new DrumNoteMapper" src/midi/InstrumentMatcher.js

# Vérifier la détection drums
grep "channel === 9" src/midi/InstrumentMatcher.js
```

---

#### 5. `src/midi/ChannelAnalyzer.js`
**Description :** Ajout des noteEvents pour analyse intelligente

**Vérification :**
```bash
grep -n "noteEvents" src/midi/ChannelAnalyzer.js
```

**Modifications :**
- Ajout de `noteEvents` dans le retour de `analyzeChannel()` (ligne 102)
- Permet à DrumNoteMapper d'analyser les notes utilisées

**Vérification du Code :**
```bash
# Ligne devrait contenir : noteEvents // Include note events for intelligent drum mapping
grep "noteEvents.*Include note events" src/midi/ChannelAnalyzer.js
```

---

#### 6. `public/index.html`
**Description :** Améliorations de l'interface utilisateur (Phase 1 + Phase 2 partielles)

**Vérification :**
```bash
wc -l public/index.html  # Devrait afficher ~6500+ lignes
grep -c "search-bar-container" public/index.html  # Devrait retourner > 0
grep -c "batch-actions-bar" public/index.html  # Devrait retourner > 0
grep -c "upload-progress-overlay" public/index.html  # Devrait retourner > 0
```

**Fonctionnalités Ajoutées :**

**Phase 1 (Complète) :**
1. ✅ Barre de recherche avec filtre temps réel
2. ✅ Affichage métadonnées (durée, taille, canaux, tempo)
3. ✅ Renommage de fichiers
4. ✅ Tri multi-critères (nom, date, taille, durée)
5. ✅ Raccourcis clavier (Ctrl+F, F2, Delete, Enter, Space, ↑↓)

**Phase 2 (Partielle - 3/6) :**
6. ✅ Sélection multiple (checkboxes)
7. ✅ Opérations par lots (sélectionner tout, déplacer, supprimer)
8. ✅ Feedback upload amélioré (modal avec progression)
9. ✅ Export fichier modifié (Save As...)
10. ✅ Gestion dossiers améliorée (renommer, supprimer avec contenu, vider, stats)

**Vérification des Fonctionnalités :**
```bash
# Recherche
grep "initFileSearch" public/index.html

# Métadonnées
grep "loadFileMetadata" public/index.html

# Renommage
grep "showRenameModal" public/index.html

# Tri
grep "sortFiles" public/index.html

# Raccourcis clavier
grep "initKeyboardShortcuts" public/index.html

# Multi-sélection
grep "toggleFileSelection" public/index.html

# Upload avec progression
grep "upload-progress-overlay" public/index.html

# Gestion dossiers
grep "showRenameFolderModal" public/index.html
grep "emptyFolder" public/index.html
```

---

## 🔧 Vérification de l'Intégration

### 1. Chaîne de Dépendances

**Vérifier que tous les modules se chargent correctement :**

```bash
# Test de chargement des modules
cd /home/user/Ma-est-tro

# DrumNoteMapper
node -e "const DrumNoteMapper = require('./src/midi/DrumNoteMapper.js'); console.log('✓ DrumNoteMapper OK');"

# InstrumentMatcher (qui charge DrumNoteMapper)
node -e "const InstrumentMatcher = require('./src/midi/InstrumentMatcher.js'); console.log('✓ InstrumentMatcher OK');"

# AutoAssigner (qui charge InstrumentMatcher et ChannelAnalyzer)
node -e "const AutoAssigner = require('./src/midi/AutoAssigner.js'); console.log('✓ AutoAssigner OK');"

# ChannelAnalyzer
node -e "const ChannelAnalyzer = require('./src/midi/ChannelAnalyzer.js'); console.log('✓ ChannelAnalyzer OK');"
```

**Résultat attendu :**
```
✓ DrumNoteMapper OK
✓ InstrumentMatcher OK
✓ AutoAssigner OK
✓ ChannelAnalyzer OK
```

---

### 2. Vérification du Serveur

**Démarrer le serveur et vérifier les logs :**

```bash
# Si systemd
sudo journalctl -u midimind -f

# Si PM2
pm2 logs midimind

# Chercher ces lignes dans les logs au démarrage :
# [INFO] CommandHandler initialized with X commands
# [INFO] AutoAssigner initialized
# [INFO] ChannelAnalyzer ready
# [INFO] InstrumentMatcher ready
# [INFO] DrumNoteMapper ready
```

---

### 3. Test Fonctionnel de l'Auto-Assignment

**Via l'interface web :**

1. Ouvrir `http://localhost:8080`
2. Aller dans l'onglet "Instruments"
3. Scanner les instruments disponibles
4. Configurer un instrument en mode "discrete" (percussion)
5. Définir des notes jouables (ex: 36, 38, 42, 46, 49, 51)
6. Uploader un fichier MIDI avec percussion (canal 10)
7. Ouvrir l'éditeur MIDI
8. Cliquer sur "Auto-Assign Instruments"

**Résultat attendu :**
- Le système détecte automatiquement le canal 9 (drums)
- Utilise DrumNoteMapper pour mapping intelligent
- Affiche un score de qualité (X/100)
- Montre le mapping détaillé (notes → substitutions)
- Préserve les éléments essentiels (kick, snare, hi-hat)

---

### 4. Test de l'Interface Utilisateur

**Fonctionnalités à tester :**

**Recherche :**
1. Ouvrir l'interface
2. Uploader plusieurs fichiers MIDI
3. Utiliser la barre de recherche
4. Appuyer sur Ctrl+F → le curseur devrait se placer dans la recherche
5. Taper un nom de fichier → filtrage en temps réel

**Métadonnées :**
1. Vérifier que chaque fichier affiche :
   - ⏱ Durée (ex: 2:34)
   - 💾 Taille (ex: 15 KB)
   - 🎹 Canaux (ex: 3 canaux)
   - ♩ Tempo (ex: 120 BPM)

**Renommage :**
1. Double-cliquer sur un fichier
2. Modifier le nom
3. Valider → le fichier est renommé

**Tri :**
1. Sélectionner différents critères de tri
2. Cliquer sur le bouton ↓/↑ pour inverser l'ordre

**Raccourcis Clavier :**
1. Sélectionner un fichier avec les flèches ↑↓
2. F2 → ouvre le renommage
3. Delete → supprime (avec confirmation)
4. Enter → ouvre l'éditeur
5. Space → joue le fichier

**Multi-sélection :**
1. Cocher plusieurs fichiers
2. Barre d'actions apparaît en haut
3. "Tout sélectionner" → sélectionne tous
4. "Supprimer" → supprime tous les fichiers cochés

**Upload avec Progression :**
1. Sélectionner plusieurs fichiers MIDI
2. Modal de progression s'affiche
3. Chaque fichier montre son statut (⏳ → ✓ ou ✗)
4. Barre de progression globale

**Gestion Dossiers :**
1. Créer un dossier
2. Déplacer des fichiers dedans
3. Cliquer sur ✏️ → renommer le dossier
4. Cliquer sur 🗑️📄 → vider le dossier (supprime fichiers)
5. Cliquer sur 🗑️ → supprimer le dossier (avec ou sans contenu)
6. Voir les stats (📄 X fichiers, 💾 X KB)

---

## 📊 Métriques de Vérification

### Fichiers Critiques

```bash
# Tous ces fichiers doivent exister
files=(
  "docs/MIDI_FILES_PAGE_IMPROVEMENTS.md"
  "docs/DRUMS_NOTE_MAPPING_STUDY.md"
  "src/midi/DrumNoteMapper.js"
  "src/midi/InstrumentMatcher.js"
  "src/midi/ChannelAnalyzer.js"
  "src/midi/AutoAssigner.js"
  "public/index.html"
)

echo "Vérification des fichiers critiques..."
for file in "${files[@]}"; do
  if [ -f "$file" ]; then
    echo "✓ $file"
  else
    echo "✗ $file MANQUANT !"
  fi
done
```

---

### Taille des Fichiers

```bash
# Vérifier que les fichiers ont la taille attendue
ls -lh docs/DRUMS_NOTE_MAPPING_STUDY.md  # ~60-70 KB
ls -lh src/midi/DrumNoteMapper.js        # ~25-30 KB
ls -lh public/index.html                 # ~250-300 KB
```

---

### Lignes de Code Ajoutées

```bash
# Documentation
wc -l docs/DRUMS_NOTE_MAPPING_STUDY.md      # ~1020 lignes
wc -l docs/MIDI_FILES_PAGE_IMPROVEMENTS.md  # ~1030 lignes

# Code
wc -l src/midi/DrumNoteMapper.js            # ~807 lignes

# Total nouvelles lignes
echo "Total nouvelles lignes documentation : ~2050"
echo "Total nouvelles lignes code : ~900"
echo "Total modifications UI : ~500 lignes"
```

---

## 🚀 Script de Vérification Automatique

**Créer et exécuter ce script de vérification :**

```bash
#!/bin/bash

echo "╔══════════════════════════════════════════════════════════╗"
echo "║  Vérification Installation MidiMind 5.0                  ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

# Couleurs
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

all_ok=true

# Vérifier fichiers
echo "1. Vérification des fichiers..."
files=(
  "docs/DRUMS_NOTE_MAPPING_STUDY.md"
  "docs/MIDI_FILES_PAGE_IMPROVEMENTS.md"
  "src/midi/DrumNoteMapper.js"
)

for file in "${files[@]}"; do
  if [ -f "$file" ]; then
    echo -e "${GREEN}✓${NC} $file"
  else
    echo -e "${RED}✗${NC} $file MANQUANT"
    all_ok=false
  fi
done

# Vérifier modules Node.js
echo ""
echo "2. Vérification des modules..."
if node -e "require('./src/midi/DrumNoteMapper.js')" 2>/dev/null; then
  echo -e "${GREEN}✓${NC} DrumNoteMapper charge correctement"
else
  echo -e "${RED}✗${NC} DrumNoteMapper erreur de chargement"
  all_ok=false
fi

if node -e "require('./src/midi/InstrumentMatcher.js')" 2>/dev/null; then
  echo -e "${GREEN}✓${NC} InstrumentMatcher charge correctement"
else
  echo -e "${RED}✗${NC} InstrumentMatcher erreur de chargement"
  all_ok=false
fi

# Vérifier modifications
echo ""
echo "3. Vérification des modifications..."
if grep -q "DrumNoteMapper" src/midi/InstrumentMatcher.js; then
  echo -e "${GREEN}✓${NC} DrumNoteMapper intégré dans InstrumentMatcher"
else
  echo -e "${RED}✗${NC} DrumNoteMapper NON intégré"
  all_ok=false
fi

if grep -q "noteEvents" src/midi/ChannelAnalyzer.js; then
  echo -e "${GREEN}✓${NC} noteEvents ajouté à ChannelAnalyzer"
else
  echo -e "${RED}✗${NC} noteEvents NON ajouté"
  all_ok=false
fi

# Vérifier UI
echo ""
echo "4. Vérification de l'interface..."
if grep -q "initFileSearch" public/index.html; then
  echo -e "${GREEN}✓${NC} Recherche implémentée"
else
  echo -e "${RED}✗${NC} Recherche NON implémentée"
  all_ok=false
fi

if grep -q "batch-actions-bar" public/index.html; then
  echo -e "${GREEN}✓${NC} Multi-sélection implémentée"
else
  echo -e "${RED}✗${NC} Multi-sélection NON implémentée"
  all_ok=false
fi

# Résultat final
echo ""
echo "══════════════════════════════════════════════════════════"
if [ "$all_ok" = true ]; then
  echo -e "${GREEN}✓ Toutes les vérifications RÉUSSIES${NC}"
  exit 0
else
  echo -e "${RED}✗ Certaines vérifications ONT ÉCHOUÉ${NC}"
  exit 1
fi
```

**Sauvegarder dans :** `scripts/verify-installation.sh`

**Exécuter :**
```bash
chmod +x scripts/verify-installation.sh
./scripts/verify-installation.sh
```

---

## ✅ Checklist de Vérification Complète

### Installation Initiale

- [ ] Node.js 18+ installé
- [ ] Dépendances npm installées
- [ ] Base de données migrée
- [ ] Serveur démarre sans erreur
- [ ] Interface accessible sur http://localhost:8080

### Nouveaux Fichiers

- [ ] `docs/DRUMS_NOTE_MAPPING_STUDY.md` existe
- [ ] `docs/MIDI_FILES_PAGE_IMPROVEMENTS.md` existe
- [ ] `src/midi/DrumNoteMapper.js` existe et se charge
- [ ] `src/midi/InstrumentMatcher.js` modifié correctement
- [ ] `src/midi/ChannelAnalyzer.js` modifié correctement

### Fonctionnalités Backend

- [ ] DrumNoteMapper se charge sans erreur
- [ ] InstrumentMatcher intègre DrumNoteMapper
- [ ] Auto-assignment détecte canal 9 (drums)
- [ ] Mapping intelligent génère rapport de qualité
- [ ] Substitutions intelligentes fonctionnent

### Fonctionnalités Frontend

- [ ] Barre de recherche fonctionne
- [ ] Métadonnées affichées (durée, taille, canaux, tempo)
- [ ] Renommage fichiers fonctionne
- [ ] Tri multi-critères fonctionne
- [ ] Raccourcis clavier fonctionnent
- [ ] Multi-sélection fonctionne
- [ ] Opérations par lots fonctionnent
- [ ] Upload avec progression fonctionne
- [ ] Export "Save As" fonctionne
- [ ] Gestion dossiers améliorée fonctionne

---

## 🐛 Dépannage

### DrumNoteMapper ne se charge pas

**Erreur :** `Cannot find module './DrumNoteMapper'`

**Solution :**
```bash
# Vérifier que le fichier existe
ls -l src/midi/DrumNoteMapper.js

# Vérifier les permissions
chmod 644 src/midi/DrumNoteMapper.js

# Réinstaller les dépendances
npm install
```

---

### Auto-assignment ne détecte pas les drums

**Problème :** Le mapping intelligent n'est pas utilisé

**Vérification :**
1. Ouvrir les logs serveur
2. Chercher `[DrumMapping]` dans les logs
3. Vérifier que le canal est bien le 9 (canal 10 en MIDI)

**Solution :**
- Le fichier MIDI doit avoir des notes sur le canal 9 (0-indexed)
- L'instrument doit être en mode "discrete"
- Vérifier que `noteEvents` est bien dans `ChannelAnalyzer`

---

### Interface UI ne s'affiche pas correctement

**Problème :** Recherche, métadonnées ou autres fonctions manquantes

**Solution :**
```bash
# Vider le cache du navigateur (Ctrl+Shift+R)
# Ou forcer le rechargement :
curl http://localhost:8080 > /dev/null

# Vérifier les erreurs JavaScript dans la console du navigateur (F12)
```

---

## 📞 Support

Si après toutes ces vérifications, des problèmes persistent :

1. Vérifier les logs : `sudo journalctl -u midimind -n 100`
2. Vérifier PM2 : `pm2 logs midimind`
3. Consulter la documentation : `README.md`, `QUICK_START.md`
4. Ouvrir une issue sur GitHub avec :
   - Sortie du script de vérification
   - Logs du serveur
   - Version de Node.js (`node --version`)
   - Système d'exploitation

---

**Document créé :** 2026-01-22
**Version :** 1.0
**Auteur :** MidiMind Team
