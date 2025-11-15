// ============================================================================
// Fichier: frontend/js/services/StorageService.js
// Version: v3.0.1 - LOGGER PROTECTION
// Date: 2025-10-30
// Projet: midiMind v3.0 - SystÃ¨me d'Orchestration MIDI pour Raspberry Pi
// ============================================================================
// CORRECTIONS v3.0.1:
// âœ… CRITIQUE: Protection complÃ¨te contre logger undefined
// âœ… Fallback sur console si logger non disponible
// âœ… VÃ©rification avant CHAQUE appel logger
// ============================================================================

class StorageService {
    constructor(eventBus, logger) {
        this.eventBus = eventBus || window.eventBus || null;
        this.logger = logger || console;
        
        // PrÃ©fixe pour toutes les clÃ©s
        this.prefix = 'midiMind_';
        
        // Configuration
        this.config = {
            maxStorageSize: 5 * 1024 * 1024, // 5MB
            compressionEnabled: true,
            encryptionEnabled: false,
            autoSave: true,
            autoSaveInterval: 30000, // 30 secondes
            version: '3.0.0'
        };
        
        // Timer d'auto-sauvegarde
        this.autoSaveTimer = null;
        
        // Cache mÃ©moire pour optimisation
        this.memoryCache = new Map();
        
        // Statistiques
        this.stats = {
            reads: 0,
            writes: 0,
            errors: 0,
            storageUsed: 0
        };
        
        this.initialize();
    }
    
    // ========================================================================
    // INITIALISATION
    // ========================================================================
    
    initialize() {
        this.log('info', 'StorageService', 'Initializing storage service...');
        
        // VÃ©rifier la disponibilitÃ© du localStorage
        if (!this.isStorageAvailable()) {
            this.log('error', 'StorageService', 'LocalStorage is not available');
            return;
        }
        
        // Migrer les donnÃ©es si nÃ©cessaire
        this.migrateData();
        
        // Calculer l'espace utilisÃ©
        this.calculateStorageUsage();
        
        // DÃ©marrer l'auto-sauvegarde
        if (this.config.autoSave) {
            this.startAutoSave();
        }
        
        // Ã‰couter les Ã©vÃ©nements
        this.bindEvents();
    }
    
    /**
     * Log sÃ©curisÃ©
     */
    log(level, ...args) {
        if (this.logger && typeof this.logger[level] === 'function') {
            this.logger[level](...args);
        } else {
            console[level]?.(...args) || console.log(...args);
        }
    }
    
    bindEvents() {
        // Sauvegarder avant fermeture de la fenÃªtre
        window.addEventListener('beforeunload', () => {
            this.saveAll();
        });
        
        // Ã‰couter les changements d'Ã©tat importants
        if (this.eventBus) {
            this.eventBus.on('state:changed', (data) => {
                if (this.config.autoSave) {
                    this.saveState(data);
                }
            });
            
            this.eventBus.on('preferences:changed', (data) => {
                this.savePreferences(data);
            });
        }
    }
    
    // ========================================================================
    // OPÃ‰RATIONS DE BASE
    // ========================================================================
    
    /**
     * Sauvegarder une valeur
     */
    save(key, value, options = {}) {
        try {
            const fullKey = this.prefix + key;
            
            // PrÃ©parer les donnÃ©es
            const data = {
                value: value,
                timestamp: Date.now(),
                version: this.config.version,
                compressed: false
            };
            
            // Compression si activÃ©e et donnÃ©es volumineuses
            let serialized = JSON.stringify(data);
            if (this.config.compressionEnabled && serialized.length > 1024) {
                serialized = this.compress(serialized);
                data.compressed = true;
            }
            
            // VÃ©rifier la taille
            if (serialized.length > this.config.maxStorageSize) {
                throw new Error('Data too large for storage');
            }
            
            // Sauvegarder
            localStorage.setItem(fullKey, serialized);
            
            // Mettre Ã  jour le cache mÃ©moire
            this.memoryCache.set(key, value);
            
            this.stats.writes++;
            this.log('debug', 'StorageService', `Saved: ${key}`);
            
            // Ã‰mettre un Ã©vÃ©nement
            if (this.eventBus) {
                this.eventBus.emit('storage:saved', { key, size: serialized.length });
            }
            
            return true;
            
        } catch (error) {
            this.stats.errors++;
            this.log('error', 'StorageService', `Failed to save ${key}:`, error);
            
            // Essayer de libÃ©rer de l'espace si quota dÃ©passÃ©
            if (error.name === 'QuotaExceededError') {
                this.cleanupOldData();
                // RÃ©essayer une fois
                try {
                    localStorage.setItem(this.prefix + key, JSON.stringify(value));
                    return true;
                } catch (retryError) {
                    return false;
                }
            }
            
            return false;
        }
    }
    
    /**
     * Charger une valeur
     */
    load(key, defaultValue = null) {
        try {
            // VÃ©rifier le cache mÃ©moire d'abord
            if (this.memoryCache.has(key)) {
                this.stats.reads++;
                return this.memoryCache.get(key);
            }
            
            const fullKey = this.prefix + key;
            const stored = localStorage.getItem(fullKey);
            
            if (!stored) {
                return defaultValue;
            }
            
            // DÃ©compresser si nÃ©cessaire
            let parsed;
            try {
                parsed = JSON.parse(stored);
            } catch (e) {
                // DonnÃ©es peut-Ãªtre compressÃ©es
                const decompressed = this.decompress(stored);
                parsed = JSON.parse(decompressed);
            }
            
            // VÃ©rifier la version
            if (parsed.version && parsed.version !== this.config.version) {
                this.log('warn', 'StorageService', `Version mismatch for ${key}`);
            }
            
            const value = parsed.value || parsed;
            
            // Mettre en cache
            this.memoryCache.set(key, value);
            
            this.stats.reads++;
            return value;
            
        } catch (error) {
            this.stats.errors++;
            this.log('error', 'StorageService', `Failed to load ${key}:`, error);
            return defaultValue;
        }
    }
    
    /**
     * Supprimer une valeur
     */
    remove(key) {
        try {
            const fullKey = this.prefix + key;
            localStorage.removeItem(fullKey);
            this.memoryCache.delete(key);
            
            this.log('debug', 'StorageService', `Removed: ${key}`);
            return true;
            
        } catch (error) {
            this.log('error', 'StorageService', `Failed to remove ${key}:`, error);
            return false;
        }
    }
    
    /**
     * VÃ©rifier si une clÃ© existe
     */
    exists(key) {
        return localStorage.getItem(this.prefix + key) !== null;
    }
    
    // ========================================================================
    // OPÃ‰RATIONS SPÃ‰CIFIQUES
    // ========================================================================
    
    /**
     * Sauvegarder l'Ã©tat global de l'application
     */
    saveState(state) {
        return this.save('appState', state);
    }
    
    /**
     * Charger l'Ã©tat global de l'application
     */
    loadState() {
        return this.load('appState', {});
    }
    
    /**
     * Sauvegarder les prÃ©fÃ©rences utilisateur
     */
    savePreferences(preferences) {
        return this.save('preferences', preferences);
    }
    
    /**
     * Charger les prÃ©fÃ©rences utilisateur
     */
    loadPreferences() {
        return this.load('preferences', {});
    }
    
    // ========================================================================
    // AUTO-SAUVEGARDE
    // ========================================================================
    
    startAutoSave() {
        if (this.autoSaveTimer) {
            return;
        }
        
        this.autoSaveTimer = setInterval(() => {
            this.autoSave();
        }, this.config.autoSaveInterval);
        
        this.log('info', 'StorageService', 'Auto-save enabled');
    }
    
    stopAutoSave() {
        if (this.autoSaveTimer) {
            clearInterval(this.autoSaveTimer);
            this.autoSaveTimer = null;
        }
    }
    
    autoSave() {
        // Sauvegarder l'Ã©tat actuel si disponible
        if (window.app && window.app.getState) {
            const state = window.app.getState();
            this.saveState(state);
        }
        
        this.log('debug', 'StorageService', 'Auto-save completed');
    }
    
    /**
     * Sauvegarder toutes les donnÃ©es en mÃ©moire
     */
    saveAll() {
        let saved = 0;
        
        for (const [key, value] of this.memoryCache) {
            if (this.save(key, value)) {
                saved++;
            }
        }
        
        this.log('info', 'StorageService', `Saved ${saved} items to storage`);
        return saved;
    }
    
    // ========================================================================
    // COMPRESSION
    // ========================================================================
    
    compress(str) {
        // ImplÃ©mentation simple - pour vraie compression utiliser pako
        return str;
    }
    
    decompress(str) {
        return str;
    }
    
    // ========================================================================
    // GESTION DE L'ESPACE
    // ========================================================================
    
    calculateStorageUsage() {
        let totalSize = 0;
        
        for (let key in localStorage) {
            if (key.startsWith(this.prefix)) {
                const value = localStorage.getItem(key);
                totalSize += key.length + value.length;
            }
        }
        
        this.stats.storageUsed = totalSize;
        return totalSize;
    }
    
    getAvailableSpace() {
        const testKey = this.prefix + '_test_';
        const chunk = 'x'.repeat(1024); // 1KB
        let size = 0;
        
        try {
            while (size < 10 * 1024 * 1024) { // Max 10MB test
                localStorage.setItem(testKey + size, chunk);
                size += 1024;
            }
        } catch (e) {
            // Quota atteint
        }
        
        // Nettoyer
        for (let i = 0; i < size; i += 1024) {
            localStorage.removeItem(testKey + i);
        }
        
        return size;
    }
    
    cleanupOldData() {
        const items = [];
        
        // Collecter tous les items avec timestamp
        for (let key in localStorage) {
            if (key.startsWith(this.prefix)) {
                try {
                    const value = localStorage.getItem(key);
                    const parsed = JSON.parse(value);
                    if (parsed.timestamp) {
                        items.push({
                            key: key,
                            timestamp: parsed.timestamp,
                            size: value.length
                        });
                    }
                } catch (e) {
                    // Ignorer les erreurs de parsing
                }
            }
        }
        
        // Trier par anciennetÃ©
        items.sort((a, b) => a.timestamp - b.timestamp);
        
        // Supprimer les 25% plus anciens
        const toRemove = Math.floor(items.length * 0.25);
        for (let i = 0; i < toRemove; i++) {
            localStorage.removeItem(items[i].key);
        }
        
        this.log('info', 'StorageService', `Cleaned up ${toRemove} old items`);
    }
    
    // ========================================================================
    // MIGRATION
    // ========================================================================
    
    migrateData() {
        const versionKey = this.prefix + 'version';
        const currentVersion = localStorage.getItem(versionKey);
        
        if (!currentVersion) {
            // PremiÃ¨re installation
            localStorage.setItem(versionKey, this.config.version);
            return;
        }
        
        if (currentVersion !== this.config.version) {
            this.log('info', 'StorageService', `Migrating from ${currentVersion} to ${this.config.version}`);
            
            // Logique de migration selon les versions
            // ...
            
            localStorage.setItem(versionKey, this.config.version);
        }
    }
    
    // ========================================================================
    // UTILITAIRES
    // ========================================================================
    
    isStorageAvailable() {
        try {
            const test = '__storage_test__';
            localStorage.setItem(test, test);
            localStorage.removeItem(test);
            return true;
        } catch (e) {
            return false;
        }
    }
    
    clearAll() {
        const keys = [];
        
        for (let key in localStorage) {
            if (key.startsWith(this.prefix)) {
                keys.push(key);
            }
        }
        
        for (const key of keys) {
            localStorage.removeItem(key);
        }
        
        this.memoryCache.clear();
        
        this.log('info', 'StorageService', 'All data cleared');
    }
    
    exportAll() {
        const data = {};
        
        for (let key in localStorage) {
            if (key.startsWith(this.prefix)) {
                const cleanKey = key.substring(this.prefix.length);
                data[cleanKey] = this.load(cleanKey);
            }
        }
        
        return data;
    }
    
    importAll(data) {
        for (const [key, value] of Object.entries(data)) {
            this.save(key, value);
        }
        
        this.log('info', 'StorageService', `Imported ${Object.keys(data).length} items`);
    }
    
    getStats() {
        return {
            ...this.stats,
            cacheSize: this.memoryCache.size,
            storageUsedMB: (this.stats.storageUsed / (1024 * 1024)).toFixed(2)
        };
    }
}

// ============================================================================
// EXPORT
// ============================================================================

if (typeof module !== 'undefined' && module.exports) {
    module.exports = StorageService;
}

if (typeof window !== 'undefined') {
    window.StorageService = StorageService;
}