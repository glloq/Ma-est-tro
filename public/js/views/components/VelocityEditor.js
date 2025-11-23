/**
 * VelocityEditor - Éditeur de vélocité des notes synchronisé avec le piano roll
 *
 * Fonctionnalités :
 * - Affichage des barres de vélocité sous forme de graphique
 * - Outils : sélection, déplacement, ligne, dessin continu
 * - Synchronisation horizontale avec le piano roll
 * - Respect de la grille temporelle et du zoom
 * - Filtre par canal sélectionné
 */

class VelocityEditor {
    constructor(container, options = {}) {
        this.container = container;
        this.options = {
            height: options.height || 150,
            timebase: options.timebase || 480, // PPQ
            xrange: options.xrange || 1920,
            xoffset: options.xoffset || 0,
            grid: options.grid || 15,
            onChange: options.onChange || null, // Callback appelé lors des changements
            ...options
        };

        // État de l'éditeur
        this.sequence = []; // Notes avec vélocité
        this.selectedNotes = new Set(); // IDs des notes sélectionnées
        this.currentTool = 'select'; // 'select', 'move', 'line', 'draw'
        this.currentChannel = 0;
        this.activeChannels = new Set([0]); // Canaux visibles
        this.isDrawing = false;
        this.lastDrawPosition = null;
        this.lastDrawTicks = null;

        // Historique pour undo/redo
        this.history = [];
        this.historyIndex = -1;

        // OPTIMISATION: Système de throttling pour le rendu
        this.pendingRender = false;
        this.renderScheduled = false;
        this.isDirty = false;

        // Canvas de buffer pour la grille (statique)
        this.gridCanvas = null;
        this.gridCtx = null;
        this.gridDirty = true;

        // Initialisation
        this.init();
    }

    init() {
        this.createUI();
        this.setupEventListeners();
    }

    createUI() {
        // Conteneur principal
        this.element = document.createElement('div');
        this.element.className = 'velocity-editor';
        this.element.style.cssText = `
            width: 100%;
            flex: 1;
            display: flex;
            flex-direction: column;
            background: #1a1a1a;
            border-top: 1px solid #333;
            position: relative;
            overflow: hidden;
            min-height: 0;
        `;

        // Canvas pour le rendu
        this.canvas = document.createElement('canvas');
        this.canvas.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            cursor: crosshair;
        `;
        this.ctx = this.canvas.getContext('2d');

        // Overlay pour les interactions
        this.overlay = document.createElement('div');
        this.overlay.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            pointer-events: none;
        `;

        this.element.appendChild(this.canvas);
        this.element.appendChild(this.overlay);
        this.container.appendChild(this.element);

        // Redimensionner le canvas
        this.resize();
    }

    setupEventListeners() {
        // Événements souris
        this.canvas.addEventListener('mousedown', this.handleMouseDown.bind(this));
        this.canvas.addEventListener('mousemove', this.handleMouseMove.bind(this));
        this.canvas.addEventListener('mouseup', this.handleMouseUp.bind(this));
        this.canvas.addEventListener('mouseleave', this.handleMouseLeave.bind(this));

        // Événements clavier
        document.addEventListener('keydown', this.handleKeyDown.bind(this));

        // Redimensionnement
        window.addEventListener('resize', this.resize.bind(this));
    }

    resize() {
        // Forcer le reflow pour obtenir les dimensions finales
        const forceReflow = this.element.offsetHeight;

        const rect = this.element.getBoundingClientRect();
        const width = rect.width;
        const height = rect.height;

        console.log(`VelocityEditor.resize(): element=${width}x${height}`);

        // Ne redimensionner que si on a des dimensions valides
        if (width > 0 && height > 100) {
            this.canvas.width = width;
            this.canvas.height = height;

            // OPTIMISATION: Recréer le canvas de buffer pour la grille
            if (!this.gridCanvas) {
                this.gridCanvas = document.createElement('canvas');
                this.gridCtx = this.gridCanvas.getContext('2d');
            }
            this.gridCanvas.width = width;
            this.gridCanvas.height = height;
            this.gridDirty = true;

            this.renderThrottled();
        } else {
            console.warn(`VelocityEditor.resize(): Invalid dimensions ${width}x${height}, skipping`);
        }
    }

    // === Gestion des outils ===

    setTool(tool) {
        this.currentTool = tool;
        this.canvas.style.cursor = tool === 'draw' ? 'crosshair' : 'default';
    }

    setChannel(channel) {
        this.currentChannel = channel;
        this.activeChannels = new Set([channel]); // CORRECTION: Mettre à jour activeChannels pour filtrage
        this.isDirty = true;
        this.renderThrottled();
    }

    setActiveChannels(channels) {
        this.activeChannels = new Set(channels);
        this.isDirty = true;
        this.renderThrottled();
    }

    // === Conversion coordonnées ===

    ticksToX(ticks) {
        return ((ticks - this.options.xoffset) / this.options.xrange) * this.canvas.width;
    }

    xToTicks(x) {
        return Math.round((x / this.canvas.width) * this.options.xrange + this.options.xoffset);
    }

    velocityToY(velocity) {
        // 0-127 → bottom to top
        const normalized = velocity / 127;
        return this.canvas.height - (normalized * this.canvas.height);
    }

    yToVelocity(y) {
        const normalized = 1 - (y / this.canvas.height);
        return Math.round(Math.max(1, Math.min(127, normalized * 127)));
    }

    snapToGrid(ticks) {
        const gridSize = this.options.grid;
        return Math.round(ticks / gridSize) * gridSize;
    }

    // === Gestion de la séquence ===

    setSequence(sequence) {
        this.sequence = sequence || [];
        this.selectedNotes.clear();
        this.isDirty = true;
        this.saveState();
        this.renderThrottled();
    }

    getSequence() {
        return this.sequence;
    }

    // === Modification de vélocité ===

    updateNoteVelocity(noteIndex, velocity) {
        if (noteIndex >= 0 && noteIndex < this.sequence.length) {
            this.sequence[noteIndex].v = Math.max(1, Math.min(127, velocity));
            this.isDirty = true;
            this.notifyChange();
        }
    }

    updateSelectedNotesVelocity(velocity) {
        Array.from(this.selectedNotes).forEach(index => {
            if (index >= 0 && index < this.sequence.length) {
                this.sequence[index].v = Math.max(1, Math.min(127, velocity));
            }
        });
        this.isDirty = true;
        this.saveState();
        this.notifyChange();
        this.renderThrottled();
    }

    adjustVelocity(noteIndex, delta) {
        if (noteIndex >= 0 && noteIndex < this.sequence.length) {
            const note = this.sequence[noteIndex];
            const currentVelocity = note.v || 100;
            note.v = Math.max(1, Math.min(127, currentVelocity + delta));
            this.isDirty = true;
            this.notifyChange();
        }
    }

    // === Outils d'édition ===

    handleMouseDown(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const ticks = this.xToTicks(x);
        const velocity = this.yToVelocity(y);

        switch (this.currentTool) {
            case 'draw':
                this.isDrawing = true;
                this.lastDrawPosition = { x, y };
                this.lastDrawTicks = this.snapToGrid(ticks);

                // Trouver la note à ce tick et modifier sa vélocité
                const noteAtDraw = this.getNoteAtTick(ticks);
                if (noteAtDraw !== null) {
                    this.updateNoteVelocity(noteAtDraw, velocity);
                    this.renderThrottled();
                }
                break;

            case 'line':
                if (!this.lineStart) {
                    this.lineStart = { ticks, velocity };
                } else {
                    this.createLine(this.lineStart.ticks, this.lineStart.velocity, ticks, velocity);
                    this.lineStart = null;
                }
                break;

            case 'select':
                const clickedNote = this.getNoteAtPosition(x, y);
                if (clickedNote !== null) {
                    if (e.shiftKey) {
                        if (this.selectedNotes.has(clickedNote)) {
                            this.selectedNotes.delete(clickedNote);
                        } else {
                            this.selectedNotes.add(clickedNote);
                        }
                    } else {
                        this.selectedNotes.clear();
                        this.selectedNotes.add(clickedNote);
                    }
                    this.dragStart = { x, y, ticks, velocity, initialVelocities: new Map() };

                    // Stocker les vélocités initiales pour le drag
                    Array.from(this.selectedNotes).forEach(index => {
                        if (index >= 0 && index < this.sequence.length) {
                            this.dragStart.initialVelocities.set(index, this.sequence[index].v || 100);
                        }
                    });
                } else {
                    if (!e.shiftKey) {
                        this.selectedNotes.clear();
                    }
                    this.selectionStart = { x, y };
                }
                this.renderThrottled();
                break;

            case 'move':
                const moveNote = this.getNoteAtPosition(x, y);
                if (moveNote !== null) {
                    if (!this.selectedNotes.has(moveNote)) {
                        this.selectedNotes.clear();
                        this.selectedNotes.add(moveNote);
                    }
                    this.dragStart = { x, y, ticks, velocity, initialVelocities: new Map() };

                    // Stocker les vélocités initiales
                    Array.from(this.selectedNotes).forEach(index => {
                        if (index >= 0 && index < this.sequence.length) {
                            this.dragStart.initialVelocities.set(index, this.sequence[index].v || 100);
                        }
                    });
                }
                this.renderThrottled();
                break;
        }
    }

    handleMouseMove(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const ticks = this.xToTicks(x);
        const velocity = this.yToVelocity(y);

        if (this.isDrawing && this.currentTool === 'draw') {
            // Dessin continu - modifier la vélocité des notes sous le curseur
            const snappedTicks = this.snapToGrid(ticks);
            if (this.lastDrawTicks === null || Math.abs(snappedTicks - this.lastDrawTicks) >= this.options.grid) {
                const noteAtDraw = this.getNoteAtTick(ticks);
                if (noteAtDraw !== null) {
                    this.updateNoteVelocity(noteAtDraw, velocity);
                }
                this.lastDrawTicks = snappedTicks;
                this.lastDrawPosition = { x, y };
                this.renderThrottled();
            }
        } else if (this.dragStart && (this.currentTool === 'select' || this.currentTool === 'move')) {
            // Déplacement vertical des barres de vélocité
            if (this.selectedNotes.size > 0) {
                const deltaVelocity = this.yToVelocity(y) - this.dragStart.velocity;

                Array.from(this.selectedNotes).forEach(index => {
                    if (index >= 0 && index < this.sequence.length) {
                        const initialVelocity = this.dragStart.initialVelocities.get(index) || 100;
                        this.sequence[index].v = Math.max(1, Math.min(127, initialVelocity + deltaVelocity));
                    }
                });

                this.renderThrottled();
            }
        } else if (this.selectionStart) {
            // Rectangle de sélection
            this.renderSelectionRect(this.selectionStart.x, this.selectionStart.y, x, y);
        } else if (this.lineStart) {
            // Prévisualisation de la ligne
            this.renderLinePreview(this.lineStart, { ticks, velocity });
        }
    }

    handleMouseUp(e) {
        if (this.isDrawing) {
            this.isDrawing = false;
            this.lastDrawPosition = null;
            this.lastDrawTicks = null;
            // Sauvegarder l'état après avoir fini de dessiner
            this.saveState();
            this.notifyChange();
        }

        if (this.selectionStart) {
            const rect = this.canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            this.selectInRect(this.selectionStart.x, this.selectionStart.y, x, y);
            this.selectionStart = null;
        }

        if (this.dragStart) {
            this.saveState();
            this.notifyChange();
            this.dragStart = null;
        }

        this.renderThrottled();
    }

    handleMouseLeave(e) {
        this.handleMouseUp(e);
    }

    handleKeyDown(e) {
        if (e.key === 'Escape') {
            this.selectedNotes.clear();
            this.lineStart = null;
            this.renderThrottled();
        } else if (e.ctrlKey || e.metaKey) {
            if (e.key === 'z') {
                this.undo();
                e.preventDefault();
            } else if (e.key === 'y' || (e.shiftKey && e.key === 'Z')) {
                this.redo();
                e.preventDefault();
            } else if (e.key === 'a') {
                this.selectAll();
                e.preventDefault();
            }
        }
    }

    // === Utilitaires de sélection ===

    getNoteAtPosition(x, y, threshold = 8) {
        const ticks = this.xToTicks(x);

        return this.getFilteredNotes().findIndex(note => {
            const nx = this.ticksToX(note.t);
            const barWidth = Math.max(2, this.ticksToX(note.t + note.g) - nx);
            const ny = this.velocityToY(note.v || 100);

            return x >= nx - threshold &&
                   x <= nx + barWidth + threshold &&
                   y >= ny - threshold &&
                   y <= this.canvas.height + threshold;
        });
    }

    getNoteAtTick(ticks, threshold = null) {
        if (threshold === null) {
            threshold = this.options.grid / 2;
        }

        return this.getFilteredNotes().findIndex(note => {
            return Math.abs(note.t - ticks) <= threshold;
        });
    }

    selectInRect(x1, y1, x2, y2) {
        const left = Math.min(x1, x2);
        const right = Math.max(x1, x2);
        const top = Math.min(y1, y2);
        const bottom = Math.max(y1, y2);

        this.getFilteredNotes().forEach((note, index) => {
            const nx = this.ticksToX(note.t);
            const barWidth = Math.max(2, this.ticksToX(note.t + note.g) - nx);
            const ny = this.velocityToY(note.v || 100);

            if (nx >= left && nx + barWidth <= right && ny >= top && ny <= bottom) {
                this.selectedNotes.add(index);
            }
        });

        this.renderThrottled();
    }

    selectAll() {
        this.selectedNotes.clear();
        this.getFilteredNotes().forEach((note, index) => {
            this.selectedNotes.add(index);
        });
        this.renderThrottled();
    }

    getFilteredNotes() {
        return this.sequence.filter(note => this.activeChannels.has(note.c));
    }

    // === Création de ligne ===

    createLine(startTicks, startVelocity, endTicks, endVelocity) {
        const minTicks = Math.min(startTicks, endTicks);
        const maxTicks = Math.max(startTicks, endTicks);

        // Trouver toutes les notes dans la plage temporelle
        this.sequence.forEach((note, index) => {
            if (note.t >= minTicks && note.t <= maxTicks && this.activeChannels.has(note.c)) {
                // Interpolation linéaire
                const t = (note.t - startTicks) / (endTicks - startTicks);
                const velocity = Math.round(startVelocity + t * (endVelocity - startVelocity));
                this.sequence[index].v = Math.max(1, Math.min(127, velocity));
            }
        });

        this.saveState();
        this.notifyChange();
        this.renderThrottled();
    }

    // === Rendu ===

    renderThrottled() {
        if (!this.renderScheduled) {
            this.renderScheduled = true;
            requestAnimationFrame(() => {
                this.render();
                this.renderScheduled = false;
            });
        }
    }

    render() {
        if (!this.ctx || this.canvas.width === 0 || this.canvas.height === 0) {
            return;
        }

        // OPTIMISATION: Redessiner la grille uniquement si nécessaire
        if (this.gridDirty) {
            this.renderGridToBuffer();
            this.gridDirty = false;
        }

        // Effacer le canvas principal
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Copier la grille depuis le buffer
        if (this.gridCanvas) {
            this.ctx.drawImage(this.gridCanvas, 0, 0);
        }

        // Dessiner les barres de vélocité
        this.renderVelocityBars();

        // Dessiner les éléments interactifs
        if (this.selectionStart) {
            this.renderSelectionRect(
                this.selectionStart.x,
                this.selectionStart.y,
                this.lastMouseX || this.selectionStart.x,
                this.lastMouseY || this.selectionStart.y
            );
        }

        if (this.lineStart) {
            const lastPos = this.lastDrawPosition || this.lineStart;
            this.renderLinePreview(this.lineStart, {
                ticks: this.xToTicks(lastPos.x),
                velocity: this.yToVelocity(lastPos.y)
            });
        }
    }

    renderGridToBuffer() {
        if (!this.gridCtx) return;

        const labelMargin = 50; // IDENTIQUE À CC: Marge pour les labels à gauche
        const ctx = this.gridCtx;

        // Effacer le buffer
        ctx.clearRect(0, 0, this.gridCanvas.width, this.gridCanvas.height);

        // Grille verticale (temps) - IDENTIQUE À CC
        ctx.strokeStyle = '#3a3a3a'; // IDENTIQUE À CC: Plus clair
        ctx.lineWidth = 1;

        const gridSize = this.options.grid;
        const startTick = Math.floor(this.options.xoffset / gridSize) * gridSize;
        const endTick = this.options.xoffset + this.options.xrange;

        for (let t = startTick; t <= endTick; t += gridSize) {
            const x = this.ticksToX(t);
            if (x >= 0 && x <= this.gridCanvas.width) {
                ctx.beginPath();
                ctx.moveTo(Math.max(x, labelMargin), 0);
                ctx.lineTo(x, this.gridCanvas.height);
                ctx.stroke();
            }
        }

        // Grille horizontale (valeurs de vélocité) - IDENTIQUE À CC
        const values = [0, 32, 64, 96, 127]; // IDENTIQUE À CC
        ctx.strokeStyle = '#3a3a3a'; // IDENTIQUE À CC
        ctx.lineWidth = 1;

        values.forEach(value => {
            const y = this.velocityToY(value);

            // Ligne de grille
            ctx.beginPath();
            ctx.moveTo(labelMargin, y);
            ctx.lineTo(this.gridCanvas.width, y);
            ctx.stroke();

            // Zone de label (fond)
            ctx.fillStyle = '#1a1a1a';
            ctx.fillRect(0, y - 7, labelMargin - 2, 14);

            // Label
            ctx.fillStyle = '#aaa'; // IDENTIQUE À CC: Plus clair
            ctx.font = '11px monospace';
            ctx.textAlign = 'right';
            ctx.fillText(value.toString(), labelMargin - 5, y + 4);
        });

        // Bordure verticale séparant la zone de labels - IDENTIQUE À CC
        ctx.strokeStyle = '#555';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(labelMargin, 0);
        ctx.lineTo(labelMargin, this.gridCanvas.height);
        ctx.stroke();

        // Réinitialiser l'alignement du texte
        ctx.textAlign = 'left';
    }

    renderVelocityBars() {
        const ctx = this.ctx;
        const filteredNotes = this.getFilteredNotes();

        filteredNotes.forEach((note, index) => {
            const velocity = note.v || 100;
            const x = this.ticksToX(note.t);
            const y = this.velocityToY(velocity);
            const barWidth = Math.max(2, this.ticksToX(note.t + note.g) - x);
            const barHeight = this.canvas.height - y;

            // Couleur basée sur la vélocité
            const intensityRatio = velocity / 127;
            const hue = 120 + (240 - 120) * (1 - intensityRatio); // Vert (120) à Bleu (240)
            const saturation = 60 + 40 * intensityRatio;
            const lightness = 40 + 20 * intensityRatio;

            // Barre de vélocité
            const isSelected = this.selectedNotes.has(index);
            if (isSelected) {
                ctx.fillStyle = `hsl(50, 100%, 60%)`; // Jaune pour sélection
            } else {
                ctx.fillStyle = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
            }

            ctx.fillRect(x, y, barWidth, barHeight);

            // Bordure
            if (isSelected) {
                ctx.strokeStyle = '#fff';
                ctx.lineWidth = 2;
                ctx.strokeRect(x, y, barWidth, barHeight);
            }
        });
    }

    renderSelectionRect(x1, y1, x2, y2) {
        const ctx = this.ctx;
        ctx.strokeStyle = '#4CAF50';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
        ctx.setLineDash([]);
    }

    renderLinePreview(start, end) {
        const ctx = this.ctx;
        ctx.strokeStyle = '#FFA500';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(this.ticksToX(start.ticks), this.velocityToY(start.velocity));
        ctx.lineTo(this.ticksToX(end.ticks), this.velocityToY(end.velocity));
        ctx.stroke();
        ctx.setLineDash([]);
    }

    // === Synchronisation avec piano roll ===

    syncWith(pianoRoll) {
        this.options.xrange = pianoRoll.xrange;
        this.options.xoffset = pianoRoll.xoffset;
        this.options.grid = pianoRoll.grid;
        this.options.timebase = pianoRoll.timebase;
        this.gridDirty = true;
        this.renderThrottled();
    }

    // === Historique (Undo/Redo) ===

    saveState() {
        const state = JSON.stringify({
            sequence: this.sequence.map(note => ({ ...note }))
        });

        // Supprimer les états futurs si on est au milieu de l'historique
        if (this.historyIndex < this.history.length - 1) {
            this.history = this.history.slice(0, this.historyIndex + 1);
        }

        this.history.push(state);

        // Limiter l'historique à 50 états
        if (this.history.length > 50) {
            this.history.shift();
        } else {
            this.historyIndex++;
        }
    }

    undo() {
        if (this.historyIndex > 0) {
            this.historyIndex--;
            this.restoreState(this.history[this.historyIndex]);
        }
    }

    redo() {
        if (this.historyIndex < this.history.length - 1) {
            this.historyIndex++;
            this.restoreState(this.history[this.historyIndex]);
        }
    }

    restoreState(stateStr) {
        const state = JSON.parse(stateStr);
        this.sequence = state.sequence;
        this.selectedNotes.clear();
        this.notifyChange();
        this.renderThrottled();
    }

    // === Callbacks ===

    notifyChange() {
        if (this.options.onChange) {
            this.options.onChange(this.sequence);
        }
    }

    // === Nettoyage ===

    destroy() {
        document.removeEventListener('keydown', this.handleKeyDown.bind(this));
        window.removeEventListener('resize', this.resize.bind(this));
        if (this.element && this.element.parentNode) {
            this.element.parentNode.removeChild(this.element);
        }
    }
}

// Exporter pour utilisation dans d'autres modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = VelocityEditor;
}
