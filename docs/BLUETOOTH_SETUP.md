# Bluetooth BLE MIDI Setup Guide

Ce guide explique comment configurer les permissions Bluetooth nécessaires pour utiliser les instruments MIDI via Bluetooth Low Energy (BLE) sur Raspberry Pi et Linux.

## 📋 Prérequis

- Raspberry Pi ou système Linux avec Bluetooth
- Node.js 18+ installé
- Adaptateur Bluetooth fonctionnel (intégré sur Raspberry Pi 3/4/5)

## 🚀 Installation Automatique

Le script d'installation principal configure automatiquement Bluetooth :

```bash
./scripts/Install.sh
```

## 🔧 Configuration Manuelle (si nécessaire)

Si vous avez déjà installé MidiMind et devez configurer Bluetooth séparément :

```bash
./scripts/setup-bluetooth.sh
```

## 📝 Ce que fait le script

Le script de configuration Bluetooth effectue les opérations suivantes :

### 1. Installation des packages Bluetooth

```bash
sudo apt-get install -y bluetooth bluez libbluetooth-dev
```

- **bluetooth** : Service Bluetooth principal
- **bluez** : Stack Bluetooth officiel Linux
- **libbluetooth-dev** : Bibliothèques de développement

### 2. Activation du service Bluetooth

```bash
sudo systemctl enable bluetooth
sudo systemctl start bluetooth
```

### 3. Ajout de l'utilisateur au groupe bluetooth

```bash
sudo usermod -a -G bluetooth $USER
```

⚠️ **Important** : Après cette commande, vous devez :
- Se déconnecter et se reconnecter, OU
- Exécuter `newgrp bluetooth` dans votre terminal

### 4. Configuration des capacités Node.js

```bash
sudo setcap cap_net_raw+eip $(which node)
```

Cette commande permet à Node.js d'accéder aux sockets Bluetooth sans être root.

**Pourquoi ?** Le package Noble (utilisé pour BLE MIDI) nécessite un accès direct aux sockets réseau bruts.

### 5. Création de la règle udev

Fichier : `/etc/udev/rules.d/99-bluetooth.rules`

```bash
KERNEL=="hci0", RUN+="/bin/hciconfig hci0 up"
```

Cette règle garantit que l'adaptateur Bluetooth est automatiquement activé au démarrage.

### 6. Configuration sudoers pour le contrôle Bluetooth

Fichier : `/etc/sudoers.d/bluetooth-hciconfig`

```bash
# Allow user to control Bluetooth adapter without password
user ALL=(ALL) NOPASSWD: /usr/bin/hciconfig hci0 up
user ALL=(ALL) NOPASSWD: /usr/bin/hciconfig hci0 down
```

**Pourquoi ?** Cette configuration permet au serveur MidiMind d'activer/désactiver le Bluetooth via le bouton dans l'interface web sans demander de mot de passe.

**Sécurité** : Seules les commandes `hciconfig hci0 up` et `hciconfig hci0 down` sont autorisées sans mot de passe. Aucun autre accès sudo n'est accordé.

## ✅ Vérification

### 1. Vérifier le service Bluetooth

```bash
sudo systemctl status bluetooth
```

Sortie attendue : `active (running)`

### 2. Vérifier l'adaptateur Bluetooth

```bash
hciconfig hci0
```

Sortie attendue : devrait contenir `UP RUNNING`

### 3. Vérifier les groupes de l'utilisateur

```bash
groups $USER
```

Sortie attendue : devrait contenir `bluetooth`

### 4. Vérifier les capacités Node.js

```bash
getcap $(which node)
```

Sortie attendue : `cap_net_raw+eip`

### 5. Vérifier les permissions sudoers

```bash
sudo -l | grep hciconfig
```

Sortie attendue :
```
NOPASSWD: /usr/bin/hciconfig hci0 up
NOPASSWD: /usr/bin/hciconfig hci0 down
```

### 6. Tester l'activation Bluetooth sans mot de passe

```bash
sudo hciconfig hci0 up
```

Devrait s'exécuter **sans demander de mot de passe**.

### 7. Scanner les périphériques BLE (test)

```bash
sudo hcitool lescan
```

Devrait afficher les périphériques BLE à proximité.

## 🎹 Utilisation dans MidiMind

1. **Démarrer MidiMind** :
   ```bash
   npm start
   ```

2. **Ouvrir l'interface web** :
   ```
   http://localhost:8080
   ```

3. **Scanner les instruments Bluetooth** :
   - Cliquer sur le bouton "📡 Scan Bluetooth"
   - La modal affiche les périphériques BLE MIDI trouvés
   - Cliquer sur "Connecter" pour un périphérique

4. **Vérifier les logs** :
   ```bash
   tail -f logs/midimind.log
   ```

## 🐛 Dépannage

### Erreur : "Bluetooth is poweredOff"

**Cause** : L'adaptateur Bluetooth est désactivé.

**Solution** :
```bash
sudo hciconfig hci0 up
sudo systemctl restart bluetooth
```

### Erreur : "Cannot open HCI socket: Operation not permitted"

**Cause** : Permissions insuffisantes ou capacités Node.js non définies.

**Solution** :
```bash
# Réappliquer les capacités
sudo setcap cap_net_raw+eip $(which node)

# Vérifier
getcap $(which node)
```

### Erreur : "noble warning: adapter state unauthorized"

**Cause** : L'utilisateur n'est pas dans le groupe bluetooth.

**Solution** :
```bash
sudo usermod -a -G bluetooth $USER
newgrp bluetooth  # ou déconnexion/reconnexion
```

### Le scan ne trouve aucun périphérique

**Vérifications** :
1. L'instrument BLE MIDI est-il allumé et en mode appairage ?
2. L'adaptateur Bluetooth fonctionne-t-il ?
   ```bash
   hciconfig hci0
   sudo hcitool lescan
   ```
3. Le périphérique est-il déjà connecté à un autre appareil ?

### Erreur : "Adapter not found"

**Cause** : Pas d'adaptateur Bluetooth détecté.

**Solution** :
```bash
# Vérifier la présence de l'adaptateur
hciconfig

# Si vide, vérifier le matériel
lsusb | grep -i bluetooth
dmesg | grep -i bluetooth
```

## 🔒 Sécurité

### Pourquoi cap_net_raw est sûr ?

La capacité `cap_net_raw` permet à Node.js de :
- Créer des sockets réseau bruts
- Scanner les périphériques BLE
- Communiquer avec les périphériques MIDI via Bluetooth

**Limites** :
- Uniquement pour le processus Node.js
- Ne donne pas accès root complet
- Spécifique au binaire Node.js

### Alternative : Exécuter en tant que root (NON RECOMMANDÉ)

Si les capacités ne fonctionnent pas :

```bash
sudo npm start
```

⚠️ **Attention** : Exécuter en tant que root présente des risques de sécurité. Utilisez cette méthode uniquement pour le débogage.

## 📚 Ressources

- [Noble Documentation](https://github.com/abandonware/noble)
- [BlueZ Official Site](http://www.bluez.org/)
- [BLE MIDI Specification](https://www.midi.org/specifications/midi-transports-specifications/bluetooth-le-midi)
- [Linux Bluetooth Wiki](https://wiki.archlinux.org/title/Bluetooth)

## 🆘 Support

Si vous rencontrez des problèmes :

1. Vérifiez les logs : `logs/midimind.log`
2. Exécutez le script de diagnostic : `./scripts/setup-bluetooth.sh`
3. Consultez la section Dépannage ci-dessus
4. Ouvrez une issue sur GitHub avec les détails

## 📋 Checklist de configuration

- [ ] Packages Bluetooth installés (bluez, bluetooth, libbluetooth-dev)
- [ ] Service Bluetooth actif (systemctl status bluetooth)
- [ ] Utilisateur ajouté au groupe bluetooth
- [ ] Session rechargée (logout/login ou newgrp bluetooth)
- [ ] Capacités Node.js configurées (cap_net_raw+eip)
- [ ] Règle udev créée (/etc/udev/rules.d/99-bluetooth.rules)
- [ ] **Sudoers configuré** (/etc/sudoers.d/bluetooth-hciconfig)
- [ ] **Test sudo sans mot de passe réussi** (sudo hciconfig hci0 up)
- [ ] Adaptateur Bluetooth UP (hciconfig hci0)
- [ ] Test de scan réussi (sudo hcitool lescan)

Une fois tous les éléments cochés, MidiMind devrait pouvoir scanner et connecter des instruments BLE MIDI ! 🎵

**Note importante** : Si le bouton "Activer le Bluetooth" dans l'interface ne fonctionne pas, vérifiez en priorité la configuration sudoers (point 7 de la checklist).
