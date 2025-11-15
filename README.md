# 🎹 MidiMind 5.0

> **Complete MIDI orchestration system for Raspberry Pi with modern web interface**

Manage MIDI devices, route channels, edit MIDI files, and play with latency compensation - all from a web browser.

[![Node.js](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org/)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

---

## ✨ Features

### 🎛️ MIDI Management
- **Device Management**: USB, Virtual, and BLE MIDI devices
- **Advanced Routing**: Channel mapping, filters, and multi-device support
- **Latency Compensation**: Automatic calibration per device/channel
- **Real-time Monitoring**: MIDI message inspection and logging

### 🎵 File & Playback
- **File Upload/Download**: Manage MIDI files via web interface
- **Piano Roll Editor**: Visual editing powered by webaudio-pianoroll
- **Smart Playback**: Tempo control, loop, transpose with latency compensation
- **Playlist Support**: Queue multiple files

### 🌐 Modern Web Interface
- **High-Performance UI**: 60 FPS canvas rendering
- **WebMIDI Integration**: Use browser MIDI devices + hardware MIDI
- **Touch-Friendly**: Works on tablets and mobile
- **Real-time Updates**: WebSocket-based live communication

### 🔧 Developer Features
- **87+ API Commands**: Complete WebSocket API
- **Session Management**: Save and restore setups
- **Preset System**: Store routing configurations
- **SQLite Database**: Lightweight and portable

---

## 🚀 Quick Start

### One-Line Installation (Raspberry Pi / Linux)

```bash
git clone https://github.com/yourusername/Ma-est-tro.git
cd Ma-est-tro
chmod +x scripts/Install.sh
./scripts/Install.sh
```

The install script will:
- ✅ Install system dependencies (ALSA, Bluetooth, build tools)
- ✅ Install Node.js 18 LTS
- ✅ Install PM2 process manager
- ✅ Install npm dependencies
- ✅ Initialize SQLite database
- ✅ Create configuration files
- ✅ Set up systemd service or PM2 startup

### Manual Installation

```bash
# 1. System dependencies
sudo apt-get update
sudo apt-get install -y libasound2-dev bluetooth bluez libbluetooth-dev build-essential

# 2. Node.js 18 LTS
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# 3. Install project
npm install

# 4. Initialize database
npm run migrate

# 5. Start server
npm start
```

### Start the Server

```bash
# Development mode (with auto-reload)
npm run dev

# Production mode
npm start

# With PM2 (recommended for production)
npm run pm2:start
npm run pm2:logs
```

### Access the Web Interface

Open your browser to:
```
http://localhost:8080
```

Or from another device on the network:
```
http://<raspberry-pi-ip>:8080
```

---

## 📖 Usage

### 1️⃣ Upload MIDI Files

- Click **"Files"** in the navigation
- Upload `.mid` or `.midi` files
- Files are stored on the Raspberry Pi

### 2️⃣ Edit MIDI Files

- Select a file
- Click **"Edit"**
- Use the piano roll to:
  - Add notes (click)
  - Move notes (drag)
  - Delete notes (select + Delete)
  - Zoom (Ctrl + Wheel)

### 3️⃣ Route MIDI Channels

- Go to **"Instruments"**
- For each MIDI channel (1-16):
  - Select target instrument
  - Set latency compensation (ms)
- Click **"Apply Routing"**

### 4️⃣ Play with Latency Compensation

- Select a file
- Click **"Play"**
- MidiMind automatically compensates for device latency
- Each channel plays in perfect sync!

---

## 🧪 Testing

### Functionality Test Suite

Open in your browser:
```
examples/functionality-test.html
```

Tests all features:
- ✅ File upload
- ✅ File selection
- ✅ Piano roll editing
- ✅ Saving modifications
- ✅ Channel routing
- ✅ Latency compensation
- ✅ Playback

See [TESTING.md](./TESTING.md) for detailed testing guide.

---

## 📚 Documentation

| Document | Description |
|----------|-------------|
| [QUICK_START.md](./QUICK_START.md) | Quick start guide with code examples |
| [INTEGRATION_GUIDE.md](./INTEGRATION_GUIDE.md) | Full architecture and integration guide |
| [FRONTEND_COMPONENTS.md](./FRONTEND_COMPONENTS.md) | UI components documentation |
| [TESTING.md](./TESTING.md) | Complete testing guide with API examples |

---

## 🎯 Key Functionalities

### File Management
```javascript
// Upload MIDI file
await fileManager.uploadFile(file);

// List files
const files = await fileManager.refreshFileList();

// Open in editor
await fileManager.openInEditor(fileId);

// Save modifications
await fileManager.saveModifications();
```

### MIDI Routing
```javascript
// Route channel to instrument
await routingManager.routeChannelToInstrument(0, 'piano-id');

// Set latency compensation
await routingManager.setDeviceLatency('piano-id', 30); // 30ms
```

### Playback
```javascript
// Start playback with options
await apiClient.startPlayback(fileId, {
    tempo: 120,
    loop: false,
    transpose: 0
});
```

See [TESTING.md](./TESTING.md) for complete API documentation.

---

## 🏗️ Architecture

```
┌──────────────────────────────────────────────────────────┐
│                    Browser Frontend                       │
├──────────────────────────────────────────────────────────┤
│                                                            │
│  WebMIDI.js (browser MIDI)                                │
│       ↕                                                    │
│  MidiBridge ←→ WebSocket ←→ Backend (Raspberry Pi)       │
│       ↕                             ↕                      │
│  Tone.js (audio preview)      easymidi (hardware MIDI)   │
│       ↕                             ↕                      │
│  webaudio-pianoroll           Hardware MIDI Devices       │
│  (visual editor)               (USB/Virtual/BLE)          │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

---

## 🔧 Configuration

Edit `config.json`:

```json
{
  "server": {
    "port": 8080,
    "host": "0.0.0.0"
  },
  "websocket": {
    "port": 8081
  },
  "midi": {
    "defaultLatency": 10,
    "enableBluetooth": true,
    "enableVirtual": true
  },
  "logging": {
    "level": "info"
  }
}
```

---

## 📦 Project Structure

```
Ma-est-tro/
├── scripts/
│   └── Install.sh           # Complete installation script
├── src/                     # Backend (Node.js)
│   ├── api/
│   │   ├── CommandHandler.js  # 87+ API commands
│   │   ├── WebSocketServer.js
│   │   └── HttpServer.js
│   ├── midi/
│   │   ├── DeviceManager.js   # MIDI device management
│   │   ├── MidiRouter.js      # Routing engine
│   │   ├── MidiPlayer.js      # Playback engine
│   │   └── LatencyCompensator.js
│   └── storage/
│       ├── Database.js
│       └── FileManager.js
├── public/                  # Frontend (Vanilla JS)
│   ├── js/
│   │   ├── api/
│   │   │   └── BackendAPIClient.js
│   │   ├── managers/
│   │   │   ├── MidiFileManager.js
│   │   │   └── MidiRoutingManager.js
│   │   ├── bridges/
│   │   │   └── MidiBridge.js
│   │   └── integration/
│   │       └── MidiIntegrationManager.js
│   └── index.html
├── examples/
│   ├── functionality-test.html   # Complete test suite
│   └── integrated-editor.html    # Full MIDI editor demo
├── migrations/              # Database migrations
├── data/                    # SQLite database
└── uploads/                 # Uploaded MIDI files
```

---

## 🌟 External Libraries Used

MidiMind integrates proven open-source libraries:

### Frontend
- [WebMidi.js](https://github.com/djipco/webmidi) - Browser MIDI access
- [Tone.js](https://github.com/Tonejs/Tone.js) - Audio synthesis
- [webaudio-pianoroll](https://github.com/g200kg/webaudio-pianoroll) - Piano roll editor
- [webaudio-controls](https://github.com/g200kg/webaudio-controls) - UI controls

### Backend
- [easymidi](https://www.npmjs.com/package/easymidi) - Node.js MIDI
- [ws](https://github.com/websockets/ws) - WebSocket server
- [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) - SQLite database

All libraries loaded from CDN with auto-fallback.

---

## 🔌 API Commands

MidiMind provides **87+ WebSocket commands** organized in categories:

| Category | Commands | Examples |
|----------|----------|----------|
| **Devices** | 12 | `device_list`, `device_refresh`, `ble_scan_start` |
| **Routing** | 15 | `route_create`, `channel_map`, `filter_set` |
| **Files** | 10 | `file_upload`, `file_load`, `file_save` |
| **Playback** | 10 | `playback_start`, `playback_set_tempo` |
| **Latency** | 8 | `latency_set`, `latency_auto_calibrate` |
| **MIDI Messages** | 8 | `midi_send_note`, `midi_send_cc`, `midi_panic` |
| **System** | 8 | `system_status`, `system_backup` |
| **Sessions** | 6 | `session_save`, `session_load` |
| **Presets** | 6 | `preset_save`, `preset_load` |
| **Playlists** | 4 | `playlist_create`, `playlist_add_file` |

See backend code for complete API reference: `src/api/CommandHandler.js`

---

## 🖥️ System Requirements

### Minimum
- **CPU**: Raspberry Pi 3B+ or equivalent
- **RAM**: 2GB
- **OS**: Raspberry Pi OS Lite (64-bit) or Ubuntu 20.04+
- **Node.js**: 18.0.0 or higher
- **Storage**: 4GB free space

### Recommended
- **CPU**: Raspberry Pi 4 or higher
- **RAM**: 4GB
- **Storage**: 8GB+ SD card
- **Network**: Ethernet or WiFi for web access

### Tested On
- ✅ Raspberry Pi 4 (4GB RAM) - Recommended
- ✅ Raspberry Pi 3B+
- ✅ Ubuntu 22.04 Desktop
- ✅ macOS 13+ (development only)

---

## 🛠️ Development

### Running in Development Mode

```bash
npm run dev
```

### Building for Production

```bash
npm start
```

### Running Tests

```bash
npm test
```

### Database Management

```bash
# Run migrations
npm run migrate

# Reset database
rm data/midimind.db
npm run migrate
```

---

## 🤝 Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

---

## 📝 License

MIT License - see [LICENSE](LICENSE) file for details.

---

## 🙏 Credits

### Libraries
- WebMidi.js by Jean-Philippe Côté ([@djipco](https://github.com/djipco))
- Tone.js by Yotam Mann and contributors
- webaudio-pianoroll by g200kg
- webaudio-controls by g200kg
- easymidi by Andrew Kelley

### Inspiration
- MIDI.org specifications
- Web MIDI API standard
- Open-source MIDI community

---

## 📬 Support

- **Documentation**: See `docs/` folder
- **Issues**: [GitHub Issues](https://github.com/yourusername/Ma-est-tro/issues)
- **Discussions**: [GitHub Discussions](https://github.com/yourusername/Ma-est-tro/discussions)

---

## 🎵 Happy MIDI Orchestrating! 🎹

Made with ❤️ for the MIDI community

---
