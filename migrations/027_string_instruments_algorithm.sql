-- ============================================================================
-- File: migrations/027_string_instruments_algorithm.sql
-- Description: Add tab_algorithm column to string_instruments table.
--              Controls which MIDI-to-tablature conversion algorithm is used.
--              Values: 'min_movement' (default), 'lowest_fret', 'highest_fret', 'zone'
-- ============================================================================

ALTER TABLE string_instruments ADD COLUMN tab_algorithm TEXT NOT NULL DEFAULT 'min_movement';
