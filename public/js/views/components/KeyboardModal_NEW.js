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
        this.isMouseDown = false; // Pour le drag sur le clavier

        // Piano config
        this.whiteKeys = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
        this.blackKeyPositions = [1, 2, 4, 5, 6]; // Position des touches noires (après C, D, F, G, A)
        this.octaves = 3; // 3 octaves complètes = 21 touches blanches
        this.baseOctave = 3; // Commence à C3

        // Keyboard mappings - touches blanches: s d f g h j k l m
        // Note: KeyW = w, KeyX = x, etc.
        this.keyMaps = {
            azerty: {
                // Touches blanches: s d f g h j k l m (C D E F G A B C D)
                'KeyS': 0,  // C
                'KeyD': 2,  // D
                'KeyF': 4,  // E
                'KeyG': 5,  // F
                'KeyH': 7,  // G
                'KeyJ': 9,  // A
                'KeyK': 11, // B
                'KeyL': 12, // C (octave suivante)
                'KeyM': 14, // D (octave suivante)

                // Touches noires (rangée du dessus)
                'KeyZ': 1,  // C#
                'KeyE': 3,  // D#
                // pas de noir entre E et F
                'KeyT': 6,  // F#
                'KeyY': 8,  // G#
                'KeyU': 10, // A#
                // pas de noir entre B et C
                'KeyO': 13, // C# (octave suivante)
                'KeyP': 15  // D# (octave suivante)
            },
            qwerty: {
                // Touches blanches: s d f g h j k l ; (même que azerty mais dernière touche différente)
                'KeyS': 0,  // C
                'KeyD': 2,  // D
                'KeyF': 4,  // E
                'KeyG': 5,  // F
                'KeyH': 7,  // G
                'KeyJ': 9,  // A
                'KeyK': 11, // B
                'KeyL': 12, // C (octave suivante)
                'Semicolon': 14, // D (octave suivante) - ; key

                // Touches noires (rangée du dessus)
                'KeyW': 1,  // C#
                'KeyE': 3,  // D#
                'KeyT': 6,  // F#
                'KeyY': 8,  // G#
                'KeyU': 10, // A#
                'KeyO': 13, // C# (octave suivante)
                'KeyP': 15  // D# (octave suivante)
            }
        };
        this.currentKeyMap = this.keyMaps.azerty;

        // Bind handlers
        this.handleKeyDown = this.handleKeyDown.bind(this);
        this.handleKeyUp = this.handleKeyUp.bind(this);
        this.handleGlobalMouseUp = this.handleGlobalMouseUp.bind(this);

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

        // Reset state
        this.isMouseDown = false;
        this.selectedDevice = null;

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

                                    <div class="control-group">
                                        <div class="info-item">
                                            <span class="info-label">Touches PC:</span>
                                            <span class="info-value" id="keyboard-help-text">SDFGHJKLM (blanches) / ZETYUOP (noires)</span>
                                        </div>
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

        // Calculer l'octave de départ en tenant compte de octaveOffset
        const startOctave = this.baseOctave + this.octaveOffset;

        for (let octave = 0; octave < this.octaves; octave++) {
            const currentOctave = startOctave + octave;

            for (let i = 0; i < this.whiteKeys.length; i++) {
                const noteName = this.whiteKeys[i];
                const noteOffset = this.getNoteOffset(noteName);

                // Calculer le numéro MIDI: C4 = 60
                // Formule: (octave + 1) * 12 + noteOffset
                const noteNumber = (currentOctave + 1) * 12 + noteOffset;

                // Touche blanche
                const whiteKey = document.createElement('div');
                whiteKey.className = 'piano-key white-key';
                whiteKey.dataset.note = noteNumber;
                whiteKey.dataset.baseNote = noteNumber; // Note fixe sans octaveOffset
                whiteKey.dataset.noteName = noteName + currentOctave;

                // Label avec nom + octave
                const label = document.createElement('span');
                label.className = 'key-label';
                label.textContent = noteName + currentOctave;
                whiteKey.appendChild(label);

                pianoContainer.appendChild(whiteKey);

                // Touche noire (si applicable)
                if (this.blackKeyPositions.includes(i + 1)) {
                    const blackNoteNumber = noteNumber + 1;
                    const blackKey = document.createElement('div');
                    blackKey.className = 'piano-key black-key';
                    blackKey.dataset.note = blackNoteNumber;
                    blackKey.dataset.baseNote = blackNoteNumber;
                    blackKey.dataset.noteName = noteName + '#' + currentOctave;

                    // Positionner la touche noire
                    blackKey.style.left = `calc(${whiteKeyIndex * (100 / totalWhiteKeys)}% + ${(100 / totalWhiteKeys) * 0.7}%)`;

                    pianoContainer.appendChild(blackKey);
                }

                whiteKeyIndex++;
            }
        }
    }

    getNoteOffset(noteName) {
        const offsets = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
        return offsets[noteName] || 0;
    }

    updatePianoDisplay() {
        const allKeys = document.querySelectorAll('.piano-key');
        allKeys.forEach(key => {
            const note = parseInt(key.dataset.note);

            // Highlight if active
            if (this.activeNotes.has(note)) {
                key.classList.add('active');
            } else {
                key.classList.remove('active');
            }
        });
    }

    regeneratePianoKeys() {
        // Régénérer tout le clavier avec le nouvel octaveOffset
        this.generatePianoKeys();

        // Ré-attacher les events sur les nouvelles touches
        const pianoKeys = document.querySelectorAll('.piano-key');
        pianoKeys.forEach(key => {
            key.addEventListener('mousedown', (e) => this.handlePianoKeyDown(e));
            key.addEventListener('mouseup', (e) => this.handlePianoKeyUp(e));
            key.addEventListener('mouseleave', (e) => this.handlePianoKeyUp(e));
            key.addEventListener('mouseenter', (e) => this.handlePianoKeyEnter(e));

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

        this.updatePianoDisplay();
    }

    /**
     * Définir le nombre de touches du clavier
     * @param {number} numberOfKeys - Nombre de touches (25, 49, 61, 88, etc.)
     */
    setNumberOfKeys(numberOfKeys) {
        // Calculer le nombre d'octaves à afficher
        // Une octave = 12 touches (7 blanches + 5 noires)
        const octaves = Math.ceil(numberOfKeys / 12);

        // Limiter entre 1 et 8 octaves
        this.octaves = Math.max(1, Math.min(8, octaves));

        this.logger.info(`[KeyboardModal] Nombre de touches changé: ${numberOfKeys} (${this.octaves} octaves)`);

        // Régénérer le clavier si le modal est ouvert
        if (this.isOpen) {
            this.regeneratePianoKeys();
        }
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
            this.regeneratePianoKeys();
        });

        document.getElementById('keyboard-octave-down')?.addEventListener('click', () => {
            this.octaveOffset = Math.max(-3, this.octaveOffset - 1);
            const display = this.octaveOffset > 0 ? `+${this.octaveOffset}` : this.octaveOffset;
            document.getElementById('keyboard-octave-display').textContent = `Octave: ${display}`;
            this.regeneratePianoKeys();
        });

        // Device select
        document.getElementById('keyboard-device-select')?.addEventListener('change', (e) => {
            const deviceId = e.target.value;
            this.selectedDevice = this.devices.find(d => d.device_id === deviceId || d.id === deviceId) || null;
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

            // Mettre à jour le texte d'aide
            const helpText = document.getElementById('keyboard-help-text');
            if (helpText) {
                if (this.keyboardLayout === 'azerty') {
                    helpText.textContent = 'SDFGHJKLM (blanches) / ZETYUOP (noires)';
                } else {
                    helpText.textContent = 'SDFGHJKL; (blanches) / WETYUOP (noires)';
                }
            }
        });

        // Piano keys
        const pianoKeys = document.querySelectorAll('.piano-key');
        pianoKeys.forEach(key => {
            key.addEventListener('mousedown', (e) => this.handlePianoKeyDown(e));
            key.addEventListener('mouseup', (e) => this.handlePianoKeyUp(e));
            key.addEventListener('mouseleave', (e) => this.handlePianoKeyUp(e));
            key.addEventListener('mouseenter', (e) => this.handlePianoKeyEnter(e));

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

        // Gestion globale du mouseup pour le drag
        document.addEventListener('mouseup', this.handleGlobalMouseUp);

        // Clavier PC
        window.addEventListener('keydown', this.handleKeyDown);
        window.addEventListener('keyup', this.handleKeyUp);
    }

    detachEvents() {
        document.removeEventListener('mouseup', this.handleGlobalMouseUp);
        window.removeEventListener('keydown', this.handleKeyDown);
        window.removeEventListener('keyup', this.handleKeyUp);
    }

    handleGlobalMouseUp() {
        this.isMouseDown = false;
    }

    handlePianoKeyDown(e) {
        this.isMouseDown = true;
        const key = e.currentTarget;
        const note = parseInt(key.dataset.note);

        if (!this.activeNotes.has(note)) {
            this.playNote(note);
        }
    }

    handlePianoKeyUp(e) {
        const key = e.currentTarget;
        const note = parseInt(key.dataset.note);

        // Arrêter la note seulement si elle est active
        if (this.activeNotes.has(note)) {
            this.stopNote(note);
        }
    }

    handlePianoKeyEnter(e) {
        // Jouer la note seulement si la souris est enfoncée (drag)
        if (!this.isMouseDown) return;

        const key = e.currentTarget;
        const note = parseInt(key.dataset.note);

        if (!this.activeNotes.has(note)) {
            this.playNote(note);
        }
    }

    handleKeyDown(e) {
        if (!this.isOpen) return;

        const noteOffset = this.currentKeyMap[e.code];
        if (noteOffset === undefined) return;

        e.preventDefault();

        // Note de base: C du baseOctave avec octaveOffset appliqué
        // Par exemple: baseOctave=3, octaveOffset=0 → C3 = 48
        // C4 = 60, donc C3 = 48
        const baseNoteNumber = (this.baseOctave + this.octaveOffset + 1) * 12;
        const note = baseNoteNumber + noteOffset;

        if (!this.activeNotes.has(note)) {
            this.playNote(note);
        }
    }

    handleKeyUp(e) {
        if (!this.isOpen) return;

        const noteOffset = this.currentKeyMap[e.code];
        if (noteOffset === undefined) return;

        e.preventDefault();

        const baseNoteNumber = (this.baseOctave + this.octaveOffset + 1) * 12;
        const note = baseNoteNumber + noteOffset;

        this.stopNote(note);
    }

    // ========================================================================
    // MIDI
    // ========================================================================

    playNote(note) {
        if (note < 21 || note > 108) return;

        // Ajouter aux notes actives
        this.activeNotes.add(note);
        this.updatePianoDisplay();

        // Envoyer MIDI si device sélectionné
        if (this.selectedDevice && this.backend) {
            const deviceId = this.selectedDevice.device_id || this.selectedDevice.id;

            this.backend.sendNoteOn(deviceId, note, this.velocity, 0)
                .catch(err => {
                    this.logger.error('[KeyboardModal] Note ON failed:', err);
                });
        }
    }

    stopNote(note) {
        // Retirer des notes actives
        this.activeNotes.delete(note);
        this.updatePianoDisplay();

        // Envoyer MIDI si device sélectionné
        if (this.selectedDevice && this.backend) {
            const deviceId = this.selectedDevice.device_id || this.selectedDevice.id;

            this.backend.sendNoteOff(deviceId, note, 0)
                .catch(err => {
                    this.logger.error('[KeyboardModal] Note OFF failed:', err);
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
    }
}
