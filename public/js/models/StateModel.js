// ============================================================================
// Fichier: frontend/js/models/StateModel.js
// Chemin rÃ©el: frontend/js/models/StateModel.js
// Version: v3.3.0 - SIGNATURE CORRIGÃ‰E (5 PARAMÃˆTRES)
// Date: 2025-11-01
// ============================================================================
// CORRECTIONS v3.3.0:
// âœ… CRITIQUE: Ajout paramÃ¨tres initialData et options manquants
// âœ… Signature cohÃ©rente: (eventBus, backend, logger, initialData = {}, options = {})
// âœ… Merge intelligente des options par dÃ©faut
// ============================================================================

class StateModel extends BaseModel {
    constructor(eventBus, backend, logger, initialData = {}, options = {}) {
        // âœ… NOUVEAU: Appel super() avec les 5 paramÃ¨tres
        super(eventBus, backend, logger, initialData, {
            persistKey: 'statemodel',
            eventPrefix: 'state',
            autoPersist: true,
            ...options  // Permet override des options par dÃ©faut
        });
        
        // Initialisation des donnÃ©es d'Ã©tat avec valeurs par dÃ©faut
        this.data.currentPage = this.data.currentPage || 'home';
        this.data.backendConnected = this.data.backendConnected || false;
        this.data.theme = this.data.theme || 'dark';
        this.data.performanceMode = this.data.performanceMode !== undefined ? this.data.performanceMode : true;
        
        this.log('debug', 'StateModel', 'Initialized v3.3.0');
    }
    
    /**
     * DÃ©finit la page courante
     * @param {string} page - Nom de la page
     */
    setCurrentPage(page) {
        this.data.currentPage = page;
        this.emit('page:changed', { page });
    }
    
    /**
     * RÃ©cupÃ¨re la page courante
     * @returns {string}
     */
    getCurrentPage() {
        return this.data.currentPage;
    }
    
    /**
     * DÃ©finit l'Ã©tat de connexion au backend
     * @param {boolean} connected
     */
    setBackendConnected(connected) {
        this.data.backendConnected = connected;
        this.emit('backend:status', { connected });
    }
    
    /**
     * VÃ©rifie si le backend est connectÃ©
     * @returns {boolean}
     */
    isBackendConnected() {
        return this.data.backendConnected;
    }
    
    /**
     * DÃ©finit le thÃ¨me de l'interface
     * @param {string} theme - 'dark' ou 'light'
     */
    setTheme(theme) {
        this.data.theme = theme;
        this.emit('theme:changed', { theme });
    }
    
    /**
     * RÃ©cupÃ¨re le thÃ¨me actuel
     * @returns {string}
     */
    getTheme() {
        return this.data.theme;
    }
    
    /**
     * Active/dÃ©sactive le mode performance
     * @param {boolean} enabled
     */
    setPerformanceMode(enabled) {
        this.data.performanceMode = enabled;
        this.emit('performance:changed', { enabled });
    }
    
    /**
     * VÃ©rifie si le mode performance est actif
     * @returns {boolean}
     */
    isPerformanceModeEnabled() {
        return this.data.performanceMode;
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = StateModel;
}

if (typeof window !== 'undefined') {
    window.StateModel = StateModel;
}