/**
 * PianoRollWrapper - Wrapper for webaudio-pianoroll (g200kg)
 * Integrates the proven piano roll library with MidiMind application
 *
 * GitHub: https://github.com/g200kg/webaudio-pianoroll
 */

class PianoRollWrapper {
    constructor(container, options = {}) {
        this.container = typeof container === 'string'
            ? document.querySelector(container)
            : container;

        this.options = {
            width: options.width || 800,
            height: options.height || 400,
            timebase: options.timebase || 16, // 16th notes
            editmode: options.editmode || 'dragpoly',
            wheelzoom: options.wheelzoom !== false ? 1 : 0,
            xrange: options.xrange || [0, 16],
            yrange: options.yrange || [0, 127],
            grid: options.grid !== false ? 1 : 0,
            snap: options.snap !== false ? 1 : 0,
            ...options
        };

        this.pianoRoll = null;
        this.eventBus = options.eventBus || window.eventBus;
        this.midibridge = options.midibridge || null;
        this.playbackState = {
            playing: false,
            position: 0,
            bpm: 120,
            loop: false
        };

        this.init();
    }

    // ========================================================================
    // INITIALIZATION
    // ========================================================================

    init() {
        if (!window.WebAudioPianoRoll) {
            console.error('webaudio-pianoroll not loaded!');
            return;
        }

        // Create piano roll element
        this.element = document.createElement('webaudio-pianoroll');

        // Set attributes
        Object.keys(this.options).forEach(key => {
            if (key !== 'eventBus' && key !== 'midibridge') {
                this.element.setAttribute(key, this.options[key]);
            }
        });

        this.container.appendChild(this.element);
        this.pianoRoll = this.element;

        // Setup event listeners
        this.setupEventListeners();

        console.log('✅ PianoRoll initialized');
    }

    setupEventListeners() {
        // Listen to sequence changes
        this.element.addEventListener('change', (e) => {
            console.log('Piano roll changed:', e);
            this.eventBus?.emit('pianoroll:changed', {
                sequence: this.getSequence()
            });
        });

        // Listen to playback events from app
        if (this.eventBus) {
            this.eventBus.on('playback:started', () => {
                this.playbackState.playing = true;
            });

            this.eventBus.on('playback:stopped', () => {
                this.playbackState.playing = false;
                this.playbackState.position = 0;
            });

            this.eventBus.on('playback:position', (data) => {
                this.playbackState.position = data.position || 0;
                this.updatePlayhead(data.position);
            });
        }
    }

    // ========================================================================
    // SEQUENCE MANAGEMENT
    // ========================================================================

    /**
     * Get current sequence
     * Format: [[tick, noteNumber, gate, velocity], ...]
     */
    getSequence() {
        return this.element.sequence || [];
    }

    /**
     * Set sequence
     */
    setSequence(sequence) {
        this.element.sequence = sequence;
        this.eventBus?.emit('pianoroll:loaded', { sequence });
    }

    /**
     * Add note
     * @param {number} tick - Start time in ticks
     * @param {number} note - MIDI note number (0-127)
     * @param {number} gate - Duration in ticks
     * @param {number} velocity - Velocity (0-127)
     */
    addNote(tick, note, gate, velocity = 100) {
        const seq = this.getSequence();
        seq.push([tick, note, gate, velocity]);
        this.setSequence(seq);
    }

    /**
     * Clear all notes
     */
    clear() {
        this.setSequence([]);
    }

    /**
     * Load from MIDI file data
     */
    loadMidiFile(midiData) {
        // Convert MIDI data to piano roll sequence
        const sequence = this.convertMidiToSequence(midiData);
        this.setSequence(sequence);
    }

    /**
     * Convert MIDI JSON to sequence format
     */
    convertMidiToSequence(midiData) {
        const sequence = [];
        const ticksPerBeat = midiData.division || 480;
        const timebase = this.options.timebase;

        // Get all tracks
        const tracks = midiData.tracks || [];

        tracks.forEach(track => {
            const notes = track.notes || [];

            notes.forEach(note => {
                // Convert time (seconds or beats) to ticks
                const tick = Math.round(note.time * timebase);
                const gate = Math.round(note.duration * timebase);
                const pitch = note.pitch || note.note || 60;
                const velocity = note.velocity || 100;

                sequence.push([tick, pitch, gate, velocity]);
            });
        });

        // Sort by time
        sequence.sort((a, b) => a[0] - b[0]);

        return sequence;
    }

    /**
     * Convert sequence to MIDI JSON format
     */
    convertSequenceToMidi() {
        const sequence = this.getSequence();
        const timebase = this.options.timebase;
        const notes = [];

        sequence.forEach(([tick, note, gate, velocity]) => {
            notes.push({
                time: tick / timebase,
                duration: gate / timebase,
                pitch: note,
                velocity: velocity,
                channel: 0
            });
        });

        return {
            format: 1,
            division: 480,
            tracks: [{
                channel: 0,
                notes: notes
            }]
        };
    }

    // ========================================================================
    // PLAYBACK
    // ========================================================================

    /**
     * Start playback
     */
    play() {
        if (this.playbackState.playing) return;

        this.playbackState.playing = true;
        this.playbackState.position = 0;

        this.eventBus?.emit('pianoroll:play_start');

        // Start playback loop
        this.playbackLoop();
    }

    /**
     * Stop playback
     */
    stop() {
        this.playbackState.playing = false;
        this.playbackState.position = 0;

        // Stop all playing notes
        if (this.midibridge) {
            this.midibridge.allNotesOff(null, 'both');
        }

        this.eventBus?.emit('pianoroll:play_stop');
    }

    /**
     * Playback loop
     */
    playbackLoop() {
        if (!this.playbackState.playing) return;

        const sequence = this.getSequence();
        const timebase = this.options.timebase;
        const bpm = this.playbackState.bpm;
        const beatDuration = 60 / bpm; // seconds per beat
        const tickDuration = (beatDuration / timebase) * 1000; // ms per tick

        const currentTick = this.playbackState.position;

        // Find notes to play at current tick
        sequence.forEach(([tick, note, gate, velocity]) => {
            if (tick === currentTick) {
                // Send Note On
                if (this.midibridge) {
                    this.midibridge.sendNoteOn(note, velocity, 1, 'both');

                    // Schedule Note Off
                    setTimeout(() => {
                        this.midibridge.sendNoteOff(note, 1, 'both');
                    }, gate * tickDuration);
                }
            }
        });

        // Update playhead
        this.updatePlayhead(currentTick / timebase);

        // Increment position
        this.playbackState.position++;

        // Check if end of sequence
        const maxTick = Math.max(...sequence.map(s => s[0]), 0);
        if (this.playbackState.position > maxTick) {
            if (this.playbackState.loop) {
                this.playbackState.position = 0;
            } else {
                this.stop();
                return;
            }
        }

        // Continue loop
        setTimeout(() => this.playbackLoop(), tickDuration);
    }

    /**
     * Update playhead position
     */
    updatePlayhead(position) {
        // Update visual playhead if piano roll supports it
        // (webaudio-pianoroll doesn't have built-in playhead, but we can add it)
        this.eventBus?.emit('pianoroll:playhead', { position });
    }

    /**
     * Set BPM
     */
    setBPM(bpm) {
        this.playbackState.bpm = Math.max(20, Math.min(300, bpm));
    }

    /**
     * Set loop mode
     */
    setLoop(loop) {
        this.playbackState.loop = loop;
    }

    // ========================================================================
    // VIEW CONTROLS
    // ========================================================================

    /**
     * Zoom in
     */
    zoomIn() {
        const xrange = this.element.xrange;
        const center = (xrange[0] + xrange[1]) / 2;
        const width = (xrange[1] - xrange[0]) / 1.5;
        this.element.xrange = [center - width / 2, center + width / 2];
    }

    /**
     * Zoom out
     */
    zoomOut() {
        const xrange = this.element.xrange;
        const center = (xrange[0] + xrange[1]) / 2;
        const width = (xrange[1] - xrange[0]) * 1.5;
        this.element.xrange = [center - width / 2, center + width / 2];
    }

    /**
     * Fit to content
     */
    fitToContent() {
        const sequence = this.getSequence();
        if (sequence.length === 0) return;

        const ticks = sequence.map(s => s[0]);
        const notes = sequence.map(s => s[1]);

        const minTick = Math.min(...ticks);
        const maxTick = Math.max(...ticks);
        const minNote = Math.min(...notes);
        const maxNote = Math.max(...notes);

        const timebase = this.options.timebase;

        this.element.xrange = [
            Math.floor(minTick / timebase),
            Math.ceil(maxTick / timebase) + 1
        ];

        this.element.yrange = [
            Math.max(0, minNote - 5),
            Math.min(127, maxNote + 5)
        ];
    }

    // ========================================================================
    // UTILITIES
    // ========================================================================

    /**
     * Get statistics
     */
    getStats() {
        const sequence = this.getSequence();

        return {
            noteCount: sequence.length,
            duration: sequence.length > 0
                ? Math.max(...sequence.map(s => s[0] + s[2])) / this.options.timebase
                : 0,
            noteRange: sequence.length > 0
                ? {
                    min: Math.min(...sequence.map(s => s[1])),
                    max: Math.max(...sequence.map(s => s[1]))
                }
                : { min: 0, max: 0 }
        };
    }

    /**
     * Export as MIDI file
     */
    async exportMidi() {
        const midiData = this.convertSequenceToMidi();

        this.eventBus?.emit('pianoroll:export_midi', { midiData });

        return midiData;
    }

    /**
     * Destroy
     */
    destroy() {
        this.stop();
        if (this.element) {
            this.element.remove();
        }
    }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PianoRollWrapper;
}
if (typeof window !== 'undefined') {
    window.PianoRollWrapper = PianoRollWrapper;
}
