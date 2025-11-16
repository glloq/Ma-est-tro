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

    print_success "Bluetooth permissions configured"
    print_warning "You may need to logout/login for group changes to take effect"
    print_info "Or run: newgrp bluetooth"
fi

# =============================================================================
# SYSTEMD / PM2 SETUP
# =============================================================================

print_step "8. Process Manager Setup"

echo ""
print_info "Choose startup method:"
echo "  1) Systemd service (recommended for production on Linux)"
echo "  2) PM2 (recommended for development)"
echo "  3) Manual start (npm start)"
echo ""

read -p "Enter choice [1-3]: " -n 1 -r
echo ""

case $REPLY in
    1)
        if [ "$OS" == "linux" ]; then
            print_info "Creating systemd service..."

            SERVICE_FILE="/etc/systemd/system/midimind.service"

            sudo tee $SERVICE_FILE > /dev/null <<EOF
[Unit]
Description=MidiMind 5.0 MIDI Orchestration System
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$(pwd)
ExecStart=$(which node) $(pwd)/src/Server.js
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=midimind

Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF

            sudo systemctl daemon-reload
            sudo systemctl enable midimind

            print_success "Systemd service installed"
            print_info "Commands:"
            echo "    Start:   sudo systemctl start midimind"
            echo "    Stop:    sudo systemctl stop midimind"
            echo "    Restart: sudo systemctl restart midimind"
            echo "    Status:  sudo systemctl status midimind"
            echo "    Logs:    sudo journalctl -u midimind -f"
        else
            print_warning "Systemd not available on macOS"
            print_info "Using PM2 instead..."
            REPLY=2
        fi
        ;;

    2)
        print_info "Setting up PM2..."
        pm2 delete midimind 2>/dev/null || true
        pm2 start ecosystem.config.cjs
        pm2 save

        print_success "PM2 configured"
        print_info "Commands:"
        echo "    Start:   pm2 start midimind"
        echo "    Stop:    pm2 stop midimind"
        echo "    Restart: pm2 restart midimind"
        echo "    Status:  pm2 status"
        echo "    Logs:    pm2 logs midimind"

        echo ""
        read -p "Setup PM2 to start on boot? (y/n) " -n 1 -r
        echo ""
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            pm2 startup
            print_info "Run the command above to complete PM2 startup configuration"
        fi
        ;;

    3)
        print_info "Manual start selected"
        print_info "Start with: npm start"
        ;;

    *)
        print_warning "Invalid choice, skipping"
        ;;
esac

# =============================================================================
# VERIFICATION
# =============================================================================

print_step "9. Verification"

# Check if all critical files exist
CRITICAL_FILES=(
    "package.json"
    "config.json"
    "src/Server.js"
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

print_success "MidiMind 5.0 is ready to use!"
echo ""

print_info "Quick Start Commands:"
echo ""
echo "  Development Mode:"
echo "    ${GREEN}npm run dev${NC}"
echo ""
echo "  Production Mode:"
echo "    ${GREEN}npm start${NC}"
echo ""
echo "  With PM2:"
echo "    ${GREEN}npm run pm2:start${NC}"
echo "    ${GREEN}npm run pm2:logs${NC}"
echo ""

print_info "Access the Web Interface:"
echo "    ${BLUE}http://$LOCAL_IP:8080${NC}"
echo ""

print_info "Test Suite:"
echo "    Open: ${BLUE}examples/functionality-test.html${NC}"
echo ""

print_info "Documentation:"
echo "    README.md              - Main documentation"
echo "    QUICK_START.md         - Quick start guide"
echo "    INTEGRATION_GUIDE.md   - Full integration guide"
echo "    TESTING.md             - Testing documentation"
echo ""

print_info "Next Steps:"
echo "  1. Connect MIDI devices (USB, Virtual, or Bluetooth)"
echo "  2. Start the server (npm start)"
echo "  3. Open web interface (http://$LOCAL_IP:8080)"
echo "  4. Scan for MIDI devices"
echo "  5. Upload MIDI files"
echo "  6. Create routes and play!"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "  Need help? Check the documentation or open an issue on GitHub"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

print_success "Happy MIDI orchestrating! 🎵🎹🎶"
echo ""
