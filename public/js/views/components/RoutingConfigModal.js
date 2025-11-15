// ============================================================================
// Fichier: public/js/views/components/RoutingConfigModal.js
// Version: v1.0.0
// Description: Modale de configuration du routage MIDI pour un fichier
// ============================================================================

class RoutingConfigModal {
    constructor(eventBus, apiClient) {
        this.eventBus = eventBus;
        this.api = apiClient;
        this.logger = window.logger || console;

        this.container = null;
        this.isOpen = false;

        // État
        this.currentFile = null;
        this.channels = [];
        this.devices = [];
        this.channelRoutes = {};
    }

    // ========================================================================
    // AFFICHAGE DE LA MODALE
    // ========================================================================

    /**
     * Afficher la modale de configuration du routage
     * @param {string} filePath - Chemin du fichier
     * @param {object} currentRouting - Routage actuel (optionnel)
     */
    async show(filePath, currentRouting = null) {
        this.currentFile = filePath;
        this.channelRoutes = currentRouting?.channels || {};

        try {
            // Charger les informations du fichier (canaux MIDI)
            await this.loadFileChannels(filePath);

            // Charger les périphériques disponibles
            await this.loadDevices();

            // Afficher la modale
            this.render();

        } catch (error) {
            this.log('error', 'Failed to show routing config modal:', error);

            if (window.app?.notifications) {
                window.app.notifications.show(
                    'Erreur',
                    `Impossible de charger les informations du fichier: ${error.message}`,
                    'error',
                    3000
                );
            }
        }
    }

    /**
     * Charger les canaux MIDI du fichier
     */
    async loadFileChannels(filePath) {
        try {
            // D'abord charger le fichier dans le lecteur
            const loadResponse = await this.api.sendCommand('playback_start', {
                fileId: filePath
            });

            // Récupérer les canaux
            const channelsResponse = await this.api.sendCommand('playback_get_channels');

            this.channels = channelsResponse.channels || [];

            this.log('info', `Loaded ${this.channels.length} channels for ${filePath}`);

        } catch (error) {
            this.log('error', 'Failed to load file channels:', error);
            throw error;
        }
    }

    /**
     * Charger les périphériques MIDI disponibles
     */
    async loadDevices() {
        try {
            const response = await this.api.sendCommand('device_list');

            // Filtrer uniquement les sorties MIDI
            this.devices = (response.devices || []).filter(d =>
                d.type === 'output' || d.type === 'virtual'
            );

            this.log('info', `Loaded ${this.devices.length} output devices`);

        } catch (error) {
            this.log('error', 'Failed to load devices:', error);
            throw error;
        }
    }

    // ========================================================================
    // RENDU
    // ========================================================================

    /**
     * Générer le HTML de la modale
     */
    render() {
        this.close();

        this.container = document.createElement('div');
        this.container.className = 'modal-overlay routing-config-modal';
        this.container.innerHTML = this.buildHTML();

        document.body.appendChild(this.container);
        this.isOpen = true;

        this.attachEvents();
    }

    /**
     * Construire le HTML
     */
    buildHTML() {
        const fileName = this.currentFile.split('/').pop();

        return `
            <div class="modal-dialog modal-lg">
                <div class="modal-header">
                    <h3>🔀 Configuration du routage MIDI</h3>
                    <button class="modal-close" data-action="close">&times;</button>
                </div>

                <div class="modal-body">
                    <div class="routing-info">
                        <div class="info-item">
                            <span class="label">📁 Fichier:</span>
                            <span class="value">${this.escapeHtml(fileName)}</span>
                        </div>
                        <div class="info-item">
                            <span class="label">🎵 Canaux MIDI:</span>
                            <span class="value">${this.channels.length}</span>
                        </div>
                        <div class="info-item">
                            <span class="label">🎛️ Périphériques disponibles:</span>
                            <span class="value">${this.devices.length}</span>
                        </div>
                    </div>

                    ${this.channels.length === 0 ? this.buildEmptyState() : this.buildChannelList()}
                </div>

                <div class="modal-footer">
                    <button class="btn btn-secondary" data-action="clear-all">
                        🗑️ Tout effacer
                    </button>
                    <button class="btn btn-secondary" data-action="auto-assign">
                        🎲 Auto-assigner
                    </button>
                    <button class="btn btn-secondary" data-action="cancel">
                        Annuler
                    </button>
                    <button class="btn btn-primary" data-action="save">
                        ✓ Sauvegarder
                    </button>
                </div>
            </div>
        `;
    }

    /**
     * Construire la liste des canaux
     */
    buildChannelList() {
        return `
            <div class="channel-routing-list">
                ${this.channels.map(ch => this.buildChannelRow(ch)).join('')}
            </div>
        `;
    }

    /**
     * Construire une ligne de canal
     */
    buildChannelRow(channel) {
        const currentDevice = this.channelRoutes[channel.channel];
        const trackNames = (channel.tracks || []).map(t => t.name || 'Piste sans nom').join(', ');

        return `
            <div class="channel-row" data-channel="${channel.channel}">
                <div class="channel-info">
                    <div class="channel-number">
                        Canal ${channel.channelDisplay || (channel.channel + 1)}
                    </div>
                    <div class="channel-tracks">
                        ${this.escapeHtml(trackNames)}
                    </div>
                </div>

                <div class="channel-routing">
                    <select class="device-select" data-channel="${channel.channel}">
                        <option value="">-- Aucun (silencieux) --</option>
                        ${this.devices.map(device => `
                            <option value="${device.id}" ${currentDevice === device.id ? 'selected' : ''}>
                                ${this.escapeHtml(device.name)}
                            </option>
                        `).join('')}
                    </select>
                </div>
            </div>
        `;
    }

    /**
     * État vide (aucun canal)
     */
    buildEmptyState() {
        return `
            <div class="empty-state">
                <div class="empty-icon">🎵</div>
                <h3>Aucun canal MIDI</h3>
                <p>Ce fichier ne contient pas de canaux MIDI détectables.</p>
            </div>
        `;
    }

    // ========================================================================
    // ÉVÉNEMENTS
    // ========================================================================

    /**
     * Attacher les événements
     */
    attachEvents() {
        if (!this.container) return;

        // Bouton fermer
        const closeBtn = this.container.querySelector('[data-action="close"]');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.close());
        }

        // Clic sur l'overlay
        this.container.addEventListener('click', (e) => {
            if (e.target === this.container) {
                this.close();
            }
        });

        // Bouton annuler
        const cancelBtn = this.container.querySelector('[data-action="cancel"]');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => this.close());
        }

        // Bouton sauvegarder
        const saveBtn = this.container.querySelector('[data-action="save"]');
        if (saveBtn) {
            saveBtn.addEventListener('click', () => this.handleSave());
        }

        // Bouton effacer tout
        const clearBtn = this.container.querySelector('[data-action="clear-all"]');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => this.handleClearAll());
        }

        // Bouton auto-assigner
        const autoBtn = this.container.querySelector('[data-action="auto-assign"]');
        if (autoBtn) {
            autoBtn.addEventListener('click', () => this.handleAutoAssign());
        }

        // Sélecteurs de périphériques
        const selects = this.container.querySelectorAll('.device-select');
        selects.forEach(select => {
            select.addEventListener('change', (e) => {
                const channel = parseInt(e.target.dataset.channel);
                const deviceId = e.target.value;

                if (deviceId) {
                    this.channelRoutes[channel] = deviceId;
                } else {
                    delete this.channelRoutes[channel];
                }
            });
        });
    }

    // ========================================================================
    // ACTIONS
    // ========================================================================

    /**
     * Sauvegarder la configuration
     */
    async handleSave() {
        try {
            // Appliquer le routage au lecteur
            for (const [channel, deviceId] of Object.entries(this.channelRoutes)) {
                await this.api.sendCommand('playback_set_channel_routing', {
                    channel: parseInt(channel),
                    deviceId: deviceId
                });
            }

            // Sauvegarder dans le service
            if (window.app?.services?.fileRouting) {
                window.app.services.fileRouting.setFileRouting(
                    this.currentFile,
                    this.channelRoutes,
                    this.channels
                );
            }

            // Émettre événement
            this.eventBus?.emit('routing:configured', {
                filePath: this.currentFile,
                channels: this.channelRoutes
            });

            if (window.app?.notifications) {
                window.app.notifications.show(
                    'Routage configuré',
                    `Routage enregistré pour ${this.channels.length} canaux`,
                    'success',
                    2000
                );
            }

            this.close();

        } catch (error) {
            this.log('error', 'Failed to save routing:', error);

            if (window.app?.notifications) {
                window.app.notifications.show(
                    'Erreur',
                    `Échec de la sauvegarde: ${error.message}`,
                    'error',
                    3000
                );
            }
        }
    }

    /**
     * Effacer tous les routages
     */
    handleClearAll() {
        this.channelRoutes = {};

        // Mettre à jour les sélecteurs
        const selects = this.container.querySelectorAll('.device-select');
        selects.forEach(select => {
            select.value = '';
        });

        if (window.app?.notifications) {
            window.app.notifications.show(
                'Routage effacé',
                'Tous les routages ont été effacés',
                'info',
                2000
            );
        }
    }

    /**
     * Auto-assigner les canaux aux périphériques
     */
    handleAutoAssign() {
        if (this.devices.length === 0) {
            if (window.app?.notifications) {
                window.app.notifications.show(
                    'Aucun périphérique',
                    'Aucun périphérique de sortie disponible',
                    'warning',
                    2000
                );
            }
            return;
        }

        // Assigner chaque canal au premier périphérique disponible
        // (ou répartir selon une logique plus avancée)
        const device = this.devices[0];

        this.channels.forEach(ch => {
            this.channelRoutes[ch.channel] = device.id;
        });

        // Mettre à jour les sélecteurs
        const selects = this.container.querySelectorAll('.device-select');
        selects.forEach(select => {
            select.value = device.id;
        });

        if (window.app?.notifications) {
            window.app.notifications.show(
                'Auto-assignation',
                `${this.channels.length} canaux assignés à ${device.name}`,
                'success',
                2000
            );
        }
    }

    // ========================================================================
    // UTILITAIRES
    // ========================================================================

    /**
     * Fermer la modale
     */
    close() {
        if (this.container) {
            this.container.remove();
            this.container = null;
        }

        this.isOpen = false;
        this.currentFile = null;
        this.channels = [];
        this.channelRoutes = {};
    }

    /**
     * Échapper le HTML
     */
    escapeHtml(text) {
        if (!text) return '';

        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Logger
     */
    log(level, ...args) {
        const prefix = '[RoutingConfigModal]';

        if (typeof this.logger[level] === 'function') {
            this.logger[level](prefix, ...args);
        } else {
            console[level](prefix, ...args);
        }
    }
}

// ============================================================================
// EXPORT
// ============================================================================

if (typeof module !== 'undefined' && module.exports) {
    module.exports = RoutingConfigModal;
}

if (typeof window !== 'undefined') {
    window.RoutingConfigModal = RoutingConfigModal;
}
