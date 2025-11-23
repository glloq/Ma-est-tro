#!/bin/bash
# =============================================================================
# MidiMind 5.0 - Complete Installation Script
# Raspberry Pi / Linux / macOS
# =============================================================================

set -e

echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║                                                               ║"
echo "║              🎹 MidiMind 5.0 Installation 🎹                  ║"
echo "║                                                               ║"
echo "║  Complete MIDI orchestration system with modern web UI        ║"
echo "║                                                               ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""

# =============================================================================
# COLORS & FORMATTING
# =============================================================================

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_step() {
    echo ""
    echo -e "${BLUE}▶${NC} $1"
    echo "─────────────────────────────────────────────────────────────────"
}

# =============================================================================
# CHECKS
# =============================================================================

# Check if running as root
if [ "$EUID" -eq 0 ]; then
  print_error "Please do not run this script as root"
  print_info "Run as normal user: ./scripts/Install.sh"
  exit 1
fi

# Detect OS
OS="unknown"
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    OS="linux"
elif [[ "$OSTYPE" == "darwin"* ]]; then
    OS="macos"
fi

print_info "Detected OS: $OS"

# =============================================================================
# SYSTEM DEPENDENCIES
# =============================================================================

print_step "1. Installing System Dependencies"

if [ "$OS" == "linux" ]; then
    print_info "Updating package list..."
    sudo apt-get update -qq

    print_info "Installing system packages..."
    sudo apt-get install -y \
      libasound2-dev \
      bluetooth \
      bluez \
      libbluetooth-dev \
      build-essential \
      git \
      curl \
      python3 \
      sqlite3 \
      > /dev/null 2>&1

    print_success "System packages installed"

elif [ "$OS" == "macos" ]; then
    if ! command -v brew &> /dev/null; then
        print_error "Homebrew not found. Please install: https://brew.sh"
        exit 1
    fi

    print_info "Installing with Homebrew..."
    brew install node sqlite3 > /dev/null 2>&1
    print_success "Homebrew packages installed"
fi

# =============================================================================
# NODE.JS
# =============================================================================

print_step "2. Installing Node.js 18 LTS"

if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    print_success "Node.js already installed: $NODE_VERSION"

    # Check version
    NODE_MAJOR=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_MAJOR" -lt 18 ]; then
        print_warning "Node.js version is too old (< 18). Upgrading..."
        if [ "$OS" == "linux" ]; then
            curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
            sudo apt-get install -y nodejs
        fi
    fi
else
    print_info "Installing Node.js 18 LTS..."
    if [ "$OS" == "linux" ]; then
        curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
        sudo apt-get install -y nodejs
    fi
    print_success "Node.js installed: $(node --version)"
fi

print_info "npm version: $(npm --version)"

# =============================================================================
# PM2 (OPTIONAL)
# =============================================================================

print_step "3. Installing PM2 Process Manager"

if command -v pm2 &> /dev/null; then
    print_success "PM2 already installed: $(pm2 --version)"
else
    print_info "Installing PM2 globally..."
    sudo npm install -g pm2 --silent
    print_success "PM2 installed"
fi

# =============================================================================
# PROJECT SETUP
# =============================================================================

print_step "4. Setting Up Project"

# Create directories
print_info "Creating directories..."
mkdir -p data
mkdir -p logs
mkdir -p uploads
mkdir -p backups
mkdir -p public/uploads
mkdir -p examples

print_success "Directories created"

# Install Node.js dependencies
print_info "Installing Node.js dependencies (this may take a few minutes)..."
npm install --silent
print_success "Dependencies installed"

# =============================================================================
# DATABASE
# =============================================================================

print_step "5. Initializing Database"

if [ -f "data/midimind.db" ]; then
    print_warning "Database already exists, skipping migration"
    print_info "To reset database: rm data/midimind.db && npm run migrate"
else
    print_info "Running database migrations..."
    npm run migrate
    print_success "Database initialized"
fi

# =============================================================================
# CONFIGURATION
# =============================================================================

print_step "6. Configuration"

# Create default config if it doesn't exist
if [ ! -f config.json ]; then
    print_info "Creating default configuration..."
    cat > config.json <<EOF
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
  "database": {
    "path": "./data/midimind.db"
  },
  "logging": {
    "level": "info",
    "file": "./logs/midimind.log"
  },
  "uploads": {
    "maxSize": 10485760,
    "allowedTypes": [".mid", ".midi"]
  }
}
EOF
    print_success "Configuration file created"
else
    print_success "Configuration file exists"
fi

# =============================================================================
# PERMISSIONS
# =============================================================================

print_step "7. Setting Permissions"

chmod +x scripts/*.sh 2>/dev/null || true
chmod 755 data logs uploads backups 2>/dev/null || true

print_success "File permissions set"

# =============================================================================
# BLUETOOTH PERMISSIONS (for BLE MIDI with Noble)
# =============================================================================

if [ "$OS" == "linux" ]; then
    print_step "7b. Configuring Bluetooth Permissions"

    # Enable and start Bluetooth service
    print_info "Enabling Bluetooth service..."
    sudo systemctl enable bluetooth 2>/dev/null || true
    sudo systemctl start bluetooth 2>/dev/null || true

    # Add user to bluetooth group
    print_info "Adding user to bluetooth group..."
    sudo usermod -a -G bluetooth $USER 2>/dev/null || true

    # Set capabilities on Node.js for BLE access without root
    print_info "Setting Node.js capabilities for BLE access..."
    NODE_PATH=$(eval readlink -f $(which node))
    if [ -n "$NODE_PATH" ]; then
        sudo setcap cap_net_raw+eip "$NODE_PATH" || {
            print_warning "Failed to set capabilities on Node.js"
            print_info "BLE MIDI may require running as root or manual capability setup"
        }
    fi

    # Create udev rule for automatic Bluetooth adapter initialization
    print_info "Creating udev rule for Bluetooth adapter..."
    echo 'KERNEL=="hci0", RUN+="/bin/hciconfig hci0 up"' | sudo tee /etc/udev/rules.d/99-bluetooth.rules > /dev/null
    sudo udevadm control --reload-rules 2>/dev/null || true

    # Configure sudoers for hciconfig and rfkill without password
    print_info "Configuring sudoers for Bluetooth control..."
    SUDOERS_FILE="/etc/sudoers.d/bluetooth-hciconfig"
    if [ ! -f "$SUDOERS_FILE" ]; then
        echo "# Allow user to control Bluetooth adapter without password" | sudo tee "$SUDOERS_FILE" > /dev/null
        echo "$USER ALL=(ALL) NOPASSWD: /usr/bin/hciconfig hci0 up" | sudo tee -a "$SUDOERS_FILE" > /dev/null
        echo "$USER ALL=(ALL) NOPASSWD: /usr/bin/hciconfig hci0 down" | sudo tee -a "$SUDOERS_FILE" > /dev/null
        echo "$USER ALL=(ALL) NOPASSWD: /usr/sbin/rfkill unblock bluetooth" | sudo tee -a "$SUDOERS_FILE" > /dev/null
        sudo chmod 0440 "$SUDOERS_FILE"

        # Validate
        if sudo visudo -c -f "$SUDOERS_FILE" > /dev/null 2>&1; then
            print_success "sudoers configured for passwordless Bluetooth control"
        else
            sudo rm -f "$SUDOERS_FILE"
            print_warning "sudoers validation failed"
        fi
    fi

    # Débloquer Bluetooth avec rfkill si bloqué
    print_info "Unblocking Bluetooth with rfkill..."
    sudo rfkill unblock bluetooth 2>/dev/null || true

    print_success "Bluetooth permissions configured"
    print_warning "You may need to logout/login for group changes to take effect"
    print_info "Or run: newgrp bluetooth"
fi

# =============================================================================
# SYSTEMD / PM2 SETUP
# =============================================================================

print_step "8. Configuration du Démarrage Automatique"

if [ "$OS" == "linux" ]; then
    # Sur Linux/Raspberry Pi, on configure automatiquement systemd
    print_info "Configuration de systemd pour le démarrage automatique..."

    SERVICE_FILE="/etc/systemd/system/midimind.service"

    # Détecter le chemin absolu de Node.js
    NODE_PATH=$(which node)
    WORKING_DIR=$(pwd)

    sudo tee $SERVICE_FILE > /dev/null <<EOF
[Unit]
Description=MidiMind 5.0 MIDI Orchestration System
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$WORKING_DIR
ExecStart=$NODE_PATH $WORKING_DIR/server.js
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=midimind

Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF

    # Recharger systemd et activer le service
    sudo systemctl daemon-reload
    sudo systemctl enable midimind

    print_success "Service systemd configuré et activé"
    print_info "Le service MidiMind démarrera automatiquement au boot"

    echo ""
    print_info "Commandes utiles :"
    echo "    ${GREEN}sudo systemctl start midimind${NC}     - Démarrer le service"
    echo "    ${GREEN}sudo systemctl stop midimind${NC}      - Arrêter le service"
    echo "    ${GREEN}sudo systemctl restart midimind${NC}   - Redémarrer le service"
    echo "    ${GREEN}sudo systemctl status midimind${NC}    - Voir le statut"
    echo "    ${GREEN}sudo journalctl -u midimind -f${NC}    - Voir les logs en temps réel"
    echo ""

    # Demander si on veut démarrer le service maintenant
    echo ""
    read -p "Démarrer le service MidiMind maintenant ? (y/n) " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        sudo systemctl start midimind
        sleep 2
        if sudo systemctl is-active --quiet midimind; then
            print_success "Service MidiMind démarré avec succès !"
        else
            print_error "Erreur lors du démarrage du service"
            print_info "Vérifiez les logs avec : sudo journalctl -u midimind -n 50"
        fi
    else
        print_info "Vous pouvez démarrer le service plus tard avec : sudo systemctl start midimind"
    fi

elif [ "$OS" == "macos" ]; then
    # Sur macOS, on propose PM2
    print_warning "Systemd n'est pas disponible sur macOS"
    print_info "Configuration de PM2 pour le démarrage automatique..."

    pm2 delete midimind 2>/dev/null || true
    pm2 start ecosystem.config.cjs
    pm2 save

    print_success "PM2 configuré"
    print_info "Commandes utiles :"
    echo "    ${GREEN}pm2 start midimind${NC}    - Démarrer"
    echo "    ${GREEN}pm2 stop midimind${NC}     - Arrêter"
    echo "    ${GREEN}pm2 restart midimind${NC}  - Redémarrer"
    echo "    ${GREEN}pm2 logs midimind${NC}     - Voir les logs"
    echo ""

    read -p "Configurer PM2 pour démarrer au boot ? (y/n) " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        pm2 startup
        print_info "Exécutez la commande ci-dessus pour terminer la configuration"
    fi
fi

# =============================================================================
# VERIFICATION
# =============================================================================

print_step "9. Verification"

# Check if all critical files exist
CRITICAL_FILES=(
    "package.json"
    "config.json"
    "server.js"
    "public/index.html"
)

ALL_OK=true
for file in "${CRITICAL_FILES[@]}"; do
    if [ -f "$file" ]; then
        print_success "$file exists"
    else
        print_error "$file missing!"
        ALL_OK=false
    fi
done

if [ "$ALL_OK" = true ]; then
    print_success "All critical files present"
else
    print_error "Some files are missing, installation may be incomplete"
    exit 1
fi

# =============================================================================
# NETWORK INFO
# =============================================================================

print_step "10. Network Information"

if [ "$OS" == "linux" ]; then
    LOCAL_IP=$(hostname -I | awk '{print $1}')
elif [ "$OS" == "macos" ]; then
    LOCAL_IP=$(ipconfig getifaddr en0 2>/dev/null || echo "localhost")
fi

print_info "Local IP: $LOCAL_IP"
print_info "HTTP Server: http://$LOCAL_IP:8080"
print_info "WebSocket: ws://$LOCAL_IP:8081"

# =============================================================================
# COMPLETION
# =============================================================================

echo ""
echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║                                                               ║"
echo "║            ✅ Installation Complete! ✅                        ║"
echo "║                                                               ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""

print_success "MidiMind 5.0 est prêt à l'emploi !"
echo ""

if [ "$OS" == "linux" ]; then
    print_info "Gestion du Service :"
    echo "  ${GREEN}sudo systemctl start midimind${NC}     - Démarrer MidiMind"
    echo "  ${GREEN}sudo systemctl stop midimind${NC}      - Arrêter MidiMind"
    echo "  ${GREEN}sudo systemctl status midimind${NC}    - Voir l'état"
    echo "  ${GREEN}sudo journalctl -u midimind -f${NC}    - Voir les logs"
    echo ""
    print_info "Le service démarre automatiquement au démarrage du Raspberry Pi"
    echo ""
fi

print_info "Modes de Démarrage Manuel :"
echo ""
echo "  Mode Développement :"
echo "    ${GREEN}npm run dev${NC}"
echo ""
echo "  Mode Production :"
echo "    ${GREEN}npm start${NC}"
echo ""
echo "  Avec PM2 :"
echo "    ${GREEN}npm run pm2:start${NC}"
echo "    ${GREEN}npm run pm2:logs${NC}"
echo ""

print_info "Accès à l'Interface Web :"
echo "    ${BLUE}http://$LOCAL_IP:8080${NC}"
echo ""
print_info "Depuis un autre appareil :"
echo "    ${BLUE}http://$LOCAL_IP:8080${NC}"
echo ""

print_info "Suite de Tests :"
echo "    Ouvrir : ${BLUE}examples/functionality-test.html${NC}"
echo ""

print_info "Documentation :"
echo "    README.md              - Documentation principale"
echo "    QUICK_START.md         - Guide de démarrage rapide"
echo "    INTEGRATION_GUIDE.md   - Guide d'intégration complet"
echo "    TESTING.md             - Documentation des tests"
echo ""

print_info "Prochaines Étapes :"
echo "  1. Connecter vos périphériques MIDI (USB, Virtual, ou Bluetooth)"
if [ "$OS" == "linux" ]; then
    echo "  2. Le service est déjà démarré (si vous avez répondu 'y')"
else
    echo "  2. Démarrer le serveur (npm start ou pm2 start)"
fi
echo "  3. Ouvrir l'interface web (http://$LOCAL_IP:8080)"
echo "  4. Scanner les périphériques MIDI"
echo "  5. Uploader des fichiers MIDI"
echo "  6. Créer des routes et jouer !"
echo ""

print_info "Commandes Utiles Raspberry Pi :"
echo "  ${BLUE}hostname -I${NC}                  - Voir l'IP du Raspberry Pi"
echo "  ${BLUE}vcgencmd measure_temp${NC}        - Voir la température CPU"
echo "  ${BLUE}free -h${NC}                      - Voir l'utilisation mémoire"
echo "  ${BLUE}aconnect -l${NC}                  - Lister les périphériques MIDI"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "  Besoin d'aide ? Consultez la documentation ou ouvrez une issue"
echo "  GitHub : https://github.com/glloq/Ma-est-tro"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

print_success "Bonne orchestration MIDI ! 🎵🎹🎶"
echo ""
