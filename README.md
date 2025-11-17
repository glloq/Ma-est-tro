# 🎹 MidiMind 5.0

> **Système complet d'orchestration MIDI pour Raspberry Pi avec interface web moderne**

Gérez vos appareils MIDI, routez les canaux, éditez les fichiers MIDI et jouez avec compensation de latence - le tout depuis un navigateur web.

[![Node.js](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org/)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Raspberry Pi](https://img.shields.io/badge/Raspberry%20Pi-3B%2B%2F4-red)](https://www.raspberrypi.org/)

---

## 🎯 Capacités de l'Application

MidiMind 5.0 est un système de gestion MIDI pour Raspberry Pi avec interface web moderne.

### 🎹 Gestion des Périphériques MIDI
- **Scan USB** : Détection des périphériques MIDI connectés en USB
- **Scan Bluetooth** : Découverte et connexion de périphériques MIDI BLE
- **Scan Réseau** : Découverte de périphériques RTP-MIDI sur le réseau local
- **Affichage en Temps Réel** : Liste des périphériques disponibles avec leur statut
- **Clavier MIDI Virtuel** : Clavier jouable directement dans le navigateur pour tester les périphériques

### 📁 Gestion des Fichiers MIDI
- **Upload de Fichiers** : Envoi de fichiers .mid et .midi depuis votre ordinateur
- **Organisation en Dossiers** : Créez des dossiers pour organiser vos fichiers
- **Drag & Drop** : Déplacez les fichiers entre dossiers par glisser-déposer
- **Suppression** : Supprimez fichiers et dossiers avec confirmation
- **Éditeur Piano Roll** : Visualisez et éditez vos fichiers MIDI avec un éditeur graphique
  - Visualisation des notes par canal avec coloration
  - Zoom et défilement
  - Édition des notes (ajout, déplacement, suppression)

### 🎵 Lecture de Fichiers MIDI
- **Contrôles de Lecture** : Play, Pause, Stop depuis l'interface
- **Barre de Progression** : Visualisez la position de lecture en temps réel
- **Affichage du Temps** : Position actuelle et durée totale
- **Routage par Canal** : Assignez chaque canal MIDI (1-16) à un périphérique différent
  - Configuration sauvegardée par fichier
  - Sélection du périphérique de sortie pour chaque canal
  - Indicateur visuel des canaux routés

### 🌐 Interface Web
- **Responsive** : Interface adaptée pour PC, tablette et smartphone
- **Temps Réel** : Communication WebSocket pour mises à jour instantanées
- **Drag & Drop** : Glissez-déposez vos fichiers MIDI pour les uploader
- **Console de Debug** : Logs en temps réel pour diagnostic (bouton 🐞)
- **Design Moderne** : Interface colorée et intuitive

### 🔧 Fonctionnalités Techniques
- **Base de Données SQLite** : Stockage local des fichiers et configurations
- **API WebSocket** : Architecture client-serveur avec 95+ commandes backend
- **Logging** : Système de logs pour monitoring et debug

---

## 💡 Fonctionnalités Avancées (API Backend)

L'API backend supporte des fonctionnalités additionnelles accessibles via WebSocket :

- **Contrôle de Tempo** : Modification du tempo de lecture (commandes API)
- **Transposition** : Transposition des notes (commandes API)
- **Mode Boucle** : Lecture en boucle (commandes API)
- **Compensation de Latence** : Réglage fin par périphérique (commandes API)
- **Sessions** : Sauvegarde/chargement de l'état complet (commandes API)
- **Presets** : Configurations de routage réutilisables (commandes API)
- **Playlists** : Files d'attente de lecture (commandes API)

> **Note** : Ces fonctionnalités sont disponibles via l'API WebSocket (95+ commandes) mais ne sont pas encore intégrées dans l'interface web. Elles peuvent être utilisées en développant une interface personnalisée ou en envoyant des commandes directement via WebSocket.

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

## 📖 Guide d'Utilisation

### 1️⃣ Scanner les Périphériques MIDI

1. Cliquez sur **"🔌 Scan USB"** pour détecter les périphériques USB
2. Cliquez sur **"📡 Scan Bluetooth"** pour rechercher des périphériques BLE
3. Cliquez sur **"🌐 Scan Réseau"** pour découvrir les périphériques RTP-MIDI
4. Les périphériques trouvés s'affichent dans la liste **"Périphériques MIDI"**

### 2️⃣ Uploader des Fichiers MIDI

1. Cliquez sur **"📁 Fichiers MIDI"**
2. Cliquez sur le bouton **"📤 Envoyer"** ou glissez-déposez vos fichiers `.mid` / `.midi`
3. Créez des dossiers avec **"📁 Nouveau dossier"**
4. Organisez vos fichiers par glisser-déposer entre dossiers

### 3️⃣ Éditer un Fichier MIDI

1. Cliquez sur l'icône **"✏️ Éditer"** à côté d'un fichier
2. L'éditeur Piano Roll s'ouvre avec :
   - Visualisation des notes par canal (colorées)
   - Zoom : molette de la souris
   - Édition : ajout, déplacement, suppression de notes
3. Cliquez sur **"💾 Sauvegarder"** pour enregistrer vos modifications

### 4️⃣ Configurer le Routage par Canal

1. Cliquez sur l'icône **"🔀 Router"** à côté d'un fichier
2. Pour chaque canal MIDI (1-16), sélectionnez le périphérique de sortie
3. Cliquez sur **"💾 Sauvegarder le routage"**
4. La configuration est sauvegardée pour ce fichier

### 5️⃣ Jouer un Fichier MIDI

1. Cliquez sur **"▶️ Jouer"** à côté d'un fichier
2. Les contrôles de lecture s'affichent en haut :
   - **▶️ Lecture** : Lire/Pauser
   - **⏹️ Stop** : Arrêter la lecture
   - Barre de progression avec temps écoulé / durée totale
3. Les notes sont envoyées vers les périphériques configurés

### 6️⃣ Utiliser le Clavier MIDI Virtuel

1. Cliquez sur le bouton **"🎹"** en haut à gauche
2. Jouez des notes avec la souris ou le clavier de l'ordinateur
3. Testez vos périphériques MIDI connectés

### 7️⃣ Console de Debug

1. Cliquez sur le bouton **"🐞"** en haut à droite
2. Visualisez les logs en temps réel :
   - Messages d'information (bleu)
   - Avertissements (orange)
   - Erreurs (rouge)
3. Utile pour diagnostiquer les problèmes de connexion

---

## 🧪 Tests et Exemples

### Test de l'Interface

Accédez à l'application :
```
http://<IP-Raspberry-Pi>:8080
```

Fonctionnalités testables :
- ✅ Upload de fichiers MIDI
- ✅ Scan de périphériques (USB, Bluetooth, Réseau)
- ✅ Édition avec Piano Roll
- ✅ Routage par canal
- ✅ Lecture MIDI
- ✅ Clavier virtuel
- ✅ Organisation en dossiers

### Exemples et Documentation

Consultez les fichiers de documentation pour plus de détails :
- `TESTING.md` : Guide de test détaillé
- `INTEGRATION_GUIDE.md` : Guide d'architecture et d'intégration
- `examples/` : Exemples de code

---

## 📚 Documentation

| Document | Description |
|----------|-------------|
| [QUICK_START.md](./QUICK_START.md) | Quick start guide with code examples |
| [INTEGRATION_GUIDE.md](./INTEGRATION_GUIDE.md) | Full architecture and integration guide |
| [FRONTEND_COMPONENTS.md](./FRONTEND_COMPONENTS.md) | UI components documentation |
| [TESTING.md](./TESTING.md) | Complete testing guide with API examples |

---

## 🎯 Exemples d'Utilisation de l'API WebSocket

### Upload et Gestion de Fichiers
```javascript
// Upload d'un fichier MIDI
const response = await api.uploadMidiFile(file, '/');

// Lister les fichiers
const response = await api.sendCommand('file_list', {});

// Supprimer un fichier
await api.sendCommand('file_delete', { fileId: 'file123' });
```

### Scan de Périphériques
```javascript
// Scanner les périphériques USB
const response = await api.sendCommand('device_refresh', {});

// Scanner Bluetooth
await api.sendCommand('ble_scan_start', { duration: 5 });

// Scanner réseau
await api.sendCommand('network_scan', { timeout: 5 });
```

### Lecture MIDI
```javascript
// Démarrer la lecture
await api.sendCommand('playback_start', { fileId: 'file123' });

// Pause
await api.sendCommand('playback_pause', {});

// Stop
await api.sendCommand('playback_stop', {});

// Obtenir les canaux du fichier
const response = await api.sendCommand('playback_get_channels', {});
```

### Routage par Canal
```javascript
// Configurer le routage d'un canal vers un périphérique
await api.sendCommand('playback_set_channel_routing', {
    channel: 0,
    deviceId: 'device-id-123'
});
```

> **Note** : L'API WebSocket supporte 95+ commandes. Consultez `TESTING.md` pour la documentation complète de l'API.

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
│   │   ├── CommandHandler.js  # 95+ commandes WebSocket
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
- **[webaudio-pianoroll](https://github.com/g200kg/webaudio-pianoroll)** - Éditeur Piano Roll visuel (version personnalisée avec coloration par canal)
- **Vanilla JavaScript** - Pas de framework, code léger et rapide

### Backend
- **[easymidi](https://www.npmjs.com/package/easymidi)** - Gestion des périphériques MIDI sous Node.js
- **[ws](https://github.com/websockets/ws)** - Serveur WebSocket pour communication temps réel
- **[better-sqlite3](https://github.com/WiseLibs/better-sqlite3)** - Base de données SQLite locale
- **[@abandonware/noble](https://www.npmjs.com/package/@abandonware/noble)** - Support Bluetooth Low Energy (BLE MIDI)

---

## 🔌 API WebSocket Backend

MidiMind fournit une **API WebSocket complète avec 95+ commandes** réparties en catégories :

| Catégorie | Commandes | Exemples |
|----------|----------|----------|
| **Devices** | ~24 | `device_list`, `device_refresh`, `ble_scan_start`, `network_scan`, `virtual_create` |
| **Routing** | 15 | `route_create`, `channel_map`, `filter_set`, `monitor_start` |
| **Files** | 12 | `file_upload`, `file_load`, `file_save`, `file_delete`, `file_rename` |
| **Playback** | 13 | `playback_start`, `playback_pause`, `playback_stop`, `playback_set_channel_routing` |
| **Latency** | 8 | `latency_set`, `latency_measure`, `latency_auto_calibrate` |
| **MIDI Messages** | 8 | `midi_send_note`, `midi_send_cc`, `midi_panic`, `midi_all_notes_off` |
| **System** | 8 | `system_status`, `system_info`, `system_backup`, `system_logs` |
| **Sessions** | 6 | `session_save`, `session_load`, `session_list`, `session_delete` |
| **Presets** | 6 | `preset_save`, `preset_load`, `preset_list`, `preset_delete` |
| **Playlists** | 4 | `playlist_create`, `playlist_list`, `playlist_add_file` |

> **Note** : Toutes ces commandes sont implémentées dans le backend, mais seules certaines sont utilisées par l'interface web actuelle. Pour utiliser les commandes avancées (tempo, transposition, sessions, presets, etc.), vous devez envoyer des commandes WebSocket directement ou développer votre propre interface.

Référence complète : `src/api/CommandHandler.js`

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
