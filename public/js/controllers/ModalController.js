// ============================================================================
// Fichier: frontend/js/controllers/ModalController.js
// Chemin réel: frontend/js/controllers/ModalController.js
// Version: v3.4.1 - FIXED BACKEND SIGNATURE - AMÉLIORATIONS NOTIFICATIONS & VALIDATIONS
// Date: 2025-11-01
// ============================================================================
// CORRECTIONS v3.4.1:
// ✅ CRITIQUE: Ajout paramètre backend au constructeur (6ème paramètre)
// ✅ Fix: super() appelle BaseController avec backend
// ✅ this.backend initialisé automatiquement via BaseController
// ============================================================================
// ============================================================================
// AMÉLIORATIONS v3.4.0:
// ✓ Meilleure intégration NotificationManager
// ✓ Validation formulaires robuste
// ✓ Méthodes helper pour modales communes
// ✓ Gestion erreurs améliorée
// ✓ Feedback utilisateur optimisé
// ✓ Support formulaires asynchrones
// ============================================================================

class ModalController extends BaseController {
    constructor(eventBus, models = {}, views = {}, notifications = null, debugConsole = null, backend = null) {
        super(eventBus, models, views, notifications, debugConsole, backend);
        
        // Référence au backend
        // ✅ this.backend initialisé automatiquement par BaseController
        
        // Registre des modales disponibles
        this.modals = {
            channelSettings: {
                id: 'channelModal',
                title: 'Attribution des canaux MIDI',
                size: 'large',
                closable: true,
                backdrop: true
            },
            instrumentConfig: {
                id: 'instrumentConfigModal',
                title: 'Configuration de l\'instrument',
                size: 'medium',
                closable: true,
                backdrop: true
            },
            playlistEditor: {
                id: 'playlistEditorModal',
                title: 'Éditeur de playlist',
                size: 'large',
                closable: true,
                backdrop: true
            },
            fileUpload: {
                id: 'fileUploadModal',
                title: 'Upload de fichiers MIDI',
                size: 'medium',
                closable: true,
                backdrop: true
            },
            systemConfig: {
                id: 'systemConfigModal',
                title: 'Configuration système',
                size: 'extra-large',
                closable: true,
                backdrop: true
            },
            confirmation: {
                id: 'confirmationModal',
                title: 'Confirmation',
                size: 'small',
                closable: true,
                backdrop: true
            },
            information: {
                id: 'informationModal',
                title: 'Information',
                size: 'medium',
                closable: true,
                backdrop: true
            },
            error: {
                id: 'errorModal',
                title: 'Erreur',
                size: 'medium',
                closable: true,
                backdrop: true
            }
        };

        // État interne
        this._draggedPlaylistItem = null;
        
        // État des modales
        this.modalState = {
            activeModals: new Set(),
            modalStack: [],
            currentFocus: null,
            lastActiveElement: null,
            validationErrors: new Map()
        };
        
        // Configuration d'animation
        this.animationConfig = {
            duration: 300,
            easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
            enableBackdrop: true,
            closeOnBackdropClick: true,
            closeOnEscape: true
        };
        
        // Cache et handlers
        this.contentCache = new Map();
        this.eventHandlers = new Map();
        this.validationRules = new Map();
        this.pendingActions = new Map();
        
        this.initializeModals();
        this.log('info', 'ModalController', '✓ Initialized v3.4.0');
    }

    /**
     * Configuration des événements
     */
    bindEvents() {
        this.eventBus.on('modal:open', (data) => {
            this.open(data.modalId, data.options);
        });
        
        this.eventBus.on('modal:close', (data) => {
            this.close(data.modalId);
        });
        
        this.eventBus.on('modal:confirm', (data) => {
            this.confirm(data.message, data.callback, data.options);
        });
        
        // Invalider cache sur changements
        this.eventBus.on('instrument:updated', () => {
            this.invalidateCache(['channelSettings', 'instrumentConfig']);
        });
        
        this.eventBus.on('file:added', () => {
            this.invalidateCache(['playlistEditor']);
        });
    }

    /**
     * Initialise le système de modales
     */
    initializeModals() {
        this.createModalContainers();
        this.setupGlobalEvents();
        this.setupValidationRules();
        this.log('debug', 'ModalController', 'Système de modales initialisé');
    }

    /**
     * Configure les règles de validation par défaut
     */
    setupValidationRules() {
        // Validation nom de playlist
        this.validationRules.set('playlistName', {
            required: true,
            minLength: 1,
            maxLength: 100,
            pattern: /^[a-zA-Z0-9\s\-_]+$/,
            message: 'Le nom doit contenir entre 1 et 100 caractères alphanumériques'
        });
        
        // Validation nom de fichier
        this.validationRules.set('filename', {
            required: true,
            pattern: /^[a-zA-Z0-9\s\-_\.]+$/,
            message: 'Nom de fichier invalide'
        });
        
        // Validation tempo
        this.validationRules.set('tempo', {
            required: true,
            min: 20,
            max: 300,
            message: 'Le tempo doit être entre 20 et 300 BPM'
        });
    }

    /**
     * Crée les conteneurs HTML
     */
    createModalContainers() {
        const existingContainer = document.getElementById('modal-container');
        if (existingContainer) {
            existingContainer.remove();
        }
        
        const container = document.createElement('div');
        container.id = 'modal-container';
        container.innerHTML = this.buildAllModalsHTML();
        document.body.appendChild(container);
    }

    /**
     * Configure les événements globaux
     */
    setupGlobalEvents() {
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' && this.animationConfig.closeOnEscape) {
                this.closeTopModal();
            }
        });
        
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Tab' && this.modalState.activeModals.size > 0) {
                this.handleTabKey(event);
            }
        });
    }

    // ========================================================================
    // GESTION DES MODALES
    // ========================================================================

    /**
     * Ouvre une modale
     */
    async open(modalId, options = {}) {
        const modalConfig = this.modals[modalId];
        if (!modalConfig) {
            this.notify('error', `Modale inconnue: ${modalId}`);
            return false;
        }
        
        if (this.modalState.activeModals.has(modalId)) {
            this.log('debug', 'ModalController', `Modale déjà ouverte: ${modalId}`);
            return false;
        }
        
        try {
            this.modalState.lastActiveElement = document.activeElement;
            
            const content = await this.generateModalContent(modalId, options);
            const modalElement = document.getElementById(modalConfig.id);
            
            if (modalElement) {
                this.updateModalContent(modalElement, content, modalConfig.title);
                this.modalState.activeModals.add(modalId);
                this.modalState.modalStack.push(modalId);
                
                await this.animateModalOpen(modalElement);
                this.setupModalFocus(modalElement);
                
                this.eventBus.emit('modal:opened', { modalId, options });
                this.log('debug', 'ModalController', `Modale ouverte: ${modalId}`);
                return true;
            }
        } catch (error) {
            this.handleError('Erreur ouverture modale', error);
            return false;
        }
        
        return false;
    }

    /**
     * Ferme une modale
     */
    async close(modalId) {
        if (!this.modalState.activeModals.has(modalId)) {
            return false;
        }
        
        const modalConfig = this.modals[modalId];
        const modalElement = document.getElementById(modalConfig.id);
        
        if (modalElement) {
            try {
                await this.animateModalClose(modalElement);
                
                this.modalState.activeModals.delete(modalId);
                this.modalState.modalStack = this.modalState.modalStack.filter(id => id !== modalId);
                this.modalState.validationErrors.delete(modalId);
                
                if (this.modalState.activeModals.size === 0) {
                    this.restoreFocus();
                } else {
                    const prevModalId = this.modalState.modalStack[this.modalState.modalStack.length - 1];
                    if (prevModalId) {
                        const prevModal = document.getElementById(this.modals[prevModalId].id);
                        this.setupModalFocus(prevModal);
                    }
                }
                
                this.eventBus.emit('modal:closed', { modalId });
                this.log('debug', 'ModalController', `Modale fermée: ${modalId}`);
                return true;
            } catch (error) {
                this.handleError('Erreur fermeture modale', error);
            }
        }
        
        return false;
    }

    /**
     * Ferme la modale du dessus
     */
    closeTopModal() {
        if (this.modalState.modalStack.length > 0) {
            const topModalId = this.modalState.modalStack[this.modalState.modalStack.length - 1];
            this.close(topModalId);
        }
    }

    /**
     * Ferme toutes les modales
     */
    closeAll() {
        const modalIds = [...this.modalState.activeModals];
        modalIds.forEach(modalId => this.close(modalId));
    }

    // ========================================================================
    // MODALES SPÉCIALISÉES (HELPERS)
    // ========================================================================

    /**
     * Affiche une modale de confirmation
     */
    confirm(message, callback, options = {}) {
        const confirmOptions = {
            message,
            callback,
            confirmText: options.confirmText || 'Confirmer',
            cancelText: options.cancelText || 'Annuler',
            confirmClass: options.confirmClass || 'btn-primary',
            cancelClass: options.cancelClass || 'btn-secondary'
        };
        
        this.pendingActions.set('confirmation', confirmOptions);
        this.open('confirmation', confirmOptions);
    }

    /**
     * Affiche une modale d'information
     */
    inform(message, options = {}) {
        this.open('information', {
            message,
            okText: options.okText || 'OK'
        });
    }

    /**
     * Affiche une modale d'erreur
     */
    showError(error, exception = null, options = {}) {
        this.open('error', {
            error,
            exception,
            showDetails: options.showDetails || false,
            okText: options.okText || 'Fermer'
        });
    }

    /**
     * Gère la confirmation (appelé depuis le HTML)
     */
    handleConfirm() {
        const action = this.pendingActions.get('confirmation');
        if (action && action.callback) {
            action.callback();
        }
        this.pendingActions.delete('confirmation');
        this.close('confirmation');
    }

    /**
     * Ouvre l'éditeur de playlist
     */
    async openPlaylistEditor(playlistId = null) {
        try {
            const options = { playlistId };
            
            if (playlistId) {
                // Charger les données de la playlist
                const playlist = await this.loadPlaylist(playlistId);
                options.playlist = playlist;
            }
            
            await this.open('playlistEditor', options);
        } catch (error) {
            this.handleError('Erreur ouverture éditeur de playlist', error);
            this.showError('Impossible d\'ouvrir l\'éditeur de playlist', error);
        }
    }

    /**
     * Charge une playlist
     */
    async loadPlaylist(playlistId) {
        // À implémenter selon le système de persistance
        return { id: playlistId, name: 'Ma Playlist', files: [] };
    }

    // ========================================================================
    // VALIDATION
    // ========================================================================

    /**
     * Valide un formulaire
     */
    validateForm(formElement, rules = null) {
        const errors = new Map();
        const inputs = formElement.querySelectorAll('[data-validate]');
        
        inputs.forEach(input => {
            const fieldName = input.getAttribute('data-validate');
            const rule = rules ? rules.get(fieldName) : this.validationRules.get(fieldName);
            
            if (!rule) return;
            
            const value = input.value;
            const error = this.validateField(value, rule);
            
            if (error) {
                errors.set(fieldName, error);
                this.showFieldError(input, error);
            } else {
                this.clearFieldError(input);
            }
        });
        
        return { valid: errors.size === 0, errors };
    }

    /**
     * Valide un champ individuel
     */
    validateField(value, rule) {
        // Required
        if (rule.required && (!value || value.trim() === '')) {
            return rule.message || 'Ce champ est requis';
        }
        
        // Min length
        if (rule.minLength && value.length < rule.minLength) {
            return rule.message || `Minimum ${rule.minLength} caractères`;
        }
        
        // Max length
        if (rule.maxLength && value.length > rule.maxLength) {
            return rule.message || `Maximum ${rule.maxLength} caractères`;
        }
        
        // Pattern
        if (rule.pattern && !rule.pattern.test(value)) {
            return rule.message || 'Format invalide';
        }
        
        // Numeric min
        if (rule.min !== undefined && Number(value) < rule.min) {
            return rule.message || `Valeur minimum: ${rule.min}`;
        }
        
        // Numeric max
        if (rule.max !== undefined && Number(value) > rule.max) {
            return rule.message || `Valeur maximum: ${rule.max}`;
        }
        
        return null;
    }

    /**
     * Valide un formulaire de manière asynchrone
     */
    async validateFormAsync(formElement, rules = null) {
        const syncResult = this.validateForm(formElement, rules);
        
        if (!syncResult.valid) {
            return syncResult;
        }
        
        // Validations asynchrones (ex: vérifier si un nom existe déjà)
        // À implémenter selon les besoins
        
        return { valid: syncResult.errors.size === 0, errors: syncResult.errors };
    }

    /**
     * Affiche une erreur de champ
     */
    showFieldError(input, message) {
        input.classList.add('error');
        
        let errorEl = input.nextElementSibling;
        if (!errorEl || !errorEl.classList.contains('field-error')) {
            errorEl = document.createElement('div');
            errorEl.className = 'field-error';
            input.parentNode.insertBefore(errorEl, input.nextSibling);
        }
        
        errorEl.textContent = message;
    }

    /**
     * Efface une erreur de champ
     */
    clearFieldError(input) {
        input.classList.remove('error');
        
        const errorEl = input.nextElementSibling;
        if (errorEl && errorEl.classList.contains('field-error')) {
            errorEl.remove();
        }
    }

    // ========================================================================
    // GÉNÉRATION DE CONTENU (stubs - à implémenter selon besoins)
    // ========================================================================

    async generateModalContent(modalId, options) {
        const cacheKey = `${modalId}_${JSON.stringify(options)}`;
        if (this.contentCache.has(cacheKey)) {
            return this.contentCache.get(cacheKey);
        }
        
        let content = '';
        
        switch (modalId) {
            case 'confirmation':
                content = this.buildConfirmationContent(options);
                break;
            case 'information':
                content = this.buildInformationContent(options);
                break;
            case 'error':
                content = this.buildErrorContent(options);
                break;
            default:
                content = this.buildDefaultContent(modalId, options);
        }
        
        if (options.cache !== false) {
            this.contentCache.set(cacheKey, content);
        }
        
        return content;
    }

    buildConfirmationContent(options) {
        return `
            <div class="modal-confirmation">
                <p>${options.message}</p>
                <div class="modal-actions">
                    <button class="btn-cancel" onclick="app.modalController.close('confirmation')">
                        ${options.cancelText || 'Annuler'}
                    </button>
                    <button class="btn-confirm" onclick="app.modalController.handleConfirm()">
                        ${options.confirmText || 'Confirmer'}
                    </button>
                </div>
            </div>
        `;
    }

    buildInformationContent(options) {
        return `
            <div class="modal-information">
                <p>${options.message}</p>
                <div class="modal-actions">
                    <button class="btn-primary" onclick="app.modalController.close('information')">
                        ${options.okText || 'OK'}
                    </button>
                </div>
            </div>
        `;
    }

    buildErrorContent(options) {
        return `
            <div class="modal-error">
                <p class="error-message">${options.error}</p>
                ${options.exception && options.showDetails ? `
                    <details class="error-details">
                        <summary>Détails techniques</summary>
                        <pre>${options.exception.stack || options.exception.message}</pre>
                    </details>
                ` : ''}
                <div class="modal-actions">
                    <button class="btn-primary" onclick="app.modalController.close('error')">
                        ${options.okText || 'Fermer'}
                    </button>
                </div>
            </div>
        `;
    }

    buildDefaultContent(modalId, options) {
        return `<div>Contenu par défaut pour ${modalId}</div>`;
    }

    buildAllModalsHTML() {
        return `
            <!-- Les modales sont créées dynamiquement selon les besoins -->
            <div id="channelModal" class="modal"></div>
            <div id="instrumentConfigModal" class="modal"></div>
            <div id="playlistEditorModal" class="modal"></div>
            <div id="fileUploadModal" class="modal"></div>
            <div id="systemConfigModal" class="modal"></div>
            <div id="confirmationModal" class="modal"></div>
            <div id="informationModal" class="modal"></div>
            <div id="errorModal" class="modal"></div>
            <div class="modal-backdrop"></div>
        `;
    }

    // ========================================================================
    // ANIMATIONS & HELPERS
    // ========================================================================

    updateModalContent(modalElement, content, title) {
        modalElement.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>${title}</h3>
                    <button class="modal-close" onclick="app.modalController.closeTopModal()">✕</button>
                </div>
                <div class="modal-body">${content}</div>
            </div>
        `;
    }

    async animateModalOpen(modalElement) {
        modalElement.style.display = 'flex';
        const backdrop = document.querySelector('.modal-backdrop');
        if (backdrop) backdrop.style.display = 'block';
        
        await new Promise(resolve => requestAnimationFrame(() => {
            modalElement.classList.add('modal-open');
            if (backdrop) backdrop.classList.add('modal-backdrop-open');
            setTimeout(resolve, this.animationConfig.duration);
        }));
    }

    async animateModalClose(modalElement) {
        modalElement.classList.remove('modal-open');
        
        const backdrop = document.querySelector('.modal-backdrop');
        if (this.modalState.activeModals.size === 1 && backdrop) {
            backdrop.classList.remove('modal-backdrop-open');
        }
        
        await new Promise(resolve => setTimeout(resolve, this.animationConfig.duration));
        modalElement.style.display = 'none';
        if (this.modalState.activeModals.size === 1 && backdrop) {
            backdrop.style.display = 'none';
        }
    }

    setupModalFocus(modalElement) {
        const firstFocusable = modalElement.querySelector('button, input, select, textarea, [tabindex]:not([tabindex="-1"])');
        if (firstFocusable) {
            firstFocusable.focus();
        }
    }

    restoreFocus() {
        if (this.modalState.lastActiveElement && typeof this.modalState.lastActiveElement.focus === 'function') {
            this.modalState.lastActiveElement.focus();
        }
    }

    handleTabKey(event) {
        // Focus trap - à implémenter si nécessaire
    }

    invalidateCache(modalIds) {
        if (Array.isArray(modalIds)) {
            modalIds.forEach(id => {
                for (const key of this.contentCache.keys()) {
                    if (key.startsWith(id)) {
                        this.contentCache.delete(key);
                    }
                }
            });
        }
    }

    /**
     * Nettoie les ressources
     */
    destroy() {
        this.closeAll();
        this.contentCache?.clear();
        this.eventHandlers?.clear();
        this.validationRules?.clear();
        
        const container = document.getElementById('modal-container');
        if (container) {
            container.remove();
        }
        
        super.destroy();
    }
}

// ============================================================================
// EXPORT
// ============================================================================

if (typeof module !== 'undefined' && module.exports) {
    module.exports = ModalController;
}

if (typeof window !== 'undefined') {
    window.ModalController = ModalController;
}