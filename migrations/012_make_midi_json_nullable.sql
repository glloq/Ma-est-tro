-- ============================================================================
-- Migration 012: Make midi_json column nullable
-- ============================================================================
-- The midi_json column was defined as NOT NULL but the upload code
-- uses the 'data' column instead. Making it nullable for compatibility.

-- SQLite doesn't support ALTER COLUMN, so we need to recreate the table

-- 1. Create new table with nullable midi_json
CREATE TABLE IF NOT EXISTS midi_files_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    filename TEXT NOT NULL,
    original_filepath TEXT,
    midi_json TEXT,                  -- Now nullable
    metadata TEXT,
    duration_ms INTEGER DEFAULT 0,
    track_count INTEGER DEFAULT 0,
    event_count INTEGER DEFAULT 0,
    created_at INTEGER NOT NULL,
    modified_at INTEGER NOT NULL,
    data TEXT,
    size INTEGER,
    tracks INTEGER,
    duration REAL,
    tempo REAL,
    ppq INTEGER,
    folder TEXT DEFAULT '/',
    uploaded_at TEXT,

    UNIQUE(filename)
);

-- 2. Copy existing data if old table exists (only base columns from migration 006)
INSERT INTO midi_files_new (
    id, filename, original_filepath, midi_json, metadata,
    duration_ms, track_count, event_count, created_at, modified_at
)
SELECT
    id, filename, original_filepath, midi_json, metadata,
    duration_ms, track_count, event_count, created_at, modified_at
FROM midi_files
WHERE EXISTS (SELECT 1 FROM sqlite_master WHERE type='table' AND name='midi_files');

-- 3. Drop old table
DROP TABLE IF EXISTS midi_files;

-- 4. Rename new table
ALTER TABLE midi_files_new RENAME TO midi_files;

-- 5. Recreate indexes
CREATE INDEX IF NOT EXISTS idx_midi_files_filename ON midi_files(filename);
CREATE INDEX IF NOT EXISTS idx_midi_files_folder ON midi_files(folder);
CREATE INDEX IF NOT EXISTS idx_midi_files_uploaded ON midi_files(uploaded_at DESC);
