// src/api/HttpServer.js
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class HttpServer {
  constructor(app, port = 8080) {
    this.app = app;
    this.port = port;
    this.server = null;
    this.expressApp = express();
    
    this.setupRoutes();
    this.app.logger.info('HttpServer initialized');
  }

  setupRoutes() {
    // Serve static files from public directory
    const publicPath = path.join(__dirname, '../../public');
    this.expressApp.use(express.static(publicPath));

    // API health check
    this.expressApp.get('/api/health', (req, res) => {
      res.json({
        status: 'ok',
        version: '5.0.0',
        uptime: process.uptime(),
        timestamp: Date.now()
      });
    });

    // API status
    this.expressApp.get('/api/status', (req, res) => {
      res.json({
        devices: this.app.deviceManager.getDeviceList().length,
        routes: this.app.midiRouter.getRouteList().length,
        files: this.app.database.getFiles('/').length,
        memory: process.memoryUsage(),
        uptime: process.uptime()
      });
    });

    // Fallback to index.html for SPA
    this.expressApp.get('*', (req, res) => {
      res.sendFile(path.join(publicPath, 'index.html'));
    });
  }

  start() {
    this.server = this.expressApp.listen(this.port, () => {
      this.app.logger.info(`HTTP server listening on port ${this.port}`);
    });

    this.server.on('error', (error) => {
      this.app.logger.error(`HTTP server error: ${error.message}`);
    });
  }

  close() {
    if (this.server) {
      this.server.close(() => {
        this.app.logger.info('HTTP server closed');
      });
    }
  }
}

export default HttpServer;