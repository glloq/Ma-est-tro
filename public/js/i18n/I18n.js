/**
 * I18n - Gestionnaire d'internationalisation léger pour Ma-est-tro
 *
 * Supporte : Français (fr), Anglais (en), Espagnol (es)
 *
 * Usage:
 *   await i18n.init();
 *   i18n.t('settings.title'); // "⚙️ Réglages"
 *   i18n.t('common.octaves', { count: 2 }); // "2 octaves"
 */

(function(global) {
    'use strict';

    class I18n {
        constructor() {
            this.currentLocale = 'fr';
            this.fallbackLocale = 'fr';
            this.translations = {};
            this.supportedLocales = ['fr', 'en', 'es', 'de', 'it', 'pt', 'nl', 'pl', 'ru', 'ja', 'zh-CN', 'ko', 'hi', 'tr', 'sv', 'no', 'el', 'id', 'vi', 'bn', 'th', 'da', 'fi', 'cs', 'hu', 'tl', 'uk'];
            this.localeNames = {
                'fr': 'Français',
                'en': 'English',
                'es': 'Español',
                'de': 'Deutsch',
                'it': 'Italiano',
                'pt': 'Português',
                'nl': 'Nederlands',
                'pl': 'Polski',
                'ru': 'Русский',
                'ja': '日本語',
                'zh-CN': '简体中文',
                'ko': '한국어',
                'hi': 'हिन्दी',
                'tr': 'Türkçe',
                'sv': 'Svenska',
                'no': 'Norsk',
                'el': 'Ελληνικά',
                'id': 'Bahasa Indonesia',
                'vi': 'Tiếng Việt',
                'bn': 'বাংলা',
                'th': 'ไทย',
                'da': 'Dansk',
                'fi': 'Suomi',
                'cs': 'Čeština',
                'hu': 'Magyar',
                'tl': 'Filipino',
                'uk': 'Українська'
            };
            this.listeners = [];
            this.initialized = false;
        }

        /**
         * Initialise le système i18n
         * Charge la langue sauvegardée ou détecte automatiquement
         */
        async init() {
            if (this.initialized) {
                console.log('[I18n] Already initialized');
                return;
            }

            // Récupérer la langue sauvegardée ou détecter automatiquement
            const savedLocale = localStorage.getItem('maestro_locale');
            const browserLocale = navigator.language?.split('-')[0];

            let locale = savedLocale || browserLocale || this.fallbackLocale;

            // Vérifier que la locale est supportée
            if (!this.supportedLocales.includes(locale)) {
                locale = this.fallbackLocale;
            }

            await this.loadLocale(locale);
            this.updatePageTranslations();
            this.initialized = true;

            console.log(`[I18n] Initialized with locale: ${this.currentLocale}`);
        }

        /**
         * Charge un fichier de traduction
         * @param {string} locale - Code de langue (fr, en, es)
         */
        async loadLocale(locale) {
            try {
                const response = await fetch(`/locales/${locale}.json`);
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }
                this.translations = await response.json();
                this.currentLocale = locale;
                localStorage.setItem('maestro_locale', locale);

                // Mettre à jour l'attribut lang du HTML
                document.documentElement.lang = locale;

            } catch (error) {
                console.warn(`[I18n] Failed to load locale "${locale}":`, error);

                // Fallback vers la langue par défaut
                if (locale !== this.fallbackLocale) {
                    console.log(`[I18n] Falling back to ${this.fallbackLocale}`);
                    await this.loadLocale(this.fallbackLocale);
                }
            }
        }

        /**
         * Traduit une clé
         * @param {string} key - Clé de traduction (ex: "settings.title")
         * @param {Object} params - Paramètres pour l'interpolation
         * @returns {string} - Texte traduit ou clé si non trouvé
         */
        t(key, params = {}) {
            const keys = key.split('.');
            let value = this.translations;

            for (const k of keys) {
                if (value && typeof value === 'object' && k in value) {
                    value = value[k];
                } else {
                    // Clé non trouvée, retourner la clé elle-même
                    console.warn(`[I18n] Missing translation: ${key}`);
                    return key;
                }
            }

            if (typeof value !== 'string') {
                console.warn(`[I18n] Translation is not a string: ${key}`);
                return key;
            }

            // Interpolation des paramètres : {param} → valeur
            return value.replace(/\{(\w+)\}/g, (match, name) => {
                return params.hasOwnProperty(name) ? params[name] : match;
            });
        }

        /**
         * Change la langue courante
         * @param {string} locale - Code de langue
         */
        async setLocale(locale) {
            if (!this.supportedLocales.includes(locale)) {
                console.warn(`[I18n] Unsupported locale: ${locale}`);
                return;
            }

            if (locale === this.currentLocale) {
                return;
            }

            await this.loadLocale(locale);
            this.updatePageTranslations();
            this.notifyListeners();

            console.log(`[I18n] Locale changed to: ${locale}`);
        }

        /**
         * Met à jour tous les éléments avec l'attribut data-i18n
         */
        updatePageTranslations() {
            // Éléments avec data-i18n pour le contenu textuel
            document.querySelectorAll('[data-i18n]').forEach(el => {
                const key = el.getAttribute('data-i18n');
                const translation = this.t(key);
                if (translation !== key) {
                    el.textContent = translation;
                }
            });

            // Éléments avec data-i18n-placeholder pour les placeholders
            document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
                const key = el.getAttribute('data-i18n-placeholder');
                const translation = this.t(key);
                if (translation !== key) {
                    el.placeholder = translation;
                }
            });

            // Éléments avec data-i18n-title pour les titres (tooltips)
            document.querySelectorAll('[data-i18n-title]').forEach(el => {
                const key = el.getAttribute('data-i18n-title');
                const translation = this.t(key);
                if (translation !== key) {
                    el.title = translation;
                }
            });

            // Éléments avec data-i18n-html pour le contenu HTML
            document.querySelectorAll('[data-i18n-html]').forEach(el => {
                const key = el.getAttribute('data-i18n-html');
                const translation = this.t(key);
                if (translation !== key) {
                    el.innerHTML = translation;
                }
            });
        }

        /**
         * Retourne la locale courante
         */
        getLocale() {
            return this.currentLocale;
        }

        /**
         * Retourne la liste des locales supportées
         */
        getSupportedLocales() {
            return this.supportedLocales.map(code => ({
                code,
                name: this.localeNames[code]
            }));
        }

        /**
         * Ajoute un écouteur pour les changements de langue
         * @param {Function} callback
         */
        onLocaleChange(callback) {
            this.listeners.push(callback);
            return () => {
                this.listeners = this.listeners.filter(cb => cb !== callback);
            };
        }

        /**
         * Notifie tous les écouteurs du changement de langue
         */
        notifyListeners() {
            this.listeners.forEach(callback => {
                try {
                    callback(this.currentLocale);
                } catch (error) {
                    console.error('[I18n] Listener error:', error);
                }
            });
        }

        /**
         * Formate un nombre selon la locale courante
         * @param {number} number
         * @param {Object} options - Options Intl.NumberFormat
         */
        formatNumber(number, options = {}) {
            return new Intl.NumberFormat(this.currentLocale, options).format(number);
        }

        /**
         * Formate une date selon la locale courante
         * @param {Date} date
         * @param {Object} options - Options Intl.DateTimeFormat
         */
        formatDate(date, options = {}) {
            return new Intl.DateTimeFormat(this.currentLocale, options).format(date);
        }
    }

    // Instance singleton exposée globalement
    global.i18n = new I18n();

    // Export pour ES modules si disponible
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = { i18n: global.i18n, I18n };
    }

})(typeof window !== 'undefined' ? window : this);
