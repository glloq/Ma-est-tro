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

        // Afficher TOUS les canaux par défaut et construire la séquence
        this.activeChannels.clear();
        if (this.channels.length > 0) {
            this.channels.forEach(ch => this.activeChannels.add(ch.channel));

            // Construire la séquence filtrée MAINTENANT (avant la création du piano roll)
            this.sequence = this.fullSequence.filter(note => this.activeChannels.has(note.c));

            this.log('info', `All ${this.channels.length} channels activated by default`);
            this.log('info', `Initial sequence: ${this.sequence.length} notes visible`);
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
        // D'ABORD: synchroniser fullSequence avec le piano roll actuel
        // pour ne pas perdre les modifications
        this.syncFullSequenceFromPianoRoll();

        if (this.activeChannels.size === 0) {
            this.sequence = [];
        } else {
            this.sequence = this.fullSequence.filter(note => this.activeChannels.has(note.c));
        }

        this.log('info', `Updated sequence: ${this.sequence.length} notes from ${this.activeChannels.size} active channel(s)`);

        // Mettre à jour le piano roll si il existe
        if (this.pianoRoll) {
            // Recharger le piano roll avec la nouvelle séquence
            this.pianoRoll.sequence = this.sequence;

            // S'assurer que les couleurs sont toujours définies
            this.pianoRoll.channelColors = this.channelColors;

            // Forcer un redraw
            if (typeof this.pianoRoll.redraw === 'function') {
                this.pianoRoll.redraw();
                this.log('debug', 'Piano roll redrawn after channel toggle');
            }
        }
    }

    /**
     * Synchroniser fullSequence avec les notes actuelles du piano roll
     * pour ne pas perdre les modifications (suppressions, ajouts, etc.)
     */
    syncFullSequenceFromPianoRoll() {
        if (!this.pianoRoll || !this.pianoRoll.sequence) return;

        const currentSequence = this.pianoRoll.sequence;

        // Reconstruire fullSequence en fusionnant:
        // - Les notes des canaux actuellement visibles (depuis le piano roll)
        // - Les notes des canaux invisibles (depuis fullSequence)

        // 1. Déterminer quels canaux sont RÉELLEMENT dans le piano roll actuellement
        //    (ne pas utiliser this.activeChannels car il a déjà été modifié par le toggle)
        const visibleChannels = new Set(currentSequence.map(note => note.c));

        // 2. Garder les notes des canaux qui ne sont PAS dans le piano roll
        const invisibleNotes = this.fullSequence.filter(note => !visibleChannels.has(note.c));

        // 3. Prendre les notes du piano roll (canaux visibles, potentiellement modifiées)
        const visibleNotes = currentSequence.map(note => ({
            t: note.t,
            g: note.g,
            n: note.n,
            c: note.c
        }));

        // 4. Fusionner
        this.fullSequence = [...invisibleNotes, ...visibleNotes];

        // 5. Trier par tick
        this.fullSequence.sort((a, b) => a.t - b.t);

        this.log('debug', `Synced fullSequence: ${invisibleNotes.length} invisible + ${visibleNotes.length} visible = ${this.fullSequence.length} total`);
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
                    title="${ch.noteCount} notes"
                >
                    <span class="channel-label">${ch.channel + 1} : ${ch.instrument}</span>
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
                    <div class="channels-toolbar">
                        ${this.renderChannelButtons()}
                    </div>
                    <div class="zoom-controls">
                        <div class="zoom-group">
                            <span class="zoom-label">Zoom H:</span>
                            <button class="btn btn-zoom" data-action="zoom-h-out" title="Dézoomer horizontal">−</button>
                            <button class="btn btn-zoom" data-action="zoom-h-in" title="Zoomer horizontal">+</button>
                        </div>
                        <div class="zoom-group">
                            <span class="zoom-label">Zoom V:</span>
                            <button class="btn btn-zoom" data-action="zoom-v-out" title="Dézoomer vertical">−</button>
                            <button class="btn btn-zoom" data-action="zoom-v-in" title="Zoomer vertical">+</button>
                        </div>
                    </div>
                    <div class="piano-roll-wrapper">
                        <div class="piano-roll-container" id="piano-roll-container">
                            <!-- webaudio-pianoroll sera inséré ici -->
                        </div>
                        <input type="range" class="scroll-slider scroll-horizontal" id="scroll-h-slider" min="0" max="100" value="0" step="1">
                        <input type="range" class="scroll-slider scroll-vertical" id="scroll-v-slider" min="0" max="100" value="0" step="1" orient="vertical">
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

        // Stocker maxTick pour les sliders
        if (!this.midiData) this.midiData = {};
        this.midiData.maxTick = maxTick;

        // Zoom par défaut pour afficher ~20 secondes
        // Avec 480 ticks/beat et 120 BPM standard: 20s = 9600 ticks
        const ticksPerBeat = this.midiData.header?.ticksPerBeat || 480;
        const twentySeconds = ticksPerBeat * 40; // ~20 secondes à 120 BPM
        const xrange = Math.max(twentySeconds, Math.min(maxTick, twentySeconds)); // Vue sur 20 premières secondes

        // Vue centrée verticalement pour voir toutes les notes des canaux visibles
        const noteRange = Math.max(24, maxNote - minNote + 4); // +4 notes de marge au lieu de +24
        const centerNote = Math.floor((minNote + maxNote) / 2);
        const yoffset = Math.max(0, centerNote - Math.floor(noteRange / 2)); // Centrer verticalement

        this.pianoRoll.setAttribute('width', width);
        this.pianoRoll.setAttribute('height', height);
        this.pianoRoll.setAttribute('editmode', 'dragpoly');
        this.pianoRoll.setAttribute('xrange', xrange.toString());
        this.pianoRoll.setAttribute('yrange', noteRange.toString());
        this.pianoRoll.setAttribute('yoffset', yoffset.toString()); // Centrer verticalement
        this.pianoRoll.setAttribute('grid', '16'); // 16th notes
        this.pianoRoll.setAttribute('wheelzoom', '1');
        this.pianoRoll.setAttribute('xscroll', '1');
        this.pianoRoll.setAttribute('yscroll', '1');
        // Pas de marqueurs (triangles vert/orange)
        this.pianoRoll.setAttribute('markstart', '-1');
        this.pianoRoll.setAttribute('markend', '-1');

        this.log('info', `Piano roll configured: xrange=${xrange}, yrange=${noteRange}, yoffset=${yoffset} (centered)`);

        // Ajouter au conteneur AVANT de charger la sequence
        container.appendChild(this.pianoRoll);

        // Attendre que le composant soit monté
        await new Promise(resolve => setTimeout(resolve, 100));

        // Définir les couleurs des canaux MIDI sur le piano roll AVANT de charger la séquence
        this.pianoRoll.channelColors = this.channelColors;

        // Initialiser les sliders de navigation
        this.initializeScrollSliders(maxTick, minNote, maxNote, xrange, noteRange, yoffset);

        // Synchroniser les sliders avec la navigation native du piano roll
        this.setupScrollSynchronization();

        // Charger la sequence SI elle existe et n'est pas vide
        if (this.sequence && this.sequence.length > 0) {
            this.log('info', `Loading ${this.sequence.length} notes into piano roll`);

            // DEBUG: Afficher les premières notes
            this.log('debug', 'First 3 notes:', JSON.stringify(this.sequence.slice(0, 3)));

            // Assigner la sequence au piano roll
            this.pianoRoll.sequence = this.sequence;

            // Attendre un peu avant le redraw
            await new Promise(resolve => setTimeout(resolve, 50));

            // Forcer un redraw pour appliquer les couleurs
            if (typeof this.pianoRoll.redraw === 'function') {
                this.pianoRoll.redraw();
                this.log('info', 'Piano roll redrawn with channel colors');
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

            // Synchroniser immédiatement fullSequence pour ne pas perdre les modifications
            this.syncFullSequenceFromPianoRoll();
        });

        // Écouter également l'événement input (certains composants l'utilisent)
        this.pianoRoll.addEventListener('input', () => {
            this.log('debug', 'Piano roll changed (input event)');
            this.isDirty = true;
            this.updateSaveButton();
            this.updateStats();

            // Synchroniser immédiatement fullSequence pour ne pas perdre les modifications
            this.syncFullSequenceFromPianoRoll();
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

                // Synchroniser immédiatement fullSequence
                this.syncFullSequenceFromPianoRoll();
            }
        }, 1000);

        this.updateStats();
    }

    /**
     * Mettre à jour les statistiques affichées
     * Note: Fonction simplifiée - l'élément note-count a été retiré pour plus d'espace
     */
    updateStats() {
        // Anciennement affichait le nombre de notes, retiré pour optimiser l'espace
        // L'information est toujours visible dans le tooltip des boutons de canal
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
                case 'zoom-h-in':
                    this.zoomHorizontal(0.8);
                    break;
                case 'zoom-h-out':
                    this.zoomHorizontal(1.25);
                    break;
                case 'zoom-v-in':
                    this.zoomVertical(0.8);
                    break;
                case 'zoom-v-out':
                    this.zoomVertical(1.25);
                    break;
            }
        });

        // Clic sur les boutons de canal
        const channelButtons = this.container.querySelectorAll('.channel-btn');
        channelButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const channel = parseInt(btn.dataset.channel);
                this.toggleChannel(channel);
            });
        });

        // Sliders de navigation (scroll) avec throttle à 15fps
        const scrollHSlider = document.getElementById('scroll-h-slider');
        const scrollVSlider = document.getElementById('scroll-v-slider');

        let lastScrollUpdateH = 0;
        let lastScrollUpdateV = 0;
        const throttleDelay = 66; // ~15fps (1000ms / 15 = 66.67ms)

        if (scrollHSlider) {
            scrollHSlider.addEventListener('input', (e) => {
                const now = Date.now();
                if (now - lastScrollUpdateH < throttleDelay) return;
                lastScrollUpdateH = now;

                const value = parseInt(e.target.value);
                this.scrollHorizontal(value);
            });
        }

        if (scrollVSlider) {
            scrollVSlider.addEventListener('input', (e) => {
                const now = Date.now();
                if (now - lastScrollUpdateV < throttleDelay) return;
                lastScrollUpdateV = now;

                const value = parseInt(e.target.value);
                this.scrollVertical(value);
            });
        }
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

        this.pianoRoll.setAttribute('xrange', xrange.toString());
        this.pianoRoll.setAttribute('yrange', noteRange.toString());

        // Recharger la séquence
        this.pianoRoll.sequence = this.sequence;

        // S'assurer que les couleurs sont toujours définies
        this.pianoRoll.channelColors = this.channelColors;

        // Forcer le redraw
        if (typeof this.pianoRoll.redraw === 'function') {
            this.pianoRoll.redraw();
        }

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
        }, 50);

        this.log('info', `Vertical zoom: ${currentRange} -> ${newRange}`);
    }

    /**
     * Initialiser les sliders de navigation avec les bonnes valeurs
     */
    initializeScrollSliders(maxTick, minNote, maxNote, xrange, noteRange, yoffset) {
        const scrollHSlider = document.getElementById('scroll-h-slider');
        const scrollVSlider = document.getElementById('scroll-v-slider');

        if (scrollHSlider) {
            // Position initiale horizontale: 0 (début du fichier)
            scrollHSlider.value = 0;
            this.log('info', `Horizontal slider initialized: maxTick=${maxTick}, xrange=${xrange}`);
        }

        if (scrollVSlider) {
            // Position initiale verticale: centrée
            const totalMidiRange = 128;
            const maxVOffset = Math.max(0, totalMidiRange - noteRange);
            const initialVPercentage = maxVOffset > 0 ? (yoffset / maxVOffset) * 100 : 0;
            scrollVSlider.value = initialVPercentage;
            this.log('info', `Vertical slider initialized: yoffset=${yoffset}, percentage=${initialVPercentage.toFixed(1)}%`);
        }
    }

    /**
     * Synchroniser les sliders avec la navigation native du piano roll
     * (clic sur timeline/clavier)
     */
    setupScrollSynchronization() {
        if (!this.pianoRoll) return;

        // Utiliser setInterval pour vérifier les changements (polling à 60fps)
        // Car webaudio-pianoroll ne déclenche pas toujours d'événements pour xoffset/yoffset
        let lastXOffset = this.pianoRoll.xoffset || 0;
        let lastYOffset = this.pianoRoll.yoffset || 0;

        this.syncInterval = setInterval(() => {
            if (!this.pianoRoll) {
                clearInterval(this.syncInterval);
                return;
            }

            const currentXOffset = this.pianoRoll.xoffset || 0;
            const currentYOffset = this.pianoRoll.yoffset || 0;

            // Si xoffset a changé, mettre à jour le slider horizontal
            if (currentXOffset !== lastXOffset) {
                this.updateHorizontalSlider(currentXOffset);
                lastXOffset = currentXOffset;
            }

            // Si yoffset a changé, mettre à jour le slider vertical
            if (currentYOffset !== lastYOffset) {
                this.updateVerticalSlider(currentYOffset);
                lastYOffset = currentYOffset;
            }
        }, 16); // ~60fps
    }

    /**
     * Mettre à jour le slider horizontal selon xoffset actuel
     */
    updateHorizontalSlider(xoffset) {
        const scrollHSlider = document.getElementById('scroll-h-slider');
        if (!scrollHSlider) return;

        const maxTick = this.midiData?.maxTick || 0;
        const xrange = this.pianoRoll.xrange || parseInt(this.pianoRoll.getAttribute('xrange')) || 128;
        const maxOffset = Math.max(0, maxTick - xrange);

        if (maxOffset > 0) {
            const percentage = (xoffset / maxOffset) * 100;
            scrollHSlider.value = percentage;
        }
    }

    /**
     * Mettre à jour le slider vertical selon yoffset actuel
     */
    updateVerticalSlider(yoffset) {
        const scrollVSlider = document.getElementById('scroll-v-slider');
        if (!scrollVSlider) return;

        const yrange = this.pianoRoll.yrange || parseInt(this.pianoRoll.getAttribute('yrange')) || 36;
        const totalMidiRange = 128;
        const maxOffset = Math.max(0, totalMidiRange - yrange);

        if (maxOffset > 0) {
            const percentage = (yoffset / maxOffset) * 100;
            scrollVSlider.value = percentage;
        }
    }

    /**
     * Défilement horizontal (0-100%)
     */
    scrollHorizontal(percentage) {
        if (!this.pianoRoll) return;

        // Calculer l'offset en fonction de la plage totale du fichier MIDI
        const maxTick = this.midiData?.maxTick || 0;
        const xrange = this.pianoRoll.xrange || parseInt(this.pianoRoll.getAttribute('xrange')) || 128;

        // L'offset maximum = maxTick - xrange (pour permettre de voir la fin)
        const maxOffset = Math.max(0, maxTick - xrange);
        const newOffset = Math.round((percentage / 100) * maxOffset);

        this.pianoRoll.xoffset = newOffset;
        this.pianoRoll.setAttribute('xoffset', newOffset.toString());

        if (typeof this.pianoRoll.redraw === 'function') {
            this.pianoRoll.redraw();
        }
    }

    /**
     * Défilement vertical (0-100%)
     */
    scrollVertical(percentage) {
        if (!this.pianoRoll) return;

        const yrange = this.pianoRoll.yrange || parseInt(this.pianoRoll.getAttribute('yrange')) || 36;

        // Plage complète MIDI: 0-127 notes
        const totalMidiRange = 128;
        const maxOffset = Math.max(0, totalMidiRange - yrange);
        const newOffset = Math.round((percentage / 100) * maxOffset);

        this.pianoRoll.yoffset = newOffset;
        this.pianoRoll.setAttribute('yoffset', newOffset.toString());

        if (typeof this.pianoRoll.redraw === 'function') {
            this.pianoRoll.redraw();
        }
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

        // Arrêter la synchronisation des sliders
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
            this.syncInterval = null;
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
