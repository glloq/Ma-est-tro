-- ============================================================================
-- Migration 014: USB Serial Number Support
-- ============================================================================

-- Check prerequisites
CREATE TEMP TABLE IF NOT EXISTS _migration_014_check AS
    SELECT
        (SELECT COUNT(*) FROM schema_version WHERE version = 13) as has_013,
        (SELECT COUNT(*) FROM schema_version WHERE version = 14) as has_014;

SELECT CASE
    WHEN (SELECT has_013 FROM _migration_014_check) = 0
    THEN 'ERROR: Migration 013 must be applied first'
    WHEN (SELECT has_014 FROM _migration_014_check) > 0
    THEN 'Migration 014 already applied - skipping'
END;

DROP TABLE _migration_014_check;

-- ============================================================================
-- ALTER TABLE: instruments_latency
-- Add USB serial number for unique identification of USB MIDI devices
-- ============================================================================

-- USB serial number for unique identification (USB devices)
-- This allows differentiation between multiple identical USB MIDI devices
ALTER TABLE instruments_latency ADD COLUMN usb_serial_number TEXT;

-- ============================================================================
-- CREATE INDEX: Optimize queries by USB serial number
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_instruments_latency_usb_serial
    ON instruments_latency(usb_serial_number);

-- ============================================================================
-- REGISTER MIGRATION
-- ============================================================================

INSERT OR IGNORE INTO schema_version (version, description)
VALUES (14, 'USB serial number support for unique device identification');
