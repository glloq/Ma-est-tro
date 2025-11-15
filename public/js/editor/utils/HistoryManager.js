// ============================================================================
// Fichier: frontend/js/editor/utils/HistoryManager.js
// Projet: MidiMind v3.0 - Système d'Orchestration MIDI pour Raspberry Pi
// Version: 3.0.0
// Date: 2025-10-14
// ============================================================================
// Description:
//   Gestionnaire d'historique Undo/Redo pour l'éditeur MIDI.
//   Implémente le pattern Command pour toutes les actions éditables.
//
// Fonctionnalités:
//   - Undo (Ctrl+Z) : Annuler dernière action
//   - Redo (Ctrl+Y) : Refaire action annulée
//   - Historique illimité (ou limité configurable)
//   - Actions groupées (batch operations)
//   - Fusion actions similaires (ex: 10 déplacements → 1)
//   - Sauvegarde/restore historique
//   - Indicateurs undo/redo disponibles
//
// Architecture:
//   HistoryManager (classe)
//   - Pattern Command (actions execute/undo)
//   - Stack d'actions (undo stack + redo stack)
//   - Batching pour performance
//
// Auteur: MidiMind Team
// ============================================================================

class HistoryManager {
    constructor(visualizer, config = {}) {
        this.visualizer = visualizer;
        
        // Configuration
        this.config = {
            maxHistorySize: config.maxHistorySize || 100,
            groupDelay: config.groupDelay || 500, // ms pour grouper les actions
            ...config
        };
        
        // Piles d'historique
        this.undoStack = [];
        this.redoStack = [];
        
        // État
        this.isUndoing = false;
        this.isRedoing = false;
        this.lastActionTime = 0;
        this.lastActionType = null;
        
        // Groupement d'actions
        this.actionGroup = null;
        this.groupTimer = null;
    }

    // ========================================================================
    // ENREGISTREMENT D'ACTIONS
    // ========================================================================

    /**
     * Enregistre une action dans l'historique
     */
    record(action) {
        if (this.isUndoing || this.isRedoing) {
            return; // Ne pas enregistrer pendant undo/redo
        }
        
        // Valider l'action
        if (!this.validateAction(action)) {
            console.warn('[HistoryManager] Invalid action:', action);
            return;
        }
        
        // Grouper les actions similaires si nécessaire
        if (this.shouldGroupAction(action)) {
            this.addToGroup(action);
            return;
        }
        
        // Ajouter à la pile
        this.pushAction(action);
        
        // Effacer la pile redo
        this.redoStack = [];
        
        // Limiter la taille
        if (this.undoStack.length > this.config.maxHistorySize) {
            this.undoStack.shift();
        }
        
        this.lastActionTime = Date.now();
        this.lastActionType = action.type;
        
        this.visualizer.emit('history:recorded', {
            canUndo: this.canUndo(),
            canRedo: this.canRedo()
        });
    }

    /**
     * Valide une action
     */
    validateAction(action) {
        if (!action || !action.type) return false;
        if (!action.undo || typeof action.undo !== 'function') return false;
        if (!action.redo || typeof action.redo !== 'function') return false;
        return true;
    }

    /**
     * Détermine si une action doit être groupée
     */
    shouldGroupAction(action) {
        if (!this.lastActionType) return false;
        
        const timeDiff = Date.now() - this.lastActionTime;
        if (timeDiff > this.config.groupDelay) return false;
        
        // Grouper seulement certains types d'actions
        const groupableTypes = ['move', 'resize', 'velocity'];
        if (!groupableTypes.includes(action.type)) return false;
        if (this.lastActionType !== action.type) return false;
        
        return true;
    }

    /**
     * Ajoute une action au groupe actuel
     */
    addToGroup(action) {
        if (!this.actionGroup) {
            // Créer un nouveau groupe
            const lastAction = this.undoStack.pop();
            this.actionGroup = {
                type: 'group',
                actions: [lastAction, action],
                undo: () => {
                    for (let i = this.actionGroup.actions.length - 1; i >= 0; i--) {
                        this.actionGroup.actions[i].undo();
                    }
                },
                redo: () => {
                    for (const a of this.actionGroup.actions) {
                        a.redo();
                    }
                }
            };
        } else {
            // Ajouter au groupe existant
            this.actionGroup.actions.push(action);
        }
        
        // Timer pour finaliser le groupe
        clearTimeout(this.groupTimer);
        this.groupTimer = setTimeout(() => {
            if (this.actionGroup) {
                this.pushAction(this.actionGroup);
                this.actionGroup = null;
            }
        }, this.config.groupDelay);
    }

    /**
     * Ajoute une action à la pile
     */
    pushAction(action) {
        this.undoStack.push(action);
    }

    // ========================================================================
    // UNDO / REDO
    // ========================================================================

    /**
     * Annule la dernière action
     */
    undo() {
        if (!this.canUndo()) {
            console.warn('[HistoryManager] Cannot undo');
            return false;
        }
        
        // Finaliser le groupe en cours
        if (this.actionGroup) {
            clearTimeout(this.groupTimer);
            this.pushAction(this.actionGroup);
            this.actionGroup = null;
        }
        
        const action = this.undoStack.pop();
        
        this.isUndoing = true;
        
        try {
            action.undo();
            this.redoStack.push(action);
            
            console.log('[HistoryManager] Undo:', action.type);
            
            this.visualizer.state.modified = true;
            this.visualizer.renderEngine.requestRedraw();
            
            this.visualizer.emit('history:undo', {
                action: action.type,
                canUndo: this.canUndo(),
                canRedo: this.canRedo()
            });
            
            return true;
            
        } catch (error) {
            console.error('[HistoryManager] Undo error:', error);
            return false;
            
        } finally {
            this.isUndoing = false;
        }
    }

    /**
     * Refait la dernière action annulée
     */
    redo() {
        if (!this.canRedo()) {
            console.warn('[HistoryManager] Cannot redo');
            return false;
        }
        
        const action = this.redoStack.pop();
        
        this.isRedoing = true;
        
        try {
            action.redo();
            this.undoStack.push(action);
            
            console.log('[HistoryManager] Redo:', action.type);
            
            this.visualizer.state.modified = true;
            this.visualizer.renderEngine.requestRedraw();
            
            this.visualizer.emit('history:redo', {
                action: action.type,
                canUndo: this.canUndo(),
                canRedo: this.canRedo()
            });
            
            return true;
            
        } catch (error) {
            console.error('[HistoryManager] Redo error:', error);
            return false;
            
        } finally {
            this.isRedoing = false;
        }
    }

    /**
     * Vérifie si on peut annuler
     */
    canUndo() {
        return this.undoStack.length > 0;
    }

    /**
     * Vérifie si on peut refaire
     */
    canRedo() {
        return this.redoStack.length > 0;
    }

    // ========================================================================
    // ACTIONS PRÉDÉFINIES
    // ========================================================================

    /**
     * Crée une action pour l'ajout de notes
     */
    createAddNotesAction(notes) {
        return {
            type: 'add',
            notes: notes.map(n => ({ ...n })), // Clone
            undo: () => {
                const ids = this.notes.map(n => n.id);
                this.visualizer.deleteNotes(ids);
            },
            redo: () => {
                this.notes.forEach(note => {
                    this.visualizer.addNote(note);
                });
            }
        };
    }

    /**
     * Crée une action pour la suppression de notes
     */
    createDeleteNotesAction(notes) {
        return {
            type: 'delete',
            notes: notes.map(n => ({ ...n })), // Clone
            undo: () => {
                this.notes.forEach(note => {
                    this.visualizer.addNote(note);
                });
            },
            redo: () => {
                const ids = this.notes.map(n => n.id);
                this.visualizer.deleteNotes(ids);
            }
        };
    }

    /**
     * Crée une action pour le déplacement de notes
     */
    createMoveNotesAction(notes, deltaTime, deltaNotes) {
        const beforeState = notes.map(n => ({
            id: n.id,
            time: n.time,
            note: n.note
        }));
        
        return {
            type: 'move',
            beforeState: beforeState,
            deltaTime: deltaTime,
            deltaNotes: deltaNotes,
            undo: () => {
                this.beforeState.forEach(state => {
                    const note = this.visualizer.midiData.timeline.find(
                        e => e.id === state.id
                    );
                    if (note) {
                        note.time = state.time;
                        note.note = state.note;
                    }
                });
                this.visualizer.midiData.timeline.sort((a, b) => a.time - b.time);
            },
            redo: () => {
                this.beforeState.forEach(state => {
                    const note = this.visualizer.midiData.timeline.find(
                        e => e.id === state.id
                    );
                    if (note) {
                        note.time = state.time + this.deltaTime;
                        note.note = state.note + this.deltaNotes;
                    }
                });
                this.visualizer.midiData.timeline.sort((a, b) => a.time - b.time);
            }
        };
    }

    /**
     * Crée une action pour le redimensionnement de notes
     */
    createResizeNotesAction(notes, beforeDurations) {
        const afterDurations = notes.map(n => n.duration);
        
        return {
            type: 'resize',
            noteIds: notes.map(n => n.id),
            beforeDurations: beforeDurations,
            afterDurations: afterDurations,
            undo: () => {
                this.noteIds.forEach((id, i) => {
                    const note = this.visualizer.midiData.timeline.find(
                        e => e.id === id
                    );
                    if (note) {
                        note.duration = this.beforeDurations[i];
                    }
                });
            },
            redo: () => {
                this.noteIds.forEach((id, i) => {
                    const note = this.visualizer.midiData.timeline.find(
                        e => e.id === id
                    );
                    if (note) {
                        note.duration = this.afterDurations[i];
                    }
                });
            }
        };
    }

    /**
     * Crée une action pour le changement de vélocité
     */
    createVelocityAction(notes, beforeVelocities, afterVelocities) {
        return {
            type: 'velocity',
            noteIds: notes.map(n => n.id),
            beforeVelocities: beforeVelocities,
            afterVelocities: afterVelocities,
            undo: () => {
                this.noteIds.forEach((id, i) => {
                    const note = this.visualizer.midiData.timeline.find(
                        e => e.id === id
                    );
                    if (note) {
                        note.velocity = this.beforeVelocities[i];
                    }
                });
            },
            redo: () => {
                this.noteIds.forEach((id, i) => {
                    const note = this.visualizer.midiData.timeline.find(
                        e => e.id === id
                    );
                    if (note) {
                        note.velocity = this.afterVelocities[i];
                    }
                });
            }
        };
    }

    /**
     * Crée une action pour le changement de canal
     */
    createChannelChangeAction(notes, beforeChannels, afterChannel) {
        return {
            type: 'channel',
            noteIds: notes.map(n => n.id),
            beforeChannels: beforeChannels,
            afterChannel: afterChannel,
            undo: () => {
                this.noteIds.forEach((id, i) => {
                    const note = this.visualizer.midiData.timeline.find(
                        e => e.id === id
                    );
                    if (note) {
                        note.channel = this.beforeChannels[i];
                    }
                });
            },
            redo: () => {
                this.noteIds.forEach(id => {
                    const note = this.visualizer.midiData.timeline.find(
                        e => e.id === id
                    );
                    if (note) {
                        note.channel = this.afterChannel;
                    }
                });
            }
        };
    }

    // ========================================================================
    // GESTION
    // ========================================================================

    /**
     * Efface tout l'historique
     */
    clear() {
        this.undoStack = [];
        this.redoStack = [];
        this.actionGroup = null;
        clearTimeout(this.groupTimer);
        
        console.log('[HistoryManager] History cleared');
        
        this.visualizer.emit('history:cleared', {
            canUndo: false,
            canRedo: false
        });
    }

    /**
     * Obtient l'état de l'historique
     */
    getState() {
        return {
            canUndo: this.canUndo(),
            canRedo: this.canRedo(),
            undoCount: this.undoStack.length,
            redoCount: this.redoStack.length,
            lastAction: this.undoStack.length > 0 ? 
                this.undoStack[this.undoStack.length - 1].type : null
        };
    }

    /**
     * Sérialise l'historique (pour sauvegarde)
     */
    serialize() {
        // Note: Sérialiser les fonctions est complexe
        // On retourne seulement les métadonnées
        return {
            undoCount: this.undoStack.length,
            redoCount: this.redoStack.length,
            actions: this.undoStack.map(a => ({
                type: a.type,
                timestamp: a.timestamp || Date.now()
            }))
        };
    }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = HistoryManager;
}
window.HistoryManager = HistoryManager;