-- ============================================================================
-- Migration 016: Auto-Assignment Support (Derived Files & Extended Routings)
-- ============================================================================
--
-- Description:
--   Add support for auto-assignment of MIDI channels to instruments:
--   - Derived MIDI files (adapted with transpositions)
--   - Extended routing metadata (scores, transpositions)
--   - File relationships (parent/child)
--
-- Author: MidiMind Team
-- Date: 2026-01-20
--
-- ============================================================================

-- ============================================================================
-- ALTER TABLE: midi_files
-- Add columns for derived files and file relationships
-- ============================================================================

-- Is this the original file or a derived/adapted version?
ALTER TABLE midi_files ADD COLUMN is_original BOOLEAN DEFAULT 1;

-- Reference to parent file (for derived files)
ALTER TABLE midi_files ADD COLUMN parent_file_id INTEGER REFERENCES midi_files(id) ON DELETE CASCADE;

-- Adaptation metadata (JSON) - stores transposition info for derived files
-- Format: { created_at, strategy, transpositions: { channel: { semitones, octaves, reason } }, notes_changed, total_notes }
ALTER TABLE midi_files ADD COLUMN adaptation_metadata TEXT
    CHECK(adaptation_metadata IS NULL OR json_valid(adaptation_metadata));

-- ============================================================================
-- ALTER TABLE: midi_instrument_routings
-- Add columns for auto-assignment metadata
-- ============================================================================

-- Compatibility score (0-100) from auto-assignment algorithm
ALTER TABLE midi_instrument_routings ADD COLUMN compatibility_score REAL;

-- Transposition applied to this channel (in semitones)
ALTER TABLE midi_instrument_routings ADD COLUMN transposition_applied INTEGER DEFAULT 0;

-- Was this assignment made automatically?
ALTER TABLE midi_instrument_routings ADD COLUMN auto_assigned BOOLEAN DEFAULT 0;

-- Human-readable reason for this assignment
ALTER TABLE midi_instrument_routings ADD COLUMN assignment_reason TEXT;

-- Note remapping (JSON) - for discrete note instruments (drums)
-- Format: { "35": 36, "37": 38 } - maps unavailable notes to closest available
ALTER TABLE midi_instrument_routings ADD COLUMN note_remapping TEXT
    CHECK(note_remapping IS NULL OR json_valid(note_remapping));

-- ============================================================================
-- CREATE INDEX: Improve query performance
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_midi_files_parent ON midi_files(parent_file_id);
CREATE INDEX IF NOT EXISTS idx_midi_files_is_original ON midi_files(is_original);

-- ============================================================================
-- REGISTER MIGRATION
-- ============================================================================

INSERT OR IGNORE INTO schema_version (version, description)
VALUES (16, 'Auto-assignment support: derived files and extended routings');

-- ============================================================================
-- VERIFICATION
-- ============================================================================

SELECT 'Migration 016 completed successfully' as status;
