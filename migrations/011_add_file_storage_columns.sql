-- ============================================================================
-- Migration 011: Add file storage columns
-- ============================================================================
-- Adds columns needed for MIDI file upload and storage compatibility

-- Add data column for base64 MIDI file storage
ALTER TABLE midi_files ADD COLUMN data TEXT;

-- Add size column for file size in bytes
ALTER TABLE midi_files ADD COLUMN size INTEGER;

-- Add tracks column (already have track_count, keeping for compatibility)
ALTER TABLE midi_files ADD COLUMN tracks INTEGER;

-- Add duration column (already have duration_ms, keeping for compatibility)
ALTER TABLE midi_files ADD COLUMN duration REAL;

-- Add tempo column
ALTER TABLE midi_files ADD COLUMN tempo REAL;

-- Add ppq column (pulses per quarter note)
ALTER TABLE midi_files ADD COLUMN ppq INTEGER;
