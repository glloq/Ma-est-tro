/**
 * SettingsModal - Modal pour les réglages de l'application
 *
 * Fonctionnalités :
 * - Modification du thème (dark, light, colored)
 * - Ajustement du nombre de touches du clavier
 * - Modification du temps d'affichage des notes
 * - Gestion de l'instrument virtuel
 */

class SettingsModal {
    constructor(eventBus, logger) {
        this.eventBus = eventBus;
        this.logger = logger;

        // Paramètres par défaut
        this.settings = this.loadSettings();

        // Initialisation
        this.init();
    }

    init() {
        this.createModal();
        this.setupEventListeners();
        this.applySettings();
    }

    /**
     * Charger les paramètres depuis localStorage
     */
    loadSettings() {
        const defaults = {
            theme: 'light',
            keyboardKeys: 25, // ~2 octaves par défaut
            noteDisplayTime: 20, // secondes
            virtualInstrument: false
        };

        try {
            const saved = localStorage.getItem('maestro_settings');
            if (saved) {
                return { ...defaults, ...JSON.parse(saved) };
            }
        } catch (error) {
            this.logger?.error('Failed to load settings:', error);
        }

        return defaults;
    }

    /**
     * Sauvegarder les paramètres dans localStorage
     */
    saveSettings() {
        try {
            localStorage.setItem('maestro_settings', JSON.stringify(this.settings));
            this.logger?.info('Settings saved');
        } catch (error) {
            this.logger?.error('Failed to save settings:', error);
        }
    }

    /**
     * Créer la structure HTML du modal
     */
    createModal() {
        // Modal overlay
        this.overlay = document.createElement('div');
        this.overlay.className = 'settings-modal-overlay';
        this.overlay.style.cssText = `
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.6);
            z-index: 9998;
            align-items: center;
            justify-content: center;
        `;

        // Modal container
        this.modal = document.createElement('div');
        this.modal.className = 'settings-modal';
        this.modal.style.cssText = `
            background: white;
            border-radius: 12px;
            padding: 0;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
            max-width: 600px;
            width: 90%;
            max-height: 80vh;
            overflow: hidden;
            display: flex;
            flex-direction: column;
        `;

        // Header
        const header = document.createElement('div');
        header.style.cssText = `
            padding: 24px;
            border-bottom: 1px solid #e5e7eb;
            display: flex;
            justify-content: space-between;
            align-items: center;
        `;
        header.innerHTML = `
            <h2 style="margin: 0; color: #667eea; font-size: 20px;">⚙️ Réglages</h2>
            <button class="settings-close-btn" style="
                background: transparent;
                border: none;
                font-size: 24px;
                cursor: pointer;
                color: #999;
                line-height: 1;
                padding: 0;
                width: 32px;
                height: 32px;
                display: flex;
                align-items: center;
                justify-content: center;
                border-radius: 50%;
                transition: all 0.2s;
            ">×</button>
        `;

        // Content
        const content = document.createElement('div');
        content.style.cssText = `
            padding: 24px;
            overflow-y: auto;
            flex: 1;
        `;
        content.innerHTML = `
            <!-- Thème -->
            <div class="settings-section">
                <h3 style="margin: 0 0 16px 0; font-size: 16px; color: #333;">🎨 Thème</h3>
                <div class="theme-options" style="display: flex; gap: 12px;">
                    <button class="theme-btn" data-theme="light" style="
                        flex: 1;
                        padding: 16px;
                        border: 2px solid #e5e7eb;
                        border-radius: 8px;
                        background: white;
                        cursor: pointer;
                        transition: all 0.2s;
                        font-size: 14px;
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        gap: 8px;
                    ">
                        <span style="font-size: 24px;">☀️</span>
                        <span>Light</span>
                    </button>
                    <button class="theme-btn" data-theme="dark" style="
                        flex: 1;
                        padding: 16px;
                        border: 2px solid #e5e7eb;
                        border-radius: 8px;
                        background: white;
                        cursor: pointer;
                        transition: all 0.2s;
                        font-size: 14px;
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        gap: 8px;
                    ">
                        <span style="font-size: 24px;">🌙</span>
                        <span>Dark</span>
                    </button>
                    <button class="theme-btn" data-theme="colored" style="
                        flex: 1;
                        padding: 16px;
                        border: 2px solid #e5e7eb;
                        border-radius: 8px;
                        background: white;
                        cursor: pointer;
                        transition: all 0.2s;
                        font-size: 14px;
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        gap: 8px;
                    ">
                        <span style="font-size: 24px;">🎨</span>
                        <span>Colored</span>
                    </button>
                </div>
            </div>

            <!-- Clavier -->
            <div class="settings-section" style="margin-top: 24px;">
                <h3 style="margin: 0 0 16px 0; font-size: 16px; color: #333;">🎹 Clavier</h3>
                <div style="display: flex; flex-direction: column; gap: 8px;">
                    <label style="font-size: 14px; color: #666;">
                        Nombre de touches : <strong id="keyboardKeysValue">${this.settings.keyboardKeys}</strong>
                    </label>
                    <input type="range" id="keyboardKeysRange" min="12" max="42" step="1"
                           value="${this.settings.keyboardKeys}"
                           style="width: 100%;">
                    <div style="display: flex; justify-content: space-between; font-size: 12px; color: #999;">
                        <span>12 touches (1 octave)</span>
                        <span>42 touches (3.5 octaves)</span>
                    </div>
                </div>
            </div>

            <!-- Temps d'affichage -->
            <div class="settings-section" style="margin-top: 24px;">
                <h3 style="margin: 0 0 16px 0; font-size: 16px; color: #333;">⏱️ Affichage des notes</h3>
                <div style="display: flex; flex-direction: column; gap: 8px;">
                    <label style="font-size: 14px; color: #666;">
                        Durée visible : <strong id="noteDisplayTimeValue">${this.settings.noteDisplayTime}s</strong>
                    </label>
                    <input type="range" id="noteDisplayTimeRange" min="5" max="60" step="5"
                           value="${this.settings.noteDisplayTime}"
                           style="width: 100%;">
                    <div style="display: flex; justify-content: space-between; font-size: 12px; color: #999;">
                        <span>5 secondes</span>
                        <span>60 secondes</span>
                    </div>
                </div>
            </div>

            <!-- Instrument virtuel -->
            <div class="settings-section" style="margin-top: 24px;">
                <h3 style="margin: 0 0 16px 0; font-size: 16px; color: #333;">🎵 Instrument virtuel</h3>
                <div style="display: flex; align-items: center; justify-content: space-between; gap: 16px;">
                    <div style="flex: 1;">
                        <p style="margin: 0 0 4px 0; font-size: 14px; color: #333;">Activer l'instrument virtuel</p>
                        <p style="margin: 0; font-size: 12px; color: #666;">Les messages MIDI seront envoyés aux logs</p>
                    </div>
                    <label class="toggle-switch" style="position: relative; display: inline-block; width: 60px; height: 30px;">
                        <input type="checkbox" id="virtualInstrumentToggle" ${this.settings.virtualInstrument ? 'checked' : ''}
                               style="opacity: 0; width: 0; height: 0;">
                        <span class="toggle-slider" style="
                            position: absolute;
                            cursor: pointer;
                            top: 0;
                            left: 0;
                            right: 0;
                            bottom: 0;
                            background-color: #ccc;
                            transition: 0.4s;
                            border-radius: 30px;
                        "></span>
                    </label>
                </div>
            </div>
        `;

        // Footer
        const footer = document.createElement('div');
        footer.style.cssText = `
            padding: 16px 24px;
            border-top: 1px solid #e5e7eb;
            display: flex;
            justify-content: flex-end;
            gap: 12px;
        `;
        footer.innerHTML = `
            <button class="btn btn-secondary settings-cancel-btn" style="
                padding: 10px 20px;
                border: 1px solid #e5e7eb;
                border-radius: 6px;
                background: white;
                color: #666;
                cursor: pointer;
                font-size: 14px;
                transition: all 0.2s;
            ">Annuler</button>
            <button class="btn btn-primary settings-save-btn" style="
                padding: 10px 20px;
                border: none;
                border-radius: 6px;
                background: #667eea;
                color: white;
                cursor: pointer;
                font-size: 14px;
                transition: all 0.2s;
            ">Enregistrer</button>
        `;

        // Assembler le modal
        this.modal.appendChild(header);
        this.modal.appendChild(content);
        this.modal.appendChild(footer);
        this.overlay.appendChild(this.modal);
        document.body.appendChild(this.overlay);

        // Ajouter les styles pour le toggle
        this.addToggleStyles();
    }

    /**
     * Ajouter les styles CSS pour le toggle switch
     */
    addToggleStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .toggle-switch input:checked + .toggle-slider {
                background-color: #667eea !important;
            }

            .toggle-slider:before {
                position: absolute;
                content: "";
                height: 22px;
                width: 22px;
                left: 4px;
                bottom: 4px;
                background-color: white;
                transition: 0.4s;
                border-radius: 50%;
            }

            .toggle-switch input:checked + .toggle-slider:before {
                transform: translateX(30px);
            }

            .theme-btn.active {
                border-color: #667eea !important;
                background: #f0f4ff !important;
            }

            .theme-btn:hover {
                border-color: #667eea !important;
                transform: translateY(-2px);
                box-shadow: 0 4px 8px rgba(102, 126, 234, 0.2);
            }

            .settings-close-btn:hover {
                background: #f3f4f6 !important;
                color: #667eea !important;
            }

            .btn-secondary:hover {
                background: #f3f4f6 !important;
            }

            .btn-primary:hover {
                background: #5568d3 !important;
                box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
            }
        `;
        document.head.appendChild(style);
    }

    /**
     * Configurer les écouteurs d'événements
     */
    setupEventListeners() {
        // Bouton fermer
        this.modal.querySelector('.settings-close-btn').addEventListener('click', () => {
            this.close();
        });

        // Bouton annuler
        this.modal.querySelector('.settings-cancel-btn').addEventListener('click', () => {
            this.close();
        });

        // Bouton enregistrer
        this.modal.querySelector('.settings-save-btn').addEventListener('click', () => {
            this.save();
        });

        // Clic en dehors du modal
        this.overlay.addEventListener('click', (e) => {
            if (e.target === this.overlay) {
                this.close();
            }
        });

        // Boutons de thème
        this.modal.querySelectorAll('.theme-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.selectTheme(btn.dataset.theme);
            });
        });

        // Range keyboard keys
        const keyboardRange = this.modal.querySelector('#keyboardKeysRange');
        const keyboardValue = this.modal.querySelector('#keyboardKeysValue');
        keyboardRange.addEventListener('input', (e) => {
            keyboardValue.textContent = e.target.value;
        });

        // Range note display time
        const timeRange = this.modal.querySelector('#noteDisplayTimeRange');
        const timeValue = this.modal.querySelector('#noteDisplayTimeValue');
        timeRange.addEventListener('input', (e) => {
            timeValue.textContent = e.target.value + 's';
        });

        // Touche Escape pour fermer
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.overlay.style.display === 'flex') {
                this.close();
            }
        });
    }

    /**
     * Sélectionner un thème
     */
    selectTheme(theme) {
        this.modal.querySelectorAll('.theme-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        this.modal.querySelector(`[data-theme="${theme}"]`).classList.add('active');
    }

    /**
     * Ouvrir le modal
     */
    open() {
        this.overlay.style.display = 'flex';

        // Restaurer les valeurs actuelles
        this.selectTheme(this.settings.theme);
        this.modal.querySelector('#keyboardKeysRange').value = this.settings.keyboardKeys;
        this.modal.querySelector('#keyboardKeysValue').textContent = this.settings.keyboardKeys;
        this.modal.querySelector('#noteDisplayTimeRange').value = this.settings.noteDisplayTime;
        this.modal.querySelector('#noteDisplayTimeValue').textContent = this.settings.noteDisplayTime + 's';
        this.modal.querySelector('#virtualInstrumentToggle').checked = this.settings.virtualInstrument;

        this.logger?.info('Settings modal opened');
    }

    /**
     * Fermer le modal
     */
    close() {
        this.overlay.style.display = 'none';
        this.logger?.info('Settings modal closed');
    }

    /**
     * Sauvegarder et appliquer les paramètres
     */
    save() {
        // Récupérer les nouvelles valeurs
        const newSettings = {
            theme: this.modal.querySelector('.theme-btn.active').dataset.theme,
            keyboardKeys: parseInt(this.modal.querySelector('#keyboardKeysRange').value),
            noteDisplayTime: parseInt(this.modal.querySelector('#noteDisplayTimeRange').value),
            virtualInstrument: this.modal.querySelector('#virtualInstrumentToggle').checked
        };

        // Vérifier les changements
        const themeChanged = newSettings.theme !== this.settings.theme;
        const keyboardChanged = newSettings.keyboardKeys !== this.settings.keyboardKeys;
        const timeChanged = newSettings.noteDisplayTime !== this.settings.noteDisplayTime;
        const virtualInstrumentChanged = newSettings.virtualInstrument !== this.settings.virtualInstrument;

        // Mettre à jour les paramètres
        this.settings = newSettings;
        this.saveSettings();
        this.applySettings();

        // Émettre les événements de changement
        if (themeChanged) {
            this.eventBus?.emit('settings:theme_changed', { theme: newSettings.theme });
        }
        if (keyboardChanged) {
            this.eventBus?.emit('settings:keyboard_changed', { keys: newSettings.keyboardKeys });
        }
        if (timeChanged) {
            this.eventBus?.emit('settings:display_time_changed', { time: newSettings.noteDisplayTime });
        }
        if (virtualInstrumentChanged) {
            this.eventBus?.emit('settings:virtual_instrument_changed', { enabled: newSettings.virtualInstrument });

            if (newSettings.virtualInstrument) {
                this.logger?.info('🎵 Instrument virtuel activé - Les messages MIDI seront envoyés aux logs');
            } else {
                this.logger?.info('🎵 Instrument virtuel désactivé');
            }
        }

        this.close();
        this.logger?.info('Settings saved and applied', newSettings);
    }

    /**
     * Appliquer les paramètres actuels
     */
    applySettings() {
        this.applyTheme(this.settings.theme);

        // Les autres paramètres seront appliqués par les composants concernés
        // via les événements de l'EventBus
    }

    /**
     * Appliquer un thème
     */
    applyTheme(theme) {
        const root = document.documentElement;

        // Supprimer les classes de thème précédentes
        document.body.classList.remove('theme-light', 'theme-dark', 'theme-colored');

        // Ajouter la nouvelle classe
        document.body.classList.add(`theme-${theme}`);

        // Appliquer les variables CSS selon le thème
        switch (theme) {
            case 'dark':
                root.style.setProperty('--bg-primary', '#1a1a1a');
                root.style.setProperty('--bg-secondary', '#2d2d2d');
                root.style.setProperty('--text-primary', '#ffffff');
                root.style.setProperty('--text-secondary', '#cccccc');
                root.style.setProperty('--border-color', '#404040');
                root.style.setProperty('--card-bg', '#2d2d2d');
                root.style.setProperty('--header-bg', '#2d2d2d');
                break;

            case 'colored':
                root.style.setProperty('--bg-primary', 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)');
                root.style.setProperty('--bg-secondary', '#ffffff');
                root.style.setProperty('--text-primary', '#333333');
                root.style.setProperty('--text-secondary', '#666666');
                root.style.setProperty('--border-color', '#e5e7eb');
                root.style.setProperty('--card-bg', '#ffffff');
                root.style.setProperty('--header-bg', 'rgba(255, 255, 255, 0.95)');
                break;

            case 'light':
            default:
                root.style.setProperty('--bg-primary', '#f9fafb');
                root.style.setProperty('--bg-secondary', '#ffffff');
                root.style.setProperty('--text-primary', '#333333');
                root.style.setProperty('--text-secondary', '#666666');
                root.style.setProperty('--border-color', '#e5e7eb');
                root.style.setProperty('--card-bg', '#ffffff');
                root.style.setProperty('--header-bg', '#ffffff');
                break;
        }

        this.logger?.info(`Theme applied: ${theme}`);
    }

    /**
     * Obtenir les paramètres actuels
     */
    getSettings() {
        return { ...this.settings };
    }
}
