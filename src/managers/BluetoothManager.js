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
    this.BLE_MIDI_CHARACTERISTIC_UUID = '7772e5db38684112a1a9f2669d106bf3'; // UUID de la caractéristique MIDI I/O

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

      // NE PAS vider le cache - conserver les périphériques appairés pour permettre la reconnexion
      // this.devices.clear(); // SUPPRIMÉ

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

            // Retirer les objets peripheral pour éviter les références circulaires lors de la sérialisation JSON
            const serializedDevices = devices.map(d => ({
              id: d.id,
              address: d.address,
              name: d.name,
              rssi: d.rssi,
              signal: d.signal,
              type: d.type,
              isMidiDevice: d.isMidiDevice,
              serviceUuids: d.serviceUuids
              // peripheral: omis - contient des références circulaires
            }));

            this.app.logger.info(`BLE scan completed: ${serializedDevices.length} devices found`);
            resolve(serializedDevices);
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

        // IMPORTANT: Marquer comme connecté IMMÉDIATEMENT après la connexion BLE
        // avant la découverte des services (qui peut prendre 30 secondes)
        const existingDevice = this.pairedDevices.find(d => d.address === address);
        if (existingDevice) {
          existingDevice.connected = true;
        } else {
          this.pairedDevices.push({
            address: address,
            name: deviceInfo.name,
            type: 'ble',
            paired: true,
            connected: true
          });
        }

        // Stocker temporairement avec services vides (sera mis à jour après découverte)
        this.connectedDevices.set(address, {
          peripheral: peripheral,
          midiService: null,
          midiCharacteristic: null
        });

        // Résoudre IMMÉDIATEMENT pour que le frontend affiche le statut connecté
        resolve({
          address: address,
          name: deviceInfo.name,
          connected: true
        });

        // Découvrir les services et caractéristiques MIDI en arrière-plan
        // (ne pas attendre pour résoudre la Promise)
        this.app.logger.info(`Discovering MIDI services for ${address} in background...`);

        peripheral.discoverServices([this.BLE_MIDI_SERVICE_UUID], (error, services) => {
          if (error || !services || services.length === 0) {
            this.app.logger.warn(`No MIDI services found on ${address} (device still usable, configure via settings)`);
            return;
          }

          const midiService = services[0];
          this.app.logger.info(`Found MIDI service on ${address}`);

          // Découvrir UNIQUEMENT la caractéristique MIDI I/O spécifique (pas de fallback)
          // Si l'UUID spécifique n'est pas trouvé, l'utilisateur devra configurer via réglages instrument
          midiService.discoverCharacteristics([this.BLE_MIDI_CHARACTERISTIC_UUID], (error, characteristics) => {
            let midiCharacteristic = null;

            if (!error && characteristics && characteristics.length > 0) {
              midiCharacteristic = characteristics[0];
              this.app.logger.info(`Found MIDI characteristic on ${address}`);
            } else {
              this.app.logger.warn(`Specific MIDI characteristic not found on ${address} - use instrument settings to configure`);
            }

            // Mettre à jour avec les services MIDI découverts (ou null si non trouvé)
            this.connectedDevices.set(address, {
              peripheral: peripheral,
              midiService: midiService,
              midiCharacteristic: midiCharacteristic
            });

            this.app.logger.info(`MIDI setup complete for ${address}`);
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

    const deviceData = this.connectedDevices.get(address);

    if (!deviceData) {
      throw new Error(`Device not connected: ${address}`);
    }

    const peripheral = deviceData.peripheral;

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

    // NE PAS supprimer du cache devices - permet le ré-appairage
    // Le cache sera rafraîchi au prochain scan de toute façon

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
   * Envoie un message MIDI à un périphérique Bluetooth
   * @param {string} address - Adresse du périphérique
   * @param {string} type - Type de message MIDI (noteon, noteoff, cc, etc.)
   * @param {Object} data - Données du message MIDI
   * @returns {boolean} Succès de l'envoi
   */
  sendMidiMessage(address, type, data) {
    const device = this.connectedDevices.get(address);
    if (!device || !device.midiService) {
      this.app.logger.warn(`Cannot send MIDI: Device ${address} not connected or no MIDI service`);
      return false;
    }

    try {
      // Convertir le message MIDI en bytes selon le format BLE MIDI
      const midiBytes = this.convertToBleMidi(type, data);

      // Envoyer via la caractéristique MIDI I/O
      if (device.midiCharacteristic) {
        device.midiCharacteristic.write(Buffer.from(midiBytes), false);
        this.app.logger.debug(`Sent MIDI message to ${address}: ${type} ${JSON.stringify(data)}`);
        return true;
      } else {
        this.app.logger.warn(`No MIDI characteristic for device ${address}`);
        return false;
      }
    } catch (error) {
      this.app.logger.error(`Failed to send MIDI to ${address}: ${error.message}`);
      return false;
    }
  }

  /**
   * Convertit un message MIDI en format BLE MIDI
   * @param {string} type - Type de message
   * @param {Object} data - Données du message
   * @returns {Array} Bytes du message BLE MIDI
   */
  convertToBleMidi(type, data) {
    // BLE MIDI header (timestamp high bits)
    const timestamp = Date.now() & 0x1FFF;
    const header = 0x80 | ((timestamp >> 7) & 0x3F);
    const timestampLow = 0x80 | (timestamp & 0x7F);

    let midiBytes = [];

    switch (type) {
      case 'noteon':
        // Note On: 0x90 + channel, note, velocity
        midiBytes = [header, timestampLow, 0x90 | (data.channel || 0), data.note || 60, data.velocity || 127];
        break;
      case 'noteoff':
        // Note Off: 0x80 + channel, note, velocity
        midiBytes = [header, timestampLow, 0x80 | (data.channel || 0), data.note || 60, data.velocity || 0];
        break;
      case 'cc':
        // Control Change: 0xB0 + channel, controller, value
        midiBytes = [header, timestampLow, 0xB0 | (data.channel || 0), data.controller || 0, data.value || 0];
        break;
      case 'program':
        // Program Change: 0xC0 + channel, program
        midiBytes = [header, timestampLow, 0xC0 | (data.channel || 0), data.program || 0];
        break;
      case 'pitchbend':
        // Pitch Bend: 0xE0 + channel, LSB, MSB
        const bend = (data.value || 0) + 8192; // Center at 8192
        midiBytes = [header, timestampLow, 0xE0 | (data.channel || 0), bend & 0x7F, (bend >> 7) & 0x7F];
        break;
      default:
        this.app.logger.warn(`Unknown MIDI message type: ${type}`);
        midiBytes = [header, timestampLow];
    }

    return midiBytes;
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
        // Débloquer RF-kill d'abord (si bloqué)
        this.app.logger.debug('Unblocking Bluetooth with rfkill...');
        try {
          await execAsync('sudo rfkill unblock bluetooth');
        } catch (rfkillError) {
          this.app.logger.warn(`rfkill unblock failed (may not be needed): ${rfkillError.message}`);
        }

        // Activer l'adaptateur hci0
        this.app.logger.debug('Bringing up hci0 adapter...');
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

        // Messages d'aide détaillés selon l'erreur
        if (error.message.includes('RF-kill')) {
          throw new Error(`Bluetooth blocked by RF-kill. Try: sudo rfkill unblock bluetooth && sudo hciconfig hci0 up`);
        } else {
          throw new Error(`Failed to enable Bluetooth. Try running: sudo rfkill unblock bluetooth && sudo hciconfig hci0 up`);
        }
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
