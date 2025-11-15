// ============================================================================
// Fichier: frontend/js/utils/Notifications.js
// Projet: MidiMind v3.0 - SystÃ¨me d'Orchestration MIDI pour Raspberry Pi
// Version: 3.0.0
// Date: 2025-10-14
// ============================================================================
// Description:
//   SystÃ¨me de notifications toast moderne et complet.
//   Affichage notifications temporaires (success, error, warning, info).
//
// FonctionnalitÃ©s:
//   - Types : Success, Error, Warning, Info
//   - DurÃ©e auto-dismiss configurable
//   - Position Ã©cran (top-right, bottom-center, etc.)
//   - Queue de notifications
//   - IcÃ´nes automatiques selon type
//   - Actions personnalisÃ©es (boutons)
//   - Fermeture manuelle (Ã—)
//   - Animation entrÃ©e/sortie
//
// Architecture:
//   Notifications (classe singleton)
//   - Queue FIFO de notifications
//   - Container DOM injectÃ©
//   - Timeout auto-dismiss
//
// Auteur: MidiMind Team
// ============================================================================

class Notifications {
    constructor(eventBus, options = {}) {
        this.eventBus = eventBus || window.eventBus || null;
        
        // Configuration par dÃ©faut
        this.config = {
            position: options.position || 'top-right', // top-right, top-left, bottom-right, bottom-left, top-center, bottom-center
            defaultDuration: options.defaultDuration || 3000,
            maxVisible: options.maxVisible || 3,
            stackSpacing: options.stackSpacing || 10,
            animationDuration: options.animationDuration || 300,
            enableSound: options.enableSound || false,
            enableVibration: options.enableVibration || false
        };
        
        // File d'attente des notifications
        this.queue = [];
        this.activeNotifications = [];
        this.nextId = 1;
        
        // Conteneur principal
        this.container = null;
        
        // Statistiques
        this.stats = {
            success: 0,
            error: 0,
            warning: 0,
            info: 0,
            total: 0
        };
        
        this.initialize();
    }
    
    // ========================================================================
    // INITIALISATION
    // ========================================================================
    
    initialize() {
        // CrÃ©er le conteneur de notifications
        this.createContainer();
        
        // Ã‰couter les Ã©vÃ©nements globaux
        this.bindEvents();
        
        // Injecter les styles CSS
        this.injectStyles();
    }
    
    createContainer() {
        this.container = document.createElement('div');
        this.container.id = 'notifications-container';
        this.container.className = `notifications-container notifications-${this.config.position}`;
        document.body.appendChild(this.container);
    }
    
    bindEvents() {
        if (!this.eventBus) return;
        
        // Ã‰couter les Ã©vÃ©nements de notification
        this.eventBus.on('notification:show', (data) => {
            this.show(data.message, data.type, data.options);
        });
        
        this.eventBus.on('notification:success', (data) => {
            this.success(data.message, data.options);
        });
        
        this.eventBus.on('notification:error', (data) => {
            this.error(data.message, data.options);
        });
        
        this.eventBus.on('notification:warning', (data) => {
            this.warning(data.message, data.options);
        });
        
        this.eventBus.on('notification:info', (data) => {
            this.info(data.message, data.options);
        });
    }
    
    // ========================================================================
    // API PUBLIQUE
    // ========================================================================
    
    /**
     * Affiche une notification gÃ©nÃ©rique
     */
    show(message, type = 'info', options = {}) {
        const notification = this.createNotification(message, type, options);
        this.addToQueue(notification);
        return notification.id;
    }
    
    /**
     * Affiche une notification de succÃ¨s
     */
    success(message, options = {}) {
        return this.show(message, 'success', options);
    }
    
    /**
     * Affiche une notification d'erreur
     */
    error(message, options = {}) {
        return this.show(message, 'error', {
            duration: 5000, // Erreurs restent plus longtemps
            ...options
        });
    }
    
    /**
     * Affiche une notification d'avertissement
     */
    warning(message, options = {}) {
        return this.show(message, 'warning', options);
    }
    
    /**
     * Affiche une notification d'information
     */
    info(message, options = {}) {
        return this.show(message, 'info', options);
    }
    
    /**
     * Ferme une notification spÃ©cifique
     */
    close(notificationId) {
        const notification = this.activeNotifications.find(n => n.id === notificationId);
        if (notification) {
            this.removeNotification(notification);
        }
    }
    
    /**
     * Ferme toutes les notifications
     */
    closeAll() {
        // Copier le tableau car removeNotification le modifie
        const notifications = [...this.activeNotifications];
        notifications.forEach(notification => {
            this.removeNotification(notification);
        });
    }
    
    // ========================================================================
    // GESTION DES NOTIFICATIONS
    // ========================================================================
    
    createNotification(message, type, options = {}) {
        const id = this.nextId++;
        
        const notification = {
            id: id,
            message: message,
            type: type,
            duration: options.duration !== undefined ? options.duration : this.config.defaultDuration,
            closeable: options.closeable !== false,
            actions: options.actions || [],
            persistent: options.persistent || false,
            icon: options.icon || this.getDefaultIcon(type),
            title: options.title || null,
            timestamp: Date.now()
        };
        
        // Statistiques
        this.stats[type]++;
        this.stats.total++;
        
        return notification;
    }
    
    addToQueue(notification) {
        // Ajouter Ã  la file d'attente
        this.queue.push(notification);
        
        // Traiter la file
        this.processQueue();
    }
    
    processQueue() {
        // Afficher autant de notifications que possible
        while (this.queue.length > 0 && this.activeNotifications.length < this.config.maxVisible) {
            const notification = this.queue.shift();
            this.displayNotification(notification);
        }
    }
    
    displayNotification(notification) {
        // CrÃ©er l'Ã©lÃ©ment DOM
        const element = this.createNotificationElement(notification);
        notification.element = element;
        
        // Ajouter Ã  la liste active
        this.activeNotifications.push(notification);
        
        // Ajouter au conteneur
        this.container.appendChild(element);
        
        // Animer l'entrÃ©e
        requestAnimationFrame(() => {
            element.classList.add('notification-show');
        });
        
        // Effets sonores et vibration
        if (this.config.enableSound) {
            this.playSound(notification.type);
        }
        
        if (this.config.enableVibration && navigator.vibrate) {
            this.vibrate(notification.type);
        }
        
        // Auto-fermeture si non persistant
        if (!notification.persistent && notification.duration > 0) {
            notification.timeout = setTimeout(() => {
                this.removeNotification(notification);
            }, notification.duration);
        }
        
        // Ã‰mettre Ã©vÃ©nement
        if (this.eventBus) {
            this.eventBus.emit('notification:displayed', {
                id: notification.id,
                type: notification.type
            });
        }
    }
    
    createNotificationElement(notification) {
        const element = document.createElement('div');
        element.className = `notification notification-${notification.type}`;
        element.dataset.notificationId = notification.id;
        
        // Structure HTML
        element.innerHTML = `
            <div class="notification-icon">
                ${notification.icon}
            </div>
            <div class="notification-content">
                ${notification.title ? `<div class="notification-title">${notification.title}</div>` : ''}
                <div class="notification-message">${notification.message}</div>
                ${notification.actions.length > 0 ? this.createActionsHTML(notification.actions) : ''}
            </div>
            ${notification.closeable ? '<button class="notification-close" aria-label="Close">&times;</button>' : ''}
        `;
        
        // Attacher les Ã©vÃ©nements
        this.attachNotificationEvents(element, notification);
        
        return element;
    }
    
    createActionsHTML(actions) {
        if (actions.length === 0) return '';
        
        const actionsHTML = actions.map(action => {
            return `<button class="notification-action" data-action="${action.id}">${action.label}</button>`;
        }).join('');
        
        return `<div class="notification-actions">${actionsHTML}</div>`;
    }
    
    attachNotificationEvents(element, notification) {
        // Bouton fermer
        const closeBtn = element.querySelector('.notification-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.removeNotification(notification);
            });
        }
        
        // Actions
        const actionButtons = element.querySelectorAll('.notification-action');
        actionButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const actionId = btn.dataset.action;
                const action = notification.actions.find(a => a.id === actionId);
                
                if (action && action.callback) {
                    action.callback(notification.id);
                }
                
                // Fermer aprÃ¨s action si spÃ©cifiÃ©
                if (action && action.closeAfter !== false) {
                    this.removeNotification(notification);
                }
            });
        });
        
        // Clic sur la notification (optionnel)
        element.addEventListener('click', () => {
            if (this.eventBus) {
                this.eventBus.emit('notification:clicked', {
                    id: notification.id,
                    type: notification.type
                });
            }
        });
    }
    
    removeNotification(notification) {
        if (!notification.element) return;
        
        // Annuler le timeout
        if (notification.timeout) {
            clearTimeout(notification.timeout);
        }
        
        // Animer la sortie
        notification.element.classList.remove('notification-show');
        notification.element.classList.add('notification-hide');
        
        // Retirer aprÃ¨s animation
        setTimeout(() => {
            if (notification.element && notification.element.parentNode) {
                notification.element.parentNode.removeChild(notification.element);
            }
            
            // Retirer de la liste active
            const index = this.activeNotifications.indexOf(notification);
            if (index > -1) {
                this.activeNotifications.splice(index, 1);
            }
            
            // Traiter la file d'attente
            this.processQueue();
            
            // Ã‰mettre Ã©vÃ©nement
            if (this.eventBus) {
                this.eventBus.emit('notification:closed', {
                    id: notification.id,
                    type: notification.type
                });
            }
        }, this.config.animationDuration);
    }
    
    // ========================================================================
    // ICÃ”NES
    // ========================================================================
    
    getDefaultIcon(type) {
        const icons = {
            success: 'âœ“',
            error: 'âœ•',
            warning: 'âš ',
            info: 'â„¹'
        };
        
        return icons[type] || 'â„¹';
    }
    
    // ========================================================================
    // EFFETS
    // ========================================================================
    
    playSound(type) {
        // ImplÃ©menter les sons si nÃ©cessaire
        // Utiliser Web Audio API ou des fichiers audio
    }
    
    vibrate(type) {
        const patterns = {
            success: [100],
            error: [100, 50, 100],
            warning: [50, 50, 50],
            info: [50]
        };
        
        const pattern = patterns[type] || [50];
        navigator.vibrate(pattern);
    }
    
    // ========================================================================
    // STYLES CSS
    // ========================================================================
    
    injectStyles() {
        // VÃ©rifier si les styles existent dÃ©jÃ 
        if (document.getElementById('notifications-styles')) return;
        
        const style = document.createElement('style');
        style.id = 'notifications-styles';
        style.textContent = `
            /* Conteneur principal */
            .notifications-container {
                position: fixed;
                z-index: 10000;
                pointer-events: none;
            }
            
            /* Positionnement */
            .notifications-top-right {
                top: 20px;
                right: 20px;
            }
            
            .notifications-top-left {
                top: 20px;
                left: 20px;
            }
            
            .notifications-bottom-right {
                bottom: 20px;
                right: 20px;
            }
            
            .notifications-bottom-left {
                bottom: 20px;
                left: 20px;
            }
            
            .notifications-top-center {
                top: 20px;
                left: 50%;
                transform: translateX(-50%);
            }
            
            .notifications-bottom-center {
                bottom: 20px;
                left: 50%;
                transform: translateX(-50%);
            }
            
            /* Notification */
            .notification {
                display: flex;
                align-items: flex-start;
                min-width: 300px;
                max-width: 400px;
                padding: 16px;
                margin-bottom: 10px;
                background: white;
                border-radius: 8px;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
                pointer-events: auto;
                opacity: 0;
                transform: translateX(100%);
                transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            }
            
            .notification-show {
                opacity: 1;
                transform: translateX(0);
            }
            
            .notification-hide {
                opacity: 0;
                transform: translateX(100%) scale(0.8);
            }
            
            /* Types */
            .notification-success {
                border-left: 4px solid #4caf50;
            }
            
            .notification-error {
                border-left: 4px solid #f44336;
            }
            
            .notification-warning {
                border-left: 4px solid #ff9800;
            }
            
            .notification-info {
                border-left: 4px solid #2196f3;
            }
            
            /* IcÃ´ne */
            .notification-icon {
                flex-shrink: 0;
                width: 24px;
                height: 24px;
                margin-right: 12px;
                font-size: 20px;
                display: flex;
                align-items: center;
                justify-content: center;
            }
            
            .notification-success .notification-icon {
                color: #4caf50;
            }
            
            .notification-error .notification-icon {
                color: #f44336;
            }
            
            .notification-warning .notification-icon {
                color: #ff9800;
            }
            
            .notification-info .notification-icon {
                color: #2196f3;
            }
            
            /* Contenu */
            .notification-content {
                flex: 1;
            }
            
            .notification-title {
                font-weight: 600;
                font-size: 14px;
                margin-bottom: 4px;
                color: #333;
            }
            
            .notification-message {
                font-size: 13px;
                color: #666;
                line-height: 1.4;
            }
            
            /* Actions */
            .notification-actions {
                display: flex;
                gap: 8px;
                margin-top: 12px;
            }
            
            .notification-action {
                padding: 6px 12px;
                border: 1px solid #ddd;
                background: white;
                border-radius: 4px;
                font-size: 12px;
                cursor: pointer;
                transition: all 0.2s;
            }
            
            .notification-action:hover {
                background: #f5f5f5;
                border-color: #bbb;
            }
            
            /* Bouton fermer */
            .notification-close {
                flex-shrink: 0;
                width: 20px;
                height: 20px;
                margin-left: 8px;
                border: none;
                background: transparent;
                font-size: 24px;
                line-height: 1;
                color: #999;
                cursor: pointer;
                padding: 0;
                transition: color 0.2s;
            }
            
            .notification-close:hover {
                color: #333;
            }
            
            /* Responsive */
            @media (max-width: 480px) {
                .notification {
                    min-width: calc(100vw - 40px);
                    max-width: calc(100vw - 40px);
                }
                
                .notifications-container {
                    left: 20px !important;
                    right: 20px !important;
                    transform: none !important;
                }
            }
        `;
        
        document.head.appendChild(style);
    }
    
    // ========================================================================
    // UTILITAIRES
    // ========================================================================
    
    /**
     * Change la position des notifications
     */
    setPosition(position) {
        this.config.position = position;
        this.container.className = `notifications-container notifications-${position}`;
    }
    
    /**
     * Obtient les statistiques
     */
    getStats() {
        return {
            ...this.stats,
            active: this.activeNotifications.length,
            queued: this.queue.length
        };
    }
    
    /**
     * Nettoie toutes les notifications et rÃ©initialise
     */
    destroy() {
        this.closeAll();
        
        if (this.container && this.container.parentNode) {
            this.container.parentNode.removeChild(this.container);
        }
        
        this.queue = [];
        this.activeNotifications = [];
    }
}

// ============================================================================
// EXPORT
// ============================================================================

if (typeof module !== 'undefined' && module.exports) {
    module.exports = Notifications;
}

if (typeof window !== 'undefined') {
    window.Notifications = Notifications;
}
window.Notifications = Notifications;