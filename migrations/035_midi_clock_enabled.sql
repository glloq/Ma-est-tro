-- Migration 035: Add per-instrument MIDI clock enabled toggle
-- Allows users to enable/disable MIDI clock output per instrument.
-- Default is 0 (disabled) so existing instruments don't receive clock
-- until explicitly opted in.

ALTER TABLE instruments_latency ADD COLUMN midi_clock_enabled BOOLEAN DEFAULT 0;

-- Register migration
INSERT OR IGNORE INTO schema_version (version, description)
VALUES (35, 'Add per-instrument MIDI clock enabled toggle');
