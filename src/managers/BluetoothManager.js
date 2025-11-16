// ============================================================================
// src/managers/BluetoothManager.js
// ============================================================================
// Description:
//   Gère les périphériques Bluetooth BLE MIDI
//   - Scan des périphériques BLE disponibles
//   - Connexion/déconnexion aux périphériques BLE MIDI
//   - Gestion des périphériques appairés
// ============================================================================

import noble from '@abandonware/noble';
import EventEmitter from 'events';

class BluetoothManager extends EventEmitter {
  constructor(app) {
    super();
    this.app = app;
    this.scanning = false;
    this.devices = new Map(); // Map of device address -> device info
    this.connectedDevices = new Map(); // Map of address -> peripheral object
    this.pairedDevices = []; // Liste des périphériques appairés (simulé pour l'instant)

    this.BLE_MIDI_SERVICE_UUID = '03b80e5aede84b33a7516ce34ec4c700'; // UUID du service MIDI BLE

    this.setupNobleEvents();

    this.app.logger.info('BluetoothManager initialized');
  }

  setupNobleEvents() {
    noble.on('stateChange', (state) => {
      this.app.logger.info(`Bluetooth state changed: ${state}`);

      if (state === 'poweredOn') {
        this.app.logger.info('Bluetooth is ready');
      } else {
        this.app.logger.warn(`Bluetooth is ${state}`);
        if (this.scanning) {
          this.stopScan();
        }
      }
    });

    noble.on('discover', (peripheral) => {
      this.handleDeviceDiscovered(peripheral);
    });
  }

  handleDeviceDiscovered(peripheral) {
    const address = peripheral.address || peripheral.id;
    const name = peripheral.advertisement.localName || 'Appareil Bluetooth';
    const rssi = peripheral.rssi;

    // Vérifier si c'est un périphérique MIDI BLE
    const serviceUuids = peripheral.advertisement.serviceUuids || [];
    const isMidiDevice = serviceUuids.some(uuid =>
      uuid.toLowerCase().includes('03b80e5a') ||
      uuid.toLowerCase().includes(this.BLE_MIDI_SERVICE_UUID)
    );

    const deviceInfo = {
      id: address,
      address: address,
      name: name,
      rssi: rssi,
      signal: this.rssiToSignalStrength(rssi),
      type: 'ble',
      isMidiDevice: isMidiDevice,
      serviceUuids: serviceUuids,
      peripheral: peripheral
    };

    this.devices.set(address, deviceInfo);

    this.app.logger.debug(`BLE device discovered: ${name} (${address}) RSSI: ${rssi} dBm ${isMidiDevice ? '[MIDI]' : ''}`);
  }

  rssiToSignalStrength(rssi) {
    // Convertir RSSI en pourcentage de signal (approximatif)
    // RSSI typique: -100 dBm (très faible) à -30 dBm (très fort)
    const minRssi = -100;
    const maxRssi = -30;
    const clampedRssi = Math.max(minRssi, Math.min(maxRssi, rssi));
    const signal = Math.round(((clampedRssi - minRssi) / (maxRssi - minRssi)) * 100);
    return signal;
  }

  /**
   * Démarre le scan BLE
   * @param {number} duration - Durée du scan en secondes (0 = scan continu)
   * @param {string} filter - Filtre optionnel sur le nom
   * @returns {Promise<Array>} Liste des périphériques trouvés
   */
  async startScan(duration = 5, filter = '') {
    return new Promise((resolve, reject) => {
      if (this.scanning) {
        return reject(new Error('Scan already in progress'));
      }

      if (noble.state !== 'poweredOn') {
        return reject(new Error(`Bluetooth is ${noble.state}. Please enable Bluetooth.`));
      }

      this.app.logger.info(`Starting BLE scan for ${duration}s...`);
      this.scanning = true;
      this.devices.clear();

      try {
        // Démarrer le scan (permettre les doublons pour obtenir des mises à jour RSSI)
        noble.startScanning([], true);

        // Arrêter automatiquement après la durée spécifiée
        if (duration > 0) {
          setTimeout(() => {
            this.stopScan();

            // Filtrer les résultats si un filtre est fourni
            let devices = Array.from(this.devices.values());

            if (filter) {
              const filterLower = filter.toLowerCase();
              devices = devices.filter(d =>
                d.name.toLowerCase().includes(filterLower) ||
                d.address.toLowerCase().includes(filterLower)
              );
            }

            this.app.logger.info(`BLE scan completed: ${devices.length} devices found`);
            resolve(devices);
          }, duration * 1000);
        } else {
          // Scan continu
          resolve([]);
        }
      } catch (error) {
        this.scanning = false;
        this.app.logger.error(`BLE scan error: ${error.message}`);
        reject(error);
      }
    });
  }

  /**
   * Arrête le scan BLE
   */
  stopScan() {
    if (this.scanning) {
      noble.stopScanning();
      this.scanning = false;
      this.app.logger.info('BLE scan stopped');
    }
  }

  /**
   * Connecte un périphérique BLE
   * @param {string} address - Adresse du périphérique
   * @returns {Promise<Object>} Info de connexion
   */
  async connect(address) {
    this.app.logger.info(`Connecting to BLE device: ${address}`);

    // Récupérer le périphérique depuis le cache
    const deviceInfo = this.devices.get(address);

    if (!deviceInfo) {
      throw new Error(`Device not found: ${address}. Please scan first.`);
    }

    const peripheral = deviceInfo.peripheral;

    return new Promise((resolve, reject) => {
      peripheral.connect((error) => {
        if (error) {
          this.app.logger.error(`Failed to connect to ${address}: ${error.message}`);
          return reject(error);
        }

        this.app.logger.info(`Connected to ${deviceInfo.name} (${address})`);
        this.connectedDevices.set(address, peripheral);

        // Ajouter aux périphériques appairés (persisté en mémoire)
        if (!this.pairedDevices.find(d => d.address === address)) {
          this.pairedDevices.push({
            address: address,
            name: deviceInfo.name,
            type: 'ble',
            paired: true,
            connected: true
          });
        }

        // Explorer les services MIDI (optionnel, pour validation)
        peripheral.discoverServices([this.BLE_MIDI_SERVICE_UUID], (error, services) => {
          if (error) {
            this.app.logger.warn(`Service discovery error: ${error.message}`);
          } else if (services && services.length > 0) {
            this.app.logger.info(`Found ${services.length} MIDI service(s)`);
          }

          resolve({
            address: address,
            name: deviceInfo.name,
            connected: true
          });
        });
      });
    });
  }

  /**
   * Déconnecte un périphérique BLE
   * @param {string} address - Adresse du périphérique
   * @returns {Promise<Object>} Résultat de la déconnexion
   */
  async disconnect(address) {
    this.app.logger.info(`Disconnecting BLE device: ${address}`);

    const peripheral = this.connectedDevices.get(address);

    if (!peripheral) {
      throw new Error(`Device not connected: ${address}`);
    }

    return new Promise((resolve, reject) => {
      peripheral.disconnect((error) => {
        if (error) {
          this.app.logger.error(`Failed to disconnect ${address}: ${error.message}`);
          return reject(error);
        }

        this.connectedDevices.delete(address);
        this.app.logger.info(`Disconnected from ${address}`);

        // Mettre à jour l'état dans pairedDevices
        const pairedDevice = this.pairedDevices.find(d => d.address === address);
        if (pairedDevice) {
          pairedDevice.connected = false;
        }

        resolve({
          address: address,
          connected: false
        });
      });
    });
  }

  /**
   * Oublie un périphérique appairé
   * @param {string} address - Adresse du périphérique
   * @returns {Object} Résultat
   */
  async forget(address) {
    this.app.logger.info(`Forgetting BLE device: ${address}`);

    // Déconnecter d'abord si connecté
    if (this.connectedDevices.has(address)) {
      await this.disconnect(address);
    }

    // Supprimer des périphériques appairés
    const index = this.pairedDevices.findIndex(d => d.address === address);
    if (index !== -1) {
      this.pairedDevices.splice(index, 1);
      this.app.logger.info(`Device ${address} forgotten`);
      return { success: true };
    } else {
      throw new Error(`Device not found in paired list: ${address}`);
    }
  }

  /**
   * Retourne la liste des périphériques appairés
   * @returns {Array} Liste des périphériques appairés
   */
  getPairedDevices() {
    return this.pairedDevices;
  }

  /**
   * Vérifie l'état de Bluetooth
   * @returns {Object} État de Bluetooth
   */
  getStatus() {
    return {
      enabled: noble.state === 'poweredOn',
      state: noble.state,
      scanning: this.scanning,
      devicesFound: this.devices.size,
      connectedDevices: this.connectedDevices.size,
      pairedDevices: this.pairedDevices.length
    };
  }

  /**
   * Active l'adaptateur Bluetooth
   * @returns {Promise<Object>} Résultat de l'activation
   */
  async powerOn() {
    this.app.logger.info('Powering on Bluetooth adapter...');

    // Sur Linux, utiliser hciconfig pour activer l'adaptateur
    if (process.platform === 'linux') {
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);

      try {
        await execAsync('sudo hciconfig hci0 up');
        this.app.logger.info('Bluetooth adapter powered on');

        // Attendre que Noble détecte le changement d'état
        await this.waitForState('poweredOn', 5000);

        return {
          success: true,
          state: noble.state
        };
      } catch (error) {
        this.app.logger.error(`Failed to power on Bluetooth: ${error.message}`);
        throw new Error(`Failed to enable Bluetooth. Try running: sudo hciconfig hci0 up`);
      }
    } else {
      throw new Error('Bluetooth power control is only available on Linux');
    }
  }

  /**
   * Désactive l'adaptateur Bluetooth
   * @returns {Promise<Object>} Résultat de la désactivation
   */
  async powerOff() {
    this.app.logger.info('Powering off Bluetooth adapter...');

    // Arrêter le scan d'abord
    if (this.scanning) {
      this.stopScan();
    }

    // Sur Linux, utiliser hciconfig pour désactiver l'adaptateur
    if (process.platform === 'linux') {
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);

      try {
        await execAsync('sudo hciconfig hci0 down');
        this.app.logger.info('Bluetooth adapter powered off');

        return {
          success: true,
          state: 'poweredOff'
        };
      } catch (error) {
        this.app.logger.error(`Failed to power off Bluetooth: ${error.message}`);
        throw new Error(`Failed to disable Bluetooth. Try running: sudo hciconfig hci0 down`);
      }
    } else {
      throw new Error('Bluetooth power control is only available on Linux');
    }
  }

  /**
   * Attend que Bluetooth atteigne un certain état
   * @param {string} targetState - État cible
   * @param {number} timeout - Timeout en ms
   * @returns {Promise<void>}
   */
  async waitForState(targetState, timeout = 5000) {
    const startTime = Date.now();

    return new Promise((resolve, reject) => {
      const checkState = () => {
        if (noble.state === targetState) {
          resolve();
        } else if (Date.now() - startTime > timeout) {
          reject(new Error(`Timeout waiting for Bluetooth state: ${targetState}`));
        } else {
          setTimeout(checkState, 100);
        }
      };

      checkState();
    });
  }

  /**
   * Arrête tous les scans et déconnecte tous les périphériques
   */
  async shutdown() {
    this.app.logger.info('Shutting down BluetoothManager...');

    // Arrêter le scan
    this.stopScan();

    // Déconnecter tous les périphériques
    const disconnectPromises = [];
    for (const address of this.connectedDevices.keys()) {
      disconnectPromises.push(
        this.disconnect(address).catch(err =>
          this.app.logger.error(`Error disconnecting ${address}: ${err.message}`)
        )
      );
    }

    await Promise.all(disconnectPromises);
    this.app.logger.info('BluetoothManager shutdown complete');
  }
}

export default BluetoothManager;
