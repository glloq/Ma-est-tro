// ============================================================================
// Fichier: frontend/js/views/KeyboardView.js
// Chemin réel: frontend/js/views/KeyboardView.js
// Version: v5.0.0 - FULLY FUNCTIONAL & CORRECTED
// Date: 2025-11-06
// ============================================================================
// CORRECTIONS MAJEURES v5.0.0:
// ✅ CRITIQUE: render() implémenté correctement (pas buildTemplate)
// ✅ CRITIQUE: buildHTML() séparé pour construction template
// ✅ CRITIQUE: Suppression super.attachEvents() (n'existe pas dans BaseView)
// ✅ CRITIQUE: Event handlers bindés dans constructor (memory leak fix)
// ✅ CRITIQUE: Événements EventBus standardisés (keyboard:*)
// ✅ CRITIQUE: device_id utilisé partout de manière cohérente
// ✅ CRITIQUE: Communication View→Controller via événements propres
// ✅ Cleanup complet dans destroy()
// ✅ Gestion canvas avec resize automatique
// ✅ Support touch pour mobile
// ✅ Performance optimisée
// ============================================================================

class KeyboardView extends BaseView {
    constructor(containerId, eventBus) {
        super(containerId, eventBus);
        
        // Configuration de la vue
        this.config.autoRender = false;
        this.config.name = 'KeyboardView';
        this.config.enableLogging = true;
        
        // État de la vue
        this.viewState = {
            selectedDevice: null,
            devices: [],
            noteRange: { min: 21, max: 108 }, // 88 touches (A0 à C8)
            velocity: 80,
            activeNotes: new Set(),
            octaveOffset: 0,
            isMouseDown: false,
            lastPlayedNote: null,
            keyboardLayout: 'azerty' // azerty ou qwerty
        };
        
        // Configuration Canvas
        this.canvas = null;
        this.ctx = null;
        this.keyWidth = 40; // Plus large pour mieux voir
        this.whiteKeyHeight = 160; // Plus haut
        this.blackKeyHeight = 100;
        this.minKeyWidth = 30;
        this.maxKeyWidth = 50;
        this.scrollOffset = 0; // Position du scroll
        
        // Keyboard mapping (touches ordinateur → notes MIDI)
        this.keyMaps = {
            azerty: {
                // Octave inférieure (touches ZXCVBNM,;:!)
                'KeyZ': 0, 'KeyS': 1, 'KeyX': 2, 'KeyD': 3, 'KeyC': 4,
                'KeyV': 5, 'KeyG': 6, 'KeyB': 7, 'KeyH': 8, 'KeyN': 9,
                'KeyJ': 10, 'Comma': 11,

                // Octave supérieure (touches AZERTYUIOP)
                'KeyA': 12, 'Digit2': 13, 'KeyQ': 14, 'Digit3': 15, 'KeyW': 16,
                'KeyE': 17, 'Digit5': 18, 'KeyR': 19, 'Digit6': 20, 'KeyT': 21,
                'Digit7': 22, 'KeyY': 23, 'KeyU': 24, 'Digit9': 25, 'KeyI': 26,
                'Digit0': 27, 'KeyO': 28, 'KeyP': 29
            },
            qwerty: {
                // Octave inférieure (touches ZXCVBNM,)
                'KeyZ': 0, 'KeyS': 1, 'KeyX': 2, 'KeyD': 3, 'KeyC': 4,
                'KeyV': 5, 'KeyG': 6, 'KeyB': 7, 'KeyH': 8, 'KeyN': 9,
                'KeyJ': 10, 'KeyM': 11,

                // Octave supérieure (touches QWERTYUIOP)
                'KeyQ': 12, 'Digit2': 13, 'KeyW': 14, 'Digit3': 15, 'KeyE': 16,
                'KeyR': 17, 'Digit5': 18, 'KeyT': 19, 'Digit6': 20, 'KeyY': 21,
                'Digit7': 22, 'KeyU': 23, 'KeyI': 24, 'Digit9': 25, 'KeyO': 26,
                'Digit0': 27, 'KeyP': 28
            }
        };

        this.keyMap = this.keyMaps.azerty; // Par défaut AZERTY
        
        // État des touches pressées (éviter répétitions)
        this.pressedKeys = new Set();
        
        // ✅ CORRECTION: Binder les event handlers dans constructor
        this.handleKeyDown = this.handleKeyDown.bind(this);
        this.handleKeyUp = this.handleKeyUp.bind(this);
        this.handleMouseDown = this.handleMouseDown.bind(this);
        this.handleMouseUp = this.handleMouseUp.bind(this);
        this.handleMouseMove = this.handleMouseMove.bind(this);
        this.handleMouseLeave = this.handleMouseLeave.bind(this);
        this.handleResize = this.handleResize.bind(this);
        
        // Touch support
        this.handleTouchStart = this.handleTouchStart.bind(this);
        this.handleTouchEnd = this.handleTouchEnd.bind(this);
        this.handleTouchMove = this.handleTouchMove.bind(this);
        
        this.log('info', 'KeyboardView v5.0.0 initialized');
    }
    
    // ========================================================================
    // CYCLE DE VIE - RENDU
    // ========================================================================
    
    /**
     * ✅ CORRECTION: Implémentation render() conforme à BaseView
     * Remplace buildTemplate() qui n'existe pas dans BaseView
     */
    render(data = null) {
        if (!this.container) {
            this.log('error', 'Cannot render: container not found');
            return;
        }
        
        // Fusionner données
        const renderData = { ...this.viewState, ...data };
        
        // Construire et injecter HTML
        this.container.innerHTML = this.buildHTML(renderData);
        
        // Attacher les événements après rendu
        this.attachEvents();
        
        // Initialiser le canvas
        this.initializeCanvas();
        
        this.state.rendered = true;
        this.log('debug', 'KeyboardView rendered');
    }
    
    /**
     * ✅ NOUVEAU: Construction template HTML séparé
     * @param {Object} state - État de la vue
     * @returns {string} HTML template
     */
    buildHTML(state = {}) {
        return `
            <div class="keyboard-view">
                <div class="keyboard-layout">
                    <!-- Slider vélocité vertical à gauche -->
                    <div class="velocity-control-vertical">
                        <label class="velocity-label-vertical">Vélocité</label>
                        <div class="velocity-slider-wrapper">
                            <input type="range"
                                   class="velocity-slider-vertical"
                                   min="1"
                                   max="127"
                                   value="${state.velocity}"
                                   data-action="set-velocity"
                                   orient="vertical" />
                        </div>
                        <div class="velocity-value-vertical">${state.velocity}</div>
                    </div>

                    <!-- Zone principale du clavier -->
                    <div class="keyboard-main">
                        <div class="keyboard-header">
                            <div class="keyboard-controls">
                                <div class="control-group">
                                    <label>Instrument:</label>
                                    <select class="device-select" data-action="select-device">
                                        <option value="">-- Sélectionner un instrument --</option>
                                        ${(state.devices || []).map(d => `
                                            <option value="${d.device_id}"
                                                    ${state.selectedDevice?.device_id === d.device_id ? 'selected' : ''}>
                                                ${this.escapeHtml(d.name || `Device ${d.device_id}`)}
                                            </option>
                                        `).join('')}
                                    </select>
                                </div>

                                <div class="control-group octave-controls">
                                    <button class="btn-octave-down"
                                            data-action="octave-down"
                                            title="Octave -1">◄</button>
                                    <span class="octave-display">Octave: ${state.octaveOffset > 0 ? '+' : ''}${state.octaveOffset}</span>
                                    <button class="btn-octave-up"
                                            data-action="octave-up"
                                            title="Octave +1">►</button>
                                </div>

                                <div class="control-group">
                                    <label>Layout clavier:</label>
                                    <select class="layout-select" data-action="change-layout">
                                        <option value="azerty" ${state.keyboardLayout === 'azerty' ? 'selected' : ''}>AZERTY</option>
                                        <option value="qwerty" ${state.keyboardLayout === 'qwerty' ? 'selected' : ''}>QWERTY</option>
                                    </select>
                                </div>

                                <div class="info-item">
                                    <span class="info-label">Notes actives:</span>
                                    <span class="info-value">${state.activeNotes.size}</span>
                                </div>
                            </div>
                        </div>

                        <div class="keyboard-canvas-container">
                            <canvas id="keyboardCanvas"
                                    class="keyboard-canvas"
                                    tabindex="0"
                                    aria-label="Clavier MIDI interactif"></canvas>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
    
    // ========================================================================
    // ÉVÉNEMENTS DOM
    // ========================================================================
    
    /**
     * ✅ CORRECTION: Pas d'appel super.attachEvents() 
     * (méthode n'existe pas dans BaseView)
     */
    attachEvents() {
        if (!this.container) {
            this.log('warn', 'Cannot attach events: container not found');
            return;
        }
        
        this.setupDOMEvents();
        this.setupKeyboardEvents();
        this.setupEventBusListeners();
        
        this.log('debug', 'Events attached');
    }
    
    /**
     * Configure les événements DOM (clicks, sliders, etc.)
     */
    setupDOMEvents() {
        // Événements sur les contrôles
        this.container.addEventListener('change', (e) => {
            const action = e.target.dataset.action;
            
            if (action === 'select-device') {
                this.handleDeviceSelect(e.target.value);
            } else if (action === 'set-velocity') {
                this.handleVelocityChange(parseInt(e.target.value, 10));
            } else if (action === 'change-layout') {
                this.handleLayoutChange(e.target.value);
            }
        });
        
        // Clicks sur boutons
        this.container.addEventListener('click', (e) => {
            const action = e.target.dataset.action;
            
            if (action === 'octave-up') {
                this.handleOctaveChange(1);
            } else if (action === 'octave-down') {
                this.handleOctaveChange(-1);
            }
        });
        
        // Événements Canvas (après initialisation)
        if (this.canvas) {
            this.attachCanvasEvents();
        }
        
        // Resize window
        window.addEventListener('resize', this.handleResize);
    }
    
    /**
     * Configure les événements clavier ordinateur
     */
    setupKeyboardEvents() {
        // ✅ CORRECTION: Utilisation de handlers bindés
        window.addEventListener('keydown', this.handleKeyDown);
        window.addEventListener('keyup', this.handleKeyUp);
        
        this.log('debug', 'Keyboard events attached');
    }
    
    /**
     * Attache événements sur canvas
     */
    attachCanvasEvents() {
        if (!this.canvas) return;
        
        // Mouse events
        this.canvas.addEventListener('mousedown', this.handleMouseDown);
        this.canvas.addEventListener('mouseup', this.handleMouseUp);
        this.canvas.addEventListener('mousemove', this.handleMouseMove);
        this.canvas.addEventListener('mouseleave', this.handleMouseLeave);
        
        // Touch events pour mobile
        this.canvas.addEventListener('touchstart', this.handleTouchStart, { passive: false });
        this.canvas.addEventListener('touchend', this.handleTouchEnd, { passive: false });
        this.canvas.addEventListener('touchmove', this.handleTouchMove, { passive: false });
        
        this.log('debug', 'Canvas events attached');
    }
    
    /**
     * ✅ CORRECTION: Événements EventBus standardisés avec préfixe "keyboard:"
     */
    setupEventBusListeners() {
        if (!this.eventBus) {
            this.log('warn', 'EventBus not available');
            return;
        }
        
        // Écoute des devices disponibles
        const devicesSub = this.eventBus.on('keyboard:devices-loaded', (data) => {
            this.log('debug', `Received ${data.devices?.length || 0} devices`);
            this.handleDevicesLoaded(data);
        });
        this.eventSubscriptions.push(devicesSub);
        
        // Écoute des notes jouées (feedback depuis controller)
        const noteOnSub = this.eventBus.on('keyboard:note-on', (data) => {
            this.handleNoteOnFeedback(data);
        });
        this.eventSubscriptions.push(noteOnSub);
        
        const noteOffSub = this.eventBus.on('keyboard:note-off', (data) => {
            this.handleNoteOffFeedback(data);
        });
        this.eventSubscriptions.push(noteOffSub);
        
        // Écoute device sélectionné
        const deviceSelectedSub = this.eventBus.on('keyboard:device-selected', (data) => {
            this.log('info', `Device selected: ${data.device_id}`);
        });
        this.eventSubscriptions.push(deviceSelectedSub);
        
        this.log('debug', 'EventBus listeners attached');
    }
    
    // ========================================================================
    // HANDLERS - CONTRÔLES UI
    // ========================================================================
    
    /**
     * ✅ CORRECTION: Émet événement vers controller au lieu d'agir directement
     */
    handleDeviceSelect(deviceId) {
        if (!deviceId) {
            this.viewState.selectedDevice = null;
            return;
        }
        
        // Trouver le device
        const device = this.viewState.devices.find(d => d.device_id === deviceId);
        
        if (!device) {
            this.log('warn', `Device ${deviceId} not found`);
            return;
        }
        
        this.viewState.selectedDevice = device;
        
        // ✅ Émettre événement vers controller
        this.emit('select-device', { device_id: deviceId });
        
        this.log('info', `Selected device: ${device.name || deviceId}`);
    }
    
    /**
     * Change la vélocité
     */
    handleVelocityChange(newVelocity) {
        this.viewState.velocity = Math.max(1, Math.min(127, newVelocity));

        // Mettre à jour l'affichage (vertical)
        const valueSpan = this.container.querySelector('.velocity-value-vertical');
        if (valueSpan) {
            valueSpan.textContent = this.viewState.velocity;
        }

        // ✅ Émettre événement vers controller
        this.emit('velocity-changed', { velocity: this.viewState.velocity });

        this.log('debug', `Velocity changed to ${this.viewState.velocity}`);
    }

    /**
     * Change le layout du clavier (AZERTY/QWERTY)
     */
    handleLayoutChange(layout) {
        this.viewState.keyboardLayout = layout;
        this.keyMap = this.keyMaps[layout] || this.keyMaps.azerty;

        this.log('info', `Keyboard layout changed to ${layout.toUpperCase()}`);

        // Émettre événement
        this.emit('layout-changed', { layout: layout });
    }

    /**
     * Change l'octave offset
     */
    handleOctaveChange(delta) {
        const newOffset = this.viewState.octaveOffset + delta;
        
        // Limiter l'offset pour rester dans la plage MIDI valide
        if (newOffset < -5 || newOffset > 5) {
            this.log('warn', 'Octave offset limit reached');
            return;
        }
        
        this.viewState.octaveOffset = newOffset;
        
        // Mettre à jour l'affichage
        const display = this.container.querySelector('.octave-display');
        if (display) {
            display.textContent = `Octave: ${newOffset > 0 ? '+' : ''}${newOffset}`;
        }
        
        // Redessiner le clavier
        this.drawKeyboard();
        
        // ✅ Émettre événement vers controller
        this.emit('octave-changed', { offset: newOffset });
        
        this.log('debug', `Octave offset: ${newOffset}`);
    }
    
    /**
     * Gère le chargement des devices
     */
    handleDevicesLoaded(data) {
        this.log('info', 'handleDevicesLoaded called with:', data);

        this.viewState.devices = data.devices || [];

        this.log('info', `Received ${this.viewState.devices.length} devices from event`);

        // Les devices sont déjà filtrés par la modal, pas besoin de re-filtrer
        // this.viewState.devices = this.viewState.devices.filter(d => d.status === 2);

        this.log('info', `Devices to display: ${this.viewState.devices.length}`, this.viewState.devices);

        // Re-render pour mettre à jour le select
        this.render();

        this.log('info', 'KeyboardView re-rendered with devices');
    }
    
    // ========================================================================
    // HANDLERS - CLAVIER ORDINATEUR
    // ========================================================================
    
    /**
     * Touche pressée
     */
    handleKeyDown(e) {
        // Éviter répétitions
        if (e.repeat) return;
        
        // Ignorer si focus sur input
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') {
            return;
        }
        
        const noteOffset = this.keyMap[e.code];
        
        if (noteOffset === undefined) return;
        
        // Vérifier si déjà pressée
        if (this.pressedKeys.has(e.code)) return;
        
        this.pressedKeys.add(e.code);
        e.preventDefault();
        
        // Calculer note absolue avec octave offset
        const baseNote = 60; // C4
        const note = baseNote + noteOffset + (this.viewState.octaveOffset * 12);
        
        // Vérifier plage valide
        if (note < 0 || note > 127) {
            this.log('warn', `Note ${note} out of MIDI range`);
            return;
        }
        
        this.playNote(note, this.viewState.velocity);
    }
    
    /**
     * Touche relâchée
     */
    handleKeyUp(e) {
        const noteOffset = this.keyMap[e.code];
        
        if (noteOffset === undefined) return;
        
        this.pressedKeys.delete(e.code);
        e.preventDefault();
        
        // Calculer note
        const baseNote = 60;
        const note = baseNote + noteOffset + (this.viewState.octaveOffset * 12);
        
        if (note < 0 || note > 127) return;
        
        this.stopNote(note);
    }
    
    // ========================================================================
    // HANDLERS - SOURIS / TOUCH
    // ========================================================================
    
    /**
     * Souris pressée sur canvas
     */
    handleMouseDown(e) {
        if (!this.canvas) return;
        
        this.viewState.isMouseDown = true;
        
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        const note = this.getNoteAtPosition(x, y);
        
        if (note !== null) {
            this.viewState.lastPlayedNote = note;
            this.playNote(note, this.viewState.velocity);
        }
    }
    
    /**
     * Souris relâchée
     */
    handleMouseUp(e) {
        if (!this.canvas || !this.viewState.isMouseDown) return;
        
        this.viewState.isMouseDown = false;
        
        if (this.viewState.lastPlayedNote !== null) {
            this.stopNote(this.viewState.lastPlayedNote);
            this.viewState.lastPlayedNote = null;
        }
    }
    
    /**
     * Souris déplacée
     */
    handleMouseMove(e) {
        if (!this.canvas || !this.viewState.isMouseDown) return;
        
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        const note = this.getNoteAtPosition(x, y);
        
        // Si changement de note pendant drag
        if (note !== null && note !== this.viewState.lastPlayedNote) {
            // Arrêter l'ancienne note
            if (this.viewState.lastPlayedNote !== null) {
                this.stopNote(this.viewState.lastPlayedNote);
            }
            
            // Jouer la nouvelle
            this.viewState.lastPlayedNote = note;
            this.playNote(note, this.viewState.velocity);
        }
    }
    
    /**
     * Souris sort du canvas
     */
    handleMouseLeave(e) {
        if (this.viewState.isMouseDown && this.viewState.lastPlayedNote !== null) {
            this.stopNote(this.viewState.lastPlayedNote);
            this.viewState.lastPlayedNote = null;
            this.viewState.isMouseDown = false;
        }
    }
    
    /**
     * Touch start (mobile)
     */
    handleTouchStart(e) {
        e.preventDefault();
        
        if (!this.canvas || e.touches.length === 0) return;
        
        const touch = e.touches[0];
        const rect = this.canvas.getBoundingClientRect();
        const x = touch.clientX - rect.left;
        const y = touch.clientY - rect.top;
        
        const note = this.getNoteAtPosition(x, y);
        
        if (note !== null) {
            this.viewState.lastPlayedNote = note;
            this.playNote(note, this.viewState.velocity);
        }
    }
    
    /**
     * Touch end (mobile)
     */
    handleTouchEnd(e) {
        e.preventDefault();
        
        if (this.viewState.lastPlayedNote !== null) {
            this.stopNote(this.viewState.lastPlayedNote);
            this.viewState.lastPlayedNote = null;
        }
    }
    
    /**
     * Touch move (mobile)
     */
    handleTouchMove(e) {
        e.preventDefault();
        
        if (!this.canvas || e.touches.length === 0) return;
        
        const touch = e.touches[0];
        const rect = this.canvas.getBoundingClientRect();
        const x = touch.clientX - rect.left;
        const y = touch.clientY - rect.top;
        
        const note = this.getNoteAtPosition(x, y);
        
        if (note !== null && note !== this.viewState.lastPlayedNote) {
            if (this.viewState.lastPlayedNote !== null) {
                this.stopNote(this.viewState.lastPlayedNote);
            }
            
            this.viewState.lastPlayedNote = note;
            this.playNote(note, this.viewState.velocity);
        }
    }
    
    /**
     * Resize window
     */
    handleResize() {
        if (this.canvas) {
            this.resizeCanvas();
            this.drawKeyboard();
        }
    }
    
    // ========================================================================
    // CANVAS - INITIALISATION
    // ========================================================================
    
    /**
     * Initialise le canvas
     */
    initializeCanvas() {
        this.canvas = document.getElementById('keyboardCanvas');
        
        if (!this.canvas) {
            this.log('error', 'Canvas element not found');
            return;
        }
        
        this.ctx = this.canvas.getContext('2d');
        
        if (!this.ctx) {
            this.log('error', 'Cannot get canvas context');
            return;
        }
        
        this.resizeCanvas();
        this.drawKeyboard();
        
        this.log('info', 'Canvas initialized');
    }
    
    /**
     * Redimensionne le canvas
     */
    resizeCanvas() {
        if (!this.canvas) return;
        
        const container = this.canvas.parentElement;
        
        if (!container) return;
        
        const width = container.clientWidth;
        const height = this.whiteKeyHeight;
        
        // Ajuster taille canvas
        this.canvas.width = width;
        this.canvas.height = height;
        
        // Recalculer largeur touches
        const visibleKeys = 24; // 2 octaves
        this.keyWidth = Math.floor(width / visibleKeys);
        this.keyWidth = Math.max(this.minKeyWidth, Math.min(this.maxKeyWidth, this.keyWidth));
        
        this.log('debug', `Canvas resized: ${width}x${height}, keyWidth: ${this.keyWidth}`);
    }
    
    // ========================================================================
    // CANVAS - DESSIN
    // ========================================================================
    
    /**
     * Dessine le clavier complet
     */
    drawKeyboard() {
        if (!this.ctx) return;

        const ctx = this.ctx;
        const width = this.canvas.width;
        const height = this.canvas.height;

        // Clear canvas
        ctx.clearRect(0, 0, width, height);

        // Dessiner fond
        ctx.fillStyle = '#f5f5f5';
        ctx.fillRect(0, 0, width, height);

        // Calculer combien de touches blanches on peut afficher
        const visibleWhiteKeys = Math.floor(width / this.keyWidth);

        // Note de départ basée sur l'octave offset
        const baseNote = 60; // C4
        const startNote = Math.max(21, baseNote + this.viewState.octaveOffset * 12 - 12);

        // Dessiner touches blanches visibles
        let x = 0;
        let displayedKeys = 0;

        for (let note = startNote; note <= 108 && displayedKeys < visibleWhiteKeys; note++) {
            if (this.isWhiteKey(note)) {
                this.drawWhiteKey(x, note);
                x += this.keyWidth;
                displayedKeys++;
            }
        }

        // Dessiner touches noires (par-dessus les blanches)
        x = 0;
        displayedKeys = 0;

        for (let note = startNote; note <= 108 && displayedKeys < visibleWhiteKeys; note++) {
            if (this.isWhiteKey(note)) {
                if (this.hasBlackKey(note)) {
                    this.drawBlackKey(x + this.keyWidth * 0.65, note + 1);
                }
                x += this.keyWidth;
                displayedKeys++;
            }
        }
    }
    
    /**
     * Dessine une touche blanche
     */
    drawWhiteKey(x, note) {
        const ctx = this.ctx;
        const isActive = this.viewState.activeNotes.has(note);
        
        // Couleur
        ctx.fillStyle = isActive ? '#4a9eff' : '#ffffff';
        ctx.fillRect(x, 0, this.keyWidth - 1, this.whiteKeyHeight);
        
        // Bordure
        ctx.strokeStyle = '#333333';
        ctx.lineWidth = 1;
        ctx.strokeRect(x, 0, this.keyWidth - 1, this.whiteKeyHeight);
        
        // Nom de la note (optionnel si espace suffisant)
        if (this.keyWidth >= 24 && note % 12 === 0) {
            const noteName = this.getNoteNameFromMidi(note);
            ctx.fillStyle = '#666666';
            ctx.font = '10px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(noteName, x + this.keyWidth / 2, this.whiteKeyHeight - 8);
        }
    }
    
    /**
     * Dessine une touche noire
     */
    drawBlackKey(x, note) {
        const ctx = this.ctx;
        const isActive = this.viewState.activeNotes.has(note);
        
        const blackKeyWidth = this.keyWidth * 0.6;
        
        // Couleur
        ctx.fillStyle = isActive ? '#4a9eff' : '#000000';
        ctx.fillRect(x, 0, blackKeyWidth, this.blackKeyHeight);
        
        // Bordure subtile
        if (!isActive) {
            ctx.strokeStyle = '#333333';
            ctx.lineWidth = 1;
            ctx.strokeRect(x, 0, blackKeyWidth, this.blackKeyHeight);
        }
    }
    
    // ========================================================================
    // CALCULS GÉOMÉTRIQUES
    // ========================================================================
    
    /**
     * Détermine la note à partir de la position (x, y)
     */
    getNoteAtPosition(x, y) {
        const baseNote = 60;
        const startNote = Math.max(21, baseNote + this.viewState.octaveOffset * 12 - 12);
        
        // Vérifier touches noires en premier (elles sont par-dessus)
        if (y < this.blackKeyHeight) {
            let keyX = 0;
            
            for (let note = startNote; note <= startNote + 24; note++) {
                if (this.isWhiteKey(note)) {
                    if (this.hasBlackKey(note)) {
                        const blackX = keyX + this.keyWidth * 0.65;
                        const blackWidth = this.keyWidth * 0.6;
                        
                        if (x >= blackX && x < blackX + blackWidth) {
                            return note + 1;
                        }
                    }
                    keyX += this.keyWidth;
                }
            }
        }
        
        // Touches blanches
        const keyIndex = Math.floor(x / this.keyWidth);
        let whiteKeyCount = 0;
        
        for (let note = startNote; note <= startNote + 24; note++) {
            if (this.isWhiteKey(note)) {
                if (whiteKeyCount === keyIndex) {
                    return note;
                }
                whiteKeyCount++;
            }
        }
        
        return null;
    }
    
    /**
     * Vérifie si une note est une touche blanche
     */
    isWhiteKey(note) {
        const noteInOctave = note % 12;
        return [0, 2, 4, 5, 7, 9, 11].includes(noteInOctave);
    }
    
    /**
     * Vérifie si une touche blanche a une touche noire à droite
     */
    hasBlackKey(note) {
        const noteInOctave = note % 12;
        return [0, 2, 5, 7, 9].includes(noteInOctave);
    }
    
    /**
     * Obtient le nom de la note depuis numéro MIDI
     */
    getNoteNameFromMidi(midiNote) {
        const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        const octave = Math.floor(midiNote / 12) - 1;
        const noteName = noteNames[midiNote % 12];
        return `${noteName}${octave}`;
    }
    
    // ========================================================================
    // ACTIONS MIDI
    // ========================================================================
    
    /**
     * ✅ CORRECTION: Émet événement vers controller au lieu d'agir directement
     * Joue une note
     */
    playNote(note, velocity) {
        if (!this.viewState.selectedDevice) {
            this.log('warn', 'No device selected, cannot play note');
            return;
        }
        
        // Vérifier plage
        if (note < this.viewState.noteRange.min || note > this.viewState.noteRange.max) {
            this.log('warn', `Note ${note} outside valid range`);
            return;
        }
        
        // Ajouter aux notes actives
        this.viewState.activeNotes.add(note);
        
        // Redessiner
        this.drawKeyboard();
        
        // ✅ Émettre événement vers controller
        this.emit('play-note', {
            note: note,
            velocity: velocity,
            channel: 0
        });
        
        this.log('debug', `Play note: ${this.getNoteNameFromMidi(note)} (${note}) vel=${velocity}`);
    }
    
    /**
     * ✅ CORRECTION: Émet événement vers controller au lieu d'agir directement
     * Arrête une note
     */
    stopNote(note) {
        if (!this.viewState.selectedDevice) {
            return;
        }
        
        // Retirer des notes actives
        this.viewState.activeNotes.delete(note);
        
        // Redessiner
        this.drawKeyboard();
        
        // ✅ Émettre événement vers controller
        this.emit('stop-note', {
            note: note,
            channel: 0
        });
        
        this.log('debug', `Stop note: ${this.getNoteNameFromMidi(note)} (${note})`);
    }
    
    // ========================================================================
    // FEEDBACK DEPUIS CONTROLLER
    // ========================================================================
    
    /**
     * Gère feedback note-on depuis controller
     */
    handleNoteOnFeedback(data) {
        if (data.note !== undefined) {
            this.viewState.activeNotes.add(data.note);
            this.drawKeyboard();
        }
    }
    
    /**
     * Gère feedback note-off depuis controller
     */
    handleNoteOffFeedback(data) {
        if (data.note !== undefined) {
            this.viewState.activeNotes.delete(data.note);
            this.drawKeyboard();
        }
    }
    
    // ========================================================================
    // UTILITAIRES
    // ========================================================================
    
    /**
     * Raccourci pour emit avec préfixe "keyboard:"
     */
    emit(event, data) {
        if (this.eventBus && !this.eventBus._isFallback) {
            this.eventBus.emit(`keyboard:${event}`, data);
        }
    }
    
    /**
     * Met à jour la vue avec nouvelles données
     */
    update(data = null) {
        if (data) {
            Object.assign(this.viewState, data);
        }
        
        if (this.state.rendered) {
            this.render();
        }
    }
    
    // ========================================================================
    // LIFECYCLE - INITIALISATION
    // ========================================================================
    
    /**
     * Initialise la vue
     */
    init() {
        super.init();

        // S'assurer que les listeners EventBus sont en place
        this.setupEventBusListeners();

        // Demander la liste des devices
        if (this.eventBus) {
            this.emit('request-devices', {});
        }

        this.log('info', 'KeyboardView initialized');
    }
    
    /**
     * ✅ CORRECTION: Cleanup complet avec retrait des event listeners
     */
    destroy() {
        this.log('info', 'Destroying KeyboardView');
        
        // Retirer event listeners keyboard
        window.removeEventListener('keydown', this.handleKeyDown);
        window.removeEventListener('keyup', this.handleKeyUp);
        window.removeEventListener('resize', this.handleResize);
        
        // Retirer event listeners canvas
        if (this.canvas) {
            this.canvas.removeEventListener('mousedown', this.handleMouseDown);
            this.canvas.removeEventListener('mouseup', this.handleMouseUp);
            this.canvas.removeEventListener('mousemove', this.handleMouseMove);
            this.canvas.removeEventListener('mouseleave', this.handleMouseLeave);
            
            this.canvas.removeEventListener('touchstart', this.handleTouchStart);
            this.canvas.removeEventListener('touchend', this.handleTouchEnd);
            this.canvas.removeEventListener('touchmove', this.handleTouchMove);
        }
        
        // Clear canvas
        if (this.ctx) {
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        }
        
        // Clear state
        this.viewState.activeNotes.clear();
        this.pressedKeys.clear();
        this.canvas = null;
        this.ctx = null;
        
        // Appeler destroy de BaseView
        super.destroy();
    }
}

// ============================================================================
// EXPORT
// ============================================================================

if (typeof module !== 'undefined' && module.exports) {
    module.exports = KeyboardView;
}

if (typeof window !== 'undefined') {
    window.KeyboardView = KeyboardView;
}