-- ============================================================================
-- File: migrations/039_instrument_timing.sql
-- Description: Add min_note_interval and min_note_duration columns to
--              instruments_latency for per-instrument timing constraints.
-- ============================================================================

-- Minimum time in ms between two consecutive note-on events
ALTER TABLE instruments_latency ADD COLUMN min_note_interval INTEGER DEFAULT NULL;

-- Minimum duration in ms a note must stay active
ALTER TABLE instruments_latency ADD COLUMN min_note_duration INTEGER DEFAULT NULL;

-- ============================================================================
-- REGISTER MIGRATION
-- ============================================================================

INSERT OR IGNORE INTO schema_version (version, description)
VALUES (39, 'Add per-instrument note timing constraints');
