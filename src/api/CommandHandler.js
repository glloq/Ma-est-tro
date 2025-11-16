// src/api/CommandHandler.js
import JsonValidator from '../utils/JsonValidator.js';

class CommandHandler {
  constructor(app) {
    this.app = app;
    this.handlers = this.registerHandlers();
    
    this.app.logger.info(`CommandHandler initialized with ${Object.keys(this.handlers).length} commands`);
  }

  registerHandlers() {
    return {
      // ==================== DEVICE MANAGEMENT (15 commands) ====================
      'device_list': () => this.deviceList(),
      'device_refresh': () => this.deviceRefresh(),
      'device_info': (data) => this.deviceInfo(data),
      'device_set_properties': (data) => this.deviceSetProperties(data),
      'device_enable': (data) => this.deviceEnable(data),
      'device_identity_request': (data) => this.deviceIdentityRequest(data),
      'device_save_sysex_identity': (data) => this.deviceSaveSysExIdentity(data),
      'instrument_update_settings': (data) => this.instrumentUpdateSettings(data),
      'instrument_get_settings': (data) => this.instrumentGetSettings(data),
      'ble_scan_start': () => this.bleScanStart(),
      'ble_scan_stop': () => this.bleScanStop(),
      'ble_connect': (data) => this.bleConnect(data),
      'ble_disconnect': (data) => this.bleDisconnect(data),
      'virtual_create': (data) => this.virtualCreate(data),
      'virtual_delete': (data) => this.virtualDelete(data),
      'virtual_list': () => this.virtualList(),

      // ==================== MIDI ROUTING (15 commands) ====================
      'route_create': (data) => this.routeCreate(data),
      'route_delete': (data) => this.routeDelete(data),
      'route_list': () => this.routeList(),
      'route_enable': (data) => this.routeEnable(data),
      'route_info': (data) => this.routeInfo(data),
      'filter_set': (data) => this.filterSet(data),
      'filter_clear': (data) => this.filterClear(data),
      'channel_map': (data) => this.channelMap(data),
      'monitor_start': (data) => this.monitorStart(data),
      'monitor_stop': (data) => this.monitorStop(data),
      'route_test': (data) => this.routeTest(data),
      'route_duplicate': (data) => this.routeDuplicate(data),
      'route_export': (data) => this.routeExport(data),
      'route_import': (data) => this.routeImport(data),
      'route_clear_all': () => this.routeClearAll(),

      // ==================== FILE MANAGEMENT (12 commands) ====================
      'file_upload': (data) => this.fileUpload(data),
      'file_list': (data) => this.fileList(data),
      'file_load': (data) => this.fileLoad(data),
      'file_read': (data) => this.fileRead(data),
      'file_write': (data) => this.fileWrite(data),
      'file_delete': (data) => this.fileDelete(data),
      'file_save': (data) => this.fileSave(data),
      'file_rename': (data) => this.fileRename(data),
      'file_move': (data) => this.fileMove(data),
      'file_duplicate': (data) => this.fileDuplicate(data),
      'file_export': (data) => this.fileExport(data),
      'file_search': (data) => this.fileSearch(data),

      // ==================== PLAYBACK (13 commands) ====================
      'playback_start': (data) => this.playbackStart(data),
      'playback_stop': () => this.playbackStop(),
      'playback_pause': () => this.playbackPause(),
      'playback_resume': () => this.playbackResume(),
      'playback_seek': (data) => this.playbackSeek(data),
      'playback_status': () => this.playbackStatus(),
      'playback_set_loop': (data) => this.playbackSetLoop(data),
      'playback_set_tempo': (data) => this.playbackSetTempo(data),
      'playback_transpose': (data) => this.playbackTranspose(data),
      'playback_set_volume': (data) => this.playbackSetVolume(data),
      'playback_get_channels': () => this.playbackGetChannels(),
      'playback_set_channel_routing': (data) => this.playbackSetChannelRouting(data),
      'playback_clear_channel_routing': () => this.playbackClearChannelRouting(),

      // ==================== LATENCY (8 commands) ====================
      'latency_measure': (data) => this.latencyMeasure(data),
      'latency_set': (data) => this.latencySet(data),
      'latency_get': (data) => this.latencyGet(data),
      'latency_list': () => this.latencyList(),
      'latency_delete': (data) => this.latencyDelete(data),
      'latency_auto_calibrate': (data) => this.latencyAutoCalibrate(data),
      'latency_recommendations': () => this.latencyRecommendations(),
      'latency_export': () => this.latencyExport(),

      // ==================== MIDI MESSAGES (8 commands) ====================
      'midi_send': (data) => this.midiSend(data),
      'midi_send_note': (data) => this.midiSendNote(data),
      'midi_send_cc': (data) => this.midiSendCc(data),
      'midi_send_program': (data) => this.midiSendProgram(data),
      'midi_send_pitchbend': (data) => this.midiSendPitchbend(data),
      'midi_panic': (data) => this.midiPanic(data),
      'midi_all_notes_off': (data) => this.midiAllNotesOff(data),
      'midi_reset': (data) => this.midiReset(data),

      // ==================== SYSTEM (8 commands) ====================
      'system_status': () => this.systemStatus(),
      'system_info': () => this.systemInfo(),
      'system_restart': () => this.systemRestart(),
      'system_shutdown': () => this.systemShutdown(),
      'system_backup': (data) => this.systemBackup(data),
      'system_restore': (data) => this.systemRestore(data),
      'system_logs': (data) => this.systemLogs(data),
      'system_clear_logs': () => this.systemClearLogs(),

      // ==================== SESSIONS (6 commands) ====================
      'session_save': (data) => this.sessionSave(data),
      'session_load': (data) => this.sessionLoad(data),
      'session_list': () => this.sessionList(),
      'session_delete': (data) => this.sessionDelete(data),
      'session_export': (data) => this.sessionExport(data),
      'session_import': (data) => this.sessionImport(data),

      // ==================== PRESETS (6 commands) ====================
      'preset_save': (data) => this.presetSave(data),
      'preset_load': (data) => this.presetLoad(data),
      'preset_list': (data) => this.presetList(data),
      'preset_delete': (data) => this.presetDelete(data),
      'preset_rename': (data) => this.presetRename(data),
      'preset_export': (data) => this.presetExport(data),

      // ==================== PLAYLISTS (4 commands) ====================
      'playlist_create': (data) => this.playlistCreate(data),
      'playlist_delete': (data) => this.playlistDelete(data),
      'playlist_list': () => this.playlistList(),
      'playlist_add_file': (data) => this.playlistAddFile(data)
    };
  }

  async handle(message, ws) {
    const startTime = Date.now();

    try {
      this.app.logger.info(`Handling command: ${message.command} (id: ${message.id})`);

      // Validate message structure
      const validation = JsonValidator.validateCommand(message);
      if (!validation.valid) {
        throw new Error(`Invalid message: ${validation.errors.join(', ')}`);
      }

      // Get handler
      const handler = this.handlers[message.command];
      if (!handler) {
        throw new Error(`Unknown command: ${message.command}`);
      }

      this.app.logger.info(`Executing handler for: ${message.command}`);

      // Execute handler
      const result = await handler(message.data || {});

      this.app.logger.info(`Handler executed, sending response for: ${message.command}`);

      // Send response with request ID for client to match
      ws.send(JSON.stringify({
        id: message.id, // Include request ID
        type: 'response',
        command: message.command,
        data: result,
        timestamp: Date.now(),
        duration: Date.now() - startTime
      }));

      this.app.logger.info(`Command ${message.command} completed in ${Date.now() - startTime}ms`);
    } catch (error) {
      this.app.logger.error(`Command ${message.command} failed: ${error.message}`);
      this.app.logger.error(error.stack);

      ws.send(JSON.stringify({
        id: message.id, // Include request ID even in errors
        type: 'error',
        command: message.command,
        error: error.message,
        timestamp: Date.now()
      }));
    }
  }

  // ==================== DEVICE HANDLERS ====================

  async deviceList() {
    return { devices: this.app.deviceManager.getDeviceList() };
  }

  async deviceRefresh() {
    const devices = await this.app.deviceManager.scanDevices();
    return { devices: devices };
  }

  async deviceInfo(data) {
    const device = this.app.deviceManager.getDeviceInfo(data.deviceId);
    if (!device) {
      throw new Error(`Device not found: ${data.deviceId}`);
    }
    return { device: device };
  }

  async deviceSetProperties(data) {
    // Future implementation for device-specific settings
    return { success: true };
  }

  async deviceEnable(data) {
    this.app.deviceManager.enableDevice(data.deviceId, data.enabled);
    return { success: true };
  }

  async deviceIdentityRequest(data) {
    // sendIdentityRequest() will throw an exception if it fails
    this.app.deviceManager.sendIdentityRequest(
      data.deviceName,
      data.deviceId || 0x7F
    );

    return {
      success: true,
      message: 'Identity Request sent. Waiting for response...'
    };
  }

  async deviceSaveSysExIdentity(data) {
    if (!this.app.database) {
      throw new Error('Database not available');
    }

    const id = this.app.database.saveSysExIdentity(data.deviceId, data.identity);

    return {
      success: true,
      id: id
    };
  }

  async instrumentUpdateSettings(data) {
    if (!this.app.database) {
      throw new Error('Database not available');
    }

    // Get USB serial number from data or from DeviceManager
    let usbSerialNumber = data.usb_serial_number;
    if (!usbSerialNumber && this.app.deviceManager) {
      const device = this.app.deviceManager.getDeviceInfo(data.deviceId);
      if (device && device.usbSerialNumber) {
        usbSerialNumber = device.usbSerialNumber;
      }
    }

    const id = this.app.database.updateInstrumentSettings(data.deviceId, {
      custom_name: data.custom_name,
      sync_delay: data.sync_delay,
      mac_address: data.mac_address,
      usb_serial_number: usbSerialNumber,
      name: data.name
    });

    return {
      success: true,
      id: id
    };
  }

  async instrumentGetSettings(data) {
    if (!this.app.database) {
      throw new Error('Database not available');
    }

    const settings = this.app.database.getInstrumentSettings(data.deviceId);

    return {
      settings: settings || null
    };
  }

  async bleScanStart() {
    // Will be implemented in Phase 7
    throw new Error('BLE MIDI not yet implemented');
  }

  async bleScanStop() {
    throw new Error('BLE MIDI not yet implemented');
  }

  async bleConnect(data) {
    throw new Error('BLE MIDI not yet implemented');
  }

  async bleDisconnect(data) {
    throw new Error('BLE MIDI not yet implemented');
  }

  async virtualCreate(data) {
    const deviceId = this.app.deviceManager.createVirtualDevice(data.name);
    return { deviceId: deviceId };
  }

  async virtualDelete(data) {
    this.app.deviceManager.deleteVirtualDevice(data.deviceId);
    return { success: true };
  }

  async virtualList() {
    const devices = this.app.deviceManager.getDeviceList()
      .filter(d => d.type === 'virtual');
    return { devices: devices };
  }

  // ==================== ROUTING HANDLERS ====================

  async routeCreate(data) {
    const routeId = this.app.midiRouter.addRoute(data);
    return { routeId: routeId };
  }

  async routeDelete(data) {
    this.app.midiRouter.deleteRoute(data.routeId);
    return { success: true };
  }

  async routeList() {
    return { routes: this.app.midiRouter.getRouteList() };
  }

  async routeEnable(data) {
    this.app.midiRouter.enableRoute(data.routeId, data.enabled);
    return { success: true };
  }

  async routeInfo(data) {
    const route = this.app.midiRouter.getRoute(data.routeId);
    if (!route) {
      throw new Error(`Route not found: ${data.routeId}`);
    }
    return { route: route };
  }

  async filterSet(data) {
    this.app.midiRouter.setFilter(data.routeId, data.filter);
    return { success: true };
  }

  async filterClear(data) {
    this.app.midiRouter.setFilter(data.routeId, {});
    return { success: true };
  }

  async channelMap(data) {
    this.app.midiRouter.setChannelMap(data.routeId, data.mapping);
    return { success: true };
  }

  async monitorStart(data) {
    this.app.midiRouter.startMonitor(data.deviceId);
    return { success: true };
  }

  async monitorStop(data) {
    this.app.midiRouter.stopMonitor(data.deviceId);
    return { success: true };
  }

  async routeTest(data) {
    // Send test MIDI message through route
    return { success: true };
  }

  async routeDuplicate(data) {
    const route = this.app.midiRouter.getRoute(data.routeId);
    if (!route) {
      throw new Error(`Route not found: ${data.routeId}`);
    }
    const newRouteId = this.app.midiRouter.addRoute({
      source: route.source,
      destination: route.destination,
      channelMap: route.channelMap,
      filter: route.filter,
      enabled: false
    });
    return { routeId: newRouteId };
  }

  async routeExport(data) {
    const route = this.app.midiRouter.getRoute(data.routeId);
    if (!route) {
      throw new Error(`Route not found: ${data.routeId}`);
    }
    return { route: route };
  }

  async routeImport(data) {
    const routeId = this.app.midiRouter.addRoute(data.route);
    return { routeId: routeId };
  }

  async routeClearAll() {
    const routes = this.app.midiRouter.getRouteList();
    routes.forEach(route => this.app.midiRouter.deleteRoute(route.id));
    return { success: true, deleted: routes.length };
  }

  // ==================== FILE HANDLERS ====================

  async fileUpload(data) {
    const result = await this.app.fileManager.handleUpload(data.filename, data.data);
    return result;
  }

  async fileList(data) {
    const files = this.app.fileManager.listFiles(data.folder || '/');
    return { files: files };
  }

  async fileLoad(data) {
    const result = await this.app.fileManager.loadFile(data.fileId);
    return result;
  }

  async fileRead(data) {
    // Read MIDI file content for editing
    const result = await this.app.fileManager.loadFile(data.fileId);
    return {
      success: true,
      fileId: data.fileId,
      midiData: result
    };
  }

  async fileWrite(data) {
    // Write MIDI file content from editor
    await this.app.fileManager.saveFile(data.fileId, data.midiData);
    return { success: true };
  }

  async fileDelete(data) {
    await this.app.fileManager.deleteFile(data.fileId);
    return { success: true };
  }

  async fileSave(data) {
    await this.app.fileManager.saveFile(data.fileId, data.midi);
    return { success: true };
  }

  async fileRename(data) {
    await this.app.fileManager.renameFile(data.fileId, data.newFilename);
    return { success: true };
  }

  async fileMove(data) {
    await this.app.fileManager.moveFile(data.fileId, data.folder);
    return { success: true };
  }

  async fileDuplicate(data) {
    const result = await this.app.fileManager.duplicateFile(data.fileId);
    return result;
  }

  async fileExport(data) {
    const result = await this.app.fileManager.exportFile(data.fileId);
    return result;
  }

  async fileSearch(data) {
    const files = this.app.database.searchFiles(data.query);
    return { files: files };
  }

  // ==================== PLAYBACK HANDLERS ====================

  async playbackStart(data) {
    // Load file first
    if (!data.fileId) {
      throw new Error('fileId is required');
    }

    this.app.logger.info(`Loading file ${data.fileId} for playback...`);
    const fileInfo = await this.app.midiPlayer.loadFile(data.fileId);

    // Determine output device
    let outputDevice = data.outputDevice;

    // If no output specified, use first available output
    if (!outputDevice) {
      const devices = this.app.deviceManager.getDeviceList();
      const outputDevices = devices.filter(d => d.output && d.enabled);

      if (outputDevices.length === 0) {
        throw new Error('No output devices available');
      }

      outputDevice = outputDevices[0].id;
      this.app.logger.info(`No output specified, using: ${outputDevice}`);
    }

    // Start playback
    this.app.midiPlayer.start(outputDevice);

    return {
      success: true,
      fileInfo: fileInfo,
      outputDevice: outputDevice
    };
  }

  async playbackStop() {
    this.app.midiPlayer.stop();
    return { success: true };
  }

  async playbackPause() {
    this.app.midiPlayer.pause();
    return { success: true };
  }

  async playbackResume() {
    this.app.midiPlayer.resume();
    return { success: true };
  }

  async playbackSeek(data) {
    this.app.midiPlayer.seek(data.position);
    return { success: true };
  }

  async playbackStatus() {
    return this.app.midiPlayer.getStatus();
  }

  async playbackSetLoop(data) {
    this.app.midiPlayer.setLoop(data.enabled);
    return { success: true };
  }

  async playbackSetTempo(data) {
    // Future implementation
    return { success: true };
  }

  async playbackTranspose(data) {
    // Future implementation
    return { success: true };
  }

  async playbackSetVolume(data) {
    // Future implementation
    return { success: true };
  }

  async playbackGetChannels() {
    return {
      channels: this.app.midiPlayer.getChannelRouting()
    };
  }

  async playbackSetChannelRouting(data) {
    if (!data.channel && data.channel !== 0) {
      throw new Error('channel is required');
    }
    if (!data.deviceId) {
      throw new Error('deviceId is required');
    }

    this.app.midiPlayer.setChannelRouting(data.channel, data.deviceId);

    return {
      success: true,
      channel: data.channel,
      channelDisplay: data.channel + 1,
      deviceId: data.deviceId
    };
  }

  async playbackClearChannelRouting() {
    this.app.midiPlayer.clearChannelRouting();
    return { success: true };
  }

  // ==================== LATENCY HANDLERS ====================

  async latencyMeasure(data) {
    const result = await this.app.latencyCompensator.measureLatency(
      data.deviceId,
      data.iterations || 5
    );
    return result;
  }

  async latencySet(data) {
    this.app.latencyCompensator.setLatency(data.deviceId, data.latency);
    return { success: true };
  }

  async latencyGet(data) {
    const profile = this.app.latencyCompensator.getProfile(data.deviceId);
    return { profile: profile };
  }

  async latencyList() {
    const profiles = this.app.latencyCompensator.getAllProfiles();
    return { profiles: profiles };
  }

  async latencyDelete(data) {
    this.app.latencyCompensator.deleteProfile(data.deviceId);
    return { success: true };
  }

  async latencyAutoCalibrate(data) {
    const results = await this.app.latencyCompensator.autoCalibrate(data.deviceIds);
    return { results: results };
  }

  async latencyRecommendations() {
    const recommendations = this.app.latencyCompensator.getRecommendedCalibrations();
    return { recommendations: recommendations };
  }

  async latencyExport() {
    const profiles = this.app.latencyCompensator.getAllProfiles();
    return { profiles: profiles };
  }

  // ==================== MIDI MESSAGE HANDLERS ====================

  async midiSend(data) {
    const validation = JsonValidator.validateMidiMessage(data);
    if (!validation.valid) {
      throw new Error(`Invalid MIDI message: ${validation.errors.join(', ')}`);
    }

    const success = this.app.deviceManager.sendMessage(
      data.deviceId,
      data.type,
      data
    );
    return { success: success };
  }

  async midiSendNote(data) {
    this.app.deviceManager.sendMessage(data.deviceId, 'noteon', {
      channel: data.channel,
      note: data.note,
      velocity: data.velocity
    });
    return { success: true };
  }

  async midiSendCc(data) {
    this.app.deviceManager.sendMessage(data.deviceId, 'cc', {
      channel: data.channel,
      controller: data.controller,
      value: data.value
    });
    return { success: true };
  }

  async midiSendProgram(data) {
    this.app.deviceManager.sendMessage(data.deviceId, 'program', {
      channel: data.channel,
      number: data.program
    });
    return { success: true };
  }

  async midiSendPitchbend(data) {
    this.app.deviceManager.sendMessage(data.deviceId, 'pitchbend', {
      channel: data.channel,
      value: data.value
    });
    return { success: true };
  }

  async midiPanic(data) {
    // Send all notes off + reset controllers on all channels
    for (let channel = 0; channel < 16; channel++) {
      this.app.deviceManager.sendMessage(data.deviceId, 'cc', {
        channel: channel,
        controller: 120, // All Sound Off
        value: 0
      });
      this.app.deviceManager.sendMessage(data.deviceId, 'cc', {
        channel: channel,
        controller: 123, // All Notes Off
        value: 0
      });
    }
    return { success: true };
  }

  async midiAllNotesOff(data) {
    for (let channel = 0; channel < 16; channel++) {
      this.app.deviceManager.sendMessage(data.deviceId, 'cc', {
        channel: channel,
        controller: 123,
        value: 0
      });
    }
    return { success: true };
  }

  async midiReset(data) {
    // Send System Reset
    return { success: true };
  }

  // ==================== SYSTEM HANDLERS ====================

  async systemStatus() {
    return {
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      version: '5.0.0',
      devices: this.app.deviceManager.getDeviceList().length,
      routes: this.app.midiRouter.getRouteList().length,
      files: this.app.database.getFiles('/').length
    };
  }

  async systemInfo() {
    return {
      platform: process.platform,
      arch: process.arch,
      nodeVersion: process.version,
      cpus: require('os').cpus().length,
      totalMemory: require('os').totalmem(),
      freeMemory: require('os').freemem()
    };
  }

  async systemRestart() {
    this.app.logger.info('System restart requested');
    setTimeout(() => process.exit(0), 1000);
    return { success: true };
  }

  async systemShutdown() {
    this.app.logger.info('System shutdown requested');
    setTimeout(() => process.exit(0), 1000);
    return { success: true };
  }

  async systemBackup(data) {
    const backupPath = data.path || `./backups/backup_${Date.now()}.db`;
    this.app.database.backup(backupPath);
    return { path: backupPath };
  }

  async systemRestore(data) {
    // Future implementation
    return { success: true };
  }

  async systemLogs(data) {
    // Future implementation - return recent logs
    return { logs: [] };
  }

  async systemClearLogs() {
    // Future implementation
    return { success: true };
  }

  // ==================== SESSION HANDLERS ====================

  async sessionSave(data) {
    const sessionData = {
      devices: this.app.deviceManager.getDeviceList(),
      routes: this.app.midiRouter.getRouteList(),
      player: this.app.midiPlayer.getStatus()
    };

    const sessionId = this.app.database.insertSession({
      name: data.name,
      description: data.description,
      data: JSON.stringify(sessionData)
    });

    return { sessionId: sessionId };
  }

  async sessionLoad(data) {
    const session = this.app.database.getSession(data.sessionId);
    if (!session) {
      throw new Error(`Session not found: ${data.sessionId}`);
    }

    const sessionData = JSON.parse(session.data);
    // Apply session data
    // Future implementation

    return { success: true, session: session };
  }

  async sessionList() {
    const sessions = this.app.database.getSessions();
    return { sessions: sessions };
  }

  async sessionDelete(data) {
    this.app.database.deleteSession(data.sessionId);
    return { success: true };
  }

  async sessionExport(data) {
    const session = this.app.database.getSession(data.sessionId);
    if (!session) {
      throw new Error(`Session not found: ${data.sessionId}`);
    }
    return { session: session };
  }

  async sessionImport(data) {
    const sessionId = this.app.database.insertSession({
      name: data.name,
      description: data.description,
      data: data.data
    });
    return { sessionId: sessionId };
  }

  // ==================== PRESET HANDLERS ====================

  async presetSave(data) {
    const presetId = this.app.database.insertPreset({
      name: data.name,
      description: data.description,
      type: data.type || 'routing',
      data: JSON.stringify(data.data)
    });
    return { presetId: presetId };
  }

  async presetLoad(data) {
    const preset = this.app.database.getPreset(data.presetId);
    if (!preset) {
      throw new Error(`Preset not found: ${data.presetId}`);
    }
    return { preset: preset };
  }

  async presetList(data) {
    const presets = this.app.database.getPresets(data.type);
    return { presets: presets };
  }

  async presetDelete(data) {
    this.app.database.deletePreset(data.presetId);
    return { success: true };
  }

  async presetRename(data) {
    this.app.database.updatePreset(data.presetId, {
      name: data.newName
    });
    return { success: true };
  }

  async presetExport(data) {
    const preset = this.app.database.getPreset(data.presetId);
    if (!preset) {
      throw new Error(`Preset not found: ${data.presetId}`);
    }
    return { preset: preset };
  }

  // ==================== PLAYLIST HANDLERS ====================

  async playlistCreate(data) {
    const playlistId = this.app.database.insertPlaylist({
      name: data.name,
      description: data.description
    });
    return { playlistId: playlistId };
  }

  async playlistDelete(data) {
    this.app.database.deletePlaylist(data.playlistId);
    return { success: true };
  }

  async playlistList() {
    const playlists = this.app.database.getPlaylists();
    return { playlists: playlists };
  }

  async playlistAddFile(data) {
    // Future implementation with playlist_items table
    return { success: true };
  }
}

export default CommandHandler;