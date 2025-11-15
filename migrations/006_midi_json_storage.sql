-- ============================================================================
-- Migration 006: MIDI JSON Storage
-- Version: 4.2.5
-- ============================================================================

-- Check prerequisites
CREATE TEMP TABLE IF NOT EXISTS _migration_006_check AS
    SELECT 
        (SELECT COUNT(*) FROM schema_version WHERE version = 1) as has_001,
        (SELECT COUNT(*) FROM schema_version WHERE version = 6) as has_006;

SELECT CASE 
    WHEN (SELECT has_001 FROM _migration_006_check) = 0
    THEN 'ERROR: Migration 001 must be applied first'
    WHEN (SELECT has_006 FROM _migration_006_check) > 0
    THEN 'Migration 006 already applied - skipping'
END;

DROP TABLE _migration_006_check;

-- ============================================================================
-- TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS midi_files (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    filename TEXT NOT NULL,
    original_filepath TEXT,
    midi_json TEXT NOT NULL,         -- JSON complet
    metadata TEXT,                   -- Métadonnées extraites
    duration_ms INTEGER DEFAULT 0,
    track_count INTEGER DEFAULT 0,
    event_count INTEGER DEFAULT 0,
    created_at INTEGER NOT NULL,
    modified_at INTEGER NOT NULL,
    
    UNIQUE(filename)
);

CREATE TABLE IF NOT EXISTS midi_instrument_routings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    midi_file_id INTEGER NOT NULL,
    track_id INTEGER NOT NULL,
    instrument_name TEXT,
    device_id TEXT,
    channel INTEGER,
    enabled BOOLEAN DEFAULT 1,
    created_at INTEGER NOT NULL,
    
    FOREIGN KEY (midi_file_id) REFERENCES midi_files(id) ON DELETE CASCADE,
    UNIQUE(midi_file_id, track_id)
);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_midi_files_filename ON midi_files(filename);
CREATE INDEX IF NOT EXISTS idx_midi_routings_file ON midi_instrument_routings(midi_file_id);

-- ============================================================================
-- REGISTER MIGRATION
-- ============================================================================

INSERT OR IGNORE INTO schema_version (version, description) 
VALUES (6, 'MIDI JSON Storage - midi_files and routings tables');

-- ============================================================================
-- VERIFICATION
-- ============================================================================

SELECT 
    CASE 
        WHEN NOT EXISTS (SELECT 1 FROM sqlite_master WHERE type='table' AND name='midi_files')
        THEN 'WARNING: midi_files table not created'
        ELSE 'Migration 006 completed successfully'
    END as status;

-- ============================================================================
-- END OF MIGRATION 006 v4.2.5
-- ============================================================================