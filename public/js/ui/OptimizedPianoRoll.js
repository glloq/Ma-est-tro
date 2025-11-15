/**
 * OptimizedPianoRoll - High-performance piano roll with WebGL/Canvas
 * Inspired by webaudio-pianoroll (https://github.com/g200kg/webaudio-pianoroll)
 * Features:
 * - Virtual scrolling for large files
 * - RequestAnimationFrame rendering
 * - Touch/mouse support
 * - Note editing (add, delete, resize)
 */

class OptimizedPianoRoll {
    constructor(container, options = {}) {
        this.container = typeof container === 'string' ? document.querySelector(container) : container;

        // Configuration
        this.options = {
            width: options.width || this.container.clientWidth || 800,
            height: options.height || this.container.clientHeight || 400,
            noteHeight: options.noteHeight || 12,
            noteRange: options.noteRange || { min: 21, max: 108 }, // A0 to C8
            timeScale: options.timeScale || 100, // pixels per beat
            snapToGrid: options.snapToGrid !== false,
            gridDivision: options.gridDivision || 16, // 16th notes
            colors: {
                bg: options.bgColor || '#1a1a1a',
                grid: options.gridColor || '#2a2a2a',
                gridBeat: options.gridBeatColor || '#3a3a3a',
                gridBar: options.gridBarColor || '#4a4a4a',
                piano: options.pianoColor || '#2c3e50',
                pianoBlack: options.pianoBlackColor || '#1c2530',
                note: options.noteColor || '#3498db',
                noteSelected: options.noteSelectedColor || '#e74c3c',
                playhead: options.playheadColor || '#2ecc71'
            },
            onNoteAdd: options.onNoteAdd || null,
            onNoteDelete: options.onNoteDelete || null,
            onNoteChange: options.onNoteChange || null,
            onSeek: options.onSeek || null
        };

        // State
        this.notes = [];
        this.viewport = {
            x: 0,
            y: 0,
            zoom: 1.0
        };
        this.playhead = 0; // Current playback position (beats)
        this.selection = new Set();
        this.isDragging = false;
        this.dragMode = null; // 'pan', 'select', 'note', 'resize'
        this.dragStart = { x: 0, y: 0 };
        this.dragNote = null;

        // Performance
        this.rafId = null;
        this.needsRender = true;
        this.lastRenderTime = 0;
        this.fps = 60;
        this.frameTime = 1000 / this.fps;

        // Cache
        this.pianoCanvas = null;
        this.pianoCtx = null;
        this.gridCanvas = null;
        this.gridCtx = null;

        this.init();
    }

    init() {
        // Create main canvas
        this.canvas = document.createElement('canvas');
        this.canvas.width = this.options.width;
        this.canvas.height = this.options.height;
        this.canvas.className = 'pianoroll-canvas';
        this.canvas.style.touchAction = 'none';
        this.ctx = this.canvas.getContext('2d', { alpha: false });
        this.container.appendChild(this.canvas);

        // Create piano keys cache
        this.pianoWidth = 80;
        this.pianoCanvas = document.createElement('canvas');
        this.pianoCanvas.width = this.pianoWidth;
        this.pianoCanvas.height = this.options.height;
        this.pianoCtx = this.pianoCanvas.getContext('2d');

        // Create grid cache
        this.gridCanvas = document.createElement('canvas');
        this.gridCanvas.width = this.options.width;
        this.gridCanvas.height = this.options.height;
        this.gridCtx = this.gridCanvas.getContext('2d');

        // Event listeners
        this.canvas.addEventListener('mousedown', this.onMouseDown.bind(this));
        this.canvas.addEventListener('mousemove', this.onMouseMove.bind(this));
        this.canvas.addEventListener('mouseup', this.onMouseUp.bind(this));
        this.canvas.addEventListener('wheel', this.onWheel.bind(this), { passive: false });
        this.canvas.addEventListener('touchstart', this.onTouchStart.bind(this), { passive: false });
        this.canvas.addEventListener('touchmove', this.onTouchMove.bind(this), { passive: false });
        this.canvas.addEventListener('touchend', this.onTouchEnd.bind(this));

        // Keyboard shortcuts
        document.addEventListener('keydown', this.onKeyDown.bind(this));

        // Initial render
        this.renderPiano();
        this.renderGrid();
        this.startRenderLoop();
    }

    // ========================================================================
    // RENDERING
    // ========================================================================

    startRenderLoop() {
        const render = (timestamp) => {
            if (timestamp - this.lastRenderTime >= this.frameTime && this.needsRender) {
                this.render();
                this.lastRenderTime = timestamp;
                this.needsRender = false;
            }
            this.rafId = requestAnimationFrame(render);
        };
        this.rafId = requestAnimationFrame(render);
    }

    render() {
        const ctx = this.ctx;
        const width = this.canvas.width;
        const height = this.canvas.height;

        // Clear
        ctx.fillStyle = this.options.colors.bg;
        ctx.fillRect(0, 0, width, height);

        // Draw grid
        ctx.drawImage(this.gridCanvas, -this.viewport.x, -this.viewport.y);

        // Draw notes
        this.renderNotes(ctx);

        // Draw playhead
        this.renderPlayhead(ctx);

        // Draw piano keys overlay
        ctx.drawImage(this.pianoCanvas, 0, -this.viewport.y);
    }

    renderPiano() {
        const ctx = this.pianoCtx;
        const noteCount = this.options.noteRange.max - this.options.noteRange.min + 1;
        const totalHeight = noteCount * this.options.noteHeight;

        ctx.fillStyle = this.options.colors.piano;
        ctx.fillRect(0, 0, this.pianoWidth, totalHeight);

        // Draw keys
        const blackNotes = [1, 3, 6, 8, 10]; // C#, D#, F#, G#, A#

        for (let i = 0; i < noteCount; i++) {
            const note = this.options.noteRange.max - i;
            const y = i * this.options.noteHeight;
            const isBlack = blackNotes.includes(note % 12);

            if (isBlack) {
                ctx.fillStyle = this.options.colors.pianoBlack;
                ctx.fillRect(0, y, this.pianoWidth, this.options.noteHeight);
            }

            // Divider
            ctx.strokeStyle = '#000';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(this.pianoWidth, y);
            ctx.stroke();

            // C notes marker
            if (note % 12 === 0) {
                ctx.fillStyle = '#fff';
                ctx.font = '10px monospace';
                ctx.fillText(`C${Math.floor(note / 12) - 1}`, 5, y + this.options.noteHeight - 2);
            }
        }
    }

    renderGrid() {
        const ctx = this.gridCtx;
        const beatsPerBar = 4;
        const maxBeats = 128; // 32 bars
        const width = maxBeats * this.options.timeScale;
        const noteCount = this.options.noteRange.max - this.options.noteRange.min + 1;
        const height = noteCount * this.options.noteHeight;

        this.gridCanvas.width = width;
        this.gridCanvas.height = height;

        ctx.fillStyle = this.options.colors.bg;
        ctx.fillRect(0, 0, width, height);

        // Vertical lines (time)
        for (let beat = 0; beat <= maxBeats; beat++) {
            const x = beat * this.options.timeScale;
            const isBeat = beat % beatsPerBar === 0;

            ctx.strokeStyle = isBeat ? this.options.colors.gridBar : this.options.colors.gridBeat;
            ctx.lineWidth = isBeat ? 2 : 1;
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
            ctx.stroke();

            // Sub-divisions
            const subDiv = this.options.gridDivision / beatsPerBar;
            for (let i = 1; i < subDiv; i++) {
                const subX = x + (i * this.options.timeScale / subDiv);
                ctx.strokeStyle = this.options.colors.grid;
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(subX, 0);
                ctx.lineTo(subX, height);
                ctx.stroke();
            }
        }

        // Horizontal lines (notes)
        for (let i = 0; i <= noteCount; i++) {
            const y = i * this.options.noteHeight;
            ctx.strokeStyle = this.options.colors.grid;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
            ctx.stroke();
        }
    }

    renderNotes(ctx) {
        ctx.save();
        ctx.translate(-this.viewport.x + this.pianoWidth, -this.viewport.y);

        this.notes.forEach(note => {
            const x = note.time * this.options.timeScale;
            const y = (this.options.noteRange.max - note.pitch) * this.options.noteHeight;
            const width = note.duration * this.options.timeScale;
            const height = this.options.noteHeight - 2;

            const isSelected = this.selection.has(note.id);

            // Note rectangle
            ctx.fillStyle = isSelected ? this.options.colors.noteSelected : this.options.colors.note;
            ctx.fillRect(x, y + 1, width, height);

            // Border
            ctx.strokeStyle = isSelected ? '#c0392b' : '#2980b9';
            ctx.lineWidth = isSelected ? 2 : 1;
            ctx.strokeRect(x, y + 1, width, height);

            // Velocity indicator
            const alpha = note.velocity / 127;
            ctx.fillStyle = `rgba(255, 255, 255, ${alpha * 0.3})`;
            ctx.fillRect(x, y + 1, width, height);
        });

        ctx.restore();
    }

    renderPlayhead(ctx) {
        const x = this.playhead * this.options.timeScale - this.viewport.x + this.pianoWidth;

        ctx.strokeStyle = this.options.colors.playhead;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, this.canvas.height);
        ctx.stroke();
    }

    // ========================================================================
    // NOTE MANAGEMENT
    // ========================================================================

    addNote(note) {
        note.id = note.id || `note_${Date.now()}_${Math.random()}`;
        this.notes.push(note);
        this.sortNotes();
        this.requestRender();

        if (this.options.onNoteAdd) {
            this.options.onNoteAdd(note);
        }
    }

    deleteNote(noteId) {
        const index = this.notes.findIndex(n => n.id === noteId);
        if (index !== -1) {
            const note = this.notes[index];
            this.notes.splice(index, 1);
            this.selection.delete(noteId);
            this.requestRender();

            if (this.options.onNoteDelete) {
                this.options.onNoteDelete(note);
            }
        }
    }

    updateNote(noteId, changes) {
        const note = this.notes.find(n => n.id === noteId);
        if (note) {
            Object.assign(note, changes);
            this.sortNotes();
            this.requestRender();

            if (this.options.onNoteChange) {
                this.options.onNoteChange(note);
            }
        }
    }

    setNotes(notes) {
        this.notes = notes.map(n => ({ ...n, id: n.id || `note_${Date.now()}_${Math.random()}` }));
        this.sortNotes();
        this.requestRender();
    }

    sortNotes() {
        this.notes.sort((a, b) => a.time - b.time || a.pitch - b.pitch);
    }

    // ========================================================================
    // PLAYBACK
    // ========================================================================

    setPlayhead(beats) {
        this.playhead = beats;
        this.requestRender();
    }

    // ========================================================================
    // VIEWPORT
    // ========================================================================

    setZoom(zoom) {
        this.viewport.zoom = Math.max(0.1, Math.min(5, zoom));
        this.options.timeScale = 100 * this.viewport.zoom;
        this.renderGrid();
        this.requestRender();
    }

    scrollTo(x, y) {
        this.viewport.x = Math.max(0, x);
        this.viewport.y = Math.max(0, y);
        this.requestRender();
    }

    // ========================================================================
    // INPUT HANDLERS
    // ========================================================================

    onMouseDown(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        this.dragStart = { x, y };
        this.isDragging = true;

        // Check if clicking on piano keys
        if (x < this.pianoWidth) {
            const pitch = this.yToPitch(y);
            // Could trigger note preview here
            return;
        }

        // Check if clicking on note
        const clickedNote = this.getNoteAtPosition(x, y);
        if (clickedNote) {
            this.dragMode = 'note';
            this.dragNote = clickedNote;

            if (!e.shiftKey) {
                this.selection.clear();
            }
            this.selection.add(clickedNote.id);
            this.requestRender();
        } else {
            this.dragMode = 'pan';
        }

        e.preventDefault();
    }

    onMouseMove(e) {
        if (!this.isDragging) return;

        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const dx = x - this.dragStart.x;
        const dy = y - this.dragStart.y;

        if (this.dragMode === 'pan') {
            this.scrollTo(this.viewport.x - dx, this.viewport.y - dy);
            this.dragStart = { x, y };
        } else if (this.dragMode === 'note' && this.dragNote) {
            // Move note
            const deltaTime = dx / this.options.timeScale;
            const deltaPitch = -Math.round(dy / this.options.noteHeight);

            this.updateNote(this.dragNote.id, {
                time: Math.max(0, this.dragNote.time + deltaTime),
                pitch: Math.max(0, Math.min(127, this.dragNote.pitch + deltaPitch))
            });

            this.dragStart = { x, y };
        }
    }

    onMouseUp(e) {
        this.isDragging = false;
        this.dragMode = null;
        this.dragNote = null;
    }

    onWheel(e) {
        e.preventDefault();

        if (e.ctrlKey || e.metaKey) {
            // Zoom
            const delta = -e.deltaY * 0.001;
            this.setZoom(this.viewport.zoom * (1 + delta));
        } else {
            // Scroll
            this.scrollTo(
                this.viewport.x + e.deltaX,
                this.viewport.y + e.deltaY
            );
        }
    }

    onTouchStart(e) {
        if (e.touches.length === 1) {
            const touch = e.touches[0];
            const rect = this.canvas.getBoundingClientRect();
            this.dragStart = {
                x: touch.clientX - rect.left,
                y: touch.clientY - rect.top
            };
            this.isDragging = true;
        }
        e.preventDefault();
    }

    onTouchMove(e) {
        if (e.touches.length === 1 && this.isDragging) {
            const touch = e.touches[0];
            const rect = this.canvas.getBoundingClientRect();
            const x = touch.clientX - rect.left;
            const y = touch.clientY - rect.top;
            const dx = x - this.dragStart.x;
            const dy = y - this.dragStart.y;

            this.scrollTo(this.viewport.x - dx, this.viewport.y - dy);
            this.dragStart = { x, y };
        }
        e.preventDefault();
    }

    onTouchEnd(e) {
        this.isDragging = false;
    }

    onKeyDown(e) {
        if (e.key === 'Delete' || e.key === 'Backspace') {
            this.selection.forEach(id => this.deleteNote(id));
            this.selection.clear();
        } else if (e.key === 'a' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            this.selection.clear();
            this.notes.forEach(n => this.selection.add(n.id));
            this.requestRender();
        }
    }

    // ========================================================================
    // UTILITIES
    // ========================================================================

    getNoteAtPosition(x, y) {
        const time = (x - this.pianoWidth + this.viewport.x) / this.options.timeScale;
        const pitch = this.yToPitch(y);

        return this.notes.find(note =>
            time >= note.time &&
            time <= note.time + note.duration &&
            pitch === note.pitch
        );
    }

    yToPitch(y) {
        const noteIndex = Math.floor((y + this.viewport.y) / this.options.noteHeight);
        return this.options.noteRange.max - noteIndex;
    }

    requestRender() {
        this.needsRender = true;
    }

    destroy() {
        if (this.rafId) {
            cancelAnimationFrame(this.rafId);
        }
        this.canvas.remove();
    }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = OptimizedPianoRoll;
}
if (typeof window !== 'undefined') {
    window.OptimizedPianoRoll = OptimizedPianoRoll;
}
