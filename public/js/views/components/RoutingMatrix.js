// ============================================================================
// Fichier: frontend/js/views/components/RoutingMatrix.js
// Version: v3.1.0 - SIMPLIFIED
// Date: 2025-10-16
// Projet: MidiMind v3.0 - Système d'Orchestration MIDI
// ============================================================================
// MODIFICATIONS v3.1.0:
// ✓ Interface simplifiée : liste au lieu de matrice NxM
// ✓ Dropdowns simples pour sélection instrument
// ✓ Pas de calcul de compatibilité
// ✓ Pas d'indicateurs visuels complexes
// ============================================================================

class RoutingMatrix {
    constructor(container, options = {}) {
        this.container = container;
        
        // Options
        this.options = {
            mode: options.mode || 'simple',  // 'simple' uniquement
            channels: options.channels || [],
            instruments: options.instruments || [],
            routingManager: options.routingManager || null,
            eventBus: options.eventBus || null
        };
        
        // État
        this.channels = this.options.channels;
        this.instruments = this.options.instruments;
        this.routes = new Map();  // channel → instrumentId
        
        // Callbacks
        this.onRouteChange = options.onRouteChange || null;
        this.onTestRoute = options.onTestRoute || null;
        
        this.render();
    }
    
    // ========================================================================
    // RENDERING PRINCIPAL (LISTE SIMPLE)
    // ========================================================================
    
    render() {
        if (!this.container) return;
        
        const html = `
            <div class="routing-matrix-simple">
                <!-- Header -->
                <div class="routing-header">
                    <h3>Assignation Canaux → Instruments</h3>
                    <div class="routing-actions">
                        <button class="btn btn-secondary btn-auto-assign" id="btn-auto-assign">
                            🎲 Auto-Assign
                        </button>
                        <button class="btn btn-secondary btn-clear-all" id="btn-clear-all">
                            🗑️ Effacer tout
                        </button>
                    </div>
                </div>
                
                <!-- Info Cards -->
                <div class="routing-info-cards">
                    <div class="info-card">
                        <span class="info-label">Canaux actifs</span>
                        <span class="info-value">${this.getActiveChannels().length}</span>
                    </div>
                    <div class="info-card">
                        <span class="info-label">Instruments connectés</span>
                        <span class="info-value">${this.getConnectedInstruments().length}</span>
                    </div>
                    <div class="info-card">
                        <span class="info-label">Routes actives</span>
                        <span class="info-value">${this.routes.size}</span>
                    </div>
                </div>
                
                <!-- Liste des canaux -->
                <div class="routing-list">
                    ${this.renderChannelsList()}
                </div>
            </div>
        `;
        
        this.container.innerHTML = html;
        this.attachListeners();
    }
    
    // ========================================================================
    // LISTE DES CANAUX
    // ========================================================================
    
    renderChannelsList() {
        if (!this.channels || this.channels.length === 0) {
            return `
                <div class="routing-empty">
                    <p>Aucun canal MIDI détecté</p>
                    <p class="text-muted">Chargez un fichier MIDI pour voir les canaux</p>
                </div>
            `;
        }
        
        return this.channels.map(channel => {
            const channelNumber = typeof channel === 'object' ? channel.number : channel;
            const channelName = typeof channel === 'object' ? channel.name : `Canal ${channelNumber}`;
            const assignedInstrument = this.routes.get(channelNumber);
            
            return `
                <div class="routing-item" data-channel="${channelNumber}">
                    <div class="channel-info">
                        <span class="channel-number">Canal ${channelNumber}</span>
                        <span class="channel-name">${channelName}</span>
                        ${this.renderChannelStats(channel)}
                    </div>
                    
                    <div class="routing-control">
                        <select class="instrument-select" 
                                data-channel="${channelNumber}"
                                ${this.getConnectedInstruments().length === 0 ? 'disabled' : ''}>
                            <option value="">-- Aucun --</option>
                            ${this.renderInstrumentOptions(assignedInstrument)}
                        </select>
                        
                        <button class="btn btn-test" 
                                data-channel="${channelNumber}"
                                ${!assignedInstrument ? 'disabled' : ''}>
                            🎵 Test
                        </button>
                    </div>
                    
                    ${assignedInstrument ? this.renderRouteStatus(channelNumber, assignedInstrument) : ''}
                </div>
            `;
        }).join('');
    }
    
    // ========================================================================
    // OPTIONS INSTRUMENTS
    // ========================================================================
    
    renderInstrumentOptions(selectedId) {
        return this.getConnectedInstruments().map(inst => {
            const isSelected = inst.id === selectedId;
            return `
                <option value="${inst.id}" ${isSelected ? 'selected' : ''}>
                    ${inst.name}
                </option>
            `;
        }).join('');
    }
    
    // ========================================================================
    // STATS CANAL (optionnel)
    // ========================================================================
    
    renderChannelStats(channel) {
        if (typeof channel !== 'object' || !channel.noteCount) {
            return '';
        }
        
        return `
            <span class="channel-stats">
                ${channel.noteCount} notes
            </span>
        `;
    }
    
    // ========================================================================
    // STATUS ROUTE
    // ========================================================================
    
    renderRouteStatus(channel, instrumentId) {
        const instrument = this.instruments.find(i => i.id === instrumentId);
        
        if (!instrument) {
            return `
                <div class="route-status error">
                    ⚠️ Instrument non trouvé
                </div>
            `;
        }
        
        if (!instrument.connected) {
            return `
                <div class="route-status warning">
                    ⚠️ Instrument déconnecté
                </div>
            `;
        }
        
        return `
            <div class="route-status success">
                ✓ Routé vers ${instrument.name}
            </div>
        `;
    }
    
    // ========================================================================
    // EVENT LISTENERS
    // ========================================================================
    
    attachListeners() {
        // Sélection instrument
        this.container.querySelectorAll('.instrument-select').forEach(select => {
            select.addEventListener('change', (e) => {
                const channel = parseInt(e.target.dataset.channel);
                const instrumentId = e.target.value;
                
                this.handleRouteChange(channel, instrumentId);
            });
        });
        
        // Boutons test
        this.container.querySelectorAll('.btn-test').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const channel = parseInt(e.target.dataset.channel);
                this.handleTestRoute(channel);
            });
        });
        
        // Auto-assign
        const autoAssignBtn = this.container.querySelector('#btn-auto-assign');
        if (autoAssignBtn) {
            autoAssignBtn.addEventListener('click', () => {
                this.handleAutoAssign();
            });
        }
        
        // Clear all
        const clearAllBtn = this.container.querySelector('#btn-clear-all');
        if (clearAllBtn) {
            clearAllBtn.addEventListener('click', () => {
                this.handleClearAll();
            });
        }
    }
    
    // ========================================================================
    // HANDLERS
    // ========================================================================
    
    handleRouteChange(channel, instrumentId) {
        if (instrumentId) {
            // Créer/modifier route
            this.routes.set(channel, instrumentId);
        } else {
            // Supprimer route
            this.routes.delete(channel);
        }
        
        // Callback
        if (this.onRouteChange) {
            this.onRouteChange(channel, instrumentId);
        }
        
        // Re-render pour mettre à jour status
        this.render();
    }
    
    handleTestRoute(channel) {
        const instrumentId = this.routes.get(channel);
        
        if (!instrumentId) {
            console.warn('No route for channel', channel);
            return;
        }
        
        // Callback
        if (this.onTestRoute) {
            this.onTestRoute(channel, instrumentId);
        }
    }
    
    handleAutoAssign() {
        const connectedInstruments = this.getConnectedInstruments();
        
        if (connectedInstruments.length === 0) {
            alert('Aucun instrument connecté');
            return;
        }
        
        // Simple round-robin
        this.channels.forEach((channel, index) => {
            const channelNumber = typeof channel === 'object' ? channel.number : channel;
            const instrument = connectedInstruments[index % connectedInstruments.length];
            
            this.routes.set(channelNumber, instrument.id);
            
            // Callback
            if (this.onRouteChange) {
                this.onRouteChange(channelNumber, instrument.id);
            }
        });
        
        this.render();
    }
    
    handleClearAll() {
        if (!confirm('Effacer toutes les routes ?')) {
            return;
        }
        
        // Notifier pour chaque route supprimée
        if (this.onRouteChange) {
            this.routes.forEach((instrumentId, channel) => {
                this.onRouteChange(channel, null);
            });
        }
        
        this.routes.clear();
        this.render();
    }
    
    // ========================================================================
    // GETTERS
    // ========================================================================
    
    getActiveChannels() {
        return this.channels.filter(ch => {
            const num = typeof ch === 'object' ? ch.number : ch;
            return this.routes.has(num);
        });
    }
    
    getConnectedInstruments() {
        return this.instruments.filter(i => i.connected);
    }
    
    getRoutes() {
        return Array.from(this.routes.entries()).map(([channel, instrumentId]) => ({
            channel,
            instrumentId
        }));
    }
    
    // ========================================================================
    // UPDATE DATA
    // ========================================================================
    
    setChannels(channels) {
        this.channels = channels || [];
        this.render();
    }
    
    setInstruments(instruments) {
        this.instruments = instruments || [];
        this.render();
    }
    
    setRoutes(routes) {
        this.routes.clear();
        
        if (Array.isArray(routes)) {
            routes.forEach(route => {
                this.routes.set(route.channel, route.instrumentId || route.instrument);
            });
        } else if (routes instanceof Map) {
            this.routes = new Map(routes);
        }
        
        this.render();
    }
    
    // ========================================================================
    // DESTRUCTION
    // ========================================================================
    
    destroy() {
        if (this.container) {
            this.container.innerHTML = '';
        }
        
        this.routes.clear();
        this.channels = [];
        this.instruments = [];
    }
}

// ============================================================================
// EXPORT
// ============================================================================

if (typeof module !== 'undefined' && module.exports) {
    module.exports = RoutingMatrix;
}

if (typeof window !== 'undefined') {
    window.RoutingMatrix = RoutingMatrix;
}
window.RoutingMatrix = RoutingMatrix;