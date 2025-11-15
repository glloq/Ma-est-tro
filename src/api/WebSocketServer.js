// src/api/WebSocketServer.js
import { WebSocketServer as WSServer } from 'ws';

class WebSocketServer {
  constructor(app, port = 8080) {
    this.app = app;
    this.port = port;
    this.wss = null;
    this.clients = new Set();
    
    this.app.logger.info('WebSocketServer initialized');
  }

  start() {
    this.wss = new WSServer({ port: this.port });
    
    this.wss.on('connection', (ws, req) => {
      this.handleConnection(ws, req);
    });

    this.wss.on('error', (error) => {
      this.app.logger.error(`WebSocket server error: ${error.message}`);
    });

    this.app.logger.info(`WebSocket server listening on port ${this.port}`);
  }

  handleConnection(ws, req) {
    const clientIp = req.socket.remoteAddress;
    this.app.logger.info(`Client connected: ${clientIp}`);
    
    this.clients.add(ws);

    // Send welcome message
    ws.send(JSON.stringify({
      type: 'event',
      event: 'connected',
      data: {
        version: '5.0.0',
        timestamp: Date.now()
      }
    }));

    // Handle messages
    ws.on('message', (data) => {
      this.handleMessage(ws, data);
    });

    // Handle close
    ws.on('close', () => {
      this.handleClose(ws, clientIp);
    });

    // Handle error
    ws.on('error', (error) => {
      this.app.logger.error(`WebSocket client error: ${error.message}`);
    });

    // Setup ping/pong for keep-alive
    ws.isAlive = true;
    ws.on('pong', () => {
      ws.isAlive = true;
    });
  }

  handleMessage(ws, data) {
    try {
      const message = JSON.parse(data.toString());
      
      // Log command
      this.app.logger.debug(`Received command: ${message.command}`);

      // Dispatch to command handler
      this.app.commandHandler.handle(message, ws);
    } catch (error) {
      this.app.logger.error(`Failed to process message: ${error.message}`);
      
      ws.send(JSON.stringify({
        type: 'error',
        error: 'Invalid message format',
        timestamp: Date.now()
      }));
    }
  }

  handleClose(ws, clientIp) {
    this.clients.delete(ws);
    this.app.logger.info(`Client disconnected: ${clientIp}`);
  }

  broadcast(event, data) {
    const message = JSON.stringify({
      type: 'event',
      event: event,
      data: data,
      timestamp: Date.now()
    });

    let sent = 0;
    this.clients.forEach(client => {
      if (client.readyState === 1) { // OPEN
        client.send(message);
        sent++;
      }
    });

    this.app.logger.debug(`Broadcast ${event} to ${sent} clients`);
  }

  send(ws, type, data) {
    if (ws.readyState === 1) { // OPEN
      ws.send(JSON.stringify({
        type: type,
        data: data,
        timestamp: Date.now()
      }));
    }
  }

  startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      this.clients.forEach(ws => {
        if (!ws.isAlive) {
          ws.terminate();
          this.clients.delete(ws);
          return;
        }
        
        ws.isAlive = false;
        ws.ping();
      });
    }, 30000); // 30 seconds
  }

  close() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    this.clients.forEach(client => {
      client.close();
    });

    if (this.wss) {
      this.wss.close();
    }

    this.app.logger.info('WebSocket server closed');
  }

  getStats() {
    return {
      clients: this.clients.size,
      port: this.port
    };
  }
}

export default WebSocketServer;