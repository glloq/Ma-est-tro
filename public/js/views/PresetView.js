// ============================================================================
// Fichier: frontend/js/views/PresetView.js
// Chemin réel: frontend/js/views/PresetView.js
// Version: v4.1.0 - SIGNATURE CORRIGÉE (HÉRITE DE BASEVIEW)
// Date: 2025-11-11
// ============================================================================
// CORRECTIONS v4.1.0:
// ✅ CRITIQUE: PresetView hérite maintenant de BaseView
// ✅ Appel super(containerId, eventBus) au début du constructeur
// ✅ Suppression réimplémentation manuelle de resolveContainer
// ✅ Accès aux méthodes BaseView (render, update, show, hide, emit, etc.)
// ✅ Utilisation de this.log() au lieu de console.log
// ✅ État spécifique renommé presetState pour éviter conflit
// ✅ Encodage UTF-8 nettoyé
// ============================================================================
// AMÉLIORATIONS v4.0.0:
// ✦ Gestion des presets système
// ✦ Créer, charger, sauvegarder presets
// ✦ Supprimer et exporter presets
// ✦ Sélection de preset actif
// ============================================================================

class PresetView extends BaseView {
    constructor(containerId, eventBus) {
        // ✅ NOUVEAU: Appel super() pour hériter de BaseView
        super(containerId, eventBus);
        
        // ✅ this.container et this.eventBus déjà initialisés par BaseView
        this.logger = window.logger || console;
        
        // État spécifique presets
        this.presetState = {
            presets: [],
            selectedPreset: null,
            currentPreset: null
        };
        
        this.log('info', 'PresetView v4.1.0 initialized');
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
        this.loadPresets();
        
        this.log('info', 'PresetView initialized');
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
            <div class="preset-view">
                <div class="preset-header">
                    <h2>💾 Presets</h2>
                    <button data-action="new" class="btn-primary">➕ Nouveau preset</button>
                </div>
                
                ${this.presetState.currentPreset ? `
                    <div class="preset-current">
                        <span class="current-label">Preset actuel:</span>
                        <strong>${this.presetState.currentPreset.name}</strong>
                        ${this.presetState.currentPreset.description ? 
                            `<span class="preset-desc">${this.presetState.currentPreset.description}</span>` : ''}
                    </div>
                ` : ''}
                
                <div class="preset-list">
                    ${this.presetState.presets.length > 0 ?
                        this.presetState.presets.map(p => this.renderPreset(p)).join('') :
                        '<p class="empty">📭 Aucun preset enregistré</p>'}
                </div>
            </div>
        `;
        
        // Marquer comme rendu
        this.state.rendered = true;
        this.state.lastUpdate = Date.now();
        
        this.log('debug', 'PresetView rendered');
    }

    /**
     * Rendu d'un preset
     * @param {Object} preset - Preset
     * @returns {string} HTML
     */
    renderPreset(preset) {
        const isSelected = this.presetState.selectedPreset?.id === preset.id;
        const isCurrent = this.presetState.currentPreset?.id === preset.id;
        
        return `
            <div class="preset-item ${isSelected ? 'selected' : ''} ${isCurrent ? 'current' : ''}" 
                 data-id="${preset.id}">
                <div class="preset-info">
                    <div class="preset-name">
                        ${preset.name}
                        ${isCurrent ? '<span class="badge-current">Actuel</span>' : ''}
                    </div>
                    ${preset.description ? 
                        `<div class="preset-desc">${preset.description}</div>` : ''}
                    ${preset.created_at ? 
                        `<div class="preset-meta">Créé: ${new Date(preset.created_at).toLocaleDateString()}</div>` : ''}
                </div>
                <div class="preset-actions">
                    <button data-action="load" class="btn-primary" title="Charger">📂 Charger</button>
                    <button data-action="save" class="btn-secondary" title="Sauvegarder">💾 Sauver</button>
                    <button data-action="delete" class="btn-danger" title="Supprimer">🗑️ Supprimer</button>
                    <button data-action="export" class="btn-secondary" title="Exporter">📤 Exporter</button>
                </div>
            </div>
        `;
    }

    // ========================================================================
    // ÉVÉNEMENTS
    // ========================================================================

    attachEvents() {
        if (!this.container) return;
        
        // Click handler
        const clickHandler = (e) => {
            const action = e.target.dataset.action;
            const presetEl = e.target.closest('.preset-item');
            const presetId = presetEl?.dataset.id;
            
            switch(action) {
                case 'new':
                    this.createPreset();
                    break;
                case 'load':
                    if (presetId) this.loadPreset(presetId);
                    break;
                case 'save':
                    if (presetId) this.savePreset(presetId);
                    break;
                case 'delete':
                    if (presetId) this.deletePreset(presetId);
                    break;
                case 'export':
                    if (presetId) this.exportPreset(presetId);
                    break;
            }
            
            // Sélection du preset au clic (hors boutons)
            if (!action && presetId) {
                this.selectPreset(presetId);
            }
        };
        
        this.container.addEventListener('click', clickHandler);
        this.addDOMListener(this.container, 'click', clickHandler);
        
        // Événements EventBus
        if (this.eventBus) {
            this.on('preset:list', (data) => {
                this.log('info', `Presets list updated: ${data.presets?.length || 0} presets`);
                this.presetState.presets = data.presets || [];
                this.render();
            });
            
            this.on('preset:loaded', (data) => {
                this.log('info', `Preset loaded: ${data.preset?.name}`);
                this.presetState.currentPreset = data.preset;
                this.render();
            });
            
            this.on('preset:saved', (data) => {
                this.log('info', `Preset saved: ${data.preset_id}`);
                this.loadPresets();
            });
            
            this.on('preset:deleted', (data) => {
                this.log('info', `Preset deleted: ${data.preset_id}`);
                if (this.presetState.currentPreset?.id === data.preset_id) {
                    this.presetState.currentPreset = null;
                }
                this.loadPresets();
            });
            
            this.log('debug', 'Event listeners attached');
        }
    }

    // ========================================================================
    // ACTIONS PRESET
    // ========================================================================

    /**
     * Crée un nouveau preset
     */
    createPreset() {
        const name = prompt('Nom du preset:');
        if (!name) {
            this.log('debug', 'Preset creation cancelled');
            return;
        }
        
        const description = prompt('Description (optionnel):');
        
        this.log('info', `Creating preset: ${name}`);
        
        if (this.eventBus) {
            this.emit('preset:save_requested', {
                name,
                description: description || ''
            });
        } else {
            this.log('error', 'Cannot create preset: EventBus not available');
        }
    }

    /**
     * Charge un preset
     * @param {string} presetId - ID du preset
     */
    loadPreset(presetId) {
        this.log('info', `Loading preset: ${presetId}`);
        
        if (this.eventBus) {
            this.emit('preset:load_requested', { preset_id: presetId });
        } else {
            this.log('error', 'Cannot load preset: EventBus not available');
        }
    }

    /**
     * Sauvegarde un preset
     * @param {string} presetId - ID du preset
     */
    savePreset(presetId) {
        this.log('info', `Saving preset: ${presetId}`);
        
        if (this.eventBus) {
            this.emit('preset:save_requested', { preset_id: presetId });
        } else {
            this.log('error', 'Cannot save preset: EventBus not available');
        }
    }

    /**
     * Supprime un preset
     * @param {string} presetId - ID du preset
     */
    deletePreset(presetId) {
        if (!confirm('Êtes-vous sûr de vouloir supprimer ce preset ?')) {
            this.log('debug', 'Preset deletion cancelled');
            return;
        }
        
        this.log('info', `Deleting preset: ${presetId}`);
        
        if (this.eventBus) {
            this.emit('preset:delete_requested', { preset_id: presetId });
        } else {
            this.log('error', 'Cannot delete preset: EventBus not available');
        }
    }

    /**
     * Exporte un preset
     * @param {string} presetId - ID du preset
     */
    exportPreset(presetId) {
        this.log('info', `Exporting preset: ${presetId}`);
        
        if (this.eventBus) {
            this.emit('preset:export_requested', { preset_id: presetId });
        } else {
            this.log('error', 'Cannot export preset: EventBus not available');
        }
    }

    /**
     * Charge la liste des presets
     */
    loadPresets() {
        this.log('debug', 'Loading presets list');
        
        if (this.eventBus) {
            this.emit('preset:list_requested');
        } else {
            this.log('error', 'Cannot load presets: EventBus not available');
        }
    }

    /**
     * Sélectionne un preset
     * @param {string} presetId - ID du preset
     */
    selectPreset(presetId) {
        const preset = this.presetState.presets.find(p => p.id === presetId);
        if (preset) {
            this.presetState.selectedPreset = preset;
            this.render();
            this.log('debug', `Preset selected: ${presetId}`);
        }
    }

    // ========================================================================
    // MÉTHODES PUBLIQUES
    // ========================================================================

    /**
     * Met à jour la liste des presets
     * @param {Array} presets - Liste des presets
     */
    updatePresets(presets) {
        this.presetState.presets = presets || [];
        this.render();
        this.log('debug', `Presets updated: ${this.presetState.presets.length}`);
    }

    /**
     * Définit le preset actuel
     * @param {Object} preset - Preset actuel
     */
    setCurrentPreset(preset) {
        this.presetState.currentPreset = preset;
        this.render();
        this.log('debug', `Current preset set: ${preset?.name}`);
    }

    /**
     * Efface le preset actuel
     */
    clearCurrentPreset() {
        this.presetState.currentPreset = null;
        this.render();
        this.log('debug', 'Current preset cleared');
    }

    // ========================================================================
    // LIFECYCLE - NETTOYAGE
    // ========================================================================

    /**
     * Détruit la vue et nettoie les ressources
     */
    destroy() {
        this.log('debug', 'Destroying PresetView');
        
        // Nettoyer l'état
        this.presetState.presets = [];
        this.presetState.selectedPreset = null;
        this.presetState.currentPreset = null;
        
        // Appeler super.destroy() pour cleanup BaseView
        super.destroy();
        
        this.log('info', 'PresetView destroyed');
    }
}

// ============================================================================
// EXPORT GLOBAL
// ============================================================================

if (typeof window !== 'undefined') {
    window.PresetView = PresetView;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = PresetView;
}