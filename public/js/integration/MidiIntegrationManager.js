/**
 * MidiIntegrationManager - Main integration layer
 * Connects all MIDI libraries and components together
 *
 * Components:
 * - WebMidi.js (browser MIDI)
 * - MidiBridge (browser <-> backend)
 * - Tone.js (audio synthesis)
 * - webaudio-pianoroll (editor)
 * - webaudio-controls (knobs/faders)
 * - Backend WebSocket (Raspberry Pi hardware)
 */

class MidiIntegrationManager {
    constructor(eventBus) {
        this.eventBus = eventBus;

        // Components
        this.midiBridge = null;
        this.websocket = null;
        this.pianoRoll = null;
        this.toneSynth = null;

        // State
        this.initialized = false;
        this.devices = {
            browser: { inputs: [], outputs: [] },
            backend: { inputs: [], outputs: [] }
        };

        // Settings
        this.settings = {
            enableAudioPreview: true,
            enableMidiThru: true,
            routingMode: 'both', // 'browser', 'backend', 'both'
            monitorMode: true
        };
    }

    // ========================================================================
    // INITIALIZATION
    // ========================================================================

    async init(websocketUrl) {
        console.log('🚀 Initializing MIDI Integration Manager...');

        try {
            // 1. Load external libraries
            await this.loadExternalLibraries();

            // 2. Initialize WebSocket
            await this.initWebSocket(websocketUrl);

            // 3. Initialize MIDI Bridge
            await this.initMidiBridge();

            // 4. Initialize Tone.js (optional audio synthesis)
            await this.initToneJS();

            // 5. Setup event routing
            this.setupEventRouting();

            this.initialized = true;
            console.log('✅ MIDI Integration Manager ready');
            this.eventBus.emit('midi:integration_ready');

            return true;

        } catch (error) {
            console.error('❌ MIDI Integration Manager initialization failed:', error);
            throw error;
        }
    }

    async loadExternalLibraries() {
        if (!window.initExternalLibs) {
            console.warn('External libs loader not found, assuming libraries are already loaded');
            return;
        }

        console.log('Loading external libraries...');
        await window.initExternalLibs();
        console.log('✅ External libraries loaded');
    }

    async initWebSocket(url) {
        console.log('Initializing WebSocket...');

        this.websocket = new EnhancedWebSocketClient(url, {
            debug: true,
            reconnectInterval: 1000,
            maxReconnectInterval: 10000
        });

        // Wait for connection
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('WebSocket connection timeout'));
            }, 10000);

            this.websocket.on('connect', () => {
                clearTimeout(timeout);
                console.log('✅ WebSocket connected');
                resolve();
            });

            this.websocket.on('error', (error) => {
                clearTimeout(timeout);
                console.warn('WebSocket connection failed, continuing in browser-only mode');
                resolve(); // Don't fail, just work in browser mode
            });
        });
    }

    async initMidiBridge() {
        console.log('Initializing MIDI Bridge...');

        this.midiBridge = new MidiBridge({
            enableWebMidi: true,
            enableBackendMidi: this.websocket?.isConnected() || false,
            routeMode: this.settings.routingMode,
            debug: true,
            eventBus: this.eventBus
        });

        await this.midiBridge.init(this.websocket);

        // Listen to device updates
        this.eventBus.on('midibridge:devices_updated', (devices) => {
            this.devices.browser.inputs = devices.browserInputs;
            this.devices.browser.outputs = devices.browserOutputs;
            this.devices.backend.inputs = devices.backendInputs;
            this.devices.backend.outputs = devices.backendOutputs;

            this.eventBus.emit('midi:devices_changed', this.devices);
        });

        console.log('✅ MIDI Bridge ready');
    }

    async initToneJS() {
        if (!window.Tone) {
            console.warn('Tone.js not loaded, audio preview disabled');
            return;
        }

        console.log('Initializing Tone.js...');

        // Create a polyphonic synth for MIDI preview
        this.toneSynth = new Tone.PolySynth(Tone.Synth, {
            maxPolyphony: 32,
            volume: -10,
            oscillator: {
                type: 'triangle'
            },
            envelope: {
                attack: 0.005,
                decay: 0.1,
                sustain: 0.3,
                release: 1
            }
        }).toDestination();

        // Listen to MIDI messages for audio preview
        this.eventBus.on('midi:message', (data) => {
            if (this.settings.enableAudioPreview) {
                this.handleMidiForAudio(data.data);
            }
        });

        console.log('✅ Tone.js ready');
    }

    setupEventRouting() {
        // Route piano roll events to MIDI output
        this.eventBus.on('pianoroll:note_trigger', (data) => {
            if (this.midiBridge) {
                this.midiBridge.sendNoteOn(
                    data.note,
                    data.velocity || 100,
                    data.channel || 1,
                    this.settings.routingMode
                );

                setTimeout(() => {
                    this.midiBridge.sendNoteOff(
                        data.note,
                        data.channel || 1,
                        this.settings.routingMode
                    );
                }, data.duration || 500);
            }
        });

        // Route control changes
        this.eventBus.on('midi:cc', (data) => {
            if (this.midiBridge) {
                this.midiBridge.sendCC(
                    data.cc,
                    data.value,
                    data.channel || 1,
                    this.settings.routingMode
                );
            }
        });
    }

    // ========================================================================
    // PIANO ROLL INTEGRATION
    // ========================================================================

    /**
     * Create and integrate piano roll
     */
    createPianoRoll(container, options = {}) {
        this.pianoRoll = new PianoRollWrapper(container, {
            ...options,
            eventBus: this.eventBus,
            midibridge: this.midiBridge
        });

        return this.pianoRoll;
    }

    /**
     * Load MIDI file into piano roll
     */
    async loadMidiFile(file) {
        if (!this.pianoRoll) {
            throw new Error('Piano roll not initialized');
        }

        try {
            const arrayBuffer = await file.arrayBuffer();
            const midiData = await this.parseMidiFile(arrayBuffer);

            this.pianoRoll.loadMidiFile(midiData);
            this.eventBus.emit('midi:file_loaded', { file, midiData });

            return midiData;

        } catch (error) {
            console.error('Error loading MIDI file:', error);
            throw error;
        }
    }

    /**
     * Parse MIDI file
     */
    async parseMidiFile(arrayBuffer) {
        // Use existing MidiParser from the app
        if (window.MidiParser) {
            return new Promise((resolve, reject) => {
                try {
                    const parser = new MidiParser();
                    const midiData = parser.parse(arrayBuffer);
                    resolve(midiData);
                } catch (error) {
                    reject(error);
                }
            });
        }

        // Fallback: Use basic parsing
        return this.basicMidiParse(arrayBuffer);
    }

    basicMidiParse(arrayBuffer) {
        // Minimal MIDI parsing for demo
        // In production, use a proper MIDI parser library
        return {
            format: 1,
            division: 480,
            tracks: [],
            tempo: 120
        };
    }

    // ========================================================================
    // DEVICE MANAGEMENT
    // ========================================================================

    /**
     * Connect browser MIDI input to backend
     */
    connectBrowserInput(inputId, outputId = null) {
        if (!this.midiBridge) {
            throw new Error('MIDI Bridge not initialized');
        }

        return this.midiBridge.connectBrowserToBackend(inputId, outputId);
    }

    /**
     * Get all available MIDI devices
     */
    getDevices() {
        return this.devices;
    }

    /**
     * Refresh device lists
     */
    refreshDevices() {
        if (this.midiBridge) {
            this.midiBridge.refreshBrowserDevices();
            this.midiBridge.refreshBackendDevices();
        }
    }

    // ========================================================================
    // MIDI PLAYBACK & RECORDING
    // ========================================================================

    /**
     * Start playback from piano roll
     */
    playPianoRoll() {
        if (!this.pianoRoll) {
            throw new Error('Piano roll not initialized');
        }

        this.pianoRoll.play();
        this.eventBus.emit('playback:started');
    }

    /**
     * Stop playback
     */
    stopPianoRoll() {
        if (!this.pianoRoll) return;

        this.pianoRoll.stop();
        this.eventBus.emit('playback:stopped');
    }

    /**
     * Record MIDI input
     */
    startRecording(inputId) {
        const recording = {
            notes: [],
            startTime: Date.now()
        };

        const handleMidi = (data) => {
            const elapsed = Date.now() - recording.startTime;
            recording.notes.push({
                time: elapsed / 1000, // seconds
                data: data.data
            });
        };

        this.eventBus.on('midi:message', handleMidi);

        // Return stop function
        return () => {
            this.eventBus.off('midi:message', handleMidi);
            return recording;
        };
    }

    // ========================================================================
    // AUDIO SYNTHESIS
    // ========================================================================

    /**
     * Handle MIDI for audio synthesis (preview)
     */
    handleMidiForAudio(midiData) {
        if (!this.toneSynth) return;

        const [status, note, velocity] = midiData;
        const command = status & 0xF0;

        if (command === 0x90 && velocity > 0) {
            // Note On
            const freq = Tone.Frequency(note, 'midi').toFrequency();
            const vel = velocity / 127;
            this.toneSynth.triggerAttack(freq, undefined, vel);

        } else if (command === 0x80 || (command === 0x90 && velocity === 0)) {
            // Note Off
            const freq = Tone.Frequency(note, 'midi').toFrequency();
            this.toneSynth.triggerRelease(freq);
        }
    }

    /**
     * Enable/disable audio preview
     */
    setAudioPreview(enabled) {
        this.settings.enableAudioPreview = enabled;

        if (enabled && this.toneSynth && Tone.context.state !== 'running') {
            Tone.start();
        }
    }

    /**
     * Set master volume
     */
    setMasterVolume(db) {
        if (this.toneSynth) {
            this.toneSynth.volume.value = db;
        }
    }

    // ========================================================================
    // UTILITIES
    // ========================================================================

    /**
     * Send MIDI panic (all notes off)
     */
    panic() {
        if (this.midiBridge) {
            this.midiBridge.allNotesOff(null, 'both');
        }

        if (this.toneSynth) {
            this.toneSynth.releaseAll();
        }
    }

    /**
     * Get integration status
     */
    getStatus() {
        return {
            initialized: this.initialized,
            websocket: this.websocket?.getState(),
            midibridge: this.midiBridge ? {
                browserInputs: this.devices.browser.inputs.length,
                browserOutputs: this.devices.browser.outputs.length,
                backendInputs: this.devices.backend.inputs.length,
                backendOutputs: this.devices.backend.outputs.length
            } : null,
            pianoRoll: this.pianoRoll ? this.pianoRoll.getStats() : null,
            audioPreview: this.settings.enableAudioPreview
        };
    }

    /**
     * Destroy all components
     */
    destroy() {
        if (this.pianoRoll) {
            this.pianoRoll.destroy();
        }

        if (this.midiBridge) {
            this.midiBridge.destroy();
        }

        if (this.websocket) {
            this.websocket.disconnect();
        }

        if (this.toneSynth) {
            this.toneSynth.dispose();
        }

        this.initialized = false;
    }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MidiIntegrationManager;
}
if (typeof window !== 'undefined') {
    window.MidiIntegrationManager = MidiIntegrationManager;
}
