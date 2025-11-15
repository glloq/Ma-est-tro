// ============================================================================
// Fichier: frontend/scripts/services/MidiService.js
// Version: 3.0.1 - LOGGER PROTECTION
// Date: 2025-10-30
// Projet: midiMind v3.0 - SystÃƒÂ¨me d'Orchestration MIDI pour Raspberry Pi
// ============================================================================
// CORRECTIONS v3.0.1:
// Ã¢Å“â€¦ Protection logger avec mÃƒÂ©thode log() sÃƒÂ©curisÃƒÂ©e
// ============================================================================

class MidiService {
    constructor(eventBus, logger) {
        this.eventBus = eventBus || window.eventBus || null;
        this.logger = logger || console;
        
        // Cache des mÃƒÂ©tadonnÃƒÂ©es parsÃƒÂ©es
        this.metadataCache = new Map();
        
        // Configuration
        this.config = {
            maxCacheSize: 100,
            cacheExpiration: 3600000, // 1 heure
            supportedFormats: ['.mid', '.midi', '.MID', '.MIDI'],
            maxFileSize: 10 * 1024 * 1024 // 10MB
        };
        
        // Parser MIDI (utilise MidiParser existant si disponible)
        this.parser = typeof MidiParser !== 'undefined' ? new MidiParser() : null;
        
        // Statistiques
        this.stats = {
            filesParsed: 0,
            cacheHits: 0,
            cacheMisses: 0,
            parseErrors: 0
        };
        
        this.initialize();
    }
    
    // ========================================================================
    // INITIALISATION
    // ========================================================================
    
    initialize() {
        this.log('info', 'MidiService', 'Initializing MIDI service...');
        
        // Nettoyer le cache pÃƒÂ©riodiquement
        setInterval(() => this.cleanCache(), 60000); // Toutes les minutes
    }
    
    /**
     * Log sÃƒÂ©curisÃƒÂ© avec fallback
     */
    log(level, ...args) {
        if (this.logger && typeof this.logger[level] === 'function') {
            this.logger[level](...args);
        } else {
            console[level]?.(...args) || console.log(...args);
        }
    }
    
    // ========================================================================
    // PARSING DE FICHIERS MIDI
    // ========================================================================
    
    /**
     * Parser un fichier MIDI et extraire les mÃƒÂ©tadonnÃƒÂ©es
     * @param {ArrayBuffer|Uint8Array} data - DonnÃƒÂ©es du fichier MIDI
     * @param {string} fileName - Nom du fichier
     * @returns {Object} MÃƒÂ©tadonnÃƒÂ©es du fichier
     */
    async parseFile(data, fileName = 'unknown.mid') {
        try {
            this.log('debug', 'MidiService', `Parsing file: ${fileName}`);
            
            // VÃƒÂ©rifier le cache
            const cacheKey = this.generateCacheKey(data);
            if (this.metadataCache.has(cacheKey)) {
                const cached = this.metadataCache.get(cacheKey);
                if (Date.now() - cached.timestamp < this.config.cacheExpiration) {
                    this.stats.cacheHits++;
                    return cached.metadata;
                }
            }
            
            this.stats.cacheMisses++;
            
            // Parser le fichier
            const metadata = await this._parseFileInternal(data, fileName);
            
            // Mettre en cache
            this.metadataCache.set(cacheKey, {
                metadata,
                timestamp: Date.now()
            });
            
            // Limiter la taille du cache
            if (this.metadataCache.size > this.config.maxCacheSize) {
                const firstKey = this.metadataCache.keys().next().value;
                this.metadataCache.delete(firstKey);
            }
            
            this.stats.filesParsed++;
            
            return metadata;
            
        } catch (error) {
            this.log('error', 'MidiService', `Failed to parse file ${fileName}:`, error);
            this.stats.parseErrors++;
            throw error;
        }
    }
    
    /**
     * Parser interne du fichier MIDI
     */
    async _parseFileInternal(data, fileName) {
        // Si MidiParser est disponible, l'utiliser
        if (this.parser) {
            return this.parser.parse(data);
        }
        
        // Sinon, parser manuellement (version simplifiÃƒÂ©e)
        const view = new DataView(data.buffer || data);
        const metadata = {
            fileName: fileName,
            fileSize: data.byteLength,
            format: 0,
            trackCount: 0,
            division: 480,
            duration: 0,
            tempo: 120,
            timeSignature: '4/4',
            tracks: [],
            instruments: [],
            noteCount: 0,
            minNote: 127,
            maxNote: 0,
            hasLyrics: false,
            hasMarkers: false
        };
        
        // VÃƒÂ©rifier l'en-tÃƒÂªte MThd
        const headerChunk = this.readChunk(view, 0);
        if (headerChunk.type !== 'MThd') {
            throw new Error('Invalid MIDI file: missing MThd header');
        }
        
        // Lire les donnÃƒÂ©es de l'en-tÃƒÂªte
        metadata.format = view.getUint16(14, false);
        metadata.trackCount = view.getUint16(16, false);
        metadata.division = view.getUint16(18, false);
        
        // Parser chaque piste
        let offset = 14 + headerChunk.length;
        for (let i = 0; i < metadata.trackCount; i++) {
            const trackData = this.parseTrack(view, offset);
            metadata.tracks.push(trackData);
            offset += trackData.size;
            
            // Collecter les statistiques
            metadata.noteCount += trackData.noteCount;
            metadata.minNote = Math.min(metadata.minNote, trackData.minNote);
            metadata.maxNote = Math.max(metadata.maxNote, trackData.maxNote);
            
            if (trackData.name) {
                metadata.instruments.push(trackData.name);
            }
            
            if (trackData.hasLyrics) metadata.hasLyrics = true;
            if (trackData.hasMarkers) metadata.hasMarkers = true;
        }
        
        // Calculer la durÃƒÂ©e totale
        metadata.duration = this.calculateDuration(metadata);
        
        return metadata;
    }
    
    /**
     * Lire un chunk MIDI
     */
    readChunk(view, offset) {
        const type = String.fromCharCode(
            view.getUint8(offset),
            view.getUint8(offset + 1),
            view.getUint8(offset + 2),
            view.getUint8(offset + 3)
        );
        const length = view.getUint32(offset + 4, false);
        
        return { type, length };
    }
    
    /**
     * Parser une piste MIDI (simplifiÃƒÂ©)
     */
    parseTrack(view, offset) {
        const chunk = this.readChunk(view, offset);
        if (chunk.type !== 'MTrk') {
            throw new Error('Invalid track chunk');
        }
        
        const trackData = {
            size: 8 + chunk.length,
            name: null,
            noteCount: 0,
            minNote: 127,
            maxNote: 0,
            hasLyrics: false,
            hasMarkers: false,
            events: []
        };
        
        // Parser simplifiÃƒÂ© - compter les ÃƒÂ©vÃƒÂ©nements principaux
        let position = offset + 8;
        const endPosition = position + chunk.length;
        let runningStatus = 0;
        
        while (position < endPosition) {
            // Lire le delta time (variable length)
            let deltaTime = 0;
            let byte;
            do {
                byte = view.getUint8(position++);
                deltaTime = (deltaTime << 7) | (byte & 0x7F);
            } while (byte & 0x80);
            
            // Lire le statut
            byte = view.getUint8(position++);
            let status = byte;
            
            if (byte < 0x80) {
                // Running status
                status = runningStatus;
                position--;
            } else {
                runningStatus = status;
            }
            
            // Traiter l'ÃƒÂ©vÃƒÂ©nement
            const eventType = status & 0xF0;
            
            switch (eventType) {
                case 0x80: // Note Off
                case 0x90: // Note On
                    const note = view.getUint8(position++);
                    const velocity = view.getUint8(position++);
                    
                    if (eventType === 0x90 && velocity > 0) {
                        trackData.noteCount++;
                        trackData.minNote = Math.min(trackData.minNote, note);
                        trackData.maxNote = Math.max(trackData.maxNote, note);
                    }
                    break;
                    
                case 0xA0: // Polyphonic Aftertouch
                case 0xB0: // Control Change
                case 0xE0: // Pitch Bend
                    position += 2;
                    break;
                    
                case 0xC0: // Program Change
                case 0xD0: // Channel Aftertouch
                    position += 1;
                    break;
                    
                case 0xF0: // System/Meta
                    if (status === 0xFF) {
                        // Meta event
                        const metaType = view.getUint8(position++);
                        const length = this.readVariableLength(view, position);
                        position += length.bytesRead;
                        
                        // Extraire les informations importantes
                        if (metaType === 0x03) { // Track name
                            trackData.name = this.readString(view, position, length.value);
                        } else if (metaType === 0x05) { // Lyrics
                            trackData.hasLyrics = true;
                        } else if (metaType === 0x06) { // Marker
                            trackData.hasMarkers = true;
                        }
                        
                        position += length.value;
                    } else if (status === 0xF0 || status === 0xF7) {
                        // SysEx
                        const length = this.readVariableLength(view, position);
                        position += length.bytesRead + length.value;
                    }
                    break;
            }
        }
        
        return trackData;
    }
    
    /**
     * Lire une longueur variable (MIDI variable-length quantity)
     */
    readVariableLength(view, offset) {
        let value = 0;
        let bytesRead = 0;
        let byte;
        
        do {
            byte = view.getUint8(offset + bytesRead);
            value = (value << 7) | (byte & 0x7F);
            bytesRead++;
        } while (byte & 0x80);
        
        return { value, bytesRead };
    }
    
    /**
     * Lire une chaÃƒÂ®ne de caractÃƒÂ¨res
     */
    readString(view, offset, length) {
        let str = '';
        for (let i = 0; i < length; i++) {
            str += String.fromCharCode(view.getUint8(offset + i));
        }
        return str;
    }
    
    // ========================================================================
    // CALCULS ET CONVERSIONS
    // ========================================================================
    
    /**
     * Calculer la durÃƒÂ©e totale du fichier
     */
    calculateDuration(metadata) {
        // Calcul simplifiÃƒÂ© basÃƒÂ© sur le tempo par dÃƒÂ©faut
        // Pour une implÃƒÂ©mentation complÃƒÂ¨te, il faudrait parser tous les ÃƒÂ©vÃƒÂ©nements tempo
        const ticksPerQuarter = metadata.division;
        const microsecondsPerQuarter = 500000; // Tempo par dÃƒÂ©faut (120 BPM)
        
        // Trouver le dernier ÃƒÂ©vÃƒÂ©nement
        let maxTicks = 0;
        for (const track of metadata.tracks) {
            // Dans une implÃƒÂ©mentation complÃƒÂ¨te, on accumulerait les delta times
            maxTicks = Math.max(maxTicks, 10000); // Valeur par dÃƒÂ©faut
        }
        
        // Convertir en millisecondes
        const quarters = maxTicks / ticksPerQuarter;
        const microseconds = quarters * microsecondsPerQuarter;
        const milliseconds = microseconds / 1000;
        
        return Math.round(milliseconds);
    }
    
    /**
     * Extraire le BPM du fichier
     */
    extractBPM(metadata) {
        // BPM = 60,000,000 / microsecondsPerQuarter
        // Par dÃƒÂ©faut: 120 BPM
        return metadata.tempo || 120;
    }
    
    /**
     * Obtenir le nom de la note ÃƒÂ  partir du numÃƒÂ©ro MIDI
     */
    getNoteName(noteNumber) {
        if (typeof MidiConstants !== 'undefined') {
            return MidiConstants.getNoteName(noteNumber);
        }
        
        const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        const octave = Math.floor(noteNumber / 12) - 1;
        const note = noteNames[noteNumber % 12];
        return `${note}${octave}`;
    }
    
    /**
     * Convertir la durÃƒÂ©e en format lisible
     */
    formatDuration(milliseconds) {
        const totalSeconds = Math.floor(milliseconds / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }
    
    // ========================================================================
    // VALIDATION
    // ========================================================================
    
    /**
     * VÃƒÂ©rifier si un fichier est un MIDI valide
     */
    isValidMidiFile(data) {
        if (!data || data.byteLength < 14) {
            return false;
        }
        
        const view = new DataView(data.buffer || data);
        
        // VÃƒÂ©rifier l'en-tÃƒÂªte MThd
        const header = String.fromCharCode(
            view.getUint8(0),
            view.getUint8(1),
            view.getUint8(2),
            view.getUint8(3)
        );
        
        return header === 'MThd';
    }
    
    /**
     * VÃƒÂ©rifier si une extension est supportÃƒÂ©e
     */
    isSupportedFormat(fileName) {
        const extension = fileName.substring(fileName.lastIndexOf('.')).toLowerCase();
        return this.config.supportedFormats.includes(extension);
    }
    
    // ========================================================================
    // CACHE
    // ========================================================================
    
    /**
     * GÃƒÂ©nÃƒÂ©rer une clÃƒÂ© de cache unique pour les donnÃƒÂ©es
     */
    generateCacheKey(data) {
        // Simple hash basÃƒÂ© sur la taille et les premiers octets
        const view = new DataView(data.buffer || data);
        let hash = data.byteLength;
        
        for (let i = 0; i < Math.min(100, data.byteLength); i++) {
            hash = ((hash << 5) - hash) + view.getUint8(i);
            hash = hash & hash; // Convertir en 32-bit integer
        }
        
        return hash.toString(16);
    }
    
    /**
     * Nettoyer le cache expirÃƒÂ©
     */
    cleanCache() {
        const now = Date.now();
        const expiredKeys = [];
        
        for (const [key, value] of this.metadataCache) {
            if (now - value.timestamp > this.config.cacheExpiration) {
                expiredKeys.push(key);
            }
        }
        
        for (const key of expiredKeys) {
            this.metadataCache.delete(key);
        }
        
        if (expiredKeys.length > 0) {
            this.log('debug', 'MidiService', `Cleaned ${expiredKeys.length} expired cache entries`);
        }
    }
    
    /**
     * Vider tout le cache
     */
    clearCache() {
        this.metadataCache.clear();
        this.log('info', 'MidiService', 'Cache cleared');
    }
    
    // ========================================================================
    // STATISTIQUES
    // ========================================================================
    
    getStats() {
        return {
            ...this.stats,
            cacheSize: this.metadataCache.size,
            cacheHitRate: this.stats.cacheHits / (this.stats.cacheHits + this.stats.cacheMisses) || 0
        };
    }
}

// ============================================================================
// EXPORT
// ============================================================================

if (typeof module !== 'undefined' && module.exports) {
    module.exports = MidiService;
}

if (typeof window !== 'undefined') {
    window.MidiService = MidiService;
}