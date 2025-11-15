// ============================================================================
// Fichier: frontend/js/editor/renderers/GridRenderer.js
// Projet: MidiMind v3.2.1 - Système d'Orchestration MIDI pour Raspberry Pi
// Version: 3.2.1 (Complétée selon audit 2025-10-14) - SYNTAX FIXED
// Date: 2025-10-18
// ============================================================================
// CORRECTION: Ligne 389 - Espace supprimé dans nom de méthode
// ============================================================================

class GridRenderer {
    constructor(config = {}) {
        this.config = {
            showTimeGrid: true,
            showNoteLines: true,
            showMeasureNumbers: true,
            showSubdivisions: true,
            
            // Couleurs
            gridColor: config.gridColor || '#2a2a2a',
            gridColorMajor: config.gridColorMajor || '#3a3a3a',
            gridColorSubdivision: config.gridColorSubdivision || '#1a1a1a',
            noteLineColor: config.noteLineColor || '#1a1a1a',
            noteLineColorOctave: config.noteLineColorOctave || '#2a2a2a',
            measureNumberColor: config.measureNumberColor || '#4a4a4a',
            
            // Opacité
            gridOpacity: 0.5,
            noteLineOpacity: 0.3,
            subdivisionOpacity: 0.2,
            
            // Subdivisions
            subdivisions: [1, 2, 4, 8, 16, 32]
        };
        
        // Cache
        this.cache = {
            enabled: true,
            lastZoomX: null,
            lastZoomY: null,
            lastViewport: null,
            gridPattern: null
        };
    }

    // ========================================================================
    // RENDU PRINCIPAL
    // ========================================================================

    render(ctx, viewport, coordSystem, metadata = {}) {
        const visibleRect = viewport.getVisibleRect();
        
        if (this.config.showNoteLines) {
            this.renderNoteLines(ctx, visibleRect, coordSystem);
        }
        
        if (this.config.showTimeGrid) {
            this.renderTimeGrid(ctx, visibleRect, coordSystem, metadata);
        }
        
        if (this.config.showMeasureNumbers) {
            this.renderMeasureNumbers(ctx, visibleRect, coordSystem, metadata);
        }
    }

    // ========================================================================
    // LIGNES DE NOTES (horizontal)
    // ========================================================================

    renderNoteLines(ctx, visibleRect, coordSystem) {
        const noteRange = visibleRect.noteRange;
        
        if (!noteRange) return;
        
        ctx.save();
        ctx.globalAlpha = this.config.noteLineOpacity;
        
        for (let note = noteRange.min; note <= noteRange.max; note++) {
            const y = coordSystem.noteToY(note);
            const isC = (note % 12) === 0;
            
            ctx.strokeStyle = isC ? 
                this.config.noteLineColorOctave : 
                this.config.noteLineColor;
            ctx.lineWidth = isC ? 2 : 1;
            
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(visibleRect.width || 10000, y);
            ctx.stroke();
        }
        
        ctx.restore();
    }

    // ========================================================================
    // GRILLE TEMPORELLE (vertical)
    // ========================================================================

    renderTimeGrid(ctx, visibleRect, coordSystem, metadata) {
        const timeRange = visibleRect.timeRange;
        
        if (!timeRange) return;
        
        const gridInfo = this.calculateGridSpacing(coordSystem.zoomX, metadata);
        const startTime = Math.floor(timeRange.start / gridInfo.spacing) * gridInfo.spacing;
        
        ctx.save();
        
        if (this.config.showSubdivisions && gridInfo.showSubdivisions) {
            this.renderSubdivisions(ctx, timeRange, coordSystem, gridInfo, visibleRect.height);
        }
        
        ctx.globalAlpha = this.config.gridOpacity;
        
        for (let time = startTime; time <= timeRange.end; time += gridInfo.spacing) {
            const x = coordSystem.timeToX(time);
            const measureTime = gridInfo.spacing * gridInfo.beatsPerMeasure;
            const isMajor = (time % measureTime) === 0;
            
            ctx.strokeStyle = isMajor ? 
                this.config.gridColorMajor : 
                this.config.gridColor;
            ctx.lineWidth = isMajor ? 2 : 1;
            
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, visibleRect.height || 10000);
            ctx.stroke();
        }
        
        ctx.restore();
    }

    renderSubdivisions(ctx, timeRange, coordSystem, gridInfo, height) {
        const subdivisionSpacing = gridInfo.spacing / gridInfo.subdivision;
        const startTime = Math.floor(timeRange.start / subdivisionSpacing) * subdivisionSpacing;
        
        ctx.save();
        ctx.globalAlpha = this.config.subdivisionOpacity;
        ctx.strokeStyle = this.config.gridColorSubdivision;
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 4]);
        
        for (let time = startTime; time <= timeRange.end; time += subdivisionSpacing) {
            if (time % gridInfo.spacing === 0) continue;
            
            const x = coordSystem.timeToX(time);
            
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height || 10000);
            ctx.stroke();
        }
        
        ctx.setLineDash([]);
        ctx.restore();
    }

    renderMeasureNumbers(ctx, visibleRect, coordSystem, metadata) {
        const timeRange = visibleRect.timeRange;
        
        if (!timeRange) return;
        
        const gridInfo = this.calculateGridSpacing(coordSystem.zoomX, metadata);
        const measureTime = gridInfo.spacing * gridInfo.beatsPerMeasure;
        
        const startMeasure = Math.floor(timeRange.start / measureTime);
        const endMeasure = Math.ceil(timeRange.end / measureTime);
        
        ctx.save();
        ctx.fillStyle = this.config.measureNumberColor;
        ctx.font = '11px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        
        for (let measure = startMeasure; measure <= endMeasure; measure++) {
            const time = measure * measureTime;
            const x = coordSystem.timeToX(time);
            const measureNumber = measure + 1;
            
            ctx.fillText(measureNumber.toString(), x, 4);
        }
        
        ctx.restore();
    }

    // ========================================================================
    // CALCULS ADAPTATIFS
    // ========================================================================

    calculateGridSpacing(zoomX, metadata = {}) {
        const tempo = metadata.tempo || 120;
        const timeSignature = metadata.timeSignature || { numerator: 4, denominator: 4 };
        const beatsPerMeasure = timeSignature.numerator || 4;
        
        const beatDuration = (60000 / tempo);
        const pixelsPerSecond = 100 * zoomX;
        const pixelsPerBeat = (beatDuration / 1000) * pixelsPerSecond;
        
        let spacing = beatDuration;
        let subdivision = 1;
        let showSubdivisions = false;
        
        if (pixelsPerBeat > 200) {
            if (pixelsPerBeat > 400) {
                subdivision = 32;
                spacing = beatDuration;
                showSubdivisions = true;
            } else {
                subdivision = 16;
                spacing = beatDuration;
                showSubdivisions = true;
            }
        } else if (pixelsPerBeat > 100) {
            subdivision = 8;
            spacing = beatDuration;
            showSubdivisions = true;
        } else if (pixelsPerBeat > 50) {
            subdivision = 4;
            spacing = beatDuration;
            showSubdivisions = pixelsPerBeat > 70;
        } else if (pixelsPerBeat > 25) {
            spacing = beatDuration;
            subdivision = 1;
            showSubdivisions = false;
        } else {
            const measuresPerGroup = Math.ceil(50 / pixelsPerBeat);
            spacing = beatDuration * beatsPerMeasure * measuresPerGroup;
            subdivision = 1;
            showSubdivisions = false;
        }
        
        return {
            spacing,
            subdivision,
            showSubdivisions,
            beatsPerMeasure,
            beatDuration,
            pixelsPerBeat
        };
    }

    // ========================================================================
    // CACHE
    // ========================================================================

    isCacheValid(coordSystem) {
        if (!this.cache.enabled) return false;
        
        return (
            this.cache.lastZoomX === coordSystem.zoomX &&
            this.cache.lastZoomY === coordSystem.zoomY
        );
    }

    invalidateCache() {
        this.cache.gridPattern = null;
        this.cache.lastZoomX = null;
        this.cache.lastZoomY = null;
        this.cache.lastViewport = null;
    }

    updateCache(coordSystem) {
        this.cache.lastZoomX = coordSystem.zoomX;
        this.cache.lastZoomY = coordSystem.zoomY;
    }

    // ========================================================================
    // CONFIGURATION
    // ========================================================================

    setTimeGridVisible(visible) {
        this.config.showTimeGrid = visible;
    }

    // ✅ CORRECTION: Espace supprimé dans le nom de la méthode
    setNoteLinesVisible(visible) {
        this.config.showNoteLines = visible;
    }

    setSubdivisionsVisible(visible) {
        this.config.showSubdivisions = visible;
    }

    setMeasureNumbersVisible(visible) {
        this.config.showMeasureNumbers = visible;
    }

    setVisible(visible) {
        this.config.showTimeGrid = visible;
        this.config.showNoteLines = visible;
    }

    setConfig(options) {
        Object.assign(this.config, options);
        this.invalidateCache();
    }
}

// ============================================================================
// EXPORT
// ============================================================================

if (typeof module !== 'undefined' && module.exports) {
    module.exports = GridRenderer;
}
window.GridRenderer = GridRenderer;