// ============================================================================
// Fichier: frontend/js/controllers/KeyboardController.js
// Chemin réel: frontend/js/controllers/KeyboardController.js
// Version: v5.0.0 - FULLY FUNCTIONAL & CORRECTED
// Date: 2025-11-06
// ============================================================================
// CORRECTIONS MAJEURES v5.0.0:
// ✅ CRITIQUE: Ajout méthode init() qui appelle initialize()
// ✅ CRITIQUE: Logger avec fallback robuste
// ✅ CRITIQUE: Écoute complète des événements View (play-note, stop-note, etc.)
// ✅ CRITIQUE: Backend calls avec error handling
// ✅ CRITIQUE: device_id utilisé partout de manière cohérente
// ✅ Gestion state cohérente avec la View
// ✅ Méthode panicAllNotesOff() pour urgences
// ✅ Support des événements MIDI entrants
// ✅ Statistiques et monitoring
// ✅ Documentation inline complète
// ============================================================================

class KeyboardController extends BaseController {
    constructor(eventBus, models = {}, views = {}, notifications = null, debugConsole = null, backend = null) {
        super(eventBus, models, views, notifications, debugConsole, backend);
        
        // ✅ CORRECTION: Logger avec fallback robuste
        this.logger = this.logger || window.logger || this.createFallbackLogger();
        
        // Configuration
        this.mode = (typeof PerformanceConfig !== 'undefined' && PerformanceConfig?.keyboard?.mode) || 'play';
        this.enableRecording = false;
        this.enablePlayback = true;
        this.showIncomingNotes = true;
        
        // État du controller
        this.selectedDevice = null;
        this.instrumentProfile = null;
        this.noteRange = { min: 21, max: 108 }; // A0 à C8 (88 touches)
        this.noteMapping = null; // Mapping optionnel des notes
        
        // Notes actives (Map: noteNumber → {note, velocity, startTime})
        this.activeNotes = new Map();
        
        // Touches pressées (clavier ordinateur)
        this.pressedKeys = new Set();
        
        // Devices disponibles
        this.availableDevices = [];
        
        // Paramètres
        this.currentVelocity = 100;
        this.currentOctaveOffset = 0;
        
        // Statistiques
        this.stats = {
            notesPlayed: 0,
            totalDuration: 0,
            errors: 0,
            lastNoteTime: null,
            sessionStartTime: Date.now()
        };
        
        this.logDebug('keyboard', `✓ KeyboardController v5.0.0 initialized (mode: ${this.mode})`);
    }
    
    // ========================================================================
    // LIFECYCLE - INITIALISATION
    // ========================================================================
    
    /**
     * ✅ CORRECTION: Méthode init() pour compatibilité BaseController
     * BaseController appelle automatiquement init() si autoInitialize = true
     */
    init() {
        this.logDebug('keyboard', 'Initializing KeyboardController...');
        
        // Appeler initialize() async
        this.initialize().catch(err => {
            this.handleError(err, 'Initialization failed');
        });
    }
    
    /**
     * Initialisation asynchrone
     */
    async initialize() {
        this.logDebug('keyboard', 'Starting async initialization');
        
        // Attacher les événements
        this.attachEvents();
        
        // Charger devices si backend connecté
        if (this.backend?.isConnected()) {
            await this.loadAvailableDevices();
        } else {
            // Attendre connexion backend
            this.eventBus.once('backend:connected', async () => {
                this.logDebug('keyboard', 'Backend connected, loading devices');
                await this.loadAvailableDevices();
            });
        }
        
        this.state.isInitialized = true;
        this.logDebug('keyboard', '✓ KeyboardController fully initialized');
    }
    
    // ========================================================================
    // GESTION DES ÉVÉNEMENTS
    // ========================================================================
    
    /**
     * ✅ CORRECTION: Écoute complète des événements View + Backend
     */
    attachEvents() {
        if (!this.eventBus) {
            this.logDebug('keyboard', 'EventBus not available', 'warn');
            return;
        }
        
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // ÉVÉNEMENTS DEPUIS LA VIEW
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

        // User demande à charger les devices
        this.eventBus.on('keyboard:request-devices', async () => {
            await this.loadAvailableDevices();
        });

        // Recevoir les devices chargés (par la modal ou autre)
        this.eventBus.on('keyboard:devices-loaded', (data) => {
            if (data && data.devices) {
                this.availableDevices = data.devices;
                this.logDebug('keyboard', `✓ Received ${this.availableDevices.length} devices from external source`);
            }
        });

        // User sélectionne un device
        this.eventBus.on('keyboard:select-device', async (data) => {
            await this.selectDevice(data.device_id);
        });
        
        // ⭐ CRITIQUE: User joue une note (depuis UI ou clavier)
        this.eventBus.on('keyboard:play-note', (data) => {
            this.sendNoteOn(data.note, data.velocity, data.channel || 0);
        });
        
        // ⭐ CRITIQUE: User arrête une note
        this.eventBus.on('keyboard:stop-note', (data) => {
            this.sendNoteOff(data.note, data.channel || 0);
        });
        
        // User change la vélocité
        this.eventBus.on('keyboard:velocity-changed', (data) => {
            this.currentVelocity = Math.max(1, Math.min(127, data.velocity));
            this.logDebug('keyboard', `Velocity changed to ${this.currentVelocity}`);
        });
        
        // User change l'octave
        this.eventBus.on('keyboard:octave-changed', (data) => {
            this.currentOctaveOffset = data.offset;
            this.logDebug('keyboard', `Octave offset changed to ${this.currentOctaveOffset}`);
        });
        
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // ÉVÉNEMENTS DEPUIS LE BACKEND (notes MIDI entrantes)
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        
        if (this.showIncomingNotes) {
            // Notes entrantes depuis périphériques MIDI
            this.eventBus.on('backend:midi:note_on', (data) => {
                this.handleIncomingNoteOn(data);
            });
            
            this.eventBus.on('backend:midi:note_off', (data) => {
                this.handleIncomingNoteOff(data);
            });
        }
        
        this.logDebug('keyboard', '✓ Events attached');
    }
    
    // ========================================================================
    // GESTION DES DEVICES
    // ========================================================================
    
    /**
     * Charge la liste des devices MIDI disponibles
     */
    async loadAvailableDevices() {
        if (!this.backend?.isConnected()) {
            this.logDebug('keyboard', 'Backend not connected, cannot load devices', 'warn');
            return;
        }

        try {
            this.logDebug('keyboard', 'Loading available devices...');

            // Appeler backend pour lister les devices
            const devices = await this.backend.listDevices();

            // Filtrer devices actifs (status = 2)
            this.availableDevices = devices.filter(d => d.status === 2);

            this.logDebug('keyboard', `✓ Loaded ${this.availableDevices.length} active devices`);

            // Notifier la vue
            this.eventBus.emit('keyboard:devices-loaded', {
                devices: this.availableDevices
            });

        } catch (error) {
            this.handleError(error, 'Failed to load devices');

            // Émettre quand même pour que la vue ne reste pas bloquée
            this.eventBus.emit('keyboard:devices-loaded', {
                devices: []
            });
        }
    }
    
    /**
     * Sélectionne un device de sortie
     * @param {string} device_id - ID du device à sélectionner
     */
    async selectDevice(device_id) {
        try {
            // Vérifier que le device existe (support device_id et id)
            const device = this.availableDevices.find(d =>
                d.device_id === device_id || d.id === device_id
            );

            if (!device) {
                this.logDebug('keyboard', `Device ${device_id} not found in available devices`, 'error');
                this.logDebug('keyboard', `Available devices:`, 'debug', this.availableDevices);
                throw new Error(`Device ${device_id} not found`);
            }

            // Utiliser l'ID normalisé (device.id ou device.device_id)
            this.selectedDevice = device.id || device.device_id;

            this.logDebug('keyboard', `✓ Device selected: ${device.displayName || device.name || device_id}`);

            // Notifier la vue
            this.eventBus.emit('keyboard:device-selected', {
                device_id: this.selectedDevice,
                noteRange: this.noteRange
            });

        } catch (error) {
            this.handleError(error, `Failed to select device ${device_id}`);
        }
    }
    
    // ========================================================================
    // ENVOI NOTES MIDI
    // ========================================================================
    
    /**
     * ✅ CORRECTION: device_id utilisé partout
     * Envoie une Note On
     * @param {number} noteNumber - Numéro MIDI de la note (0-127)
     * @param {number} velocity - Vélocité (1-127)
     * @param {number} channel - Canal MIDI (0-15)
     */
    sendNoteOn(noteNumber, velocity = null, channel = 0) {
        this.logDebug('keyboard', `sendNoteOn called: note=${noteNumber}, vel=${velocity}, ch=${channel}`, 'debug');

        // Vérifier qu'un device est sélectionné
        if (!this.selectedDevice) {
            this.logDebug('keyboard', 'No device selected, cannot send note', 'warn');
            return;
        }

        this.logDebug('keyboard', `Selected device: ${this.selectedDevice}`, 'debug');

        // Appliquer note mapping si défini
        const mappedNote = this.noteMapping ?
            (this.noteMapping[noteNumber] || noteNumber) :
            noteNumber;

        // Vérifier plage de notes
        if (mappedNote < this.noteRange.min || mappedNote > this.noteRange.max) {
            this.logDebug('keyboard', `Note ${mappedNote} outside valid range [${this.noteRange.min}-${this.noteRange.max}]`, 'warn');
            return;
        }

        // Vélocité finale
        const finalVelocity = velocity !== null ? velocity : this.currentVelocity;

        // Enregistrer note active
        this.activeNotes.set(noteNumber, {
            note: mappedNote,
            velocity: finalVelocity,
            startTime: Date.now(),
            channel: channel
        });

        // Envoyer au backend si playback activé
        if (this.enablePlayback && this.backend?.isConnected()) {
            this.logDebug('keyboard', `Sending MIDI note-on: device=${this.selectedDevice}, note=${mappedNote}, vel=${finalVelocity}, ch=${channel}`, 'info');
            this.backend.sendNoteOn(
                this.selectedDevice,
                mappedNote,
                finalVelocity,
                channel
            ).catch(err => {
                this.logDebug('keyboard', `Note-on failed: ${err.message}`, 'error');
                this.stats.errors++;
            });
        } else {
            this.logDebug('keyboard', `Note-on NOT sent: enablePlayback=${this.enablePlayback}, backendConnected=${this.backend?.isConnected()}`, 'warn');
        }
        
        // Émettre événement de feedback vers la vue
        this.eventBus.emit('keyboard:note-on', {
            note: mappedNote,
            velocity: finalVelocity,
            originalNote: noteNumber,
            channel: channel
        });
        
        // Statistiques
        this.stats.notesPlayed++;
        this.stats.lastNoteTime = Date.now();
        
        this.logDebug('keyboard', `Note ON: ${this.getNoteNameFromMidi(mappedNote)} (${mappedNote}) vel=${finalVelocity} ch=${channel}`);
    }
    
    /**
     * Envoie une Note Off
     * @param {number} noteNumber - Numéro MIDI de la note (0-127)
     * @param {number} channel - Canal MIDI (0-15)
     */
    sendNoteOff(noteNumber, channel = 0) {
        // Vérifier qu'un device est sélectionné
        if (!this.selectedDevice) {
            return;
        }
        
        // Récupérer info note active
        const activeNote = this.activeNotes.get(noteNumber);
        
        if (!activeNote) {
            this.logDebug('keyboard', `Note ${noteNumber} was not active`, 'warn');
            return;
        }
        
        const mappedNote = activeNote.note;
        const duration = Date.now() - activeNote.startTime;
        
        // Retirer des notes actives
        this.activeNotes.delete(noteNumber);
        
        // Envoyer au backend si playback activé
        if (this.enablePlayback && this.backend?.isConnected()) {
            this.backend.sendNoteOff(
                this.selectedDevice,
                mappedNote,
                channel
            ).catch(err => {
                this.logDebug('keyboard', `Note-off failed: ${err.message}`, 'error');
                this.stats.errors++;
            });
        }
        
        // Émettre événement de feedback vers la vue
        this.eventBus.emit('keyboard:note-off', {
            note: mappedNote,
            duration: duration,
            originalNote: noteNumber,
            channel: channel
        });
        
        // Statistiques
        this.stats.totalDuration += duration;
        
        this.logDebug('keyboard', `Note OFF: ${this.getNoteNameFromMidi(mappedNote)} (${mappedNote}) duration=${duration}ms ch=${channel}`);
    }
    
    /**
     * PANIC: Arrête toutes les notes immédiatement
     * Utile en cas de problème ou pour reset
     */
    panicAllNotesOff() {
        if (!this.selectedDevice || !this.backend?.isConnected()) {
            this.logDebug('keyboard', 'Cannot panic: no device or backend', 'warn');
            return;
        }
        
        this.logDebug('keyboard', '🚨 PANIC: Sending all notes off', 'warn');
        
        // Envoyer Note Off pour toutes les notes MIDI (0-127)
        for (let note = 0; note <= 127; note++) {
            this.backend.sendNoteOff(this.selectedDevice, note, 0).catch(() => {
                // Ignorer les erreurs en mode panic
            });
        }
        
        // Clear l'état local
        this.activeNotes.clear();
        this.pressedKeys.clear();
        
        // Notifier la vue
        this.eventBus.emit('keyboard:panic', {});
        
        this.logDebug('keyboard', '✓ All notes off sent');
    }
    
    // ========================================================================
    // RÉCEPTION NOTES MIDI (depuis périphériques)
    // ========================================================================
    
    /**
     * Gère une Note On entrante depuis un périphérique MIDI
     */
    handleIncomingNoteOn(data) {
        // Afficher dans les logs si mode monitor
        if (this.mode === 'monitor') {
            this.logDebug('keyboard', `MIDI IN: Note ON ${this.getNoteNameFromMidi(data.note)} (${data.note}) vel=${data.velocity}`);
        }
        
        // Transmettre à la vue pour feedback visuel
        this.eventBus.emit('keyboard:note-on', {
            note: data.note,
            velocity: data.velocity,
            channel: data.channel || 0,
            source: 'external'
        });
    }
    
    /**
     * Gère une Note Off entrante depuis un périphérique MIDI
     */
    handleIncomingNoteOff(data) {
        // Afficher dans les logs si mode monitor
        if (this.mode === 'monitor') {
            this.logDebug('keyboard', `MIDI IN: Note OFF ${this.getNoteNameFromMidi(data.note)} (${data.note})`);
        }
        
        // Transmettre à la vue pour feedback visuel
        this.eventBus.emit('keyboard:note-off', {
            note: data.note,
            channel: data.channel || 0,
            source: 'external'
        });
    }
    
    // ========================================================================
    // UTILITAIRES
    // ========================================================================
    
    /**
     * Obtient le nom d'une note depuis son numéro MIDI
     * @param {number} midiNote - Numéro MIDI (0-127)
     * @returns {string} Nom de la note (ex: "C4", "A#5")
     */
    getNoteNameFromMidi(midiNote) {
        const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        const octave = Math.floor(midiNote / 12) - 1;
        const noteName = noteNames[midiNote % 12];
        return `${noteName}${octave}`;
    }
    
    /**
     * Récupère les statistiques
     * @returns {Object} Statistiques
     */
    getStats() {
        return {
            ...this.stats,
            activeNotesCount: this.activeNotes.size,
            selectedDevice: this.selectedDevice,
            sessionDuration: Date.now() - this.stats.sessionStartTime,
            averageNoteDuration: this.stats.notesPlayed > 0 ? 
                this.stats.totalDuration / this.stats.notesPlayed : 0
        };
    }
    
    /**
     * Réinitialise les statistiques
     */
    resetStats() {
        this.stats = {
            notesPlayed: 0,
            totalDuration: 0,
            errors: 0,
            lastNoteTime: null,
            sessionStartTime: Date.now()
        };
        
        this.logDebug('keyboard', 'Stats reset');
    }
    
    /**
     * Gère une erreur
     * @param {Error} error - Erreur
     * @param {string} context - Contexte de l'erreur
     */
    handleError(error, context) {
        this.stats.errors++;
        
        const errorMessage = error.message || String(error);
        
        this.logDebug('keyboard', `${context}: ${errorMessage}`, 'error');
        
        // Notifier via EventBus
        this.eventBus.emit('keyboard:error', {
            context: context,
            error: errorMessage,
            timestamp: Date.now()
        });
        
        // Notifier via notifications si disponibles
        if (this.notifications && typeof this.notifications.error === 'function') {
            this.notifications.error(`Keyboard: ${context}`, errorMessage);
        }
    }
    
    /**
     * ✅ CORRECTION: Logger avec fallback robuste
     * Log un message de debug
     * @param {string} category - Catégorie du log
     * @param {string} message - Message
     * @param {string} level - Niveau de log (info, warn, error, debug)
     */
    logDebug(category, message, level = 'info') {
        // Fallback si pas de logger
        if (!this.logger) {
            console.log(`[${category}] ${message}`);
            return;
        }
        
        // Utiliser logger si méthode existe
        if (typeof this.logger[level] === 'function') {
            this.logger[level](category, message);
        } else if (typeof this.logger.log === 'function') {
            this.logger.log(level, category, message);
        } else {
            // Dernier fallback
            console.log(`[${level.toUpperCase()}] [${category}] ${message}`);
        }
    }
    
    /**
     * Crée un logger fallback minimal
     * @returns {Object} Logger fallback
     */
    createFallbackLogger() {
        return {
            debug: (cat, msg) => console.log(`[DEBUG] [${cat}] ${msg}`),
            info: (cat, msg) => console.log(`[INFO] [${cat}] ${msg}`),
            warn: (cat, msg) => console.warn(`[WARN] [${cat}] ${msg}`),
            error: (cat, msg) => console.error(`[ERROR] [${cat}] ${msg}`),
            log: (level, cat, msg) => console.log(`[${level.toUpperCase()}] [${cat}] ${msg}`)
        };
    }
    
    // ========================================================================
    // LIFECYCLE - DESTRUCTION
    // ========================================================================
    
    /**
     * Détruit le controller
     */
    destroy() {
        this.logDebug('keyboard', 'Destroying KeyboardController');
        
        // Panic: arrêter toutes les notes
        if (this.activeNotes.size > 0) {
            this.panicAllNotesOff();
        }
        
        // Clear état
        this.activeNotes.clear();
        this.pressedKeys.clear();
        this.availableDevices = [];
        this.selectedDevice = null;
        
        // Appeler destroy de BaseController
        super.destroy();
        
        this.logDebug('keyboard', '✓ KeyboardController destroyed');
    }
}

// ============================================================================
// EXPORT
// ============================================================================

if (typeof module !== 'undefined' && module.exports) {
    module.exports = KeyboardController;
}

if (typeof window !== 'undefined') {
    window.KeyboardController = KeyboardController;
}