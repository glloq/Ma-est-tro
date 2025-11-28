-- ============================================================================
-- Migration 015: Instrument Capabilities (Note Range, Supported CCs)
-- ============================================================================
--
-- Description:
--   Add instrument capabilities to allow users to define:
--   - Note range (min/max playable notes)
--   - Supported CC controllers
--   These can be retrieved via SysEx or configured manually.
--
-- Author: MidiMind Team
-- Date: 2025-11-28
--
-- ============================================================================

-- Check prerequisites
CREATE TEMP TABLE IF NOT EXISTS _migration_015_check AS
    SELECT
        (SELECT COUNT(*) FROM schema_version WHERE version = 14) as has_014,
        (SELECT COUNT(*) FROM schema_version WHERE version = 15) as has_015;

SELECT CASE
    WHEN (SELECT has_014 FROM _migration_015_check) = 0
    THEN 'ERROR: Migration 014 must be applied first'
    WHEN (SELECT has_015 FROM _migration_015_check) > 0
    THEN 'Migration 015 already applied - skipping'
END;

DROP TABLE _migration_015_check;

-- ============================================================================
-- ALTER TABLE: instruments_latency
-- Add columns for instrument capabilities
-- ============================================================================

-- Note range: minimum playable MIDI note (0-127)
-- Default NULL means no restriction (all notes playable)
ALTER TABLE instruments_latency ADD COLUMN note_range_min INTEGER
    CHECK(note_range_min IS NULL OR (note_range_min BETWEEN 0 AND 127));

-- Note range: maximum playable MIDI note (0-127)
-- Default NULL means no restriction (all notes playable)
ALTER TABLE instruments_latency ADD COLUMN note_range_max INTEGER
    CHECK(note_range_max IS NULL OR (note_range_max BETWEEN 0 AND 127));

-- Supported CC controllers (JSON array)
-- Format: [1, 7, 10, 11, 64, 74] or null for "all CCs supported"
-- Common CCs: 1=Modulation, 7=Volume, 10=Pan, 11=Expression, 64=Sustain, 74=Filter
ALTER TABLE instruments_latency ADD COLUMN supported_ccs TEXT
    CHECK(supported_ccs IS NULL OR json_valid(supported_ccs));

-- Note selection mode: 'range' or 'discrete'
-- 'range' = use note_range_min/max
-- 'discrete' = use selected_notes array
ALTER TABLE instruments_latency ADD COLUMN note_selection_mode TEXT DEFAULT 'range'
    CHECK(note_selection_mode IN ('range', 'discrete'));

-- Selected notes for discrete mode (JSON array)
-- Format: [36, 38, 40, 41, 42, 44, 46, 48, 49, 51] for drum pads
-- or [0, 2, 4, 5, 7, 9, 11, 12, 14, 16, ...] for 7-note scales
ALTER TABLE instruments_latency ADD COLUMN selected_notes TEXT
    CHECK(selected_notes IS NULL OR json_valid(selected_notes));

-- Capabilities source: how the capabilities were obtained
-- 'manual' = configured manually by user
-- 'sysex' = retrieved via SysEx request
-- 'auto' = auto-detected
ALTER TABLE instruments_latency ADD COLUMN capabilities_source TEXT DEFAULT 'manual'
    CHECK(capabilities_source IN ('manual', 'sysex', 'auto'));

-- Timestamp of last capability update
ALTER TABLE instruments_latency ADD COLUMN capabilities_updated_at TEXT;

-- ============================================================================
-- REGISTER MIGRATION
-- ============================================================================

INSERT OR IGNORE INTO schema_version (version, description)
VALUES (15, 'Instrument capabilities: note range, supported CCs');

-- ============================================================================
-- VERIFICATION
-- ============================================================================

SELECT
    CASE
        WHEN NOT EXISTS (
            SELECT 1 FROM pragma_table_info('instruments_latency')
            WHERE name = 'note_range_min'
        )
        THEN 'WARNING: note_range_min column not created'
        ELSE 'Column note_range_min created successfully'
    END as column_check_1;

SELECT
    CASE
        WHEN NOT EXISTS (
            SELECT 1 FROM pragma_table_info('instruments_latency')
            WHERE name = 'supported_ccs'
        )
        THEN 'WARNING: supported_ccs column not created'
        ELSE 'Column supported_ccs created successfully'
    END as column_check_2;

SELECT
    'Migration 015 completed successfully' as status,
    (SELECT version FROM schema_version ORDER BY version DESC LIMIT 1) as current_version;

-- ============================================================================
-- USAGE EXAMPLES
-- ============================================================================

-- Set note range for a piano (A0 = 21 to C8 = 108):
/*
UPDATE instruments_latency
SET note_range_min = 21,
    note_range_max = 108,
    capabilities_source = 'manual',
    capabilities_updated_at = datetime('now')
WHERE device_id = 'my_piano';
*/

-- Set supported CCs for a synth:
/*
UPDATE instruments_latency
SET supported_ccs = '[1, 7, 10, 11, 64, 74]',
    capabilities_source = 'manual',
    capabilities_updated_at = datetime('now')
WHERE device_id = 'my_synth';
*/

-- ============================================================================
-- END OF FILE 015_instrument_capabilities.sql
-- ============================================================================
