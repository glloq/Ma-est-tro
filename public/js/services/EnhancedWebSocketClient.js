/**
 * EnhancedWebSocketClient - Robust WebSocket client with auto-reconnect
 * Features:
 * - Automatic reconnection with exponential backoff
 * - Message queuing when offline
 * - Heartbeat/ping-pong
 * - Promise-based request/response
 * - Event system
 */

class EnhancedWebSocketClient {
    constructor(url, options = {}) {
        this.url = url;
        this.options = {
            reconnectInterval: options.reconnectInterval || 1000,
            maxReconnectInterval: options.maxReconnectInterval || 30000,
            reconnectDecay: options.reconnectDecay || 1.5,
            heartbeatInterval: options.heartbeatInterval || 30000,
            messageTimeout: options.messageTimeout || 5000,
            maxQueueSize: options.maxQueueSize || 100,
            debug: options.debug || false,
            ...options
        };

        this.ws = null;
        this.connected = false;
        this.reconnectAttempts = 0;
        this.reconnectTimeout = null;
        this.heartbeatInterval = null;
        this.messageQueue = [];
        this.pendingRequests = new Map();
        this.messageId = 0;
        this.eventHandlers = new Map();

        this.connect();
    }

    // ========================================================================
    // CONNECTION
    // ========================================================================

    connect() {
        if (this.ws && (this.ws.readyState === WebSocket.CONNECTING || this.ws.readyState === WebSocket.OPEN)) {
            return;
        }

        this.log('Connecting to', this.url);

        try {
            this.ws = new WebSocket(this.url);

            this.ws.onopen = () => this.onOpen();
            this.ws.onclose = (event) => this.onClose(event);
            this.ws.onerror = (error) => this.onError(error);
            this.ws.onmessage = (event) => this.onMessage(event);

        } catch (error) {
            this.log('Connection error:', error);
            this.scheduleReconnect();
        }
    }

    disconnect() {
        this.log('Disconnecting...');

        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
            this.reconnectTimeout = null;
        }

        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }

        if (this.ws) {
            this.ws.onclose = null; // Prevent reconnect
            this.ws.close();
            this.ws = null;
        }

        this.connected = false;
    }

    onOpen() {
        this.log('Connected');
        this.connected = true;
        this.reconnectAttempts = 0;

        // Start heartbeat
        this.startHeartbeat();

        // Flush message queue
        this.flushMessageQueue();

        // Emit connect event
        this.emit('connect');
        this.trigger('connect');
    }

    onClose(event) {
        this.log('Disconnected', event.code, event.reason);
        this.connected = false;

        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }

        // Emit disconnect event
        this.emit('disconnect', event);
        this.trigger('disconnect', event);

        // Auto-reconnect
        if (event.code !== 1000) { // Normal closure
            this.scheduleReconnect();
        }
    }

    onError(error) {
        this.log('WebSocket error:', error);
        this.emit('error', error);
        this.trigger('error', error);
    }

    scheduleReconnect() {
        if (this.reconnectTimeout) return;

        const delay = Math.min(
            this.options.reconnectInterval * Math.pow(this.options.reconnectDecay, this.reconnectAttempts),
            this.options.maxReconnectInterval
        );

        this.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts + 1})`);

        this.reconnectTimeout = setTimeout(() => {
            this.reconnectTimeout = null;
            this.reconnectAttempts++;
            this.connect();
        }, delay);
    }

    // ========================================================================
    // HEARTBEAT
    // ========================================================================

    startHeartbeat() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
        }

        this.heartbeatInterval = setInterval(() => {
            if (this.connected) {
                this.send({ type: 'ping', timestamp: Date.now() });
            }
        }, this.options.heartbeatInterval);
    }

    // ========================================================================
    // MESSAGING
    // ========================================================================

    send(data, options = {}) {
        const message = typeof data === 'string' ? data : JSON.stringify(data);

        if (!this.connected || this.ws.readyState !== WebSocket.OPEN) {
            if (options.queue !== false && this.messageQueue.length < this.options.maxQueueSize) {
                this.log('Queueing message (offline)');
                this.messageQueue.push(message);
                return false;
            } else {
                this.log('Cannot send message (offline, queue full)');
                return false;
            }
        }

        try {
            this.ws.send(message);
            this.log('Sent:', message);
            return true;
        } catch (error) {
            this.log('Send error:', error);
            return false;
        }
    }

    /**
     * Send a request and wait for response (promise-based)
     */
    async request(command, params = {}, timeout = null) {
        return new Promise((resolve, reject) => {
            const messageId = ++this.messageId;
            const message = {
                id: messageId,
                command,
                params,
                timestamp: Date.now()
            };

            // Setup timeout
            const timeoutMs = timeout || this.options.messageTimeout;
            const timeoutId = setTimeout(() => {
                this.pendingRequests.delete(messageId);
                reject(new Error(`Request timeout: ${command}`));
            }, timeoutMs);

            // Store pending request
            this.pendingRequests.set(messageId, {
                resolve: (response) => {
                    clearTimeout(timeoutId);
                    this.pendingRequests.delete(messageId);
                    resolve(response);
                },
                reject: (error) => {
                    clearTimeout(timeoutId);
                    this.pendingRequests.delete(messageId);
                    reject(error);
                }
            });

            // Send message
            const sent = this.send(message);
            if (!sent) {
                clearTimeout(timeoutId);
                this.pendingRequests.delete(messageId);
                reject(new Error('Failed to send request (offline)'));
            }
        });
    }

    flushMessageQueue() {
        this.log(`Flushing ${this.messageQueue.length} queued messages`);

        while (this.messageQueue.length > 0) {
            const message = this.messageQueue.shift();
            this.ws.send(message);
        }
    }

    onMessage(event) {
        this.log('Received:', event.data);

        try {
            const data = JSON.parse(event.data);

            // Handle pong
            if (data.type === 'pong') {
                const latency = Date.now() - data.timestamp;
                this.emit('pong', { latency });
                return;
            }

            // Handle response to request
            if (data.id && this.pendingRequests.has(data.id)) {
                const pending = this.pendingRequests.get(data.id);
                if (data.error) {
                    pending.reject(new Error(data.error));
                } else {
                    pending.resolve(data.result || data);
                }
                return;
            }

            // Handle event/notification
            if (data.type) {
                this.emit(data.type, data);
                this.trigger(data.type, data);
            }

            // Emit raw message
            this.emit('message', data);
            this.trigger('message', data);

        } catch (error) {
            this.log('Message parse error:', error);
        }
    }

    // ========================================================================
    // EVENT SYSTEM
    // ========================================================================

    on(event, handler) {
        if (!this.eventHandlers.has(event)) {
            this.eventHandlers.set(event, []);
        }
        this.eventHandlers.get(event).push(handler);
    }

    off(event, handler) {
        if (!this.eventHandlers.has(event)) return;

        if (handler) {
            const handlers = this.eventHandlers.get(event);
            const index = handlers.indexOf(handler);
            if (index !== -1) {
                handlers.splice(index, 1);
            }
        } else {
            this.eventHandlers.delete(event);
        }
    }

    emit(event, data) {
        if (!this.eventHandlers.has(event)) return;

        const handlers = this.eventHandlers.get(event);
        handlers.forEach(handler => {
            try {
                handler(data);
            } catch (error) {
                this.log('Event handler error:', error);
            }
        });
    }

    /**
     * Compatibility with EventBus pattern
     */
    trigger(event, data) {
        if (window.eventBus) {
            window.eventBus.emit(`ws:${event}`, data);
        }
    }

    // ========================================================================
    // UTILITIES
    // ========================================================================

    isConnected() {
        return this.connected && this.ws && this.ws.readyState === WebSocket.OPEN;
    }

    getState() {
        return {
            connected: this.connected,
            reconnectAttempts: this.reconnectAttempts,
            queueSize: this.messageQueue.length,
            pendingRequests: this.pendingRequests.size
        };
    }

    log(...args) {
        if (this.options.debug) {
            console.log('[WebSocket]', ...args);
        }
    }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = EnhancedWebSocketClient;
}
if (typeof window !== 'undefined') {
    window.EnhancedWebSocketClient = EnhancedWebSocketClient;
}
