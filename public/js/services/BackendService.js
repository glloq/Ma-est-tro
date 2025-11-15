// ============================================================================
// Fichier: frontend/js/services/BackendService.js
// Chemin réel: frontend/js/services/BackendService.js  
// Version: v5.0.0 - Phase 6 Node.js Backend
// Date: 2025-11-15
// ============================================================================
// MIGRATION PHASE 6:
// ✅ Protocole WebSocket simplifié (Node.js)
// ✅ Format requête: { command, data, timestamp }
// ✅ Format réponse: { type, command, data, timestamp, error? }
// ✅ Suppression de l'enveloppe complexe (id, version, payload)
// ✅ Compatibilité avec backend Express + ws
// ✅ Heartbeat simplifié avec system.ping
// ============================================================================

class BackendService {
    constructor(url, eventBus, logger) {
        this.eventBus = eventBus || window.eventBus || null;
        this.logger = logger || console;
        
        this.ws = null;
        this.connected = false;
        this.connecting = false;
        this.offlineMode = false;
        this.reconnectionStopped = false;
        
        const isDevelopment = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        const isRaspberryPi = window.location.hostname === '192.168.1.37';
        
        this.config = {
            url: url || 'ws://localhost:8080',
            reconnectInterval: isDevelopment ? 2000 : 3000,
            maxReconnectInterval: isDevelopment ? 20000 : 30000,
            reconnectDecay: 1.5,
            timeoutInterval: isDevelopment ? 3000 : 5000,
            maxReconnectAttempts: isDevelopment ? 10 : 5,
            heartbeatInterval: isRaspberryPi ? 60000 : 45000,
            heartbeatTimeout: isRaspberryPi ? 120000 : 90000,
            maxHeartbeatFailures: 3,
            defaultCommandTimeout: 10000,
            heartbeatCommandTimeout: isRaspberryPi ? 20000 : 15000
        };
        
        this.reconnectAttempts = 0;
        this.reconnectTimer = null;
        this.heartbeatTimer = null;
        this.connectionTimeout = null;
        
        this.lastActivityTime = Date.now();
        this.connectionStartTime = null;
        this.lastHeartbeatCheck = null;
        this.heartbeatPending = false;
        this.heartbeatFailures = 0;
        
        this.messageQueue = [];
        this.maxQueueSize = 100;
        this.messageCallbacks = new Map();
        this.connectionHistory = this.loadConnectionHistory();
        
        this.logger.info('BackendService', `Service initialized (v5.0.0 - Phase 6 Node.js)`);
        this.logger.info('BackendService', `Environment: ${isDevelopment ? 'DEV' : isRaspberryPi ? 'RPI' : 'PROD'}`);
    }
    
    // ========================================================================
    // TIMESTAMP GENERATION
    // ========================================================================
    
    generateTimestamp() {
        return Date.now();
    }
    
    /**
     * ✅ Phase 6: Validation format message simplifié
     */
    validateMessageFormat(message) {
        if (typeof message !== 'object' || message === null) {
            this.logger.error('BackendService', '❌ Not an object');
            return false;
        }
        
        // Requête doit avoir: command, data, timestamp
        if (message.command !== undefined) {
            if (!message.hasOwnProperty('data')) {
                this.logger.error('BackendService', '❌ Missing data field');
                return false;
            }
            if (!message.hasOwnProperty('timestamp')) {
                this.logger.error('BackendService', '❌ Missing timestamp field');
                return false;
            }
            return true;
        }
        
        // Réponse doit avoir: type, command, data, timestamp
        if (message.type !== undefined) {
            const requiredFields = ['type', 'command', 'data', 'timestamp'];
            for (const field of requiredFields) {
                if (!message.hasOwnProperty(field)) {
                    this.logger.error('BackendService', `❌ Missing field: ${field}`);
                    return false;
                }
            }
            return true;
        }
        
        this.logger.error('BackendService', '❌ Invalid message format');
        return false;
    }
    
    // ========================================================================
    // CONNEXION WEBSOCKET
    // ========================================================================
    
    async connect(url = null) {
        if (this.connected) {
            this.logger.warn('BackendService', 'Already connected');
            return true;
        }
        
        if (this.connecting) {
            this.logger.warn('BackendService', 'Connection already in progress');
            return false;
        }
        
        const wsUrl = url || this.config.url;
        this.connecting = true;
        this.reconnectionStopped = false;
        this.connectionStartTime = Date.now();
        
        this.logger.info('BackendService', `Connecting to ${wsUrl}...`);
        
        return new Promise((resolve) => {
            try {
                this.ws = new WebSocket(wsUrl);
                
                this.connectionTimeout = setTimeout(() => {
                    if (!this.connected) {
                        this.logger.error('BackendService', 'Connection timeout');
                        this.handleConnectionError('Connection timeout');
                        resolve(false);
                    }
                }, this.config.timeoutInterval);
                
                this.ws.onopen = () => {
                    clearTimeout(this.connectionTimeout);
                    this.handleOpen();
                    resolve(true);
                };
                
                this.ws.onclose = (event) => {
                    this.handleClose(event);
                };
                
                this.ws.onerror = (error) => {
                    this.handleError(error);
                    resolve(false);
                };
                
                this.ws.onmessage = (event) => {
                    this.handleMessage(event);
                };
                
            } catch (error) {
                this.logger.error('BackendService', 'Connection failed:', error);
                this.handleConnectionError(error);
                resolve(false);
            }
        });
    }
    
    handleOpen() {
        this.connected = true;
        this.connecting = false;
        this.offlineMode = false;
        this.reconnectAttempts = 0;
        this.connectionStartTime = Date.now();
        
        this.logger.info('BackendService', '✓ Connected successfully');
        this.eventBus.emit('backend:connected');
        
        this.saveConnectionEvent('connected', {
            timestamp: this.generateTimestamp(),
            url: this.config.url
        });
        
        this.startHeartbeat();
        this.flushMessageQueue();
    }
    
    handleClose(event) {
        const wasConnected = this.connected;
        const uptime = this.connectionStartTime ? Date.now() - this.connectionStartTime : 0;
        
        const diagnostic = {
            timestamp: this.generateTimestamp(),
            code: event.code,
            reason: event.reason || 'No reason provided',
            wasClean: event.wasClean,
            wasConnected: wasConnected,
            uptime: uptime,
            uptimeFormatted: this.formatUptime(uptime),
            lastActivity: this.lastActivityTime,
            timeSinceActivity: Date.now() - this.lastActivityTime,
            heartbeatStatus: {
                failures: this.heartbeatFailures,
                pending: this.heartbeatPending,
                lastCheck: this.lastHeartbeatCheck
            },
            queue: {
                size: this.messageQueue.length,
                maxSize: this.maxQueueSize
            },
            callbacks: {
                pending: this.messageCallbacks.size
            },
            reconnect: {
                attempts: this.reconnectAttempts,
                max: this.config.maxReconnectAttempts,
                stopped: this.reconnectionStopped
            }
        };
        
        this.connected = false;
        this.connecting = false;
        this.stopHeartbeat();
        
        this.logger.error('BackendService', '❌ CONNEXION FERMÉE:', JSON.stringify(diagnostic, null, 2));
        
        const closeReason = this.getCloseReason(event.code);
        this.logger.warn('BackendService', `Code ${event.code}: ${closeReason}`);
        
        this.saveConnectionEvent('closed', diagnostic);
        this.failPendingCallbacks('Connection closed');
        
        if (wasConnected) {
            this.eventBus.emit('backend:disconnected', {
                code: event.code,
                reason: event.reason,
                uptime: uptime,
                diagnostic: diagnostic
            });
        }
        
        if (!this.reconnectionStopped) {
            this.scheduleReconnection();
        }
    }
    
    handleError(error) {
        this.logger.error('BackendService', 'WebSocket error:', error);
        this.eventBus.emit('backend:error', error);
    }
    
    handleConnectionError(error) {
        this.connecting = false;
        this.logger.error('BackendService', 'Connection error:', error);
        this.eventBus.emit('backend:connection_error', error);
    }
    
    scheduleReconnection() {
        if (this.reconnectionStopped) return;
        
        if (this.reconnectAttempts >= this.config.maxReconnectAttempts) {
            this.logger.error('BackendService', 'Max reconnection attempts reached');
            this.offlineMode = true;
            this.eventBus.emit('backend:offline');
            return;
        }
        
        const delay = Math.min(
            this.config.reconnectInterval * Math.pow(this.config.reconnectDecay, this.reconnectAttempts),
            this.config.maxReconnectInterval
        );
        
        this.reconnectAttempts++;
        this.logger.info('BackendService', `Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.config.maxReconnectAttempts})`);
        
        this.reconnectTimer = setTimeout(() => {
            this.connect();
        }, delay);
    }
    
    // ========================================================================
    // GESTION DES MESSAGES
    // ========================================================================
    
    handleMessage(event) {
        this.lastActivityTime = Date.now();
        
        try {
            const message = JSON.parse(event.data);
            
            if (!this.validateMessageFormat(message)) {
                this.logger.error('BackendService', 'Invalid message format received');
                return;
            }
            
            // Événement backend
            if (message.type === 'event') {
                this.handleEvent(message);
                return;
            }
            
            // Réponse à une commande
            if (message.type === 'response') {
                this.handleResponse(message);
                return;
            }
            
            // Erreur
            if (message.type === 'error') {
                this.handleErrorMessage(message);
                return;
            }
            
            this.logger.warn('BackendService', 'Unknown message type:', message.type);
            
        } catch (error) {
            this.logger.error('BackendService', 'Failed to parse message:', error);
        }
    }
    
    handleEvent(message) {
        const eventName = message.command || 'unknown';
        this.logger.debug('BackendService', `Event received: ${eventName}`);
        this.eventBus.emit(`backend:${eventName}`, message.data);
    }
    
    handleResponse(message) {
        const command = message.command;
        
        // Heartbeat response
        if (command === 'system.ping' && this.heartbeatPending) {
            this.heartbeatPending = false;
            this.heartbeatFailures = 0;
            this.logger.debug('BackendService', '💓 Heartbeat response received');
            return;
        }
        
        // Chercher le callback correspondant
        const callbacks = Array.from(this.messageCallbacks.values());
        for (let i = 0; i < callbacks.length; i++) {
            const callback = callbacks[i];
            // On essaie de trouver le callback correspondant
            // Phase 6 ne retourne pas l'ID original, donc on prend le premier callback en attente
            if (callback && typeof callback === 'function') {
                this.messageCallbacks.delete(this.messageCallbacks.keys().next().value);
                
                if (message.error) {
                    callback({ success: false, error: message.error });
                } else {
                    callback({ success: true, data: message.data });
                }
                return;
            }
        }
        
        this.logger.debug('BackendService', `Response for ${command}:`, message.data);
    }
    
    handleErrorMessage(message) {
        this.logger.error('BackendService', `Error from backend [${message.command}]:`, message.error);
        this.eventBus.emit('backend:error', {
            command: message.command,
            error: message.error,
            data: message.data
        });
    }
    
    failPendingCallbacks(reason) {
        const count = this.messageCallbacks.size;
        
        this.messageCallbacks.forEach((callback) => {
            if (typeof callback === 'function') {
                callback({
                    success: false,
                    error: reason
                });
            }
        });
        
        this.messageCallbacks.clear();
        
        if (count > 0) {
            this.logger.warn('BackendService', `Failed ${count} pending callbacks: ${reason}`);
        }
    }
    
    // ========================================================================
    // HEARTBEAT
    // ========================================================================
    
    startHeartbeat() {
        this.stopHeartbeat();
        
        this.heartbeatTimer = setInterval(() => {
            this.checkHeartbeat();
        }, this.config.heartbeatInterval);
        
        this.logger.debug('BackendService', `Heartbeat started (interval: ${this.config.heartbeatInterval}ms)`);
    }
    
    stopHeartbeat() {
        if (this.heartbeatTimer) {
            clearInterval(this.heartbeatTimer);
            this.heartbeatTimer = null;
            this.heartbeatPending = false;
            this.heartbeatFailures = 0;
            this.logger.debug('BackendService', 'Heartbeat stopped');
        }
    }
    
    async checkHeartbeat() {
        if (!this.connected) {
            this.stopHeartbeat();
            return;
        }
        
        if (this.heartbeatPending) {
            this.heartbeatFailures++;
            this.logger.warn('BackendService', `💔 Heartbeat timeout (failures: ${this.heartbeatFailures}/${this.config.maxHeartbeatFailures})`);
            
            if (this.heartbeatFailures >= this.config.maxHeartbeatFailures) {
                this.logger.error('BackendService', 'Max heartbeat failures reached, closing connection');
                this.ws.close(1000, 'Heartbeat timeout');
                return;
            }
        }
        
        this.heartbeatPending = true;
        this.lastHeartbeatCheck = Date.now();
        
        // Envoyer ping avec timeout spécifique
        this.sendCommand('system.ping', {}, this.config.heartbeatCommandTimeout)
            .then(() => {
                this.logger.debug('BackendService', '💓 Heartbeat OK');
            })
            .catch((error) => {
                this.logger.error('BackendService', '💔 Heartbeat failed:', error);
            });
    }
    
    // ========================================================================
    // ENVOI DE MESSAGES
    // ========================================================================
    
    send(data) {
        if (!this.connected || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
            if (typeof data === 'object' && !this.validateMessageFormat(data)) {
                this.logger.error('BackendService', '❌ REJECT invalid - not queued');
                return false;
            }
            if (this.messageQueue.length >= this.maxQueueSize) {
                this.logger.warn('BackendService', 'Queue full');
                return false;
            }
            this.messageQueue.push(data);
            return false;
        }
        
        try {
            let message;
            if (typeof data === 'string') {
                const parsed = JSON.parse(data);
                if (!this.validateMessageFormat(parsed)) return false;
                message = data;
            } else {
                if (!this.validateMessageFormat(data)) return false;
                message = JSON.stringify(data);
            }
            this.ws.send(message);
            return true;
        } catch (error) {
            this.logger.error('BackendService', 'Send error:', error);
            return false;
        }
    }
    
    async sendCommand(command, data = {}, timeout = null) {
        return new Promise((resolve, reject) => {
            if (!this.isConnected()) {
                reject(new Error('Not connected to backend'));
                return;
            }
            
            const timeoutMs = timeout || this.config.defaultCommandTimeout;
            const timestamp = this.generateTimestamp();
            
            const timeoutTimer = setTimeout(() => {
                this.messageCallbacks.delete(timestamp);
                reject(new Error(`Command timeout after ${timeoutMs}ms: ${command}`));
            }, timeoutMs);
            
            this.messageCallbacks.set(timestamp, (response) => {
                clearTimeout(timeoutTimer);
                
                if (response.success === true) {
                    this.logger.debug('BackendService', `✔ Command success: ${command}`);
                    resolve(response.data || response);
                } else {
                    this.logger.error('BackendService', `✖ Command failed: ${command}`, response.error);
                    reject(new Error(response.error || 'Command failed'));
                }
            });
            
            const message = {
                command: command,
                data: data,
                timestamp: timestamp
            };
            
            if (!this.send(message)) {
                clearTimeout(timeoutTimer);
                this.messageCallbacks.delete(timestamp);
                reject(new Error('Failed to send command'));
            }
        });
    }
    
    // ========================================================================
    // API COMMANDS WRAPPERS
    // ========================================================================
    
    // Device Management
    async getDeviceList() { return this.sendCommand('devices.list'); }
    async refreshDevices() { return this.sendCommand('devices.refresh'); }
    async getDeviceInfo(deviceId) { return this.sendCommand('devices.info', { deviceId }); }
    async enableDevice(deviceId) { return this.sendCommand('devices.enable', { deviceId, enabled: true }); }
    async disableDevice(deviceId) { return this.sendCommand('devices.enable', { deviceId, enabled: false }); }
    
    // File Management
    async listFiles(folder = '/') { return this.sendCommand('files.list', { folder }); }
    async uploadFile(filename, data) { return this.sendCommand('files.upload', { filename, data }); }
    async loadFile(fileId) { return this.sendCommand('files.load', { fileId }); }
    async deleteFile(fileId) { return this.sendCommand('files.delete', { fileId }); }
    async saveFile(fileId, midi) { return this.sendCommand('files.save', { fileId, midi }); }
    
    // Playback
    async playbackStart(fileId) { return this.sendCommand('playback.start', { fileId }); }
    async playbackPause() { return this.sendCommand('playback.pause'); }
    async playbackStop() { return this.sendCommand('playback.stop'); }
    async playbackResume() { return this.sendCommand('playback.resume'); }
    async playbackSeek(position) { return this.sendCommand('playback.seek', { position }); }
    async playbackSetLoop(enabled) { return this.sendCommand('playback.setLoop', { enabled }); }
    async playbackGetStatus() { return this.sendCommand('playback.getStatus'); }
    
    // Routing
    async createRoute(source, destination, channel = 0) { 
        return this.sendCommand('routing.create', { source, destination, channel }); 
    }
    async deleteRoute(routeId) { return this.sendCommand('routing.delete', { routeId }); }
    async listRoutes() { return this.sendCommand('routing.list'); }
    async enableRoute(routeId) { return this.sendCommand('routing.enable', { routeId, enabled: true }); }
    async disableRoute(routeId) { return this.sendCommand('routing.enable', { routeId, enabled: false }); }
    
    // System
    async systemInfo() { return this.sendCommand('system.info'); }
    async systemStatus() { return this.sendCommand('system.status'); }
    async systemVersion() { return this.sendCommand('system.version'); }
    async systemCommands() { return this.sendCommand('system.commands'); }
    
    // ========================================================================
    // UTILS
    // ========================================================================
    
    flushMessageQueue() {
        if (this.messageQueue.length === 0) return;
        
        let success = 0, failed = 0, invalid = 0;
        
        while (this.messageQueue.length > 0) {
            const msg = this.messageQueue.shift();
            if (typeof msg === 'object' && !this.validateMessageFormat(msg)) {
                invalid++;
                continue;
            }
            this.send(msg) ? success++ : failed++;
        }
        
        this.logger.info('BackendService', `Flushed: ${success} sent, ${failed} fail, ${invalid} invalid`);
    }
    
    disconnect() {
        this.stopHeartbeat();
        this.reconnectionStopped = true;
        
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
        
        this.failPendingCallbacks('Manual disconnect');
        
        if (this.ws) {
            this.ws.close(1000, 'Client disconnect');
            this.ws = null;
        }
        
        this.connected = false;
        this.connecting = false;
        this.reconnectAttempts = 0;
        
        this.logger.info('BackendService', 'Disconnected');
        
        this.saveConnectionEvent('manual_disconnect', {
            timestamp: this.generateTimestamp()
        });
    }
    
    enableReconnection() {
        this.reconnectionStopped = false;
        this.offlineMode = false;
        this.reconnectAttempts = 0;
        
        if (!this.connected && !this.connecting) {
            this.logger.info('BackendService', 'Reconnection enabled, attempting to connect');
            this.connect();
        }
    }
    
    disableReconnection() {
        this.reconnectionStopped = true;
        this.logger.info('BackendService', 'Reconnection disabled');
    }
    
    isConnected() {
        return this.connected && this.ws && this.ws.readyState === WebSocket.OPEN;
    }
    
    isOffline() {
        return this.offlineMode;
    }
    
    getConnectionState() {
        if (this.offlineMode) return 'offline';
        if (!this.ws) return 'disconnected';
        
        switch (this.ws.readyState) {
            case WebSocket.CONNECTING: return 'connecting';
            case WebSocket.OPEN: return 'connected';
            case WebSocket.CLOSING: return 'closing';
            case WebSocket.CLOSED: return 'disconnected';
            default: return 'unknown';
        }
    }
    
    getStatus() {
        return {
            connected: this.connected,
            connecting: this.connecting,
            offlineMode: this.offlineMode,
            reconnectAttempts: this.reconnectAttempts,
            maxReconnectAttempts: this.config.maxReconnectAttempts,
            reconnectionStopped: this.reconnectionStopped,
            state: this.getConnectionState(),
            queuedMessages: this.messageQueue.length,
            pendingCallbacks: this.messageCallbacks.size,
            url: this.config.url,
            lastActivityTime: this.lastActivityTime,
            timeSinceActivity: Date.now() - this.lastActivityTime,
            heartbeatFailures: this.heartbeatFailures,
            heartbeatPending: this.heartbeatPending,
            heartbeatInterval: this.config.heartbeatInterval,
            heartbeatTimeout: this.config.heartbeatTimeout,
            uptime: this.connectionStartTime ? Date.now() - this.connectionStartTime : 0
        };
    }
    
    formatUptime(ms) {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        
        if (hours > 0) {
            return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
        } else if (minutes > 0) {
            return `${minutes}m ${seconds % 60}s`;
        } else {
            return `${seconds}s`;
        }
    }
    
    getCloseReason(code) {
        const reasons = {
            1000: 'Normal closure',
            1001: 'Going away (browser closed)',
            1002: 'Protocol error',
            1003: 'Unsupported data',
            1006: 'Abnormal closure (connection lost)',
            1007: 'Invalid frame payload data',
            1008: 'Policy violation',
            1009: 'Message too big',
            1010: 'Missing extension',
            1011: 'Internal server error',
            1012: 'Service restart',
            1013: 'Try again later',
            1014: 'Bad gateway',
            1015: 'TLS handshake failed'
        };
        
        return reasons[code] || `Unknown code: ${code}`;
    }
    
    // ========================================================================
    // DIAGNOSTIC
    // ========================================================================
    
    loadConnectionHistory() {
        try {
            const history = localStorage.getItem('midimind_connection_history');
            return history ? JSON.parse(history) : [];
        } catch (error) {
            this.logger.error('BackendService', 'Error loading connection history:', error);
            return [];
        }
    }
    
    saveConnectionEvent(eventType, data) {
        try {
            const event = {
                type: eventType,
                timestamp: this.generateTimestamp(),
                ...data
            };
            
            this.connectionHistory.push(event);
            
            if (this.connectionHistory.length > 50) {
                this.connectionHistory = this.connectionHistory.slice(-50);
            }
            
            localStorage.setItem('midimind_connection_history', JSON.stringify(this.connectionHistory));
            
            this.logger.debug('BackendService', `Connection event saved: ${eventType}`);
        } catch (error) {
            this.logger.error('BackendService', 'Error saving connection event:', error);
        }
    }
    
    getConnectionHistory() {
        return [...this.connectionHistory];
    }
    
    clearConnectionHistory() {
        this.connectionHistory = [];
        try {
            localStorage.removeItem('midimind_connection_history');
            this.logger.info('BackendService', 'Connection history cleared');
        } catch (error) {
            this.logger.error('BackendService', 'Error clearing connection history:', error);
        }
    }
}

// ============================================================================
// EXPORT
// ============================================================================

if (typeof module !== 'undefined' && module.exports) {
    module.exports = BackendService;
}
window.BackendService = BackendService;