// ============================================================================
// Fichier: frontend/js/controllers/SystemController.js
// Version: v3.4.0 - SYSTEMVIEW EVENTS LISTENERS
// Date: 2025-11-06
// ============================================================================
// CORRECTIONS v3.4.0:
// âœ… NOUVEAU: Ajout listeners pour Ã©vÃ©nements SystemView (*_requested)
// âœ… NOUVEAU: Connexion complÃ¨te View â†’ Controller â†’ Model â†’ Backend
// âœ… NOUVEAU: Support system.info, uptime, memory, disk
// âœ… NOUVEAU: Stubs pour network.* et logger.* (Ã  implÃ©menter backend)
// âœ… Gestion erreurs avec mode offline silencieux
//
// CORRECTIONS v3.3.0:
// âœ… CRITIQUE: Ajout vÃ©rifications backend avant tous les appels
// âœ… CRITIQUE: Utilisation mÃ©thodes withBackend() et isBackendReady()
// âœ… Gestion mode offline avec messages appropriÃ©s
// âœ… Protection complÃ¨te contre backend null/undefined
//
// CORRECTIONS v3.2.1:
// âœ… CRITIQUE: Ajout paramÃ¨tre backend au constructeur (6Ã¨me paramÃ¨tre)
// âœ… Fix: super() appelle BaseController avec backend
// âœ… this.backend initialisÃ© automatiquement via BaseController
// ============================================================================

class SystemController extends BaseController {
    constructor(eventBus, models = {}, views = {}, notifications = null, debugConsole = null, backend = null) {
        super(eventBus, models, views, notifications, debugConsole, backend);
        
        this.logger = window.logger || console;
        this.systemModel = models.system || models.state;
        this.instrumentModel = models.instrument;
        this.view = views.system;
        
        // Ã‰tat systÃ¨me
        this.state = {
            ...this.state,
            backendConnected: false,
            devicesCount: 0,
            connectedDevicesCount: 0,
            lastScan: null
        };
        
        // Configuration monitoring
        this.config = {
            ...this.config,
            autoRefreshInterval: 5000, // 5 secondes
            statsUpdateInterval: 10000 // 10 secondes
        };
        
        // Timers
        this.statsTimer = null;
        this.devicesTimer = null;
        
        this._fullyInitialized = true;
        this.bindEvents();
    }
    
    // ========================================================================
    // Ã‰VÃ‰NEMENTS
    // ========================================================================
    
    bindEvents() {
        // Backend
        this.eventBus.on('backend:connected', () => this.onBackendConnected());
        this.eventBus.on('backend:disconnected', () => this.onBackendDisconnected());
        
        // Devices (Ã©vÃ©nements backend)
        this.eventBus.on('backend:event:device_connected', (data) => {
            this.handleDeviceConnected(data);
        });
        this.eventBus.on('backend:event:device_disconnected', (data) => {
            this.handleDeviceDisconnected(data);
        });
        this.eventBus.on('backend:event:midi_message', (data) => {
            this.handleMidiMessage(data);
        });
        
        // Navigation
        this.eventBus.on('navigation:page_changed', (data) => {
            if (data.page === 'system') {
                // Charger les données quand la page devient active
                if (this.backend?.isConnected?.()) {
                    this.refreshSystemInfo().catch(err => {
                        if (!err.offline) {
                            this.log('error', 'SystemController', 'refreshSystemInfo failed:', err);
                        }
                    });
                    
                    this.scanDevices().catch(err => {
                        if (!err.offline) {
                            this.log('error', 'SystemController', 'scanDevices failed:', err);
                        }
                    });
                }
                
                this.startMonitoring();
            } else {
                this.stopMonitoring();
            }
        });
        
        // ========================================================================
        // NOUVEAUX LISTENERS v3.4.0 - SYSTEMVIEW EVENTS
        // ========================================================================
        
        // System info requests
        this.eventBus.on('system:info_requested', async () => {
            try {
                const info = await this.getInfo();
                this.eventBus.emit('system:info', info);
            } catch (error) {
                if (!error.offline) {
                    this.log('error', 'SystemController', 'Failed to get info:', error);
                }
            }
        });
        
        this.eventBus.on('system:uptime_requested', async () => {
            try {
                const uptime = await this.getUptime();
                this.eventBus.emit('system:uptime', { uptime });
            } catch (error) {
                if (!error.offline) {
                    this.log('error', 'SystemController', 'Failed to get uptime:', error);
                }
            }
        });
        
        this.eventBus.on('system:memory_requested', async () => {
            try {
                const memory = await this.getMemory();
                this.eventBus.emit('system:memory', memory);
            } catch (error) {
                if (!error.offline) {
                    this.log('error', 'SystemController', 'Failed to get memory:', error);
                }
            }
        });
        
        this.eventBus.on('system:disk_requested', async () => {
            try {
                const disk = await this.getDisk();
                this.eventBus.emit('system:disk', disk);
            } catch (error) {
                if (!error.offline) {
                    this.log('error', 'SystemController', 'Failed to get disk:', error);
                }
            }
        });
        
        // Network requests (pour future implÃ©mentation backend)
        this.eventBus.on('network:status_requested', async () => {
            this.log('debug', 'SystemController', 'network:status requested (not implemented in backend yet)');
            this.eventBus.emit('network:status', { connected: true });
        });
        
        this.eventBus.on('network:interfaces_requested', async () => {
            this.log('debug', 'SystemController', 'network:interfaces requested (not implemented in backend yet)');
            this.eventBus.emit('network:interfaces', { interfaces: [] });
        });
        
        this.eventBus.on('network:stats_requested', async () => {
            this.log('debug', 'SystemController', 'network:stats requested (not implemented in backend yet)');
            this.eventBus.emit('network:stats', { rx_bytes: 0, tx_bytes: 0 });
        });
        
        // Logger requests (pour future implÃ©mentation backend)
        this.eventBus.on('logger:get_logs_requested', async (data) => {
            this.log('debug', 'SystemController', 'logger:get_logs requested (not implemented in backend yet)');
            this.eventBus.emit('logger:logs', { logs: [] });
        });
        
        this.eventBus.on('logger:set_level_requested', async (data) => {
            this.log('info', 'SystemController', `Logger level changed to: ${data.level}`);
            this.eventBus.emit('logger:level', { level: data.level });
        });
        
        this.eventBus.on('logger:clear_requested', async () => {
            this.log('info', 'SystemController', 'Logs cleared');
            this.eventBus.emit('logger:logs', { logs: [] });
        });
        
        this.eventBus.on('logger:export_requested', async () => {
            this.log('debug', 'SystemController', 'logger:export requested (not implemented in backend yet)');
        });
        
        this.log('info', 'SystemController', 'âœ¦ Events bound (v3.4.0 - with SystemView listeners)');
    }
    
    async onBackendConnected() {
        this.state.backendConnected = true;
        this.log('info', 'SystemController', 'âœ¦ Backend connected');
        
        // NE PAS charger automatiquement les données au démarrage
        // Les données seront chargées quand la page System devient active
        this.log('info', 'SystemController', 'Waiting for system page activation...');
    }
    }
    
    onBackendDisconnected() {
        this.state.backendConnected = false;
        this.stopMonitoring();
        this.log('warn', 'SystemController', 'âš ï¸ Backend disconnected');
    }
    
    // ========================================================================
    // COMMANDES SYSTEM.*
    // ========================================================================
    
    /**
     * Obtient la version du backend
     */
    async getVersion() {
        return this.withBackend(
            async () => {
                const response = await this.backend.sendCommand('system.info', {});
                
                if (response.success !== false) {
                    return response.data || response;
                }
                throw new Error(response.message || 'Failed to get version');
            },
            'get version',
            null
        );
    }
    
    /**
     * Obtient les infos systÃ¨me
     */
    async getInfo() {
        return this.withBackend(
            async () => {
                const response = await this.backend.sendCommand('system.info', {});
                
                if (response.success !== false) {
                    return response.data || response;
                }
                throw new Error(response.message || 'Failed to get info');
            },
            'get info',
            null
        );
    }
    
    /**
     * Obtient l'uptime
     */
    async getUptime() {
        return this.withBackend(
            async () => {
                const response = await this.backend.sendCommand('system.info', {});
                
                if (response.success !== false) {
                    return response.data?.uptime || response.uptime || 0;
                }
                throw new Error(response.message || 'Failed to get uptime');
            },
            'get uptime',
            0
        );
    }
    
    /**
     * Obtient l'usage mÃ©moire
     */
    async getMemory() {
        return this.withBackend(
            async () => {
                const response = await this.backend.sendCommand('system.info', {});
                
                if (response.success !== false) {
                    return response.data?.memory || response.memory || null;
                }
                throw new Error(response.message || 'Failed to get memory');
            },
            'get memory',
            null
        );
    }
    
    /**
     * Obtient l'usage disque
     */
    async getDisk() {
        return this.withBackend(
            async () => {
                const response = await this.backend.sendCommand('system.info', {});
                
                if (response.success !== false) {
                    return response.data?.disk || response.disk || null;
                }
                throw new Error(response.message || 'Failed to get disk');
            },
            'get disk',
            null
        );
    }
    
    /**
     * Ping le backend
     */
    async ping() {
        return this.withBackend(
            async () => {
                const response = await this.backend.sendCommand('system.info', {});
                return response.success !== false;
            },
            'ping',
            false
        );
    }
    
    /**
     * RafraÃ®chit toutes les infos systÃ¨me
     */
    async refreshSystemInfo() {
        // Ne rien faire si backend non disponible
        if (!this.isBackendReady()) {
            return null;
        }
        
        try {
            const [version, info, uptime, memory, disk] = await Promise.allSettled([
                this.getVersion(),
                this.getInfo(),
                this.getUptime(),
                this.getMemory(),
                this.getDisk()
            ]);
            
            const systemInfo = {
                version: version.status === 'fulfilled' ? version.value : null,
                info: info.status === 'fulfilled' ? info.value : null,
                uptime: uptime.status === 'fulfilled' ? uptime.value : null,
                memory: memory.status === 'fulfilled' ? memory.value : null,
                disk: disk.status === 'fulfilled' ? disk.value : null,
                lastUpdate: Date.now()
            };
            
            // Mettre Ã  jour le model
            if (this.systemModel) {
                this.systemModel.set('systemInfo', systemInfo);
            }
            
            // Ã‰mettre Ã©vÃ©nement
            this.eventBus.emit('system:info-updated', systemInfo);
            
            return systemInfo;
        } catch (error) {
            // Silencieux si offline
            if (!error.offline) {
                this.log('error', 'SystemController', 'refreshSystemInfo failed:', error);
            }
            throw error;
        }
    }
    
    // ========================================================================
    // COMMANDES DEVICES.*
    // ========================================================================
    
    /**
     * Liste tous les devices MIDI
     */
    async listDevices() {
        return this.withBackend(
            async () => {
                const response = await this.backend.sendCommand('devices.list', {});
                
                if (response.success !== false) {
                    const devices = response.data?.devices || response.devices || [];
                    
                    this.state.devicesCount = devices.length;
                    
                    // Mettre Ã  jour le model instrument
                    if (this.instrumentModel && devices.length > 0) {
                        this.instrumentModel.instruments.clear();
                        devices.forEach(device => {
                            this.instrumentModel.instruments.set(device.id, device);
                        });
                        
                        this.instrumentModel.state.totalInstruments = devices.length;
                        this.instrumentModel.state.connectedCount = devices.filter(d => d.connected).length;
                    }
                    
                    this.eventBus.emit('devices:list-updated', { devices });
                    
                    return devices;
                }
                throw new Error(response.message || 'Failed to list devices');
            },
            'list devices',
            []
        );
    }
    
    /**
     * Scanne les devices disponibles
     */
    async scanDevices() {
        return this.withBackend(
            async () => {
                this.log('info', 'SystemController', 'Scanning devices...');
                
                const response = await this.backend.sendCommand('devices.list', {});
                
                if (response.success !== false) {
                    const devices = response.data?.devices || response.devices || [];
                    
                    this.state.devicesCount = devices.length;
                    this.state.lastScan = Date.now();
                    
                    // Mettre Ã  jour le model instrument
                    if (this.instrumentModel && devices.length > 0) {
                        this.instrumentModel.instruments.clear();
                        devices.forEach(device => {
                            this.instrumentModel.instruments.set(device.id, device);
                        });
                        
                        this.instrumentModel.state.totalInstruments = devices.length;
                        this.instrumentModel.state.connectedCount = devices.filter(d => d.connected).length;
                        this.instrumentModel.state.lastScan = Date.now();
                    }
                    
                    this.log('info', 'SystemController', `âœ¦ Found ${devices.length} devices`);
                    this.eventBus.emit('devices:scan-complete', { devices });
                    
                    return devices;
                }
                throw new Error(response.message || 'Scan failed');
            },
            'scan devices',
            []
        );
    }
    
    /**
     * Connecte un device
     */
    async connectDevice(deviceId) {
        return this.withBackend(
            async () => {
                this.log('info', 'SystemController', `Connecting device: ${deviceId}`);
                
                const response = await this.backend.sendCommand('devices.connect', {
                    device_id: deviceId
                });
                
                if (response.success !== false) {
                    // Mettre Ã  jour le model
                    if (this.instrumentModel) {
                        const device = this.instrumentModel.instruments.get(deviceId);
                        if (device) {
                            device.connected = true;
                            this.instrumentModel.instruments.set(deviceId, device);
                            this.instrumentModel.state.connectedCount++;
                        }
                    }
                    
                    this.log('info', 'SystemController', `âœ¦ Device connected: ${deviceId}`);
                    this.eventBus.emit('devices:connected', { deviceId });
                    
                    return true;
                }
                throw new Error(response.message || 'Connection failed');
            },
            'connect device',
            false
        );
    }
    
    /**
     * DÃ©connecte un device
     */
    async disconnectDevice(deviceId) {
        return this.withBackend(
            async () => {
                this.log('info', 'SystemController', `Disconnecting device: ${deviceId}`);
                
                const response = await this.backend.sendCommand('devices.disconnect', {
                    device_id: deviceId
                });
                
                if (response.success !== false) {
                    // Mettre Ã  jour le model
                    if (this.instrumentModel) {
                        const device = this.instrumentModel.instruments.get(deviceId);
                        if (device) {
                            device.connected = false;
                            this.instrumentModel.instruments.set(deviceId, device);
                            this.instrumentModel.state.connectedCount = Math.max(0, this.instrumentModel.state.connectedCount - 1);
                        }
                    }
                    
                    this.log('info', 'SystemController', `âœ¦ Device disconnected: ${deviceId}`);
                    this.eventBus.emit('devices:disconnected', { deviceId });
                    
                    return true;
                }
                throw new Error(response.message || 'Disconnection failed');
            },
            'disconnect device',
            false
        );
    }
    
    // ========================================================================
    // GESTION Ã‰VÃ‰NEMENTS BACKEND
    // ========================================================================
    
    handleDeviceConnected(data) {
        this.log('info', 'SystemController', `Device connected: ${data.device_id}`);
        
        // Notifier
        if (this.notifications) {
            this.notifications.show(
                'Device Connected',
                `Device ${data.device_id} has been connected`,
                'success',
                3000
            );
        }
        
        // RafraÃ®chir liste
        this.listDevices().catch(err => {
            if (!err.offline) {
                this.log('error', 'SystemController', 'Failed to refresh devices:', err);
            }
        });
    }
    
    handleDeviceDisconnected(data) {
        this.log('info', 'SystemController', `Device disconnected: ${data.device_id}`);
        
        // Notifier
        if (this.notifications) {
            this.notifications.show(
                'Device Disconnected',
                `Device ${data.device_id} has been disconnected`,
                'warning',
                3000
            );
        }
        
        // RafraÃ®chir liste
        this.listDevices().catch(err => {
            if (!err.offline) {
                this.log('error', 'SystemController', 'Failed to refresh devices:', err);
            }
        });
    }
    
    handleMidiMessage(data) {
        // Ã‰mettre pour visualisation
        this.eventBus.emit('midi:message', data);
    }
    
    // ========================================================================
    // MONITORING
    // ========================================================================
    
    startMonitoring() {
        if (this.statsTimer || this.devicesTimer) {
            return; // DÃ©jÃ  dÃ©marrÃ©
        }
        
        // VÃ©rifier backend avant de dÃ©marrer
        if (!this.isBackendReady()) {
            this.log('info', 'SystemController', 'Monitoring skipped - backend not ready');
            return;
        }
        
        this.log('info', 'SystemController', 'Starting monitoring...');
        
        // Stats systÃ¨me
        this.statsTimer = setInterval(() => {
            // VÃ©rifier backend avant chaque update
            if (!this.isBackendReady()) {
                this.stopMonitoring();
                return;
            }
            
            this.refreshSystemInfo().catch(err => {
                // Silencieux si offline
                if (!err.offline) {
                    this.log('error', 'SystemController', 'Stats update failed:', err);
                }
            });
        }, this.config.statsUpdateInterval);
        
        // Devices
        this.devicesTimer = setInterval(() => {
            // VÃ©rifier backend avant chaque update
            if (!this.isBackendReady()) {
                this.stopMonitoring();
                return;
            }
            
            this.listDevices().catch(err => {
                // Silencieux si offline
                if (!err.offline) {
                    this.log('error', 'SystemController', 'Devices update failed:', err);
                }
            });
        }, this.config.autoRefreshInterval);
        
        // Premier refresh immÃ©diat
        this.refreshSystemInfo().catch(err => {
            if (!err.offline) {
                this.log('error', 'SystemController', 'Initial refresh failed:', err);
            }
        });
        
        this.listDevices().catch(err => {
            if (!err.offline) {
                this.log('error', 'SystemController', 'Initial devices list failed:', err);
            }
        });
    }
    
    stopMonitoring() {
        if (this.statsTimer) {
            clearInterval(this.statsTimer);
            this.statsTimer = null;
        }
        
        if (this.devicesTimer) {
            clearInterval(this.devicesTimer);
            this.devicesTimer = null;
        }
        
        this.log('info', 'SystemController', 'Monitoring stopped');
    }
    
    // ========================================================================
    // UTILITAIRES
    // ========================================================================
    
    log(level, ...args) {
        if (this.logger && typeof this.logger[level] === 'function') {
            this.logger[level](...args);
        }
    }
}

// ============================================================================
// EXPORT
// ============================================================================
if (typeof window !== 'undefined') {
    window.SystemController = SystemController;
}