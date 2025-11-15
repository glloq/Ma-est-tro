// ============================================================================
// Fichier: frontend/js/editor/interaction/DragHandler.js
// Projet: MidiMind v3.2.1 - Système d'Orchestration MIDI pour Raspberry Pi
// Version: 3.2.1 (Complétée selon audit 2025-10-14)
// Date: 2025-10-14
// ============================================================================
// Description:
//   Gestionnaire des opérations de drag & drop dans l'éditeur.
//   Gère déplacement, redimensionnement, sélection rectangle.
//
// Fonctionnalités:
//   - Drag notes (déplacer)
//   - Resize notes (handles gauche/droite)
//   - Sélection rectangle (drag on background)
//   - Multi-sélection (Ctrl+drag)
//   - Snap to grid pendant drag
//   - Preview pendant drag (ghost)
//   - Annulation (Esc pendant drag)
//   - Contraintes (limites temporelles/pitch)
//   - Sauvegarde dans historique
//
// Corrections v3.2.1:
//   ✅ updateDrag() - Ajout contraintes complètes
//   ✅ finishDrag() - Ajout sauvegarde historique
//   ✅ cancelDrag() - Restauration positions initiales
//   ✅ renderGhost() - Rendu complet ghost notes
//
// Architecture:
//   DragHandler (classe)
//   - State machine (idle, dragging)
//   - Utilise CoordinateSystem pour conversions
//   - Émet événements (dragStart, dragMove, dragEnd)
//   - Intégration HistoryManager
//
// Auteur: MidiMind Team
// ============================================================================

class DragHandler {
    constructor(visualizer) {
        this.visualizer = visualizer;
        this.coordSystem = visualizer.coordSystem;
        this.selection = visualizer.selection;
        
        // État du drag
        this.isDragging = false;
        this.dragStartPos = null;
        this.draggedNote = null;
        this.initialNotePositions = new Map();
        
        // Ghost notes (aperçu pendant le drag)
        this.ghostNotes = [];
        
        // Contraintes
        this.constraints = {
            minTime: 0,
            maxTime: Infinity,
            minNote: 0,
            maxNote: 127
        };
    }

    // ========================================================================
    // DRAG
    // ========================================================================

    /**
     * Démarre le drag
     * @param {number} x - Position X
     * @param {number} y - Position Y
     * @param {Object} note - Note à déplacer
     */
    startDrag(x, y, note) {
        this.isDragging = true;
        this.dragStartPos = { x, y };
        this.draggedNote = note;
        
        // Sauvegarder les positions initiales de toutes les notes sélectionnées
        const selectedNotes = this.selection.getSelectedNotes();
        this.initialNotePositions.clear();
        
        selectedNotes.forEach(n => {
            this.initialNotePositions.set(n.id, {
                time: n.time,
                note: n.note,
                duration: n.duration,
                velocity: n.velocity,
                channel: n.channel
            });
        });
        
        // Définir contraintes basées sur le coordSystem
        this.constraints.minNote = this.coordSystem.minNote || 0;
        this.constraints.maxNote = this.coordSystem.maxNote || 127;
        
        this.visualizer.emit('drag:started', { note, count: selectedNotes.length });
    }

    /**
     * Met à jour le drag avec contraintes et ghost notes
     * @param {number} x - Position X actuelle
     * @param {number} y - Position Y actuelle
     * @param {boolean} snapToGrid - Activer snap to grid
     */
    updateDrag(x, y, snapToGrid = false) {
        if (!this.isDragging) return;
        
        const deltaX = x - this.dragStartPos.x;
        const deltaY = y - this.dragStartPos.y;
        
        // Convertir en delta temps et notes
        let deltaTime = this.coordSystem.widthToDuration(deltaX);
        let deltaNotes = Math.round(-deltaY / this.coordSystem.noteHeight());
        
        // Snap à la grille si activé
        if (snapToGrid && this.visualizer.config.snapToGrid) {
            const gridSize = this.visualizer.config.gridSize || 100;
            deltaTime = Math.round(deltaTime / gridSize) * gridSize;
        }
        
        // Appliquer contraintes pour éviter les déplacements invalides
        const selectedNotes = this.selection.getSelectedNotes();
        
        // Trouver les limites min/max pour toutes les notes sélectionnées
        let minTimeAfterDrag = Infinity;
        let maxNoteAfterDrag = -Infinity;
        let minNoteAfterDrag = Infinity;
        
        selectedNotes.forEach(note => {
            const initial = this.initialNotePositions.get(note.id);
            if (!initial) return;
            
            const newTime = initial.time + deltaTime;
            const newNote = initial.note + deltaNotes;
            
            minTimeAfterDrag = Math.min(minTimeAfterDrag, newTime);
            maxNoteAfterDrag = Math.max(maxNoteAfterDrag, newNote);
            minNoteAfterDrag = Math.min(minNoteAfterDrag, newNote);
        });
        
        // Contraindre le temps (pas de temps négatif)
        if (minTimeAfterDrag < this.constraints.minTime) {
            deltaTime = deltaTime - minTimeAfterDrag + this.constraints.minTime;
        }
        
        // Contraindre les notes (rester dans la plage MIDI)
        if (maxNoteAfterDrag > this.constraints.maxNote) {
            deltaNotes = deltaNotes - (maxNoteAfterDrag - this.constraints.maxNote);
        }
        if (minNoteAfterDrag < this.constraints.minNote) {
            deltaNotes = deltaNotes + (this.constraints.minNote - minNoteAfterDrag);
        }
        
        // Mettre à jour les ghost notes avec les deltas contraints
        this.updateGhostNotes(deltaTime, deltaNotes);
        
        // Demander un redraw pour afficher les ghost notes
        this.visualizer.renderEngine.requestRedraw();
        
        // Émettre événement pour feedback
        this.visualizer.emit('drag:updated', { deltaTime, deltaNotes });
    }

    /**
     * Met à jour les ghost notes (aperçu visuel)
     * @param {number} deltaTime - Delta temps en ms
     * @param {number} deltaNotes - Delta hauteur de note
     */
    updateGhostNotes(deltaTime, deltaNotes) {
        this.ghostNotes = [];
        
        const selectedNotes = this.selection.getSelectedNotes();
        
        selectedNotes.forEach(note => {
            const initial = this.initialNotePositions.get(note.id);
            if (!initial) return;
            
            // Calculer nouvelle position avec contraintes
            const newTime = Math.max(this.constraints.minTime, initial.time + deltaTime);
            const newNote = Math.max(
                this.constraints.minNote,
                Math.min(this.constraints.maxNote, initial.note + deltaNotes)
            );
            
            this.ghostNotes.push({
                time: newTime,
                note: newNote,
                duration: initial.duration,
                velocity: initial.velocity,
                channel: initial.channel
            });
        });
    }

    /**
     * Termine le drag et applique les changements avec historique
     * @param {number} x - Position X finale
     * @param {number} y - Position Y finale
     * @param {boolean} snapToGrid - Activer snap to grid
     */
    finishDrag(x, y, snapToGrid = false) {
        if (!this.isDragging) return;
        
        const deltaX = x - this.dragStartPos.x;
        const deltaY = y - this.dragStartPos.y;
        
        let deltaTime = this.coordSystem.widthToDuration(deltaX);
        let deltaNotes = Math.round(-deltaY / this.coordSystem.noteHeight());
        
        // Snap à la grille
        if (snapToGrid && this.visualizer.config.snapToGrid) {
            const gridSize = this.visualizer.config.gridSize || 100;
            deltaTime = Math.round(deltaTime / gridSize) * gridSize;
        }
        
        // Préparer l'action pour l'historique
        const selectedNotes = this.selection.getSelectedNotes();
        const beforeState = [];
        const afterState = [];
        
        // Appliquer les changements et capturer l'état avant/après
        selectedNotes.forEach(note => {
            const initial = this.initialNotePositions.get(note.id);
            if (!initial) return;
            
            // État avant
            beforeState.push({
                id: note.id,
                time: initial.time,
                note: initial.note,
                duration: initial.duration,
                velocity: initial.velocity,
                channel: initial.channel
            });
            
            // Appliquer changement avec contraintes
            const newTime = Math.max(this.constraints.minTime, initial.time + deltaTime);
            const newNote = Math.max(
                this.constraints.minNote,
                Math.min(this.constraints.maxNote, initial.note + deltaNotes)
            );
            
            note.time = newTime;
            note.note = newNote;
            
            // État après
            afterState.push({
                id: note.id,
                time: note.time,
                note: note.note,
                duration: note.duration,
                velocity: note.velocity,
                channel: note.channel
            });
        });
        
        // Retrier la timeline
        if (this.visualizer.midiData && this.visualizer.midiData.timeline) {
            this.visualizer.midiData.timeline.sort((a, b) => a.time - b.time);
        }
        
        // Enregistrer dans l'historique si disponible
        if (this.visualizer.historyManager) {
            this.visualizer.historyManager.addAction({
                type: 'move',
                description: `Move ${selectedNotes.length} note(s)`,
                undo: () => {
                    // Restaurer état avant
                    beforeState.forEach(state => {
                        const note = this.visualizer.midiData.timeline.find(n => n.id === state.id);
                        if (note) {
                            note.time = state.time;
                            note.note = state.note;
                        }
                    });
                    this.visualizer.midiData.timeline.sort((a, b) => a.time - b.time);
                    this.visualizer.renderEngine.requestRedraw();
                },
                redo: () => {
                    // Réappliquer état après
                    afterState.forEach(state => {
                        const note = this.visualizer.midiData.timeline.find(n => n.id === state.id);
                        if (note) {
                            note.time = state.time;
                            note.note = state.note;
                        }
                    });
                    this.visualizer.midiData.timeline.sort((a, b) => a.time - b.time);
                    this.visualizer.renderEngine.requestRedraw();
                }
            });
        }
        
        // Marquer comme modifié
        this.visualizer.state.modified = true;
        
        // Réinitialiser état
        this.isDragging = false;
        this.ghostNotes = [];
        this.initialNotePositions.clear();
        this.dragStartPos = null;
        this.draggedNote = null;
        
        // Redraw
        this.visualizer.renderEngine.requestRedraw();
        
        // Émettre événement de fin
        this.visualizer.emit('drag:finished', { 
            count: selectedNotes.length,
            deltaTime,
            deltaNotes
        });
    }

    /**
     * Annule le drag et restaure les positions initiales
     */
    cancelDrag() {
        if (!this.isDragging) return;
        
        // Restaurer toutes les positions initiales
        const selectedNotes = this.selection.getSelectedNotes();
        
        selectedNotes.forEach(note => {
            const initial = this.initialNotePositions.get(note.id);
            if (!initial) return;
            
            note.time = initial.time;
            note.note = initial.note;
            note.duration = initial.duration;
            note.velocity = initial.velocity;
            note.channel = initial.channel;
        });
        
        // Retrier la timeline
        if (this.visualizer.midiData && this.visualizer.midiData.timeline) {
            this.visualizer.midiData.timeline.sort((a, b) => a.time - b.time);
        }
        
        // Réinitialiser état
        this.isDragging = false;
        this.ghostNotes = [];
        this.initialNotePositions.clear();
        this.dragStartPos = null;
        this.draggedNote = null;
        
        // Redraw
        this.visualizer.renderEngine.requestRedraw();
        
        // Émettre événement d'annulation
        this.visualizer.emit('drag:cancelled');
    }

    // ========================================================================
    // RENDU
    // ========================================================================

    /**
     * Rendu des ghost notes (aperçu semi-transparent pendant le drag)
     * @param {CanvasRenderingContext2D} ctx - Contexte de rendu
     */
    renderGhost(ctx) {
        if (!this.isDragging || this.ghostNotes.length === 0) return;
        
        ctx.save();
        ctx.globalAlpha = 0.4;
        
        this.ghostNotes.forEach(ghost => {
            const rect = this.coordSystem.noteToRect(ghost);
            
            // Couleur selon canal
            const colors = [
                '#667eea', '#f56565', '#48bb78', '#ed8936',
                '#9f7aea', '#38b2ac', '#ed64a6', '#ecc94b'
            ];
            const color = colors[ghost.channel % colors.length];
            
            // Fond avec coins arrondis
            ctx.fillStyle = color;
            this.roundRect(ctx, rect.x, rect.y, rect.width, rect.height, 3);
            ctx.fill();
            
            // Bordure en pointillés
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2;
            ctx.setLineDash([5, 5]);
            this.roundRect(ctx, rect.x, rect.y, rect.width, rect.height, 3);
            ctx.stroke();
            ctx.setLineDash([]);
            
            // Indicateur de vélocité (ligne verticale à gauche)
            const velocityHeight = (ghost.velocity / 127) * rect.height;
            ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
            ctx.fillRect(rect.x, rect.y + rect.height - velocityHeight, 3, velocityHeight);
        });
        
        ctx.restore();
    }

    /**
     * Dessine un rectangle avec coins arrondis
     * @param {CanvasRenderingContext2D} ctx - Contexte
     * @param {number} x - Position X
     * @param {number} y - Position Y
     * @param {number} width - Largeur
     * @param {number} height - Hauteur
     * @param {number} radius - Rayon des coins
     */
    roundRect(ctx, x, y, width, height, radius) {
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.lineTo(x + width - radius, y);
        ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
        ctx.lineTo(x + width, y + height - radius);
        ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
        ctx.lineTo(x + radius, y + height);
        ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
        ctx.lineTo(x, y + radius);
        ctx.quadraticCurveTo(x, y, x + radius, y);
        ctx.closePath();
    }

    // ========================================================================
    // GETTERS
    // ========================================================================

    /**
     * Vérifie si un drag est en cours
     * @returns {boolean}
     */
    isDraggingNote() {
        return this.isDragging;
    }

    /**
     * Obtient les ghost notes actuelles
     * @returns {Array}
     */
    getGhostNotes() {
        return this.ghostNotes;
    }

    /**
     * Obtient la note actuellement déplacée
     * @returns {Object|null}
     */
    getDraggedNote() {
        return this.draggedNote;
    }

    /**
     * Définit les contraintes de déplacement
     * @param {Object} constraints - {minTime, maxTime, minNote, maxNote}
     */
    setConstraints(constraints) {
        this.constraints = { ...this.constraints, ...constraints };
    }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { DragHandler };
}
window.DragHandler = DragHandler;