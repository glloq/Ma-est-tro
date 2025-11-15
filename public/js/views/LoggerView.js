// ============================================================================
// Fichier: frontend/js/views/LoggerView.js
// Chemin réel: frontend/js/views/LoggerView.js
// Version: v4.1.0 - SIGNATURE CORRIGÉE (HÉRITE DE BASEVIEW)
// Date: 2025-11-11
// ============================================================================
// CORRECTIONS v4.1.0:
// ✅ CRITIQUE: LoggerView hérite maintenant de BaseView
// ✅ Appel super(containerId, eventBus) au début du constructeur
// ✅ Suppression réimplémentation manuelle de resolveContainer
// ✅ Accès aux méthodes BaseView (render, update, show, hide, emit, etc.)
// ✅ Utilisation de this.log() au lieu de console.log
// ✅ État spécifique renommé loggerState pour éviter conflit
// ✅ Encodage UTF-8 nettoyé
// ============================================================================
// AMÉLIORATIONS v4.0.0:
// ✦ Affichage logs système
// ✦ Filtrage par niveau et texte
// ✦ Auto-scroll
// ✦ Export logs
// ============================================================================

class LoggerView extends BaseView {
    constructor(containerId, eventBus) {
        // ✅ NOUVEAU: Appel super() pour hériter de BaseView
        super(containerId, eventBus);
        
        // ✅ this.container et this.eventBus déjà initialisés par BaseView
        this.logger = window.logger || console;
        
        // État spécifique logger
        this.loggerState = {
            logs: [],
            level: 'info',
            filter: '',
            autoScroll: true,
            maxLogs: 1000
        };
        
        this.log('info', 'LoggerView v4.1.0 initialized');
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
        this.loadLogs();
        
        this.log('info', 'LoggerView initialized');
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
            <div class="logger-view">
                <div class="logger-header">
                    <h2>📋 Logs système</h2>
                    <div class="logger-controls">
                        <select data-action="level">
                            <option value="debug" ${this.loggerState.level === 'debug' ? 'selected' : ''}>Debug</option>
                            <option value="info" ${this.loggerState.level === 'info' ? 'selected' : ''}>Info</option>
                            <option value="warning" ${this.loggerState.level === 'warning' ? 'selected' : ''}>Warning</option>
                            <option value="error" ${this.loggerState.level === 'error' ? 'selected' : ''}>Error</option>
                        </select>
                        <input type="text" placeholder="Filtrer..." 
                               data-action="filter" 
                               value="${this.loggerState.filter}" />
                        <label class="auto-scroll-toggle">
                            <input type="checkbox" 
                                   data-action="auto-scroll" 
                                   ${this.loggerState.autoScroll ? 'checked' : ''} />
                            <span>Auto-scroll</span>
                        </label>
                        <button data-action="clear" class="btn-danger">🗑️ Effacer</button>
                        <button data-action="export" class="btn-primary">💾 Exporter</button>
                    </div>
                </div>
                
                <div class="logger-content" id="loggerContent">
                    ${this.renderLogs()}
                </div>
                
                <div class="logger-footer">
                    <span>${this.loggerState.logs.length} log(s)</span>
                    ${this.loggerState.filter ? 
                        `<span>${this.getFilteredLogs().length} affiché(s)</span>` : ''}
                </div>
            </div>
        `;
        
        // Marquer comme rendu
        this.state.rendered = true;
        this.state.lastUpdate = Date.now();
        
        // Auto-scroll si activé
        if (this.loggerState.autoScroll) {
            this.$nextTick(() => this.scrollToBottom());
        }
        
        this.log('debug', 'LoggerView rendered');
    }

    /**
     * Rendu des logs filtrés
     * @returns {string} HTML
     */
    renderLogs() {
        const filtered = this.getFilteredLogs();
        
        if (filtered.length === 0) {
            return '<div class="logs-empty">📭 Aucun log disponible</div>';
        }
        
        return filtered.map(log => this.renderLogEntry(log)).join('');
    }

    /**
     * Rendu d'une entrée de log
     * @param {Object} log - Entrée de log
     * @returns {string} HTML
     */
    renderLogEntry(log) {
        const level = log.level || 'info';
        const timestamp = log.timestamp || Date.now() / 1000;
        const message = log.message || '';
        const date = new Date(timestamp * 1000);
        
        const levelIcons = {
            debug: '🔍',
            info: 'ℹ️',
            warning: '⚠️',
            error: '❌'
        };
        
        return `
            <div class="log-entry log-${level}">
                <span class="log-time">${date.toLocaleString()}</span>
                <span class="log-level">${levelIcons[level] || '📝'} ${level.toUpperCase()}</span>
                <span class="log-message">${this.escapeHtml(message)}</span>
            </div>
        `;
    }

    /**
     * Obtient les logs filtrés
     * @returns {Array} Logs filtrés
     */
    getFilteredLogs() {
        return this.loggerState.logs.filter(log => {
            // Filtrage par texte
            if (this.loggerState.filter) {
                const message = log.message?.toLowerCase() || '';
                const filter = this.loggerState.filter.toLowerCase();
                if (!message.includes(filter)) return false;
            }
            
            // Optionnel: Filtrage par niveau si nécessaire
            // if (this.loggerState.level !== 'debug') {
            //     const levels = ['debug', 'info', 'warning', 'error'];
            //     const minLevel = levels.indexOf(this.loggerState.level);
            //     const logLevel = levels.indexOf(log.level || 'info');
            //     if (logLevel < minLevel) return false;
            // }
            
            return true;
        });
    }

    /**
     * Échappe les caractères HTML
     * @param {string} text - Texte à échapper
     * @returns {string} Texte échappé
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // ========================================================================
    // ÉVÉNEMENTS
    // ========================================================================

    attachEvents() {
        if (!this.container) return;
        
        // Change handler (select level, auto-scroll checkbox)
        const changeHandler = (e) => {
            const action = e.target.dataset.action;
            if (action === 'level') {
                this.setLevel(e.target.value);
            } else if (action === 'auto-scroll') {
                this.loggerState.autoScroll = e.target.checked;
            }
        };
        
        this.container.addEventListener('change', changeHandler);
        this.addDOMListener(this.container, 'change', changeHandler);
        
        // Input handler (filter)
        const inputHandler = (e) => {
            if (e.target.dataset.action === 'filter') {
                this.loggerState.filter = e.target.value;
                this.render();
            }
        };
        
        this.container.addEventListener('input', inputHandler);
        this.addDOMListener(this.container, 'input', inputHandler);
        
        // Click handler (clear, export)
        const clickHandler = (e) => {
            const action = e.target.dataset.action;
            if (action === 'clear') this.clearLogs();
            if (action === 'export') this.exportLogs();
        };
        
        this.container.addEventListener('click', clickHandler);
        this.addDOMListener(this.container, 'click', clickHandler);
        
        // Événements EventBus
        if (this.eventBus) {
            this.on('logger:logs', (data) => {
                this.log('debug', `Received ${data.logs?.length || 0} logs`);
                this.loggerState.logs = data.logs || [];
                
                // Limiter le nombre de logs
                if (this.loggerState.logs.length > this.loggerState.maxLogs) {
                    this.loggerState.logs = this.loggerState.logs.slice(-this.loggerState.maxLogs);
                }
                
                this.render();
            });
            
            this.on('logger:level', (data) => {
                this.log('debug', `Log level set to: ${data.level}`);
                this.loggerState.level = data.level;
                this.render();
            });
            
            this.on('logger:cleared', () => {
                this.log('info', 'Logs cleared');
                this.loggerState.logs = [];
                this.render();
            });
            
            this.log('debug', 'Event listeners attached');
        }
    }

    // ========================================================================
    // ACTIONS LOGGER
    // ========================================================================

    /**
     * Définit le niveau de log
     * @param {string} level - Niveau (debug, info, warning, error)
     */
    setLevel(level) {
        this.log('info', `Setting log level to: ${level}`);
        this.loggerState.level = level;
        
        if (this.eventBus) {
            this.emit('logger:set_level_requested', { level });
        } else {
            this.log('error', 'Cannot set level: EventBus not available');
        }
    }

    /**
     * Efface tous les logs
     */
    clearLogs() {
        this.log('info', 'Clearing logs');
        
        if (this.eventBus) {
            this.emit('logger:clear_requested');
        } else {
            this.log('error', 'Cannot clear logs: EventBus not available');
        }
    }

    /**
     * Exporte les logs
     */
    exportLogs() {
        this.log('info', 'Exporting logs');
        
        if (this.eventBus) {
            this.emit('logger:export_requested');
        } else {
            // Fallback: export local
            const filtered = this.getFilteredLogs();
            const text = filtered.map(log => {
                const date = new Date(log.timestamp * 1000).toISOString();
                return `[${date}] [${log.level?.toUpperCase()}] ${log.message}`;
            }).join('\n');
            
            const blob = new Blob([text], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `midimind-logs-${Date.now()}.txt`;
            a.click();
            URL.revokeObjectURL(url);
            
            this.log('info', 'Logs exported locally');
        }
    }

    /**
     * Charge les logs depuis le backend
     */
    loadLogs() {
        this.log('debug', 'Loading logs');
        
        if (this.eventBus) {
            this.emit('logger:get_logs_requested', { limit: this.loggerState.maxLogs });
            this.emit('logger:get_level_requested');
        } else {
            this.log('error', 'Cannot load logs: EventBus not available');
        }
    }

    /**
     * Scroll vers le bas
     */
    scrollToBottom() {
        const content = this.container?.querySelector('#loggerContent');
        if (content) {
            content.scrollTop = content.scrollHeight;
        }
    }

    /**
     * Exécute une fonction au prochain tick (après render)
     * @param {Function} fn - Fonction à exécuter
     */
    $nextTick(fn) {
        setTimeout(fn, 0);
    }

    // ========================================================================
    // MÉTHODES PUBLIQUES
    // ========================================================================

    /**
     * Ajoute un log
     * @param {Object} log - Entrée de log
     */
    addLog(log) {
        this.loggerState.logs.push(log);
        
        // Limiter le nombre de logs
        if (this.loggerState.logs.length > this.loggerState.maxLogs) {
            this.loggerState.logs.shift();
        }
        
        this.render();
    }

    /**
     * Définit le filtre
     * @param {string} filter - Texte de filtre
     */
    setFilter(filter) {
        this.loggerState.filter = filter || '';
        this.render();
    }

    // ========================================================================
    // LIFECYCLE - NETTOYAGE
    // ========================================================================

    /**
     * Détruit la vue et nettoie les ressources
     */
    destroy() {
        this.log('debug', 'Destroying LoggerView');
        
        // Nettoyer l'état
        this.loggerState.logs = [];
        this.loggerState.filter = '';
        
        // Appeler super.destroy() pour cleanup BaseView
        super.destroy();
        
        this.log('info', 'LoggerView destroyed');
    }
}

// ============================================================================
// EXPORT GLOBAL
// ============================================================================

if (typeof window !== 'undefined') {
    window.LoggerView = LoggerView;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = LoggerView;
}