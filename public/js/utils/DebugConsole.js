// ============================================================================
// Fichier: frontend/js/utils/DebugConsole.js
// Chemin réel: frontend/js/utils/DebugConsole.js
// Version: v3.2.0 - SAFE EVENTBUS USAGE
// Date: 2025-10-31
// ============================================================================

class DebugConsole {
    constructor(containerId, eventBus = null) {
        this.containerId = containerId;
        this.eventBus = eventBus || window.eventBus || null;
        this.container = null;
        this.contentEl = null;
        this.logs = [];
        this.maxLogs = 500;
        this.isVisible = false;
        
        this.filters = {
            error: true,
            warn: true,
            info: true,
            debug: true,
            midi: true,
            device: true,
            routing: true,
            playback: true,
            file: true,
            system: true,
            backend: true,
            sync: true,
            instruments: true,
            notification: true
        };
        
        // ✅ SAFE: Setup listeners only if eventBus is available
        if (this.eventBus && typeof this.eventBus.on === 'function') {
            this.setupListeners();
        } else {
            console.warn('[DebugConsole] EventBus not available, listeners not setup');
        }
    }

    setupListeners() {
        if (!this.eventBus || typeof this.eventBus.on !== 'function') {
            return;
        }
        
        this.eventBus.on('debug:log', (data) => {
            this.log(data.category, data.message, data.data);
        });
        
        this.eventBus.on('error:caught', (error) => {
            this.log('error', `Erreur: ${error.message || error}`, error);
        });
    }

    init() {
        this.container = document.getElementById(this.containerId);
        if (!this.container) {
            console.warn(`[DebugConsole] Container ${this.containerId} not found`);
            return;
        }
        
        this.contentEl = this.container.querySelector('.debug-content');
        if (!this.contentEl) {
            console.warn('[DebugConsole] Content element not found');
            return;
        }
        
        this.setupUI();
    }

    setupUI() {
        const closeBtn = document.getElementById('btnCloseDebug');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.hide());
        }
        
        const clearBtn = document.getElementById('btnClearLogs');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => this.clear());
        }
        
        const levelSelect = document.getElementById('logLevelSelect');
        if (levelSelect) {
            levelSelect.addEventListener('change', (e) => {
                this.setFilter(e.target.value);
            });
        }
    }

    log(category, message, data = null) {
        const logEntry = {
            timestamp: Date.now(),
            category,
            message,
            data,
            level: this.getLogLevel(category)
        };
        
        this.logs.push(logEntry);
        
        if (this.logs.length > this.maxLogs) {
            this.logs.shift();
        }
        
        if (this.isVisible && this.contentEl) {
            this.appendLog(logEntry);
        }
    }

    getLogLevel(category) {
        if (category === 'error') return 'error';
        if (category === 'warn') return 'warn';
        if (category === 'info') return 'info';
        return 'debug';
    }

    appendLog(entry) {
        if (!this.contentEl) return;
        
        const div = document.createElement('div');
        div.className = `debug-log debug-log-${entry.level}`;
        
        const time = new Date(entry.timestamp).toLocaleTimeString();
        div.innerHTML = `
            <span class="debug-time">[${time}]</span>
            <span class="debug-category">[${entry.category}]</span>
            <span class="debug-message">${this.escapeHtml(entry.message)}</span>
        `;
        
        if (entry.data) {
            const dataDiv = document.createElement('pre');
            dataDiv.className = 'debug-data';
            dataDiv.textContent = JSON.stringify(entry.data, null, 2);
            div.appendChild(dataDiv);
        }
        
        this.contentEl.appendChild(div);
        this.contentEl.scrollTop = this.contentEl.scrollHeight;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    show() {
        if (this.container) {
            this.container.style.display = 'block';
            this.isVisible = true;
            this.render();
        }
    }

    hide() {
        if (this.container) {
            this.container.style.display = 'none';
            this.isVisible = false;
        }
    }

    toggle() {
        if (this.isVisible) {
            this.hide();
        } else {
            this.show();
        }
    }

    clear() {
        this.logs = [];
        if (this.contentEl) {
            this.contentEl.innerHTML = '';
        }
    }

    render() {
        if (!this.contentEl) return;
        
        this.contentEl.innerHTML = '';
        
        const filteredLogs = this.logs.filter(log => {
            return this.filters[log.level] !== false;
        });
        
        filteredLogs.forEach(log => this.appendLog(log));
    }

    setFilter(level) {
        if (level === 'all') {
            for (const key in this.filters) {
                this.filters[key] = true;
            }
        } else {
            for (const key in this.filters) {
                this.filters[key] = false;
            }
            this.filters[level] = true;
        }
        
        this.render();
    }

    destroy() {
        this.clear();
        this.container = null;
        this.contentEl = null;
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = DebugConsole;
}

if (typeof window !== 'undefined') {
    window.DebugConsole = DebugConsole;
}