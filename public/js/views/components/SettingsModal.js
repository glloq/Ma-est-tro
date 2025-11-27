/**
 * SettingsModal - Modal pour les réglages de l'application
 *
 * Fonctionnalités :
 * - Modification du thème (dark, light, colored)
 * - Ajustement du nombre de touches du clavier
 * - Modification du temps d'affichage des notes
 * - Gestion de l'instrument virtuel
 * - Sélection de la langue (FR, EN, ES)
 *
 * Dépendance: i18n doit être chargé avant ce script (js/i18n/I18n.js)
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

        // Écouter les changements de langue pour mettre à jour le modal
        i18n.onLocaleChange(() => this.updateModalTexts());
    }

    /**
     * Charger les paramètres depuis localStorage
     */
    loadSettings() {
        const defaults = {
            theme: 'light',
            keyboardOctaves: 2, // 2 octaves par défaut (24 touches)
            noteDisplayTime: 20, // secondes
            virtualInstrument: false
        };

        try {
            const saved = localStorage.getItem('maestro_settings');
            if (saved) {
                const parsed = JSON.parse(saved);

                // Migration: convertir keyboardKeys → keyboardOctaves si nécessaire
                if (parsed.keyboardKeys !== undefined && parsed.keyboardOctaves === undefined) {
                    parsed.keyboardOctaves = Math.ceil(parsed.keyboardKeys / 12);
                    delete parsed.keyboardKeys;
                    this.logger?.info(`Migrated keyboardKeys (${parsed.keyboardKeys}) to keyboardOctaves (${parsed.keyboardOctaves})`);
                }

                return { ...defaults, ...parsed };
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
        header.className = 'settings-modal-header';
        header.style.cssText = `
            padding: 24px;
            border-bottom: 1px solid #e5e7eb;
            display: flex;
            justify-content: space-between;
            align-items: center;
        `;
        header.innerHTML = `
            <h2 class="settings-title" style="margin: 0; color: #667eea; font-size: 20px;" data-i18n="settings.title">⚙️ ${i18n.t('settings.title')}</h2>
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
        content.className = 'settings-modal-content';
        content.style.cssText = `
            padding: 24px;
            overflow-y: auto;
            flex: 1;
        `;
        content.innerHTML = this.renderContent();

        // Footer
        const footer = document.createElement('div');
        footer.className = 'settings-modal-footer';
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
            ">${i18n.t('common.cancel')}</button>
            <button class="btn btn-primary settings-save-btn" style="
                padding: 10px 20px;
                border: none;
                border-radius: 6px;
                background: #667eea;
                color: white;
                cursor: pointer;
                font-size: 14px;
                transition: all 0.2s;
            ">${i18n.t('common.save')}</button>
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
     * Générer le contenu HTML du modal
     */
    renderContent() {
        const currentLocale = i18n.getLocale();
        const locales = i18n.getSupportedLocales();

        return `
            <!-- Langue -->
            <div class="settings-section">
                <h3 style="margin: 0 0 16px 0; font-size: 16px; color: #333;">🌐 ${i18n.t('settings.language.title')}</h3>
                <div class="language-options" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 10px;">
                    ${locales.map(locale => `
                        <button class="language-btn ${locale.code === currentLocale ? 'active' : ''}"
                                data-locale="${locale.code}"
                                style="
                                    padding: 10px 12px;
                                    border: 2px solid ${locale.code === currentLocale ? '#667eea' : '#e5e7eb'};
                                    border-radius: 8px;
                                    background: ${locale.code === currentLocale ? '#f0f4ff' : 'white'};
                                    cursor: pointer;
                                    transition: all 0.2s;
                                    font-size: 13px;
                                    display: flex;
                                    align-items: center;
                                    justify-content: flex-start;
                                    gap: 8px;
                                    white-space: nowrap;
                                    overflow: hidden;
                                ">
                            <span style="font-size: 18px; flex-shrink: 0;">${this.getLocaleFlag(locale.code)}</span>
                            <span style="overflow: hidden; text-overflow: ellipsis;">${locale.name}</span>
                        </button>
                    `).join('')}
                </div>
            </div>

            <!-- Thème -->
            <div class="settings-section" style="margin-top: 24px;">
                <h3 style="margin: 0 0 16px 0; font-size: 16px; color: #333;">🎨 ${i18n.t('settings.theme.title')}</h3>
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
                        <span>${i18n.t('settings.theme.light')}</span>
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
                        <span>${i18n.t('settings.theme.dark')}</span>
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
                        <span>${i18n.t('settings.theme.colored')}</span>
                    </button>
                </div>
            </div>

            <!-- Clavier -->
            <div class="settings-section" style="margin-top: 24px;">
                <h3 style="margin: 0 0 16px 0; font-size: 16px; color: #333;">🎹 ${i18n.t('settings.keyboard.title')}</h3>
                <div style="display: flex; flex-direction: column; gap: 8px;">
                    <label style="font-size: 14px; color: #666;">
                        ${i18n.t('settings.keyboard.octaveCount')} : <strong id="keyboardOctavesValue">${this.settings.keyboardOctaves}</strong>
                        <span style="color: #999; font-weight: normal;">(<span id="keyboardTouchesCount">${this.settings.keyboardOctaves * 12}</span> ${i18n.t('common.keys')})</span>
                    </label>
                    <input type="range" id="keyboardOctavesRange" min="1" max="4" step="1"
                           value="${this.settings.keyboardOctaves}"
                           style="width: 100%;">
                    <div style="display: flex; justify-content: space-between; font-size: 12px; color: #999;">
                        <span>1 ${i18n.t('common.octave')}</span>
                        <span>4 ${i18n.t('common.octaves')}</span>
                    </div>
                </div>
            </div>

            <!-- Temps d'affichage -->
            <div class="settings-section" style="margin-top: 24px;">
                <h3 style="margin: 0 0 16px 0; font-size: 16px; color: #333;">⏱️ ${i18n.t('settings.noteDisplay.title')}</h3>
                <div style="display: flex; flex-direction: column; gap: 8px;">
                    <label style="font-size: 14px; color: #666;">
                        ${i18n.t('settings.noteDisplay.visibleDuration')} : <strong id="noteDisplayTimeValue">${this.settings.noteDisplayTime}s</strong>
                    </label>
                    <input type="range" id="noteDisplayTimeRange" min="5" max="60" step="5"
                           value="${this.settings.noteDisplayTime}"
                           style="width: 100%;">
                    <div style="display: flex; justify-content: space-between; font-size: 12px; color: #999;">
                        <span>${i18n.t('settings.noteDisplay.minSeconds')}</span>
                        <span>${i18n.t('settings.noteDisplay.maxSeconds')}</span>
                    </div>
                </div>
            </div>

            <!-- Instrument virtuel -->
            <div class="settings-section" style="margin-top: 24px;">
                <h3 style="margin: 0 0 16px 0; font-size: 16px; color: #333;">🎵 ${i18n.t('settings.virtualInstrument.title')}</h3>
                <div style="display: flex; align-items: center; justify-content: space-between; gap: 16px;">
                    <div style="flex: 1;">
                        <p style="margin: 0 0 4px 0; font-size: 14px; color: #333;">${i18n.t('settings.virtualInstrument.enable')}</p>
                        <p style="margin: 0; font-size: 12px; color: #666;">${i18n.t('settings.virtualInstrument.description')}</p>
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
    }

    /**
     * Obtenir le drapeau emoji pour une locale
     */
    getLocaleFlag(locale) {
        const flags = {
            'fr': '🇫🇷',
            'en': '🇬🇧',
            'es': '🇪🇸',
            'de': '🇩🇪',
            'it': '🇮🇹',
            'pt': '🇧🇷',
            'nl': '🇳🇱',
            'pl': '🇵🇱',
            'ru': '🇷🇺',
            'ja': '🇯🇵',
            'zh-CN': '🇨🇳',
            'ko': '🇰🇷',
            'hi': '🇮🇳',
            'tr': '🇹🇷',
            'sv': '🇸🇪',
            'no': '🇳🇴',
            'el': '🇬🇷',
            'id': '🇮🇩',
            'vi': '🇻🇳',
            'bn': '🇧🇩'
        };
        return flags[locale] || '🌐';
    }

    /**
     * Mettre à jour les textes du modal lors du changement de langue
     */
    updateModalTexts() {
        if (!this.modal) return;

        // Mettre à jour le titre
        const title = this.modal.querySelector('.settings-title');
        if (title) {
            title.innerHTML = `⚙️ ${i18n.t('settings.title')}`;
        }

        // Mettre à jour le contenu
        const content = this.modal.querySelector('.settings-modal-content');
        if (content) {
            content.innerHTML = this.renderContent();
            // Réattacher les événements pour les nouveaux éléments
            this.attachContentEventListeners();
            // Restaurer les valeurs
            this.selectTheme(this.settings.theme);
        }

        // Mettre à jour les boutons du footer
        const cancelBtn = this.modal.querySelector('.settings-cancel-btn');
        const saveBtn = this.modal.querySelector('.settings-save-btn');
        if (cancelBtn) cancelBtn.textContent = i18n.t('common.cancel');
        if (saveBtn) saveBtn.textContent = i18n.t('common.save');
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

            .theme-btn.active,
            .language-btn.active {
                border-color: #667eea !important;
                background: #f0f4ff !important;
            }

            .theme-btn:hover,
            .language-btn:hover {
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

        // Touche Escape pour fermer
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.overlay.style.display === 'flex') {
                this.close();
            }
        });

        // Attacher les événements du contenu
        this.attachContentEventListeners();
    }

    /**
     * Attacher les événements du contenu (appelé après mise à jour du contenu)
     */
    attachContentEventListeners() {
        // Boutons de langue
        this.modal.querySelectorAll('.language-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const locale = btn.dataset.locale;
                await i18n.setLocale(locale);
                // Mettre à jour l'état actif des boutons
                this.modal.querySelectorAll('.language-btn').forEach(b => {
                    b.classList.toggle('active', b.dataset.locale === locale);
                    b.style.borderColor = b.dataset.locale === locale ? '#667eea' : '#e5e7eb';
                    b.style.background = b.dataset.locale === locale ? '#f0f4ff' : 'white';
                });
            });
        });

        // Boutons de thème
        this.modal.querySelectorAll('.theme-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.selectTheme(btn.dataset.theme);
            });
        });

        // Range keyboard octaves
        const keyboardRange = this.modal.querySelector('#keyboardOctavesRange');
        const keyboardValue = this.modal.querySelector('#keyboardOctavesValue');
        const keyboardTouchesCount = this.modal.querySelector('#keyboardTouchesCount');
        if (keyboardRange) {
            keyboardRange.addEventListener('input', (e) => {
                const octaves = parseInt(e.target.value);
                keyboardValue.textContent = octaves;
                keyboardTouchesCount.textContent = octaves * 12;
            });
        }

        // Range note display time
        const timeRange = this.modal.querySelector('#noteDisplayTimeRange');
        const timeValue = this.modal.querySelector('#noteDisplayTimeValue');
        if (timeRange) {
            timeRange.addEventListener('input', (e) => {
                timeValue.textContent = e.target.value + 's';
            });
        }
    }

    /**
     * Sélectionner un thème
     */
    selectTheme(theme) {
        this.modal.querySelectorAll('.theme-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        const selectedBtn = this.modal.querySelector(`[data-theme="${theme}"]`);
        if (selectedBtn) {
            selectedBtn.classList.add('active');
        }
    }

    /**
     * Ouvrir le modal
     */
    open() {
        this.overlay.style.display = 'flex';

        // Restaurer les valeurs actuelles
        this.selectTheme(this.settings.theme);

        const keyboardRange = this.modal.querySelector('#keyboardOctavesRange');
        const keyboardValue = this.modal.querySelector('#keyboardOctavesValue');
        const keyboardTouchesCount = this.modal.querySelector('#keyboardTouchesCount');
        const timeRange = this.modal.querySelector('#noteDisplayTimeRange');
        const timeValue = this.modal.querySelector('#noteDisplayTimeValue');
        const virtualToggle = this.modal.querySelector('#virtualInstrumentToggle');

        if (keyboardRange) keyboardRange.value = this.settings.keyboardOctaves;
        if (keyboardValue) keyboardValue.textContent = this.settings.keyboardOctaves;
        if (keyboardTouchesCount) keyboardTouchesCount.textContent = this.settings.keyboardOctaves * 12;
        if (timeRange) timeRange.value = this.settings.noteDisplayTime;
        if (timeValue) timeValue.textContent = this.settings.noteDisplayTime + 's';
        if (virtualToggle) virtualToggle.checked = this.settings.virtualInstrument;

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
        const activeThemeBtn = this.modal.querySelector('.theme-btn.active');
        const keyboardRange = this.modal.querySelector('#keyboardOctavesRange');
        const timeRange = this.modal.querySelector('#noteDisplayTimeRange');
        const virtualToggle = this.modal.querySelector('#virtualInstrumentToggle');

        const newSettings = {
            theme: activeThemeBtn ? activeThemeBtn.dataset.theme : this.settings.theme,
            keyboardOctaves: keyboardRange ? parseInt(keyboardRange.value) : this.settings.keyboardOctaves,
            noteDisplayTime: timeRange ? parseInt(timeRange.value) : this.settings.noteDisplayTime,
            virtualInstrument: virtualToggle ? virtualToggle.checked : this.settings.virtualInstrument
        };

        // Vérifier les changements
        const themeChanged = newSettings.theme !== this.settings.theme;
        const keyboardChanged = newSettings.keyboardOctaves !== this.settings.keyboardOctaves;
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
            this.eventBus?.emit('settings:keyboard_changed', { octaves: newSettings.keyboardOctaves });
        }
        if (timeChanged) {
            this.eventBus?.emit('settings:display_time_changed', { time: newSettings.noteDisplayTime });
        }
        if (virtualInstrumentChanged) {
            this.eventBus?.emit('settings:virtual_instrument_changed', { enabled: newSettings.virtualInstrument });

            if (newSettings.virtualInstrument) {
                this.logger?.info(`🎵 ${i18n.t('settings.virtualInstrument.enabled')}`);
            } else {
                this.logger?.info(`🎵 ${i18n.t('settings.virtualInstrument.disabled')}`);
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

// Export global
if (typeof window !== 'undefined') {
    window.SettingsModal = SettingsModal;
}
