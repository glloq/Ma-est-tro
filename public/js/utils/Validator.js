// ============================================================================
// Fichier: frontend/js/utils/Validator.js
// Projet: MidiMind v3.0 - Système d'Orchestration MIDI pour Raspberry Pi
// Version: 3.0.0
// Date: 2025-10-14
// ============================================================================
// Description:
//   Fonctions de validation génériques pour toutes les données de l'application.
//   Types, formats, plages, patterns, etc.
//
// Fonctionnalités:
//   - Validation types (string, number, boolean, array, object)
//   - Validation formats (email, URL, date, hex color)
//   - Validation plages (min, max, range)
//   - Validation patterns (regex)
//   - Validation longueurs (minLength, maxLength)
//   - Validation fichiers (extension, taille, MIME)
//   - Validation MIDI (note, channel, velocity, CC)
//   - Règles personnalisées (callback)
//
// Architecture:
//   Validator (objet statique)
//   - Méthodes pures (no state)
//   - Retour standardisé {valid: bool, error: string}
//   - Chainable (validation multiple)
//
// Auteur: MidiMind Team
// ============================================================================

const Validator = {
    // ========================================================================
    // TYPES DE BASE
    // ========================================================================
    
    /**
     * Vérifie si une valeur est définie (non null et non undefined)
     * @param {any} value - Valeur à vérifier
     * @returns {boolean}
     */
    isDefined(value) {
        return value !== null && value !== undefined;
    },
    
    /**
     * Vérifie si une valeur est un nombre valide
     * @param {any} value - Valeur à vérifier
     * @returns {boolean}
     */
    isNumber(value) {
        return typeof value === 'number' && !isNaN(value) && isFinite(value);
    },
    
    /**
     * Vérifie si une valeur est un entier
     * @param {any} value - Valeur à vérifier
     * @returns {boolean}
     */
    isInteger(value) {
        return this.isNumber(value) && Number.isInteger(value);
    },
    
    /**
     * Vérifie si une valeur est une chaîne non vide
     * @param {any} value - Valeur à vérifier
     * @returns {boolean}
     */
    isString(value) {
        return typeof value === 'string' && value.trim().length > 0;
    },
    
    /**
     * Vérifie si une valeur est un booléen
     * @param {any} value - Valeur à vérifier
     * @returns {boolean}
     */
    isBoolean(value) {
        return typeof value === 'boolean';
    },
    
    /**
     * Vérifie si une valeur est un objet
     * @param {any} value - Valeur à vérifier
     * @returns {boolean}
     */
    isObject(value) {
        return value !== null && typeof value === 'object' && !Array.isArray(value);
    },
    
    /**
     * Vérifie si une valeur est un tableau
     * @param {any} value - Valeur à vérifier
     * @returns {boolean}
     */
    isArray(value) {
        return Array.isArray(value);
    },
    
    /**
     * Vérifie si une valeur est une fonction
     * @param {any} value - Valeur à vérifier
     * @returns {boolean}
     */
    isFunction(value) {
        return typeof value === 'function';
    },
    
    // ========================================================================
    // PLAGES & LIMITES
    // ========================================================================
    
    /**
     * Vérifie si un nombre est dans une plage
     * @param {number} value - Valeur à vérifier
     * @param {number} min - Minimum (inclus)
     * @param {number} max - Maximum (inclus)
     * @returns {boolean}
     */
    isInRange(value, min, max) {
        return this.isNumber(value) && value >= min && value <= max;
    },
    
    /**
     * Vérifie si une chaîne a une longueur valide
     * @param {string} str - Chaîne à vérifier
     * @param {number} minLength - Longueur minimale
     * @param {number} maxLength - Longueur maximale
     * @returns {boolean}
     */
    isValidLength(str, minLength = 0, maxLength = Infinity) {
        if (typeof str !== 'string') return false;
        const length = str.trim().length;
        return length >= minLength && length <= maxLength;
    },
    
    // ========================================================================
    // VALIDATION MIDI - VALEURS DE BASE
    // ========================================================================
    
    /**
     * Vérifie si une note MIDI est valide (0-127)
     * @param {number} note - Note MIDI
     * @returns {boolean}
     */
    isValidMidiNote(note) {
        return this.isInteger(note) && note >= 0 && note <= 127;
    },
    
    /**
     * Vérifie si un canal MIDI est valide (1-16)
     * @param {number} channel - Canal MIDI
     * @returns {boolean}
     */
    isValidMidiChannel(channel) {
        return this.isInteger(channel) && channel >= 1 && channel <= 16;
    },
    
    /**
     * Vérifie si un index de canal MIDI est valide (0-15)
     * @param {number} channel - Index de canal MIDI
     * @returns {boolean}
     */
    isValidMidiChannelIndex(channel) {
        return this.isInteger(channel) && channel >= 0 && channel <= 15;
    },
    
    /**
     * Vérifie si une vélocité est valide (0-127)
     * @param {number} velocity - Vélocité
     * @returns {boolean}
     */
    isValidVelocity(velocity) {
        return this.isInteger(velocity) && velocity >= 0 && velocity <= 127;
    },
    
    /**
     * Vérifie si un CC (Control Change) est valide (0-127)
     * @param {number} cc - Numéro de contrôleur
     * @returns {boolean}
     */
    isValidControlChange(cc) {
        return this.isInteger(cc) && cc >= 0 && cc <= 127;
    },
    
    /**
     * Vérifie si un numéro de programme est valide (0-127)
     * @param {number} program - Numéro de programme
     * @returns {boolean}
     */
    isValidProgram(program) {
        return this.isInteger(program) && program >= 0 && program <= 127;
    },
    
    /**
     * Vérifie si un pitch bend est valide (-8192 à 8191)
     * @param {number} pitchBend - Valeur de pitch bend
     * @returns {boolean}
     */
    isValidPitchBend(pitchBend) {
        return this.isInteger(pitchBend) && pitchBend >= -8192 && pitchBend <= 8191;
    },
    
    /**
     * Vérifie si un tempo est valide
     * @param {number} tempo - Tempo en BPM
     * @returns {boolean}
     */
    isValidTempo(tempo) {
        return this.isNumber(tempo) && tempo > 0 && tempo <= 999;
    },
    
    /**
     * Vérifie si une signature temporelle est valide
     * @param {Object} timeSig - {numerator, denominator}
     * @returns {boolean}
     */
    isValidTimeSignature(timeSig) {
        if (!this.isObject(timeSig)) return false;
        return this.isInteger(timeSig.numerator) && 
               this.isInteger(timeSig.denominator) &&
               timeSig.numerator > 0 && 
               [2, 4, 8, 16].includes(timeSig.denominator);
    },
    
    // ========================================================================
    // VALIDATION MIDI - MESSAGES
    // ========================================================================
    
    /**
     * Valide un message MIDI complet
     * @param {Object} message - Message MIDI
     * @returns {Object} {valid: boolean, errors: Array}
     */
    validateMidiMessage(message) {
        const errors = [];
        
        if (!this.isObject(message)) {
            return { valid: false, errors: ['Message must be an object'] };
        }
        
        const validTypes = ['noteOn', 'noteOff', 'controlChange', 'programChange', 'pitchBend', 'aftertouch'];
        
        if (!this.isString(message.type) || !validTypes.includes(message.type)) {
            errors.push('Invalid message type');
        }
        
        if (!this.isValidMidiChannelIndex(message.channel)) {
            errors.push('Invalid channel (must be 0-15)');
        }
        
        if (message.type === 'noteOn' || message.type === 'noteOff') {
            if (!this.isValidMidiNote(message.note)) {
                errors.push('Invalid note (must be 0-127)');
            }
            if (!this.isValidVelocity(message.velocity)) {
                errors.push('Invalid velocity (must be 0-127)');
            }
        }
        
        if (message.type === 'controlChange') {
            if (!this.isValidControlChange(message.controller)) {
                errors.push('Invalid controller (must be 0-127)');
            }
            if (!this.isInteger(message.value) || message.value < 0 || message.value > 127) {
                errors.push('Invalid value (must be 0-127)');
            }
        }
        
        if (message.type === 'programChange') {
            if (!this.isValidProgram(message.program)) {
                errors.push('Invalid program (must be 0-127)');
            }
        }
        
        if (message.type === 'pitchBend') {
            if (!this.isValidPitchBend(message.value)) {
                errors.push('Invalid pitch bend (-8192 to 8191)');
            }
        }
        
        return {
            valid: errors.length === 0,
            errors: errors
        };
    },
    
    // ========================================================================
    // VALIDATION MIDI - FICHIERS
    // ========================================================================
    
    /**
     * Valide un fichier MIDI
     * @param {Object} file - Fichier MIDI
     * @returns {Object} {valid: boolean, errors: Array}
     */
    validateMidiFile(file) {
        const errors = [];
        
        if (!this.isObject(file)) {
            return { valid: false, errors: ['File must be an object'] };
        }
        
        if (!this.isString(file.name)) {
            errors.push('Missing or invalid name');
        }
        
        if (!this.isString(file.path)) {
            errors.push('Missing or invalid path');
        }
        
        if (this.isDefined(file.size) && !this.isInteger(file.size)) {
            errors.push('Invalid size (must be integer)');
        }
        
        if (this.isDefined(file.duration) && !this.isNumber(file.duration)) {
            errors.push('Invalid duration');
        }
        
        if (this.isDefined(file.tempo) && !this.isValidTempo(file.tempo)) {
            errors.push('Invalid tempo');
        }
        
        if (this.isDefined(file.tracks) && !this.isArray(file.tracks)) {
            errors.push('Invalid tracks (must be array)');
        }
        
        return {
            valid: errors.length === 0,
            errors: errors
        };
    },
    
    /**
     * Valide une playlist
     * @param {Object} playlist - Playlist
     * @returns {Object} {valid: boolean, errors: Array}
     */
    validatePlaylist(playlist) {
        const errors = [];
        
        if (!this.isObject(playlist)) {
            return { valid: false, errors: ['Playlist must be an object'] };
        }
        
        if (!this.isValidLength(playlist.name, 1, 100)) {
            errors.push('Invalid name (1-100 characters)');
        }
        
        if (playlist.description && !this.isValidLength(playlist.description, 0, 500)) {
            errors.push('Description too long (max 500 characters)');
        }
        
        if (!this.isArray(playlist.files)) {
            errors.push('Missing or invalid files array');
        }
        
        if (this.isDefined(playlist.loop) && !this.isBoolean(playlist.loop)) {
            errors.push('loop must be boolean');
        }
        
        if (this.isDefined(playlist.shuffle) && !this.isBoolean(playlist.shuffle)) {
            errors.push('shuffle must be boolean');
        }
        
        return {
            valid: errors.length === 0,
            errors: errors
        };
    },
    
    // ========================================================================
    // VALIDATION ROUTING
    // ========================================================================
    
    /**
     * Valide une configuration de route MIDI
     * @param {Object} route - Route à valider
     * @returns {Object} {valid: boolean, errors: Array}
     */
    validateRoute(route) {
        const errors = [];
        
        if (!this.isObject(route)) {
            return { valid: false, errors: ['Route must be an object'] };
        }
        
        // Source (requis)
        if (!this.isString(route.source)) {
            errors.push('Missing source device');
        }
        
        // Destination (requis)
        if (!this.isString(route.destination)) {
            errors.push('Missing destination device');
        }
        
        // Canaux source (optionnel, array 0-15)
        if (route.sourceChannels !== undefined) {
            if (!Array.isArray(route.sourceChannels)) {
                errors.push('sourceChannels must be an array');
            } else {
                for (const ch of route.sourceChannels) {
                    if (!this.isInteger(ch) || ch < 0 || ch > 15) {
                        errors.push(`Invalid source channel: ${ch}`);
                        break;
                    }
                }
            }
        }
        
        // Canal destination (optionnel, 0-15 ou null pour no-remap)
        if (route.destinationChannel !== undefined && route.destinationChannel !== null) {
            if (!this.isInteger(route.destinationChannel) || 
                route.destinationChannel < 0 || 
                route.destinationChannel > 15) {
                errors.push('Invalid destination channel');
            }
        }
        
        // Filtres (optionnel)
        if (route.filters !== undefined) {
            if (!this.isObject(route.filters)) {
                errors.push('filters must be an object');
            } else {
                const validFilterTypes = ['noteOn', 'noteOff', 'cc', 'programChange', 'pitchBend'];
                for (const [type, enabled] of Object.entries(route.filters)) {
                    if (!validFilterTypes.includes(type)) {
                        errors.push(`Invalid filter type: ${type}`);
                    }
                    if (!this.isBoolean(enabled)) {
                        errors.push(`Filter ${type} must be boolean`);
                    }
                }
            }
        }
        
        // Enabled (optionnel, boolean)
        if (route.enabled !== undefined && !this.isBoolean(route.enabled)) {
            errors.push('enabled must be boolean');
        }
        
        return {
            valid: errors.length === 0,
            errors: errors
        };
    },
    
    /**
     * Valide une configuration de routing
     * @param {Object} routing - Configuration routing
     * @returns {Object} {valid: boolean, errors: Array}
     */
    validateRouting(routing) {
        const errors = [];
        
        if (!this.isObject(routing)) {
            return { valid: false, errors: ['Routing must be an object'] };
        }
        
        if (this.isDefined(routing.sourceChannel) && !this.isValidMidiChannel(routing.sourceChannel)) {
            errors.push('Invalid source channel (must be 1-16)');
        }
        
        if (this.isDefined(routing.targetChannel) && !this.isValidMidiChannel(routing.targetChannel)) {
            errors.push('Invalid target channel (must be 1-16)');
        }
        
        if (this.isDefined(routing.transpose) && 
            (!this.isInteger(routing.transpose) || !this.isInRange(routing.transpose, -24, 24))) {
            errors.push('Invalid transpose (must be -24 to 24)');
        }
        
        if (this.isDefined(routing.velocityCurve) && 
            !['linear', 'exponential', 'logarithmic', 'fixed'].includes(routing.velocityCurve)) {
            errors.push('Invalid velocity curve');
        }
        
        return {
            valid: errors.length === 0,
            errors: errors
        };
    },
    
    /**
     * Valide un preset de routing
     * @param {Object} preset - Preset de routing
     * @returns {Object} {valid: boolean, errors: Array}
     */
    validateRoutingPreset(preset) {
        const errors = [];
        
        if (!this.isObject(preset)) {
            return { valid: false, errors: ['Preset must be an object'] };
        }
        
        if (!this.isValidLength(preset.name, 1, 100)) {
            errors.push('Invalid name (1-100 characters)');
        }
        
        if (preset.description && !this.isValidLength(preset.description, 0, 500)) {
            errors.push('Description too long (max 500 characters)');
        }
        
        if (!this.isObject(preset.config)) {
            errors.push('Missing or invalid config object');
        }
        
        if (preset.tags && !this.isArray(preset.tags)) {
            errors.push('tags must be an array');
        }
        
        return {
            valid: errors.length === 0,
            errors: errors
        };
    },
    
    // ========================================================================
    // VALIDATION DE CONFIGURATION
    // ========================================================================
    
    /**
     * Valide une configuration d'application avec un schéma
     * @param {Object} config - Configuration à valider
     * @param {Object} schema - Schéma de validation
     * @returns {Object} {valid: boolean, errors: Array}
     */
    validateConfig(config, schema) {
        const errors = [];
        
        if (!this.isObject(config)) {
            return { valid: false, errors: ['Config must be an object'] };
        }
        
        if (!this.isObject(schema)) {
            return { valid: false, errors: ['Schema must be an object'] };
        }
        
        for (const [key, rules] of Object.entries(schema)) {
            const value = config[key];
            
            // Required
            if (rules.required && !this.isDefined(value)) {
                errors.push(`Missing required field: ${key}`);
                continue;
            }
            
            // Skip validation if not defined and not required
            if (!this.isDefined(value)) continue;
            
            // Type
            if (rules.type) {
                const typeValidators = {
                    'string': this.isString,
                    'number': this.isNumber,
                    'integer': this.isInteger,
                    'boolean': this.isBoolean,
                    'object': this.isObject,
                    'array': this.isArray,
                    'function': this.isFunction
                };
                
                const validator = typeValidators[rules.type];
                if (validator && !validator.call(this, value)) {
                    errors.push(`Invalid type for ${key}: expected ${rules.type}`);
                }
            }
            
            // Min/Max for numbers
            if (rules.min !== undefined && this.isNumber(value) && value < rules.min) {
                errors.push(`${key} must be >= ${rules.min}`);
            }
            
            if (rules.max !== undefined && this.isNumber(value) && value > rules.max) {
                errors.push(`${key} must be <= ${rules.max}`);
            }
            
            // Enum
            if (rules.enum && !rules.enum.includes(value)) {
                errors.push(`${key} must be one of: ${rules.enum.join(', ')}`);
            }
            
            // Custom validator
            if (rules.validator && this.isFunction(rules.validator)) {
                if (!rules.validator(value)) {
                    errors.push(`Custom validation failed for ${key}`);
                }
            }
        }
        
        return {
            valid: errors.length === 0,
            errors: errors
        };
    },
    
    /**
     * Valide une configuration d'instrument
     * @param {Object} instrument - Configuration instrument
     * @returns {Object} {valid: boolean, errors: Array}
     */
    validateInstrument(instrument) {
        const errors = [];
        
        if (!this.isObject(instrument)) {
            return { valid: false, errors: ['Instrument must be an object'] };
        }
        
        if (!this.isValidLength(instrument.name, 1, 100)) {
            errors.push('Invalid name (1-100 characters)');
        }
        
        const validTypes = ['piano', 'guitar', 'bass', 'drums', 'strings', 'brass', 'woodwind', 'synth', 'other'];
        if (!validTypes.includes(instrument.type)) {
            errors.push('Invalid type');
        }
        
        if (this.isDefined(instrument.midiChannel) && !this.isValidMidiChannel(instrument.midiChannel)) {
            errors.push('Invalid MIDI channel');
        }
        
        if (this.isDefined(instrument.program) && !this.isValidProgram(instrument.program)) {
            errors.push('Invalid program number');
        }
        
        return {
            valid: errors.length === 0,
            errors: errors
        };
    },
    
    // ========================================================================
    // VALIDATION DE FICHIERS
    // ========================================================================
    
    /**
     * Vérifie si un nom de fichier est valide
     * @param {string} filename - Nom de fichier
     * @returns {boolean}
     */
    isValidFilename(filename) {
        if (!this.isString(filename)) return false;
        // Autorise lettres, chiffres, espaces, points, tirets, underscores
        return /^[a-zA-Z0-9_\-. ]+$/.test(filename) && filename.length <= 255;
    },
    
    /**
     * Vérifie si un chemin est valide
     * @param {string} path - Chemin
     * @returns {boolean}
     */
    isValidPath(path) {
        if (!this.isString(path)) return false;
        return /^[a-zA-Z0-9_\-./\\: ]+$/.test(path);
    },
    
    /**
     * Vérifie si un fichier a une extension MIDI valide
     * @param {string} filename - Nom de fichier
     * @returns {boolean}
     */
    isValidMidiExtension(filename) {
        if (!this.isString(filename)) return false;
        return /\.(mid|midi)$/i.test(filename);
    },
    
    /**
     * Vérifie si une URL est valide
     * @param {string} url - URL
     * @returns {boolean}
     */
    isValidUrl(url) {
        if (!this.isString(url)) return false;
        return /^https?:\/\/.+/.test(url);
    },
    
    /**
     * Vérifie si un email est valide
     * @param {string} email - Email
     * @returns {boolean}
     */
    isValidEmail(email) {
        if (!this.isString(email)) return false;
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    },
    
    /**
     * Vérifie si une couleur hexadécimale est valide
     * @param {string} color - Couleur hex
     * @returns {boolean}
     */
    isValidHexColor(color) {
        if (!this.isString(color)) return false;
        return /^#[0-9A-F]{6}$/i.test(color);
    },
    
    /**
     * Vérifie si une chaîne est un JSON valide
     * @param {string} str - Chaîne JSON
     * @returns {boolean}
     */
    isValidJSON(str) {
        if (!this.isString(str)) return false;
        try {
            JSON.parse(str);
            return true;
        } catch (e) {
            return false;
        }
    },
    
    // ========================================================================
    // UTILITAIRES DE SANITIZATION
    // ========================================================================
    
    /**
     * Nettoie et valide une valeur selon un type
     * @param {any} value - Valeur à nettoyer
     * @param {string} type - Type attendu
     * @param {any} defaultValue - Valeur par défaut
     * @returns {any} Valeur nettoyée
     */
    sanitize(value, type, defaultValue = null) {
        switch (type) {
            case 'number':
                return this.isNumber(value) ? value : defaultValue;
            
            case 'integer':
                return this.isInteger(value) ? value : defaultValue;
            
            case 'string':
                return typeof value === 'string' ? value.trim() : defaultValue;
            
            case 'boolean':
                return typeof value === 'boolean' ? value : defaultValue;
            
            case 'midiNote':
                return this.isValidMidiNote(value) ? value : defaultValue;
            
            case 'midiChannel':
                return this.isValidMidiChannel(value) ? value : defaultValue;
            
            case 'velocity':
                return this.isValidVelocity(value) ? value : defaultValue;
            
            default:
                return value;
        }
    },
    
    /**
     * Contraint une valeur dans une plage
     * @param {number} value - Valeur
     * @param {number} min - Minimum
     * @param {number} max - Maximum
     * @returns {number} Valeur contrainte
     */
    clamp(value, min, max) {
        if (!this.isNumber(value)) return min;
        return Math.max(min, Math.min(max, value));
    },
    
    /**
     * Valide et retourne les erreurs sous forme de message
     * @param {Object} validationResult - Résultat de validation
     * @returns {string} Message d'erreur ou chaîne vide
     */
    getErrorMessage(validationResult) {
        if (!validationResult || validationResult.valid) {
            return '';
        }
        
        return validationResult.errors.join('; ');
    },
    
    /**
     * Crée un validateur personnalisé
     * @param {Function} fn - Fonction de validation
     * @param {string} errorMessage - Message d'erreur
     * @returns {Function} Validateur
     */
    createValidator(fn, errorMessage) {
        return (value) => {
            const valid = fn(value);
            return {
                valid: valid,
                errors: valid ? [] : [errorMessage]
            };
        };
    },
    
    /**
     * Échappe les caractères HTML dans une chaîne
     * @param {string} str - Chaîne à échapper
     * @returns {string} Chaîne échappée
     */
    escapeHtml(str) {
        if (!this.isString(str)) return '';
        
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        
        return str.replace(/[&<>"']/g, m => map[m]);
    },
    
    /**
     * Nettoie une chaîne pour utilisation en tant qu'ID
     * @param {string} str - Chaîne à nettoyer
     * @returns {string} ID nettoyé
     */
    sanitizeId(str) {
        if (!this.isString(str)) return '';
        
        return str
            .toLowerCase()
            .trim()
            .replace(/[^a-z0-9-_]/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '');
    },
    
    /**
     * Nettoie un nom de fichier
     * @param {string} filename - Nom de fichier
     * @returns {string} Nom nettoyé
     */
    sanitizeFilename(filename) {
        if (!this.isString(filename)) return '';
        
        return filename
            .trim()
            .replace(/[^a-zA-Z0-9._-]/g, '_')
            .substring(0, 255);
    },
    
    // ========================================================================
    // VALIDATION DE DONNÉES SYSTÈME
    // ========================================================================
    
    /**
     * Valide une configuration système
     * @param {Object} systemConfig - Configuration système
     * @returns {Object} {valid: boolean, errors: Array}
     */
    validateSystemConfig(systemConfig) {
        const errors = [];
        
        if (!this.isObject(systemConfig)) {
            return { valid: false, errors: ['System config must be an object'] };
        }
        
        // Audio settings
        if (systemConfig.audio) {
            if (this.isDefined(systemConfig.audio.sampleRate) && 
                ![44100, 48000, 96000].includes(systemConfig.audio.sampleRate)) {
                errors.push('Invalid sample rate');
            }
            
            if (this.isDefined(systemConfig.audio.bufferSize) && 
                !this.isInteger(systemConfig.audio.bufferSize)) {
                errors.push('Invalid buffer size');
            }
        }
        
        // MIDI settings
        if (systemConfig.midi) {
            if (this.isDefined(systemConfig.midi.inputDevice) && 
                !this.isString(systemConfig.midi.inputDevice)) {
                errors.push('Invalid MIDI input device');
            }
            
            if (this.isDefined(systemConfig.midi.outputDevice) && 
                !this.isString(systemConfig.midi.outputDevice)) {
                errors.push('Invalid MIDI output device');
            }
        }
        
        return {
            valid: errors.length === 0,
            errors: errors
        };
    }
};

// Geler l'objet pour empêcher les modifications
Object.freeze(Validator);

// ============================================================================
// EXPORT
// ============================================================================

if (typeof module !== 'undefined' && module.exports) {
    module.exports = Validator;
}

if (typeof window !== 'undefined') {
    window.Validator = Validator;
}
window.Validator = Validator;