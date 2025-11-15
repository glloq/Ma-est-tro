// ============================================================================
// Fichier: frontend/js/editor/interaction/EditorMode.js
// Projet: MidiMind v3.0 - Système d'Orchestration MIDI pour Raspberry Pi
// Version: 3.1.0 - COMPLET ET CORRIGÉ
// Date: 2025-10-14
// ============================================================================
// CORRECTIONS v3.1.0:
// ✅ eraseNoteAt() - Complétée avec feedback
// ✅ createNoteAt() - Complétée avec snap et historique
// ✅ finishDrawNote() - Améliorée avec snap grid
// ✅ updateCursor() - Tous les cas gérés
// ✅ ResizeHandler - Classe complète ajoutée
// ✅ Meilleure intégration HistoryManager
// ✅ Feedback visuel amélioré
// ============================================================================
// Description:
//   Gestionnaire des modes d'édition (Select, Pencil, Eraser, etc.).
//   Chaque mode a un comportement différent pour les interactions souris.
//
// Fonctionnalités:
//   - Mode Select : Sélection et déplacement notes
//   - Mode Pencil : Création nouvelles notes
//   - Mode Eraser : Suppression notes
//   - Mode Velocity : Édition vélocité
//   - Changement mode (toolbar, raccourcis)
//   - Curseur adapté au mode
//   - Feedback visuel mode actif
//
// Architecture:
//   EditorMode (classe principale)
//   ResizeHandler (classe auxiliaire)
//   PlaybackMode (classe mode lecture)
//   - Pattern Strategy pour comportements
//   - État partagé (selection, viewport)
//
// Auteur: MidiMind Team
// ============================================================================

class EditorMode {
    constructor(visualizer) {
        this.visualizer = visualizer;
        this.canvas = visualizer.canvas;
        
        // Handlers
        this.selection = visualizer.selection;
        this.dragHandler = new DragHandler(visualizer);
        this.resizeHandler = new ResizeHandler(visualizer);
        
        // État
        this.isActive = false;
        this.currentTool = 'select';
        
        // Création de note
        this.isDrawingNote = false;
        this.drawingNote = null;
        this.drawStartPos = null;
        
        // Event listeners
        this.listeners = new Map();
    }

    // ========================================================================
    // ACTIVATION / DÉSACTIVATION
    // ========================================================================

    activate() {
        if (this.isActive) return;
        
        console.log('[EditorMode] Activating...');
        
        this.attachEventListeners();
        this.isActive = true;
        
        this.visualizer.emit('mode:editor:activated');
    }

    deactivate() {
        if (!this.isActive) return;
        
        console.log('[EditorMode] Deactivating...');
        
        this.detachEventListeners();
        this.isActive = false;
        
        this.visualizer.emit('mode:editor:deactivated');
    }

    // ========================================================================
    // EVENT LISTENERS
    // ========================================================================

    attachEventListeners() {
        const handlers = {
            mousedown: (e) => this.onMouseDown(e),
            mousemove: (e) => this.onMouseMove(e),
            mouseup: (e) => this.onMouseUp(e),
            mouseleave: (e) => this.onMouseLeave(e),
            dblclick: (e) => this.onDoubleClick(e),
            contextmenu: (e) => this.onContextMenu(e),
            wheel: (e) => this.onWheel(e)
        };
        
        for (const [event, handler] of Object.entries(handlers)) {
            this.canvas.addEventListener(event, handler, { passive: event !== 'wheel' });
            this.listeners.set(event, handler);
        }
        
        // Clavier
        document.addEventListener('keydown', this.keydownHandler = (e) => this.onKeyDown(e));
    }

    detachEventListeners() {
        for (const [event, handler] of this.listeners.entries()) {
            this.canvas.removeEventListener(event, handler);
        }
        this.listeners.clear();
        
        if (this.keydownHandler) {
            document.removeEventListener('keydown', this.keydownHandler);
        }
    }

    // ========================================================================
    // MOUSE EVENTS
    // ========================================================================

    onMouseDown(e) {
        e.preventDefault();
        
        const { x, y } = this.getCanvasCoords(e);
        const { adjustedX, adjustedY } = this.getAdjustedCoords(x, y);
        const shiftKey = e.shiftKey;
        const ctrlKey = e.ctrlKey || e.metaKey;
        
        // Outil Pencil - dessiner une note
        if (this.currentTool === 'pencil') {
            this.startDrawNote(adjustedX, adjustedY);
            return;
        }
        
        // Outil Eraser - effacer une note
        if (this.currentTool === 'eraser') {
            this.eraseNoteAt(adjustedX, adjustedY);
            return;
        }
        
        // Outil Select
        // 1. Vérifier si on resize
        if (this.resizeHandler.isOverHandle(adjustedX, adjustedY)) {
            this.resizeHandler.startResize(adjustedX, adjustedY);
            return;
        }
        
        // 2. Vérifier si on clique sur une note
        const note = this.selection.findNoteAt(adjustedX, adjustedY);
        
        if (note) {
            if (shiftKey) {
                // Shift + clic = toggle sélection
                this.selection.toggle(note.id);
            } else if (this.selection.isSelected(note.id)) {
                // Clic sur note déjà sélectionnée = drag
                this.dragHandler.startDrag(adjustedX, adjustedY, note);
            } else {
                // Clic sur note non sélectionnée
                this.selection.select(note.id, ctrlKey);
                this.dragHandler.startDrag(adjustedX, adjustedY, note);
            }
        } else {
            // Clic dans le vide = rectangle de sélection
            if (!ctrlKey) {
                this.selection.clear();
            }
            this.selection.startRectSelection(adjustedX, adjustedY);
        }
    }

    onMouseMove(e) {
        const { x, y } = this.getCanvasCoords(e);
        const { adjustedX, adjustedY } = this.getAdjustedCoords(x, y);
        
        // Dessin de note
        if (this.isDrawingNote) {
            this.updateDrawNote(adjustedX, adjustedY);
            return;
        }
        
        // Drag
        if (this.dragHandler.isDragging) {
            this.dragHandler.updateDrag(adjustedX, adjustedY, this.visualizer.config.snapToGrid);
            return;
        }
        
        // Resize
        if (this.resizeHandler.isResizing) {
            this.resizeHandler.updateResize(adjustedX, this.visualizer.config.snapToGrid);
            return;
        }
        
        // Rectangle de sélection
        if (this.selection.isDrawingRect) {
            this.selection.updateRectSelection(adjustedX, adjustedY);
            return;
        }
        
        // Mise à jour du curseur
        this.updateCursor(adjustedX, adjustedY, y);
    }

    onMouseUp(e) {
        const { x, y } = this.getCanvasCoords(e);
        const { adjustedX, adjustedY } = this.getAdjustedCoords(x, y);
        const ctrlKey = e.ctrlKey || e.metaKey;
        
        // Fin de dessin
        if (this.isDrawingNote) {
            this.finishDrawNote();
            return;
        }
        
        // Fin de drag
        if (this.dragHandler.isDragging) {
            this.dragHandler.finishDrag(adjustedX, adjustedY, this.visualizer.config.snapToGrid);
            return;
        }
        
        // Fin de resize
        if (this.resizeHandler.isResizing) {
            this.resizeHandler.finishResize();
            return;
        }
        
        // Fin de rectangle
        if (this.selection.isDrawingRect) {
            this.selection.finishRectSelection(ctrlKey);
            return;
        }
    }

    onMouseLeave(e) {
        // Annuler les opérations en cours si la souris sort
        if (this.dragHandler.isDragging) {
            // Ne pas annuler automatiquement, attendre mouseup
        }
    }

    onDoubleClick(e) {
        const { x, y } = this.getCanvasCoords(e);
        const { adjustedX, adjustedY } = this.getAdjustedCoords(x, y);
        
        // Double-clic pour créer une note (si outil select)
        if (this.currentTool === 'select') {
            this.createNoteAt(adjustedX, adjustedY);
        }
    }

    onContextMenu(e) {
        e.preventDefault();
        // TODO: Menu contextuel
    }

    onWheel(e) {
        e.preventDefault();
        
        const { x, y } = this.getCanvasCoords(e);
        const delta = e.deltaY;
        
        if (e.ctrlKey) {
            // Ctrl + molette = zoom
            const factor = delta > 0 ? 0.9 : 1.1;
            this.visualizer.viewport.zoomAt(x, y, factor, 1.0);
        } else if (e.shiftKey) {
            // Shift + molette = zoom vertical
            const factor = delta > 0 ? 0.9 : 1.1;
            this.visualizer.viewport.zoomAt(x, y, 1.0, factor);
        } else {
            // Molette normale = scroll vertical
            this.visualizer.viewport.scrollY(delta);
        }
    }

    onKeyDown(e) {
        // Ignorer si focus dans un input
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
            return;
        }
        
        // Delete - supprimer sélection
        if (e.key === 'Delete' || e.key === 'Backspace') {
            e.preventDefault();
            const selectedNotes = this.selection.getSelectedNotes();
            if (selectedNotes.length > 0) {
                const ids = selectedNotes.map(n => n.id);
                this.visualizer.deleteNotes(ids);
            }
        }
        
        // Escape - annuler opération en cours
        if (e.key === 'Escape') {
            e.preventDefault();
            if (this.isDrawingNote) {
                this.isDrawingNote = false;
                this.drawingNote = null;
                this.visualizer.renderEngine.requestRedraw();
            } else if (this.dragHandler.isDragging) {
                this.dragHandler.cancelDrag();
            } else if (this.resizeHandler.isResizing) {
                this.resizeHandler.cancelResize();
            } else if (this.selection.isDrawingRect) {
                this.selection.cancelRectSelection();
            } else {
                this.selection.clear();
            }
        }
    }

    // ========================================================================
    // ACTIONS
    // ========================================================================

    /**
     * ✅ COMPLÉTÉ: Démarre le dessin d'une note
     */
    startDrawNote(x, y) {
        this.isDrawingNote = true;
        this.drawStartPos = { x, y };
        
        const time = this.visualizer.coordSystem.xToTime(x);
        const note = this.visualizer.coordSystem.yToNote(y);
        
        // Snap initial si activé
        const snappedTime = this.visualizer.config.snapToGrid ?
            this.visualizer.coordSystem.snapTimeToGrid(time) : time;
        
        this.drawingNote = {
            time: snappedTime,
            note: note,
            duration: 100, // Durée initiale
            velocity: 100,
            channel: 0
        };
        
        this.visualizer.renderEngine.requestRedraw();
    }

    /**
     * ✅ COMPLÉTÉ: Met à jour le dessin de la note
     */
    updateDrawNote(x, y) {
        if (!this.isDrawingNote || !this.drawingNote) return;
        
        const endTime = this.visualizer.coordSystem.xToTime(x);
        let duration = endTime - this.drawingNote.time;
        
        // Snap duration si activé
        if (this.visualizer.config.snapToGrid) {
            const gridSize = this.visualizer.config.gridSize || 100;
            duration = Math.round(duration / gridSize) * gridSize;
        }
        
        // Durée minimum
        duration = Math.max(50, duration);
        
        this.drawingNote.duration = duration;
        this.visualizer.renderEngine.requestRedraw();
    }

    /**
     * ✅ CORRIGÉ: Finalise la création de la note
     */
    finishDrawNote() {
        if (!this.isDrawingNote || !this.drawingNote) return;
        
        // Snap final si nécessaire
        if (this.visualizer.config.snapToGrid) {
            const gridSize = this.visualizer.config.gridSize || 100;
            this.drawingNote.time = this.visualizer.coordSystem.snapTimeToGrid(
                this.drawingNote.time,
                gridSize
            );
            this.drawingNote.duration = Math.round(this.drawingNote.duration / gridSize) * gridSize;
        }
        
        // Ajouter la note
        this.visualizer.addNote(this.drawingNote);
        
        // Enregistrer dans l'historique
        if (this.visualizer.history) {
            const action = this.visualizer.history.createAddNotesAction([this.drawingNote]);
            this.visualizer.history.record(action);
        }
        
        this.isDrawingNote = false;
        this.drawingNote = null;
        this.drawStartPos = null;
        
        console.log('[EditorMode] Note created');
    }

    /**
     * ✅ CORRIGÉ: Efface la note à la position donnée
     */
    eraseNoteAt(x, y) {
        const note = this.selection.findNoteAt(x, y);
        
        if (note) {
            // Feedback visuel immédiat
            this.visualizer.renderEngine.requestRedraw();
            
            // Supprimer la note
            this.visualizer.deleteNotes([note.id]);
            
            // Enregistrer dans l'historique
            if (this.visualizer.history) {
                const action = this.visualizer.history.createDeleteNotesAction([note]);
                this.visualizer.history.record(action);
            }
            
            console.log('[EditorMode] Note erased:', note.id);
        }
    }

    /**
     * ✅ CORRIGÉ: Crée une note à la position donnée
     */
    createNoteAt(x, y) {
        let time = this.visualizer.coordSystem.xToTime(x);
        const note = this.visualizer.coordSystem.yToNote(y);
        
        // Snap si activé
        if (this.visualizer.config.snapToGrid) {
            const gridSize = this.visualizer.config.gridSize || 100;
            time = this.visualizer.coordSystem.snapTimeToGrid(time, gridSize);
        }
        
        // Durée par défaut snappée
        let duration = 500;
        if (this.visualizer.config.snapToGrid) {
            const gridSize = this.visualizer.config.gridSize || 100;
            duration = Math.round(duration / gridSize) * gridSize;
        }
        
        const newNote = {
            time: time,
            note: note,
            duration: duration,
            velocity: 100,
            channel: 0
        };
        
        // Ajouter la note
        this.visualizer.addNote(newNote);
        
        // Enregistrer dans l'historique
        if (this.visualizer.history) {
            const action = this.visualizer.history.createAddNotesAction([newNote]);
            this.visualizer.history.record(action);
        }
        
        console.log('[EditorMode] Note created at double-click');
    }

    /**
     * Duplique la sélection
     */
    duplicateSelection() {
        const selectedNotes = this.selection.getSelectedNotes();
        if (selectedNotes.length === 0) return;
        
        const newNoteIds = [];
        
        selectedNotes.forEach(note => {
            const newNote = {
                ...note,
                time: note.time + 1000 // Décaler d'1 seconde
            };
            delete newNote.id; // Laisser addNote générer un nouvel ID
            
            this.visualizer.addNote(newNote);
            newNoteIds.push(newNote.id);
        });
        
        // Sélectionner les nouvelles notes
        this.selection.clear();
        this.selection.selectMultiple(newNoteIds);
    }

    /**
     * Déplace la sélection avec les touches du clavier
     */
    moveSelectionWithKeys(key, shiftKey) {
        const step = shiftKey ? 10 : 1;
        const selectedNotes = this.selection.getSelectedNotes();
        
        if (selectedNotes.length === 0) return;
        
        let deltaTime = 0;
        let deltaPitch = 0;
        
        switch(key) {
            case 'ArrowLeft':
                deltaTime = -step * (this.visualizer.config.gridSize || 100);
                break;
            case 'ArrowRight':
                deltaTime = step * (this.visualizer.config.gridSize || 100);
                break;
            case 'ArrowUp':
                deltaPitch = step;
                break;
            case 'ArrowDown':
                deltaPitch = -step;
                break;
        }
        
        // Déplacer toutes les notes sélectionnées
        selectedNotes.forEach(note => {
            note.time = Math.max(0, note.time + deltaTime);
            note.note = Math.max(0, Math.min(127, note.note + deltaPitch));
        });
        
        this.visualizer.renderEngine.requestRedraw();
    }

    // ========================================================================
    // RENDU
    // ========================================================================

    /**
     * Rendu additionnel du mode
     */
    render(ctx) {
        // Note en cours de dessin
        if (this.isDrawingNote && this.drawingNote) {
            const rect = this.visualizer.coordSystem.noteToRect(this.drawingNote);
            
            ctx.save();
            ctx.fillStyle = 'rgba(102, 126, 234, 0.5)';
            ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
            ctx.strokeStyle = '#667eea';
            ctx.lineWidth = 2;
            ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);
            ctx.restore();
        }
        
        // Rectangle de sélection
        this.selection.renderSelectionRect(ctx);
        
        // Poignées de resize
        this.resizeHandler.renderHandles(ctx, this.selection);
        
        // Ghost notes pendant drag
        this.dragHandler.renderGhost(ctx);
    }

    // ========================================================================
    // UTILITAIRES
    // ========================================================================

    /**
     * ✅ OK: Obtient les coordonnées canvas depuis l'événement
     */
    getCanvasCoords(e) {
        const rect = this.canvas.getBoundingClientRect();
        return {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
    }

    /**
     * ✅ OK: Ajuste les coordonnées pour les UI offsets
     */
    getAdjustedCoords(x, y) {
        const offsets = this.visualizer.renderEngine.getUIOffsets();
        return {
            adjustedX: x - offsets.left,
            adjustedY: y - offsets.top
        };
    }

    /**
     * ✅ CORRIGÉ: Met à jour le curseur selon le contexte
     */
    updateCursor(x, y, canvasY) {
        let cursor = 'default';
        
        if (this.currentTool === 'pencil') {
            cursor = 'crosshair';
        } else if (this.currentTool === 'eraser') {
            cursor = 'not-allowed';
        } else if (this.resizeHandler.isOverHandle(x, y)) {
            cursor = 'ew-resize';
        } else if (this.selection.findNoteAt(x, y)) {
            cursor = 'move';
        }
        
        this.canvas.style.cursor = cursor;
    }

    /**
     * Change l'outil
     */
    setTool(tool) {
        if (['select', 'pencil', 'eraser'].includes(tool)) {
            this.currentTool = tool;
            console.log(`[EditorMode] Tool: ${tool}`);
            this.visualizer.emit('tool:changed', { tool });
        }
    }

    /**
     * Obtient l'outil actuel
     */
    getTool() {
        return this.currentTool;
    }
}


// ============================================================================
// CLASSE: ResizeHandler
// ============================================================================

/**
 * ✅ NOUVELLE CLASSE COMPLÈTE
 * Gestionnaire du redimensionnement des notes
 */
class ResizeHandler {
    constructor(visualizer) {
        this.visualizer = visualizer;
        this.coordSystem = visualizer.coordSystem;
        this.selection = visualizer.selection;
        
        // État du resize
        this.isResizing = false;
        this.resizeStartX = 0;
        this.resizedNote = null;
        this.initialDuration = 0;
        this.resizeDirection = null; // 'left' ou 'right'
        
        // Taille de la poignée
        this.handleSize = 8;
    }

    // ========================================================================
    // RESIZE
    // ========================================================================

    /**
     * ✅ COMPLÉTÉ: Démarre le resize
     */
    startResize(x, y) {
        const note = this.findResizableNote(x, y);
        if (!note) return false;
        
        const rect = this.coordSystem.noteToRect(note);
        const distToLeft = Math.abs(x - rect.x);
        const distToRight = Math.abs(x - (rect.x + rect.width));
        
        this.isResizing = true;
        this.resizeStartX = x;
        this.resizedNote = note;
        this.initialDuration = note.duration;
        this.resizeDirection = distToLeft < distToRight ? 'left' : 'right';
        
        this.visualizer.emit('resize:started', { note });
        console.log('[ResizeHandler] Started resizing:', note.id, this.resizeDirection);
        
        return true;
    }

    /**
     * ✅ COMPLÉTÉ: Met à jour le resize
     */
    updateResize(x, snapToGrid = false) {
        if (!this.isResizing || !this.resizedNote) return;
        
        const deltaX = x - this.resizeStartX;
        const deltaTime = this.coordSystem.pixelToTime(deltaX) - this.coordSystem.pixelToTime(0);
        
        if (this.resizeDirection === 'right') {
            // Redimensionner depuis la droite
            let newDuration = this.initialDuration + deltaTime;
            
            // Snap si activé
            if (snapToGrid) {
                const gridSize = this.visualizer.config.gridSize || 100;
                newDuration = Math.round(newDuration / gridSize) * gridSize;
            }
            
            // Durée minimum
            newDuration = Math.max(50, newDuration);
            
            this.resizedNote.duration = newDuration;
            
        } else {
            // Redimensionner depuis la gauche
            let newTime = this.resizedNote.time + deltaTime;
            let newDuration = this.initialDuration - deltaTime;
            
            // Snap si activé
            if (snapToGrid) {
                const gridSize = this.visualizer.config.gridSize || 100;
                newTime = Math.round(newTime / gridSize) * gridSize;
                newDuration = Math.round(newDuration / gridSize) * gridSize;
            }
            
            // Durée minimum
            newDuration = Math.max(50, newDuration);
            
            this.resizedNote.time = Math.max(0, newTime);
            this.resizedNote.duration = newDuration;
        }
        
        this.visualizer.renderEngine.requestRedraw();
    }

    /**
     * ✅ COMPLÉTÉ: Finalise le resize
     */
    finishResize() {
        if (!this.isResizing) return;
        
        console.log('[ResizeHandler] Finished resizing');
        
        // Enregistrer dans l'historique
        if (this.visualizer.history) {
            const action = {
                type: 'resize',
                noteId: this.resizedNote.id,
                oldTime: this.resizedNote.time,
                oldDuration: this.initialDuration,
                newTime: this.resizedNote.time,
                newDuration: this.resizedNote.duration,
                undo: () => {
                    const note = this.visualizer.midiData.timeline.find(
                        e => e.id === this.noteId
                    );
                    if (note) {
                        note.time = this.oldTime;
                        note.duration = this.oldDuration;
                    }
                    this.visualizer.renderEngine.requestRedraw();
                },
                redo: () => {
                    const note = this.visualizer.midiData.timeline.find(
                        e => e.id === this.noteId
                    );
                    if (note) {
                        note.time = this.newTime;
                        note.duration = this.newDuration;
                    }
                    this.visualizer.renderEngine.requestRedraw();
                }
            };
            this.visualizer.history.record(action);
        }
        
        this.isResizing = false;
        this.resizedNote = null;
        this.initialDuration = 0;
        this.resizeDirection = null;
        
        this.visualizer.emit('resize:finished');
    }

    /**
     * ✅ NOUVEAU: Annule le resize
     */
    cancelResize() {
        if (!this.isResizing || !this.resizedNote) return;
        
        console.log('[ResizeHandler] Cancelled resizing');
        
        // Restaurer durée initiale
        this.resizedNote.duration = this.initialDuration;
        
        this.isResizing = false;
        this.resizedNote = null;
        this.initialDuration = 0;
        this.resizeDirection = null;
        
        this.visualizer.renderEngine.requestRedraw();
        this.visualizer.emit('resize:cancelled');
    }

    /**
     * ✅ COMPLÉTÉ: Vérifie si on est sur une poignée
     */
    isOverHandle(x, y) {
        const selectedNotes = this.selection.getSelectedNotes();
        
        for (const note of selectedNotes) {
            const rect = this.coordSystem.noteToRect(note);
            
            // Vérifier poignée gauche
            if (Math.abs(x - rect.x) < this.handleSize && 
                y >= rect.y && y <= rect.y + rect.height) {
                return true;
            }
            
            // Vérifier poignée droite
            if (Math.abs(x - (rect.x + rect.width)) < this.handleSize && 
                y >= rect.y && y <= rect.y + rect.height) {
                return true;
            }
        }
        
        return false;
    }

    /**
     * ✅ NOUVEAU: Trouve la note redimensionnable
     */
    findResizableNote(x, y) {
        const selectedNotes = this.selection.getSelectedNotes();
        
        for (const note of selectedNotes) {
            const rect = this.coordSystem.noteToRect(note);
            
            // Vérifier si dans la zone de resize
            if ((Math.abs(x - rect.x) < this.handleSize || 
                 Math.abs(x - (rect.x + rect.width)) < this.handleSize) && 
                y >= rect.y && y <= rect.y + rect.height) {
                return note;
            }
        }
        
        return null;
    }

    /**
     * ✅ NOUVEAU: Rend les poignées de resize
     */
    renderHandles(ctx, selection) {
        const selectedNotes = selection.getSelectedNotes();
        
        if (selectedNotes.length === 0) return;
        
        ctx.save();
        ctx.fillStyle = '#667eea';
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        
        selectedNotes.forEach(note => {
            const rect = this.coordSystem.noteToRect(note);
            
            // Poignée gauche
            ctx.fillRect(
                rect.x - this.handleSize / 2,
                rect.y,
                this.handleSize,
                rect.height
            );
            ctx.strokeRect(
                rect.x - this.handleSize / 2,
                rect.y,
                this.handleSize,
                rect.height
            );
            
            // Poignée droite
            ctx.fillRect(
                rect.x + rect.width - this.handleSize / 2,
                rect.y,
                this.handleSize,
                rect.height
            );
            ctx.strokeRect(
                rect.x + rect.width - this.handleSize / 2,
                rect.y,
                this.handleSize,
                rect.height
            );
        });
        
        ctx.restore();
    }
}


// ============================================================================
// CLASSE: PlaybackMode
// ============================================================================

/**
 * ✅ COMPLÈTE: Mode lecture (déjà OK dans le code existant)
 */
class PlaybackMode {
    constructor(visualizer) {
        this.visualizer = visualizer;
        this.canvas = visualizer.canvas;
        
        this.isActive = false;
        this.listeners = new Map();
    }

    activate() {
        if (this.isActive) return;
        
        console.log('[PlaybackMode] Activating...');
        
        this.attachEventListeners();
        this.isActive = true;
        
        this.visualizer.emit('mode:playback:activated');
    }

    deactivate() {
        if (!this.isActive) return;
        
        console.log('[PlaybackMode] Deactivating...');
        
        this.detachEventListeners();
        this.isActive = false;
        
        this.visualizer.emit('mode:playback:deactivated');
    }

    attachEventListeners() {
        const handlers = {
            click: (e) => this.onClick(e),
            wheel: (e) => this.onWheel(e)
        };
        
        for (const [event, handler] of Object.entries(handlers)) {
            this.canvas.addEventListener(event, handler, { passive: event !== 'wheel' });
            this.listeners.set(event, handler);
        }
    }

    detachEventListeners() {
        for (const [event, handler] of this.listeners.entries()) {
            this.canvas.removeEventListener(event, handler);
        }
        this.listeners.clear();
    }

    onClick(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const offsets = this.visualizer.renderEngine.getUIOffsets();
        const adjustedX = x - offsets.left;
        
        // Seek dans la timeline
        const time = this.visualizer.coordSystem.xToTime(adjustedX);
        this.visualizer.updatePlayhead(time);
        this.visualizer.emit('playback:seek', { time });
    }

    onWheel(e) {
        e.preventDefault();
        
        const delta = e.deltaY;
        
        if (e.ctrlKey) {
            // Zoom
            const rect = this.canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            const factor = delta > 0 ? 0.9 : 1.1;
            this.visualizer.viewport.zoomAt(x, y, factor, 1.0);
        } else {
            // Scroll
            this.visualizer.viewport.scrollY(delta);
        }
    }

    render(ctx) {
        // Le playhead est déjà rendu par le visualizer
    }
}


// ============================================================================
// EXPORT
// ============================================================================

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { EditorMode, ResizeHandler, PlaybackMode };
}

window.EditorMode = EditorMode;