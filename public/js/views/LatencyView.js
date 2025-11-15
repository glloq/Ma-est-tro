// ============================================================================
// Fichier: frontend/js/views/LatencyView.js
// Chemin réel: frontend/js/views/LatencyView.js
// Version: v4.1.0 - SIGNATURE CORRIGÉE (HÉRITE DE BASEVIEW)
// Date: 2025-11-11
// ============================================================================
// CORRECTIONS v4.1.0:
// ✅ CRITIQUE: LatencyView hérite maintenant de BaseView
// ✅ Appel super(containerId, eventBus) au début du constructeur
// ✅ Suppression réimplémentation manuelle de resolveContainer
// ✅ Accès aux méthodes BaseView (render, update, show, hide, emit, etc.)
// ✅ Utilisation de this.log() au lieu de console.log
// ✅ État spécifique renommé latencyState pour éviter conflit
// ✅ Encodage UTF-8 nettoyé
// ============================================================================
// AMÉLIORATIONS v4.0.0:
// ✦ Compensation de latence MIDI
// ✦ Offset global
// ✦ Compensation par instrument
// ✦ Enable/disable compensation
// ============================================================================

class LatencyView extends BaseView {
    constructor(containerId, eventBus) {
        // ✅ NOUVEAU: Appel super() pour hériter de BaseView
        super(containerId, eventBus);
        
        // ✅ this.container et this.eventBus déjà initialisés par BaseView
        this.logger = window.logger || console;
        
        // État spécifique latence
        this.latencyState = {
            instruments: [],
            globalOffset: 0,
            enabled: false
        };
        
        this.log('info', 'LatencyView v4.1.0 initialized');
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
        this.attachEvents();
        this.loadData();
        
        this.log('info', 'LatencyView initialized');
    }

    // ========================================================================
    // RENDU
    // ========================================================================

    render() {
        if (!this.container) {
            this.log('error', 'Cannot render: container not found');
            return;
        }
        
        this.container.innerHTML = `
            <div class="latency-view">
                <div class="latency-header">
                    <h2>⏱️ Compensation de latence</h2>
                    <label class="latency-toggle">
                        <input type="checkbox" data-action="toggle-enabled" 
                               ${this.latencyState.enabled ? 'checked' : ''} />
                        <span>Activer compensation</span>
                    </label>
                </div>
                
                <div class="latency-global">
                    <h3>Offset global</h3>
                    <p class="help-text">Applique un délai global à toutes les sorties MIDI</p>
                    <div class="offset-control">
                        <input type="range" min="-200" max="200" step="1"
                               value="${this.latencyState.globalOffset}"
                               data-action="global-offset" 
                               ${!this.latencyState.enabled ? 'disabled' : ''} />
                        <span class="offset-value">${this.latencyState.globalOffset} ms</span>
                    </div>
                </div>
                
                <div class="latency-instruments">
                    <h3>Compensation par instrument</h3>
                    <p class="help-text">Ajuste le délai individuellement pour chaque instrument</p>
                    ${this.latencyState.instruments.length > 0 ? 
                        this.latencyState.instruments.map(inst => this.renderInstrument(inst)).join('') :
                        '<p class="empty">Aucun instrument disponible</p>'}
                </div>
            </div>
        `;
        
        // Marquer comme rendu
        this.state.rendered = true;
        this.state.lastUpdate = Date.now();
        
        this.log('debug', 'LatencyView rendered');
    }

    /**
     * Rendu d'un instrument avec contrôle de compensation
     * @param {Object} inst - Instrument
     * @returns {string} HTML
     */
    renderInstrument(inst) {
        const compensation = inst.compensation || 0;
        const disabled = !this.latencyState.enabled;
        
        return `
            <div class="instrument-latency" data-id="${inst.id}">
                <div class="instrument-info">
                    <span class="instrument-name">${inst.name}</span>
                    ${inst.type ? `<span class="instrument-type">${inst.type}</span>` : ''}
                </div>
                <div class="compensation-control">
                    <input type="number" 
                           value="${compensation}" 
                           data-action="set-compensation" 
                           min="-500" max="500" step="1"
                           ${disabled ? 'disabled' : ''} />
                    <span class="unit">ms</span>
                </div>
            </div>
        `;
    }

    // ========================================================================
    // ÉVÉNEMENTS
    // ========================================================================

    attachEvents() {
        if (!this.container) return;
        
        // Événements DOM - Change handler
        const changeHandler = (e) => {
            const action = e.target.dataset.action;
            
            if (action === 'toggle-enabled') {
                this.toggleEnabled(e.target.checked);
            } else if (action === 'global-offset') {
                this.setGlobalOffset(parseInt(e.target.value));
            } else if (action === 'set-compensation') {
                const instEl = e.target.closest('.instrument-latency');
                const instId = instEl?.dataset.id;
                if (instId) {
                    this.setCompensation(instId, parseInt(e.target.value));
                }
            }
        };
        
        this.container.addEventListener('change', changeHandler);
        this.addDOMListener(this.container, 'change', changeHandler);
        
        // Input event pour mise à jour temps réel du range
        const inputHandler = (e) => {
            if (e.target.dataset.action === 'global-offset') {
                const valueSpan = e.target.parentElement.querySelector('.offset-value');
                if (valueSpan) {
                    valueSpan.textContent = `${e.target.value} ms`;
                }
            }
        };
        
        this.container.addEventListener('input', inputHandler);
        this.addDOMListener(this.container, 'input', inputHandler);
        
        // Événements EventBus
        if (this.eventBus) {
            this.on('latency:instruments_list', (data) => {
                this.log('info', `Instruments list updated: ${data.instruments?.length || 0} instruments`);
                this.latencyState.instruments = data.instruments || [];
                this.render();
            });
            
            this.on('latency:compensation_updated', (data) => {
                this.log('info', 'Compensation updated');
                this.loadData();
            });
            
            this.on('latency:global_offset', (data) => {
                this.log('debug', `Global offset: ${data.offset} ms`);
                this.latencyState.globalOffset = data.offset || 0;
                this.render();
            });
            
            this.on('latency:enabled', (data) => {
                this.log('info', `Latency compensation ${data.enabled ? 'enabled' : 'disabled'}`);
                this.latencyState.enabled = data.enabled;
                this.render();
            });
            
            this.log('debug', 'Event listeners attached');
        }
    }

    // ========================================================================
    // ACTIONS LATENCE
    // ========================================================================

    /**
     * Active/désactive la compensation de latence
     * @param {boolean} enabled - Activer?
     */
    toggleEnabled(enabled) {
        this.log('info', `Latency compensation ${enabled ? 'enabled' : 'disabled'}`);
        this.latencyState.enabled = enabled;
        
        if (this.eventBus) {
            this.emit(enabled ? 'latency:enable_requested' : 'latency:disable_requested');
        } else {
            this.log('error', 'Cannot toggle: EventBus not available');
        }
        
        this.render();
    }

    /**
     * Définit l'offset global
     * @param {number} offset - Offset en ms
     */
    setGlobalOffset(offset) {
        this.log('info', `Setting global offset: ${offset} ms`);
        this.latencyState.globalOffset = offset;
        
        if (this.eventBus) {
            this.emit('latency:set_global_offset_requested', { offset });
        } else {
            this.log('error', 'Cannot set global offset: EventBus not available');
        }
    }

    /**
     * Définit la compensation pour un instrument
     * @param {string} instrumentId - ID de l'instrument
     * @param {number} compensation - Compensation en ms
     */
    setCompensation(instrumentId, compensation) {
        this.log('info', `Setting compensation for ${instrumentId}: ${compensation} ms`);
        
        if (this.eventBus) {
            this.emit('latency:set_compensation_requested', {
                instrument_id: instrumentId,
                compensation
            });
        } else {
            this.log('error', 'Cannot set compensation: EventBus not available');
        }
    }

    /**
     * Charge les données de latence
     */
    loadData() {
        this.log('debug', 'Loading latency data');
        
        if (this.eventBus) {
            this.emit('latency:list_instruments_requested');
            this.emit('latency:get_global_offset_requested');
            this.emit('latency:get_enabled_requested');
        } else {
            this.log('error', 'Cannot load data: EventBus not available');
        }
    }

    // ========================================================================
    // MÉTHODES PUBLIQUES
    // ========================================================================

    /**
     * Met à jour la liste des instruments
     * @param {Array} instruments - Liste des instruments
     */
    updateInstruments(instruments) {
        this.latencyState.instruments = instruments || [];
        this.render();
        this.log('debug', `Instruments updated: ${this.latencyState.instruments.length}`);
    }

    /**
     * Met à jour l'offset global
     * @param {number} offset - Offset en ms
     */
    updateGlobalOffset(offset) {
        this.latencyState.globalOffset = offset;
        this.render();
        this.log('debug', `Global offset updated: ${offset} ms`);
    }

    /**
     * Met à jour l'état activé/désactivé
     * @param {boolean} enabled - Activé?
     */
    updateEnabled(enabled) {
        this.latencyState.enabled = enabled;
        this.render();
        this.log('debug', `Enabled state updated: ${enabled}`);
    }

    // ========================================================================
    // LIFECYCLE - NETTOYAGE
    // ========================================================================

    /**
     * Détruit la vue et nettoie les ressources
     */
    destroy() {
        this.log('debug', 'Destroying LatencyView');
        
        // Nettoyer l'état
        this.latencyState.instruments = [];
        this.latencyState.globalOffset = 0;
        this.latencyState.enabled = false;
        
        // Appeler super.destroy() pour cleanup BaseView
        super.destroy();
        
        this.log('info', 'LatencyView destroyed');
    }
}

// ============================================================================
// EXPORT GLOBAL
// ============================================================================

if (typeof window !== 'undefined') {
    window.LatencyView = LatencyView;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = LatencyView;
}