/**
 * @file src/repositories/InstrumentRepository.js
 * @description Thin business-named wrapper over the instrument-related
 * methods on {@link Database}/{@link InstrumentDatabase} +
 * {@link InstrumentSettingsDB} + {@link InstrumentCapabilitiesDB}
 * (P0-2.3, ADR-002).
 *
 * Used by every command that touches instruments — settings, lookups,
 * capability writes, USB-serial / MAC / normalized-name reconciliation
 * helpers consumed by {@link DeviceReconciliationService}.
 */

export default class InstrumentRepository {
  /** @param {Object} database - Application database facade. */
  constructor(database) {
    this.database = database;
  }

  // findById/findAll/save/update/delete generic CRUD over a phantom
  // `instruments` table were removed in v6 (the table was never created
  // by the baseline schema and no live caller depended on them).
  // Per-channel data lives on `instruments_latency` (plural), reachable
  // via the *Settings/*Capabilities helpers below.

  findAllWithCapabilities() {
    return this.database.getInstrumentsWithCapabilities();
  }

  getCapabilities(deviceId, channel) {
    return this.database.getInstrumentCapabilities(deviceId, channel);
  }

  getAllCapabilities() {
    return this.database.getAllInstrumentCapabilities();
  }

  updateCapabilities(deviceId, channel, fields) {
    return this.database.updateInstrumentCapabilities(deviceId, channel, fields);
  }

  updateSettings(deviceId, channel, fields) {
    return this.database.updateInstrumentSettings(deviceId, channel, fields);
  }

  getSettings(deviceId, channel) {
    return this.database.getInstrumentSettings(deviceId, channel);
  }

  getAllSettings(deviceId) {
    return this.database.getInstrumentSettings(deviceId);
  }

  findByDevice(deviceId) {
    return this.database.getInstrumentsByDevice(deviceId);
  }

  // deleteLatencyProfile removed in v6 — latency now lives on the
  // per-channel rows of `instruments_latency` (plural). To clear a
  // device's latency, either patch sync_delay/avg_latency back to 0
  // via updateSettings, or use deleteSettingsByDevice to drop the row
  // entirely.

  deleteSettingsByDevice(deviceId, channel) {
    return this.database.deleteInstrumentSettingsByDevice(deviceId, channel);
  }

  findByUsbSerial(serial) {
    return this.database.findInstrumentByUsbSerial(serial);
  }

  findByMac(mac) {
    return this.database.findInstrumentByMac(mac);
  }

  findByNormalizedName(deviceId) {
    return this.database.findInstrumentByNormalizedName(deviceId);
  }

  reconcileDeviceId(oldDeviceId, newDeviceId) {
    return this.database.reconcileDeviceId(oldDeviceId, newDeviceId);
  }

  deduplicateByUsbSerial() {
    return this.database.deduplicateByUsbSerial();
  }

  saveSysExIdentity(deviceId, channel, identity) {
    return this.database.saveSysExIdentity(deviceId, channel, identity);
  }

  // Wrap a synchronous function in a SQLite transaction. Returns the
  // better-sqlite3 wrapper so callers can invoke it with their own arguments
  // (ADR-002 §Conventions — composite writes belong in the Repository layer).
  transaction(fn) {
    return this.database.transaction(fn);
  }
}
