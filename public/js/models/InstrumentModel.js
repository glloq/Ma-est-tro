// ============================================================================
// Fichier: frontend/js/models/InstrumentModel.js
// Chemin réel: frontend/js/models/InstrumentModel.js
// Version: v4.2.2 - API CORRECTED
// Date: 2025-11-02
// ============================================================================
// CORRECTIONS v4.2.2:
// ✅ device_id snake_case
// ✅ response via BackendService (déjà extrait)
// ✅ devices.scan pour count
// ============================================================================

class InstrumentModel extends BaseModel {
    constructor(eventBus, backend, logger, initialData = {}, options = {}) {
        super(eventBus, backend, logger, initialData, {
            persistKey: 'instrumentmodel',
            eventPrefix: 'instrument',
            autoPersist: false,
            ...options
        });
        
        this.instruments = new Map();
        
        this.state = {
            scanning: false,
            lastScan: null,
            totalInstruments: 0,
            connectedCount: 0
        };
        
        this.log('info', 'InstrumentModel', '✓ v4.2.2 initialized');
    }
    
    /**
     * ✅ devices.scan pour count
     */
    async scan(full_scan = false) {
        if (this.state.scanning) return Array.from(this.instruments.values());
        if (!this.backend) throw new Error('Backend not available');
        
        this.state.scanning = true;
        this.eventBus?.emit('instruments:scan:started');
        
        try {
            const response = await this.backend.scanDevices(full_scan);
            
            // ✅ BackendService extrait déjà response.data
            const instruments = response.devices || [];
            const count = response.count || instruments.length;
            
            this.instruments.clear();
            instruments.forEach(inst => {
                this.instruments.set(inst.id, {
                    id: inst.id,
                    name: inst.name,
                    type: inst.type,
                    status: inst.status,
                    connected: inst.status === 2,
                    available: inst.available || true
                });
            });
            
            this.state.totalInstruments = count;
            this.state.connectedCount = instruments.filter(i => i.status === 2).length;
            this.state.lastScan = Date.now();
            
            this.log('info', 'InstrumentModel', `Found ${count} instruments (${this.state.connectedCount} connected)`);
            
            this.eventBus?.emit('instruments:scan:complete', {
                instruments: Array.from(this.instruments.values()),
                total: count,
                connected: this.state.connectedCount
            });
            
            return Array.from(this.instruments.values());
            
        } catch (error) {
            this.log('error', 'InstrumentModel.scan', error);
            throw error;
        } finally {
            this.state.scanning = false;
        }
    }
    
    async listDevices() {
        if (!this.backend) throw new Error('Backend not available');
        
        try {
            const response = await this.backend.listDevices();
            const instruments = response.devices || [];
            
            instruments.forEach(inst => {
                this.instruments.set(inst.id, {
                    id: inst.id,
                    name: inst.name,
                    type: inst.type,
                    status: inst.status,
                    connected: inst.status === 2,
                    available: inst.available || true
                });
            });
            
            return Array.from(this.instruments.values());
            
        } catch (error) {
            this.log('error', 'InstrumentModel.listDevices', error);
            throw error;
        }
    }
    
    /**
     * ✅ device_id snake_case
     */
    async connect(device_id) {
        if (!this.backend) throw new Error('Backend not available');
        
        try {
            await this.backend.connectDevice(device_id);
            
            const inst = this.instruments.get(device_id);
            if (inst) {
                inst.connected = true;
                inst.status = 2;
            }
            
            this.eventBus?.emit('instrument:connected', { device_id });
            
        } catch (error) {
            this.log('error', 'InstrumentModel.connect', error);
            throw error;
        }
    }
    
    async disconnect(device_id) {
        if (!this.backend) throw new Error('Backend not available');
        
        try {
            await this.backend.disconnectDevice(device_id);
            
            const inst = this.instruments.get(device_id);
            if (inst) {
                inst.connected = false;
                inst.status = 1;
            }
            
            this.eventBus?.emit('instrument:disconnected', { device_id });
            
        } catch (error) {
            this.log('error', 'InstrumentModel.disconnect', error);
            throw error;
        }
    }
    
    getInstrument(device_id) {
        return this.instruments.get(device_id);
    }
    
    getAllInstruments() {
        return Array.from(this.instruments.values());
    }
    
    getConnectedInstruments() {
        return Array.from(this.instruments.values()).filter(i => i.connected);
    }

    /**
     * Send SysEx Identity Request to a device
     * @param {string} deviceName - Name of the device
     * @param {number} deviceId - MIDI device ID (default: 0x7F for broadcast)
     * @returns {Promise<Object>} Response from backend
     */
    async requestIdentity(deviceName, deviceId = 0x7F) {
        if (!this.backend) throw new Error('Backend not available');

        try {
            const response = await this.backend.sendCommand('device_identity_request', {
                deviceName: deviceName,
                deviceId: deviceId
            });

            this.log('info', 'InstrumentModel', `Identity request sent to ${deviceName}`);
            return response;

        } catch (error) {
            this.log('error', 'InstrumentModel.requestIdentity', error);
            throw error;
        }
    }

    /**
     * Update instrument settings (custom name, sync delay, MAC address)
     * @param {string} deviceId - Device ID
     * @param {Object} settings - Settings object
     * @param {string} settings.custom_name - Custom name for the instrument
     * @param {number} settings.sync_delay - Synchronization delay in microseconds
     * @param {string} settings.mac_address - MAC address of the instrument
     * @returns {Promise<Object>} Response from backend
     */
    async updateSettings(deviceId, settings) {
        if (!this.backend) throw new Error('Backend not available');

        try {
            const response = await this.backend.sendCommand('instrument_update_settings', {
                deviceId: deviceId,
                custom_name: settings.custom_name,
                sync_delay: settings.sync_delay,
                mac_address: settings.mac_address,
                name: settings.name
            });

            this.log('info', 'InstrumentModel', `Settings updated for ${deviceId}`);
            this.eventBus?.emit('instrument:settings:updated', { deviceId, settings });

            return response;

        } catch (error) {
            this.log('error', 'InstrumentModel.updateSettings', error);
            throw error;
        }
    }

    /**
     * Get instrument settings
     * @param {string} deviceId - Device ID
     * @returns {Promise<Object>} Instrument settings
     */
    async getSettings(deviceId) {
        if (!this.backend) throw new Error('Backend not available');

        try {
            const response = await this.backend.sendCommand('instrument_get_settings', {
                deviceId: deviceId
            });

            return response.settings;

        } catch (error) {
            this.log('error', 'InstrumentModel.getSettings', error);
            throw error;
        }
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = InstrumentModel;
}

if (typeof window !== 'undefined') {
    window.InstrumentModel = InstrumentModel;
}