// ============================================================================
// Fichier: frontend/js/views/components/NetworkScanModal.js
// Version: v1.0.0
// Date: 2025-11-16
// ============================================================================
// Description:
//   Modal personnalisée pour scanner et connecter des instruments via réseau/WiFi
//   - Affichage des périphériques disponibles sur le réseau
//   - Connexion aux instruments
//   - Interface utilisateur intuitive
// ============================================================================

class NetworkScanModal {
    constructor(eventBus) {
        this.eventBus = eventBus || window.eventBus || null;
        this.logger = window.logger || console;

        this.container = null;
        this.isOpen = false;
        this.scanning = false;
        this.availableDevices = [];
        this.connectedDevices = [];

        this.setupEventListeners();

        this.logger.info('NetworkScanModal', '✓ Modal initialized v1.0.0');
    }

    // ========================================================================
    // ÉVÉNEMENTS
    // ========================================================================

    setupEventListeners() {
        if (!this.eventBus) return;

        // Réponse du scan réseau
        this.eventBus.on('network:scanned', (data) => {
            this.handleScanComplete(data);
        });

        // Réponse de la liste des appareils connectés
        this.eventBus.on('network:connected_list', (data) => {
            this.handleConnectedList(data);
        });

        // Connexion réussie
        this.eventBus.on('network:connected', (data) => {
            this.handleDeviceConnected(data);
        });

        // Déconnexion réussie
        this.eventBus.on('network:disconnected', (data) => {
            this.handleDeviceDisconnected(data);
        });

        // Erreur de scan
        this.eventBus.on('network:scan_error', (data) => {
            this.handleScanError(data);
        });

        this.logger.debug('NetworkScanModal', 'Event listeners configured');
    }

    // ========================================================================
    // AFFICHAGE DE LA MODAL
    // ========================================================================

    /**
     * Ouvre la modal et lance le scan
     */
    open() {
        if (this.isOpen) {
            this.logger.warn('NetworkScanModal', 'Modal already open');
            return;
        }

        this.isOpen = true;
        this.availableDevices = [];
        this.connectedDevices = [];

        this.createModal();
        this.loadConnectedDevices();
        this.startScan();

        this.logger.info('NetworkScanModal', 'Modal opened');
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

        this.logger.info('NetworkScanModal', 'Modal closed');
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
        this.container.className = 'modal-overlay network-scan-modal';
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
                    <h2>🌐 Recherche d'instruments réseau</h2>
                    <button class="modal-close" data-action="close">&times;</button>
                </div>

                <div class="modal-body">
                    <!-- Section scan -->
                    <div class="scan-section">
                        <div class="scan-header">
                            <h3>Périphériques disponibles</h3>
                            <button class="btn-scan ${this.scanning ? 'scanning' : ''}"
                                    data-action="scan" ${this.scanning ? 'disabled' : ''}>
                                ${this.scanning ? '🔄 Scan en cours...' : '🔍 Rechercher'}
                            </button>
                        </div>

                        <div class="devices-list" id="networkAvailableDevices">
                            ${this.renderAvailableDevices()}
                        </div>
                    </div>

                    <!-- Section appareils connectés -->
                    ${this.connectedDevices.length > 0 ? `
                        <div class="connected-section">
                            <h3>Appareils connectés</h3>
                            <div class="devices-list" id="networkConnectedDevices">
                                ${this.renderConnectedDevices()}
                            </div>
                        </div>
                    ` : ''}

                    <!-- Informations -->
                    <div class="info-section">
                        <p>
                            💡 <strong>Astuce:</strong> Assurez-vous que votre instrument est connecté au même réseau
                            WiFi que cet appareil et qu'il est allumé avant de lancer la recherche.
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
                    <p>Recherche de périphériques sur le réseau...</p>
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
        const deviceName = this.escapeHtml(device.name || 'Instrument réseau');
        const deviceIp = device.ip || device.address || 'IP inconnue';
        const devicePort = device.port || '';

        return `
            <div class="device-card network-device" data-device-ip="${deviceIp}">
                <div class="device-icon">🌐</div>
                <div class="device-info">
                    <div class="device-name">${deviceName}</div>
                    <div class="device-ip">${deviceIp}${devicePort ? ':' + devicePort : ''}</div>
                    ${device.type ? `<div class="device-signal">🎹 Type: ${device.type}</div>` : ''}
                    ${device.manufacturer ? `<div class="device-signal">🏭 ${device.manufacturer}</div>` : ''}
                </div>
                <div class="device-actions">
                    <button class="btn-connect-network" data-action="connect"
                            data-device-ip="${deviceIp}"
                            data-device-port="${devicePort || ''}"
                            data-device-name="${deviceName}">
                        🔌 Connecter
                    </button>
                </div>
            </div>
        `;
    }

    /**
     * Rendu de la liste des périphériques connectés
     */
    renderConnectedDevices() {
        if (this.connectedDevices.length === 0) {
            return '<p class="text-muted">Aucun appareil connecté</p>';
        }

        return `
            <div class="devices-grid">
                ${this.connectedDevices.map(device => this.renderConnectedDevice(device)).join('')}
            </div>
        `;
    }

    /**
     * Rendu d'un périphérique connecté
     */
    renderConnectedDevice(device) {
        const deviceName = this.escapeHtml(device.name || device.ip);
        const deviceIp = device.ip || device.address;
        const devicePort = device.port || '';

        return `
            <div class="device-card network-device connected" data-device-ip="${deviceIp}">
                <div class="device-icon">✓</div>
                <div class="device-info">
                    <div class="device-name">${deviceName}</div>
                    <div class="device-ip">${deviceIp}${devicePort ? ':' + devicePort : ''}</div>
                    <div class="device-status">
                        <span class="status-badge connected">✓ Connecté</span>
                    </div>
                </div>
                <div class="device-actions">
                    <button class="btn-disconnect" data-action="disconnect"
                            data-device-ip="${deviceIp}">
                        Déconnecter
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

        // Délégation d'événements pour les actions sur les périphériques
        this.container.addEventListener('click', (e) => {
            const action = e.target.dataset.action;

            if (action === 'connect') {
                const deviceIp = e.target.dataset.deviceIp;
                const devicePort = e.target.dataset.devicePort;
                const deviceName = e.target.dataset.deviceName;
                if (deviceIp) this.connectDevice(deviceIp, devicePort, deviceName);
            }

            if (action === 'disconnect') {
                const deviceIp = e.target.dataset.deviceIp;
                if (deviceIp) this.disconnectDevice(deviceIp);
            }
        });
    }

    // ========================================================================
    // ACTIONS
    // ========================================================================

    /**
     * Lance le scan réseau
     */
    startScan() {
        if (this.scanning) {
            this.logger.warn('NetworkScanModal', 'Scan already in progress');
            return;
        }

        this.scanning = true;
        this.availableDevices = [];
        this.updateModalContent();

        this.logger.info('NetworkScanModal', 'Starting network scan');

        if (this.eventBus) {
            this.eventBus.emit('network:scan_requested');
        } else {
            this.logger.error('NetworkScanModal', 'EventBus not available');
            this.scanning = false;
            this.updateModalContent();
        }
    }

    /**
     * Charge la liste des périphériques connectés
     */
    loadConnectedDevices() {
        this.logger.debug('NetworkScanModal', 'Loading connected devices');

        if (this.eventBus) {
            this.eventBus.emit('network:connected_requested');
        }
    }

    /**
     * Connecte un périphérique
     */
    connectDevice(deviceIp, devicePort, deviceName) {
        this.logger.info('NetworkScanModal', `Connecting device: ${deviceIp}${devicePort ? ':' + devicePort : ''}`);

        if (this.eventBus) {
            this.eventBus.emit('network:connect_requested', {
                ip: deviceIp,
                port: devicePort || '',
                address: deviceIp,
                name: deviceName
            });
        }
    }

    /**
     * Déconnecte un périphérique
     */
    disconnectDevice(deviceIp) {
        if (!confirm('Voulez-vous vraiment déconnecter cet appareil ?')) {
            return;
        }

        this.logger.info('NetworkScanModal', `Disconnecting device: ${deviceIp}`);

        if (this.eventBus) {
            this.eventBus.emit('network:disconnect_requested', {
                ip: deviceIp,
                address: deviceIp
            });
        }
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

        this.logger.info('NetworkScanModal', `Scan complete: ${this.availableDevices.length} devices found`);

        this.updateModalContent();
    }

    /**
     * Gère la liste des périphériques connectés
     */
    handleConnectedList(data) {
        this.connectedDevices = data.devices || [];

        this.logger.debug('NetworkScanModal', `Connected devices loaded: ${this.connectedDevices.length}`);

        this.updateModalContent();
    }

    /**
     * Gère la connexion réussie d'un périphérique
     */
    handleDeviceConnected(data) {
        this.logger.info('NetworkScanModal', `Device connected: ${data.ip || data.address}`);

        // Recharger la liste des appareils connectés
        this.loadConnectedDevices();

        // Supprimer de la liste des disponibles
        const deviceIp = data.ip || data.address;
        this.availableDevices = this.availableDevices.filter(
            d => d.ip !== deviceIp && d.address !== deviceIp
        );

        this.updateModalContent();

        // Afficher un message de succès
        if (this.logger.success) {
            this.logger.success('NetworkScanModal', `Instrument connecté avec succès: ${data.name || deviceIp}`);
        }
    }

    /**
     * Gère la déconnexion d'un périphérique
     */
    handleDeviceDisconnected(data) {
        this.logger.info('NetworkScanModal', `Device disconnected: ${data.ip || data.address}`);

        // Recharger la liste des appareils connectés
        this.loadConnectedDevices();

        this.updateModalContent();
    }

    /**
     * Gère les erreurs de scan
     */
    handleScanError(data) {
        this.scanning = false;

        this.logger.error('NetworkScanModal', 'Scan error:', data.error);

        this.updateModalContent();
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
    module.exports = NetworkScanModal;
}

if (typeof window !== 'undefined') {
    window.NetworkScanModal = NetworkScanModal;
}
