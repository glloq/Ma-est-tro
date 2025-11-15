/**
 * MidiBridge - Connects browser WebMIDI to Raspberry Pi backend
 *
 * Architecture:
 * Browser (WebMIDI.js) <-> MidiBridge <-> WebSocket <-> Backend (easymidi)
 *
 * Features:
 * - Route browser MIDI to Raspberry Pi hardware
 * - Route Raspberry Pi MIDI to browser
 * - Virtual MIDI ports
 * - MIDI message filtering
 */

class MidiBridge {
    constructor(options = {}) {
        this.options = {
            enableWebMidi: options.enableWebMidi !== false,
            enableBackendMidi: options.enableBackendMidi !== false,
            routeMode: options.routeMode || 'both', // 'browser', 'backend', 'both'
            debug: options.debug || false,
            ...options
        };

        this.webmidi = null;
        this.websocket = null;
        this.eventBus = options.eventBus || window.eventBus;

        // Device lists
        this.browserInputs = [];
        this.browserOutputs = [];
        this.backendInputs = [];
        this.backendOutputs = [];

        // Routing table
        this.routes = new Map();

        // Active connections
        this.activeInputs = new Set();
        this.activeOutputs = new Set();

        this.initialized = false;
    }

    // ========================================================================
    // INITIALIZATION
    // ========================================================================

    async init(websocket) {
        if (this.initialized) {
            console.warn('MidiBridge already initialized');
            return;
        }

        this.websocket = websocket;
        this.log('Initializing MidiBridge...');

        try {
            // Initialize WebMIDI.js
            if (this.options.enableWebMidi) {
                await this.initWebMidi();
            }

            // Setup WebSocket handlers
            if (this.options.enableBackendMidi && websocket) {
                this.setupWebSocketHandlers();
            }

            this.initialized = true;
            this.log('✅ MidiBridge initialized');
            this.eventBus?.emit('midibridge:ready');

            return true;

        } catch (error) {
            console.error('❌ MidiBridge initialization failed:', error);
            throw error;
        }
    }

    async initWebMidi() {
        if (!window.WebMidi) {
            throw new Error('WebMidi.js not loaded');
        }

        return new Promise((resolve, reject) => {
            WebMidi.enable((err) => {
                if (err) {
                    console.error('WebMIDI initialization failed:', err);
                    reject(err);
                    return;
                }

                this.webmidi = WebMidi;
                this.log('✅ WebMIDI enabled');

                // Get initial device list
                this.refreshBrowserDevices();

                // Listen for device changes
                WebMidi.addListener('connected', (e) => {
                    this.log('MIDI device connected:', e.port.name);
                    this.refreshBrowserDevices();
                    this.eventBus?.emit('midi:device_connected', e.port);
                });

                WebMidi.addListener('disconnected', (e) => {
                    this.log('MIDI device disconnected:', e.port.name);
                    this.refreshBrowserDevices();
                    this.eventBus?.emit('midi:device_disconnected', e.port);
                });

                resolve();
            }, true); // Request sysex
        });
    }

    setupWebSocketHandlers() {
        if (!this.websocket) return;

        // Handle MIDI messages from backend
        this.websocket.on('midi', (data) => {
            this.handleBackendMidi(data);
        });

        // Handle device list updates
        this.websocket.on('devices', (data) => {
            this.updateBackendDevices(data);
        });

        this.websocket.on('init', (data) => {
            this.updateBackendDevices(data);
        });

        // Request initial device list
        this.refreshBackendDevices();
    }

    // ========================================================================
    // DEVICE MANAGEMENT
    // ========================================================================

    refreshBrowserDevices() {
        if (!this.webmidi) return;

        this.browserInputs = WebMidi.inputs.map(input => ({
            id: input.id,
            name: input.name,
            manufacturer: input.manufacturer,
            state: input.state,
            type: 'browser_input',
            source: 'browser'
        }));

        this.browserOutputs = WebMidi.outputs.map(output => ({
            id: output.id,
            name: output.name,
            manufacturer: output.manufacturer,
            state: output.state,
            type: 'browser_output',
            source: 'browser'
        }));

        this.log('Browser devices:', {
            inputs: this.browserInputs.length,
            outputs: this.browserOutputs.length
        });

        this.eventBus?.emit('midibridge:devices_updated', {
            browserInputs: this.browserInputs,
            browserOutputs: this.browserOutputs,
            backendInputs: this.backendInputs,
            backendOutputs: this.backendOutputs
        });
    }

    refreshBackendDevices() {
        if (!this.websocket || !this.websocket.isConnected()) return;

        this.websocket.send({
            type: 'get_devices'
        });
    }

    updateBackendDevices(data) {
        this.backendInputs = (data.midiInputs || []).map(device => ({
            ...device,
            type: 'backend_input',
            source: 'backend'
        }));

        this.backendOutputs = (data.midiOutputs || []).map(device => ({
            ...device,
            type: 'backend_output',
            source: 'backend'
        }));

        this.log('Backend devices:', {
            inputs: this.backendInputs.length,
            outputs: this.backendOutputs.length
        });

        this.eventBus?.emit('midibridge:devices_updated', {
            browserInputs: this.browserInputs,
            browserOutputs: this.browserOutputs,
            backendInputs: this.backendInputs,
            backendOutputs: this.backendOutputs
        });
    }

    getAllDevices() {
        return {
            browserInputs: this.browserInputs,
            browserOutputs: this.browserOutputs,
            backendInputs: this.backendInputs,
            backendOutputs: this.backendOutputs
        };
    }

    // ========================================================================
    // ROUTING
    // ========================================================================

    /**
     * Connect browser MIDI input to backend output
     */
    connectBrowserToBackend(inputId, outputId = null) {
        if (!this.webmidi) {
            throw new Error('WebMIDI not initialized');
        }

        const input = WebMidi.getInputById(inputId);
        if (!input) {
            throw new Error(`Input ${inputId} not found`);
        }

        this.log(`Connecting browser input "${input.name}" to backend`);

        // Listen to all MIDI messages
        input.addListener('midimessage', (e) => {
            this.sendToBackend(e.data, outputId);
        });

        this.activeInputs.add(inputId);
        this.routes.set(inputId, { type: 'browser_to_backend', outputId });

        return true;
    }

    /**
     * Send MIDI data to backend
     */
    sendToBackend(midiData, outputId = null) {
        if (!this.websocket || !this.websocket.isConnected()) {
            this.log('Cannot send to backend: not connected');
            return false;
        }

        const message = {
            type: 'midi_out',
            data: Array.from(midiData),
            timestamp: Date.now()
        };

        if (outputId !== null) {
            message.outputId = outputId;
        }

        this.websocket.send(message);
        this.log('→ Backend:', midiData);

        return true;
    }

    /**
     * Handle MIDI from backend
     */
    handleBackendMidi(data) {
        this.log('← Backend:', data.data);

        // Route to browser outputs
        if (this.options.routeMode === 'browser' || this.options.routeMode === 'both') {
            this.sendToBrowser(data.data);
        }

        // Emit event for app
        this.eventBus?.emit('midi:message', {
            source: 'backend',
            data: data.data,
            timestamp: data.timestamp
        });
    }

    /**
     * Send MIDI to browser output
     */
    sendToBrowser(midiData, outputId = null) {
        if (!this.webmidi) return false;

        const outputs = outputId
            ? [WebMidi.getOutputById(outputId)]
            : WebMidi.outputs;

        outputs.forEach(output => {
            if (output && output.state === 'connected') {
                output.send(midiData);
                this.log('→ Browser output:', output.name, midiData);
            }
        });

        return true;
    }

    // ========================================================================
    // MIDI MESSAGE HELPERS
    // ========================================================================

    /**
     * Send Note On
     */
    sendNoteOn(note, velocity = 100, channel = 1, target = 'both') {
        const midiData = [0x90 + (channel - 1), note, velocity];

        if (target === 'backend' || target === 'both') {
            this.sendToBackend(midiData);
        }

        if (target === 'browser' || target === 'both') {
            this.sendToBrowser(midiData);
        }
    }

    /**
     * Send Note Off
     */
    sendNoteOff(note, channel = 1, target = 'both') {
        const midiData = [0x80 + (channel - 1), note, 0];

        if (target === 'backend' || target === 'both') {
            this.sendToBackend(midiData);
        }

        if (target === 'browser' || target === 'both') {
            this.sendToBrowser(midiData);
        }
    }

    /**
     * Send Control Change
     */
    sendCC(cc, value, channel = 1, target = 'both') {
        const midiData = [0xB0 + (channel - 1), cc, value];

        if (target === 'backend' || target === 'both') {
            this.sendToBackend(midiData);
        }

        if (target === 'browser' || target === 'both') {
            this.sendToBrowser(midiData);
        }
    }

    /**
     * Send Program Change
     */
    sendProgramChange(program, channel = 1, target = 'both') {
        const midiData = [0xC0 + (channel - 1), program];

        if (target === 'backend' || target === 'both') {
            this.sendToBackend(midiData);
        }

        if (target === 'browser' || target === 'both') {
            this.sendToBrowser(midiData);
        }
    }

    /**
     * All Notes Off
     */
    allNotesOff(channel = null, target = 'both') {
        const channels = channel ? [channel] : Array.from({length: 16}, (_, i) => i + 1);

        channels.forEach(ch => {
            // CC 123: All Notes Off
            this.sendCC(123, 0, ch, target);
        });
    }

    // ========================================================================
    // UTILITIES
    // ========================================================================

    disconnect(inputId) {
        if (!this.webmidi) return;

        const input = WebMidi.getInputById(inputId);
        if (input) {
            input.removeListener();
            this.activeInputs.delete(inputId);
            this.routes.delete(inputId);
            this.log(`Disconnected input: ${input.name}`);
        }
    }

    disconnectAll() {
        this.activeInputs.forEach(inputId => {
            this.disconnect(inputId);
        });
    }

    getRoutes() {
        return Array.from(this.routes.entries()).map(([inputId, route]) => ({
            inputId,
            ...route
        }));
    }

    log(...args) {
        if (this.options.debug) {
            console.log('[MidiBridge]', ...args);
        }
    }

    destroy() {
        this.disconnectAll();

        if (this.webmidi) {
            WebMidi.disable();
        }

        this.initialized = false;
    }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MidiBridge;
}
if (typeof window !== 'undefined') {
    window.MidiBridge = MidiBridge;
}
