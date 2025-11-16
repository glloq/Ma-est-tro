// ============================================================================
// Fichier: frontend/js/views/components/KeyboardModal.js
// Version: v1.0.0
// Date: 2025-11-16
// ============================================================================
// Description:
//   Modal personnalisée pour afficher un clavier MIDI virtuel
//   - Affichage d'un clavier visuel interactif
//   - Sélection de l'instrument de sortie
//   - Envoi de notes MIDI vers l'instrument sélectionné
//   - Support clavier ordinateur, souris et touch
// ============================================================================

class KeyboardModal {
    constructor(eventBus) {
        this.eventBus = eventBus || window.eventBus || null;
        this.logger = window.logger || console;
        this.backend = window.api || null;

        this.container = null;
        this.isOpen = false;

        // Instance du KeyboardView qui sera créée dans la modal
        this.keyboardView = null;
        this.keyboardController = null;

        // État
        this.availableDevices = [];
        this.selectedDevice = null;

        // Cache pour optimiser les rechargements
        this.devicesCache = null;
        this.cacheTimestamp = 0;
        this.CACHE_DURATION = 30000; // 30 secondes

        this.setupEventListeners();

        this.logger.info('KeyboardModal', '✓ Modal initialized v1.0.0');
    }

    // ========================================================================
    // ÉVÉNEMENTS
    // ========================================================================

    setupEventListeners() {
        if (!this.eventBus) return;

        // Écouter les devices disponibles
        this.eventBus.on('keyboard:devices-loaded', (data) => {
            this.handleDevicesLoaded(data);
        });

        this.logger.debug('KeyboardModal', 'Event listeners configured');
    }

    // ========================================================================
    // AFFICHAGE DE LA MODAL
    // ========================================================================

    /**
     * Ouvre la modal et initialise le clavier
     */
    async open() {
        if (this.isOpen) {
            this.logger.warn('KeyboardModal', 'Modal already open');
            return;
        }

        this.isOpen = true;
        this.createModal();

        // ✅ FIX #4: Utiliser async/await au lieu de setTimeout
        // Attendre le prochain tick pour que le DOM soit créé
        await new Promise(resolve => setTimeout(resolve, 0));

        await this.initializeKeyboard();

        this.logger.info('KeyboardModal', 'Modal opened');
    }

    /**
     * Ferme la modal
     */
    close() {
        if (!this.isOpen) return;

        this.isOpen = false;

        // Détruire le KeyboardController si existant
        if (this.keyboardController) {
            if (typeof this.keyboardController.destroy === 'function') {
                this.keyboardController.destroy();
            }
            this.keyboardController = null;
        }

        // Détruire le KeyboardView si existant
        if (this.keyboardView) {
            this.keyboardView.destroy();
            this.keyboardView = null;
        }

        if (this.container) {
            this.container.remove();
            this.container = null;
        }

        this.logger.info('KeyboardModal', 'Modal closed');
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
        this.container.className = 'modal-overlay keyboard-modal';
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
            <div class="modal-dialog modal-xl">
                <div class="modal-header">
                    <h2>🎹 Clavier MIDI Virtuel</h2>
                    <button class="modal-close" data-action="close">&times;</button>
                </div>

                <div class="modal-body">
                    <!-- Container pour le KeyboardView -->
                    <div id="keyboard-modal-view"></div>
                </div>

                <div class="modal-footer">
                    <button class="btn-secondary" data-action="close">Fermer</button>
                </div>
            </div>
        `;
    }

    // ========================================================================
    // INITIALISATION DU CLAVIER
    // ========================================================================

    /**
     * Initialise le KeyboardView dans la modal
     */
    async initializeKeyboard() {
        const keyboardContainer = document.getElementById('keyboard-modal-view');

        if (!keyboardContainer) {
            this.logger.error('KeyboardModal', 'Keyboard container not found');
            return;
        }

        // Créer une instance de KeyboardView
        if (typeof KeyboardView === 'undefined') {
            this.logger.error('KeyboardModal', 'KeyboardView class not loaded');
            return;
        }

        // Créer le container avec l'ID attendu par KeyboardView
        keyboardContainer.innerHTML = '<div id="keyboard-modal-container"></div>';

        // ✅ FIX #4: Utiliser async/await au lieu de setTimeout imbriqués
        // Attendre le prochain tick pour que le DOM soit mis à jour
        await new Promise(resolve => setTimeout(resolve, 0));

        // Créer le KeyboardView
        this.keyboardView = new KeyboardView('keyboard-modal-container', this.eventBus);

        // Créer le KeyboardController
        if (typeof KeyboardController !== 'undefined') {
            this.keyboardController = new KeyboardController(
                this.eventBus,
                {}, // viewConfig
                {}, // controllerConfig
                null, // display
                null, // logger
                this.backend
            );
            this.keyboardController.init();
            this.logger.info('KeyboardModal', 'KeyboardController created and initialized');
        } else {
            this.logger.warn('KeyboardModal', 'KeyboardController class not available');
        }

        if (this.keyboardView) {
            // Initialiser et rendre
            this.keyboardView.init();
            this.keyboardView.render();

            // Charger les devices disponibles
            await this.loadDevices();

            this.logger.info('KeyboardModal', 'Keyboard initialized and rendered');
        }
    }

    /**
     * Charge les devices MIDI disponibles
     */
    async loadDevices() {
        if (!this.backend) {
            this.logger.warn('KeyboardModal', 'Backend not available');
            return;
        }

        try {
            // Vérifier si on peut utiliser le cache
            const now = Date.now();
            if (this.devicesCache && (now - this.cacheTimestamp) < this.CACHE_DURATION) {
                this.logger.info('KeyboardModal', 'Using cached devices');
                this.availableDevices = this.devicesCache;
                this.emitDevicesLoaded();
                return;
            }

            this.logger.info('KeyboardModal', 'Loading devices from backend...');

            // Charger les devices via l'API
            const devices = await this.backend.listDevices();

            this.logger.info('KeyboardModal', `Total devices: ${devices.length}`);

            // Filtrer les devices actifs (status = 2)
            const activeDevices = devices.filter(d => d.status === 2);

            this.logger.info('KeyboardModal', `Active devices (status=2): ${activeDevices.length}`);

            // Enrichir avec les noms personnalisés
            this.availableDevices = await Promise.all(activeDevices.map(async (device) => {
                // Normaliser : s'assurer que device.id et device.device_id sont définis
                const deviceId = device.id || device.device_id;
                const normalizedDevice = {
                    ...device,
                    id: deviceId,
                    device_id: deviceId
                };

                try {
                    const response = await this.backend.sendCommand('instrument_get_settings', {
                        deviceId: deviceId
                    });
                    const settings = response.settings || {};
                    return {
                        ...normalizedDevice,
                        displayName: settings.custom_name || device.name,
                        customName: settings.custom_name
                    };
                } catch (error) {
                    // Si on ne peut pas charger les settings, utiliser le nom par défaut
                    this.logger.warn('KeyboardModal', `Cannot load settings for ${deviceId}:`, error);
                    return {
                        ...normalizedDevice,
                        displayName: device.name,
                        customName: null
                    };
                }
            }));

            // Mettre en cache
            this.devicesCache = this.availableDevices;
            this.cacheTimestamp = now;

            this.logger.info('KeyboardModal', 'Devices enriched with custom names:', this.availableDevices);

            // Émettre l'événement pour la vue
            this.emitDevicesLoaded();

        } catch (error) {
            this.logger.error('KeyboardModal', 'Failed to load devices:', error);

            // Émettre quand même un événement vide
            this.availableDevices = [];
            this.emitDevicesLoaded();
        }
    }

    /**
     * Émet l'événement devices-loaded
     */
    emitDevicesLoaded() {
        if (this.eventBus) {
            this.logger.info('KeyboardModal', 'Emitting keyboard:devices-loaded event');
            this.eventBus.emit('keyboard:devices-loaded', {
                devices: this.availableDevices
            });
        } else {
            this.logger.error('KeyboardModal', 'EventBus not available!');
        }
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

        // Empêcher la fermeture lors d'un clic dans la modal
        const modalDialog = this.container.querySelector('.modal-dialog');
        if (modalDialog) {
            modalDialog.addEventListener('click', (e) => {
                e.stopPropagation();
            });
        }
    }

    // ========================================================================
    // HANDLERS
    // ========================================================================

    /**
     * Gère le chargement des devices
     */
    handleDevicesLoaded(data) {
        this.availableDevices = data.devices || [];
        this.logger.debug('KeyboardModal', `Devices loaded: ${this.availableDevices.length}`);
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
    module.exports = KeyboardModal;
}

if (typeof window !== 'undefined') {
    window.KeyboardModal = KeyboardModal;
}
