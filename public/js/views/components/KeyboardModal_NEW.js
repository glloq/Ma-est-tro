// ============================================================================
// Fichier: KeyboardModal_NEW.js - VERSION SIMPLIFIÉE ET FONCTIONNELLE
// ============================================================================

class KeyboardModalNew {
    constructor() {
        this.backend = window.api;
        this.logger = console;
        this.isOpen = false;

        // Canvas
        this.canvas = null;
        this.ctx = null;
        this.keyWidth = 40;
        this.whiteKeyHeight = 320;
        this.blackKeyHeight = 200;

        // État
        this.devices = [];
        this.selectedDevice = null;
        this.activeNotes = new Set();
        this.velocity = 80;
        this.octaveOffset = 0;
        this.keyboardLayout = 'azerty';

        // Keyboard mappings
        this.keyMaps = {
            azerty: {
                'KeyZ': 0, 'KeyS': 1, 'KeyX': 2, 'KeyD': 3, 'KeyC': 4,
                'KeyV': 5, 'KeyG': 6, 'KeyB': 7, 'KeyH': 8, 'KeyN': 9,
                'KeyJ': 10, 'Comma': 11,
                'KeyA': 12, 'Digit2': 13, 'KeyQ': 14, 'Digit3': 15, 'KeyW': 16,
                'KeyE': 17, 'Digit5': 18, 'KeyR': 19, 'Digit6': 20, 'KeyT': 21,
                'Digit7': 22, 'KeyY': 23, 'KeyU': 24, 'Digit9': 25, 'KeyI': 26,
                'Digit0': 27, 'KeyO': 28, 'KeyP': 29
            },
            qwerty: {
                'KeyZ': 0, 'KeyS': 1, 'KeyX': 2, 'KeyD': 3, 'KeyC': 4,
                'KeyV': 5, 'KeyG': 6, 'KeyB': 7, 'KeyH': 8, 'KeyN': 9,
                'KeyJ': 10, 'KeyM': 11,
                'KeyQ': 12, 'Digit2': 13, 'KeyW': 14, 'Digit3': 15, 'KeyE': 16,
                'KeyR': 17, 'Digit5': 18, 'KeyT': 19, 'Digit6': 20, 'KeyY': 21,
                'Digit7': 22, 'KeyU': 23, 'KeyI': 24, 'Digit9': 25, 'KeyO': 26,
                'Digit0': 27, 'KeyP': 28
            }
        };
        this.currentKeyMap = this.keyMaps.azerty;

        // Bind handlers
        this.handleKeyDown = this.handleKeyDown.bind(this);
        this.handleKeyUp = this.handleKeyUp.bind(this);
        this.handleMouseDown = this.handleMouseDown.bind(this);
        this.handleMouseUp = this.handleMouseUp.bind(this);

        this.logger.info('[KeyboardModal] Initialized');
    }

    // ========================================================================
    // MODAL
    // ========================================================================

    async open() {
        if (this.isOpen) return;

        this.isOpen = true;
        this.createModal();

        // Attendre que le DOM soit créé
        await new Promise(resolve => setTimeout(resolve, 0));

        this.setupCanvas();
        this.attachEvents();
        await this.loadDevices();

        this.logger.info('[KeyboardModal] Opened');
    }

    close() {
        if (!this.isOpen) return;

        this.isOpen = false;
        this.detachEvents();

        if (this.container) {
            this.container.remove();
            this.container = null;
        }

        this.canvas = null;
        this.ctx = null;

        this.logger.info('[KeyboardModal] Closed');
    }

    createModal() {
        this.container = document.createElement('div');
        this.container.className = 'keyboard-modal';
        this.container.innerHTML = `
            <div class="modal-dialog">
                <div class="modal-header">
                    <h2>🎹 Clavier MIDI Virtuel</h2>
                    <button class="modal-close" id="keyboard-close-btn">&times;</button>
                </div>

                <div class="modal-body">
                    <div class="keyboard-layout">
                        <!-- Slider vélocité vertical à gauche -->
                        <div class="velocity-control-vertical">
                            <div class="velocity-label-vertical">Vélocité</div>
                            <div class="velocity-slider-wrapper">
                                <input type="range"
                                       id="keyboard-velocity"
                                       class="velocity-slider-vertical"
                                       min="1"
                                       max="127"
                                       value="80"
                                       orient="vertical">
                            </div>
                            <div class="velocity-value-vertical" id="keyboard-velocity-display">80</div>
                        </div>

                        <!-- Zone principale du clavier -->
                        <div class="keyboard-main">
                            <div class="keyboard-header">
                                <div class="keyboard-controls">
                                    <div class="control-group">
                                        <label>Instrument:</label>
                                        <select class="device-select" id="keyboard-device-select">
                                            <option value="">-- Sélectionner --</option>
                                        </select>
                                    </div>

                                    <div class="control-group octave-controls">
                                        <button class="btn-octave-down" id="keyboard-octave-down">◄</button>
                                        <span class="octave-display" id="keyboard-octave-display">Octave: 0</span>
                                        <button class="btn-octave-up" id="keyboard-octave-up">►</button>
                                    </div>

                                    <div class="control-group">
                                        <label>Layout clavier:</label>
                                        <select class="layout-select" id="keyboard-layout-select">
                                            <option value="azerty">AZERTY</option>
                                            <option value="qwerty">QWERTY</option>
                                        </select>
                                    </div>
                                </div>
                            </div>

                            <div class="keyboard-canvas-container">
                                <canvas id="keyboard-canvas" class="keyboard-canvas"></canvas>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="modal-footer">
                    <button class="btn-secondary" id="keyboard-close-btn-footer">Fermer</button>
                </div>
            </div>
        `;

        document.body.appendChild(this.container);
    }

    // ========================================================================
    // CANVAS
    // ========================================================================

    setupCanvas() {
        this.canvas = document.getElementById('keyboard-canvas');
        if (!this.canvas) {
            this.logger.error('[KeyboardModal] Canvas not found');
            return;
        }

        this.ctx = this.canvas.getContext('2d');

        // Définir une taille par défaut si offsetWidth n'est pas encore disponible
        const width = this.canvas.offsetWidth || 1000;
        this.canvas.width = width;
        this.canvas.height = this.whiteKeyHeight;

        this.logger.info(`[KeyboardModal] Canvas setup: ${this.canvas.width}x${this.canvas.height}`);

        this.drawKeyboard();
    }

    drawKeyboard() {
        if (!this.ctx) return;

        const ctx = this.ctx;
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        const baseNote = 60 + (this.octaveOffset * 12);
        const visibleKeys = Math.floor(this.canvas.width / this.keyWidth);

        // Dessiner touches blanches
        let x = 0;
        for (let i = 0; i < visibleKeys; i++) {
            const note = baseNote + i;
            const isBlackKey = this.isBlackKey(note % 12);

            if (!isBlackKey) {
                this.drawWhiteKey(x, note);
                x += this.keyWidth;
            }
        }

        // Dessiner touches noires
        x = 0;
        for (let i = 0; i < visibleKeys; i++) {
            const note = baseNote + i;
            const noteInOctave = note % 12;

            if (!this.isBlackKey(noteInOctave)) {
                // Dessiner touche noire après cette touche blanche si applicable
                const nextNote = note + 1;
                if (this.isBlackKey(nextNote % 12)) {
                    this.drawBlackKey(x + this.keyWidth - (this.keyWidth * 0.3), nextNote);
                }
                x += this.keyWidth;
            }
        }
    }

    isBlackKey(noteInOctave) {
        return [1, 3, 6, 8, 10].includes(noteInOctave);
    }

    drawWhiteKey(x, note) {
        const ctx = this.ctx;
        const isActive = this.activeNotes.has(note);

        ctx.fillStyle = isActive ? '#cccccc' : '#ffffff';
        ctx.fillRect(x, 0, this.keyWidth - 1, this.whiteKeyHeight);

        ctx.strokeStyle = isActive ? '#ff0000' : '#333333';
        ctx.lineWidth = isActive ? 2 : 1;
        ctx.strokeRect(x, 0, this.keyWidth - 1, this.whiteKeyHeight);
    }

    drawBlackKey(x, note) {
        const ctx = this.ctx;
        const isActive = this.activeNotes.has(note);
        const blackKeyWidth = this.keyWidth * 0.6;

        ctx.fillStyle = isActive ? '#666666' : '#000000';
        ctx.fillRect(x, 0, blackKeyWidth, this.blackKeyHeight);

        ctx.strokeStyle = isActive ? '#ff0000' : '#333333';
        ctx.lineWidth = isActive ? 2 : 1;
        ctx.strokeRect(x, 0, blackKeyWidth, this.blackKeyHeight);
    }

    getNoteAtPosition(x, y) {
        const baseNote = 60 + (this.octaveOffset * 12);
        const keyIndex = Math.floor(x / this.keyWidth);
        return baseNote + keyIndex;
    }

    // ========================================================================
    // EVENTS
    // ========================================================================

    attachEvents() {
        // Boutons
        document.getElementById('keyboard-close-btn')?.addEventListener('click', () => this.close());
        document.getElementById('keyboard-close-btn-footer')?.addEventListener('click', () => this.close());

        document.getElementById('keyboard-octave-up')?.addEventListener('click', () => {
            this.octaveOffset = Math.min(5, this.octaveOffset + 1);
            const display = this.octaveOffset > 0 ? `+${this.octaveOffset}` : this.octaveOffset;
            document.getElementById('keyboard-octave-display').textContent = `Octave: ${display}`;
            this.drawKeyboard();
        });

        document.getElementById('keyboard-octave-down')?.addEventListener('click', () => {
            this.octaveOffset = Math.max(-5, this.octaveOffset - 1);
            const display = this.octaveOffset > 0 ? `+${this.octaveOffset}` : this.octaveOffset;
            document.getElementById('keyboard-octave-display').textContent = `Octave: ${display}`;
            this.drawKeyboard();
        });

        // Device select
        document.getElementById('keyboard-device-select')?.addEventListener('change', (e) => {
            const deviceId = e.target.value;
            this.selectedDevice = this.devices.find(d => d.device_id === deviceId) || null;
            this.logger.info('[KeyboardModal] Device selected:', this.selectedDevice?.displayName);
        });

        // Velocity
        document.getElementById('keyboard-velocity')?.addEventListener('input', (e) => {
            this.velocity = parseInt(e.target.value);
            document.getElementById('keyboard-velocity-display').textContent = this.velocity;
        });

        // Layout
        document.getElementById('keyboard-layout-select')?.addEventListener('change', (e) => {
            this.keyboardLayout = e.target.value;
            this.currentKeyMap = this.keyMaps[this.keyboardLayout];
        });

        // Canvas
        if (this.canvas) {
            this.canvas.addEventListener('mousedown', this.handleMouseDown);
            this.canvas.addEventListener('mouseup', this.handleMouseUp);
        }

        // Clavier
        window.addEventListener('keydown', this.handleKeyDown);
        window.addEventListener('keyup', this.handleKeyUp);

        this.logger.info('[KeyboardModal] Events attached');
    }

    detachEvents() {
        if (this.canvas) {
            this.canvas.removeEventListener('mousedown', this.handleMouseDown);
            this.canvas.removeEventListener('mouseup', this.handleMouseUp);
        }

        window.removeEventListener('keydown', this.handleKeyDown);
        window.removeEventListener('keyup', this.handleKeyUp);

        this.logger.info('[KeyboardModal] Events detached');
    }

    handleMouseDown(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const note = this.getNoteAtPosition(x, y);
        this.playNote(note);
    }

    handleMouseUp(e) {
        // Arrêter toutes les notes actives
        this.activeNotes.forEach(note => this.stopNote(note));
    }

    handleKeyDown(e) {
        if (!this.isOpen) return;

        const noteOffset = this.currentKeyMap[e.code];
        if (noteOffset === undefined) return;

        e.preventDefault();
        const note = 60 + noteOffset + (this.octaveOffset * 12);
        this.playNote(note);
    }

    handleKeyUp(e) {
        if (!this.isOpen) return;

        const noteOffset = this.currentKeyMap[e.code];
        if (noteOffset === undefined) return;

        e.preventDefault();
        const note = 60 + noteOffset + (this.octaveOffset * 12);
        this.stopNote(note);
    }

    // ========================================================================
    // MIDI
    // ========================================================================

    playNote(note) {
        if (note < 21 || note > 108) return;

        this.logger.info(`[KeyboardModal] Play note: ${note} vel=${this.velocity}`);

        // Ajouter aux notes actives
        this.activeNotes.add(note);
        this.drawKeyboard();

        // Logs de debug
        this.logger.info(`[KeyboardModal] backend available: ${!!this.backend}`);
        this.logger.info(`[KeyboardModal] selectedDevice: ${JSON.stringify(this.selectedDevice)}`);

        // Envoyer MIDI si device sélectionné
        if (this.selectedDevice && this.backend) {
            const deviceId = this.selectedDevice.device_id || this.selectedDevice.id;
            this.logger.info(`[KeyboardModal] Sending noteOn to device ${deviceId}, note=${note}, vel=${this.velocity}`);

            this.backend.sendNoteOn(deviceId, note, this.velocity, 0)
                .then(() => {
                    this.logger.info(`[KeyboardModal] ✓ Note ON sent successfully: ${note}`);
                })
                .catch(err => {
                    this.logger.error('[KeyboardModal] ✗ Note ON failed:', err);
                });
        } else {
            if (!this.backend) {
                this.logger.warn('[KeyboardModal] Backend not available');
            }
            if (!this.selectedDevice) {
                this.logger.warn('[KeyboardModal] No device selected - note not sent');
            }
        }
    }

    stopNote(note) {
        this.logger.info(`[KeyboardModal] Stop note: ${note}`);

        // Retirer des notes actives
        this.activeNotes.delete(note);
        this.drawKeyboard();

        // Envoyer MIDI si device sélectionné
        if (this.selectedDevice && this.backend) {
            this.backend.sendNoteOff(this.selectedDevice.device_id, note, 0)
                .then(() => {
                    this.logger.info(`[KeyboardModal] Note OFF sent: ${note}`);
                })
                .catch(err => {
                    this.logger.error('[KeyboardModal] Note OFF failed:', err);
                });
        }
    }

    // ========================================================================
    // DEVICES
    // ========================================================================

    async loadDevices() {
        if (!this.backend) {
            this.logger.warn('[KeyboardModal] Backend not available');
            return;
        }

        try {
            this.logger.info('[KeyboardModal] Loading devices...');

            const devices = await this.backend.listDevices();
            const activeDevices = devices.filter(d => d.status === 2);

            // Enrichir avec noms personnalisés
            this.devices = await Promise.all(activeDevices.map(async (device) => {
                const deviceId = device.id || device.device_id;
                const normalizedDevice = {
                    ...device,
                    id: deviceId,
                    device_id: deviceId
                };

                try {
                    const response = await this.backend.sendCommand('instrument_get_settings', {
                        deviceId: deviceId
                    });
                    const settings = response.settings || {};
                    return {
                        ...normalizedDevice,
                        displayName: settings.custom_name || device.name
                    };
                } catch {
                    return {
                        ...normalizedDevice,
                        displayName: device.name
                    };
                }
            }));

            this.logger.info(`[KeyboardModal] Loaded ${this.devices.length} devices`);
            this.updateDeviceSelect();

        } catch (error) {
            this.logger.error('[KeyboardModal] Failed to load devices:', error);
        }
    }

    updateDeviceSelect() {
        const select = document.getElementById('keyboard-device-select');
        if (!select) return;

        select.innerHTML = '<option value="">-- Sélectionner --</option>';

        this.devices.forEach(device => {
            const option = document.createElement('option');
            option.value = device.device_id;
            option.textContent = device.displayName;
            select.appendChild(option);
        });
    }
}

// Export global
if (typeof window !== 'undefined') {
    window.KeyboardModalNew = KeyboardModalNew;
}
