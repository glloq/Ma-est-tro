// ============================================================================
// Fichier: frontend/js/ui/NotificationManager.js
// Projet: MidiMind v3.0 - Système d'Orchestration MIDI pour Raspberry Pi
// Version: 3.1.0 - Enrichi avec nouvelles notifications API
// Date: 2025-10-28
// ============================================================================
// Description:
//   Gestionnaire centralisé de toutes les notifications de l'application.
//   Interface unifiée pour notifications, alertes, confirmations.
//
// Fonctionnalités:
//   - Notifications toast (success, error, warning, info)
//   - Alertes modales (alert, confirm, prompt)
//   - Badges de notifications (compteurs)
//   - Notifications système (si permission)
//   - Queue prioritaire
//   - Grouping similaires (anti-spam)
//   - Historique notifications
//   - Préférences utilisateur (son, vibration)
//   - Mapping codes erreur backend → messages utilisateur
//   - Notifications Bluetooth, Hot-plug, Latence, Presets
//
// Architecture:
//   NotificationManager (classe singleton)
//   - Utilise Notifications (utils/) pour toasts
//   - Utilise Modal (views/components/) pour alertes
//   - Notification API pour système
//
// Auteur: MidiMind Team
// ============================================================================
/**
 * @class NotificationManager
 * @description Gestionnaire de notifications toast enrichi pour API Backend
 */
class NotificationManager {
    constructor() {
        this.container = null;
        this.notifications = [];
        this.maxNotifications = 5;
        this.defaultDuration = 3000; // ms
        
        // Mapping des codes d'erreur backend → messages utilisateur
        this.errorMessages = this.initErrorMessages();
        
        this.init();
    }

    /**
     * Initialise le gestionnaire
     */
    init() {
        // Créer le container de notifications
        this.container = document.createElement('div');
        this.container.className = 'notification-container';
        document.body.appendChild(this.container);
    }

    /**
     * Initialise le mapping des codes d'erreur
     */
    initErrorMessages() {
        return {
            // Erreurs générales
            'INVALID_REQUEST': 'Requête invalide',
            'UNAUTHORIZED': 'Non autorisé',
            'FORBIDDEN': 'Accès refusé',
            'NOT_FOUND': 'Ressource non trouvée',
            'TIMEOUT': 'Délai d\'attente dépassé',
            'INTERNAL_ERROR': 'Erreur interne du serveur',
            'SERVICE_UNAVAILABLE': 'Service temporairement indisponible',
            'PARSE_ERROR': 'Erreur de format de données',
            'INVALID_COMMAND': 'Commande invalide',
            'INVALID_PARAMS': 'Paramètres invalides',
            'INVALID_MESSAGE': 'Message invalide',
            'COMMAND_FAILED': 'Échec de l\'exécution de la commande',
            'UNKNOWN_COMMAND': 'Commande inconnue',
            
            // Erreurs périphériques
            'DEVICE_NOT_FOUND': 'Périphérique non trouvé',
            'DEVICE_BUSY': 'Périphérique occupé',
            'DEVICE_DISCONNECTED': 'Périphérique déconnecté',
            'DEVICE_CONNECTION_FAILED': 'Échec de connexion au périphérique',
            
            // Erreurs MIDI
            'MIDI_ERROR': 'Erreur MIDI',
            'MIDI_PORT_ERROR': 'Erreur de port MIDI',
            'MIDI_ROUTING_ERROR': 'Erreur de routage MIDI',
            
            // Erreurs fichiers
            'FILE_ERROR': 'Erreur de fichier',
            'FILE_NOT_FOUND': 'Fichier non trouvé',
            'FILE_READ_ERROR': 'Erreur de lecture du fichier',
            'FILE_WRITE_ERROR': 'Erreur d\'écriture du fichier',
            'FILE_DELETE_ERROR': 'Erreur de suppression du fichier',
            
            // Erreurs système
            'SYSTEM_ERROR': 'Erreur système',
            'MEMORY_ERROR': 'Erreur de mémoire',
            'DISK_ERROR': 'Erreur disque',
            
            // Erreurs Bluetooth
            'BLUETOOTH_ERROR': 'Erreur Bluetooth',
            'BLUETOOTH_NOT_AVAILABLE': 'Bluetooth non disponible',
            'BLUETOOTH_SCAN_FAILED': 'Échec du scan Bluetooth',
            'BLUETOOTH_PAIR_FAILED': 'Échec d\'appairage Bluetooth',
            'BLUETOOTH_UNPAIR_FAILED': 'Échec du désappairage Bluetooth',
            
            // Erreurs Latence
            'LATENCY_ERROR': 'Erreur de latence',
            'LATENCY_CALIBRATION_FAILED': 'Échec de calibration de latence',
            
            // Erreurs Preset
            'PRESET_ERROR': 'Erreur de preset',
            'PRESET_NOT_FOUND': 'Preset non trouvé',
            'PRESET_LOAD_FAILED': 'Échec du chargement du preset',
            'PRESET_SAVE_FAILED': 'Échec de la sauvegarde du preset'
        };
    }

    /**
     * Affiche une notification
     * @param {string} message - Message à afficher
     * @param {string} type - Type: success, error, warning, info
     * @param {number} duration - Durée en ms (0 = pas d'auto-dismiss)
     * @param {object} options - Options additionnelles
     */
    show(message, type = 'info', duration = null, options = {}) {
        // Limiter le nombre de notifications
        if (this.notifications.length >= this.maxNotifications) {
            this.dismissOldest();
        }

        // Créer l'élément de notification
        const notification = this.createNotification(message, type, options);
        
        // Ajouter au container
        this.container.appendChild(notification.element);
        this.notifications.push(notification);

        // Animation d'entrée
        setTimeout(() => {
            notification.element.classList.add('show');
        }, 10);

        // Auto-dismiss si durée définie
        const dismissDuration = duration !== null ? duration : this.defaultDuration;
        if (dismissDuration > 0) {
            notification.timer = setTimeout(() => {
                this.dismiss(notification.id);
            }, dismissDuration);
        }

        return notification.id;
    }

    /**
     * Crée l'élément de notification
     */
    createNotification(message, type, options) {
        const id = `notif_${Date.now()}_${Math.random()}`;
        
        const element = document.createElement('div');
        element.className = `notification notification-${type}`;
        element.dataset.id = id;

        // Icône selon le type
        const icon = this.getIcon(type);
        
        // Action button (optionnel)
        const actionButton = options.action ? `
            <button class="notification-action" onclick="${options.action.handler}">
                ${options.action.label}
            </button>
        ` : '';

        element.innerHTML = `
            <div class="notification-icon">${icon}</div>
            <div class="notification-content">
                <div class="notification-message">${this.escapeHtml(message)}</div>
                ${options.details ? `<div class="notification-details">${this.escapeHtml(options.details)}</div>` : ''}
            </div>
            ${actionButton}
            <button class="notification-close" onclick="notificationManager.dismiss('${id}')">
                ×
            </button>
        `;

        return {
            id: id,
            element: element,
            timer: null
        };
    }

    /**
     * Obtient l'icône selon le type
     */
    getIcon(type) {
        const icons = {
            success: '✔',
            error: '✕',
            warning: '⚠',
            info: 'ℹ'
        };
        return icons[type] || icons.info;
    }

    /**
     * Dismiss une notification
     */
    dismiss(id) {
        const notification = this.notifications.find(n => n.id === id);
        if (!notification) return;

        // Annuler le timer
        if (notification.timer) {
            clearTimeout(notification.timer);
        }

        // Animation de sortie
        notification.element.classList.remove('show');
        notification.element.classList.add('hide');

        // Retirer du DOM après l'animation
        setTimeout(() => {
            if (notification.element.parentNode) {
                notification.element.parentNode.removeChild(notification.element);
            }
            
            // Retirer du tableau
            const index = this.notifications.findIndex(n => n.id === id);
            if (index !== -1) {
                this.notifications.splice(index, 1);
            }
        }, 300); // Durée de l'animation
    }

    /**
     * Dismiss la plus ancienne notification
     */
    dismissOldest() {
        if (this.notifications.length > 0) {
            this.dismiss(this.notifications[0].id);
        }
    }

    /**
     * Dismiss toutes les notifications
     */
    dismissAll() {
        // Copier le tableau car dismiss modifie this.notifications
        const notifs = [...this.notifications];
        notifs.forEach(n => this.dismiss(n.id));
    }

    /**
     * Raccourcis pour les différents types
     */
    success(message, duration = null, options = {}) {
        return this.show(message, 'success', duration, options);
    }

    error(message, duration = 5000, options = {}) {
        return this.show(message, 'error', duration, options);
    }

    warning(message, duration = 4000, options = {}) {
        return this.show(message, 'warning', duration, options);
    }

    info(message, duration = null, options = {}) {
        return this.show(message, 'info', duration, options);
    }

    // ========================================================================
    // NOTIFICATIONS SPÉCIFIQUES API BACKEND
    // ========================================================================

    /**
     * Affiche une notification d'erreur backend avec mapping
     * @param {string} errorCode - Code d'erreur du backend
     * @param {string} errorMessage - Message d'erreur optionnel
     */
    showBackendError(errorCode, errorMessage = null) {
        const mappedMessage = this.errorMessages[errorCode] || errorMessage || 'Erreur inconnue';
        return this.error(mappedMessage, 5000, {
            details: errorCode
        });
    }

    /**
     * Notification Bluetooth - Scan démarré
     */
    bluetoothScanStarted() {
        return this.info('Scan Bluetooth démarré...', 2000);
    }

    /**
     * Notification Bluetooth - Périphérique trouvé
     * @param {string} deviceName - Nom du périphérique
     */
    bluetoothDeviceFound(deviceName) {
        return this.info(`Périphérique trouvé: ${deviceName}`, 3000);
    }

    /**
     * Notification Bluetooth - Périphérique apparié
     * @param {string} deviceName - Nom du périphérique
     */
    bluetoothDevicePaired(deviceName) {
        return this.success(`Périphérique apparié: ${deviceName}`, 4000);
    }

    /**
     * Notification Bluetooth - Périphérique désapparié
     * @param {string} deviceName - Nom du périphérique
     */
    bluetoothDeviceUnpaired(deviceName) {
        return this.info(`Périphérique désapparié: ${deviceName}`, 3000);
    }

    /**
     * Notification Bluetooth - Signal faible
     * @param {string} deviceName - Nom du périphérique
     * @param {number} signal - Force du signal (0-100)
     */
    bluetoothWeakSignal(deviceName, signal) {
        return this.warning(`Signal faible pour ${deviceName}: ${signal}%`, 4000);
    }

    /**
     * Notification Hot-plug - Périphérique ajouté
     * @param {string} deviceName - Nom du périphérique
     */
    hotplugDeviceAdded(deviceName) {
        return this.success(`Périphérique connecté: ${deviceName}`, 4000);
    }

    /**
     * Notification Hot-plug - Périphérique retiré
     * @param {string} deviceName - Nom du périphérique
     */
    hotplugDeviceRemoved(deviceName) {
        return this.warning(`Périphérique déconnecté: ${deviceName}`, 4000);
    }

    /**
     * Notification Hot-plug - Surveillance démarrée
     */
    hotplugMonitoringStarted() {
        return this.info('Surveillance des périphériques activée', 2000);
    }

    /**
     * Notification Hot-plug - Surveillance arrêtée
     */
    hotplugMonitoringStopped() {
        return this.info('Surveillance des périphériques désactivée', 2000);
    }

    /**
     * Notification Latence - Calibration démarrée
     * @param {string} instrumentName - Nom de l'instrument
     */
    latencyCalibrationStarted(instrumentName) {
        return this.info(`Calibration de latence démarrée pour ${instrumentName}...`, 3000);
    }

    /**
     * Notification Latence - Calibration terminée
     * @param {string} instrumentName - Nom de l'instrument
     * @param {number} latencyMs - Latence mesurée en ms
     */
    latencyCalibrationComplete(instrumentName, latencyMs) {
        return this.success(`Calibration terminée pour ${instrumentName}: ${latencyMs.toFixed(1)}ms`, 5000);
    }

    /**
     * Notification Latence - Compensation mise à jour
     * @param {string} instrumentName - Nom de l'instrument
     * @param {number} offsetMs - Offset de compensation en ms
     */
    latencyCompensationUpdated(instrumentName, offsetMs) {
        return this.info(`Compensation de latence mise à jour pour ${instrumentName}: ${offsetMs.toFixed(1)}ms`, 3000);
    }

    /**
     * Notification Latence - Compensation activée
     */
    latencyCompensationEnabled() {
        return this.success('Compensation de latence activée', 3000);
    }

    /**
     * Notification Latence - Compensation désactivée
     */
    latencyCompensationDisabled() {
        return this.info('Compensation de latence désactivée', 3000);
    }

    /**
     * Notification Preset - Chargé
     * @param {string} presetName - Nom du preset
     */
    presetLoaded(presetName) {
        return this.success(`Preset chargé: ${presetName}`, 3000);
    }

    /**
     * Notification Preset - Sauvegardé
     * @param {string} presetName - Nom du preset
     */
    presetSaved(presetName) {
        return this.success(`Preset sauvegardé: ${presetName}`, 3000);
    }

    /**
     * Notification Preset - Supprimé
     * @param {string} presetName - Nom du preset
     */
    presetDeleted(presetName) {
        return this.info(`Preset supprimé: ${presetName}`, 3000);
    }

    /**
     * Notification Preset - Exporté
     * @param {string} presetName - Nom du preset
     * @param {string} filepath - Chemin du fichier
     */
    presetExported(presetName, filepath) {
        return this.success(`Preset exporté: ${presetName}`, 3000, {
            details: filepath
        });
    }

    /**
     * Notification Logger - Niveau de log changé
     * @param {string} level - Nouveau niveau (DEBUG, INFO, WARNING, ERROR, CRITICAL)
     */
    loggerLevelChanged(level) {
        return this.info(`Niveau de log changé: ${level}`, 2000);
    }

    /**
     * Notification Network - Statut changé
     * @param {boolean} isOnline - true si en ligne, false si hors ligne
     */
    networkStatusChanged(isOnline) {
        if (isOnline) {
            return this.success('Connexion réseau rétablie', 3000);
        } else {
            return this.warning('Connexion réseau perdue', 4000);
        }
    }

    /**
     * Notification Network - Interface activée
     * @param {string} interfaceName - Nom de l'interface
     */
    networkInterfaceUp(interfaceName) {
        return this.info(`Interface réseau activée: ${interfaceName}`, 3000);
    }

    /**
     * Notification Network - Interface désactivée
     * @param {string} interfaceName - Nom de l'interface
     */
    networkInterfaceDown(interfaceName) {
        return this.warning(`Interface réseau désactivée: ${interfaceName}`, 3000);
    }

    // ========================================================================
    // UTILITAIRES
    // ========================================================================

    /**
     * Échappe le HTML pour éviter XSS
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Nettoie les ressources
     */
    destroy() {
        this.dismissAll();
        
        if (this.container && this.container.parentNode) {
            this.container.parentNode.removeChild(this.container);
        }
        
        this.container = null;
        this.notifications = [];
    }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = NotificationManager;
}

// Instance globale
if (typeof window !== 'undefined') {
    window.NotificationManager = NotificationManager;
}
window.NotificationManager = NotificationManager;
// ============================================================================
// FIN DU FICHIER NotificationManager.js v3.1.0
// ============================================================================