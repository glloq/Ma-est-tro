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

        // Clipboard pour copy/paste
        this.clipboard = [];

        // Mode d'édition actuel
        this.editMode = 'drag-view'; // 'select', 'drag-notes', 'drag-view' - drag-view par défaut pour navigation

        // Instrument sélectionné pour les nouveaux canaux (program MIDI GM)
        this.selectedInstrument = 0; // Piano par défaut

        // CC/Pitchbend Editor
        this.ccEditor = null;
        this.currentCCType = 'cc1'; // 'cc1', 'cc7', 'cc10', 'cc11', 'pitchbend'
        this.ccEvents = []; // Événements CC et pitchbend
        this.ccSectionExpanded = false; // État du collapse de la section CC

        // Grille de snap pour l'édition (contrainte de positionnement)
        // Valeurs en ticks (basé sur 480 ticks par noire)
        // Progression optimisée : précision maximale pour 1/16, valeurs raisonnables pour subdivisions larges
        this.snapValues = [
            { ticks: 120, label: '1/1' },  // Ronde (snap à 120 = 1/16, évite sauts énormes)
            { ticks: 60,  label: '1/2' },  // Blanche (snap à 60 = 1/32)
            { ticks: 30,  label: '1/4' },  // Noire (snap à 30 = 1/64)
            { ticks: 15,  label: '1/8' },  // Croche (snap à 15 = 1/128)
            { ticks: 1,   label: '1/16' }  // Double croche (snap à 1 tick = PRÉCISION MAXIMALE)
        ];
        this.currentSnapIndex = 3; // Par défaut 1/8 (15 ticks, très fin)

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

        // CommandHistory n'est plus utilisé - le piano roll gère undo/redo nativement

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
        this.ticksPerBeat = ticksPerBeat; // Sauvegarder pour utilisation ultérieure

        // Extraire le tempo du fichier MIDI (généralement dans la première piste)
        let tempo = 120; // Tempo par défaut
        if (this.midiData.tracks && this.midiData.tracks.length > 0) {
            for (const track of this.midiData.tracks) {
                if (track.events) {
                    const tempoEvent = track.events.find(e => e.type === 'setTempo');
                    if (tempoEvent && tempoEvent.microsecondsPerBeat) {
                        // Convertir microsecondes par beat en BPM
                        tempo = Math.round(60000000 / tempoEvent.microsecondsPerBeat);
                        this.log('info', `Tempo found: ${tempo} BPM`);
                        break;
                    }
                }
            }
        }
        this.tempo = tempo; // Sauvegarder pour utilisation ultérieure

        this.log('info', `Converting MIDI: ${this.midiData.tracks.length} tracks, ${ticksPerBeat} ticks/beat, ${tempo} BPM`);

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

        // Extraire les événements CC et pitchbend
        this.extractCCAndPitchbend();

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
     * Obtenir l'ensemble de TOUS les canaux ayant des événements CC/Pitchbend
     * (tous types confondus)
     */
    getAllCCChannels() {
        const channels = new Set();
        this.ccEvents.forEach(event => {
            if (event.channel !== undefined) {
                channels.add(event.channel);
            }
        });
        return Array.from(channels).sort((a, b) => a - b);
    }

    /**
     * Obtenir l'ensemble des canaux utilisés par le type CC/Pitchbend actuel
     */
    getCCChannelsUsed() {
        const channels = new Set();
        this.ccEvents.forEach(event => {
            // Filtrer uniquement les événements du type CC actuellement sélectionné
            if (event.type === this.currentCCType && event.channel !== undefined) {
                channels.add(event.channel);
            }
        });
        return Array.from(channels).sort((a, b) => a - b);
    }

    /**
     * Mettre à jour le sélecteur de canal pour afficher uniquement les canaux utilisés
     */
    updateCCChannelSelector() {
        const channelSelector = this.container?.querySelector('.cc-channel-selector');
        if (!channelSelector) return;

        const usedChannels = this.getCCChannelsUsed();

        // Si aucun canal n'est utilisé pour le type actuel, afficher tous les canaux ayant des CC/Pitchbend
        const channelsToShow = usedChannels.length > 0 ? usedChannels : this.getAllCCChannels();

        // Obtenir le canal actuellement actif
        const activeChannel = this.ccEditor ? this.ccEditor.currentChannel : 0;

        // Si aucun canal n'a de CC/Pitchbend, afficher un message
        if (channelsToShow.length === 0) {
            channelSelector.innerHTML = '<div class="cc-no-channels">Aucun CC/Pitchbend dans ce fichier</div>';
            this.log('info', 'Aucun canal avec CC/Pitchbend trouvé');
            return;
        }

        // Générer les boutons uniquement pour les canaux utilisés
        channelSelector.innerHTML = channelsToShow.map(channel => `
            <button class="cc-channel-btn ${channel === activeChannel ? 'active' : ''}" data-channel="${channel}" title="Canal ${channel + 1}">
                ${channel + 1}
            </button>
        `).join('');

        // Réattacher les event listeners
        this.attachCCChannelListeners();

        const allChannels = this.getAllCCChannels();
        this.log('info', `Sélecteur de canal CC mis à jour - Type ${this.currentCCType}: ${usedChannels.length} canaux, Total CC/PB: ${allChannels.length} canaux`);
    }

    /**
     * Attacher les event listeners aux boutons de canal CC
     */
    attachCCChannelListeners() {
        if (!this.container) return;

        const channelButtons = this.container.querySelectorAll('.cc-channel-btn');
        channelButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const channel = parseInt(btn.dataset.channel);

                if (!isNaN(channel) && this.ccEditor) {
                    // Mettre à jour l'UI
                    channelButtons.forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');

                    // Mettre à jour l'éditeur
                    this.ccEditor.setChannel(channel);
                    this.log('info', `Canal CC sélectionné: ${channel + 1}`);
                }
            });
        });
    }

    /**
     * Extraire les événements CC et pitchbend de toutes les pistes
     * Format de sortie attendu par CCPitchbendEditor:
     * { type: 'cc1'|'cc7'|'cc10'|'cc11'|'pitchbend', ticks: number, value: number, channel: number }
     */
    extractCCAndPitchbend() {
        this.ccEvents = [];

        if (!this.midiData || !this.midiData.tracks) {
            this.log('warn', 'No MIDI tracks to extract CC/pitchbend');
            return;
        }

        this.midiData.tracks.forEach((track, trackIndex) => {
            if (!track.events) {
                return;
            }

            let currentTick = 0;

            track.events.forEach((event) => {
                currentTick += event.deltaTime || 0;

                // Control Change events
                if (event.type === 'controller') {
                    const channel = event.channel !== undefined ? event.channel : 0;
                    const controller = event.controllerType;

                    // Convertir le numéro de contrôleur en type pour l'éditeur
                    let ccType = null;
                    if (controller === 1) ccType = 'cc1';
                    else if (controller === 7) ccType = 'cc7';
                    else if (controller === 10) ccType = 'cc10';
                    else if (controller === 11) ccType = 'cc11';

                    // Stocker uniquement les CC supportés
                    if (ccType) {
                        this.ccEvents.push({
                            type: ccType,
                            ticks: currentTick,
                            channel: channel,
                            value: event.value,
                            id: Date.now() + Math.random() + this.ccEvents.length
                        });
                    }
                }

                // Pitch Bend events
                if (event.type === 'pitchBend') {
                    const channel = event.channel !== undefined ? event.channel : 0;
                    this.ccEvents.push({
                        type: 'pitchbend',
                        ticks: currentTick,
                        channel: channel,
                        value: event.value,
                        id: Date.now() + Math.random() + this.ccEvents.length
                    });
                }
            });
        });

        // Trier par tick
        this.ccEvents.sort((a, b) => a.ticks - b.ticks);

        this.log('info', `Extracted ${this.ccEvents.length} CC/pitchbend events`);

        // Log summary by type
        const cc1Count = this.ccEvents.filter(e => e.type === 'cc1').length;
        const cc7Count = this.ccEvents.filter(e => e.type === 'cc7').length;
        const cc10Count = this.ccEvents.filter(e => e.type === 'cc10').length;
        const cc11Count = this.ccEvents.filter(e => e.type === 'cc11').length;
        const pitchbendCount = this.ccEvents.filter(e => e.type === 'pitchbend').length;
        this.log('info', `  - CC1: ${cc1Count}, CC7: ${cc7Count}, CC10: ${cc10Count}, CC11: ${cc11Count}, Pitchbend: ${pitchbendCount}`);

        // Log des canaux utilisés
        const usedChannels = this.getCCChannelsUsed();
        if (usedChannels.length > 0) {
            this.log('info', `  - Canaux utilisés: ${usedChannels.map(c => c + 1).join(', ')}`);
        }
    }

    /**
     * Basculer l'affichage d'un canal
     */
    toggleChannel(channel) {
        // Sauvegarder les canaux actuellement actifs AVANT le toggle
        const previousActiveChannels = new Set(this.activeChannels);

        if (this.activeChannels.has(channel)) {
            this.activeChannels.delete(channel);
        } else {
            this.activeChannels.add(channel);
        }

        this.log('info', `Toggled channel ${channel}. Active channels: [${Array.from(this.activeChannels).join(', ')}]`);

        this.updateSequenceFromActiveChannels(previousActiveChannels);
        this.updateChannelButtons();
        this.updateInstrumentSelector();

        // Mettre à jour le canal pour l'édition CC
        this.updateCCEditorChannel();
    }

    /**
     * Mettre à jour la séquence depuis les canaux actifs
     * @param {Set} previousActiveChannels - Canaux qui étaient actifs AVANT le changement (optionnel)
     */
    updateSequenceFromActiveChannels(previousActiveChannels = null) {
        // D'ABORD: synchroniser fullSequence avec le piano roll actuel
        // pour ne pas perdre les modifications
        // Passer les canaux précédents pour savoir quelles notes sont dans le piano roll
        this.syncFullSequenceFromPianoRoll(previousActiveChannels);

        if (this.activeChannels.size === 0) {
            this.sequence = [];
        } else {
            this.sequence = this.fullSequence.filter(note => this.activeChannels.has(note.c));
        }

        this.log('info', `Updated sequence: ${this.sequence.length} notes from ${this.activeChannels.size} active channel(s)`);

        // Mettre à jour le piano roll si il existe
        if (this.pianoRoll) {
            // Vider complètement la séquence du piano roll d'abord
            this.pianoRoll.sequence.length = 0;

            // Puis copier les nouvelles notes
            this.sequence.forEach(note => {
                this.pianoRoll.sequence.push({...note});
            });

            // S'assurer que les couleurs sont toujours définies
            this.pianoRoll.channelColors = this.channelColors;

            // Définir le canal par défaut pour les nouvelles notes (premier canal actif)
            if (this.activeChannels.size > 0) {
                this.pianoRoll.defaultChannel = Array.from(this.activeChannels)[0];
                this.log('debug', `Default channel for new notes: ${this.pianoRoll.defaultChannel}`);
            }

            // Forcer un redraw complet
            if (typeof this.pianoRoll.redraw === 'function') {
                this.pianoRoll.redraw();
                this.log('debug', `Piano roll redrawn after channel toggle: ${this.pianoRoll.sequence.length} notes visible`);
            }
        }
    }

    /**
     * Synchroniser fullSequence avec les notes actuelles du piano roll
     * pour ne pas perdre les modifications (suppressions, ajouts, etc.)
     * @param {Set} previousActiveChannels - Canaux qui étaient visibles dans le piano roll (optionnel)
     */
    syncFullSequenceFromPianoRoll(previousActiveChannels = null) {
        if (!this.pianoRoll || !this.pianoRoll.sequence) return;

        const currentSequence = this.pianoRoll.sequence;

        // Reconstruire fullSequence en fusionnant:
        // - Les notes des canaux actuellement visibles dans le piano roll (potentiellement modifiées)
        // - Les notes des canaux invisibles dans le piano roll (non modifiées)

        // 1. Utiliser previousActiveChannels (si fourni) ou this.activeChannels pour savoir
        //    quels canaux sont actuellement affichés dans le piano roll
        const visibleChannels = previousActiveChannels || this.activeChannels;

        // 2. Garder les notes des canaux qui ne sont PAS visibles dans le piano roll
        //    (Ces notes n'ont pas été touchées)
        const invisibleNotes = this.fullSequence.filter(note => !visibleChannels.has(note.c));

        // 3. Prendre TOUTES les notes du piano roll
        //    (Elles ont potentiellement des canaux modifiés via changeChannelSelection)
        const visibleNotes = currentSequence.map(note => ({
            t: note.t,
            g: note.g,
            n: note.n,
            c: note.c !== undefined ? note.c : Array.from(visibleChannels)[0] || 0, // Assurer que c existe
            v: note.v || 100 // Préserver velocity
        }));

        // 4. Fusionner
        this.fullSequence = [...invisibleNotes, ...visibleNotes];

        // 5. Trier par tick
        this.fullSequence.sort((a, b) => a.t - b.t);

        this.log('debug', `Synced fullSequence: ${invisibleNotes.length} invisible + ${visibleNotes.length} visible = ${this.fullSequence.length} total (using ${previousActiveChannels ? 'previous' : 'current'} active channels)`);
    }

    // ========================================================================
    // GESTION DU MODE CC/PITCHBEND
    // ========================================================================

    /**
     * Basculer l'état collapsed/expanded de la section CC
     */
    toggleCCSection() {
        this.ccSectionExpanded = !this.ccSectionExpanded;

        const ccSection = document.getElementById('cc-section');
        const ccContent = document.getElementById('cc-section-content');
        const ccHeader = document.getElementById('cc-section-header');

        if (ccSection && ccContent && ccHeader) {
            if (this.ccSectionExpanded) {
                ccSection.classList.add('expanded');
                ccSection.classList.remove('collapsed');
                ccHeader.classList.add('expanded');
                ccHeader.classList.remove('collapsed');

                // Initialiser l'éditeur CC s'il n'existe pas encore
                if (!this.ccEditor) {
                    this.initCCEditor();
                } else {
                    // Forcer un rendu pour s'assurer que le canvas est à jour
                    this.ccEditor.resize();
                    this.ccEditor.render();
                }
            } else {
                ccSection.classList.remove('expanded');
                ccSection.classList.add('collapsed');
                ccHeader.classList.remove('expanded');
                ccHeader.classList.add('collapsed');
            }
        }

        this.log('info', `Section CC ${this.ccSectionExpanded ? 'expanded' : 'collapsed'}`);
    }

    /**
     * Sélectionner le type de CC à éditer
     */
    selectCCType(ccType) {
        this.currentCCType = ccType;
        this.log('info', `CC Type sélectionné: ${ccType}`);

        // Mettre à jour les boutons
        const ccTypeButtons = this.container?.querySelectorAll('.cc-type-btn-v');
        ccTypeButtons?.forEach(btn => {
            if (btn.dataset.ccType === ccType) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });

        // Mettre à jour l'éditeur CC
        if (this.ccEditor) {
            this.ccEditor.setCC(ccType);
            // Mettre à jour le sélecteur de canal car les canaux utilisés peuvent varier selon le type CC
            this.updateCCChannelSelector();
        }
    }

    /**
     * Mettre à jour le canal actif pour l'édition CC
     */
    updateCCEditorChannel() {
        if (!this.ccEditor) return;

        // Utiliser le premier canal actif comme canal pour l'édition CC
        const activeChannel = this.activeChannels.size > 0
            ? Array.from(this.activeChannels)[0]
            : 0;

        this.ccEditor.setChannel(activeChannel);
        this.log('info', `Canal CC mis à jour: ${activeChannel}`);
    }

    /**
     * Initialiser l'éditeur CC/Pitchbend
     */
    initCCEditor() {
        const container = document.getElementById('cc-editor-container');
        if (!container) {
            this.log('warn', 'Container cc-editor-container not found');
            return;
        }

        if (this.ccEditor) {
            this.log('info', 'CC Editor already initialized');
            return;
        }

        this.log('info', `Initializing CC Editor with ${this.ccEvents.length} total CC events`);

        // Obtenir les paramètres du piano roll
        const options = {
            height: 150,
            timebase: this.pianoRoll?.timebase || 480,
            xrange: this.pianoRoll?.xrange || 1920,
            xoffset: this.pianoRoll?.xoffset || 0,
            grid: this.snapValues[this.currentSnapIndex].ticks
        };

        // Créer l'éditeur
        this.ccEditor = new CCPitchbendEditor(container, options);
        this.ccEditor.setCC(this.currentCCType);

        // Charger les événements existants AVANT de mettre à jour le sélecteur
        if (this.ccEvents.length > 0) {
            this.ccEditor.loadEvents(this.ccEvents);
            this.log('info', `Loaded ${this.ccEvents.length} CC events into editor`);
        }

        // Mettre à jour le sélecteur de canal pour afficher uniquement les canaux utilisés
        this.updateCCChannelSelector();

        // Obtenir le canal actif (premier canal utilisé pour ce type, sinon premier canal avec CC/PB)
        const usedChannels = this.getCCChannelsUsed();
        const allChannels = this.getAllCCChannels();
        const activeChannel = usedChannels.length > 0 ? usedChannels[0] : (allChannels.length > 0 ? allChannels[0] : 0);
        this.ccEditor.setChannel(activeChannel);

        this.log('info', `CC Editor initialized - Type: ${this.currentCCType}, Channel: ${activeChannel + 1}, Type channels: [${usedChannels.map(c => c + 1).join(', ')}], All CC channels: [${allChannels.map(c => c + 1).join(', ')}]`);
    }

    /**
     * Synchroniser l'éditeur CC avec le piano roll
     */
    syncCCEditor() {
        if (!this.ccEditor || !this.pianoRoll) return;

        this.ccEditor.syncWith({
            xrange: this.pianoRoll.xrange,
            xoffset: this.pianoRoll.xoffset,
            grid: this.snapValues[this.currentSnapIndex].ticks,
            timebase: this.pianoRoll.timebase
        });
    }

    /**
     * Synchroniser les événements depuis l'éditeur CC vers this.ccEvents
     * Appelé avant la sauvegarde pour récupérer les modifications
     */
    syncCCEventsFromEditor() {
        if (!this.ccEditor) return;

        // Récupérer tous les événements depuis l'éditeur
        const editorEvents = this.ccEditor.getEvents();

        if (!editorEvents || editorEvents.length === 0) {
            this.log('info', 'No CC events in editor');
            this.ccEvents = [];
            return;
        }

        // Les événements de l'éditeur sont déjà au bon format
        // { type: 'cc1'|'cc7'|'cc10'|'cc11'|'pitchbend', ticks: number, value: number, channel: number }
        this.ccEvents = editorEvents.map(e => ({
            type: e.type,
            ticks: e.ticks,
            channel: e.channel,
            value: e.value,
            id: e.id
        }));

        this.log('info', `Synchronized ${this.ccEvents.length} CC/pitchbend events from editor`);
    }

    /**
     * Mettre à jour la liste des canaux basée sur fullSequence
     */
    updateChannelsFromSequence() {
        const channelNoteCount = new Map();
        const channelPrograms = new Map();

        // Compter les notes par canal et préserver les programmes existants
        this.fullSequence.forEach(note => {
            const channel = note.c !== undefined ? note.c : 0;
            channelNoteCount.set(channel, (channelNoteCount.get(channel) || 0) + 1);

            // Trouver le programme pour ce canal (depuis this.channels existants)
            if (!channelPrograms.has(channel)) {
                const existingChannel = this.channels.find(ch => ch.channel === channel);
                if (existingChannel) {
                    channelPrograms.set(channel, existingChannel.program);
                } else {
                    // Nouveau canal : utiliser l'instrument sélectionné
                    channelPrograms.set(channel, this.selectedInstrument || 0);
                }
            }
        });

        // Reconstruire this.channels
        this.channels = [];
        channelNoteCount.forEach((count, channel) => {
            const program = channelPrograms.get(channel) || 0;
            const instrumentName = channel === 9 ? 'Drums' : this.gmInstruments[program];

            this.channels.push({
                channel: channel,
                program: program,
                instrument: instrumentName,
                noteCount: count
            });
        });

        // Trier par numéro de canal
        this.channels.sort((a, b) => a.channel - b.channel);

        this.log('debug', `Updated channels: ${this.channels.length} channels found`);
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

        // Déterminer quels canaux sont utilisés et leurs instruments
        const usedChannels = new Map(); // canal -> program
        fullSequenceToSave.forEach(note => {
            const channel = note.c !== undefined ? note.c : 0;
            if (!usedChannels.has(channel)) {
                // Trouver l'instrument pour ce canal
                const channelInfo = this.channels.find(ch => ch.channel === channel);
                const program = channelInfo ? channelInfo.program : this.selectedInstrument || 0;
                usedChannels.set(channel, program);
            }
        });

        // Ajouter les événements programChange au début (tick 0) pour chaque canal
        usedChannels.forEach((program, channel) => {
            if (channel !== 9) { // Canal 10 (index 9) est pour drums, pas de programChange
                events.push({
                    absoluteTime: 0,
                    type: 'programChange',
                    channel: channel,
                    programNumber: program
                });
                this.log('debug', `Added programChange for channel ${channel}: ${this.gmInstruments[program]}`);
            }
        });

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

        // Ajouter les événements CC et pitchbend
        if (this.ccEvents && this.ccEvents.length > 0) {
            this.log('info', `Adding ${this.ccEvents.length} CC/pitchbend events`);
            this.ccEvents.forEach(ccEvent => {
                // Convertir le type de l'éditeur (cc1, cc7, cc10, cc11) en numéro de contrôleur
                if (ccEvent.type === 'cc1' || ccEvent.type === 'cc7' || ccEvent.type === 'cc10' || ccEvent.type === 'cc11') {
                    // Extraire le numéro du type (cc1 -> 1, cc7 -> 7, etc.)
                    const controllerNumber = parseInt(ccEvent.type.replace('cc', ''));
                    events.push({
                        absoluteTime: ccEvent.ticks || ccEvent.tick,
                        type: 'controller',
                        channel: ccEvent.channel,
                        controllerType: controllerNumber,
                        value: ccEvent.value
                    });
                } else if (ccEvent.type === 'pitchbend') {
                    events.push({
                        absoluteTime: ccEvent.ticks || ccEvent.tick,
                        type: 'pitchBend',
                        channel: ccEvent.channel,
                        value: ccEvent.value
                    });
                }
            });
        }

        // Trier par temps absolu
        events.sort((a, b) => a.absoluteTime - b.absoluteTime);

        // Convertir temps absolu en deltaTime
        let lastTime = 0;
        const trackEvents = events.map(event => {
            const deltaTime = event.absoluteTime - lastTime;
            lastTime = event.absoluteTime;

            const trackEvent = {
                deltaTime: deltaTime,
                type: event.type,
                channel: event.channel
            };

            // Ajouter les champs spécifiques selon le type d'événement
            if (event.type === 'programChange') {
                trackEvent.programNumber = event.programNumber;
            } else if (event.type === 'noteOn' || event.type === 'noteOff') {
                trackEvent.noteNumber = event.noteNumber;
                trackEvent.velocity = event.velocity;
            } else if (event.type === 'controller') {
                trackEvent.controllerType = event.controllerType;
                trackEvent.value = event.value;
            } else if (event.type === 'pitchBend') {
                trackEvent.value = event.value;
            }

            return trackEvent;
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

            // Synchroniser fullSequence avec le piano roll actuel (gère les canaux, ajouts, suppressions, etc.)
            this.syncFullSequenceFromPianoRoll();

            // Synchroniser les événements CC/Pitchbend depuis l'éditeur
            this.syncCCEventsFromEditor();

            // Mettre à jour la liste des canaux pour refléter la séquence actuelle
            this.updateChannelsFromSequence();

            this.log('info', `Saving ${this.fullSequence.length} notes across ${this.channels.length} channels`);

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
                    title="${ch.noteCount} notes - Canal ${ch.channel + 1}"
                >
                    <span class="channel-label">${ch.channel + 1} : ${ch.instrument}</span>
                </button>
            `;
        });

        buttons += '</div>';
        return buttons;
    }

    /**
     * Rendre les options du sélecteur de canal
     */
    renderChannelOptions() {
        let options = '';
        for (let i = 0; i < 16; i++) {
            const instrumentName = i === 9 ? 'Drums' : this.gmInstruments[0];
            options += `<option value="${i}">Canal ${i + 1}${i === 9 ? ' (Drums)' : ''}</option>`;
        }
        return options;
    }

    /**
     * Rendre les options d'instruments MIDI GM
     */
    renderInstrumentOptions() {
        let options = '';

        // Groupes d'instruments MIDI GM
        const groups = [
            { name: 'Piano', start: 0, count: 8 },
            { name: 'Chromatic Percussion', start: 8, count: 8 },
            { name: 'Organ', start: 16, count: 8 },
            { name: 'Guitar', start: 24, count: 8 },
            { name: 'Bass', start: 32, count: 8 },
            { name: 'Strings', start: 40, count: 8 },
            { name: 'Ensemble', start: 48, count: 8 },
            { name: 'Brass', start: 56, count: 8 },
            { name: 'Reed', start: 64, count: 8 },
            { name: 'Pipe', start: 72, count: 8 },
            { name: 'Synth Lead', start: 80, count: 8 },
            { name: 'Synth Pad', start: 88, count: 8 },
            { name: 'Synth Effects', start: 96, count: 8 },
            { name: 'Ethnic', start: 104, count: 8 },
            { name: 'Percussive', start: 112, count: 8 },
            { name: 'Sound Effects', start: 120, count: 8 }
        ];

        groups.forEach(group => {
            options += `<optgroup label="${group.name}">`;
            for (let i = 0; i < group.count; i++) {
                const program = group.start + i;
                const instrument = this.gmInstruments[program];
                options += `<option value="${program}">${program}: ${instrument}</option>`;
            }
            options += `</optgroup>`;
        });

        return options;
    }

    /**
     * Mettre à jour le sélecteur d'instrument selon les canaux actifs
     */
    updateInstrumentSelector() {
        const instrumentSelector = document.getElementById('instrument-selector');
        const instrumentLabel = document.getElementById('instrument-label');
        const applyBtn = document.getElementById('apply-instrument-btn');

        if (!instrumentSelector) return;

        if (this.activeChannels.size === 0) {
            // Aucun canal actif : afficher "Instrument:" et désactiver
            if (instrumentLabel) instrumentLabel.textContent = 'Instrument:';
            if (applyBtn) applyBtn.disabled = true;
        } else if (this.activeChannels.size === 1) {
            // Un seul canal actif : on peut modifier son instrument
            const activeChannel = Array.from(this.activeChannels)[0];
            const channelInfo = this.channels.find(ch => ch.channel === activeChannel);

            if (channelInfo) {
                // Mettre à jour le label pour indiquer quel canal sera modifié
                if (instrumentLabel) {
                    instrumentLabel.textContent = `Instrument canal ${activeChannel + 1}:`;
                    instrumentLabel.title = '';
                }

                // Mettre à jour le sélecteur pour afficher l'instrument actuel
                instrumentSelector.value = channelInfo.program.toString();

                // Activer le bouton
                if (applyBtn) {
                    applyBtn.disabled = false;
                    applyBtn.title = 'Appliquer l\'instrument au canal';
                }
            }
        } else {
            // Plusieurs canaux actifs : désactiver le bouton et afficher un message clair
            const firstActiveChannel = Array.from(this.activeChannels)[0];
            const channelInfo = this.channels.find(ch => ch.channel === firstActiveChannel);

            if (instrumentLabel) {
                instrumentLabel.textContent = `⚠ ${this.activeChannels.size} canaux actifs`;
                instrumentLabel.title = 'Désactivez les canaux que vous ne voulez pas modifier';
            }

            // Afficher l'instrument du premier canal actif
            if (channelInfo) {
                instrumentSelector.value = channelInfo.program.toString();
            }

            // Désactiver le bouton car plusieurs canaux actifs
            if (applyBtn) {
                applyBtn.disabled = true;
                applyBtn.title = 'Veuillez garder un seul canal actif pour modifier son instrument';
            }
        }
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
                    <!-- Toolbar d'édition -->
                    <div class="editor-toolbar">
                        <!-- Section Undo/Redo -->
                        <div class="toolbar-section">
                            <button class="tool-btn" data-action="undo" id="undo-btn" title="Annuler (Ctrl+Z)" disabled>
                                <span class="icon">↶</span>
                                <span class="btn-label">Annuler</span>
                            </button>
                            <button class="tool-btn" data-action="redo" id="redo-btn" title="Refaire (Ctrl+Y)" disabled>
                                <span class="icon">↷</span>
                                <span class="btn-label">Refaire</span>
                            </button>
                        </div>

                        <div class="toolbar-divider"></div>

                        <!-- Section Grille/Snap -->
                        <div class="toolbar-section">
                            <label class="snap-label">Grille:</label>
                            <button class="tool-btn-snap" data-action="cycle-snap" id="snap-btn" title="Subdivision de la grille (clic pour changer)">
                                <span class="snap-value" id="snap-value">1/8</span>
                            </button>
                        </div>

                        <div class="toolbar-divider"></div>

                        <!-- Section Navigation et Zoom -->
                        <div class="toolbar-section">
                            <button class="tool-btn active" data-action="mode-drag-view" data-mode="drag-view" title="Mode Déplacer Vue (actif par défaut)">
                                <span class="icon">👁️</span>
                                <span class="btn-label">Vue</span>
                            </button>
                            <button class="tool-btn-compact" data-action="zoom-h-out" title="Dézoomer horizontal">H−</button>
                            <button class="tool-btn-compact" data-action="zoom-h-in" title="Zoomer horizontal">H+</button>
                            <button class="tool-btn-compact" data-action="zoom-v-out" title="Dézoomer vertical">V−</button>
                            <button class="tool-btn-compact" data-action="zoom-v-in" title="Zoomer vertical">V+</button>
                        </div>

                        <div class="toolbar-divider"></div>

                        <!-- Section Mode d'édition -->
                        <div class="toolbar-section">
                            <button class="tool-btn" data-action="mode-select" data-mode="select" title="Mode Sélection">
                                <span class="icon">⊕</span>
                                <span class="btn-label">Sélection</span>
                            </button>
                            <button class="tool-btn" data-action="mode-drag-notes" data-mode="drag-notes" title="Mode Déplacer Notes">
                                <span class="icon">🎵</span>
                                <span class="btn-label">Déplacer</span>
                            </button>
                            <button class="tool-btn" data-action="mode-add-note" data-mode="add-note" title="Mode Ajouter Note">
                                <span class="icon">➕</span>
                                <span class="btn-label">Ajouter</span>
                            </button>
                            <button class="tool-btn" data-action="mode-resize-note" data-mode="resize-note" title="Mode Modifier Durée">
                                <span class="icon">↔</span>
                                <span class="btn-label">Durée</span>
                            </button>
                        </div>

                        <div class="toolbar-divider"></div>

                        <!-- Section Édition -->
                        <div class="toolbar-section">
                            <button class="tool-btn" data-action="copy" id="copy-btn" title="Copier (Ctrl+C)" disabled>
                                <span class="icon">📋</span>
                                <span class="btn-label">Copier</span>
                            </button>
                            <button class="tool-btn" data-action="paste" id="paste-btn" title="Coller (Ctrl+V)" disabled>
                                <span class="icon">📄</span>
                                <span class="btn-label">Coller</span>
                            </button>
                            <button class="tool-btn" data-action="delete" id="delete-btn" title="Supprimer (Del)">
                                <span class="icon">🗑</span>
                                <span class="btn-label">Supprimer</span>
                            </button>
                        </div>

                        <div class="toolbar-divider"></div>

                        <!-- Section Canal -->
                        <div class="toolbar-section">
                            <label class="snap-label">Canal:</label>
                            <select class="snap-select" id="channel-selector" title="Changer le canal des notes sélectionnées">
                                ${this.renderChannelOptions()}
                            </select>
                            <button class="tool-btn-compact" data-action="change-channel" id="change-channel-btn" title="Appliquer le canal" disabled>→</button>
                        </div>

                        <div class="toolbar-divider"></div>

                        <!-- Section Instrument -->
                        <div class="toolbar-section">
                            <label class="snap-label" id="instrument-label">Instrument:</label>
                            <select class="snap-select" id="instrument-selector" title="Instrument du canal actif">
                                ${this.renderInstrumentOptions()}
                            </select>
                            <button class="tool-btn-compact" data-action="apply-instrument" id="apply-instrument-btn" title="Appliquer l'instrument au canal">✓</button>
                        </div>
                    </div>

                    <!-- Toolbar des canaux -->
                    <div class="channels-toolbar">
                        ${this.renderChannelButtons()}
                    </div>

                    <!-- Conteneur pour Notes et CC/Pitchbend -->
                    <div class="midi-editor-container">
                        <!-- Section Notes -->
                        <div class="midi-editor-section notes-section">
                            <div class="piano-roll-wrapper">
                                <div class="piano-roll-container" id="piano-roll-container">
                                    <!-- webaudio-pianoroll sera inséré ici -->
                                </div>
                                <!-- Slider vertical avec boutons -->
                                <div class="scroll-controls scroll-controls-vertical">
                                    <button class="scroll-btn scroll-btn-up" data-action="scroll-up">▲</button>
                                    <input type="range" class="scroll-slider scroll-vertical" id="scroll-v-slider" min="0" max="100" value="0" step="1" orient="vertical">
                                    <button class="scroll-btn scroll-btn-down" data-action="scroll-down">▼</button>
                                </div>
                            </div>
                            <!-- Slider horizontal avec boutons (toujours visible) -->
                            <div class="scroll-controls scroll-controls-horizontal">
                                <button class="scroll-btn scroll-btn-left" data-action="scroll-left">◄</button>
                                <input type="range" class="scroll-slider scroll-horizontal" id="scroll-h-slider" min="0" max="100" value="0" step="1">
                                <button class="scroll-btn scroll-btn-right" data-action="scroll-right">►</button>
                            </div>
                        </div>

                        <!-- Section CC/Pitchbend (collapsible) -->
                        <div class="midi-editor-section cc-section collapsed" id="cc-section">
                            <!-- Header collapsible -->
                            <div class="cc-section-header collapsed" id="cc-section-header">
                                <div class="cc-section-title">
                                    <span class="cc-collapse-icon">▼</span>
                                    <span>CC & Pitch Bend</span>
                                </div>
                            </div>

                            <!-- Contenu de l'éditeur CC -->
                            <div class="cc-section-content" id="cc-section-content">
                                <div class="cc-editor-layout">
                                    <!-- Panneau latéral gauche avec sélection CC et outils -->
                                    <div class="cc-sidebar">
                                        <div class="cc-sidebar-label">Type CC/PB</div>
                                        <div class="cc-type-buttons-vertical">
                                            <button class="cc-type-btn-v active" data-cc-type="cc1" title="Modulation Wheel">
                                                CC1<span class="cc-label">Modulation</span>
                                            </button>
                                            <button class="cc-type-btn-v" data-cc-type="cc7" title="Channel Volume">
                                                CC7<span class="cc-label">Volume</span>
                                            </button>
                                            <button class="cc-type-btn-v" data-cc-type="cc10" title="Pan Position">
                                                CC10<span class="cc-label">Pan</span>
                                            </button>
                                            <button class="cc-type-btn-v" data-cc-type="cc11" title="Expression Controller">
                                                CC11<span class="cc-label">Expression</span>
                                            </button>
                                            <button class="cc-type-btn-v" data-cc-type="pitchbend" title="Pitch Wheel">
                                                PB<span class="cc-label">Pitch Bend</span>
                                            </button>
                                        </div>

                                        <div class="cc-sidebar-divider"></div>

                                        <div class="cc-sidebar-label">Outils</div>
                                        <div class="cc-tool-buttons-vertical">
                                            <button class="cc-tool-btn-v active" data-tool="select" title="Sélection">
                                                ⬚<span class="tool-label">Sélection</span>
                                            </button>
                                            <button class="cc-tool-btn-v" data-tool="move" title="Déplacer">
                                                ✥<span class="tool-label">Déplacer</span>
                                            </button>
                                            <button class="cc-tool-btn-v" data-tool="line" title="Ligne">
                                                ╱<span class="tool-label">Ligne</span>
                                            </button>
                                            <button class="cc-tool-btn-v" data-tool="draw" title="Dessin continu">
                                                ✎<span class="tool-label">Dessin</span>
                                            </button>
                                        </div>

                                        <div class="cc-sidebar-divider"></div>

                                        <div class="cc-sidebar-label">Canal</div>
                                        <div class="cc-channel-selector">
                                            ${Array.from({length: 16}, (_, i) => `
                                                <button class="cc-channel-btn ${i === 0 ? 'active' : ''}" data-channel="${i}" title="Canal ${i + 1}">
                                                    ${i + 1}
                                                </button>
                                            `).join('')}
                                        </div>
                                    </div>

                                    <!-- Conteneur de l'éditeur CC -->
                                    <div id="cc-editor-container" class="cc-editor-main"></div>
                                </div>
                            </div>
                        </div>
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

        // Raccourcis clavier
        this.setupKeyboardShortcuts();
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
        this.pianoRoll.setAttribute('wheelzoom', '1');
        this.pianoRoll.setAttribute('xscroll', '1');
        this.pianoRoll.setAttribute('yscroll', '1');
        // Pas de marqueurs (triangles vert/orange)
        this.pianoRoll.setAttribute('markstart', '-1');
        this.pianoRoll.setAttribute('markend', '-1');

        this.log('info', `Piano roll configured: xrange=${xrange}, yrange=${noteRange}, yoffset=${yoffset} (centered), tempo=${this.tempo || 120} BPM, timebase=${this.ticksPerBeat || 480} ticks/beat`);

        // Ajouter au conteneur AVANT de charger la sequence
        container.appendChild(this.pianoRoll);

        // Assigner APRÈS avoir ajouté au DOM pour que les propriétés soient bien initialisées
        // Tempo et timebase du fichier MIDI (importants pour l'affichage du temps en secondes)
        this.pianoRoll.tempo = this.tempo || 120;
        this.pianoRoll.timebase = this.ticksPerBeat || 480;

        // Grille visuelle fixe pour voir les subdivisions (1/16 note = 120 ticks)
        this.pianoRoll.grid = 120;

        // Snap to grid pour contraindre le positionnement des notes
        const currentSnap = this.snapValues[this.currentSnapIndex];
        this.pianoRoll.snap = currentSnap.ticks;

        this.log('info', `Piano roll grid/snap: grid=${this.pianoRoll.grid} ticks, snap=${this.pianoRoll.snap} ticks (${currentSnap.label})`);

        // Forcer updateTimer() et redraw pour afficher les secondes
        if (typeof this.pianoRoll.updateTimer === 'function') {
            this.pianoRoll.updateTimer();
        }
        if (typeof this.pianoRoll.redrawXRuler === 'function') {
            this.pianoRoll.redrawXRuler();
        }

        // Attendre que le composant soit monté
        await new Promise(resolve => setTimeout(resolve, 100));

        // Définir les couleurs des canaux MIDI sur le piano roll AVANT de charger la séquence
        this.pianoRoll.channelColors = this.channelColors;

        // Définir le canal par défaut pour les nouvelles notes (premier canal actif)
        if (this.activeChannels.size > 0) {
            this.pianoRoll.defaultChannel = Array.from(this.activeChannels)[0];
        }

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

        // Optimisation : utiliser un debounce pour éviter les appels multiples
        let changeTimeout = null;
        const handleChange = () => {
            if (changeTimeout) clearTimeout(changeTimeout);
            changeTimeout = setTimeout(() => {
                this.isDirty = true;
                this.updateSaveButton();
                this.syncFullSequenceFromPianoRoll();
                this.updateUndoRedoButtonsState(); // Mettre à jour undo/redo quand la séquence change
            }, 100); // Debounce de 100ms
        };

        // Écouter les changements avec debounce
        this.pianoRoll.addEventListener('change', handleChange);

        // Observer les mutations du sequence pour détecter les changements de sélection uniquement
        let lastSelectionCount = 0;

        this.selectionCheckInterval = setInterval(() => {
            // Vérifier UNIQUEMENT le changement de sélection (très léger)
            const currentSelectionCount = this.getSelectionCount();
            if (currentSelectionCount !== lastSelectionCount) {
                this.updateEditButtons();
                lastSelectionCount = currentSelectionCount;
            }
        }, 2000); // Réduit à 2 secondes pour minimiser la charge

        this.updateStats();
        this.updateEditButtons(); // État initial
        this.updateUndoRedoButtonsState(); // État initial undo/redo
        this.updateInstrumentSelector(); // État initial sélecteur d'instrument

        // Définir le mode par défaut (drag-view pour navigation)
        if (this.pianoRoll && typeof this.pianoRoll.setUIMode === 'function') {
            this.pianoRoll.setUIMode(this.editMode); // 'drag-view' par défaut
            this.log('info', `Piano roll UI mode set to: ${this.editMode}`);
        }

        // L'éditeur CC/Pitchbend sera initialisé lors de l'ouverture de la section
        // via toggleCCSection()
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
    // ACTIONS D'ÉDITION
    // ========================================================================

    /**
     * Annuler la dernière action
     */
    undo() {
        if (!this.pianoRoll || typeof this.pianoRoll.undo !== 'function') {
            this.log('warn', 'Undo not available');
            return;
        }

        if (this.pianoRoll.undo()) {
            this.log('info', 'Undo successful');
            this.isDirty = true;
            this.updateSaveButton();
            this.syncFullSequenceFromPianoRoll();
            this.updateUndoRedoButtonsState();
        }
    }

    /**
     * Refaire la dernière action annulée
     */
    redo() {
        if (!this.pianoRoll || typeof this.pianoRoll.redo !== 'function') {
            this.log('warn', 'Redo not available');
            return;
        }

        if (this.pianoRoll.redo()) {
            this.log('info', 'Redo successful');
            this.isDirty = true;
            this.updateSaveButton();
            this.syncFullSequenceFromPianoRoll();
            this.updateUndoRedoButtonsState();
        }
    }

    /**
     * Mettre à jour l'état des boutons undo/redo
     */
    updateUndoRedoButtonsState() {
        if (!this.pianoRoll) return;

        const undoBtn = document.getElementById('undo-btn');
        const redoBtn = document.getElementById('redo-btn');

        if (undoBtn) {
            undoBtn.disabled = !this.pianoRoll.canUndo();
        }
        if (redoBtn) {
            redoBtn.disabled = !this.pianoRoll.canRedo();
        }
    }

    /**
     * Obtenir les notes sélectionnées du piano roll
     */
    getSelectedNotes() {
        if (!this.pianoRoll) {
            return [];
        }

        // Utiliser la méthode publique du piano roll
        if (typeof this.pianoRoll.getSelectedNotes === 'function') {
            return this.pianoRoll.getSelectedNotes();
        }

        this.log('warn', 'Piano roll does not support getSelectedNotes');
        return [];
    }

    /**
     * Obtenir le nombre de notes sélectionnées
     */
    getSelectionCount() {
        if (!this.pianoRoll || typeof this.pianoRoll.getSelectionCount !== 'function') {
            return 0;
        }
        return this.pianoRoll.getSelectionCount();
    }

    /**
     * Copier les notes sélectionnées
     */
    copy() {
        if (!this.pianoRoll || typeof this.pianoRoll.copySelection !== 'function') {
            this.showNotification('Fonction copier non disponible', 'error');
            return;
        }

        const count = this.getSelectionCount();
        if (count === 0) {
            this.showNotification('Aucune note sélectionnée', 'info');
            return;
        }

        // Utiliser la méthode du piano roll
        this.clipboard = this.pianoRoll.copySelection();

        this.log('info', `Copied ${this.clipboard.length} notes`);
        this.showNotification(`${this.clipboard.length} note(s) copiée(s)`, 'success');

        // Activer le bouton Paste
        const pasteBtn = document.getElementById('paste-btn');
        if (pasteBtn) {
            pasteBtn.disabled = false;
        }

        this.updateEditButtons();
    }

    /**
     * Coller les notes du clipboard
     */
    paste() {
        if (!this.clipboard || this.clipboard.length === 0) {
            this.showNotification('Clipboard vide', 'info');
            return;
        }

        if (!this.pianoRoll || typeof this.pianoRoll.pasteNotes !== 'function') {
            this.showNotification('Fonction coller non disponible', 'error');
            return;
        }

        // Obtenir la position actuelle du curseur
        const currentTime = this.pianoRoll.xoffset || 0;

        // Utiliser la méthode du piano roll
        this.pianoRoll.pasteNotes(this.clipboard, currentTime);

        this.log('info', `Pasted ${this.clipboard.length} notes`);
        this.showNotification(`${this.clipboard.length} note(s) collée(s)`, 'success');

        this.isDirty = true;
        this.updateSaveButton();
        this.syncFullSequenceFromPianoRoll();
        this.updateEditButtons();
    }

    /**
     * Supprimer les notes sélectionnées
     */
    deleteSelectedNotes() {
        if (!this.pianoRoll || typeof this.pianoRoll.deleteSelection !== 'function') {
            this.showNotification('Fonction supprimer non disponible', 'error');
            return;
        }

        const count = this.getSelectionCount();
        if (count === 0) {
            this.showNotification('Aucune note sélectionnée', 'info');
            return;
        }

        // Utiliser la méthode du piano roll
        this.pianoRoll.deleteSelection();

        this.log('info', `Deleted ${count} notes`);
        this.showNotification(`${count} note(s) supprimée(s)`, 'success');

        this.isDirty = true;
        this.updateSaveButton();
        this.syncFullSequenceFromPianoRoll();
        this.updateEditButtons();
    }

    /**
     * Changer le canal des notes sélectionnées
     */
    changeChannel() {
        if (!this.pianoRoll || typeof this.pianoRoll.changeChannelSelection !== 'function') {
            this.showNotification('Fonction changer canal non disponible', 'error');
            return;
        }

        const count = this.getSelectionCount();
        if (count === 0) {
            this.showNotification('Aucune note sélectionnée', 'info');
            return;
        }

        const channelSelector = document.getElementById('channel-selector');
        if (!channelSelector) return;

        const newChannel = parseInt(channelSelector.value);
        const instrumentSelector = document.getElementById('instrument-selector');

        // Vérifier si c'est un nouveau canal
        const channelExists = this.channels.find(ch => ch.channel === newChannel);

        // Si c'est un nouveau canal, utiliser l'instrument sélectionné dans le sélecteur
        if (!channelExists && instrumentSelector) {
            this.selectedInstrument = parseInt(instrumentSelector.value);
            this.log('info', `New channel ${newChannel} will use instrument: ${this.gmInstruments[this.selectedInstrument]}`);
        }

        // Utiliser la méthode du piano roll
        this.pianoRoll.changeChannelSelection(newChannel);

        this.log('info', `Changed channel of ${count} notes to ${newChannel}`);
        this.showNotification(`Canal changé pour ${count} note(s)`, 'success');

        this.isDirty = true;
        this.updateSaveButton();
        this.syncFullSequenceFromPianoRoll();

        // Mettre à jour la liste des canaux pour inclure le nouveau canal
        this.updateChannelsFromSequence();

        // Activer automatiquement le nouveau canal s'il n'était pas actif
        if (!this.activeChannels.has(newChannel)) {
            this.activeChannels.add(newChannel);
            this.updateSequenceFromActiveChannels();
        }

        // Rafraîchir l'affichage des boutons de canal
        const channelsToolbar = this.container?.querySelector('.channels-toolbar');
        if (channelsToolbar) {
            channelsToolbar.innerHTML = this.renderChannelButtons();

            // Réattacher les événements sur les nouveaux boutons
            const channelButtons = this.container.querySelectorAll('.channel-btn');
            channelButtons.forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    const channel = parseInt(btn.dataset.channel);
                    this.toggleChannel(channel);
                });
            });
        }

        // Mettre à jour le sélecteur d'instrument pour refléter le nouveau canal
        this.updateInstrumentSelector();

        this.updateEditButtons();
    }

    /**
     * Appliquer l'instrument sélectionné au canal ciblé
     */
    applyInstrument() {
        if (this.activeChannels.size === 0) {
            this.showNotification('Aucun canal actif', 'info');
            return;
        }

        // Si plusieurs canaux sont actifs, demander de n'en garder qu'un seul
        if (this.activeChannels.size > 1) {
            this.showNotification(
                `Plusieurs canaux actifs (${this.activeChannels.size}). Veuillez désactiver les canaux que vous ne voulez pas modifier en cliquant sur leurs boutons.`,
                'warning'
            );
            return;
        }

        const instrumentSelector = document.getElementById('instrument-selector');
        if (!instrumentSelector) return;

        const selectedProgram = parseInt(instrumentSelector.value);
        const instrumentName = this.gmInstruments[selectedProgram];

        // Un seul canal actif : c'est celui-ci qu'on modifie
        const targetChannel = Array.from(this.activeChannels)[0];
        const channelInfo = this.channels.find(ch => ch.channel === targetChannel);

        if (!channelInfo) {
            this.log('error', `Channel ${targetChannel} not found in this.channels`);
            return;
        }

        // Vérifier si le canal a des notes et si l'instrument change
        if (channelInfo.noteCount > 0 && channelInfo.program !== selectedProgram) {
            const message = `Voulez-vous changer l'instrument du canal ${targetChannel + 1} ?\n\n` +
                `  Actuel: ${channelInfo.instrument} (${channelInfo.noteCount} notes)\n` +
                `  Nouveau: ${instrumentName}`;

            if (!confirm(message)) {
                this.log('info', 'Instrument change cancelled by user');
                return;
            }
        }

        // Appliquer l'instrument au canal ciblé
        channelInfo.program = selectedProgram;
        channelInfo.instrument = targetChannel === 9 ? 'Drums' : instrumentName;

        this.log('info', `Applied instrument ${instrumentName} to channel ${targetChannel}`);
        this.showNotification(`Canal ${targetChannel + 1}: ${instrumentName}`, 'success');

        // Mettre à jour l'affichage des boutons de canal (pour refléter le nouvel instrument)
        // Régénérer complètement les boutons avec les nouveaux noms d'instrument
        const channelsToolbar = this.container?.querySelector('.channels-toolbar');
        if (channelsToolbar) {
            channelsToolbar.innerHTML = this.renderChannelButtons();

            // Réattacher les événements sur les nouveaux boutons
            const channelButtons = this.container.querySelectorAll('.channel-btn');
            channelButtons.forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    const channel = parseInt(btn.dataset.channel);
                    this.toggleChannel(channel);
                });
            });
        }

        this.isDirty = true;
        this.updateSaveButton();
    }

    /**
     * Cycler entre les différentes valeurs de grille/snap
     */
    cycleSnap() {
        // Passer à la valeur suivante (cycle)
        this.currentSnapIndex = (this.currentSnapIndex + 1) % this.snapValues.length;

        const currentSnap = this.snapValues[this.currentSnapIndex];

        // Mettre à jour l'affichage du bouton
        const snapValueElement = document.getElementById('snap-value');
        if (snapValueElement) {
            snapValueElement.textContent = currentSnap.label;
        }

        // Appliquer le snap au piano roll (grille visuelle reste fixe à 120)
        // Utiliser la propriété JavaScript pour s'assurer que le changement est bien appliqué
        if (this.pianoRoll) {
            this.pianoRoll.snap = currentSnap.ticks;
            this.log('info', `Snap to grid changed to ${currentSnap.label} (${currentSnap.ticks} ticks) - snap property set to ${this.pianoRoll.snap}`);
        }

        // Synchroniser l'éditeur CC
        this.syncCCEditor();

        this.showNotification(`Magnétisme: ${currentSnap.label}`, 'info');
    }

    /**
     * Changer le mode d'édition
     */
    setEditMode(mode) {
        this.editMode = mode;

        // Utiliser la méthode setUIMode du piano roll
        if (this.pianoRoll && typeof this.pianoRoll.setUIMode === 'function') {
            this.pianoRoll.setUIMode(mode);
        }

        // Mettre à jour l'UI
        this.updateModeButtons();

        this.log('info', `Edit mode changed to: ${mode}`);
    }

    /**
     * Mettre à jour les boutons de mode
     */
    updateModeButtons() {
        const modeButtons = this.container?.querySelectorAll('[data-mode]');
        if (!modeButtons) return;

        modeButtons.forEach(btn => {
            const btnMode = btn.dataset.mode;
            if (btnMode === this.editMode) {
                btn.classList.add('active');
                btn.disabled = true; // Griser le bouton du mode actif
            } else {
                btn.classList.remove('active');
                btn.disabled = false;
            }
        });
    }

    /**
     * Mettre à jour les boutons d'édition (copy, paste, delete, change channel)
     */
    updateEditButtons() {
        const selectionCount = this.getSelectionCount();
        const hasSelection = selectionCount > 0;

        const copyBtn = document.getElementById('copy-btn');
        const deleteBtn = document.getElementById('delete-btn');
        const changeChannelBtn = document.getElementById('change-channel-btn');

        if (copyBtn) copyBtn.disabled = !hasSelection;
        if (deleteBtn) deleteBtn.disabled = !hasSelection;
        if (changeChannelBtn) changeChannelBtn.disabled = !hasSelection;

        this.log('debug', `Selection: ${selectionCount} notes`);
    }

    /**
     * Configurer les raccourcis clavier
     */
    setupKeyboardShortcuts() {
        this.keyboardHandler = (e) => {
            // Ignorer si on est dans un input/textarea
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
                return;
            }

            // Ctrl/Cmd + Z = Undo
            if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
                e.preventDefault();
                this.undo();
            }

            // Ctrl/Cmd + Y = Redo (ou Ctrl/Cmd + Shift + Z)
            else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
                e.preventDefault();
                this.redo();
            }

            // Ctrl/Cmd + C = Copy
            else if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
                e.preventDefault();
                this.copy();
            }

            // Ctrl/Cmd + V = Paste
            else if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
                e.preventDefault();
                this.paste();
            }

            // Delete ou Backspace = Delete
            else if (e.key === 'Delete' || e.key === 'Backspace') {
                e.preventDefault();
                this.deleteSelectedNotes();
            }
        };

        document.addEventListener('keydown', this.keyboardHandler);
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

                // Boutons de navigation des sliders
                case 'scroll-left':
                    this.scrollByHalf('left');
                    break;
                case 'scroll-right':
                    this.scrollByHalf('right');
                    break;
                case 'scroll-up':
                    this.scrollByHalf('up');
                    break;
                case 'scroll-down':
                    this.scrollByHalf('down');
                    break;

                // Nouveaux boutons d'édition
                case 'undo':
                    this.undo();
                    break;
                case 'redo':
                    this.redo();
                    break;
                case 'copy':
                    this.copy();
                    break;
                case 'paste':
                    this.paste();
                    break;
                case 'delete':
                    this.deleteSelectedNotes();
                    break;
                case 'change-channel':
                    this.changeChannel();
                    break;
                case 'apply-instrument':
                    this.applyInstrument();
                    break;
                case 'cycle-snap':
                    this.cycleSnap();
                    break;

                // Modes d'édition
                case 'mode-select':
                case 'mode-drag-notes':
                case 'mode-drag-view':
                case 'mode-add-note':
                case 'mode-resize-note':
                    const mode = btn.dataset.mode;
                    if (mode) {
                        this.setEditMode(mode);
                    }
                    break;
            }
        });

        // Boutons de canal
        const channelButtons = this.container.querySelectorAll('.channel-btn');
        channelButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const channel = parseInt(btn.dataset.channel);
                if (!isNaN(channel)) {
                    this.toggleChannel(channel);
                }
            });
        });

        // Header de la section CC (collapse/expand)
        const ccSectionHeader = document.getElementById('cc-section-header');
        if (ccSectionHeader) {
            ccSectionHeader.addEventListener('click', (e) => {
                e.preventDefault();
                this.toggleCCSection();
            });
        }

        // Boutons de type CC (verticaux)
        const ccTypeButtons = this.container.querySelectorAll('.cc-type-btn-v');
        ccTypeButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const ccType = btn.dataset.ccType;
                if (ccType) {
                    this.selectCCType(ccType);
                }
            });
        });

        // Boutons d'outils CC (verticaux)
        const ccToolButtons = this.container.querySelectorAll('.cc-tool-btn-v');
        ccToolButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const tool = btn.dataset.tool;
                if (tool && this.ccEditor) {
                    // Désactiver tous les boutons
                    ccToolButtons.forEach(b => b.classList.remove('active'));
                    // Activer le bouton cliqué
                    btn.classList.add('active');
                    // Changer l'outil
                    this.ccEditor.setTool(tool);
                }
            });
        });

        // Les event listeners pour les boutons de canal CC sont attachés
        // dans attachCCChannelListeners() appelé depuis initCCEditor()
        // pour éviter les conflits lors de la mise à jour dynamique des canaux

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

        // Sélecteur d'instrument pour nouveaux canaux
        const instrumentSelector = document.getElementById('instrument-selector');
        if (instrumentSelector) {
            instrumentSelector.addEventListener('change', (e) => {
                this.selectedInstrument = parseInt(e.target.value);
                this.log('info', `Selected instrument changed to: ${this.gmInstruments[this.selectedInstrument]} (${this.selectedInstrument})`);
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
     * Ajuster la grille en fonction du niveau de zoom horizontal
     * Plus on dézoome, moins on affiche de lignes de grille
     */
    updateGridResolution(xrange) {
        if (!this.pianoRoll) return;

        let gridValue;

        // Cacher le quadrillage si zoom supérieur à 2000
        if (xrange > 2000) {
            gridValue = 100000; // Valeur très grande = grille invisible
        }
        // Adapter la résolution de la grille selon le zoom
        // grid = pas en ticks entre les lignes (petit = beaucoup de lignes, grand = peu de lignes)
        // Donc: plus on est zoomé (petit xrange), plus grid doit être PETIT
        else if (xrange < 500) {
            gridValue = 1;  // Ultra zoomé : ligne tous les 1 tick (maximum de détails)
        } else if (xrange < 1000) {
            gridValue = 2;  // Très zoomé : ligne tous les 2 ticks
        } else if (xrange < 1500) {
            gridValue = 4;  // Zoomé : ligne tous les 4 ticks (quarter notes)
        } else {
            gridValue = 8;  // Normal : ligne tous les 8 ticks
        }

        // Mettre à jour les deux : attribut ET propriété
        this.pianoRoll.setAttribute('grid', gridValue.toString());
        if (this.pianoRoll.grid !== undefined) {
            this.pianoRoll.grid = gridValue;
        }

        this.log('info', `Grid resolution updated: ${gridValue} (xrange=${xrange})`);
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
        const newRange = Math.max(16, Math.min(100000, Math.round(currentRange * factor)));

        // Essayer les deux méthodes
        this.pianoRoll.setAttribute('xrange', newRange.toString());
        if (this.pianoRoll.xrange !== undefined) {
            this.pianoRoll.xrange = newRange;
        }

        // Ajuster la grille en fonction du nouveau zoom
        this.updateGridResolution(newRange);

        // Forcer le redraw avec un court délai
        setTimeout(() => {
            if (typeof this.pianoRoll.redraw === 'function') {
                this.pianoRoll.redraw();
            }
        }, 50);

        // Synchroniser l'éditeur CC
        this.syncCCEditor();

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

        // Synchroniser l'éditeur CC
        this.syncCCEditor();
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

    /**
     * Déplacer la vue de moitié dans une direction
     * @param {string} direction - 'left', 'right', 'up', 'down'
     */
    scrollByHalf(direction) {
        if (!this.pianoRoll) return;

        if (direction === 'left' || direction === 'right') {
            // Déplacement horizontal
            const currentXOffset = this.pianoRoll.xoffset || 0;
            const xrange = this.pianoRoll.xrange || parseInt(this.pianoRoll.getAttribute('xrange')) || 128;
            const maxTick = this.midiData?.maxTick || 0;
            const maxOffset = Math.max(0, maxTick - xrange);

            // Déplacer de la moitié de xrange
            const halfRange = xrange / 2;
            let newOffset;

            if (direction === 'left') {
                newOffset = Math.max(0, currentXOffset - halfRange);
            } else { // right
                newOffset = Math.min(maxOffset, currentXOffset + halfRange);
            }

            // Convertir en pourcentage et utiliser scrollHorizontal
            const percentage = maxOffset > 0 ? (newOffset / maxOffset) * 100 : 0;
            this.scrollHorizontal(percentage);

            // Mettre à jour le slider
            this.updateHorizontalSlider(newOffset);

        } else if (direction === 'up' || direction === 'down') {
            // Déplacement vertical
            const currentYOffset = this.pianoRoll.yoffset || 0;
            const yrange = this.pianoRoll.yrange || parseInt(this.pianoRoll.getAttribute('yrange')) || 36;
            const totalMidiRange = 128;
            const maxOffset = Math.max(0, totalMidiRange - yrange);

            // Déplacer de la moitié de yrange
            const halfRange = yrange / 2;
            let newOffset;

            if (direction === 'up') {
                newOffset = Math.min(maxOffset, currentYOffset + halfRange);
            } else { // down
                newOffset = Math.max(0, currentYOffset - halfRange);
            }

            // Convertir en pourcentage et utiliser scrollVertical
            const percentage = maxOffset > 0 ? (newOffset / maxOffset) * 100 : 0;
            this.scrollVertical(percentage);

            // Mettre à jour le slider
            this.updateVerticalSlider(newOffset);
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
                '⚠️ Modifications non sauvegardées ⚠️\n\n' +
                'Vous avez effectué des modifications qui n\'ont pas été sauvegardées.\n\n' +
                'Si vous fermez maintenant, ces modifications seront PERDUES.\n\n' +
                'Cliquez sur "Annuler" pour revenir à l\'éditeur et sauvegarder vos modifications.\n' +
                'Cliquez sur "OK" pour fermer SANS sauvegarder (les modifications seront perdues).'
            );
            if (!confirmClose) return;
        }

        // Arrêter la synchronisation des sliders
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
            this.syncInterval = null;
        }

        // Arrêter la vérification de sélection
        if (this.selectionCheckInterval) {
            clearInterval(this.selectionCheckInterval);
            this.selectionCheckInterval = null;
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

        // Retirer les raccourcis clavier
        if (this.keyboardHandler) {
            document.removeEventListener('keydown', this.keyboardHandler);
            this.keyboardHandler = null;
        }

        // Nettoyer l'historique du piano roll
        if (this.pianoRoll && typeof this.pianoRoll.clearHistory === 'function') {
            this.pianoRoll.clearHistory();
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
        this.clipboard = [];

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
