// ============================================================================
// Fichier: public/js/audio/MidiSynthesizer.js
// Version: v2.1.0 - Synthétiseur MIDI avec Web Audio API (oscillateurs)
// Description: Lecteur MIDI intégré au navigateur
// ============================================================================

/**
 * MidiSynthesizer - Synthétiseur MIDI utilisant Web Audio API
 */
class MidiSynthesizer {
    constructor() {
        this.audioContext = null;
        this.masterGain = null;
        this.compressor = null;
        this.isInitialized = false;
        this.isPlaying = false;
        this.isPaused = false;

        // État de lecture
        this.currentTick = 0;
        this.startTick = 0;
        this.endTick = 0;
        this.startTime = 0;

        // Tempo et timing
        this.tempo = 120;
        this.ticksPerBeat = 480;

        // Canaux et instruments
        this.channelInstruments = new Array(16).fill(0);
        this.channelVolumes = new Array(16).fill(100);

        // Scheduler
        this.schedulerInterval = null;
        this.animationFrame = null;
        this.scheduleAheadTime = 0.15;
        this.lastScheduledTick = 0;

        // Callbacks
        this.onTickUpdate = null;
        this.onPlaybackEnd = null;

        // Séquence
        this.sequence = [];

        // Logger
        this.logger = window.logger || console;

        // Presets d'instruments
        this.presets = this.createPresets();
    }

    /**
     * Créer les presets d'instruments
     */
    createPresets() {
        return {
            piano: { wave: 'triangle', attack: 0.005, decay: 0.3, sustain: 0.4, release: 0.3 },
            chromatic: { wave: 'sine', attack: 0.001, decay: 0.5, sustain: 0.3, release: 0.5 },
            organ: { wave: 'sine', attack: 0.01, decay: 0.1, sustain: 0.9, release: 0.1 },
            guitar: { wave: 'triangle', attack: 0.002, decay: 0.4, sustain: 0.2, release: 0.3 },
            bass: { wave: 'sawtooth', attack: 0.01, decay: 0.2, sustain: 0.6, release: 0.2 },
            strings: { wave: 'sawtooth', attack: 0.15, decay: 0.2, sustain: 0.8, release: 0.4 },
            brass: { wave: 'sawtooth', attack: 0.05, decay: 0.2, sustain: 0.7, release: 0.2 },
            reed: { wave: 'square', attack: 0.03, decay: 0.15, sustain: 0.6, release: 0.2 },
            pipe: { wave: 'sine', attack: 0.05, decay: 0.1, sustain: 0.7, release: 0.3 },
            synth: { wave: 'sawtooth', attack: 0.01, decay: 0.2, sustain: 0.6, release: 0.2 },
            drums: { wave: 'triangle', attack: 0.001, decay: 0.15, sustain: 0.05, release: 0.1 }
        };
    }

    /**
     * Obtenir le preset pour un programme
     */
    getPreset(program, channel) {
        if (channel === 9) return this.presets.drums;
        if (program < 8) return this.presets.piano;
        if (program < 16) return this.presets.chromatic;
        if (program < 24) return this.presets.organ;
        if (program < 32) return this.presets.guitar;
        if (program < 40) return this.presets.bass;
        if (program < 56) return this.presets.strings;
        if (program < 64) return this.presets.brass;
        if (program < 72) return this.presets.reed;
        if (program < 80) return this.presets.pipe;
        return this.presets.synth;
    }

    /**
     * Initialiser
     */
    async initialize() {
        if (this.isInitialized) return true;

        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();

            this.masterGain = this.audioContext.createGain();
            this.masterGain.gain.value = 0.5;

            this.compressor = this.audioContext.createDynamicsCompressor();
            this.compressor.threshold.value = -24;
            this.compressor.knee.value = 30;
            this.compressor.ratio.value = 12;
            this.compressor.attack.value = 0.003;
            this.compressor.release.value = 0.25;

            this.compressor.connect(this.masterGain);
            this.masterGain.connect(this.audioContext.destination);

            this.isInitialized = true;
            this.log('info', 'MidiSynthesizer initialized');
            return true;
        } catch (error) {
            this.log('error', 'Failed to initialize:', error);
            return false;
        }
    }

    /**
     * Convertir note MIDI en fréquence
     */
    midiToFrequency(note) {
        return 440 * Math.pow(2, (note - 69) / 12);
    }

    setChannelInstrument(channel, program) {
        if (channel >= 0 && channel < 16) {
            this.channelInstruments[channel] = program;
        }
    }

    setChannelVolume(channel, volume) {
        if (channel >= 0 && channel < 16) {
            this.channelVolumes[channel] = Math.max(0, Math.min(127, volume));
        }
    }

    ticksToSeconds(ticks) {
        return ticks / (this.tempo / 60 * this.ticksPerBeat);
    }

    secondsToTicks(seconds) {
        return Math.round(seconds * this.tempo / 60 * this.ticksPerBeat);
    }

    loadSequence(sequence, tempo = 120, ticksPerBeat = 480) {
        this.sequence = sequence.map(note => ({
            t: note.t, g: note.g, n: note.n, c: note.c || 0, v: note.v || 100
        }));
        this.tempo = tempo;
        this.ticksPerBeat = ticksPerBeat;
        this.sequence.sort((a, b) => a.t - b.t);

        let maxEndTick = 0;
        this.sequence.forEach(note => {
            const endTick = note.t + note.g;
            if (endTick > maxEndTick) maxEndTick = endTick;
        });

        this.endTick = maxEndTick;
        this.startTick = 0;
        this.currentTick = 0;
        this.log('info', `Sequence: ${this.sequence.length} notes, ${this.ticksToSeconds(maxEndTick).toFixed(2)}s`);
    }

    setPlaybackRange(startTick, endTick) {
        this.startTick = Math.max(0, startTick);
        this.endTick = endTick;
        this.currentTick = this.startTick;
    }

    /**
     * Jouer une note
     */
    playNote(note, velocity, channel, duration, time) {
        if (!this.isInitialized) return;

        const startTime = time || this.audioContext.currentTime;
        const frequency = this.midiToFrequency(note);
        const program = this.channelInstruments[channel];
        const preset = this.getPreset(program, channel);

        const velocityGain = velocity / 127;
        const channelGain = this.channelVolumes[channel] / 127;
        const baseGain = velocityGain * channelGain * 0.12;

        try {
            const osc = this.audioContext.createOscillator();
            osc.type = preset.wave;
            osc.frequency.value = frequency;

            const gainNode = this.audioContext.createGain();
            gainNode.gain.value = 0;

            osc.connect(gainNode);
            gainNode.connect(this.compressor);

            const { attack, decay, sustain, release } = preset;
            const attackEnd = startTime + attack;
            const decayEnd = attackEnd + decay;
            const releaseStart = startTime + duration;
            const releaseEnd = releaseStart + release;

            gainNode.gain.setValueAtTime(0, startTime);
            gainNode.gain.linearRampToValueAtTime(baseGain, attackEnd);
            gainNode.gain.linearRampToValueAtTime(baseGain * sustain, decayEnd);
            gainNode.gain.setValueAtTime(baseGain * sustain, releaseStart);
            gainNode.gain.linearRampToValueAtTime(0, releaseEnd);

            osc.start(startTime);
            osc.stop(releaseEnd + 0.1);

            osc.onended = () => {
                osc.disconnect();
                gainNode.disconnect();
            };
        } catch (e) {
            // Ignore
        }
    }

    async play() {
        if (!this.isInitialized) {
            const ok = await this.initialize();
            if (!ok) return;
        }

        if (this.audioContext.state === 'suspended') {
            await this.audioContext.resume();
        }

        if (this.isPaused) {
            this.isPaused = false;
            this.startTime = this.audioContext.currentTime - this.ticksToSeconds(this.currentTick - this.startTick);
        } else {
            this.currentTick = this.startTick;
            this.startTime = this.audioContext.currentTime;
            this.lastScheduledTick = this.startTick;
        }

        this.isPlaying = true;
        this.startScheduler();
        this.log('info', `Playback started at tick ${this.currentTick}`);
    }

    pause() {
        if (!this.isPlaying) return;
        this.isPlaying = false;
        this.isPaused = true;
        this.stopScheduler();
        this.log('info', `Playback paused at tick ${this.currentTick}`);
    }

    stop() {
        this.isPlaying = false;
        this.isPaused = false;
        this.stopScheduler();
        this.currentTick = this.startTick;
        this.lastScheduledTick = this.startTick;

        if (this.onTickUpdate) {
            this.onTickUpdate(this.currentTick);
        }
        this.log('info', 'Playback stopped');
    }

    seek(tick) {
        const wasPlaying = this.isPlaying;
        if (wasPlaying) this.pause();

        this.currentTick = Math.max(this.startTick, Math.min(tick, this.endTick));
        this.lastScheduledTick = this.currentTick;

        if (this.onTickUpdate) {
            this.onTickUpdate(this.currentTick);
        }

        if (wasPlaying) {
            this.isPaused = false;
            this.play();
        }
    }

    startScheduler() {
        if (this.schedulerInterval) clearInterval(this.schedulerInterval);
        if (this.animationFrame) cancelAnimationFrame(this.animationFrame);

        this.schedulerInterval = setInterval(() => this.scheduleNotes(), 50);

        const updateCursor = () => {
            if (this.isPlaying) {
                const elapsed = this.audioContext.currentTime - this.startTime;
                this.currentTick = this.startTick + this.secondsToTicks(elapsed);

                if (this.onTickUpdate) {
                    this.onTickUpdate(this.currentTick);
                }
                this.animationFrame = requestAnimationFrame(updateCursor);
            }
        };
        this.animationFrame = requestAnimationFrame(updateCursor);
    }

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

    scheduleNotes() {
        if (!this.isPlaying) return;

        const currentTime = this.audioContext.currentTime;
        const elapsed = currentTime - this.startTime;
        const currentTick = this.startTick + this.secondsToTicks(elapsed);

        if (currentTick >= this.endTick) {
            this.stop();
            if (this.onPlaybackEnd) this.onPlaybackEnd();
            return;
        }

        const scheduleEndTime = currentTime + this.scheduleAheadTime;
        const scheduleEndTick = this.startTick + this.secondsToTicks(scheduleEndTime - this.startTime);

        for (const note of this.sequence) {
            if (note.t < this.startTick) continue;
            if (note.t > this.endTick) break;

            if (note.t > this.lastScheduledTick && note.t <= scheduleEndTick) {
                const noteStart = this.startTime + this.ticksToSeconds(note.t - this.startTick);
                const noteDur = this.ticksToSeconds(note.g);
                this.playNote(note.n, note.v, note.c, noteDur, noteStart);
            }
        }

        this.lastScheduledTick = Math.max(this.lastScheduledTick, scheduleEndTick);
    }

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

    log(level, ...args) {
        if (this.logger && typeof this.logger[level] === 'function') {
            this.logger[level]('[MidiSynthesizer]', ...args);
        } else {
            console[level]('[MidiSynthesizer]', ...args);
        }
    }
}

window.MidiSynthesizer = MidiSynthesizer;
