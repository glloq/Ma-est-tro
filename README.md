# 🎹 MidiMind 5.0

> **Système d'orchestration MIDI pour Raspberry Pi avec interface web moderne**

[![Node.js](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org/)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Raspberry Pi](https://img.shields.io/badge/Raspberry%20Pi-3B%2B%2F4-red)](https://www.raspberrypi.org/)

MidiMind est un système complet de gestion MIDI qui vous permet de gérer vos périphériques MIDI, éditer et jouer des fichiers MIDI avec compensation de latence, le tout depuis une interface web moderne.

---

## ✨ Fonctionnalités

- **Gestion des Périphériques** : Détection USB, Bluetooth (BLE) et Réseau (RTP-MIDI)
- **Fichiers MIDI** : Upload, organisation en dossiers, édition avec Piano Roll
- **Routage par Canal** : Assignez chaque canal MIDI (1-16) à un périphérique différent
- **Lecture Intelligente** : Compensation de latence par instrument pour synchronisation parfaite
- **Clavier Virtuel** : Testez vos périphériques depuis le navigateur
- **Interface Web** : Responsive, temps réel via WebSocket

---

## 🚀 Installation Rapide

### Prérequis
- Raspberry Pi 3B+ ou 4 (2GB RAM minimum, 4GB recommandé)
- Raspberry Pi OS (Lite ou Desktop)
- Connexion réseau (Ethernet ou WiFi)

### Installation Automatique

```bash
# Cloner le repository
git clone https://github.com/glloq/Ma-est-tro.git
cd Ma-est-tro

# Lancer l'installation complète
chmod +x scripts/Install.sh
./scripts/Install.sh
```

Le script installe automatiquement :
- Node.js 18 LTS
- Toutes les dépendances système (ALSA, Bluetooth, build tools)
- PM2 (gestionnaire de processus)
- Base de données SQLite
- Configuration Bluetooth
- Service systemd pour démarrage automatique

### Démarrage

```bash
# Mode développement
npm run dev

# Mode production
npm start

# Avec PM2 (recommandé)
npm run pm2:start
npm run pm2:logs
```

### Accès à l'Interface Web

**En local** : `http://localhost:8080`
**Sur le réseau** : `http://<IP-du-Raspberry-Pi>:8080`

Trouvez votre IP : `hostname -I`

---

## 📖 Guide d'Utilisation

### 1. Scanner les Périphériques MIDI
- Cliquez sur **🔌 Scan USB** pour les périphériques USB
- Cliquez sur **📡 Scan Bluetooth** pour les périphériques BLE
- Cliquez sur **🌐 Scan Réseau** pour les périphériques RTP-MIDI

### 2. Uploader des Fichiers MIDI
- Cliquez sur **📁 Fichiers MIDI** puis **📤 Envoyer**
- Glissez-déposez vos fichiers `.mid` / `.midi`
- Organisez avec des dossiers

### 3. Configurer le Routage
- Cliquez sur **🔀 Router** à côté d'un fichier
- Assignez chaque canal MIDI (1-16) à un périphérique
- Sauvegardez la configuration

### 4. Configurer les Délais de Synchronisation
- Cliquez sur **⚙️ Réglages** à côté d'un périphérique
- Entrez le délai de synchronisation en millisecondes :
  - **Positif** (ex: `80`) pour retarder (Bluetooth)
  - **Négatif** (ex: `-20`) pour avancer
  - **Zéro** (défaut) pour aucune compensation
- Les délais sont appliqués automatiquement lors de la lecture

### 5. Jouer un Fichier
- Cliquez sur **▶️ Jouer** à côté d'un fichier
- Utilisez les contrôles de lecture (Play, Pause, Stop)

### 6. Éditer un Fichier
- Cliquez sur **✏️ Éditer** pour ouvrir le Piano Roll
- Ajoutez, déplacez ou supprimez des notes
- Sauvegardez vos modifications

---

## 🔧 Configuration

Éditez `config.json` pour personnaliser :

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

## 📚 Documentation

| Document | Description |
|----------|-------------|
| [docs/BLUETOOTH_SETUP.md](./docs/BLUETOOTH_SETUP.md) | Configuration Bluetooth BLE MIDI |
| [docs/NETWORK_MIDI_SETUP.md](./docs/NETWORK_MIDI_SETUP.md) | Configuration RTP-MIDI réseau |

---

## 🔄 Mise à Jour

```bash
cd ~/Ma-est-tro
./scripts/update.sh
```

Le script met à jour automatiquement :
- Code source (git pull)
- Dépendances npm
- Migrations de base de données
- Redémarrage du serveur

---

## 🏗️ Architecture

```
┌──────────────────────────────────────────────────────────┐
│                    Interface Web (Browser)                │
├──────────────────────────────────────────────────────────┤
│  WebSocket Client ←→ WebSocket Server (Raspberry Pi)     │
│                             ↕                              │
│                       Backend (Node.js)                    │
│                             ↕                              │
│                   Hardware MIDI Devices                    │
│                   (USB / Bluetooth / Network)              │
└──────────────────────────────────────────────────────────┘
```

**Backend** : Node.js, Express, WebSocket (ws), easymidi, better-sqlite3
**Frontend** : Vanilla JavaScript, Web MIDI API, webaudio-pianoroll

---

## 🔌 API WebSocket

MidiMind fournit une **API WebSocket complète avec 95+ commandes** :

| Catégorie | Exemples |
|----------|----------|
| **Devices** | `device_list`, `device_refresh`, `ble_scan_start`, `network_scan` |
| **Files** | `file_upload`, `file_load`, `file_save`, `file_delete` |
| **Playback** | `playback_start`, `playback_pause`, `playback_stop` |
| **Routing** | `route_create`, `channel_map`, `playback_set_channel_routing` |
| **Latency** | `latency_set`, `latency_measure`, `latency_auto_calibrate` |
| **MIDI** | `midi_send_note`, `midi_send_cc`, `midi_panic` |

Référence complète : `src/api/CommandHandler.js`

---

## 🛠️ Commandes Utiles

### Gestion du Service

**Avec PM2** :
```bash
npm run pm2:start    # Démarrer
npm run pm2:stop     # Arrêter
npm run pm2:restart  # Redémarrer
npm run pm2:logs     # Voir les logs
```

**Avec systemd** :
```bash
sudo systemctl start midimind    # Démarrer
sudo systemctl stop midimind     # Arrêter
sudo systemctl restart midimind  # Redémarrer
sudo systemctl status midimind   # Statut
sudo journalctl -u midimind -f   # Logs en temps réel
```

### Diagnostic MIDI

```bash
# Lister les périphériques MIDI
aconnect -l
amidi -l

# Statut Bluetooth
sudo systemctl status bluetooth

# Logs de l'application
tail -f logs/midimind.log
```

---

## 📦 Structure du Projet

```
Ma-est-tro/
├── scripts/          # Scripts d'installation et mise à jour
├── src/              # Backend (Node.js)
│   ├── api/          # WebSocket, CommandHandler, HttpServer
│   ├── midi/         # DeviceManager, MidiRouter, MidiPlayer
│   ├── storage/      # Database, FileManager
│   └── managers/     # BluetoothManager, NetworkManager
├── public/           # Frontend (Vanilla JS)
│   ├── js/           # Application, Components, API Client
│   └── styles/       # CSS
├── docs/             # Documentation
├── migrations/       # Database migrations
├── data/             # SQLite database (créé au runtime)
└── uploads/          # Fichiers MIDI uploadés
```

---

## 🤝 Contribution

Les contributions sont les bienvenues ! Pour contribuer :

1. Forkez le repository
2. Créez une branche feature
3. Testez vos changements
4. Soumettez une pull request

---

## 📝 Licence

MIT License - voir le fichier [LICENSE](LICENSE)

---

## 🙏 Remerciements

**Bibliothèques** :
- [webaudio-pianoroll](https://github.com/g200kg/webaudio-pianoroll) par g200kg
- [easymidi](https://www.npmjs.com/package/easymidi) par Andrew Kelley
- [ws](https://github.com/websockets/ws) - WebSocket server
- [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) - SQLite database

---

## 📬 Support

- **Documentation** : Voir le dossier `docs/`
- **Issues** : [GitHub Issues](https://github.com/glloq/Ma-est-tro/issues)

---

## 🎵 Happy MIDI Orchestrating! 🎹

Made with ❤️ for the MIDI community
