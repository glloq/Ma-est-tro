// ============================================================================
// Fichier: frontend/js/monitoring/NetworkMonitor.js
// Version: v1.0.0
// Date: 2025-10-28
// ============================================================================
// Description:
//   Moniteur rÃ©seau pour le systÃ¨me MidiMind
//   - Statut rÃ©seau en temps rÃ©el
//   - Liste des interfaces
//   - Statistiques de dÃ©bit et paquets
//   - Alertes de problÃ¨mes rÃ©seau
// ============================================================================

class NetworkMonitor extends BaseController {
    constructor(eventBus, models = {}, views = {}, notifications = null, debugConsole = null, backend = null) {
        super(eventBus, models, views, notifications, debugConsole, backend);
        
        this.backendService = backendService;
        
        // Ã‰tat du rÃ©seau
        this.state.network = {
            status: {
                connected: false,
                quality: 'unknown',
                lastCheck: null
            },
            interfaces: [],
            statistics: {
                bytesReceived: 0,
                bytesSent: 0,
                packetsReceived: 0,
                packetsSent: 0,
                errors: 0,
                drops: 0
            },
            alerts: []
        };
        
        // Configuration
        this.config.monitoringEnabled = false;
        this.config.updateInterval = 5000; // 5 secondes
        this.config.alertThresholds = {
            errorRate: 0.05, // 5% d'erreurs
            dropRate: 0.02,  // 2% de drops
            minQuality: 50   // QualitÃ© minimale (0-100)
        };
        
        // Timers
        this.monitoringTimer = null;
        
        // Historique pour calcul de dÃ©bit
        this.history = {
            timestamps: [],
            bytesReceived: [],
            bytesSent: []
        };
        this.historySize = 60; // Garder 60 Ã©chantillons
    }
    
    /**
     * Initialisation personnalisÃ©e
     */
    onInitialize() {
        this.logDebug('info', 'NetworkMonitor initializing...');
        
        // Charger l'Ã©tat initial
        this.checkNetworkStatus();
        this.loadInterfaces();
    }
    
    /**
     * Liaison des Ã©vÃ©nements
     */
    bindEvents() {
        // Ã‰vÃ©nements de contrÃ´le
        this.subscribe('network:start-monitoring', () => this.startMonitoring());
        this.subscribe('network:stop-monitoring', () => this.stopMonitoring());
        this.subscribe('network:check-status', () => this.checkNetworkStatus());
        this.subscribe('network:refresh', () => this.refreshAll());
        
        // Ã‰vÃ©nements backend
        this.subscribe('backend:connected', () => {
            this.checkNetworkStatus();
            this.loadInterfaces();
        });
        
        this.subscribe('backend:disconnected', () => {
            this.handleNetworkDisconnection();
        });
    }
    
    /**
     * VÃ©rifie le statut rÃ©seau
     */
    async checkNetworkStatus() {
        return this.executeAction('checkNetworkStatus', async () => {
            try {
                const response = await this.backendService.sendCommand('network.status', {});
                
                if (response.success) {
                    const previousStatus = this.state.network.status.connected;
                    
                    this.state.network.status = {
                        connected: response.data.connected || false,
                        quality: this.calculateQuality(response.data),
                        lastCheck: new Date().toISOString(),
                        ...response.data
                    };
                    
                    // DÃ©tecter changement de statut
                    if (previousStatus !== this.state.network.status.connected) {
                        if (this.state.network.status.connected) {
                            this.handleNetworkConnection();
                        } else {
                            this.handleNetworkDisconnection();
                        }
                    }
                    
                    this.emitEvent('network:status:updated', {
                        status: this.state.network.status
                    });
                }
                
                return response;
            } catch (error) {
                this.state.network.status.connected = false;
                this.handleError('Erreur lors de la vÃ©rification du statut rÃ©seau', error);
                throw error;
            }
        });
    }
    
    /**
     * Charge la liste des interfaces rÃ©seau
     */
    async loadInterfaces() {
        return this.executeAction('loadInterfaces', async () => {
            try {
                const response = await this.backendService.sendCommand('network.interfaces', {});
                
                if (response.success) {
                    this.state.network.interfaces = response.data.interfaces || [];
                    
                    this.emitEvent('network:interfaces:loaded', {
                        interfaces: this.state.network.interfaces
                    });
                }
                
                return response;
            } catch (error) {
                this.handleError('Erreur lors du chargement des interfaces rÃ©seau', error);
                throw error;
            }
        });
    }
    
    /**
     * Charge les statistiques rÃ©seau
     */
    async loadStatistics() {
        return this.executeAction('loadStatistics', async () => {
            try {
                const response = await this.backendService.sendCommand('network.stats', {});
                
                if (response.success) {
                    const previousStats = { ...this.state.network.statistics };
                    
                    this.state.network.statistics = {
                        bytesReceived: response.data.bytes_received || 0,
                        bytesSent: response.data.bytes_sent || 0,
                        packetsReceived: response.data.packets_received || 0,
                        packetsSent: response.data.packets_sent || 0,
                        errors: response.data.errors || 0,
                        drops: response.data.drops || 0,
                        timestamp: Date.now()
                    };
                    
                    // Mettre Ã  jour l'historique
                    this.updateHistory(this.state.network.statistics);
                    
                    // Calculer les dÃ©bits
                    const rates = this.calculateRates(previousStats);
                    
                    // VÃ©rifier les seuils d'alerte
                    this.checkAlertThresholds(rates);
                    
                    this.emitEvent('network:stats:updated', {
                        statistics: this.state.network.statistics,
                        rates
                    });
                }
                
                return response;
            } catch (error) {
                this.handleError('Erreur lors du chargement des statistiques rÃ©seau', error);
                throw error;
            }
        });
    }
    
    /**
     * Met Ã  jour l'historique des statistiques
     */
    updateHistory(stats) {
        this.history.timestamps.push(stats.timestamp);
        this.history.bytesReceived.push(stats.bytesReceived);
        this.history.bytesSent.push(stats.bytesSent);
        
        // Limiter la taille de l'historique
        if (this.history.timestamps.length > this.historySize) {
            this.history.timestamps.shift();
            this.history.bytesReceived.shift();
            this.history.bytesSent.shift();
        }
    }
    
    /**
     * Calcule les dÃ©bits (bytes/s)
     */
    calculateRates(previousStats) {
        if (!previousStats.timestamp) {
            return {
                receiveRate: 0,
                sendRate: 0
            };
        }
        
        const currentStats = this.state.network.statistics;
        const timeDiff = (currentStats.timestamp - previousStats.timestamp) / 1000; // en secondes
        
        if (timeDiff <= 0) {
            return { receiveRate: 0, sendRate: 0 };
        }
        
        return {
            receiveRate: (currentStats.bytesReceived - previousStats.bytesReceived) / timeDiff,
            sendRate: (currentStats.bytesSent - previousStats.bytesSent) / timeDiff
        };
    }
    
    /**
     * Calcule la qualitÃ© rÃ©seau (0-100)
     */
    calculateQuality(statusData) {
        if (!statusData.connected) {
            return 0;
        }
        
        let quality = 100;
        
        // RÃ©duire selon les erreurs
        const stats = this.state.network.statistics;
        if (stats.packetsReceived > 0) {
            const errorRate = stats.errors / stats.packetsReceived;
            quality -= errorRate * 100;
        }
        
        // RÃ©duire selon les drops
        if (stats.packetsReceived > 0) {
            const dropRate = stats.drops / stats.packetsReceived;
            quality -= dropRate * 50;
        }
        
        return Math.max(0, Math.min(100, quality));
    }
    
    /**
     * VÃ©rifie les seuils d'alerte
     */
    checkAlertThresholds(rates) {
        const stats = this.state.network.statistics;
        const alerts = [];
        
        // VÃ©rifier le taux d'erreur
        if (stats.packetsReceived > 0) {
            const errorRate = stats.errors / stats.packetsReceived;
            if (errorRate > this.config.alertThresholds.errorRate) {
                alerts.push({
                    type: 'error',
                    severity: 'warning',
                    message: `Taux d'erreur Ã©levÃ©: ${(errorRate * 100).toFixed(2)}%`,
                    timestamp: Date.now()
                });
            }
        }
        
        // VÃ©rifier le taux de drops
        if (stats.packetsReceived > 0) {
            const dropRate = stats.drops / stats.packetsReceived;
            if (dropRate > this.config.alertThresholds.dropRate) {
                alerts.push({
                    type: 'drop',
                    severity: 'warning',
                    message: `Taux de paquets perdus Ã©levÃ©: ${(dropRate * 100).toFixed(2)}%`,
                    timestamp: Date.now()
                });
            }
        }
        
        // VÃ©rifier la qualitÃ© minimale
        const quality = this.calculateQuality({ connected: true });
        if (quality < this.config.alertThresholds.minQuality) {
            alerts.push({
                type: 'quality',
                severity: 'error',
                message: `QualitÃ© rÃ©seau faible: ${quality.toFixed(0)}%`,
                timestamp: Date.now()
            });
        }
        
        // Ajouter les nouvelles alertes
        if (alerts.length > 0) {
            this.state.network.alerts.push(...alerts);
            
            // Limiter le nombre d'alertes conservÃ©es
            if (this.state.network.alerts.length > 100) {
                this.state.network.alerts = this.state.network.alerts.slice(-100);
            }
            
            // Notifier
            alerts.forEach(alert => {
                this.showNotification(alert.message, alert.severity);
            });
            
            this.emitEvent('network:alerts', { alerts });
        }
    }
    
    /**
     * GÃ¨re la connexion rÃ©seau
     */
    handleNetworkConnection() {
        this.logDebug('info', 'Network connected');
        
        this.showNotification('RÃ©seau connectÃ©', 'success');
        
        this.emitEvent('network:connected');
    }
    
    /**
     * GÃ¨re la dÃ©connexion rÃ©seau
     */
    handleNetworkDisconnection() {
        this.logDebug('warning', 'Network disconnected');
        
        this.showNotification('RÃ©seau dÃ©connectÃ©', 'error');
        
        this.emitEvent('network:disconnected');
    }
    
    /**
     * DÃ©marre le monitoring
     */
    startMonitoring() {
        if (this.config.monitoringEnabled) {
            this.logDebug('warning', 'Monitoring already started');
            return;
        }
        
        this.config.monitoringEnabled = true;
        
        this.monitoringTimer = setInterval(() => {
            this.checkNetworkStatus();
            this.loadStatistics();
        }, this.config.updateInterval);
        
        this.logDebug('info', 'Network monitoring started');
        
        this.emitEvent('network:monitoring:started');
    }
    
    /**
     * ArrÃªte le monitoring
     */
    stopMonitoring() {
        if (!this.config.monitoringEnabled) {
            return;
        }
        
        this.config.monitoringEnabled = false;
        
        if (this.monitoringTimer) {
            clearInterval(this.monitoringTimer);
            this.monitoringTimer = null;
        }
        
        this.logDebug('info', 'Network monitoring stopped');
        
        this.emitEvent('network:monitoring:stopped');
    }
    
    /**
     * RafraÃ®chit toutes les donnÃ©es rÃ©seau
     */
    async refreshAll() {
        return this.executeAction('refreshAll', async () => {
            try {
                await this.checkNetworkStatus();
                await this.loadInterfaces();
                await this.loadStatistics();
                
                this.showNotification('DonnÃ©es rÃ©seau rafraÃ®chies', 'success');
            } catch (error) {
                this.handleError('Erreur lors du rafraÃ®chissement des donnÃ©es rÃ©seau', error);
                throw error;
            }
        });
    }
    
    /**
     * Formate un dÃ©bit (bytes/s) en lecture humaine
     */
    formatRate(bytesPerSecond) {
        const units = ['B/s', 'KB/s', 'MB/s', 'GB/s'];
        let value = bytesPerSecond;
        let unitIndex = 0;
        
        while (value >= 1024 && unitIndex < units.length - 1) {
            value /= 1024;
            unitIndex++;
        }
        
        return `${value.toFixed(2)} ${units[unitIndex]}`;
    }
    
    /**
     * Obtient un rÃ©sumÃ© du statut rÃ©seau
     */
    getNetworkSummary() {
        return {
            connected: this.state.network.status.connected,
            quality: this.state.network.status.quality,
            interfacesCount: this.state.network.interfaces.length,
            alertsCount: this.state.network.alerts.length,
            monitoring: this.config.monitoringEnabled
        };
    }
    
    /**
     * Afficher une notification
     */
    showNotification(message, type = 'info') {
        if (this.notifications && typeof this.notifications.show === 'function') {
            this.notifications.show(message, type);
        } else {
            this.logDebug(type, message);
        }
    }
    
    /**
     * Obtenir l'Ã©tat actuel
     */
    getNetworkState() {
        return {
            ...this.state.network,
            monitoring: this.config.monitoringEnabled
        };
    }
    
    /**
     * Nettoyage lors de la destruction
     */
    destroy() {
        this.stopMonitoring();
        super.destroy();
    }
}

// ============================================================================
// EXPORT
// ============================================================================

if (typeof module !== 'undefined' && module.exports) {
    module.exports = NetworkMonitor;
}

if (typeof window !== 'undefined') {
    window.NetworkMonitor = NetworkMonitor;
}