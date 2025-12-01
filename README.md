# Ma-est-tro

> **MIDI Orchestration System for Raspberry Pi with Modern Web Interface**

[![Node.js](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org/)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Raspberry Pi](https://img.shields.io/badge/Raspberry%20Pi-3B%2B%2F4%2F5-red)](https://www.raspberrypi.org/)

Ma-est-tro is a MIDI management system that allows you to manage your MIDI devices, edit and play MIDI files with latency compensation, all from a modern responsive web interface.

![Main Interface](docs/images/main-interface.png)

---

## Table of Contents

- [Installation](#installation)
- [Main Interface](#main-interface)
- [MIDI Devices](#midi-devices)
- [MIDI Files](#midi-files)
- [MIDI Editor](#midi-editor)
- [Virtual Keyboard](#virtual-keyboard)
- [Channel Routing](#channel-routing)
- [Settings](#settings)
- [Languages](#languages)
- [Configuration](#configuration)
- [Useful Commands](#useful-commands)
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

## Main Interface

The main interface is divided into two main sections:

![Main Interface](docs/images/main-interface.png)

### Left Panel - MIDI Files
- Upload and manage your MIDI files
- Organize files in folders
- Play, edit, or configure routing for each file

### Right Panel - MIDI Devices
- View all connected MIDI devices
- Scan for new devices (USB, Bluetooth, Network)
- Configure each device settings

### Header Controls
- **Play/Pause**: Start or pause playback of the selected file
- **Stop**: Stop playback
- **Keyboard button**: Open the virtual MIDI keyboard
- **Settings button**: Open application settings
- **Debug button**: Show/hide the debug console

---

## MIDI Devices

Ma-est-tro supports three types of MIDI connections:

### USB MIDI
1. Connect your USB MIDI device to the Raspberry Pi
2. Click **Scan USB**
3. The device appears in the list

### Bluetooth LE MIDI
1. Put your MIDI device in pairing mode
2. Click **Scan Bluetooth**
3. Select your device from the list
4. Click **Connect**

### Network MIDI (RTP-MIDI)
1. Ensure your device is on the same network
2. Click **Scan Network**
3. Select the device or enter IP manually

### Device Settings

Click the **⚙️** button next to a device to configure:

| Setting | Description |
|---------|-------------|
| **Name** | Custom display name |
| **Sync Delay** | Latency compensation in milliseconds |
| **Notes** | Personal notes about the device |

#### Latency Compensation
- **Positive value** (ex: `80`): Delays the notes (for Bluetooth devices)
- **Negative value** (ex: `-20`): Advances the notes
- **Zero**: No compensation (default)

### Instrument Capabilities

You can also configure:
- Note range supported by the instrument
- Available MIDI CC controllers
- SysEx identity information

---

## MIDI Files

### Upload Files

1. Click **Browse** to select files, or drag-and-drop
2. Click **Upload**
3. Supported formats: `.mid`, `.midi`

### File Organization

- Click **New Folder** to create folders
- Drag files to move them between folders
- Right-click for more options (rename, delete, duplicate)

### File Actions

For each file, you can:
- **▶️ Play**: Start playback
- **✏️ Edit**: Open in the MIDI editor
- **🔀 Route**: Configure channel routing

---

## MIDI Editor

The built-in Piano Roll editor allows you to create and modify MIDI files:

![MIDI Editor](docs/images/editor.png)

### Navigation
- **Scroll**: Navigate through the timeline
- **Zoom**: Adjust the view scale

### Editing Notes
- **Click** on the grid to add a note
- **Drag** a note to move it
- **Right-click** to delete a note

### Snap Grid

Control note placement precision:

| Grid | Description |
|------|-------------|
| 1/1 | Whole note |
| 1/2 | Half note |
| 1/4 | Quarter note |
| 1/8 | Eighth note |
| 1/16 | Sixteenth note (maximum precision) |

### Channels

- Each MIDI channel (1-16) has a distinct color
- Toggle channels on/off for display
- Select which channel to edit

### CC & Pitchbend

Expand the CC section to edit:
- Control Change (CC) curves
- Pitchbend automation
- Velocity curves

### Playback Preview

The editor includes a built-in synthesizer to preview your work:
- Click **Play** to hear the MIDI directly in your browser
- Supports General MIDI instruments
- No external equipment needed

---

## Virtual Keyboard

Test your MIDI devices directly from the browser:

![Virtual Keyboard](docs/images/virtual-keyboard.png)

### Mouse Control
- Click on keys to play notes
- Drag across keys for glissando

### Computer Keyboard

**AZERTY layout:**
- White keys: `S D F G H J K L M`
- Black keys: `Z E T Y U O P`

**QWERTY layout:**
- White keys: `S D F G H J K L ;`
- Black keys: `W E T Y U I O P`

### Controls

| Control | Description |
|---------|-------------|
| **Octave** | Shift keyboard up/down by octaves |
| **Velocity** | Adjust note intensity (0-127) |
| **Device** | Select target MIDI device |
| **Layout** | Switch between AZERTY/QWERTY |

---

## Channel Routing

Configure which MIDI device plays each channel:

1. Click **🔀 Route** next to a MIDI file
2. For each channel (1-16), select a target device
3. Click **Save**

This allows you to:
- Send drums (channel 10) to one device
- Send melody to another device
- Split a multi-track MIDI across multiple instruments

---

## Settings

Access settings via the **⚙️** button in the header:

### Theme
- **Light**: Light background (default)
- **Dark**: Dark background
- **Colored**: Gradient background

### Keyboard Octaves
Adjust the number of octaves displayed in the virtual keyboard (1-4 octaves)

### Language
Select your preferred interface language (see [Languages](#languages))

---

## Languages

Ma-est-tro is available in 28 languages:

| | | | |
|---|---|---|---|
| English | French | Spanish | German |
| Italian | Portuguese | Dutch | Polish |
| Russian | Chinese (Simplified) | Japanese | Korean |
| Turkish | Hindi | Bengali | Thai |
| Vietnamese | Czech | Danish | Finnish |
| Greek | Hungarian | Indonesian | Norwegian |
| Swedish | Ukrainian | Esperanto | Tagalog |

To change language:
1. Open **Settings**
2. Select your language
3. The interface updates immediately

---

## Configuration

Edit `config.json` to customize:

```json
{
  "server": {
    "port": 8080,
    "host": "0.0.0.0"
  },
  "midi": {
    "defaultLatency": 10,
    "enableBluetooth": true
  },
  "logging": {
    "level": "info"
  }
}
```

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
sudo systemctl start midimind
sudo systemctl stop midimind
sudo systemctl status midimind
sudo journalctl -u midimind -f
```

### MIDI Diagnostics

```bash
aconnect -l              # List MIDI connections
amidi -l                 # List MIDI devices
sudo systemctl status bluetooth   # Bluetooth status
```

---

## Project Structure

```
Ma-est-tro/
├── scripts/          # Installation scripts
├── src/              # Backend (Node.js)
├── public/           # Frontend (Web interface)
│   ├── js/           # JavaScript components
│   ├── locales/      # Translation files
│   └── styles/       # CSS
├── docs/             # Documentation
└── uploads/          # Uploaded MIDI files
```

---

## Documentation

- [Bluetooth Setup](./docs/BLUETOOTH_SETUP.md)
- [Network MIDI Setup](./docs/NETWORK_MIDI_SETUP.md)

---

## Contributing

Contributions are welcome!

1. Fork the repository
2. Create a feature branch
3. Test your changes
4. Submit a pull request

---

## License

MIT License - see [LICENSE](LICENSE)

---

## Acknowledgements

- [webaudio-pianoroll](https://github.com/g200kg/webaudio-pianoroll) by g200kg
- [easymidi](https://www.npmjs.com/package/easymidi)
- [ws](https://github.com/websockets/ws)
- [better-sqlite3](https://github.com/WiseLibs/better-sqlite3)

---

## Support

- **Issues**: [GitHub Issues](https://github.com/glloq/Ma-est-tro/issues)
