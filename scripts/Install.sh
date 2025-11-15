#!/bin/bash
# MidiMind 5.0 Installation Script for Raspberry Pi

set -e

echo "=== MidiMind 5.0 Installation ==="
echo ""

# Check if running as root
if [ "$EUID" -eq 0 ]; then
  echo "⚠️  Please do not run this script as root"
  exit 1
fi

# Update system
echo "📦 Updating system packages..."
sudo apt-get update

# Install system dependencies
echo "📦 Installing system dependencies..."
sudo apt-get install -y \
  libasound2-dev \
  bluetooth \
  bluez \
  libbluetooth-dev \
  build-essential \
  git

# Install Node.js 18 LTS
echo "📦 Installing Node.js 18 LTS..."
if ! command -v node &> /dev/null; then
  curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
  sudo apt-get install -y nodejs
else
  echo "✓ Node.js already installed ($(node --version))"
fi

# Install PM2 globally
echo "📦 Installing PM2..."
if ! command -v pm2 &> /dev/null; then
  sudo npm install -g pm2
else
  echo "✓ PM2 already installed"
fi

# Create necessary directories
echo "📁 Creating directories..."
mkdir -p data
mkdir -p logs
mkdir -p uploads
mkdir -p backups
mkdir -p public/css
mkdir -p public/js
mkdir -p public/assets

# Install Node.js dependencies
echo "📦 Installing Node.js dependencies..."
npm install

# Run database migrations
echo "🗄️  Running database migrations..."
npm run migrate

# Create systemd service (optional)
read -p "Do you want to install as systemd service? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
  echo "📝 Creating systemd service..."
  
  SERVICE_FILE="/etc/systemd/system/midimind.service"
  
  sudo tee $SERVICE_FILE > /dev/null <<EOF
[Unit]
Description=MidiMind 5.0 MIDI Orchestration System
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$(pwd)
ExecStart=$(which node) $(pwd)/server.js
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=midimind

[Install]
WantedBy=multi-user.target
EOF

  sudo systemctl daemon-reload
  sudo systemctl enable midimind
  
  echo "✓ Systemd service installed"
  echo "  Start: sudo systemctl start midimind"
  echo "  Stop:  sudo systemctl stop midimind"
  echo "  Logs:  sudo journalctl -u midimind -f"
fi

# Setup PM2 startup (alternative to systemd)
if ! [[ $REPLY =~ ^[Yy]$ ]]; then
  read -p "Do you want to setup PM2 startup? (y/n) " -n 1 -r
  echo
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    pm2 startup
    echo "✓ PM2 startup configured"
    echo "  Now run: pm2 save"
  fi
fi

# Create default config if it doesn't exist
if [ ! -f config.json ]; then
  echo "📝 Creating default configuration..."
  cp config.json.example config.json 2>/dev/null || echo "{}" > config.json
fi

# Set permissions
echo "🔒 Setting permissions..."
chmod +x scripts/*.sh 2>/dev/null || true
chmod 755 data logs uploads backups 2>/dev/null || true

# Summary
echo ""
echo "=== Installation Complete ==="
echo ""
echo "🎉 MidiMind 5.0 is ready!"
echo ""
echo "Quick Start:"
echo "  Development:  npm run dev"
echo "  Production:   npm start"
echo "  With PM2:     npm run pm2:start"
echo ""
echo "Access: http://$(hostname -I | awk '{print $1}'):8080"
echo ""
echo "Next Steps:"
echo "  1. Connect MIDI devices"
echo "  2. Open the web interface"
echo "  3. Scan for devices"
echo "  4. Create routes and enjoy!"
echo ""