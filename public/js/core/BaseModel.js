// ============================================================================
// Fichier: frontend/js/core/BaseModel.js
// Chemin réel: frontend/js/core/BaseModel.js
// Version: v3.3.0 - EVENTBUS FALLBACK FIX
// Date: 2025-11-05
// ============================================================================
// CORRECTIONS v3.3.0:
// ✅ CRITIQUE: Fallback EventBus minimal au lieu de null
// ✅ Prévention des erreurs "Cannot read property 'emit' of null"
// ✅ Mode dégradé gracieux si EventBus manquant
//
// CORRECTIONS v3.2.0:
// ✓ CRITIQUE: Signature cohérente (eventBus, backend, logger, initialData, options)
// ✓ Support backward compatible (initialData, options)
// ✓ Fallbacks robustes pour tous les services
// ============================================================================

class BaseModel {
    constructor(eventBus, backend, logger, initialData = {}, options = {}) {
        // Support backward compatible
        if (eventBus && typeof eventBus === 'object' && !eventBus.emit) {
            // Ancien style: BaseModel(initialData, options)
            options = backend || {};
            initialData = eventBus;
            logger = null;
            backend = null;
            eventBus = null;
        }
        
        // ✅ CORRECTION v3.3.0: Services avec fallbacks
        this.eventBus = eventBus || window.eventBus;
        
        // ✅ CRITIQUE: Si EventBus toujours absent, créer fallback minimal
        if (!this.eventBus) {
            console.warn(
                `[${this.constructor.name}] EventBus not found - creating minimal fallback. ` +
                `Check that EventBus is initialized in main.js before Application.`
            );
            
            // Créer un EventBus minimal fonctionnel
            this.eventBus = {
                on: () => () => {},      // Retourne une fonction de désinscription vide
                once: () => () => {},    // Retourne une fonction de désinscription vide
                emit: () => {},          // Ne fait rien
                off: () => {},           // Ne fait rien
                _isFallback: true        // Marqueur pour identification
            };
        }
        
        // Backend et Logger avec fallbacks
        this.backend = backend || window.backendService || window.app?.services?.backend || null;
        this.logger = logger || this.createFallbackLogger();
        
        // Données du modèle
        this.data = { ...initialData };
        
        // Métadonnées
        this.meta = {
            initialized: false,
            dirty: false,
            lastModified: null,
            version: 1,
            errors: {}
        };
        
        // Configuration
        this.config = {
            autoPersist: options.autoPersist !== false,
            persistKey: options.persistKey || this.constructor.name.toLowerCase(),
            storageType: options.storageType || 'localStorage',
            validateOnSet: options.validateOnSet !== false,
            eventPrefix: options.eventPrefix || this.constructor.name.toLowerCase(),
            debounceMs: options.debounceMs || 300,
            ...options
        };
        
        // Règles de validation
        this.validationRules = {};
        
        // Historique
        this.history = {
            past: [],
            future: [],
            maxSize: options.historyMaxSize || 50
        };
        
        // Timers
        this._persistTimer = null;
        this._validationTimer = null;
        
        this.log('debug', `${this.constructor.name}`, 'Model created');
    }
    
    createFallbackLogger() {
        if (window.logger && typeof window.logger.log === 'function') {
            return window.logger;
        }
        
        return {
            log: (level, ...args) => console.log(`[${level.toUpperCase()}]`, ...args),
            debug: (...args) => console.log('[DEBUG]', ...args),
            info: (...args) => console.log('[INFO]', ...args),
            warn: (...args) => console.warn('[WARN]', ...args),
            error: (...args) => console.error('[ERROR]', ...args)
        };
    }
    
    // ========================================================================
    // GESTION DES DONNÉES
    // ========================================================================
    
    get(path, defaultValue = null) {
        if (!path) return this.data;
        
        const keys = path.split('.');
        let value = this.data;
        
        for (const key of keys) {
            if (value && typeof value === 'object' && key in value) {
                value = value[key];
            } else {
                return defaultValue;
            }
        }
        
        return value !== undefined ? value : defaultValue;
    }
    
    set(path, value, options = {}) {
        if (!path) {
            this.log('warn', 'BaseModel.set', 'Path required');
            return false;
        }
        
        const keys = path.split('.');
        const lastKey = keys.pop();
        let target = this.data;
        
        for (const key of keys) {
            if (!(key in target)) {
                target[key] = {};
            }
            target = target[key];
        }
        
        const oldValue = target[lastKey];
        
        if (this.config.validateOnSet && !options.skipValidation) {
            const error = this.validateField(path, value);
            if (error) {
                this.log('warn', 'BaseModel.set', `Validation error for ${path}: ${error}`);
                return false;
            }
        }
        
        target[lastKey] = value;
        
        if (oldValue !== value) {
            this.markDirty();
            this.updateHistory('set', path, { oldValue, newValue: value });
            this.emit('changed', { path, value, oldValue });
            this.emit(`changed:${path}`, { value, oldValue });
            
            if (this.config.autoPersist) {
                this.debouncePersist();
            }
        }
        
        return true;
    }
    
    delete(path) {
        if (!path) return false;
        
        const keys = path.split('.');
        const lastKey = keys.pop();
        let target = this.data;
        
        for (const key of keys) {
            if (!(key in target)) return false;
            target = target[key];
        }
        
        if (!(lastKey in target)) return false;
        
        const oldValue = target[lastKey];
        delete target[lastKey];
        
        this.markDirty();
        this.updateHistory('delete', path, { oldValue });
        this.emit('changed', { path, deleted: true, oldValue });
        this.emit(`deleted:${path}`, { oldValue });
        
        if (this.config.autoPersist) {
            this.debouncePersist();
        }
        
        return true;
    }
    
    reset(data = {}) {
        const oldData = { ...this.data };
        this.data = { ...data };
        
        this.markDirty();
        this.emit('reset', { oldData, newData: this.data });
        
        if (this.config.autoPersist) {
            this.debouncePersist();
        }
    }
    
    // ========================================================================
    // VALIDATION
    // ========================================================================
    
    validateField(field, value) {
        const rule = this.validationRules[field];
        if (!rule) return null;
        
        if (rule.required && (value === null || value === undefined || value === '')) {
            return `${field} is required`;
        }
        
        if (rule.type && typeof value !== rule.type) {
            return `${field} must be of type ${rule.type}`;
        }
        
        if (rule.min !== undefined && value < rule.min) {
            return `${field} must be >= ${rule.min}`;
        }
        
        if (rule.max !== undefined && value > rule.max) {
            return `${field} must be <= ${rule.max}`;
        }
        
        if (rule.pattern && !rule.pattern.test(value)) {
            return `${field} format is invalid`;
        }
        
        if (rule.custom && typeof rule.custom === 'function') {
            const error = rule.custom(value);
            if (error) return error;
        }
        
        return null;
    }
    
    validate() {
        const errors = {};
        
        for (const field in this.validationRules) {
            const value = this.get(field);
            const error = this.validateField(field, value);
            
            if (error) {
                errors[field] = error;
            }
        }
        
        this.meta.errors = errors;
        
        return Object.keys(errors).length === 0;
    }
    
    // ========================================================================
    // PERSISTENCE
    // ========================================================================
    
    persist() {
        if (!this.config.autoPersist) return;
        
        try {
            const key = this.config.persistKey;
            const data = this.serialize();
            
            if (this.config.storageType === 'localStorage') {
                localStorage.setItem(key, JSON.stringify(data));
            } else if (this.config.storageType === 'sessionStorage') {
                sessionStorage.setItem(key, JSON.stringify(data));
            }
            
            this.meta.dirty = false;
            this.log('debug', 'BaseModel.persist', `Persisted to ${key}`);
            
        } catch (error) {
            this.log('error', 'BaseModel.persist', 'Failed to persist:', error);
        }
    }
    
    load() {
        try {
            const key = this.config.persistKey;
            let data = null;
            
            if (this.config.storageType === 'localStorage') {
                data = localStorage.getItem(key);
            } else if (this.config.storageType === 'sessionStorage') {
                data = sessionStorage.getItem(key);
            }
            
            if (data) {
                this.deserialize(JSON.parse(data));
                this.log('debug', 'BaseModel.load', `Loaded from ${key}`);
                return true;
            }
            
        } catch (error) {
            this.log('error', 'BaseModel.load', 'Failed to load:', error);
        }
        
        return false;
    }
    
    debouncePersist() {
        clearTimeout(this._persistTimer);
        this._persistTimer = setTimeout(() => {
            this.persist();
        }, this.config.debounceMs);
    }
    
    serialize() {
        return {
            data: this.data,
            meta: {
                version: this.meta.version,
                lastModified: this.meta.lastModified
            }
        };
    }
    
    deserialize(serialized) {
        if (serialized.data) {
            this.data = serialized.data;
        }
        
        if (serialized.meta) {
            this.meta.version = serialized.meta.version || 1;
            this.meta.lastModified = serialized.meta.lastModified;
        }
        
        this.meta.initialized = true;
    }
    
    // ========================================================================
    // HISTORIQUE
    // ========================================================================
    
    updateHistory(action, path, details) {
        this.history.past.push({
            action,
            path,
            details,
            timestamp: Date.now()
        });
        
        if (this.history.past.length > this.history.maxSize) {
            this.history.past.shift();
        }
        
        this.history.future = [];
    }
    
    undo() {
        if (this.history.past.length === 0) return false;
        
        const entry = this.history.past.pop();
        this.history.future.push(entry);
        
        if (entry.action === 'set' && entry.details.oldValue !== undefined) {
            this.set(entry.path, entry.details.oldValue, { skipHistory: true });
        } else if (entry.action === 'delete' && entry.details.oldValue !== undefined) {
            this.set(entry.path, entry.details.oldValue, { skipHistory: true });
        }
        
        this.emit('undo', entry);
        return true;
    }
    
    redo() {
        if (this.history.future.length === 0) return false;
        
        const entry = this.history.future.pop();
        this.history.past.push(entry);
        
        if (entry.action === 'set') {
            this.set(entry.path, entry.details.newValue, { skipHistory: true });
        } else if (entry.action === 'delete') {
            this.delete(entry.path);
        }
        
        this.emit('redo', entry);
        return true;
    }
    
    // ========================================================================
    // UTILITAIRES
    // ========================================================================
    
    markDirty() {
        this.meta.dirty = true;
        this.meta.lastModified = Date.now();
    }
    
    log(level, ...args) {
        if (this.logger && typeof this.logger[level] === 'function') {
            this.logger[level](...args);
        }
    }
    
    on(event, callback) {
        if (this.eventBus && !this.eventBus._isFallback) {
            this.eventBus.on(`${this.config.eventPrefix}:${event}`, callback);
        }
    }
    
    once(event, callback) {
        if (this.eventBus && !this.eventBus._isFallback) {
            this.eventBus.once(`${this.config.eventPrefix}:${event}`, callback);
        }
    }
    
    off(event, callback) {
        if (this.eventBus && !this.eventBus._isFallback) {
            this.eventBus.off(`${this.config.eventPrefix}:${event}`, callback);
        }
    }
    
    emit(event, data) {
        if (this.eventBus && !this.eventBus._isFallback) {
            this.eventBus.emit(`${this.config.eventPrefix}:${event}`, data);
        }
    }
    
    toJSON() {
        return this.serialize();
    }
    
    toString() {
        return JSON.stringify(this.data, null, 2);
    }
    
    clone() {
        const ModelClass = this.constructor;
        return new ModelClass(this.eventBus, this.backend, this.logger, { ...this.data }, { ...this.config });
    }
    
    destroy() {
        clearTimeout(this._persistTimer);
        clearTimeout(this._validationTimer);
        
        if (this.meta.dirty && this.config.autoPersist) {
            this.persist();
        }
        
        this.log('debug', `${this.constructor.name}`, 'Model destroyed');
    }
}

// ============================================================================
// EXPORT
// ============================================================================

if (typeof module !== 'undefined' && module.exports) {
    module.exports = BaseModel;
}

if (typeof window !== 'undefined') {
    window.BaseModel = BaseModel;
}