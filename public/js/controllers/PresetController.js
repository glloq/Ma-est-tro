// ============================================================================
// Fichier: frontend/js/controllers/PresetController.js
// Version: v1.0.1 - FIXED BACKEND SIGNATURE
// Date: 2025-10-28
// ============================================================================
// CORRECTIONS v1.0.1:
// ✅ CRITIQUE: Ajout paramètre backend au constructeur (6ème paramètre)
// ✅ Fix: super() appelle BaseController avec backend
// ✅ this.backend initialisé automatiquement via BaseController
// ============================================================================
// ============================================================================
// Description:
//   Contrôleur pour gérer les presets de configuration
//   - Liste et chargement des presets
//   - Sauvegarde de la configuration actuelle
//   - Suppression et export de presets
//   - Validation de la structure
// ============================================================================

class PresetController extends BaseController {
    constructor(eventBus, models = {}, views = {}, notifications = null, debugConsole = null, backend = null) {
        super(eventBus, models, views, notifications, debugConsole, backend);
        
        this.backendService = backendService;
        this.presetView = presetView;
        
        // État des presets
        this.state.presets = {
            list: [],
            current: null,
            selectedPreset: null
        };
        
        // Configuration
        this.config.autoLoad = true;
    }
    
    /**
     * Initialisation personnalisée
     */
    onInitialize() {
        this.logDebug('info', 'PresetController initializing...');
        
        // Charger la liste des presets
        if (this.config.autoLoad) {
            this.loadPresetsList();
        }
    }
    
    /**
     * Liaison des événements
     */
    bindEvents() {
        // Événements de la vue
        this.subscribe('preset:list', () => this.loadPresetsList());
        this.subscribe('preset:load', (data) => this.loadPreset(data.id));
        this.subscribe('preset:save', (data) => this.savePreset(data.preset));
        this.subscribe('preset:delete', (data) => this.deletePreset(data.id));
        this.subscribe('preset:export', (data) => this.exportPreset(data.id, data.filepath));
        this.subscribe('preset:select', (data) => this.selectPreset(data.id));
        this.subscribe('preset:create-new', (data) => this.createNewPreset(data));
        
        // Événements backend
        this.subscribe('backend:connected', () => {
            this.loadPresetsList();
        });
    }
    
    /**
     * Charge la liste des presets
     */
    async loadPresetsList() {
        return this.executeAction('loadPresetsList', async () => {
            try {
                const response = await this.backendService.sendCommand('preset.list', {});
                
                if (response.success) {
                    this.state.presets.list = response.data.presets || [];
                    
                    this.updateView({
                        presets: this.state.presets.list
                    });
                    
                    this.emitEvent('presets:list:loaded', {
                        presets: this.state.presets.list
                    });
                }
                
                return response;
            } catch (error) {
                this.handleError('Erreur lors du chargement de la liste des presets', error);
                throw error;
            }
        });
    }
    
    /**
     * Charge un preset
     */
    async loadPreset(presetId) {
        return this.executeAction('loadPreset', async (data) => {
            try {
                this.showNotification(`Chargement du preset ${data.id}...`, 'info');
                
                const response = await this.backendService.sendCommand('preset.load', {
                    id: data.id
                });
                
                if (response.success) {
                    this.state.presets.current = response.data.preset || null;
                    
                    this.showNotification(
                        `Preset "${response.data.preset?.metadata?.name || data.id}" chargé avec succès`,
                        'success'
                    );
                    
                    // Émettre un événement pour que les autres contrôleurs puissent réagir
                    this.emitEvent('preset:loaded', {
                        preset: this.state.presets.current
                    });
                    
                    // Rafraîchir la liste pour mettre à jour l'état actuel
                    await this.loadPresetsList();
                }
                
                return response;
            } catch (error) {
                this.handleError(`Erreur lors du chargement du preset ${presetId}`, error);
                throw error;
            }
        }, { id: presetId });
    }
    
    /**
     * Sauvegarde un preset
     */
    async savePreset(presetData) {
        return this.executeAction('savePreset', async (data) => {
            try {
                // Valider la structure du preset
                if (!this.validatePresetStructure(data.preset)) {
                    throw new Error('Structure de preset invalide');
                }
                
                this.showNotification('Sauvegarde du preset...', 'info');
                
                const response = await this.backendService.sendCommand('preset.save', {
                    preset: data.preset
                });
                
                if (response.success) {
                    const presetId = response.data.id || 'unknown';
                    const presetName = data.preset.metadata?.name || presetId;
                    
                    this.showNotification(
                        `Preset "${presetName}" sauvegardé avec succès`,
                        'success'
                    );
                    
                    this.emitEvent('preset:saved', {
                        id: presetId,
                        preset: data.preset
                    });
                    
                    // Rafraîchir la liste
                    await this.loadPresetsList();
                }
                
                return response;
            } catch (error) {
                this.handleError('Erreur lors de la sauvegarde du preset', error);
                throw error;
            }
        }, { preset: presetData });
    }
    
    /**
     * Supprime un preset
     */
    async deletePreset(presetId) {
        return this.executeAction('deletePreset', async (data) => {
            try {
                const preset = this.state.presets.list.find(p => p.id === data.id);
                const presetName = preset?.metadata?.name || data.id;
                
                // Demander confirmation
                if (!confirm(`Êtes-vous sûr de vouloir supprimer le preset "${presetName}" ?`)) {
                    return { success: false, cancelled: true };
                }
                
                this.showNotification(`Suppression du preset ${presetName}...`, 'info');
                
                const response = await this.backendService.sendCommand('preset.delete', {
                    id: data.id
                });
                
                if (response.success) {
                    this.showNotification(
                        `Preset "${presetName}" supprimé`,
                        'success'
                    );
                    
                    // Retirer de la liste locale
                    this.state.presets.list = this.state.presets.list.filter(
                        p => p.id !== data.id
                    );
                    
                    this.updateView({
                        presets: this.state.presets.list
                    });
                    
                    this.emitEvent('preset:deleted', {
                        id: data.id
                    });
                }
                
                return response;
            } catch (error) {
                this.handleError(`Erreur lors de la suppression du preset ${presetId}`, error);
                throw error;
            }
        }, { id: presetId });
    }
    
    /**
     * Exporte un preset
     */
    async exportPreset(presetId, filepath) {
        return this.executeAction('exportPreset', async (data) => {
            try {
                this.showNotification('Export du preset...', 'info');
                
                const response = await this.backendService.sendCommand('preset.export', {
                    id: data.id,
                    filepath: data.filepath
                });
                
                if (response.success) {
                    const preset = this.state.presets.list.find(p => p.id === data.id);
                    const presetName = preset?.metadata?.name || data.id;
                    
                    this.showNotification(
                        `Preset "${presetName}" exporté vers ${data.filepath}`,
                        'success'
                    );
                    
                    this.emitEvent('preset:exported', {
                        id: data.id,
                        filepath: data.filepath
                    });
                }
                
                return response;
            } catch (error) {
                this.handleError(`Erreur lors de l'export du preset ${presetId}`, error);
                throw error;
            }
        }, { id: presetId, filepath });
    }
    
    /**
     * Sélectionne un preset
     */
    selectPreset(presetId) {
        const preset = this.state.presets.list.find(p => p.id === presetId);
        
        if (preset) {
            this.state.presets.selectedPreset = preset;
            
            this.updateView({
                selectedPreset: preset
            });
            
            this.emitEvent('preset:selected', {
                preset
            });
        }
    }
    
    /**
     * Crée un nouveau preset à partir de la configuration actuelle
     */
    async createNewPreset(metadata) {
        return this.executeAction('createNewPreset', async (data) => {
            try {
                // Demander les informations du preset
                const name = data.name || prompt('Nom du preset:');
                if (!name) {
                    return { success: false, cancelled: true };
                }
                
                const description = data.description || prompt('Description (optionnel):') || '';
                
                // Construire le preset avec la configuration actuelle
                // Note: Cette partie devrait récupérer la configuration actuelle
                // des routes et périphériques depuis les autres contrôleurs
                const preset = {
                    metadata: {
                        name,
                        description,
                        created: new Date().toISOString(),
                        version: '1.0.0'
                    },
                    routes: data.routes || [],
                    deviceSettings: data.deviceSettings || {}
                };
                
                // Sauvegarder le preset
                return await this.savePreset(preset);
                
            } catch (error) {
                this.handleError('Erreur lors de la création du preset', error);
                throw error;
            }
        }, metadata);
    }
    
    /**
     * Valide la structure d'un preset
     */
    validatePresetStructure(preset) {
        if (!preset || typeof preset !== 'object') {
            this.logDebug('error', 'Preset must be an object');
            return false;
        }
        
        // Vérifier la présence des champs requis
        if (!preset.metadata || typeof preset.metadata !== 'object') {
            this.logDebug('error', 'Preset must have metadata object');
            return false;
        }
        
        if (!preset.metadata.name || typeof preset.metadata.name !== 'string') {
            this.logDebug('error', 'Preset metadata must have a name');
            return false;
        }
        
        // Vérifier les routes (optionnel mais doit être un tableau si présent)
        if (preset.routes && !Array.isArray(preset.routes)) {
            this.logDebug('error', 'Preset routes must be an array');
            return false;
        }
        
        // Vérifier les paramètres des périphériques (optionnel mais doit être un objet si présent)
        if (preset.deviceSettings && typeof preset.deviceSettings !== 'object') {
            this.logDebug('error', 'Preset deviceSettings must be an object');
            return false;
        }
        
        return true;
    }
    
    /**
     * Met à jour la vue
     */
    updateView(data) {
        if (this.presetView && typeof this.presetView.render === 'function') {
            this.presetView.render(data);
        }
    }
    
    /**
     * Afficher une notification
     */
    showNotification(message, type = 'info') {
        if (this.notifications && typeof this.notifications.show === 'function') {
            this.notifications.show(message, type);
        } else {
            this.logDebug(type, message);
        }
    }
    
    /**
     * Obtenir l'état actuel
     */
    getPresetsState() {
        return {
            ...this.state.presets,
            presetsCount: this.state.presets.list.length
        };
    }
}

// ============================================================================
// EXPORT
// ============================================================================

if (typeof module !== 'undefined' && module.exports) {
    module.exports = PresetController;
}

if (typeof window !== 'undefined') {
    window.PresetController = PresetController;
}