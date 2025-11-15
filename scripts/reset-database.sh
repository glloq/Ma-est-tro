#!/bin/bash

# ============================================================================
# MidiMind Database Reset Script
# Deletes the database and restarts the server to recreate it with migrations
# ============================================================================

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

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

# Get script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_DIR="$( cd "$SCRIPT_DIR/.." && pwd )"

cd "$PROJECT_DIR"

echo -e "${YELLOW}"
cat << "EOF"
  ____  ____   ____  ____  _____
 |  _ \| __ ) |  _ \| __ )|_   _|
 | | | |  _ \ | |_) |  _ \  | |
 | |_| | |_) ||  _ <| |_) | | |
 |____/|____/ |_| \_\____/  |_|

  Database Reset Script
EOF
echo -e "${NC}"

print_warning "This will DELETE the current database and all data!"
print_warning "The database will be recreated with all migrations."
echo ""

# Confirm action
read -p "Are you sure you want to continue? (type 'yes' to confirm): " -r
echo

if [[ ! $REPLY == "yes" ]]; then
    print_info "Operation cancelled"
    exit 0
fi

# ============================================================================
# 1. Stop Server
# ============================================================================

print_header "1. Stopping Server"

# Stop PM2
if command -v pm2 &> /dev/null; then
    if pm2 list | grep -q "midimind"; then
        print_info "Stopping PM2 process..."
        pm2 delete midimind 2>/dev/null || true
        print_success "PM2 process stopped"
    fi
fi

# Kill any processes on port 8080
if lsof -ti:8080 &> /dev/null; then
    print_info "Killing processes on port 8080..."
    lsof -ti:8080 | xargs -r kill -9 2>/dev/null || true
    sleep 2
    print_success "Port 8080 freed"
fi

# ============================================================================
# 2. Backup Current Database
# ============================================================================

print_header "2. Backing Up Current Database"

DB_PATH="data/midimind.db"
BACKUP_DIR="data/backups"
BACKUP_FILE="$BACKUP_DIR/midimind_$(date +%Y%m%d_%H%M%S).db"

if [ -f "$DB_PATH" ]; then
    mkdir -p "$BACKUP_DIR"
    cp "$DB_PATH" "$BACKUP_FILE"
    print_success "Database backed up to: $BACKUP_FILE"
else
    print_info "No existing database to backup"
fi

# ============================================================================
# 3. Delete Database
# ============================================================================

print_header "3. Deleting Database"

if [ -f "$DB_PATH" ]; then
    rm -f "$DB_PATH"
    rm -f "$DB_PATH-shm" 2>/dev/null || true
    rm -f "$DB_PATH-wal" 2>/dev/null || true
    print_success "Database deleted"
else
    print_info "No database to delete"
fi

# ============================================================================
# 4. Restart Server
# ============================================================================

print_header "4. Restarting Server"

print_info "Starting server with PM2..."

if command -v pm2 &> /dev/null; then
    if pm2 start ecosystem.config.cjs; then
        print_success "PM2 process started"
        pm2 save
        print_success "PM2 configuration saved"

        # Wait for server to initialize
        sleep 5

        # Show logs
        print_info "Recent logs:"
        pm2 logs midimind --lines 20 --nostream
    else
        print_error "Failed to start PM2 process"
        exit 1
    fi
else
    print_warning "PM2 not available"
    print_info "Starting server manually..."
    npm start &
fi

# ============================================================================
# 5. Verify Database Recreation
# ============================================================================

print_header "5. Verification"

# Wait for database to be created
sleep 3

if [ -f "$DB_PATH" ]; then
    print_success "New database created: $DB_PATH"

    # Show database info
    DB_SIZE=$(du -h "$DB_PATH" | cut -f1)
    print_info "Database size: $DB_SIZE"
else
    print_error "Database was not created!"
    print_info "Check the logs for errors"
    exit 1
fi

# Check if server is running
if lsof -ti:8080 &> /dev/null; then
    print_success "Server is running on port 8080"
else
    print_error "Server is NOT running on port 8080"
fi

# ============================================================================
# Summary
# ============================================================================

print_header "Database Reset Complete"

print_success "Database has been reset successfully!"
echo ""
print_info "Old database backed up to: $BACKUP_FILE"
print_info "New database created with all migrations"
echo ""
print_info "Access the interface at: http://localhost:8080"
print_info "Network access: http://$(hostname -I | awk '{print $1}'):8080"
echo ""

exit 0
