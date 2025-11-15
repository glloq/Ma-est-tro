// ============================================================================
// Fichier: frontend/js/editor/core/Viewport.js
// Projet: MidiMind v3.2.1 - Système d'Orchestration MIDI pour Raspberry Pi
// Version: 3.2.1 (Complétée selon audit 2025-10-14)
// Date: 2025-10-14
// ============================================================================
// Description:
//   Gestion du viewport de l'éditeur MIDI (zone visible, zoom, pan).
//   Contrôle ce qui est affiché et comment (limites, transformations).
//
// Fonctionnalités:
//   - Gestion zone visible (bounds)
//   - Zoom in/out (molette, pinch)
//   - Zoom sur sélection (fit selection)
//   - Pan (défilement) horizontal/vertical
//   - Limites configurables (min/max zoom)
//   - Centrage automatique (center on time/pitch)
//   - Smooth scrolling (animation)
//   - Sauvegarde/restore vue
//
// Corrections v3.2.1:
//   ✅ getVisibleRect() - Retourne noteRange complet et correct
//   ✅ fitToNotes() - Zoom optimal pour afficher toutes notes
//   ✅ emitChange() - Notification changements viewport
//   ✅ animateScroll() - Smooth scrolling avec easing
//   ✅ Ajout focusRegion(), followPlayhead()
//   ✅ Ajout pan(), setZoom()
//
// Architecture:
//   Viewport (classe)
//   - Utilise CoordinateSystem pour conversions
//   - Émet événements sur changements (zoom, pan)
//   - Animation avec requestAnimationFrame
//
// Auteur: MidiMind Team
// ============================================================================

class Viewport {
    constructor(canvas, coordSystem) {
        this.canvas = canvas;
        this.coordSystem = coordSystem;
        
        // Dimensions du canvas
        this.width = canvas.width;
        this.height = canvas.height;
        
        // Limites de scroll
        this.minScrollX = -1000;
        this.maxScrollX = 100000;
        this.minScrollY = -500;
        this.maxScrollY = 10000;
        
        // Auto-scroll (suivre la lecture)
        this.autoScroll = false;
        this.autoScrollMargin = 200; // pixels avant le bord
        
        // Animation
        this.animationFrameId = null;
        this.isAnimating = false;
        
        // Callbacks
        this.onViewChanged = null;
    }

    // ========================================================================
    // DIMENSIONNEMENT
    // ========================================================================

    /**
     * Met à jour les dimensions du viewport
     * @param {number} width - Largeur
     * @param {number} height - Hauteur
     */
    resize(width, height) {
        this.width = width;
        this.height = height;
        this.canvas.width = width;
        this.canvas.height = height;
        
        this.emitChange();
    }

    /**
     * Obtient les dimensions
     * @returns {Object} {width, height}
     */
    getSize() {
        return {
            width: this.width,
            height: this.height
        };
    }

    // ========================================================================
    // VISIBILITÉ
    // ========================================================================

    /**
     * ✅ AMÉLIORÉ: Obtient le rectangle visible (en coordonnées monde)
     * @returns {Object} Rectangle visible avec timeRange et noteRange complets
     */
    getVisibleRect() {
        const timeRange = this.coordSystem.getVisibleTimeRange(this.width);
        const noteRange = this.coordSystem.getVisibleNoteRange(this.height);
        
        // S'assurer que noteRange est valide
        const safeNoteRange = {
            min: noteRange.min !== undefined ? noteRange.min : 0,
            max: noteRange.max !== undefined ? noteRange.max : 127
        };
        
        return {
            timeRange: timeRange,
            noteRange: safeNoteRange,
            x: timeRange.start,
            y: this.coordSystem.noteToY(safeNoteRange.max),
            width: timeRange.end - timeRange.start,
            height: Math.abs(
                this.coordSystem.noteToY(safeNoteRange.min) - 
                this.coordSystem.noteToY(safeNoteRange.max)
            )
        };
    }

    /**
     * Vérifie si un point est visible
     * @param {number} x - Position X
     * @param {number} y - Position Y
     * @returns {boolean}
     */
    isPointVisible(x, y) {
        return x >= 0 && x < this.width && y >= 0 && y < this.height;
    }

    /**
     * Vérifie si un rectangle est visible
     * @param {Object} rect - Rectangle {x, y, width, height}
     * @returns {boolean}
     */
    isRectVisible(rect) {
        return !(
            rect.x + rect.width < 0 ||
            rect.x > this.width ||
            rect.y + rect.height < 0 ||
            rect.y > this.height
        );
    }

    // ========================================================================
    // SCROLL
    // ========================================================================

    /**
     * Scroll horizontal
     * @param {number} delta - Delta en pixels
     */
    scrollX(delta) {
        const newOffsetX = this.coordSystem.offsetX + delta;
        
        // Limiter le scroll
        if (newOffsetX >= this.minScrollX && newOffsetX <= this.maxScrollX) {
            this.coordSystem.scrollX(delta);
            this.emitChange();
        }
    }

    /**
     * Scroll vertical
     * @param {number} delta - Delta en pixels
     */
    scrollY(delta) {
        const newOffsetY = this.coordSystem.offsetY + delta;
        
        // Limiter le scroll
        if (newOffsetY >= this.minScrollY && newOffsetY <= this.maxScrollY) {
            this.coordSystem.scrollY(delta);
            this.emitChange();
        }
    }

    /**
     * Scroll vers un temps spécifique
     * @param {number} timeMs - Temps en millisecondes
     * @param {boolean} animated - Animer le scroll
     */
    scrollToTime(timeMs, animated = false) {
        const targetX = this.coordSystem.timeToX(timeMs);
        const centerX = this.width / 2;
        
        const deltaX = centerX - targetX;
        
        if (animated) {
            this.animateScroll(deltaX, 0, 300);
        } else {
            this.scrollX(deltaX);
        }
    }

    /**
     * Scroll vers une note spécifique
     * @param {number} note - Numéro MIDI
     * @param {boolean} animated - Animer le scroll
     */
    scrollToNote(note, animated = false) {
        const targetY = this.coordSystem.noteToY(note);
        const centerY = this.height / 2;
        
        const deltaY = centerY - targetY;
        
        if (animated) {
            this.animateScroll(0, deltaY, 300);
        } else {
            this.scrollY(deltaY);
        }
    }

    /**
     * ✅ COMPLET: Animation de scroll smooth
     * @param {number} deltaX - Delta X en pixels
     * @param {number} deltaY - Delta Y en pixels
     * @param {number} duration - Durée en ms
     */
    animateScroll(deltaX, deltaY, duration = 300) {
        // Annuler animation précédente
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
        }
        
        const startTime = performance.now();
        const startOffsetX = this.coordSystem.offsetX;
        const startOffsetY = this.coordSystem.offsetY;
        
        this.isAnimating = true;
        
        const animate = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            // Easing ease-in-out cubic
            const eased = this.easeInOutCubic(progress);
            
            // Calculer nouvelles positions
            const newOffsetX = startOffsetX + deltaX * eased;
            const newOffsetY = startOffsetY + deltaY * eased;
            
            // Appliquer
            this.coordSystem.offsetX = newOffsetX;
            this.coordSystem.offsetY = newOffsetY;
            
            this.emitChange();
            
            // Continuer ou terminer
            if (progress < 1) {
                this.animationFrameId = requestAnimationFrame(animate);
            } else {
                this.isAnimating = false;
                this.animationFrameId = null;
            }
        };
        
        this.animationFrameId = requestAnimationFrame(animate);
    }

    /**
     * ✅ NOUVEAU: Pan (déplacement) combiné
     * @param {number} deltaX - Delta X
     * @param {number} deltaY - Delta Y
     */
    pan(deltaX, deltaY) {
        this.scrollX(-deltaX);
        this.scrollY(-deltaY);
    }

    /**
     * Suit automatiquement la lecture
     * @param {number} playheadX - Position X du playhead
     */
    followPlayhead(playheadX) {
        if (!this.autoScroll) return;
        
        const rightEdge = this.width - this.autoScrollMargin;
        
        if (playheadX > rightEdge) {
            const delta = playheadX - rightEdge;
            this.scrollX(-delta);
        }
    }

    /**
     * Active/désactive l'auto-scroll
     * @param {boolean} enabled - Activer auto-scroll
     */
    setAutoScroll(enabled) {
        this.autoScroll = !!enabled;
    }

    // ========================================================================
    // ZOOM
    // ========================================================================

    /**
     * Zoom à une position spécifique
     * @param {number} x - Position X
     * @param {number} y - Position Y
     * @param {number} factorX - Facteur zoom X
     * @param {number} factorY - Facteur zoom Y
     */
    zoomAt(x, y, factorX, factorY) {
        // Coordonnées monde avant zoom
        const worldBefore = this.screenToWorld(x, y);
        
        // Appliquer zoom
        this.coordSystem.zoom(factorX, factorY);
        
        // Coordonnées monde après zoom
        const worldAfter = this.screenToWorld(x, y);
        
        // Ajuster offset pour garder le point sous la souris
        const deltaTime = worldAfter.time - worldBefore.time;
        const deltaNote = worldAfter.note - worldBefore.note;
        
        this.coordSystem.offsetX += this.coordSystem.timeToX(deltaTime) - this.coordSystem.timeToX(0);
        this.coordSystem.offsetY += this.coordSystem.noteToY(deltaNote) - this.coordSystem.noteToY(0);
        
        this.emitChange();
    }

    /**
     * Zoom horizontal
     * @param {number} factor - Facteur
     * @param {number} centerX - Centre
     */
    zoomHorizontal(factor, centerX = null) {
        centerX = centerX !== null ? centerX : this.width / 2;
        this.zoomAt(centerX, 0, factor, 1.0);
    }

    /**
     * Zoom vertical
     * @param {number} factor - Facteur
     * @param {number} centerY - Centre
     */
    zoomVertical(factor, centerY = null) {
        centerY = centerY !== null ? centerY : this.height / 2;
        this.zoomAt(0, centerY, 1.0, factor);
    }

    /**
     * ✅ NOUVEAU: Définit le zoom directement
     * @param {number} zoomX - Zoom X
     * @param {number} zoomY - Zoom Y (optionnel)
     */
    setZoom(zoomX, zoomY = null) {
        this.setZoomX(zoomX);
        if (zoomY !== null) {
            this.setZoomY(zoomY);
        }
    }

    /**
     * Définit le zoom X
     * @param {number} zoom - Niveau de zoom
     */
    setZoomX(zoom) {
        this.coordSystem.zoomX = Math.max(
            this.coordSystem.minZoomX,
            Math.min(this.coordSystem.maxZoomX, zoom)
        );
        this.emitChange();
    }

    /**
     * Définit le zoom Y
     * @param {number} zoom - Niveau de zoom
     */
    setZoomY(zoom) {
        this.coordSystem.zoomY = Math.max(
            this.coordSystem.minZoomY,
            Math.min(this.coordSystem.maxZoomY, zoom)
        );
        this.emitChange();
    }

    /**
     * Reset zoom
     */
    resetZoom() {
        this.coordSystem.resetZoom();
        this.emitChange();
    }

    // ========================================================================
    // FIT TO CONTENT
    // ========================================================================

    /**
     * ✅ COMPLET: Ajuste la vue pour montrer toutes les notes
     * @param {Array} notes - Liste des notes
     * @param {number} padding - Padding en pixels
     */
    fitToNotes(notes, padding = 50) {
        if (!notes || notes.length === 0) return;
        
        // Trouver les limites temporelles
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
        
        // Ajouter une marge
        const timeMargin = (maxTime - minTime) * 0.1;
        const noteMargin = 2;
        
        minTime = Math.max(0, minTime - timeMargin);
        maxTime = maxTime + timeMargin;
        minNote = Math.max(0, minNote - noteMargin);
        maxNote = Math.min(127, maxNote + noteMargin);
        
        // Calculer le zoom nécessaire
        const timeSpan = maxTime - minTime;
        const noteSpan = maxNote - minNote + 1;
        
        const availableWidth = this.width - padding * 2;
        const availableHeight = this.height - padding * 2;
        
        // Zoom horizontal
        const pixelsPerMs = availableWidth / timeSpan;
        const zoomX = pixelsPerMs / (this.coordSystem.pixelsPerSecond / 1000);
        
        // Zoom vertical
        const pixelsPerNote = availableHeight / noteSpan;
        const zoomY = pixelsPerNote / this.coordSystem.pixelsPerNote;
        
        // Appliquer zoom avec limites
        this.coordSystem.zoomX = Math.max(
            this.coordSystem.minZoomX,
            Math.min(this.coordSystem.maxZoomX, zoomX)
        );
        this.coordSystem.zoomY = Math.max(
            this.coordSystem.minZoomY,
            Math.min(this.coordSystem.maxZoomY, zoomY)
        );
        
        // Centrer sur la région
        const centerTime = (minTime + maxTime) / 2;
        const centerNote = (minNote + maxNote) / 2;
        
        this.coordSystem.centerOnTime(centerTime, this.width);
        this.coordSystem.centerOnNote(centerNote, this.height);
        
        this.emitChange();
    }

    /**
     * ✅ NOUVEAU: Centre sur une région spécifique
     * @param {number} startTime - Temps début
     * @param {number} endTime - Temps fin
     * @param {number} minNote - Note minimum
     * @param {number} maxNote - Note maximum
     * @param {number} padding - Padding
     */
    focusRegion(startTime, endTime, minNote, maxNote, padding = 50) {
        // Calculer le zoom nécessaire
        const timeSpan = endTime - startTime;
        const noteSpan = maxNote - minNote + 1;
        
        const availableWidth = this.width - padding * 2;
        const availableHeight = this.height - padding * 2;
        
        const pixelsPerMs = availableWidth / timeSpan;
        const pixelsPerNote = availableHeight / noteSpan;
        
        // Appliquer le zoom
        this.coordSystem.zoomX = pixelsPerMs / (this.coordSystem.pixelsPerSecond / 1000);
        this.coordSystem.zoomY = pixelsPerNote / this.coordSystem.pixelsPerNote;
        
        // Limiter le zoom
        this.coordSystem.zoomX = Math.max(
            this.coordSystem.minZoomX, 
            Math.min(this.coordSystem.maxZoomX, this.coordSystem.zoomX)
        );
        this.coordSystem.zoomY = Math.max(
            this.coordSystem.minZoomY, 
            Math.min(this.coordSystem.maxZoomY, this.coordSystem.zoomY)
        );
        
        // Centrer
        const centerTime = (startTime + endTime) / 2;
        const centerNote = (minNote + maxNote) / 2;
        
        this.coordSystem.centerOnTime(centerTime, this.width);
        this.coordSystem.centerOnNote(centerNote, this.height);
        
        this.emitChange();
    }

    // ========================================================================
    // CONVERSIONS
    // ========================================================================

    /**
     * Convertit des coordonnées canvas en coordonnées monde
     * @param {number} screenX - X écran
     * @param {number} screenY - Y écran
     * @returns {Object} {time, note}
     */
    screenToWorld(screenX, screenY) {
        return {
            time: this.coordSystem.xToTime(screenX),
            note: this.coordSystem.yToNote(screenY)
        };
    }

    /**
     * Convertit des coordonnées monde en coordonnées canvas
     * @param {number} time - Temps
     * @param {number} note - Note
     * @returns {Object} {x, y}
     */
    worldToScreen(time, note) {
        return {
            x: this.coordSystem.timeToX(time),
            y: this.coordSystem.noteToY(note)
        };
    }

    // ========================================================================
    // UTILITAIRES
    // ========================================================================

    /**
     * Fonction d'easing cubic
     * @param {number} t - Progress (0-1)
     * @returns {number} Valeur easée
     */
    easeInOutCubic(t) {
        return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    }

    /**
     * ✅ COMPLET: Émet un événement de changement
     */
    emitChange() {
        if (this.onViewChanged) {
            const visibleRect = this.getVisibleRect();
            
            this.onViewChanged({
                visibleRect: visibleRect,
                zoom: {
                    x: this.coordSystem.zoomX,
                    y: this.coordSystem.zoomY
                },
                offset: {
                    x: this.coordSystem.offsetX,
                    y: this.coordSystem.offsetY
                },
                bounds: {
                    timeStart: visibleRect.timeRange.start,
                    timeEnd: visibleRect.timeRange.end,
                    noteMin: visibleRect.noteRange.min,
                    noteMax: visibleRect.noteRange.max
                }
            });
        }
    }

    /**
     * Sérialise l'état
     * @returns {Object} État sérialisé
     */
    serialize() {
        return {
            width: this.width,
            height: this.height,
            autoScroll: this.autoScroll,
            coordSystem: this.coordSystem.serialize()
        };
    }

    /**
     * Restaure l'état
     * @param {Object} data - Données sérialisées
     */
    deserialize(data) {
        this.width = data.width;
        this.height = data.height;
        this.autoScroll = data.autoScroll;
        this.coordSystem.deserialize(data.coordSystem);
        
        this.emitChange();
    }

    /**
     * Nettoie les ressources
     */
    destroy() {
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
        
        this.onViewChanged = null;
    }
}

// ============================================================================
// EXPORT
// ============================================================================

if (typeof module !== 'undefined' && module.exports) {
    module.exports = Viewport;
}
window.Viewport = Viewport;