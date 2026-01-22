-- ============================================================================
-- Migration 017: Filter Metadata for Advanced MIDI File Search
-- ============================================================================
--
-- Description:
--   Add metadata columns to enable advanced filtering of MIDI files:
--   - Instrument types detected in the file
--   - Number of MIDI channels used
--   - Note range (min/max)
--   - Boolean flags for quick filtering (drums, melody, bass)
--
-- Author: MidiMind Team
-- Date: 2026-01-22
--
-- ============================================================================

-- ============================================================================
-- ALTER TABLE: midi_files
-- Add columns for filter metadata
-- ============================================================================

-- Instrument types detected in file (JSON array)
-- Format: ["Piano", "Drums", "Bass", "Strings"]
ALTER TABLE midi_files ADD COLUMN instrument_types TEXT DEFAULT '[]'
    CHECK(instrument_types IS NULL OR json_valid(instrument_types));

-- Number of MIDI channels used in the file
ALTER TABLE midi_files ADD COLUMN channel_count INTEGER DEFAULT 0;

-- Note range: minimum MIDI note (0-127)
ALTER TABLE midi_files ADD COLUMN note_range_min INTEGER;

-- Note range: maximum MIDI note (0-127)
ALTER TABLE midi_files ADD COLUMN note_range_max INTEGER;

-- Boolean flags for quick filtering
ALTER TABLE midi_files ADD COLUMN has_drums BOOLEAN DEFAULT 0;
ALTER TABLE midi_files ADD COLUMN has_melody BOOLEAN DEFAULT 0;
ALTER TABLE midi_files ADD COLUMN has_bass BOOLEAN DEFAULT 0;

-- ============================================================================
-- CREATE INDEX: Improve query performance for filtering
-- ============================================================================

-- Index for instrument type searches
CREATE INDEX IF NOT EXISTS idx_midi_files_instrument_types ON midi_files(instrument_types);

-- Index for channel count filtering
CREATE INDEX IF NOT EXISTS idx_midi_files_channel_count ON midi_files(channel_count);

-- Composite index for common filter combinations (duration + tempo)
CREATE INDEX IF NOT EXISTS idx_midi_files_duration_tempo ON midi_files(duration, tempo);

-- Index for folder + date filtering
CREATE INDEX IF NOT EXISTS idx_midi_files_folder_date ON midi_files(folder, uploaded_at);

-- Indexes for boolean quick filters
CREATE INDEX IF NOT EXISTS idx_midi_files_has_drums ON midi_files(has_drums);
CREATE INDEX IF NOT EXISTS idx_midi_files_has_melody ON midi_files(has_melody);
CREATE INDEX IF NOT EXISTS idx_midi_files_has_bass ON midi_files(has_bass);

-- ============================================================================
-- REGISTER MIGRATION
-- ============================================================================

INSERT OR IGNORE INTO schema_version (version, description)
VALUES (17, 'Filter metadata: instrument types, channels, note range, quick filters');

-- ============================================================================
-- VERIFICATION
-- ============================================================================

SELECT 'Migration 017 completed successfully' as status;
