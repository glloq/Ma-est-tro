// ============================================================================
// Fichier: frontend/js/views/BluetoothView.js
// Chemin réel: frontend/js/views/BluetoothView.js
// Version: v4.1.0 - SIGNATURE CORRIGÉE (HÉRITE DE BASEVIEW)
// Date: 2025-11-11
// ============================================================================
// CORRECTIONS v4.1.0:
// ✅ CRITIQUE: BluetoothView hérite maintenant de BaseView
// ✅ Appel super(containerId, eventBus) au début du constructeur
// ✅ Suppression réimplémentation manuelle de resolveContainer
// ✅ Accès aux méthodes BaseView (render, update, show, hide, emit, etc.)
// ✅ Utilisation de this.log() au lieu de console.log
// ✅ État spécifique renommé btState pour éviter conflit avec BaseView.state
// ============================================================================
// AMÉLIORATIONS v4.0.0:
// ✦ Gestion appareils Bluetooth MIDI
// ✦ Scan et découverte
// ✦ Appairage et connexion
// ✦ Liste appareils paired/available
// ============================================================================

class BluetoothView extends BaseView {
    constructor(containerId, eventBus) {
        // ✅ NOUVEAU: Appel super() pour hériter de BaseView
        super(containerId, eventBus);
        
        // ✅ this.container et this.eventBus déjà initialisés par BaseView
        this.logger = window.logger || console;
        
        // État spécifique Bluetooth
        this.btState = {
            scanning: false,
            pairedDevices: [],
            availableDevices: [],
            selectedDevice: null
        };
        
        this.log('info', 'BluetoothView v4.1.0 initialized');
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
        this.loadPairedDevices();
        
        this.log('info', 'BluetoothView initialized');
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
            <div class="bluetooth-view">
                <div class="bt-header">
                    <h2>📡 Bluetooth MIDI</h2>
                    <button data-action="scan" ${this.btState.scanning ? 'disabled' : ''}>
                        ${this.btState.scanning ? '🔄 Scan...' : '🔍 Scanner'}
                    </button>
                </div>
                
                <div class="bt-paired">
                    <h3>Appareils appairés</h3>
                    <div class="device-list">
                        ${this.btState.pairedDevices.length > 0 ? 
                            this.btState.pairedDevices.map(d => this.renderDevice(d, true)).join('') :
                            '<p class="empty">Aucun appareil appairé</p>'}
                    </div>
                </div>
                
                <div class="bt-available">
                    <h3>Appareils disponibles</h3>
                    <div class="device-list">
                        ${this.btState.availableDevices.length > 0 ?
                            this.btState.availableDevices.map(d => this.renderDevice(d, false)).join('') :
                            '<p class="empty">Lancez un scan pour découvrir des appareils</p>'}
                    </div>
                </div>
            </div>
        `;
        
        // Marquer comme rendu
        this.state.rendered = true;
        this.state.lastUpdate = Date.now();
        
        this.log('debug', 'BluetoothView rendered');
    }

    /**
     * Rendu d'un appareil Bluetooth
     * @param {Object} device - Appareil Bluetooth
     * @param {boolean} isPaired - Est appairé?
     * @returns {string} HTML
     */
    renderDevice(device, isPaired) {
        return `
            <div class="bt-device" data-device-id="${device.id}">
                <div class="device-info">
                    <div class="device-name">${device.name || 'Appareil Bluetooth'}</div>
                    <div class="device-address">${device.address || '—'}</div>
                    ${device.signal ? `<div class="device-signal">Signal: ${device.signal}%</div>` : ''}
                </div>
                <div class="device-actions">
                    ${isPaired ? `
                        <button data-action="connect" class="btn-primary">Connecter</button>
                        <button data-action="forget" class="btn-danger">Oublier</button>
                    ` : `
                        <button data-action="pair" class="btn-primary">Appairer</button>
                    `}
                </div>
            </div>
        `;
    }

    // ========================================================================
    // ÉVÉNEMENTS
    // ========================================================================

    attachEvents() {
        if (!this.container) return;
        
        // Événements DOM - Click handler
        const clickHandler = (e) => {
            const action = e.target.dataset.action;
            const deviceEl = e.target.closest('.bt-device');
            const deviceId = deviceEl?.dataset.deviceId;
            
            switch(action) {
                case 'scan':
                    this.scan();
                    break;
                case 'pair':
                    if (deviceId) this.pair(deviceId);
                    break;
                case 'connect':
                    if (deviceId) this.connect(deviceId);
                    break;
                case 'forget':
                    if (deviceId) this.forget(deviceId);
                    break;
            }
        };
        
        this.container.addEventListener('click', clickHandler);
        this.addDOMListener(this.container, 'click', clickHandler);
        
        // Événements EventBus
        if (this.eventBus) {
            this.on('bluetooth:scanned', (data) => {
                this.log('info', `Scan completed: ${data.devices?.length || 0} devices found`);
                this.btState.availableDevices = data.devices || [];
                this.btState.scanning = false;
                this.render();
            });
            
            this.on('bluetooth:paired_list', (data) => {
                this.log('info', `Paired devices updated: ${data.devices?.length || 0} devices`);
                this.btState.pairedDevices = data.devices || [];
                this.render();
            });
            
            this.on('bluetooth:scan_failed', (data) => {
                this.log('error', 'Bluetooth scan failed:', data.error);
                this.btState.scanning = false;
                this.render();
            });
            
            this.on('bluetooth:paired', (data) => {
                this.log('info', `Device paired: ${data.device_id}`);
                this.loadPairedDevices();
            });
            
            this.on('bluetooth:forgotten', (data) => {
                this.log('info', `Device forgotten: ${data.device_id}`);
                this.loadPairedDevices();
            });
            
            this.log('debug', 'Event listeners attached');
        }
    }

    // ========================================================================
    // ACTIONS BLUETOOTH
    // ========================================================================

    /**
     * Lance un scan Bluetooth
     */
    scan() {
        this.log('info', 'Starting Bluetooth scan');
        this.btState.scanning = true;
        this.render();
        
        if (this.eventBus) {
            this.emit('bluetooth:scan_requested');
        } else {
            this.log('error', 'Cannot scan: EventBus not available');
            this.btState.scanning = false;
            this.render();
        }
    }

    /**
     * Appaire un appareil
     * @param {string} deviceId - ID de l'appareil
     */
    pair(deviceId) {
        this.log('info', `Pairing device: ${deviceId}`);
        
        if (this.eventBus) {
            this.emit('bluetooth:pair_requested', { device_id: deviceId });
        } else {
            this.log('error', 'Cannot pair: EventBus not available');
        }
    }

    /**
     * Connecte un appareil appairé
     * @param {string} deviceId - ID de l'appareil
     */
    connect(deviceId) {
        this.log('info', `Connecting device: ${deviceId}`);
        
        if (this.eventBus) {
            this.emit('devices:connect_requested', { device_id: deviceId });
        } else {
            this.log('error', 'Cannot connect: EventBus not available');
        }
    }

    /**
     * Oublie un appareil appairé
     * @param {string} deviceId - ID de l'appareil
     */
    forget(deviceId) {
        this.log('info', `Forgetting device: ${deviceId}`);
        
        if (this.eventBus) {
            this.emit('bluetooth:forget_requested', { device_id: deviceId });
        } else {
            this.log('error', 'Cannot forget: EventBus not available');
        }
    }

    /**
     * Charge la liste des appareils appairés
     */
    loadPairedDevices() {
        this.log('debug', 'Loading paired devices');
        
        if (this.eventBus) {
            this.emit('bluetooth:paired_requested');
        } else {
            this.log('error', 'Cannot load paired devices: EventBus not available');
        }
    }

    // ========================================================================
    // MÉTHODES PUBLIQUES
    // ========================================================================

    /**
     * Met à jour la liste des appareils disponibles
     * @param {Array} devices - Liste des appareils
     */
    updateAvailableDevices(devices) {
        this.btState.availableDevices = devices || [];
        this.render();
        this.log('debug', `Available devices updated: ${this.btState.availableDevices.length}`);
    }

    /**
     * Met à jour la liste des appareils appairés
     * @param {Array} devices - Liste des appareils
     */
    updatePairedDevices(devices) {
        this.btState.pairedDevices = devices || [];
        this.render();
        this.log('debug', `Paired devices updated: ${this.btState.pairedDevices.length}`);
    }

    /**
     * Sélectionne un appareil
     * @param {string} deviceId - ID de l'appareil
     */
    selectDevice(deviceId) {
        this.btState.selectedDevice = deviceId;
        this.log('debug', `Device selected: ${deviceId}`);
    }

    /**
     * Efface la liste des appareils disponibles
     */
    clearAvailableDevices() {
        this.btState.availableDevices = [];
        this.render();
        this.log('debug', 'Available devices cleared');
    }

    // ========================================================================
    // LIFECYCLE - NETTOYAGE
    // ========================================================================

    /**
     * Détruit la vue et nettoie les ressources
     */
    destroy() {
        this.log('debug', 'Destroying BluetoothView');
        
        // Nettoyer l'état
        this.btState.availableDevices = [];
        this.btState.pairedDevices = [];
        this.btState.scanning = false;
        this.btState.selectedDevice = null;
        
        // Appeler super.destroy() pour cleanup BaseView
        super.destroy();
        
        this.log('info', 'BluetoothView destroyed');
    }
}

// ============================================================================
// EXPORT GLOBAL
// ============================================================================

if (typeof window !== 'undefined') {
    window.BluetoothView = BluetoothView;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = BluetoothView;
}