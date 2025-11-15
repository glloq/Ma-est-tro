-- ============================================================================
-- Migration 007: Playlists
-- Version: 4.2.3 - FIXED: midi_id column name consistency
-- ============================================================================

CREATE TABLE IF NOT EXISTS playlists (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    loop INTEGER DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS playlist_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    playlist_id INTEGER NOT NULL,
    midi_id INTEGER NOT NULL,
    position INTEGER NOT NULL,
    
    FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE CASCADE,
    FOREIGN KEY (midi_id) REFERENCES midi_files(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_playlists_updated ON playlists(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_playlist_items_playlist ON playlist_items(playlist_id, position);

-- ============================================================================
-- REGISTER MIGRATION
-- ============================================================================

INSERT OR IGNORE INTO schema_version (version, description) 
VALUES (7, 'Playlists - midi_id column fix');

-- ============================================================================
-- END OF MIGRATION 007 v4.2.3
-- ============================================================================