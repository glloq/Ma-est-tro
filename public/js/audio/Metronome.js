// ============================================================================
// Fichier: frontend/js/audio/Metronome.js
// Version: 1.1.0
// Date: 2025-10-14
// ============================================================================
// Description:
//   Métronome utilisant Web Audio API pour fournir un timing précis.
//   Génère des clics audio pour marquer le tempo avec accent sur le premier temps.
//
// Fonctionnalités:
//   - Click accent (premier temps) et click normal
//   - Contrôle du volume
//   - Start/Stop avec synchronisation tempo
//   - Support des signatures temporelles variables
//   - Callbacks personnalisables (onBeat, onAccent)
//
// Changelog v1.1.0:
//   ✅ Vérification complète de toutes les fonctions
//   ✅ Optimisation playTone() avec gestion erreurs améliorée
//   ✅ Ajout validation paramètres
//   ✅ Amélioration documentation inline
//   ✅ Code production-ready
//
// Usage:
//   const metronome = new Metronome();
//   metronome.start(120, 4); // 120 BPM, 4 temps par mesure
//   metronome.stop();
// ============================================================================

/**
 * @class Metronome
 * @description Métronome haute précision avec Web Audio API
 */
class Metronome {
    constructor() {
        // Audio Context
        this.audioContext = null;
        this.initAudioContext();
        
        // État
        this.isRunning = false;
        this.tempo = 120;              // BPM
        this.beatsPerBar = 4;          // Temps par mesure
        this.currentBeat = 0;          // Beat actuel (0-indexed)
        
        // Volume
        this.volume = 0.5;             // 0.0 à 1.0
        
        // Timing
        this.intervalId = null;
        this.nextBeatTime = 0;
        this.scheduleAheadTime = 0.1;  // Scheduler 100ms à l'avance
        this.timerInterval = 25;       // Vérifier toutes les 25ms
        
        // Fréquences des sons
        this.accentFreq = 1000;        // Hz - Son aigu pour accent
        this.clickFreq = 800;          // Hz - Son normal
        this.clickDuration = 0.05;     // Secondes
        
        // Callbacks
        this.onBeat = null;            // Callback sur chaque beat
        this.onAccent = null;          // Callback sur accent
    }
    
    // ========================================================================
    // INITIALISATION
    // ========================================================================
    
    /**
     * Initialise l'Audio Context
     */
    initAudioContext() {
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            this.audioContext = new AudioContext();
            
            // Resume audio context si suspendu (Chrome policy)
            if (this.audioContext.state === 'suspended') {
                this.audioContext.resume();
            }
            
            console.log('Metronome: Audio Context initialized');
        } catch (error) {
            console.error('Metronome: Failed to initialize Audio Context', error);
        }
    }
    
    // ========================================================================
    // CONTRÔLE LECTURE
    // ========================================================================
    
    /**
     * Démarre le métronome
     * @param {number} tempo - Tempo en BPM (20-300)
     * @param {number} beatsPerBar - Nombre de temps par mesure (1-16)
     */
    start(tempo = 120, beatsPerBar = 4) {
        if (this.isRunning) {
            console.warn('Metronome: Already running');
            return;
        }
        
        if (!this.audioContext) {
            console.error('Metronome: Audio Context not initialized');
            return;
        }
        
        // Validation paramètres
        if (tempo < 20 || tempo > 300) {
            console.warn('Metronome: Tempo must be between 20 and 300 BPM, using default');
            tempo = 120;
        }
        
        if (beatsPerBar < 1 || beatsPerBar > 16) {
            console.warn('Metronome: Beats per bar must be between 1 and 16, using default');
            beatsPerBar = 4;
        }
        
        // Resume audio context si nécessaire
        if (this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }
        
        this.tempo = tempo;
        this.beatsPerBar = beatsPerBar;
        this.currentBeat = 0;
        this.isRunning = true;
        
        // Initialiser le timing
        this.nextBeatTime = this.audioContext.currentTime;
        
        // Démarrer le scheduler
        this.scheduleNote();
        this.intervalId = setInterval(() => {
            this.scheduleNote();
        }, this.timerInterval);
        
        console.log(`Metronome: Started at ${tempo} BPM, ${beatsPerBar}/4`);
    }
    
    /**
     * Arrête le métronome
     */
    stop() {
        if (!this.isRunning) {
            return;
        }
        
        this.isRunning = false;
        this.currentBeat = 0;
        
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
        
        console.log('Metronome: Stopped');
    }
    
    // ========================================================================
    // SCHEDULING
    // ========================================================================
    
    /**
     * Schedule le prochain beat
     * Utilise look-ahead scheduling pour timing précis
     */
    scheduleNote() {
        if (!this.isRunning || !this.audioContext) {
            return;
        }
        
        const currentTime = this.audioContext.currentTime;
        
        // Scheduler tous les beats dans la fenêtre scheduleAheadTime
        while (this.nextBeatTime < currentTime + this.scheduleAheadTime) {
            // Jouer le son
            if (this.currentBeat === 0) {
                this.playAccent(this.nextBeatTime);
            } else {
                this.playClick(this.nextBeatTime);
            }
            
            // Callbacks
            this.triggerCallbacks();
            
            // Calculer le temps du prochain beat
            const secondsPerBeat = 60.0 / this.tempo;
            this.nextBeatTime += secondsPerBeat;
            
            // Avancer au beat suivant
            this.currentBeat = (this.currentBeat + 1) % this.beatsPerBar;
        }
    }
    
    // ========================================================================
    // GÉNÉRATION AUDIO
    // ========================================================================
    
    /**
     * Joue le son d'accent (premier temps)
     * @param {number} time - Temps absolu dans l'Audio Context
     */
    playAccent(time = null) {
        if (!this.audioContext) return;
        
        const playTime = time || this.audioContext.currentTime;
        this.playTone(this.accentFreq, playTime, this.clickDuration, this.volume);
    }
    
    /**
     * Joue le son de click normal
     * @param {number} time - Temps absolu dans l'Audio Context
     */
    playClick(time = null) {
        if (!this.audioContext) return;
        
        const playTime = time || this.audioContext.currentTime;
        this.playTone(this.clickFreq, playTime, this.clickDuration, this.volume * 0.7);
    }
    
    /**
     * Joue un ton à une fréquence donnée
     * @param {number} frequency - Fréquence en Hz
     * @param {number} time - Temps de début
     * @param {number} duration - Durée en secondes
     * @param {number} volume - Volume (0.0 à 1.0)
     */
    playTone(frequency, time, duration, volume) {
        if (!this.audioContext) return;
        
        try {
            // Créer oscillateur
            const oscillator = this.audioContext.createOscillator();
            oscillator.type = 'sine';
            oscillator.frequency.value = frequency;
            
            // Créer gain node pour le volume et l'enveloppe
            const gainNode = this.audioContext.createGain();
            gainNode.gain.value = 0;
            
            // Connecter oscillator -> gain -> destination
            oscillator.connect(gainNode);
            gainNode.connect(this.audioContext.destination);
            
            // Enveloppe ADSR simplifiée
            const attackTime = 0.001;
            const releaseTime = duration * 0.3;
            
            // Attack
            gainNode.gain.setValueAtTime(0, time);
            gainNode.gain.linearRampToValueAtTime(volume, time + attackTime);
            
            // Sustain
            gainNode.gain.setValueAtTime(volume, time + duration - releaseTime);
            
            // Release
            gainNode.gain.linearRampToValueAtTime(0.001, time + duration);
            
            // Démarrer et arrêter l'oscillateur
            oscillator.start(time);
            oscillator.stop(time + duration);
            
        } catch (error) {
            console.error('Metronome: Error playing tone', error);
        }
    }
    
    // ========================================================================
    // CALLBACKS
    // ========================================================================
    
    /**
     * Déclenche les callbacks
     */
    triggerCallbacks() {
        try {
            if (this.currentBeat === 0 && this.onAccent) {
                this.onAccent();
            }
            
            if (this.onBeat) {
                this.onBeat(this.currentBeat);
            }
        } catch (error) {
            console.error('Metronome: Error in callback', error);
        }
    }
    
    // ========================================================================
    // PARAMÈTRES
    // ========================================================================
    
    /**
     * Change le tempo en cours d'exécution
     * @param {number} tempo - Nouveau tempo en BPM (20-300)
     */
    setTempo(tempo) {
        if (tempo < 20 || tempo > 300) {
            console.warn('Metronome: Tempo must be between 20 and 300 BPM');
            return;
        }
        
        this.tempo = tempo;
        console.log(`Metronome: Tempo changed to ${tempo} BPM`);
    }
    
    /**
     * Change la signature temporelle
     * @param {number} beatsPerBar - Nombre de temps par mesure (1-16)
     */
    setBeatsPerBar(beatsPerBar) {
        if (beatsPerBar < 1 || beatsPerBar > 16) {
            console.warn('Metronome: Beats per bar must be between 1 and 16');
            return;
        }
        
        this.beatsPerBar = beatsPerBar;
        this.currentBeat = 0; // Reset au début de la mesure
        console.log(`Metronome: Time signature changed to ${beatsPerBar}/4`);
    }
    
    /**
     * Définit le volume
     * @param {number} volume - Volume (0.0 à 1.0)
     */
    setVolume(volume) {
        this.volume = Math.max(0, Math.min(1, volume));
    }
    
    /**
     * Définit les fréquences des sons
     * @param {number} accentFreq - Fréquence de l'accent (Hz)
     * @param {number} clickFreq - Fréquence du click (Hz)
     */
    setFrequencies(accentFreq, clickFreq) {
        this.accentFreq = accentFreq;
        this.clickFreq = clickFreq;
    }
    
    // ========================================================================
    // ÉTAT ET UTILITAIRES
    // ========================================================================
    
    /**
     * Obtient l'état actuel
     * @returns {object} État du métronome
     */
    getState() {
        return {
            isRunning: this.isRunning,
            tempo: this.tempo,
            beatsPerBar: this.beatsPerBar,
            currentBeat: this.currentBeat,
            volume: this.volume
        };
    }
    
    /**
     * Vérifie si le métronome est en cours d'exécution
     * @returns {boolean} true si en cours
     */
    isPlaying() {
        return this.isRunning;
    }
    
    /**
     * Nettoie les ressources
     */
    destroy() {
        this.stop();
        
        if (this.audioContext) {
            this.audioContext.close();
            this.audioContext = null;
        }
        
        console.log('Metronome: Destroyed');
    }
}

// Export pour modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Metronome;
}
window.Metronome = Metronome;
// ============================================================================
// FIN DU FICHIER Metronome.js - v1.1.0
// ============================================================================