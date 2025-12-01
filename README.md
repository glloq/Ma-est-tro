# Ma-est-tro

> **MIDI Orchestration System for Raspberry Pi with Modern Web Interface**

[![Node.js](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org/)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Raspberry Pi](https://img.shields.io/badge/Raspberry%20Pi-3B%2B%2F4%2F5-red)](https://www.raspberrypi.org/)

Ma-est-tro is a MIDI management system that allows you to manage your MIDI devices, edit and play MIDI files with latency compensation, all from a modern web interface.

![Main Interface](docs/images/main-interface.png)

## Installation

```bash
git clone https://github.com/glloq/Ma-est-tro.git
cd Ma-est-tro
chmod +x scripts/Install.sh
./scripts/Install.sh
```

Access the interface: `http://<Raspberry-Pi-IP>:8080`

See [docs/INSTALLATION.md](./docs/INSTALLATION.md) for detailed configuration.

## Features

### MIDI Devices

Support for multiple connection types:
- **USB MIDI** - Automatic detection
- **Bluetooth LE MIDI** - Scan and pair wireless instruments
- **Network MIDI (RTP-MIDI)** - Connect over WiFi/Ethernet

Configure each device with custom name, latency compensation, and note range.

### MIDI Files

- Upload and organize MIDI files in folders
- Drag-and-drop support
- Play, edit, or route files to devices

### MIDI Editor

![MIDI Editor](docs/images/editor.png)

Built-in Piano Roll editor:
- Add, move, delete notes
- Snap grid (1/1 to 1/16)
- 16 channels with distinct colors
- CC & Pitchbend editing
- Built-in synthesizer for preview

### Virtual Keyboard

![Virtual Keyboard](docs/images/virtual-keyboard.png)

Test devices from your browser:
- Mouse click and drag
- Computer keyboard support (AZERTY/QWERTY)
- Adjustable octave and velocity

### Channel Routing

Route each MIDI channel (1-16) to a different device for multi-instrument playback.

### Settings

- Theme: Light, Dark, Colored
- Virtual keyboard octaves (1-4)
- Language selection

## Languages

Available in 28 languages: English, French, Spanish, German, Italian, Portuguese, Dutch, Polish, Russian, Chinese, Japanese, Korean, Turkish, Hindi, Bengali, Thai, Vietnamese, Czech, Danish, Finnish, Greek, Hungarian, Indonesian, Norwegian, Swedish, Ukrainian, Esperanto, Tagalog.

## Documentation

- [Installation Guide](./docs/INSTALLATION.md)


## License

MIT License - see [LICENSE](LICENSE)
