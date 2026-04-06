-- Migration 036: Add device-level settings columns
-- Adds custom_name, midi_clock_enabled, and message_rate_limit to the devices table.
-- These are device-level settings (not per-channel/instrument).

ALTER TABLE devices ADD COLUMN custom_name TEXT;
ALTER TABLE devices ADD COLUMN midi_clock_enabled BOOLEAN DEFAULT 0;
ALTER TABLE devices ADD COLUMN message_rate_limit INTEGER DEFAULT 0;

-- Register migration
INSERT OR IGNORE INTO schema_version (version, description)
VALUES (36, 'Add device-level settings: custom_name, midi_clock_enabled, message_rate_limit');
