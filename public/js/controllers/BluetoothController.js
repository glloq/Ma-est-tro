// ============================================================================
// Fichier: frontend/js/controllers/BluetoothController.js
// Version: v1.0.1 - FIXED BACKEND SIGNATURE
// Date: 2025-10-28
// ============================================================================
// CORRECTIONS v1.0.1:
// ✅ CRITIQUE: Ajout paramètre backend au constructeur (6ème paramètre)
// ✅ Fix: super() appelle BaseController avec backend
// ✅ this.backend initialisé automatiquement via BaseController
// ============================================================================
// ============================================================================
// Description:
//   Contrôleur pour gérer les périphériques Bluetooth BLE
//   - Scan des périphériques disponibles
//   - Appairage/désappairage
//   - Configuration Bluetooth
//   - Monitoring des signaux
// ============================================================================

class BluetoothController extends BaseController {
    constructor(eventBus, models = {}, views = {}, notifications = null, debugConsole = null, backend = null) {
        super(eventBus, models, views, notifications, debugConsole, backend);
        
        this.backendService = backendService;
        this.bluetoothView = bluetoothView;
        
        // État du Bluetooth
        this.state.bluetooth = {
            enabled: false,
            scanning: false,
            devices: [],
            pairedDevices: [],
            selectedDevice: null
        };
        
        // Configuration
        this.config.scanTimeout = 5;
        this.config.signalUpdateInterval = 5000;
        
        // Timers
        this.scanTimer = null;
        this.signalTimer = null;
    }
    
    /**
     * Initialisation personnalisée
     */
    onInitialize() {
        this.logDebug('info', 'BluetoothController initializing...');
        
        // Charger le statut initial
        this.loadBluetoothStatus();
    }
    
    /**
     * Liaison des événements
     */
    bindEvents() {
        // Événements de la vue
        this.subscribe('bluetooth:scan', () => this.scanDevices());
        this.subscribe('bluetooth:pair', (data) => this.pairDevice(data.address, data.pin));
        this.subscribe('bluetooth:unpair', (data) => this.unpairDevice(data.address));
        this.subscribe('bluetooth:forget', (data) => this.forgetDevice(data.address));
        this.subscribe('bluetooth:config', (data) => this.configBluetooth(data));
        this.subscribe('bluetooth:refresh-paired', () => this.listPairedDevices());
        this.subscribe('bluetooth:refresh-signal', (data) => this.getSignalStrength(data.device_id));
        
        // Événements backend
        this.subscribe('backend:connected', () => {
            this.loadBluetoothStatus();
            this.listPairedDevices();
        });
    }
    
    /**
     * Charge le statut Bluetooth
     */
    async loadBluetoothStatus() {
        return this.executeAction('loadBluetoothStatus', async () => {
            try {
                const response = await this.backendService.sendCommand('bluetooth.status', {});
                
                if (response.success) {
                    this.state.bluetooth.enabled = response.data.enabled || false;
                    
                    this.updateView({
                        enabled: this.state.bluetooth.enabled,
                        status: response.data
                    });
                    
                    this.emitEvent('bluetooth:status:loaded', response.data);
                }
                
                return response;
            } catch (error) {
                this.handleError('Erreur lors du chargement du statut Bluetooth', error);
                throw error;
            }
        });
    }
    
    /**
     * Configure le Bluetooth
     */
    async configBluetooth(config) {
        return this.executeAction('configBluetooth', async (data) => {
            try {
                const response = await this.backendService.sendCommand('bluetooth.config', {
                    enabled: data.enabled,
                    scan_timeout: data.scanTimeout || this.config.scanTimeout
                });
                
                if (response.success) {
                    this.state.bluetooth.enabled = data.enabled;
                    
                    this.showNotification(
                        data.enabled ? 'Bluetooth activé' : 'Bluetooth désactivé',
                        'success'
                    );
                    
                    this.updateView({
                        enabled: this.state.bluetooth.enabled
                    });
                    
                    this.emitEvent('bluetooth:config:updated', data);
                }
                
                return response;
            } catch (error) {
                this.handleError('Erreur lors de la configuration Bluetooth', error);
                throw error;
            }
        }, config);
    }
    
    /**
     * Scanner les périphériques BLE disponibles
     */
    async scanDevices(duration = null, filter = null) {
        if (this.state.bluetooth.scanning) {
            this.logDebug('warning', 'Scan already in progress');
            return;
        }
        
        return this.executeAction('scanDevices', async () => {
            try {
                this.state.bluetooth.scanning = true;
                this.updateView({ scanning: true });
                
                const scanDuration = duration || this.config.scanTimeout;
                
                const response = await this.backendService.sendCommand('bluetooth.scan', {
                    duration: scanDuration,
                    filter: filter || ''
                });
                
                if (response.success) {
                    this.state.bluetooth.devices = response.data.devices || [];
                    
                    this.updateView({
                        devices: this.state.bluetooth.devices,
                        scanning: false
                    });
                    
                    this.showNotification(
                        `${this.state.bluetooth.devices.length} périphérique(s) trouvé(s)`,
                        'success'
                    );
                    
                    this.emitEvent('bluetooth:scan:completed', {
                        devices: this.state.bluetooth.devices
                    });
                }
                
                this.state.bluetooth.scanning = false;
                return response;
                
            } catch (error) {
                this.state.bluetooth.scanning = false;
                this.updateView({ scanning: false });
                this.handleError('Erreur lors du scan Bluetooth', error);
                throw error;
            }
        });
    }
    
    /**
     * Appairer un périphérique
     */
    async pairDevice(address, pin = '') {
        return this.executeAction('pairDevice', async (data) => {
            try {
                this.showNotification(`Appairage de ${data.address}...`, 'info');
                
                const response = await this.backendService.sendCommand('bluetooth.pair', {
                    address: data.address,
                    pin: data.pin
                });
                
                if (response.success) {
                    this.showNotification(
                        `Périphérique ${data.address} appairé avec succès`,
                        'success'
                    );
                    
                    // Rafraîchir la liste des périphériques appairés
                    await this.listPairedDevices();
                    
                    this.emitEvent('bluetooth:device:paired', {
                        address: data.address
                    });
                }
                
                return response;
            } catch (error) {
                this.handleError(`Erreur lors de l'appairage de ${address}`, error);
                throw error;
            }
        }, { address, pin });
    }
    
    /**
     * Désappairer un périphérique
     */
    async unpairDevice(address) {
        return this.executeAction('unpairDevice', async (data) => {
            try {
                this.showNotification(`Désappairage de ${data.address}...`, 'info');
                
                const response = await this.backendService.sendCommand('bluetooth.unpair', {
                    address: data.address
                });
                
                if (response.success) {
                    this.showNotification(
                        `Périphérique ${data.address} désappairé`,
                        'success'
                    );
                    
                    // Rafraîchir la liste des périphériques appairés
                    await this.listPairedDevices();
                    
                    this.emitEvent('bluetooth:device:unpaired', {
                        address: data.address
                    });
                }
                
                return response;
            } catch (error) {
                this.handleError(`Erreur lors du désappairage de ${address}`, error);
                throw error;
            }
        }, { address });
    }
    
    /**
     * Oublier un périphérique
     */
    async forgetDevice(address) {
        return this.executeAction('forgetDevice', async (data) => {
            try {
                this.showNotification(`Suppression de ${data.address}...`, 'info');
                
                const response = await this.backendService.sendCommand('bluetooth.forget', {
                    address: data.address
                });
                
                if (response.success) {
                    this.showNotification(
                        `Périphérique ${data.address} oublié`,
                        'success'
                    );
                    
                    // Rafraîchir la liste des périphériques appairés
                    await this.listPairedDevices();
                    
                    this.emitEvent('bluetooth:device:forgotten', {
                        address: data.address
                    });
                }
                
                return response;
            } catch (error) {
                this.handleError(`Erreur lors de la suppression de ${address}`, error);
                throw error;
            }
        }, { address });
    }
    
    /**
     * Liste les périphériques appairés
     */
    async listPairedDevices() {
        return this.executeAction('listPairedDevices', async () => {
            try {
                const response = await this.backendService.sendCommand('bluetooth.paired', {});
                
                if (response.success) {
                    this.state.bluetooth.pairedDevices = response.data.devices || [];
                    
                    this.updateView({
                        pairedDevices: this.state.bluetooth.pairedDevices
                    });
                    
                    this.emitEvent('bluetooth:paired:loaded', {
                        devices: this.state.bluetooth.pairedDevices
                    });
                }
                
                return response;
            } catch (error) {
                this.handleError('Erreur lors du chargement des périphériques appairés', error);
                throw error;
            }
        });
    }
    
    /**
     * Obtenir l'intensité du signal d'un périphérique
     */
    async getSignalStrength(device_id) {
        return this.executeAction('getSignalStrength', async (data) => {
            try {
                const response = await this.backendService.sendCommand('bluetooth.signal', {
                    device_id: data.device_id
                });
                
                if (response.success) {
                    const rssi = response.data.rssi || 0;
                    
                    // Mettre à jour le périphérique dans la liste
                    const device = this.state.bluetooth.devices.find(d => d.id === data.device_id);
                    if (device) {
                        device.rssi = rssi;
                    }
                    
                    this.updateView({signalStrength: { device_id: data.device_id, rssi }
                    });
                    
                    this.emitEvent('bluetooth:signal:updated', {device_id: data.device_id,
                        rssi
                    });
                }
                
                return response;
            } catch (error) {
                this.logDebug('error', `Erreur lors de la récupération du signal: ${error.message}`);
                throw error;
            }
        }, {device_id });
    }
    
    /**
     * Démarrer le monitoring des signaux
     */
    startSignalMonitoring() {
        this.stopSignalMonitoring();
        
        this.signalTimer = setInterval(() => {
            if (this.state.bluetooth.devices.length > 0) {
                this.state.bluetooth.devices.forEach(device => {
                    if (device.id) {
                        this.getSignalStrength(device.id);
                    }
                });
            }
        }, this.config.signalUpdateInterval);
        
        this.logDebug('info', 'Signal monitoring started');
    }
    
    /**
     * Arrêter le monitoring des signaux
     */
    stopSignalMonitoring() {
        if (this.signalTimer) {
            clearInterval(this.signalTimer);
            this.signalTimer = null;
            this.logDebug('info', 'Signal monitoring stopped');
        }
    }
    
    /**
     * Met à jour la vue
     */
    updateView(data) {
        if (this.bluetoothView && typeof this.bluetoothView.render === 'function') {
            this.bluetoothView.render(data);
        }
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
     * Obtenir l'état actuel
     */
    getBluetoothState() {
        return {
            ...this.state.bluetooth,
            devicesCount: this.state.bluetooth.devices.length,
            pairedCount: this.state.bluetooth.pairedDevices.length
        };
    }
    
    /**
     * Nettoyage lors de la destruction
     */
    destroy() {
        this.stopSignalMonitoring();
        super.destroy();
    }
}

// ============================================================================
// EXPORT
// ============================================================================

if (typeof module !== 'undefined' && module.exports) {
    module.exports = BluetoothController;
}

if (typeof window !== 'undefined') {
    window.BluetoothController = BluetoothController;
}