// src/midi/DeviceManager.js
import easymidi from 'easymidi';

class DeviceManager {
  constructor(app) {
    this.app = app;
    this.devices = new Map();
    this.inputs = new Map();
    this.outputs = new Map();
    this.virtualDevices = new Map();

    // Hot-plug detection
    this.hotPlugInterval = null;
    this.hotPlugCheckIntervalMs = 2000; // Check every 2 seconds
    this.knownInputs = new Set();
    this.knownOutputs = new Set();

    this.app.logger.info('DeviceManager initialized');
  }

  async scanDevices() {
    // Close all existing connections first to ensure clean state
    this.app.logger.info('Closing existing MIDI connections...');

    // Close inputs with error handling
    const inputsToClose = Array.from(this.inputs.entries());
    for (const [name, input] of inputsToClose) {
      try {
        // Remove all listeners first to avoid issues
        input.removeAllListeners();
        input.close();
        this.app.logger.info(`✓ Closed input: ${name}`);
      } catch (error) {
        this.app.logger.warn(`Failed to close input ${name}: ${error.message}`);
      }
    }

    // Close outputs with error handling
    const outputsToClose = Array.from(this.outputs.entries());
    for (const [name, output] of outputsToClose) {
      try {
        output.close();
        this.app.logger.info(`✓ Closed output: ${name}`);
      } catch (error) {
        this.app.logger.warn(`Failed to close output ${name}: ${error.message}`);
      }
    }

    // Clear all maps
    this.inputs.clear();
    this.outputs.clear();
    this.devices.clear();

    // Longer delay to ensure ports are properly released and system recognizes changes
    this.app.logger.info('Waiting for ports to release...');
    await new Promise(resolve => setTimeout(resolve, 250));

    // USB MIDI devices - get fresh list
    const inputs = easymidi.getInputs();
    const outputs = easymidi.getOutputs();

    this.app.logger.info(`Scanning devices: ${inputs.length} inputs, ${outputs.length} outputs`);
    this.app.logger.info(`Input devices found: ${JSON.stringify(inputs)}`);
    this.app.logger.info(`Output devices found: ${JSON.stringify(outputs)}`);

    // Add inputs (filter out system devices)
    for (const name of inputs) {
      // Skip MIDI Through ports (system virtual ports)
      if (this.isSystemDevice(name)) {
        this.app.logger.info(`Skipping system device (input): ${name}`);
        continue;
      }

      try {
        this.addInput(name);
        this.app.logger.info(`✓ Input device added: ${name}`);
      } catch (error) {
        this.app.logger.error(`✗ Failed to add input ${name}: ${error.message}`);
      }
    }

    // Add outputs (filter out system devices)
    for (const name of outputs) {
      // Skip MIDI Through ports (system virtual ports)
      if (this.isSystemDevice(name)) {
        this.app.logger.info(`Skipping system device (output): ${name}`);
        continue;
      }

      try {
        this.addOutput(name);
        this.app.logger.info(`✓ Output device added: ${name}`);
      } catch (error) {
        this.app.logger.error(`✗ Failed to add output ${name}: ${error.message}`);
      }
    }

    // BLE MIDI (sera implémenté en Phase 7)
    // await this.scanBLE();

    // Update devices map
    this.updateDeviceMap();

    // Broadcast device list
    this.broadcastDeviceList();

    const deviceList = this.getDeviceList();
    this.app.logger.info(`Scan complete: ${deviceList.length} device(s) found`);

    // Start hot-plug monitoring
    this.startHotPlugMonitoring();

    return deviceList;
  }

  addInput(name) {
    if (this.inputs.has(name)) {
      return;
    }

    try {
      const input = new easymidi.Input(name);

      // Add error listener to detect device issues
      input.on('error', (error) => {
        this.app.logger.error(`Input device error ${name}: ${error.message}`);
      });

      // Handle MIDI messages
      input.on('noteon', (msg) => this.handleMidiMessage(name, 'noteon', msg));
      input.on('noteoff', (msg) => this.handleMidiMessage(name, 'noteoff', msg));
      input.on('cc', (msg) => this.handleMidiMessage(name, 'cc', msg));
      input.on('program', (msg) => this.handleMidiMessage(name, 'program', msg));
      input.on('pitchbend', (msg) => this.handleMidiMessage(name, 'pitchbend', msg));
      input.on('poly aftertouch', (msg) => this.handleMidiMessage(name, 'poly aftertouch', msg));
      input.on('channel aftertouch', (msg) => this.handleMidiMessage(name, 'channel aftertouch', msg));
      input.on('sysex', (msg) => this.handleMidiMessage(name, 'sysex', msg));

      this.inputs.set(name, input);
    } catch (error) {
      this.app.logger.error(`Cannot open input ${name}: ${error.message}`);
      throw error;
    }
  }

  addOutput(name) {
    if (this.outputs.has(name)) {
      return;
    }

    try {
      const output = new easymidi.Output(name);

      // Store with error tracking
      this.outputs.set(name, output);
    } catch (error) {
      this.app.logger.error(`Cannot open output ${name}: ${error.message}`);
      throw error;
    }
  }

  updateDeviceMap() {
    this.devices.clear();

    // Add USB devices
    this.inputs.forEach((input, name) => {
      if (!this.devices.has(name)) {
        this.devices.set(name, {
          id: name,
          name: name,
          type: 'usb',
          input: true,
          output: this.outputs.has(name),
          enabled: true,
          connected: true,
          status: 2  // 0=disconnected, 1=connecting, 2=connected
        });
      }
    });

    this.outputs.forEach((output, name) => {
      if (!this.devices.has(name)) {
        this.devices.set(name, {
          id: name,
          name: name,
          type: 'usb',
          input: false,
          output: true,
          enabled: true,
          connected: true,
          status: 2  // 0=disconnected, 1=connecting, 2=connected
        });
      }
    });

    // Add virtual devices
    this.virtualDevices.forEach((vdev, name) => {
      this.devices.set(name, {
        id: name,
        name: name,
        type: 'virtual',
        input: vdev.input !== null,
        output: vdev.output !== null,
        enabled: true,
        connected: true,
        status: 2  // 0=disconnected, 1=connecting, 2=connected
      });
    });
  }

  getDeviceList() {
    return Array.from(this.devices.values());
  }

  sendMessage(deviceName, type, data) {
    const output = this.outputs.get(deviceName);
    if (!output) {
      this.app.logger.warn(`Output device not found: ${deviceName}`);
      return false;
    }

    try {
      output.send(type, data);
      return true;
    } catch (error) {
      this.app.logger.error(`Failed to send MIDI message: ${error.message}`);
      return false;
    }
  }

  /**
   * Send SysEx Identity Request to a device
   * Format: F0 7E 7F 06 01 F7
   * @param {string} deviceName - Name of the device
   * @param {number} deviceId - MIDI device ID (0x7F for broadcast to all devices)
   * @returns {boolean} Success status
   */
  sendIdentityRequest(deviceName, deviceId = 0x7F) {
    const output = this.outputs.get(deviceName);
    if (!output) {
      this.app.logger.warn(`Output device not found: ${deviceName}`);
      return false;
    }

    try {
      // Identity Request SysEx message
      // F0 7E [device_id] 06 01 F7
      // easymidi expects bytes without F0 and F7
      const sysexData = [
        0x7E,        // Universal Non-Real Time
        deviceId,    // Device ID (0x7F = all devices)
        0x06,        // General Information
        0x01         // Identity Request
      ];

      output.send('sysex', sysexData);
      this.app.logger.info(`Identity Request sent to ${deviceName} (device ID: 0x${deviceId.toString(16).toUpperCase()})`);
      return true;
    } catch (error) {
      this.app.logger.error(`Failed to send Identity Request: ${error.message}`);
      return false;
    }
  }

  handleMidiMessage(deviceName, type, msg) {
    const timestamp = Date.now();

    // Parse SysEx Identity Reply if applicable
    if (type === 'sysex') {
      const identityInfo = this.parseIdentityReply(msg);
      if (identityInfo) {
        this.app.logger.info(`Identity Reply received from ${deviceName}:`, identityInfo);

        // Broadcast parsed identity info to WebSocket clients
        if (this.app.wsServer) {
          this.app.wsServer.broadcast('device_identity', {
            device: deviceName,
            identity: identityInfo,
            timestamp: timestamp
          });
        }
      }
    }

    // Emit to event bus
    this.app.eventBus.emit('midi_message', {
      device: deviceName,
      type: type,
      data: msg,
      timestamp: timestamp
    });

    // Route message if router is available
    if (this.app.midiRouter) {
      this.app.midiRouter.routeMessage(deviceName, type, msg);
    }

    // Broadcast to WebSocket clients
    if (this.app.wsServer) {
      this.app.wsServer.broadcast('midi_event', {
        device: deviceName,
        type: type,
        data: msg,
        timestamp: timestamp
      });
    }
  }

  /**
   * Parse SysEx Identity Reply message
   * Format: F0 7E [device_id] 06 02 [manufacturer_id] [device_family] [device_family_member] [software_version] F7
   * @param {Array|Object} msg - SysEx message data (without F0 and F7)
   * @returns {Object|null} Parsed identity info or null if not an identity reply
   */
  parseIdentityReply(msg) {
    // Convert to array if necessary
    const bytes = Array.isArray(msg) ? msg : (msg.bytes || []);

    // Check minimum length and identity reply signature
    // 7E [device_id] 06 02 [manufacturer] [family] [member] [version]
    if (bytes.length < 6) return null;
    if (bytes[0] !== 0x7E) return null;  // Universal Non-Real Time
    if (bytes[2] !== 0x06) return null;  // General Information
    if (bytes[3] !== 0x02) return null;  // Identity Reply

    const deviceId = bytes[1];
    let pos = 4;

    // Parse manufacturer ID (1 or 3 bytes)
    let manufacturerId;
    let manufacturerName = 'Unknown';

    if (bytes[pos] === 0x00) {
      // 3-byte manufacturer ID
      if (bytes.length < pos + 3) return null;
      manufacturerId = `00 ${bytes[pos + 1].toString(16).padStart(2, '0').toUpperCase()} ${bytes[pos + 2].toString(16).padStart(2, '0').toUpperCase()}`;
      pos += 3;
    } else {
      // 1-byte manufacturer ID
      manufacturerId = bytes[pos].toString(16).padStart(2, '0').toUpperCase();
      manufacturerName = this.getManufacturerName(bytes[pos]);
      pos += 1;
    }

    // Parse device family (2 bytes, little-endian)
    if (bytes.length < pos + 2) return null;
    const deviceFamily = bytes[pos] | (bytes[pos + 1] << 8);
    pos += 2;

    // Parse device family member (2 bytes, little-endian)
    if (bytes.length < pos + 2) return null;
    const deviceFamilyMember = bytes[pos] | (bytes[pos + 1] << 8);
    pos += 2;

    // Parse software revision (4 bytes)
    const softwareRevision = bytes.slice(pos, pos + 4)
      .map(b => b.toString(16).padStart(2, '0').toUpperCase())
      .join(' ');

    return {
      deviceId: `0x${deviceId.toString(16).padStart(2, '0').toUpperCase()}`,
      manufacturerId,
      manufacturerName,
      deviceFamily: `0x${deviceFamily.toString(16).padStart(4, '0').toUpperCase()}`,
      deviceFamilyMember: `0x${deviceFamilyMember.toString(16).padStart(4, '0').toUpperCase()}`,
      softwareRevision,
      rawBytes: bytes.map(b => b.toString(16).padStart(2, '0').toUpperCase()).join(' ')
    };
  }

  /**
   * Get manufacturer name from manufacturer ID
   * @param {number} id - Manufacturer ID (1 byte)
   * @returns {string} Manufacturer name
   */
  getManufacturerName(id) {
    const manufacturers = {
      0x01: 'Sequential Circuits',
      0x02: 'IDP',
      0x03: 'Voyetra/Octave-Plateau',
      0x04: 'Moog',
      0x05: 'Passport Designs',
      0x06: 'Lexicon',
      0x07: 'Kurzweil',
      0x08: 'Fender',
      0x09: 'Gulbransen',
      0x0A: 'AKG Acoustics',
      0x0B: 'Voyce Music',
      0x0C: 'Waveframe',
      0x0D: 'ADA',
      0x0E: 'Garfield Electronics',
      0x0F: 'Ensoniq',
      0x10: 'Oberheim',
      0x11: 'Apple',
      0x12: 'Grey Matter Response',
      0x13: 'Digidesign',
      0x14: 'Palmtree Instruments',
      0x15: 'JLCooper Electronics',
      0x16: 'Lowrey',
      0x17: 'Adams-Smith',
      0x18: 'E-mu',
      0x19: 'Harmony Systems',
      0x1A: 'ART',
      0x1B: 'Baldwin',
      0x1C: 'Eventide',
      0x1D: 'Inventronics',
      0x20: 'Clarity',
      0x21: 'Passac',
      0x22: 'SIEL',
      0x23: 'Synthaxe',
      0x25: 'Hohner',
      0x26: 'Twister',
      0x27: 'Solton',
      0x28: 'Jellinghaus MS',
      0x2F: 'Elka',
      0x36: 'Cheetah',
      0x3E: 'Waldorf',
      0x40: 'Kawai',
      0x41: 'Roland',
      0x42: 'Korg',
      0x43: 'Yamaha',
      0x44: 'Casio',
      0x47: 'Akai'
    };

    return manufacturers[id] || 'Unknown';
  }

  createVirtualDevice(name) {
    if (this.virtualDevices.has(name)) {
      throw new Error(`Virtual device already exists: ${name}`);
    }

    const input = new easymidi.Input(name, true);
    const output = new easymidi.Output(name, true);

    // Setup input handlers
    input.on('noteon', (msg) => this.handleMidiMessage(name, 'noteon', msg));
    input.on('noteoff', (msg) => this.handleMidiMessage(name, 'noteoff', msg));
    input.on('cc', (msg) => this.handleMidiMessage(name, 'cc', msg));

    this.virtualDevices.set(name, { input, output });
    this.updateDeviceMap();
    this.broadcastDeviceList();

    this.app.logger.info(`Virtual device created: ${name}`);
    return name;
  }

  deleteVirtualDevice(name) {
    const vdev = this.virtualDevices.get(name);
    if (!vdev) {
      throw new Error(`Virtual device not found: ${name}`);
    }

    vdev.input.close();
    vdev.output.close();
    this.virtualDevices.delete(name);
    this.updateDeviceMap();
    this.broadcastDeviceList();

    this.app.logger.info(`Virtual device deleted: ${name}`);
  }

  enableDevice(deviceId, enabled) {
    const device = this.devices.get(deviceId);
    if (!device) {
      throw new Error(`Device not found: ${deviceId}`);
    }

    device.enabled = enabled;
    this.app.logger.info(`Device ${deviceId} ${enabled ? 'enabled' : 'disabled'}`);
    this.broadcastDeviceList();
  }

  getDeviceInfo(deviceId) {
    return this.devices.get(deviceId);
  }

  isSystemDevice(name) {
    // Filter out system MIDI Through ports and other virtual system devices
    const systemPatterns = [
      /^Midi Through/i,           // ALSA MIDI Through ports
      /^Through Port/i,           // macOS MIDI Through
      /^Microsoft GS Wavetable/i  // Windows system synth
    ];

    return systemPatterns.some(pattern => pattern.test(name));
  }

  broadcastDeviceList() {
    if (this.app.wsServer) {
      this.app.wsServer.broadcast('device_list', {
        devices: this.getDeviceList()
      });
    }
  }

  // ==================== HOT-PLUG MONITORING ====================

  /**
   * Start automatic hot-plug monitoring
   */
  startHotPlugMonitoring() {
    if (this.hotPlugInterval) {
      return; // Already running
    }

    this.app.logger.info(`Starting hot-plug monitoring (check every ${this.hotPlugCheckIntervalMs}ms)`);

    // Initialize known devices
    this.knownInputs = new Set(easymidi.getInputs().filter(name => !this.isSystemDevice(name)));
    this.knownOutputs = new Set(easymidi.getOutputs().filter(name => !this.isSystemDevice(name)));

    // Start periodic checking
    this.hotPlugInterval = setInterval(() => {
      this.checkDeviceChanges();
    }, this.hotPlugCheckIntervalMs);
  }

  /**
   * Stop automatic hot-plug monitoring
   */
  stopHotPlugMonitoring() {
    if (this.hotPlugInterval) {
      clearInterval(this.hotPlugInterval);
      this.hotPlugInterval = null;
      this.app.logger.info('Hot-plug monitoring stopped');
    }
  }

  /**
   * Check for device changes without closing existing connections
   */
  async checkDeviceChanges() {
    try {
      // Get current system ports
      const currentInputs = new Set(easymidi.getInputs().filter(name => !this.isSystemDevice(name)));
      const currentOutputs = new Set(easymidi.getOutputs().filter(name => !this.isSystemDevice(name)));

      let hasChanges = false;

      // Check for new inputs
      for (const name of currentInputs) {
        if (!this.knownInputs.has(name)) {
          this.app.logger.info(`🔌 New MIDI input detected: ${name}`);
          try {
            this.addInput(name);
            this.knownInputs.add(name);
            hasChanges = true;
          } catch (error) {
            this.app.logger.error(`Failed to add new input ${name}: ${error.message}`);
          }
        }
      }

      // Check for removed inputs
      for (const name of this.knownInputs) {
        if (!currentInputs.has(name)) {
          this.app.logger.info(`🔌 MIDI input disconnected: ${name}`);
          const input = this.inputs.get(name);
          if (input) {
            try {
              input.removeAllListeners();
              input.close();
            } catch (error) {
              this.app.logger.warn(`Error closing disconnected input ${name}: ${error.message}`);
            }
            this.inputs.delete(name);
          }
          this.knownInputs.delete(name);
          hasChanges = true;
        }
      }

      // Check for new outputs
      for (const name of currentOutputs) {
        if (!this.knownOutputs.has(name)) {
          this.app.logger.info(`🔌 New MIDI output detected: ${name}`);
          try {
            this.addOutput(name);
            this.knownOutputs.add(name);
            hasChanges = true;
          } catch (error) {
            this.app.logger.error(`Failed to add new output ${name}: ${error.message}`);
          }
        }
      }

      // Check for removed outputs
      for (const name of this.knownOutputs) {
        if (!currentOutputs.has(name)) {
          this.app.logger.info(`🔌 MIDI output disconnected: ${name}`);
          const output = this.outputs.get(name);
          if (output) {
            try {
              output.close();
            } catch (error) {
              this.app.logger.warn(`Error closing disconnected output ${name}: ${error.message}`);
            }
            this.outputs.delete(name);
          }
          this.knownOutputs.delete(name);
          hasChanges = true;
        }
      }

      // If there were changes, update the device map and broadcast
      if (hasChanges) {
        this.updateDeviceMap();
        this.broadcastDeviceList();
        this.app.logger.info(`Device list updated: ${this.devices.size} device(s)`);
      }

    } catch (error) {
      this.app.logger.error(`Error checking device changes: ${error.message}`);
    }
  }

  close() {
    // Stop hot-plug monitoring
    this.stopHotPlugMonitoring();

    // Close all inputs
    this.inputs.forEach(input => {
      try {
        input.close();
      } catch (error) {
        this.app.logger.error(`Error closing input: ${error.message}`);
      }
    });

    // Close all outputs
    this.outputs.forEach(output => {
      try {
        output.close();
      } catch (error) {
        this.app.logger.error(`Error closing output: ${error.message}`);
      }
    });

    // Close virtual devices
    this.virtualDevices.forEach(vdev => {
      try {
        vdev.input.close();
        vdev.output.close();
      } catch (error) {
        this.app.logger.error(`Error closing virtual device: ${error.message}`);
      }
    });

    this.app.logger.info('DeviceManager closed');
  }
}

export default DeviceManager;