// ============================================================================
// Fichier: frontend/js/views/EditorView.js
// Version: v4.0.1 - CONFORMITÉ API + MÉTHODES RENDER
// Date: 2025-11-08
// ============================================================================
// AMÉLIORATIONS v4.0.1:
// ✅ Ajout méthode render() pour insertion DOM
// ✅ Ajout méthode show() pour affichage et redessinage canvas
// ✅ Ajout méthode hide() pour masquage
// ✅ Conformité API v4.2.2
// ============================================================================

class EditorView extends BaseView {
    constructor(containerId, eventBus) {
        super(containerId, eventBus);
        
        this.config.autoRender = false;
        this.config.name = 'EditorView';
        
        this.viewState = {
            currentFile: null,
            midiData: null,
            tracks: [],
            selectedTrack: 0,
            notes: [],
            zoom: 1,
            scrollX: 0,
            scrollY: 0,
            tool: 'select', // select, pencil, eraser
            isModified: false
        };
        
        this.canvas = null;
        this.ctx = null;
        
        this.log('info', 'EditorView', '✅ EditorView v4.0.1 initialized');
    }
    
    buildTemplate(data = {}) {
        const state = { ...this.viewState, ...data };
        
        return `
            <div class="editor-view">
                <div class="editor-toolbar">
                    <div class="toolbar-section">
                        <button data-action="load" title="Charger fichier">📂</button>
                        <button data-action="save" title="Sauvegarder">💾</button>
                    </div>
                    <div class="toolbar-section">
                        <button data-action="tool-select" class="${state.tool === 'select' ? 'active' : ''}">↖️</button>
                        <button data-action="tool-pencil" class="${state.tool === 'pencil' ? 'active' : ''}">✏️</button>
                        <button data-action="tool-eraser" class="${state.tool === 'eraser' ? 'active' : ''}">🗑️</button>
                    </div>
                    <div class="toolbar-section">
                        <button data-action="zoom-in">🔍+</button>
                        <button data-action="zoom-out">🔍-</button>
                        <span>Zoom: ${Math.round(state.zoom * 100)}%</span>
                    </div>
                    <div class="toolbar-info">
                        <span>${state.currentFile?.name || 'Pas de fichier'}</span>
                        ${state.isModified ? '<span class="modified">*</span>' : ''}
                    </div>
                </div>
                
                <div class="editor-main">
                    <div class="editor-sidebar">
                        <h3>Pistes</h3>
                        <div class="tracks-list">
                            ${state.tracks.map((t, i) => `
                                <div class="track-item ${i === state.selectedTrack ? 'selected' : ''}" 
                                     data-track="${i}">
                                    <span>Piste ${i + 1}</span>
                                    <span>${t.notes?.length || 0} notes</span>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                    
                    <div class="editor-canvas-container">
                        <canvas id="editorCanvas"></canvas>
                    </div>
                </div>
            </div>
        `;
    }
    
    // ========================================================================
    // RENDERING - MÉTHODES PRINCIPALES
    // ========================================================================
    
    /**
     * Rendre la vue éditeur
     * @param {Object} data - Données optionnelles pour le rendu
     */
    render(data = null) {
        if (!this.container) {
            this.log('error', 'EditorView', 'Cannot render: container not found');
            return;
        }
        
        const startTime = performance.now();
        
        try {
            // Générer et insérer le HTML
            this.container.innerHTML = this.buildTemplate(data || this.viewState);
            
            // Initialiser le canvas si nécessaire
            this.initializeCanvas();
            
            // Attacher les événements
            this.attachEvents();
            
            // Mettre à jour l'état
            this.state.rendered = true;
            this.state.lastUpdate = Date.now();
            
            // Émettre événement
            if (this.eventBus) {
                this.eventBus.emit('editor-view:rendered', {
                    hasFile: !!this.viewState.currentFile
                });
            }
            
            const renderTime = performance.now() - startTime;
            this.log('debug', 'EditorView', `✓ Rendered in ${renderTime.toFixed(2)}ms`);
            
        } catch (error) {
            this.log('error', 'EditorView', 'Render failed:', error);
            this.handleError('Render failed', error);
        }
    }

    /**
     * Afficher la vue éditeur
     */
    show() {
        if (this.container) {
            this.container.style.display = 'block';
            this.state.visible = true;
            
            // Redessiner le canvas si nécessaire
            if (this.canvas && this.viewState.currentFile) {
                this.redrawCanvas();
            }
        }
    }

    /**
     * Masquer la vue éditeur
     */
    hide() {
        if (this.container) {
            this.container.style.display = 'none';
            this.state.visible = false;
        }
    }
    
    /**
     * Initialiser le canvas après insertion DOM
     */
    initializeCanvas() {
        this.setupCanvas();
    }
    
    /**
     * Redessiner le canvas
     */
    redrawCanvas() {
        this.drawGrid();
    }
    
    // ========================================================================
    // EVENTS
    // ========================================================================
    
    attachEvents() {
        super.attachEvents();
        
        if (!this.container) return;
        
        this.container.addEventListener('click', (e) => {
            const action = e.target.closest('[data-action]')?.dataset.action;
            
            switch (action) {
                case 'load': this.loadFile(); break;
                case 'save': this.saveFile(); break;
                case 'tool-select': this.viewState.tool = 'select'; this.render(); break;
                case 'tool-pencil': this.viewState.tool = 'pencil'; this.render(); break;
                case 'tool-eraser': this.viewState.tool = 'eraser'; this.render(); break;
                case 'zoom-in': this.zoom(1.2); break;
                case 'zoom-out': this.zoom(0.8); break;
            }
            
            const trackItem = e.target.closest('.track-item');
            if (trackItem) {
                this.viewState.selectedTrack = parseInt(trackItem.dataset.track);
                this.render();
            }
        });
        
        this.setupCanvas();
        this.setupEventBusListeners();
    }
    
    setupCanvas() {
        this.canvas = document.getElementById('editorCanvas');
        if (!this.canvas) return;
        
        this.ctx = this.canvas.getContext('2d');
        this.resizeCanvas();
        this.drawGrid();
        
        this.canvas.addEventListener('mousedown', (e) => this.handleCanvasMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this.handleCanvasMouseMove(e));
        this.canvas.addEventListener('mouseup', (e) => this.handleCanvasMouseUp(e));
        this.canvas.addEventListener('wheel', (e) => this.handleCanvasWheel(e));
    }
    
    setupEventBusListeners() {
        if (!this.eventBus) return;
        
        // midi.convert response (MIDI → JSON)
        this.eventBus.on('midi:converted_to_json', (data) => {
            this.viewState.midiData = data.json;
            this.viewState.tracks = data.json.tracks || [];
            this.extractNotes();
            this.render();
        });
        
        // files.read response
        this.eventBus.on('file:loaded_content', (data) => {
            // Convertir le contenu MIDI en JSON
            if (this.eventBus) {
                this.eventBus.emit('midi:convert_to_json_requested', {
                    midi_data: data.content,
                    format: 'binary'
                });
            }
        });
        
        // files.write response
        this.eventBus.on('file:saved', (data) => {
            this.viewState.isModified = false;
            this.render();
        });
    }
    
    // ========================================================================
    // FILE OPERATIONS
    // ========================================================================
    
    loadFile() {
        // Émettre event pour ouvrir modal de sélection
        if (this.eventBus) {
            this.eventBus.emit('editor:open_file_modal');
        }
    }
    
    loadFileByPath(filePath) {
        // API: files.read
        if (this.eventBus) {
            this.eventBus.emit('file:read_requested', {
                file_path: filePath
            });
        }
        
        this.viewState.currentFile = { name: filePath.split('/').pop() };
    }
    
    saveFile() {
        if (!this.viewState.midiData || !this.viewState.currentFile) return;
        
        // Mettre à jour les notes dans midiData
        this.updateMidiData();
        
        // API: midi.convert (JSON → MIDI) puis files.write
        if (this.eventBus) {
            this.eventBus.emit('midi:convert_to_midi_requested', {
                json_data: this.viewState.midiData,
                file_path: this.viewState.currentFile.path || this.viewState.currentFile.name
            });
        }
    }
    
    // ========================================================================
    // MIDI DATA
    // ========================================================================
    
    extractNotes() {
        const track = this.viewState.tracks[this.viewState.selectedTrack];
        if (!track || !track.events) return;
        
        this.viewState.notes = [];
        const activeNotes = new Map();
        
        track.events.forEach(event => {
            if (event.type === 'noteOn') {
                activeNotes.set(event.note, { ...event });
            } else if (event.type === 'noteOff') {
                const noteOn = activeNotes.get(event.note);
                if (noteOn) {
                    this.viewState.notes.push({
                        note: event.note,
                        start: noteOn.time,
                        duration: event.time - noteOn.time,
                        velocity: noteOn.velocity || 64,
                        channel: noteOn.channel || 0
                    });
                    activeNotes.delete(event.note);
                }
            }
        });
    }
    
    updateMidiData() {
        const track = this.viewState.tracks[this.viewState.selectedTrack];
        if (!track) return;
        
        // Convertir notes en events MIDI
        track.events = [];
        
        this.viewState.notes.forEach(note => {
            track.events.push({
                type: 'noteOn',
                time: note.start,
                note: note.note,
                velocity: note.velocity,
                channel: note.channel
            });
            track.events.push({
                type: 'noteOff',
                time: note.start + note.duration,
                note: note.note,
                velocity: 0,
                channel: note.channel
            });
        });
        
        // Trier par temps
        track.events.sort((a, b) => a.time - b.time);
        
        this.viewState.isModified = true;
    }
    
    // ========================================================================
    // CANVAS
    // ========================================================================
    
    resizeCanvas() {
        if (!this.canvas) return;
        const parent = this.canvas.parentElement;
        this.canvas.width = parent.clientWidth;
        this.canvas.height = parent.clientHeight;
        this.drawGrid();
    }
    
    drawGrid() {
        if (!this.ctx) return;
        
        const ctx = this.ctx;
        const width = this.canvas.width;
        const height = this.canvas.height;
        
        ctx.fillStyle = '#1a1a2e';
        ctx.fillRect(0, 0, width, height);
        
        // Grid
        ctx.strokeStyle = '#2a2a3e';
        ctx.lineWidth = 1;
        
        const gridSize = 20 * this.viewState.zoom;
        
        for (let x = 0; x < width; x += gridSize) {
            ctx.beginPath();
            ctx.moveTo(x - this.viewState.scrollX % gridSize, 0);
            ctx.lineTo(x - this.viewState.scrollX % gridSize, height);
            ctx.stroke();
        }
        
        for (let y = 0; y < height; y += gridSize) {
            ctx.beginPath();
            ctx.moveTo(0, y - this.viewState.scrollY % gridSize);
            ctx.lineTo(width, y - this.viewState.scrollY % gridSize);
            ctx.stroke();
        }
        
        this.drawNotes();
    }
    
    drawNotes() {
        if (!this.ctx) return;
        
        const ctx = this.ctx;
        const noteHeight = 10;
        
        this.viewState.notes.forEach(note => {
            const x = (note.start * this.viewState.zoom) - this.viewState.scrollX;
            const y = ((127 - note.note) * noteHeight) - this.viewState.scrollY;
            const width = note.duration * this.viewState.zoom;
            
            ctx.fillStyle = `hsl(${(note.channel * 30) % 360}, 70%, 60%)`;
            ctx.fillRect(x, y, width, noteHeight - 1);
        });
    }
    
    // ========================================================================
    // INTERACTION
    // ========================================================================
    
    handleCanvasMouseDown(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        if (this.viewState.tool === 'pencil') {
            this.addNote(x, y);
        }
    }
    
    handleCanvasMouseMove(e) {
        // Drag pour scroll
    }
    
    handleCanvasMouseUp(e) {
        // Fin drag
    }
    
    handleCanvasWheel(e) {
        e.preventDefault();
        
        if (e.deltaY < 0) {
            this.zoom(1.1);
        } else {
            this.zoom(0.9);
        }
    }
    
    addNote(x, y) {
        const noteHeight = 10;
        const note = 127 - Math.floor((y + this.viewState.scrollY) / noteHeight);
        const start = (x + this.viewState.scrollX) / this.viewState.zoom;
        
        this.viewState.notes.push({
            note: Math.max(0, Math.min(127, note)),
            start: Math.max(0, start),
            duration: 480, // 1 beat
            velocity: 80,
            channel: 0
        });
        
        this.viewState.isModified = true;
        this.drawGrid();
    }
    
    zoom(factor) {
        this.viewState.zoom = Math.max(0.1, Math.min(5, this.viewState.zoom * factor));
        this.drawGrid();
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = EditorView;
}
if (typeof window !== 'undefined') {
    window.EditorView = EditorView;
}