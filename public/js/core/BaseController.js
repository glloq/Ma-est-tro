/* ======================================================================================
   CONTRÔLEUR DE BASE - PATTERN CONTROLLER DU MVC
   ======================================================================================
   Fichier: frontend/js/core/BaseController.js
   Version: v3.5.0 - BACKEND NULL SAFETY
   Date: 2025-11-04
   ======================================================================================
   CORRECTIONS v3.5.0:
   ✦ CRITIQUE: Ajout méthode ensureBackendAvailable() pour vérification backend
   ✦ CRITIQUE: Ajout méthode isBackendReady() pour check état connexion
   ✦ Protection complète contre backend null/undefined
   ✦ Gestion mode offline avec messages appropriés
   
   CORRECTIONS v3.4.0:
   ✦ CRITIQUE: Ajout paramètre backend au constructeur
   ✦ CRITIQUE: this.backend initialisé avec fallback window.backendService
   ✦ Protection contre backend null
   ✦ Signature cohérente pour tous les contrôleurs
   ====================================================================================== */

class BaseController {
    constructor(eventBus, models = {}, views = {}, notifications = null, debugConsole = null, backend = null) {
        // ✦ CRITIQUE: EventBus avec fallback robuste
        this.eventBus = eventBus || window.eventBus || null;
        
        // Validation EventBus
        if (!this.eventBus) {
            console.error(`[${this.constructor.name}] CRITIQUE: EventBus non disponible!`);
            // Créer un fallback minimal pour éviter les crashes
            this.eventBus = {
                on: () => () => {},
                once: () => () => {},
                emit: () => {},
                off: () => {}
            };
        }
        
        // ✦ CRITIQUE: Backend avec fallback robuste
        this.backend = backend || window.backendService || window.app?.services?.backend || null;
        
        // Validation Backend (warning seulement, pas d'erreur critique)
        if (!this.backend) {
            console.warn(`[${this.constructor.name}] Backend service not available - offline mode`);
        }
        
        // Références aux composants principaux
        this.models = models;
        this.views = views;
        this.notifications = notifications;
        this.debugConsole = debugConsole;
        
        // État du contrôleur
        this.state = {
            isInitialized: false,
            isActive: false,
            isDestroyed: false,
            lastAction: null,
            errors: []
        };
        
        // Configuration
        this.config = {
            autoInitialize: true,
            handleErrors: true,
            logActions: true,
            validateInputs: true,
            debounceActions: {},
            cacheTTL: 5 * 60 * 1000 // 5 minutes
        };
        
        // Gestion des événements
        this.eventSubscriptions = [];
        this.actionQueue = [];
        
        // Métriques et monitoring
        this.metrics = {
            actionsExecuted: 0,
            errorsHandled: 0,
            notificationsSent: 0,
            startTime: Date.now()
        };
        
        // Cache pour optimisation
        this.cache = new Map();
        this.cacheTimestamps = new Map();
        this._lastCacheClean = null;
		
        // Validateurs d'entrée
        this.validators = {};
        
        // Actions debouncées
        this.debouncedActions = new Map();
        
        // Initialisation automatique si configurée
        if (this.config.autoInitialize) {
            this.initialize();
        }
    }

    /**
     * ✦ NOUVEAU v3.5.0: Vérifie si le backend est disponible et connecté
     * @returns {boolean} true si backend disponible et prêt
     */
    isBackendReady() {
        if (!this.backend) {
            return false;
        }
        
        // Vérifier si le backend a une méthode isConnected
        if (typeof this.backend.isConnected === 'function') {
            return this.backend.isConnected();
        }
        
        // Vérifier si le backend a une propriété connected
        if (this.backend.connected !== undefined) {
            return this.backend.connected;
        }
        
        // Si pas de méthode de vérification, considérer comme prêt si existe
        return true;
    }

    /**
     * ✦ NOUVEAU v3.5.0: S'assure que le backend est disponible
     * Lance une erreur appropriée si backend non disponible
     * @param {string} operation - Nom de l'opération qui nécessite le backend
     * @throws {Error} Si backend non disponible
     */
    ensureBackendAvailable(operation = 'operation') {
        if (!this.backend) {
            const error = new Error(`Backend not available - cannot perform ${operation} (offline mode)`);
            error.code = 'BACKEND_NOT_AVAILABLE';
            error.offline = true;
            throw error;
        }
        
        if (!this.isBackendReady()) {
            const error = new Error(`Backend not connected - cannot perform ${operation}`);
            error.code = 'BACKEND_NOT_CONNECTED';
            error.offline = true;
            throw error;
        }
    }

    /**
     * ✦ NOUVEAU v3.5.0: Exécute une opération backend avec gestion d'erreur
     * @param {Function} operation - Fonction async qui utilise le backend
     * @param {string} operationName - Nom de l'opération pour les logs
     * @param {*} defaultValue - Valeur par défaut si backend non disponible
     * @returns {Promise<*>} Résultat de l'opération ou defaultValue
     */
    async withBackend(operation, operationName = 'operation', defaultValue = null) {
        try {
            this.ensureBackendAvailable(operationName);
            return await operation();
        } catch (error) {
            if (error.offline) {
                this.log('warn', this.constructor.name, `${operationName} skipped - offline mode`);
                return defaultValue;
            }
            throw error;
        }
    }

    /**
     * Initialisation du contrôleur
     */
    initialize() {
        if (this.state.isInitialized) {
            this.log('warn', this.constructor.name, 'Already initialized');
            return;
        }
        
        try {
            this.log('info', this.constructor.name, 'Initializing...');
            
            // Hook pour initialisation personnalisée
            if (typeof this.onInitialize === 'function') {
                this.onInitialize();
            }
            
            this.state.isInitialized = true;
            this.log('info', this.constructor.name, '✓ Initialized');
            
        } catch (error) {
            this.handleError('Initialization failed', error);
        }
    }

    /**
     * Active le contrôleur
     */
    activate() {
        if (this.state.isDestroyed) {
            this.log('error', this.constructor.name, 'Cannot activate - destroyed');
            return;
        }
        
        if (this.state.isActive) {
            return;
        }
        
        this.state.isActive = true;
        
        // Hook pour activation personnalisée
        if (typeof this.onActivate === 'function') {
            this.onActivate();
        }
        
        this.log('info', this.constructor.name, 'Activated');
    }

    /**
     * Désactive le contrôleur
     */
    deactivate() {
        if (!this.state.isActive) {
            return;
        }
        
        this.state.isActive = false;
        
        // Hook pour désactivation personnalisée
        if (typeof this.onDeactivate === 'function') {
            this.onDeactivate();
        }
        
        this.log('info', this.constructor.name, 'Deactivated');
    }

    /**
     * Gestion d'erreur unifiée
     */
    handleError(context, error, showNotification = true) {
        this.metrics.errorsHandled++;
        this.state.errors.push({
            context,
            error,
            timestamp: Date.now()
        });
        
        // Log
        this.log('error', this.constructor.name, context, error);
        
        // Notification si activée
        if (showNotification && this.notifications) {
            const message = error.message || 'An error occurred';
            this.notifications.show(`${context}: ${message}`, 'error', 5000);
            this.metrics.notificationsSent++;
        }
        
        // Événement
        if (this.eventBus) {
            this.eventBus.emit('controller:error', {
                controller: this.constructor.name,
                context,
                error
            });
        }
        
        // Hook personnalisé
        if (typeof this.onError === 'function') {
            this.onError(context, error);
        }
    }

    /**
     * Log helper
     */
    log(level, source, ...args) {
        const prefix = `[${source}]`;
        
        // Essayer debugConsole si la méthode existe
        if (this.debugConsole && typeof this.debugConsole[level] === 'function') {
            this.debugConsole[level](prefix, ...args);
        } 
        // Sinon essayer window.logger si la méthode existe
        else if (window.logger && typeof window.logger[level] === 'function') {
            window.logger[level](prefix, ...args);
        } 
        // Fallback sur console standard
        else if (typeof console[level] === 'function') {
            console[level](prefix, ...args);
        } else {
            // Dernier recours : console.log
            console.log(prefix, ...args);
        }
    }

    /**
     * Méthodes de logging raccourcies
     */
    logDebug(...args) {
        this.log('debug', this.constructor.name, ...args);
    }

    logInfo(...args) {
        this.log('info', this.constructor.name, ...args);
    }

    logWarn(...args) {
        this.log('warn', this.constructor.name, ...args);
    }

    logError(...args) {
        this.log('error', this.constructor.name, ...args);
    }

    /**
     * Validation d'entrée
     */
    validate(data, validatorName) {
        if (!this.config.validateInputs) {
            return { valid: true };
        }
        
        const validator = this.validators[validatorName];
        if (!validator) {
            this.log('warn', this.constructor.name, `No validator found: ${validatorName}`);
            return { valid: true };
        }
        
        return validator(data);
    }

    /**
     * Émission d'événement
     */
    emit(eventName, data = {}) {
        if (!this.eventBus) return;
        
        const enrichedData = {
            ...data,
            source: this.constructor.name,
            timestamp: Date.now()
        };
        
        this.eventBus.emit(eventName, enrichedData);
    }

    /**
     * Abonnement à événement
     */
    on(eventName, handler) {
        if (!this.eventBus) return () => {};
        
        const unsubscribe = this.eventBus.on(eventName, handler);
        this.eventSubscriptions.push({ eventName, unsubscribe });
        
        return unsubscribe;
    }

    /**
     * Cache management
     */
    getCached(key) {
        const timestamp = this.cacheTimestamps.get(key);
        if (!timestamp || Date.now() - timestamp > this.config.cacheTTL) {
            return null;
        }
        return this.cache.get(key);
    }

    setCached(key, value) {
        this.cache.set(key, value);
        this.cacheTimestamps.set(key, Date.now());
        
        // Nettoyage périodique
        this.cleanCache();
    }

    cleanCache() {
        const now = Date.now();
        
        // Nettoyer seulement toutes les 60 secondes max
        if (this._lastCacheClean && now - this._lastCacheClean < 60000) {
            return;
        }
        
        this._lastCacheClean = now;
        
        for (const [key, timestamp] of this.cacheTimestamps.entries()) {
            if (now - timestamp > this.config.cacheTTL) {
                this.cache.delete(key);
                this.cacheTimestamps.delete(key);
            }
        }
    }

    clearCache() {
        this.cache.clear();
        this.cacheTimestamps.clear();
    }

    /**
     * Notification helper
     */
    notify(message, type = 'info', duration = 3000) {
        if (this.notifications) {
            this.notifications.show(message, type, duration);
            this.metrics.notificationsSent++;
        }
    }

    /**
     * Debounce helper
     */
    debounce(actionName, delay = 300) {
        if (this.debouncedActions.has(actionName)) {
            clearTimeout(this.debouncedActions.get(actionName));
        }
        
        return new Promise((resolve) => {
            const timeout = setTimeout(() => {
                this.debouncedActions.delete(actionName);
                resolve();
            }, delay);
            
            this.debouncedActions.set(actionName, timeout);
        });
    }

    /**
     * Métriques
     */
    getMetrics() {
        return {
            ...this.metrics,
            uptime: Date.now() - this.metrics.startTime,
            cacheSize: this.cache.size,
            subscriptions: this.eventSubscriptions.length
        };
    }

    /**
     * Destruction
     */
    destroy() {
        if (this.state.isDestroyed) {
            return;
        }
        
        this.log('info', this.constructor.name, 'Destroying...');
        
        // Désabonner tous les événements
        this.eventSubscriptions.forEach(({ unsubscribe }) => {
            if (typeof unsubscribe === 'function') {
                unsubscribe();
            }
        });
        this.eventSubscriptions = [];
        
        // Nettoyer les timers debounce
        this.debouncedActions.forEach((timeout) => clearTimeout(timeout));
        this.debouncedActions.clear();
        
        // Vider le cache
        this.clearCache();
        
        // Hook personnalisé
        if (typeof this.onDestroy === 'function') {
            this.onDestroy();
        }
        
        this.state.isDestroyed = true;
        this.state.isActive = false;
        
        this.log('info', this.constructor.name, '✓ Destroyed');
    }
}

// ============================================================================
// EXPORT
// ============================================================================

if (typeof module !== 'undefined' && module.exports) {
    module.exports = BaseController;
}

window.BaseController = BaseController;