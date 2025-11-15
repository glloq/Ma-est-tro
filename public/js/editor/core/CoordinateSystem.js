// ============================================================================
// Fichier: frontend/js/editor/core/CoordinateSystem.js
// Projet: MidiMind v3.0 - Système d'Orchestration MIDI pour Raspberry Pi
// Version: 3.0.0
// Date: 2025-10-14
// ============================================================================
// Description:
//   Système de coordonnées pour l'éditeur MIDI.
//   Gère les conversions bidirectionnelles entre pixels (écran) et 
//   unités MIDI (temps en ms, pitch en notes 0-127).
//
// Fonctionnalités:
//   - Conversion pixels ↔ temps (ms)
//   - Conversion pixels ↔ pitch (note 0-127)
//   - Prise en compte zoom horizontal/vertical
//   - Prise en compte offset (pan)
//   - Snap to grid (quantization temporelle)
//   - Calcul dimensions notes (width, height)
//   - Détection collisions notes
//
// Architecture:
//   CoordinateSystem (classe autonome)
//   - Configuration zoom/offset modifiable
//   - Calculs optimisés (cache)
//   - Support transformations CSS
//
// Auteur: MidiMind Team
// ============================================================================

class CoordinateSystem {
    constructor(config = {}) {
        // Configuration de base
        this.pixelsPerSecond = config.pixelsPerSecond || 100;
        this.pixelsPerNote = config.pixelsPerNote || 12;
        this.noteHeight = this.pixelsPerNote;
        
        // Plage de notes (21 = A0, 108 = C8)
        this.minNote = config.minNote || 21;
        this.maxNote = config.maxNote || 108;
        
        // Décalages (scroll)
        this.offsetX = config.offsetX || 0;
        this.offsetY = config.offsetY || 0;
        
        // Zoom
        this.zoomX = 1.0;
        this.zoomY = 1.0;
        
        // Limites
        this.minZoomX = 0.1;
        this.maxZoomX = 10.0;
        this.minZoomY = 0.5;
        this.maxZoomY = 3.0;
    }

    // ========================================================================
    // CONVERSIONS TEMPS (horizontal)
    // ========================================================================

    /**
     * Convertit un temps (ms) en position X (pixels)
     */
    timeToX(timeMs) {
        return (timeMs / 1000) * this.pixelsPerSecond * this.zoomX + this.offsetX;
    }

    /**
     * Convertit une position X (pixels) en temps (ms)
     */
    xToTime(x) {
        return ((x - this.offsetX) / (this.pixelsPerSecond * this.zoomX)) * 1000;
    }

    /**
     * Convertit une durée (ms) en largeur (pixels)
     */
    durationToWidth(durationMs) {
        return (durationMs / 1000) * this.pixelsPerSecond * this.zoomX;
    }

    /**
     * Convertit une largeur (pixels) en durée (ms)
     */
    widthToDuration(width) {
        return (width / (this.pixelsPerSecond * this.zoomX)) * 1000;
    }

    // ========================================================================
    // CONVERSIONS NOTES (vertical)
    // ========================================================================

    /**
     * Convertit un numéro de note MIDI en position Y (pixels)
     * Note: Y=0 en haut du canvas
     */
    noteToY(noteNumber) {
        const noteIndex = this.maxNote - noteNumber;
        return noteIndex * this.pixelsPerNote * this.zoomY + this.offsetY;
    }

    /**
     * Convertit une position Y (pixels) en numéro de note MIDI
     */
    yToNote(y) {
        const noteIndex = (y - this.offsetY) / (this.pixelsPerNote * this.zoomY);
        return Math.round(this.maxNote - noteIndex);
    }

    /**
     * Convertit une hauteur de note en pixels
     */
    noteHeight() {
        return this.pixelsPerNote * this.zoomY;
    }

    // ========================================================================
    // CONVERSIONS DE NOTES COMPLÈTES
    // ========================================================================

    /**
     * Convertit un objet note en rectangle de rendu
     * @param {Object} note - {time, duration, note, velocity}
     * @returns {Object} - {x, y, width, height}
     */
    noteToRect(note) {
        return {
            x: this.timeToX(note.time),
            y: this.noteToY(note.note),
            width: this.durationToWidth(note.duration),
            height: this.noteHeight()
        };
    }

    /**
     * Convertit un rectangle en objet note
     * @param {Object} rect - {x, y, width, height}
     * @returns {Object} - {time, duration, note}
     */
    rectToNote(rect) {
        return {
            time: this.xToTime(rect.x),
            duration: this.widthToDuration(rect.width),
            note: this.yToNote(rect.y)
        };
    }

    // ========================================================================
    // ZOOM
    // ========================================================================

    /**
     * Applique un zoom horizontal
     */
    setZoomX(zoom, centerX = null) {
        const oldZoom = this.zoomX;
        this.zoomX = Math.max(this.minZoomX, Math.min(this.maxZoomX, zoom));
        
        // Ajuster l'offset pour garder le point central fixe
        if (centerX !== null) {
            const ratio = this.zoomX / oldZoom;
            this.offsetX = centerX - (centerX - this.offsetX) * ratio;
        }
    }

    /**
     * Applique un zoom vertical
     */
    setZoomY(zoom, centerY = null) {
        const oldZoom = this.zoomY;
        this.zoomY = Math.max(this.minZoomY, Math.min(this.maxZoomY, zoom));
        
        // Ajuster l'offset pour garder le point central fixe
        if (centerY !== null) {
            const ratio = this.zoomY / oldZoom;
            this.offsetY = centerY - (centerY - this.offsetY) * ratio;
        }
    }

    /**
     * Zoom incrémental horizontal
     */
    zoomInX(factor = 1.2, centerX = null) {
        this.setZoomX(this.zoomX * factor, centerX);
    }

    zoomOutX(factor = 1.2, centerX = null) {
        this.setZoomX(this.zoomX / factor, centerX);
    }

    /**
     * Zoom incrémental vertical
     */
    zoomInY(factor = 1.2, centerY = null) {
        this.setZoomY(this.zoomY * factor, centerY);
    }

    zoomOutY(factor = 1.2, centerY = null) {
        this.setZoomY(this.zoomY / factor, centerY);
    }

    /**
     * Reset zoom
     */
    resetZoom() {
        this.zoomX = 1.0;
        this.zoomY = 1.0;
    }

    // ========================================================================
    // SCROLL / OFFSET
    // ========================================================================

    /**
     * Déplace le viewport
     */
    pan(deltaX, deltaY) {
        this.offsetX += deltaX;
        this.offsetY += deltaY;
    }

    /**
     * Scroll horizontal
     */
    scrollX(delta) {
        this.offsetX += delta;
    }

    /**
     * Scroll vertical
     */
    scrollY(delta) {
        this.offsetY += delta;
    }

    /**
     * Centre sur une note spécifique
     */
    centerOnNote(noteNumber, canvasHeight) {
        const targetY = this.noteToY(noteNumber);
        this.offsetY = canvasHeight / 2 - targetY;
    }

    /**
     * Centre sur un temps spécifique
     */
    centerOnTime(timeMs, canvasWidth) {
        const targetX = this.timeToX(timeMs);
        this.offsetX = canvasWidth / 2 - targetX;
    }

    // ========================================================================
    // FIT TO CONTENT
    // ========================================================================

    /**
     * Ajuste le zoom pour afficher toutes les notes
     */
    fitToNotes(notes, canvasWidth, canvasHeight, padding = 50) {
        if (!notes || notes.length === 0) return;

        // Trouver les limites
        let minTime = Infinity;
        let maxTime = -Infinity;
        let minNote = Infinity;
        let maxNote = -Infinity;

        notes.forEach(note => {
            minTime = Math.min(minTime, note.time);
            maxTime = Math.max(maxTime, note.time + note.duration);
            minNote = Math.min(minNote, note.note);
            maxNote = Math.max(maxNote, note.note);
        });

        // Calculer le zoom nécessaire
        const contentWidth = (maxTime - minTime) / 1000 * this.pixelsPerSecond;
        const contentHeight = (maxNote - minNote + 1) * this.pixelsPerNote;

        const availableWidth = canvasWidth - padding * 2;
        const availableHeight = canvasHeight - padding * 2;

        this.zoomX = availableWidth / contentWidth;
        this.zoomY = availableHeight / contentHeight;

        // Limiter le zoom
        this.zoomX = Math.max(this.minZoomX, Math.min(this.maxZoomX, this.zoomX));
        this.zoomY = Math.max(this.minZoomY, Math.min(this.maxZoomY, this.zoomY));

        // Centrer
        this.offsetX = padding - this.timeToX(minTime) + (availableWidth - contentWidth * this.zoomX) / 2;
        this.offsetY = padding - this.noteToY(maxNote) + (availableHeight - contentHeight * this.zoomY) / 2;
    }

    // ========================================================================
    // VISIBILITÉ
    // ========================================================================

    /**
     * Vérifie si une note est visible dans le viewport
     */
    isNoteVisible(note, canvasWidth, canvasHeight) {
        const rect = this.noteToRect(note);
        
        return !(
            rect.x + rect.width < 0 ||
            rect.x > canvasWidth ||
            rect.y + rect.height < 0 ||
            rect.y > canvasHeight
        );
    }

    /**
     * Obtient la plage de notes visibles
     */
    getVisibleNoteRange(canvasHeight) {
        const topNote = this.yToNote(0);
        const bottomNote = this.yToNote(canvasHeight);
        
        return {
            min: Math.max(this.minNote, Math.floor(bottomNote)),
            max: Math.min(this.maxNote, Math.ceil(topNote))
        };
    }

    /**
     * Obtient la plage de temps visible
     */
    getVisibleTimeRange(canvasWidth) {
        return {
            start: Math.max(0, this.xToTime(0)),
            end: this.xToTime(canvasWidth)
        };
    }

    // ========================================================================
    // SNAPPING / GRID
    // ========================================================================

    /**
     * Snap un temps à la grille
     */
    snapTimeToGrid(timeMs, gridSize = 100) {
        return Math.round(timeMs / gridSize) * gridSize;
    }

    /**
     * Snap une position X à la grille temporelle
     */
    snapXToGrid(x, gridSize = 100) {
        const time = this.xToTime(x);
        const snappedTime = this.snapTimeToGrid(time, gridSize);
        return this.timeToX(snappedTime);
    }

    /**
     * Snap une note MIDI à la note la plus proche
     */
    snapToNote(noteFloat) {
        return Math.round(noteFloat);
    }

    /**
     * Snap une position Y à la note la plus proche
     */
    snapYToNote(y) {
        const note = this.yToNote(y);
        return this.noteToY(Math.round(note));
    }

    // ========================================================================
    // UTILITAIRES
    // ========================================================================

    /**
     * Clone le système de coordonnées
     */
    clone() {
        const cloned = new CoordinateSystem({
            pixelsPerSecond: this.pixelsPerSecond,
            pixelsPerNote: this.pixelsPerNote,
            minNote: this.minNote,
            maxNote: this.maxNote,
            offsetX: this.offsetX,
            offsetY: this.offsetY
        });
        
        cloned.zoomX = this.zoomX;
        cloned.zoomY = this.zoomY;
        
        return cloned;
    }

    /**
     * Sérialise l'état
     */
    serialize() {
        return {
            pixelsPerSecond: this.pixelsPerSecond,
            pixelsPerNote: this.pixelsPerNote,
            minNote: this.minNote,
            maxNote: this.maxNote,
            offsetX: this.offsetX,
            offsetY: this.offsetY,
            zoomX: this.zoomX,
            zoomY: this.zoomY
        };
    }

    /**
     * Restaure l'état
     */
    deserialize(data) {
        Object.assign(this, data);
    }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CoordinateSystem;

}
window.CoordinateSystem = CoordinateSystem;