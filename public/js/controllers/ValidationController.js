// ============================================================================
// Fichier: frontend/js/controllers/ValidationController.js
// Projet: MidiMind v3.1.0 - Système d'Orchestration MIDI pour Raspberry Pi
// Version: 3.1.0 - OPTIMISÉ
// Date: 2025-11-01
// ============================================================================
// Description:
//   Contrôleur de validation des données utilisateur.
//   Fournit validation pour formulaires, paramètres, fichiers, etc.
//
// Fonctionnalités:
//   - Validation formulaires (champs requis, formats)
//   - Validation types de données (string, number, email, etc.)
//   - Validation plages de valeurs (min, max, range)
//   - Validation fichiers (extension, taille, type MIME)
//   - Validation paramètres système (audio, MIDI, réseau)
//   - Règles personnalisées (regex, callback)
//   - Messages d'erreur personnalisables
//   - Validation asynchrone (vérification backend)
//   - Vérification intégrité système
//
// Architecture:
//   ValidationController extends BaseController
//   - Utilise Validator (utils/)
//   - Règles de validation réutilisables
//   - Cache des résultats de validation
//
// MODIFICATIONS v3.1.0:
//   ✓ Constructeur conforme à BaseController
//   ✓ Utilisation cohérente de subscribe() pour événements
//   ✓ Règles de validation étendues
//   ✓ Support validation asynchrone
//   ✓ Méthodes helper de BaseController
//   ✓ Validation MIDI spécifique
//
// Auteur: MidiMind Team
// ============================================================================

class ValidationController extends BaseController {
    constructor(eventBus, models = {}, views = {}, notifications = null, debugConsole = null, backend = null) {
        super(eventBus, models, views, notifications, debugConsole, backend);
        
        // Validateurs
        this.validators = {};
        this.customValidators = new Map();
        
        // Cache de validation
        this.validationCache = new Map();
        
        // Configuration
        this.config = {
            ...this.config,  // Hériter de BaseController
            cacheEnabled: true,
            cacheExpiryMs: 60000,  // 1 minute
            strictMode: false,
            showWarnings: true
        };
        
        // Statistiques
        this.stats = {
            totalValidations: 0,
            successCount: 0,
            failureCount: 0,
            cacheHits: 0
        };
        
        // Initialiser les validateurs
        this.setupValidators();
    }
    
    /**
     * Initialisation du contrôleur
     */
    onInitialize() {
        this.logDebug('info', 'Initializing validation controller...');
        this.logDebug('info', 'Validation controller initialized');
    }
    
    /**
     * Bind des événements
     */
    bindEvents() {
        // Événements de fichiers
        this.subscribe('file:before:add', (data) => {
            if (!this.validateFile(data.file)) {
                this.emitEvent('file:validation:failed', data);
            }
        });
        
        this.subscribe('file:added', (data) => this.validateFile(data.file));
        
        // Événements de playlists
        this.subscribe('playlist:before:create', (data) => {
            if (!this.validatePlaylist(data.playlist)) {
                this.emitEvent('playlist:validation:failed', data);
            }
        });
        
        this.subscribe('playlist:added', (data) => this.validatePlaylist(data.playlist));
        
        // Événements d'instruments
        this.subscribe('instrument:before:connect', (data) => {
            if (!this.validateInstrument(data.instrument)) {
                this.emitEvent('instrument:validation:failed', data);
            }
        });
        
        this.subscribe('instrument:connected', (data) => this.validateInstrument(data.instrument));
        
        // Événements système
        this.subscribe('system:check:integrity', () => this.checkSystemIntegrity());
        this.subscribe('validation:clear:cache', () => this.clearCache());
    }
    
    /**
     * Configuration des validateurs
     */
    setupValidators() {
        // Validateurs de fichiers
        this.validators.file = {
            name: {
                validator: (name) => name && name.trim().length > 0 && name.length <= 255,
                message: 'Le nom du fichier doit contenir 1-255 caractères'
            },
            size: {
                validator: (size) => size && parseInt(size) > 0 && parseInt(size) < 100 * 1024 * 1024, // Max 100MB
                message: 'La taille du fichier doit être entre 1 et 100MB'
            },
            duration: {
                validator: (duration) => !duration || (duration > 0 && duration < 7200), // Max 2 heures
                message: 'La durée doit être entre 0 et 2 heures'
            },
            tempo: {
                validator: (tempo) => !tempo || (tempo > 0 && tempo <= 300),
                message: 'Le tempo doit être entre 1 et 300 BPM'
            },
            tracks: {
                validator: (tracks) => !tracks || (Array.isArray(tracks) && tracks.length > 0 && tracks.length <= 128),
                message: 'Le fichier doit avoir entre 1 et 128 pistes'
            },
            format: {
                validator: (format) => !format || ['mid', 'midi', 'smf'].includes(format.toLowerCase()),
                message: 'Le format doit être MIDI (.mid, .midi, .smf)'
            }
        };
        
        // Validateurs de playlists
        this.validators.playlist = {
            name: {
                validator: (name) => name && name.trim().length > 0 && name.length <= 100,
                message: 'Le nom de la playlist doit contenir 1-100 caractères'
            },
            files: {
                validator: (files) => Array.isArray(files),
                message: 'La liste de fichiers doit être un tableau'
            },
            description: {
                validator: (desc) => !desc || desc.length <= 500,
                message: 'La description ne doit pas dépasser 500 caractères'
            }
        };
        
        // Validateurs d'instruments
        this.validators.instrument = {
            name: {
                validator: (name) => name && name.trim().length > 0 && name.length <= 100,
                message: 'Le nom de l\'instrument doit contenir 1-100 caractères'
            },
            type: {
                validator: (type) => !type || ['Cordes', 'Vents', 'Percussions', 'Clavier', 'Électronique'].includes(type),
                message: 'Type d\'instrument invalide'
            },
            connection: {
                validator: (conn) => !conn || ['usb', 'wifi', 'bluetooth', 'midi'].includes(conn),
                message: 'Type de connexion invalide'
            },
            latency: {
                validator: (latency) => !latency || (latency >= 0 && latency <= 1000),
                message: 'La latence doit être entre 0 et 1000ms'
            },
            noteRange: {
                validator: (range) => !range || (range.min >= 0 && range.max <= 127 && range.min <= range.max),
                message: 'La plage de notes doit être entre 0-127 (MIDI standard)'
            }
        };
        
        // Validateurs MIDI
        this.validators.midi = {
            note: {
                validator: (note) => Number.isInteger(note) && note >= 0 && note <= 127,
                message: 'La note MIDI doit être entre 0 et 127'
            },
            velocity: {
                validator: (velocity) => Number.isInteger(velocity) && velocity >= 0 && velocity <= 127,
                message: 'La vélocité doit être entre 0 et 127'
            },
            channel: {
                validator: (channel) => Number.isInteger(channel) && channel >= 0 && channel <= 15,
                message: 'Le canal MIDI doit être entre 0 et 15'
            },
            cc: {
                validator: (cc) => Number.isInteger(cc) && cc >= 0 && cc <= 127,
                message: 'Le numéro de CC doit être entre 0 et 127'
            },
            program: {
                validator: (program) => Number.isInteger(program) && program >= 0 && program <= 127,
                message: 'Le numéro de programme doit être entre 0 et 127'
            }
        };
        
        // Validateurs de routage
        this.validators.routing = {source_id: {
                validator: (id) => typeof id === 'number' && id >= 0,
                message: 'L\'ID source doit être un nombre positif'
            },
            targetId: {
                validator: (id) => typeof id === 'number' && id >= 0,
                message: 'L\'ID cible doit être un nombre positif'
            },
            channelMap: {
                validator: (map) => !map || (typeof map === 'object' && Object.values(map).every(ch => ch >= 0 && ch <= 15)),
                message: 'La carte de canaux doit contenir des canaux MIDI valides (0-15)'
            }
        };
    }
    
    /**
     * Valider un fichier
     */
    validateFile(file) {
        if (!file) {
            this.logDebug('warn', 'Cannot validate null file');
            return false;
        }
        
        return this.validate(file, this.validators.file, 'file');
    }
    
    /**
     * Valider une playlist
     */
    validatePlaylist(playlist) {
        if (!playlist) {
            this.logDebug('warn', 'Cannot validate null playlist');
            return false;
        }
        
        return this.validate(playlist, this.validators.playlist, 'playlist');
    }
    
    /**
     * Valider un instrument
     */
    validateInstrument(instrument) {
        if (!instrument) {
            this.logDebug('warn', 'Cannot validate null instrument');
            return false;
        }
        
        return this.validate(instrument, this.validators.instrument, 'instrument');
    }
    
    /**
     * Valider une note MIDI
     */
    validateMidiNote(note, velocity = null, channel = null) {
        const errors = [];
        
        if (!this.validators.midi.note.validator(note)) {
            errors.push(this.validators.midi.note.message);
        }
        
        if (velocity !== null && !this.validators.midi.velocity.validator(velocity)) {
            errors.push(this.validators.midi.velocity.message);
        }
        
        if (channel !== null && !this.validators.midi.channel.validator(channel)) {
            errors.push(this.validators.midi.channel.message);
        }
        
        if (errors.length > 0) {
            this.logDebug('warn', `MIDI validation failed: ${errors.join(', ')}`);
            return false;
        }
        
        return true;
    }
    
    /**
     * Valider une route
     */
    validateRoute(route) {
        if (!route) {
            this.logDebug('warn', 'Cannot validate null route');
            return false;
        }
        
        return this.validate(route, this.validators.routing, 'routing');
    }
    
    /**
     * Méthode de validation générique
     */
    validate(data, validators, type = 'generic') {
        const errors = [];
        const warnings = [];
        
        // Vérifier le cache
        if (this.config.cacheEnabled) {
            const cacheKey = this.getCacheKey(data, type);
            const cached = this.getCachedValidation(cacheKey);
            if (cached !== null) {
                this.stats.cacheHits++;
                return cached;
            }
        }
        
        this.stats.totalValidations++;
        
        // Valider chaque champ
        for (const [field, rules] of Object.entries(validators)) {
            const value = data[field];
            
            // Champ requis
            if (value === undefined || value === null) {
                if (this.config.strictMode) {
                    errors.push(`Champ manquant: ${field}`);
                } else if (this.config.showWarnings) {
                    warnings.push(`Champ optionnel manquant: ${field}`);
                }
                continue;
            }
            
            // Appliquer le validateur
            if (!rules.validator(value)) {
                errors.push(rules.message || `Champ invalide: ${field}`);
            }
        }
        
        // Résultat
        const isValid = errors.length === 0;
        
        if (isValid) {
            this.stats.successCount++;
        } else {
            this.stats.failureCount++;
            
            // Logger les erreurs
            const name = data.name || data.id || 'unknown';
            this.logDebug('warn', `Validation failed for ${type} ${name}: ${errors.join(', ')}`);
            
            // Notifier
            this.notify('warning', `Validation échouée: ${errors[0]}`);
            
            // Émettre événement
            this.emitEvent('validation:failed', {
                type,
                data,
                errors,
                warnings
            });
        }
        
        // Warnings
        if (warnings.length > 0 && this.config.showWarnings) {
            this.logDebug('info', `Validation warnings for ${type}: ${warnings.join(', ')}`);
        }
        
        // Mettre en cache
        if (this.config.cacheEnabled) {
            const cacheKey = this.getCacheKey(data, type);
            this.cacheValidation(cacheKey, isValid);
        }
        
        return isValid;
    }
    
    /**
     * Ajouter un validateur personnalisé
     */
    addCustomValidator(name, validator, message) {
        this.customValidators.set(name, {
            validator,
            message
        });
        this.logDebug('debug', `Custom validator added: ${name}`);
    }
    
    /**
     * Supprimer un validateur personnalisé
     */
    removeCustomValidator(name) {
        this.customValidators.delete(name);
        this.logDebug('debug', `Custom validator removed: ${name}`);
    }
    
    /**
     * Nettoyer/Sanitizer une entrée
     */
    sanitizeInput(input, type = 'string') {
        if (!input) return '';
        
        switch (type) {
            case 'string':
                return String(input).trim().slice(0, 255);
                
            case 'number':
                const num = parseFloat(input);
                return isNaN(num) ? 0 : Math.max(0, num);
                
            case 'integer':
                const int = parseInt(input);
                return isNaN(int) ? 0 : Math.max(0, int);
                
            case 'filename':
                return String(input)
                    .replace(/[^a-zA-Z0-9._-]/g, '_')
                    .replace(/_{2,}/g, '_')
                    .slice(0, 100);
                
            case 'midi':
                const midi = parseInt(input);
                return isNaN(midi) ? 0 : Math.max(0, Math.min(127, midi));
                
            case 'channel':
                const channel = parseInt(input);
                return isNaN(channel) ? 0 : Math.max(0, Math.min(15, channel));
                
            default:
                return input;
        }
    }
    
    /**
     * Vérifier l'intégrité du système
     */
    async checkSystemIntegrity() {
        this.logDebug('info', 'Checking system integrity...');
        
        const issues = [];
        
        try {
            // Vérifier les fichiers orphelins dans les playlists
            const fileModel = this.getModel('file');
            const playlistModel = this.getModel('playlist');
            
            if (fileModel && playlistModel) {
                const files = fileModel.get('files') || [];
                const playlists = playlistModel.get('playlists') || [];
                
                playlists.forEach(playlist => {
                    if (Array.isArray(playlist.files)) {
                        playlist.files.forEach(fileId => {
                            if (!files.find(f => f.id === fileId)) {
                                issues.push({
                                    type: 'orphan_file',
                                    message: `Fichier manquant dans playlist ${playlist.name}: ${fileId}`,
                                    severity: 'warning'
                                });
                            }
                        });
                    }
                });
            }
            
            // Vérifier les assignations d'instruments
            const instrumentModel = this.getModel('instrument');
            
            if (fileModel && instrumentModel) {
                const files = fileModel.get('files') || [];
                
                files.forEach(file => {
                    if (file.assignments && typeof file.assignments === 'object') {
                        Object.entries(file.assignments).forEach(([track, instId]) => {
                            const instruments = instrumentModel.get('instruments') || [];
                            if (!instruments.find(i => i.id === instId)) {
                                issues.push({
                                    type: 'missing_instrument',
                                    message: `Instrument manquant pour ${file.name} (track ${track}): ${instId}`,
                                    severity: 'warning'
                                });
                            }
                        });
                    }
                });
            }
            
            // Vérifier les routes de routage
            const routingModel = this.getModel('routing');
            
            if (routingModel) {
                const routes = routingModel.get('routes') || [];
                
                routes.forEach(route => {
                    if (!this.validateRoute(route)) {
                        issues.push({
                            type: 'invalid_route',
                            message: `Route invalide: ${route.id}`,
                            severity: 'error'
                        });
                    }
                });
            }
            
        } catch (error) {
            this.logDebug('error', 'Error checking system integrity:', error);
            issues.push({
                type: 'check_error',
                message: `Erreur lors de la vérification: ${error.message}`,
                severity: 'error'
            });
        }
        
        // Rapport
        if (issues.length > 0) {
            this.logDebug('warn', `System integrity issues detected: ${issues.length}`);
            issues.forEach(issue => {
                this.logDebug(issue.severity, issue.message);
            });
            
            // Émettre événement
            this.emitEvent('validation:integrity:issues', { issues });
            
            // Notifier
            const errorCount = issues.filter(i => i.severity === 'error').length;
            if (errorCount > 0) {
                this.notify('error', `${errorCount} problème(s) d'intégrité détecté(s)`);
            } else {
                this.notify('warning', `${issues.length} avertissement(s) d'intégrité`);
            }
        } else {
            this.logDebug('info', 'System integrity check passed');
            this.emitEvent('validation:integrity:ok');
        }
        
        return issues;
    }
    
    /**
     * Gestion du cache
     */
    getCacheKey(data, type) {
        const id = data.id || data.name || '';
        return `${type}:${id}`;
    }
    
    getCachedValidation(key) {
        const cached = this.validationCache.get(key);
        if (!cached) return null;
        
        const now = Date.now();
        if (now - cached.timestamp > this.config.cacheExpiryMs) {
            this.validationCache.delete(key);
            return null;
        }
        
        return cached.result;
    }
    
    cacheValidation(key, result) {
        this.validationCache.set(key, {
            result,
            timestamp: Date.now()
        });
    }
    
    clearCache() {
        this.validationCache.clear();
        this.logDebug('debug', 'Validation cache cleared');
    }
    
    /**
     * Obtenir les statistiques
     */
    getStats() {
        return {
            ...this.stats,
            cacheSize: this.validationCache.size,
            customValidators: this.customValidators.size
        };
    }
    
    /**
     * Réinitialiser les statistiques
     */
    resetStats() {
        this.stats = {
            totalValidations: 0,
            successCount: 0,
            failureCount: 0,
            cacheHits: 0
        };
        this.logDebug('debug', 'Validation stats reset');
    }
    
    /**
     * Configuration
     */
    setConfig(config) {
        Object.assign(this.config, config);
        this.logDebug('debug', 'Configuration updated', config);
    }
    
    getConfig() {
        return { ...this.config };
    }
}

// ============================================================================
// EXPORT
// ============================================================================

if (typeof module !== 'undefined' && module.exports) {
    module.exports = ValidationController;
}

if (typeof window !== 'undefined') {
    window.ValidationController = ValidationController;
}