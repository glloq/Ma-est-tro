// ============================================================================
// Fichier: public/js/views/components/PianoRollView.js
// Version: v1.0.0 - Piano roll view pour l'écran principal
// Description: Affiche un piano roll des notes à venir pendant la lecture
// ============================================================================

class PianoRollView {
    constructor(eventBus, logger) {
        this.eventBus = eventBus;
        this.logger = logger;

        // État
        this.isVisible = false;
        this.midiData = null;
        this.sequence = [];
        this.fullSequence = [];
        this.channels = [];
        this.activeChannels = new Set();
        this.mutedChannels = new Set();

        // Piano roll element
        this.pianoRoll = null;
        this.container = null;

        // Playback state
        this.isPlaying = false;
        this.currentTick = 0;
        this.ticksPerBeat = 480;
        this.tempo = 120;
        this.displayTimeSeconds = 20;

        // Animation
        this.animationFrameId = null;
        this.lastUpdateTime = 0;

        // Feature enabled state (from settings)
        this.isEnabled = false;

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

        // Couleur grise pour les canaux mutés
        this.mutedColor = '#666666';

        // Table des instruments General MIDI (simplifiée)
        this.gmInstruments = [
            'Acoustic Grand Piano', 'Bright Acoustic Piano', 'Electric Grand Piano', 'Honky-tonk Piano',
            'Electric Piano 1', 'Electric Piano 2', 'Harpsichord', 'Clavinet',
            'Celesta', 'Glockenspiel', 'Music Box', 'Vibraphone', 'Marimba', 'Xylophone', 'Tubular Bells', 'Dulcimer',
            'Drawbar Organ', 'Percussive Organ', 'Rock Organ', 'Church Organ', 'Reed Organ', 'Accordion', 'Harmonica', 'Tango Accordion',
            'Acoustic Guitar (nylon)', 'Acoustic Guitar (steel)', 'Electric Guitar (jazz)', 'Electric Guitar (clean)',
            'Electric Guitar (muted)', 'Overdriven Guitar', 'Distortion Guitar', 'Guitar harmonics',
            'Acoustic Bass', 'Electric Bass (finger)', 'Electric Bass (pick)', 'Fretless Bass',
            'Slap Bass 1', 'Slap Bass 2', 'Synth Bass 1', 'Synth Bass 2',
            'Violin', 'Viola', 'Cello', 'Contrabass', 'Tremolo Strings', 'Pizzicato Strings', 'Orchestral Harp', 'Timpani',
            'String Ensemble 1', 'String Ensemble 2', 'Synth Strings 1', 'Synth Strings 2',
            'Choir Aahs', 'Voice Oohs', 'Synth Voice', 'Orchestra Hit',
            'Trumpet', 'Trombone', 'Tuba', 'Muted Trumpet', 'French Horn', 'Brass Section', 'Synth Brass 1', 'Synth Brass 2',
            'Soprano Sax', 'Alto Sax', 'Tenor Sax', 'Baritone Sax', 'Oboe', 'English Horn', 'Bassoon', 'Clarinet',
            'Piccolo', 'Flute', 'Recorder', 'Pan Flute', 'Blown Bottle', 'Shakuhachi', 'Whistle', 'Ocarina',
            'Lead 1 (square)', 'Lead 2 (sawtooth)', 'Lead 3 (calliope)', 'Lead 4 (chiff)', 'Lead 5 (charang)', 'Lead 6 (voice)', 'Lead 7 (fifths)', 'Lead 8 (bass + lead)',
            'Pad 1 (new age)', 'Pad 2 (warm)', 'Pad 3 (polysynth)', 'Pad 4 (choir)', 'Pad 5 (bowed)', 'Pad 6 (metallic)', 'Pad 7 (halo)', 'Pad 8 (sweep)',
            'FX 1 (rain)', 'FX 2 (soundtrack)', 'FX 3 (crystal)', 'FX 4 (atmosphere)', 'FX 5 (brightness)', 'FX 6 (goblins)', 'FX 7 (echoes)', 'FX 8 (sci-fi)',
            'Sitar', 'Banjo', 'Shamisen', 'Koto', 'Kalimba', 'Bag pipe', 'Fiddle', 'Shanai',
            'Tinkle Bell', 'Agogo', 'Steel Drums', 'Woodblock', 'Taiko Drum', 'Melodic Tom', 'Synth Drum', 'Reverse Cymbal',
            'Guitar Fret Noise', 'Breath Noise', 'Seashore', 'Bird Tweet', 'Telephone Ring', 'Helicopter', 'Applause', 'Gunshot'
        ];

        this.init();
    }

    /**
     * Traduction helper
     */
    t(key, params = {}) {
        if (typeof i18n !== 'undefined' && i18n.t) {
            return i18n.t(key, params);
        }
        return key;
    }

    /**
     * Logging helper
     */
    log(level, ...args) {
        if (this.logger) {
            if (typeof this.logger[level] === 'function') {
                this.logger[level]('[PianoRollView]', ...args);
            } else if (typeof this.logger.log === 'function') {
                this.logger.log(`[${level.toUpperCase()}] [PianoRollView]`, ...args);
            }
        }
    }

    /**
     * Initialisation
     */
    init() {
        this.createContainer();
        this.setupEventListeners();
        this.setupWindowListeners();
        this.loadSettings();
        this.log('info', 'PianoRollView initialized');
    }

    /**
     * Configurer les écouteurs de fenêtre
     */
    setupWindowListeners() {
        // Recalculer la position lors du redimensionnement
        window.addEventListener('resize', () => {
            if (this.isVisible) {
                this.updatePosition();
            }
        });

        // Recalculer après le scroll (au cas où)
        window.addEventListener('scroll', () => {
            if (this.isVisible) {
                this.updatePosition();
            }
        });
    }

    /**
     * Charger les paramètres
     */
    loadSettings() {
        try {
            const saved = localStorage.getItem('maestro_settings');
            if (saved) {
                const settings = JSON.parse(saved);
                this.displayTimeSeconds = settings.noteDisplayTime || 20;
                // Just store the enabled state, don't show yet
                // Piano roll will show when playback starts
                this.isEnabled = settings.showPianoRoll || false;
            }
        } catch (error) {
            this.log('error', 'Failed to load settings:', error);
        }
    }

    /**
     * Créer le conteneur HTML
     */
    createContainer() {
        // Créer le conteneur principal
        this.container = document.createElement('div');
        this.container.id = 'piano-roll-view';
        this.container.className = 'piano-roll-view hidden';

        this.container.innerHTML = `
            <div class="piano-roll-view-header">
                <div class="piano-roll-view-title">
                    <span class="piano-roll-icon">🎹</span>
                    <span class="piano-roll-title-text">${this.t('pianoRoll.title')}</span>
                </div>
                <div class="piano-roll-view-channels" id="pianoRollChannelButtons">
                    <!-- Les boutons de canal seront générés ici -->
                </div>
            </div>
            <div class="piano-roll-view-content">
                <div class="piano-roll-view-container" id="pianoRollViewContainer">
                    <!-- Le piano roll sera inséré ici -->
                </div>
            </div>
        `;

        // Insérer après le header
        const header = document.querySelector('header');
        if (header && header.parentNode) {
            header.parentNode.insertBefore(this.container, header.nextSibling);
        }
    }

    /**
     * Configurer les écouteurs d'événements
     */
    setupEventListeners() {
        // Changement de paramètres - just update enabled state
        this.eventBus?.on('settings:piano_roll_changed', (data) => {
            this.isEnabled = data.enabled;
            // If disabled while visible, hide immediately
            if (!this.isEnabled && this.isVisible) {
                this.hide();
            }
        });

        this.eventBus?.on('settings:display_time_changed', (data) => {
            this.displayTimeSeconds = data.time;
            this.updatePianoRollRange();
        });

        // Fichier MIDI chargé
        this.eventBus?.on('file:selected', (data) => {
            if (data.midiData) {
                this.loadMidiData(data.midiData);
            }
        });

        // Playback events
        this.eventBus?.on('playback:play', () => {
            this.isPlaying = true;
            // Show piano roll when playback starts (if enabled and has data)
            if (this.isEnabled && this.midiData) {
                this.show();
            }
            this.startAnimation();
        });

        this.eventBus?.on('playback:pause', () => {
            this.isPlaying = false;
            this.stopAnimation();
            // Keep piano roll visible during pause
        });

        this.eventBus?.on('playback:stop', () => {
            this.isPlaying = false;
            this.currentTick = 0;
            this.stopAnimation();
            // Hide piano roll when stopped
            this.hide();
        });

        this.eventBus?.on('playback:time', (data) => {
            if (data.tick !== undefined) {
                this.currentTick = data.tick;
            } else if (data.time !== undefined) {
                // Convertir le temps en ticks
                this.currentTick = this.timeToTicks(data.time);
            }
            if (!this.isPlaying) {
                this.updateView();
            }
        });

        // Position de lecture mise à jour par le synthétiseur
        this.eventBus?.on('synthesizer:position', (data) => {
            this.currentTick = data.tick || 0;
            if (!this.isPlaying) {
                this.updateView();
            }
        });
    }

    /**
     * Charger les données MIDI
     */
    loadMidiData(midiData) {
        this.midiData = midiData;
        this.convertMidiToSequence();
        this.extractChannelInfo();
        this.initializePianoRoll();
        this.renderChannelButtons();
        this.updateView();
        this.log('info', `MIDI data loaded: ${this.sequence.length} notes`);
    }

    /**
     * Convertir les données MIDI en format séquence pour webaudio-pianoroll
     */
    convertMidiToSequence() {
        if (!this.midiData || !this.midiData.tracks) {
            this.sequence = [];
            this.fullSequence = [];
            this.log('warn', 'No MIDI data or tracks available');
            return;
        }

        const allNotes = [];
        // Support multiple formats for ticksPerBeat
        this.ticksPerBeat = this.midiData.ticksPerQuarter ||
                           this.midiData.header?.ticksPerBeat ||
                           this.midiData.ticksPerBeat || 480;

        // Also get tempo from midiData if available
        if (this.midiData.tempo) {
            this.tempo = this.midiData.tempo;
        }

        this.log('info', `Processing ${this.midiData.tracks.length} tracks, ticksPerBeat: ${this.ticksPerBeat}`);

        this.midiData.tracks.forEach((track, trackIndex) => {
            // Support both formats: track as array of events, or track.events as array
            const events = track.events || track;
            if (!events || !Array.isArray(events)) {
                this.log('debug', `Track ${trackIndex}: no events array`);
                return;
            }

            const noteOns = {};
            let currentTick = 0; // For deltaTime-based format

            events.forEach(event => {
                // Accumulate ticks for deltaTime-based format
                if (event.deltaTime !== undefined) {
                    currentTick += event.deltaTime;
                }

                // Get note number and velocity - support multiple formats
                const noteNumber = event.noteNumber !== undefined ? event.noteNumber :
                                  event.data1 !== undefined ? event.data1 :
                                  event.note;
                const velocity = event.velocity !== undefined ? event.velocity :
                                event.data2 !== undefined ? event.data2 : 0;
                const channel = event.channel !== undefined ? event.channel : 0;

                // Get tick position - support both absolute time and deltaTime
                const tickPosition = event.time !== undefined ? event.time : currentTick;

                // Handle noteOn
                if ((event.type === 'noteOn' || event.subtype === 'noteOn') && velocity > 0 && noteNumber !== undefined) {
                    const key = `${channel}_${noteNumber}`;
                    noteOns[key] = {
                        tick: tickPosition,
                        velocity: velocity,
                        channel: channel,
                        note: noteNumber
                    };
                }
                // Handle noteOff
                else if ((event.type === 'noteOff' || event.subtype === 'noteOff' ||
                         ((event.type === 'noteOn' || event.subtype === 'noteOn') && velocity === 0)) &&
                         noteNumber !== undefined) {
                    const key = `${channel}_${noteNumber}`;
                    if (noteOns[key]) {
                        const noteOn = noteOns[key];
                        allNotes.push({
                            tick: noteOn.tick,
                            gate: tickPosition - noteOn.tick,
                            note: noteOn.note,
                            channel: noteOn.channel,
                            velocity: noteOn.velocity
                        });
                        delete noteOns[key];
                    }
                }
            });
        });

        // Convertir en format webaudio-pianoroll
        this.fullSequence = allNotes.map(note => ({
            t: note.tick,
            g: note.gate,
            n: note.note,
            c: note.channel,
            v: note.velocity
        }));

        // Trier par tick
        this.fullSequence.sort((a, b) => a.t - b.t);

        // Initialiser la séquence avec toutes les notes
        this.sequence = [...this.fullSequence];

        this.log('info', `Converted MIDI: ${this.fullSequence.length} notes, tempo: ${this.tempo} BPM`);
    }

    /**
     * Extraire les informations des canaux
     */
    extractChannelInfo() {
        this.channels = [];
        this.activeChannels.clear();
        const channelMap = new Map();

        if (!this.midiData || !this.midiData.tracks) return;

        this.midiData.tracks.forEach((track, trackIndex) => {
            // Support both formats: track as array of events, or track.events as array
            const events = track.events || track;
            if (!events || !Array.isArray(events)) return;

            events.forEach(event => {
                const channel = event.channel !== undefined ? event.channel : 0;

                // Handle programChange - support multiple formats
                if (event.type === 'programChange' || event.subtype === 'programChange') {
                    const program = event.programNumber !== undefined ? event.programNumber :
                                   event.data1 !== undefined ? event.data1 : 0;
                    if (!channelMap.has(channel)) {
                        channelMap.set(channel, { program, noteCount: 0 });
                    } else {
                        channelMap.get(channel).program = program;
                    }
                }

                // Handle noteOn - support multiple formats
                const velocity = event.velocity !== undefined ? event.velocity :
                                event.data2 !== undefined ? event.data2 : 0;
                if ((event.type === 'noteOn' || event.subtype === 'noteOn') && velocity > 0) {
                    if (!channelMap.has(channel)) {
                        channelMap.set(channel, { program: 0, noteCount: 0 });
                    }
                    channelMap.get(channel).noteCount++;
                }
            });
        });

        // Construire la liste des canaux
        channelMap.forEach((data, channel) => {
            if (data.noteCount > 0) {
                const instrumentName = channel === 9 ? 'Drums' : (this.gmInstruments[data.program] || `Program ${data.program}`);
                this.channels.push({
                    channel: channel,
                    program: data.program,
                    instrument: instrumentName,
                    noteCount: data.noteCount
                });
                this.activeChannels.add(channel);
            }
        });

        // Trier par numéro de canal
        this.channels.sort((a, b) => a.channel - b.channel);

        this.log('info', `Extracted ${this.channels.length} channels with notes`);
    }

    /**
     * Initialiser le piano roll
     */
    initializePianoRoll() {
        const container = document.getElementById('pianoRollViewContainer');
        if (!container) return;

        // Supprimer l'ancien piano roll s'il existe
        if (this.pianoRoll) {
            container.innerHTML = '';
        }

        // Créer le nouvel élément piano roll
        this.pianoRoll = document.createElement('webaudio-pianoroll');

        // Calculer les dimensions
        const width = container.clientWidth || 800;
        const height = container.clientHeight || 200;

        // Calculer la plage de notes (yoffset et yrange)
        const { yoffset, yrange } = this.calculateNoteRange();

        // Calculer xrange basé sur le temps d'affichage
        const xrange = this.calculateXRange();

        // Configurer le piano roll
        this.pianoRoll.setAttribute('width', width);
        this.pianoRoll.setAttribute('height', height);
        this.pianoRoll.setAttribute('editmode', 'none'); // Lecture seule
        this.pianoRoll.setAttribute('xrange', xrange);
        this.pianoRoll.setAttribute('yrange', yrange);
        this.pianoRoll.setAttribute('yoffset', yoffset);
        this.pianoRoll.setAttribute('wheelzoom', '0');
        this.pianoRoll.setAttribute('xscroll', '0');
        this.pianoRoll.setAttribute('yscroll', '0');
        this.pianoRoll.setAttribute('grid', '120'); // 1/16 note
        this.pianoRoll.setAttribute('snap', '0');
        this.pianoRoll.setAttribute('timebase', this.ticksPerBeat);

        // Ajouter au container
        container.appendChild(this.pianoRoll);

        // Configurer les couleurs des canaux
        this.pianoRoll.channelColors = this.getChannelColorsWithMuted();

        // Charger la séquence
        this.updateSequence();

        // Observer les changements de taille
        this.setupResizeObserver();

        this.log('info', 'Piano roll initialized');
    }

    /**
     * Calculer la plage de notes (yoffset et yrange)
     */
    calculateNoteRange() {
        if (this.sequence.length === 0) {
            return { yoffset: 36, yrange: 48 }; // Valeurs par défaut
        }

        let minNote = 127;
        let maxNote = 0;

        this.sequence.forEach(note => {
            if (note.n < minNote) minNote = note.n;
            if (note.n > maxNote) maxNote = note.n;
        });

        // Ajouter une marge
        const margin = 4;
        minNote = Math.max(0, minNote - margin);
        maxNote = Math.min(127, maxNote + margin);

        const range = maxNote - minNote + 1;
        const yrange = Math.max(24, Math.min(48, range)); // Entre 24 et 48 notes visibles

        // Centrer sur les notes
        const center = (minNote + maxNote) / 2;
        const yoffset = Math.max(0, Math.min(127 - yrange, Math.floor(center - yrange / 2)));

        return { yoffset, yrange };
    }

    /**
     * Calculer xrange basé sur le temps d'affichage
     */
    calculateXRange() {
        // Convertir le temps d'affichage en ticks
        const ticksPerSecond = (this.ticksPerBeat * this.tempo) / 60;
        return Math.floor(ticksPerSecond * this.displayTimeSeconds);
    }

    /**
     * Obtenir les couleurs des canaux avec les canaux mutés en gris
     */
    getChannelColorsWithMuted() {
        const colors = [...this.channelColors];
        this.mutedChannels.forEach(channel => {
            if (channel >= 0 && channel < 16) {
                colors[channel] = this.mutedColor;
            }
        });
        // Griser aussi les canaux sans instrument attribué
        for (let i = 0; i < 16; i++) {
            const hasInstrument = this.channels.some(ch => ch.channel === i);
            if (!hasInstrument && !this.activeChannels.has(i)) {
                colors[i] = this.mutedColor;
            }
        }
        return colors;
    }

    /**
     * Mettre à jour la séquence affichée
     */
    updateSequence() {
        if (!this.pianoRoll) return;

        // Filtrer par canaux actifs (non mutés)
        this.sequence = this.fullSequence.filter(note =>
            this.activeChannels.has(note.c) && !this.mutedChannels.has(note.c)
        );

        // Ajouter aussi les notes mutées (mais elles seront grises)
        const mutedNotes = this.fullSequence.filter(note =>
            this.mutedChannels.has(note.c)
        );

        // Combiner avec les notes mutées
        const displaySequence = [...this.sequence, ...mutedNotes];

        // Mettre à jour le piano roll
        this.pianoRoll.sequence = displaySequence;
        this.pianoRoll.channelColors = this.getChannelColorsWithMuted();

        if (typeof this.pianoRoll.redraw === 'function') {
            this.pianoRoll.redraw();
        }
    }

    /**
     * Mettre à jour la plage d'affichage du piano roll
     */
    updatePianoRollRange() {
        if (!this.pianoRoll) return;

        const xrange = this.calculateXRange();
        this.pianoRoll.setAttribute('xrange', xrange);
        this.pianoRoll.xrange = xrange;

        if (typeof this.pianoRoll.redraw === 'function') {
            this.pianoRoll.redraw();
        }
    }

    /**
     * Générer les boutons de canal
     */
    renderChannelButtons() {
        const container = document.getElementById('pianoRollChannelButtons');
        if (!container) return;

        if (this.channels.length === 0) {
            container.innerHTML = `<span class="no-channels">${this.t('pianoRoll.noChannels')}</span>`;
            return;
        }

        let html = '';
        this.channels.forEach(ch => {
            const isActive = this.activeChannels.has(ch.channel);
            const isMuted = this.mutedChannels.has(ch.channel);
            const color = this.channelColors[ch.channel % this.channelColors.length];

            const activeClass = isActive && !isMuted ? 'active' : '';
            const mutedClass = isMuted ? 'muted' : '';

            const style = isActive && !isMuted
                ? `background: ${color}; border-color: ${color};`
                : `--channel-color: ${color}; border-color: ${color};`;

            // Icône de mute
            const muteIcon = isMuted ? '🔇' : '🔊';

            html += `
                <div class="channel-btn-group" data-channel="${ch.channel}">
                    <button
                        class="channel-btn ${activeClass} ${mutedClass}"
                        data-channel="${ch.channel}"
                        style="${style}"
                        title="${ch.instrument} (${ch.noteCount} notes) - Click to toggle mute"
                    >
                        ${ch.channel + 1}: ${ch.instrument.split(' ')[0]}
                    </button>
                    <button
                        class="mute-btn ${mutedClass}"
                        data-channel="${ch.channel}"
                        title="${isMuted ? 'Unmute' : 'Mute'} channel ${ch.channel + 1}"
                    >
                        ${muteIcon}
                    </button>
                </div>
            `;
        });

        container.innerHTML = html;

        // Attacher les événements aux boutons de canal (toggle mute)
        container.querySelectorAll('.channel-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const channel = parseInt(btn.dataset.channel);
                this.toggleChannel(channel);
            });
        });

        // Attacher les événements aux boutons mute
        container.querySelectorAll('.mute-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const channel = parseInt(btn.dataset.channel);
                this.toggleChannel(channel);
            });
        });
    }

    /**
     * Basculer un canal (mute/unmute)
     */
    toggleChannel(channel) {
        if (this.mutedChannels.has(channel)) {
            this.mutedChannels.delete(channel);
        } else {
            this.mutedChannels.add(channel);
        }

        this.renderChannelButtons();
        this.updateSequence();

        // Émettre un événement pour synchroniser avec le synthétiseur
        this.eventBus?.emit('pianoroll:channel_toggled', {
            channel: channel,
            muted: this.mutedChannels.has(channel)
        });

        this.log('info', `Channel ${channel} ${this.mutedChannels.has(channel) ? 'muted' : 'unmuted'}`);
    }

    /**
     * Mettre à jour la vue
     */
    updateView() {
        if (!this.pianoRoll || !this.isVisible) return;

        // Mettre à jour la position de lecture (xoffset)
        this.pianoRoll.xoffset = this.currentTick;

        if (typeof this.pianoRoll.redraw === 'function') {
            this.pianoRoll.redraw();
        }
    }

    /**
     * Démarrer l'animation de lecture
     */
    startAnimation() {
        if (this.animationFrameId) return;

        const animate = (timestamp) => {
            if (!this.isPlaying) {
                this.animationFrameId = null;
                return;
            }

            this.updateView();
            this.animationFrameId = requestAnimationFrame(animate);
        };

        this.animationFrameId = requestAnimationFrame(animate);
    }

    /**
     * Arrêter l'animation
     */
    stopAnimation() {
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
    }

    /**
     * Convertir le temps en ticks
     */
    timeToTicks(timeSeconds) {
        const ticksPerSecond = (this.ticksPerBeat * this.tempo) / 60;
        return Math.floor(timeSeconds * ticksPerSecond);
    }

    /**
     * Observer les changements de taille
     */
    setupResizeObserver() {
        const container = document.getElementById('pianoRollViewContainer');
        if (!container) return;

        const resizeObserver = new ResizeObserver(entries => {
            for (const entry of entries) {
                const { width, height } = entry.contentRect;
                if (this.pianoRoll && width > 0 && height > 0) {
                    this.pianoRoll.setAttribute('width', Math.floor(width));
                    this.pianoRoll.setAttribute('height', Math.floor(height));
                    if (typeof this.pianoRoll.redraw === 'function') {
                        this.pianoRoll.redraw();
                    }
                }
            }
        });

        resizeObserver.observe(container);
    }

    /**
     * Calculer la position du piano roll sous le header
     */
    updatePosition() {
        const header = document.querySelector('header');
        if (header && this.container) {
            const headerRect = header.getBoundingClientRect();
            const topPosition = headerRect.bottom + 16; // 16px de marge
            this.container.style.top = `${topPosition}px`;
            this.log('debug', `Position updated: top=${topPosition}px`);
        }
    }

    /**
     * Afficher le piano roll
     */
    show() {
        if (this.isVisible) return; // Déjà visible

        this.isVisible = true;

        if (this.container) {
            // D'abord rendre visible pour pouvoir calculer les positions
            this.container.classList.remove('hidden');
            this.container.classList.add('fullscreen');
        }

        // Cacher les cartes fichiers/périphériques
        const mainGrid = document.querySelector('.main-grid');
        if (mainGrid) {
            mainGrid.classList.add('hidden-for-pianoroll');
        }

        // Cacher la console de debug si visible
        const debugConsole = document.getElementById('debugConsole');
        if (debugConsole && !debugConsole.classList.contains('hidden')) {
            this._debugWasVisible = true;
            debugConsole.classList.add('hidden-for-pianoroll');
        }

        // Calculer la position après que le DOM soit mis à jour
        requestAnimationFrame(() => {
            this.updatePosition();

            // Initialiser le piano roll si on a des données
            if (this.midiData) {
                this.initializePianoRoll();
            }
        });

        this.log('info', 'Piano roll view shown');
    }

    /**
     * Cacher le piano roll
     */
    hide() {
        this.isVisible = false;
        if (this.container) {
            this.container.classList.add('hidden');
            this.container.classList.remove('fullscreen');
        }

        // Réafficher les cartes fichiers/périphériques
        const mainGrid = document.querySelector('.main-grid');
        if (mainGrid) {
            mainGrid.classList.remove('hidden-for-pianoroll');
        }

        // Réafficher la console de debug si elle était visible
        const debugConsole = document.getElementById('debugConsole');
        if (debugConsole && this._debugWasVisible) {
            debugConsole.classList.remove('hidden-for-pianoroll');
            this._debugWasVisible = false;
        }

        this.stopAnimation();
        this.log('info', 'Piano roll view hidden');
    }

    /**
     * Basculer la visibilité
     */
    toggle() {
        if (this.isVisible) {
            this.hide();
        } else {
            this.show();
        }
    }

    /**
     * Détruire le composant
     */
    destroy() {
        this.stopAnimation();
        if (this.container && this.container.parentNode) {
            this.container.parentNode.removeChild(this.container);
        }
        this.pianoRoll = null;
        this.container = null;
    }
}

// Export global
if (typeof window !== 'undefined') {
    window.PianoRollView = PianoRollView;
}
