# 🎹 MidiMind 5.0

> **Système complet d'orchestration MIDI pour Raspberry Pi avec interface web moderne**

Gérez vos appareils MIDI, routez les canaux, éditez les fichiers MIDI et jouez avec compensation de latence - le tout depuis un navigateur web.

[![Node.js](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org/)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Raspberry Pi](https://img.shields.io/badge/Raspberry%20Pi-3B%2B%2F4-red)](https://www.raspberrypi.org/)

---

## 🎯 Capacités de l'Application

MidiMind 5.0 est un système d'orchestration MIDI professionnel conçu pour Raspberry Pi, permettant de :

### 🎹 Gestion Complète des Périphériques MIDI
- **Détection Automatique** : Scan des périphériques USB, Bluetooth (BLE) et réseau (RTP-MIDI)
- **Support Multi-Connexions** : Gérez plusieurs claviers, synthétiseurs, contrôleurs simultanément
- **Périphériques Virtuels** : Créez des ports MIDI virtuels pour le routage inter-applications
- **Clavier MIDI Virtuel** : Interface de clavier jouable directement dans le navigateur
- **Surveillance en Temps Réel** : Visualisez tous les messages MIDI (Note On/Off, Control Change, Program Change, etc.)

### 🎵 Édition et Lecture de Fichiers MIDI
- **Gestionnaire de Fichiers** : Upload/download de fichiers MIDI (.mid, .midi)
- **Organisation** : Création de dossiers, tri, recherche de fichiers
- **Éditeur Piano Roll** : Édition visuelle avec zoom, déplacement, ajout/suppression de notes
- **Lecture Avancée** :
  - Contrôle du tempo (30-300 BPM)
  - Transposition (-24 à +24 demi-tons)
  - Mode boucle
  - Compensation automatique de latence par canal
- **Playlists** : Files d'attente de lecture avec lecture consécutive

### 🔀 Routage MIDI Avancé
- **Routage par Canal** : Assignez chaque canal MIDI (1-16) à un périphérique différent
- **Filtrage** : Filtrez les types de messages (notes, CC, pitch bend, etc.)
- **Mapping de Canaux** : Redirigez un canal source vers un canal destination différent
- **Latence par Périphérique** : Compensation individuelle de 0 à 500ms par canal
- **Presets** : Sauvegardez et chargez des configurations de routage

### 🌐 Interface Web Moderne
- **Responsive** : Fonctionne sur PC, tablette, smartphone
- **Temps Réel** : Mise à jour instantanée via WebSocket
- **Drag & Drop** : Glissez-déposez vos fichiers MIDI
- **Console de Debug** : Logs en temps réel pour le diagnostic
- **Commandes Clavier** : Raccourcis pour lecture, pause, stop

### 🔧 Fonctionnalités Système
- **Base de Données SQLite** : Stockage des configurations, presets, historique
- **Sessions** : Sauvegarde complète de l'état de l'application
- **Backup/Restore** : Sauvegarde automatique des données
- **API WebSocket** : 87+ commandes pour intégration personnalisée
- **Logging** : Système de logs rotatifs pour monitoring

---

## ✨ Features Détaillées

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

## 🚀 Installation sur Raspberry Pi

### 📋 Prérequis

- **Matériel** : Raspberry Pi 3B+ ou 4 (recommandé)
- **RAM** : Minimum 2GB (4GB recommandé)
- **OS** : Raspberry Pi OS Lite (64-bit) ou Raspberry Pi OS Desktop
- **Stockage** : Carte SD 8GB minimum
- **Réseau** : Connexion Ethernet ou WiFi

### 🎯 Installation Automatique (Recommandée)

**Option 1 : Installation complète avec une seule commande**

```bash
# Cloner le repository
git clone https://github.com/glloq/Ma-est-tro.git
cd Ma-est-tro

# Rendre le script exécutable
chmod +x scripts/Install.sh

# Lancer l'installation
./scripts/Install.sh
```

Le script d'installation va automatiquement :
- ✅ Mettre à jour le système (`apt-get update`)
- ✅ Installer les dépendances système (ALSA, Bluetooth, build tools)
- ✅ Installer Node.js 18 LTS
- ✅ Installer PM2 (gestionnaire de processus)
- ✅ Installer les dépendances npm
- ✅ Créer les dossiers nécessaires (data, logs, uploads, backups)
- ✅ Initialiser la base de données SQLite
- ✅ Créer le fichier de configuration
- ✅ Configurer les permissions Bluetooth
- ✅ Configurer systemd pour démarrage automatique
- ✅ Afficher l'IP locale pour accéder à l'interface web

### ⚙️ Installation Manuelle (Détails des Commandes)

Si vous préférez installer manuellement, voici les commandes exactes :

**Étape 1 : Mise à jour du système**
```bash
sudo apt-get update
sudo apt-get upgrade -y
```

**Étape 2 : Installation des dépendances système**
```bash
sudo apt-get install -y \
  libasound2-dev \
  bluetooth \
  bluez \
  libbluetooth-dev \
  build-essential \
  git \
  curl \
  python3 \
  sqlite3
```

**Étape 3 : Installation de Node.js 18 LTS**
```bash
# Télécharger et installer Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Vérifier l'installation
node --version  # Doit afficher v18.x.x
npm --version   # Doit afficher 9.x.x ou supérieur
```

**Étape 4 : Installation de PM2 (gestionnaire de processus)**
```bash
sudo npm install -g pm2
pm2 --version
```

**Étape 5 : Cloner et installer le projet**
```bash
# Cloner le repository
cd ~
git clone https://github.com/glloq/Ma-est-tro.git
cd Ma-est-tro

# Installer les dépendances npm
npm install

# Créer les dossiers nécessaires
mkdir -p data logs uploads backups public/uploads examples
```

**Étape 6 : Initialiser la base de données**
```bash
npm run migrate
```

**Étape 7 : Configuration Bluetooth (pour MIDI BLE)**
```bash
# Activer le service Bluetooth
sudo systemctl enable bluetooth
sudo systemctl start bluetooth

# Ajouter l'utilisateur au groupe bluetooth
sudo usermod -a -G bluetooth $USER

# Définir les permissions pour Node.js
sudo setcap cap_net_raw+eip $(eval readlink -f `which node`)

# Débloquer le Bluetooth
sudo rfkill unblock bluetooth

# Redémarrer pour appliquer les changements de groupe
# (ou exécuter : newgrp bluetooth)
```

**Étape 8 : Configuration du démarrage automatique**

**Option A : Avec systemd (recommandé pour Raspberry Pi)**
```bash
# Créer le service systemd
sudo nano /etc/systemd/system/midimind.service
```

Coller le contenu suivant :
```ini
[Unit]
Description=MidiMind 5.0 MIDI Orchestration System
After=network.target

[Service]
Type=simple
User=pi
WorkingDirectory=/home/pi/Ma-est-tro
ExecStart=/usr/bin/node /home/pi/Ma-est-tro/server.js
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=midimind
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

Puis activer et démarrer le service :
```bash
# Recharger systemd
sudo systemctl daemon-reload

# Activer le démarrage automatique
sudo systemctl enable midimind

# Démarrer le service
sudo systemctl start midimind

# Vérifier le statut
sudo systemctl status midimind

# Voir les logs
sudo journalctl -u midimind -f
```

**Option B : Avec PM2**
```bash
# Démarrer l'application
pm2 start ecosystem.config.cjs

# Sauvegarder la configuration
pm2 save

# Configurer le démarrage automatique
pm2 startup
# Exécuter la commande affichée par PM2

# Vérifier
pm2 list
pm2 logs midimind
```

### 🎮 Démarrage de l'Application

**Démarrage manuel (développement)**
```bash
# Mode développement (avec rechargement automatique)
npm run dev

# Mode production
npm start
```

**Avec PM2 (recommandé)**
```bash
# Démarrer
npm run pm2:start

# Voir les logs
npm run pm2:logs

# Arrêter
npm run pm2:stop

# Redémarrer
npm run pm2:restart

# Statut
npm run pm2:status
```

**Avec systemd (si configuré)**
```bash
# Démarrer
sudo systemctl start midimind

# Arrêter
sudo systemctl stop midimind

# Redémarrer
sudo systemctl restart midimind

# Statut
sudo systemctl status midimind

# Logs en temps réel
sudo journalctl -u midimind -f
```

### 🌐 Accès à l'Interface Web

**En local sur le Raspberry Pi**
```
http://localhost:8080
```

**Depuis un autre appareil sur le réseau**
```
http://<IP-du-Raspberry-Pi>:8080
```

Pour connaître l'IP de votre Raspberry Pi :
```bash
hostname -I
```

Exemple : `http://192.168.1.100:8080`

### 🔄 Mise à jour depuis GitHub

Pour récupérer les dernières modifications :

```bash
cd ~/Ma-est-tro
./scripts/update.sh
```

Le script de mise à jour va :
- ✅ Récupérer les dernières modifications (`git pull`)
- ✅ Mettre à jour les dépendances npm (si nécessaire)
- ✅ Exécuter les migrations de base de données
- ✅ Redémarrer automatiquement le serveur
- ✅ Vérifier que la mise à jour s'est bien déroulée

### 📱 Commandes Utiles Raspberry Pi

**Vérifier l'état du système**
```bash
# Température du CPU
vcgencmd measure_temp

# Utilisation mémoire
free -h

# Espace disque
df -h

# Processus Node.js
ps aux | grep node
```

**Gérer les périphériques MIDI**
```bash
# Lister les périphériques MIDI USB
aconnect -l

# Lister les périphériques ALSA
amidi -l

# Tester un périphérique MIDI
amidi -p hw:1,0 -d
```

**Gérer le Bluetooth**
```bash
# Statut Bluetooth
sudo systemctl status bluetooth

# Scanner les périphériques Bluetooth
bluetoothctl scan on

# Vérifier l'adaptateur Bluetooth
hciconfig -a
```

**Logs et Diagnostic**
```bash
# Logs du système
sudo journalctl -xe

# Logs MidiMind (systemd)
sudo journalctl -u midimind -n 100

# Logs PM2
pm2 logs midimind --lines 100

# Logs de l'application
tail -f logs/midimind.log
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
