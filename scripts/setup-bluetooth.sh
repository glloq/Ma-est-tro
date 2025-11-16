#!/bin/bash
# =============================================================================
# MidiMind 5.0 - Bluetooth BLE MIDI Setup
# Configure Bluetooth permissions for Noble on Raspberry Pi / Linux
# =============================================================================

set -e

echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║                                                               ║"
echo "║         🔵 Bluetooth BLE MIDI Permission Setup 🔵            ║"
echo "║                                                               ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""

# =============================================================================
# COLORS
# =============================================================================

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

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

# =============================================================================
# CHECKS
# =============================================================================

# Check if running as root
if [ "$EUID" -eq 0 ]; then
  print_error "Please do not run this script as root"
  print_info "Run as normal user: ./scripts/setup-bluetooth.sh"
  exit 1
fi

# Detect OS
if [[ ! "$OSTYPE" == "linux-gnu"* ]]; then
    print_error "This script is only for Linux systems"
    print_info "On macOS, Bluetooth should work without special configuration"
    exit 1
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# =============================================================================
# STEP 1: CHECK BLUETOOTH PACKAGES
# =============================================================================

print_info "Step 1: Checking Bluetooth packages..."
echo ""

PACKAGES_NEEDED=()

if ! dpkg -l | grep -q "^ii.*bluez"; then
    PACKAGES_NEEDED+=("bluez")
fi

if ! dpkg -l | grep -q "^ii.*bluetooth"; then
    PACKAGES_NEEDED+=("bluetooth")
fi

if ! dpkg -l | grep -q "^ii.*libbluetooth-dev"; then
    PACKAGES_NEEDED+=("libbluetooth-dev")
fi

if [ ${#PACKAGES_NEEDED[@]} -gt 0 ]; then
    print_warning "Missing packages: ${PACKAGES_NEEDED[@]}"
    print_info "Installing missing packages..."
    sudo apt-get update -qq
    sudo apt-get install -y "${PACKAGES_NEEDED[@]}"
    print_success "Packages installed"
else
    print_success "All required packages are installed"
fi

echo ""

# =============================================================================
# STEP 2: ENABLE BLUETOOTH SERVICE
# =============================================================================

print_info "Step 2: Enabling Bluetooth service..."
echo ""

sudo systemctl enable bluetooth 2>/dev/null || true
sudo systemctl start bluetooth 2>/dev/null || true

if systemctl is-active --quiet bluetooth; then
    print_success "Bluetooth service is running"
else
    print_error "Bluetooth service failed to start"
    print_info "Try: sudo systemctl status bluetooth"
    exit 1
fi

echo ""

# =============================================================================
# STEP 3: ADD USER TO BLUETOOTH GROUP
# =============================================================================

print_info "Step 3: Adding user to bluetooth group..."
echo ""

if groups $USER | grep -q bluetooth; then
    print_success "User $USER is already in bluetooth group"
else
    sudo usermod -a -G bluetooth $USER
    print_success "User $USER added to bluetooth group"
    print_warning "⚠️  You need to logout/login for group changes to take effect"
    print_info "Or run: newgrp bluetooth"
fi

echo ""

# =============================================================================
# STEP 4: SET NODE.JS CAPABILITIES
# =============================================================================

print_info "Step 4: Setting Node.js capabilities for BLE access..."
echo ""

NODE_PATH=$(eval readlink -f $(which node))

if [ -z "$NODE_PATH" ]; then
    print_error "Node.js not found. Please install Node.js first."
    exit 1
fi

print_info "Node.js path: $NODE_PATH"

# Set capabilities
if sudo setcap cap_net_raw+eip "$NODE_PATH"; then
    print_success "Capabilities set on Node.js"

    # Verify
    CAPS=$(getcap "$NODE_PATH")
    if [ -n "$CAPS" ]; then
        print_info "Current capabilities: $CAPS"
    fi
else
    print_error "Failed to set capabilities on Node.js"
    print_info "BLE MIDI may require running as root"
    exit 1
fi

echo ""

# =============================================================================
# STEP 5: CREATE UDEV RULE
# =============================================================================

print_info "Step 5: Creating udev rule for Bluetooth adapter..."
echo ""

UDEV_RULE="/etc/udev/rules.d/99-bluetooth.rules"

if [ -f "$UDEV_RULE" ]; then
    print_warning "udev rule already exists"
else
    echo 'KERNEL=="hci0", RUN+="/bin/hciconfig hci0 up"' | sudo tee "$UDEV_RULE" > /dev/null
    sudo udevadm control --reload-rules 2>/dev/null || true
    print_success "udev rule created"
fi

echo ""

# =============================================================================
# STEP 6: CONFIGURE SUDOERS FOR HCICONFIG
# =============================================================================

print_info "Step 6: Configuring sudoers for Bluetooth control..."
echo ""

SUDOERS_FILE="/etc/sudoers.d/bluetooth-hciconfig"

if [ -f "$SUDOERS_FILE" ]; then
    print_warning "sudoers file already exists"
else
    print_info "Creating sudoers configuration..."
    echo "# Allow user to control Bluetooth adapter without password" | sudo tee "$SUDOERS_FILE" > /dev/null
    echo "$USER ALL=(ALL) NOPASSWD: /usr/bin/hciconfig hci0 up" | sudo tee -a "$SUDOERS_FILE" > /dev/null
    echo "$USER ALL=(ALL) NOPASSWD: /usr/bin/hciconfig hci0 down" | sudo tee -a "$SUDOERS_FILE" > /dev/null
    sudo chmod 0440 "$SUDOERS_FILE"

    # Validate sudoers file
    if sudo visudo -c -f "$SUDOERS_FILE" > /dev/null 2>&1; then
        print_success "sudoers configuration created and validated"
        print_info "User $USER can now run: sudo hciconfig hci0 up/down"
    else
        print_error "sudoers file validation failed, removing..."
        sudo rm -f "$SUDOERS_FILE"
        print_warning "Manual configuration required"
    fi
fi

echo ""

# =============================================================================
# STEP 7: CHECK BLUETOOTH ADAPTER
# =============================================================================

print_info "Step 7: Checking Bluetooth adapter..."
echo ""

if command -v hciconfig &> /dev/null; then
    ADAPTER_STATUS=$(hciconfig hci0 2>&1)

    if echo "$ADAPTER_STATUS" | grep -q "UP RUNNING"; then
        print_success "Bluetooth adapter hci0 is UP and RUNNING"

        # Show adapter info
        echo ""
        echo "Adapter information:"
        hciconfig hci0 | grep -E "BD Address|UP RUNNING"
    else
        print_warning "Bluetooth adapter hci0 exists but may not be running"
        print_info "Attempting to bring up adapter..."
        sudo hciconfig hci0 up 2>/dev/null || print_warning "Could not bring up adapter"
    fi
else
    print_warning "hciconfig not available, cannot check adapter status"
fi

echo ""

# =============================================================================
# VERIFICATION
# =============================================================================

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo -e "${GREEN}✅ Bluetooth BLE MIDI Setup Complete!${NC}"
echo ""
echo "Summary:"
echo "  ✓ Bluetooth packages installed"
echo "  ✓ Bluetooth service enabled and running"
echo "  ✓ User added to bluetooth group"
echo "  ✓ Node.js capabilities configured"
echo "  ✓ udev rule created"
echo ""
print_warning "IMPORTANT: If you were added to the bluetooth group, you must:"
echo "  1. Logout and login again, OR"
echo "  2. Run: newgrp bluetooth"
echo "  3. Then restart the MidiMind server"
echo ""
print_info "Testing BLE scan:"
echo "  1. Start MidiMind: npm start"
echo "  2. Open web interface: http://localhost:8080"
echo "  3. Click 'Scan Bluetooth' button"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
