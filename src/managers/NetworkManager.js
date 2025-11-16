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

const execAsync = promisify(exec);

class NetworkManager extends EventEmitter {
  constructor(app) {
    super();
    this.app = app;
    this.scanning = false;
    this.devices = new Map(); // Map of IP -> device info
    this.connectedDevices = new Map(); // Map of IP -> connection info

    // Ports MIDI over network couramment utilisés
    this.MIDI_NETWORK_PORTS = [
      5004, // RTP-MIDI (Apple Network MIDI)
      5353, // mDNS
      21928, // RTP-MIDI session
      7000, 7001, 7002 // Ports personnalisés souvent utilisés
    ];

    this.app.logger.info('NetworkManager initialized');
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
   * Connecte un instrument réseau
   * @param {string} ip - Adresse IP de l'instrument
   * @param {string} port - Port (optionnel)
   * @returns {Promise<Object>} Info de connexion
   */
  async connect(ip, port = '5004') {
    this.app.logger.info(`Connecting to network instrument: ${ip}:${port}`);

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

    // Simuler la connexion
    // En production, il faudrait établir une vraie connexion RTP-MIDI ou OSC
    const connectionInfo = {
      ip: ip,
      address: ip,
      port: port,
      name: deviceInfo.name,
      connected: true,
      connectedAt: new Date().toISOString()
    };

    this.connectedDevices.set(ip, connectionInfo);
    this.app.logger.info(`Connected to ${deviceInfo.name} (${ip}:${port})`);

    return connectionInfo;
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
    this.app.logger.info(`Disconnecting network instrument: ${ip}`);

    const connectionInfo = this.connectedDevices.get(ip);

    if (!connectionInfo) {
      throw new Error(`Instrument not connected: ${ip}`);
    }

    // Simuler la déconnexion
    this.connectedDevices.delete(ip);
    this.app.logger.info(`Disconnected from ${ip}`);

    return {
      ip: ip,
      address: ip,
      connected: false
    };
  }

  /**
   * Retourne la liste des instruments connectés
   * @returns {Array} Liste des instruments connectés
   */
  getConnectedDevices() {
    return Array.from(this.connectedDevices.values());
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
