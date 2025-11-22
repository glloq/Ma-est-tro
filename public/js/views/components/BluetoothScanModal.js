// ============================================================================
// Fichier: frontend/js/views/components/BluetoothScanModal.js
// Version: v1.0.0
// Date: 2025-11-16
// ============================================================================
// Description:
//   Modal personnalisée pour scanner et connecter des instruments Bluetooth
//   - Affichage des périphériques disponibles
//   - Appairage et connexion
//   - Interface utilisateur intuitive
// ============================================================================

class BluetoothScanModal {
    constructor(eventBus) {
        this.eventBus = eventBus || window.eventBus || null;
        this.logger = window.logger || console;

        this.container = null;
        this.isOpen = false;
        this.scanning = false;
        this.bluetoothEnabled = true; // État du Bluetooth
        this.bluetoothState = 'unknown'; // État détaillé
        this.availableDevices = [];
        this.pairedDevices = [];

        this.setupEventListeners();

        this.logger.info('BluetoothScanModal', '✓ Modal initialized v1.0.0');
    }

    // ========================================================================
    // ÉVÉNEMENTS
    // ========================================================================

    setupEventListeners() {
        if (!this.eventBus) return;

        // Réponse du scan Bluetooth
        this.eventBus.on('bluetooth:scanned', (data) => {
            this.handleScanComplete(data);
        });

        // Réponse de la liste des appareils appairés
        this.eventBus.on('bluetooth:paired_list', (data) => {
            this.handlePairedList(data);
        });

        // Appairage réussi
        this.eventBus.on('bluetooth:paired', (data) => {
            this.handleDevicePaired(data);
        });

        // Erreur de scan
        this.eventBus.on('bluetooth:scan_error', (data) => {
            this.handleScanError(data);
        });

        // État du Bluetooth
        this.eventBus.on('bluetooth:status', (data) => {
            this.handleBluetoothStatus(data);
        });

        // Bluetooth activé
        this.eventBus.on('bluetooth:powered_on', (data) => {
            this.handleBluetoothPoweredOn(data);
        });

        // Bluetooth désactivé
        this.eventBus.on('bluetooth:powered_off', (data) => {
            this.handleBluetoothPoweredOff(data);
        });

        // Périphérique oublié
        this.eventBus.on('bluetooth:unpaired', (data) => {
            this.handleDeviceUnpaired(data);
        });

        this.logger.debug('BluetoothScanModal', 'Event listeners configured');
    }

    // ========================================================================
    // AFFICHAGE DE LA MODAL
    // ========================================================================

    /**
     * Ouvre la modal et lance le scan
     */
    open() {
        if (this.isOpen) {
            this.logger.warn('BluetoothScanModal', 'Modal already open');
            return;
        }

        this.isOpen = true;
        this.availableDevices = [];
        this.pairedDevices = [];

        this.createModal();
        this.checkBluetoothStatus(); // Vérifier l'état du Bluetooth

        this.logger.info('BluetoothScanModal', 'Modal opened');
    }

    /**
     * Ferme la modal
     */
    close() {
        if (!this.isOpen) return;

        this.isOpen = false;
        this.scanning = false;

        if (this.container) {
            this.container.remove();
            this.container = null;
        }

        this.logger.info('BluetoothScanModal', 'Modal closed');
    }

    /**
     * Crée le DOM de la modal
     */
    createModal() {
        // Supprimer l'ancienne modal si elle existe
        if (this.container) {
            this.container.remove();
        }

        // Créer la nouvelle modal
        this.container = document.createElement('div');
        this.container.className = 'modal-overlay bluetooth-scan-modal';
        this.container.innerHTML = this.renderModalContent();

        document.body.appendChild(this.container);

        // Attacher les événements
        this.attachModalEvents();
    }

    /**
     * Rendu du contenu de la modal
     */
    renderModalContent() {
        return `
            <div class="modal-dialog modal-lg">
                <div class="modal-header">
                    <h2>📡 Recherche d'instruments Bluetooth</h2>
                    <button class="modal-close" data-action="close">&times;</button>
                </div>

                <div class="modal-body">
                    <!-- État du Bluetooth -->
                    ${!this.bluetoothEnabled ? this.renderBluetoothDisabled() : ''}

                    <!-- Section scan -->
                    <div class="scan-section">
                        <div class="scan-header">
                            <h3>Périphériques disponibles</h3>
                            <button class="btn-scan ${this.scanning ? 'scanning' : ''}"
                                    data-action="scan" ${this.scanning ? 'disabled' : ''}>
                                ${this.scanning ? '🔄 Scan en cours...' : '🔍 Rechercher'}
                            </button>
                        </div>

                        <div class="devices-list" id="bluetoothAvailableDevices">
                            ${this.renderAvailableDevices()}
                        </div>
                    </div>

                    <!-- Section appareils appairés -->
                    ${this.pairedDevices.length > 0 ? `
                        <div class="paired-section">
                            <h3>Appareils appairés</h3>
                            <div class="devices-list" id="bluetoothPairedDevices">
                                ${this.renderPairedDevices()}
                            </div>
                        </div>
                    ` : ''}

                    <!-- Informations -->
                    <div class="info-section">
                        <p>
                            💡 <strong>Astuce:</strong> Assurez-vous que votre instrument Bluetooth est en mode appairage
                            et à portée (10-15m max) avant de lancer la recherche.
                        </p>
                    </div>
                </div>

                <div class="modal-footer">
                    <button class="btn-secondary" data-action="close">Fermer</button>
                </div>
            </div>
        `;
    }

    /**
     * Rendu de la liste des périphériques disponibles
     */
    renderAvailableDevices() {
        if (this.scanning) {
            return `
                <div class="devices-scanning">
                    <div class="spinner"></div>
                    <p>Recherche de périphériques Bluetooth...</p>
                    <p class="text-muted">Cette opération peut prendre quelques secondes</p>
                </div>
            `;
        }

        if (this.availableDevices.length === 0) {
            return `
                <div class="devices-empty">
                    <div class="empty-icon">🔍</div>
                    <p>Aucun périphérique détecté</p>
                    <p class="text-muted">Cliquez sur "Rechercher" pour scanner</p>
                </div>
            `;
        }

        return `
            <div class="devices-grid">
                ${this.availableDevices.map(device => this.renderAvailableDevice(device)).join('')}
            </div>
        `;
    }

    /**
     * Rendu d'un périphérique disponible
     */
    renderAvailableDevice(device) {
        const deviceName = this.escapeHtml(device.name || 'Appareil Bluetooth');
        const deviceAddress = device.address || device.id || 'Adresse inconnue';

        return `
            <div class="device-card bluetooth-device" data-device-id="${device.id || device.address}">
                <div class="device-icon">📡</div>
                <div class="device-info">
                    <div class="device-name">${deviceName}</div>
                    <div class="device-address">${deviceAddress}</div>
                    ${device.signal ? `<div class="device-signal">📶 Signal: ${device.signal}%</div>` : ''}
                    ${device.rssi ? `<div class="device-signal">📡 RSSI: ${device.rssi} dBm</div>` : ''}
                </div>
                <div class="device-actions">
                    <button class="btn-pair" data-action="pair"
                            data-device-id="${device.id || device.address}"
                            data-device-name="${deviceName}">
                        🔗 Appairer
                    </button>
                </div>
            </div>
        `;
    }

    /**
     * Rendu de la liste des périphériques appairés
     */
    renderPairedDevices() {
        if (this.pairedDevices.length === 0) {
            return '<p class="text-muted">Aucun appareil appairé</p>';
        }

        return `
            <div class="devices-grid">
                ${this.pairedDevices.map(device => this.renderPairedDevice(device)).join('')}
            </div>
        `;
    }

    /**
     * Rendu d'un périphérique appairé
     */
    renderPairedDevice(device) {
        const deviceName = this.escapeHtml(device.name || device.address);

        return `
            <div class="device-card bluetooth-device paired" data-device-address="${device.address}">
                <div class="device-icon">✓</div>
                <div class="device-info">
                    <div class="device-name">${deviceName}</div>
                    <div class="device-address">${device.address}</div>
                    <div class="device-status">
                        <span class="status-badge paired">✓ Appairé</span>
                    </div>
                </div>
                <div class="device-actions">
                    <button class="btn-connect" data-action="connect"
                            data-device-address="${device.address}">
                        🔌 Connecter
                    </button>
                    <button class="btn-unpair" data-action="unpair"
                            data-device-address="${device.address}">
                        Oublier
                    </button>
                </div>
            </div>
        `;
    }

    // ========================================================================
    // ÉVÉNEMENTS DOM
    // ========================================================================

    /**
     * Attache les événements de la modal
     */
    attachModalEvents() {
        if (!this.container) return;

        // Fermeture de la modal
        const closeButtons = this.container.querySelectorAll('[data-action="close"]');
        closeButtons.forEach(btn => {
            btn.addEventListener('click', () => this.close());
        });

        // Clic sur le fond pour fermer
        this.container.addEventListener('click', (e) => {
            if (e.target === this.container) {
                this.close();
            }
        });

        // Bouton de scan
        const scanButton = this.container.querySelector('[data-action="scan"]');
        if (scanButton) {
            scanButton.addEventListener('click', () => this.startScan());
        }

        // Bouton d'activation Bluetooth
        const powerOnButton = this.container.querySelector('[data-action="power_on"]');
        if (powerOnButton) {
            powerOnButton.addEventListener('click', () => this.powerOnBluetooth());
        }

        // Délégation d'événements pour les actions sur les périphériques
        this.container.addEventListener('click', (e) => {
            const action = e.target.dataset.action;

            if (action === 'pair') {
                const deviceId = e.target.dataset.deviceId;
                const deviceName = e.target.dataset.deviceName;
                if (deviceId) this.pairDevice(deviceId, deviceName);
            }

            if (action === 'connect') {
                const deviceAddress = e.target.dataset.deviceAddress;
                if (deviceAddress) this.connectDevice(deviceAddress);
            }

            if (action === 'unpair') {
                const deviceAddress = e.target.dataset.deviceAddress;
                if (deviceAddress) this.unpairDevice(deviceAddress);
            }
        });
    }

    // ========================================================================
    // ACTIONS
    // ========================================================================

    /**
     * Lance le scan Bluetooth
     */
    startScan() {
        if (this.scanning) {
            this.logger.warn('BluetoothScanModal', 'Scan already in progress');
            return;
        }

        this.scanning = true;
        this.availableDevices = [];
        this.updateModalContent();

        this.logger.info('BluetoothScanModal', 'Starting Bluetooth scan');

        if (this.eventBus) {
            this.eventBus.emit('bluetooth:scan_requested');
        } else {
            this.logger.error('BluetoothScanModal', 'EventBus not available');
            this.scanning = false;
            this.updateModalContent();
        }
    }

    /**
     * Charge la liste des périphériques appairés
     */
    loadPairedDevices() {
        this.logger.debug('BluetoothScanModal', 'Loading paired devices');

        if (this.eventBus) {
            this.eventBus.emit('bluetooth:paired_requested');
        }
    }

    /**
     * Appaire un périphérique
     */
    pairDevice(deviceId, deviceName) {
        this.logger.info('BluetoothScanModal', `Pairing device: ${deviceId}`);

        if (this.eventBus) {
            this.eventBus.emit('bluetooth:pair_requested', {
                device_id: deviceId,
                address: deviceId,
                name: deviceName
            });
        }
    }

    /**
     * Connecte un périphérique appairé
     */
    connectDevice(deviceAddress) {
        this.logger.info('BluetoothScanModal', `Connecting device: ${deviceAddress}`);

        if (this.eventBus) {
            this.eventBus.emit('bluetooth:connect_requested', {
                address: deviceAddress
            });
        }

        // Fermer la modal après connexion
        this.close();
    }

    /**
     * Oublie un périphérique appairé
     */
    unpairDevice(deviceAddress) {
        // Trouver le nom du périphérique
        const device = this.pairedDevices.find(d => d.address === deviceAddress);
        const deviceName = device ? device.name : deviceAddress;

        // Afficher la modal de confirmation
        this.showConfirmModal(
            'Oublier cet appareil ?',
            `Voulez-vous vraiment oublier <strong>${this.escapeHtml(deviceName)}</strong> ?<br><br>Cette action supprimera l'appairage avec cet appareil.`,
            () => {
                this.logger.info('BluetoothScanModal', `Unpairing device: ${deviceAddress}`);

                if (this.eventBus) {
                    this.eventBus.emit('bluetooth:unpair_requested', {
                        address: deviceAddress
                    });
                }
            }
        );
    }

    // ========================================================================
    // HANDLERS
    // ========================================================================

    /**
     * Gère la fin du scan
     */
    handleScanComplete(data) {
        this.scanning = false;
        this.availableDevices = data.devices || [];

        this.logger.info('BluetoothScanModal', `Scan complete: ${this.availableDevices.length} devices found`);

        this.updateModalContent();
    }

    /**
     * Gère la liste des périphériques appairés
     */
    handlePairedList(data) {
        this.pairedDevices = data.devices || [];

        this.logger.debug('BluetoothScanModal', `Paired devices loaded: ${this.pairedDevices.length}`);

        this.updateModalContent();
    }

    /**
     * Gère l'appairage réussi d'un périphérique
     */
    handleDevicePaired(data) {
        this.logger.info('BluetoothScanModal', `Device paired: ${data.device_id}`);

        // Recharger la liste des appareils appairés
        this.loadPairedDevices();

        // Supprimer de la liste des disponibles
        this.availableDevices = this.availableDevices.filter(
            d => (d.id || d.address) !== data.device_id
        );

        this.updateModalContent();
    }

    /**
     * Gère les erreurs de scan
     */
    handleScanError(data) {
        this.scanning = false;

        this.logger.error('BluetoothScanModal', 'Scan error:', data.error);

        // Vérifier si c'est une erreur de Bluetooth désactivé
        if (data.error && data.error.includes('poweredOff')) {
            this.bluetoothEnabled = false;
            this.bluetoothState = 'poweredOff';
        }

        this.updateModalContent();
    }

    /**
     * Gère l'état du Bluetooth
     */
    handleBluetoothStatus(data) {
        this.bluetoothEnabled = data.enabled || false;
        this.bluetoothState = data.state || 'unknown';

        this.logger.info('BluetoothScanModal', `Bluetooth status: ${this.bluetoothState}`);

        this.updateModalContent();

        // Si Bluetooth est activé, lancer le scan et charger les périphériques appairés
        if (this.bluetoothEnabled) {
            this.startScan();
            this.loadPairedDevices();
        }
    }

    /**
     * Gère l'activation du Bluetooth
     */
    handleBluetoothPoweredOn(data) {
        this.bluetoothEnabled = true;
        this.bluetoothState = 'poweredOn';

        this.logger.info('BluetoothScanModal', 'Bluetooth powered on');

        this.updateModalContent();

        // Lancer automatiquement le scan
        this.startScan();
        this.loadPairedDevices();
    }

    /**
     * Gère la désactivation du Bluetooth
     */
    handleBluetoothPoweredOff(data) {
        this.bluetoothEnabled = false;
        this.bluetoothState = 'poweredOff';
        this.scanning = false;

        this.logger.info('BluetoothScanModal', 'Bluetooth powered off');

        this.updateModalContent();
    }

    /**
     * Gère l'oubli d'un périphérique
     */
    handleDeviceUnpaired(data) {
        const deviceId = data.device_id || data.address;

        this.logger.info('BluetoothScanModal', `Device unpaired: ${deviceId}`);

        // Supprimer de la liste des appareils appairés
        this.pairedDevices = this.pairedDevices.filter(
            d => d.address !== deviceId
        );

        this.updateModalContent();
    }

    // ========================================================================
    // BLUETOOTH POWER CONTROL
    // ========================================================================

    /**
     * Vérifie l'état du Bluetooth
     */
    checkBluetoothStatus() {
        this.logger.debug('BluetoothScanModal', 'Checking Bluetooth status');

        if (this.eventBus) {
            this.eventBus.emit('bluetooth:status_requested');
        }
    }

    /**
     * Active le Bluetooth
     */
    powerOnBluetooth() {
        this.logger.info('BluetoothScanModal', 'Requesting Bluetooth power on');

        if (this.eventBus) {
            this.eventBus.emit('bluetooth:power_on_requested');
        }
    }

    /**
     * Désactive le Bluetooth
     */
    powerOffBluetooth() {
        this.logger.info('BluetoothScanModal', 'Requesting Bluetooth power off');

        if (this.eventBus) {
            this.eventBus.emit('bluetooth:power_off_requested');
        }
    }

    /**
     * Rendu du message Bluetooth désactivé
     */
    renderBluetoothDisabled() {
        return `
            <div class="bluetooth-disabled-section" style="
                background: linear-gradient(135deg, #fff3cd 0%, #ffe5b4 100%);
                border: 2px solid #ffc107;
                border-radius: 12px;
                padding: 20px;
                margin-bottom: 20px;
                text-align: center;
            ">
                <div style="font-size: 48px; margin-bottom: 12px;">⚠️</div>
                <h3 style="margin: 0 0 12px; color: #856404; font-size: 18px;">
                    Bluetooth désactivé
                </h3>
                <p style="margin: 0 0 16px; color: #856404; font-size: 14px;">
                    L'adaptateur Bluetooth est actuellement désactivé.<br>
                    Veuillez l'activer pour scanner les périphériques disponibles.
                </p>
                <button class="btn-power-on" data-action="power_on" style="
                    padding: 12px 24px;
                    background: linear-gradient(135deg, #ffc107 0%, #ff9800 100%);
                    color: #fff;
                    border: none;
                    border-radius: 8px;
                    font-size: 15px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.2s;
                    box-shadow: 0 2px 8px rgba(255, 193, 7, 0.4);
                ">
                    🔌 Activer le Bluetooth
                </button>
            </div>
        `;
    }

    // ========================================================================
    // MISE À JOUR
    // ========================================================================

    /**
     * Met à jour le contenu de la modal
     */
    updateModalContent() {
        if (!this.container || !this.isOpen) return;

        const modalDialog = this.container.querySelector('.modal-dialog');
        if (modalDialog) {
            modalDialog.innerHTML = this.renderModalContent()
                .replace('<div class="modal-dialog modal-lg">', '')
                .replace('</div>', '');

            // Réattacher les événements
            this.attachModalEvents();
        }
    }

    // ========================================================================
    // MODAL DE CONFIRMATION
    // ========================================================================

    /**
     * Affiche une modal de confirmation
     * @param {string} title - Titre de la modal
     * @param {string} message - Message de confirmation (peut contenir du HTML)
     * @param {Function} onConfirm - Callback si confirmé
     */
    showConfirmModal(title, message, onConfirm) {
        // Créer la modal de confirmation
        const confirmModal = document.createElement('div');
        confirmModal.className = 'modal-overlay confirm-modal';
        confirmModal.style.zIndex = '10001'; // Au-dessus de la modal Bluetooth

        confirmModal.innerHTML = `
            <div class="modal-dialog modal-sm">
                <div class="modal-header">
                    <h2>${this.escapeHtml(title)}</h2>
                </div>
                <div class="modal-body">
                    <p style="text-align: center; font-size: 15px; line-height: 1.6;">
                        ${message}
                    </p>
                </div>
                <div class="modal-footer" style="display: flex; gap: 12px; justify-content: center;">
                    <button class="btn-secondary" data-action="cancel">Annuler</button>
                    <button class="btn-danger" data-action="confirm">Oublier</button>
                </div>
            </div>
        `;

        document.body.appendChild(confirmModal);

        // Bouton Annuler
        const cancelBtn = confirmModal.querySelector('[data-action="cancel"]');
        cancelBtn.addEventListener('click', () => {
            confirmModal.remove();
        });

        // Bouton Confirmer
        const confirmBtn = confirmModal.querySelector('[data-action="confirm"]');
        confirmBtn.addEventListener('click', () => {
            confirmModal.remove();
            if (onConfirm) onConfirm();
        });

        // Clic sur le fond pour fermer
        confirmModal.addEventListener('click', (e) => {
            if (e.target === confirmModal) {
                confirmModal.remove();
            }
        });
    }

    // ========================================================================
    // UTILITAIRES
    // ========================================================================

    /**
     * Échappe le HTML pour éviter les injections
     */
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
    module.exports = BluetoothScanModal;
}

if (typeof window !== 'undefined') {
    window.BluetoothScanModal = BluetoothScanModal;
}
