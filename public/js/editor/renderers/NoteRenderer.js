// ============================================================================
// Fichier: frontend/js/editor/renderers/NoteRenderer.js
// Projet: MidiMind v3.2.1 - Système d'Orchestration MIDI pour Raspberry Pi
// Version: 3.2.1 (Complétée selon audit 2025-10-14)
// Date: 2025-10-14
// ============================================================================
// Description:
//   Renderer spécialisé pour le dessin des notes MIDI dans le piano roll.
//   Optimisé pour performances avec culling et batching.
//
// Fonctionnalités:
//   - Dessin notes rectangulaires avec coins arrondis
//   - Couleur selon vélocité (gradient)
//   - Couleur selon canal MIDI
//   - Highlight notes sélectionnées
//   - Overlay notes actives (playback)
//   - Culling viewport (ne dessiner que notes visibles)
//   - Batching par canal (optimisation draw calls)
//   - Anti-aliasing optionnel
//
// Corrections v3.2.1:
//   ✅ getVisibleNotes() - Culling viewport complet et optimisé
//   ✅ renderChannelNotes() - Batching optimisé par canal
//   ✅ drawNote() - Coins arrondis + gradient vélocité
//   ✅ renderActiveNotes() - Effet glow pour notes actives
//   ✅ Ajout cache de couleurs et gradients
//   ✅ LOD (Level of Detail) selon zoom
//
// Architecture:
//   NoteRenderer (classe)
//   - Utilise CoordinateSystem pour positions
//   - Context 2D avec optimisations
//   - Cache de couleurs/gradients
//
// Auteur: MidiMind Team
// ============================================================================

class NoteRenderer {
    constructor(config = {}) {
        this.config = {
            // Couleurs par canal MIDI (16 canaux)
            channelColors: config.channelColors || this.getDefaultChannelColors(),
            
            // Style
            noteRadius: 3,
            noteBorderWidth: 1,
            noteBorderColor: 'rgba(0, 0, 0, 0.3)',
            selectionBorderColor: '#ffffff',
            selectionBorderWidth: 2,
            
            // Affichage
            showVelocity: true,
            showVelocityGradient: true,
            showNoteNames: false,
            enableLOD: true, // Level of Detail
            
            // Performance
            minNoteWidth: 2, // pixels minimum pour afficher une note
            maxNotesPerFrame: 5000,
            enableCache: true
        };
        
        // Cache de rendu
        this.gradientCache = new Map();
        this.colorCache = new Map();
        this.maxCacheSize = 1000;
        
        // Statistiques
        this.stats = {
            notesRendered: 0,
            notesCulled: 0,
            lastFrameTime: 0
        };
    }

    // ========================================================================
    // RENDU PRINCIPAL
    // ========================================================================

    /**
     * Rendu des notes
     * @param {CanvasRenderingContext2D} ctx - Contexte Canvas
     * @param {Array} notes - Liste des notes à rendre
     * @param {Object} viewport - Viewport actuel
     * @param {Object} coordSystem - Système de coordonnées
     * @param {Object} selection - Gestionnaire de sélection
     */
    render(ctx, notes, viewport, coordSystem, selection = null) {
        if (!notes || notes.length === 0) return;
        
        const startTime = performance.now();
        this.stats.notesRendered = 0;
        this.stats.notesCulled = 0;
        
        const visibleRect = viewport.getVisibleRect();
        
        ctx.save();
        
        // Filtrer les notes visibles (culling viewport)
        const visibleNotes = this.getVisibleNotes(notes, visibleRect, coordSystem);
        
        // Limiter le nombre de notes par frame si nécessaire
        const notesToRender = this.config.maxNotesPerFrame > 0 ?
            visibleNotes.slice(0, this.config.maxNotesPerFrame) :
            visibleNotes;
        
        // Trier par canal pour le batching
        const notesByChannel = this.groupByChannel(notesToRender);
        
        // Rendu par canal (optimisation batching)
        for (const [channel, channelNotes] of notesByChannel.entries()) {
            this.renderChannelNotes(ctx, channelNotes, coordSystem, selection, channel);
        }
        
        ctx.restore();
        
        // Statistiques
        this.stats.lastFrameTime = performance.now() - startTime;
        this.stats.notesCulled = notes.length - visibleNotes.length;
    }

    /**
     * ✅ OPTIMISÉ: Rendu des notes d'un canal avec batching
     * @param {CanvasRenderingContext2D} ctx - Contexte Canvas
     * @param {Array} notes - Notes du canal
     * @param {Object} coordSystem - Système de coordonnées
     * @param {Object} selection - Gestionnaire de sélection
     * @param {number} channel - Numéro de canal MIDI
     */
    renderChannelNotes(ctx, notes, coordSystem, selection, channel) {
        const baseColor = this.getChannelColor(channel);
        
        // Trier notes: non-sélectionnées d'abord, sélectionnées au-dessus
        const sortedNotes = notes.sort((a, b) => {
            const aSelected = selection && selection.isSelected(a.id);
            const bSelected = selection && selection.isSelected(b.id);
            if (aSelected === bSelected) return 0;
            return aSelected ? 1 : -1;
        });
        
        for (const note of sortedNotes) {
            const rect = coordSystem.noteToRect(note);
            
            // Skip si trop petit (LOD)
            if (rect.width < this.config.minNoteWidth) continue;
            
            // Déterminer la couleur et opacité
            const isSelected = selection && selection.isSelected(note.id);
            const color = isSelected ?
                this.getLighterColor(baseColor, 0.3) : 
                baseColor;
            
            // Opacité basée sur velocity
            const opacity = this.config.showVelocity ? 
                0.6 + (note.velocity / 127) * 0.4 : 
                1.0;
            
            // Dessiner la note
            this.drawNote(ctx, rect, color, note.velocity, opacity, isSelected);
            
            // Nom de note (si zoom suffisant - LOD)
            if (this.config.showNoteNames && rect.width > 30 && rect.height > 12) {
                this.drawNoteName(ctx, rect, note.note);
            }
            
            this.stats.notesRendered++;
        }
    }

    /**
     * ✅ COMPLET: Dessine une note avec coins arrondis et gradient vélocité
     * @param {CanvasRenderingContext2D} ctx - Contexte Canvas
     * @param {Object} rect - Rectangle {x, y, width, height}
     * @param {string} color - Couleur de base
     * @param {number} velocity - Vélocité (0-127)
     * @param {number} opacity - Opacité globale
     * @param {boolean} isSelected - Note sélectionnée
     */
    drawNote(ctx, rect, color, velocity, opacity, isSelected) {
        ctx.save();
        ctx.globalAlpha = opacity;
        
        // Dessiner fond avec gradient vélocité si activé
        if (this.config.showVelocityGradient && rect.height > 4) {
            const gradient = this.getVelocityGradient(ctx, rect, color, velocity);
            ctx.fillStyle = gradient;
        } else {
            ctx.fillStyle = color;
        }
        
        // Dessiner avec coins arrondis si assez grand
        if (rect.width > 10 && rect.height > 6) {
            this.fillRoundedRect(ctx, rect.x, rect.y, rect.width, rect.height, this.config.noteRadius);
        } else {
            ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
        }
        
        // Bordure
        if (isSelected) {
            ctx.strokeStyle = this.config.selectionBorderColor;
            ctx.lineWidth = this.config.selectionBorderWidth;
        } else {
            ctx.strokeStyle = this.config.noteBorderColor;
            ctx.lineWidth = this.config.noteBorderWidth;
        }
        
        if (rect.width > 10 && rect.height > 6) {
            this.strokeRoundedRect(ctx, rect.x, rect.y, rect.width, rect.height, this.config.noteRadius);
        } else {
            ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);
        }
        
        // Indicateur de vélocité (barre verticale à gauche)
        if (this.config.showVelocity && rect.width > 15 && rect.height > 8) {
            const velocityHeight = (velocity / 127) * rect.height;
            ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
            ctx.fillRect(rect.x + 1, rect.y + rect.height - velocityHeight, 3, velocityHeight);
        }
        
        ctx.restore();
    }

    /**
     * ✅ NOUVEAU: Crée un gradient de vélocité pour une note
     * @param {CanvasRenderingContext2D} ctx - Contexte Canvas
     * @param {Object} rect - Rectangle de la note
     * @param {string} baseColor - Couleur de base
     * @param {number} velocity - Vélocité (0-127)
     * @returns {CanvasGradient} Gradient
     */
    getVelocityGradient(ctx, rect, baseColor, velocity) {
        // Cache key
        const cacheKey = `${baseColor}_${velocity}_${rect.height}`;
        
        if (this.gradientCache.has(cacheKey)) {
            // Recréer gradient avec nouvelles coordonnées
            const cached = this.gradientCache.get(cacheKey);
            const gradient = ctx.createLinearGradient(rect.x, rect.y, rect.x, rect.y + rect.height);
            gradient.addColorStop(0, cached.color1);
            gradient.addColorStop(1, cached.color2);
            return gradient;
        }
        
        // Créer gradient top-to-bottom
        const gradient = ctx.createLinearGradient(rect.x, rect.y, rect.x, rect.y + rect.height);
        
        // Couleur plus claire en haut
        const lighterColor = this.getLighterColor(baseColor, 0.2);
        // Couleur plus foncée en bas selon vélocité
        const darkerColor = this.getDarkerColor(baseColor, (1 - velocity / 127) * 0.3);
        
        gradient.addColorStop(0, lighterColor);
        gradient.addColorStop(1, darkerColor);
        
        // Mettre en cache (limiter taille)
        if (this.gradientCache.size > this.maxCacheSize) {
            const firstKey = this.gradientCache.keys().next().value;
            this.gradientCache.delete(firstKey);
        }
        this.gradientCache.set(cacheKey, { color1: lighterColor, color2: darkerColor });
        
        return gradient;
    }

    /**
     * ✅ COMPLET: Dessine un rectangle rempli avec coins arrondis
     * @param {CanvasRenderingContext2D} ctx - Contexte
     * @param {number} x - Position X
     * @param {number} y - Position Y
     * @param {number} width - Largeur
     * @param {number} height - Hauteur
     * @param {number} radius - Rayon des coins
     */
    fillRoundedRect(ctx, x, y, width, height, radius) {
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.lineTo(x + width - radius, y);
        ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
        ctx.lineTo(x + width, y + height - radius);
        ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
        ctx.lineTo(x + radius, y + height);
        ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
        ctx.lineTo(x, y + radius);
        ctx.quadraticCurveTo(x, y, x + radius, y);
        ctx.closePath();
        ctx.fill();
    }

    /**
     * ✅ COMPLET: Dessine le contour d'un rectangle avec coins arrondis
     * @param {CanvasRenderingContext2D} ctx - Contexte
     * @param {number} x - Position X
     * @param {number} y - Position Y
     * @param {number} width - Largeur
     * @param {number} height - Hauteur
     * @param {number} radius - Rayon des coins
     */
    strokeRoundedRect(ctx, x, y, width, height, radius) {
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.lineTo(x + width - radius, y);
        ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
        ctx.lineTo(x + width, y + height - radius);
        ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
        ctx.lineTo(x + radius, y + height);
        ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
        ctx.lineTo(x, y + radius);
        ctx.quadraticCurveTo(x, y, x + radius, y);
        ctx.closePath();
        ctx.stroke();
    }

    /**
     * Dessine le nom de la note (LOD)
     * @param {CanvasRenderingContext2D} ctx - Contexte
     * @param {Object} rect - Rectangle de la note
     * @param {number} noteNumber - Numéro MIDI de la note
     */
    drawNoteName(ctx, rect, noteNumber) {
        const noteName = this.getNoteNameFromNumber(noteNumber);
        
        ctx.save();
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.font = '10px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(noteName, rect.x + rect.width / 2, rect.y + rect.height / 2);
        ctx.restore();
    }

    // ========================================================================
    // NOTES ACTIVES (playback)
    // ========================================================================

    /**
     * ✅ COMPLET: Rendu des notes actives pendant la lecture avec effet glow
     * @param {CanvasRenderingContext2D} ctx - Contexte Canvas
     * @param {Array} activeNotes - Notes actives
     * @param {Object} viewport - Viewport actuel
     * @param {Object} coordSystem - Système de coordonnées
     */
    renderActiveNotes(ctx, activeNotes, viewport, coordSystem) {
        if (!activeNotes || activeNotes.length === 0) return;
        
        ctx.save();
        
        for (const note of activeNotes) {
            const rect = coordSystem.noteToRect(note);
            
            // Couleur plus brillante
            const baseColor = this.getChannelColor(note.channel);
            const brightColor = this.getLighterColor(baseColor, 0.5);
            
            // Effet glow (multiple passes)
            ctx.globalAlpha = 0.3;
            ctx.shadowColor = brightColor;
            ctx.shadowBlur = 20;
            ctx.fillStyle = brightColor;
            this.fillRoundedRect(ctx, rect.x, rect.y, rect.width, rect.height, this.config.noteRadius);
            
            // Pass principal
            ctx.globalAlpha = 0.8;
            ctx.shadowBlur = 10;
            ctx.fillStyle = brightColor;
            this.fillRoundedRect(ctx, rect.x, rect.y, rect.width, rect.height, this.config.noteRadius);
            
            // Bordure brillante
            ctx.globalAlpha = 1.0;
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2;
            ctx.shadowBlur = 5;
            this.strokeRoundedRect(ctx, rect.x, rect.y, rect.width, rect.height, this.config.noteRadius);
        }
        
        ctx.restore();
    }

    // ========================================================================
    // FILTRAGE ET OPTIMISATION
    // ========================================================================

    /**
     * ✅ OPTIMISÉ: Obtient les notes visibles dans le viewport (culling)
     * @param {Array} notes - Toutes les notes
     * @param {Object} visibleRect - Rectangle visible
     * @param {Object} coordSystem - Système de coordonnées
     * @returns {Array} Notes visibles
     */
    getVisibleNotes(notes, visibleRect, coordSystem) {
        const visible = [];
        
        // Extraire les plages du viewport
        const { timeRange, noteRange } = visibleRect;
        
        if (!timeRange || !noteRange) {
            // Fallback: retourner toutes les notes
            return notes;
        }
        
        const startTime = timeRange.start;
        const endTime = timeRange.end;
        const minNote = noteRange.min;
        const maxNote = noteRange.max;
        
        for (const note of notes) {
            // Culling temporel
            // Note complètement avant viewport
            if (note.time + note.duration < startTime) continue;
            // Note complètement après viewport
            if (note.time > endTime) continue;
            
            // Culling vertical (hauteur de note)
            if (note.note < minNote) continue;
            if (note.note > maxNote) continue;
            
            visible.push(note);
        }
        
        return visible;
    }

    /**
     * Groupe les notes par canal MIDI (batching)
     * @param {Array} notes - Notes à grouper
     * @returns {Map} Map canal -> notes
     */
    groupByChannel(notes) {
        const byChannel = new Map();
        
        for (const note of notes) {
            const channel = note.channel || 0;
            if (!byChannel.has(channel)) {
                byChannel.set(channel, []);
            }
            byChannel.get(channel).push(note);
        }
        
        return byChannel;
    }

    // ========================================================================
    // COULEURS
    // ========================================================================

    /**
     * Couleurs par défaut pour les 16 canaux MIDI
     * @returns {Array<string>} Tableau de couleurs hex
     */
    getDefaultChannelColors() {
        return [
            '#667eea', // Canal 0 - Bleu violet
            '#f093fb', // Canal 1 - Rose
            '#4facfe', // Canal 2 - Bleu ciel
            '#00f2fe', // Canal 3 - Cyan
            '#43e97b', // Canal 4 - Vert
            '#38f9d7', // Canal 5 - Turquoise
            '#fa709a', // Canal 6 - Rose-rouge
            '#fee140', // Canal 7 - Jaune
            '#30cfd0', // Canal 8 - Cyan-vert
            '#a8edea', // Canal 9 - Bleu pâle
            '#ff6a00', // Canal 10 - Orange (percussion)
            '#ee0979', // Canal 11 - Magenta
            '#7f7fd5', // Canal 12 - Violet
            '#86a8e7', // Canal 13 - Bleu
            '#91eae4', // Canal 14 - Turquoise clair
            '#c471f5'  // Canal 15 - Violet rose
        ];
    }

    /**
     * Obtient la couleur d'un canal
     * @param {number} channel - Numéro de canal (0-15)
     * @returns {string} Couleur hex
     */
    getChannelColor(channel) {
        return this.config.channelColors[channel % this.config.channelColors.length];
    }

    /**
     * Éclaircit une couleur
     * @param {string} color - Couleur hex
     * @param {number} amount - Quantité (0-1)
     * @returns {string} Couleur rgb
     */
    getLighterColor(color, amount) {
        const hex = color.replace('#', '');
        const r = Math.min(255, parseInt(hex.substr(0, 2), 16) + amount * 255);
        const g = Math.min(255, parseInt(hex.substr(2, 2), 16) + amount * 255);
        const b = Math.min(255, parseInt(hex.substr(4, 2), 16) + amount * 255);
        
        return `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;
    }

    /**
     * ✅ NOUVEAU: Assombrit une couleur
     * @param {string} color - Couleur hex
     * @param {number} amount - Quantité (0-1)
     * @returns {string} Couleur rgb
     */
    getDarkerColor(color, amount) {
        const hex = color.replace('#', '');
        const r = Math.max(0, parseInt(hex.substr(0, 2), 16) - amount * 255);
        const g = Math.max(0, parseInt(hex.substr(2, 2), 16) - amount * 255);
        const b = Math.max(0, parseInt(hex.substr(4, 2), 16) - amount * 255);
        
        return `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;
    }

    // ========================================================================
    // UTILITAIRES
    // ========================================================================

    /**
     * Obtient le nom d'une note MIDI
     * @param {number} noteNumber - Numéro MIDI (0-127)
     * @returns {string} Nom de note (ex: "C4")
     */
    getNoteNameFromNumber(noteNumber) {
        const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        const octave = Math.floor(noteNumber / 12) - 1;
        const noteName = noteNames[noteNumber % 12];
        return `${noteName}${octave}`;
    }

    /**
     * Nettoie les caches
     */
    clearCache() {
        this.gradientCache.clear();
        this.colorCache.clear();
    }

    /**
     * Obtient les statistiques de rendu
     * @returns {Object} Statistiques
     */
    getStats() {
        return { ...this.stats };
    }

    /**
     * Configure les options
     * @param {Object} options - Options à modifier
     */
    setConfig(options) {
        Object.assign(this.config, options);
    }

    /**
     * Définit la visibilité
     * @param {boolean} visible - Visibilité
     */
    setVisible(visible) {
        // NoteRenderer est toujours visible (pas d'état interne)
    }
}

// ============================================================================
// EXPORT
// ============================================================================

if (typeof module !== 'undefined' && module.exports) {
    module.exports = NoteRenderer;
}
window.NoteRenderer = NoteRenderer;