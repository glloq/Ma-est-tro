// One-shot migration from the "Ma-est-tro" / "MidiMind" era (v5.x) to
// "Général Midi Boop" (v0.7.x). Remove this file and its <script> tag in 0.8.0.
(function migrateLegacy() {
  if (typeof localStorage === 'undefined') return;
  const MAP = {
    maestro_settings: 'gmboop_settings',
    maestro_filter_sections: 'gmboop_filter_sections',
    maestro_locale: 'gmboop_locale',
    midimind_update_completed: 'gmboop_update_completed',
    midimind_loaded: 'gmboop_loaded',
  };
  for (const [oldKey, newKey] of Object.entries(MAP)) {
    try {
      const value = localStorage.getItem(oldKey);
      if (value !== null && localStorage.getItem(newKey) === null) {
        localStorage.setItem(newKey, value);
      }
      if (value !== null) localStorage.removeItem(oldKey);
    } catch {
      // Ignore quota / access errors — best-effort migration.
    }
  }
})();
