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
    open() {
        if (this.isOpen) {
            this.logger.warn('KeyboardModal', 'Modal already open');
            return;
        }

        this.isOpen = true;
        this.createModal();

        // Initialiser le clavier après que le DOM soit créé
        setTimeout(() => {
            this.initializeKeyboard();
        }, 100);

        this.logger.info('KeyboardModal', 'Modal opened');
    }

    /**
     * Ferme la modal
     */
    close() {
        if (!this.isOpen) return;

        this.isOpen = false;

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

                    <!-- Informations -->
                    <div class="keyboard-modal-info">
                        <div class="info-item">
                            <span class="info-icon">💡</span>
                            <span class="info-text">
                                <strong>Astuce:</strong> Utilisez les touches de votre clavier (ZXCVBNM, QWERTY)
                                ou cliquez directement sur les touches du clavier virtuel pour jouer des notes.
                            </span>
                        </div>
                        <div class="info-item">
                            <span class="info-icon">🎛️</span>
                            <span class="info-text">
                                <strong>Contrôles:</strong> Utilisez les boutons ◄ ► pour changer d'octave,
                                et le slider pour ajuster la vélocité des notes.
                            </span>
                        </div>
                    </div>
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
    initializeKeyboard() {
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

        // Attendre que le DOM soit mis à jour
        setTimeout(() => {
            // Créer le controller si disponible
            if (typeof KeyboardController !== 'undefined') {
                this.keyboardController = new KeyboardController(
                    this.eventBus,
                    {},
                    {},
                    null,
                    null,
                    this.backend
                );
                this.keyboardController.init();
                this.logger.info('KeyboardModal', 'KeyboardController created');
            }

            this.keyboardView = new KeyboardView('keyboard-modal-container', this.eventBus);

            if (this.keyboardView) {
                // Initialiser et rendre
                this.keyboardView.init();

                // S'assurer que le render est bien fait
                setTimeout(() => {
                    this.keyboardView.render();

                    // Charger les devices disponibles
                    this.loadDevices();

                    this.logger.info('KeyboardModal', 'Keyboard initialized and rendered');
                }, 50);
            }
        }, 10);
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
            // Scanner les devices
            const response = await this.backend.sendCommand('scan_devices');

            if (response && response.success && response.data) {
                const devices = response.data.devices || [];

                // Filtrer les devices actifs (status = 2)
                this.availableDevices = devices.filter(d => d.status === 2);

                this.logger.info('KeyboardModal', `Loaded ${this.availableDevices.length} devices`);

                // Émettre l'événement pour la vue
                if (this.eventBus) {
                    this.eventBus.emit('keyboard:devices-loaded', {
                        devices: this.availableDevices
                    });
                }
            }
        } catch (error) {
            this.logger.error('KeyboardModal', 'Failed to load devices:', error);

            // Émettre quand même un événement vide
            if (this.eventBus) {
                this.eventBus.emit('keyboard:devices-loaded', {
                    devices: []
                });
            }
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
