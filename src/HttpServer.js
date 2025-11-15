import express from 'express';
import cors from 'cors';
import path from 'path';

class HttpServer {
  constructor(app) {
    this.app = app;
    this.express = express();
    this.server = null;
    this.setupMiddleware();
    this.setupRoutes();
  }

  setupMiddleware() {
    // CORS
    this.express.use(cors());

    // Body parsing
    this.express.use(express.json({ limit: '10mb' }));
    this.express.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Request logging
    this.express.use((req, res, next) => {
      this.app.logger.logRequest(req);
      next();
    });

    // Static files
    this.express.use(express.static(this.app.config.paths.public));
  }

  setupRoutes() {
    // Health check
    this.express.get('/api/health', (req, res) => {
      const health = {
        status: 'ok',
        timestamp: Date.now(),
        uptime: process.uptime(),
        database: this.app.database.healthCheck(),
        version: '5.0.0'
      };
      res.json(health);
    });

    // System status
    this.express.get('/api/status', (req, res) => {
      const status = {
        cpu: process.cpuUsage(),
        memory: process.memoryUsage(),
        uptime: process.uptime(),
        version: '5.0.0'
      };
      res.json(status);
    });

    // Settings
    this.express.get('/api/settings', (req, res) => {
      try {
        const settings = this.app.database.getSettings();
        res.json({ settings });
      } catch (error) {
        this.app.logger.error('Failed to get settings:', error);
        res.status(500).json({ error: 'Failed to get settings' });
      }
    });

    this.express.get('/api/settings/:key', (req, res) => {
      try {
        const value = this.app.database.getSetting(req.params.key);
        if (value === null) {
          return res.status(404).json({ error: 'Setting not found' });
        }
        res.json({ key: req.params.key, value });
      } catch (error) {
        this.app.logger.error('Failed to get setting:', error);
        res.status(500).json({ error: 'Failed to get setting' });
      }
    });

    this.express.put('/api/settings/:key', (req, res) => {
      try {
        const { value, type } = req.body;
        this.app.database.setSetting(req.params.key, value, type || 'string');
        res.json({ success: true });
      } catch (error) {
        this.app.logger.error('Failed to set setting:', error);
        res.status(500).json({ error: 'Failed to set setting' });
      }
    });

    // Presets
    this.express.get('/api/presets', (req, res) => {
      try {
        const category = req.query.category;
        const presets = this.app.database.getPresets(category);
        res.json({ presets });
      } catch (error) {
        this.app.logger.error('Failed to get presets:', error);
        res.status(500).json({ error: 'Failed to get presets' });
      }
    });

    this.express.get('/api/presets/:id', (req, res) => {
      try {
        const preset = this.app.database.getPreset(req.params.id);
        if (!preset) {
          return res.status(404).json({ error: 'Preset not found' });
        }
        res.json({ preset });
      } catch (error) {
        this.app.logger.error('Failed to get preset:', error);
        res.status(500).json({ error: 'Failed to get preset' });
      }
    });

    // Sessions
    this.express.get('/api/sessions', (req, res) => {
      try {
        const sessions = this.app.database.getSessions();
        res.json({ sessions });
      } catch (error) {
        this.app.logger.error('Failed to get sessions:', error);
        res.status(500).json({ error: 'Failed to get sessions' });
      }
    });

    // MIDI History
    this.express.get('/api/history', (req, res) => {
      try {
        const limit = parseInt(req.query.limit) || 100;
        const deviceId = req.query.device;
        const history = this.app.database.getMidiHistory(limit, deviceId);
        res.json({ history });
      } catch (error) {
        this.app.logger.error('Failed to get history:', error);
        res.status(500).json({ error: 'Failed to get history' });
      }
    });

    // MIDI Files
    this.express.get('/api/files', (req, res) => {
      try {
        const files = this.app.database.getMidiFiles();
        res.json({ files });
      } catch (error) {
        this.app.logger.error('Failed to get files:', error);
        res.status(500).json({ error: 'Failed to get files' });
      }
    });

    this.express.get('/api/files/:id', (req, res) => {
      try {
        const file = this.app.database.getMidiFile(req.params.id);
        if (!file) {
          return res.status(404).json({ error: 'File not found' });
        }
        res.json({ file });
      } catch (error) {
        this.app.logger.error('Failed to get file:', error);
        res.status(500).json({ error: 'Failed to get file' });
      }
    });

    // Playlists
    this.express.get('/api/playlists', (req, res) => {
      try {
        const playlists = this.app.database.getPlaylists();
        res.json({ playlists });
      } catch (error) {
        this.app.logger.error('Failed to get playlists:', error);
        res.status(500).json({ error: 'Failed to get playlists' });
      }
    });

    this.express.get('/api/playlists/:id', (req, res) => {
      try {
        const playlist = this.app.database.getPlaylist(req.params.id);
        if (!playlist) {
          return res.status(404).json({ error: 'Playlist not found' });
        }
        res.json({ playlist });
      } catch (error) {
        this.app.logger.error('Failed to get playlist:', error);
        res.status(500).json({ error: 'Failed to get playlist' });
      }
    });

    // 404 handler
    this.express.use((req, res) => {
      res.status(404).json({ error: 'Not found' });
    });

    // Error handler
    this.express.use((err, req, res, next) => {
      this.app.logger.error('HTTP error:', err);
      res.status(500).json({ error: 'Internal server error' });
    });
  }

  start() {
    return new Promise((resolve, reject) => {
      try {
        const port = this.app.config.server.port;
        const host = this.app.config.server.host;

        this.server = this.express.listen(port, host, () => {
          this.app.logger.info(`HTTP server listening on http://${host}:${port}`);
          resolve();
        });

        this.server.on('error', (error) => {
          this.app.logger.error('HTTP server error:', error);
          reject(error);
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  stop() {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          this.app.logger.info('HTTP server stopped');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  getExpressApp() {
    return this.express;
  }
}

export default HttpServer;