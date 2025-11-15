// ============================================================================
// Fichier: frontend/js/views/components/ProgressBar.js
// Projet: midiMind v3.0 - Système d'Orchestration MIDI pour Raspberry Pi
// ============================================================================
// Description:
//   Composant de barre de progression pour la lecture MIDI.
//   Supporte le clic pour seek, le drag, l'affichage du temps et du buffer.
//
// Auteur: midiMind Team
// Date: 2025-10-04
// Version: 3.0.0
// ============================================================================

class ProgressBar {
    constructor(container, config = {}) {
        this.container = typeof container === 'string' ? 
            document.getElementById(container) : container;
        
        // Configuration
        this.config = {
            clickable: true,
            draggable: true,
            showTime: true,
            showBuffer: false,
            showTooltip: true,
            smoothUpdate: true,
            updateInterval: 100,
            height: 6,
            ...config
        };
        
        // État
        this.state = {
            position: 0,        // Position actuelle en ms
            duration: 0,        // Durée totale en ms
            buffered: 0,        // Position buffered en ms
            isDragging: false,
            isHovering: false,
            lastUpdate: 0
        };
        
        // Éléments DOM
        this.elements = {};
        
        // Callbacks
        this.onSeek = config.onSeek || null;
        this.onSeekStart = config.onSeekStart || null;
        this.onSeekEnd = config.onSeekEnd || null;
        
        // Timer pour mise à jour smooth
        this.updateTimer = null;
        
        this.init();
    }
    
    // ========================================================================
    // INITIALISATION
    // ========================================================================
    
    init() {
        if (!this.container) {
            console.error('ProgressBar: Container not found');
            return;
        }
        
        this.render();
        this.attachEvents();
        
        // Démarrer l'animation smooth si activée
        if (this.config.smoothUpdate) {
            this.startSmoothUpdate();
        }
    }
    
    render() {
        // Structure HTML
        const html = `
            <div class="progress-bar-wrapper">
                ${this.config.showTime ? `
                    <span class="progress-time progress-time-current">00:00</span>
                ` : ''}
                
                <div class="progress-track" style="height: ${this.config.height}px;">
                    ${this.config.showBuffer ? `
                        <div class="progress-buffer"></div>
                    ` : ''}
                    <div class="progress-fill"></div>
                    <div class="progress-handle"></div>
                    ${this.config.showTooltip ? `
                        <div class="progress-tooltip">00:00</div>
                    ` : ''}
                </div>
                
                ${this.config.showTime ? `
                    <span class="progress-time progress-time-total">00:00</span>
                ` : ''}
            </div>
        `;
        
        this.container.innerHTML = html;
        
        // Cacher les éléments DOM
        this.elements = {
            wrapper: this.container.querySelector('.progress-bar-wrapper'),
            track: this.container.querySelector('.progress-track'),
            fill: this.container.querySelector('.progress-fill'),
            handle: this.container.querySelector('.progress-handle'),
            buffer: this.container.querySelector('.progress-buffer'),
            tooltip: this.container.querySelector('.progress-tooltip'),
            currentTime: this.container.querySelector('.progress-time-current'),
            totalTime: this.container.querySelector('.progress-time-total')
        };
        
        // Appliquer les styles CSS
        this.applyStyles();
    }
    
    applyStyles() {
        // Styles inline pour le composant
        const style = document.createElement('style');
        style.textContent = `
            .progress-bar-wrapper {
                display: flex;
                align-items: center;
                gap: 12px;
                user-select: none;
            }
            
            .progress-track {
                position: relative;
                flex: 1;
                background: rgba(255, 255, 255, 0.1);
                border-radius: ${this.config.height / 2}px;
                overflow: hidden;
                cursor: ${this.config.clickable ? 'pointer' : 'default'};
                transition: transform 0.2s ease;
            }
            
            .progress-track:hover {
                transform: ${this.config.clickable ? 'scaleY(1.5)' : 'none'};
            }
            
            .progress-fill {
                position: absolute;
                left: 0;
                top: 0;
                height: 100%;
                background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
                border-radius: inherit;
                width: 0%;
                transition: width 0.1s linear;
            }
            
            .progress-buffer {
                position: absolute;
                left: 0;
                top: 0;
                height: 100%;
                background: rgba(255, 255, 255, 0.2);
                border-radius: inherit;
                width: 0%;
            }
            
            .progress-handle {
                position: absolute;
                top: 50%;
                transform: translate(-50%, -50%);
                width: 16px;
                height: 16px;
                background: white;
                border-radius: 50%;
                box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
                cursor: ${this.config.draggable ? 'grab' : 'default'};
                opacity: 0;
                transition: opacity 0.2s ease;
                left: 0%;
            }
            
            .progress-track:hover .progress-handle,
            .progress-handle.dragging {
                opacity: 1;
            }
            
            .progress-handle.dragging {
                cursor: grabbing;
                transform: translate(-50%, -50%) scale(1.2);
            }
            
            .progress-time {
                font-size: 12px;
                color: rgba(255, 255, 255, 0.7);
                font-family: monospace;
                min-width: 45px;
            }
            
            .progress-tooltip {
                position: absolute;
                bottom: 100%;
                left: 0;
                transform: translateX(-50%);
                background: rgba(0, 0, 0, 0.8);
                color: white;
                padding: 4px 8px;
                border-radius: 4px;
                font-size: 12px;
                white-space: nowrap;
                pointer-events: none;
                opacity: 0;
                transition: opacity 0.2s ease;
                margin-bottom: 8px;
            }
            
            .progress-tooltip.visible {
                opacity: 1;
            }
        `;
        
        // Ajouter les styles au document si pas déjà présents
        if (!document.getElementById('progress-bar-styles')) {
            style.id = 'progress-bar-styles';
            document.head.appendChild(style);
        }
    }
    
    // ========================================================================
    // ÉVÉNEMENTS
    // ========================================================================
    
    attachEvents() {
        if (!this.elements.track) return;
        
        // Click pour seek
        if (this.config.clickable) {
            this.elements.track.addEventListener('click', (e) => this.handleClick(e));
        }
        
        // Drag handle
        if (this.config.draggable && this.elements.handle) {
            this.elements.handle.addEventListener('mousedown', (e) => this.startDrag(e));
            
            // Touch events pour mobile
            this.elements.handle.addEventListener('touchstart', (e) => this.startDrag(e), { passive: false });
        }
        
        // Hover pour tooltip
        if (this.config.showTooltip) {
            this.elements.track.addEventListener('mousemove', (e) => this.handleMouseMove(e));
            this.elements.track.addEventListener('mouseenter', () => this.showTooltip());
            this.elements.track.addEventListener('mouseleave', () => this.hideTooltip());
        }
        
        // Global events pour drag
        document.addEventListener('mousemove', (e) => this.handleDrag(e));
        document.addEventListener('mouseup', () => this.endDrag());
        document.addEventListener('touchmove', (e) => this.handleDrag(e), { passive: false });
        document.addEventListener('touchend', () => this.endDrag());
    }
    
    handleClick(event) {
        if (this.state.isDragging) return;
        
        const percent = this.getPercentFromEvent(event);
        const position = Math.round(this.state.duration * percent);
        
        this.seek(position);
    }
    
    startDrag(event) {
        event.preventDefault();
        
        this.state.isDragging = true;
        this.elements.handle.classList.add('dragging');
        
        if (this.onSeekStart) {
            this.onSeekStart();
        }
    }
    
    handleDrag(event) {
        if (!this.state.isDragging) return;
        
        event.preventDefault();
        
        const percent = this.getPercentFromEvent(event);
        const position = Math.round(this.state.duration * percent);
        
        // Mise à jour visuelle immédiate
        this.updateVisual(position, this.state.duration);
        
        // Callback optionnel pour preview
        if (this.config.liveSeek && this.onSeek) {
            this.onSeek(position);
        }
    }
    
    endDrag() {
        if (!this.state.isDragging) return;
        
        this.state.isDragging = false;
        this.elements.handle.classList.remove('dragging');
        
        // Seek final
        const percent = parseFloat(this.elements.fill.style.width) / 100;
        const position = Math.round(this.state.duration * percent);
        
        this.seek(position);
        
        if (this.onSeekEnd) {
            this.onSeekEnd();
        }
    }
    
    handleMouseMove(event) {
        if (!this.config.showTooltip || !this.elements.tooltip) return;
        
        const percent = this.getPercentFromEvent(event);
        const position = Math.round(this.state.duration * percent);
        
        // Positionner le tooltip
        this.elements.tooltip.style.left = `${percent * 100}%`;
        this.elements.tooltip.textContent = this.formatTime(position);
    }
    
    showTooltip() {
        if (this.elements.tooltip) {
            this.elements.tooltip.classList.add('visible');
        }
    }
    
    hideTooltip() {
        if (this.elements.tooltip) {
            this.elements.tooltip.classList.remove('visible');
        }
    }
    
    // ========================================================================
    // MISE À JOUR
    // ========================================================================
    
    /**
     * Mettre à jour la position et la durée
     * @param {number} position - Position en millisecondes
     * @param {number} duration - Durée totale en millisecondes
     */
    update(position, duration) {
        this.state.position = position;
        this.state.duration = duration;
        this.state.lastUpdate = Date.now();
        
        if (!this.state.isDragging) {
            this.updateVisual(position, duration);
        }
    }
    
    /**
     * Mise à jour visuelle de la barre
     */
    updateVisual(position, duration) {
        const percent = duration > 0 ? (position / duration) * 100 : 0;
        
        // Limiter entre 0 et 100
        const clampedPercent = Math.max(0, Math.min(100, percent));
        
        // Mettre à jour la barre de progression
        if (this.elements.fill) {
            this.elements.fill.style.width = `${clampedPercent}%`;
        }
        
        // Mettre à jour la poignée
        if (this.elements.handle) {
            this.elements.handle.style.left = `${clampedPercent}%`;
        }
        
        // Mettre à jour les temps
        if (this.config.showTime) {
            if (this.elements.currentTime) {
                this.elements.currentTime.textContent = this.formatTime(position);
            }
            if (this.elements.totalTime) {
                this.elements.totalTime.textContent = this.formatTime(duration);
            }
        }
    }
    
    /**
     * Mettre à jour le buffer
     * @param {number} buffered - Position buffered en millisecondes
     */
    updateBuffer(buffered) {
        if (!this.config.showBuffer || !this.elements.buffer) return;
        
        this.state.buffered = buffered;
        const percent = this.state.duration > 0 ? 
            (buffered / this.state.duration) * 100 : 0;
        
        this.elements.buffer.style.width = `${percent}%`;
    }
    
    /**
     * Animation smooth de la progression
     */
    startSmoothUpdate() {
        this.stopSmoothUpdate();
        
        this.updateTimer = setInterval(() => {
            if (this.state.duration > 0 && !this.state.isDragging) {
                // Estimer la position actuelle basée sur le temps écoulé
                const elapsed = Date.now() - this.state.lastUpdate;
                const estimatedPosition = this.state.position + elapsed;
                
                if (estimatedPosition <= this.state.duration) {
                    this.updateVisual(estimatedPosition, this.state.duration);
                }
            }
        }, this.config.updateInterval);
    }
    
    stopSmoothUpdate() {
        if (this.updateTimer) {
            clearInterval(this.updateTimer);
            this.updateTimer = null;
        }
    }
    
    // ========================================================================
    // ACTIONS
    // ========================================================================
    
    /**
     * Seek à une position spécifique
     * @param {number} position - Position en millisecondes
     */
    seek(position) {
        if (this.onSeek) {
            this.onSeek(position);
        }
        
        this.update(position, this.state.duration);
    }
    
    /**
     * Reset la barre de progression
     */
    reset() {
        this.update(0, 0);
        this.updateBuffer(0);
        this.state = {
            position: 0,
            duration: 0,
            buffered: 0,
            isDragging: false,
            isHovering: false,
            lastUpdate: 0
        };
    }
    
    // ========================================================================
    // UTILITAIRES
    // ========================================================================
    
    /**
     * Obtenir le pourcentage depuis un événement souris/touch
     */
    getPercentFromEvent(event) {
        const rect = this.elements.track.getBoundingClientRect();
        
        let clientX;
        if (event.type.includes('touch')) {
            clientX = event.touches[0].clientX;
        } else {
            clientX = event.clientX;
        }
        
        const x = clientX - rect.left;
        const percent = x / rect.width;
        
        // Limiter entre 0 et 1
        return Math.max(0, Math.min(1, percent));
    }
    
    /**
     * Formater le temps en MM:SS ou HH:MM:SS
     * @param {number} milliseconds - Temps en millisecondes
     */
    formatTime(milliseconds) {
        if (!milliseconds || milliseconds < 0) {
            return '00:00';
        }
        
        const totalSeconds = Math.floor(milliseconds / 1000);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;
        
        if (hours > 0) {
            return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        } else {
            return `${minutes}:${seconds.toString().padStart(2, '0')}`;
        }
    }
    
    // ========================================================================
    // DESTRUCTION
    // ========================================================================
    
    destroy() {
        // Arrêter les timers
        this.stopSmoothUpdate();
        
        // Nettoyer les événements
        document.removeEventListener('mousemove', this.handleDrag);
        document.removeEventListener('mouseup', this.endDrag);
        document.removeEventListener('touchmove', this.handleDrag);
        document.removeEventListener('touchend', this.endDrag);
        
        // Vider le container
        if (this.container) {
            this.container.innerHTML = '';
        }
    }
}
window.ProgressBar = ProgressBar;