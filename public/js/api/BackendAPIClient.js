/**
 * BackendAPIClient - Complete API client for MidiMind backend
 * Handles all backend communication with proper error handling
 */

class BackendAPIClient {
    constructor(websocket) {
        this.ws = websocket;
        this.requestId = 0;
        this.pendingRequests = new Map();
    }

    /**
     * Send command to backend and wait for response
     */
    async sendCommand(command, data = {}, timeout = 10000) {
        if (!this.ws || !this.ws.isConnected()) {
            throw new Error('WebSocket not connected');
        }

        return new Promise((resolve, reject) => {
            const id = ++this.requestId;
            const timeoutId = setTimeout(() => {
                this.pendingRequests.delete(id);
                reject(new Error(`Command timeout: ${command}`));
            }, timeout);

            this.pendingRequests.set(id, {
                resolve: (response) => {
                    clearTimeout(timeoutId);
                    this.pendingRequests.delete(id);
                    resolve(response);
                },
                reject: (error) => {
                    clearTimeout(timeoutId);
                    this.pendingRequests.delete(id);
                    reject(error);
                }
            });

            // Send command
            this.ws.send({
                id,
                command,
                data,
                timestamp: Date.now()
            });
        });
    }

    /**
     * Handle response from backend
     */
    handleResponse(response) {
        if (response.id && this.pendingRequests.has(response.id)) {
            const pending = this.pendingRequests.get(response.id);
            if (response.error) {
                pending.reject(new Error(response.error));
            } else {
                pending.resolve(response.data);
            }
        }
    }

    // ========================================================================
    // FILE MANAGEMENT
    // ========================================================================

    /**
     * Upload MIDI file to backend
     * @param {File} file - MIDI file
     * @param {string} folder - Target folder (optional)
     */
    async uploadMidiFile(file, folder = '/') {
        const arrayBuffer = await file.arrayBuffer();
        const base64 = this.arrayBufferToBase64(arrayBuffer);

        return this.sendCommand('file_upload', {
            filename: file.name,
            data: base64,
            folder: folder
        });
    }

    /**
     * List MIDI files
     * @param {string} folder - Folder to list
     */
    async listMidiFiles(folder = '/') {
        const result = await this.sendCommand('file_list', { folder });
        return result.files || [];
    }

    /**
     * Load MIDI file from backend
     * @param {number} fileId - File ID
     */
    async loadMidiFile(fileId) {
        return this.sendCommand('file_load', { fileId });
    }

    /**
     * Save MIDI file modifications
     * @param {number} fileId - File ID
     * @param {object} midiData - MIDI data (JSON format)
     */
    async saveMidiFile(fileId, midiData) {
        return this.sendCommand('file_save', {
            fileId,
            midi: midiData
        });
    }

    /**
     * Delete MIDI file
     */
    async deleteMidiFile(fileId) {
        return this.sendCommand('file_delete', { fileId });
    }

    /**
     * Rename MIDI file
     */
    async renameMidiFile(fileId, newFilename) {
        return this.sendCommand('file_rename', { fileId, newFilename });
    }

    /**
     * Search MIDI files
     */
    async searchMidiFiles(query) {
        return this.sendCommand('file_search', { query });
    }

    // ========================================================================
    // ROUTING & INSTRUMENTS
    // ========================================================================

    /**
     * Create MIDI route
     * @param {string} fromDevice - Source device ID
     * @param {string} toDevice - Target device ID
     * @param {object} options - Routing options
     */
    async createRoute(fromDevice, toDevice, options = {}) {
        return this.sendCommand('route_create', {
            from: fromDevice,
            to: toDevice,
            ...options
        });
    }

    /**
     * List all routes
     */
    async listRoutes() {
        const result = await this.sendCommand('route_list');
        return result.routes || [];
    }

    /**
     * Delete route
     */
    async deleteRoute(routeId) {
        return this.sendCommand('route_delete', { routeId });
    }

    /**
     * Map MIDI channel to instrument
     * @param {number} routeId - Route ID
     * @param {number} fromChannel - Source MIDI channel (0-15)
     * @param {number} toChannel - Target MIDI channel (0-15)
     */
    async mapChannel(routeId, fromChannel, toChannel) {
        return this.sendCommand('channel_map', {
            routeId,
            fromChannel,
            toChannel
        });
    }

    /**
     * Set channel filter
     */
    async setChannelFilter(routeId, channels) {
        return this.sendCommand('filter_set', {
            routeId,
            type: 'channel',
            channels: Array.isArray(channels) ? channels : [channels]
        });
    }

    // ========================================================================
    // LATENCY COMPENSATION
    // ========================================================================

    /**
     * Measure device latency
     */
    async measureLatency(deviceId) {
        return this.sendCommand('latency_measure', { deviceId });
    }

    /**
     * Set device latency compensation
     * @param {string} deviceId - Device ID
     * @param {number} latency - Latency in milliseconds
     */
    async setLatency(deviceId, latency) {
        return this.sendCommand('latency_set', {
            deviceId,
            latency
        });
    }

    /**
     * Get device latency
     */
    async getLatency(deviceId) {
        return this.sendCommand('latency_get', { deviceId });
    }

    /**
     * List all latencies
     */
    async listLatencies() {
        const result = await this.sendCommand('latency_list');
        return result.latencies || [];
    }

    /**
     * Auto-calibrate latency
     */
    async autoCalibrateLatency(deviceId) {
        return this.sendCommand('latency_auto_calibrate', { deviceId });
    }

    // ========================================================================
    // PLAYBACK
    // ========================================================================

    /**
     * Start playback
     * @param {number} fileId - File ID to play
     * @param {object} options - Playback options
     */
    async startPlayback(fileId, options = {}) {
        return this.sendCommand('playback_start', {
            fileId,
            loop: options.loop || false,
            tempo: options.tempo || 120,
            transpose: options.transpose || 0,
            volume: options.volume || 100
        });
    }

    /**
     * Stop playback
     */
    async stopPlayback() {
        return this.sendCommand('playback_stop');
    }

    /**
     * Pause playback
     */
    async pausePlayback() {
        return this.sendCommand('playback_pause');
    }

    /**
     * Resume playback
     */
    async resumePlayback() {
        return this.sendCommand('playback_resume');
    }

    /**
     * Seek to position
     * @param {number} position - Position in seconds
     */
    async seekPlayback(position) {
        return this.sendCommand('playback_seek', { position });
    }

    /**
     * Get playback status
     */
    async getPlaybackStatus() {
        return this.sendCommand('playback_status');
    }

    /**
     * Set playback loop
     */
    async setPlaybackLoop(enabled) {
        return this.sendCommand('playback_set_loop', { enabled });
    }

    /**
     * Set playback tempo
     */
    async setPlaybackTempo(bpm) {
        return this.sendCommand('playback_set_tempo', { bpm });
    }

    /**
     * Set playback transpose
     */
    async setPlaybackTranspose(semitones) {
        return this.sendCommand('playback_transpose', { semitones });
    }

    // ========================================================================
    // DEVICES
    // ========================================================================

    /**
     * List all MIDI devices
     */
    async listDevices() {
        const result = await this.sendCommand('device_list');
        return result.devices || [];
    }

    /**
     * Refresh device list
     */
    async refreshDevices() {
        return this.sendCommand('device_refresh');
    }

    /**
     * Get device info
     */
    async getDeviceInfo(deviceId) {
        return this.sendCommand('device_info', { deviceId });
    }

    /**
     * Enable/disable device
     */
    async setDeviceEnabled(deviceId, enabled) {
        return this.sendCommand('device_enable', {
            deviceId,
            enabled
        });
    }

    // ========================================================================
    // MIDI MESSAGES
    // ========================================================================

    /**
     * Send raw MIDI message
     */
    async sendMidi(deviceId, data) {
        return this.sendCommand('midi_send', {
            device: deviceId,
            data: Array.isArray(data) ? data : [data]
        });
    }

    /**
     * Send MIDI note
     */
    async sendNote(deviceId, note, velocity, channel = 0, duration = 500) {
        return this.sendCommand('midi_send_note', {
            device: deviceId,
            note,
            velocity,
            channel,
            duration
        });
    }

    /**
     * Send MIDI CC
     */
    async sendCC(deviceId, cc, value, channel = 0) {
        return this.sendCommand('midi_send_cc', {
            device: deviceId,
            cc,
            value,
            channel
        });
    }

    /**
     * MIDI panic (all notes off)
     */
    async midiPanic(deviceId = null) {
        return this.sendCommand('midi_panic', {
            device: deviceId
        });
    }

    // ========================================================================
    // SESSIONS
    // ========================================================================

    /**
     * Save session
     */
    async saveSession(name, data) {
        return this.sendCommand('session_save', { name, data });
    }

    /**
     * Load session
     */
    async loadSession(sessionId) {
        return this.sendCommand('session_load', { sessionId });
    }

    /**
     * List sessions
     */
    async listSessions() {
        const result = await this.sendCommand('session_list');
        return result.sessions || [];
    }

    // ========================================================================
    // SYSTEM
    // ========================================================================

    /**
     * Get system status
     */
    async getSystemStatus() {
        return this.sendCommand('system_status');
    }

    /**
     * Get system info
     */
    async getSystemInfo() {
        return this.sendCommand('system_info');
    }

    // ========================================================================
    // UTILITIES
    // ========================================================================

    /**
     * Convert ArrayBuffer to Base64
     */
    arrayBufferToBase64(buffer) {
        let binary = '';
        const bytes = new Uint8Array(buffer);
        for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary);
    }

    /**
     * Convert Base64 to ArrayBuffer
     */
    base64ToArrayBuffer(base64) {
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }
        return bytes.buffer;
    }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = BackendAPIClient;
}
if (typeof window !== 'undefined') {
    window.BackendAPIClient = BackendAPIClient;
}
