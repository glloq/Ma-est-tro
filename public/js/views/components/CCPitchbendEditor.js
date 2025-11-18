/**
 * CCPitchbendEditor - Éditeur de Control Change et Pitchbend synchronisé avec le piano roll
 *
 * Fonctionnalités :
 * - Édition de CC1, CC7, CC10, CC1-step, pitchbend
 * - Outils : sélection, déplacement, ligne, dessin continu
 * - Synchronisation horizontale avec le piano roll
 * - Respect de la grille temporelle et du zoom
 * - Filtre par canal sélectionné
 */

class CCPitchbendEditor {
    constructor(container, options = {}) {
        this.container = container;
        this.options = {
            height: options.height || 150,
            timebase: options.timebase || 480, // PPQ
            xrange: options.xrange || 1920,
            xoffset: options.xoffset || 0,
            grid: options.grid || 15,
            ...options
        };

        // État de l'éditeur
        this.events = []; // CC et pitchbend events
        this.selectedEvents = new Set();
        this.currentTool = 'select'; // 'select', 'move', 'line', 'draw'
        this.currentCC = 'cc1'; // 'cc1', 'cc7', 'cc10', 'cc11', 'pitchbend'
        this.currentChannel = 0;
        this.isDrawing = false;
        this.lastDrawPosition = null;
        this.lastDrawTicks = null; // Dernier tick où un point a été créé en mode dessin

        // Historique pour undo/redo
        this.history = [];
        this.historyIndex = -1;

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
        this.element.className = 'cc-pitchbend-editor';
        this.element.style.cssText = `
            width: 100%;
            height: ${this.options.height}px;
            background: #1a1a1a;
            border-top: 1px solid #333;
            position: relative;
            overflow: hidden;
        `;

        // Canvas pour le rendu
        this.canvas = document.createElement('canvas');
        this.canvas.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
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
        const rect = this.container.getBoundingClientRect();
        this.canvas.width = rect.width;
        this.canvas.height = this.options.height;
        this.render();
    }

    // === Gestion des outils ===

    setTool(tool) {
        this.currentTool = tool;
        this.canvas.style.cursor = tool === 'draw' ? 'crosshair' : 'default';
    }

    setCC(ccType) {
        this.currentCC = ccType;
        this.render();
    }

    setChannel(channel) {
        this.currentChannel = channel;
        this.render();
    }

    // === Conversion coordonnées ===

    ticksToX(ticks) {
        return ((ticks - this.options.xoffset) / this.options.xrange) * this.canvas.width;
    }

    xToTicks(x) {
        return Math.round((x / this.canvas.width) * this.options.xrange + this.options.xoffset);
    }

    valueToY(value) {
        // Pour CC: 0-127 → bottom to top
        // Pour pitchbend: -8192 to 8191 → bottom to top
        let normalized;
        if (this.currentCC === 'pitchbend') {
            normalized = (value + 8192) / 16383; // -8192..8191 → 0..1
        } else {
            normalized = value / 127; // 0..127 → 0..1
        }
        return this.canvas.height - (normalized * this.canvas.height);
    }

    yToValue(y) {
        const normalized = 1 - (y / this.canvas.height);
        if (this.currentCC === 'pitchbend') {
            return Math.round(normalized * 16383 - 8192);
        } else {
            return Math.round(normalized * 127);
        }
    }

    snapToGrid(ticks) {
        const gridSize = this.options.grid;
        return Math.round(ticks / gridSize) * gridSize;
    }

    // === Gestion des événements ===

    addEvent(ticks, value, channel = this.currentChannel, autoSave = true) {
        const snappedTicks = this.snapToGrid(ticks);

        // Vérifier si un événement existe déjà à ce tick (pour éviter les doublons)
        const existingEvent = this.events.find(e =>
            e.ticks === snappedTicks &&
            e.type === this.currentCC &&
            e.channel === channel
        );

        if (existingEvent) {
            // Mettre à jour la valeur existante
            existingEvent.value = this.clampValue(value);
            if (autoSave) {
                this.render();
            }
            return existingEvent;
        }

        const event = {
            type: this.currentCC,
            ticks: snappedTicks,
            value: this.clampValue(value),
            channel: channel,
            id: Date.now() + Math.random()
        };
        this.events.push(event);

        if (autoSave) {
            this.saveState();
            this.render();
        }

        return event;
    }

    removeEvents(eventIds) {
        this.events = this.events.filter(e => !eventIds.includes(e.id));
        this.selectedEvents.clear();
        this.saveState();
        this.render();
    }

    moveEvents(eventIds, deltaTicks, deltaValue) {
        eventIds.forEach(id => {
            const event = this.events.find(e => e.id === id);
            if (event) {
                event.ticks = this.snapToGrid(Math.max(0, event.ticks + deltaTicks));
                event.value = this.clampValue(event.value + deltaValue);
            }
        });
        this.saveState();
        this.render();
    }

    clampValue(value) {
        if (this.currentCC === 'pitchbend') {
            return Math.max(-8192, Math.min(8191, value));
        } else {
            return Math.max(0, Math.min(127, value));
        }
    }

    // === Outils d'édition ===

    handleMouseDown(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const ticks = this.xToTicks(x);
        const value = this.yToValue(y);

        switch (this.currentTool) {
            case 'draw':
                this.isDrawing = true;
                this.lastDrawPosition = { x, y };
                this.lastDrawTicks = this.snapToGrid(ticks);
                this.addEvent(ticks, value, this.currentChannel, false); // Ne pas sauvegarder immédiatement
                this.render();
                break;

            case 'line':
                if (!this.lineStart) {
                    this.lineStart = { ticks, value };
                } else {
                    this.createLine(this.lineStart.ticks, this.lineStart.value, ticks, value);
                    this.lineStart = null;
                }
                break;

            case 'select':
                const clickedEvent = this.getEventAtPosition(x, y);
                if (clickedEvent) {
                    if (e.shiftKey) {
                        if (this.selectedEvents.has(clickedEvent.id)) {
                            this.selectedEvents.delete(clickedEvent.id);
                        } else {
                            this.selectedEvents.add(clickedEvent.id);
                        }
                    } else {
                        this.selectedEvents.clear();
                        this.selectedEvents.add(clickedEvent.id);
                    }
                    this.dragStart = { x, y, ticks, value };
                } else {
                    if (!e.shiftKey) {
                        this.selectedEvents.clear();
                    }
                    this.selectionStart = { x, y };
                }
                this.render();
                break;

            case 'move':
                const moveEvent = this.getEventAtPosition(x, y);
                if (moveEvent) {
                    if (!this.selectedEvents.has(moveEvent.id)) {
                        this.selectedEvents.clear();
                        this.selectedEvents.add(moveEvent.id);
                    }
                    this.dragStart = { x, y, ticks, value };
                }
                this.render();
                break;
        }
    }

    handleMouseMove(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const ticks = this.xToTicks(x);
        const value = this.yToValue(y);

        if (this.isDrawing && this.currentTool === 'draw') {
            // Dessin continu - créer un point seulement si on a avancé d'au moins un tick de grille
            const snappedTicks = this.snapToGrid(ticks);
            if (this.lastDrawTicks === null || Math.abs(snappedTicks - this.lastDrawTicks) >= this.options.grid) {
                this.addEvent(ticks, value, this.currentChannel, false); // Ne pas sauvegarder immédiatement
                this.lastDrawTicks = snappedTicks;
                this.lastDrawPosition = { x, y };
                this.render();
            }
        } else if (this.dragStart && (this.currentTool === 'select' || this.currentTool === 'move')) {
            // Déplacement des événements sélectionnés
            if (this.selectedEvents.size > 0) {
                const deltaTicks = this.xToTicks(x) - this.dragStart.ticks;
                const deltaValue = this.yToValue(y) - this.dragStart.value;

                Array.from(this.selectedEvents).forEach(id => {
                    const event = this.events.find(e => e.id === id);
                    if (event) {
                        event.ticks = this.snapToGrid(Math.max(0, event.ticks + deltaTicks));
                        event.value = this.clampValue(event.value + deltaValue);
                    }
                });

                this.dragStart = { x, y, ticks, value };
                this.render();
            }
        } else if (this.selectionStart) {
            // Rectangle de sélection
            this.renderSelectionRect(this.selectionStart.x, this.selectionStart.y, x, y);
        } else if (this.lineStart) {
            // Prévisualisation de la ligne
            this.renderLinePreview(this.lineStart, { ticks, value });
        }
    }

    handleMouseUp(e) {
        if (this.isDrawing) {
            this.isDrawing = false;
            this.lastDrawPosition = null;
            this.lastDrawTicks = null;
            // Sauvegarder l'état après avoir fini de dessiner
            this.saveState();
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
            this.dragStart = null;
        }

        this.render();
    }

    handleMouseLeave(e) {
        this.handleMouseUp(e);
    }

    handleKeyDown(e) {
        if (e.key === 'Delete' || e.key === 'Backspace') {
            if (this.selectedEvents.size > 0) {
                this.removeEvents(Array.from(this.selectedEvents));
            }
        } else if (e.key === 'Escape') {
            this.selectedEvents.clear();
            this.lineStart = null;
            this.render();
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

    getEventAtPosition(x, y, threshold = 5) {
        const ticks = this.xToTicks(x);
        const value = this.yToValue(y);

        return this.getFilteredEvents().find(event => {
            const ex = this.ticksToX(event.ticks);
            const ey = this.valueToY(event.value);
            return Math.abs(ex - x) <= threshold && Math.abs(ey - y) <= threshold;
        });
    }

    selectInRect(x1, y1, x2, y2) {
        const left = Math.min(x1, x2);
        const right = Math.max(x1, x2);
        const top = Math.min(y1, y2);
        const bottom = Math.max(y1, y2);

        this.getFilteredEvents().forEach(event => {
            const ex = this.ticksToX(event.ticks);
            const ey = this.valueToY(event.value);
            if (ex >= left && ex <= right && ey >= top && ey <= bottom) {
                this.selectedEvents.add(event.id);
            }
        });
    }

    selectAll() {
        this.selectedEvents.clear();
        this.getFilteredEvents().forEach(event => {
            this.selectedEvents.add(event.id);
        });
        this.render();
    }

    // === Outil ligne ===

    createLine(startTicks, startValue, endTicks, endValue) {
        const minTicks = Math.min(startTicks, endTicks);
        const maxTicks = Math.max(startTicks, endTicks);
        const ticksRange = maxTicks - minTicks;
        const valueRange = endValue - startValue;

        // Créer des points le long de la ligne selon la grille
        // Utiliser autoSave=false pour ne pas sauvegarder à chaque point
        for (let t = minTicks; t <= maxTicks; t += this.options.grid) {
            const progress = ticksRange > 0 ? (t - minTicks) / ticksRange : 0;
            const value = Math.round(startValue + valueRange * progress);
            this.addEvent(t, value, this.currentChannel, false);
        }

        // Sauvegarder l'état une seule fois à la fin
        this.saveState();
        this.render();
    }

    // === Rendu ===

    render() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Grille de fond
        this.renderGrid();

        // Ligne médiane (0 pour pitchbend, 64 pour CC)
        this.renderCenterLine();

        // Événements
        this.renderEvents();
    }

    renderGrid() {
        const labelMargin = 50; // Marge pour les labels à gauche

        // Grille verticale (temps)
        this.ctx.strokeStyle = '#2a2a2a';
        this.ctx.lineWidth = 1;

        const gridSize = this.options.grid;
        const startTick = Math.floor(this.options.xoffset / gridSize) * gridSize;
        const endTick = this.options.xoffset + this.options.xrange;

        for (let t = startTick; t <= endTick; t += gridSize) {
            const x = this.ticksToX(t);
            if (x >= 0 && x <= this.canvas.width) {
                this.ctx.beginPath();
                this.ctx.moveTo(Math.max(x, labelMargin), 0);
                this.ctx.lineTo(x, this.canvas.height);
                this.ctx.stroke();
            }
        }

        // Grille horizontale (valeurs)
        if (this.currentCC === 'pitchbend') {
            // Pour pitchbend : lignes aux valeurs -8192, -4096, 0, 4096, 8191
            const values = [-8192, -4096, 0, 4096, 8191];
            this.ctx.strokeStyle = '#2a2a2a';
            this.ctx.lineWidth = 1;

            values.forEach(value => {
                const y = this.valueToY(value);

                // Ligne de grille
                this.ctx.beginPath();
                this.ctx.moveTo(labelMargin, y);
                this.ctx.lineTo(this.canvas.width, y);
                this.ctx.stroke();

                // Zone de label (fond)
                this.ctx.fillStyle = '#1a1a1a';
                this.ctx.fillRect(0, y - 7, labelMargin - 2, 14);

                // Label
                this.ctx.fillStyle = '#888';
                this.ctx.font = '11px monospace';
                this.ctx.textAlign = 'right';
                this.ctx.fillText(value.toString(), labelMargin - 5, y + 4);
            });
        } else {
            // Pour CC : lignes aux valeurs 0, 32, 64, 96, 127
            const values = [0, 32, 64, 96, 127];
            this.ctx.strokeStyle = '#2a2a2a';
            this.ctx.lineWidth = 1;

            values.forEach(value => {
                const y = this.valueToY(value);

                // Ligne de grille
                this.ctx.beginPath();
                this.ctx.moveTo(labelMargin, y);
                this.ctx.lineTo(this.canvas.width, y);
                this.ctx.stroke();

                // Zone de label (fond)
                this.ctx.fillStyle = '#1a1a1a';
                this.ctx.fillRect(0, y - 7, labelMargin - 2, 14);

                // Label
                this.ctx.fillStyle = '#888';
                this.ctx.font = '11px monospace';
                this.ctx.textAlign = 'right';
                this.ctx.fillText(value.toString(), labelMargin - 5, y + 4);
            });
        }

        // Bordure verticale séparant la zone de labels
        this.ctx.strokeStyle = '#333';
        this.ctx.lineWidth = 1;
        this.ctx.beginPath();
        this.ctx.moveTo(labelMargin, 0);
        this.ctx.lineTo(labelMargin, this.canvas.height);
        this.ctx.stroke();

        // Réinitialiser l'alignement du texte
        this.ctx.textAlign = 'left';
    }

    renderCenterLine() {
        const filteredEvents = this.getFilteredEvents();
        const labelMargin = 50;

        if (this.currentCC === 'pitchbend') {
            // Pour pitchbend : toujours afficher une barre centrale à 0
            this.ctx.strokeStyle = '#888';
            this.ctx.lineWidth = 2;
            const y = this.valueToY(0);
            this.ctx.beginPath();
            this.ctx.moveTo(labelMargin, y);
            this.ctx.lineTo(this.canvas.width, y);
            this.ctx.stroke();
        } else {
            // Pour CC : afficher une barre à 0 si pas d'événements
            if (filteredEvents.length === 0) {
                this.ctx.strokeStyle = '#666';
                this.ctx.lineWidth = 2;
                this.ctx.setLineDash([5, 5]);
                const y = this.valueToY(0);
                this.ctx.beginPath();
                this.ctx.moveTo(labelMargin, y);
                this.ctx.lineTo(this.canvas.width, y);
                this.ctx.stroke();
                this.ctx.setLineDash([]);
            }
        }
    }

    renderEvents() {
        const events = this.getFilteredEvents();

        // Trier par ticks
        events.sort((a, b) => a.ticks - b.ticks);

        // Dessiner les lignes connectant les événements
        if (events.length > 1) {
            this.ctx.strokeStyle = '#4CAF50';
            this.ctx.lineWidth = 2;

            // CC et Pitchbend : courbe en escalier (valeurs discrètes)
            this.ctx.beginPath();
            events.forEach((event, i) => {
                const x = this.ticksToX(event.ticks);
                const y = this.valueToY(event.value);

                if (i === 0) {
                    this.ctx.moveTo(x, y);
                } else {
                    const prevEvent = events[i - 1];
                    const prevX = this.ticksToX(prevEvent.ticks);
                    const prevY = this.valueToY(prevEvent.value);

                    // Ligne horizontale depuis le point précédent jusqu'à l'abscisse du point actuel
                    this.ctx.lineTo(x, prevY);
                    // Ligne verticale jusqu'au point actuel
                    this.ctx.lineTo(x, y);
                }
            });
            this.ctx.stroke();
        } else if (events.length === 1) {
            // Si un seul événement, afficher une ligne horizontale
            this.ctx.strokeStyle = '#4CAF50';
            this.ctx.lineWidth = 2;
            this.ctx.beginPath();
            const x = this.ticksToX(events[0].ticks);
            const y = this.valueToY(events[0].value);
            this.ctx.moveTo(x, y);
            this.ctx.lineTo(this.canvas.width, y);
            this.ctx.stroke();
        }

        // Dessiner les points
        events.forEach(event => {
            const x = this.ticksToX(event.ticks);
            const y = this.valueToY(event.value);
            const isSelected = this.selectedEvents.has(event.id);

            this.ctx.fillStyle = isSelected ? '#FFC107' : '#4CAF50';
            this.ctx.beginPath();
            this.ctx.arc(x, y, isSelected ? 5 : 3, 0, 2 * Math.PI);
            this.ctx.fill();
        });
    }

    renderSelectionRect(x1, y1, x2, y2) {
        this.render();
        this.ctx.strokeStyle = '#2196F3';
        this.ctx.lineWidth = 1;
        this.ctx.setLineDash([5, 5]);
        this.ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
        this.ctx.setLineDash([]);
    }

    renderLinePreview(start, end) {
        this.render();
        this.ctx.strokeStyle = '#9E9E9E';
        this.ctx.lineWidth = 1;
        this.ctx.setLineDash([5, 5]);
        this.ctx.beginPath();
        this.ctx.moveTo(this.ticksToX(start.ticks), this.valueToY(start.value));
        this.ctx.lineTo(this.ticksToX(end.ticks), this.valueToY(end.value));
        this.ctx.stroke();
        this.ctx.setLineDash([]);
    }

    // === Filtrage ===

    getFilteredEvents() {
        return this.events.filter(event =>
            event.type === this.currentCC &&
            event.channel === this.currentChannel
        );
    }

    // === Synchronisation ===

    syncWith(pianoRoll) {
        // Synchroniser avec les paramètres du piano roll
        this.options.xrange = pianoRoll.xrange || this.options.xrange;
        this.options.xoffset = pianoRoll.xoffset || this.options.xoffset;
        this.options.grid = pianoRoll.grid || this.options.grid;
        this.options.timebase = pianoRoll.timebase || this.options.timebase;
        this.render();
    }

    // === Undo/Redo ===

    saveState() {
        const state = JSON.stringify(this.events);
        if (this.history[this.historyIndex] !== state) {
            this.history = this.history.slice(0, this.historyIndex + 1);
            this.history.push(state);
            this.historyIndex++;

            // Limiter l'historique
            if (this.history.length > 50) {
                this.history.shift();
                this.historyIndex--;
            }
        }
    }

    undo() {
        if (this.historyIndex > 0) {
            this.historyIndex--;
            this.events = JSON.parse(this.history[this.historyIndex]);
            this.selectedEvents.clear();
            this.render();
        }
    }

    redo() {
        if (this.historyIndex < this.history.length - 1) {
            this.historyIndex++;
            this.events = JSON.parse(this.history[this.historyIndex]);
            this.selectedEvents.clear();
            this.render();
        }
    }

    // === Import/Export ===

    loadEvents(events) {
        this.events = events.map(e => ({
            ...e,
            id: e.id || (Date.now() + Math.random())
        }));
        this.saveState();
        this.render();
    }

    getEvents() {
        return this.events;
    }

    clear() {
        this.events = [];
        this.selectedEvents.clear();
        this.saveState();
        this.render();
    }

    // === Cleanup ===

    destroy() {
        this.canvas.removeEventListener('mousedown', this.handleMouseDown);
        this.canvas.removeEventListener('mousemove', this.handleMouseMove);
        this.canvas.removeEventListener('mouseup', this.handleMouseUp);
        this.canvas.removeEventListener('mouseleave', this.handleMouseLeave);
        document.removeEventListener('keydown', this.handleKeyDown);
        window.removeEventListener('resize', this.resize);

        if (this.element && this.element.parentNode) {
            this.element.parentNode.removeChild(this.element);
        }
    }
}

// Export pour utilisation
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CCPitchbendEditor;
}
