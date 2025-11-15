// ============================================================================
// Fichier: public/js/services/FileRoutingService.js
// Version: v1.0.0
// Description: Gère l'état du routage MIDI pour chaque fichier
// ============================================================================

class FileRoutingService {
    constructor(eventBus) {
        this.eventBus = eventBus;
        this.logger = window.logger || console;

        // Stockage de l'état du routage par fichier
        // Format: { filePath: { channels: { channelNum: deviceId }, configured: true/false } }
        this.routingStates = new Map();

        // Charger les états depuis localStorage
        this.loadFromStorage();

        this.log('info', '✅ FileRoutingService initialized');
    }

    // ========================================================================
    // GESTION DE L'ÉTAT DU ROUTAGE
    // ========================================================================

    /**
     * Vérifier si un fichier a son routage configuré
     * @param {string} filePath - Chemin du fichier
     * @returns {boolean}
     */
    isFileRouted(filePath) {
        const state = this.routingStates.get(filePath);
        return state?.configured === true && Object.keys(state.channels || {}).length > 0;
    }

    /**
     * Obtenir le routage d'un fichier
     * @param {string} filePath - Chemin du fichier
     * @returns {object|null}
     */
    getFileRouting(filePath) {
        return this.routingStates.get(filePath) || null;
    }

    /**
     * Définir le routage pour un fichier
     * @param {string} filePath - Chemin du fichier
     * @param {object} channels - Mapping des canaux { channelNum: deviceId }
     * @param {array} channelInfo - Informations sur les canaux du fichier
     */
    setFileRouting(filePath, channels, channelInfo = []) {
        const state = {
            channels: channels || {},
            configured: Object.keys(channels || {}).length > 0,
            channelInfo: channelInfo,
            lastModified: Date.now()
        };

        this.routingStates.set(filePath, state);
        this.saveToStorage();

        // Émettre événement
        this.eventBus?.emit('file_routing:updated', {
            filePath,
            state
        });

        this.log('info', `Routing set for ${filePath}: ${Object.keys(channels).length} channels`);

        return state;
    }

    /**
     * Effacer le routage d'un fichier
     * @param {string} filePath - Chemin du fichier
     */
    clearFileRouting(filePath) {
        this.routingStates.delete(filePath);
        this.saveToStorage();

        this.eventBus?.emit('file_routing:cleared', { filePath });

        this.log('info', `Routing cleared for ${filePath}`);
    }

    /**
     * Mettre à jour un canal spécifique
     * @param {string} filePath - Chemin du fichier
     * @param {number} channel - Numéro du canal MIDI (0-15)
     * @param {string} deviceId - ID de l'appareil cible
     */
    setChannelRoute(filePath, channel, deviceId) {
        let state = this.routingStates.get(filePath);

        if (!state) {
            state = {
                channels: {},
                configured: false,
                channelInfo: [],
                lastModified: Date.now()
            };
        }

        state.channels[channel] = deviceId;
        state.configured = true;
        state.lastModified = Date.now();

        this.routingStates.set(filePath, state);
        this.saveToStorage();

        this.eventBus?.emit('file_routing:channel_updated', {
            filePath,
            channel,
            deviceId
        });

        return state;
    }

    /**
     * Obtenir le routage d'un canal spécifique
     * @param {string} filePath - Chemin du fichier
     * @param {number} channel - Numéro du canal
     * @returns {string|null}
     */
    getChannelRoute(filePath, channel) {
        const state = this.routingStates.get(filePath);
        return state?.channels?.[channel] || null;
    }

    /**
     * Obtenir tous les fichiers routés
     * @returns {array}
     */
    getAllRoutedFiles() {
        const routed = [];

        for (const [filePath, state] of this.routingStates.entries()) {
            if (state.configured && Object.keys(state.channels || {}).length > 0) {
                routed.push({
                    filePath,
                    channelCount: Object.keys(state.channels).length,
                    lastModified: state.lastModified
                });
            }
        }

        return routed;
    }

    // ========================================================================
    // PERSISTANCE
    // ========================================================================

    /**
     * Sauvegarder dans localStorage
     */
    saveToStorage() {
        try {
            const data = {};

            for (const [filePath, state] of this.routingStates.entries()) {
                data[filePath] = state;
            }

            localStorage.setItem('midi_file_routing', JSON.stringify(data));

        } catch (error) {
            this.log('error', 'Failed to save routing to storage:', error);
        }
    }

    /**
     * Charger depuis localStorage
     */
    loadFromStorage() {
        try {
            const data = localStorage.getItem('midi_file_routing');

            if (data) {
                const parsed = JSON.parse(data);

                for (const [filePath, state] of Object.entries(parsed)) {
                    this.routingStates.set(filePath, state);
                }

                this.log('info', `Loaded routing for ${this.routingStates.size} files from storage`);
            }

        } catch (error) {
            this.log('error', 'Failed to load routing from storage:', error);
        }
    }

    /**
     * Exporter la configuration
     * @returns {object}
     */
    exportConfig() {
        const config = {};

        for (const [filePath, state] of this.routingStates.entries()) {
            config[filePath] = state;
        }

        return config;
    }

    /**
     * Importer une configuration
     * @param {object} config - Configuration à importer
     */
    importConfig(config) {
        if (!config || typeof config !== 'object') {
            throw new Error('Invalid config format');
        }

        this.routingStates.clear();

        for (const [filePath, state] of Object.entries(config)) {
            this.routingStates.set(filePath, state);
        }

        this.saveToStorage();
        this.eventBus?.emit('file_routing:imported', { count: this.routingStates.size });

        this.log('info', `Imported routing for ${this.routingStates.size} files`);
    }

    /**
     * Effacer toutes les configurations
     */
    clearAll() {
        this.routingStates.clear();
        this.saveToStorage();

        this.eventBus?.emit('file_routing:all_cleared');

        this.log('info', 'All routing cleared');
    }

    // ========================================================================
    // UTILITAIRES
    // ========================================================================

    /**
     * Logger avec préfixe
     */
    log(level, ...args) {
        const prefix = '[FileRoutingService]';

        if (typeof this.logger[level] === 'function') {
            this.logger[level](prefix, ...args);
        } else {
            console[level](prefix, ...args);
        }
    }
}

// ============================================================================
// EXPORT
// ============================================================================

if (typeof module !== 'undefined' && module.exports) {
    module.exports = FileRoutingService;
}

if (typeof window !== 'undefined') {
    window.FileRoutingService = FileRoutingService;
}
