-- ============================================================================
-- Migration 010: Add uploaded_at column to midi_files
-- ============================================================================

-- Add uploaded_at column to midi_files table
ALTER TABLE midi_files ADD COLUMN uploaded_at INTEGER;

-- Set uploaded_at to created_at for existing records
UPDATE midi_files SET uploaded_at = created_at WHERE uploaded_at IS NULL;

-- Create index for uploaded_at
CREATE INDEX IF NOT EXISTS idx_midi_files_uploaded ON midi_files(uploaded_at DESC);

-- ============================================================================
-- REGISTER MIGRATION
-- ============================================================================

INSERT OR IGNORE INTO schema_version (version, description)
VALUES (10, 'Add uploaded_at column to midi_files');
