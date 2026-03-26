-- ============================================================================
-- File: migrations/029_string_instruments_cc_config.sql
-- Description: Add configurable CC numbers, range, offset for string/fret
--              control, and per-string fret count support.
-- ============================================================================

-- CC String Select configuration
ALTER TABLE string_instruments ADD COLUMN cc_string_number INTEGER NOT NULL DEFAULT 20;
ALTER TABLE string_instruments ADD COLUMN cc_string_min INTEGER NOT NULL DEFAULT 1;
ALTER TABLE string_instruments ADD COLUMN cc_string_max INTEGER NOT NULL DEFAULT 12;
ALTER TABLE string_instruments ADD COLUMN cc_string_offset INTEGER NOT NULL DEFAULT 0;

-- CC Fret Select configuration
ALTER TABLE string_instruments ADD COLUMN cc_fret_number INTEGER NOT NULL DEFAULT 21;
ALTER TABLE string_instruments ADD COLUMN cc_fret_min INTEGER NOT NULL DEFAULT 0;
ALTER TABLE string_instruments ADD COLUMN cc_fret_max INTEGER NOT NULL DEFAULT 36;
ALTER TABLE string_instruments ADD COLUMN cc_fret_offset INTEGER NOT NULL DEFAULT 0;

-- Per-string fret count (JSON array, e.g. [24,24,22,22,20,20])
-- NULL means all strings use num_frets uniformly
ALTER TABLE string_instruments ADD COLUMN frets_per_string TEXT DEFAULT NULL;
