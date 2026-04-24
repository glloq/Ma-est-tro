-- ============================================================================
-- Migration 007: Scale length on string_instruments
-- ============================================================================
--
-- Adds `scale_length_mm` to `string_instruments` so the hand-position
-- planner (mode frets) can use a physically-correct model: frets are
-- not equally spaced — gap(n, n+1) ≈ L · 2^(−n/12) · (1 − 2^(−1/12)) —
-- so a hand of fixed physical width covers fewer frets near the nut and
-- more frets near the bridge. Without `scale_length_mm` the planner
-- falls back to the simpler constant-frets-per-window model.
--
-- The column is nullable: existing rows keep working unchanged
-- (fallback to `hand_span_frets` / `hand_move_frets_per_sec` from
-- `hands_config`). Frontend exposes a preset picker and lets the user
-- override per instrument; presets live in
-- StringInstrumentDatabase.SCALE_LENGTH_PRESETS, not in the DB.
--
-- Range: 100..2000 mm covers everything from a soprano ukulele
-- (~350) to a 5-string contrabass (~1100). NULL is permitted to mean
-- "preset not chosen yet".
-- ============================================================================

ALTER TABLE string_instruments
    ADD COLUMN scale_length_mm INTEGER
    CHECK (scale_length_mm IS NULL OR scale_length_mm BETWEEN 100 AND 2000);

INSERT OR IGNORE INTO schema_version (version, description)
VALUES (7, 'Add scale_length_mm to string_instruments (physical hand model)');
