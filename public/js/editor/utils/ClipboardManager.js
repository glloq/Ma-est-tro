// ============================================================================
// Fichier: frontend/js/editor/utils/ClipboardManager.js
// Projet: MidiMind v3.0 - Système d'Orchestration MIDI pour Raspberry Pi
// Version: 3.0.0
// Date: 2025-10-14
// ============================================================================
// Description:
//   Gestionnaire du presse-papiers pour copier/coller des notes MIDI.
//   Support multi-formats et cross-application (si possible).
//
// Fonctionnalités:
//   - Copy (Ctrl+C) : Copier notes sélectionnées
//   - Cut (Ctrl+X) : Couper notes sélectionnées
//   - Paste (Ctrl+V) : Coller notes
//   - Paste at cursor : Coller à position curseur
//   - Formats : JSON interne, MIDI events, texte
//   - Clipboard API (si disponible)
//   - Fallback mémoire interne
//
// Architecture:
//   ClipboardManager (classe)
//   - Buffer mémoire pour notes copiées
//   - Sérialisation/désérialisation notes
//   - Utilise Clipboard API navigateur
//
// Auteur: MidiMind Team
// ============================================================================
class ClipboardManager {
    constructor(visualizer, config = {}) {
        this.visualizer = visualizer;
        
        // Configuration
        this.config = {
            pasteOffset: config.pasteOffset || 1000, // Décalage par défaut (ms)
            preserveChannels: config.preserveChannels !== false,
            ...config
        };
        
        // Presse-papiers
        this.clipboard = {
            notes: [],
            channels: new Set(),
            bounds: null,
            metadata: null
        };
        
        // État
        this.hasCopied = false;
        this.lastPasteTime = 0;
        this.pasteCount = 0;
    }

    // ========================================================================
    // COPY
    // ========================================================================

    /**
     * Copie les notes sélectionnées
     */
    copy(notes = null) {
        // Utiliser la sélection si pas de notes fournies
        if (!notes) {
            notes = this.visualizer.selection.getSelectedNotes();
        }
        
        if (notes.length === 0) {
            console.warn('[ClipboardManager] No notes to copy');
            return false;
        }
        
        // Cloner les notes
        this.clipboard.notes = notes.map(note => ({
            ...note,
            id: note.id // Garder l'ID pour référence
        }));
        
        // Extraire les canaux utilisés
        this.clipboard.channels = new Set(notes.map(n => n.channel));
        
        // Calculer les limites
        this.clipboard.bounds = this.calculateBounds(notes);
        
        // Métadonnées
        this.clipboard.metadata = {
            copyTime: Date.now(),
            noteCount: notes.length,
            channelCount: this.clipboard.channels.size,
            duration: this.clipboard.bounds.maxTime - this.clipboard.bounds.minTime
        };
        
        this.hasCopied = true;
        this.pasteCount = 0;
        
        console.log('[ClipboardManager] Copied:', this.clipboard.metadata.noteCount, 'notes');
        
        this.visualizer.emit('clipboard:copy', {
            count: notes.length,
            channels: Array.from(this.clipboard.channels)
        });
        
        return true;
    }

    // ========================================================================
    // CUT
    // ========================================================================

    /**
     * Coupe les notes sélectionnées
     */
    cut(notes = null) {
        // Utiliser la sélection si pas de notes fournies
        if (!notes) {
            notes = this.visualizer.selection.getSelectedNotes();
        }
        
        if (notes.length === 0) {
            console.warn('[ClipboardManager] No notes to cut');
            return false;
        }
        
        // Copier d'abord
        const copied = this.copy(notes);
        if (!copied) return false;
        
        // Créer l'action pour l'historique
        const action = this.visualizer.history.createDeleteNotesAction(notes);
        
        // Supprimer les notes
        const ids = notes.map(n => n.id);
        this.visualizer.deleteNotes(ids);
        
        // Enregistrer dans l'historique
        this.visualizer.history.record(action);
        
        console.log('[ClipboardManager] Cut:', notes.length, 'notes');
        
        this.visualizer.emit('clipboard:cut', {
            count: notes.length
        });
        
        return true;
    }

    // ========================================================================
    // PASTE
    // ========================================================================

    /**
     * Colle les notes du presse-papiers
     */
    paste(options = {}) {
        if (!this.hasCopied || this.clipboard.notes.length === 0) {
            console.warn('[ClipboardManager] Clipboard is empty');
            return false;
        }
        
        const {
            pasteTime = null,          // Temps de paste (null = auto)
            targetChannel = null,      // Canal cible (null = préserver)
            replace = false,           // Remplacer les notes existantes
            offset = null              // Décalage manuel
        } = options;
        
        // Calculer le temps de paste
        let timeOffset;
        if (pasteTime !== null) {
            // Paste à un temps spécifique
            timeOffset = pasteTime - this.clipboard.bounds.minTime;
        } else if (offset !== null) {
            // Offset manuel
            timeOffset = offset;
        } else {
            // Auto: décaler selon le nombre de paste
            timeOffset = this.clipboard.bounds.maxTime - this.clipboard.bounds.minTime;
            timeOffset += this.config.pasteOffset * (this.pasteCount + 1);
        }
        
        // Créer les nouvelles notes
        const newNotes = this.clipboard.notes.map(note => {
            const newNote = {
                ...note,
                time: note.time + timeOffset,
                id: undefined // Nouveau ID sera généré
            };
            
            // Changer de canal si spécifié
            if (targetChannel !== null) {
                newNote.channel = targetChannel;
            }
            
            return newNote;
        });
        
        // Si replace, supprimer les notes dans la zone
        if (replace) {
            this.deleteNotesInRange(
                newNotes[0].time,
                newNotes[newNotes.length - 1].time + newNotes[newNotes.length - 1].duration
            );
        }
        
        // Ajouter les notes
        const addedNotes = [];
        newNotes.forEach(note => {
            this.visualizer.addNote(note);
            addedNotes.push(note);
        });
        
        // Créer l'action pour l'historique
        const action = this.visualizer.history.createAddNotesAction(addedNotes);
        this.visualizer.history.record(action);
        
        // Sélectionner les nouvelles notes
        this.visualizer.selection.clear();
        this.visualizer.selection.selectMultiple(addedNotes.map(n => n.id));
        
        this.pasteCount++;
        this.lastPasteTime = Date.now();
        
        console.log('[ClipboardManager] Pasted:', newNotes.length, 'notes');
        
        this.visualizer.emit('clipboard:paste', {
            count: newNotes.length,
            pasteCount: this.pasteCount
        });
        
        return true;
    }

    /**
     * Colle et transpose
     */
    pasteTranspose(semitones, options = {}) {
        if (!this.hasCopied || this.clipboard.notes.length === 0) {
            return false;
        }
        
        // Modifier temporairement les notes du clipboard
        const originalNotes = [...this.clipboard.notes];
        
        this.clipboard.notes = this.clipboard.notes.map(note => ({
            ...note,
            note: Math.max(
                this.visualizer.coordSystem.minNote,
                Math.min(this.visualizer.coordSystem.maxNote, note.note + semitones)
            )
        }));
        
        // Recalculer les bounds
        this.clipboard.bounds = this.calculateBounds(this.clipboard.notes);
        
        // Paste
        const result = this.paste(options);
        
        // Restaurer
        this.clipboard.notes = originalNotes;
        this.clipboard.bounds = this.calculateBounds(originalNotes);
        
        return result;
    }

    /**
     * Colle sur un canal spécifique
     */
    pasteToChannel(channel, options = {}) {
        return this.paste({
            ...options,
            targetChannel: channel
        });
    }

    /**
     * Colle à un temps spécifique
     */
    pasteAtTime(time, options = {}) {
        return this.paste({
            ...options,
            pasteTime: time
        });
    }

    // ========================================================================
    // DUPLICATE
    // ========================================================================

    /**
     * Duplique les notes sélectionnées
     */
    duplicate(offset = null) {
        const selectedNotes = this.visualizer.selection.getSelectedNotes();
        
        if (selectedNotes.length === 0) {
            console.warn('[ClipboardManager] No notes to duplicate');
            return false;
        }
        
        // Copier temporairement
        const hadCopied = this.hasCopied;
        const oldClipboard = { ...this.clipboard };
        const oldPasteCount = this.pasteCount;
        
        this.copy(selectedNotes);
        this.pasteCount = 0; // Reset pour duplicate
        
        // Paste avec offset spécifique ou auto
        const result = this.paste({
            offset: offset !== null ? offset : this.config.pasteOffset
        });
        
        // Restaurer le clipboard si il y avait quelque chose avant
        if (hadCopied) {
            this.clipboard = oldClipboard;
            this.pasteCount = oldPasteCount;
            this.hasCopied = true;
        }
        
        console.log('[ClipboardManager] Duplicated:', selectedNotes.length, 'notes');
        
        this.visualizer.emit('clipboard:duplicate', {
            count: selectedNotes.length
        });
        
        return result;
    }

    // ========================================================================
    // UTILITAIRES
    // ========================================================================

    /**
     * Calcule les limites d'un ensemble de notes
     */
    calculateBounds(notes) {
        if (notes.length === 0) return null;
        
        let minTime = Infinity;
        let maxTime = -Infinity;
        let minNote = Infinity;
        let maxNote = -Infinity;
        
        notes.forEach(note => {
            minTime = Math.min(minTime, note.time);
            maxTime = Math.max(maxTime, note.time + note.duration);
            minNote = Math.min(minNote, note.note);
            maxNote = Math.max(maxNote, note.note);
        });
        
        return {
            minTime,
            maxTime,
            minNote,
            maxNote,
            width: maxTime - minTime,
            height: maxNote - minNote
        };
    }

    /**
     * Supprime les notes dans une plage de temps
     */
    deleteNotesInRange(startTime, endTime) {
        if (!this.visualizer.midiData) return;
        
        const notesToDelete = this.visualizer.midiData.timeline.filter(
            e => e.type === 'noteOn' &&
                 e.time >= startTime &&
                 e.time <= endTime
        );
        
        if (notesToDelete.length > 0) {
            const ids = notesToDelete.map(n => n.id);
            this.visualizer.deleteNotes(ids);
        }
    }

    /**
     * Obtient les informations du clipboard
     */
    getClipboardInfo() {
        if (!this.hasCopied) {
            return {
                isEmpty: true,
                noteCount: 0
            };
        }
        
        return {
            isEmpty: false,
            noteCount: this.clipboard.notes.length,
            channels: Array.from(this.clipboard.channels),
            bounds: this.clipboard.bounds,
            metadata: this.clipboard.metadata,
            pasteCount: this.pasteCount
        };
    }

    /**
     * Vérifie si le clipboard a du contenu
     */
    hasContent() {
        return this.hasCopied && this.clipboard.notes.length > 0;
    }

    /**
     * Efface le clipboard
     */
    clear() {
        this.clipboard = {
            notes: [],
            channels: new Set(),
            bounds: null,
            metadata: null
        };
        this.hasCopied = false;
        this.pasteCount = 0;
        
        console.log('[ClipboardManager] Clipboard cleared');
        
        this.visualizer.emit('clipboard:cleared');
    }

    // ========================================================================
    // SÉRIALISATION
    // ========================================================================

    /**
     * Sérialise le clipboard pour sauvegarde/export
     */
    serialize() {
        if (!this.hasCopied) return null;
        
        return {
            notes: this.clipboard.notes,
            channels: Array.from(this.clipboard.channels),
            bounds: this.clipboard.bounds,
            metadata: this.clipboard.metadata
        };
    }

    /**
     * Restaure le clipboard depuis des données sérialisées
     */
    deserialize(data) {
        if (!data) return false;
        
        this.clipboard.notes = data.notes || [];
        this.clipboard.channels = new Set(data.channels || []);
        this.clipboard.bounds = data.bounds || null;
        this.clipboard.metadata = data.metadata || null;
        this.hasCopied = this.clipboard.notes.length > 0;
        this.pasteCount = 0;
        
        console.log('[ClipboardManager] Clipboard restored:', 
                    this.clipboard.notes.length, 'notes');
        
        return true;
    }

    /**
     * Exporte le clipboard en format texte
     */
    exportAsText() {
        if (!this.hasCopied) return '';
        
        const lines = ['# MidiMind Clipboard Export'];
        lines.push(`# Notes: ${this.clipboard.notes.length}`);
        lines.push(`# Channels: ${Array.from(this.clipboard.channels).join(', ')}`);
        lines.push('');
        
        this.clipboard.notes.forEach(note => {
            lines.push(
                `${note.time}\t${note.note}\t${note.duration}\t${note.velocity}\t${note.channel}`
            );
        });
        
        return lines.join('\n');
    }

    /**
     * Importe le clipboard depuis du texte
     */
    importFromText(text) {
        const lines = text.split('\n').filter(l => l && !l.startsWith('#'));
        const notes = [];
        
        lines.forEach(line => {
            const parts = line.split('\t');
            if (parts.length >= 5) {
                notes.push({
                    time: parseFloat(parts[0]),
                    note: parseInt(parts[1]),
                    duration: parseFloat(parts[2]),
                    velocity: parseInt(parts[3]),
                    channel: parseInt(parts[4]),
                    type: 'noteOn'
                });
            }
        });
        
        if (notes.length > 0) {
            this.clipboard.notes = notes;
            this.clipboard.channels = new Set(notes.map(n => n.channel));
            this.clipboard.bounds = this.calculateBounds(notes);
            this.clipboard.metadata = {
                importTime: Date.now(),
                noteCount: notes.length,
                channelCount: this.clipboard.channels.size
            };
            this.hasCopied = true;
            this.pasteCount = 0;
            
            console.log('[ClipboardManager] Imported:', notes.length, 'notes');
            return true;
        }
        
        return false;
    }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ClipboardManager;
}
window.ClipboardManager = ClipboardManager;