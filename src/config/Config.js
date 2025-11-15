// src/config/Config.js
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class Config {
  constructor(configPath = null) {
    this.configPath = configPath || path.join(__dirname, '../../config.json');
    this.config = this.loadConfig();
  }

  loadConfig() {
    try {
      if (fs.existsSync(this.configPath)) {
        const data = fs.readFileSync(this.configPath, 'utf8');
        return JSON.parse(data);
      } else {
        // Return default configuration
        return this.getDefaultConfig();
      }
    } catch (error) {
      console.error(`Failed to load config: ${error.message}`);
      return this.getDefaultConfig();
    }
  }

  getDefaultConfig() {
    return {
      server: {
        port: 8080,
        wsPort: 8080,
        staticPath: './public'
      },
      midi: {
        bufferSize: 1024,
        sampleRate: 44100,
        defaultLatency: 10
      },
      database: {
        path: './data/midimind.db'
      },
      logging: {
        level: 'info',
        file: './logs/midimind.log',
        console: true
      },
      playback: {
        defaultTempo: 120,
        defaultVolume: 100,
        lookahead: 100 // ms
      },
      latency: {
        defaultIterations: 5,
        recalibrationDays: 7
      },
      ble: {
        enabled: false,
        scanDuration: 10000 // ms
      }
    };
  }

  get(key, defaultValue = null) {
    const keys = key.split('.');
    let value = this.config;

    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        return defaultValue;
      }
    }

    return value;
  }

  set(key, value) {
    const keys = key.split('.');
    let obj = this.config;

    for (let i = 0; i < keys.length - 1; i++) {
      const k = keys[i];
      if (!(k in obj) || typeof obj[k] !== 'object') {
        obj[k] = {};
      }
      obj = obj[k];
    }

    obj[keys[keys.length - 1]] = value;
  }

  save() {
    try {
      const data = JSON.stringify(this.config, null, 2);
      fs.writeFileSync(this.configPath, data, 'utf8');
      return true;
    } catch (error) {
      console.error(`Failed to save config: ${error.message}`);
      return false;
    }
  }

  reload() {
    this.config = this.loadConfig();
  }

  getAll() {
    return { ...this.config };
  }

  // Convenience getters
  get server() {
    return this.config.server;
  }

  get midi() {
    return this.config.midi;
  }

  get database() {
    return this.config.database;
  }

  get logging() {
    return this.config.logging;
  }

  get playback() {
    return this.config.playback;
  }

  get latency() {
    return this.config.latency;
  }

  get ble() {
    return this.config.ble;
  }
}

export default Config;