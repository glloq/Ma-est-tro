# Ma-est-tro

> **MIDI Orchestration System for Raspberry Pi with Modern Web Interface**

[![Node.js](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org/)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Raspberry Pi](https://img.shields.io/badge/Raspberry%20Pi-3B%2B%2F4%2F5-red)](https://www.raspberrypi.org/)

Ma-est-tro is a MIDI management system that allows you to manage your MIDI devices, edit and play MIDI files with latency compensation, all from a modern responsive web interface.

---

## Quick Installation

```bash
# Clone the repository
git clone https://github.com/glloq/Ma-est-tro.git
cd Ma-est-tro

# Run the installation script
chmod +x scripts/Install.sh
./scripts/Install.sh

# Start the server
npm run pm2:start
```

Access the interface: `http://<Raspberry-Pi-IP>:8080`

> For detailed installation and configuration, see [docs/INSTALLATION.md](./docs/INSTALLATION.md)

---

## Features

![Main Interface](docs/images/main-interface.png)

### MIDI Device Management

Connect and manage your MIDI devices:

- **USB MIDI** - Automatic detection of USB devices
- **Bluetooth LE MIDI** - Scan and connect Bluetooth instruments
- **Network MIDI (RTP-MIDI)** - Connect devices over WiFi/Ethernet

Each device can be configured with:
- Custom name
- Latency compensation (positive or negative offset)
- Note range and CC capabilities

---

### MIDI File Management

- Upload MIDI files (.mid, .midi)
- Organize in folders with drag-and-drop
- Play, edit, or route each file

---

### MIDI Editor

![MIDI Editor](docs/images/editor.png)

Built-in Piano Roll editor:

- **Add/Move/Delete notes** with click and drag
- **Snap grid** - 1/1, 1/2, 1/4, 1/8, 1/16 note precision
- **16 MIDI channels** with distinct colors
- **CC & Pitchbend curves** editing
- **Built-in synthesizer** to preview without external equipment

---

### Virtual Keyboard

![Virtual Keyboard](docs/images/virtual-keyboard.png)

Test your MIDI devices from the browser:

- **Mouse**: Click or drag across keys
- **Computer keyboard**: AZERTY and QWERTY layouts supported
- **Controls**: Octave shift, velocity, device selection

| AZERTY | QWERTY |
|--------|--------|
| White: `S D F G H J K L M` | White: `S D F G H J K L ;` |
| Black: `Z E T Y U O P` | Black: `W E T Y U I O P` |

---

### Channel Routing

Route MIDI channels to different devices:

1. Click **Route** on a MIDI file
2. Assign each channel (1-16) to a device
3. Play the file - each instrument receives its channel

Perfect for multi-instrument setups!

---

### Settings

- **Theme**: Light, Dark, or Colored
- **Keyboard octaves**: 1 to 4 octaves
- **Language**: 28 languages available

---

## Languages

Available in 28 languages:

| | | | |
|---|---|---|---|
| English | French | Spanish | German |
| Italian | Portuguese | Dutch | Polish |
| Russian | Chinese | Japanese | Korean |
| Turkish | Hindi | Bengali | Thai |
| Vietnamese | Czech | Danish | Finnish |
| Greek | Hungarian | Indonesian | Norwegian |
| Swedish | Ukrainian | Esperanto | Tagalog |

---

## Documentation

| Document | Description |
|----------|-------------|
| [Installation Guide](./docs/INSTALLATION.md) | Detailed setup, configuration, and commands |
| [Bluetooth Setup](./docs/BLUETOOTH_SETUP.md) | BLE MIDI configuration |
| [Network MIDI Setup](./docs/NETWORK_MIDI_SETUP.md) | RTP-MIDI configuration |

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
