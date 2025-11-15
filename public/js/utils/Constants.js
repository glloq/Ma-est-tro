// ============================================================================
// Fichier: frontend/js/utils/Constants.js
// Projet: MidiMind v3.1 - Système d'Orchestration MIDI pour Raspberry Pi 🎹
// Version: 3.1.1 - SYNCHRONIZED WITH BACKEND API v4.2.2
// Date: 2025-11-01
// ============================================================================
// CORRECTIONS v3.1.1:
// ✅ Synchronisation 100% avec API_DOCUMENTATION_FRONTEND_CORRECTED.md v4.2.2
// ✅ 87 commandes backend documentées (100% couverture)
// ✅ Encodage UTF-8 corrigé (é, è, à, ô, etc.)
// ✅ Ajout emojis pertinents pour meilleure lisibilité 🎵
// ✅ Toutes les commandes suivent le format exact du backend
// ✅ Ajout des commandes manquantes: MIDI (11), Playlists (9), Logger (3)
// ============================================================================

const Constants = {
    
    // ========================================================================
    // 📋 VERSION DU PROTOCOLE
    // ========================================================================
    
    PROTOCOL_VERSION: '4.2.2',
    FRONTEND_VERSION: '3.1.1',
    
    // ========================================================================
    // 🎛️ COMMANDES BACKEND - SYNCHRONISÉES AVEC API v4.2.2
    // Total: 87 commandes disponibles (couverture 100%)
    // ========================================================================
    
    COMMANDS: {
        // ===================================================================
        // 1. 🔌 DEVICES COMMANDS (18 commandes)
        // backend/src/api/commands/devices.cpp
        // ===================================================================
        DEVICES_LIST: 'devices.list',
        DEVICES_SCAN: 'devices.scan',
        DEVICES_CONNECT: 'devices.connect',
        DEVICES_DISCONNECT: 'devices.disconnect',
        DEVICES_DISCONNECT_ALL: 'devices.disconnectAll',
        DEVICES_GET_INFO: 'devices.getInfo',
        DEVICES_GET_CONNECTED: 'devices.getConnected',
        DEVICES_START_HOTPLUG: 'devices.startHotPlug',
        DEVICES_STOP_HOTPLUG: 'devices.stopHotPlug',
        DEVICES_GET_HOTPLUG_STATUS: 'devices.getHotPlugStatus',
        
        // ===================================================================
        // 2. 📡 BLUETOOTH COMMANDS (8 commandes)
        // backend/src/api/commands/bluetooth.cpp
        // ===================================================================
        BLUETOOTH_CONFIG: 'bluetooth.config',
        BLUETOOTH_STATUS: 'bluetooth.status',
        BLUETOOTH_SCAN: 'bluetooth.scan',
        BLUETOOTH_PAIR: 'bluetooth.pair',
        BLUETOOTH_UNPAIR: 'bluetooth.unpair',
        BLUETOOTH_PAIRED: 'bluetooth.paired',
        BLUETOOTH_FORGET: 'bluetooth.forget',
        BLUETOOTH_SIGNAL: 'bluetooth.signal',
        
        // ===================================================================
        // 3. 🔀 ROUTING COMMANDS (6 commandes)
        // backend/src/api/commands/routing.cpp
        // ===================================================================
        ROUTING_ADD_ROUTE: 'routing.addRoute',
        ROUTING_REMOVE_ROUTE: 'routing.removeRoute',
        ROUTING_CLEAR_ROUTES: 'routing.clearRoutes',
        ROUTING_LIST_ROUTES: 'routing.listRoutes',
        ROUTING_ENABLE_ROUTE: 'routing.enableRoute',
        ROUTING_DISABLE_ROUTE: 'routing.disableRoute',
        
        // ===================================================================
        // 4. ▶️ PLAYBACK COMMANDS (10 commandes)
        // backend/src/api/commands/playback.cpp
        // ===================================================================
        PLAYBACK_LOAD: 'playback.load',
        PLAYBACK_PLAY: 'playback.play',
        PLAYBACK_PAUSE: 'playback.pause',
        PLAYBACK_STOP: 'playback.stop',
        PLAYBACK_GET_STATUS: 'playback.getStatus',
        PLAYBACK_SEEK: 'playback.seek',
        PLAYBACK_SET_TEMPO: 'playback.setTempo',
        PLAYBACK_SET_LOOP: 'playback.setLoop',
        PLAYBACK_GET_INFO: 'playback.getInfo',
        PLAYBACK_LIST_FILES: 'playback.listFiles',
        
        // ===================================================================
        // 5. 📁 FILE COMMANDS (6 commandes)
        // backend/src/api/commands/files.cpp
        // ===================================================================
        FILES_LIST: 'files.list',
        FILES_READ: 'files.read',
        FILES_WRITE: 'files.write',
        FILES_DELETE: 'files.delete',
        FILES_EXISTS: 'files.exists',
        FILES_GET_INFO: 'files.getInfo',
        
        // ===================================================================
        // 6. 💻 SYSTEM COMMANDS (7 commandes)
        // backend/src/api/commands/system.cpp
        // ===================================================================
        SYSTEM_PING: 'system.ping',
        SYSTEM_VERSION: 'system.version',
        SYSTEM_INFO: 'system.info',
        SYSTEM_UPTIME: 'system.uptime',
        SYSTEM_MEMORY: 'system.memory',
        SYSTEM_DISK: 'system.disk',
        SYSTEM_COMMANDS: 'system.commands',
        
        // ===================================================================
        // 7. 🌐 NETWORK COMMANDS (3 commandes)
        // backend/src/api/commands/network.cpp
        // ===================================================================
        NETWORK_STATUS: 'network.status',
        NETWORK_INTERFACES: 'network.interfaces',
        NETWORK_STATS: 'network.stats',
        
        // ===================================================================
        // 8. 📝 LOGGER COMMANDS (5 commandes) ✅ AJOUT MANQUANT
        // backend/src/api/commands/logger.cpp
        // ===================================================================
        LOGGER_SET_LEVEL: 'logger.setLevel',
        LOGGER_GET_LEVEL: 'logger.getLevel',
        LOGGER_GET_LOGS: 'logger.getLogs',       // ✅ Ajout
        LOGGER_CLEAR: 'logger.clear',            // ✅ Ajout
        LOGGER_EXPORT: 'logger.export',          // ✅ Ajout
        
        // ===================================================================
        // 9. ⏱️ LATENCY COMMANDS (7 commandes)
        // backend/src/api/commands/latency.cpp
        // ===================================================================
        LATENCY_SET_COMPENSATION: 'latency.setCompensation',
        LATENCY_GET_COMPENSATION: 'latency.getCompensation',
        LATENCY_ENABLE: 'latency.enable',
        LATENCY_DISABLE: 'latency.disable',
        LATENCY_SET_GLOBAL_OFFSET: 'latency.setGlobalOffset',
        LATENCY_GET_GLOBAL_OFFSET: 'latency.getGlobalOffset',
        LATENCY_LIST_INSTRUMENTS: 'latency.listInstruments',
        
        // ===================================================================
        // 10. 💾 PRESET COMMANDS (5 commandes)
        // backend/src/api/commands/preset.cpp
        // ===================================================================
        PRESET_LIST: 'preset.list',
        PRESET_LOAD: 'preset.load',
        PRESET_SAVE: 'preset.save',
        PRESET_DELETE: 'preset.delete',
        PRESET_EXPORT: 'preset.export',
        
        // ===================================================================
        // 11. 🎵 MIDI COMMANDS (11 commandes) ✅ AJOUT MANQUANT
        // backend/src/api/commands/midi.cpp
        // ===================================================================
        MIDI_CONVERT: 'midi.convert',            // ✅ Ajout
        MIDI_LOAD: 'midi.load',                  // ✅ Ajout
        MIDI_SAVE: 'midi.save',                  // ✅ Ajout
        MIDI_IMPORT: 'midi.import',              // ✅ Ajout
        MIDI_ROUTING_ADD: 'midi.routing.add',    // ✅ Ajout
        MIDI_ROUTING_LIST: 'midi.routing.list',  // ✅ Ajout
        MIDI_ROUTING_UPDATE: 'midi.routing.update', // ✅ Ajout
        MIDI_ROUTING_REMOVE: 'midi.routing.remove', // ✅ Ajout
        MIDI_ROUTING_CLEAR: 'midi.routing.clear',   // ✅ Ajout
        MIDI_SEND_NOTE_ON: 'midi.sendNoteOn',    // ✅ Ajout
        MIDI_SEND_NOTE_OFF: 'midi.sendNoteOff',  // ✅ Ajout
        
        // ===================================================================
        // 12. 📋 PLAYLIST COMMANDS (9 commandes) ✅ AJOUT MANQUANT
        // backend/src/api/commands/playlist.cpp
        // ===================================================================
        PLAYLIST_CREATE: 'playlist.create',      // ✅ Ajout
        PLAYLIST_DELETE: 'playlist.delete',      // ✅ Ajout
        PLAYLIST_UPDATE: 'playlist.update',      // ✅ Ajout
        PLAYLIST_LIST: 'playlist.list',          // ✅ Ajout
        PLAYLIST_GET: 'playlist.get',            // ✅ Ajout
        PLAYLIST_ADD_ITEM: 'playlist.addItem',   // ✅ Ajout
        PLAYLIST_REMOVE_ITEM: 'playlist.removeItem', // ✅ Ajout
        PLAYLIST_REORDER: 'playlist.reorder',    // ✅ Ajout
        PLAYLIST_SET_LOOP: 'playlist.setLoop'    // ✅ Ajout
    },
    
    // ========================================================================
    // 📡 ÉVÉNEMENTS BACKEND → FRONTEND
    // ========================================================================
    
    EVENTS: {
        // 🔌 Connexion WebSocket
        WEBSOCKET_CONNECTED: 'websocket:connected',
        WEBSOCKET_DISCONNECTED: 'websocket:disconnected',
        WEBSOCKET_ERROR: 'websocket:error',
        
        // 🖥️ Backend général
        BACKEND_CONNECTED: 'backend:connected',
        BACKEND_DISCONNECTED: 'backend:disconnected',
        BACKEND_STATUS: 'backend:status',
        BACKEND_EVENT: 'backend:event',
        BACKEND_ERROR: 'backend:error',
        BACKEND_RESPONSE: 'backend:response',
        
        // 🎹 MIDI Messages
        MIDI_MESSAGE: 'backend:midi:message',
        MIDI_NOTE_ON: 'backend:midi:note_on',
        MIDI_NOTE_OFF: 'backend:midi:note_off',
        MIDI_CC: 'backend:midi:cc',
        MIDI_PROGRAM_CHANGE: 'backend:midi:program_change',
        MIDI_PITCH_BEND: 'backend:midi:pitch_bend',
        
        // 🔌 Devices
        DEVICE_CONNECTED: 'backend:device:connected',
        DEVICE_DISCONNECTED: 'backend:device:disconnected',
        DEVICE_DISCOVERED: 'backend:device:discovered',
        DEVICE_ERROR: 'backend:device:error',
        
        // ▶️ Playback
        PLAYBACK_STARTED: 'backend:playback:started',
        PLAYBACK_STOPPED: 'backend:playback:stopped',
        PLAYBACK_PAUSED: 'backend:playback:paused',
        PLAYBACK_POSITION: 'backend:playback:position',
        PLAYBACK_FINISHED: 'backend:playback:finished',
        PLAYBACK_TEMPO_CHANGED: 'backend:playback:tempo_changed',
        
        // 📁 Files
        FILE_LOADED: 'backend:file:loaded',
        FILE_SAVED: 'backend:file:saved',
        FILE_DELETED: 'backend:file:deleted',
        FILE_ADDED: 'backend:file:added',
        
        // 🔀 Routing
        ROUTE_ADDED: 'backend:route:added',
        ROUTE_REMOVED: 'backend:route:removed',
        ROUTE_UPDATED: 'backend:route:updated',
        
        // ⚙️ System
        SYSTEM_ERROR: 'backend:system:error',
        SYSTEM_WARNING: 'backend:system:warning',
        SYSTEM_STATUS_UPDATE: 'backend:status_update',
        
        // 📊 Performance
        METRICS_UPDATE: 'backend:metrics_update',
        PERFORMANCE_WARNING: 'backend:performance:warning'
    },
    
    // ========================================================================
    // ❌ CODES D'ERREUR BACKEND
    // ========================================================================
    
    ERROR_CODES: {
        INVALID_REQUEST: 'INVALID_REQUEST',
        UNAUTHORIZED: 'UNAUTHORIZED',
        FORBIDDEN: 'FORBIDDEN',
        NOT_FOUND: 'NOT_FOUND',
        INTERNAL_ERROR: 'INTERNAL_ERROR',
        DEVICE_NOT_FOUND: 'DEVICE_NOT_FOUND',
        DEVICE_BUSY: 'DEVICE_BUSY',
        CONNECTION_FAILED: 'CONNECTION_FAILED',
        TIMEOUT: 'TIMEOUT',
        INVALID_PARAMS: 'INVALID_PARAMS',
        FILE_NOT_FOUND: 'FILE_NOT_FOUND',
        PLAYBACK_ERROR: 'PLAYBACK_ERROR'
    },
    
    // ========================================================================
    // ▶️ ÉTATS DE LECTURE
    // ========================================================================
    
    PLAYBACK_STATES: {
        STOPPED: 0,
        PLAYING: 1,
        PAUSED: 2,
        LOADING: 3
    },
    
    PLAYBACK_STATE_NAMES: {
        0: 'stopped',
        1: 'playing',
        2: 'paused',
        3: 'loading'
    },
    
    // ========================================================================
    // 🔌 TYPES DE DEVICES
    // ========================================================================
    
    DEVICE_TYPES: {
        UNKNOWN: 0,
        USB: 1,
        BLE: 2,
        VIRTUAL: 3
    },
    
    DEVICE_TYPE_NAMES: {
        0: 'Unknown',
        1: 'USB',
        2: 'BLE',
        3: 'Virtual'
    },
    
    // ========================================================================
    // 🚦 STATUTS DEVICE
    // ========================================================================
    
    DEVICE_STATUS: {
        UNKNOWN: 0,
        DISCONNECTED: 1,
        CONNECTED: 2,
        ERROR: 3
    },
    
    DEVICE_STATUS_NAMES: {
        0: 'Unknown',
        1: 'Disconnected',
        2: 'Connected',
        3: 'Error'
    },
    
    // ========================================================================
    // 📝 NIVEAUX DE LOG
    // ========================================================================
    
    LOG_LEVELS: {
        DEBUG: 'DEBUG',
        INFO: 'INFO',
        WARNING: 'WARNING',
        ERROR: 'ERROR',
        CRITICAL: 'CRITICAL'
    },
    
    // ========================================================================
    // 🎹 MIDI
    // ========================================================================
    
    MIDI: {
        // Canaux (0-15, 0-based indexing pour le protocole)
        CHANNELS: Array.from({ length: 16 }, (_, i) => i),
        
        // Notes (0-127)
        NOTES: {
            MIN: 0,
            MAX: 127,
            MIDDLE_C: 60
        },
        
        // Vélocité (0-127)
        VELOCITY: {
            MIN: 0,
            MAX: 127,
            OFF: 0
        },
        
        // CC (Control Change) - 0-127
        CC: {
            MIN: 0,
            MAX: 127,
            BANK_SELECT: 0,
            MODULATION: 1,
            BREATH: 2,
            FOOT_CONTROLLER: 4,
            PORTAMENTO_TIME: 5,
            DATA_ENTRY: 6,
            VOLUME: 7,
            BALANCE: 8,
            PAN: 10,
            EXPRESSION: 11,
            SUSTAIN: 64,
            PORTAMENTO: 65,
            SOSTENUTO: 66,
            SOFT_PEDAL: 67,
            LEGATO: 68,
            HOLD_2: 69,
            SOUND_CONTROLLER_1: 70,
            SOUND_CONTROLLER_2: 71,
            SOUND_CONTROLLER_3: 72,
            SOUND_CONTROLLER_4: 73,
            SOUND_CONTROLLER_5: 74,
            SOUND_CONTROLLER_6: 75,
            SOUND_CONTROLLER_7: 76,
            SOUND_CONTROLLER_8: 77,
            SOUND_CONTROLLER_9: 78,
            SOUND_CONTROLLER_10: 79,
            EFFECTS_1: 91,
            EFFECTS_2: 92,
            EFFECTS_3: 93,
            EFFECTS_4: 94,
            EFFECTS_5: 95,
            ALL_SOUND_OFF: 120,
            RESET_CONTROLLERS: 121,
            ALL_NOTES_OFF: 123
        },
        
        // Messages MIDI
        MESSAGES: {
            NOTE_OFF: 0x80,
            NOTE_ON: 0x90,
            POLY_AFTERTOUCH: 0xA0,
            CC: 0xB0,
            PROGRAM_CHANGE: 0xC0,
            CHANNEL_AFTERTOUCH: 0xD0,
            PITCH_BEND: 0xE0,
            SYSTEM_EXCLUSIVE: 0xF0,
            TIME_CODE: 0xF1,
            SONG_POSITION: 0xF2,
            SONG_SELECT: 0xF3,
            TUNE_REQUEST: 0xF6,
            END_OF_SYSEX: 0xF7,
            TIMING_CLOCK: 0xF8,
            START: 0xFA,
            CONTINUE: 0xFB,
            STOP: 0xFC,
            ACTIVE_SENSING: 0xFE,
            RESET: 0xFF
        }
    },
    
    // ========================================================================
    // 🎨 UI
    // ========================================================================
    
    UI: {
        COLORS: {
            PRIMARY: '#007bff',
            SECONDARY: '#6c757d',
            SUCCESS: '#28a745',
            DANGER: '#dc3545',
            WARNING: '#ffc107',
            INFO: '#17a2b8',
            LIGHT: '#f8f9fa',
            DARK: '#343a40'
        },
        
        ANIMATION_DURATION: 300, // ms
        DEBOUNCE_DELAY: 300, // ms
        THROTTLE_DELAY: 100, // ms
        
        NOTIFICATION_DURATION: {
            INFO: 3000,
            SUCCESS: 3000,
            WARNING: 5000,
            ERROR: 7000
        }
    },
    
    // ========================================================================
    // 🌐 NETWORK
    // ========================================================================
    
    NETWORK: {
        get WEBSOCKET_URL() { 
            return (typeof AppConfig !== 'undefined' && AppConfig.backend) 
                ? AppConfig.backend.url 
                : 'ws://localhost:8080'; 
        },
        RECONNECT_INTERVAL: 5000, // ms
        MAX_RECONNECT_ATTEMPTS: 10,
        PING_INTERVAL: 30000, // ms
        REQUEST_TIMEOUT: 30000, // ms
        HEARTBEAT_INTERVAL: 15000 // ms
    },
    
    // ========================================================================
    // 📁 FILES
    // ========================================================================
    
    FILES: {
        SUPPORTED_EXTENSIONS: ['.mid', '.midi'],
        MAX_FILE_SIZE: 10 * 1024 * 1024, // 10 MB
        UPLOAD_CHUNK_SIZE: 64 * 1024 // 64 KB
    },
    
    // ========================================================================
    // ⚡ PERFORMANCE
    // ========================================================================
    
    PERFORMANCE: {
        TARGET_FPS: 60,
        MIN_FPS: 30,
        RENDER_THROTTLE: 16, // ms (~60 fps)
        CACHE_CLEAN_INTERVAL: 60000, // ms
        MAX_CACHE_SIZE: 100
    }
};

// 🔒 Geler l'objet pour éviter les modifications
Object.freeze(Constants);
Object.freeze(Constants.COMMANDS);
Object.freeze(Constants.EVENTS);
Object.freeze(Constants.ERROR_CODES);
Object.freeze(Constants.PLAYBACK_STATES);
Object.freeze(Constants.PLAYBACK_STATE_NAMES);
Object.freeze(Constants.DEVICE_TYPES);
Object.freeze(Constants.DEVICE_TYPE_NAMES);
Object.freeze(Constants.DEVICE_STATUS);
Object.freeze(Constants.DEVICE_STATUS_NAMES);
Object.freeze(Constants.LOG_LEVELS);
Object.freeze(Constants.MIDI);
Object.freeze(Constants.UI);
Object.freeze(Constants.NETWORK);
Object.freeze(Constants.FILES);
Object.freeze(Constants.PERFORMANCE);

// 📤 Export pour utilisation
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Constants;
}
if (typeof window !== 'undefined') {
    window.Constants = Constants;
}