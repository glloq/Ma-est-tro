-- ============================================================================
-- Migration 013: Instrument Settings (MAC Address, Custom Name, Sync Delay, SysEx Info)
-- ============================================================================

-- Check prerequisites
CREATE TEMP TABLE IF NOT EXISTS _migration_013_check AS
    SELECT
        (SELECT COUNT(*) FROM schema_version WHERE version = 1) as has_001,
        (SELECT COUNT(*) FROM schema_version WHERE version = 5) as has_005,
        (SELECT COUNT(*) FROM schema_version WHERE version = 13) as has_013;

SELECT CASE
    WHEN (SELECT has_001 FROM _migration_013_check) = 0
    THEN 'ERROR: Migration 001 must be applied first'
    WHEN (SELECT has_005 FROM _migration_013_check) = 0
    THEN 'ERROR: Migration 005 must be applied first'
    WHEN (SELECT has_013 FROM _migration_013_check) > 0
    THEN 'Migration 013 already applied - skipping'
END;

DROP TABLE _migration_013_check;

-- ============================================================================
-- ALTER TABLE: instruments_latency
-- Add columns for instrument settings and SysEx identity
-- ============================================================================

-- MAC Address for unique identification (Bluetooth devices)
ALTER TABLE instruments_latency ADD COLUMN mac_address TEXT;

-- Custom name set by user (independent from device name)
ALTER TABLE instruments_latency ADD COLUMN custom_name TEXT;

-- Synchronization delay in microseconds (for multi-instrument sync)
-- Positive values delay the instrument, negative values advance it
ALTER TABLE instruments_latency ADD COLUMN sync_delay INTEGER DEFAULT 0
    CHECK(sync_delay BETWEEN -2147483648 AND 2147483647);

-- SysEx Identity Request/Reply information
ALTER TABLE instruments_latency ADD COLUMN sysex_manufacturer_id TEXT;
ALTER TABLE instruments_latency ADD COLUMN sysex_family TEXT;
ALTER TABLE instruments_latency ADD COLUMN sysex_model TEXT;
ALTER TABLE instruments_latency ADD COLUMN sysex_version TEXT;
ALTER TABLE instruments_latency ADD COLUMN sysex_device_id TEXT;
ALTER TABLE instruments_latency ADD COLUMN sysex_raw_response TEXT; -- Raw hex data

-- Timestamp of last SysEx identity request
ALTER TABLE instruments_latency ADD COLUMN sysex_last_request TEXT;

-- ============================================================================
-- CREATE INDEX: Optimize queries by MAC address
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_instruments_latency_mac
    ON instruments_latency(mac_address);

-- ============================================================================
-- REGISTER MIGRATION
-- ============================================================================

INSERT OR IGNORE INTO schema_version (version, description)
VALUES (13, 'Instrument settings: MAC address, custom name, sync delay, SysEx identity');
