-- ============================================================================
-- File: migrations/026_string_instruments_cc_enabled.sql
-- Description: Add cc_enabled flag to string_instruments table.
--              When disabled, CC20/CC21 events are not generated and the
--              TAB button is hidden in the MIDI editor. The tuning section
--              in the config modal is collapsed.
-- ============================================================================

ALTER TABLE string_instruments ADD COLUMN cc_enabled INTEGER NOT NULL DEFAULT 1;
