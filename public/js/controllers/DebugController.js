// ============================================================================
// Fichier: frontend/js/controllers/DebugController.js
// Chemin réel: frontend/js/controllers/DebugController.js
// Version: v3.6.1 - FIXED BACKEND SIGNATURE - API CONFORMITÉ DOCUMENTATION_FRONTEND
// Date: 2025-11-01
// ============================================================================
// CORRECTIONS v3.6.1:
// ✅ CRITIQUE: Ajout paramètre backend au constructeur (6ème paramètre)
// ✅ Fix: super() appelle BaseController avec backend
// ✅ this.backend initialisé automatiquement via BaseController
// ============================================================================
// ============================================================================
// AMÉLIORATIONS v3.5.0:
// ✓ Collecte métriques système complète
// ✓ Monitoring performances en temps réel
// ✓ Diagnostic réseau et MIDI
// ✅ CORRECTIONS v4.0.0: Compatibilité API v4.0.0
// ✓ Export logs avec filtrage
// ✓ Affichage état système détaillé
// ✓ Détection problèmes automatique
// ✓ Suggestions diagnostic
// ✓ Graphiques performances
// ============================================================================

class DebugController extends BaseController {
    constructor(eventBus, models = {}, views = {}, notifications = null, debugConsole = null, backend = null) {
        super(eventBus, models, views, notifications, debugConsole, backend);
        
        // Backend
        // ✅ this.backend initialisé automatiquement par BaseController
        
        // Configuration
        this.config = {
            metricsInterval: 1000, // 1 seconde
            maxLogEntries: 1000,
            maxMetricsHistory: 60, // 60 échantillons
            autoDetectIssues: true,
            enablePerformanceMonitoring: true
        };
        
        // Métriques système
        this.metrics = {
            cpu: [],
            memory: [],
            fps: [],
            latency: [],
            eventRate: [],
            renderTime: [],
            apiCalls: []
        };
        
        // Compteurs
        this.counters = {
            events: 0,
            errors: 0,
            warnings: 0,
            apiCalls: 0,
            midiMessages: 0,
            renders: 0
        };
        
        // État système
        this.systemState = {
            backendConnected: false,
            midiDevicesCount: 0,
            activeNotes: 0,
            filesLoaded: 0,
            memoryUsage: 0,
            cpuUsage: 0,
            lastUpdate: null
        };
        
        // Logs
        this.logs = [];
        this.logFilters = {
            debug: true,
            info: true,
            warn: true,
            error: true
        };
        
        // Issues détectées
        this.detectedIssues = [];
        
        // Performance monitoring
        this.performanceObserver = null;
        this.fpsCounter = {
            frames: 0,
            lastTime: performance.now(),
            fps: 60
        };
        
        // Timers
        this.metricsTimer = null;
        
        this.log('info', 'DebugController', '✓ Initialized v3.5.0');
        
        this.initialize();
    }

    /**
     * Initialisation
     */
    initialize() {
        this.setupMetricsCollection();
        this.setupPerformanceMonitoring();
        this.setupEventTracking();
        this.collectInitialMetrics();
    }

    /**
     * Liaison des événements
     */
    bindEvents() {
        // Toggle debug panel
        this.eventBus.on('debug:toggle', () => {
            this.toggle();
        });
        
        this.eventBus.on('debug:toggled', (data) => {
            this.log('debug', 'DebugController', `Debug panel ${data.active ? 'opened' : 'closed'}`);
        });
        
        // Collecte d'événements pour métriques
        this.eventBus.on('*', (eventName, data) => {
            this.trackEvent(eventName, data);
        });
        
        // Erreurs
        this.eventBus.on('error', (data) => {
            this.counters.errors++;
            this.addLog('error', data.message || 'Unknown error', data);
        });
        
        // Warnings
        this.eventBus.on('warning', (data) => {
            this.counters.warnings++;
            this.addLog('warn', data.message || 'Warning', data);
        });
        
        // Messages MIDI
        this.eventBus.on('midi:message', () => {
            this.counters.midiMessages++;
        });
        
        // Appels API
        this.eventBus.on('backend:command', () => {
            this.counters.apiCalls++;
        });
        
        // Rendus
        this.eventBus.on('render:complete', () => {
            this.counters.renders++;
        });
        
        // État backend
        this.eventBus.on('backend:connected', () => {
            this.systemState.backendConnected = true;
            this.updateSystemState();
        });
        
        this.eventBus.on('backend:disconnected', () => {
            this.systemState.backendConnected = false;
            this.detectedIssues.push({
                type: 'error',
                message: 'Backend disconnected',
                timestamp: Date.now(),
                suggestion: 'Check backend service status'
            });
            this.updateSystemState();
        });
    }

    // ========================================================================
    // MÉTRIQUES
    // ========================================================================

    /**
     * Configure la collecte de métriques
     */
    setupMetricsCollection() {
        if (!this.config.metricsInterval) return;
        
        this.metricsTimer = setInterval(() => {
            this.collectMetrics();
        }, this.config.metricsInterval);
    }

    /**
     * Collecte les métriques
     */
    async collectMetrics() {
        const now = Date.now();
        
        // FPS
        const fps = this.calculateFPS();
        this.addMetric('fps', fps);
        
        // Mémoire
        if (performance.memory) {
            const memoryMB = performance.memory.usedJSHeapSize / 1048576;
            this.systemState.memoryUsage = memoryMB;
            this.addMetric('memory', memoryMB);
        }
        
        // Latence backend
        if (this.backend && this.backend.isConnected()) {
            const latency = await this.measureBackendLatency();
            if (latency !== null) {
                this.addMetric('latency', latency);
            }
        }
        
        // Taux d'événements (events/sec)
        const eventRate = this.counters.events / (this.config.metricsInterval / 1000);
        this.addMetric('eventRate', eventRate);
        this.counters.events = 0; // Reset
        
        // API calls rate
        const apiCallsRate = this.counters.apiCalls / (this.config.metricsInterval / 1000);
        this.addMetric('apiCalls', apiCallsRate);
        
        // Détection automatique de problèmes
        if (this.config.autoDetectIssues) {
            this.detectIssues();
        }
        
        // Mettre à jour l'affichage si le panel est ouvert
        if (this.debugConsole && this.debugConsole.isOpen) {
            this.updateDebugDisplay();
        }
    }

    /**
     * Collecte les métriques initiales
     */
    async collectInitialMetrics() {
        // Collecter infos système
        this.systemState.filesLoaded = this.getModel('file')?.data?.files?.length || 0;
        
        // Devices MIDI
        if (this.backend && this.backend.isConnected()) {
            try {
                const response = await this.backend.sendCommand('devices.list');
                this.systemState.midiDevicesCount = response?.devices?.length || 0;
            } catch (error) {
                this.log('warn', 'DebugController', 'Could not fetch MIDI devices');
            }
        }
        
        this.updateSystemState();
    }

    /**
     * Ajoute une métrique
     */
    addMetric(name, value) {
        if (!this.metrics[name]) {
            this.metrics[name] = [];
        }
        
        this.metrics[name].push({
            timestamp: Date.now(),
            value: value
        });
        
        // Limiter l'historique
        if (this.metrics[name].length > this.config.maxMetricsHistory) {
            this.metrics[name].shift();
        }
    }

    /**
     * Calcule le FPS
     */
    calculateFPS() {
        const now = performance.now();
        const delta = now - this.fpsCounter.lastTime;
        
        if (delta >= 1000) {
            this.fpsCounter.fps = Math.round((this.fpsCounter.frames * 1000) / delta);
            this.fpsCounter.frames = 0;
            this.fpsCounter.lastTime = now;
        }
        
        this.fpsCounter.frames++;
        return this.fpsCounter.fps;
    }

    /**
     * Mesure la latence backend
     */
    async measureBackendLatency() {
        if (!this.backend || !this.backend.isConnected()) {
            return null;
        }
        
        try {
            const start = performance.now();
            await this.backend.sendCommand('playback.getStatus');
            const latency = performance.now() - start;
            return latency;
        } catch (error) {
            return null;
        }
    }

    // ========================================================================
    // PERFORMANCE MONITORING
    // ========================================================================

    /**
     * Configure le monitoring de performance
     */
    setupPerformanceMonitoring() {
        if (!this.config.enablePerformanceMonitoring) return;
        
        if (typeof PerformanceObserver !== 'undefined') {
            try {
                this.performanceObserver = new PerformanceObserver((list) => {
                    for (const entry of list.getEntries()) {
                        if (entry.entryType === 'measure') {
                            this.addMetric('renderTime', entry.duration);
                        }
                    }
                });
                
                this.performanceObserver.observe({ entryTypes: ['measure'] });
            } catch (error) {
                this.log('warn', 'DebugController', 'PerformanceObserver not supported');
            }
        }
    }

    /**
     * Configure le tracking d'événements
     */
    setupEventTracking() {
        // Wrapper l'emit pour compter les événements
        if (this.eventBus) {
            const originalEmit = this.eventBus.emit.bind(this.eventBus);
            this.eventBus.emit = (eventName, ...args) => {
                this.counters.events++;
                return originalEmit(eventName, ...args);
            };
        }
    }

    /**
     * Track un événement
     */
    trackEvent(eventName, data) {
        // Ne pas logger les événements de métriques pour éviter les boucles
        if (eventName.startsWith('debug:') || eventName.startsWith('metrics:')) {
            return;
        }
        
        this.addLog('debug', `Event: ${eventName}`, { event: eventName, data });
    }

    // ========================================================================
    // DÉTECTION PROBLÈMES
    // ========================================================================

    /**
     * Détecte les problèmes automatiquement
     */
    detectIssues() {
        const issues = [];
        
        // FPS bas
        const avgFPS = this.getAverageMetric('fps');
        if (avgFPS < 30) {
            issues.push({
                type: 'warning',
                category: 'performance',
                message: `Low FPS: ${avgFPS.toFixed(1)}`,
                timestamp: Date.now(),
                suggestion: 'Consider reducing render complexity or enabling performance mode'
            });
        }
        
        // Mémoire haute
        const avgMemory = this.getAverageMetric('memory');
        if (avgMemory > 200) { // > 200MB
            issues.push({
                type: 'warning',
                category: 'memory',
                message: `High memory usage: ${avgMemory.toFixed(0)}MB`,
                timestamp: Date.now(),
                suggestion: 'Check for memory leaks or reduce cached data'
            });
        }
        
        // Latence élevée
        const avgLatency = this.getAverageMetric('latency');
        if (avgLatency > 100) { // > 100ms
            issues.push({
                type: 'warning',
                category: 'network',
                message: `High backend latency: ${avgLatency.toFixed(0)}ms`,
                timestamp: Date.now(),
                suggestion: 'Check network connection or backend performance'
            });
        }
        
        // Trop d'erreurs
        if (this.counters.errors > 10) {
            issues.push({
                type: 'error',
                category: 'errors',
                message: `High error count: ${this.counters.errors}`,
                timestamp: Date.now(),
                suggestion: 'Check console for error details'
            });
        }
        
        // Backend déconnecté
        if (!this.systemState.backendConnected) {
            issues.push({
                type: 'error',
                category: 'backend',
                message: 'Backend not connected',
                timestamp: Date.now(),
                suggestion: 'Restart backend service or check connection'
            });
        }
        
        // Ajouter les nouveaux issues
        issues.forEach(issue => {
            // Éviter les doublons
            const exists = this.detectedIssues.some(i => 
                i.category === issue.category && 
                i.message === issue.message &&
                (Date.now() - i.timestamp) < 60000 // Dans la dernière minute
            );
            
            if (!exists) {
                this.detectedIssues.push(issue);
                this.eventBus.emit('debug:issue_detected', issue);
            }
        });
        
        // Limiter l'historique des issues
        if (this.detectedIssues.length > 50) {
            this.detectedIssues = this.detectedIssues.slice(-50);
        }
    }

    /**
     * Obtient la moyenne d'une métrique
     */
    getAverageMetric(name) {
        const metric = this.metrics[name];
        if (!metric || metric.length === 0) return 0;
        
        const sum = metric.reduce((acc, m) => acc + m.value, 0);
        return sum / metric.length;
    }

    // ========================================================================
    // LOGS
    // ========================================================================

    /**
     * Ajoute un log
     */
    addLog(level, message, data = null) {
        const logEntry = {
            timestamp: Date.now(),
            level: level,
            message: message,
            data: data
        };
        
        this.logs.push(logEntry);
        
        // Limiter la taille
        if (this.logs.length > this.config.maxLogEntries) {
            this.logs.shift();
        }
        
        // Envoyer au debugConsole si présent
        if (this.debugConsole && typeof this.debugConsole.log === 'function') {
            this.debugConsole.log(level, message, data);
        }
    }

    /**
     * Filtre les logs
     */
    getFilteredLogs() {
        return this.logs.filter(log => this.logFilters[log.level]);
    }

    /**
     * Exporte les logs
     */
    exportLogs() {
        try {
            const exportData = {
                timestamp: new Date().toISOString(),
                systemState: this.systemState,
                metrics: this.getMetricsSummary(),
                counters: this.counters,
                issues: this.detectedIssues,
                logs: this.logs
            };
            
            const blob = new Blob([JSON.stringify(exportData, null, 2)], {
                type: 'application/json'
            });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `midimind-debug-${Date.now()}.json`;
            a.click();
            URL.revokeObjectURL(url);
            
            this.notify('success', 'Logs exportés');
            this.log('info', 'DebugController', '📤 Logs exported');
            
        } catch (error) {
            this.handleError('Erreur export logs', error);
        }
    }

    /**
     * Efface les logs
     */
    clearLogs() {
        this.logs = [];
        this.counters = {
            events: 0,
            errors: 0,
            warnings: 0,
            apiCalls: 0,
            midiMessages: 0,
            renders: 0
        };
        this.detectedIssues = [];
        
        if (this.debugConsole && typeof this.debugConsole.clear === 'function') {
            this.debugConsole.clear();
        }
        
        this.log('info', 'DebugController', '🗑️ Logs cleared');
    }

    // ========================================================================
    // INTERFACE
    // ========================================================================

    /**
     * Toggle le panel de debug
     */
    toggle() {
        if (this.debugConsole && typeof this.debugConsole.toggle === 'function') {
            this.debugConsole.toggle();
        }
    }

    /**
     * Toggle un filtre
     */
    toggleFilter(filter) {
        if (filter in this.logFilters) {
            this.logFilters[filter] = !this.logFilters[filter];
            this.updateDebugDisplay();
        }
        
        if (this.debugConsole && typeof this.debugConsole.toggleFilter === 'function') {
            this.debugConsole.toggleFilter(filter);
        }
    }

    /**
     * Met à jour l'affichage du debug panel
     */
    updateDebugDisplay() {
        if (!this.debugConsole || !this.debugConsole.isOpen) return;
        
        const displayData = {
            systemState: this.systemState,
            metrics: this.getMetricsSummary(),
            counters: this.counters,
            issues: this.detectedIssues,
            logs: this.getFilteredLogs().slice(-50) // Derniers 50 logs
        };
        
        this.eventBus.emit('debug:update', displayData);
    }

    /**
     * Met à jour l'état système
     */
    updateSystemState() {
        this.systemState.lastUpdate = Date.now();
        this.eventBus.emit('debug:system_state_updated', this.systemState);
    }

    // ========================================================================
    // GETTERS
    // ========================================================================

    /**
     * Obtient un résumé des métriques
     */
    getMetricsSummary() {
        const summary = {};
        
        for (const [name, values] of Object.entries(this.metrics)) {
            if (values.length === 0) continue;
            
            const recentValues = values.map(v => v.value);
            const sum = recentValues.reduce((a, b) => a + b, 0);
            const avg = sum / recentValues.length;
            const min = Math.min(...recentValues);
            const max = Math.max(...recentValues);
            const current = recentValues[recentValues.length - 1];
            
            summary[name] = {
                current: current.toFixed(2),
                avg: avg.toFixed(2),
                min: min.toFixed(2),
                max: max.toFixed(2),
                samples: values.length
            };
        }
        
        return summary;
    }

    /**
     * Obtient l'état complet du système
     */
    getSystemState() {
        return {
            ...this.systemState,
            metrics: this.getMetricsSummary(),
            counters: this.counters,
            issues: this.detectedIssues.length,
            logsCount: this.logs.length
        };
    }

    /**
     * Obtient un rapport de diagnostic
     */
    getDiagnosticReport() {
        return {
            timestamp: new Date().toISOString(),
            system: this.systemState,
            metrics: this.getMetricsSummary(),
            counters: this.counters,
            issues: this.detectedIssues,
            performance: {
                fps: this.getAverageMetric('fps'),
                memory: this.getAverageMetric('memory'),
                latency: this.getAverageMetric('latency')
            },
            recommendations: this.getRecommendations()
        };
    }

    /**
     * Obtient des recommandations
     */
    getRecommendations() {
        const recommendations = [];
        
        if (this.getAverageMetric('fps') < 30) {
            recommendations.push('Enable performance mode to improve FPS');
        }
        
        if (this.getAverageMetric('memory') > 200) {
            recommendations.push('Clear cache or restart application to free memory');
        }
        
        if (!this.systemState.backendConnected) {
            recommendations.push('Connect to backend for full functionality');
        }
        
        if (this.counters.errors > 10) {
            recommendations.push('Check console for recurring errors');
        }
        
        return recommendations;
    }

    // ========================================================================
    // CLEANUP
    // ========================================================================

    /**
     * Nettoie les ressources
     */
    destroy() {
        if (this.metricsTimer) {
            clearInterval(this.metricsTimer);
        }
        
        if (this.performanceObserver) {
            this.performanceObserver.disconnect();
        }
        
        super.destroy();
    }
}

// ============================================================================
// EXPORT
// ============================================================================

if (typeof module !== 'undefined' && module.exports) {
    module.exports = DebugController;
}

if (typeof window !== 'undefined') {
    window.DebugController = DebugController;
}