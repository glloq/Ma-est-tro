// ============================================================================
// Fichier: frontend/js/editor/renderers/TimelineRenderer.js
// Version: v3.1.0 - PERFORMANCE OPTIMIZED
// Date: 2025-10-16
// Projet: MidiMind v3.0 - Système d'Orchestration MIDI
// ============================================================================
// MODIFICATIONS v3.1.0:
// ✓ Pas d'animations (marqueurs statiques uniquement)
// ✓ Rendering simplifié
// ============================================================================

class TimelineRenderer {
    constructor(coordSystem) {
        this.coordSystem = coordSystem;
        
        // Configuration (OPTIMISÉ)
        this.config = {
            height: 30,
            enableAnimations: PerformanceConfig.rendering.enableAnimations || false  // ✓ DÉSACTIVÉ
        };
        
        // Couleurs
        this.colors = {
            background: '#2c3e50',
            text: '#ecf0f1',
            majorTick: '#95A5A6',
            minorTick: '#7f8c8d',
            playhead: '#FF6B6B',
            marker: '#FFD93D'
        };
        
        // État
        this.playheadPosition = 0;
        this.markers = [];
    }
    
    // ========================================================================
    // RENDERING PRINCIPAL
    // ========================================================================
    
    render(ctx, viewport, metadata) {
        ctx.save();
        
        // Background
        ctx.fillStyle = this.colors.background;
        ctx.fillRect(0, 0, ctx.canvas.width, this.config.height);
        
        // ✓ RENDERING SIMPLE : pas d'animations
        this.renderStaticMarkers(ctx, viewport, metadata);
        
        // Playhead (si lecture)
        if (this.playheadPosition > 0) {
            this.renderPlayhead(ctx, viewport);
        }
        
        ctx.restore();
    }
    
    // ========================================================================
    // MARQUEURS DE TEMPS (STATIQUES)
    // ========================================================================
    
    renderStaticMarkers(ctx, viewport, metadata) {
        const division = metadata?.division || 480;
        const tempo = metadata?.tempo || 500000;
        
        // Calculer intervalle des marqueurs selon zoom
        const range = viewport.endTime - viewport.startTime;
        let tickInterval;
        
        if (range > 50000) {
            tickInterval = division * 4;  // Mesures
        } else if (range > 20000) {
            tickInterval = division;  // Beats
        } else {
            tickInterval = division / 4;  // 1/4 beats
        }
        
        // Dessiner ticks
        for (let time = 0; time <= viewport.endTime; time += tickInterval) {
            if (time < viewport.startTime) continue;
            
            const x = this.coordSystem.timeToX(time);
            const isMajor = time % (division * 4) === 0;
            
            // Ligne
            ctx.strokeStyle = isMajor ? this.colors.majorTick : this.colors.minorTick;
            ctx.lineWidth = isMajor ? 2 : 1;
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, isMajor ? this.config.height : this.config.height / 2);
            ctx.stroke();
            
            // Label (seulement majeurs)
            if (isMajor) {
                const measure = Math.floor(time / (division * 4)) + 1;
                ctx.fillStyle = this.colors.text;
                ctx.font = '11px sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText(`${measure}`, x, this.config.height - 5);
            }
        }
    }
    
    // ========================================================================
    // PLAYHEAD
    // ========================================================================
    
    renderPlayhead(ctx, viewport) {
        const x = this.coordSystem.timeToX(this.playheadPosition);
        
        // Ligne verticale
        ctx.strokeStyle = this.colors.playhead;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, this.config.height);
        ctx.stroke();
        
        // Triangle en haut
        ctx.fillStyle = this.colors.playhead;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x - 5, 10);
        ctx.lineTo(x + 5, 10);
        ctx.closePath();
        ctx.fill();
    }
    
    setPlayheadPosition(time) {
        this.playheadPosition = time;
    }
    
    // ========================================================================
    // MARQUEURS PERSONNALISÉS
    // ========================================================================
    
    addMarker(time, label, color) {
        this.markers.push({
            time,
            label,
            color: color || this.colors.marker
        });
    }
    
    removeMarker(time) {
        this.markers = this.markers.filter(m => m.time !== time);
    }
    
    clearMarkers() {
        this.markers = [];
    }
    
    renderMarkers(ctx, viewport) {
        if (this.markers.length === 0) return;
        
        ctx.save();
        
        this.markers.forEach(marker => {
            if (marker.time < viewport.startTime || marker.time > viewport.endTime) {
                return;
            }
            
            const x = this.coordSystem.timeToX(marker.time);
            
            // Ligne
            ctx.strokeStyle = marker.color;
            ctx.lineWidth = 2;
            ctx.setLineDash([5, 3]);
            ctx.beginPath();
            ctx.moveTo(x, this.config.height);
            ctx.lineTo(x, ctx.canvas.height);
            ctx.stroke();
            ctx.setLineDash([]);
            
            // Label
            if (marker.label) {
                ctx.fillStyle = marker.color;
                ctx.font = 'bold 11px sans-serif';
                ctx.textAlign = 'left';
                ctx.fillText(marker.label, x + 3, this.config.height + 15);
            }
        });
        
        ctx.restore();
    }
    
    // ========================================================================
    // TEMPS → FORMAT LISIBLE
    // ========================================================================
    
    formatTime(time, division = 480) {
        const totalBeats = time / division;
        const measures = Math.floor(totalBeats / 4) + 1;
        const beats = Math.floor(totalBeats % 4) + 1;
        const ticks = time % division;
        
        return `${measures}:${beats}:${ticks.toString().padStart(3, '0')}`;
    }
    
    formatTimeSMPTE(time, fps = 30) {
        const totalSeconds = time / 1000;
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = Math.floor(totalSeconds % 60);
        const frames = Math.floor((totalSeconds % 1) * fps);
        
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}:${frames.toString().padStart(2, '0')}`;
    }
    
    // ========================================================================
    // HIT DETECTION
    // ========================================================================
    
    getTimeAtPosition(x) {
        return this.coordSystem.xToTime(x);
    }
    
    getMarkerAtPosition(x, viewport, tolerance = 5) {
        const time = this.getTimeAtPosition(x);
        
        return this.markers.find(marker => {
            const markerX = this.coordSystem.timeToX(marker.time);
            return Math.abs(markerX - x) <= tolerance;
        });
    }
    
    // ========================================================================
    // CONFIGURATION
    // ========================================================================
    
    setHeight(height) {
        this.config.height = height;
    }
    
    setColors(colors) {
        this.colors = { ...this.colors, ...colors };
    }
    
    getHeight() {
        return this.config.height;
    }
}

// ============================================================================
// EXPORT
// ============================================================================

if (typeof module !== 'undefined' && module.exports) {
    module.exports = TimelineRenderer;
}

if (typeof window !== 'undefined') {
    window.TimelineRenderer = TimelineRenderer;
}
window.TimelineRenderer = TimelineRenderer;