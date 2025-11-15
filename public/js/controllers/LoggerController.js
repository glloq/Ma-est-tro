// ============================================================================
// Fichier: frontend/js/controllers/LoggerController.js
// Chemin réel: frontend/js/controllers/LoggerController.js
// Version: v1.1.0 - SIGNATURE CORRIGÉE
// Date: 2025-11-11
// ============================================================================
// CORRECTIONS v1.1.0:
// ✅ CRITIQUE: Signature constructor cohérente avec BaseController
// ✅ Appel super() avec paramètre backend correct
// ✅ Correction méthodes inexistantes (executeAction, subscribe, emitEvent)
// ✅ Utilisation API standard BaseController
//
// FONCTIONNALITÉS v1.0.0:
// - Configuration niveau de log backend (DEBUG, INFO, WARNING, ERROR, CRITICAL)
// - Synchronisation avec Logger frontend
// - Interface de sélection du niveau
// - Gestion événements via EventBus
// ============================================================================

class LoggerController extends BaseController {
    constructor(eventBus, models = {}, views = {}, notifications = null, debugConsole = null, backend = null) {
        // ✅ CORRECTION: Appel super() avec TOUS les paramètres (backend inclus)
        super(eventBus, models, views, notifications, debugConsole, backend);
        
        // Logger frontend (référence locale)
        this.logger = window.logger || console;
        
        // État du logger
        this.loggerState = {
            backendLevel: 'INFO',
            frontendLevel: 'INFO',
            availableLevels: ['DEBUG', 'INFO', 'WARNING', 'ERROR', 'CRITICAL']
        };
        
        // Configuration
        this.config.syncWithFrontend = true;
    }
    
    /**
     * Initialisation personnalisée
     * ✅ Hook standard BaseController
     */
    onInitialize() {
        this.logInfo('LoggerController initializing v1.1.0...');
        
        // Attacher événements
        this.bindEvents();
        
        // Charger le niveau actuel si backend disponible
        if (this.isBackendReady()) {
            this.loadBackendLogLevel();
        }
    }
    
    /**
     * Liaison des événements
     * ✅ Utilise this.on() de BaseController au lieu de subscribe()
     */
    bindEvents() {
        // Événements de l'interface
        this.on('logger:set-level', (data) => this.setLogLevel(data.level));
        this.on('logger:get-level', () => this.loadBackendLogLevel());
        this.on('logger:sync-frontend', (data) => this.syncFrontendLevel(data.level));
        
        // Événements backend
        this.on('backend:connected', () => {
            this.loadBackendLogLevel();
        });
    }
    
    /**
     * Charge le niveau de log actuel du backend
     * ✅ API v4.2.2: logger.getLevel
     */
    async loadBackendLogLevel() {
        if (!this.isBackendReady()) {
            this.logWarn('Backend not available - cannot load log level');
            return null;
        }
        
        try {
            this.logInfo('Loading backend log level...');
            
            const response = await this.backend.sendCommand('logger.getLevel', {});
            const data = response.data || response;
            
            if (data && data.level) {
                this.loggerState.backendLevel = data.level;
                
                this.logInfo(`Backend log level loaded: ${this.loggerState.backendLevel}`);
                
                // ✅ Utilise this.emit() au lieu de emitEvent()
                this.emit('logger:level:loaded', {
                    level: this.loggerState.backendLevel
                });
                
                // Synchroniser avec le frontend si configuré
                if (this.config.syncWithFrontend) {
                    this.syncFrontendLevel(this.loggerState.backendLevel);
                }
                
                return data;
            }
            
            return null;
        } catch (error) {
            this.handleError('Erreur lors du chargement du niveau de log', error);
            return null;
        }
    }
    
    /**
     * Définit le niveau de log du backend
     * ✅ API v4.2.2: logger.setLevel
     */
    async setLogLevel(level) {
        if (!this.isBackendReady()) {
            this.notify('Backend non disponible - mode offline', 'warning');
            return false;
        }
        
        try {
            // Valider le niveau
            if (!this.loggerState.availableLevels.includes(level)) {
                throw new Error(`Niveau de log invalide: ${level}`);
            }
            
            this.logInfo(`Setting backend log level to ${level}`);
            
            const response = await this.backend.sendCommand('logger.setLevel', {
                level: level
            });
            const data = response.data || response;
            
            if (data && data.success !== false) {
                this.loggerState.backendLevel = level;
                
                this.notify(
                    `Niveau de log backend défini à ${level}`,
                    'success',
                    3000
                );
                
                // ✅ Utilise this.emit() au lieu de emitEvent()
                this.emit('logger:level:updated', {
                    level: level
                });
                
                // Synchroniser avec le frontend si configuré
                if (this.config.syncWithFrontend) {
                    this.syncFrontendLevel(level);
                }
                
                return true;
            }
            
            return false;
        } catch (error) {
            this.handleError(`Erreur lors de la définition du niveau de log à ${level}`, error);
            return false;
        }
    }
    
    /**
     * Synchronise le niveau de log avec le Logger frontend
     */
    syncFrontendLevel(level) {
        this.loggerState.frontendLevel = level;
        
        // Si un Logger frontend est disponible, le synchroniser
        if (this.logger && typeof this.logger.setLevel === 'function') {
            this.logger.setLevel(level);
            this.logInfo(`Frontend log level synchronized to ${level}`);
        }
        
        // Si window.logger global existe
        if (typeof window !== 'undefined' && window.logger && typeof window.logger.setLevel === 'function') {
            window.logger.setLevel(level);
            this.logInfo(`Global Logger level synchronized to ${level}`);
        }
        
        // ✅ Utilise this.emit() au lieu de emitEvent()
        this.emit('logger:frontend:synced', {
            level: level
        });
    }
    
    /**
     * Obtient les niveaux de log disponibles
     */
    getAvailableLevels() {
        return [...this.loggerState.availableLevels];
    }
    
    /**
     * Obtient le niveau de log actuel
     */
    getCurrentLevel() {
        return {
            backend: this.loggerState.backendLevel,
            frontend: this.loggerState.frontendLevel
        };
    }
    
    /**
     * Vérifie si un niveau de log est valide
     */
    isValidLevel(level) {
        return this.loggerState.availableLevels.includes(level);
    }
    
    /**
     * Obtient la priorité numérique d'un niveau
     */
    getLevelPriority(level) {
        const priorities = {
            'DEBUG': 0,
            'INFO': 1,
            'WARNING': 2,
            'ERROR': 3,
            'CRITICAL': 4
        };
        
        return priorities[level] !== undefined ? priorities[level] : 1;
    }
    
    /**
     * Compare deux niveaux de log
     */
    compareLevels(level1, level2) {
        return this.getLevelPriority(level1) - this.getLevelPriority(level2);
    }
    
    /**
     * Active le mode debug (raccourci)
     */
    async enableDebugMode() {
        return this.setLogLevel('DEBUG');
    }
    
    /**
     * Désactive le mode debug (raccourci)
     */
    async disableDebugMode() {
        return this.setLogLevel('INFO');
    }
    
    /**
     * Obtenir l'état actuel
     */
    getLoggerState() {
        return {
            ...this.loggerState,
            isDebugMode: this.loggerState.backendLevel === 'DEBUG',
            backendAvailable: this.isBackendReady()
        };
    }
    
    /**
     * Crée une interface UI simple pour le changement de niveau
     */
    createLevelSelectorUI(containerId) {
        const container = document.getElementById(containerId);
        if (!container) {
            this.logError(`Container ${containerId} not found`);
            return;
        }
        
        const html = `
            <div class="logger-level-selector">
                <label for="log-level-select">Niveau de Log Backend:</label>
                <select id="log-level-select" class="form-control">
                    ${this.loggerState.availableLevels.map(level => `
                        <option value="${level}" ${level === this.loggerState.backendLevel ? 'selected' : ''}>
                            ${level}
                        </option>
                    `).join('')}
                </select>
                <button id="apply-log-level" class="btn btn-primary">Appliquer</button>
            </div>
        `;
        
        container.innerHTML = html;
        
        // Attacher les événements
        const select = document.getElementById('log-level-select');
        const button = document.getElementById('apply-log-level');
        
        if (button) {
            button.addEventListener('click', () => {
                const level = select.value;
                this.setLogLevel(level);
            });
        }
        
        // Mettre à jour le sélecteur quand le niveau change
        this.on('logger:level:updated', (data) => {
            if (select) {
                select.value = data.level;
            }
        });
    }
    
    /**
     * Hook de destruction personnalisée
     * ✅ Appelé par BaseController.destroy()
     */
    onDestroy() {
        this.logInfo('LoggerController destroying...');
        // Nettoyage spécifique si nécessaire
    }
}

// ============================================================================
// EXPORT
// ============================================================================

if (typeof module !== 'undefined' && module.exports) {
    module.exports = LoggerController;
}

if (typeof window !== 'undefined') {
    window.LoggerController = LoggerController;
}