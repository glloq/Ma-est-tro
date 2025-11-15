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
        this.fullSequence = []; // Toutes les notes (tous canaux)
        this.activeChannels = new Set(); // Canaux actifs à afficher
        this.channels = []; // Informations sur les canaux disponibles

        // Couleurs éclatantes pour les 16 canaux MIDI
        this.channelColors = [
            '#FF0066', // 1 - Rose/Magenta vif
            '#00FFFF', // 2 - Cyan éclatant
            '#FF00FF', // 3 - Magenta pur
            '#FFFF00', // 4 - Jaune vif
            '#00FF00', // 5 - Vert pur
            '#FF6600', // 6 - Orange éclatant
            '#9D00FF', // 7 - Violet vif
            '#00FF99', // 8 - Vert menthe éclatant
            '#FF0000', // 9 - Rouge pur
            '#00BFFF', // 10 - Bleu ciel éclatant (Drums)
            '#FFD700', // 11 - Or éclatant
            '#FF1493', // 12 - Rose profond
            '#00FFAA', // 13 - Turquoise éclatant
            '#FF4500', // 14 - Orange-rouge vif
            '#7FFF00', // 15 - Vert chartreuse
            '#FF69B4'  // 16 - Rose chaud
        ];

        // Table des instruments General MIDI
        this.gmInstruments = [
            // Piano (0-7)
            'Acoustic Grand Piano', 'Bright Acoustic Piano', 'Electric Grand Piano', 'Honky-tonk Piano',
            'Electric Piano 1', 'Electric Piano 2', 'Harpsichord', 'Clavinet',
            // Chromatic Percussion (8-15)
            'Celesta', 'Glockenspiel', 'Music Box', 'Vibraphone', 'Marimba', 'Xylophone', 'Tubular Bells', 'Dulcimer',
            // Organ (16-23)
            'Drawbar Organ', 'Percussive Organ', 'Rock Organ', 'Church Organ', 'Reed Organ', 'Accordion', 'Harmonica', 'Tango Accordion',
            // Guitar (24-31)
            'Acoustic Guitar (nylon)', 'Acoustic Guitar (steel)', 'Electric Guitar (jazz)', 'Electric Guitar (clean)',
            'Electric Guitar (muted)', 'Overdriven Guitar', 'Distortion Guitar', 'Guitar harmonics',
            // Bass (32-39)
            'Acoustic Bass', 'Electric Bass (finger)', 'Electric Bass (pick)', 'Fretless Bass',
            'Slap Bass 1', 'Slap Bass 2', 'Synth Bass 1', 'Synth Bass 2',
            // Strings (40-47)
            'Violin', 'Viola', 'Cello', 'Contrabass', 'Tremolo Strings', 'Pizzicato Strings', 'Orchestral Harp', 'Timpani',
            // Ensemble (48-55)
            'String Ensemble 1', 'String Ensemble 2', 'Synth Strings 1', 'Synth Strings 2',
            'Choir Aahs', 'Voice Oohs', 'Synth Voice', 'Orchestra Hit',
            // Brass (56-63)
            'Trumpet', 'Trombone', 'Tuba', 'Muted Trumpet', 'French Horn', 'Brass Section', 'Synth Brass 1', 'Synth Brass 2',
            // Reed (64-71)
            'Soprano Sax', 'Alto Sax', 'Tenor Sax', 'Baritone Sax', 'Oboe', 'English Horn', 'Bassoon', 'Clarinet',
            // Pipe (72-79)
            'Piccolo', 'Flute', 'Recorder', 'Pan Flute', 'Blown Bottle', 'Shakuhachi', 'Whistle', 'Ocarina',
            // Synth Lead (80-87)
            'Lead 1 (square)', 'Lead 2 (sawtooth)', 'Lead 3 (calliope)', 'Lead 4 (chiff)',
            'Lead 5 (charang)', 'Lead 6 (voice)', 'Lead 7 (fifths)', 'Lead 8 (bass + lead)',
            // Synth Pad (88-95)
            'Pad 1 (new age)', 'Pad 2 (warm)', 'Pad 3 (polysynth)', 'Pad 4 (choir)',
            'Pad 5 (bowed)', 'Pad 6 (metallic)', 'Pad 7 (halo)', 'Pad 8 (sweep)',
            // Synth Effects (96-103)
            'FX 1 (rain)', 'FX 2 (soundtrack)', 'FX 3 (crystal)', 'FX 4 (atmosphere)',
            'FX 5 (brightness)', 'FX 6 (goblins)', 'FX 7 (echoes)', 'FX 8 (sci-fi)',
            // Ethnic (104-111)
            'Sitar', 'Banjo', 'Shamisen', 'Koto', 'Kalimba', 'Bag pipe', 'Fiddle', 'Shanai',
            // Percussive (112-119)
            'Tinkle Bell', 'Agogo', 'Steel Drums', 'Woodblock', 'Taiko Drum', 'Melodic Tom', 'Synth Drum', 'Reverse Cymbal',
            // Sound Effects (120-127)
            'Guitar Fret Noise', 'Breath Noise', 'Seashore', 'Bird Tweet', 'Telephone Ring', 'Helicopter', 'Applause', 'Gunshot'
        ];
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
     * Format: {t: tick, g: gate, n: note, c: channel}
     */
    convertMidiToSequence() {
        this.fullSequence = [];
        this.channels = [];

        if (!this.midiData || !this.midiData.tracks) {
            this.log('warn', 'No MIDI tracks to convert');
            return;
        }

        const ticksPerBeat = this.midiData.header?.ticksPerBeat || 480;
        this.log('info', `Converting MIDI: ${this.midiData.tracks.length} tracks, ${ticksPerBeat} ticks/beat`);

        // Informations sur les instruments par canal
        const channelInstruments = new Map(); // canal -> program number
        const channelNoteCount = new Map();   // canal -> nombre de notes

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

                // Program Change (instrument)
                if (event.type === 'programChange') {
                    const channel = event.channel || 0;
                    channelInstruments.set(channel, event.programNumber);
                    this.log('debug', `Channel ${channel}: program ${event.programNumber} (${this.gmInstruments[event.programNumber]})`);
                }

                // Note On
                if (event.type === 'noteOn' && event.velocity > 0) {
                    noteOnCount++;
                    const channel = event.channel || 0;
                    const key = `${channel}_${event.noteNumber}`;
                    activeNotes.set(key, {
                        tick: currentTick,
                        note: event.noteNumber,
                        velocity: event.velocity,
                        channel: channel
                    });

                    // Log first note on event for debugging
                    if (noteOnCount === 1) {
                        this.log('debug', `First noteOn in track ${trackIndex}:`, {
                            tick: currentTick,
                            note: event.noteNumber,
                            velocity: event.velocity,
                            channel: channel
                        });
                    }
                }
                // Note Off
                else if (event.type === 'noteOff' || (event.type === 'noteOn' && event.velocity === 0)) {
                    noteOffCount++;
                    const channel = event.channel || 0;
                    const key = `${channel}_${event.noteNumber}`;
                    const noteOn = activeNotes.get(key);

                    if (noteOn) {
                        const gate = currentTick - noteOn.tick;
                        allNotes.push({
                            tick: noteOn.tick,
                            note: noteOn.note,
                            gate: gate,
                            velocity: noteOn.velocity,
                            channel: channel
                        });

                        // Compter les notes par canal
                        channelNoteCount.set(channel, (channelNoteCount.get(channel) || 0) + 1);

                        activeNotes.delete(key);
                    }
                }
            });

            this.log('debug', `Track ${trackIndex} summary: ${noteOnCount} note-ons, ${noteOffCount} note-offs, ${allNotes.length} complete notes`);
        });

        // Convertir en format webaudio-pianoroll: {t: tick, g: gate, n: note, c: channel}
        this.fullSequence = allNotes.map(note => ({
            t: note.tick,    // tick (position de départ)
            g: note.gate,    // gate (durée)
            n: note.note,    // note (numéro MIDI)
            c: note.channel  // canal MIDI (0-15)
        }));

        // Trier par tick
        this.fullSequence.sort((a, b) => a.t - b.t);

        // Construire la liste des canaux disponibles
        channelNoteCount.forEach((count, channel) => {
            const programNumber = channelInstruments.get(channel) || 0;
            const instrumentName = channel === 9 ? 'Drums' : this.gmInstruments[programNumber];

            this.channels.push({
                channel: channel,
                program: programNumber,
                instrument: instrumentName,
                noteCount: count
            });
        });

        // Trier les canaux par numéro
        this.channels.sort((a, b) => a.channel - b.channel);

        this.log('info', `Converted ${this.fullSequence.length} notes to sequence`);
        this.log('info', `Found ${this.channels.length} channels:`, this.channels);

        // Activer le premier canal par défaut (économise la mémoire)
        if (this.channels.length > 0) {
            this.activeChannels.clear();
            this.activeChannels.add(this.channels[0].channel);
            this.updateSequenceFromActiveChannels();
        } else {
            this.log('warn', 'No notes found! Check MIDI data structure.');
            this.sequence = [];
        }
    }

    /**
     * Basculer l'affichage d'un canal
     */
    toggleChannel(channel) {
        if (this.activeChannels.has(channel)) {
            this.activeChannels.delete(channel);
        } else {
            this.activeChannels.add(channel);
        }

        this.log('info', `Toggled channel ${channel}. Active channels: [${Array.from(this.activeChannels).join(', ')}]`);

        this.updateSequenceFromActiveChannels();
        this.updateChannelButtons();
    }

    /**
     * Mettre à jour la séquence depuis les canaux actifs
     */
    updateSequenceFromActiveChannels() {
        if (this.activeChannels.size === 0) {
            this.sequence = [];
        } else {
            this.sequence = this.fullSequence.filter(note => this.activeChannels.has(note.c));
        }

        this.log('info', `Updated sequence: ${this.sequence.length} notes from ${this.activeChannels.size} active channel(s)`);

        // Mettre à jour le piano roll si il existe
        if (this.pianoRoll) {
            this.updatePianoRollColor();
            this.reloadPianoRoll();
        }
    }

    /**
     * Mettre à jour la couleur des notes selon les canaux actifs
     * NOTE: Désormais les notes sont colorées individuellement par canal dans drawColoredNotes()
     * Cette fonction rend les notes de base transparentes
     */
    updatePianoRollColor() {
        if (!this.pianoRoll) return;

        // Rendre les notes de base transparentes (l'overlay dessinera les vraies couleurs)
        this.pianoRoll.setAttribute('colnote', 'rgba(0,0,0,0)'); // Transparent
        this.pianoRoll.setAttribute('colnotesel', 'rgba(255,255,255,0.1)'); // Très légèrement visible pour la sélection

        this.log('debug', 'Piano roll base notes set to transparent');
    }

    /**
     * Éclaircir/éclairer une couleur hexadécimale pour la rendre plus éclatante
     */
    brightenColor(color, percent) {
        const num = parseInt(color.replace('#', ''), 16);
        const amt = Math.round(2.55 * percent);
        const R = Math.min(255, (num >> 16) + amt);
        const G = Math.min(255, (num >> 8 & 0x00FF) + amt);
        const B = Math.min(255, (num & 0x0000FF) + amt);
        return '#' + (0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1);
    }

    /**
     * Convertir la sequence en données MIDI pour le backend
     * Format compatible avec la bibliothèque 'midi-file'
     */
    convertSequenceToMidi() {
        // Utiliser fullSequence qui contient toutes les notes à jour
        const fullSequenceToSave = this.fullSequence;

        if (!fullSequenceToSave || fullSequenceToSave.length === 0) {
            this.log('warn', 'No sequence to convert');
            return null;
        }

        const ticksPerBeat = this.midiData?.header?.ticksPerBeat || 480;

        this.log('info', `Converting ${fullSequenceToSave.length} notes to MIDI`);

        // Convertir la sequence en événements MIDI
        const events = [];

        // Ajouter les événements de note
        fullSequenceToSave.forEach(note => {
            const tick = note.t;
            const noteNumber = note.n;
            const gate = note.g;
            const channel = note.c !== undefined ? note.c : 0;
            const velocity = note.v || 100; // velocity par défaut si non présente

            // Note On
            events.push({
                absoluteTime: tick,
                type: 'noteOn',
                channel: channel,
                noteNumber: noteNumber,
                velocity: velocity
            });

            // Note Off
            events.push({
                absoluteTime: tick + gate,
                type: 'noteOff',
                channel: channel,
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
            const editedSequence = this.pianoRoll.sequence || [];

            this.log('info', `Sequence length from piano roll: ${editedSequence.length}`);

            // IMPORTANT: Restaurer la propriété canal (c) sur les notes éditées
            // car webaudio-pianoroll ne la préserve pas
            const editedSequenceWithChannels = editedSequence.map(note => {
                // Si la note a déjà un canal, le garder
                if (note.c !== undefined) {
                    return note;
                }

                // Sinon, attribuer le canal basé sur les canaux actifs
                // Si un seul canal actif, utiliser celui-ci
                if (this.activeChannels.size === 1) {
                    const activeChannel = Array.from(this.activeChannels)[0];
                    return { ...note, c: activeChannel };
                }

                // Si plusieurs canaux actifs, essayer de retrouver le canal d'origine
                // en cherchant dans fullSequence
                const originalNote = this.fullSequence.find(
                    fn => fn.t === note.t && fn.n === note.n && this.activeChannels.has(fn.c)
                );

                return {
                    ...note,
                    c: originalNote ? originalNote.c : Array.from(this.activeChannels)[0]
                };
            });

            this.log('debug', `Restored channels on ${editedSequenceWithChannels.length} notes`);

            // Mettre à jour this.sequence pour la conversion MIDI
            this.sequence = editedSequenceWithChannels;

            // Mettre à jour fullSequence avec les notes éditées
            // Supprimer les anciennes notes des canaux actifs
            this.fullSequence = this.fullSequence.filter(note => !this.activeChannels.has(note.c));

            // Ajouter les notes éditées
            this.fullSequence = [...this.fullSequence, ...editedSequenceWithChannels];
            this.fullSequence.sort((a, b) => a.t - b.t);

            this.log('info', `Updated fullSequence: ${this.fullSequence.length} total notes`);

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

    /**
     * Générer les boutons de canal
     */
    renderChannelButtons() {
        if (!this.channels || this.channels.length === 0) {
            return '<div class="channel-buttons"><span>Aucun canal disponible</span></div>';
        }

        let buttons = '<div class="channel-buttons">';

        // Boutons pour chaque canal
        this.channels.forEach(ch => {
            const isActive = this.activeChannels.has(ch.channel);
            const color = this.channelColors[ch.channel % this.channelColors.length];
            const activeClass = isActive ? 'active' : '';

            // Générer les styles inline directement (sans lueur)
            const inlineStyles = isActive
                ? `
                    --channel-color: ${color};
                    background: ${color};
                    border-color: ${color};
                `.trim()
                : `
                    --channel-color: ${color};
                    border-color: ${color};
                `.trim();

            buttons += `
                <button
                    class="channel-btn ${activeClass}"
                    data-channel="${ch.channel}"
                    data-color="${color}"
                    style="${inlineStyles}"
                    title="${ch.instrument} (${ch.noteCount} notes)"
                >
                    <span class="channel-number">${ch.channel + 1}</span>
                    <span class="channel-name">${ch.instrument}</span>
                    <span class="channel-count">${ch.noteCount}</span>
                </button>
            `;
        });

        buttons += '</div>';
        return buttons;
    }

    /**
     * Mettre à jour l'état visuel des boutons de canal
     */
    updateChannelButtons() {
        const buttons = this.container?.querySelectorAll('.channel-btn');
        if (!buttons) return;

        buttons.forEach(btn => {
            const channel = parseInt(btn.dataset.channel);
            const color = btn.dataset.color; // Récupérer la couleur depuis data-attribute
            const isActive = this.activeChannels.has(channel);

            if (isActive) {
                btn.classList.add('active');
                // Appliquer les styles pour l'état actif (sans lueur)
                btn.style.cssText = `
                    --channel-color: ${color};
                    background: ${color};
                    border-color: ${color};
                `;
            } else {
                btn.classList.remove('active');
                // Appliquer les styles pour l'état inactif (sans lueur)
                btn.style.cssText = `
                    --channel-color: ${color};
                    border-color: ${color};
                `;
            }
        });

        // Mettre à jour le compteur de notes
        this.updateStats();
    }

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
                                    <option value="dragpoly">Drag Poly</option>
                                    <option value="dragmono">Drag Mono</option>
                                    <option value="gridpoly">Grid Poly</option>
                                    <option value="gridmono">Grid Mono</option>
                                </select>
                            </label>
                        </div>
                        <div class="toolbar-group">
                            <button class="btn btn-sm" data-action="zoom-in" title="Zoom horizontal +">🔍+</button>
                            <button class="btn btn-sm" data-action="zoom-out" title="Zoom horizontal -">🔍−</button>
                            <button class="btn btn-sm" data-action="vzoom-in" title="Zoom vertical +">⬆️</button>
                            <button class="btn btn-sm" data-action="vzoom-out" title="Zoom vertical -">⬇️</button>
                        </div>
                        <div class="toolbar-group">
                            <span class="toolbar-label">Notes: <span id="note-count">${this.sequence.length}</span></span>
                        </div>
                    </div>
                    <div class="channels-toolbar">
                        ${this.renderChannelButtons()}
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

        // Appliquer la couleur selon les canaux actifs
        this.updatePianoRollColor();

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

        // Activer le rendu coloré par canal
        this.setupColoredNoteRendering();

        this.updateStats();
    }

    /**
     * Configure le rendu des notes colorées par canal
     * Approche: Remplacement complet de la méthode redraw() pour coloration directe
     */
    setupColoredNoteRendering() {
        if (!this.pianoRoll) return;

        try {
            // Attendre un peu pour que le composant soit prêt
            setTimeout(() => {
                // Essayer d'accéder au Shadow DOM
                const shadowRoot = this.pianoRoll.shadowRoot;
                if (!shadowRoot) {
                    this.log('warn', 'No shadow root found, trying fallback approach');
                    this.setupColoredNoteRenderingFallback();
                    return;
                }

                // Trouver le canvas dans le Shadow DOM
                const canvas = shadowRoot.querySelector('canvas');
                if (!canvas) {
                    this.log('warn', 'No canvas found in shadow root, trying fallback');
                    this.setupColoredNoteRenderingFallback();
                    return;
                }

                this.log('info', 'Found internal canvas, replacing redraw() method');

                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    this.log('warn', 'Cannot get 2D context');
                    return;
                }

                const that = this;
                const pr = this.pianoRoll;

                // Sauvegarder la méthode originale redraw
                const originalRedraw = pr.redraw ? pr.redraw.bind(pr) : null;

                // Remplacer redraw() par une version qui colore directement par canal
                pr.redraw = function() {
                    if (!ctx) return;

                    // Effacer le canvas
                    ctx.clearRect(0, 0, canvas.width, canvas.height);

                    // Recalculer stepw et steph (IMPORTANT pour le zoom)
                    pr.stepw = pr.swidth / (parseFloat(pr.getAttribute('xrange')) || 128);
                    pr.steph = pr.sheight / (parseFloat(pr.getAttribute('yrange')) || 36);

                    // Dessiner la grille (utiliser la méthode originale si disponible)
                    if (typeof pr.redrawGrid === 'function') {
                        pr.redrawGrid();
                    } else {
                        // Fallback simplifié
                        ctx.fillStyle = pr.getAttribute('colbg') || '#000';
                        ctx.fillRect(0, 0, canvas.width, canvas.height);
                    }

                    // Dessiner les notes avec couleurs par canal (COPIE EXACTE de l'algorithme original)
                    const l = pr.sequence ? pr.sequence.length : 0;
                    for (let s = 0; s < l; ++s) {
                        const ev = pr.sequence[s];
                        if (!ev) continue;

                        // Obtenir la couleur du canal pour le remplissage
                        const channel = ev.c !== undefined ? ev.c : 0;
                        const channelColor = that.channelColors[channel % that.channelColors.length];

                        // Couleur de remplissage : canal si non sélectionné, semi-transparent si sélectionné
                        if (ev.f) {
                            // Note sélectionnée : mixer avec blanc semi-transparent
                            ctx.fillStyle = 'rgba(255,255,255,0.3)';
                        } else {
                            // Note normale : couleur du canal
                            ctx.fillStyle = channelColor;
                        }

                        // Calculer les coordonnées (FORMULE EXACTE de l'original)
                        const w = ev.g * pr.stepw;
                        const x = (ev.t - pr.xoffset) * pr.stepw + pr.yruler + pr.kbwidth;
                        const x2 = (x + w) | 0;
                        const xInt = x | 0;
                        const y = canvas.height - (ev.n - pr.yoffset) * pr.steph;
                        const y2 = (y - pr.steph) | 0;
                        const yInt = y | 0;

                        // Dessiner le remplissage
                        ctx.fillRect(xInt, yInt, x2 - xInt, y2 - yInt);

                        // Dessiner les bordures (4 rectangles comme l'original)
                        if (ev.f) {
                            ctx.fillStyle = pr.getAttribute('colnoteselborder') || '#fff';
                        } else {
                            ctx.fillStyle = pr.getAttribute('colnoteborder') || '#000';
                        }
                        ctx.fillRect(xInt, yInt, 1, y2 - yInt);           // Bordure gauche
                        ctx.fillRect(x2, yInt, 1, y2 - yInt);             // Bordure droite
                        ctx.fillRect(xInt, yInt, x2 - xInt, 1);           // Bordure haut
                        ctx.fillRect(xInt, y2, x2 - xInt, 1);             // Bordure bas
                    }

                    // Dessiner les overlays (utiliser les méthodes originales si disponibles)
                    if (typeof pr.redrawYRuler === 'function') pr.redrawYRuler();
                    if (typeof pr.redrawXRuler === 'function') pr.redrawXRuler();
                    if (typeof pr.redrawMarker === 'function') pr.redrawMarker();
                    if (typeof pr.redrawAreaSel === 'function') pr.redrawAreaSel();
                };

                // Marquer que le remplacement est actif
                this.customRedrawActive = true;

                // Forcer un redraw initial
                pr.redraw();

                this.log('info', 'Custom redraw() installed - direct coloring with zero lag!');
            }, 300);
        } catch (error) {
            this.log('error', 'Failed to setup colored note rendering:', error);
            this.setupColoredNoteRenderingFallback();
        }
    }

    /**
     * Approche de fallback: canvas overlay
     */
    setupColoredNoteRenderingFallback() {
        const container = document.getElementById('piano-roll-container');
        if (!container) return;

        // DIAGNOSTIC: Afficher toutes les propriétés disponibles du piano roll
        this.log('info', 'Piano roll properties:', {
            xoffset: this.pianoRoll.xoffset,
            yoffset: this.pianoRoll.yoffset,
            stepw: this.pianoRoll.stepw,
            steph: this.pianoRoll.steph,
            kbwidth: this.pianoRoll.kbwidth,
            yruler: this.pianoRoll.yruler,
            height: this.pianoRoll.height,
            width: this.pianoRoll.width,
            xrange: this.pianoRoll.xrange,
            yrange: this.pianoRoll.yrange
        });

        // Créer un canvas overlay
        const overlay = document.createElement('canvas');
        overlay.style.position = 'absolute';
        overlay.style.top = '0';
        overlay.style.left = '0';
        overlay.style.pointerEvents = 'none';
        overlay.style.zIndex = '10';
        overlay.className = 'piano-roll-color-overlay';

        // Dimensionner le overlay
        const width = this.pianoRoll.getAttribute('width') || container.clientWidth;
        const height = this.pianoRoll.getAttribute('height') || container.clientHeight;
        overlay.width = width;
        overlay.height = height;
        overlay.style.width = width + 'px';
        overlay.style.height = height + 'px';

        // Ajouter au conteneur
        container.style.position = 'relative';
        container.appendChild(overlay);

        this.colorOverlay = overlay;
        this.colorOverlayCtx = overlay.getContext('2d');

        // Dessiner les notes colorées
        this.drawColoredNotesOverlay();

        // Redessiner quand nécessaire
        this.pianoRoll.addEventListener('change', () => this.drawColoredNotesOverlay());
        this.pianoRoll.addEventListener('input', () => this.drawColoredNotesOverlay());

        // Redessiner en continu
        this.overlayRenderInterval = setInterval(() => {
            if (this.pianoRoll && this.pianoRoll.sequence) {
                this.drawColoredNotesOverlay();
            }
        }, 100);

        this.log('info', 'Fallback color overlay created');
    }

    /**
     * Dessine les notes colorées sur le canvas overlay
     * Utilise la même formule que webaudio-pianoroll pour un alignement parfait
     */
    drawColoredNotesOverlay() {
        if (!this.colorOverlay || !this.colorOverlayCtx || !this.pianoRoll || !this.pianoRoll.sequence) return;

        const canvas = this.colorOverlay;
        const ctx = this.colorOverlayCtx;

        // Effacer le canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        try {
            // Accéder DIRECTEMENT aux propriétés internes de webaudio-pianoroll
            // Ces valeurs changent avec le zoom, le scroll, etc.
            const xoffset = this.pianoRoll.xoffset !== undefined ? this.pianoRoll.xoffset : 0;
            const yoffset = this.pianoRoll.yoffset !== undefined ? this.pianoRoll.yoffset : 60;
            const kbwidth = this.pianoRoll.kbwidth !== undefined ? this.pianoRoll.kbwidth : 0;
            const yruler = this.pianoRoll.yruler !== undefined ? this.pianoRoll.yruler : 0;

            // IMPORTANT: Utiliser les valeurs DIRECTES de stepw, steph et height du piano roll
            // au lieu de les recalculer, car elles peuvent différer selon l'implémentation interne
            const stepw = this.pianoRoll.stepw !== undefined ? this.pianoRoll.stepw : (canvas.width - kbwidth) / (parseFloat(this.pianoRoll.getAttribute('xrange')) || 128);
            const steph = this.pianoRoll.steph !== undefined ? this.pianoRoll.steph : (canvas.height - yruler) / (parseFloat(this.pianoRoll.getAttribute('yrange')) || 36);
            const height = this.pianoRoll.height !== undefined ? this.pianoRoll.height : canvas.height;

            this.log('debug', `Overlay params: xoffset=${xoffset}, yoffset=${yoffset}, stepw=${stepw}, steph=${steph}, kbwidth=${kbwidth}, yruler=${yruler}, height=${height}`);

            // Dessiner chaque note avec sa couleur de canal
            this.pianoRoll.sequence.forEach(note => {
                if (!note) return;

                const channel = note.c !== undefined ? note.c : 0;
                const color = this.channelColors[channel % this.channelColors.length];

                // FORMULE EXACTE de webaudio-pianoroll (code source ligne par ligne)
                const w = note.g * stepw;
                const x = (note.t - xoffset) * stepw + yruler + kbwidth;
                const y = height - (note.n - yoffset) * steph;
                const y2 = Math.floor(y - steph);

                // Ne dessiner que si la note est visible dans le viewport
                if (x + w >= kbwidth && x <= canvas.width && y2 >= yruler && y <= canvas.height) {
                    // Dessiner la note avec la couleur du canal
                    ctx.fillStyle = color;
                    ctx.fillRect(x, y2, w, steph);

                    // Bordure pour visibilité
                    ctx.strokeStyle = 'rgba(0,0,0,0.2)';
                    ctx.lineWidth = 0.5;
                    ctx.strokeRect(x, y2, w, steph);
                }
            });

            this.log('debug', `Color overlay drawn: ${this.pianoRoll.sequence.length} notes`);
        } catch (error) {
            this.log('error', 'Error drawing color overlay:', error);
        }
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

        // Clic sur les boutons de canal
        const channelButtons = this.container.querySelectorAll('.channel-btn');
        channelButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const channel = parseInt(btn.dataset.channel);
                this.toggleChannel(channel);
            });
        });
    }

    /**
     * Recharger le piano roll avec la séquence actuelle
     */
    reloadPianoRoll() {
        if (!this.pianoRoll) {
            this.log('warn', 'Cannot reload piano roll: not initialized');
            return;
        }

        this.log('info', `Reloading piano roll with ${this.sequence.length} notes`);

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
        }

        // Mettre à jour les attributs du piano roll
        const xrange = Math.max(128, Math.ceil(maxTick / 128) * 128);
        const noteRange = Math.max(36, maxNote - minNote + 12);

        this.pianoRoll.setAttribute('markend', maxTick.toString());
        this.pianoRoll.setAttribute('xrange', xrange.toString());
        this.pianoRoll.setAttribute('yrange', noteRange.toString());

        // Appliquer la couleur selon les canaux actifs
        this.updatePianoRollColor();

        // Recharger la séquence
        this.pianoRoll.sequence = this.sequence;

        // Forcer le redraw
        if (typeof this.pianoRoll.redraw === 'function') {
            this.pianoRoll.redraw();
        }

        // Redessiner le color overlay
        setTimeout(() => {
            this.drawColoredNotesOverlay();
        }, 100);

        // Mettre à jour les stats
        this.updateStats();

        this.log('info', `Piano roll reloaded: ${this.sequence.length} notes, xrange=${xrange}, yrange=${noteRange}`);
    }

    /**
     * Zoom horizontal
     */
    zoomHorizontal(factor) {
        if (!this.pianoRoll) {
            this.log('warn', 'Cannot zoom: piano roll not initialized');
            return;
        }

        // Essayer d'accéder à la propriété directement
        const currentRange = this.pianoRoll.xrange || parseInt(this.pianoRoll.getAttribute('xrange')) || 128;
        const newRange = Math.max(16, Math.min(10000, Math.round(currentRange * factor)));

        // Essayer les deux méthodes
        this.pianoRoll.setAttribute('xrange', newRange.toString());
        if (this.pianoRoll.xrange !== undefined) {
            this.pianoRoll.xrange = newRange;
        }

        // Forcer le redraw avec un court délai
        setTimeout(() => {
            if (typeof this.pianoRoll.redraw === 'function') {
                this.pianoRoll.redraw();
            }
            // Synchroniser le canvas overlay avec le piano roll
            this.syncOverlayCanvas();
            // Redessiner le color overlay
            this.drawColoredNotesOverlay();
        }, 50);

        this.log('info', `Horizontal zoom: ${currentRange} -> ${newRange}`);
    }

    /**
     * Zoom vertical
     */
    zoomVertical(factor) {
        if (!this.pianoRoll) {
            this.log('warn', 'Cannot zoom: piano roll not initialized');
            return;
        }

        // Essayer d'accéder à la propriété directement
        const currentRange = this.pianoRoll.yrange || parseInt(this.pianoRoll.getAttribute('yrange')) || 36;
        const newRange = Math.max(12, Math.min(88, Math.round(currentRange * factor)));

        // Essayer les deux méthodes
        this.pianoRoll.setAttribute('yrange', newRange.toString());
        if (this.pianoRoll.yrange !== undefined) {
            this.pianoRoll.yrange = newRange;
        }

        // Forcer le redraw avec un court délai
        setTimeout(() => {
            if (typeof this.pianoRoll.redraw === 'function') {
                this.pianoRoll.redraw();
            }
            // Synchroniser le canvas overlay avec le piano roll
            this.syncOverlayCanvas();
            // Redessiner le color overlay
            this.drawColoredNotesOverlay();
        }, 50);

        this.log('info', `Vertical zoom: ${currentRange} -> ${newRange}`);
    }

    /**
     * Synchroniser les dimensions du canvas overlay avec le piano roll
     */
    syncOverlayCanvas() {
        if (!this.colorOverlay || !this.pianoRoll) return;

        const container = document.getElementById('piano-roll-container');
        if (!container) return;

        const width = this.pianoRoll.getAttribute('width') || container.clientWidth;
        const height = this.pianoRoll.getAttribute('height') || container.clientHeight;

        // Redimensionner le canvas overlay
        this.colorOverlay.width = width;
        this.colorOverlay.height = height;
        this.colorOverlay.style.width = width + 'px';
        this.colorOverlay.style.height = height + 'px';

        this.log('debug', `Overlay canvas resized to ${width}x${height}`);
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

        // Nettoyer l'intervalle de rendu de l'overlay
        if (this.overlayRenderInterval) {
            clearInterval(this.overlayRenderInterval);
            this.overlayRenderInterval = null;
        }

        // Nettoyer le color overlay
        if (this.colorOverlay) {
            this.colorOverlay.remove();
            this.colorOverlay = null;
            this.colorOverlayCtx = null;
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
        this.fullSequence = [];
        this.activeChannels.clear();
        this.channels = [];

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
