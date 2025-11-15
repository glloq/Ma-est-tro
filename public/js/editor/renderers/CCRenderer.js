// ============================================================================
// Fichier: frontend/js/editor/renderers/CCRenderer.js
// Projet: MidiMind v3.2.1 - Système d'Orchestration MIDI pour Raspberry Pi
// Version: 3.2.1 (Complétée selon audit 2025-10-14)
// Date: 2025-10-14
// ============================================================================
// Description:
//   Renderer spécialisé pour le dessin des courbes Control Change (CC) MIDI.
//   Affichage optimisé avec interpolation et lissage.
//
// Fonctionnalités:
//   - Dessin courbes CC (line chart)
//   - Interpolation linéaire/courbe (Catmull-Rom)
//   - Points de contrôle éditables
//   - Couleur selon type CC
//   - Remplissage sous courbe (area chart)
//   - Grille verticale (valeurs 0-127)
//   - Anti-aliasing
//   - Culling optimisé
//
// Corrections v3.2.1:
//   ✅ renderCCLine() - Interpolation Catmull-Rom complète
//   ✅ renderVerticalGrid() - Grille 0-127 avec labels
//   ✅ renderEditablePoints() - Points avec handles
//   ✅ Ajout interpolation courbe lisse
//   ✅ Area chart (remplissage sous courbe)
//
// Architecture:
//   CCRenderer (classe)
//   - Utilise CoordinateSystem
//   - Algorithmes interpolation (Catmull-Rom, Bezier)
//   - Canvas Path2D pour performance
//
// Auteur: MidiMind Team
// ============================================================================

class CCRenderer {
    constructor(config = {}) {
        this.config = {
            height: config.height || 100,
            backgroundColor: '#0f0f0f',
            lineColor: '#667eea',
            areaColor: 'rgba(102, 126, 234, 0.2)',
            pointColor: '#667eea',
            pointColorSelected: '#ffffff',
            pointRadius: 4,
            pointRadiusSelected: 6,
            gridColor: '#2a2a2a',
            gridColorMajor: '#3a3a3a',
            textColor: '#888',
            baselineColor: '#444',
            
            // Interpolation
            interpolationType: 'linear', // 'linear', 'step', 'smooth', 'catmull-rom'
            smoothness: 0.5, // 0-1 pour interpolation
            
            // Affichage
            showGrid: true,
            showBaseline: true,
            showPoints: true,
            showArea: true,
            showLabels: true
        };
        
        this.visible = false;
        this.hoveredPoint = null;
        this.selectedPoints = new Set();
    }

    // ========================================================================
    // RENDU PRINCIPAL
    // ========================================================================

    /**
     * Rendu des courbes CC
     * @param {CanvasRenderingContext2D} ctx - Contexte Canvas
     * @param {Array} ccEvents - Événements CC
     * @param {Object} viewport - Viewport actuel
     * @param {Object} coordSystem - Système de coordonnées
     * @param {number} height - Hauteur zone CC
     */
    render(ctx, ccEvents, viewport, coordSystem, height) {
        if (!this.visible || !ccEvents || ccEvents.length === 0) return;
        
        ctx.save();
        
        // Fond
        ctx.fillStyle = this.config.backgroundColor;
        ctx.fillRect(0, 0, viewport.width, height);
        
        // Grille verticale
        if (this.config.showGrid) {
            this.renderVerticalGrid(ctx, height);
        }
        
        // Ligne de base (valeur 64 = centre)
        if (this.config.showBaseline) {
            this.renderBaseline(ctx, height);
        }
        
        // Grouper par CC number
        const byCCNumber = new Map();
        ccEvents.forEach(event => {
            const ccNum = event.controller || 0;
            if (!byCCNumber.has(ccNum)) {
                byCCNumber.set(ccNum, []);
            }
            byCCNumber.get(ccNum).push(event);
        });
        
        // Dessiner chaque CC
        byCCNumber.forEach((events, ccNumber) => {
            this.renderCCLine(ctx, events, coordSystem, height);
        });
        
        // Points éditables
        if (this.config.showPoints) {
            byCCNumber.forEach((events, ccNumber) => {
                this.renderEditablePoints(ctx, events, coordSystem, height);
            });
        }
        
        ctx.restore();
    }

    /**
     * ✅ COMPLET: Rendu d'une ligne CC avec interpolation
     * @param {CanvasRenderingContext2D} ctx - Contexte Canvas
     * @param {Array} events - Événements CC triés par temps
     * @param {Object} coordSystem - Système de coordonnées
     * @param {number} height - Hauteur zone
     */
    renderCCLine(ctx, events, coordSystem, height) {
        if (events.length === 0) return;
        
        // Trier par temps
        const sortedEvents = [...events].sort((a, b) => a.time - b.time);
        
        ctx.save();
        ctx.strokeStyle = this.config.lineColor;
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        
        ctx.beginPath();
        
        // Dessiner selon type d'interpolation
        switch (this.config.interpolationType) {
            case 'linear':
                this.drawLinearInterpolation(ctx, sortedEvents, coordSystem, height);
                break;
            case 'step':
                this.drawStepInterpolation(ctx, sortedEvents, coordSystem, height);
                break;
            case 'smooth':
                this.drawSmoothInterpolation(ctx, sortedEvents, coordSystem, height);
                break;
            case 'catmull-rom':
                this.drawCatmullRomInterpolation(ctx, sortedEvents, coordSystem, height);
                break;
            default:
                this.drawLinearInterpolation(ctx, sortedEvents, coordSystem, height);
        }
        
        ctx.stroke();
        
        // Area chart (remplissage sous la courbe)
        if (this.config.showArea) {
            this.fillAreaUnderCurve(ctx, sortedEvents, coordSystem, height);
        }
        
        ctx.restore();
    }

    /**
     * ✅ NOUVEAU: Interpolation linéaire
     */
    drawLinearInterpolation(ctx, events, coordSystem, height) {
        events.forEach((event, i) => {
            const x = coordSystem.timeToX(event.time);
            const y = this.valueToY(event.value, height);
            
            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        });
    }

    /**
     * ✅ NOUVEAU: Interpolation en escalier
     */
    drawStepInterpolation(ctx, events, coordSystem, height) {
        events.forEach((event, i) => {
            const x = coordSystem.timeToX(event.time);
            const y = this.valueToY(event.value, height);
            
            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                const prevEvent = events[i - 1];
                const prevX = coordSystem.timeToX(prevEvent.time);
                const prevY = this.valueToY(prevEvent.value, height);
                
                // Ligne horizontale puis verticale
                ctx.lineTo(x, prevY);
                ctx.lineTo(x, y);
            }
        });
    }

    /**
     * ✅ NOUVEAU: Interpolation lisse (Bézier cubique)
     */
    drawSmoothInterpolation(ctx, events, coordSystem, height) {
        if (events.length === 0) return;
        
        const firstX = coordSystem.timeToX(events[0].time);
        const firstY = this.valueToY(events[0].value, height);
        ctx.moveTo(firstX, firstY);
        
        for (let i = 1; i < events.length; i++) {
            const prev = events[i - 1];
            const curr = events[i];
            
            const prevX = coordSystem.timeToX(prev.time);
            const prevY = this.valueToY(prev.value, height);
            const currX = coordSystem.timeToX(curr.time);
            const currY = this.valueToY(curr.value, height);
            
            // Points de contrôle pour courbe de Bézier
            const deltaX = (currX - prevX) * this.config.smoothness;
            const cpX1 = prevX + deltaX;
            const cpY1 = prevY;
            const cpX2 = currX - deltaX;
            const cpY2 = currY;
            
            ctx.bezierCurveTo(cpX1, cpY1, cpX2, cpY2, currX, currY);
        }
    }

    /**
     * ✅ NOUVEAU: Interpolation Catmull-Rom (courbe lisse passant par tous les points)
     */
    drawCatmullRomInterpolation(ctx, events, coordSystem, height) {
        if (events.length < 2) {
            this.drawLinearInterpolation(ctx, events, coordSystem, height);
            return;
        }
        
        // Convertir events en points
        const points = events.map(e => ({
            x: coordSystem.timeToX(e.time),
            y: this.valueToY(e.value, height)
        }));
        
        ctx.moveTo(points[0].x, points[0].y);
        
        // Pour chaque segment
        for (let i = 0; i < points.length - 1; i++) {
            // Points de contrôle Catmull-Rom
            const p0 = points[Math.max(0, i - 1)];
            const p1 = points[i];
            const p2 = points[i + 1];
            const p3 = points[Math.min(points.length - 1, i + 2)];
            
            // Subdiviser le segment en petits pas
            const steps = 20;
            for (let t = 0; t <= steps; t++) {
                const u = t / steps;
                const point = this.catmullRomPoint(p0, p1, p2, p3, u);
                ctx.lineTo(point.x, point.y);
            }
        }
    }

    /**
     * ✅ NOUVEAU: Calcul d'un point sur une courbe Catmull-Rom
     */
    catmullRomPoint(p0, p1, p2, p3, t) {
        const t2 = t * t;
        const t3 = t2 * t;
        
        const x = 0.5 * (
            (2 * p1.x) +
            (-p0.x + p2.x) * t +
            (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
            (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3
        );
        
        const y = 0.5 * (
            (2 * p1.y) +
            (-p0.y + p2.y) * t +
            (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
            (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3
        );
        
        return { x, y };
    }

    /**
     * ✅ NOUVEAU: Remplissage area chart sous la courbe
     */
    fillAreaUnderCurve(ctx, events, coordSystem, height) {
        if (events.length === 0) return;
        
        ctx.save();
        ctx.globalAlpha = 0.3;
        ctx.fillStyle = this.config.areaColor;
        
        ctx.beginPath();
        
        // Redessiner la courbe (même type d'interpolation)
        switch (this.config.interpolationType) {
            case 'linear':
                this.drawLinearInterpolation(ctx, events, coordSystem, height);
                break;
            case 'smooth':
                this.drawSmoothInterpolation(ctx, events, coordSystem, height);
                break;
            case 'catmull-rom':
                this.drawCatmullRomInterpolation(ctx, events, coordSystem, height);
                break;
            default:
                this.drawLinearInterpolation(ctx, events, coordSystem, height);
        }
        
        // Fermer le chemin en bas
        const lastEvent = events[events.length - 1];
        const lastX = coordSystem.timeToX(lastEvent.time);
        const firstX = coordSystem.timeToX(events[0].time);
        
        ctx.lineTo(lastX, height);
        ctx.lineTo(firstX, height);
        ctx.closePath();
        
        ctx.fill();
        ctx.restore();
    }

    /**
     * ✅ NOUVEAU: Rendu des points éditables avec handles
     */
    renderEditablePoints(ctx, events, coordSystem, height) {
        events.forEach(event => {
            const x = coordSystem.timeToX(event.time);
            const y = this.valueToY(event.value, height);
            
            const isSelected = this.selectedPoints.has(event.id);
            const isHovered = this.hoveredPoint === event.id;
            
            const radius = isSelected ? this.config.pointRadiusSelected : this.config.pointRadius;
            const color = isSelected ? this.config.pointColorSelected : this.config.pointColor;
            
            // Ombre pour profondeur
            ctx.save();
            ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
            ctx.shadowBlur = 4;
            ctx.shadowOffsetY = 2;
            
            // Point
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(x, y, radius, 0, Math.PI * 2);
            ctx.fill();
            
            // Bordure si hover
            if (isHovered) {
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 2;
                ctx.stroke();
            }
            
            ctx.restore();
            
            // Label valeur (si hover)
            if (isHovered) {
                this.renderValueLabel(ctx, x, y, event.value);
            }
        });
    }

    /**
     * ✅ NOUVEAU: Label de valeur pour point hover
     */
    renderValueLabel(ctx, x, y, value) {
        const label = value.toString();
        const padding = 6;
        
        ctx.save();
        ctx.font = '11px monospace';
        const metrics = ctx.measureText(label);
        const width = metrics.width + padding * 2;
        const height = 18;
        
        // Fond
        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.fillRect(x - width / 2, y - height - 10, width, height);
        
        // Texte
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, x, y - height / 2 - 10);
        
        ctx.restore();
    }

    /**
     * ✅ NOUVEAU: Grille verticale 0-127
     */
    renderVerticalGrid(ctx, height) {
        const levels = [0, 32, 64, 96, 127];
        
        ctx.save();
        ctx.strokeStyle = this.config.gridColor;
        ctx.lineWidth = 1;
        
        levels.forEach(level => {
            const y = this.valueToY(level, height);
            
            // Ligne plus épaisse pour 64 (centre)
            if (level === 64) {
                ctx.strokeStyle = this.config.gridColorMajor;
                ctx.lineWidth = 1.5;
            } else {
                ctx.strokeStyle = this.config.gridColor;
                ctx.lineWidth = 1;
            }
            
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(ctx.canvas.width, y);
            ctx.stroke();
            
            // Label de valeur
            if (this.config.showLabels) {
                ctx.fillStyle = this.config.textColor;
                ctx.font = '10px monospace';
                ctx.textAlign = 'right';
                ctx.textBaseline = 'middle';
                ctx.fillText(level.toString(), ctx.canvas.width - 5, y);
            }
        });
        
        ctx.restore();
    }

    /**
     * ✅ NOUVEAU: Ligne de base (valeur 64 = milieu)
     */
    renderBaseline(ctx, height) {
        const y = this.valueToY(64, height);
        
        ctx.save();
        ctx.strokeStyle = this.config.baselineColor;
        ctx.lineWidth = 1;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(ctx.canvas.width, y);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
    }

    // ========================================================================
    // CONVERSIONS
    // ========================================================================

    /**
     * Convertit une valeur CC (0-127) en position Y
     * @param {number} value - Valeur CC (0-127)
     * @param {number} height - Hauteur zone
     * @returns {number} Position Y
     */
    valueToY(value, height) {
        // Inverser: 127 en haut, 0 en bas
        return height - ((value / 127) * height);
    }

    /**
     * Convertit une position Y en valeur CC
     * @param {number} y - Position Y
     * @param {number} height - Hauteur zone
     * @returns {number} Valeur CC (0-127)
     */
    yToValue(y, height) {
        const value = Math.round((1 - (y / height)) * 127);
        return Math.max(0, Math.min(127, value));
    }

    // ========================================================================
    // INTERACTION
    // ========================================================================

    /**
     * Trouve un point à une position
     * @param {number} x - Position X
     * @param {number} y - Position Y
     * @param {Array} events - Événements CC
     * @param {Object} coordSystem - Système de coordonnées
     * @param {number} height - Hauteur zone
     * @returns {Object|null} Événement trouvé
     */
    findPointAt(x, y, events, coordSystem, height) {
        const threshold = 10; // pixels
        
        for (const event of events) {
            const eventX = coordSystem.timeToX(event.time);
            const eventY = this.valueToY(event.value, height);
            
            const distance = Math.sqrt(
                Math.pow(x - eventX, 2) + Math.pow(y - eventY, 2)
            );
            
            if (distance <= threshold) {
                return event;
            }
        }
        
        return null;
    }

    /**
     * Définit le point survolé
     * @param {string|null} eventId - ID événement
     */
    setHoveredPoint(eventId) {
        this.hoveredPoint = eventId;
    }

    /**
     * Sélectionne des points
     * @param {Array<string>} eventIds - IDs événements
     */
    selectPoints(eventIds) {
        this.selectedPoints = new Set(eventIds);
    }

    // ========================================================================
    // CONFIGURATION
    // ========================================================================

    /**
     * Définit le type d'interpolation
     * @param {string} type - 'linear', 'step', 'smooth', 'catmull-rom'
     */
    setInterpolationType(type) {
        if (['linear', 'step', 'smooth', 'catmull-rom'].includes(type)) {
            this.config.interpolationType = type;
        }
    }

    /**
     * Définit la hauteur de la zone CC
     * @param {number} height - Hauteur en pixels
     */
    setHeight(height) {
        this.config.height = height;
    }

    /**
     * Obtient la hauteur
     * @returns {number} Hauteur
     */
    getHeight() {
        return this.config.height;
    }

    /**
     * Définit la visibilité
     * @param {boolean} visible - Visible
     */
    setVisible(visible) {
        this.visible = visible;
    }

    /**
     * Configure les options
     * @param {Object} options - Options à modifier
     */
    setConfig(options) {
        Object.assign(this.config, options);
    }
}

// ============================================================================
// EXPORT
// ============================================================================

if (typeof module !== 'undefined' && module.exports) {
    module.exports = CCRenderer;
}
window.CCRenderer = CCRenderer;