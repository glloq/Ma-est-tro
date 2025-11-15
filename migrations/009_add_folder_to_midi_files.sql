-- ============================================================================
-- Migration 009: Add folder column to midi_files
-- ============================================================================

-- Add folder column to midi_files table
ALTER TABLE midi_files ADD COLUMN folder TEXT NOT NULL DEFAULT '/';

-- Create index for folder
CREATE INDEX IF NOT EXISTS idx_midi_files_folder ON midi_files(folder);

-- Update MidiDatabase.js to use folder column for file organization

-- ============================================================================
-- REGISTER MIGRATION
-- ============================================================================

INSERT OR IGNORE INTO schema_version (version, description)
VALUES (9, 'Add folder column to midi_files');
