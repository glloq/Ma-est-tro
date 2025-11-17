# Axes d'amélioration de l'éditeur MIDI

## État actuel

L'éditeur actuel utilise `webaudio-pianoroll` (by g200kg), un piano roll basé sur Canvas avec:
- ✅ Édition de notes multi-canaux (16 canaux)
- ✅ Support tactile basique (touch events)
- ✅ Modes d'édition (drag/grid, poly/mono)
- ✅ Zoom horizontal et vertical
- ✅ Snap to grid
- ⚠️ Support mobile limité
- ⚠️ Pas de gestes tactiles avancés
- ⚠️ Interface non optimisée pour écrans tactiles

---

## 🎯 Axes d'amélioration prioritaires

### 1. 📱 **Interface tactile complète**

#### 1.1 Gestes multi-touch
**État actuel**: Touch basique avec single-touch uniquement
**Améliorations nécessaires**:

- [ ] **Pinch-to-zoom** (2 doigts)
  - Zoom horizontal et vertical simultané
  - Centre du zoom = centre du pinch
  - Limites min/max pour éviter zoom excessif

- [ ] **Pan avec 2 doigts**
  - Déplacement dans le piano roll
  - Distinction entre pan et zoom
  - Inertie pour fluidité

- [ ] **Tap & Hold** (pression longue améliorée)
  - Menu contextuel tactile
  - Feedback visuel (ripple effect)
  - Durée configurable (300-500ms)

- [ ] **Double-tap**
  - Centrer sur la sélection
  - Zoom intelligent sur zone

- [ ] **Swipe**
  - Swipe horizontal: navigation temporelle rapide
  - Swipe vertical: changer de canal actif

**Fichiers concernés**:
- `public/lib/webaudio-pianoroll-custom.js:138,658,752-755` (touch events)
- `public/js/views/components/MidiEditorModal.js` (wrapper)

**Technologies recommandées**:
```javascript
// Hammer.js pour gestes avancés
import Hammer from 'hammerjs';
const hammer = new Hammer(canvas);
hammer.get('pinch').set({ enable: true });
hammer.get('rotate').set({ enable: false });

// Ou natives avec Pointer Events
canvas.addEventListener('pointerdown', handleMultiTouch);
canvas.addEventListener('pointermove', handleMultiTouch);
canvas.addEventListener('pointerup', handleMultiTouch);
```

---

#### 1.2 Contrôles tactiles optimisés

**Problème actuel**: Boutons trop petits pour touch (min 36px sur mobile)

- [ ] **Taille des zones tactiles**
  - Minimum 44x44px (Apple HIG)
  - Espacement 8px minimum entre boutons
  - Hit area élargie (padding invisible)

- [ ] **Toolbar responsive**
  - Mode desktop: labels + icônes
  - Mode tablette: icônes + tooltips
  - Mode mobile: icônes compacts + menu hamburger

- [ ] **Notes plus faciles à manipuler**
  - Handles de resize plus larges (20px min)
  - Zone de grab augmentée
  - Feedback visuel au toucher (highlight)

- [ ] **Clavier virtuel tactile**
  - Piano overlay pour jouer les notes
  - Preview audio en temps réel
  - Velocity sensible à la vitesse de tap

**Exemple UI mobile**:
```
┌─────────────────────────┐
│ ☰  Title        [✓][✕] │ <- Header fixe
├─────────────────────────┤
│ [Ch1][Ch2][Ch3]... ⋮    │ <- Channels scrollables
├─────────────────────────┤
│                         │
│   Piano Roll Canvas     │ <- Zone tactile principale
│   (gestures enabled)    │
│                         │
├─────────────────────────┤
│ [−] Zoom [+] | Play [⏸] │ <- Footer fixe
└─────────────────────────┘
```

**Fichiers à modifier**:
- `public/styles/editor.css` (responsive)
- `public/js/views/components/MidiEditorModal.js` (UI adaptative)

---

#### 1.3 Orientation et responsive

- [ ] **Support portrait et paysage**
  - Paysage: layout classique (piano + roll)
  - Portrait: piano au-dessus ou caché
  - Auto-rotation sans perte de contexte

- [ ] **Breakpoints**
  ```css
  /* Mobile portrait */
  @media (max-width: 480px) and (orientation: portrait)

  /* Mobile paysage / Tablette portrait */
  @media (min-width: 481px) and (max-width: 768px)

  /* Tablette paysage */
  @media (min-width: 769px) and (max-width: 1024px)

  /* Desktop */
  @media (min-width: 1025px)
  ```

- [ ] **Virtual keyboard iOS/Android**
  - Éviter que le clavier ne cache l'éditeur
  - Resize automatique du canvas
  - scroll-into-view intelligent

---

### 2. ✨ **Fonctionnalités d'édition avancées**

#### 2.1 Undo/Redo (CRITIQUE)
**État actuel**: ❌ Aucun historique d'édition

- [ ] **Stack d'historique**
  - Utiliser Command Pattern
  - Limite: 50-100 actions
  - Stockage en mémoire (state snapshots)

- [ ] **Actions trackées**:
  - Add note
  - Delete note(s)
  - Move note(s)
  - Resize note(s)
  - Change velocity
  - Paste

- [ ] **UI Controls**
  - Boutons Undo/Redo dans toolbar
  - Raccourcis: Ctrl+Z / Ctrl+Y
  - Touch: boutons tactiles dédiés
  - État disabled quand stack vide

**Implémentation suggérée**:
```javascript
class CommandHistory {
  constructor() {
    this.undoStack = [];
    this.redoStack = [];
    this.maxSize = 100;
  }

  execute(command) {
    command.execute();
    this.undoStack.push(command);
    this.redoStack = []; // Clear redo on new action
    if (this.undoStack.length > this.maxSize) {
      this.undoStack.shift();
    }
  }

  undo() {
    const cmd = this.undoStack.pop();
    if (cmd) {
      cmd.undo();
      this.redoStack.push(cmd);
    }
  }

  redo() {
    const cmd = this.redoStack.pop();
    if (cmd) {
      cmd.execute();
      this.undoStack.push(cmd);
    }
  }
}

class AddNoteCommand {
  constructor(pianoRoll, note) {
    this.pianoRoll = pianoRoll;
    this.note = note;
  }
  execute() { this.pianoRoll.addNote(this.note); }
  undo() { this.pianoRoll.removeNote(this.note); }
}
```

**Fichiers concernés**:
- `public/js/views/components/MidiEditorModal.js` (integration)
- Nouveau fichier: `public/js/utils/CommandHistory.js`

---

#### 2.2 Édition de vélocité

**État actuel**: Vélocité par défaut (100), pas d'édition visuelle

- [ ] **Vélocité par note**
  - Éditeur de vélocité sous le piano roll
  - Barres verticales colorées par intensité
  - Édition au clic/drag

- [ ] **Édition en batch**
  - Sélection multiple + vélocité uniforme
  - Rampe de vélocité (crescendo/diminuendo)
  - Randomisation (humanisation)

- [ ] **Visualisation**
  - Opacité des notes proportionnelle à la vélocité
  - Ou hauteur des rectangles
  - Scale: 0-127 → visual feedback

**UI Design**:
```
┌────────────────────────────┐
│   Piano Roll (Notes)       │
│   [====] [====] [====]     │
│                            │
├────────────────────────────┤
│   Velocity Editor          │
│   |█  |▓  |░  |█  |▓       │ <- Barres éditables
│   0  32  64  96 127        │
└────────────────────────────┘
```

**Fichiers**:
- `public/styles/editor-phase2.css` (déjà créé, à activer)
- `public/lib/webaudio-pianoroll-custom.js` (ajouter velocity display)

---

#### 2.3 Automation CC (Control Change)

**État actuel**: CC non géré dans l'éditeur

- [ ] **Éditeur d'automation**
  - Lanes pour CC (volume, pan, modulation, etc.)
  - Courbes de Bézier ou points linéaires
  - Snap to grid optionnel

- [ ] **CC supportés**:
  - CC#1: Modulation
  - CC#7: Volume
  - CC#10: Pan
  - CC#11: Expression
  - CC#64: Sustain (on/off)
  - Pitchbend

- [ ] **UI Multi-lanes**
  - Toggle pour afficher/cacher CC lanes
  - Plusieurs CC visibles simultanément
  - Couleurs différentes par CC

**Stockage**:
```javascript
// Étendre la séquence avec CC events
{
  notes: [
    {t: 0, g: 480, n: 60, c: 0, v: 100}
  ],
  cc: [
    {t: 0, c: 0, cc: 7, value: 127},    // Volume max
    {t: 480, c: 0, cc: 7, value: 64}    // Volume moyen
  ]
}
```

---

#### 2.4 Copier/Coller avancé

**État actuel**: Pas de clipboard

- [ ] **Copy/Paste**
  - Copier sélection dans clipboard
  - Coller à la position du curseur
  - Ctrl+C / Ctrl+V (desktop)
  - Boutons tactiles (mobile)

- [ ] **Paste spécial**
  - Paste avec décalage de pitch
  - Paste sur canal différent
  - Paste avec multiplication temporelle

- [ ] **Duplication rapide**
  - Drag + Alt pour dupliquer
  - Repeat last (Ctrl+D)

---

#### 2.5 Quantification

**État actuel**: Snap to grid uniquement

- [ ] **Quantize**
  - Quantize start time (1/4, 1/8, 1/16, 1/32)
  - Quantize end time (longueur)
  - Strength: 0-100% (humanisation partielle)

- [ ] **Swing/Groove**
  - Templates de groove prédéfinis
  - Shuffle (swing)
  - Custom groove patterns

**UI**:
```
┌─ Quantize ─────────────┐
│ Resolution: [1/16▼]    │
│ Strength:  [||||||||] 80% │
│ □ Start  ☑ End         │
│ Groove: [None▼]        │
│ [Apply] [Cancel]       │
└────────────────────────┘
```

---

#### 2.6 Sélection avancée

- [ ] **Modes de sélection**
  - Rectangle (actuel)
  - Lasso (forme libre)
  - Magic wand (notes similaires)
  - Par canal
  - Par range de pitch

- [ ] **Transformations**
  - Transpose (+/- semitones)
  - Stretch/Shrink temporel
  - Invert (pitch inversion)
  - Reverse (ordre inversé)

---

### 3. ♿ **Accessibilité**

#### 3.1 Vision

- [ ] **Daltonisme**
  - Schémas de couleurs alternatifs
  - Motifs/textures en plus des couleurs
  - Mode high contrast

- [ ] **Malvoyance**
  - Zoom jusqu'à 400%
  - Polices ajustables
  - ARIA labels sur tous les contrôles

#### 3.2 Motricité

- [ ] **Navigation clavier complète**
  - Tab entre contrôles
  - Flèches pour navigation dans roll
  - Space pour play/pause
  - Raccourcis configurables

- [ ] **Sticky keys**
  - Pas besoin de maintenir Shift/Ctrl

#### 3.3 Standards

- [ ] **WCAG 2.1 Level AA**
  - Contraste 4.5:1 minimum
  - Taille de touche 44x44px
  - Focus visible
  - Pas de timeout forcé

---

### 4. ⚡ **Performance**

#### 4.1 Optimisation Canvas

**Problème**: Redraw complet à chaque frame

- [ ] **Dirty rectangles**
  - Redessiner uniquement zones modifiées
  - Layer caching (piano keys, grid, notes)

- [ ] **Virtualization**
  - Render uniquement notes visibles
  - Culling des éléments hors viewport

- [ ] **Web Workers**
  - Calculs MIDI dans worker
  - Quantization dans worker
  - Pas de freeze de l'UI

#### 4.2 Gestion mémoire

- [ ] **Lazy loading**
  - Charger tracks à la demande
  - Décharger canaux masqués

- [ ] **Limites**
  - Max notes par fichier: warning si >10000
  - Pagination pour gros fichiers

---

### 5. 🎨 **UX/UI améliorations**

#### 5.1 Feedback visuel

- [ ] **Preview audio**
  - Jouer note au clic (ghost note)
  - Volume preview pour vélocité

- [ ] **Curseur temps réel**
  - Position de playback dans l'éditeur
  - Auto-scroll pendant lecture

- [ ] **Animations**
  - Transitions fluides (60fps)
  - Micro-interactions (hover, click)
  - Loading states

#### 5.2 Workflow

- [ ] **Templates**
  - Patterns prédéfinis (drum beats, arpeggios)
  - User-saved patterns

- [ ] **Layers**
  - Grouper canaux en layers
  - Solo/Mute par layer

- [ ] **Markers**
  - Sections (Intro, Verse, Chorus)
  - Loop regions multiples
  - Couleurs de régions

#### 5.3 Outils créatifs

- [ ] **Step sequencer**
  - Vue alternative (grille de steps)
  - Parfait pour drums

- [ ] **Chord builder**
  - Insérer accords prédéfinis
  - Transposer accords

- [ ] **Scale assistant**
  - Highlight notes dans la gamme
  - Snap to scale

---

## 📊 Priorisation

### Phase 1: Fondations tactiles (2-3 semaines)
**Priorité: HAUTE**
- [x] Touch events basiques (déjà fait)
- [ ] Pinch-to-zoom
- [ ] Pan 2 doigts
- [ ] Toolbar responsive
- [ ] Tailles tactiles (44x44px)
- [ ] Tests sur iOS/Android

### Phase 2: Édition essentielle (2-3 semaines)
**Priorité: HAUTE**
- [ ] Undo/Redo (CRITIQUE)
- [ ] Copy/Paste
- [ ] Quantize basique
- [ ] Vélocité édition
- [ ] Sélection améliorée

### Phase 3: Fonctionnalités avancées (3-4 semaines)
**Priorité: MOYENNE**
- [ ] CC automation
- [ ] Clavier virtuel tactile
- [ ] Templates/Patterns
- [ ] Snap to scale
- [ ] Performance optimisations

### Phase 4: Polish & Accessibilité (2 semaines)
**Priorité: MOYENNE**
- [ ] WCAG 2.1 compliance
- [ ] Thèmes de couleurs
- [ ] Navigation clavier
- [ ] Animations polish
- [ ] Documentation

---

## 🛠️ Stack technique recommandée

### Bibliothèques à considérer

#### Gestes tactiles
```json
{
  "hammerjs": "^2.0.8",           // Gestes multi-touch
  "pointer-tracker": "^2.1.0"     // Alternative légère
}
```

#### Optimisation Canvas
```json
{
  "offscreen-canvas": "polyfill", // Workers rendering
  "pixi.js": "^7.x"               // Alternative: WebGL renderer
}
```

#### Undo/Redo
```json
{
  "immer": "^10.x",               // Immutable state
  "zustand": "^4.x"               // State + history
}
```

#### Accessibilité
```json
{
  "@reach/dialog": "^0.18.0",    // Modals accessibles
  "focus-trap-react": "^10.x"    // Focus management
}
```

---

## 📱 Tests nécessaires

### Devices
- [ ] iPhone (Safari)
- [ ] iPad (Safari + Chrome)
- [ ] Android phone (Chrome + Firefox)
- [ ] Android tablet
- [ ] Surface (touch + stylus)

### Scénarios
- [ ] Édition avec doigts uniquement
- [ ] Édition avec stylet
- [ ] Rotation device (portrait ↔ paysage)
- [ ] Multi-utilisateur (collaborative?)
- [ ] Offline mode (PWA?)

---

## 🚀 Migration path

### Option A: Évolution progressive
**Avantages**:
- Pas de breaking changes
- Tests continus
- ROI rapide

**Inconvénients**:
- Limité par architecture actuelle
- Dette technique accumulée

### Option B: Refonte complète
**Avantages**:
- Architecture moderne (React + Canvas ou WebGL)
- Performances optimales
- Maintenance facilitée

**Inconvénients**:
- Temps de développement long (2-3 mois)
- Risque de régression
- Formation utilisateurs

### ✅ Recommandation: **Option A avec modules**
- Garder `webaudio-pianoroll` comme base
- Ajouter wrapper React/Vue pour UI
- Modules indépendants (UndoManager, TouchHandler, etc.)
- Migration progressive vers architecture moderne

---

## 📖 Références

### Standards
- [Apple Human Interface Guidelines - Touch](https://developer.apple.com/design/human-interface-guidelines/touch)
- [Material Design - Touch](https://m3.material.io/foundations/interaction/gestures)
- [WCAG 2.1](https://www.w3.org/WAI/WCAG21/quickref/)

### Bibliothèques
- [Hammer.js](https://hammerjs.github.io/)
- [Tone.js](https://tonejs.github.io/) (audio preview)
- [Pixi.js](https://pixijs.com/) (WebGL rendering)

### Inspiration
- [Ableton Live](https://www.ableton.com/) - MIDI editor reference
- [FL Studio Mobile](https://www.image-line.com/fl-studio-mobile/) - Touch UI
- [Cubasis](https://www.steinberg.net/cubasis/) - iPad DAW
- [Bandlab](https://www.bandlab.com/) - Web-based avec touch

---

## 📝 Prochaines étapes

1. **Valider la priorisation** avec l'équipe/users
2. **Prototyper** les gestes tactiles (2-3 jours)
3. **Implémenter** Undo/Redo (critique)
4. **Tests utilisateurs** sur tablette
5. **Itérer** basé sur feedback

---

**Document créé**: 2025-11-17
**Version**: 1.0
**Auteur**: Claude
**Statut**: Proposition - À valider
