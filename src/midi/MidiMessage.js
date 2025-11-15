// src/midi/MidiMessage.js
import MidiUtils from '../utils/MidiUtils.js';

class MidiMessage {
  constructor(data) {
    this.raw = data;
    this.type = null;
    this.channel = null;
    this.timestamp = Date.now();
    
    if (data) {
      this.parse(data);
    }
  }

  parse(data) {
    // Handle different input formats
    if (Array.isArray(data)) {
      this.parseBytes(data);
    } else if (typeof data === 'object') {
      this.parseObject(data);
    } else {
      throw new Error('Invalid MIDI message data');
    }
  }

  parseBytes(bytes) {
    if (bytes.length < 1) {
      throw new Error('Empty MIDI message');
    }

    const status = bytes[0];
    const parsed = MidiUtils.parseStatus(status);
    
    this.type = this.getTypeString(parsed.type);
    this.channel = parsed.channel;

    switch (parsed.type) {
      case MidiUtils.MessageTypes.NOTE_OFF:
        this.note = bytes[1];
        this.velocity = bytes[2];
        break;

      case MidiUtils.MessageTypes.NOTE_ON:
        this.note = bytes[1];
        this.velocity = bytes[2];
        // Treat velocity 0 as note off
        if (this.velocity === 0) {
          this.type = 'noteoff';
        }
        break;

      case MidiUtils.MessageTypes.POLY_AFTERTOUCH:
        this.note = bytes[1];
        this.pressure = bytes[2];
        break;

      case MidiUtils.MessageTypes.CONTROL_CHANGE:
        this.controller = bytes[1];
        this.value = bytes[2];
        break;

      case MidiUtils.MessageTypes.PROGRAM_CHANGE:
        this.program = bytes[1];
        break;

      case MidiUtils.MessageTypes.CHANNEL_AFTERTOUCH:
        this.pressure = bytes[1];
        break;

      case MidiUtils.MessageTypes.PITCH_BEND:
        const lsb = bytes[1];
        const msb = bytes[2];
        this.value = MidiUtils.decode14bit(msb, lsb) - 8192; // Center at 0
        break;

      case MidiUtils.MessageTypes.SYSTEM:
        this.parseSystemMessage(bytes);
        break;

      default:
        throw new Error(`Unknown MIDI message type: ${parsed.type}`);
    }
  }

  parseObject(obj) {
    this.type = obj.type;
    this.channel = obj.channel;
    
    // Copy all properties
    Object.keys(obj).forEach(key => {
      if (key !== 'type' && key !== 'channel') {
        this[key] = obj[key];
      }
    });
  }

  parseSystemMessage(bytes) {
    const status = bytes[0];

    if (status === 0xF0) {
      // SysEx
      this.type = 'sysex';
      this.data = bytes.slice(1, -1); // Remove 0xF0 and 0xF7
    } else if (status === 0xF1) {
      // MIDI Time Code Quarter Frame
      this.type = 'mtc';
      this.value = bytes[1];
    } else if (status === 0xF2) {
      // Song Position Pointer
      this.type = 'position';
      this.value = MidiUtils.decode14bit(bytes[2], bytes[1]);
    } else if (status === 0xF3) {
      // Song Select
      this.type = 'select';
      this.song = bytes[1];
    } else if (status === 0xF6) {
      // Tune Request
      this.type = 'tune';
    } else if (status === 0xF8) {
      // Timing Clock
      this.type = 'clock';
    } else if (status === 0xFA) {
      // Start
      this.type = 'start';
    } else if (status === 0xFB) {
      // Continue
      this.type = 'continue';
    } else if (status === 0xFC) {
      // Stop
      this.type = 'stop';
    } else if (status === 0xFE) {
      // Active Sensing
      this.type = 'sensing';
    } else if (status === 0xFF) {
      // System Reset
      this.type = 'reset';
    }
  }

  getTypeString(typeCode) {
    switch (typeCode) {
      case MidiUtils.MessageTypes.NOTE_OFF: return 'noteoff';
      case MidiUtils.MessageTypes.NOTE_ON: return 'noteon';
      case MidiUtils.MessageTypes.POLY_AFTERTOUCH: return 'poly aftertouch';
      case MidiUtils.MessageTypes.CONTROL_CHANGE: return 'cc';
      case MidiUtils.MessageTypes.PROGRAM_CHANGE: return 'program';
      case MidiUtils.MessageTypes.CHANNEL_AFTERTOUCH: return 'channel aftertouch';
      case MidiUtils.MessageTypes.PITCH_BEND: return 'pitchbend';
      case MidiUtils.MessageTypes.SYSTEM: return 'system';
      default: return 'unknown';
    }
  }

  toBytes() {
    const bytes = [];

    switch (this.type) {
      case 'noteoff':
        bytes.push(MidiUtils.createStatus(MidiUtils.MessageTypes.NOTE_OFF, this.channel));
        bytes.push(this.note);
        bytes.push(this.velocity);
        break;

      case 'noteon':
        bytes.push(MidiUtils.createStatus(MidiUtils.MessageTypes.NOTE_ON, this.channel));
        bytes.push(this.note);
        bytes.push(this.velocity);
        break;

      case 'poly aftertouch':
        bytes.push(MidiUtils.createStatus(MidiUtils.MessageTypes.POLY_AFTERTOUCH, this.channel));
        bytes.push(this.note);
        bytes.push(this.pressure);
        break;

      case 'cc':
        bytes.push(MidiUtils.createStatus(MidiUtils.MessageTypes.CONTROL_CHANGE, this.channel));
        bytes.push(this.controller);
        bytes.push(this.value);
        break;

      case 'program':
        bytes.push(MidiUtils.createStatus(MidiUtils.MessageTypes.PROGRAM_CHANGE, this.channel));
        bytes.push(this.program);
        break;

      case 'channel aftertouch':
        bytes.push(MidiUtils.createStatus(MidiUtils.MessageTypes.CHANNEL_AFTERTOUCH, this.channel));
        bytes.push(this.pressure);
        break;

      case 'pitchbend':
        bytes.push(MidiUtils.createStatus(MidiUtils.MessageTypes.PITCH_BEND, this.channel));
        const encoded = MidiUtils.encode14bit(this.value + 8192);
        bytes.push(encoded.lsb);
        bytes.push(encoded.msb);
        break;

      case 'sysex':
        bytes.push(0xF0);
        bytes.push(...this.data);
        bytes.push(0xF7);
        break;

      default:
        throw new Error(`Cannot convert ${this.type} to bytes`);
    }

    return bytes;
  }

  validate() {
    const errors = [];

    // Check channel
    if (this.channel !== undefined && !MidiUtils.isValidChannel(this.channel)) {
      errors.push(`Invalid channel: ${this.channel}`);
    }

    // Type-specific validation
    switch (this.type) {
      case 'noteon':
      case 'noteoff':
        if (!MidiUtils.isValidNote(this.note)) {
          errors.push(`Invalid note: ${this.note}`);
        }
        if (!MidiUtils.isValidDataByte(this.velocity)) {
          errors.push(`Invalid velocity: ${this.velocity}`);
        }
        break;

      case 'cc':
        if (!MidiUtils.isValidDataByte(this.controller)) {
          errors.push(`Invalid controller: ${this.controller}`);
        }
        if (!MidiUtils.isValidDataByte(this.value)) {
          errors.push(`Invalid value: ${this.value}`);
        }
        break;

      case 'program':
        if (!MidiUtils.isValidDataByte(this.program)) {
          errors.push(`Invalid program: ${this.program}`);
        }
        break;

      case 'poly aftertouch':
      case 'channel aftertouch':
        if (!MidiUtils.isValidDataByte(this.pressure)) {
          errors.push(`Invalid pressure: ${this.pressure}`);
        }
        break;

      case 'pitchbend':
        if (this.value < -8192 || this.value > 8191) {
          errors.push(`Invalid pitch bend value: ${this.value}`);
        }
        break;
    }

    return {
      valid: errors.length === 0,
      errors: errors
    };
  }

  clone() {
    return new MidiMessage(this.toObject());
  }

  toObject() {
    const obj = {
      type: this.type,
      channel: this.channel,
      timestamp: this.timestamp
    };

    // Add type-specific properties
    switch (this.type) {
      case 'noteon':
      case 'noteoff':
        obj.note = this.note;
        obj.velocity = this.velocity;
        break;

      case 'cc':
        obj.controller = this.controller;
        obj.value = this.value;
        break;

      case 'program':
        obj.program = this.program;
        break;

      case 'poly aftertouch':
        obj.note = this.note;
        obj.pressure = this.pressure;
        break;

      case 'channel aftertouch':
        obj.pressure = this.pressure;
        break;

      case 'pitchbend':
        obj.value = this.value;
        break;

      case 'sysex':
        obj.data = this.data;
        break;
    }

    return obj;
  }

  toString() {
    const parts = [`[${this.type.toUpperCase()}]`];
    
    if (this.channel !== undefined) {
      parts.push(`ch:${this.channel + 1}`);
    }

    switch (this.type) {
      case 'noteon':
      case 'noteoff':
        parts.push(`note:${MidiUtils.noteNumberToName(this.note)}`);
        parts.push(`vel:${this.velocity}`);
        break;

      case 'cc':
        parts.push(`cc:${this.controller}`);
        parts.push(`val:${this.value}`);
        break;

      case 'program':
        parts.push(`prog:${this.program}`);
        parts.push(`(${MidiUtils.getGMInstrumentName(this.program)})`);
        break;

      case 'pitchbend':
        parts.push(`val:${this.value}`);
        break;
    }

    return parts.join(' ');
  }
}

export default MidiMessage;