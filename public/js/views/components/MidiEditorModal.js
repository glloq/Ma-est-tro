// ============================================================================
// Fichier: public/js/views/components/MidiEditorModal.js
// Version: v2.0.0 - Utilise webaudio-pianoroll (g200kg)
// Description: Modale d'édition MIDI avec piano roll webaudio-pianoroll
// ============================================================================

class MidiEditorModal {
    constructor(eventBus, apiClient) {
        this.eventBus = eventBus;
        this.api = apiClient;
        this.logger = window.logger || console;

        this.container = null;
        this.isOpen = false;
        this.pianoRoll = null;

        // État
        this.currentFile = null;
        this.midiData = null;
        this.isDirty = false;
        this.midiParser = new MidiParser();

        // Sequence de notes pour webaudio-pianoroll
        this.sequence = [];
    }

    // ========================================================================
    // AFFICHAGE DE LA MODALE
    // ========================================================================

    /**
     * Afficher la modale d'édition MIDI
     * @param {string} filePath - Chemin du fichier MIDI à éditer
     */
    async show(filePath) {
        if (this.isOpen) {
            this.log('warn', 'Modal already open');
            return;
        }

        this.currentFile = filePath;
        this.isDirty = false;

        try {
            // Charger le fichier MIDI
            await this.loadMidiFile(filePath);

            // Afficher la modale
            this.render();

            // Initialiser le piano roll
            await this.initPianoRoll();

            this.isOpen = true;

            // Émettre événement
            if (this.eventBus) {
                this.eventBus.emit('midi_editor:opened', { filePath });
            }

        } catch (error) {
            this.log('error', 'Failed to open MIDI editor:', error);
            this.showError(`Impossible d'ouvrir le fichier: ${error.message}`);
        }
    }

    /**
     * Charger le fichier MIDI depuis le backend
     */
    async loadMidiFile(filePath) {
        try {
            this.log('info', `Loading MIDI file: ${filePath}`);

            const response = await this.api.sendCommand('files.read', {
                filename: filePath
            });

            if (!response || !response.midi_data) {
                throw new Error('No MIDI data received from server');
            }

            // Parser les données MIDI
            this.midiData = this.midiParser.parse(response.midi_data);

            // Convertir en sequence pour webaudio-pianoroll
            this.convertMidiToSequence();

            this.log('info', `MIDI file loaded: ${this.midiData.tracks?.length || 0} tracks, ${this.sequence.length} notes`);

        } catch (error) {
            this.log('error', 'Failed to load MIDI file:', error);
            throw error;
        }
    }

    /**
     * Convertir les données MIDI en format sequence pour webaudio-pianoroll
     * Format: [[tick, note, gate, velocity], ...]
     */
    convertMidiToSequence() {
        this.sequence = [];

        if (!this.midiData || !this.midiData.allNotes) {
            return;
        }

        const ticksPerBeat = this.midiData.division || 480;

        this.midiData.allNotes.forEach(note => {
            // Convertir le temps en ticks
            const tick = Math.round((note.startTime || note.time || 0) * ticksPerBeat);
            const notePitch = note.pitch || 60;
            const gate = Math.round((note.duration || 0.5) * ticksPerBeat);
            const velocity = note.velocity || 100;

            this.sequence.push([tick, notePitch, gate, velocity]);
        });

        // Trier par tick
        this.sequence.sort((a, b) => a[0] - b[0]);
    }

    /**
     * Convertir la sequence en données MIDI
     */
    convertSequenceToMidi() {
        if (!this.sequence || this.sequence.length === 0) {
            return null;
        }

        const ticksPerBeat = this.midiData?.division || 480;
        const notes = [];

        this.sequence.forEach(([tick, pitch, gate, velocity]) => {
            notes.push({
                pitch: pitch,
                velocity: velocity,
                time: tick / ticksPerBeat,
                duration: gate / ticksPerBeat,
                channel: 0
            });
        });

        return {
            format: this.midiData?.format || 1,
            division: ticksPerBeat,
            tracks: [{
                channel: 0,
                notes: notes
            }]
        };
    }

    /**
     * Sauvegarder le fichier MIDI
     */
    async saveMidiFile() {
        if (!this.isDirty) {
            this.showNotification('Aucune modification à sauvegarder', 'info');
            return;
        }

        if (!this.currentFile || !this.pianoRoll) {
            this.log('error', 'Cannot save: no file or piano roll');
            return;
        }

        try {
            this.log('info', `Saving MIDI file: ${this.currentFile}`);

            // Récupérer la sequence depuis le piano roll
            this.sequence = this.pianoRoll.sequence || [];

            // Convertir en format MIDI
            const midiData = this.convertSequenceToMidi();

            if (!midiData) {
                throw new Error('No MIDI data to save');
            }

            // Envoyer au backend
            const response = await this.api.sendCommand('files.write', {
                filename: this.currentFile,
                midi_data: midiData
            });

            if (response) {
                this.isDirty = false;
                this.updateSaveButton();
                this.showNotification('Fichier sauvegardé avec succès', 'success');

                // Émettre événement
                if (this.eventBus) {
                    this.eventBus.emit('midi_editor:saved', {
                        filePath: this.currentFile
                    });
                }
            }

        } catch (error) {
            this.log('error', 'Failed to save MIDI file:', error);
            this.showError(`Erreur de sauvegarde: ${error.message}`);
        }
    }

    // ========================================================================
    // RENDU
    // ========================================================================

    render() {
        // Créer le conteneur de la modale
        this.container = document.createElement('div');
        this.container.className = 'modal-overlay midi-editor-modal';
        this.container.innerHTML = `
            <div class="modal-dialog modal-xl">
                <div class="modal-header">
                    <div class="modal-title">
                        <h3>🎹 Éditeur MIDI</h3>
                        <span class="file-name">${this.escapeHtml(this.currentFile || '')}</span>
                    </div>
                    <button class="modal-close" data-action="close">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="editor-toolbar">
                        <div class="toolbar-group">
                            <label>Mode:
                                <select id="edit-mode">
                                    <option value="dragpoly">Drag Poly (Multi-notes)</option>
                                    <option value="dragmono">Drag Mono</option>
                                    <option value="gridpoly">Grid Poly</option>
                                    <option value="gridmono">Grid Mono</option>
                                </select>
                            </label>
                        </div>
                        <div class="toolbar-group">
                            <button class="btn btn-sm" data-action="zoom-in" title="Zoom horizontal +">H+</button>
                            <button class="btn btn-sm" data-action="zoom-out" title="Zoom horizontal -">H-</button>
                            <button class="btn btn-sm" data-action="vzoom-in" title="Zoom vertical +">V+</button>
                            <button class="btn btn-sm" data-action="vzoom-out" title="Zoom vertical -">V-</button>
                        </div>
                        <div class="toolbar-group">
                            <span class="toolbar-label">Notes: <span id="note-count">${this.sequence.length}</span></span>
                        </div>
                    </div>
                    <div class="piano-roll-container" id="piano-roll-container">
                        <!-- webaudio-pianoroll sera inséré ici -->
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" data-action="close">Fermer</button>
                    <button class="btn btn-primary" data-action="save" id="save-btn">
                        💾 Sauvegarder
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(this.container);

        // Attacher les événements
        this.attachEvents();

        // Fermer avec Escape
        this.escapeHandler = (e) => {
            if (e.key === 'Escape') this.close();
        };
        document.addEventListener('keydown', this.escapeHandler);
    }

    /**
     * Initialiser le piano roll avec webaudio-pianoroll
     */
    async initPianoRoll() {
        const container = document.getElementById('piano-roll-container');
        if (!container) {
            this.log('error', 'Piano roll container not found');
            return;
        }

        // Vérifier que webaudio-pianoroll est chargé
        if (typeof customElements.get('webaudio-pianoroll') === 'undefined') {
            this.showError('La bibliothèque webaudio-pianoroll n\'est pas chargée. Vérifiez que le script est inclus dans index.html.');
            return;
        }

        // Créer l'élément webaudio-pianoroll
        this.pianoRoll = document.createElement('webaudio-pianoroll');

        // Configuration
        const width = container.clientWidth || 1000;
        const height = container.clientHeight || 400;

        this.pianoRoll.setAttribute('width', width);
        this.pianoRoll.setAttribute('height', height);
        this.pianoRoll.setAttribute('editmode', 'dragpoly');
        this.pianoRoll.setAttribute('xrange', '128'); // 128 ticks visible
        this.pianoRoll.setAttribute('yrange', '36'); // 3 octaves
        this.pianoRoll.setAttribute('grid', '16'); // 16th notes
        this.pianoRoll.setAttribute('wheelzoom', '1');
        this.pianoRoll.setAttribute('xscroll', '1');
        this.pianoRoll.setAttribute('yscroll', '1');
        this.pianoRoll.setAttribute('markstart', '0');
        this.pianoRoll.setAttribute('markend', '128');

        // Charger la sequence
        if (this.sequence && this.sequence.length > 0) {
            this.pianoRoll.sequence = this.sequence;
        }

        // Ajouter au conteneur
        container.appendChild(this.pianoRoll);

        // Écouter les changements
        this.pianoRoll.addEventListener('change', () => {
            this.isDirty = true;
            this.updateSaveButton();
            this.updateStats();
        });

        // Attendre que le composant soit prêt
        await new Promise(resolve => setTimeout(resolve, 100));

        // Forcer un redraw
        if (this.pianoRoll.redraw) {
            this.pianoRoll.redraw();
        }

        this.updateStats();
    }

    /**
     * Mettre à jour les statistiques affichées
     */
    updateStats() {
        if (!this.pianoRoll) return;

        const noteCountEl = document.getElementById('note-count');

        if (noteCountEl) {
            const sequence = this.pianoRoll.sequence || [];
            noteCountEl.textContent = sequence.length;
        }
    }

    /**
     * Mettre à jour le bouton de sauvegarde
     */
    updateSaveButton() {
        const saveBtn = document.getElementById('save-btn');
        if (saveBtn) {
            if (this.isDirty) {
                saveBtn.classList.add('btn-warning');
                saveBtn.innerHTML = '💾 Sauvegarder *';
            } else {
                saveBtn.classList.remove('btn-warning');
                saveBtn.innerHTML = '💾 Sauvegarder';
            }
        }
    }

    // ========================================================================
    // ÉVÉNEMENTS
    // ========================================================================

    attachEvents() {
        if (!this.container) return;

        // Clic sur fond pour fermer
        this.container.addEventListener('click', (e) => {
            if (e.target === this.container) {
                this.close();
            }
        });

        // Boutons d'action
        this.container.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-action]');
            if (!btn) return;

            const action = btn.dataset.action;

            switch (action) {
                case 'close':
                    this.close();
                    break;
                case 'save':
                    this.saveMidiFile();
                    break;
                case 'zoom-in':
                    this.zoomHorizontal(0.8);
                    break;
                case 'zoom-out':
                    this.zoomHorizontal(1.2);
                    break;
                case 'vzoom-in':
                    this.zoomVertical(0.8);
                    break;
                case 'vzoom-out':
                    this.zoomVertical(1.2);
                    break;
            }
        });

        // Changement de mode d'édition
        const editModeSelect = document.getElementById('edit-mode');
        if (editModeSelect) {
            editModeSelect.addEventListener('change', (e) => {
                if (this.pianoRoll) {
                    this.pianoRoll.setAttribute('editmode', e.target.value);
                }
            });
        }
    }

    /**
     * Zoom horizontal
     */
    zoomHorizontal(factor) {
        if (!this.pianoRoll) return;

        const currentRange = parseInt(this.pianoRoll.getAttribute('xrange')) || 128;
        const newRange = Math.max(16, Math.min(512, Math.round(currentRange * factor)));
        this.pianoRoll.setAttribute('xrange', newRange);
    }

    /**
     * Zoom vertical
     */
    zoomVertical(factor) {
        if (!this.pianoRoll) return;

        const currentRange = parseInt(this.pianoRoll.getAttribute('yrange')) || 36;
        const newRange = Math.max(12, Math.min(88, Math.round(currentRange * factor)));
        this.pianoRoll.setAttribute('yrange', newRange);
    }

    // ========================================================================
    // FERMETURE
    // ========================================================================

    /**
     * Fermer la modale
     */
    close() {
        // Vérifier les modifications non sauvegardées
        if (this.isDirty) {
            const confirmClose = confirm(
                'Vous avez des modifications non sauvegardées.\n\n' +
                'Voulez-vous vraiment fermer l\'éditeur ?'
            );
            if (!confirmClose) return;
        }

        // Nettoyer le piano roll
        if (this.pianoRoll) {
            this.pianoRoll.remove();
            this.pianoRoll = null;
        }

        // Retirer l'événement escape
        if (this.escapeHandler) {
            document.removeEventListener('keydown', this.escapeHandler);
            this.escapeHandler = null;
        }

        // Retirer le conteneur
        if (this.container) {
            this.container.remove();
            this.container = null;
        }

        this.isOpen = false;
        this.currentFile = null;
        this.midiData = null;
        this.isDirty = false;
        this.sequence = [];

        // Émettre événement
        if (this.eventBus) {
            this.eventBus.emit('midi_editor:closed', {});
        }
    }

    // ========================================================================
    // UTILITAIRES
    // ========================================================================

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    showNotification(message, type = 'info') {
        if (window.app?.notifications) {
            window.app.notifications.show('Éditeur MIDI', message, type, 3000);
        } else {
            this.log('info', message);
        }
    }

    showError(message) {
        if (window.app?.notifications) {
            window.app.notifications.show('Erreur', message, 'error', 5000);
        } else {
            this.log('error', message);
            alert(message);
        }
    }

    log(level, ...args) {
        const prefix = '[MidiEditorModal]';
        if (typeof this.logger[level] === 'function') {
            this.logger[level](prefix, ...args);
        } else {
            console[level](prefix, ...args);
        }
    }
}

// ============================================================================
// EXPORT
// ============================================================================

if (typeof module !== 'undefined' && module.exports) {
    module.exports = MidiEditorModal;
}

if (typeof window !== 'undefined') {
    window.MidiEditorModal = MidiEditorModal;
}
