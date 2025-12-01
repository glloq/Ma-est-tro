// ============================================================================
// Fichier: public/js/audio/MidiSynthesizer.js
// Version: v1.0.0 - Synthétiseur MIDI avec Web Audio API
// Description: Lecteur MIDI intégré au navigateur avec synthèse audio
// ============================================================================

/**
 * MidiSynthesizer - Synthétiseur MIDI pour lecture dans le navigateur
 * Utilise le Web Audio API natif avec synthèse FM pour un son de qualité
 */
class MidiSynthesizer {
    constructor() {
        this.audioContext = null;
        this.masterGain = null;
        this.isInitialized = false;
        this.isPlaying = false;
        this.isPaused = false;

        // État de lecture
        this.currentTick = 0;
        this.startTick = 0;
        this.endTick = 0;
        this.startTime = 0;
        this.pauseTime = 0;

        // Tempo et timing
        this.tempo = 120; // BPM
        this.ticksPerBeat = 480; // PPQ standard

        // Canaux et instruments
        this.channelInstruments = new Array(16).fill(0); // Program numbers par canal
        this.channelVolumes = new Array(16).fill(100); // Volume par canal (0-127)

        // Notes actives pour arrêter proprement
        this.activeVoices = new Map(); // Map<voiceId, {oscillator, gain, endTime}>

        // Scheduler
        this.schedulerInterval = null;
        this.animationFrame = null;
        this.scheduleAheadTime = 0.15; // 150ms de lookahead
        this.lastScheduledTick = 0;

        // Callbacks
        this.onTickUpdate = null; // Callback pour mise à jour du curseur
        this.onPlaybackEnd = null; // Callback quand la lecture est terminée

        // Séquence de notes à jouer
        this.sequence = [];

        // Logger
        this.logger = window.logger || console;

        // Presets d'instruments (type d'onde et enveloppe ADSR)
        this.instrumentPresets = this.createInstrumentPresets();
    }

    /**
     * Créer les presets d'instruments
     * Chaque preset définit le type d'oscillateur et l'enveloppe ADSR
     */
    createInstrumentPresets() {
        return {
            // Piano (0-7) - Son percussif avec decay rapide
            piano: {
                wave: 'triangle',
                attack: 0.005, decay: 0.3, sustain: 0.4, release: 0.3,
                harmonics: [1, 0.5, 0.25], // Fondamentale + harmoniques
                modulation: { ratio: 2, depth: 0.5 }
            },
            // Chromatic (8-15) - Son brillant
            chromatic: {
                wave: 'sine',
                attack: 0.001, decay: 0.5, sustain: 0.3, release: 0.5,
                harmonics: [1, 0.3],
                modulation: { ratio: 4, depth: 0.3 }
            },
            // Organ (16-23) - Son soutenu
            organ: {
                wave: 'sine',
                attack: 0.01, decay: 0.1, sustain: 0.9, release: 0.1,
                harmonics: [1, 0.8, 0.6, 0.4],
                modulation: null
            },
            // Guitar (24-31) - Son avec attaque
            guitar: {
                wave: 'triangle',
                attack: 0.002, decay: 0.4, sustain: 0.2, release: 0.3,
                harmonics: [1, 0.4, 0.2],
                modulation: { ratio: 3, depth: 0.2 }
            },
            // Bass (32-39) - Son grave
            bass: {
                wave: 'sawtooth',
                attack: 0.01, decay: 0.2, sustain: 0.6, release: 0.2,
                harmonics: [1, 0.6],
                modulation: { ratio: 1, depth: 0.3 },
                lowpass: 800
            },
            // Strings (40-47) - Son doux avec attaque lente
            strings: {
                wave: 'sawtooth',
                attack: 0.15, decay: 0.2, sustain: 0.8, release: 0.4,
                harmonics: [1, 0.5, 0.3],
                modulation: { ratio: 2, depth: 0.1 },
                lowpass: 3000
            },
            // Ensemble (48-55) - Choeur/Orchestre
            ensemble: {
                wave: 'sawtooth',
                attack: 0.1, decay: 0.2, sustain: 0.7, release: 0.5,
                harmonics: [1, 0.6, 0.4, 0.2],
                modulation: { ratio: 1.5, depth: 0.2 },
                lowpass: 4000
            },
            // Brass (56-63) - Cuivres
            brass: {
                wave: 'sawtooth',
                attack: 0.05, decay: 0.2, sustain: 0.7, release: 0.2,
                harmonics: [1, 0.7, 0.4],
                modulation: { ratio: 1, depth: 0.4 },
                lowpass: 2500
            },
            // Reed (64-71) - Anches
            reed: {
                wave: 'square',
                attack: 0.03, decay: 0.15, sustain: 0.6, release: 0.2,
                harmonics: [1, 0.5, 0.3],
                modulation: { ratio: 2, depth: 0.3 },
                lowpass: 2000
            },
            // Pipe (72-79) - Flûtes
            pipe: {
                wave: 'sine',
                attack: 0.05, decay: 0.1, sustain: 0.7, release: 0.3,
                harmonics: [1, 0.2],
                modulation: null
            },
            // Synth Lead (80-87)
            synthLead: {
                wave: 'sawtooth',
                attack: 0.01, decay: 0.2, sustain: 0.6, release: 0.2,
                harmonics: [1, 0.5],
                modulation: { ratio: 2, depth: 0.5 }
            },
            // Synth Pad (88-95)
            synthPad: {
                wave: 'sawtooth',
                attack: 0.3, decay: 0.3, sustain: 0.7, release: 0.6,
                harmonics: [1, 0.4, 0.2],
                modulation: { ratio: 1.5, depth: 0.2 },
                lowpass: 3000
            },
            // Synth Effects (96-103)
            synthFx: {
                wave: 'square',
                attack: 0.2, decay: 0.4, sustain: 0.5, release: 0.8,
                harmonics: [1, 0.3],
                modulation: { ratio: 3, depth: 0.6 }
            },
            // Ethnic (104-111)
            ethnic: {
                wave: 'triangle',
                attack: 0.01, decay: 0.3, sustain: 0.3, release: 0.4,
                harmonics: [1, 0.4, 0.2],
                modulation: { ratio: 2.5, depth: 0.3 }
            },
            // Percussive (112-119)
            percussive: {
                wave: 'triangle',
                attack: 0.001, decay: 0.3, sustain: 0.1, release: 0.2,
                harmonics: [1, 0.6, 0.3],
                modulation: { ratio: 5, depth: 0.5 }
            },
            // Drums (canal 9)
            drums: {
                wave: 'triangle',
                attack: 0.001, decay: 0.15, sustain: 0.05, release: 0.1,
                harmonics: [1, 0.8, 0.5],
                modulation: { ratio: 1.5, depth: 0.8 },
                noise: true
            }
        };
    }

    /**
     * Obtenir le preset d'instrument pour un programme MIDI
     * @param {number} program - Numéro de programme (0-127)
     * @param {number} channel - Canal MIDI (0-15)
     * @returns {Object} - Preset d'instrument
     */
    getPresetForProgram(program, channel) {
        // Canal 9 = Drums
        if (channel === 9) {
            return this.instrumentPresets.drums;
        }

        // Mapper le programme vers une catégorie
        if (program < 8) return this.instrumentPresets.piano;
        if (program < 16) return this.instrumentPresets.chromatic;
        if (program < 24) return this.instrumentPresets.organ;
        if (program < 32) return this.instrumentPresets.guitar;
        if (program < 40) return this.instrumentPresets.bass;
        if (program < 48) return this.instrumentPresets.strings;
        if (program < 56) return this.instrumentPresets.ensemble;
        if (program < 64) return this.instrumentPresets.brass;
        if (program < 72) return this.instrumentPresets.reed;
        if (program < 80) return this.instrumentPresets.pipe;
        if (program < 88) return this.instrumentPresets.synthLead;
        if (program < 96) return this.instrumentPresets.synthPad;
        if (program < 104) return this.instrumentPresets.synthFx;
        if (program < 112) return this.instrumentPresets.ethnic;
        if (program < 120) return this.instrumentPresets.percussive;

        return this.instrumentPresets.piano; // Default
    }

    /**
     * Initialiser le synthétiseur
     * @returns {Promise<boolean>}
     */
    async initialize() {
        if (this.isInitialized) {
            return true;
        }

        try {
            // Créer le contexte audio
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();

            // Créer le gain master
            this.masterGain = this.audioContext.createGain();
            this.masterGain.gain.value = 0.5; // Volume global à 50%
            this.masterGain.connect(this.audioContext.destination);

            // Créer un compresseur pour éviter la distorsion
            this.compressor = this.audioContext.createDynamicsCompressor();
            this.compressor.threshold.value = -24;
            this.compressor.knee.value = 30;
            this.compressor.ratio.value = 12;
            this.compressor.attack.value = 0.003;
            this.compressor.release.value = 0.25;
            this.compressor.connect(this.masterGain);

            this.isInitialized = true;
            this.log('info', 'MidiSynthesizer initialized successfully');

            return true;
        } catch (error) {
            this.log('error', 'Failed to initialize MidiSynthesizer:', error);
            return false;
        }
    }

    /**
     * Convertir une note MIDI en fréquence
     * @param {number} note - Note MIDI (0-127)
     * @returns {number} - Fréquence en Hz
     */
    midiToFrequency(note) {
        return 440 * Math.pow(2, (note - 69) / 12);
    }

    /**
     * Définir l'instrument pour un canal
     * @param {number} channel - Canal MIDI (0-15)
     * @param {number} program - Numéro de programme MIDI (0-127)
     */
    setChannelInstrument(channel, program) {
        if (channel >= 0 && channel < 16) {
            this.channelInstruments[channel] = program;
            this.log('debug', `Channel ${channel + 1} instrument set to ${program}`);
        }
    }

    /**
     * Définir le volume pour un canal
     * @param {number} channel - Canal MIDI (0-15)
     * @param {number} volume - Volume (0-127)
     */
    setChannelVolume(channel, volume) {
        if (channel >= 0 && channel < 16) {
            this.channelVolumes[channel] = Math.max(0, Math.min(127, volume));
        }
    }

    /**
     * Définir le volume master
     * @param {number} volume - Volume (0-1)
     */
    setMasterVolume(volume) {
        if (this.masterGain) {
            this.masterGain.gain.value = Math.max(0, Math.min(1, volume));
        }
    }

    /**
     * Convertir des ticks en secondes
     * @param {number} ticks - Position en ticks
     * @returns {number} - Position en secondes
     */
    ticksToSeconds(ticks) {
        const beatsPerSecond = this.tempo / 60;
        const ticksPerSecond = beatsPerSecond * this.ticksPerBeat;
        return ticks / ticksPerSecond;
    }

    /**
     * Convertir des secondes en ticks
     * @param {number} seconds - Position en secondes
     * @returns {number} - Position en ticks
     */
    secondsToTicks(seconds) {
        const beatsPerSecond = this.tempo / 60;
        const ticksPerSecond = beatsPerSecond * this.ticksPerBeat;
        return Math.round(seconds * ticksPerSecond);
    }

    /**
     * Charger une séquence de notes pour la lecture
     * @param {Array} sequence - Notes au format [{t, g, n, c, v}, ...]
     * @param {number} tempo - Tempo en BPM
     * @param {number} ticksPerBeat - Résolution en ticks par noire
     */
    loadSequence(sequence, tempo = 120, ticksPerBeat = 480) {
        this.sequence = sequence.map(note => ({
            t: note.t,           // Tick de début
            g: note.g,           // Durée en ticks (gate)
            n: note.n,           // Note MIDI (0-127)
            c: note.c || 0,      // Canal (0-15)
            v: note.v || 100     // Vélocité (0-127)
        }));

        this.tempo = tempo;
        this.ticksPerBeat = ticksPerBeat;

        // Trier par tick de début
        this.sequence.sort((a, b) => a.t - b.t);

        // Calculer la durée totale
        let maxEndTick = 0;
        this.sequence.forEach(note => {
            const endTick = note.t + note.g;
            if (endTick > maxEndTick) maxEndTick = endTick;
        });

        this.endTick = maxEndTick;
        this.startTick = 0;
        this.currentTick = 0;

        this.log('info', `Sequence loaded: ${this.sequence.length} notes, duration: ${this.ticksToSeconds(maxEndTick).toFixed(2)}s at ${tempo} BPM`);
    }

    /**
     * Définir la plage de lecture (markstart/markend)
     * @param {number} startTick - Tick de début
     * @param {number} endTick - Tick de fin
     */
    setPlaybackRange(startTick, endTick) {
        this.startTick = Math.max(0, startTick);
        this.endTick = endTick;
        this.currentTick = this.startTick;
        this.log('info', `Playback range set: ${this.startTick} - ${this.endTick} ticks`);
    }

    /**
     * Jouer une note avec synthèse FM
     * @param {number} note - Note MIDI (0-127)
     * @param {number} velocity - Vélocité (0-127)
     * @param {number} channel - Canal (0-15)
     * @param {number} duration - Durée en secondes
     * @param {number} time - Temps de départ (AudioContext time)
     */
    playNote(note, velocity, channel, duration, time = null) {
        if (!this.isInitialized) return;

        const startTime = time || this.audioContext.currentTime;
        const frequency = this.midiToFrequency(note);
        const program = this.channelInstruments[channel];
        const preset = this.getPresetForProgram(program, channel);

        // Calculer le volume
        const velocityGain = velocity / 127;
        const channelGain = this.channelVolumes[channel] / 127;
        const baseGain = velocityGain * channelGain * 0.15; // Réduire pour éviter la saturation

        try {
            // Créer l'oscillateur principal
            const osc = this.audioContext.createOscillator();
            osc.type = preset.wave;
            osc.frequency.value = frequency;

            // Créer l'enveloppe de gain
            const gainNode = this.audioContext.createGain();
            gainNode.gain.value = 0;

            // Ajouter un filtre passe-bas si défini
            let lastNode = gainNode;
            if (preset.lowpass) {
                const filter = this.audioContext.createBiquadFilter();
                filter.type = 'lowpass';
                filter.frequency.value = preset.lowpass;
                filter.Q.value = 1;
                gainNode.connect(filter);
                lastNode = filter;
            }

            // Connecter au compresseur
            lastNode.connect(this.compressor);

            // Modulation FM si définie
            if (preset.modulation) {
                const modOsc = this.audioContext.createOscillator();
                const modGain = this.audioContext.createGain();
                modOsc.type = 'sine';
                modOsc.frequency.value = frequency * preset.modulation.ratio;
                modGain.gain.value = frequency * preset.modulation.depth;
                modOsc.connect(modGain);
                modGain.connect(osc.frequency);
                modOsc.start(startTime);
                modOsc.stop(startTime + duration + preset.release);
            }

            // Appliquer l'enveloppe ADSR
            const { attack, decay, sustain, release } = preset;
            const attackEnd = startTime + attack;
            const decayEnd = attackEnd + decay;
            const releaseStart = startTime + duration;
            const releaseEnd = releaseStart + release;

            // Attack
            gainNode.gain.setValueAtTime(0, startTime);
            gainNode.gain.linearRampToValueAtTime(baseGain, attackEnd);

            // Decay to sustain
            gainNode.gain.linearRampToValueAtTime(baseGain * sustain, decayEnd);

            // Sustain (maintenir jusqu'au release)
            gainNode.gain.setValueAtTime(baseGain * sustain, releaseStart);

            // Release
            gainNode.gain.linearRampToValueAtTime(0, releaseEnd);

            // Connecter l'oscillateur
            osc.connect(gainNode);

            // Démarrer et arrêter
            osc.start(startTime);
            osc.stop(releaseEnd + 0.1);

            // Nettoyer après la fin
            osc.onended = () => {
                osc.disconnect();
                gainNode.disconnect();
            };

        } catch (error) {
            this.log('debug', `Error playing note ${note}:`, error.message);
        }
    }

    /**
     * Démarrer la lecture
     */
    async play() {
        if (!this.isInitialized) {
            const initialized = await this.initialize();
            if (!initialized) {
                this.log('error', 'Cannot play: synthesizer not initialized');
                return;
            }
        }

        // Reprendre le contexte audio si suspendu
        if (this.audioContext.state === 'suspended') {
            await this.audioContext.resume();
        }

        if (this.isPaused) {
            // Reprendre depuis la pause
            this.isPaused = false;
            this.startTime = this.audioContext.currentTime - this.ticksToSeconds(this.currentTick - this.startTick);
        } else {
            // Nouvelle lecture depuis le début de la plage
            this.currentTick = this.startTick;
            this.startTime = this.audioContext.currentTime;
            this.lastScheduledTick = this.startTick;
        }

        this.isPlaying = true;

        // Démarrer le scheduler
        this.startScheduler();

        this.log('info', `Playback started at tick ${this.currentTick}`);
    }

    /**
     * Mettre en pause la lecture
     */
    pause() {
        if (!this.isPlaying) return;

        this.isPlaying = false;
        this.isPaused = true;
        this.stopScheduler();

        this.log('info', `Playback paused at tick ${this.currentTick}`);
    }

    /**
     * Arrêter la lecture
     */
    stop() {
        this.isPlaying = false;
        this.isPaused = false;
        this.stopScheduler();
        this.currentTick = this.startTick;
        this.lastScheduledTick = this.startTick;

        // Mettre à jour le curseur
        if (this.onTickUpdate) {
            this.onTickUpdate(this.currentTick);
        }

        this.log('info', 'Playback stopped');
    }

    /**
     * Aller à une position
     * @param {number} tick - Position en ticks
     */
    seek(tick) {
        const wasPlaying = this.isPlaying;

        if (wasPlaying) {
            this.pause();
        }

        this.currentTick = Math.max(this.startTick, Math.min(tick, this.endTick));
        this.lastScheduledTick = this.currentTick;

        // Mettre à jour le curseur
        if (this.onTickUpdate) {
            this.onTickUpdate(this.currentTick);
        }

        if (wasPlaying) {
            this.isPaused = false;
            this.play();
        }
    }

    /**
     * Démarrer le scheduler de notes
     */
    startScheduler() {
        if (this.schedulerInterval) {
            clearInterval(this.schedulerInterval);
        }
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
        }

        // Scheduler audio à 50ms pour la précision des notes
        this.schedulerInterval = setInterval(() => {
            this.scheduleNotes();
        }, 50);

        // Animation frame pour le curseur (60fps)
        const updateCursor = () => {
            if (this.isPlaying) {
                const currentTime = this.audioContext.currentTime;
                const elapsedTime = currentTime - this.startTime;
                this.currentTick = this.startTick + this.secondsToTicks(elapsedTime);

                if (this.onTickUpdate) {
                    this.onTickUpdate(this.currentTick);
                }

                this.animationFrame = requestAnimationFrame(updateCursor);
            }
        };
        this.animationFrame = requestAnimationFrame(updateCursor);
    }

    /**
     * Arrêter le scheduler
     */
    stopScheduler() {
        if (this.schedulerInterval) {
            clearInterval(this.schedulerInterval);
            this.schedulerInterval = null;
        }
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
            this.animationFrame = null;
        }
    }

    /**
     * Planifier les notes à jouer
     */
    scheduleNotes() {
        if (!this.isPlaying) return;

        const currentTime = this.audioContext.currentTime;
        const elapsedTime = currentTime - this.startTime;
        const currentTick = this.startTick + this.secondsToTicks(elapsedTime);

        // Vérifier si on a atteint la fin
        if (currentTick >= this.endTick) {
            this.stop();
            if (this.onPlaybackEnd) {
                this.onPlaybackEnd();
            }
            return;
        }

        // Planifier les notes à venir
        const scheduleEndTime = currentTime + this.scheduleAheadTime;
        const scheduleEndTick = this.startTick + this.secondsToTicks(scheduleEndTime - this.startTime);

        // Trouver et jouer les notes dans la fenêtre de planification
        for (const note of this.sequence) {
            // Ignorer les notes avant la plage
            if (note.t < this.startTick) continue;

            // Arrêter si on dépasse la fin
            if (note.t > this.endTick) break;

            // Planifier seulement les notes pas encore planifiées
            if (note.t > this.lastScheduledTick && note.t <= scheduleEndTick) {
                const noteStartTime = this.startTime + this.ticksToSeconds(note.t - this.startTick);
                const noteDuration = this.ticksToSeconds(note.g);

                this.playNote(note.n, note.v, note.c, noteDuration, noteStartTime);
            }
        }

        this.lastScheduledTick = Math.max(this.lastScheduledTick, scheduleEndTick);
    }

    /**
     * Libérer les ressources
     */
    dispose() {
        this.stop();

        if (this.audioContext && this.audioContext.state !== 'closed') {
            this.audioContext.close();
        }
        this.audioContext = null;
        this.masterGain = null;
        this.compressor = null;
        this.isInitialized = false;

        this.log('info', 'MidiSynthesizer disposed');
    }

    /**
     * Logger helper
     */
    log(level, ...args) {
        if (this.logger && typeof this.logger[level] === 'function') {
            this.logger[level]('[MidiSynthesizer]', ...args);
        } else {
            console[level]('[MidiSynthesizer]', ...args);
        }
    }
}

// Export pour utilisation globale
window.MidiSynthesizer = MidiSynthesizer;
