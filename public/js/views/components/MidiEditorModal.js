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
        this.currentFile = null;  // fileId
        this.currentFilename = null;  // nom du fichier pour affichage
        this.midiData = null;
        this.isDirty = false;

        // Sequence de notes pour webaudio-pianoroll
        this.sequence = [];
    }

    // ========================================================================
    // AFFICHAGE DE LA MODALE
    // ========================================================================

    /**
     * Afficher la modale d'édition MIDI
     * @param {string} fileId - ID du fichier dans la base de données
     * @param {string} filename - Nom du fichier (optionnel, pour l'affichage)
     */
    async show(fileId, filename = null) {
        if (this.isOpen) {
            this.log('warn', 'Modal already open');
            return;
        }

        this.currentFile = fileId;
        this.currentFilename = filename || fileId;
        this.isDirty = false;

        try {
            // Charger le fichier MIDI
            await this.loadMidiFile(fileId);

            // Afficher la modale
            this.render();

            // Initialiser le piano roll
            await this.initPianoRoll();

            this.isOpen = true;

            // Émettre événement
            if (this.eventBus) {
                this.eventBus.emit('midi_editor:opened', { fileId, filename: this.currentFilename });
            }

        } catch (error) {
            this.log('error', 'Failed to open MIDI editor:', error);
            this.showError(`Impossible d'ouvrir le fichier: ${error.message}`);
        }
    }

    /**
     * Charger le fichier MIDI depuis le backend
     */
    async loadMidiFile(fileId) {
        try {
            this.log('info', `Loading MIDI file: ${this.currentFilename || fileId}`);

            // Utiliser la nouvelle méthode readMidiFile du BackendAPIClient
            const response = await this.api.readMidiFile(fileId);

            if (!response || !response.midiData) {
                throw new Error('No MIDI data received from server');
            }

            // Le backend renvoie un objet avec : { id, filename, midi: {...}, size, tracks, duration, tempo }
            // Extraire les données MIDI proprement dites
            const fileData = response.midiData;
            this.midiData = fileData.midi || fileData;

            // S'assurer qu'on a bien un objet header et tracks
            if (!this.midiData.header || !this.midiData.tracks) {
                throw new Error('Invalid MIDI data structure');
            }

            // Convertir en sequence pour webaudio-pianoroll
            this.convertMidiToSequence();

            this.log('info', `MIDI file loaded: ${this.midiData.tracks?.length || 0} tracks, ${this.sequence.length} notes`);

        } catch (error) {
            this.log('error', 'Failed to load MIDI file:', error);

            // Si l'erreur est "Unknown command", proposer une alternative
            if (error.message.includes('Unknown command') || error.message.includes('file_read')) {
                throw new Error(
                    'Le backend ne supporte pas encore la lecture de fichiers MIDI.\n\n' +
                    'La commande "file_read" doit être ajoutée au backend.\n' +
                    'En attendant, utilisez l\'éditeur classique.'
                );
            }

            throw error;
        }
    }

    /**
     * Convertir les données MIDI en format sequence pour webaudio-pianoroll
     * Format: [[tick, note, gate, velocity], ...]
     */
    convertMidiToSequence() {
        this.sequence = [];

        if (!this.midiData || !this.midiData.tracks) {
            this.log('warn', 'No MIDI tracks to convert');
            return;
        }

        const ticksPerBeat = this.midiData.header?.ticksPerBeat || 480;
        this.log('info', `Converting MIDI: ${this.midiData.tracks.length} tracks, ${ticksPerBeat} ticks/beat`);

        // Extraire toutes les notes de toutes les pistes
        const allNotes = [];

        this.midiData.tracks.forEach((track, trackIndex) => {
            if (!track.events) {
                this.log('debug', `Track ${trackIndex}: no events`);
                return;
            }

            this.log('debug', `Track ${trackIndex} (${track.name || 'unnamed'}): ${track.events.length} events`);

            // Tracker les notes actives pour calculer la durée
            const activeNotes = new Map();
            let currentTick = 0;
            let noteOnCount = 0;
            let noteOffCount = 0;

            track.events.forEach((event, eventIndex) => {
                currentTick += event.deltaTime || 0;

                // Note On
                if (event.type === 'noteOn' && event.velocity > 0) {
                    noteOnCount++;
                    const key = `${event.channel}_${event.noteNumber}`;
                    activeNotes.set(key, {
                        tick: currentTick,
                        note: event.noteNumber,
                        velocity: event.velocity,
                        channel: event.channel || 0
                    });

                    // Log first note on event for debugging
                    if (noteOnCount === 1) {
                        this.log('debug', `First noteOn in track ${trackIndex}:`, {
                            tick: currentTick,
                            note: event.noteNumber,
                            velocity: event.velocity,
                            channel: event.channel
                        });
                    }
                }
                // Note Off
                else if (event.type === 'noteOff' || (event.type === 'noteOn' && event.velocity === 0)) {
                    noteOffCount++;
                    const key = `${event.channel}_${event.noteNumber}`;
                    const noteOn = activeNotes.get(key);

                    if (noteOn) {
                        const gate = currentTick - noteOn.tick;
                        allNotes.push({
                            tick: noteOn.tick,
                            note: noteOn.note,
                            gate: gate,
                            velocity: noteOn.velocity
                        });
                        activeNotes.delete(key);
                    }
                }
            });

            this.log('debug', `Track ${trackIndex} summary: ${noteOnCount} note-ons, ${noteOffCount} note-offs, ${allNotes.length} complete notes`);
        });

        // Convertir en format webaudio-pianoroll: {t: tick, g: gate, n: note}
        this.sequence = allNotes.map(note => ({
            t: note.tick,    // tick (position de départ)
            g: note.gate,    // gate (durée)
            n: note.note     // note (numéro MIDI)
        }));

        // Trier par tick
        this.sequence.sort((a, b) => a.t - b.t);

        this.log('info', `Converted ${this.sequence.length} notes to sequence`);

        if (this.sequence.length === 0) {
            this.log('warn', 'No notes found! Check MIDI data structure.');
        } else {
            this.log('debug', 'Sample notes:', this.sequence.slice(0, 3));
        }
    }

    /**
     * Convertir la sequence en données MIDI pour le backend
     * Format compatible avec la bibliothèque 'midi-file'
     */
    convertSequenceToMidi() {
        if (!this.sequence || this.sequence.length === 0) {
            return null;
        }

        const ticksPerBeat = this.midiData?.header?.ticksPerBeat || 480;

        // Convertir la sequence en événements MIDI
        const events = [];

        // Ajouter les événements de note
        this.sequence.forEach(note => {
            const tick = note.t;
            const noteNumber = note.n;
            const gate = note.g;
            const velocity = note.v || 100; // velocity par défaut si non présente

            // Note On
            events.push({
                absoluteTime: tick,
                type: 'noteOn',
                channel: 0,
                noteNumber: noteNumber,
                velocity: velocity
            });

            // Note Off
            events.push({
                absoluteTime: tick + gate,
                type: 'noteOff',
                channel: 0,
                noteNumber: noteNumber,
                velocity: 0
            });
        });

        // Trier par temps absolu
        events.sort((a, b) => a.absoluteTime - b.absoluteTime);

        // Convertir temps absolu en deltaTime
        let lastTime = 0;
        const trackEvents = events.map(event => {
            const deltaTime = event.absoluteTime - lastTime;
            lastTime = event.absoluteTime;

            return {
                deltaTime: deltaTime,
                type: event.type,
                channel: event.channel,
                noteNumber: event.noteNumber,
                velocity: event.velocity
            };
        });

        // Ajouter End of Track
        trackEvents.push({
            deltaTime: 0,
            type: 'endOfTrack'
        });

        // Structure MIDI compatible avec midi-file
        return {
            header: {
                format: this.midiData?.header?.format || 1,
                numTracks: 1,
                ticksPerBeat: ticksPerBeat
            },
            tracks: [trackEvents]
        };
    }

    /**
     * Sauvegarder le fichier MIDI
     */
    async saveMidiFile() {
        if (!this.currentFile || !this.pianoRoll) {
            this.log('error', 'Cannot save: no file or piano roll');
            this.showError('Impossible de sauvegarder: éditeur non initialisé');
            return;
        }

        try {
            this.log('info', `Saving MIDI file: ${this.currentFile}`);

            // Récupérer la sequence depuis le piano roll
            this.sequence = this.pianoRoll.sequence || [];

            this.log('info', `Sequence length from piano roll: ${this.sequence.length}`);

            if (this.sequence.length === 0) {
                this.showError('Aucune note à sauvegarder');
                return;
            }

            // Convertir en format MIDI
            const midiData = this.convertSequenceToMidi();

            if (!midiData) {
                throw new Error('Échec de conversion en format MIDI');
            }

            this.log('debug', `MIDI data to save: ${midiData.tracks.length} tracks`);

            // Envoyer au backend
            const response = await this.api.writeMidiFile(this.currentFile, midiData);

            if (response && response.success) {
                this.isDirty = false;
                this.updateSaveButton();
                this.showNotification('Fichier sauvegardé avec succès', 'success');

                // Émettre événement
                if (this.eventBus) {
                    this.eventBus.emit('midi_editor:saved', {
                        filePath: this.currentFile
                    });
                }
            } else {
                throw new Error('La réponse du serveur indique un échec');
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
                        <span class="file-name">${this.escapeHtml(this.currentFilename || this.currentFile || '')}</span>
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

        // Calculer la plage de ticks depuis la séquence
        let maxTick = 0;
        let minNote = 127;
        let maxNote = 0;

        if (this.sequence && this.sequence.length > 0) {
            this.sequence.forEach(note => {
                const endTick = note.t + note.g;
                if (endTick > maxTick) maxTick = endTick;
                if (note.n < minNote) minNote = note.n;
                if (note.n > maxNote) maxNote = note.n;
            });

            this.log('info', `Sequence range: ticks 0-${maxTick}, notes ${minNote}-${maxNote}`);
        }

        // Définir une plage visible appropriée (arrondir au multiple de 128)
        const xrange = Math.max(128, Math.ceil(maxTick / 128) * 128);
        const noteRange = Math.max(36, maxNote - minNote + 12); // +12 pour marge

        this.pianoRoll.setAttribute('width', width);
        this.pianoRoll.setAttribute('height', height);
        this.pianoRoll.setAttribute('editmode', 'dragpoly');
        this.pianoRoll.setAttribute('xrange', xrange.toString());
        this.pianoRoll.setAttribute('yrange', noteRange.toString());
        this.pianoRoll.setAttribute('grid', '16'); // 16th notes
        this.pianoRoll.setAttribute('wheelzoom', '1');
        this.pianoRoll.setAttribute('xscroll', '1');
        this.pianoRoll.setAttribute('yscroll', '1');
        this.pianoRoll.setAttribute('markstart', '0');
        this.pianoRoll.setAttribute('markend', maxTick.toString());

        this.log('info', `Piano roll configured: xrange=${xrange}, yrange=${noteRange}, markend=${maxTick}`);

        // Ajouter au conteneur AVANT de charger la sequence
        container.appendChild(this.pianoRoll);

        // Attendre que le composant soit monté
        await new Promise(resolve => setTimeout(resolve, 100));

        // Charger la sequence SI elle existe et n'est pas vide
        if (this.sequence && this.sequence.length > 0) {
            this.log('info', `Loading ${this.sequence.length} notes into piano roll`);

            // DEBUG: Afficher les premières notes
            this.log('debug', 'First 3 notes:', JSON.stringify(this.sequence.slice(0, 3)));

            // Assigner la sequence au piano roll
            this.pianoRoll.sequence = this.sequence;

            // Attendre un peu avant le redraw
            await new Promise(resolve => setTimeout(resolve, 50));

            // Forcer un redraw
            if (typeof this.pianoRoll.redraw === 'function') {
                this.pianoRoll.redraw();
                this.log('info', 'Piano roll redrawn');
            }

            // Vérifier que la sequence a bien été assignée
            this.log('debug', `Piano roll sequence length: ${this.pianoRoll.sequence?.length || 0}`);
        } else {
            this.log('warn', 'No notes to display in piano roll - adding test notes');

            // Ajouter quelques notes de test pour vérifier que le piano roll fonctionne
            this.pianoRoll.sequence = [
                { t: 0, g: 480, n: 60 },   // C4
                { t: 480, g: 480, n: 64 }, // E4
                { t: 960, g: 480, n: 67 }  // G4
            ];

            if (typeof this.pianoRoll.redraw === 'function') {
                this.pianoRoll.redraw();
            }
        }

        // Écouter les changements
        this.pianoRoll.addEventListener('change', () => {
            this.log('debug', 'Piano roll changed (change event)');
            this.isDirty = true;
            this.updateSaveButton();
            this.updateStats();
        });

        // Écouter également l'événement input (certains composants l'utilisent)
        this.pianoRoll.addEventListener('input', () => {
            this.log('debug', 'Piano roll changed (input event)');
            this.isDirty = true;
            this.updateSaveButton();
            this.updateStats();
        });

        // Observer les mutations du sequence pour détecter les changements
        let lastSequenceLength = this.pianoRoll.sequence?.length || 0;
        setInterval(() => {
            const currentLength = this.pianoRoll.sequence?.length || 0;
            if (currentLength !== lastSequenceLength) {
                this.log('debug', `Piano roll sequence changed: ${lastSequenceLength} -> ${currentLength}`);
                this.isDirty = true;
                this.updateSaveButton();
                this.updateStats();
                lastSequenceLength = currentLength;
            }
        }, 1000);

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
        const newRange = Math.max(16, Math.min(10000, Math.round(currentRange * factor)));
        this.pianoRoll.setAttribute('xrange', newRange);

        // Forcer le redraw
        if (typeof this.pianoRoll.redraw === 'function') {
            this.pianoRoll.redraw();
        }

        this.log('debug', `Horizontal zoom: ${currentRange} -> ${newRange}`);
    }

    /**
     * Zoom vertical
     */
    zoomVertical(factor) {
        if (!this.pianoRoll) return;

        const currentRange = parseInt(this.pianoRoll.getAttribute('yrange')) || 36;
        const newRange = Math.max(12, Math.min(88, Math.round(currentRange * factor)));
        this.pianoRoll.setAttribute('yrange', newRange);

        // Forcer le redraw
        if (typeof this.pianoRoll.redraw === 'function') {
            this.pianoRoll.redraw();
        }

        this.log('debug', `Vertical zoom: ${currentRange} -> ${newRange}`);
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
        this.currentFilename = null;
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
