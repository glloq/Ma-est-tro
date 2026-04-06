class DeviceSettingsDB {
  constructor(db, logger) {
    this.db = db;
    this.logger = logger;
  }

  /**
   * Get device-level settings.
   * @param {string} deviceId
   * @returns {Object|undefined}
   */
  getDeviceSettings(deviceId) {
    try {
      const stmt = this.db.prepare(
        'SELECT id, name, type, custom_name, midi_clock_enabled, message_rate_limit FROM devices WHERE id = ?'
      );
      return stmt.get(deviceId);
    } catch (error) {
      this.logger.error(`DeviceSettingsDB.getDeviceSettings failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Update device-level settings (dynamic fields).
   * @param {string} deviceId
   * @param {Object} settings - { custom_name?, midi_clock_enabled?, message_rate_limit? }
   */
  updateDeviceSettings(deviceId, settings) {
    const fields = [];
    const values = [];

    if (settings.custom_name !== undefined) {
      fields.push('custom_name = ?');
      values.push(settings.custom_name || null);
    }
    if (settings.midi_clock_enabled !== undefined) {
      fields.push('midi_clock_enabled = ?');
      values.push(settings.midi_clock_enabled ? 1 : 0);
    }
    if (settings.message_rate_limit !== undefined) {
      fields.push('message_rate_limit = ?');
      values.push(Math.max(0, parseInt(settings.message_rate_limit) || 0));
    }

    if (fields.length === 0) return;

    values.push(deviceId);
    const stmt = this.db.prepare(
      `UPDATE devices SET ${fields.join(', ')} WHERE id = ?`
    );
    stmt.run(...values);
  }

  /**
   * Ensure a device row exists (INSERT OR IGNORE).
   * @param {string} deviceId
   * @param {string} name
   * @param {string} type - 'input', 'output', or 'virtual'
   */
  ensureDevice(deviceId, name, type) {
    try {
      const stmt = this.db.prepare(
        'INSERT OR IGNORE INTO devices (id, name, type) VALUES (?, ?, ?)'
      );
      stmt.run(deviceId, name, type || 'output');
    } catch (error) {
      this.logger.error(`DeviceSettingsDB.ensureDevice failed: ${error.message}`);
    }
  }
}

export default DeviceSettingsDB;
