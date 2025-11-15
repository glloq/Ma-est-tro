// ============================================================================
// Fichier: frontend/js/utils/Logger.js
// Projet: MidiMind v3.0 - Système d'Orchestration MIDI pour Raspberry Pi
// Version: 3.0.2 - FIXED CRITICAL GLOBAL EXPOSURE BUG
// Date: 2025-11-11
// ============================================================================
// CORRECTIONS v3.0.2:
// ✅ CRITIQUE: window.Logger au lieu de window.logger (ligne 164)
// ✅ Suppression doublon ligne 167
// ✅ Encodage UTF-8 corrigé (é, è, à, etc.)
// ✅ Émojis correctement affichés (✓, ✅, etc.)
// ============================================================================
// CORRECTIONS v3.0.1:
// ✅ Exposition globale explicite de la classe Logger
// ✅ Vérification de disponibilité window
// ============================================================================

class Logger {
    static LEVELS = {
        DEBUG: 0,
        INFO: 1,
        WARN: 2,
        ERROR: 3,
        NONE: 4
    };
    
    static LEVEL_NAMES = ['DEBUG', 'INFO', 'WARN', 'ERROR', 'NONE'];
    
    static LEVEL_COLORS = {
        DEBUG: '#6c757d',
        INFO: '#007bff',
        WARN: '#ffc107',
        ERROR: '#dc3545'
    };
    
    constructor(config = {}) {
        this.config = {
            level: config.level || 'info',
            enableConsole: config.enableConsole !== false,
            enableEventBus: config.enableEventBus !== false,
            maxHistorySize: config.maxHistorySize || 1000,
            timestampFormat: config.timestampFormat || 'HH:mm:ss.SSS'
        };
        
        this.eventBus = config.eventBus || window.eventBus || null;
        this.currentLevel = this._getLevelValue(this.config.level);
        this.history = [];
        this.stats = {
            debug: 0,
            info: 0,
            warn: 0,
            error: 0
        };
    }
    
    _getLevelValue(levelName) {
        const level = levelName.toUpperCase();
        return Logger.LEVELS[level] !== undefined ? Logger.LEVELS[level] : Logger.LEVELS.INFO;
    }
    
    _shouldLog(level) {
        return level >= this.currentLevel;
    }
    
    _formatTimestamp() {
        const now = new Date();
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const seconds = String(now.getSeconds()).padStart(2, '0');
        const ms = String(now.getMilliseconds()).padStart(3, '0');
        return `${hours}:${minutes}:${seconds}.${ms}`;
    }
    
    _formatMessage(level, category, message, data) {
        const timestamp = this._formatTimestamp();
        const levelName = Logger.LEVEL_NAMES[level];
        
        let formatted = `[${timestamp}] [${levelName}] [${category}] ${message}`;
        
        if (data !== undefined) {
            formatted += ' ' + (typeof data === 'object' ? JSON.stringify(data) : data);
        }
        
        return formatted;
    }
    
    _log(level, category, message, data) {
        if (!this._shouldLog(level)) return;
        
        const levelName = Logger.LEVEL_NAMES[level].toLowerCase();
        this.stats[levelName]++;
        
        const formatted = this._formatMessage(level, category, message, data);
        
        // Ajouter à l'historique
        this.history.push({
            level: levelName,
            category,
            message,
            data,
            timestamp: Date.now(),
            formatted
        });
        
        if (this.history.length > this.config.maxHistorySize) {
            this.history.shift();
        }
        
        // Afficher dans la console
        if (this.config.enableConsole) {
            const consoleMethod = level === Logger.LEVELS.ERROR ? 'error' :
                                  level === Logger.LEVELS.WARN ? 'warn' :
                                  level === Logger.LEVELS.DEBUG ? 'debug' : 'log';
            
            const color = Logger.LEVEL_COLORS[Logger.LEVEL_NAMES[level]];
            console[consoleMethod](`%c${formatted}`, `color: ${color}`);
        }
        
        // Émettre événement
        if (this.config.enableEventBus && this.eventBus) {
            this.eventBus.emit('log', {
                level: levelName,
                category,
                message,
                data,
                timestamp: Date.now()
            });
        }
    }
    
    debug(category, message, data) {
        this._log(Logger.LEVELS.DEBUG, category, message, data);
    }
    
    info(category, message, data) {
        this._log(Logger.LEVELS.INFO, category, message, data);
    }
    
    warn(category, message, data) {
        this._log(Logger.LEVELS.WARN, category, message, data);
    }
    
    error(category, message, data) {
        this._log(Logger.LEVELS.ERROR, category, message, data);
    }
    
    setLevel(level) {
        this.currentLevel = this._getLevelValue(level);
        this.info('Logger', `Log level set to ${level.toUpperCase()}`);
    }
    
    getHistory(filterLevel = null) {
        if (!filterLevel) return [...this.history];
        return this.history.filter(entry => entry.level === filterLevel.toLowerCase());
    }
    
    clearHistory() {
        this.history = [];
    }
    
    getStats() {
        return { ...this.stats };
    }
}

// ============================================================================
// EXPOSITION GLOBALE - ✅ CORRIGÉ v3.0.2
// ============================================================================
if (typeof window !== 'undefined') {
    window.Logger = Logger;  // ✅ CORRECTION: window.Logger (la classe), pas window.logger
    console.log('✅ Logger class exposed globally as window.Logger');
}
// ============================================================================
// FIN DU FICHIER Logger.js v3.0.2
// ============================================================================