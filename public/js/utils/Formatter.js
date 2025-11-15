// ============================================================================
// Fichier: frontend/js/utils/Formatter.js
// Projet: MidiMind v3.0 - Système d'Orchestration MIDI pour Raspberry Pi
// Version: 3.0.0
// Date: 2025-10-14
// ============================================================================
// Description:
//   Utilitaires de formatage de données pour affichage UI.
//   Dates, durées, tailles fichiers, nombres, etc.
//
// Fonctionnalités:
//   - Formatage dates (DD/MM/YYYY, relative)
//   - Formatage durées (mm:ss.ms, human-readable)
//   - Formatage tailles fichiers (KB, MB)
//   - Formatage nombres (séparateurs milliers)
//   - Formatage pourcentages
//   - Formatage temps MIDI (bars:beats:ticks)
//   - Pluralization automatique
//
// Architecture:
//   Formatter (objet statique)
//   - Méthodes pures (no state)
//   - Locale-aware (i18n ready)
//   - Cache de formats courants
//
// Auteur: MidiMind Team
// ============================================================================

const Formatter = {
    // ========================================================================
    // TEMPS & DURÉE
    // ========================================================================
    
    /**
     * Formate une durée en millisecondes en format lisible
     * @param {number} ms - Durée en millisecondes
     * @param {boolean} showMs - Afficher les millisecondes
     * @returns {string} Durée formatée (ex: "2:34.567" ou "1:23:45")
     */
    formatDuration(ms, showMs = false) {
        if (ms === null || ms === undefined || isNaN(ms)) return '0:00';
        
        const totalSeconds = Math.floor(ms / 1000);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;
        const milliseconds = Math.floor(ms % 1000);
        
        let result = '';
        
        if (hours > 0) {
            result = `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        } else {
            result = `${minutes}:${String(seconds).padStart(2, '0')}`;
        }
        
        if (showMs) {
            result += `.${String(milliseconds).padStart(3, '0')}`;
        }
        
        return result;
    },
    
    /**
     * Formate une durée en secondes
     * @param {number} seconds - Durée en secondes
     * @returns {string} Durée formatée
     */
    formatSeconds(seconds) {
        return this.formatDuration(seconds * 1000);
    },
    
    /**
     * Formate un timestamp en temps musical (bars:beats:ticks)
     * @param {number} ticks - Position en ticks
     * @param {number} ticksPerBeat - Ticks par beat (défaut 480)
     * @param {number} beatsPerBar - Beats par mesure (défaut 4)
     * @returns {string} Format "bar:beat:tick"
     */
    formatMusicalTime(ticks, ticksPerBeat = 480, beatsPerBar = 4) {
        if (ticks === null || ticks === undefined || isNaN(ticks)) return '1:1:0';
        
        const totalBeats = ticks / ticksPerBeat;
        const bar = Math.floor(totalBeats / beatsPerBar) + 1;
        const beat = Math.floor(totalBeats % beatsPerBar) + 1;
        const tick = Math.floor(ticks % ticksPerBeat);
        
        return `${bar}:${beat}:${tick}`;
    },
    
    /**
     * Formate un timestamp Unix en date/heure lisible
     * @param {number} timestamp - Timestamp Unix (ms)
     * @param {boolean} includeTime - Inclure l'heure
     * @returns {string} Date formatée
     */
    formatTimestamp(timestamp, includeTime = true) {
        if (!timestamp) return 'N/A';
        
        const date = new Date(timestamp);
        
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        
        let result = `${year}-${month}-${day}`;
        
        if (includeTime) {
            const hours = String(date.getHours()).padStart(2, '0');
            const minutes = String(date.getMinutes()).padStart(2, '0');
            const seconds = String(date.getSeconds()).padStart(2, '0');
            result += ` ${hours}:${minutes}:${seconds}`;
        }
        
        return result;
    },
    
    /**
     * Formate un timestamp en temps relatif (il y a X minutes)
     * @param {number} timestamp - Timestamp Unix (ms)
     * @returns {string} Temps relatif
     */
    formatRelativeTime(timestamp) {
        if (!timestamp) return 'Never';
        
        const now = Date.now();
        const diff = now - timestamp;
        
        const seconds = Math.floor(diff / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);
        const months = Math.floor(days / 30);
        const years = Math.floor(days / 365);
        
        if (seconds < 60) return 'Just now';
        if (minutes < 60) return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
        if (hours < 24) return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
        if (days < 30) return `${days} day${days !== 1 ? 's' : ''} ago`;
        if (months < 12) return `${months} month${months !== 1 ? 's' : ''} ago`;
        return `${years} year${years !== 1 ? 's' : ''} ago`;
    },
    
    // ========================================================================
    // TAILLES DE FICHIERS
    // ========================================================================
    
    /**
     * Formate une taille en octets en format lisible
     * @param {number} bytes - Taille en octets
     * @param {number} decimals - Nombre de décimales
     * @returns {string} Taille formatée (ex: "1.5 MB")
     */
    formatFileSize(bytes, decimals = 2) {
        if (bytes === null || bytes === undefined || isNaN(bytes)) return '0 B';
        if (bytes === 0) return '0 B';
        
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
        
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    },
    
    /**
     * Formate un nombre d'octets en format court
     * @param {number} bytes - Taille en octets
     * @returns {string} Taille formatée courte (ex: "1.5M")
     */
    formatFileSizeShort(bytes) {
        if (bytes === null || bytes === undefined || isNaN(bytes)) return '0';
        if (bytes === 0) return '0';
        
        const k = 1024;
        const sizes = ['', 'K', 'M', 'G', 'T'];
        
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + sizes[i];
    },
    
    // ========================================================================
    // NOTES MIDI
    // ========================================================================
    
    /**
     * Formate un numéro de note MIDI en nom (ex: 60 -> "C4")
     * @param {number} noteNumber - Numéro de note MIDI (0-127)
     * @returns {string} Nom de la note
     */
    formatNoteName(noteNumber) {
        if (noteNumber === null || noteNumber === undefined || isNaN(noteNumber)) return 'N/A';
        if (noteNumber < 0 || noteNumber > 127) return 'Invalid';
        
        const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        const octave = Math.floor(noteNumber / 12) - 1;
        const noteName = noteNames[noteNumber % 12];
        
        return `${noteName}${octave}`;
    },
    
    /**
     * Formate une plage de notes
     * @param {number} minNote - Note minimale
     * @param {number} maxNote - Note maximale
     * @returns {string} Plage formatée (ex: "C2-C7")
     */
    formatNoteRange(minNote, maxNote) {
        return `${this.formatNoteName(minNote)}-${this.formatNoteName(maxNote)}`;
    },
    
    /**
     * Formate une vélocité en pourcentage
     * @param {number} velocity - Vélocité MIDI (0-127)
     * @returns {string} Vélocité en % (ex: "64%")
     */
    formatVelocity(velocity) {
        if (velocity === null || velocity === undefined || isNaN(velocity)) return '0%';
        const percent = Math.round((velocity / 127) * 100);
        return `${percent}%`;
    },
    
    // ========================================================================
    // NOMBRES
    // ========================================================================
    
    /**
     * Formate un nombre avec séparateurs de milliers
     * @param {number} number - Nombre à formater
     * @param {number} decimals - Nombre de décimales
     * @returns {string} Nombre formaté (ex: "1,234.56")
     */
    formatNumber(number, decimals = 0) {
        if (number === null || number === undefined || isNaN(number)) return '0';
        
        return number.toLocaleString('en-US', {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals
        });
    },
    
    /**
     * Formate un nombre en pourcentage
     * @param {number} value - Valeur (0-1)
     * @param {number} decimals - Nombre de décimales
     * @returns {string} Pourcentage formaté (ex: "75.5%")
     */
    formatPercent(value, decimals = 0) {
        if (value === null || value === undefined || isNaN(value)) return '0%';
        const percent = value * 100;
        return `${percent.toFixed(decimals)}%`;
    },
    
    /**
     * Formate un nombre avec une unité
     * @param {number} value - Valeur
     * @param {string} unit - Unité
     * @param {number} decimals - Nombre de décimales
     * @returns {string} Valeur avec unité (ex: "120 BPM")
     */
    formatWithUnit(value, unit, decimals = 0) {
        if (value === null || value === undefined || isNaN(value)) return `0 ${unit}`;
        return `${value.toFixed(decimals)} ${unit}`;
    },
    
    /**
     * Formate un tempo
     * @param {number} bpm - Tempo en BPM
     * @returns {string} Tempo formaté (ex: "120 BPM")
     */
    formatTempo(bpm) {
        return this.formatWithUnit(bpm, 'BPM', 1);
    },
    
    /**
     * Arrondit un nombre à N décimales
     * @param {number} value - Valeur
     * @param {number} decimals - Nombre de décimales
     * @returns {number} Valeur arrondie
     */
    round(value, decimals = 0) {
        if (value === null || value === undefined || isNaN(value)) return 0;
        const multiplier = Math.pow(10, decimals);
        return Math.round(value * multiplier) / multiplier;
    },
    
    // ========================================================================
    // CANAUX & INSTRUMENTS
    // ========================================================================
    
    /**
     * Formate un numéro de canal MIDI
     * @param {number} channel - Canal MIDI (1-16)
     * @returns {string} Canal formaté (ex: "Ch 1")
     */
    formatChannel(channel) {
        if (channel === null || channel === undefined || isNaN(channel)) return 'N/A';
        if (channel < 1 || channel > 16) return 'Invalid';
        return `Ch ${channel}`;
    },
    
    /**
     * Formate un numéro de programme (instrument)
     * @param {number} program - Numéro de programme (0-127)
     * @returns {string} Programme formaté (ex: "Pgm 1")
     */
    formatProgram(program) {
        if (program === null || program === undefined || isNaN(program)) return 'N/A';
        if (program < 0 || program > 127) return 'Invalid';
        return `Pgm ${program + 1}`;
    },
    
    /**
     * Formate un numéro de Control Change
     * @param {number} cc - Numéro CC (0-127)
     * @returns {string} CC formaté (ex: "CC 7")
     */
    formatCC(cc) {
        if (cc === null || cc === undefined || isNaN(cc)) return 'N/A';
        if (cc < 0 || cc > 127) return 'Invalid';
        return `CC ${cc}`;
    },
    
    // ========================================================================
    // CHAÎNES DE CARACTÈRES
    // ========================================================================
    
    /**
     * Tronque une chaîne à une longueur max
     * @param {string} str - Chaîne à tronquer
     * @param {number} maxLength - Longueur maximale
     * @param {string} suffix - Suffixe (défaut "...")
     * @returns {string} Chaîne tronquée
     */
    truncate(str, maxLength, suffix = '...') {
        if (!str) return '';
        if (str.length <= maxLength) return str;
        return str.substring(0, maxLength - suffix.length) + suffix;
    },
    
    /**
     * Capitalise la première lettre
     * @param {string} str - Chaîne
     * @returns {string} Chaîne capitalisée
     */
    capitalize(str) {
        if (!str) return '';
        return str.charAt(0).toUpperCase() + str.slice(1);
    },
    
    /**
     * Convertit en titre (première lettre de chaque mot en majuscule)
     * @param {string} str - Chaîne
     * @returns {string} Chaîne en titre
     */
    toTitleCase(str) {
        if (!str) return '';
        return str.replace(/\w\S*/g, (txt) => {
            return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
        });
    },
    
    /**
     * Convertit camelCase en "Camel Case"
     * @param {string} str - Chaîne en camelCase
     * @returns {string} Chaîne lisible
     */
    camelCaseToWords(str) {
        if (!str) return '';
        return str.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase()).trim();
    },
    
    /**
     * Nettoie un nom de fichier
     * @param {string} filename - Nom de fichier
     * @returns {string} Nom nettoyé
     */
    cleanFilename(filename) {
        if (!filename) return '';
        return filename.replace(/[^a-z0-9_\-\.]/gi, '_');
    },
    
    // ========================================================================
    // COULEURS
    // ========================================================================
    
    /**
     * Convertit une couleur RGB en hex
     * @param {number} r - Rouge (0-255)
     * @param {number} g - Vert (0-255)
     * @param {number} b - Bleu (0-255)
     * @returns {string} Couleur hex (ex: "#ff0000")
     */
    rgbToHex(r, g, b) {
        const toHex = (n) => {
            const hex = Math.max(0, Math.min(255, Math.round(n))).toString(16);
            return hex.length === 1 ? '0' + hex : hex;
        };
        return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
    },
    
    /**
     * Convertit une couleur hex en RGB
     * @param {string} hex - Couleur hex (ex: "#ff0000")
     * @returns {Object} Objet {r, g, b}
     */
    hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : null;
    },
    
    /**
     * Obtient une couleur basée sur une vélocité
     * @param {number} velocity - Vélocité (0-127)
     * @returns {string} Couleur hex
     */
    velocityToColor(velocity) {
        if (velocity === null || velocity === undefined || isNaN(velocity)) return '#808080';
        
        const normalized = velocity / 127;
        
        // Gradient du bleu au rouge
        const r = Math.round(normalized * 255);
        const g = 0;
        const b = Math.round((1 - normalized) * 255);
        
        return this.rgbToHex(r, g, b);
    },
    
    // ========================================================================
    // LISTES & TABLEAUX
    // ========================================================================
    
    /**
     * Formate un tableau en liste lisible
     * @param {Array} items - Éléments
     * @param {string} separator - Séparateur (défaut ", ")
     * @param {string} lastSeparator - Dernier séparateur (défaut " and ")
     * @returns {string} Liste formatée
     */
    formatList(items, separator = ', ', lastSeparator = ' and ') {
        if (!items || items.length === 0) return '';
        if (items.length === 1) return items[0];
        
        const allButLast = items.slice(0, -1).join(separator);
        const last = items[items.length - 1];
        
        return `${allButLast}${lastSeparator}${last}`;
    },
    
    /**
     * Formate un compte (ex: "3 files", "1 file")
     * @param {number} count - Nombre d'items
     * @param {string} singular - Forme singulière
     * @param {string} plural - Forme plurielle (optionnel, ajoute 's')
     * @returns {string} Compte formaté
     */
    formatCount(count, singular, plural = null) {
        if (count === null || count === undefined) count = 0;
        const pluralForm = plural || (singular + 's');
        return `${count} ${count === 1 ? singular : pluralForm}`;
    },
    
    // ========================================================================
    // ÉTAT & STATUT
    // ========================================================================
    
    /**
     * Formate un état de connexion
     * @param {boolean} connected - Est connecté
     * @returns {string} État formaté
     */
    formatConnectionState(connected) {
        return connected ? '🟢 Connected' : '🔴 Disconnected';
    },
    
    /**
     * Formate un état de playback
     * @param {string} state - État (stopped, playing, paused)
     * @returns {string} État formaté avec icône
     */
    formatPlaybackState(state) {
        const states = {
            stopped: '⏹️ Stopped',
            playing: '▶️ Playing',
            paused: '⏸️ Paused',
            recording: '⏺️ Recording'
        };
        return states[state] || state;
    },
    
    /**
     * Formate une valeur booléenne
     * @param {boolean} value - Valeur
     * @param {Object} labels - Labels personnalisés {true: '...', false: '...'}
     * @returns {string} Valeur formatée
     */
    formatBoolean(value, labels = { true: 'Yes', false: 'No' }) {
        return value ? labels.true : labels.false;
    },
    
    // ========================================================================
    // COORDONNÉES & POSITIONS
    // ========================================================================
    
    /**
     * Formate des coordonnées
     * @param {number} x - Position X
     * @param {number} y - Position Y
     * @returns {string} Coordonnées formatées
     */
    formatCoordinates(x, y) {
        return `(${this.round(x, 2)}, ${this.round(y, 2)})`;
    },
    
    /**
     * Formate une résolution
     * @param {number} width - Largeur
     * @param {number} height - Hauteur
     * @returns {string} Résolution formatée (ex: "1920x1080")
     */
    formatResolution(width, height) {
        return `${width}×${height}`;
    },
    
    // ========================================================================
    // UTILITAIRES
    // ========================================================================
    
    /**
     * Pad un nombre avec des zéros à gauche
     * @param {number} num - Nombre
     * @param {number} size - Taille totale
     * @returns {string} Nombre padé
     */
    padZero(num, size = 2) {
        return String(num).padStart(size, '0');
    },
    
    /**
     * Génère un ID unique
     * @param {string} prefix - Préfixe optionnel
     * @returns {string} ID unique
     */
    generateId(prefix = 'id') {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(2, 9);
        return `${prefix}_${timestamp}_${random}`;
    }
};

// Geler l'objet
Object.freeze(Formatter);

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Formatter;
}

if (typeof window !== 'undefined') {
    window.Formatter = Formatter;
}
window.Formatter = Formatter;