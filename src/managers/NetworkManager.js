// ============================================================================
// src/managers/NetworkManager.js
// ============================================================================
// Description:
//   Gère les instruments MIDI via réseau/WiFi
//   - Scan du réseau local pour trouver des instruments
//   - Connexion/déconnexion aux instruments réseau
//   - Gestion des instruments connectés via réseau
// ============================================================================

import EventEmitter from 'events';
import { exec } from 'child_process';
import { promisify } from 'util';
import os from 'os';
import RtpMidiSession from './RtpMidiSession.js';

const execAsync = promisify(exec);

class NetworkManager extends EventEmitter {
  constructor(app) {
    super();
    this.app = app;
    this.scanning = false;
    this.devices = new Map(); // Map of IP -> device info
    this.connectedDevices = new Map(); // Map of IP -> connection info
    this.rtpSessions = new Map(); // Map of IP -> RtpMidiSession

    // Ports MIDI over network couramment utilisés
    this.MIDI_NETWORK_PORTS = [
      5004, // RTP-MIDI (Apple Network MIDI)
      5353, // mDNS
      21928, // RTP-MIDI session
      7000, 7001, 7002 // Ports personnalisés souvent utilisés
    ];

    this.app.logger.info('NetworkManager initialized with RTP-MIDI support');
  }

  /**
   * Obtient le sous-réseau local à scanner
   * @returns {string} Sous-réseau local (ex: "192.168.1")
   */
  getLocalSubnet() {
    const interfaces = os.networkInterfaces();

    for (const name in interfaces) {
      for (const iface of interfaces[name]) {
        // Ignorer les interfaces loopback et non IPv4
        if (iface.family === 'IPv4' && !iface.internal) {
          const parts = iface.address.split('.');
          // Retourner le sous-réseau de classe C
          return `${parts[0]}.${parts[1]}.${parts[2]}`;
        }
      }
    }

    // Fallback au sous-réseau par défaut
    return '192.168.1';
  }

  /**
   * Scan du réseau local pour trouver des instruments
   * @param {number} timeout - Timeout en secondes
   * @returns {Promise<Array>} Liste des instruments trouvés
   */
  async startScan(timeout = 5) {
    if (this.scanning) {
      throw new Error('Scan already in progress');
    }

    this.app.logger.info(`Starting network scan for ${timeout}s...`);
    this.scanning = true;
    this.devices.clear();

    try {
      const subnet = this.getLocalSubnet();
      this.app.logger.info(`Scanning subnet: ${subnet}.0/24`);

      // Méthode 1: Scan mDNS pour services MIDI
      await this.scanMDNS(timeout);

      // Méthode 2: Scan de ports sur le sous-réseau local
      // Note: Cette méthode peut être lente et devrait être optimisée en production
      // Pour l'instant, on utilise seulement mDNS

      const devices = Array.from(this.devices.values());

      this.app.logger.info(`Network scan completed: ${devices.length} devices found`);
      this.scanning = false;

      return devices;
    } catch (error) {
      this.scanning = false;
      this.app.logger.error(`Network scan error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Scan mDNS pour découvrir les services MIDI sur le réseau
   * @param {number} timeout - Timeout en secondes
   */
  async scanMDNS(timeout) {
    try {
      // Utiliser avahi-browse sur Linux pour découvrir les services
      if (process.platform === 'linux') {
        this.app.logger.debug('Using avahi-browse for mDNS discovery...');

        try {
          const { stdout } = await execAsync(
            `timeout ${timeout}s avahi-browse -a -t -r -p 2>/dev/null | grep -i midi || true`,
            { timeout: (timeout + 1) * 1000 }
          );

          if (stdout) {
            this.parseMDNSOutput(stdout);
          }
        } catch (error) {
          this.app.logger.debug('avahi-browse not available or no MIDI services found');
        }
      }

      // Ajouter des périphériques de test pour le développement
      this.addTestDevices();

    } catch (error) {
      this.app.logger.warn(`mDNS scan error: ${error.message}`);
    }
  }

  /**
   * Parse la sortie de avahi-browse
   * @param {string} output - Sortie de avahi-browse
   */
  parseMDNSOutput(output) {
    const lines = output.split('\n');

    for (const line of lines) {
      if (!line.trim()) continue;

      const parts = line.split(';');
      if (parts.length < 8) continue;

      const name = parts[3];
      const ip = parts[7];
      const port = parts[8] || '5004';

      if (ip && ip !== '(null)') {
        const deviceInfo = {
          ip: ip,
          address: ip,
          port: port,
          name: name || `Instrument réseau (${ip})`,
          type: 'network',
          manufacturer: 'Unknown',
          protocol: 'RTP-MIDI'
        };

        this.devices.set(ip, deviceInfo);
        this.app.logger.debug(`mDNS device found: ${name} at ${ip}:${port}`);
      }
    }
  }

  /**
   * Ajoute des périphériques de test (pour le développement)
   */
  addTestDevices() {
    // Ajouter quelques périphériques de test si aucun trouvé
    if (this.devices.size === 0) {
      this.app.logger.debug('Adding test network devices...');

      const subnet = this.getLocalSubnet();

      // Simuler quelques instruments réseau possibles
      const testDevices = [
        {
          ip: `${subnet}.100`,
          address: `${subnet}.100`,
          port: '5004',
          name: 'Roland FA-06 Network',
          type: 'network',
          manufacturer: 'Roland',
          protocol: 'RTP-MIDI'
        },
        {
          ip: `${subnet}.101`,
          address: `${subnet}.101`,
          port: '5004',
          name: 'Yamaha MODX Network',
          type: 'network',
          manufacturer: 'Yamaha',
          protocol: 'RTP-MIDI'
        }
      ];

      // Ne pas ajouter les périphériques de test en production
      // Décommenter la ligne suivante pour les tests
      // testDevices.forEach(device => this.devices.set(device.ip, device));
    }
  }

  /**
   * Arrête le scan réseau
   */
  stopScan() {
    if (this.scanning) {
      this.scanning = false;
      this.app.logger.info('Network scan stopped');
    }
  }

  /**
   * Connecte un instrument réseau via RTP-MIDI
   * @param {string} ip - Adresse IP de l'instrument
   * @param {string} port - Port (optionnel)
   * @returns {Promise<Object>} Info de connexion
   */
  async connect(ip, port = '5004') {
    this.app.logger.info(`[NetworkManager] Connecting to network instrument: ${ip}:${port}`);

    // Vérifier si l'instrument est accessible
    const isReachable = await this.checkReachability(ip);

    if (!isReachable) {
      throw new Error(`Instrument not reachable at ${ip}`);
    }

    // Récupérer les infos du périphérique depuis le cache
    let deviceInfo = this.devices.get(ip);

    if (!deviceInfo) {
      // Créer une entrée si pas encore découvert
      deviceInfo = {
        ip: ip,
        address: ip,
        port: port,
        name: `Instrument réseau (${ip})`,
        type: 'network',
        manufacturer: 'Unknown',
        protocol: 'RTP-MIDI'
      };
      this.devices.set(ip, deviceInfo);
    }

    try {
      // Créer session RTP-MIDI
      const session = new RtpMidiSession({
        localName: 'MidiMind',
        localPort: 5004
      });

      // Écouter les messages MIDI entrants
      session.on('message', (deltaTime, midiBytes) => {
        this.handleMidiData(ip, midiBytes);
      });

      // Écouter les erreurs
      session.on('error', (error) => {
        this.app.logger.error(`[NetworkManager] RTP-MIDI error for ${ip}: ${error.message}`);
      });

      // Écouter la déconnexion
      session.on('disconnected', () => {
        this.app.logger.info(`[NetworkManager] RTP-MIDI session disconnected: ${ip}`);
        this.rtpSessions.delete(ip);
        this.connectedDevices.delete(ip);

        // Émettre événement
        this.emit('network:disconnected', { ip });
      });

      // Connecter
      await session.connect(ip, parseInt(port));

      // Stocker la session
      this.rtpSessions.set(ip, session);

      // Info de connexion
      const connectionInfo = {
        ip: ip,
        address: ip,
        port: port,
        name: deviceInfo.name,
        connected: true,
        connectedAt: new Date().toISOString(),
        session: session
      };

      this.connectedDevices.set(ip, connectionInfo);
      this.app.logger.info(`[NetworkManager] ✅ Connected to ${deviceInfo.name} (${ip}:${port}) via RTP-MIDI`);

      // Émettre événement
      this.emit('network:connected', {
        ip: ip,
        device_id: ip,
        name: deviceInfo.name
      });

      return connectionInfo;

    } catch (error) {
      this.app.logger.error(`[NetworkManager] Failed to connect RTP-MIDI to ${ip}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Vérifie si un hôte est accessible
   * @param {string} ip - Adresse IP
   * @returns {Promise<boolean>} True si accessible
   */
  async checkReachability(ip) {
    try {
      const timeout = 2; // secondes

      if (process.platform === 'win32') {
        await execAsync(`ping -n 1 -w ${timeout * 1000} ${ip}`, { timeout: timeout * 1000 });
      } else {
        await execAsync(`ping -c 1 -W ${timeout} ${ip}`, { timeout: timeout * 1000 });
      }

      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Déconnecte un instrument réseau
   * @param {string} ip - Adresse IP de l'instrument
   * @returns {Promise<Object>} Résultat de la déconnexion
   */
  async disconnect(ip) {
    this.app.logger.info(`[NetworkManager] Disconnecting network instrument: ${ip}`);

    const connectionInfo = this.connectedDevices.get(ip);

    if (!connectionInfo) {
      throw new Error(`Instrument not connected: ${ip}`);
    }

    try {
      // Fermer la session RTP-MIDI
      const session = this.rtpSessions.get(ip);
      if (session) {
        await session.disconnect();
        this.rtpSessions.delete(ip);
      }

      this.connectedDevices.delete(ip);
      this.app.logger.info(`[NetworkManager] ✅ Disconnected from ${ip}`);

      // Émettre événement
      this.emit('network:disconnected', {
        ip: ip,
        device_id: ip
      });

      return {
        ip: ip,
        address: ip,
        connected: false
      };

    } catch (error) {
      this.app.logger.error(`[NetworkManager] Error disconnecting ${ip}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Envoie un message MIDI à un instrument réseau
   * @param {string} ip - Adresse IP de l'instrument
   * @param {string} type - Type de message ('noteon', 'noteoff', 'cc', etc.)
   * @param {object} data - Données du message
   */
  async sendMidiMessage(ip, type, data) {
    const session = this.rtpSessions.get(ip);

    if (!session || !session.isConnected()) {
      throw new Error(`Device ${ip} not connected via RTP-MIDI`);
    }

    try {
      // Convertir format easymidi en bytes MIDI bruts
      const midiBytes = this.convertToMidiBytes(type, data);

      if (midiBytes) {
        session.sendMessage(midiBytes);
        this.app.logger.debug(`[NetworkManager] MIDI sent to ${ip}:`, type, data);
      } else {
        this.app.logger.warn(`[NetworkManager] Unsupported MIDI message type: ${type}`);
      }

    } catch (error) {
      this.app.logger.error(`[NetworkManager] Send MIDI error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Gère les données MIDI reçues d'un instrument réseau
   * @param {string} ip - Adresse IP de l'instrument
   * @param {Array<number>} midiBytes - Bytes MIDI reçus
   */
  handleMidiData(ip, midiBytes) {
    try {
      // Parser les bytes MIDI
      const parsedMessage = this.parseMidiBytes(midiBytes);

      if (parsedMessage) {
        this.app.logger.debug(`[NetworkManager] MIDI from ${ip}:`, parsedMessage.type, parsedMessage.data);

        // Émettre événement MIDI
        this.emit('midi:data', {
          ip: ip,
          address: ip,
          type: parsedMessage.type,
          data: parsedMessage.data
        });
      }

    } catch (error) {
      this.app.logger.error(`[NetworkManager] Error processing MIDI data: ${error.message}`);
    }
  }

  /**
   * Convertit un message easymidi en bytes MIDI
   * @param {string} type - Type de message
   * @param {object} data - Données du message
   * @returns {Array<number>} Bytes MIDI
   */
  convertToMidiBytes(type, data) {
    const channel = data.channel || 0;

    switch (type.toLowerCase()) {
      case 'noteon':
        return [0x90 | channel, data.note, data.velocity];

      case 'noteoff':
        return [0x80 | channel, data.note, data.velocity || 0];

      case 'cc':
      case 'controlchange':
        return [0xB0 | channel, data.controller, data.value];

      case 'programchange':
      case 'program':
        return [0xC0 | channel, data.program || data.number];

      case 'pitchbend':
        const value = data.value || 0;
        const lsb = value & 0x7F;
        const msb = (value >> 7) & 0x7F;
        return [0xE0 | channel, lsb, msb];

      case 'poly aftertouch':
      case 'polyaftertouch':
        return [0xA0 | channel, data.note, data.pressure];

      case 'channel aftertouch':
      case 'channelaftertouch':
        return [0xD0 | channel, data.pressure];

      default:
        return null;
    }
  }

  /**
   * Parse des bytes MIDI en format easymidi
   * @param {Array<number>} bytes - Bytes MIDI
   * @returns {Object|null} Message parsé {type, data}
   */
  parseMidiBytes(bytes) {
    if (!bytes || bytes.length === 0) {
      return null;
    }

    const status = bytes[0];
    const command = status & 0xF0;
    const channel = status & 0x0F;

    switch (command) {
      case 0x90: // Note On
        if (bytes.length >= 3) {
          return {
            type: 'noteon',
            data: { channel, note: bytes[1], velocity: bytes[2] }
          };
        }
        break;

      case 0x80: // Note Off
        if (bytes.length >= 3) {
          return {
            type: 'noteoff',
            data: { channel, note: bytes[1], velocity: bytes[2] }
          };
        }
        break;

      case 0xB0: // Control Change
        if (bytes.length >= 3) {
          return {
            type: 'cc',
            data: { channel, controller: bytes[1], value: bytes[2] }
          };
        }
        break;

      case 0xC0: // Program Change
        if (bytes.length >= 2) {
          return {
            type: 'program',
            data: { channel, number: bytes[1] }
          };
        }
        break;

      case 0xE0: // Pitch Bend
        if (bytes.length >= 3) {
          const value = (bytes[2] << 7) | bytes[1];
          return {
            type: 'pitchbend',
            data: { channel, value }
          };
        }
        break;

      case 0xA0: // Poly Aftertouch
        if (bytes.length >= 3) {
          return {
            type: 'poly aftertouch',
            data: { channel, note: bytes[1], pressure: bytes[2] }
          };
        }
        break;

      case 0xD0: // Channel Aftertouch
        if (bytes.length >= 2) {
          return {
            type: 'channel aftertouch',
            data: { channel, pressure: bytes[1] }
          };
        }
        break;
    }

    return null;
  }

  /**
   * Retourne la liste des instruments connectés
   * @returns {Array} Liste des instruments connectés
   */
  getConnectedDevices() {
    return Array.from(this.connectedDevices.values()).map(({ session, ...device }) => device);
  }

  /**
   * Vérifie l'état du NetworkManager
   * @returns {Object} État du NetworkManager
   */
  getStatus() {
    return {
      scanning: this.scanning,
      devicesFound: this.devices.size,
      connectedDevices: this.connectedDevices.size
    };
  }

  /**
   * Arrête tous les scans et déconnecte tous les instruments
   */
  async shutdown() {
    this.app.logger.info('Shutting down NetworkManager...');

    // Arrêter le scan
    this.stopScan();

    // Déconnecter tous les instruments
    const disconnectPromises = [];
    for (const ip of this.connectedDevices.keys()) {
      disconnectPromises.push(
        this.disconnect(ip).catch(err =>
          this.app.logger.error(`Error disconnecting ${ip}: ${err.message}`)
        )
      );
    }

    await Promise.all(disconnectPromises);
    this.app.logger.info('NetworkManager shutdown complete');
  }
}

export default NetworkManager;
