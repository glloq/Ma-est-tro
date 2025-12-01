# Installation Guide

Complete installation and configuration guide for Ma-est-tro.

---

## Table of Contents

- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Starting the Server](#starting-the-server)
- [Accessing the Interface](#accessing-the-interface)
- [Configuration](#configuration)
- [Service Management](#service-management)
- [Updating](#updating)
- [Troubleshooting](#troubleshooting)
- [Project Structure](#project-structure)

---

## Prerequisites

### Hardware
- Raspberry Pi 3B+, 4, or 5
- 2GB RAM minimum (4GB recommended)
- SD card with Raspberry Pi OS (Lite or Desktop)
- Network connection (Ethernet or WiFi)

### Software
- Raspberry Pi OS (Bookworm or newer recommended)
- Internet connection for installation

---

## Installation

### Automatic Installation (Recommended)

```bash
# Clone the repository
git clone https://github.com/glloq/Ma-est-tro.git
cd Ma-est-tro

# Run the installation script
chmod +x scripts/Install.sh
./scripts/Install.sh
```

The script automatically installs:
- Node.js 18 LTS
- System dependencies (ALSA, Bluetooth, build tools)
- PM2 process manager
- SQLite database
- Bluetooth configuration
- Systemd service for automatic startup

### Manual Installation

If you prefer manual installation:

```bash
# Install Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install system dependencies
sudo apt-get install -y libasound2-dev bluetooth bluez libbluetooth-dev

# Install npm dependencies
npm install

# Install PM2 globally
sudo npm install -g pm2
```

---

## Starting the Server

### Development Mode

```bash
npm run dev
```

### Production Mode

```bash
npm start
```

### With PM2 (Recommended)

```bash
# Start
npm run pm2:start

# View logs
npm run pm2:logs

# Stop
npm run pm2:stop

# Restart
npm run pm2:restart
```

---

## Accessing the Interface

### Local Access

```
http://localhost:8080
```

### Network Access

```
http://<Raspberry-Pi-IP>:8080
```

Find your IP address:
```bash
hostname -I
```

---

## Configuration

### config.json

Edit `config.json` to customize settings:

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

### Server Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `server.port` | 8080 | HTTP server port |
| `server.host` | 0.0.0.0 | Listen address (0.0.0.0 for all interfaces) |

### MIDI Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `midi.defaultLatency` | 10 | Default latency compensation in ms |
| `midi.enableBluetooth` | true | Enable Bluetooth device scanning |

### Logging

| Setting | Default | Description |
|---------|---------|-------------|
| `logging.level` | info | Log level: debug, info, warn, error |

---

## Service Management

### With PM2

```bash
npm run pm2:start     # Start the server
npm run pm2:stop      # Stop the server
npm run pm2:restart   # Restart the server
npm run pm2:logs      # View real-time logs
npm run pm2:status    # Check status
```

### With systemd

```bash
sudo systemctl start midimind     # Start
sudo systemctl stop midimind      # Stop
sudo systemctl restart midimind   # Restart
sudo systemctl status midimind    # Check status
sudo systemctl enable midimind    # Enable on boot
sudo systemctl disable midimind   # Disable on boot
```

### View Logs

```bash
# PM2 logs
npm run pm2:logs

# Systemd logs
sudo journalctl -u midimind -f

# Application logs
tail -f logs/midimind.log
```

---

## Updating

### Automatic Update

```bash
cd ~/Ma-est-tro
./scripts/update.sh
```

The script:
- Pulls latest code from git
- Updates npm dependencies
- Runs database migrations
- Restarts the server

### Manual Update

```bash
cd ~/Ma-est-tro
git pull origin main
npm install
npm run pm2:restart
```

---

## Troubleshooting

### MIDI Devices Not Detected

```bash
# List MIDI connections
aconnect -l

# List MIDI hardware
amidi -l

# Check ALSA
aplay -l
```

### Bluetooth Issues

```bash
# Check Bluetooth status
sudo systemctl status bluetooth

# Restart Bluetooth
sudo systemctl restart bluetooth

# Scan for devices manually
bluetoothctl
> power on
> scan on
```

### Server Won't Start

```bash
# Check if port is in use
sudo lsof -i :8080

# Check PM2 status
pm2 status

# View error logs
npm run pm2:logs
```

### Permission Issues

```bash
# Add user to required groups
sudo usermod -a -G audio,bluetooth $USER

# Logout and login again for changes to take effect
```

---

## Project Structure

```
Ma-est-tro/
├── scripts/              # Installation and update scripts
│   ├── Install.sh        # Main installation script
│   └── update.sh         # Update script
├── src/                  # Backend (Node.js)
│   ├── api/              # WebSocket server and HTTP API
│   ├── midi/             # MIDI device management and playback
│   ├── storage/          # Database and file management
│   └── managers/         # Bluetooth and Network managers
├── public/               # Frontend (Web interface)
│   ├── js/               # JavaScript components
│   ├── locales/          # Translation files (28 languages)
│   └── styles/           # CSS stylesheets
├── docs/                 # Documentation
├── migrations/           # Database migrations
├── data/                 # SQLite database (created at runtime)
├── uploads/              # Uploaded MIDI files
├── logs/                 # Application logs
└── config.json           # Configuration file
```

---

## Related Documentation

- [Bluetooth Setup](./BLUETOOTH_SETUP.md) - Configure Bluetooth LE MIDI
- [Network MIDI Setup](./NETWORK_MIDI_SETUP.md) - Configure RTP-MIDI
