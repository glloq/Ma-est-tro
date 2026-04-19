#!/usr/bin/env bash
# scripts/migrate-from-v5.sh
# One-shot helper for deployments upgrading from the legacy "Ma-est-tro" /
# "MidiMind" v5.x to Général Midi Boop (v0.7.x).  Run BEFORE `npm start` or
# `scripts/update.sh`.  Safe to re-run — every step is idempotent.
#
# Actions:
#   1. Stop and remove the old PM2 app (midimind) if present.
#   2. Stop, disable, and remove the old systemd service (midimind.service).
#   3. Rename MAESTRO_* variables in .env to GMBOOP_*.
#   4. Rename data/midimind.db -> data/gmboop.db and logs/midimind.log -> logs/gmboop.log
#      (the backend does this too on first boot; the shell path is here for
#      operators who want to run it explicitly before switching services).

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

log() { echo "[migrate-from-v5] $*"; }

# 1. PM2 cleanup
if command -v pm2 >/dev/null 2>&1; then
    if pm2 describe midimind >/dev/null 2>&1; then
        log "Stopping and deleting legacy PM2 app 'midimind'..."
        pm2 stop midimind || true
        pm2 delete midimind || true
        pm2 save || true
    else
        log "No legacy PM2 app named 'midimind' found."
    fi
else
    log "pm2 not installed — skipping PM2 cleanup."
fi

# 2. systemd cleanup (requires sudo)
if [ -f /etc/systemd/system/midimind.service ]; then
    log "Disabling legacy systemd service 'midimind.service'..."
    sudo systemctl stop midimind.service || true
    sudo systemctl disable midimind.service || true
    sudo rm -f /etc/systemd/system/midimind.service
    sudo systemctl daemon-reload || true
else
    log "No legacy systemd unit at /etc/systemd/system/midimind.service."
fi

# 3. .env rewrite (if present)
if [ -f .env ]; then
    if grep -q '^MAESTRO_' .env; then
        log "Rewriting MAESTRO_* -> GMBOOP_* in .env..."
        cp .env .env.bak-v5
        sed -i 's/^MAESTRO_/GMBOOP_/g' .env
        log "Backup saved to .env.bak-v5"
    else
        log "No MAESTRO_* variables in .env."
    fi
else
    log "No .env file present."
fi

# 4. Rename runtime artifacts
rename_if_legacy() {
    local old="$1"
    local new="$2"
    if [ -e "$old" ] && [ ! -e "$new" ]; then
        log "Renaming $old -> $new"
        mv "$old" "$new"
    fi
}

mkdir -p data logs
rename_if_legacy data/midimind.db data/gmboop.db
rename_if_legacy logs/midimind.log logs/gmboop.log

log "Legacy cleanup complete. You can now start Général Midi Boop."
