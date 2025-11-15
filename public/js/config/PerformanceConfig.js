// ============================================================================
// Fichier: frontend/js/config/PerformanceConfig.js
// Version: v3.1.1 - LOOP RECORDER DISABLED
// Date: 2025-11-02
// Projet: MidiMind v3.0 - Système d'Orchestration MIDI
// ============================================================================
// MODIFICATIONS v3.1.1:
// ✅ Désactivation Loop Recorder (enableLoopRecorder: false)
// ============================================================================

const PerformanceConfig = {
    // ========================================================================
    // RENDERING PERFORMANCE
    // ========================================================================
    rendering: {
        targetFPS: 10,                      // 60 → 10 fps (économie CPU)
        enableAntiAliasing: false,          // Désactiver smooth rendering
        maxVisibleNotes: 500,               // Limiter notes visibles
        updateInterval: 100,                // ms entre updates (au lieu de 16ms)
        useOffscreenCanvas: false,          // Pas nécessaire pour notre cas
        enableWebGL: false,                 // Canvas 2D suffit
        enableSmoothScrolling: false,       // Désactiver smooth scroll
        enableAnimations: false             // Désactiver animations UI
    },

    // ========================================================================
    // MEMORY MANAGEMENT
    // ========================================================================
    memory: {
        maxCacheSize: 50,                   // 200 → 50 MB
        maxHistorySize: 10,                 // 50 → 10 undo levels
        maxSnapshots: 5,                    // 20 → 5 snapshots
        enablePreload: false,               // Pas de préchargement
        cacheTimeout: 300000,               // 5 min cache timeout
        aggressiveGC: true                  // Garbage collection agressive
    },

    // ========================================================================
    // EDITOR PERFORMANCE
    // ========================================================================
    editor: {
        maxUndoLevels: 10,                  // Historique limité
        showVelocityEditor: false,          // Désactivé par défaut
        enableVelocityGraph: false,         // Pas de graphique vélocité
        snapToGrid: true,                   // Forcer snap
        quantizeResolution: 480,            // 1 beat minimum
        renderBatchSize: 100,               // Notes par batch
        enableSelectionAnimation: false     // Pas d'animation sélection
    },

    // ========================================================================
    // ROUTING PERFORMANCE
    // ========================================================================
    routing: {
        allowComplexRouting: false,         // 1→1 uniquement
        maxRoutes: 16,                      // Limité aux 16 canaux MIDI
        enableAutoRouting: false,           // Pas de routing auto
        enableCompatibilityScoring: false,  // Pas de calcul compatibilité
        maxPresets: 5,                      // Limiter presets
        enableConflictResolution: false     // Pas de résolution conflits
    },

    // ========================================================================
    // KEYBOARD PERFORMANCE
    // ========================================================================
    keyboard: {
        mode: 'monitor',                    // 'monitor' ou 'full' (default: monitor)
        enableRecording: false,             // Pas d'enregistrement temps réel
        enablePlayback: true,               // Permettre lecture notes
        showNoteNames: true,                // Afficher noms notes
        highlightActiveNotes: true,         // Surligner notes actives
        maxVisibleKeys: 88,                 // 88 touches piano
        enableVelocitySensitivity: true,    // Sensibilité vélocité
        debounceDelay: 50                   // ms anti-rebond
    },

    // ========================================================================
    // NETWORK PERFORMANCE
    // ========================================================================
    network: {
        requestTimeout: 10000,              // 30s → 10s
        maxRetries: 2,                      // 5 → 2
        enableRequestCache: true,           // Cache requêtes
        cacheTimeout: 60000,                // 1 min
        enableCompression: false,           // Pas de compression (overhead)
        enableBatching: false               // Pas de batch requests
    },

    // ========================================================================
    // UI PERFORMANCE
    // ========================================================================
    ui: {
        enableTransitions: false,           // Pas de transitions CSS
        transitionDuration: 0,              // Instant
        enableTooltips: true,               // Garder tooltips
        tooltipDelay: 500,                  // ms avant affichage
        enableHoverEffects: false,          // Pas d'effets hover
        enableNotifications: true,          // Garder notifications
        notificationDuration: 3000          // 3 secondes
    },

    // ========================================================================
    // DEBUG & MONITORING
    // ========================================================================
    debug: {
        enablePerformanceMonitoring: true,  // Garder monitoring
        monitoringInterval: 5000,           // Check toutes les 5 secondes
        enableConsoleDebug: false,          // Désactiver logs debug
        logLevel: 'warn',                   // warn, error uniquement
        enableFPSCounter: false,            // Pas de compteur FPS
        enableMemoryMonitor: true           // Surveiller mémoire
    },

    // ========================================================================
    // FEATURE FLAGS
    // ========================================================================
    features: {
        enableLoopRecorder: false,          // ❌ Loop recorder désactivé
        enablePlaylistManagement: true,     // Garder playlists
        enableMIDIExport: true,             // Garder export MIDI
        enableThemeSwitch: false,           // Pas de switch thème
        enableAdvancedRouting: false,       // Pas de routing avancé
        enableRealTimeRecording: false      // Pas d'enregistrement temps réel
    }
};

// Freeze l'objet pour éviter modifications accidentelles
Object.freeze(PerformanceConfig);

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PerformanceConfig;
}
if (typeof window !== 'undefined') {
    window.PerformanceConfig = PerformanceConfig;
}