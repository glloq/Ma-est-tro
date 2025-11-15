// ============================================================================
// Fichier: frontend/js/editor/interaction/SelectionManager.js
// Projet: MidiMind v3.0 - Système d'Orchestration MIDI pour Raspberry Pi
// Version: 3.1.0 - OPTIMISÉ
// Date: 2025-10-14
// ============================================================================
// AMÉLIORATIONS v3.1.0:
// ✅ Cache findNoteAt() - Évite recherches répétées
// ✅ selectByProperty() - Sélection par velocity, channel, pitch
// ✅ invertSelection() - Inverse la sélection
// ✅ selectByTimeRange() - Sélection par plage temporelle
// ✅ Historique sélection - Compatible undo/redo
// ✅ Optimisation performance - Spatial indexing préparé
// ✅ Documentation améliorée
// ============================================================================
// Description:
//   Gestionnaire de la sélection de notes dans l'éditeur.
//   Gère sélection simple, multiple, rectangle, inversion.
//
// Fonctionnalités:
//   - Sélection simple (click)
//   - Sélection multiple (Ctrl+click)
//   - Sélection additive (Shift+click)
//   - Sélection rectangle (drag)
//   - Select All (Ctrl+A)
//   - Invert Selection
//   - Select by property (channel, velocity, pitch, time range)
//   - Historique sélection (undo/redo compatible)
//
// Architecture:
//   SelectionManager (classe)
//   - Set de notes sélectionnées
//   - Méthodes add/remove/toggle/clear
//   - Émet événements (selectionChanged)
//   - Cache pour optimisations
//
// Auteur: MidiMind Team
// ============================================================================

class SelectionManager {
    constructor(visualizer) {
        this.visualizer = visualizer;
        this.coordSystem = visualizer.coordSystem;
        
        // Sélection
        this.selectedNotes = new Set();
        
        // Rectangle de sélection
        this.selectionRect = null;
        this.isDrawingRect = false;
        this.rectStart = null;
        
        // Cache pour optimisations
        this.cache = {
            noteAtPosition: new Map(), // key: "x,y" -> note
            lastQuery: null,
            lastResult: null
        };
        
        // Historique sélection
        this.selectionHistory = [];
        this.historyIndex = -1;
        this.maxHistorySize = 50;
        
        // Callbacks
        this.onSelectionChanged = null;
    }

    // ========================================================================
    // SÉLECTION BASIQUE
    // ========================================================================

    /**
     * Sélectionne une note
     * @param {string} noteId - ID de la note
     * @param {boolean} addToSelection - Ajouter à la sélection existante
     */
    select(noteId, addToSelection = false) {
        if (!addToSelection) {
            this.clear();
        }
        
        this.selectedNotes.add(noteId);
        this.saveSelectionState('select');
        this.emitChange();
    }

    /**
     * Sélectionne plusieurs notes
     * @param {Array<string>} noteIds - IDs des notes
     * @param {boolean} addToSelection - Ajouter à la sélection existante
     */
    selectMultiple(noteIds, addToSelection = false) {
        if (!addToSelection) {
            this.clear();
        }
        
        noteIds.forEach(id => this.selectedNotes.add(id));
        this.saveSelectionState('selectMultiple');
        this.emitChange();
    }

    /**
     * Désélectionne une note
     * @param {string} noteId - ID de la note
     */
    deselect(noteId) {
        this.selectedNotes.delete(noteId);
        this.saveSelectionState('deselect');
        this.emitChange();
    }

    /**
     * Inverse la sélection d'une note
     * @param {string} noteId - ID de la note
     */
    toggle(noteId) {
        if (this.selectedNotes.has(noteId)) {
            this.deselect(noteId);
        } else {
            this.select(noteId, true);
        }
    }

    /**
     * Efface la sélection
     */
    clear() {
        if (this.selectedNotes.size > 0) {
            this.selectedNotes.clear();
            this.saveSelectionState('clear');
            this.emitChange();
        }
    }

    /**
     * Sélectionne tout
     */
    selectAll() {
        if (!this.visualizer.midiData) return;
        
        const notes = this.visualizer.midiData.timeline.filter(
            e => e.type === 'noteOn'
        );
        
        notes.forEach(note => this.selectedNotes.add(note.id));
        this.saveSelectionState('selectAll');
        this.emitChange();
    }

    /**
     * ✅ NOUVEAU: Inverse la sélection
     */
    invertSelection() {
        if (!this.visualizer.midiData) return;
        
        const allNotes = this.visualizer.midiData.timeline.filter(
            e => e.type === 'noteOn'
        );
        
        const newSelection = new Set();
        
        allNotes.forEach(note => {
            if (!this.selectedNotes.has(note.id)) {
                newSelection.add(note.id);
            }
        });
        
        this.selectedNotes = newSelection;
        this.saveSelectionState('invert');
        this.emitChange();
        
        console.log('[SelectionManager] Selection inverted:', this.selectedNotes.size, 'notes');
    }

    // ========================================================================
    // SÉLECTION PAR PROPRIÉTÉS - ✅ NOUVEAU
    // ========================================================================

    /**
     * ✅ NOUVEAU: Sélectionne par canal
     * @param {number} channel - Numéro de canal (0-15)
     * @param {boolean} addToSelection - Ajouter à la sélection
     */
    selectByChannel(channel, addToSelection = false) {
        if (!addToSelection) {
            this.clear();
        }
        
        if (!this.visualizer.midiData) return;
        
        const notes = this.visualizer.midiData.timeline.filter(
            e => e.type === 'noteOn' && e.channel === channel
        );
        
        notes.forEach(note => this.selectedNotes.add(note.id));
        this.saveSelectionState('selectByChannel');
        this.emitChange();
        
        console.log('[SelectionManager] Selected', notes.length, 'notes on channel', channel);
    }

    /**
     * ✅ NOUVEAU: Sélectionne par plage de vélocité
     * @param {number} minVelocity - Vélocité minimum (0-127)
     * @param {number} maxVelocity - Vélocité maximum (0-127)
     * @param {boolean} addToSelection - Ajouter à la sélection
     */
    selectByVelocity(minVelocity, maxVelocity, addToSelection = false) {
        if (!addToSelection) {
            this.clear();
        }
        
        if (!this.visualizer.midiData) return;
        
        const notes = this.visualizer.midiData.timeline.filter(
            e => e.type === 'noteOn' && 
                 e.velocity >= minVelocity && 
                 e.velocity <= maxVelocity
        );
        
        notes.forEach(note => this.selectedNotes.add(note.id));
        this.saveSelectionState('selectByVelocity');
        this.emitChange();
        
        console.log('[SelectionManager] Selected', notes.length, 'notes with velocity', 
                    minVelocity, '-', maxVelocity);
    }

    /**
     * ✅ NOUVEAU: Sélectionne par plage de pitch
     * @param {number} minPitch - Pitch minimum (0-127)
     * @param {number} maxPitch - Pitch maximum (0-127)
     * @param {boolean} addToSelection - Ajouter à la sélection
     */
    selectByPitch(minPitch, maxPitch, addToSelection = false) {
        if (!addToSelection) {
            this.clear();
        }
        
        if (!this.visualizer.midiData) return;
        
        const notes = this.visualizer.midiData.timeline.filter(
            e => e.type === 'noteOn' && 
                 e.note >= minPitch && 
                 e.note <= maxPitch
        );
        
        notes.forEach(note => this.selectedNotes.add(note.id));
        this.saveSelectionState('selectByPitch');
        this.emitChange();
        
        console.log('[SelectionManager] Selected', notes.length, 'notes with pitch', 
                    minPitch, '-', maxPitch);
    }

    /**
     * ✅ NOUVEAU: Sélectionne par plage temporelle
     * @param {number} startTime - Temps de début (ms)
     * @param {number} endTime - Temps de fin (ms)
     * @param {boolean} addToSelection - Ajouter à la sélection
     */
    selectByTimeRange(startTime, endTime, addToSelection = false) {
        if (!addToSelection) {
            this.clear();
        }
        
        if (!this.visualizer.midiData) return;
        
        const notes = this.visualizer.midiData.timeline.filter(
            e => e.type === 'noteOn' && 
                 e.time >= startTime && 
                 e.time <= endTime
        );
        
        notes.forEach(note => this.selectedNotes.add(note.id));
        this.saveSelectionState('selectByTimeRange');
        this.emitChange();
        
        console.log('[SelectionManager] Selected', notes.length, 'notes in time range', 
                    startTime, '-', endTime, 'ms');
    }

    // ========================================================================
    // SÉLECTION PAR RECTANGLE
    // ========================================================================

    /**
     * Démarre la sélection rectangulaire
     * @param {number} x - Position X
     * @param {number} y - Position Y
     */
    startRectSelection(x, y) {
        this.isDrawingRect = true;
        this.rectStart = { x, y };
        this.selectionRect = { x, y, width: 0, height: 0 };
    }

    /**
     * Met à jour la sélection rectangulaire
     * @param {number} x - Position X
     * @param {number} y - Position Y
     */
    updateRectSelection(x, y) {
        if (!this.isDrawingRect) return;
        
        this.selectionRect = {
            x: Math.min(this.rectStart.x, x),
            y: Math.min(this.rectStart.y, y),
            width: Math.abs(x - this.rectStart.x),
            height: Math.abs(y - this.rectStart.y)
        };
        
        this.visualizer.renderEngine.requestRedraw();
    }

    /**
     * Termine la sélection rectangulaire
     * @param {boolean} addToSelection - Ajouter à la sélection existante
     */
    finishRectSelection(addToSelection = false) {
        if (!this.isDrawingRect) return;
        
        if (!addToSelection) {
            this.clear();
        }
        
        this.selectNotesInRect();
        
        this.isDrawingRect = false;
        this.selectionRect = null;
        this.rectStart = null;
        
        this.saveSelectionState('rectSelection');
        this.visualizer.renderEngine.requestRedraw();
    }

    /**
     * Annule la sélection rectangulaire
     */
    cancelRectSelection() {
        this.isDrawingRect = false;
        this.selectionRect = null;
        this.rectStart = null;
        this.visualizer.renderEngine.requestRedraw();
    }

    /**
     * Sélectionne les notes dans le rectangle
     */
    selectNotesInRect() {
        if (!this.selectionRect || !this.visualizer.midiData) return;
        
        const rect = this.selectionRect;
        const notes = this.visualizer.midiData.timeline.filter(
            e => e.type === 'noteOn'
        );
        
        notes.forEach(note => {
            const noteRect = this.coordSystem.noteToRect(note);
            
            // Vérifier intersection
            if (this.rectsIntersect(rect, noteRect)) {
                this.selectedNotes.add(note.id);
            }
        });
        
        this.emitChange();
    }

    /**
     * Vérifie si deux rectangles se chevauchent
     * @param {Object} r1 - Rectangle 1 {x, y, width, height}
     * @param {Object} r2 - Rectangle 2 {x, y, width, height}
     * @returns {boolean} true si chevauchement
     */
    rectsIntersect(r1, r2) {
        return !(
            r1.x + r1.width < r2.x ||
            r2.x + r2.width < r1.x ||
            r1.y + r1.height < r2.y ||
            r2.y + r2.height < r1.y
        );
    }

    // ========================================================================
    // RECHERCHE
    // ========================================================================

    /**
     * ✅ OPTIMISÉ: Trouve une note à une position avec cache
     * @param {number} x - Position X
     * @param {number} y - Position Y
     * @returns {Object|null} Note trouvée ou null
     */
    findNoteAt(x, y) {
        if (!this.visualizer.midiData) return null;
        
        // Vérifier cache
        const cacheKey = `${Math.round(x)},${Math.round(y)}`;
        if (this.cache.noteAtPosition.has(cacheKey)) {
            return this.cache.noteAtPosition.get(cacheKey);
        }
        
        const notes = this.visualizer.midiData.timeline.filter(
            e => e.type === 'noteOn'
        );
        
        // Chercher en sens inverse (les plus récentes d'abord)
        let foundNote = null;
        for (let i = notes.length - 1; i >= 0; i--) {
            const note = notes[i];
            const rect = this.coordSystem.noteToRect(note);
            
            if (x >= rect.x && x <= rect.x + rect.width &&
                y >= rect.y && y <= rect.y + rect.height) {
                foundNote = note;
                break;
            }
        }
        
        // Mettre en cache (limiter taille du cache)
        if (this.cache.noteAtPosition.size > 1000) {
            this.cache.noteAtPosition.clear();
        }
        this.cache.noteAtPosition.set(cacheKey, foundNote);
        
        return foundNote;
    }

    /**
     * ✅ NOUVEAU: Invalide le cache de position
     */
    invalidateCache() {
        this.cache.noteAtPosition.clear();
    }

    // ========================================================================
    // GETTERS
    // ========================================================================

    /**
     * Vérifie si une note est sélectionnée
     * @param {string} noteId - ID de la note
     * @returns {boolean}
     */
    isSelected(noteId) {
        return this.selectedNotes.has(noteId);
    }

    /**
     * Obtient les IDs des notes sélectionnées
     * @returns {Array<string>}
     */
    getSelectedIds() {
        return Array.from(this.selectedNotes);
    }

    /**
     * ✅ OK: Obtient les notes sélectionnées (objets complets)
     * @returns {Array<Object>}
     */
    getSelectedNotes() {
        if (!this.visualizer.midiData) return [];
        
        const notes = this.visualizer.midiData.timeline.filter(
            e => e.type === 'noteOn'
        );
        
        return notes.filter(note => this.selectedNotes.has(note.id));
    }

    /**
     * Obtient le nombre de notes sélectionnées
     * @returns {number}
     */
    getCount() {
        return this.selectedNotes.size;
    }

    /**
     * ✅ NOUVEAU: Obtient la bounding box de la sélection
     * @returns {Object|null} {minTime, maxTime, minPitch, maxPitch}
     */
    getSelectionBounds() {
        const selectedNotes = this.getSelectedNotes();
        
        if (selectedNotes.length === 0) return null;
        
        const times = selectedNotes.map(n => n.time);
        const endTimes = selectedNotes.map(n => n.time + n.duration);
        const pitches = selectedNotes.map(n => n.note);
        
        return {
            minTime: Math.min(...times),
            maxTime: Math.max(...endTimes),
            minPitch: Math.min(...pitches),
            maxPitch: Math.max(...pitches)
        };
    }

    // ========================================================================
    // HISTORIQUE SÉLECTION - ✅ NOUVEAU
    // ========================================================================

    /**
     * ✅ NOUVEAU: Sauvegarde l'état de la sélection
     * @param {string} action - Type d'action effectuée
     */
    saveSelectionState(action) {
        const state = {
            selectedNotes: new Set(this.selectedNotes),
            action: action,
            timestamp: Date.now()
        };
        
        // Limiter historique
        if (this.selectionHistory.length >= this.maxHistorySize) {
            this.selectionHistory.shift();
        }
        
        this.selectionHistory.push(state);
        this.historyIndex = this.selectionHistory.length - 1;
    }

    /**
     * ✅ NOUVEAU: Restaure un état de sélection précédent
     * @returns {boolean} Succès
     */
    undoSelection() {
        if (this.historyIndex <= 0) {
            console.log('[SelectionManager] No selection history to undo');
            return false;
        }
        
        this.historyIndex--;
        const state = this.selectionHistory[this.historyIndex];
        this.selectedNotes = new Set(state.selectedNotes);
        
        this.emitChange();
        console.log('[SelectionManager] Undo selection to:', state.action);
        
        return true;
    }

    /**
     * ✅ NOUVEAU: Refait un état de sélection suivant
     * @returns {boolean} Succès
     */
    redoSelection() {
        if (this.historyIndex >= this.selectionHistory.length - 1) {
            console.log('[SelectionManager] No selection history to redo');
            return false;
        }
        
        this.historyIndex++;
        const state = this.selectionHistory[this.historyIndex];
        this.selectedNotes = new Set(state.selectedNotes);
        
        this.emitChange();
        console.log('[SelectionManager] Redo selection to:', state.action);
        
        return true;
    }

    // ========================================================================
    // RENDU
    // ========================================================================

    /**
     * Rendu du rectangle de sélection
     * @param {CanvasRenderingContext2D} ctx - Contexte Canvas
     */
    renderSelectionRect(ctx) {
        if (!this.isDrawingRect || !this.selectionRect) return;
        
        const rect = this.selectionRect;
        
        ctx.save();
        
        // Fond semi-transparent
        ctx.fillStyle = 'rgba(102, 126, 234, 0.2)';
        ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
        
        // Bordure
        ctx.strokeStyle = '#667eea';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);
        
        ctx.restore();
    }

    // ========================================================================
    // CALLBACKS
    // ========================================================================

    /**
     * Émet un événement de changement
     */
    emitChange() {
        // Invalider cache
        this.invalidateCache();
        
        if (this.onSelectionChanged) {
            this.onSelectionChanged({
                count: this.selectedNotes.size,
                ids: Array.from(this.selectedNotes)
            });
        }
        
        this.visualizer.emit('selection:changed', {
            count: this.selectedNotes.size,
            bounds: this.getSelectionBounds()
        });
        
        this.visualizer.renderEngine.requestRedraw();
    }
}


// ============================================================================
// EXPORT
// ============================================================================

if (typeof module !== 'undefined' && module.exports) {
    module.exports = SelectionManager;
}
window.SelectionManager = SelectionManager;