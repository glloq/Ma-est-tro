# MidiMind 5.0

Comprehensive MIDI orchestration system for Raspberry Pi with modern web-based frontend.

## Features

### Backend (Node.js)
- **Device Management**: USB, Virtual, and BLE MIDI devices
- **Routing Engine**: Advanced MIDI routing with filters and channel mapping
- **File Management**: Upload, store, and playback MIDI files
- **Latency Compensation**: Automatic latency measurement and compensation
- **WebSocket API**: Real-time communication with 87+ commands
- **Session Management**: Save and restore complete MIDI setups
- **Playlist Support**: Organize and queue MIDI files

### Frontend (Vanilla JS + Modern UI Components)
- **High-Performance Piano Roll**: Optimized canvas rendering with RequestAnimationFrame (60 FPS)
- **WebAudio Controls**: Professional knobs and faders inspired by webaudio-controls
- **Enhanced WebSocket Client**: Auto-reconnect, message queuing, Promise-based API
- **Component Adapter**: Easy integration of UI components with existing architecture
- **Touch-Friendly**: Full support for mouse, touch, and keyboard interactions

## Requirements

- Node.js 18 LTS or higher
- Raspberry Pi OS Lite (64-bit)
- ALSA (`libasound2-dev`)
- 2GB RAM minimum (4GB recommended)

## Installation

```bash
# System dependencies
sudo apt-get update
sudo apt-get install -y libasound2-dev bluetooth bluez libbluetooth-dev

# Node.js 18 LTS
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# PM2 (optional)
sudo npm install -g pm2

# Project setup
npm install

# Database migration
npm run migrate
```

## Usage

### Development
```bash
npm run dev
```

### Production
```bash
# Direct
npm start

# With PM2
npm run pm2:start
npm run pm2:logs
npm run pm2:status
```

### Access
```
HTTP/WebSocket: http://localhost:8080
```

## API Commands

### Device Management (12 commands)
- `device_list` - List all MIDI devices
- `device_refresh` - Scan for new devices
- `device_info` - Get device details
- `device_enable` - Enable/disable device
- `virtual_create` - Create virtual MIDI port
- `virtual_delete` - Delete virtual port
- `ble_scan_start` - Start BLE scan
- `ble_connect` - Connect BLE device

### MIDI Routing (15 commands)
- `route_create` - Create MIDI route
- `route_delete` - Delete route
- `route_list` - List all routes
- `route_enable` - Enable/disable route
- `filter_set` - Set message filter
- `channel_map` - Set channel mapping
- `monitor_start` - Start device monitoring

### File Management (10 commands)
- `file_upload` - Upload MIDI file (Base64)
- `file_list` - List files
- `file_load` - Load file for playback
- `file_delete` - Delete file
- `file_save` - Save edited file
- `file_rename` - Rename file
- `file_export` - Export file

### Playback (10 commands)
- `playback_start` - Start playback
- `playback_stop` - Stop playback
- `playback_pause` - Pause playback
- `playback_seek` - Seek to position
- `playback_set_loop` - Enable/disable loop
- `playback_status` - Get playback status

### Latency (8 commands)
- `latency_measure` - Measure device latency
- `latency_set` - Set manual latency
- `latency_get` - Get latency profile
- `latency_list` - List all profiles
- `latency_auto_calibrate` - Auto-calibrate multiple devices

### MIDI Messages (8 commands)
- `midi_send` - Send raw MIDI message
- `midi_send_note` - Send note on/off
- `midi_send_cc` - Send control change
- `midi_send_program` - Send program change
- `midi_panic` - Send all notes off + reset

### System (8 commands)
- `system_status` - Get system status
- `system_info` - Get system info
- `system_backup` - Backup database
- `system_logs` - Get recent logs

### Sessions (6 commands)
- `session_save` - Save current session
- `session_load` - Load session
- `session_list` - List sessions
- `session_delete` - Delete session

### Presets (6 commands)
- `preset_save` - Save preset
- `preset_load` - Load preset
- `preset_list` - List presets
- `preset_delete` - Delete preset

### Playlists (4 commands)
- `playlist_create` - Create playlist
- `playlist_list` - List playlists
- `playlist_delete` - Delete playlist

## Configuration

Edit `config.json`:

```json
{
  "server": {
    "port": 8080
  },
  "midi": {
    "defaultLatency": 10
  },
  "logging": {
    "level": "info"
  }
}
```

## Frontend Components

See [FRONTEND_COMPONENTS.md](./FRONTEND_COMPONENTS.md) for detailed documentation on:
- **WebAudioKnob** - Rotary knobs for MIDI/audio controls
- **WebAudioFader** - Vertical/horizontal faders
- **OptimizedPianoRoll** - High-performance MIDI editor
- **EnhancedWebSocketClient** - Robust WebSocket with auto-reconnect
- **UIComponentAdapter** - Integration helper

### Demo
Open `examples/ui-components-demo.html` to see the components in action.

## Database

SQLite database with automatic migrations:
- `001_initial.sql` - Core tables
- `002-007_*.sql` - Feature tables

## Project Structure

```
midimind/
├── server.js              # Entry point
├── package.json
├── ecosystem.config.js    # PM2 config
├── config.json            # Configuration
├── src/
│   ├── core/
│   │   ├── Application.js
│   │   ├── EventBus.js
│   │   └── Logger.js
│   ├── config/
│   │   └── Config.js
│   ├── midi/
│   │   ├── DeviceManager.js
│   │   ├── MidiRouter.js
│   │   ├── MidiPlayer.js
│   │   ├── LatencyCompensator.js
│   │   └── MidiMessage.js
│   ├── storage/
│   │   ├── Database.js
│   │   ├── FileManager.js
│   │   ├── MidiDatabase.js
│   │   └── InstrumentDatabase.js
│   ├── api/
│   │   ├── CommandHandler.js
│   │   ├── WebSocketServer.js
│   │   └── HttpServer.js
│   └── utils/
│       ├── MidiUtils.js
│       ├── TimeUtils.js
│       └── JsonValidator.js
├── migrations/
│   ├── 001_initial.sql
│   └── 002-007_*.sql
├── scripts/
│   └── migrate-db.js
└── public/
    ├── index.html
    ├── css/
    └── js/
```

## License

MIT