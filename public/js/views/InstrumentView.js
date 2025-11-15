// ============================================================================
// Fichier: frontend/js/views/InstrumentView.js
// Version: v4.1.2 - FIX UTF-8 COMPLET
// Date: 2025-11-11
// ============================================================================
// CORRECTIONS v4.1.2:
// ✅ Fix: Encodage UTF-8 correct pour tous les émojis et accents français
// ✅ Fix: Messages console avec caractères corrects
// ✅ Fix: Interface utilisateur avec émojis corrects
// ============================================================================

class InstrumentView extends BaseView {
    constructor(containerId, eventBus) {
        super(containerId, eventBus);
        
        this.logger = window.logger || console;
        
        // État interne
        this.viewState = {
            connectedDevices: [],
            availableDevices: [],
            bluetoothDevices: [],
            scanning: {
                usb: false,
                bluetooth: false
            },
            hotPlugEnabled: false,
            selectedDevice: null
        };
        
        // Éléments DOM
        this.elements = {};
        
        this.log('info', '[InstrumentView]', '✦ InstrumentView v4.1.2 initialized (UTF-8 Fix)');
    }

    // ========================================================================
    // INITIALISATION
    // ========================================================================

    init() {
        if (!this.container) {
            this.log('error', '[InstrumentView]', 'Cannot initialize: container not found (#instrument-view)');
            return;
        }
        
        this.render();
        this.cacheElements();
        this.attachEvents();
        this.loadDevices();
        this.checkHotPlugStatus();
        
        this.log('info', '[InstrumentView]', 'Initialized v4.1.2');
    }

    render() {
        if (!this.container) {
            this.log('error', '[InstrumentView]', 'Cannot render: container not found');
            return;
        }
        
        this.container.innerHTML = `
            <div class="page-header">
                <h1>🎸 Gestion des Instruments</h1>
                <div class="header-actions">
                    <button class="btn-hotplug" id="btnToggleHotPlug" 
                            data-enabled="${this.viewState.hotPlugEnabled}">
                        ${this.viewState.hotPlugEnabled ? '🔌 Hot-Plug ON' : '🔌 Hot-Plug OFF'}
                    </button>
                </div>
            </div>
            
            <div class="instruments-layout">
                <!-- Scan et découverte -->
                <div class="instruments-discover">
                    <div class="section-header">
                        <h2>Rechercher et connecter</h2>
                        <div class="discover-controls">
                            <button class="btn-scan ${this.viewState.scanning.usb ? 'scanning' : ''}" 
                                    id="btnScanUSB" data-type="usb">
                                🔌 ${this.viewState.scanning.usb ? 'Scan...' : 'Scan USB'}
                            </button>
                            <button class="btn-scan ${this.viewState.scanning.bluetooth ? 'scanning' : ''}" 
                                    id="btnScanBluetooth" data-type="bluetooth">
                                📡 ${this.viewState.scanning.bluetooth ? 'Scan...' : 'Scan Bluetooth'}
                            </button>
                        </div>
                    </div>
                    
                    <div class="devices-found" id="devicesFound">
                        ${this.renderAvailableDevices()}
                    </div>
                    
                    <!-- Bluetooth paired devices -->
                    <div class="bluetooth-paired" id="bluetoothPaired">
                        ${this.renderBluetoothDevices()}
                    </div>
                </div>
                
                <!-- Instruments connectés -->
                <div class="instruments-connected">
                    <div class="section-header">
                        <h2>Instruments connectés</h2>
                        <button class="btn-disconnect-all" id="btnDisconnectAll">
                            🔌 Tout déconnecter
                        </button>
                    </div>
                    
                    <div class="devices-list" id="connectedDevices">
                        ${this.renderConnectedDevices()}
                    </div>
                </div>
            </div>
        `;
    }

    show() {
        if (this.container) {
            this.container.style.display = 'block';
            this.state.visible = true;
            this.log('debug', '[InstrumentView]', 'Showing view');
        } else {
            this.log('error', '[InstrumentView]', 'Cannot show: container not found');
        }
    }

    hide() {
        if (this.container) {
            this.container.style.display = 'none';
            this.state.visible = false;
        }
    }

    cacheElements() {
        this.elements = {
            btnScanUSB: document.getElementById('btnScanUSB'),
            btnScanBluetooth: document.getElementById('btnScanBluetooth'),
            btnToggleHotPlug: document.getElementById('btnToggleHotPlug'),
            btnDisconnectAll: document.getElementById('btnDisconnectAll'),
            devicesFound: document.getElementById('devicesFound'),
            connectedDevices: document.getElementById('connectedDevices'),
            bluetoothPaired: document.getElementById('bluetoothPaired')
        };
    }

    attachEvents() {
        // Scan buttons
        if (this.elements.btnScanUSB) {
            this.elements.btnScanUSB.addEventListener('click', () => this.scanDevices(true));
        }
        if (this.elements.btnScanBluetooth) {
            this.elements.btnScanBluetooth.addEventListener('click', () => this.scanBluetooth());
        }
        
        // Hot-plug toggle
        if (this.elements.btnToggleHotPlug) {
            this.elements.btnToggleHotPlug.addEventListener('click', () => this.toggleHotPlug());
        }
        
        // Disconnect all
        if (this.elements.btnDisconnectAll) {
            this.elements.btnDisconnectAll.addEventListener('click', () => this.disconnectAll());
        }
        
        // Délégation d'événements
        if (this.elements.devicesFound) {
            this.elements.devicesFound.addEventListener('click', (e) => this.handleAvailableDeviceAction(e));
        }
        if (this.elements.connectedDevices) {
            this.elements.connectedDevices.addEventListener('click', (e) => this.handleConnectedDeviceAction(e));
        }
        if (this.elements.bluetoothPaired) {
            this.elements.bluetoothPaired.addEventListener('click', (e) => this.handleBluetoothAction(e));
        }
        
        // EventBus
        this.setupEventBusListeners();
    }

    setupEventBusListeners() {
        if (!this.eventBus) return;
        
        // devices.list response
        this.eventBus.on('devices:listed', (data) => {
            this.updateDevicesFromList(data.devices || []);
        });
        
        // device:connected event
        this.eventBus.on('device:connected', (data) => {
            this.handleDeviceConnected(data);
        });
        
        // device:disconnected event
        this.eventBus.on('device:disconnected', (data) => {
            this.handleDeviceDisconnected(data);
        });
        
        // devices.scan response
        this.eventBus.on('devices:scanned', (data) => {
            this.viewState.availableDevices = data.devices || [];
            this.viewState.scanning.usb = false;
            this.renderAvailableDevicesList();
        });
        
        // bluetooth.scan response
        this.eventBus.on('bluetooth:scanned', (data) => {
            this.viewState.availableDevices = data.devices || [];
            this.viewState.scanning.bluetooth = false;
            this.renderAvailableDevicesList();
        });
        
        // bluetooth.paired response
        this.eventBus.on('bluetooth:paired_list', (data) => {
            this.viewState.bluetoothDevices = data.devices || [];
            this.renderBluetoothDevicesList();
        });
        
        // hot-plug status
        this.eventBus.on('hotplug:status', (data) => {
            this.viewState.hotPlugEnabled = data.enabled || false;
            this.updateHotPlugButton();
        });
    }

    // ========================================================================
    // RENDERING - AVAILABLE DEVICES
    // ========================================================================

    renderAvailableDevices() {
        const devices = this.viewState.availableDevices;
        
        if (devices.length === 0 && !this.viewState.scanning.usb && !this.viewState.scanning.bluetooth) {
            return `
                <div class="devices-empty">
                    <div class="empty-icon">🔍</div>
                    <p>Aucun périphérique détecté</p>
                    <p class="text-muted">Cliquez sur "Scan USB" ou "Scan Bluetooth" pour rechercher</p>
                </div>
            `;
        }
        
        if (this.viewState.scanning.usb || this.viewState.scanning.bluetooth) {
            return `
                <div class="devices-scanning">
                    <div class="spinner"></div>
                    <p>Recherche en cours...</p>
                </div>
            `;
        }
        
        return `
            <div class="devices-grid">
                ${devices.map(device => this.renderAvailableDeviceCard(device)).join('')}
            </div>
        `;
    }

    renderAvailableDeviceCard(device) {
        const typeIcon = device.type === 'usb' ? '🔌' : 
                        device.type === 'bluetooth' ? '📡' : 
                        device.type === 'network' ? '🌐' : '🎹';
        
        return `
            <div class="device-card available" data-device-id="${device.id}">
                <div class="device-icon">${typeIcon}</div>
                <div class="device-info">
                    <div class="device-name">${this.escapeHtml(device.name)}</div>
                    <div class="device-type">${device.type.toUpperCase()}</div>
                    ${device.ports ? `<div class="device-ports">${device.ports.in}→${device.ports.out}</div>` : ''}
                </div>
                <div class="device-actions">
                    <button class="btn-connect" data-action="connect">Connecter</button>
                </div>
            </div>
        `;
    }

    renderAvailableDevicesList() {
        if (this.elements.devicesFound) {
            this.elements.devicesFound.innerHTML = this.renderAvailableDevices();
        }
    }

    // ========================================================================
    // RENDERING - CONNECTED DEVICES
    // ========================================================================

    renderConnectedDevices() {
        const devices = this.viewState.connectedDevices;
        
        if (devices.length === 0) {
            return `
                <div class="devices-empty">
                    <div class="empty-icon">🎸</div>
                    <p>Aucun instrument connecté</p>
                    <p class="text-muted">Connectez des périphériques MIDI pour commencer</p>
                </div>
            `;
        }
        
        return `
            <div class="devices-grid">
                ${devices.map(device => this.renderConnectedDeviceCard(device)).join('')}
            </div>
        `;
    }

    renderConnectedDeviceCard(device) {
        const typeIcon = device.type === 'usb' ? '🔌' : 
                        device.type === 'bluetooth' ? '📡' : 
                        device.type === 'network' ? '🌐' : '🎹';
        
        const statusClass = device.active ? 'active' : 'idle';
        
        return `
            <div class="device-card connected ${statusClass}" data-device-id="${device.id}">
                <div class="device-icon">${typeIcon}</div>
                <div class="device-info">
                    <div class="device-name">${this.escapeHtml(device.name)}</div>
                    <div class="device-status">
                        <span class="status-indicator ${statusClass}"></span>
                        <span class="status-text">${device.active ? 'Actif' : 'Inactif'}</span>
                    </div>
                    ${device.ports ? `<div class="device-ports">${device.ports.in}→${device.ports.out}</div>` : ''}
                </div>
                <div class="device-actions">
                    <button class="btn-test" data-action="test" title="Tester">🎵</button>
                    <button class="btn-disconnect" data-action="disconnect" title="Déconnecter">🔌</button>
                </div>
            </div>
        `;
    }

    renderConnectedDevicesList() {
        if (this.elements.connectedDevices) {
            this.elements.connectedDevices.innerHTML = this.renderConnectedDevices();
        }
    }

    // ========================================================================
    // RENDERING - BLUETOOTH DEVICES
    // ========================================================================

    renderBluetoothDevices() {
        const devices = this.viewState.bluetoothDevices;
        
        if (devices.length === 0) {
            return '';
        }
        
        return `
            <div class="bluetooth-section">
                <h3>Appareils Bluetooth appairés</h3>
                <div class="devices-grid">
                    ${devices.map(device => this.renderBluetoothDeviceCard(device)).join('')}
                </div>
            </div>
        `;
    }

    renderBluetoothDeviceCard(device) {
        return `
            <div class="device-card bluetooth" data-device-address="${device.address}">
                <div class="device-icon">📡</div>
                <div class="device-info">
                    <div class="device-name">${this.escapeHtml(device.name || device.address)}</div>
                    <div class="device-address">${device.address}</div>
                </div>
                <div class="device-actions">
                    <button class="btn-pair" data-action="pair">Connecter</button>
                    <button class="btn-unpair" data-action="unpair">Oublier</button>
                </div>
            </div>
        `;
    }

    renderBluetoothDevicesList() {
        if (this.elements.bluetoothPaired) {
            this.elements.bluetoothPaired.innerHTML = this.renderBluetoothDevices();
        }
    }

    // ========================================================================
    // ACTIONS
    // ========================================================================

    scanDevices(usb = true) {
        this.viewState.scanning.usb = usb;
        this.render();
        
        if (this.eventBus) {
            this.eventBus.emit('devices:scan_requested');
        }
    }

    scanBluetooth() {
        this.viewState.scanning.bluetooth = true;
        this.render();
        
        if (this.eventBus) {
            this.eventBus.emit('bluetooth:scan_requested');
        }
    }

    toggleHotPlug() {
        if (this.eventBus) {
            this.eventBus.emit('hotplug:toggle_requested');
        }
    }

    disconnectAll() {
        if (confirm('Déconnecter tous les instruments ?')) {
            if (this.eventBus) {
                this.eventBus.emit('devices:disconnect_all_requested');
            }
        }
    }

    handleAvailableDeviceAction(e) {
        const action = e.target.dataset.action;
        if (!action) return;
        
        const card = e.target.closest('.device-card');
        const deviceId = card?.dataset.deviceId;
        
        if (action === 'connect' && deviceId) {
            this.connectDevice(deviceId);
        }
    }

    handleConnectedDeviceAction(e) {
        const action = e.target.dataset.action;
        if (!action) return;
        
        const card = e.target.closest('.device-card');
        const deviceId = card?.dataset.deviceId;
        
        if (!deviceId) return;
        
        switch (action) {
            case 'test':
                this.testDevice(deviceId);
                break;
            case 'disconnect':
                this.disconnectDevice(deviceId);
                break;
        }
    }

    handleBluetoothAction(e) {
        const action = e.target.dataset.action;
        if (!action) return;
        
        const card = e.target.closest('.device-card');
        const address = card?.dataset.deviceAddress;
        
        if (!address) return;
        
        switch (action) {
            case 'pair':
                this.pairBluetoothDevice(address);
                break;
            case 'unpair':
                this.unpairBluetoothDevice(address);
                break;
        }
    }

    connectDevice(deviceId) {
        if (this.eventBus) {
            this.eventBus.emit('device:connect_requested', { device_id: deviceId });
        }
    }

    disconnectDevice(deviceId) {
        if (this.eventBus) {
            this.eventBus.emit('device:disconnect_requested', { device_id: deviceId });
        }
    }

    testDevice(deviceId) {
        if (this.eventBus) {
            this.eventBus.emit('device:test_requested', { device_id: deviceId });
        }
    }

    pairBluetoothDevice(address) {
        if (this.eventBus) {
            this.eventBus.emit('bluetooth:pair_requested', { address });
        }
    }

    unpairBluetoothDevice(address) {
        if (this.eventBus) {
            this.eventBus.emit('bluetooth:unpair_requested', { address });
        }
    }

    // ========================================================================
    // DEVICE UPDATES
    // ========================================================================

    updateDevicesFromList(devices) {
        this.viewState.connectedDevices = devices.filter(d => d.connected);
        this.renderConnectedDevicesList();
    }

    handleDeviceConnected(data) {
        const device = data.device;
        if (!device) return;
        
        // Ajouter aux connectés
        const exists = this.viewState.connectedDevices.find(d => d.id === device.id);
        if (!exists) {
            this.viewState.connectedDevices.push(device);
            this.renderConnectedDevicesList();
        }
        
        // Retirer des disponibles
        this.viewState.availableDevices = this.viewState.availableDevices.filter(d => d.id !== device.id);
        this.renderAvailableDevicesList();
    }

    handleDeviceDisconnected(data) {
        const deviceId = data.device_id;
        if (!deviceId) return;
        
        // Retirer des connectés
        this.viewState.connectedDevices = this.viewState.connectedDevices.filter(d => d.id !== deviceId);
        this.renderConnectedDevicesList();
    }

    updateHotPlugButton() {
        if (this.elements.btnToggleHotPlug) {
            this.elements.btnToggleHotPlug.dataset.enabled = this.viewState.hotPlugEnabled;
            this.elements.btnToggleHotPlug.textContent = this.viewState.hotPlugEnabled ? 
                '🔌 Hot-Plug ON' : '🔌 Hot-Plug OFF';
        }
    }

    // ========================================================================
    // DATA LOADING
    // ========================================================================

    loadDevices() {
        if (this.eventBus) {
            this.eventBus.emit('devices:list_requested');
        }
    }

    checkHotPlugStatus() {
        if (this.eventBus) {
            this.eventBus.emit('hotplug:status_requested');
        }
    }

    // ========================================================================
    // UTILITY
    // ========================================================================

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// ============================================================================
// EXPORT
// ============================================================================

if (typeof module !== 'undefined' && module.exports) {
    module.exports = InstrumentView;
}

if (typeof window !== 'undefined') {
    window.InstrumentView = InstrumentView;
}