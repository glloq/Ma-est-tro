# Ma-est-tro

> **MIDI Orchestration System for Raspberry Pi with Modern Web Interface**

[![Node.js](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org/)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Raspberry Pi](https://img.shields.io/badge/Raspberry%20Pi-3B%2B%2F4%2F5-red)](https://www.raspberrypi.org/)

Ma-est-tro is a complete MIDI management system that allows you to manage your MIDI devices, edit and play MIDI files with latency compensation, all from a modern responsive web interface.

![Main Interface](docs/images/main-interface.png)

---

## Table of Contents

- [Installation](#installation)
- [Features Overview](#features-overview)
- [Main Interface](#main-interface)
- [Instrument Connection](#instrument-connection)
- [MIDI File Management](#midi-file-management)
- [MIDI Editor](#midi-editor)
- [Virtual Keyboard](#virtual-keyboard)
- [Playback Controls](#playback-controls)
- [Routing & Channel Mapping](#routing--channel-mapping)
- [Languages](#languages)
- [Configuration](#configuration)
- [Useful Commands](#useful-commands)
- [API Reference](#api-reference)
- [Contributing](#contributing)
- [License](#license)

---

## Installation

### Prerequisites

- Raspberry Pi 3B+, 4, or 5 (2GB RAM minimum, 4GB recommended)
- Raspberry Pi OS (Lite or Desktop)
- Network connection (Ethernet or WiFi)

### Automatic Installation

```bash
# Clone the repository
git clone https://github.com/glloq/Ma-est-tro.git
cd Ma-est-tro

# Run the complete installation
chmod +x scripts/Install.sh
./scripts/Install.sh
```

The script automatically installs:
- Node.js 18 LTS
- All system dependencies (ALSA, Bluetooth, build tools)
- PM2 (process manager)
- SQLite database
- Bluetooth configuration
- Systemd service for automatic startup

### Starting the Server

```bash
# Development mode
npm run dev

# Production mode
npm start

# With PM2 (recommended)
npm run pm2:start
npm run pm2:logs
```

### Accessing the Web Interface

- **Local**: `http://localhost:8080`
- **On network**: `http://<Raspberry-Pi-IP>:8080`

Find your IP address: `hostname -I`

### Updating

```bash
cd ~/Ma-est-tro
./scripts/update.sh
```

---

## Features Overview

| Feature | Description |
|---------|-------------|
| **Device Management** | USB, Bluetooth (BLE), and Network (RTP-MIDI) detection |
| **MIDI Files** | Upload, folder organization, Piano Roll editing |
| **Channel Routing** | Assign each MIDI channel (1-16) to different devices |
| **Smart Playback** | Per-instrument latency compensation for perfect sync |
| **Virtual Keyboard** | Test your devices from the browser |
| **Built-in Synthesizer** | Preview MIDI playback directly in browser |
| **Multi-language** | 28+ languages supported |
| **Real-time Interface** | WebSocket-based responsive UI |

---

## Main Interface

The main interface provides quick access to all features:

![Main Interface](docs/images/main-interface.png)

### Device Panel
- View all connected MIDI devices
- Scan for USB, Bluetooth, and Network devices
- Enable/disable individual devices
- Configure device settings and latency

### File Browser
- Browse uploaded MIDI files
- Organize files in folders
- Quick access to play, edit, or route files
- Search files by name

### Quick Actions
- **Scan USB**: Detect USB MIDI devices
- **Scan Bluetooth**: Find BLE MIDI devices
- **Scan Network**: Discover RTP-MIDI devices on the network

---

## Instrument Connection

Ma-est-tro supports three types of MIDI connections:

### USB MIDI Devices

1. Connect your USB MIDI device to the Raspberry Pi
2. Click **Scan USB** in the interface
3. The device appears in the device list

### Bluetooth LE MIDI

1. Enable Bluetooth on your MIDI device
2. Click **Scan Bluetooth** in the interface
3. Select your device from the discovered list
4. Click **Connect** to pair

### Network MIDI (RTP-MIDI)

1. Ensure your device is on the same network
2. Click **Scan Network** to auto-discover devices
3. Or manually enter the IP address to connect

### Instrument Settings

Click the **Settings** icon next to any device to configure:

| Setting | Description |
|---------|-------------|
| **Name** | Custom display name for the instrument |
| **MIDI Channel** | Default channel (1-16) |
| **Program** | Default program/patch number (0-127) |
| **Bank MSB/LSB** | Bank selection for instruments with multiple banks |
| **Sync Delay** | Latency compensation in milliseconds |
| **Notes** | Custom notes or description |

#### Latency Compensation

Configure synchronization delay for each device:
- **Positive value** (e.g., `80`): Delay notes (useful for Bluetooth)
- **Negative value** (e.g., `-20`): Advance notes
- **Zero** (default): No compensation

The system can also auto-calibrate latency using the **Measure Latency** feature.

---

## MIDI File Management

### Uploading Files

1. Click **MIDI Files** in the navigation
2. Click **Upload** or drag-and-drop files
3. Supported formats: `.mid`, `.midi`

### File Organization

- Create folders to organize your files
- Move files between folders
- Rename or duplicate files
- Search by filename

### File Information

Each file displays:
- Duration
- Tempo (BPM)
- Number of tracks
- Detected channels

---

## MIDI Editor

The built-in Piano Roll editor allows you to create and modify MIDI files:

![MIDI Editor](docs/images/editor.png)

### Editing Notes

- **Add notes**: Click on the piano roll grid
- **Move notes**: Drag notes to reposition
- **Delete notes**: Select and press Delete, or right-click
- **Adjust velocity**: Modify note intensity
- **Resize notes**: Drag note edges to change duration

### Snap Grid Options

| Grid | Resolution |
|------|------------|
| 1/1 | Whole note |
| 1/2 | Half note |
| 1/4 | Quarter note |
| 1/8 | Eighth note |
| 1/16 | Sixteenth note |

### Channel Management

- View all 16 MIDI channels
- Each channel has a distinct color
- Enable/disable channels for playback
- Switch between channels for editing

### CC & Pitchbend Editing

- Edit Control Change (CC) curves
- Draw pitchbend automation
- Velocity curve visualization

### Undo/Redo

Full command history support:
- Undo changes with Ctrl+Z
- Redo with Ctrl+Y
- History tracks all note operations

### Built-in Synthesizer

Preview your edits with the integrated browser synthesizer:
- FM synthesis with multiple presets
- 100+ General MIDI instruments
- No external audio equipment needed

---

## Virtual Keyboard

Test your MIDI devices directly from the browser:

![Virtual Keyboard](docs/images/virtual-keyboard.png)

### Keyboard Layout

- 3-octave piano display (configurable 1-4 octaves)
- Visual feedback for active notes
- Click or drag to play notes

### Computer Keyboard Support

**QWERTY Layout:**
- White keys: `A S D F G H J K L ;`
- Black keys: `W E T Y U I O P`

**AZERTY Layout:**
- White keys: `Q S D F G H J K L M`
- Black keys: `Z E T Y U I O P`

### Controls

| Control | Description |
|---------|-------------|
| **Octave +/-** | Shift the keyboard up or down |
| **Velocity** | Adjust note intensity (0-127) |
| **Device** | Select target MIDI device |
| **All Notes Off** | Panic button - stops all sounds |

---

## Playback Controls

### Transport Controls

- **Play**: Start playback from current position
- **Pause**: Pause playback (resume from same position)
- **Stop**: Stop and reset to beginning
- **Seek**: Click on timeline to jump to position

### Playback Settings

| Setting | Description |
|---------|-------------|
| **Tempo** | Adjust BPM (speed up or slow down) |
| **Volume** | Master volume control (0-100%) |
| **Transpose** | Shift pitch up/down by semitones |
| **Loop** | Enable/disable loop playback |

### Channel Routing During Playback

Configure which device plays each MIDI channel:
1. Click **Route** next to a file
2. Assign channels 1-16 to available devices
3. Save the configuration

---

## Routing & Channel Mapping

### Creating Routes

1. Go to **Routing** section
2. Click **Create Route**
3. Select source and destination devices
4. Configure channel mapping

### Channel Mapping

Map MIDI channels from source to destination:
- Route channel 1 to channel 10
- Merge multiple channels
- Split one channel to many

### Filtering Options

Filter MIDI messages by:
- Message type (Note, CC, Program Change)
- Channel range
- Note range
- Velocity range
- CC number

### Route Operations

- **Enable/Disable**: Toggle routes on/off
- **Duplicate**: Copy route configuration
- **Export/Import**: Share routing setups
- **Test**: Send test notes through route

---

## Languages

Ma-est-tro supports 28+ languages:

| Language | Code | Language | Code |
|----------|------|----------|------|
| English | en | Russian | ru |
| French | fr | Chinese (Simplified) | zh-CN |
| Spanish | es | Japanese | ja |
| German | de | Korean | ko |
| Italian | it | Turkish | tr |
| Portuguese | pt | Hindi | hi |
| Dutch | nl | Thai | th |
| Polish | pl | Vietnamese | vi |
| Czech | cs | Indonesian | id |
| Danish | da | Ukrainian | uk |
| Finnish | fi | Hungarian | hu |
| Greek | el | Swedish | sv |
| Norwegian | no | Esperanto | eo |
| Bengali | bn | Tagalog | tl |

### Changing Language

1. Click **Settings** in the navigation
2. Select your language from the dropdown
3. The interface updates immediately

---

## Configuration

Edit `config.json` to customize settings:

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

### Server Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `server.port` | 8080 | HTTP server port |
| `server.host` | 0.0.0.0 | Listen address |
| `websocket.port` | 8081 | WebSocket port |

### MIDI Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `midi.defaultLatency` | 10 | Default latency compensation (ms) |
| `midi.enableBluetooth` | true | Enable Bluetooth scanning |
| `midi.enableVirtual` | true | Allow virtual MIDI devices |

### Logging

| Setting | Default | Description |
|---------|---------|-------------|
| `logging.level` | info | Log level (debug, info, warn, error) |

---

## Useful Commands

### Service Management

**With PM2:**
```bash
npm run pm2:start    # Start
npm run pm2:stop     # Stop
npm run pm2:restart  # Restart
npm run pm2:logs     # View logs
```

**With systemd:**
```bash
sudo systemctl start midimind    # Start
sudo systemctl stop midimind     # Stop
sudo systemctl restart midimind  # Restart
sudo systemctl status midimind   # Status
sudo journalctl -u midimind -f   # Real-time logs
```

### MIDI Diagnostics

```bash
# List MIDI devices
aconnect -l
amidi -l

# Bluetooth status
sudo systemctl status bluetooth

# Application logs
tail -f logs/midimind.log
```

---

## API Reference

Ma-est-tro provides a comprehensive **WebSocket API with 95+ commands**:

| Category | Commands |
|----------|----------|
| **Devices** | `device_list`, `device_refresh`, `ble_scan_start`, `network_scan` |
| **Files** | `file_upload`, `file_load`, `file_save`, `file_delete` |
| **Playback** | `playback_start`, `playback_pause`, `playback_stop`, `playback_seek` |
| **Routing** | `route_create`, `channel_map`, `playback_set_channel_routing` |
| **Latency** | `latency_set`, `latency_measure`, `latency_auto_calibrate` |
| **MIDI** | `midi_send_note`, `midi_send_cc`, `midi_panic` |

Full API reference: `src/api/CommandHandler.js`

---

## Project Structure

```
Ma-est-tro/
├── scripts/          # Installation and update scripts
├── src/              # Backend (Node.js)
│   ├── api/          # WebSocket, CommandHandler, HttpServer
│   ├── midi/         # DeviceManager, MidiRouter, MidiPlayer
│   ├── storage/      # Database, FileManager
│   └── managers/     # BluetoothManager, NetworkManager
├── public/           # Frontend (Vanilla JS)
│   ├── js/           # Application, Components, API Client
│   ├── locales/      # Translation files (28+ languages)
│   └── styles/       # CSS stylesheets
├── docs/             # Documentation
├── migrations/       # Database migrations
├── data/             # SQLite database (created at runtime)
└── uploads/          # Uploaded MIDI files
```

---

## Documentation

| Document | Description |
|----------|-------------|
| [BLUETOOTH_SETUP.md](./docs/BLUETOOTH_SETUP.md) | Bluetooth BLE MIDI configuration |
| [NETWORK_MIDI_SETUP.md](./docs/NETWORK_MIDI_SETUP.md) | RTP-MIDI network configuration |

---

## Contributing

Contributions are welcome! To contribute:

1. Fork the repository
2. Create a feature branch
3. Test your changes
4. Submit a pull request

---

## License

MIT License - see the [LICENSE](LICENSE) file

---

## Acknowledgements

**Libraries:**
- [webaudio-pianoroll](https://github.com/g200kg/webaudio-pianoroll) by g200kg
- [easymidi](https://www.npmjs.com/package/easymidi) by Andrew Kelley
- [ws](https://github.com/websockets/ws) - WebSocket server
- [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) - SQLite database

---

## Support

- **Documentation**: See the `docs/` folder
- **Issues**: [GitHub Issues](https://github.com/glloq/Ma-est-tro/issues)

---

**Happy MIDI Orchestrating!**

Made with love for the MIDI community
