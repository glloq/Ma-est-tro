// ============================================================================
// Fichier: frontend/js/controllers/InstrumentController.js
// Chemin rÃ©el: frontend/js/controllers/InstrumentController.js
// Version: v4.3.0 - COMPLET ET CORRIGÃ‰
// Date: 2025-11-06
// ============================================================================
// CORRECTIONS v4.3.0:
// âœ… CRITIQUE: Ajout TOUS les event bindings View â†” Controller
// âœ… CRITIQUE: MÃ©thode updateView() au lieu de render(data)
// âœ… CRITIQUE: Gestion complÃ¨te des requÃªtes View (*_requested)
// âœ… CRITIQUE: Ã‰mission des Ã©vÃ©nements de rÃ©ponse pour la View
// âœ… Gestion hot-plug complÃ¨te
// âœ… Gestion Bluetooth complÃ¨te
// ============================================================================
// CORRECTIONS v4.2.3:
// âœ… CRITIQUE: Ajout paramÃ¨tre backend au constructeur (6Ã¨me paramÃ¨tre)
// âœ… Fix: super() appelle BaseController avec backend
// âœ… this.backend initialisÃ© automatiquement via BaseController
// ============================================================================

class InstrumentController extends BaseController {
    constructor(eventBus, models = {}, views = {}, notifications = null, debugConsole = null, backend = null) {
        super(eventBus, models, views, notifications, debugConsole, backend);
        
        this.logger = window.logger || console;
        this.model = models.instrument;
        this.view = views.instrument;
        // âœ… this.backend initialisÃ© automatiquement par BaseController
        
        this.devices = new Map();
        this.connectedDevices = new Set();
        
        this.hotPlugEnabled = false;
        this.hotPlugInterval = 2000;
        this.hotPlugTimer = null;
        
        this.deviceInfoCache = new Map();
        this.deviceInfoCacheTTL = 30000;
        
        this.isScanning = false;
        this.lastScanTime = null;
        
        this._fullyInitialized = true;
        this.bindEvents();
    }

    bindEvents() {
        // ========================================================================
        // Ã‰VÃ‰NEMENTS BACKEND
        // ========================================================================
        this.eventBus.on('backend:connected', () => this.onBackendConnected());
        this.eventBus.on('backend:disconnected', () => this.onBackendDisconnected());
        this.eventBus.on('backend:device:connected', (data) => this.handleBackendDeviceConnected(data));
        this.eventBus.on('backend:device:disconnected', (data) => this.handleBackendDeviceDisconnected(data));
        this.eventBus.on('backend:device:discovered', (data) => this.handleDeviceDiscovered(data));
        this.eventBus.on('backend:device:error', (data) => this.handleDeviceError(data));
        
        // ========================================================================
        // Ã‰VÃ‰NEMENTS NAVIGATION
        // ========================================================================
        this.eventBus.on('navigation:page_changed', (data) => {
            if (data.page === 'instruments') {
                this.onInstrumentsPageActive();
            } else {
                this.onInstrumentsPageInactive();
            }
        });
        
        // ========================================================================
        // REQUÃŠTES DE LA VIEW (*_requested) - NOUVEAU v4.3.0
        // ========================================================================
        
        // Liste des devices
        this.eventBus.on('devices:list_requested', () => {
            this.handleListRequest();
        });
        
        // Scan des devices
        this.eventBus.on('devices:scan_requested', (data) => {
            this.handleScanRequest(data);
        });
        
        // Connexion device
        this.eventBus.on('devices:connect_requested', (data) => {
            this.handleConnectRequest(data);
        });
        
        // DÃ©connexion device
        this.eventBus.on('devices:disconnect_requested', (data) => {
            this.handleDisconnectRequest(data);
        });
        
        // DÃ©connexion tous devices
        this.eventBus.on('devices:disconnect_all_requested', () => {
            this.handleDisconnectAllRequest();
        });
        
        // Info device
        this.eventBus.on('devices:info_requested', (data) => {
            this.handleDeviceInfoRequest(data);
        });
        
        // Hot-plug start
        this.eventBus.on('hotplug:start_requested', () => {
            this.handleHotPlugStartRequest();
        });
        
        // Hot-plug stop
        this.eventBus.on('hotplug:stop_requested', () => {
            this.handleHotPlugStopRequest();
        });
        
        // Hot-plug status
        this.eventBus.on('hotplug:status_requested', () => {
            this.handleHotPlugStatusRequest();
        });
        
        // Bluetooth scan
        this.eventBus.on('bluetooth:scan_requested', () => {
            this.handleBluetoothScanRequest();
        });
        
        // Bluetooth paired
        this.eventBus.on('bluetooth:paired_requested', () => {
            this.handleBluetoothPairedRequest();
        });
        
        // Bluetooth forget
        this.eventBus.on('bluetooth:forget_requested', (data) => {
            this.handleBluetoothForgetRequest(data);
        });

        // Bluetooth pair
        this.eventBus.on('bluetooth:pair_requested', (data) => {
            this.handleBluetoothPairRequest(data);
        });

        // Bluetooth unpair
        this.eventBus.on('bluetooth:unpair_requested', (data) => {
            this.handleBluetoothUnpairRequest(data);
        });

        // Bluetooth connect
        this.eventBus.on('bluetooth:connect_requested', (data) => {
            this.handleBluetoothConnectRequest(data);
        });

        // Instrument settings
        this.eventBus.on('instrument:settings:requested', (data) => {
            this.handleInstrumentSettingsRequest(data);
        });

        this.eventBus.on('instrument:settings:save', (data) => {
            this.handleInstrumentSettingsSave(data);
        });

        this.eventBus.on('instrument:identity:requested', (data) => {
            this.handleInstrumentIdentityRequest(data);
        });

        // Backend events for device identity
        this.eventBus.on('backend:device_identity', (data) => {
            this.handleDeviceIdentityReceived(data);
        });

        // Autres
        this.eventBus.on('instruments:request_refresh', () => this.refreshDeviceList());

        this.logger?.info?.('InstrumentController', 'âœ" Events bound (v4.3.0 - COMPLET + Settings)');
    }

    async initialize() {
        this.logger?.info?.('InstrumentController', 'Initializing...');

        if (this.backend?.isConnected()) {
            await this.onBackendConnected();
        }
    }

    async onBackendConnected() {
        this.logger?.info?.('InstrumentController', 'âœ" Backend connected');
        
        // NE PAS faire de requêtes automatiques au démarrage
        // Les requêtes seront déclenchées uniquement quand la page Instruments devient active
        this.logger?.info?.('InstrumentController', 'Waiting for instruments page activation...');
    }

    onBackendDisconnected() {
        this.logger?.warn?.('InstrumentController', 'âš ï¸ Backend disconnected');
        this.stopHotPlugMonitoring();
        this.connectedDevices.clear();
        this.updateView();
    }

    // ========================================================================
    // HANDLERS DES REQUÃŠTES VIEW - NOUVEAU v4.3.0
    // ========================================================================

    async handleListRequest() {
        try {
            this.logger?.debug?.('InstrumentController', 'Handling list request');
            await this.refreshDeviceList();
        } catch (error) {
            this.logger?.error?.('InstrumentController', 'handleListRequest failed:', error);
            this.eventBus.emit('devices:list_error', { error: error.message });
        }
    }

    async handleScanRequest(data = {}) {
        try {
            this.logger?.debug?.('InstrumentController', 'Handling scan request');
            const full_scan = data.full_scan || false;
            await this.scanDevices(full_scan);
        } catch (error) {
            this.logger?.error?.('InstrumentController', 'handleScanRequest failed:', error);
            this.eventBus.emit('devices:scan_error', { error: error.message });
        }
    }

    async handleConnectRequest(data) {
        try {
            const device_id = data.device_id;
            if (!device_id) throw new Error('device_id required');
            
            this.logger?.debug?.('InstrumentController', `Handling connect request: ${device_id}`);
            await this.connectDevice(device_id);
        } catch (error) {
            this.logger?.error?.('InstrumentController', 'handleConnectRequest failed:', error);
            this.notifications?.error('Connection failed', error.message);
            this.eventBus.emit('devices:connect_error', { error: error.message });
        }
    }

    async handleDisconnectRequest(data) {
        try {
            const device_id = data.device_id;
            if (!device_id) throw new Error('device_id required');
            
            this.logger?.debug?.('InstrumentController', `Handling disconnect request: ${device_id}`);
            await this.disconnectDevice(device_id);
        } catch (error) {
            this.logger?.error?.('InstrumentController', 'handleDisconnectRequest failed:', error);
            this.notifications?.error('Disconnection failed', error.message);
            this.eventBus.emit('devices:disconnect_error', { error: error.message });
        }
    }

    async handleDisconnectAllRequest() {
        try {
            this.logger?.debug?.('InstrumentController', 'Handling disconnect all request');
            await this.disconnectAllDevices();
        } catch (error) {
            this.logger?.error?.('InstrumentController', 'handleDisconnectAllRequest failed:', error);
            this.notifications?.error('Disconnection failed', error.message);
        }
    }

    async handleDeviceInfoRequest(data) {
        try {
            const device_id = data.device_id;
            if (!device_id) throw new Error('device_id required');
            
            this.logger?.debug?.('InstrumentController', `Handling device info request: ${device_id}`);
            const info = await this.getDeviceInfo(device_id);
            
            this.eventBus.emit('devices:info', {
                device_id,
                info
            });
        } catch (error) {
            this.logger?.error?.('InstrumentController', 'handleDeviceInfoRequest failed:', error);
            this.eventBus.emit('devices:info_error', { error: error.message });
        }
    }

    async handleHotPlugStartRequest() {
        try {
            this.logger?.debug?.('InstrumentController', 'Handling hot-plug start request');
            await this.startHotPlugMonitoring();
            this.notifyHotPlugStatus();
        } catch (error) {
            this.logger?.error?.('InstrumentController', 'handleHotPlugStartRequest failed:', error);
            this.notifications?.error('Hot-plug failed', error.message);
        }
    }

    async handleHotPlugStopRequest() {
        try {
            this.logger?.debug?.('InstrumentController', 'Handling hot-plug stop request');
            await this.stopHotPlugMonitoring();
            this.notifyHotPlugStatus();
        } catch (error) {
            this.logger?.error?.('InstrumentController', 'handleHotPlugStopRequest failed:', error);
            this.notifications?.error('Hot-plug failed', error.message);
        }
    }

    async handleHotPlugStatusRequest() {
        try {
            this.logger?.debug?.('InstrumentController', 'Handling hot-plug status request');
            const status = await this.getHotPlugStatus();
            this.hotPlugEnabled = status?.enabled || false;
            this.notifyHotPlugStatus();
        } catch (error) {
            this.logger?.error?.('InstrumentController', 'handleHotPlugStatusRequest failed:', error);
        }
    }

    async handleBluetoothScanRequest() {
        try {
            this.logger?.debug?.('InstrumentController', 'Handling Bluetooth scan request');

            if (!this.backend) {
                throw new Error('Backend not available');
            }

            // Lancer le scan Bluetooth via le backend
            const response = await this.backend.bluetoothScan();
            const devices = response.devices || [];

            this.logger?.info?.('InstrumentController', `Bluetooth scan complete: ${devices.length} devices found`);

            // Émettre les résultats pour la modal
            this.eventBus.emit('bluetooth:scanned', {
                devices: devices
            });
        } catch (error) {
            this.logger?.error?.('InstrumentController', 'handleBluetoothScanRequest failed:', error);
            this.eventBus.emit('bluetooth:scan_error', { error: error.message });
            this.notifications?.error('Scan Bluetooth échoué', error.message);
        }
    }

    async handleBluetoothPairedRequest() {
        try {
            this.logger?.debug?.('InstrumentController', 'Handling Bluetooth paired request');

            if (!this.backend) {
                throw new Error('Backend not available');
            }

            // Récupérer la liste des appareils appairés
            const response = await this.backend.bluetoothPaired();
            const devices = response.devices || [];

            this.logger?.info?.('InstrumentController', `Bluetooth paired devices: ${devices.length}`);

            // Émettre la liste pour la modal
            this.eventBus.emit('bluetooth:paired_list', {
                devices: devices
            });
        } catch (error) {
            this.logger?.error?.('InstrumentController', 'handleBluetoothPairedRequest failed:', error);
            this.eventBus.emit('bluetooth:paired_list', { devices: [] });
        }
    }

    async handleBluetoothForgetRequest(data) {
        try {
            const address = data.address || data.device_id;
            if (!address) throw new Error('address required');

            this.logger?.debug?.('InstrumentController', `Handling Bluetooth forget request: ${address}`);

            if (!this.backend) {
                throw new Error('Backend not available');
            }

            // Oublier l'appareil Bluetooth
            await this.backend.bluetoothUnpair(address);

            this.logger?.info?.('InstrumentController', `Bluetooth device forgotten: ${address}`);

            // Émettre l'événement de succès
            this.eventBus.emit('bluetooth:forgotten', { device_id: address });
            this.notifications?.success('Appareil oublié', `L'appareil ${address} a été oublié`);

            // Recharger la liste des appareils appairés
            this.handleBluetoothPairedRequest();
        } catch (error) {
            this.logger?.error?.('InstrumentController', 'handleBluetoothForgetRequest failed:', error);
            this.notifications?.error('Erreur', error.message);
        }
    }

    async handleBluetoothPairRequest(data) {
        try {
            const address = data.address || data.device_id;
            const name = data.name || 'Appareil Bluetooth';
            const pin = data.pin || '';

            if (!address) throw new Error('address required');

            this.logger?.debug?.('InstrumentController', `Handling Bluetooth pair request: ${address}`);

            if (!this.backend) {
                throw new Error('Backend not available');
            }

            this.notifications?.info('Appairage en cours', `Appairage de ${name}...`);

            // Appairer l'appareil Bluetooth
            await this.backend.bluetoothPair(address, pin);

            this.logger?.info?.('InstrumentController', `Bluetooth device paired: ${address}`);

            // Émettre l'événement de succès
            this.eventBus.emit('bluetooth:paired', { device_id: address, address: address });
            this.notifications?.success('Appareil appairé', `${name} a été appairé avec succès`);

            // Recharger la liste des appareils appairés
            this.handleBluetoothPairedRequest();
        } catch (error) {
            this.logger?.error?.('InstrumentController', 'handleBluetoothPairRequest failed:', error);
            this.notifications?.error('Appairage échoué', error.message);
        }
    }

    async handleBluetoothUnpairRequest(data) {
        try {
            const address = data.address || data.device_id;
            if (!address) throw new Error('address required');

            this.logger?.debug?.('InstrumentController', `Handling Bluetooth unpair request: ${address}`);

            if (!this.backend) {
                throw new Error('Backend not available');
            }

            // Désappairer l'appareil Bluetooth
            await this.backend.bluetoothUnpair(address);

            this.logger?.info?.('InstrumentController', `Bluetooth device unpaired: ${address}`);

            // Émettre l'événement de succès
            this.eventBus.emit('bluetooth:unpaired', { device_id: address });
            this.notifications?.success('Appareil désappairé', `L'appareil ${address} a été désappairé`);

            // Recharger la liste des appareils appairés
            this.handleBluetoothPairedRequest();
        } catch (error) {
            this.logger?.error?.('InstrumentController', 'handleBluetoothUnpairRequest failed:', error);
            this.notifications?.error('Erreur', error.message);
        }
    }

    async handleBluetoothConnectRequest(data) {
        try {
            const address = data.address || data.device_id;
            if (!address) throw new Error('address required');

            this.logger?.debug?.('InstrumentController', `Handling Bluetooth connect request: ${address}`);

            if (!this.backend) {
                throw new Error('Backend not available');
            }

            this.notifications?.info('Connexion en cours', `Connexion à ${address}...`);

            // Connecter l'appareil Bluetooth
            await this.backend.bluetoothConnect(address);

            this.logger?.info?.('InstrumentController', `Bluetooth device connected: ${address}`);

            // Émettre l'événement de succès
            this.eventBus.emit('bluetooth:connected', { device_id: address });
            this.notifications?.success('Appareil connecté', `Connecté à ${address}`);

            // Rafraîchir la liste des appareils
            this.refreshDeviceList();
        } catch (error) {
            this.logger?.error?.('InstrumentController', 'handleBluetoothConnectRequest failed:', error);
            this.notifications?.error('Connexion échouée', error.message);
        }
    }

    // ========================================================================
    // ACTIONS BACKEND
    // ========================================================================

    /**
     * âœ… CORRECTION: Utiliser devices.scan pour obtenir count
     */
    async scanDevices(full_scan = false) {
        if (!this.backend) {
            throw new Error('Backend not available');
        }

        if (this.isScanning) {
            this.logger?.debug?.('InstrumentController', 'Scan already in progress');
            return [];
        }

        this.isScanning = true;
        
        try {
            // âœ… CORRECTION: devices.scan retourne count
            const response = await this.backend.scanDevices(full_scan);
            
            // âœ… Extraction via response (dÃ©jÃ  data dans BackendService)
            const devices = response.devices || [];
            const count = response.count || devices.length;
            
            devices.forEach(device => {
                this.devices.set(device.id, device);
            });
            
            this.lastScanTime = Date.now();
            
            this.logger?.info?.('InstrumentController', 
                `âœ“ Scan complete: ${count} devices found`);
            
            // âœ… NOUVEAU: Ã‰mettre pour la View
            this.eventBus.emit('devices:scanned', { 
                devices, 
                count 
            });
            
            this.updateView();
            
            return devices;
            
        } catch (error) {
            this.logger?.error?.('InstrumentController', 'scanDevices failed:', error);
            throw error;
        } finally {
            this.isScanning = false;
        }
    }

    async refreshDeviceList() {
        try {
            // âœ… devices.list n'a pas de count
            const response = await this.backend.listDevices();
            const devices = response.devices || [];
            
            devices.forEach(device => {
                this.devices.set(device.id, device);
            });
            
            // âœ… NOUVEAU: Ã‰mettre pour la View
            this.eventBus.emit('devices:listed', { devices });
            
            this.updateView();
            return devices;
            
        } catch (error) {
            this.logger?.error?.('InstrumentController', 'refreshDeviceList failed:', error);
            throw error;
        }
    }

    async loadConnectedDevices() {
        if (!this.backend) return [];
        
        try {
            const response = await this.backend.getConnectedDevices();
            const devices = response.devices || [];
            
            this.connectedDevices.clear();
            devices.forEach(device => {
                this.connectedDevices.add(device.id);
            });
            
            this.updateView();
            return devices;
            
        } catch (error) {
            this.logger?.error?.('InstrumentController', 'loadConnectedDevices failed:', error);
            return [];
        }
    }

    /**
     * âœ… CORRECTION: device_id en snake_case
     */
    async connectDevice(device_id) {
        if (!this.backend) {
            throw new Error('Backend not available');
        }
        
        try {
            this.logger?.info?.('InstrumentController', `Connecting device: ${device_id}`);
            
            await this.backend.connectDevice(device_id);
            
            this.connectedDevices.add(device_id);
            
            // âœ… NOUVEAU: Ã‰mettre pour la View
            this.eventBus.emit('device:connected', { device_id });
            
            this.notifications?.success('Device connected', `Device ${device_id} connected successfully`);
            
            this.updateView();
            
        } catch (error) {
            this.logger?.error?.('InstrumentController', `Failed to connect device ${device_id}:`, error);
            this.notifications?.error('Connection failed', error.message);
            throw error;
        }
    }

    async disconnectDevice(device_id) {
        if (!this.backend) {
            throw new Error('Backend not available');
        }
        
        try {
            this.logger?.info?.('InstrumentController', `Disconnecting device: ${device_id}`);
            
            await this.backend.disconnectDevice(device_id);
            
            this.connectedDevices.delete(device_id);
            
            // âœ… NOUVEAU: Ã‰mettre pour la View
            this.eventBus.emit('device:disconnected', { device_id });
            
            this.notifications?.success('Device disconnected', `Device ${device_id} disconnected`);
            
            this.updateView();
            
        } catch (error) {
            this.logger?.error?.('InstrumentController', `Failed to disconnect device ${device_id}:`, error);
            this.notifications?.error('Disconnection failed', error.message);
            throw error;
        }
    }

    async disconnectAllDevices() {
        if (!this.backend) {
            throw new Error('Backend not available');
        }
        
        try {
            this.logger?.info?.('InstrumentController', 'Disconnecting all devices');
            
            await this.backend.disconnectAllDevices();
            
            this.connectedDevices.clear();
            
            this.eventBus.emit('instruments:all_devices_disconnected');
            
            this.notifications?.success('All disconnected', 'All devices disconnected');
            
            this.updateView();
            
        } catch (error) {
            this.logger?.error?.('InstrumentController', 'Failed to disconnect all devices:', error);
            this.notifications?.error('Disconnection failed', error.message);
            throw error;
        }
    }

    async getDeviceInfo(device_id) {
        const cached = this.deviceInfoCache.get(device_id);
        if (cached && (Date.now() - cached.timestamp) < this.deviceInfoCacheTTL) {
            return cached.info;
        }
        
        if (!this.backend) {
            throw new Error('Backend not available');
        }
        
        try {
            const info = await this.backend.getDevice(device_id);
            
            this.deviceInfoCache.set(device_id, {
                info,
                timestamp: Date.now()
            });
            
            return info;
            
        } catch (error) {
            this.logger?.error?.('InstrumentController', `getDeviceInfo(${device_id}) failed:`, error);
            throw error;
        }
    }

    async startHotPlugMonitoring() {
        if (!this.backend) {
            throw new Error('Backend not available');
        }
        
        try {
            await this.backend.startHotPlug();
            this.hotPlugEnabled = true;
            this.logger?.info?.('InstrumentController', 'Hot-plug monitoring started');
        } catch (error) {
            this.logger?.error?.('InstrumentController', 'Failed to start hot-plug:', error);
            throw error;
        }
    }

    async stopHotPlugMonitoring() {
        if (!this.backend) return;
        
        try {
            await this.backend.stopHotPlug();
            this.hotPlugEnabled = false;
            this.logger?.info?.('InstrumentController', 'Hot-plug monitoring stopped');
        } catch (error) {
            this.logger?.error?.('InstrumentController', 'Failed to stop hot-plug:', error);
        }
    }

    async getHotPlugStatus() {
        if (!this.backend) return null;
        
        try {
            return await this.backend.getHotPlugStatus();
        } catch (error) {
            this.logger?.error?.('InstrumentController', 'getHotPlugStatus failed:', error);
            return null;
        }
    }

    // ========================================================================
    // HANDLERS Ã‰VÃ‰NEMENTS BACKEND
    // ========================================================================

    handleBackendDeviceConnected(data) {
        const device_id = data.device_id || data.id;
        this.logger?.info?.('InstrumentController', `Device connected: ${device_id}`);
        this.connectedDevices.add(device_id);
        
        // âœ… Propager Ã  la View
        this.eventBus.emit('device:connected', { device_id });
        
        this.updateView();
    }

    handleBackendDeviceDisconnected(data) {
        const device_id = data.device_id || data.id;
        this.logger?.info?.('InstrumentController', `Device disconnected: ${device_id}`);
        this.connectedDevices.delete(device_id);
        
        // âœ… Propager Ã  la View
        this.eventBus.emit('device:disconnected', { device_id });
        
        this.updateView();
    }

    handleDeviceDiscovered(data) {
        const device = data.device;
        if (device) {
            this.devices.set(device.id, device);
            this.updateView();
        }
    }

    handleDeviceError(data) {
        const device_id = data.device_id;
        const error = data.error;
        this.logger?.error?.('InstrumentController', `Device error (${device_id}):`, error);
        this.notifications?.error('Device error', `Device ${device_id}: ${error}`);
    }

    onInstrumentsPageActive() {
        // Charger les données quand la page devient active
        if (this.backend?.isConnected?.()) {
            this.scanDevices().catch(err => {
                this.log('warn', 'InstrumentController', 'Scan failed:', err.message);
            });
            
            this.loadConnectedDevices().catch(err => {
                this.log('warn', 'InstrumentController', 'Load devices failed:', err.message);
            });
            
            this.getHotPlugStatus().then(status => {
                if (status?.enabled) {
                    this.hotPlugEnabled = true;
                    this.logger?.info?.('InstrumentController', 'âœ" Hot-plug enabled');
                    this.notifyHotPlugStatus();
                }
            }).catch(err => {
                this.log('warn', 'InstrumentController', 'Hot-plug status failed:', err.message);
            });
        }
    }

    onInstrumentsPageInactive() {
        // Rien pour l'instant
    }

    // ========================================================================
    // MISE Ã€ JOUR VIEW - NOUVEAU v4.3.0
    // ========================================================================

    /**
     * âœ… NOUVELLE MÃ‰THODE: Mise Ã  jour de la View avec les donnÃ©es actuelles
     * Remplace l'ancien this.view.render(data) qui ne fonctionnait pas
     */
    updateView() {
        if (!this.view) return;
        
        const devicesArray = Array.from(this.devices.values());
        
        // SÃ©parer les devices connectÃ©s et disponibles
        const connectedDevices = devicesArray.filter(d => 
            this.connectedDevices.has(d.id) || d.status === 2
        );
        
        const availableDevices = devicesArray.filter(d => 
            !this.connectedDevices.has(d.id) && d.status !== 2
        );
        
        // âœ… NOUVEAU: Ã‰mettre un Ã©vÃ©nement pour que la View se mette Ã  jour
        this.eventBus.emit('devices:listed', {
            devices: devicesArray
        });
        
        this.logger?.debug?.('InstrumentController', `View updated: ${connectedDevices.length} connected, ${availableDevices.length} available`);
    }

    /**
     * âœ… NOUVELLE MÃ‰THODE: Notifier le statut hot-plug Ã  la View
     */
    notifyHotPlugStatus() {
        this.eventBus.emit('hotplug:status', {
            enabled: this.hotPlugEnabled
        });
    }

    // ========================================================================
    // INSTRUMENT SETTINGS HANDLERS
    // ========================================================================

    /**
     * Handle instrument settings request - load and send settings to view
     */
    async handleInstrumentSettingsRequest(data) {
        try {
            const { deviceId } = data;
            if (!deviceId) {
                throw new Error('deviceId required');
            }

            this.logger?.debug?.('InstrumentController', `Loading settings for ${deviceId}`);

            // Get settings from model
            const settings = await this.model.getSettings(deviceId);

            // Send settings to view
            if (this.view && typeof this.view.populateInstrumentSettings === 'function') {
                this.view.populateInstrumentSettings(settings);
            }

            this.logger?.info?.('InstrumentController', `Settings loaded for ${deviceId}`);
        } catch (error) {
            this.logger?.error?.('InstrumentController', 'Failed to load instrument settings:', error);
            this.notifications?.error('Erreur', 'Impossible de charger les réglages de l\'instrument');
        }
    }

    /**
     * Handle instrument settings save
     */
    async handleInstrumentSettingsSave(data) {
        try {
            const { deviceId, settings } = data;
            if (!deviceId || !settings) {
                throw new Error('deviceId and settings required');
            }

            this.logger?.debug?.('InstrumentController', `Saving settings for ${deviceId}`, settings);

            // Save settings via model
            await this.model.updateSettings(deviceId, settings);

            this.logger?.info?.('InstrumentController', `Settings saved for ${deviceId}`);
            this.notifications?.success('Réglages sauvegardés', 'Les réglages de l\'instrument ont été enregistrés');

            // Refresh device list to show updated info
            await this.refreshDeviceList();
        } catch (error) {
            this.logger?.error?.('InstrumentController', 'Failed to save instrument settings:', error);
            this.notifications?.error('Erreur', 'Impossible de sauvegarder les réglages');
        }
    }

    /**
     * Handle SysEx Identity Request
     */
    async handleInstrumentIdentityRequest(data) {
        try {
            const { deviceName, deviceId } = data;
            if (!deviceName) {
                throw new Error('deviceName required');
            }

            this.logger?.debug?.('InstrumentController', `Requesting SysEx Identity for ${deviceName}`);

            // Send identity request via model
            await this.model.requestIdentity(deviceName, deviceId);

            this.notifications?.info('Requête envoyée', 'Demande d\'identité SysEx envoyée. En attente de réponse...');
        } catch (error) {
            this.logger?.error?.('InstrumentController', 'Failed to request SysEx identity:', error);
            this.notifications?.error('Erreur', 'Impossible d\'envoyer la requête SysEx Identity');
        }
    }

    /**
     * Handle device identity received from backend
     */
    handleDeviceIdentityReceived(data) {
        try {
            const { device, identity } = data;

            this.logger?.info?.('InstrumentController', `Received identity for ${device}:`, identity);

            // Update view with identity info
            if (this.view && typeof this.view.updateSysExIdentityInfo === 'function') {
                this.view.updateSysExIdentityInfo(identity);
            }

            this.notifications?.success('Identité reçue', `Instrument identifié: ${identity.manufacturerName || 'Unknown'}`);
        } catch (error) {
            this.logger?.error?.('InstrumentController', 'Failed to handle device identity:', error);
        }
    }

    // ========================================================================
    // GETTERS
    // ========================================================================

    getDevices() {
        return Array.from(this.devices.values());
    }

    getConnectedDevices() {
        return Array.from(this.connectedDevices);
    }

    isDeviceConnected(device_id) {
        return this.connectedDevices.has(device_id);
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = InstrumentController;
}

if (typeof window !== 'undefined') {
    window.InstrumentController = InstrumentController;
}