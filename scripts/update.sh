#!/bin/bash

# ============================================================================
# MidiMind Update Script
# Pulls latest changes from GitHub and updates the system
# ============================================================================

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
print_header() {
    echo -e "\n${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}▶ $1${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

# ============================================================================
# Main Update Process
# ============================================================================

echo -e "${GREEN}"
cat << "EOF"
  __  __ _     _ _ __  __ _           _
 |  \/  (_) __| (_)  \/  (_)_ __   __| |
 | |\/| | |/ _` | | |\/| | | '_ \ / _` |
 | |  | | | (_| | | |  | | | | | | (_| |
 |_|  |_|_|\__,_|_|_|  |_|_|_| |_|\__,_|

         Update Script v1.0
EOF
echo -e "${NC}"

# Get current directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_DIR="$( cd "$SCRIPT_DIR/.." && pwd )"

cd "$PROJECT_DIR"

print_info "Project directory: $PROJECT_DIR"

# ============================================================================
# 1. Check Git Status
# ============================================================================

print_header "1. Checking Git Status"

# Check if we have uncommitted changes
if ! git diff-index --quiet HEAD --; then
    print_warning "You have uncommitted changes!"
    git status --short
    read -p "Do you want to stash your changes? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        git stash push -m "Auto-stash before update at $(date)"
        print_success "Changes stashed"
    else
        print_error "Please commit or stash your changes before updating"
        exit 1
    fi
fi

print_success "Working directory clean"

# ============================================================================
# 2. Stop Running Server
# ============================================================================

print_header "2. Stopping Server"

# Try PM2 first
if command -v pm2 &> /dev/null; then
    if pm2 list | grep -q "midimind"; then
        print_info "Stopping PM2 process..."
        pm2 stop midimind 2>/dev/null || true
        print_success "PM2 process stopped"
    fi
fi

# Try systemd
if systemctl is-active --quiet midimind 2>/dev/null; then
    print_info "Stopping systemd service..."
    sudo systemctl stop midimind
    print_success "Systemd service stopped"
fi

# Kill any remaining node processes on port 8080
if lsof -ti:8080 &> /dev/null; then
    print_info "Killing processes on port 8080..."
    lsof -ti:8080 | xargs -r kill 2>/dev/null || true
    sleep 1
    print_success "Port 8080 freed"
fi

# ============================================================================
# 3. Pull Latest Changes from GitHub
# ============================================================================

print_header "3. Pulling Latest Changes"

# Get current branch
CURRENT_BRANCH=$(git branch --show-current)
print_info "Current branch: $CURRENT_BRANCH"

# Fetch latest changes
print_info "Fetching from remote..."
git fetch origin

# Pull changes
print_info "Pulling changes..."
if git pull origin "$CURRENT_BRANCH"; then
    print_success "Successfully pulled latest changes"
else
    print_error "Failed to pull changes"
    exit 1
fi

# Show what changed
echo ""
print_info "Recent commits:"
git log -5 --oneline --decorate

# ============================================================================
# 4. Update Dependencies
# ============================================================================

print_header "4. Updating Dependencies"

# Check if package.json changed
if git diff HEAD@{1} --name-only | grep -q "package.json"; then
    print_info "package.json changed, updating npm dependencies..."
    npm install
    print_success "Dependencies updated"
else
    print_info "No package.json changes detected, skipping npm install"
fi

# ============================================================================
# 5. Run Database Migrations
# ============================================================================

print_header "5. Running Database Migrations"

# Check if migrations directory changed
if git diff HEAD@{1} --name-only | grep -q "migrations/"; then
    print_info "Migrations changed, running database migrations..."
    npm run migrate
    print_success "Database migrations completed"
else
    print_info "No migration changes detected"
    # Run migrations anyway to be safe
    npm run migrate
fi

# ============================================================================
# 6. Restart Server
# ============================================================================

print_header "6. Restarting Server"

# Choose restart method
if command -v pm2 &> /dev/null && pm2 list | grep -q "midimind"; then
    print_info "Restarting with PM2..."
    pm2 restart midimind
    print_success "PM2 process restarted"

    # Show logs
    print_info "Recent logs:"
    pm2 logs midimind --lines 10 --nostream

elif systemctl list-units --type=service | grep -q "midimind"; then
    print_info "Restarting with systemd..."
    sudo systemctl restart midimind
    sleep 2
    if systemctl is-active --quiet midimind; then
        print_success "Systemd service restarted"
    else
        print_error "Failed to restart systemd service"
        sudo systemctl status midimind
        exit 1
    fi
else
    print_warning "No service manager detected"
    print_info "You can start the server manually with:"
    echo "  npm start          # Foreground"
    echo "  npm run pm2:start  # Background with PM2"
fi

# ============================================================================
# 7. Verify Update
# ============================================================================

print_header "7. Verification"

# Wait for server to start
sleep 3

# Check if port 8080 is listening
if lsof -ti:8080 &> /dev/null; then
    print_success "Server is running on port 8080"
else
    print_warning "Server doesn't appear to be running on port 8080"
fi

# Test HTTP endpoint
if curl -s -o /dev/null -w "%{http_code}" http://localhost:8080 | grep -q "200"; then
    print_success "HTTP endpoint responding correctly"
else
    print_warning "HTTP endpoint not responding"
fi

# Show current version
if [ -f "package.json" ]; then
    VERSION=$(node -p "require('./package.json').version")
    print_info "Current version: $VERSION"
fi

# ============================================================================
# Summary
# ============================================================================

print_header "Update Complete"

print_success "MidiMind has been updated successfully!"
echo ""
print_info "Access the interface at: http://localhost:8080"
print_info "Network access: http://$(hostname -I | awk '{print $1}'):8080"
echo ""

# Check for stashed changes
if git stash list | grep -q "Auto-stash before update"; then
    print_warning "You have stashed changes. To restore them:"
    echo "  git stash pop"
fi

echo ""
print_info "Useful commands:"
echo "  npm run pm2:logs    # View PM2 logs"
echo "  npm run pm2:status  # Check PM2 status"
echo "  sudo systemctl status midimind  # Check systemd status"
echo ""

exit 0
