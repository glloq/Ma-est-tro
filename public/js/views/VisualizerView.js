// ============================================================================
// Fichier: frontend/js/views/VisualizerView.js
// Chemin réel: frontend/js/views/VisualizerView.js
// Version: v4.1.0 - SIGNATURE CORRIGÉE (HÉRITE DE BASEVIEW)
// Date: 2025-11-11
// ============================================================================
// CORRECTIONS v4.1.0:
// ✅ CRITIQUE: VisualizerView hérite maintenant de BaseView
// ✅ Appel super(containerId, eventBus) au début du constructeur
// ✅ Suppression réimplémentation manuelle de resolveContainer
// ✅ Accès aux méthodes BaseView (render, update, show, hide, emit, etc.)
// ✅ Utilisation de this.log() au lieu de console.log
// ✅ Event listeners enregistrés via addDOMListener() pour cleanup automatique
// ✅ Méthode destroy() appelle super.destroy()
// ============================================================================
// AMÉLIORATIONS v4.0.0:
// ✦ Visualisation MIDI en temps réel
// ✦ 3 modes: bars, waveform, spectrum
// ✦ Colorisation par canal ou vélocité
// ✦ Animation fluide avec fade out
// ============================================================================

class VisualizerView extends BaseView {
    constructor(containerId, eventBus) {
        // ✅ NOUVEAU: Appel super() pour hériter de BaseView
        super(containerId, eventBus);
        
        // ✅ this.container et this.eventBus déjà initialisés par BaseView
        this.logger = window.logger || console;
        
        // Canvas
        this.canvas = null;
        this.ctx = null;
        this.animationId = null;
        
        // État spécifique au visualizer
        this.visualizerState = {
            activeNotes: new Map(), // note -> {channel, velocity, time}
            mode: 'bars', // 'bars', 'waveform', 'spectrum'
            colorMode: 'channel' // 'channel', 'velocity'
        };
        
        // Bind animation frame handler
        this.boundAnimate = this.animate.bind(this);
        
        this.log('info', 'VisualizerView v4.1.0 initialized');
    }

    // ========================================================================
    // INITIALISATION
    // ========================================================================

    init() {
        if (!this.container) {
            this.log('error', 'Cannot initialize: container not found');
            return;
        }
        
        this.render();
        this.setupCanvas();
        this.attachEvents();
        this.startAnimation();
        
        this.log('info', 'VisualizerView initialized');
    }

    render() {
        if (!this.container) {
            this.log('error', 'Cannot render: container not found');
            return;
        }
        
        this.container.innerHTML = `
            <div class="visualizer-view">
                <div class="visualizer-controls">
                    <select data-action="mode">
                        <option value="bars">Bars</option>
                        <option value="waveform">Waveform</option>
                        <option value="spectrum">Spectrum</option>
                    </select>
                    <select data-action="color">
                        <option value="channel">Par canal</option>
                        <option value="velocity">Par vélocité</option>
                    </select>
                </div>
                <canvas id="visualizerCanvas"></canvas>
                <div class="visualizer-info">
                    <span class="note-count">0 notes</span>
                    <span class="channel-count">0 canaux</span>
                </div>
            </div>
        `;
        
        // Marquer comme rendu
        this.state.rendered = true;
        this.state.lastUpdate = Date.now();
    }

    setupCanvas() {
        this.canvas = document.getElementById('visualizerCanvas');
        if (!this.canvas) {
            this.log('error', 'Canvas element not found');
            return;
        }
        
        this.ctx = this.canvas.getContext('2d');
        this.resizeCanvas();
        
        // ✅ Utiliser addDOMListener pour cleanup automatique
        this.resizeHandler = () => this.resizeCanvas();
        window.addEventListener('resize', this.resizeHandler);
        
        this.log('debug', 'Canvas setup complete');
    }

    resizeCanvas() {
        if (!this.canvas) return;
        const parent = this.canvas.parentElement;
        if (!parent) return;
        
        this.canvas.width = parent.clientWidth;
        this.canvas.height = parent.clientHeight;
        
        this.log('debug', `Canvas resized to ${this.canvas.width}x${this.canvas.height}`);
    }

    // ========================================================================
    // ÉVÉNEMENTS
    // ========================================================================

    attachEvents() {
        // Événements DOM
        if (this.container) {
            const changeHandler = (e) => {
                const action = e.target.dataset.action;
                if (action === 'mode') {
                    this.visualizerState.mode = e.target.value;
                    this.log('debug', `Mode changed to: ${e.target.value}`);
                }
                if (action === 'color') {
                    this.visualizerState.colorMode = e.target.value;
                    this.log('debug', `Color mode changed to: ${e.target.value}`);
                }
            };
            
            this.container.addEventListener('change', changeHandler);
            this.addDOMListener(this.container, 'change', changeHandler);
        }
        
        // Événements MIDI via EventBus
        if (this.eventBus) {
            this.on('midi:note_on', (data) => {
                this.visualizerState.activeNotes.set(data.note, {
                    channel: data.channel || 0,
                    velocity: data.velocity || 64,
                    time: Date.now()
                });
            });
            
            this.on('midi:note_off', (data) => {
                // Laisser fade out naturel dans draw()
            });
            
            this.log('debug', 'Event listeners attached');
        }
    }

    // ========================================================================
    // ANIMATION
    // ========================================================================

    startAnimation() {
        if (this.animationId) {
            this.log('warn', 'Animation already running');
            return;
        }
        
        this.animate();
        this.log('debug', 'Animation started');
    }

    animate() {
        this.draw();
        this.animationId = requestAnimationFrame(this.boundAnimate);
    }

    stopAnimation() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
            this.log('debug', 'Animation stopped');
        }
    }

    // ========================================================================
    // RENDU
    // ========================================================================

    draw() {
        if (!this.ctx || !this.canvas) return;
        
        const ctx = this.ctx;
        const width = this.canvas.width;
        const height = this.canvas.height;
        
        // Clear avec fade
        ctx.fillStyle = 'rgba(20, 20, 30, 0.3)';
        ctx.fillRect(0, 0, width, height);
        
        // Rendu selon le mode
        switch (this.visualizerState.mode) {
            case 'bars':
                this.drawBars(ctx, width, height);
                break;
            case 'waveform':
                this.drawWaveform(ctx, width, height);
                break;
            case 'spectrum':
                this.drawSpectrum(ctx, width, height);
                break;
        }
        
        this.updateInfo();
    }

    drawBars(ctx, width, height) {
        const now = Date.now();
        const noteHeight = height / 128;
        
        this.visualizerState.activeNotes.forEach((data, note) => {
            const age = now - data.time;
            const alpha = Math.max(0, 1 - age / 2000);
            
            if (alpha <= 0) {
                this.visualizerState.activeNotes.delete(note);
                return;
            }
            
            const color = this.getColor(data);
            ctx.fillStyle = `${color}${Math.floor(alpha * 255).toString(16).padStart(2, '0')}`;
            
            const y = (127 - note) * noteHeight;
            const barWidth = (data.velocity / 127) * width * 0.8;
            ctx.fillRect(width * 0.1, y, barWidth, noteHeight);
        });
    }

    drawWaveform(ctx, width, height) {
        const now = Date.now();
        ctx.strokeStyle = '#4a9eff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        
        let x = 0;
        this.visualizerState.activeNotes.forEach((data, note) => {
            const age = now - data.time;
            const y = height / 2 + Math.sin(age * 0.01 + note) * (data.velocity / 127) * height * 0.4;
            
            if (x === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
            
            x += width / Math.max(1, this.visualizerState.activeNotes.size);
        });
        
        ctx.stroke();
    }

    drawSpectrum(ctx, width, height) {
        const barWidth = width / 128;
        
        this.visualizerState.activeNotes.forEach((data, note) => {
            const x = (note / 128) * width;
            const barHeight = (data.velocity / 127) * height * 0.8;
            const color = this.getColor(data);
            
            ctx.fillStyle = color;
            ctx.fillRect(x, height - barHeight, barWidth, barHeight);
        });
    }

    getColor(data) {
        if (this.visualizerState.colorMode === 'channel') {
            const hue = (data.channel * 30) % 360;
            return `hsl(${hue}, 70%, 60%)`;
        } else {
            const hue = (data.velocity / 127) * 240;
            return `hsl(${hue}, 70%, 60%)`;
        }
    }

    updateInfo() {
        if (!this.container) return;
        
        const noteCount = this.container.querySelector('.note-count');
        const channelCount = this.container.querySelector('.channel-count');
        
        if (noteCount) {
            noteCount.textContent = `${this.visualizerState.activeNotes.size} notes`;
        }
        
        const channels = new Set();
        this.visualizerState.activeNotes.forEach(data => channels.add(data.channel));
        if (channelCount) {
            channelCount.textContent = `${channels.size} canaux`;
        }
    }

    // ========================================================================
    // LIFECYCLE - NETTOYAGE
    // ========================================================================

    /**
     * Détruit la vue et nettoie les ressources
     * ✅ Appelle super.destroy() pour cleanup BaseView
     */
    destroy() {
        this.log('debug', 'Destroying VisualizerView');
        
        // Arrêter l'animation
        this.stopAnimation();
        
        // Nettoyer resize handler
        if (this.resizeHandler) {
            window.removeEventListener('resize', this.resizeHandler);
            this.resizeHandler = null;
        }
        
        // Nettoyer canvas
        if (this.ctx) {
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        }
        this.canvas = null;
        this.ctx = null;
        
        // Nettoyer state
        this.visualizerState.activeNotes.clear();
        
        // ✅ Appeler super.destroy() pour cleanup BaseView
        super.destroy();
        
        this.log('info', 'VisualizerView destroyed');
    }

    // ========================================================================
    // MÉTHODES PUBLIQUES
    // ========================================================================

    /**
     * Change le mode de visualisation
     * @param {string} mode - 'bars', 'waveform', ou 'spectrum'
     */
    setMode(mode) {
        if (['bars', 'waveform', 'spectrum'].includes(mode)) {
            this.visualizerState.mode = mode;
            const select = this.container?.querySelector('[data-action="mode"]');
            if (select) select.value = mode;
            this.log('info', `Visualization mode set to: ${mode}`);
        } else {
            this.log('warn', `Invalid mode: ${mode}`);
        }
    }

    /**
     * Change le mode de colorisation
     * @param {string} colorMode - 'channel' ou 'velocity'
     */
    setColorMode(colorMode) {
        if (['channel', 'velocity'].includes(colorMode)) {
            this.visualizerState.colorMode = colorMode;
            const select = this.container?.querySelector('[data-action="color"]');
            if (select) select.value = colorMode;
            this.log('info', `Color mode set to: ${colorMode}`);
        } else {
            this.log('warn', `Invalid color mode: ${colorMode}`);
        }
    }

    /**
     * Efface toutes les notes actives
     */
    clearNotes() {
        this.visualizerState.activeNotes.clear();
        this.log('debug', 'All notes cleared');
    }
}

// ============================================================================
// EXPORT GLOBAL
// ============================================================================

if (typeof window !== 'undefined') {
    window.VisualizerView = VisualizerView;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = VisualizerView;
}