// src/storage/InstrumentDatabase.js

class InstrumentDatabase {
  constructor(db, logger) {
    this.db = db;
    this.logger = logger;
  }

  // ==================== INSTRUMENT PROFILES ====================

  insertInstrument(instrument) {
    try {
      const stmt = this.db.prepare(`
        INSERT INTO instruments (
          name, manufacturer, model, type, midi_channel, program_number, 
          bank_msb, bank_lsb, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const result = stmt.run(
        instrument.name,
        instrument.manufacturer || null,
        instrument.model || null,
        instrument.type || 'synth',
        instrument.midi_channel || 0,
        instrument.program_number || 0,
        instrument.bank_msb || null,
        instrument.bank_lsb || null,
        instrument.notes || null
      );

      return result.lastInsertRowid;
    } catch (error) {
      this.logger.error(`Failed to insert instrument: ${error.message}`);
      throw error;
    }
  }

  getInstrument(instrumentId) {
    try {
      const stmt = this.db.prepare('SELECT * FROM instruments WHERE id = ?');
      return stmt.get(instrumentId);
    } catch (error) {
      this.logger.error(`Failed to get instrument: ${error.message}`);
      throw error;
    }
  }

  getInstruments() {
    try {
      const stmt = this.db.prepare('SELECT * FROM instruments ORDER BY name');
      return stmt.all();
    } catch (error) {
      this.logger.error(`Failed to get instruments: ${error.message}`);
      throw error;
    }
  }

  updateInstrument(instrumentId, updates) {
    try {
      const fields = [];
      const values = [];

      if (updates.name !== undefined) {
        fields.push('name = ?');
        values.push(updates.name);
      }
      if (updates.manufacturer !== undefined) {
        fields.push('manufacturer = ?');
        values.push(updates.manufacturer);
      }
      if (updates.model !== undefined) {
        fields.push('model = ?');
        values.push(updates.model);
      }
      if (updates.type !== undefined) {
        fields.push('type = ?');
        values.push(updates.type);
      }
      if (updates.midi_channel !== undefined) {
        fields.push('midi_channel = ?');
        values.push(updates.midi_channel);
      }
      if (updates.program_number !== undefined) {
        fields.push('program_number = ?');
        values.push(updates.program_number);
      }
      if (updates.bank_msb !== undefined) {
        fields.push('bank_msb = ?');
        values.push(updates.bank_msb);
      }
      if (updates.bank_lsb !== undefined) {
        fields.push('bank_lsb = ?');
        values.push(updates.bank_lsb);
      }
      if (updates.notes !== undefined) {
        fields.push('notes = ?');
        values.push(updates.notes);
      }

      if (fields.length === 0) {
        return;
      }

      values.push(instrumentId);

      const stmt = this.db.prepare(`
        UPDATE instruments SET ${fields.join(', ')} WHERE id = ?
      `);

      stmt.run(...values);
    } catch (error) {
      this.logger.error(`Failed to update instrument: ${error.message}`);
      throw error;
    }
  }

  deleteInstrument(instrumentId) {
    try {
      const stmt = this.db.prepare('DELETE FROM instruments WHERE id = ?');
      stmt.run(instrumentId);
    } catch (error) {
      this.logger.error(`Failed to delete instrument: ${error.message}`);
      throw error;
    }
  }

  searchInstruments(query) {
    try {
      const stmt = this.db.prepare(`
        SELECT * FROM instruments 
        WHERE name LIKE ? OR manufacturer LIKE ? OR model LIKE ?
        ORDER BY name
      `);
      const searchPattern = `%${query}%`;
      return stmt.all(searchPattern, searchPattern, searchPattern);
    } catch (error) {
      this.logger.error(`Failed to search instruments: ${error.message}`);
      throw error;
    }
  }

  // ==================== LATENCY PROFILES ====================

  saveLatencyProfile(profile) {
    try {
      // Check if profile exists
      const existing = this.db.prepare(
        'SELECT id FROM instrument_latency WHERE device_id = ?'
      ).get(profile.device_id);

      if (existing) {
        // Update existing
        const stmt = this.db.prepare(`
          UPDATE instrument_latency 
          SET latency_ms = ?, last_calibrated = ?, measurement_count = ?,
              average_latency_ms = ?, min_latency_ms = ?, max_latency_ms = ?
          WHERE device_id = ?
        `);

        stmt.run(
          profile.latency_ms,
          profile.last_calibrated,
          profile.measurement_count || 1,
          profile.average_latency_ms || profile.latency_ms,
          profile.min_latency_ms || profile.latency_ms,
          profile.max_latency_ms || profile.latency_ms,
          profile.device_id
        );

        return existing.id;
      } else {
        // Insert new
        const stmt = this.db.prepare(`
          INSERT INTO instrument_latency (
            device_id, latency_ms, last_calibrated, measurement_count,
            average_latency_ms, min_latency_ms, max_latency_ms
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `);

        const result = stmt.run(
          profile.device_id,
          profile.latency_ms,
          profile.last_calibrated,
          profile.measurement_count || 1,
          profile.average_latency_ms || profile.latency_ms,
          profile.min_latency_ms || profile.latency_ms,
          profile.max_latency_ms || profile.latency_ms
        );

        return result.lastInsertRowid;
      }
    } catch (error) {
      this.logger.error(`Failed to save latency profile: ${error.message}`);
      throw error;
    }
  }

  getLatencyProfile(deviceId) {
    try {
      const stmt = this.db.prepare('SELECT * FROM instrument_latency WHERE device_id = ?');
      return stmt.get(deviceId);
    } catch (error) {
      this.logger.error(`Failed to get latency profile: ${error.message}`);
      throw error;
    }
  }

  getLatencyProfiles() {
    try {
      const stmt = this.db.prepare('SELECT * FROM instrument_latency ORDER BY device_id');
      return stmt.all();
    } catch (error) {
      this.logger.error(`Failed to get latency profiles: ${error.message}`);
      throw error;
    }
  }

  deleteLatencyProfile(deviceId) {
    try {
      const stmt = this.db.prepare('DELETE FROM instrument_latency WHERE device_id = ?');
      stmt.run(deviceId);
    } catch (error) {
      this.logger.error(`Failed to delete latency profile: ${error.message}`);
      throw error;
    }
  }

  // ==================== PRESETS ====================

  insertPreset(preset) {
    try {
      const stmt = this.db.prepare(`
        INSERT INTO presets (
          name, description, type, data, created_at
        ) VALUES (?, ?, ?, ?, ?)
      `);

      const result = stmt.run(
        preset.name,
        preset.description || null,
        preset.type || 'routing',
        preset.data,
        new Date().toISOString()
      );

      return result.lastInsertRowid;
    } catch (error) {
      this.logger.error(`Failed to insert preset: ${error.message}`);
      throw error;
    }
  }

  getPreset(presetId) {
    try {
      const stmt = this.db.prepare('SELECT * FROM presets WHERE id = ?');
      return stmt.get(presetId);
    } catch (error) {
      this.logger.error(`Failed to get preset: ${error.message}`);
      throw error;
    }
  }

  getPresets(type = null) {
    try {
      let stmt;
      if (type) {
        stmt = this.db.prepare('SELECT * FROM presets WHERE type = ? ORDER BY name');
        return stmt.all(type);
      } else {
        stmt = this.db.prepare('SELECT * FROM presets ORDER BY name');
        return stmt.all();
      }
    } catch (error) {
      this.logger.error(`Failed to get presets: ${error.message}`);
      throw error;
    }
  }

  updatePreset(presetId, updates) {
    try {
      const fields = [];
      const values = [];

      if (updates.name !== undefined) {
        fields.push('name = ?');
        values.push(updates.name);
      }
      if (updates.description !== undefined) {
        fields.push('description = ?');
        values.push(updates.description);
      }
      if (updates.data !== undefined) {
        fields.push('data = ?');
        values.push(updates.data);
      }

      if (fields.length === 0) {
        return;
      }

      values.push(presetId);

      const stmt = this.db.prepare(`
        UPDATE presets SET ${fields.join(', ')} WHERE id = ?
      `);

      stmt.run(...values);
    } catch (error) {
      this.logger.error(`Failed to update preset: ${error.message}`);
      throw error;
    }
  }

  deletePreset(presetId) {
    try {
      const stmt = this.db.prepare('DELETE FROM presets WHERE id = ?');
      stmt.run(presetId);
    } catch (error) {
      this.logger.error(`Failed to delete preset: ${error.message}`);
      throw error;
    }
  }

  // ==================== INSTRUMENT SETTINGS ====================

  /**
   * Update instrument settings (custom name, sync delay, MAC address)
   * Uses instruments_latency table
   */
  updateInstrumentSettings(deviceId, settings) {
    try {
      // Check if entry exists for this device
      const existing = this.db.prepare(
        'SELECT id FROM instruments_latency WHERE device_id = ?'
      ).get(deviceId);

      if (existing) {
        // Update existing entry
        const fields = [];
        const values = [];

        if (settings.custom_name !== undefined) {
          fields.push('custom_name = ?');
          values.push(settings.custom_name);
        }
        if (settings.sync_delay !== undefined) {
          fields.push('sync_delay = ?');
          values.push(settings.sync_delay);
        }
        if (settings.mac_address !== undefined) {
          fields.push('mac_address = ?');
          values.push(settings.mac_address);
        }
        if (settings.usb_serial_number !== undefined) {
          fields.push('usb_serial_number = ?');
          values.push(settings.usb_serial_number);
        }
        if (settings.name !== undefined) {
          fields.push('name = ?');
          values.push(settings.name);
        }

        if (fields.length === 0) {
          return existing.id;
        }

        values.push(deviceId);

        const stmt = this.db.prepare(`
          UPDATE instruments_latency SET ${fields.join(', ')} WHERE device_id = ?
        `);

        stmt.run(...values);
        return existing.id;
      } else {
        // Insert new entry
        const stmt = this.db.prepare(`
          INSERT INTO instruments_latency (
            id, device_id, channel, name, custom_name, sync_delay, mac_address, usb_serial_number
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);

        const id = `${deviceId}_0`; // Default channel 0
        const result = stmt.run(
          id,
          deviceId,
          0, // Default channel
          settings.name || 'Unnamed Instrument',
          settings.custom_name || null,
          settings.sync_delay || 0,
          settings.mac_address || null,
          settings.usb_serial_number || null
        );

        return id;
      }
    } catch (error) {
      this.logger.error(`Failed to update instrument settings: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get instrument settings
   */
  getInstrumentSettings(deviceId) {
    try {
      const stmt = this.db.prepare('SELECT * FROM instruments_latency WHERE device_id = ?');
      return stmt.get(deviceId);
    } catch (error) {
      this.logger.error(`Failed to get instrument settings: ${error.message}`);
      throw error;
    }
  }

  /**
   * Save SysEx Identity information for an instrument
   */
  saveSysExIdentity(deviceId, identity) {
    try {
      // Check if entry exists
      const existing = this.db.prepare(
        'SELECT id FROM instruments_latency WHERE device_id = ?'
      ).get(deviceId);

      const now = new Date().toISOString();

      if (existing) {
        // Update existing entry
        const stmt = this.db.prepare(`
          UPDATE instruments_latency
          SET sysex_manufacturer_id = ?,
              sysex_family = ?,
              sysex_model = ?,
              sysex_version = ?,
              sysex_device_id = ?,
              sysex_raw_response = ?,
              sysex_last_request = ?
          WHERE device_id = ?
        `);

        stmt.run(
          identity.manufacturerId || null,
          identity.deviceFamily || null,
          identity.deviceFamilyMember || null,
          identity.softwareRevision || null,
          identity.deviceId || null,
          identity.rawBytes || null,
          now,
          deviceId
        );

        return existing.id;
      } else {
        // Insert new entry
        const stmt = this.db.prepare(`
          INSERT INTO instruments_latency (
            id, device_id, channel, name,
            sysex_manufacturer_id, sysex_family, sysex_model,
            sysex_version, sysex_device_id, sysex_raw_response,
            sysex_last_request
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        const id = `${deviceId}_0`;
        stmt.run(
          id,
          deviceId,
          0,
          'Unnamed Instrument',
          identity.manufacturerId || null,
          identity.deviceFamily || null,
          identity.deviceFamilyMember || null,
          identity.softwareRevision || null,
          identity.deviceId || null,
          identity.rawBytes || null,
          now
        );

        return id;
      }
    } catch (error) {
      this.logger.error(`Failed to save SysEx identity: ${error.message}`);
      throw error;
    }
  }

  /**
   * Find instrument by MAC address
   */
  findInstrumentByMac(macAddress) {
    try {
      const stmt = this.db.prepare('SELECT * FROM instruments_latency WHERE mac_address = ?');
      return stmt.get(macAddress);
    } catch (error) {
      this.logger.error(`Failed to find instrument by MAC: ${error.message}`);
      throw error;
    }
  }

  /**
   * Find instrument by USB serial number
   */
  findInstrumentByUsbSerial(usbSerialNumber) {
    try {
      const stmt = this.db.prepare('SELECT * FROM instruments_latency WHERE usb_serial_number = ?');
      return stmt.get(usbSerialNumber);
    } catch (error) {
      this.logger.error(`Failed to find instrument by USB serial: ${error.message}`);
      throw error;
    }
  }
}

export default InstrumentDatabase;