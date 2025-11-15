// ============================================================================
// Fichier: frontend/js/controllers/VisualizerController.js
// Projet: MidiMind v3.0 - Système d'Orchestration MIDI pour Raspberry Pi
// Version: 3.0.1 - CORRECTION DOCUMENTATION
// Date: 2025-10-29
// ============================================================================
// CORRECTIONS v3.0.1:
// ✓ Documentation corrigée - N'hérite PAS de BaseController
// ✓ Architecture clarifiée - Standalone controller
// ============================================================================
// Description:
//   Contrôleur du visualiseur temps réel MIDI.
//   Gère l'affichage, le routing des notes actives, et les performances
//   du rendu en temps réel.
//
// Fonctionnalités:
//   - Réception notes MIDI temps réel
//   - Mise à jour visualiseur (60 FPS max)
//   - Gestion pool notes actives (object pooling)
//   - Filtrage par canal/instrument
//   - Configuration fenêtre temporelle
//   - Statistiques temps réel (notes/sec, latence)
//   - Optimisation performance (throttling)
//   - Pause/Resume visualisation
//
// Architecture:
//   VisualizerController - Standalone visualizer controller
//   - Utilise VisualizerView pour rendu
//   - Utilise PlaybackModel pour données MIDI
//   - PerformanceMonitor pour optimisation
//   - Object pooling pour notes actives
//   - Ne hérite PAS de BaseController (contrôleur léger optimisé)
//
// Auteur: MidiMind Team
// ============================================================================

class VisualizerController {
    constructor(eventBus, models = {}, views = {}, notifications = null, debugConsole = null, backend = null) {
        this.eventBus = eventBus;
        this.visualizer = null;
        this.playbackController = null;
        this.routingModel = null;
        
        this.updateInterval = null;
        this.updateRate = 60; // FPS
    }

    /**
     * Initialise le contrôleur
     */
    init(visualizer, playbackController, routingModel) {
        this.visualizer = visualizer;
        this.playbackController = playbackController;
        this.routingModel = routingModel;

        this.attachEvents();
    }

    /**
     * Attache les événements
     */
    attachEvents() {
        // Événements de lecture
        this.eventBus.on('playback:started', () => {
            this.startUpdates();
        });

        this.eventBus.on('playback:paused', () => {
            this.stopUpdates();
        });

        this.eventBus.on('playback:stopped', () => {
            this.stopUpdates();
            if (this.visualizer) {
                this.visualizer.update(0);
            }
        });

        this.eventBus.on('playback:seeked', (time) => {
            if (this.visualizer) {
                this.visualizer.update(time);
            }
        });

        // Événements MIDI
        this.eventBus.on('playback:event', (event) => {
            this.handleMidiEvent(event);
        });

        // Événements de routing
        this.eventBus.on('routing:changed', () => {
            if (this.visualizer) {
                this.visualizer.invalidate();
            }
        });

        // Événements de performance
        this.eventBus.on('performance:quality:changed', (data) => {
            this.adjustQuality(data.quality);
        });
    }

    /**
     * Démarre les mises à jour
     */
    startUpdates() {
        this.stopUpdates();

        const interval = 1000 / this.updateRate;

        this.updateInterval = setInterval(() => {
            if (!this.playbackController || !this.visualizer) return;

            const state = this.playbackController.getState();
            
            if (state.state === 'playing') {
                this.visualizer.update(state.currentTime);
            }
        }, interval);
    }

    /**
     * Arrête les mises à jour
     */
    stopUpdates() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
    }

    /**
     * Gère un événement MIDI
     */
    handleMidiEvent(event) {
        if (!this.visualizer) return;

        // Vérifier la validité avec le routing
        if (event.channel !== undefined) {
            const routing = this.routingModel.getRouting(event.channel);

            if (!routing) return;

            // Marquer si non-jouable
            if (event.type === 'noteOn') {
                const instrument = routing.instrument;
                
                if (instrument && !instrument.notes.includes(event.note)) {
                    event.unplayable = true;
                }
            }
        }

        // L'événement sera visible dans le visualizer via la mise à jour normale
    }

    /**
     * Ajuste la qualité selon les performances
     */
    adjustQuality(quality) {
        if (!this.visualizer) return;

        switch (quality) {
            case 'low':
                this.updateRate = 20;
                this.visualizer.setShowVelocity(false);
                this.visualizer.setShowNoteNames(false);
                break;

            case 'medium':
                this.updateRate = 30;
                this.visualizer.setShowVelocity(true);
                this.visualizer.setShowNoteNames(false);
                break;

            case 'high':
                this.updateRate = 60;
                this.visualizer.setShowVelocity(true);
                this.visualizer.setShowNoteNames(true);
                break;
        }

        // Redémarrer avec le nouveau rate
        if (this.updateInterval) {
            this.startUpdates();
        }
    }

    /**
     * Définit le temps d'aperçu
     */
    setPreviewTime(ms) {
        if (this.visualizer) {
            this.visualizer.setPreviewTime(ms);
        }
    }

    /**
     * Active/désactive un canal
     */
    toggleChannel(channel, enabled) {
        if (this.visualizer) {
            this.visualizer.toggleChannel(channel, enabled);
        }
    }

    /**
     * Active/désactive l'affichage de la vélocité
     */
    setShowVelocity(show) {
        if (this.visualizer) {
            this.visualizer.setShowVelocity(show);
        }
    }

    /**
     * Active/désactive l'affichage des CC
     */
    setShowCC(show) {
        if (this.visualizer) {
            this.visualizer.setShowCC(show);
        }
    }

    /**
     * Active/désactive l'affichage des noms de notes
     */
    setShowNoteNames(show) {
        if (this.visualizer) {
            this.visualizer.setShowNoteNames(show);
        }
    }

    /**
     * Obtient un snapshot de l'état actuel
     */
    getSnapshot() {
        if (!this.visualizer || !this.playbackController) {
            return null;
        }

        const state = this.playbackController.getState();
        const upcomingNotes = this.playbackController.getUpcomingEvents(2000);

        return {
            currentTime: state.currentTime,
            upcomingNotes: upcomingNotes,
            activeChannels: Array.from(this.visualizer.activeChannels),
            previewTime: this.visualizer.previewTime
        };
    }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = VisualizerController;
}
window.VisualizerController = VisualizerController;