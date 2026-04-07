-- ============================================================================
-- File: migrations/037_overlap_strategy.sql
-- Project: Ma-est-tro - MIDI Orchestration System
-- ============================================================================
--
-- Description:
--   Ajoute la colonne overlap_strategy a midi_instrument_routings pour
--   persister la strategie de resolution des chevauchements de notes
--   entre segments de split routing.
--   Valeurs possibles: 'first', 'second', 'shared', 'round_robin',
--   'least_loaded', NULL (defaut = first-match).
--
-- ============================================================================

-- Pre-check
CREATE TEMP TABLE IF NOT EXISTS _migration_037_check AS
    SELECT
        (SELECT COUNT(*) FROM schema_version WHERE version = 36) as has_036,
        (SELECT COUNT(*) FROM schema_version WHERE version = 37) as has_037;

SELECT CASE
    WHEN (SELECT has_036 FROM _migration_037_check) = 0
    THEN 'ERROR: Migration 036 must be applied first'
    WHEN (SELECT has_037 FROM _migration_037_check) > 0
    THEN 'Migration 037 already applied - skipping'
END;

DROP TABLE _migration_037_check;

-- ============================================================================
-- Ajouter la colonne overlap_strategy
-- ============================================================================

ALTER TABLE midi_instrument_routings
    ADD COLUMN overlap_strategy TEXT DEFAULT NULL;

-- ============================================================================
-- ENREGISTRER LA MIGRATION
-- ============================================================================

INSERT OR IGNORE INTO schema_version (version, description)
VALUES (37, 'Add overlap_strategy column to midi_instrument_routings');

-- Verification
SELECT
    'Migration 037 completed successfully' as status,
    (SELECT version FROM schema_version ORDER BY version DESC LIMIT 1) as current_version;
