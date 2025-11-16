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
                        device.type === 'network' ? '🌐' :
                        device.type === 'virtual' ? '🎹' : '🎵';

        // Device is active if status is 2 (connected) or if explicitly marked as active
        const isActive = device.status === 2 || device.active;
        const statusClass = isActive ? 'active' : 'idle';

        return `
            <div class="device-card connected ${statusClass}" data-device-id="${device.id}">
                <div class="device-icon">${typeIcon}</div>
                <div class="device-info">
                    <div class="device-name">${this.escapeHtml(device.name)}</div>
                    <div class="device-status">
                        <span class="status-indicator ${statusClass}"></span>
                        <span class="status-text">${isActive ? 'Connecté' : 'Inactif'}</span>
                    </div>
                    ${device.ports ? `<div class="device-ports">${device.ports.in}→${device.ports.out}</div>` : ''}
                </div>
                <div class="device-actions">
                    <button class="btn-settings" data-action="settings" title="Réglages">⚙️</button>
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
            case 'settings':
                this.showInstrumentSettingsModal(deviceId);
                break;
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
        // Filter connected devices (status === 2 means connected)
        this.viewState.connectedDevices = devices.filter(d => d.status === 2 || d.connected);
        this.viewState.availableDevices = devices.filter(d => d.status !== 2 && !d.connected);

        this.renderConnectedDevicesList();
        this.renderAvailableDevicesList();
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
    // INSTRUMENT SETTINGS MODAL
    // ========================================================================

    showInstrumentSettingsModal(deviceId) {
        const device = this.viewState.connectedDevices.find(d => d.id === deviceId);
        if (!device) {
            this.log('error', '[InstrumentView]', `Device not found: ${deviceId}`);
            return;
        }

        // Create modal container if it doesn't exist
        let modal = document.getElementById('instrumentSettingsModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'instrumentSettingsModal';
            modal.className = 'modal';
            document.body.appendChild(modal);
        }

        // Emit event to request current settings
        this.eventBus?.emit('instrument:settings:requested', { deviceId });

        // Render modal content
        modal.innerHTML = `
            <div class="modal-content instrument-settings-modal">
                <div class="modal-header">
                    <h2>⚙️ Réglages de l'instrument</h2>
                    <button class="modal-close" data-action="close-modal">&times;</button>
                </div>

                <div class="modal-body">
                    <div class="settings-section">
                        <h3>Informations</h3>
                        <div class="form-group">
                            <label>Nom du périphérique</label>
                            <input type="text" id="deviceOriginalName" value="${this.escapeHtml(device.name)}" disabled class="form-control" />
                        </div>

                        <div class="form-group">
                            <label>Nom personnalisé</label>
                            <input type="text" id="deviceCustomName" placeholder="Mon Piano, Mon Synthé..." class="form-control" />
                            <small class="form-text">Optionnel : donnez un nom personnalisé à votre instrument</small>
                        </div>
                    </div>

                    <div class="settings-section">
                        <h3>Synchronisation</h3>
                        <div class="form-group">
                            <label>Délai de synchronisation (ms)</label>
                            <input type="number" id="deviceSyncDelay" value="0" step="0.1" class="form-control" />
                            <small class="form-text">
                                Délai en millisecondes pour synchroniser cet instrument avec d'autres.<br/>
                                Valeur positive = retarder, négative = avancer
                            </small>
                        </div>
                    </div>

                    <div class="settings-section">
                        <h3>Adresse MAC (Bluetooth)</h3>
                        <div class="form-group">
                            <label>Adresse MAC</label>
                            <input type="text" id="deviceMacAddress" placeholder="XX:XX:XX:XX:XX:XX" class="form-control"
                                   pattern="^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$" />
                            <small class="form-text">
                                L'adresse MAC permet de retrouver les réglages même si le périphérique change de nom
                            </small>
                        </div>
                    </div>

                    <div class="settings-section">
                        <h3>Identification SysEx</h3>
                        <div class="form-group">
                            <button class="btn-primary" id="btnRequestIdentity">
                                📨 Demander l'identité (SysEx)
                            </button>
                            <small class="form-text">
                                Envoie une requête SysEx Identity Request pour identifier automatiquement l'instrument
                            </small>
                        </div>

                        <div id="sysexIdentityInfo" class="identity-info" style="display: none;">
                            <div class="info-group">
                                <label>Fabricant</label>
                                <div id="sysexManufacturer" class="info-value">-</div>
                            </div>
                            <div class="info-group">
                                <label>Famille</label>
                                <div id="sysexFamily" class="info-value">-</div>
                            </div>
                            <div class="info-group">
                                <label>Modèle</label>
                                <div id="sysexModel" class="info-value">-</div>
                            </div>
                            <div class="info-group">
                                <label>Version</label>
                                <div id="sysexVersion" class="info-value">-</div>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="modal-footer">
                    <button class="btn-secondary" data-action="close-modal">Annuler</button>
                    <button class="btn-primary" data-action="save-settings">💾 Sauvegarder</button>
                </div>
            </div>
        `;

        // Show modal
        modal.style.display = 'flex';

        // Attach event listeners
        this.attachModalEvents(modal, deviceId, device.name);
    }

    attachModalEvents(modal, deviceId, deviceName) {
        // Close modal
        modal.querySelectorAll('[data-action="close-modal"]').forEach(btn => {
            btn.addEventListener('click', () => {
                modal.style.display = 'none';
            });
        });

        // Request SysEx Identity
        const btnRequestIdentity = modal.querySelector('#btnRequestIdentity');
        if (btnRequestIdentity) {
            btnRequestIdentity.addEventListener('click', () => {
                this.log('info', '[InstrumentView]', `Requesting SysEx Identity for ${deviceName}`);
                this.eventBus?.emit('instrument:identity:requested', {
                    deviceName: deviceName,
                    deviceId: deviceId
                });
                btnRequestIdentity.disabled = true;
                btnRequestIdentity.textContent = '⏳ Envoi en cours...';

                // Re-enable after 3 seconds
                setTimeout(() => {
                    btnRequestIdentity.disabled = false;
                    btnRequestIdentity.textContent = '📨 Demander l\'identité (SysEx)';
                }, 3000);
            });
        }

        // Save settings
        const btnSave = modal.querySelector('[data-action="save-settings"]');
        if (btnSave) {
            btnSave.addEventListener('click', () => {
                const customName = modal.querySelector('#deviceCustomName').value;
                const syncDelay = parseFloat(modal.querySelector('#deviceSyncDelay').value) * 1000; // Convert ms to microseconds
                const macAddress = modal.querySelector('#deviceMacAddress').value;

                this.log('info', '[InstrumentView]', `Saving settings for ${deviceId}`, {
                    customName,
                    syncDelay,
                    macAddress
                });

                this.eventBus?.emit('instrument:settings:save', {
                    deviceId: deviceId,
                    settings: {
                        custom_name: customName || null,
                        sync_delay: syncDelay || 0,
                        mac_address: macAddress || null
                    }
                });

                modal.style.display = 'none';
            });
        }

        // Close modal on background click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.style.display = 'none';
            }
        });
    }

    updateSysExIdentityInfo(identity) {
        const modal = document.getElementById('instrumentSettingsModal');
        if (!modal) return;

        const infoSection = modal.querySelector('#sysexIdentityInfo');
        if (!infoSection) return;

        // Update info values
        const manufacturerEl = modal.querySelector('#sysexManufacturer');
        const familyEl = modal.querySelector('#sysexFamily');
        const modelEl = modal.querySelector('#sysexModel');
        const versionEl = modal.querySelector('#sysexVersion');

        if (manufacturerEl) manufacturerEl.textContent = identity.manufacturerName || identity.manufacturerId || '-';
        if (familyEl) familyEl.textContent = identity.deviceFamily || '-';
        if (modelEl) modelEl.textContent = identity.deviceFamilyMember || '-';
        if (versionEl) versionEl.textContent = identity.softwareRevision || '-';

        // Show info section
        infoSection.style.display = 'block';

        this.log('info', '[InstrumentView]', 'SysEx Identity info updated', identity);
    }

    populateInstrumentSettings(settings) {
        const modal = document.getElementById('instrumentSettingsModal');
        if (!modal || !settings) return;

        const customNameInput = modal.querySelector('#deviceCustomName');
        const syncDelayInput = modal.querySelector('#deviceSyncDelay');
        const macAddressInput = modal.querySelector('#deviceMacAddress');

        if (customNameInput && settings.custom_name) {
            customNameInput.value = settings.custom_name;
        }

        if (syncDelayInput && settings.sync_delay !== undefined) {
            // Convert microseconds to milliseconds for display
            syncDelayInput.value = (settings.sync_delay / 1000).toFixed(1);
        }

        if (macAddressInput && settings.mac_address) {
            macAddressInput.value = settings.mac_address;
        }

        // Populate SysEx identity if available
        if (settings.sysex_manufacturer_id) {
            this.updateSysExIdentityInfo({
                manufacturerId: settings.sysex_manufacturer_id,
                manufacturerName: settings.sysex_manufacturer_name || 'Unknown',
                deviceFamily: settings.sysex_family,
                deviceFamilyMember: settings.sysex_model,
                softwareRevision: settings.sysex_version
            });
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