/**
 * MidiRoutingManager - Manages MIDI routing and latency compensation
 * Routes MIDI channels to specific instruments with latency compensation
 */

class MidiRoutingManager {
    constructor(apiClient, eventBus) {
        this.api = apiClient;
        this.eventBus = eventBus;

        // State
        this.devices = [];
        this.routes = [];
        this.channelRoutes = {}; // Maps MIDI channel -> device/route
        this.latencies = {}; // Maps device ID -> latency (ms)

        this.init();
    }

    async init() {
        try {
            // Load devices
            await this.refreshDevices();

            // Load existing routes
            await this.refreshRoutes();

            // Load latencies
            await this.refreshLatencies();

            console.log('✅ MidiRoutingManager initialized');
            this.eventBus.emit('routing:ready');

        } catch (error) {
            console.error('Failed to initialize routing manager:', error);
        }
    }

    // ========================================================================
    // DEVICE MANAGEMENT
    // ========================================================================

    /**
     * Refresh device list
     */
    async refreshDevices() {
        try {
            this.devices = await this.api.listDevices();
            this.eventBus.emit('routing:devices_updated', this.devices);
            return this.devices;
        } catch (error) {
            console.error('Failed to refresh devices:', error);
            throw error;
        }
    }

    /**
     * Get all available instruments/devices
     */
    getAvailableInstruments() {
        return this.devices.filter(d => d.type === 'output' || d.type === 'virtual');
    }

    /**
     * Get device by ID
     */
    getDevice(deviceId) {
        return this.devices.find(d => d.id === deviceId);
    }

    // ========================================================================
    // ROUTING
    // ========================================================================

    /**
     * Refresh routes list
     */
    async refreshRoutes() {
        try {
            this.routes = await this.api.listRoutes();
            this.eventBus.emit('routing:routes_updated', this.routes);
            return this.routes;
        } catch (error) {
            console.error('Failed to refresh routes:', error);
            throw error;
        }
    }

    /**
     * Create a route from source to destination
     * @param {string} fromDevice - Source device ID
     * @param {string} toDevice - Target device ID
     * @param {object} options - Routing options
     */
    async createRoute(fromDevice, toDevice, options = {}) {
        try {
            const result = await this.api.createRoute(fromDevice, toDevice, {
                enabled: options.enabled !== false,
                name: options.name || `${fromDevice} -> ${toDevice}`,
                ...options
            });

            await this.refreshRoutes();
            this.eventBus.emit('routing:route_created', result);

            return result;

        } catch (error) {
            console.error('Failed to create route:', error);
            throw error;
        }
    }

    /**
     * Delete a route
     */
    async deleteRoute(routeId) {
        try {
            await this.api.deleteRoute(routeId);
            await this.refreshRoutes();
            this.eventBus.emit('routing:route_deleted', { routeId });
            return true;
        } catch (error) {
            console.error('Failed to delete route:', error);
            throw error;
        }
    }

    // ========================================================================
    // CHANNEL ROUTING
    // ========================================================================

    /**
     * Route a MIDI channel to a specific instrument
     * @param {number} channel - MIDI channel (0-15)
     * @param {string} instrumentId - Target instrument/device ID
     * @param {number} targetChannel - Target MIDI channel (optional)
     */
    async routeChannelToInstrument(channel, instrumentId, targetChannel = null) {
        try {
            console.log(`Routing channel ${channel} -> ${instrumentId}`);

            // Find or create route to this instrument
            let route = this.routes.find(r => r.to === instrumentId);

            if (!route) {
                // Create new route
                const result = await this.createRoute('pianoroll', instrumentId, {
                    name: `Piano Roll -> ${instrumentId}`
                });
                route = result;
            }

            // Set channel mapping
            await this.api.mapChannel(
                route.id,
                channel,
                targetChannel !== null ? targetChannel : channel
            );

            // Store mapping
            this.channelRoutes[channel] = {
                routeId: route.id,
                instrumentId: instrumentId,
                targetChannel: targetChannel !== null ? targetChannel : channel
            };

            this.eventBus.emit('routing:channel_mapped', {
                channel,
                instrumentId,
                targetChannel
            });

            console.log(`✅ Channel ${channel} routed to ${instrumentId}`);

            return true;

        } catch (error) {
            console.error('Failed to route channel:', error);
            throw error;
        }
    }

    /**
     * Get routing for a channel
     */
    getChannelRoute(channel) {
        return this.channelRoutes[channel] || null;
    }

    /**
     * Clear channel routing
     */
    async clearChannelRoute(channel) {
        const route = this.channelRoutes[channel];
        if (route) {
            try {
                // Clear channel filter
                await this.api.sendCommand('filter_clear', {
                    routeId: route.routeId,
                    type: 'channel',
                    channel: channel
                });

                delete this.channelRoutes[channel];

                this.eventBus.emit('routing:channel_cleared', { channel });

                return true;

            } catch (error) {
                console.error('Failed to clear channel route:', error);
                throw error;
            }
        }
        return false;
    }

    /**
     * Get all channel routes
     */
    getAllChannelRoutes() {
        return { ...this.channelRoutes };
    }

    /**
     * Set multiple channel routes at once
     * @param {object} channelMap - Map of channel -> instrumentId
     */
    async setChannelRoutes(channelMap) {
        const promises = [];

        for (const [channel, instrumentId] of Object.entries(channelMap)) {
            promises.push(
                this.routeChannelToInstrument(parseInt(channel), instrumentId)
            );
        }

        await Promise.all(promises);

        this.eventBus.emit('routing:bulk_update', channelMap);
    }

    // ========================================================================
    // LATENCY COMPENSATION
    // ========================================================================

    /**
     * Refresh latencies list
     */
    async refreshLatencies() {
        try {
            const latencies = await this.api.listLatencies();

            this.latencies = {};
            latencies.forEach(l => {
                this.latencies[l.deviceId] = l.latency;
            });

            this.eventBus.emit('routing:latencies_updated', this.latencies);

            return this.latencies;

        } catch (error) {
            console.error('Failed to refresh latencies:', error);
            throw error;
        }
    }

    /**
     * Set latency for a device
     * @param {string} deviceId - Device ID
     * @param {number} latency - Latency in milliseconds
     */
    async setDeviceLatency(deviceId, latency) {
        try {
            await this.api.setLatency(deviceId, latency);
            this.latencies[deviceId] = latency;

            this.eventBus.emit('routing:latency_set', { deviceId, latency });

            console.log(`Latency set for ${deviceId}: ${latency}ms`);

            return true;

        } catch (error) {
            console.error('Failed to set latency:', error);
            throw error;
        }
    }

    /**
     * Get latency for a device
     */
    getDeviceLatency(deviceId) {
        return this.latencies[deviceId] || 0;
    }

    /**
     * Get latency for a MIDI channel (via its route)
     */
    getChannelLatency(channel) {
        const route = this.channelRoutes[channel];
        if (route) {
            return this.getDeviceLatency(route.instrumentId);
        }
        return 0;
    }

    /**
     * Auto-calibrate latency for a device
     */
    async autoCalibrateLatency(deviceId) {
        try {
            console.log(`Auto-calibrating latency for ${deviceId}...`);

            const result = await this.api.autoCalibrateLatency(deviceId);

            if (result.latency !== undefined) {
                this.latencies[deviceId] = result.latency;
                this.eventBus.emit('routing:latency_calibrated', {
                    deviceId,
                    latency: result.latency
                });
            }

            return result;

        } catch (error) {
            console.error('Failed to auto-calibrate latency:', error);
            throw error;
        }
    }

    /**
     * Measure latency for a device
     */
    async measureLatency(deviceId) {
        try {
            const result = await this.api.measureLatency(deviceId);
            return result;
        } catch (error) {
            console.error('Failed to measure latency:', error);
            throw error;
        }
    }

    /**
     * Set latency for all channels from track data
     * @param {array} tracks - MIDI tracks with latency info
     */
    async setChannelLatenciesFromTracks(tracks) {
        const promises = [];

        tracks.forEach((track, index) => {
            if (track.latency !== undefined) {
                const route = this.channelRoutes[index];
                if (route) {
                    promises.push(
                        this.setDeviceLatency(route.instrumentId, track.latency)
                    );
                }
            }
        });

        await Promise.all(promises);

        console.log(`Set latencies for ${promises.length} channels`);
    }

    // ========================================================================
    // PLAYBACK WITH LATENCY COMPENSATION
    // ========================================================================

    /**
     * Get playback configuration with latency compensation
     * Returns a map of channel -> latency for playback engine
     */
    getPlaybackLatencyMap() {
        const latencyMap = {};

        for (let channel = 0; channel < 16; channel++) {
            latencyMap[channel] = this.getChannelLatency(channel);
        }

        return latencyMap;
    }

    /**
     * Apply latency compensation to MIDI events
     * @param {array} events - MIDI events with time property
     * @param {number} channel - MIDI channel
     */
    applyLatencyCompensation(events, channel) {
        const latency = this.getChannelLatency(channel);

        if (latency === 0) return events;

        // Subtract latency from event times (play earlier)
        return events.map(event => ({
            ...event,
            time: Math.max(0, event.time - (latency / 1000))
        }));
    }

    // ========================================================================
    // PRESETS
    // ========================================================================

    /**
     * Save current routing configuration as preset
     */
    async saveRoutingPreset(name) {
        const preset = {
            name,
            timestamp: Date.now(),
            routes: this.routes,
            channelRoutes: this.channelRoutes,
            latencies: this.latencies
        };

        try {
            await this.api.sendCommand('preset_save', {
                name,
                type: 'routing',
                data: preset
            });

            this.eventBus.emit('routing:preset_saved', { name });

            return preset;

        } catch (error) {
            console.error('Failed to save routing preset:', error);
            throw error;
        }
    }

    /**
     * Load routing preset
     */
    async loadRoutingPreset(presetId) {
        try {
            const preset = await this.api.sendCommand('preset_load', {
                presetId
            });

            if (preset.data) {
                // Restore channel routes
                if (preset.data.channelRoutes) {
                    await this.setChannelRoutes(preset.data.channelRoutes);
                }

                // Restore latencies
                if (preset.data.latencies) {
                    for (const [deviceId, latency] of Object.entries(preset.data.latencies)) {
                        await this.setDeviceLatency(deviceId, latency);
                    }
                }

                this.eventBus.emit('routing:preset_loaded', preset);
            }

            return preset;

        } catch (error) {
            console.error('Failed to load routing preset:', error);
            throw error;
        }
    }

    // ========================================================================
    // UTILITIES
    // ========================================================================

    /**
     * Get complete routing state
     */
    getRoutingState() {
        return {
            devices: this.devices,
            routes: this.routes,
            channelRoutes: this.channelRoutes,
            latencies: this.latencies
        };
    }

    /**
     * Export routing configuration
     */
    exportConfiguration() {
        return {
            version: '1.0',
            timestamp: Date.now(),
            channelRoutes: this.channelRoutes,
            latencies: this.latencies
        };
    }

    /**
     * Import routing configuration
     */
    async importConfiguration(config) {
        if (config.channelRoutes) {
            await this.setChannelRoutes(config.channelRoutes);
        }

        if (config.latencies) {
            for (const [deviceId, latency] of Object.entries(config.latencies)) {
                await this.setDeviceLatency(deviceId, latency);
            }
        }

        this.eventBus.emit('routing:config_imported', config);
    }

    /**
     * Reset all routing
     */
    async resetAll() {
        const confirm = window.confirm('Reset all routing and latency settings?');
        if (!confirm) return false;

        try {
            // Clear all routes
            await this.api.sendCommand('route_clear_all');

            // Reset state
            this.routes = [];
            this.channelRoutes = {};

            this.eventBus.emit('routing:reset');

            return true;

        } catch (error) {
            console.error('Failed to reset routing:', error);
            throw error;
        }
    }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MidiRoutingManager;
}
if (typeof window !== 'undefined') {
    window.MidiRoutingManager = MidiRoutingManager;
}
