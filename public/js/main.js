// ============================================================================
// Fichier: frontend/js/main.js
// Version: v3.4.0 - FIX LOADER NOT HIDING
// Date: 2025-11-11
// Projet: MidiMind v3.1 - Système d'Orchestration MIDI
// ============================================================================
// MODIFICATIONS v3.3.0:
// ✅ CRITIQUE: Initialisation EventBus GLOBAL avant Application
// ✅ Vérification EventBus après initialisation
// ✅ Fix du problème "EventBus is null"
//
// MODIFICATIONS v3.2.0:
// ✅ Ajout d'un timeout pour forcer l'affichage si l'init bloque
// ✅ Affichage de l'interface même si l'initialisation est incomplète
// ✅ Meilleure gestion des erreurs d'initialisation
// ============================================================================


// Attendre que le DOM soit chargé
document.addEventListener('DOMContentLoaded', async () => {
    
    // FORCE: Display #app immediately
    setTimeout(() => {
        const appEl = document.getElementById('app');
        if (appEl) {
            appEl.style.display = 'block';
            console.log('✅ #app force displayed');
        } else {
            console.error('❌ #app NOT FOUND');
        }
    }, 0);
    console.log('🚀 Starting MidiMind v3.1.0 (Performance Mode)...');
    
    try {
        // =====================================================================
        // ÉTAPE 0: VÉRIFIER PERFORMANCE CONFIG
        // =====================================================================
        
        if (typeof PerformanceConfig === 'undefined') {
            throw new Error('PerformanceConfig not loaded! Check index.html script order.');
        }
        
        console.log('✅ PerformanceConfig loaded:', {
            targetFPS: PerformanceConfig.rendering.targetFPS,
            maxHistory: PerformanceConfig.memory.maxHistorySize,
            maxCache: PerformanceConfig.memory.maxCacheSize,
            keyboardMode: PerformanceConfig.keyboard.mode
        });
        
        // =====================================================================
        // ÉTAPE 1: ACTIVER MODE PERFORMANCE
        // =====================================================================
        
        // ✅ Ajouter classe performance-mode au body
        if (!PerformanceConfig.ui.enableTransitions) {
            document.body.classList.add('performance-mode');
            console.log('✅ Performance mode activated (transitions disabled)');
        }
        
        // ✅ Désactiver smooth scroll
        if (!PerformanceConfig.rendering.enableSmoothScrolling) {
            document.documentElement.style.scrollBehavior = 'auto';
            const mainContainer = document.querySelector('.app-main');
            if (mainContainer) {
                mainContainer.style.scrollBehavior = 'auto';
            }
            console.log('✅ Smooth scrolling disabled');
        }
        
        // =====================================================================
        // ÉTAPE 2: VÉRIFIER ET INITIALISER EVENTBUS GLOBAL
        // =====================================================================
        
        if (typeof EventBus === 'undefined') {
            throw new Error('EventBus class not loaded. Check index.html script order.');
        }
        
        // ✅ CRITIQUE: Créer EventBus GLOBAL avant tout le reste
        if (!window.eventBus) {
            window.eventBus = new EventBus();
            console.log('✅ EventBus initialized globally');
        } else {
            console.log('✅ EventBus already exists (reusing existing instance)');
        }
        
        // Vérification de sécurité
        if (!window.eventBus || typeof window.eventBus.emit !== 'function') {
            throw new Error('EventBus initialization failed - invalid instance');
        }
        
        console.log('✅ EventBus verified:', {
            hasOn: typeof window.eventBus.on === 'function',
            hasEmit: typeof window.eventBus.emit === 'function',
            hasOff: typeof window.eventBus.off === 'function'
        });
        
        // =====================================================================
        // ÉTAPE 3: VÉRIFIER APPLICATION CLASS
        // =====================================================================
        
        if (typeof Application === 'undefined') {
            throw new Error('Application class not loaded. Check index.html script order.');
        }
        
        // =====================================================================
        // ÉTAPE 4: CRÉER INSTANCE APPLICATION
        // =====================================================================
        
        const app = new Application();
        
        // Rendre app globale pour accès depuis la console et les autres scripts
        window.app = app;
        console.log('✅ Application instance created');
        
        // Vérification supplémentaire EventBus
        if (!window.eventBus) {
            console.error('❌ CRITICAL: EventBus was lost during Application initialization!');
            throw new Error('EventBus disappeared after Application creation');
        }
        
        // =====================================================================
        // ÉTAPE 5: VÉRIFIER MÉTHODE INIT
        // =====================================================================
        
        if (typeof app.init !== 'function') {
            throw new Error('Application.init() method not found');
        }
        
        // =====================================================================
        // ÉTAPE 6: AFFICHER LOADING INDICATOR
        // =====================================================================
        
        showLoadingIndicator();
        
        // =====================================================================
        // ÉTAPE 7: INITIALISER L'APPLICATION AVEC TIMEOUT
        // =====================================================================
        
        console.log('⚙️ Initializing application...');
        
        // NOUVEAU: Timeout de sécurité pour forcer l'affichage après 5 secondes
        let initTimeout = setTimeout(() => {
            console.warn('⚠️ Initialization timeout - forcing interface display');
            forceShowInterface();
        }, 5000);
        
        try {
            await app.init();
            
            // Annuler le timeout si l'init réussit
            clearTimeout(initTimeout);
            
            // Vérifier que l'initialisation a réussi
            if (!app.state.initialized || !app.state.ready) {
                console.warn('⚠️ Application initialization incomplete - showing interface anyway');
                forceShowInterface();
            } else {
                // =====================================================================
                // ÉTAPE 8: AFFICHER L'INTERFACE & MASQUER LOADING
                // =====================================================================
                
                hideLoadingIndicator();
                
                // CRITIQUE: Afficher l'élément #app qui est caché par défaut
                const appElement = document.getElementById('app');
                if (appElement) {
                    appElement.style.display = 'block';
                    console.log('✅ Application interface displayed');
                } else {
                    console.warn('⚠️ #app element not found in DOM');
                }
                
                console.log('✅ MidiMind v3.1.0 initialized successfully (Performance Mode)');
                console.log('📊 Performance Stats:', {
                    antiAliasing: PerformanceConfig.rendering.enableAntiAliasing ? 'ON' : 'OFF',
                    targetFPS: PerformanceConfig.rendering.targetFPS,
                    maxNotes: PerformanceConfig.rendering.maxVisibleNotes,
                    cacheSize: `${PerformanceConfig.memory.maxCacheSize}MB`,
                    historyLevels: PerformanceConfig.memory.maxHistorySize,
                    keyboardMode: PerformanceConfig.keyboard.mode
                });
                
                // Afficher le récapitulatif des performances
                showPerformanceInfo();
            }
        } catch (initError) {
            // Annuler le timeout en cas d'erreur
            clearTimeout(initTimeout);
            
            console.error('❌ Initialization error:', initError);
            
            // NOUVEAU: Forcer l'affichage même en cas d'erreur d'init
            console.warn('⚠️ Forcing interface display despite initialization error');
            forceShowInterface();
            
            // Re-throw l'erreur pour qu'elle soit capturée par le catch externe
            throw initError;
        }
        
    } catch (error) {
        console.error('❌ Fatal initialization error:', error);
        console.error('Stack trace:', error.stack);
        
        // NOUVEAU: Toujours forcer l'affichage de l'interface
        forceShowInterface();
        
        // Afficher une erreur utilisateur conviviale
        showErrorMessage(
            'Erreur d\'initialisation',
            `Une erreur s'est produite lors du chargement de l'application: ${error.message}`,
            'Veuillez recharger la page ou consulter la console pour plus de détails.'
        );
    }
});

// =============================================================================
// LOADING INDICATOR
// =============================================================================

/**
 * Affiche l'indicateur de chargement
 */
function showLoadingIndicator() {
    const loadingDiv = document.createElement('div');
    loadingDiv.id = 'app-loading';
    loadingDiv.innerHTML = `
        <div class="loading-content">
            <div class="loading-spinner"></div>
            <div class="loading-text">Chargement de MidiMind...</div>
        </div>
    `;
    loadingDiv.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.8);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
    `;
    document.body.appendChild(loadingDiv);
}

/**
 * Masque l'indicateur de chargement
 */
function hideLoadingIndicator() {
    // Retirer le loader dynamique créé par showLoadingIndicator()
    const dynamicLoader = document.getElementById('app-loading');
    if (dynamicLoader) {
        dynamicLoader.remove();
        console.log('✅ Dynamic loader (#app-loading) removed');
    }
    
    // FIX: Retirer aussi le loader statique de l'index.html
    const staticLoader = document.getElementById('loading-indicator');
    if (staticLoader) {
        staticLoader.remove();
        console.log('✅ Static loader (#loading-indicator) removed');
    }
}

/**
 * NOUVEAU: Force l'affichage de l'interface même si l'init échoue
 */
function forceShowInterface() {
    console.log('🔧 Forcing interface display...');
    
    // Masquer le loading
    hideLoadingIndicator();
    
    // Afficher #app
    const appElement = document.getElementById('app');
    if (appElement) {
        appElement.style.display = 'block';
        console.log('✅ #app forced to display');
    } else {
        console.error('❌ #app element not found - cannot force display');
    }
    
    // Afficher la navigation au minimum
    const nav = document.querySelector('.app-nav');
    if (nav) {
        nav.style.display = 'block';
        console.log('✅ Navigation forced to display');
    }
    
    console.log('✅ Interface forced to display (degraded mode)');
}

// =============================================================================
// ERROR DISPLAY
// =============================================================================

/**
 * Affiche un message d'erreur convivial
 */
function showErrorMessage(title, message, details) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.innerHTML = `
        <div class="error-content">
            <h2>❌ ${title}</h2>
            <p>${message}</p>
            ${details ? `<p class="error-details">${details}</p>` : ''}
            <button onclick="location.reload()">Recharger la page</button>
        </div>
    `;
    errorDiv.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: white;
        padding: 2rem;
        border-radius: 8px;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        z-index: 10001;
        max-width: 500px;
    `;
    document.body.appendChild(errorDiv);
}

// =============================================================================
// PERFORMANCE INFO DISPLAY
// =============================================================================

/**
 * Affiche les informations de performance dans la console
 */
function showPerformanceInfo() {
    const info = `
╔══════════════════════════════════════════════════╗
║                                                  ║
║  🎵 MidiMind v3.1.0 - Performance Mode Activé    ║
║                                                  ║
╠══════════════════════════════════════════════════╣
║                                                  ║
║  RENDERING                                       ║
║  • FPS target: ${PerformanceConfig.rendering.targetFPS.toString().padEnd(36)} ║
║  • Max notes: ${PerformanceConfig.rendering.maxVisibleNotes.toString().padEnd(37)} ║
║  • Anti-aliasing: ${(PerformanceConfig.rendering.enableAntiAliasing ? 'ON' : 'OFF').padEnd(31)} ║
║  • Smooth scroll: ${(PerformanceConfig.rendering.enableSmoothScrolling ? 'ON' : 'OFF').padEnd(31)} ║
║                                                  ║
║  MEMORY                                          ║
║  • Max cache: ${PerformanceConfig.memory.maxCacheSize.toString().padEnd(36)} MB ║
║  • History levels: ${PerformanceConfig.memory.maxHistorySize.toString().padEnd(31)} ║
║  • Aggressive GC: ${(PerformanceConfig.memory.aggressiveGC ? 'ON' : 'OFF').padEnd(34)} ║
║                                                  ║
║  KEYBOARD                                        ║
║  • Mode: ${PerformanceConfig.keyboard.mode.padEnd(43)} ║
║  • Recording: ${(PerformanceConfig.keyboard.enableRecording ? 'ON' : 'OFF').padEnd(38)} ║
║  • Playback: ${(PerformanceConfig.keyboard.enablePlayback ? 'ON' : 'OFF').padEnd(39)} ║
║                                                  ║
║  ROUTING                                         ║
║  • Complex routing: ${(PerformanceConfig.routing.allowComplexRouting ? 'ON' : 'OFF').padEnd(30)} ║
║  • Auto-assign: ${(PerformanceConfig.routing.enableAutoRouting ? 'ON' : 'OFF').padEnd(36)} ║
║  • Max routes: ${PerformanceConfig.routing.maxRoutes.toString().padEnd(37)} ║
║                                                  ║
╠══════════════════════════════════════════════════╣
║                                                  ║
║  💡 Tips:                                        ║
║  • Utilisez window.app pour accéder à l'application ║
║  • Utilisez window.eventBus pour l'EventBus global  ║
║  • Utilisez window.PerformanceConfig pour config    ║
║  • Pressez F12 pour ouvrir DevTools             ║
║                                                  ║
╚══════════════════════════════════════════════════╝
    `;
    
    console.log(info);
    
    // Ajouter également des métadonnées pour debug
    console.group('🔍 Performance Configuration Details');
    console.log('Rendering:', PerformanceConfig.rendering);
    console.log('Memory:', PerformanceConfig.memory);
    console.log('Editor:', PerformanceConfig.editor);
    console.log('Routing:', PerformanceConfig.routing);
    console.log('Keyboard:', PerformanceConfig.keyboard);
    console.log('UI:', PerformanceConfig.ui);
    console.log('Features:', PerformanceConfig.features);
    console.groupEnd();
}

// =============================================================================
// GESTION ERREURS GLOBALES
// =============================================================================

// Capturer les erreurs non gérées
window.addEventListener('error', (event) => {
    const errorMessage = event.error && event.error.message 
        ? event.error.message 
        : (event.message || 'Unknown error');
    
    // Ignorer erreur ResizeObserver (bénigne)
    if (errorMessage.includes('ResizeObserver')) {
        return;
    }
    
    console.error('🔴 Unhandled error:', event.error || errorMessage);
    
    if (window.app && window.app.debugConsole) {
        window.app.debugConsole.log('error', 
            `Unhandled error: ${errorMessage}`, 
            'error'
        );
    }
});

// Capturer les promesses rejetées
window.addEventListener('unhandledrejection', (event) => {
    console.error('🔴 Unhandled promise rejection:', event.reason);
    
    if (window.app && window.app.debugConsole) {
        window.app.debugConsole.log('error', 
            `Unhandled rejection: ${event.reason}`, 
            'error'
        );
    }
});

// =============================================================================
// UTILITAIRES DE DEBUG (accessibles depuis console)
// =============================================================================

window.debugUtils = {
    /**
     * Affiche l'état actuel de l'application
     */
    showAppState() {
        if (!window.app) {
            console.warn('Application not initialized yet');
            return;
        }
        
        console.group('📱 Application State');
        console.log('Current Page:', window.location.hash || '#home');
        console.log('Initialized:', window.app.state?.initialized || false);
        console.log('Ready:', window.app.state?.ready || false);
        console.log('Backend Connected:', window.app.state?.backendConnected || false);
        console.log('Offline Mode:', window.app.state?.offlineMode || false);
        console.log('Models:', Object.keys(window.app.models || {}));
        console.log('Controllers:', Object.keys(window.app.controllers || {}));
        console.log('Views:', Object.keys(window.app.views || {}));
        console.groupEnd();
    },
    
    /**
     * Affiche les statistiques de performance
     */
    showPerformanceStats() {
        const stats = {
            memory: performance.memory ? {
                used: `${(performance.memory.usedJSHeapSize / 1024 / 1024).toFixed(2)} MB`,
                total: `${(performance.memory.totalJSHeapSize / 1024 / 1024).toFixed(2)} MB`,
                limit: `${(performance.memory.jsHeapSizeLimit / 1024 / 1024).toFixed(2)} MB`
            } : 'Not available',
            timing: performance.timing ? {
                loadTime: `${performance.timing.loadEventEnd - performance.timing.navigationStart} ms`,
                domReady: `${performance.timing.domContentLoadedEventEnd - performance.timing.navigationStart} ms`
            } : 'Not available'
        };
        
        console.group('📊 Performance Statistics');
        console.table(stats);
        console.groupEnd();
    },
    
    /**
     * Toggle mode performance
     */
    togglePerformanceMode() {
        document.body.classList.toggle('performance-mode');
        const isActive = document.body.classList.contains('performance-mode');
        console.log(`Performance mode: ${isActive ? 'ON' : 'OFF'}`);
    },
    
    /**
     * Force garbage collection (si disponible)
     */
    forceGC() {
        if (window.gc) {
            console.log('🗑️ Running garbage collection...');
            window.gc();
            console.log('✅ GC complete');
        } else {
            console.warn('GC not available. Start Chrome with --expose-gc flag.');
        }
    },
    
    /**
     * Force l'affichage de l'interface
     */
    forceShowInterface() {
        forceShowInterface();
    },
    
    /**
     * Vérifie l'état d'EventBus
     */
    checkEventBus() {
        console.group('🔌 EventBus Status');
        console.log('Exists:', !!window.eventBus);
        console.log('Type:', typeof window.eventBus);
        if (window.eventBus) {
            console.log('Has emit:', typeof window.eventBus.emit === 'function');
            console.log('Has on:', typeof window.eventBus.on === 'function');
            console.log('Has off:', typeof window.eventBus.off === 'function');
            console.log('Listeners count:', Object.keys(window.eventBus.listeners || {}).length);
        }
        console.groupEnd();
    }
};

// Afficher les utilitaires disponibles
console.log('🔧 Debug utilities available: window.debugUtils');
console.log('   • showAppState()');
console.log('   • showPerformanceStats()');
console.log('   • togglePerformanceMode()');
console.log('   • forceGC()');
console.log('   • forceShowInterface()');
console.log('   • checkEventBus()');