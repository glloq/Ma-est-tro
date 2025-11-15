/**
 * UIComponentAdapter - Facilitates integration of modern UI components
 * into the existing MidiMind application
 */

class UIComponentAdapter {
    constructor(eventBus) {
        this.eventBus = eventBus;
        this.components = new Map();
        this.wsClient = null;
    }

    // ========================================================================
    // WEBSOCKET CLIENT
    // ========================================================================

    /**
     * Initialize enhanced WebSocket client
     */
    initWebSocket(url, options = {}) {
        this.wsClient = new EnhancedWebSocketClient(url, {
            debug: true,
            reconnectInterval: 1000,
            maxReconnectInterval: 10000,
            ...options
        });

        // Bridge WebSocket events to EventBus
        this.wsClient.on('connect', () => {
            console.log('✅ WebSocket connected');
            this.eventBus.emit('backend:connected');
        });

        this.wsClient.on('disconnect', () => {
            console.log('❌ WebSocket disconnected');
            this.eventBus.emit('backend:disconnected');
        });

        this.wsClient.on('message', (data) => {
            this.handleWebSocketMessage(data);
        });

        return this.wsClient;
    }

    /**
     * Handle incoming WebSocket messages
     */
    handleWebSocketMessage(data) {
        // MIDI messages
        if (data.type === 'midi') {
            this.eventBus.emit('midi:message', {
                data: data.data,
                timestamp: data.timestamp
            });
        }

        // Device list updates
        else if (data.type === 'devices' || data.type === 'init') {
            this.eventBus.emit('midi:devices_updated', {
                inputs: data.midiInputs || [],
                outputs: data.midiOutputs || []
            });
        }

        // Generic message
        else {
            this.eventBus.emit('backend:message', data);
        }
    }

    // ========================================================================
    // UI COMPONENTS - KNOBS
    // ========================================================================

    /**
     * Create a rotary knob
     */
    createKnob(container, options = {}) {
        const knob = new WebAudioKnob(container, {
            min: options.min ?? 0,
            max: options.max ?? 127,
            value: options.value ?? 64,
            size: options.size ?? 64,
            label: options.label || '',
            showValue: options.showValue !== false,
            onChange: (value) => {
                if (options.onChange) {
                    options.onChange(value);
                }
                if (options.midiCC) {
                    this.sendMidiCC(options.channel || 0, options.midiCC, value);
                }
            },
            ...options
        });

        const id = options.id || `knob_${Date.now()}`;
        this.components.set(id, knob);

        return knob;
    }

    /**
     * Create multiple knobs for a panel
     */
    createKnobPanel(container, knobConfigs) {
        const panel = document.createElement('div');
        panel.className = 'knob-panel';
        panel.style.display = 'flex';
        panel.style.gap = '16px';
        panel.style.flexWrap = 'wrap';

        const knobs = {};

        knobConfigs.forEach(config => {
            const knobContainer = document.createElement('div');
            knobContainer.className = 'knob-container';
            panel.appendChild(knobContainer);

            knobs[config.id] = this.createKnob(knobContainer, config);
        });

        if (typeof container === 'string') {
            container = document.querySelector(container);
        }
        container.appendChild(panel);

        return { panel, knobs };
    }

    // ========================================================================
    // UI COMPONENTS - FADERS
    // ========================================================================

    /**
     * Create a fader
     */
    createFader(container, options = {}) {
        const fader = new WebAudioFader(container, {
            min: options.min ?? 0,
            max: options.max ?? 127,
            value: options.value ?? 64,
            height: options.height ?? 150,
            width: options.width ?? 40,
            orientation: options.orientation || 'vertical',
            label: options.label || '',
            showValue: options.showValue !== false,
            onChange: (value) => {
                if (options.onChange) {
                    options.onChange(value);
                }
                if (options.midiCC) {
                    this.sendMidiCC(options.channel || 0, options.midiCC, value);
                }
            },
            ...options
        });

        const id = options.id || `fader_${Date.now()}`;
        this.components.set(id, fader);

        return fader;
    }

    /**
     * Create a mixer with multiple faders
     */
    createMixer(container, channelCount, options = {}) {
        const mixer = document.createElement('div');
        mixer.className = 'mixer-panel';
        mixer.style.display = 'flex';
        mixer.style.gap = '8px';

        const faders = [];

        for (let i = 0; i < channelCount; i++) {
            const channelContainer = document.createElement('div');
            channelContainer.className = 'mixer-channel';
            mixer.appendChild(channelContainer);

            const fader = this.createFader(channelContainer, {
                id: `channel_${i}`,
                label: `Ch ${i + 1}`,
                height: options.height || 150,
                width: options.width || 40,
                midiCC: 7, // Volume CC
                channel: i,
                ...options
            });

            faders.push(fader);
        }

        if (typeof container === 'string') {
            container = document.querySelector(container);
        }
        container.appendChild(mixer);

        return { mixer, faders };
    }

    // ========================================================================
    // UI COMPONENTS - PIANO ROLL
    // ========================================================================

    /**
     * Create an optimized piano roll
     */
    createPianoRoll(container, options = {}) {
        const pianoRoll = new OptimizedPianoRoll(container, {
            width: options.width,
            height: options.height,
            onNoteAdd: (note) => {
                this.eventBus.emit('editor:note_add', note);
                if (options.onNoteAdd) {
                    options.onNoteAdd(note);
                }
            },
            onNoteDelete: (note) => {
                this.eventBus.emit('editor:note_delete', note);
                if (options.onNoteDelete) {
                    options.onNoteDelete(note);
                }
            },
            onNoteChange: (note) => {
                this.eventBus.emit('editor:note_change', note);
                if (options.onNoteChange) {
                    options.onNoteChange(note);
                }
            },
            ...options
        });

        const id = options.id || `pianoroll_${Date.now()}`;
        this.components.set(id, pianoRoll);

        // Listen for playback updates
        this.eventBus.on('playback:position', (data) => {
            pianoRoll.setPlayhead(data.position || 0);
        });

        return pianoRoll;
    }

    // ========================================================================
    // MIDI HELPERS
    // ========================================================================

    /**
     * Send MIDI CC via WebSocket
     */
    sendMidiCC(channel, cc, value) {
        if (!this.wsClient || !this.wsClient.isConnected()) {
            console.warn('WebSocket not connected, cannot send MIDI CC');
            return false;
        }

        const status = 0xB0 + (channel & 0x0F); // Control Change
        const midiData = [status, cc & 0x7F, value & 0x7F];

        this.wsClient.send({
            type: 'midi_out',
            data: midiData,
            timestamp: Date.now()
        });

        return true;
    }

    /**
     * Send MIDI Note On/Off
     */
    sendMidiNote(channel, note, velocity, on = true) {
        if (!this.wsClient || !this.wsClient.isConnected()) {
            return false;
        }

        const status = (on ? 0x90 : 0x80) + (channel & 0x0F);
        const midiData = [status, note & 0x7F, velocity & 0x7F];

        this.wsClient.send({
            type: 'midi_out',
            data: midiData,
            timestamp: Date.now()
        });

        return true;
    }

    // ========================================================================
    // COMPONENT MANAGEMENT
    // ========================================================================

    /**
     * Get a component by ID
     */
    getComponent(id) {
        return this.components.get(id);
    }

    /**
     * Destroy a component
     */
    destroyComponent(id) {
        const component = this.components.get(id);
        if (component && typeof component.destroy === 'function') {
            component.destroy();
        }
        this.components.delete(id);
    }

    /**
     * Destroy all components
     */
    destroyAll() {
        this.components.forEach((component, id) => {
            this.destroyComponent(id);
        });
        this.components.clear();
    }

    // ========================================================================
    // PRESETS
    // ========================================================================

    /**
     * Create a preset manager for controls
     */
    createPresetManager(controls) {
        return {
            save: (name) => {
                const preset = {};
                controls.forEach((control, id) => {
                    preset[id] = control.getValue ? control.getValue() : control.value;
                });
                localStorage.setItem(`preset_${name}`, JSON.stringify(preset));
                this.eventBus.emit('preset:saved', { name, preset });
                return preset;
            },

            load: (name) => {
                const preset = JSON.parse(localStorage.getItem(`preset_${name}`));
                if (!preset) return null;

                Object.keys(preset).forEach(id => {
                    const control = controls.get(id);
                    if (control && control.setValue) {
                        control.setValue(preset[id], false);
                    }
                });

                this.eventBus.emit('preset:loaded', { name, preset });
                return preset;
            },

            list: () => {
                const presets = [];
                for (let i = 0; i < localStorage.length; i++) {
                    const key = localStorage.key(i);
                    if (key.startsWith('preset_')) {
                        presets.push(key.replace('preset_', ''));
                    }
                }
                return presets;
            },

            delete: (name) => {
                localStorage.removeItem(`preset_${name}`);
                this.eventBus.emit('preset:deleted', { name });
            }
        };
    }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = UIComponentAdapter;
}
if (typeof window !== 'undefined') {
    window.UIComponentAdapter = UIComponentAdapter;
}
