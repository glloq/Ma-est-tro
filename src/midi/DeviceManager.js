// src/midi/DeviceManager.js
import easymidi from 'easymidi';

class DeviceManager {
  constructor(app) {
    this.app = app;
    this.devices = new Map();
    this.inputs = new Map();
    this.outputs = new Map();
    this.virtualDevices = new Map();
    
    this.app.logger.info('DeviceManager initialized');
  }

  async scanDevices() {
    // USB MIDI devices
    const inputs = easymidi.getInputs();
    const outputs = easymidi.getOutputs();

    // Clear previous devices
    this.inputs.forEach(input => input.close());
    this.outputs.forEach(output => output.close());
    this.inputs.clear();
    this.outputs.clear();

    // Add inputs (filter out system devices)
    inputs.forEach(name => {
      // Skip MIDI Through ports (system virtual ports)
      if (this.isSystemDevice(name)) {
        this.app.logger.debug(`Skipping system device: ${name}`);
        return;
      }

      try {
        this.addInput(name);
        this.app.logger.info(`Input device added: ${name}`);
      } catch (error) {
        this.app.logger.error(`Failed to add input ${name}: ${error.message}`);
      }
    });

    // Add outputs (filter out system devices)
    outputs.forEach(name => {
      // Skip MIDI Through ports (system virtual ports)
      if (this.isSystemDevice(name)) {
        this.app.logger.debug(`Skipping system device: ${name}`);
        return;
      }

      try {
        this.addOutput(name);
        this.app.logger.info(`Output device added: ${name}`);
      } catch (error) {
        this.app.logger.error(`Failed to add output ${name}: ${error.message}`);
      }
    });

    // BLE MIDI (sera implémenté en Phase 7)
    // await this.scanBLE();

    // Update devices map
    this.updateDeviceMap();

    // Broadcast device list
    this.broadcastDeviceList();

    return this.getDeviceList();
  }

  addInput(name) {
    if (this.inputs.has(name)) {
      return;
    }

    const input = new easymidi.Input(name);
    
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
  }

  addOutput(name) {
    if (this.outputs.has(name)) {
      return;
    }

    const output = new easymidi.Output(name);
    this.outputs.set(name, output);
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
          connected: true
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
          connected: true
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
        connected: true
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

  handleMidiMessage(deviceName, type, msg) {
    const timestamp = Date.now();

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

  close() {
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