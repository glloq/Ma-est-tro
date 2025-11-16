// ============================================================================
// Fichier: KeyboardModal_NEW.js - VERSION DIVs (Pas de Canvas!)
// ============================================================================

class KeyboardModalNew {
    constructor() {
        this.backend = window.api;
        this.logger = console;
        this.isOpen = false;

        // État
        this.devices = [];
        this.selectedDevice = null;
        this.activeNotes = new Set();
        this.velocity = 80;
        this.octaveOffset = 0;
        this.keyboardLayout = 'azerty';

        // Piano config
        this.whiteKeys = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
        this.blackKeyPositions = [1, 2, 4, 5, 6]; // Position des touches noires (après C, D, F, G, A)
        this.octaves = 2; // Nombre d'octaves à afficher (2 octaves = 14 touches blanches)

        // Keyboard mappings
        this.keyMaps = {
            azerty: {
                'KeyW': 0, 'KeyS': 1, 'KeyX': 2, 'KeyD': 3, 'KeyC': 4,
                'KeyV': 5, 'KeyG': 6, 'KeyB': 7, 'KeyH': 8, 'KeyN': 9,
                'KeyJ': 10, 'Comma': 11,
                'KeyA': 12, 'Digit2': 13, 'KeyZ': 14, 'Digit3': 15, 'KeyE': 16,
                'KeyR': 17, 'Digit5': 18, 'KeyT': 19, 'Digit6': 20, 'KeyY': 21,
                'Digit7': 22, 'KeyU': 23, 'KeyI': 24, 'Digit9': 25, 'KeyO': 26,
                'Digit0': 27, 'KeyP': 28
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

        this.container = null;
    }

    // ========================================================================
    // OPEN / CLOSE
    // ========================================================================

    async open() {
        if (this.isOpen) return;

        this.createModal();
        this.isOpen = true;

        // Load devices
        await this.loadDevices();
        this.populateDeviceSelect();

        // Attach events
        this.attachEvents();

        this.logger.info('[KeyboardModal] Opened');
    }

    close() {
        if (!this.isOpen) return;

        this.detachEvents();

        // Stop toutes les notes actives
        this.activeNotes.forEach(note => this.stopNote(note));

        if (this.container) {
            this.container.remove();
            this.container = null;
        }

        this.isOpen = false;
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
                                <div id="piano-container" class="piano-container"></div>
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

        // Générer les touches du piano
        this.generatePianoKeys();
    }

    // ========================================================================
    // PIANO KEYS GENERATION (DIVs)
    // ========================================================================

    generatePianoKeys() {
        const pianoContainer = document.getElementById('piano-container');
        if (!pianoContainer) return;

        pianoContainer.innerHTML = ''; // Clear

        const totalWhiteKeys = this.whiteKeys.length * this.octaves;
        let whiteKeyIndex = 0;

        for (let octave = 0; octave < this.octaves; octave++) {
            for (let i = 0; i < this.whiteKeys.length; i++) {
                const noteName = this.whiteKeys[i];
                const noteNumber = 60 + (octave * 12) + this.getNoteOffset(noteName);

                // Touche blanche
                const whiteKey = document.createElement('div');
                whiteKey.className = 'piano-key white-key';
                whiteKey.dataset.note = noteNumber;
                whiteKey.dataset.noteName = noteName + (4 + octave);

                // Label
                const label = document.createElement('span');
                label.className = 'key-label';
                label.textContent = noteName;
                whiteKey.appendChild(label);

                pianoContainer.appendChild(whiteKey);

                // Touche noire (si applicable)
                if (this.blackKeyPositions.includes(i + 1)) {
                    const blackNoteNumber = noteNumber + 1;
                    const blackKey = document.createElement('div');
                    blackKey.className = 'piano-key black-key';
                    blackKey.dataset.note = blackNoteNumber;
                    blackKey.dataset.noteName = noteName + '#' + (4 + octave);

                    // Positionner la touche noire
                    blackKey.style.left = `calc(${whiteKeyIndex * (100 / totalWhiteKeys)}% + ${(100 / totalWhiteKeys) * 0.7}%)`;

                    pianoContainer.appendChild(blackKey);
                }

                whiteKeyIndex++;
            }
        }

        this.logger.info('[KeyboardModal] Piano keys generated');
    }

    getNoteOffset(noteName) {
        const offsets = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
        return offsets[noteName] || 0;
    }

    updatePianoDisplay() {
        const allKeys = document.querySelectorAll('.piano-key');
        allKeys.forEach(key => {
            const baseNote = parseInt(key.dataset.note);
            const adjustedNote = baseNote + (this.octaveOffset * 12);

            // Update note number
            key.dataset.adjustedNote = adjustedNote;

            // Highlight if active
            if (this.activeNotes.has(adjustedNote)) {
                key.classList.add('active');
            } else {
                key.classList.remove('active');
            }
        });
    }

    // ========================================================================
    // EVENTS
    // ========================================================================

    attachEvents() {
        // Boutons
        document.getElementById('keyboard-close-btn')?.addEventListener('click', () => this.close());
        document.getElementById('keyboard-close-btn-footer')?.addEventListener('click', () => this.close());

        document.getElementById('keyboard-octave-up')?.addEventListener('click', () => {
            this.octaveOffset = Math.min(3, this.octaveOffset + 1);
            const display = this.octaveOffset > 0 ? `+${this.octaveOffset}` : this.octaveOffset;
            document.getElementById('keyboard-octave-display').textContent = `Octave: ${display}`;
            this.updatePianoDisplay();
        });

        document.getElementById('keyboard-octave-down')?.addEventListener('click', () => {
            this.octaveOffset = Math.max(-3, this.octaveOffset - 1);
            const display = this.octaveOffset > 0 ? `+${this.octaveOffset}` : this.octaveOffset;
            document.getElementById('keyboard-octave-display').textContent = `Octave: ${display}`;
            this.updatePianoDisplay();
        });

        // Device select
        document.getElementById('keyboard-device-select')?.addEventListener('change', (e) => {
            const deviceId = e.target.value;
            this.selectedDevice = this.devices.find(d => d.device_id === deviceId || d.id === deviceId) || null;
            this.logger.info('[KeyboardModal] Device selected:', this.selectedDevice);
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

        // Piano keys
        const pianoKeys = document.querySelectorAll('.piano-key');
        pianoKeys.forEach(key => {
            key.addEventListener('mousedown', (e) => this.handlePianoKeyDown(e));
            key.addEventListener('mouseup', (e) => this.handlePianoKeyUp(e));
            key.addEventListener('mouseleave', (e) => this.handlePianoKeyUp(e));

            // Touch support
            key.addEventListener('touchstart', (e) => {
                e.preventDefault();
                this.handlePianoKeyDown(e);
            });
            key.addEventListener('touchend', (e) => {
                e.preventDefault();
                this.handlePianoKeyUp(e);
            });
        });

        // Clavier PC
        window.addEventListener('keydown', this.handleKeyDown);
        window.addEventListener('keyup', this.handleKeyUp);

        this.logger.info('[KeyboardModal] Events attached');
    }

    detachEvents() {
        window.removeEventListener('keydown', this.handleKeyDown);
        window.removeEventListener('keyup', this.handleKeyUp);
        this.logger.info('[KeyboardModal] Events detached');
    }

    handlePianoKeyDown(e) {
        const key = e.currentTarget;
        const baseNote = parseInt(key.dataset.note);
        const note = baseNote + (this.octaveOffset * 12);

        if (!this.activeNotes.has(note)) {
            this.playNote(note);
        }
    }

    handlePianoKeyUp(e) {
        const key = e.currentTarget;
        const baseNote = parseInt(key.dataset.note);
        const note = baseNote + (this.octaveOffset * 12);

        this.stopNote(note);
    }

    handleKeyDown(e) {
        if (!this.isOpen) return;

        const noteOffset = this.currentKeyMap[e.code];
        if (noteOffset === undefined) return;

        e.preventDefault();
        const note = 60 + noteOffset + (this.octaveOffset * 12);

        if (!this.activeNotes.has(note)) {
            this.playNote(note);
        }
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
        this.updatePianoDisplay();

        // Envoyer MIDI si device sélectionné
        if (this.selectedDevice && this.backend) {
            const deviceId = this.selectedDevice.device_id || this.selectedDevice.id;
            this.logger.info(`[KeyboardModal] Sending noteOn to device ${deviceId}, note=${note}, vel=${this.velocity}`);

            this.backend.sendNoteOn(deviceId, note, this.velocity, 0)
                .then(() => {
                    this.logger.info(`[KeyboardModal] ✓ Note ON sent: ${note}`);
                })
                .catch(err => {
                    this.logger.error('[KeyboardModal] ✗ Note ON failed:', err);
                });
        } else {
            this.logger.warn('[KeyboardModal] No device/backend - note not sent');
        }
    }

    stopNote(note) {
        this.logger.info(`[KeyboardModal] Stop note: ${note}`);

        // Retirer des notes actives
        this.activeNotes.delete(note);
        this.updatePianoDisplay();

        // Envoyer MIDI si device sélectionné
        if (this.selectedDevice && this.backend) {
            const deviceId = this.selectedDevice.device_id || this.selectedDevice.id;

            this.backend.sendNoteOff(deviceId, note, 0)
                .then(() => {
                    this.logger.info(`[KeyboardModal] ✓ Note OFF sent: ${note}`);
                })
                .catch(err => {
                    this.logger.error('[KeyboardModal] ✗ Note OFF failed:', err);
                });
        }
    }

    // ========================================================================
    // DEVICES
    // ========================================================================

    async loadDevices() {
        try {
            const devices = await this.backend.listDevices();
            this.devices = devices.filter(d => d.status === 2); // Actifs seulement

            // Enrichir avec noms personnalisés
            this.devices = await Promise.all(this.devices.map(async (device) => {
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
                        displayName: settings.custom_name || device.name,
                        customName: settings.custom_name
                    };
                } catch (error) {
                    return {
                        ...normalizedDevice,
                        displayName: device.name,
                        customName: null
                    };
                }
            }));

            this.logger.info(`[KeyboardModal] Loaded ${this.devices.length} devices`);
        } catch (error) {
            this.logger.error('[KeyboardModal] Failed to load devices:', error);
            this.devices = [];
        }
    }

    populateDeviceSelect() {
        const select = document.getElementById('keyboard-device-select');
        if (!select) return;

        select.innerHTML = '<option value="">-- Sélectionner --</option>';

        this.devices.forEach(device => {
            const option = document.createElement('option');
            option.value = device.device_id;
            option.textContent = device.displayName || device.name;
            select.appendChild(option);
        });

        this.logger.info('[KeyboardModal] Device select populated');
    }
}
