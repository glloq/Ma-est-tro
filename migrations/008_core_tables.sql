-- ============================================================================
-- Migration 008: Core Tables (devices, routes, files)
-- ============================================================================

-- Check prerequisites
CREATE TEMP TABLE IF NOT EXISTS _migration_008_check AS
    SELECT
        (SELECT COUNT(*) FROM schema_version WHERE version = 1) as has_001,
        (SELECT COUNT(*) FROM schema_version WHERE version = 8) as has_008;

SELECT CASE
    WHEN (SELECT has_001 FROM _migration_008_check) = 0
    THEN 'ERROR: Migration 001 must be applied first'
    WHEN (SELECT has_008 FROM _migration_008_check) > 0
    THEN 'Migration 008 already applied - skipping'
END;

DROP TABLE _migration_008_check;

-- ============================================================================
-- TABLE: devices
-- ============================================================================

CREATE TABLE IF NOT EXISTS devices (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('input', 'output', 'virtual')),
    port_id INTEGER,
    manufacturer TEXT,
    version TEXT,
    enabled BOOLEAN DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_devices_type ON devices(type);
CREATE INDEX IF NOT EXISTS idx_devices_enabled ON devices(enabled);

CREATE TRIGGER IF NOT EXISTS trg_devices_update
AFTER UPDATE ON devices
FOR EACH ROW
BEGIN
    UPDATE devices SET updated_at = datetime('now') WHERE id = NEW.id;
END;

-- ============================================================================
-- TABLE: routes
-- ============================================================================

CREATE TABLE IF NOT EXISTS routes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    from_device TEXT NOT NULL,
    to_device TEXT NOT NULL,
    from_channel INTEGER CHECK(from_channel BETWEEN 0 AND 15),
    to_channel INTEGER CHECK(to_channel BETWEEN 0 AND 15),
    enabled BOOLEAN DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_routes_from ON routes(from_device);
CREATE INDEX IF NOT EXISTS idx_routes_to ON routes(to_device);
CREATE INDEX IF NOT EXISTS idx_routes_enabled ON routes(enabled);

CREATE TRIGGER IF NOT EXISTS trg_routes_update
AFTER UPDATE ON routes
FOR EACH ROW
BEGIN
    UPDATE routes SET updated_at = datetime('now') WHERE id = NEW.id;
END;

-- ============================================================================
-- TABLE: files
-- ============================================================================

CREATE TABLE IF NOT EXISTS files (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    filename TEXT NOT NULL,
    folder TEXT NOT NULL DEFAULT '/',
    filepath TEXT NOT NULL,
    midi_data TEXT,              -- MIDI JSON data
    metadata TEXT,               -- File metadata
    size INTEGER DEFAULT 0,
    duration_ms INTEGER DEFAULT 0,
    track_count INTEGER DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),

    UNIQUE(filepath)
);

CREATE INDEX IF NOT EXISTS idx_files_folder ON files(folder);
CREATE INDEX IF NOT EXISTS idx_files_filename ON files(filename);
CREATE INDEX IF NOT EXISTS idx_files_updated ON files(updated_at DESC);

CREATE TRIGGER IF NOT EXISTS trg_files_update
AFTER UPDATE ON files
FOR EACH ROW
BEGIN
    UPDATE files SET updated_at = datetime('now') WHERE id = NEW.id;
END;

-- ============================================================================
-- TABLE: instrument_latency (renamed from instruments_latency)
-- ============================================================================

CREATE TABLE IF NOT EXISTS instrument_latency (
    id TEXT PRIMARY KEY NOT NULL,
    device_id TEXT NOT NULL,
    channel INTEGER NOT NULL CHECK(channel BETWEEN 0 AND 15),
    name TEXT NOT NULL DEFAULT 'Unnamed Instrument',
    latency_ms INTEGER DEFAULT 0,
    enabled BOOLEAN DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_instrument_latency_device ON instrument_latency(device_id);
CREATE INDEX IF NOT EXISTS idx_instrument_latency_channel ON instrument_latency(channel);

CREATE TRIGGER IF NOT EXISTS trg_instrument_latency_update
AFTER UPDATE ON instrument_latency
FOR EACH ROW
BEGIN
    UPDATE instrument_latency SET updated_at = datetime('now') WHERE id = NEW.id;
END;

-- ============================================================================
-- REGISTER MIGRATION
-- ============================================================================

INSERT OR IGNORE INTO schema_version (version, description)
VALUES (8, 'Core tables: devices, routes, files, instrument_latency');
