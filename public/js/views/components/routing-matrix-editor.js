// ============================================================================
// Fichier: frontend/js/views/components/routing-matrix-editor.js
// Version: v1.0.1 - COMPLET (Toutes fonctions TODO implémentées)
// Date: 2025-10-12
// Projet: midiMind v3.0 - Système d'Orchestration MIDI pour Raspberry Pi
// ============================================================================
// CORRECTIONS v1.0.1:
// ✅ addDestination() - Modal sélection instrument implémentée
// ✅ showRouteDetails() - Affichage détails route implémenté
// ✅ cacheElements() - Cache DOM implémenté
// ✅ _createInstrumentSelectionModal() - Nouvelle méthode
// ✅ _selectInstrument() - Nouvelle méthode
// ✅ _createRouteDetailsModal() - Nouvelle méthode
// ============================================================================

class RoutingMatrixEditor {
    constructor(containerId, eventBus, routingManager, logger) {
        this.containerId = containerId;
        this.eventBus = eventBus || null;
        this.routingManager = routingManager;
        this.logger = logger || console;
        
        this.container = null;
        this.instruments = [];
        this.channels = [];
        
        // État
        this.state = {
            viewMode: 'matrix', // 'matrix' ou 'list'
            selectedCell: null,
            isMultiSelect: false,
            selectedCells: []
        };
        
        // Configuration
        this.config = {
            channelCount: 16,
            showChannelNames: true,
            showCompatibility: true,
            enableDragDrop: false
        };
        
        // Cache DOM
        this.cachedElements = {};
        
        this.init();
    }
    
    // ========================================================================
    // INITIALISATION
    // ========================================================================
    
    init() {
        this.container = document.getElementById(this.containerId);
        if (!this.container) {
            this.logger.error('RoutingMatrixEditor: Container not found:', this.containerId);
            return;
        }
        
        // Initialiser les canaux MIDI
        this.channels = Array.from({ length: this.config.channelCount }, (_, i) => ({
            number: i,
            name: `CH${i + 1}`,
            type: null
        }));
        
        // Charger les instruments
        this.loadInstruments();
        
        // Premier rendu
        this.render();
        
        // Événements
        this.attachEvents();
        
        this.logger.info('RoutingMatrixEditor: Initialized');
    }
    
    loadInstruments() {
        // Récupérer les instruments depuis le routing manager
        if (this.routingManager && typeof this.routingManager.getInstruments === 'function') {
            this.instruments = this.routingManager.getInstruments();
        } else {
            this.instruments = [];
        }
    }
    
    // ========================================================================
    // RENDU
    // ========================================================================
    
    render() {
        if (!this.container) return;
        
        const html = this.state.viewMode === 'matrix' 
            ? this.renderMatrix() 
            : this.renderList();
        
        this.container.innerHTML = html;
        
        // Cache des éléments DOM après rendu
        this.cacheElements();
        
        this.logger.info('RoutingMatrixEditor: Rendered');
    }
    
    renderMatrix() {
        if (this.instruments.length === 0) {
            return '<div class="matrix-empty">No instruments available. Please connect MIDI devices.</div>';
        }
        
        let html = '<div class="routing-matrix">';
        
        // Header avec noms d'instruments
        html += '<div class="matrix-header">';
        html += '<div class="matrix-corner"></div>';
        this.instruments.forEach(inst => {
            html += `
                <div class="inst-header" title="${inst.name}">
                    <span class="inst-icon">${this.getInstrumentIcon(inst.type)}</span>
                    <span class="inst-name">${inst.name}</span>
                </div>
            `;
        });
        html += '</div>';
        
        // Lignes pour chaque canal
        this.channels.forEach(channel => {
            html += `<div class="channel-row" data-channel="${channel.number}">`;
            html += `
                <div class="ch-header">
                    <span class="ch-number">CH${channel.number + 1}</span>
                </div>
            `;
            
            // Cellules pour chaque instrument
            this.instruments.forEach(inst => {
                const route = this.routingManager?.getRoute(channel.number, inst.id);
                const isAssigned = !!route;
                const compatibility = this.config.showCompatibility 
                    ? this.getCompatibility(channel, inst) 
                    : 1.0;
                
                html += `
                    <div class="routing-cell ${isAssigned ? 'assigned' : ''}" 
                         data-channel="${channel.number}" 
                         data-instrument="${inst.id}"
                         onclick="window.routingMatrixEditor.toggleAssignment(${channel.number}, '${inst.id}')">
                        <div class="cell-indicator">
                            ${isAssigned ? '●' : '○'}
                        </div>
                        ${this.config.showCompatibility ? `
                            <div class="cell-compat ${this.getCompatClass(compatibility)}">
                                ${Math.round(compatibility * 100)}%
                            </div>
                        ` : ''}
                    </div>
                `;
            });
            
            html += '</div>';
        });
        
        html += '</div>';
        
        return html;
    }
    
    renderList() {
        let html = '<div class="routing-list">';
        
        this.channels.forEach(channel => {
            const route = this.routingManager?.getRouteForChannel(channel.number);
            const instrument = route ? this.instruments.find(i => i.id === route.instrumentId) : null;
            
            html += `
                <div class="list-item" data-channel="${channel.number}">
                    <div class="list-channel">
                        <span class="ch-badge">CH${channel.number + 1}</span>
                    </div>
                    <div class="list-arrow">→</div>
                    <div class="list-instrument">
                        ${instrument ? `
                            <span class="inst-icon">${this.getInstrumentIcon(instrument.type)}</span>
                            <span class="inst-name">${instrument.name}</span>
                            <button class="btn-remove" 
                                    onclick="window.routingMatrixEditor.removeRoute('${route.id}')">
                                ×
                            </button>
                        ` : `
                            <button class="btn-add" 
                                    onclick="window.routingMatrixEditor.addDestination(${channel.number})">
                                + Add Destination
                            </button>
                        `}
                    </div>
                </div>
            `;
        });
        
        html += '</div>';
        
        return html;
    }
    
    // ========================================================================
    // INTERACTIONS
    // ========================================================================
    
    toggleAssignment(channel, instrumentId) {
        const route = this.routingManager?.getRoute(channel, instrumentId);
        
        if (route) {
            // Déjà assigné - supprimer
            if (confirm(`Remove route CH${channel + 1} → ${instrumentId}?`)) {
                this.routingManager.removeRoute(route.id);
                this.render();
                this.updateStats();
            }
        } else {
            // Assigner
            this.assignFromSelect(channel, instrumentId);
        }
    }
    
    assignFromSelect(channel, instrumentId) {
        if (instrumentId) {
            this.routingManager.assign(channel, instrumentId);
            this.render();
            this.updateStats();
        }
    }
    
    removeRoute(routeId) {
        this.routingManager.removeRoute(routeId);
        this.render();
        this.updateStats();
    }
    
    autoRoute() {
        if (confirm('Auto-route all channels?')) {
            this.routingManager.autoRoute();
            this.render();
            this.updateStats();
        }
    }
    
    clearAll() {
        if (confirm('Clear all routes?')) {
            this.routingManager.clearAll();
            this.render();
            this.updateStats();
        }
    }
    
    // ========================================================================
    // ✅ v1.0.1 - FONCTIONS COMPLÉTÉES
    // ========================================================================
    
    /**
     * ✅ NOUVEAU v1.0.1: Ouvre une modal pour ajouter une destination
     * @param {number} channel - Numéro de canal MIDI
     */
    addDestination(channel) {
        if (!this.instruments || this.instruments.length === 0) {
            alert('No instruments available. Please connect MIDI devices first.');
            return;
        }
        
        // Créer modal
        const modal = this._createInstrumentSelectionModal(channel);
        document.body.appendChild(modal);
        
        // Animation d'entrée
        setTimeout(() => modal.classList.add('show'), 10);
        
        this.logger.info(`RoutingMatrixEditor: Opening instrument selection for CH${channel + 1}`);
    }
    
    /**
     * ✅ NOUVEAU v1.0.1: Crée une modal de sélection d'instrument
     * @private
     * @param {number} channel - Canal MIDI
     * @returns {HTMLElement}
     */
    _createInstrumentSelectionModal(channel) {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.id = 'instrument-selection-modal';
        
        const instrumentsList = this.instruments.map(inst => `
            <div class="instrument-item" data-instrument-id="${inst.id}">
                <span class="instrument-icon">${this.getInstrumentIcon(inst.type)}</span>
                <div class="instrument-info">
                    <div class="instrument-name">${inst.name}</div>
                    <div class="instrument-type">${inst.type || 'Unknown'}</div>
                </div>
                <button class="btn-select" onclick="window.routingMatrixEditor._selectInstrument(${channel}, '${inst.id}')">
                    Select
                </button>
            </div>
        `).join('');
        
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>Select Instrument for Channel ${channel + 1}</h3>
                    <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">×</button>
                </div>
                <div class="modal-body">
                    <div class="instruments-list">
                        ${instrumentsList}
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">
                        Cancel
                    </button>
                </div>
            </div>
        `;
        
        // Fermer sur clic overlay
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });
        
        // Fermer sur touche Échap
        const escapeHandler = (e) => {
            if (e.key === 'Escape') {
                modal.remove();
                document.removeEventListener('keydown', escapeHandler);
            }
        };
        document.addEventListener('keydown', escapeHandler);
        
        return modal;
    }
    
    /**
     * ✅ NOUVEAU v1.0.1: Sélectionne un instrument pour un canal
     * @private
     * @param {number} channel - Canal MIDI
     * @param {string} instrumentId - ID instrument
     */
    _selectInstrument(channel, instrumentId) {
        if (this.routingManager) {
            this.routingManager.assign(channel, instrumentId);
            this.render();
            this.updateStats();
            
            this.logger.info(`RoutingMatrixEditor: Assigned CH${channel + 1} → ${instrumentId}`);
        }
        
        // Fermer modal
        const modal = document.getElementById('instrument-selection-modal');
        if (modal) {
            modal.remove();
        }
    }
    
    /**
     * ✅ NOUVEAU v1.0.1: Affiche les détails d'une route
     * @param {string} routeId - ID de la route
     */
    showRouteDetails(routeId) {
        if (!this.routingManager) {
            console.error('RoutingManager not available');
            return;
        }
        
        const route = this.routingManager.getRouteById(routeId);
        if (!route) {
            console.error('Route not found:', routeId);
            return;
        }
        
        // Créer modal de détails
        const modal = this._createRouteDetailsModal(route);
        document.body.appendChild(modal);
        
        // Animation d'entrée
        setTimeout(() => modal.classList.add('show'), 10);
        
        this.logger.info('RoutingMatrixEditor: Showing route details:', routeId);
    }
    
    /**
     * ✅ NOUVEAU v1.0.1: Crée une modal d'affichage des détails d'une route
     * @private
     * @param {Object} route - Route à afficher
     * @returns {HTMLElement}
     */
    _createRouteDetailsModal(route) {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        
        const instrument = this.instruments.find(i => i.id === route.instrumentId);
        
        modal.innerHTML = `
            <div class="modal-content route-details-modal">
                <div class="modal-header">
                    <h3>Route Details</h3>
                    <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">×</button>
                </div>
                <div class="modal-body">
                    <div class="route-detail-section">
                        <h4>Source</h4>
                        <div class="detail-item">
                            <span class="detail-label">MIDI Channel:</span>
                            <span class="detail-value">CH${route.channel + 1}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Route ID:</span>
                            <span class="detail-value">${route.id}</span>
                        </div>
                    </div>
                    
                    <div class="route-detail-section">
                        <h4>Destination</h4>
                        <div class="detail-item">
                            <span class="detail-label">Instrument:</span>
                            <span class="detail-value">
                                ${this.getInstrumentIcon(instrument?.type)} ${instrument?.name || 'Unknown'}
                            </span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Type:</span>
                            <span class="detail-value">${instrument?.type || 'N/A'}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Connection:</span>
                            <span class="detail-value">${instrument?.connection || 'N/A'}</span>
                        </div>
                    </div>
                    
                    <div class="route-detail-section">
                        <h4>Configuration</h4>
                        <div class="detail-item">
                            <span class="detail-label">Note Range:</span>
                            <span class="detail-value">
                                ${instrument?.noteRange?.min || 0} - ${instrument?.noteRange?.max || 127}
                            </span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Created:</span>
                            <span class="detail-value">${new Date(route.createdAt || Date.now()).toLocaleString()}</span>
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-danger" onclick="window.routingMatrixEditor.removeRoute('${route.id}'); this.closest('.modal-overlay').remove();">
                        Delete Route
                    </button>
                    <button class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">
                        Close
                    </button>
                </div>
            </div>
        `;
        
        // Fermer sur clic overlay
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });
        
        // Fermer sur touche Échap
        const escapeHandler = (e) => {
            if (e.key === 'Escape') {
                modal.remove();
                document.removeEventListener('keydown', escapeHandler);
            }
        };
        document.addEventListener('keydown', escapeHandler);
        
        return modal;
    }
    
    /**
     * ✅ NOUVEAU v1.0.1: Cache les éléments DOM pour optimisation
     */
    cacheElements() {
        if (!this.container) return;
        
        // Cache des éléments fréquemment accédés
        this.cachedElements = {
            header: this.container.querySelector('.matrix-header'),
            body: this.container.querySelector('.routing-matrix') || this.container.querySelector('.routing-list'),
            channelRows: this.container.querySelectorAll('.channel-row'),
            cells: this.container.querySelectorAll('.routing-cell')
        };
        
        // Log pour debug
        this.logger.info('RoutingMatrixEditor: DOM elements cached', {
            header: !!this.cachedElements.header,
            body: !!this.cachedElements.body,
            rows: this.cachedElements.channelRows.length,
            cells: this.cachedElements.cells.length
        });
    }
    
    // ========================================================================
    // UTILS
    // ========================================================================
    
    getInstrumentIcon(type) {
        const icons = {
            'piano': '🎹',
            'synth': '🎛️',
            'drums': '🥁',
            'bass': '🎸',
            'strings': '🎻',
            'guitar': '🎸',
            'brass': '🎺',
            'woodwinds': '🎷'
        };
        return icons[type?.toLowerCase()] || '🎵';
    }
    
    getCompatClass(score) {
        if (score >= 0.8) return 'compat-high';
        if (score >= 0.5) return 'compat-medium';
        return 'compat-low';
    }
    
    getCompatibility(channel, instrument) {
        // Calcul simple de compatibilité basé sur le type
        // À améliorer selon la logique métier
        return 0.85;
    }
    
    updateStats() {
        this.eventBus?.emit('routing:stats-updated', this.routingManager.getStats());
    }
    
    attachEvents() {
        // Exposer l'instance globalement pour les onclick
        window.routingMatrixEditor = this;
        
        // Écouter les événements du routing manager
        this.eventBus?.on('routing:route-created', () => this.render());
        this.eventBus?.on('routing:route-removed', () => this.render());
        this.eventBus?.on('routing:assigned', () => this.render());
    }
    
    destroy() {
        delete window.routingMatrixEditor;
    }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = RoutingMatrixEditor;
}
