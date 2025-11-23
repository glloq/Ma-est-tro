# Configuration MIDI Réseau (RTP-MIDI)

## Vue d'ensemble

MidiMind 5.0 supporte maintenant le MIDI via réseau WiFi/Ethernet en utilisant le protocole **RTP-MIDI** (RFC 6295), également connu sous le nom d'Apple Network MIDI.

Cette fonctionnalité permet de :
- ✅ Connecter des instruments MIDI via WiFi/Ethernet
- ✅ Envoyer et recevoir des messages MIDI à travers le réseau
- ✅ Utiliser des devices réseau comme n'importe quel autre instrument MIDI
- ✅ Faible latence (~5-20ms sur LAN)

---

## Prérequis

### Côté MidiMind (Raspberry Pi)

- Raspberry Pi connecté au réseau WiFi/Ethernet
- MidiMind 5.0 installé et configuré
- Port UDP 5004 ouvert (RTP-MIDI)

### Côté Instrument/Client

Selon votre plateforme :

#### macOS / iOS
- ✅ Support natif RTP-MIDI (Audio MIDI Setup)
- ✅ Découverte automatique via Bonjour/mDNS
- ✅ Aucun logiciel supplémentaire requis

#### Windows
- ⚠️ Nécessite un driver tiers : **rtpMIDI** by Tobias Erichsen
- 📥 Télécharger : https://www.tobias-erichsen.de/software/rtpmidi.html
- ✅ Gratuit et open-source

#### Linux
- ⚠️ Nécessite configuration manuelle
- 📦 Packages requis : `avahi-daemon`, `avahi-utils`
- 🔧 Peut utiliser `rtpmidid` ou implémentation custom

#### Android / iOS (Apps)
- 📱 Apps compatibles RTP-MIDI disponibles sur les stores
- Exemples : TouchOSC, MIDI Designer, TB MIDI Stuff

---

## Configuration par Plateforme

### macOS - Configuration Native

**1. Ouvrir Audio MIDI Setup**
```bash
# Depuis Spotlight
Cmd + Space → "Audio MIDI Setup"
# Ou depuis Applications
/Applications/Utilities/Audio MIDI Setup.app
```

**2. Ouvrir la fenêtre MIDI Network Setup**
- Menu : `Window` → `Show MIDI Network Setup`
- Ou raccourci : `Cmd + 2`

**3. Créer une nouvelle session**
- Cliquer sur `+` pour ajouter une session
- Nom : `MidiMind` (ou votre choix)
- Port : `5004` (par défaut)
- Activer : `Enable`

**4. Se connecter à MidiMind**
- Dans la section "Directory", MidiMind devrait apparaître automatiquement
- Sélectionner `MidiMind` et cliquer `Connect`
- Status devrait passer à "Connected"

**5. Vérifier la connexion**
```bash
# Terminal - vérifier que le port est ouvert
netstat -an | grep 5004
```

### Windows - Avec rtpMIDI

**1. Installer rtpMIDI**
- Télécharger depuis https://www.tobias-erichsen.de/software/rtpmidi.html
- Installer l'application
- Lancer `rtpMIDI.exe`

**2. Créer une session**
- Dans rtpMIDI, section "My sessions"
- Cliquer `+` pour nouvelle session
- Nom : `MidiMind`
- Port : `5004`
- Enabled : ✅

**3. Se connecter à MidiMind**
- Section "Directory" : Attendre découverte automatique
- Si MidiMind n'apparaît pas automatiquement :
  - Cliquer `Add contact` (bouton `+`)
  - Nom : `MidiMind`
  - IP : `[IP de votre Raspberry Pi]`
  - Port : `5004`
- Double-cliquer sur MidiMind pour connecter
- Status : "Connected" ✅

**4. Configurer dans votre DAW**
- Dans Ableton/FL Studio/Reaper/etc.
- Préférences MIDI
- Activer "Network-MidiMind" comme périphérique MIDI

### Linux - Configuration Manuelle

**1. Installer Avahi (mDNS)**
```bash
sudo apt-get update
sudo apt-get install avahi-daemon avahi-utils
sudo systemctl start avahi-daemon
sudo systemctl enable avahi-daemon
```

**2. Vérifier la découverte mDNS**
```bash
# Scanner les services MIDI sur le réseau
avahi-browse -a -t -r | grep -i midi
```

**3. Option A : Utiliser rtpmidid**
```bash
# Installer rtpmidid
sudo apt-get install rtpmidid

# Lancer rtpmidid
rtpmidid &

# Se connecter à MidiMind
rtpmidid -c [IP_RASPBERRY_PI]:5004
```

**4. Option B : Connexion manuelle (avec MidiMind)**
- Utiliser l'interface web de MidiMind
- Scanner le réseau
- Connecter manuellement à l'IP du client Linux

### iOS/Android - Apps Tierces

**Apps Recommandées iOS** :
- **TouchOSC** : Contrôleur MIDI + OSC avec support RTP-MIDI
- **MIDI Designer** : Créer interfaces MIDI custom
- **TB MIDI Stuff** : Tools MIDI complets

**Apps Recommandées Android** :
- **RTP MIDI** by mobileer
- **MIDI BLE Connect**

---

## Utilisation dans MidiMind

### Via l'Interface Web

**1. Scanner le réseau**
```
Interface Web → Devices → Network → Scan
```

**2. Connecter un device**
- Sélectionner le device découvert dans la liste
- Cliquer "Connect"
- Status : Connected ✅

**3. Utiliser le device**
- Le device apparaît dans la liste unifiée des instruments
- Utilisable comme n'importe quel autre instrument :
  - Piano virtuel
  - Routage MIDI
  - Playback de fichiers MIDI
  - Live performance

### Via l'API WebSocket

**Scanner le réseau**
```javascript
{
  "command": "network_scan",
  "data": {
    "timeout": 5  // secondes
  }
}
```

**Connecter un device**
```javascript
{
  "command": "network_connect",
  "data": {
    "ip": "192.168.1.100",
    "port": "5004"
  }
}
```

**Envoyer un message MIDI**
```javascript
{
  "command": "midi_send_note",
  "data": {
    "device": "192.168.1.100",  // IP ou nom
    "channel": 0,
    "note": 60,    // C4
    "velocity": 127,
    "duration": 500  // ms
  }
}
```

**Déconnecter**
```javascript
{
  "command": "network_disconnect",
  "data": {
    "ip": "192.168.1.100"
  }
}
```

---

## Dépannage

### Device non découvert

**Problème** : Le device n'apparaît pas dans le scan

**Solutions** :
1. Vérifier que les deux devices sont sur le même réseau
```bash
# Sur Raspberry Pi
ip addr show

# Devrait afficher une IP dans le même sous-réseau que le client
```

2. Vérifier le firewall
```bash
# Sur Raspberry Pi - ouvrir port 5004
sudo ufw allow 5004/udp

# Sur macOS
# Préférences Système → Sécurité → Firewall → Options
# Autoriser "Audio MIDI Setup" ou "MidiMind"
```

3. Vérifier Avahi/mDNS
```bash
# Sur Raspberry Pi
sudo systemctl status avahi-daemon

# Si non actif
sudo systemctl start avahi-daemon
```

4. Connexion manuelle
- Utiliser l'IP directement au lieu de la découverte automatique
- Dans l'interface web : Network → Connect → Saisir IP manuellement

### Latence élevée

**Problème** : Latence > 50ms ou messages retardés

**Solutions** :
1. Vérifier la qualité du réseau WiFi
```bash
# Ping test
ping -c 10 [IP_DU_DEVICE]

# Devrait être < 10ms sur LAN
```

2. Utiliser Ethernet au lieu de WiFi si possible

3. Configurer la compensation de latence
```
Interface Web → Settings → Latency Compensation
Mesurer la latence → Appliquer compensation
```

4. Optimiser le réseau
- Utiliser WiFi 5GHz au lieu de 2.4GHz
- Réduire la distance au routeur
- Éviter les interférences (micro-ondes, etc.)

### Messages MIDI perdus

**Problème** : Notes manquantes, événements CC perdus

**Solutions** :
1. Vérifier la congestion réseau
```bash
# Sur Raspberry Pi
iftop -i wlan0  # ou eth0
```

2. Vérifier les logs MidiMind
```
Interface Web → System → Logs
Rechercher : "RTP-MIDI" ou "Network"
```

3. Redémarrer la session
```
Network → Disconnect → Reconnect
```

### Connexion instable

**Problème** : Déconnexions fréquentes

**Solutions** :
1. Vérifier stabilité réseau WiFi
```bash
# Sur Raspberry Pi - monitorer WiFi
watch -n 1 'iwconfig wlan0 | grep Quality'
```

2. Utiliser IP statique
```bash
# Éditer /etc/dhcpcd.conf
sudo nano /etc/dhcpcd.conf

# Ajouter :
interface wlan0
static ip_address=192.168.1.50/24
static routers=192.168.1.1
static domain_name_servers=192.168.1.1
```

3. Désactiver power management WiFi
```bash
sudo iwconfig wlan0 power off
```

---

## Optimisations

### Performance Réseau

**1. Utiliser QoS (Quality of Service)**
```bash
# Sur le routeur (si supporté)
# Prioriser le trafic UDP port 5004
```

**2. Réduire MTU si nécessaire**
```bash
# Sur Raspberry Pi
sudo ifconfig wlan0 mtu 1400
```

**3. Activer multicast**
```bash
# Vérifier support multicast
ip maddress show
```

### Sécurité

**1. Firewall - Autoriser seulement réseau local**
```bash
# Sur Raspberry Pi
sudo ufw allow from 192.168.1.0/24 to any port 5004
```

**2. VPN pour accès distant**
- Ne PAS exposer le port 5004 sur Internet public
- Utiliser VPN (WireGuard, OpenVPN) pour accès distant sécurisé

---

## Comparaison des Protocoles

| Caractéristique | USB MIDI | Bluetooth MIDI | Network MIDI (RTP) |
|-----------------|----------|----------------|---------------------|
| **Latence** | < 1ms | 5-15ms | 5-20ms |
| **Portée** | 5m (câble) | 10m | Infinie (réseau) |
| **Stabilité** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| **Setup** | Plug & Play | Pairing | Configuration |
| **Multi-device** | Limité | Limité | ✅ Excellent |
| **Mobilité** | ❌ Câble | ✅ Sans fil | ✅ Sans fil |
| **Coût** | Gratuit | Gratuit | Gratuit |

---

## Cas d'Usage

### 1. Studio Multi-Room
```
[Studio A] - MacBook Pro (Ableton)
    ↓ WiFi
[MidiMind] - Raspberry Pi
    ↓ USB
[Studio B] - Synthés & Modules
```

### 2. Live Performance
```
[Scène] - iPad (TouchOSC)
    ↓ WiFi
[MidiMind] - Raspberry Pi
    ↓ MIDI Out
[Instruments sur scène]
```

### 3. Orchestration à Distance
```
[Compositeur] - Ordinateur principal
    ↓ Réseau local
[MidiMind 1, 2, 3] - Plusieurs Raspberry Pi
    ↓ USB/MIDI
[Différents instruments]
```

---

## Ressources

### Documentation Officielle
- [RFC 6295 - RTP Payload Format for MIDI](https://datatracker.ietf.org/doc/html/rfc6295)
- [Apple Network MIDI Protocol](https://developer.apple.com/documentation/coremidi)

### Logiciels
- [rtpMIDI (Windows)](https://www.tobias-erichsen.de/software/rtpmidi.html)
- [rtpmidid (Linux)](https://github.com/davidmoreno/rtpmidid)

### Articles
- [Understanding RTP-MIDI](https://www.midi.org/articles/rtp-midi)
- [Network MIDI Best Practices](https://www.soundonsound.com/techniques/network-midi)

---

**Auteur** : MidiMind Team
**Version** : 1.0
**Dernière mise à jour** : 2025-11-23
