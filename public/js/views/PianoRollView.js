// ============================================================================
// Fichier: frontend/js/views/PianoRollView.js
// Projet: MidiMind v3.1.0 - Système d'Orchestration MIDI pour Raspberry Pi
// Version: 3.1.0
// Date: 2025-11-04
// ============================================================================
// Description:
//   Vue piano roll pour l'édition graphique des notes MIDI.
//   Affichage en grille avec timeline, notes rectangulaires,
//   clavier piano vertical, et outils d'édition.
//
// Fonctionnalités:
//   - Affichage notes en grille temporelle
//   - Clavier piano vertical (88 touches)
//   - Timeline avec mesures et temps
//   - Zoom horizontal et vertical
//   - Pan (défilement) fluide
//   - Sélection multiple notes (rectangle)
//   - Édition notes (déplacer, redimensionner)
//   - Outils : Select, Pencil, Eraser
//   - Snap to grid configurable
//   - Affichage vélocité (couleur)
//
// Architecture:
//   PianoRollView extends BaseCanvasView
//   - CoordinateSystem : Conversions pixels <-> temps/pitch
//   - Viewport : Gestion zoom/pan
//   - NoteRenderer : Rendu notes optimisé
//   - GridRenderer : Grille et mesures
//
// Auteur: MidiMind Team
// ============================================================================


class PianoRollView extends BaseCanvasView {
    // ✅ CORRECTION: Signature conforme à BaseCanvasView (canvas, eventBus)
    constructor(canvas, eventBus) {
        super(canvas, eventBus);
        
        // Récupérer canvas depuis BaseCanvasView (déjà résolu)
        // this.canvas et this.ctx sont déjà disponibles via super()
        this.model = null; // Model sera fourni via setModel()
        
        // Configuration spécifique
        this.noteHeight = 12;
        this.pixelsPerMs = 0.1;
    }
    /**
     * Rendu optimisé avec JsonMidi timeline
     */
    render() {
        if (!this.editorModel || !this.editorModel.data) return;
        
        // Accès direct à la timeline JsonMidi
        const notes = this.editorModel.data.timeline.filter(e => e.type === 'noteOn');
        
        this.clearCanvas();
        this.drawGrid();
        this.drawTimeRuler();
        
        // Dessiner chaque note
        notes.forEach(note => {
            // Vérifier si note visible dans viewport
            if (!this.isNoteVisible(note)) return;
            
            const x = this.timeToX(note.time);
            const y = this.noteToY(note.note);
            const width = this.timeToX(note.time + note.duration) - x;
            const height = this.noteHeight;
            
            // Style basé sur vélocité
            this.ctx.fillStyle = this.getNoteColor(note.velocity);
            this.ctx.fillRect(x, y, width, height);
            
            // Border
            if (this.selectedNotes.has(note.id)) {
                this.ctx.strokeStyle = '#fff';
                this.ctx.lineWidth = 2;
            } else {
                this.ctx.strokeStyle = '#667eea';
                this.ctx.lineWidth = 1;
            }
            this.ctx.strokeRect(x, y, width, height);
        });
        
        // Dessiner playhead
        this.drawPlayhead();
    }
    
    /**
     * Gestion clic - Ajouter note
     */
    handleClick(e) {
        const point = this.getCanvasPoint(e);
        const time = this.xToTime(point.x);
        const note = this.yToNote(point.y);
        
        // Quantifier si activé
        const quantizedTime = this.editorModel.state.snap 
            ? this.quantizeTime(time) 
            : time;
        
        // Ajouter via EditorModel (qui gère JsonMidi)
        this.editorModel.addNote(
            quantizedTime,
            this.currentChannel,
            note,
            100,  // velocity
            480   // duration (1 beat)
        );
    }
    /**
     * Invalide le cache et force le redessinage
     */
    invalidate() {
        this.needsRedraw = true;
        this.renderCache.clear();
    }

    /**
     * Boucle de rendu
     */
    startRenderLoop() {
        const render = () => {
            if (this.needsRedraw) {
                this.render();
                this.needsRedraw = false;
            }
            requestAnimationFrame(render);
        };
        requestAnimationFrame(render);
    }


    /**
     * Dessine la grille
     */
    drawGrid() {
        const { start, end } = this.model.state.viewport;
        
        // Lignes verticales (temps)
        this.ctx.strokeStyle = '#2a2a2a';
        this.ctx.lineWidth = 1;
        
        const gridInterval = this.snapResolution;
        const startTime = Math.floor(start / gridInterval) * gridInterval;
        
        for (let time = startTime; time <= end; time += gridInterval) {
            const x = this.timeToX(time);
            
            if (x >= 0 && x <= this.width) {
                // Ligne plus épaisse tous les 4 temps
                if ((time / gridInterval) % 4 === 0) {
                    this.ctx.strokeStyle = '#3a3a3a';
                    this.ctx.lineWidth = 1.5;
                } else {
                    this.ctx.strokeStyle = '#2a2a2a';
                    this.ctx.lineWidth = 1;
                }
                
                this.ctx.beginPath();
                this.ctx.moveTo(x, 0);
                this.ctx.lineTo(x, this.height);
                this.ctx.stroke();
            }
        }
        
        // Lignes horizontales (notes)
        this.ctx.strokeStyle = '#2a2a2a';
        this.ctx.lineWidth = 1;
        
        for (let note = 0; note <= 127; note++) {
            const y = this.noteToY(note);
            
            // Ligne plus visible pour les C
            if (note % 12 === 0) {
                this.ctx.strokeStyle = '#3a3a3a';
            } else {
                this.ctx.strokeStyle = '#2a2a2a';
            }
            
            this.ctx.beginPath();
            this.ctx.moveTo(0, y);
            this.ctx.lineTo(this.width, y);
            this.ctx.stroke();
        }
    }

    /**
     * Dessine les notes
     */
    drawNotes() {
        const timeline = this.model.getFilteredTimeline();
        const notes = timeline.filter(e => e.type === 'noteOn');
        const selectedNotes = this.model.state.selectedNotes;
        
        notes.forEach(note => {
            const x = this.timeToX(note.time);
            const y = this.noteToY(note.note);
            const width = note.duration * this.pixelsPerMs;
            const height = this.noteHeight - 2;
            
            // Vérifier si visible
            if (x + width < 0 || x > this.width || 
                y + height < 0 || y > this.height) {
                return;
            }
            
            const isSelected = selectedNotes.has(note.id);
            
            // Couleur selon le canal
            const channelColor = this.getChannelColor(note.channel);
            
            // Dessiner la note
            this.ctx.fillStyle = isSelected ? '#667eea' : channelColor;
            this.ctx.fillRect(x, y, width, height);
            
            // Border pour les notes sélectionnées
            if (isSelected) {
                this.ctx.strokeStyle = '#fff';
                this.ctx.lineWidth = 2;
                this.ctx.strokeRect(x, y, width, height);
            }
            
            // Barre de vélocité
            if (this.model.state.velocityView) {
                const velocityHeight = (note.velocity / 127) * height;
                this.ctx.fillStyle = 'rgba(255,255,255,0.3)';
                this.ctx.fillRect(x, y + height - velocityHeight, 3, velocityHeight);
            }
            
            // Nom de la note si assez large
            if (width > 40) {
                this.ctx.fillStyle = '#fff';
                this.ctx.font = '10px sans-serif';
                this.ctx.textAlign = 'left';
                this.ctx.textBaseline = 'middle';
                
                const noteName = this.getNoteName(note.note);
                this.ctx.fillText(noteName, x + 4, y + height / 2);
            }
            
            // Poignée de redimensionnement (si sélectionnée)
            if (isSelected && width > 20) {
                this.ctx.fillStyle = '#fff';
                this.ctx.fillRect(x + width - 4, y + height / 2 - 2, 4, 4);
            }
        });
    }

    /**
     * Dessine la timeline avec mesures et temps
     */
    drawTimeRuler() {
        const height = 30;
        const { start, end } = this.model.state.viewport;
        
        // Fond
        this.ctx.fillStyle = '#1a1a1a';
        this.ctx.fillRect(0, 0, this.width, height);
        
        // Marqueurs de mesure
        this.ctx.strokeStyle = '#4a4a4a';
        this.ctx.fillStyle = '#ccc';
        this.ctx.font = '11px sans-serif';
        this.ctx.textAlign = 'center';
        
        const ticksPerBeat = 480;  // PPQ
        const beatsPerMeasure = 4;
        const measureInterval = ticksPerBeat * beatsPerMeasure;
        
        const startMeasure = Math.floor(start / measureInterval);
        const endMeasure = Math.ceil(end / measureInterval) + 1;
        
        for (let measure = startMeasure; measure <= endMeasure; measure++) {
            const time = measure * measureInterval;
            const x = this.timeToX(time);
            
            if (x >= 0 && x <= this.width) {
                // Ligne
                this.ctx.beginPath();
                this.ctx.moveTo(x, height - 10);
                this.ctx.lineTo(x, height);
                this.ctx.stroke();
                
                // Numéro de mesure
                const measureLabel = measure + 1;
                this.ctx.fillText(measureLabel.toString(), x, 15);
            }
            
            // Beats intermédiaires
            for (let beat = 1; beat < beatsPerMeasure; beat++) {
                const beatTime = time + (beat * ticksPerBeat);
                const beatX = this.timeToX(beatTime);
                
                if (beatX >= 0 && beatX <= this.width) {
                    this.ctx.beginPath();
                    this.ctx.moveTo(beatX, height - 5);
                    this.ctx.lineTo(beatX, height);
                    this.ctx.stroke();
                }
            }
        }
    }

    /**
     * Dessine le playhead
     */
    drawPlayhead() {
        if (!this.model || this.model.state.playbackTime === null) return;
        
        const x = this.timeToX(this.model.state.playbackTime);
        
        if (x >= 0 && x <= this.width) {
            this.ctx.strokeStyle = '#ff0000';
            this.ctx.lineWidth = 2;
            this.ctx.beginPath();
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, this.height);
            this.ctx.stroke();
        }
    }

    /**
     * Gestion du clic
     */
    onMouseDown(e) {
        if (!this.canvas) return;
        
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        const tool = this.model.state.currentTool;
        const hoveredNote = this.findNoteAt(x, y);
        
        if (tool === 'select') {
            if (hoveredNote) {
                // Vérifier si on clique sur la poignée de resize
                if (this.isResizeHandle(hoveredNote, x, y)) {
                    this.resizingNote = hoveredNote;
                    this.dragStart = { x, y, time: hoveredNote.time, duration: hoveredNote.duration };
                } else {
                    // Déplacer la note
                    if (!this.model.state.selectedNotes.has(hoveredNote.id)) {
                        // Sélectionner si pas déjà sélectionnée
                        this.model.selectNotes([hoveredNote.id], !e.shiftKey);
                    }
                    this.isDragging = true;
                    this.dragStart = { 
                        x, 
                        y, 
                        time: this.xToTime(x),
                        note: this.yToNote(y)
                    };
                }
            } else {
                // Commencer une sélection rectangle
                this.isSelecting = true;
                this.selectionRect = { x, y, width: 0, height: 0 };
            }
        } else if (tool === 'pencil') {
            // Ajouter une note
            const time = this.xToTime(x);
            const note = this.yToNote(y);
            
            const quantizedTime = this.snapEnabled 
                ? Math.round(time / this.snapResolution) * this.snapResolution
                : time;
            
            this.model.addNote({
                time: quantizedTime,
                note: Math.max(0, Math.min(127, note)),
                duration: this.snapResolution,
                velocity: 100,
                channel: this.model.state.currentChannel
            });
        } else if (tool === 'eraser' && hoveredNote) {
            // Supprimer la note
            this.model.deleteNotes([hoveredNote.id]);
        }
        
        this.invalidate();
    }

    /**
     * Gestion du déplacement
     */
    onMouseMove(e) {
        if (!this.canvas) return;
        
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        // Mettre à jour la note survolée
        const hoveredNote = this.findNoteAt(x, y);
        
        if (hoveredNote !== this.hoveredNote) {
            this.hoveredNote = hoveredNote;
            this.invalidate();
        }
        
        // Mise à jour du curseur
        this.updateCursor(x, y, hoveredNote);
        
        // Gestion du drag
        if (this.isDragging && this.dragStart) {
            const deltaTime = this.xToTime(x) - this.dragStart.time;
            const deltaNotes = this.yToNote(y) - this.dragStart.note;
            
            this.moveSelectedNotes(deltaTime, deltaNotes);
            this.dragStart.time = this.xToTime(x);
            this.dragStart.note = this.yToNote(y);
            
            this.invalidate();
        }
        
        // Gestion du resize
        if (this.resizingNote && this.dragStart) {
            const newTime = this.xToTime(x);
            const newDuration = Math.max(this.snapResolution, newTime - this.resizingNote.time);
            
            this.model.updateNote(this.resizingNote.id, {
                duration: newDuration
            });
            
            this.invalidate();
        }
        
        // Gestion de la sélection rectangle
        if (this.isSelecting && this.selectionRect) {
            this.selectionRect.width = x - this.selectionRect.x;
            this.selectionRect.height = y - this.selectionRect.y;
            
            this.invalidate();
        }
    }

    /**
     * Gestion du relâchement
     */
    onMouseUp(e) {
        this.isDragging = false;
        this.isSelecting = false;
        this.resizingNote = null;
        this.selectionRect = null;
        this.dragStart = null;
        
        this.invalidate();
    }

    /**
     * Gestion du scroll
     */
    onWheel(e) {
        e.preventDefault();
        
        if (e.ctrlKey) {
            // Zoom
            const delta = e.deltaY > 0 ? 0.9 : 1.1;
            const newZoom = this.model.state.zoom.x * delta;
            
            editorController.setZoom(newZoom, null);
        } else {
            // Scroll horizontal
            const delta = e.deltaY;
            this.scrollX += delta;
            
            // Limiter le scroll
            this.scrollX = Math.max(0, this.scrollX);
            
            this.invalidate();
        }
    }

    /**
     * Gestion de la sortie de souris
     */
    onMouseLeave() {
        this.hoveredNote = null;
        this.invalidate();
    }

    /**
     * Trouve une note aux coordonnées données
     */
    findNoteAt(x, y) {
        const timeline = this.model.getFilteredTimeline();
        const notes = timeline.filter(e => e.type === 'noteOn');
        
        for (let i = notes.length - 1; i >= 0; i--) {
            const note = notes[i];
            const noteX = this.timeToX(note.time);
            const noteY = this.noteToY(note.note);
            const noteWidth = note.duration * this.pixelsPerMs;
            const noteHeight = this.noteHeight - 2;
            
            if (x >= noteX && x <= noteX + noteWidth &&
                y >= noteY && y <= noteY + noteHeight) {
                return note;
            }
        }
        
        return null;
    }

    /**
     * Vérifie si on clique sur la poignée de redimensionnement
     */
    isResizeHandle(note, x, y) {
        const noteX = this.timeToX(note.time);
        const noteY = this.noteToY(note.note);
        const noteWidth = note.duration * this.pixelsPerMs;
        const noteHeight = this.noteHeight - 2;
        
        const handleX = noteX + noteWidth - 4;
        const handleY = noteY + noteHeight / 2 - 2;
        
        return x >= handleX - 4 && x <= handleX + 8 &&
               y >= handleY - 4 && y <= handleY + 8;
    }

    /**
     * Déplace les notes sélectionnées
     */
    moveSelectedNotes(deltaTime, deltaNotes) {
        const selectedIds = Array.from(this.model.state.selectedNotes);
        
        selectedIds.forEach(id => {
            const note = this.model.midiJson.timeline.find(e => e.id === id);
            
            if (note) {
                let newTime = note.time + deltaTime;
                let newNote = note.note + deltaNotes;
                
                // Snap
                if (this.snapEnabled) {
                    newTime = Math.round(newTime / this.snapResolution) * this.snapResolution;
                }
                
                // Limites
                newTime = Math.max(0, newTime);
                newNote = Math.max(0, Math.min(127, newNote));
                
                this.model.updateNote(id, {
                    time: newTime,
                    note: newNote
                });
            }
        });
    }

    /**
     * Sélectionne les notes dans le rectangle de sélection
     */
    selectNotesInRect() {
        if (!this.selectionRect) return;
        
        const rect = this.normalizeRect(this.selectionRect);
        const timeline = this.model.getFilteredTimeline();
        const notes = timeline.filter(e => e.type === 'noteOn');
        
        const selectedIds = [];
        
        notes.forEach(note => {
            const noteX = this.timeToX(note.time);
            const noteY = this.noteToY(note.note);
            const noteWidth = note.duration * this.pixelsPerMs;
            const noteHeight = this.noteHeight - 2;
            
            // Vérifier intersection
            if (this.rectsIntersect(
                rect,
                { x: noteX, y: noteY, width: noteWidth, height: noteHeight }
            )) {
                selectedIds.push(note.id);
            }
        });
        
        this.model.selectNotes(selectedIds, true);
    }

    /**
     * Normalise un rectangle (gère width/height négatifs)
     */
    normalizeRect(rect) {
        const x = rect.width < 0 ? rect.x + rect.width : rect.x;
        const y = rect.height < 0 ? rect.y + rect.height : rect.y;
        const width = Math.abs(rect.width);
        const height = Math.abs(rect.height);
        
        return { x, y, width, height };
    }

    /**
     * Vérifie l'intersection de deux rectangles
     */
    rectsIntersect(r1, r2) {
        return !(r1.x + r1.width < r2.x || 
                 r2.x + r2.width < r1.x ||
                 r1.y + r1.height < r2.y ||
                 r2.y + r2.height < r1.y);
    }

    /**
     * Met à jour le curseur selon le contexte
     */
    updateCursor(x, y, hoveredNote) {
        let cursor = 'default';
        
        const tool = this.model.state.currentTool;
        
        switch (tool) {
            case 'select':
                if (hoveredNote) {
                    if (this.isResizeHandle(hoveredNote, x, y)) {
                        cursor = 'ew-resize';
                    } else {
                        cursor = 'move';
                    }
                } else {
                    cursor = 'crosshair';
                }
                break;
            case 'pencil':
                cursor = 'crosshair';
                break;
            case 'eraser':
                cursor = 'not-allowed';
                break;
        }
        
        this.canvas.style.cursor = cursor;
    }

    // ========================================================================
    // CONVERSIONS
    // ========================================================================

    timeToX(time) {
        return (time - this.scrollX) * this.pixelsPerMs;
    }

    xToTime(x) {
        return (x / this.pixelsPerMs) + this.scrollX;
    }

    noteToY(note) {
        return (127 - note) * this.noteHeight - this.scrollY;
    }

    yToNote(y) {
        return 127 - Math.floor((y + this.scrollY) / this.noteHeight);
    }

    getChannelColor(channel) {
        const colors = [
            '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A',
            '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E2',
            '#F8B739', '#52C7B8', '#FF8C94', '#A8E6CF',
            '#FFD93D', '#BCB3E5', '#FAB1A0', '#81C784'
        ];
        return colors[channel % colors.length];
    }

    getNoteName(midiNote) {
        const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        const octave = Math.floor(midiNote / 12) - 1;
        return `${names[midiNote % 12]}${octave}`;
    }
}
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PianoRollView;
}

if (typeof window !== 'undefined') {
    window.PianoRollView = PianoRollView;
}

// Export par défaut
window.PianoRollView = PianoRollView;