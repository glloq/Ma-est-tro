// ============================================================================
// Fichier: frontend/js/utils/MetronomeEngine.js
// Projet: MidiMind v3.0 - Système d'Orchestration MIDI pour Raspberry Pi
// Version: 3.0.0
// Date: 2025-10-14
// ============================================================================
// Description:
//   Moteur de métronome audio pour l'éditeur et la lecture.
//   Click précis avec Web Audio API, tempo variable.
//
// Fonctionnalités:
//   - Click métronome (temps forts/faibles)
//   - Tempo variable (BPM)
//   - Time signature configurable (4/4, 3/4, etc.)
//   - Volume réglable
//   - Subdivision (1/4, 1/8, 1/16)
//   - Sons personnalisables (beep, wood, clap)
//   - Synchronisation avec playback
//
// Architecture:
//   MetronomeEngine (classe)
//   - Web Audio API (OscillatorNode)
//   - Scheduling précis (lookahead)
//   - Compensation latence
//
// Auteur: MidiMind Team
// ============================================================================

class MetronomeEngine {
    constructor() {
        // Audio Context
        this.audioContext = null;
        this.masterGainNode = null;
        
        // État
        this.isPlaying = false;
        this.currentBeat = 0;
        this.nextNoteTime = 0.0;
        
        // Configuration
        this.tempo = 120; // BPM
        this.timeSignature = { numerator: 4, denominator: 4 };
        this.volume = 0.5;
        this.subdivision = 4; // 1/4, 1/8, 1/16
        this.soundType = 'beep'; // beep, wood, clap
        
        // Scheduling
        this.scheduleAheadTime = 0.1; // En secondes
        this.lookahead = 25.0; // En millisecondes
        this.timerID = null;
        
        // Callbacks
        this.onBeatCallback = null;
        this.onBarCallback = null;
        
        // Initialisation
        this.initAudioContext();
    }

    /**
     * Initialise le contexte audio
     */
    initAudioContext() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.masterGainNode = this.audioContext.createGain();
            this.masterGainNode.gain.value = this.volume;
            this.masterGainNode.connect(this.audioContext.destination);
        } catch (e) {
            console.error('Web Audio API non supportée:', e);
        }
    }

    /**
     * Démarre le métronome
     */
    start() {
        if (this.isPlaying) return;
        
        if (!this.audioContext) {
            this.initAudioContext();
        }
        
        // Résumer le contexte audio si nécessaire
        if (this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }
        
        this.isPlaying = true;
        this.currentBeat = 0;
        this.nextNoteTime = this.audioContext.currentTime;
        
        this.scheduler();
    }

    /**
     * Arrête le métronome
     */
    stop() {
        this.isPlaying = false;
        this.currentBeat = 0;
        
        if (this.timerID) {
            clearTimeout(this.timerID);
            this.timerID = null;
        }
    }

    /**
     * Met en pause
     */
    pause() {
        this.isPlaying = false;
        
        if (this.timerID) {
            clearTimeout(this.timerID);
            this.timerID = null;
        }
    }

    /**
     * Reprend la lecture
     */
    resume() {
        if (this.isPlaying) return;
        
        this.isPlaying = true;
        this.nextNoteTime = this.audioContext.currentTime;
        this.scheduler();
    }

    /**
     * Scheduler principal
     */
    scheduler() {
        // Schedule les notes dans la fenêtre lookahead
        while (this.nextNoteTime < this.audioContext.currentTime + this.scheduleAheadTime) {
            this.scheduleNote(this.currentBeat, this.nextNoteTime);
            this.nextNote();
        }
        
        // Continue si en lecture
        if (this.isPlaying) {
            this.timerID = setTimeout(() => this.scheduler(), this.lookahead);
        }
    }

    /**
     * Avance au prochain beat
     */
    nextNote() {
        // Calcul du temps entre les beats
        const secondsPerBeat = 60.0 / this.tempo;
        const subdivisionFactor = 4 / this.subdivision;
        
        this.nextNoteTime += secondsPerBeat / subdivisionFactor;
        
        // Avance le compteur de beat
        this.currentBeat++;
        
        // Boucle selon la signature temporelle
        const beatsPerBar = this.timeSignature.numerator * (4 / this.subdivision);
        if (this.currentBeat >= beatsPerBar) {
            this.currentBeat = 0;
            
            // Callback de mesure
            if (this.onBarCallback) {
                this.onBarCallback();
            }
        }
    }

    /**
     * Schedule un click/son
     */
    scheduleNote(beatNumber, time) {
        // Détermine si c'est un temps fort
        const isDownbeat = (beatNumber % (4 / this.subdivision)) === 0;
        
        // Joue le son
        this.playSound(time, isDownbeat);
        
        // Callback de beat
        if (this.onBeatCallback) {
            this.onBeatCallback(beatNumber, isDownbeat);
        }
    }

    /**
     * Joue un son selon le type
     */
    playSound(time, isDownbeat) {
        switch (this.soundType) {
            case 'beep':
                this.playBeep(time, isDownbeat);
                break;
            case 'wood':
                this.playWood(time, isDownbeat);
                break;
            case 'clap':
                this.playClap(time, isDownbeat);
                break;
            default:
                this.playBeep(time, isDownbeat);
        }
    }

    /**
     * Son beep (oscillateur)
     */
    playBeep(time, isDownbeat) {
        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(this.masterGainNode);
        
        // Fréquences différentes pour temps forts/faibles
        oscillator.frequency.value = isDownbeat ? 1000 : 800;
        
        // Envelope
        gainNode.gain.setValueAtTime(0.3, time);
        gainNode.gain.exponentialRampToValueAtTime(0.01, time + 0.05);
        
        oscillator.start(time);
        oscillator.stop(time + 0.05);
    }

    /**
     * Son wood (bruit filtré)
     */
    playWood(time, isDownbeat) {
        const bufferSize = this.audioContext.sampleRate * 0.05;
        const buffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
        const data = buffer.getChannelData(0);
        
        // Génère du bruit blanc
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }
        
        const source = this.audioContext.createBufferSource();
        const filter = this.audioContext.createBiquadFilter();
        const gainNode = this.audioContext.createGain();
        
        source.buffer = buffer;
        
        // Filtre pour simuler le son du bois
        filter.type = 'bandpass';
        filter.frequency.value = isDownbeat ? 800 : 600;
        filter.Q.value = 10;
        
        source.connect(filter);
        filter.connect(gainNode);
        gainNode.connect(this.masterGainNode);
        
        // Envelope
        gainNode.gain.setValueAtTime(0.4, time);
        gainNode.gain.exponentialRampToValueAtTime(0.01, time + 0.05);
        
        source.start(time);
        source.stop(time + 0.05);
    }

    /**
     * Son clap (bruit percussif)
     */
    playClap(time, isDownbeat) {
        const bufferSize = this.audioContext.sampleRate * 0.08;
        const buffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
        const data = buffer.getChannelData(0);
        
        // Génère du bruit rose
        let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
        for (let i = 0; i < bufferSize; i++) {
            const white = Math.random() * 2 - 1;
            b0 = 0.99886 * b0 + white * 0.0555179;
            b1 = 0.99332 * b1 + white * 0.0750759;
            b2 = 0.96900 * b2 + white * 0.1538520;
            b3 = 0.86650 * b3 + white * 0.3104856;
            b4 = 0.55000 * b4 + white * 0.5329522;
            b5 = -0.7616 * b5 - white * 0.0168980;
            data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
            b6 = white * 0.115926;
        }
        
        const source = this.audioContext.createBufferSource();
        const filter = this.audioContext.createBiquadFilter();
        const gainNode = this.audioContext.createGain();
        
        source.buffer = buffer;
        
        filter.type = 'highpass';
        filter.frequency.value = 1000;
        
        source.connect(filter);
        filter.connect(gainNode);
        gainNode.connect(this.masterGainNode);
        
        // Envelope - plus fort pour temps forts
        const initialGain = isDownbeat ? 0.6 : 0.4;
        gainNode.gain.setValueAtTime(initialGain, time);
        gainNode.gain.exponentialRampToValueAtTime(0.01, time + 0.08);
        
        source.start(time);
        source.stop(time + 0.08);
    }

    /**
     * Change le tempo
     */
    setTempo(bpm) {
        this.tempo = Math.max(20, Math.min(300, bpm));
    }

    /**
     * Change la signature temporelle
     */
    setTimeSignature(numerator, denominator) {
        this.timeSignature = { numerator, denominator };
        this.currentBeat = 0;
    }

    /**
     * Change le volume
     */
    setVolume(volume) {
        this.volume = Math.max(0, Math.min(1, volume));
        if (this.masterGainNode) {
            this.masterGainNode.gain.value = this.volume;
        }
    }

    /**
     * Change la subdivision
     */
    setSubdivision(subdivision) {
        // 4 = noires, 8 = croches, 16 = double-croches
        if ([4, 8, 16].includes(subdivision)) {
            this.subdivision = subdivision;
            this.currentBeat = 0;
        }
    }

    /**
     * Change le type de son
     */
    setSoundType(type) {
        if (['beep', 'wood', 'clap'].includes(type)) {
            this.soundType = type;
        }
    }

    /**
     * Définit le callback de beat
     */
    onBeat(callback) {
        this.onBeatCallback = callback;
    }

    /**
     * Définit le callback de mesure
     */
    onBar(callback) {
        this.onBarCallback = callback;
    }

    /**
     * Reset le métronome
     */
    reset() {
        this.stop();
        this.currentBeat = 0;
        this.nextNoteTime = 0.0;
    }

    /**
     * Obtient l'état actuel
     */
    getState() {
        return {
            isPlaying: this.isPlaying,
            tempo: this.tempo,
            timeSignature: this.timeSignature,
            volume: this.volume,
            subdivision: this.subdivision,
            soundType: this.soundType,
            currentBeat: this.currentBeat
        };
    }

    /**
     * Synchronise avec un temps donné
     */
    syncToTime(time) {
        if (!this.audioContext) return;
        
        const secondsPerBeat = 60.0 / this.tempo;
        const beatNumber = Math.floor(time / secondsPerBeat);
        
        this.currentBeat = beatNumber % this.timeSignature.numerator;
        this.nextNoteTime = this.audioContext.currentTime + (secondsPerBeat - (time % secondsPerBeat));
    }

    /**
     * Nettoie les ressources
     */
    dispose() {
        this.stop();
        
        if (this.masterGainNode) {
            this.masterGainNode.disconnect();
        }
        
        if (this.audioContext) {
            this.audioContext.close();
        }
    }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MetronomeEngine;
}
window.MetronomeEngine = MetronomeEngine;