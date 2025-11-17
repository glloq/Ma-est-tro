# Plan d'implémentation - Améliorations éditeur

## 🎯 Phase 1: Interface tactile complète (Sprint 1-2)

### 1.1 Gestes multi-touch avec Hammer.js

#### Installation
```bash
npm install hammerjs --save
# ou via CDN pour vanilla JS
<script src="https://cdn.jsdelivr.net/npm/hammerjs@2.0.8/hammer.min.js"></script>
```

#### Fichiers à créer/modifier

**Nouveau fichier: `public/js/utils/TouchGestureHandler.js`**
```javascript
/**
 * Gère les gestes tactiles avancés pour le piano roll
 * Utilise Hammer.js pour pinch, pan, tap, press
 */
class TouchGestureHandler {
  constructor(canvasElement, pianoRoll) {
    this.canvas = canvasElement;
    this.pianoRoll = pianoRoll;
    this.hammer = null;
    this.initialZoom = { x: 1, y: 1 };
    this.lastPinchScale = 1;

    this.init();
  }

  init() {
    // Créer instance Hammer
    this.hammer = new Hammer.Manager(this.canvas, {
      touchAction: 'none',
      recognizers: [
        // Pinch pour zoom
        [Hammer.Pinch, { enable: true }],

        // Pan avec 2 doigts
        [Hammer.Pan, {
          direction: Hammer.DIRECTION_ALL,
          threshold: 10,
          pointers: 2
        }],

        // Tap simple
        [Hammer.Tap, { taps: 1 }],

        // Double tap
        [Hammer.Tap, { event: 'doubletap', taps: 2 }],

        // Press (long press)
        [Hammer.Press, { time: 500 }]
      ]
    });

    // Configurer les events
    this.setupEventListeners();
  }

  setupEventListeners() {
    // PINCH TO ZOOM
    this.hammer.on('pinchstart', (ev) => {
      this.initialZoom = {
        x: this.pianoRoll.xZoom,
        y: this.pianoRoll.yZoom
      };
      this.lastPinchScale = 1;
    });

    this.hammer.on('pinchmove', (ev) => {
      const scale = ev.scale;
      const delta = scale - this.lastPinchScale;
      this.lastPinchScale = scale;

      // Zoom centré sur le point de pinch
      const rect = this.canvas.getBoundingClientRect();
      const centerX = ev.center.x - rect.left;
      const centerY = ev.center.y - rect.top;

      this.pianoRoll.zoomAt(centerX, centerY, delta);
    });

    this.hammer.on('pinchend', (ev) => {
      this.lastPinchScale = 1;
    });

    // PAN AVEC 2 DOIGTS
    this.hammer.on('panstart', (ev) => {
      if (ev.pointers.length === 2) {
        this.pianoRoll.startPan();
      }
    });

    this.hammer.on('panmove', (ev) => {
      if (ev.pointers.length === 2) {
        this.pianoRoll.pan(ev.deltaX, ev.deltaY);
      }
    });

    this.hammer.on('panend', (ev) => {
      this.pianoRoll.endPan();
    });

    // DOUBLE TAP - Zoom sur sélection
    this.hammer.on('doubletap', (ev) => {
      const rect = this.canvas.getBoundingClientRect();
      const x = ev.center.x - rect.left;
      const y = ev.center.y - rect.top;

      this.pianoRoll.zoomToFit(x, y);
    });

    // LONG PRESS - Menu contextuel
    this.hammer.on('press', (ev) => {
      const rect = this.canvas.getBoundingClientRect();
      const x = ev.center.x - rect.left;
      const y = ev.center.y - rect.top;

      this.pianoRoll.showContextMenu(x, y);

      // Vibration feedback (si supporté)
      if (navigator.vibrate) {
        navigator.vibrate(50);
      }
    });
  }

  destroy() {
    if (this.hammer) {
      this.hammer.destroy();
      this.hammer = null;
    }
  }
}

export default TouchGestureHandler;
```

**Modifier: `public/lib/webaudio-pianoroll-custom.js`**

Ajouter les méthodes:
```javascript
// Ligne ~1200 (après les méthodes existantes)

zoomAt(x, y, delta) {
  const oldZoomX = this.xZoom;
  const oldZoomY = this.yZoom;

  // Calculer nouveau zoom (limites: 0.1x à 10x)
  this.xZoom = Math.max(0.1, Math.min(10, oldZoomX * (1 + delta * 0.5)));
  this.yZoom = Math.max(0.1, Math.min(10, oldZoomY * (1 + delta * 0.5)));

  // Ajuster scroll pour garder le point (x,y) fixe
  const zoomRatioX = this.xZoom / oldZoomX;
  const zoomRatioY = this.yZoom / oldZoomY;

  this.scrollX = (this.scrollX + x) * zoomRatioX - x;
  this.scrollY = (this.scrollY + y) * zoomRatioY - y;

  this.redraw();
}

startPan() {
  this.isPanning = true;
  this.panStartX = this.scrollX;
  this.panStartY = this.scrollY;
}

pan(deltaX, deltaY) {
  if (!this.isPanning) return;

  this.scrollX = this.panStartX - deltaX;
  this.scrollY = this.panStartY - deltaY;

  // Limiter le scroll aux boundaries
  this.clampScroll();
  this.redraw();
}

endPan() {
  this.isPanning = false;
}

zoomToFit(centerX, centerY) {
  // Si notes sélectionnées, zoom dessus
  if (this.selectedNotes.length > 0) {
    const bounds = this.getSelectionBounds();
    this.fitToBounds(bounds);
  } else {
    // Sinon, toggle zoom
    if (this.xZoom > 1.5) {
      this.xZoom = 1;
      this.yZoom = 1;
    } else {
      this.xZoom = 2;
      this.yZoom = 2;
    }
    this.redraw();
  }
}

getSelectionBounds() {
  let minT = Infinity, maxT = -Infinity;
  let minN = Infinity, maxN = -Infinity;

  for (const note of this.selectedNotes) {
    minT = Math.min(minT, note.t);
    maxT = Math.max(maxT, note.t + note.g);
    minN = Math.min(minN, note.n);
    maxN = Math.max(maxN, note.n);
  }

  return { minT, maxT, minN, maxN };
}

fitToBounds(bounds) {
  // Calculer zoom pour fit
  const canvasWidth = this.canvas.width - this.pianoWidth;
  const canvasHeight = this.canvas.height - this.rulerHeight;

  const timeRange = bounds.maxT - bounds.minT;
  const noteRange = bounds.maxN - bounds.minN + 2; // Padding

  this.xZoom = canvasWidth / (timeRange * this.timeScale);
  this.yZoom = canvasHeight / (noteRange * this.noteHeight);

  // Centrer
  this.scrollX = bounds.minT * this.timeScale;
  this.scrollY = (127 - bounds.maxN - 1) * this.noteHeight;

  this.redraw();
}

showContextMenu(x, y) {
  const noteUnderCursor = this.findNoteAt(x, y);

  // Créer menu contextuel
  const menu = document.createElement('div');
  menu.className = 'piano-roll-context-menu';
  menu.style.position = 'fixed';
  menu.style.left = x + 'px';
  menu.style.top = y + 'px';

  if (noteUnderCursor) {
    menu.innerHTML = `
      <div class="menu-item" data-action="delete">Supprimer</div>
      <div class="menu-item" data-action="duplicate">Dupliquer</div>
      <div class="menu-item" data-action="velocity">Éditer vélocité</div>
    `;
  } else {
    menu.innerHTML = `
      <div class="menu-item" data-action="paste">Coller</div>
      <div class="menu-item" data-action="selectAll">Tout sélectionner</div>
    `;
  }

  // Event listeners
  menu.addEventListener('click', (e) => {
    const action = e.target.dataset.action;
    this.handleContextMenuAction(action, noteUnderCursor);
    menu.remove();
  });

  document.body.appendChild(menu);

  // Fermer au clic ailleurs
  setTimeout(() => {
    const closeMenu = (e) => {
      if (!menu.contains(e.target)) {
        menu.remove();
        document.removeEventListener('click', closeMenu);
      }
    };
    document.addEventListener('click', closeMenu);
  }, 100);
}
```

**Modifier: `public/js/views/components/MidiEditorModal.js`**

Intégrer le TouchGestureHandler:
```javascript
// Ligne ~50, après l'initialisation du piano roll
import TouchGestureHandler from '../../utils/TouchGestureHandler.js';

// Dans la méthode show(), après pianoRoll.setSequence()
this.touchHandler = new TouchGestureHandler(
  this.pianoRoll.canvas,
  this.pianoRoll
);

// Dans cleanup/close
if (this.touchHandler) {
  this.touchHandler.destroy();
  this.touchHandler = null;
}
```

---

### 1.2 Responsive UI pour tactile

**Modifier: `public/styles/editor.css`**

```css
/* ========================================
   RESPONSIVE TOUCH OPTIMIZATIONS
   ======================================== */

/* Tailles minimales tactiles (44x44px) */
.tool-btn,
.channel-btn,
.zoom-btn {
  min-width: 44px;
  min-height: 44px;

  /* Hit area élargie */
  position: relative;
}

.tool-btn::before,
.channel-btn::before {
  content: '';
  position: absolute;
  top: -8px;
  right: -8px;
  bottom: -8px;
  left: -8px;
}

/* Feedback tactile */
.tool-btn:active,
.channel-btn:active {
  transform: scale(0.95);
  transition: transform 0.1s ease;
}

/* Mobile portrait */
@media (max-width: 480px) and (orientation: portrait) {
  .midi-editor-modal {
    width: 100vw !important;
    height: 100vh !important;
    margin: 0 !important;
    border-radius: 0 !important;
  }

  .editor-header {
    padding: 12px 16px;
    height: 56px;
  }

  .channels-toolbar {
    flex-wrap: nowrap;
    overflow-x: auto;
    overflow-y: hidden;
    -webkit-overflow-scrolling: touch;
    padding: 8px 4px;
  }

  .channel-btn {
    flex-shrink: 0;
    width: 40px;
    height: 40px;
    margin: 0 4px;
  }

  .channel-btn .btn-label {
    display: none;
  }

  .zoom-controls {
    flex-direction: column;
    gap: 8px;
  }

  .zoom-btn {
    width: 44px;
    height: 44px;
    font-size: 20px;
  }

  /* Piano roll plein écran */
  .piano-roll-container {
    height: calc(100vh - 56px - 60px - 60px) !important;
  }
}

/* Mobile paysage / Tablette portrait */
@media (min-width: 481px) and (max-width: 768px) {
  .midi-editor-modal {
    width: 95vw;
    height: 90vh;
  }

  .channel-btn {
    min-width: 50px;
    padding: 8px 12px;
  }

  .channel-btn .btn-label {
    font-size: 10px;
  }
}

/* Tablette paysage */
@media (min-width: 769px) and (max-width: 1024px) {
  .midi-editor-modal {
    width: 90vw;
    height: 85vh;
  }

  .channel-btn {
    min-width: 60px;
  }
}

/* Desktop - valeurs par défaut */
@media (min-width: 1025px) {
  /* Comportement actuel conservé */
}

/* Menu contextuel tactile */
.piano-roll-context-menu {
  background: var(--bg-secondary, #2a2a2a);
  border: 1px solid var(--border-color, #444);
  border-radius: 8px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
  padding: 8px 0;
  min-width: 200px;
  z-index: 10000;
}

.piano-roll-context-menu .menu-item {
  padding: 12px 16px;
  cursor: pointer;
  color: var(--text-primary, #fff);
  font-size: 14px;

  /* Touch target */
  min-height: 44px;
  display: flex;
  align-items: center;
}

.piano-roll-context-menu .menu-item:hover,
.piano-roll-context-menu .menu-item:active {
  background: var(--accent-color, #007bff);
}

.piano-roll-context-menu .menu-item:active {
  transform: scale(0.98);
}

/* Orientation change - pas de transition pendant rotation */
@media (orientation: portrait) {
  * {
    transition: none !important;
  }
}

@media (orientation: landscape) {
  * {
    transition: none !important;
  }
}

/* Prevent text selection on touch */
.piano-roll-container,
.channels-toolbar,
.zoom-controls {
  -webkit-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;
  user-select: none;

  -webkit-tap-highlight-color: transparent;
}

/* Scrollbars plus larges sur tactile */
@media (hover: none) and (pointer: coarse) {
  .channels-toolbar::-webkit-scrollbar {
    height: 8px;
  }

  .channels-toolbar::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.3);
    border-radius: 4px;
  }
}
```

---

## 🎯 Phase 2: Undo/Redo (Sprint 3)

### 2.1 Command Pattern

**Nouveau fichier: `public/js/utils/CommandHistory.js`**

```javascript
/**
 * Système d'historique Undo/Redo basé sur Command Pattern
 */

class Command {
  constructor() {
    this.timestamp = Date.now();
  }

  execute() {
    throw new Error('execute() must be implemented');
  }

  undo() {
    throw new Error('undo() must be implemented');
  }

  toString() {
    return this.constructor.name;
  }
}

class AddNoteCommand extends Command {
  constructor(pianoRoll, note) {
    super();
    this.pianoRoll = pianoRoll;
    this.note = { ...note }; // Deep copy
  }

  execute() {
    this.pianoRoll.addNote(this.note);
    return true;
  }

  undo() {
    this.pianoRoll.removeNote(this.note);
    return true;
  }

  toString() {
    return `Add note ${this.note.n} at ${this.note.t}`;
  }
}

class DeleteNotesCommand extends Command {
  constructor(pianoRoll, notes) {
    super();
    this.pianoRoll = pianoRoll;
    this.notes = notes.map(n => ({ ...n })); // Deep copy
  }

  execute() {
    for (const note of this.notes) {
      this.pianoRoll.removeNote(note);
    }
    return true;
  }

  undo() {
    for (const note of this.notes) {
      this.pianoRoll.addNote(note);
    }
    return true;
  }

  toString() {
    return `Delete ${this.notes.length} note(s)`;
  }
}

class MoveNotesCommand extends Command {
  constructor(pianoRoll, notes, deltaT, deltaN) {
    super();
    this.pianoRoll = pianoRoll;
    this.noteIds = notes.map(n => n.id || `${n.t}_${n.n}_${n.c}`);
    this.deltaT = deltaT;
    this.deltaN = deltaN;
  }

  execute() {
    const notes = this.pianoRoll.findNotesByIds(this.noteIds);
    for (const note of notes) {
      note.t += this.deltaT;
      note.n += this.deltaN;
    }
    this.pianoRoll.redraw();
    return true;
  }

  undo() {
    const notes = this.pianoRoll.findNotesByIds(this.noteIds);
    for (const note of notes) {
      note.t -= this.deltaT;
      note.n -= this.deltaN;
    }
    this.pianoRoll.redraw();
    return true;
  }

  toString() {
    return `Move ${this.noteIds.length} note(s)`;
  }
}

class ResizeNoteCommand extends Command {
  constructor(pianoRoll, note, oldGate, newGate) {
    super();
    this.pianoRoll = pianoRoll;
    this.noteId = note.id || `${note.t}_${note.n}_${note.c}`;
    this.oldGate = oldGate;
    this.newGate = newGate;
  }

  execute() {
    const note = this.pianoRoll.findNoteById(this.noteId);
    if (note) {
      note.g = this.newGate;
      this.pianoRoll.redraw();
    }
    return true;
  }

  undo() {
    const note = this.pianoRoll.findNoteById(this.noteId);
    if (note) {
      note.g = this.oldGate;
      this.pianoRoll.redraw();
    }
    return true;
  }

  toString() {
    return `Resize note`;
  }
}

class ChangeVelocityCommand extends Command {
  constructor(pianoRoll, notes, oldVelocities, newVelocity) {
    super();
    this.pianoRoll = pianoRoll;
    this.noteIds = notes.map(n => n.id || `${n.t}_${n.n}_${n.c}`);
    this.oldVelocities = oldVelocities;
    this.newVelocity = newVelocity;
  }

  execute() {
    const notes = this.pianoRoll.findNotesByIds(this.noteIds);
    for (const note of notes) {
      note.v = this.newVelocity;
    }
    this.pianoRoll.redraw();
    return true;
  }

  undo() {
    const notes = this.pianoRoll.findNotesByIds(this.noteIds);
    for (let i = 0; i < notes.length; i++) {
      notes[i].v = this.oldVelocities[i];
    }
    this.pianoRoll.redraw();
    return true;
  }

  toString() {
    return `Change velocity of ${this.noteIds.length} note(s)`;
  }
}

class CommandHistory {
  constructor(maxSize = 100) {
    this.undoStack = [];
    this.redoStack = [];
    this.maxSize = maxSize;
    this.enabled = true;

    // Callbacks
    this.onHistoryChange = null;
  }

  execute(command) {
    if (!this.enabled) return;

    const success = command.execute();

    if (success) {
      this.undoStack.push(command);
      this.redoStack = []; // Clear redo stack on new action

      // Limiter la taille
      if (this.undoStack.length > this.maxSize) {
        this.undoStack.shift();
      }

      this.notifyChange();
    }
  }

  undo() {
    if (!this.canUndo()) return false;

    const command = this.undoStack.pop();
    const success = command.undo();

    if (success) {
      this.redoStack.push(command);
      this.notifyChange();
      return true;
    }

    // Rollback si échec
    this.undoStack.push(command);
    return false;
  }

  redo() {
    if (!this.canRedo()) return false;

    const command = this.redoStack.pop();
    const success = command.execute();

    if (success) {
      this.undoStack.push(command);
      this.notifyChange();
      return true;
    }

    // Rollback si échec
    this.redoStack.push(command);
    return false;
  }

  canUndo() {
    return this.undoStack.length > 0;
  }

  canRedo() {
    return this.redoStack.length > 0;
  }

  clear() {
    this.undoStack = [];
    this.redoStack = [];
    this.notifyChange();
  }

  getUndoDescription() {
    if (!this.canUndo()) return null;
    return this.undoStack[this.undoStack.length - 1].toString();
  }

  getRedoDescription() {
    if (!this.canRedo()) return null;
    return this.redoStack[this.redoStack.length - 1].toString();
  }

  notifyChange() {
    if (this.onHistoryChange) {
      this.onHistoryChange({
        canUndo: this.canUndo(),
        canRedo: this.canRedo(),
        undoDescription: this.getUndoDescription(),
        redoDescription: this.getRedoDescription()
      });
    }
  }

  // Grouper plusieurs commandes en une seule
  beginMacro(description = 'Macro') {
    this.macroCommands = [];
    this.macroDescription = description;
  }

  endMacro() {
    if (this.macroCommands && this.macroCommands.length > 0) {
      const macro = new MacroCommand(this.macroCommands, this.macroDescription);
      this.execute(macro);
    }
    this.macroCommands = null;
  }
}

class MacroCommand extends Command {
  constructor(commands, description = 'Macro') {
    super();
    this.commands = commands;
    this.description = description;
  }

  execute() {
    for (const cmd of this.commands) {
      if (!cmd.execute()) return false;
    }
    return true;
  }

  undo() {
    // Undo en ordre inverse
    for (let i = this.commands.length - 1; i >= 0; i--) {
      if (!this.commands[i].undo()) return false;
    }
    return true;
  }

  toString() {
    return this.description;
  }
}

export {
  CommandHistory,
  Command,
  AddNoteCommand,
  DeleteNotesCommand,
  MoveNotesCommand,
  ResizeNoteCommand,
  ChangeVelocityCommand,
  MacroCommand
};
```

---

### 2.2 Intégration UI

**Modifier: `public/js/views/components/MidiEditorModal.js`**

```javascript
import {
  CommandHistory,
  AddNoteCommand,
  DeleteNotesCommand,
  MoveNotesCommand,
  ResizeNoteCommand
} from '../../utils/CommandHistory.js';

// Dans la méthode show()
this.commandHistory = new CommandHistory(100);

// Callback pour mettre à jour l'UI
this.commandHistory.onHistoryChange = (state) => {
  this.updateUndoRedoButtons(state);
};

// Ajouter boutons Undo/Redo dans le header
this.createUndoRedoButtons();

// Raccourcis clavier
this.setupKeyboardShortcuts();

// ... reste du code

// Nouvelles méthodes:

createUndoRedoButtons() {
  const toolbar = this.modal.querySelector('.editor-toolbar');

  const undoBtn = document.createElement('button');
  undoBtn.className = 'tool-btn undo-btn';
  undoBtn.innerHTML = `
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <path d="M3 7v6h6M3 13a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 7"/>
    </svg>
    <span class="btn-label">Undo</span>
  `;
  undoBtn.disabled = true;
  undoBtn.addEventListener('click', () => this.undo());

  const redoBtn = document.createElement('button');
  redoBtn.className = 'tool-btn redo-btn';
  redoBtn.innerHTML = `
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <path d="M21 7v6h-6M21 13a9 9 0 1 1-9-9c2.74 0 5.19 1.23 6.74 3.26L21 7"/>
    </svg>
    <span class="btn-label">Redo</span>
  `;
  redoBtn.disabled = true;
  redoBtn.addEventListener('click', () => this.redo());

  toolbar.prepend(redoBtn);
  toolbar.prepend(undoBtn);

  this.undoBtn = undoBtn;
  this.redoBtn = redoBtn;
}

updateUndoRedoButtons(state) {
  if (this.undoBtn) {
    this.undoBtn.disabled = !state.canUndo;
    this.undoBtn.title = state.undoDescription || 'Undo';
  }

  if (this.redoBtn) {
    this.redoBtn.disabled = !state.canRedo;
    this.redoBtn.title = state.redoDescription || 'Redo';
  }
}

setupKeyboardShortcuts() {
  this.keyHandler = (e) => {
    // Ctrl/Cmd + Z = Undo
    if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
      e.preventDefault();
      this.undo();
    }

    // Ctrl/Cmd + Shift + Z = Redo
    // Ctrl/Cmd + Y = Redo
    if ((e.ctrlKey || e.metaKey) && (
      (e.key === 'z' && e.shiftKey) ||
      e.key === 'y'
    )) {
      e.preventDefault();
      this.redo();
    }
  };

  document.addEventListener('keydown', this.keyHandler);
}

undo() {
  if (this.commandHistory.undo()) {
    console.log('Undo:', this.commandHistory.getRedoDescription());
  }
}

redo() {
  if (this.commandHistory.redo()) {
    console.log('Redo:', this.commandHistory.getUndoDescription());
  }
}

// Modifier les méthodes existantes pour utiliser les commandes

addNote(note) {
  const cmd = new AddNoteCommand(this.pianoRoll, note);
  this.commandHistory.execute(cmd);
  this.markDirty();
}

deleteSelectedNotes() {
  const notes = this.pianoRoll.getSelectedNotes();
  if (notes.length === 0) return;

  const cmd = new DeleteNotesCommand(this.pianoRoll, notes);
  this.commandHistory.execute(cmd);
  this.markDirty();
}

moveNotes(notes, deltaT, deltaN) {
  const cmd = new MoveNotesCommand(this.pianoRoll, notes, deltaT, deltaN);
  this.commandHistory.execute(cmd);
  this.markDirty();
}

resizeNote(note, oldGate, newGate) {
  const cmd = new ResizeNoteCommand(this.pianoRoll, note, oldGate, newGate);
  this.commandHistory.execute(cmd);
  this.markDirty();
}

// Cleanup
destroy() {
  if (this.keyHandler) {
    document.removeEventListener('keydown', this.keyHandler);
  }

  if (this.commandHistory) {
    this.commandHistory.clear();
  }

  // ... reste du cleanup
}
```

---

## 🎯 Phase 3: Vélocité & CC Automation (Sprint 4-5)

### 3.1 Vélocité Editor

**Nouveau fichier: `public/js/views/components/VelocityEditor.js`**

```javascript
/**
 * Éditeur de vélocité pour notes MIDI
 * Affiche des barres verticales éditables sous le piano roll
 */
class VelocityEditor {
  constructor(container, pianoRoll) {
    this.container = container;
    this.pianoRoll = pianoRoll;
    this.canvas = null;
    this.ctx = null;
    this.height = 120;

    this.isDragging = false;
    this.selectedNotes = [];

    this.init();
  }

  init() {
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'velocity-editor-canvas';
    this.canvas.height = this.height;
    this.canvas.width = this.pianoRoll.canvas.width;

    this.ctx = this.canvas.getContext('2d');
    this.container.appendChild(this.canvas);

    this.setupEventListeners();
    this.render();
  }

  setupEventListeners() {
    this.canvas.addEventListener('pointerdown', this.onPointerDown.bind(this));
    this.canvas.addEventListener('pointermove', this.onPointerMove.bind(this));
    this.canvas.addEventListener('pointerup', this.onPointerUp.bind(this));

    // Sync avec sélection piano roll
    this.pianoRoll.on('selectionChange', (notes) => {
      this.selectedNotes = notes;
      this.render();
    });

    // Sync scroll horizontal
    this.pianoRoll.on('scroll', () => {
      this.render();
    });
  }

  render() {
    const { ctx, canvas, height } = this;
    const notes = this.pianoRoll.getAllNotes();

    // Clear
    ctx.clearRect(0, 0, canvas.width, height);

    // Background
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, canvas.width, height);

    // Grid horizontal
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    for (let v = 0; v <= 127; v += 32) {
      const y = height - (v / 127) * height;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }

    // Labels
    ctx.fillStyle = '#666';
    ctx.font = '10px monospace';
    ctx.fillText('127', 5, 10);
    ctx.fillText('64', 5, height / 2);
    ctx.fillText('0', 5, height - 5);

    // Barres de vélocité
    const scrollX = this.pianoRoll.scrollX;
    const timeScale = this.pianoRoll.timeScale;
    const xZoom = this.pianoRoll.xZoom;

    for (const note of notes) {
      const x = (note.t * timeScale - scrollX) * xZoom;
      const width = (note.g * timeScale) * xZoom;

      // Skip si hors écran
      if (x + width < 0 || x > canvas.width) continue;

      const velocity = note.v || 100;
      const barHeight = (velocity / 127) * height;
      const y = height - barHeight;

      // Couleur selon vélocité
      const isSelected = this.selectedNotes.includes(note);
      if (isSelected) {
        ctx.fillStyle = '#00bfff';
      } else {
        const intensity = velocity / 127;
        const r = Math.floor(100 + intensity * 155);
        const g = Math.floor(50 + intensity * 100);
        const b = 50;
        ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
      }

      // Barre
      ctx.fillRect(x, y, Math.max(2, width), barHeight);

      // Border
      if (isSelected) {
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.strokeRect(x, y, Math.max(2, width), barHeight);
      }
    }
  }

  onPointerDown(e) {
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const note = this.findNoteAtX(x);
    if (note) {
      this.isDragging = true;
      this.updateNoteVelocity(note, y);
    }
  }

  onPointerMove(e) {
    if (!this.isDragging) return;

    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const note = this.findNoteAtX(x);
    if (note) {
      this.updateNoteVelocity(note, y);
    }
  }

  onPointerUp(e) {
    this.isDragging = false;
  }

  findNoteAtX(x) {
    const scrollX = this.pianoRoll.scrollX;
    const timeScale = this.pianoRoll.timeScale;
    const xZoom = this.pianoRoll.xZoom;

    const notes = this.pianoRoll.getAllNotes();

    for (const note of notes) {
      const noteX = (note.t * timeScale - scrollX) * xZoom;
      const noteWidth = (note.g * timeScale) * xZoom;

      if (x >= noteX && x <= noteX + noteWidth) {
        return note;
      }
    }

    return null;
  }

  updateNoteVelocity(note, y) {
    const velocity = Math.max(1, Math.min(127, Math.floor((1 - y / this.height) * 127)));

    // Via command pour undo/redo
    const oldVelocity = note.v || 100;
    note.v = velocity;

    this.render();
    this.pianoRoll.redraw();

    // Event
    this.pianoRoll.emit('velocityChange', { note, oldVelocity, newVelocity: velocity });
  }

  resize(width) {
    this.canvas.width = width;
    this.render();
  }

  destroy() {
    this.canvas.remove();
  }
}

export default VelocityEditor;
```

---

## 📊 Checklist d'implémentation

### Sprint 1-2: Touch (2 semaines)
- [ ] Installer Hammer.js
- [ ] Créer TouchGestureHandler.js
- [ ] Ajouter méthodes zoom/pan au piano roll
- [ ] Implémenter pinch-to-zoom
- [ ] Implémenter pan 2 doigts
- [ ] Menu contextuel long-press
- [ ] Double-tap zoom
- [ ] CSS responsive (breakpoints)
- [ ] Tailles tactiles (44x44px)
- [ ] Tests iOS Safari
- [ ] Tests Android Chrome
- [ ] Tests iPad

### Sprint 3: Undo/Redo (1 semaine)
- [ ] Créer CommandHistory.js
- [ ] Implémenter Command classes
- [ ] Intégrer dans MidiEditorModal
- [ ] Boutons UI Undo/Redo
- [ ] Raccourcis clavier (Ctrl+Z, Ctrl+Y)
- [ ] Tests unitaires
- [ ] Documentation

### Sprint 4-5: Vélocité/CC (2 semaines)
- [ ] Créer VelocityEditor.js
- [ ] Intégrer dans layout
- [ ] Sync sélection avec piano roll
- [ ] Édition drag vélocité
- [ ] Créer CCAutomationEditor.js
- [ ] Lanes multi-CC
- [ ] Courbes Bézier
- [ ] Tests

---

## 🚀 Commandes de déploiement

```bash
# Tests unitaires
npm run test

# Build production
npm run build

# Déploiement
git add .
git commit -m "feat: Touch gestures, Undo/Redo, Velocity editor"
git push origin claude/study-editor-improvements-018botD5TJiSddZVx9HkG86A
```

---

**Document créé**: 2025-11-17
**Version**: 1.0
**Statut**: Plan technique - Prêt pour implémentation
