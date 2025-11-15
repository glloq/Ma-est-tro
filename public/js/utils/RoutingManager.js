// ============================================================================
// Fichier: frontend/js/utils/RoutingManager.js
// Version: v3.1.0 - PERFORMANCE OPTIMIZED (SIMPLIFIED)
// Date: 2025-10-16
// Projet: MidiMind v3.0 - SystÃ¨me d'Orchestration MIDI
// ============================================================================
// MODIFICATIONS v3.1.0:
// âœ“ Uniquement routing 1â†’1 (suppression topologies complexes)
// âœ“ Suppression calcul compatibilitÃ©
// âœ“ Auto-assign simple (round-robin)
// âœ“ Pas de rÃ©solution de conflits
// ============================================================================

class RoutingManager {
    constructor(eventBus, debugConsole) {
        this.eventBus = eventBus || window.eventBus || null;
        this.debugConsole = debugConsole;
        
        // Configuration du routage (SIMPLIFIÃ‰)
        this.config = {
            allowComplexRouting: PerformanceConfig.routing.allowComplexRouting || false,  // âœ“ DÃ‰SACTIVÃ‰
            enableAutoRouting: PerformanceConfig.routing.enableAutoRouting || true,
            maxRoutes: PerformanceConfig.routing.maxRoutes || 16,
            enableCompatibilityScoring: PerformanceConfig.routing.enableCompatibilityScoring || false,  // âœ“ DÃ‰SACTIVÃ‰
            enableConflictResolution: PerformanceConfig.routing.enableConflictResolution || false  // âœ“ DÃ‰SACTIVÃ‰
        };
        
        // Types de routes (SIMPLIFIÃ‰)
        this.ROUTE_TYPES = {
            STANDARD: '1:1'  // âœ“ Uniquement 1â†’1
        };
        
        // DonnÃ©es
        this.routes = new Map();  // routeId â†’ Route
        this.channelToRoute = new Map();  // channel â†’ routeId
        this.instrumentToRoutes = new Map();  // instrumentId â†’ Set<routeId>
        
        this.midiChannels = [];
        this.instruments = [];
        this.presets = [];
        
        // Ã‰tat
        this.isValid = false;
        this.nextRouteId = 1;
        
        // Statistiques
        this.stats = {
            totalRoutes: 0,
            activeRoutes: 0,
            assignedChannels: 0,
            unassignedChannels: 0,
            autoAssignments: 0
        };
        
        this.logDebug('routing', 'âœ“ RoutingManager initialized (simple 1:1 mode)');
    }
    
    // ========================================================================
    // INITIALISATION
    // ========================================================================
    
    setChannels(channels) {
        this.midiChannels = channels || [];
        this.updateStats();
        this.logDebug('routing', `Channels set: ${this.midiChannels.length}`);
    }
    
    setInstruments(instruments) {
        this.instruments = instruments || [];
        this.updateStats();
        this.logDebug('routing', `Instruments set: ${this.instruments.length}`);
    }
    
    // ========================================================================
    // CRÃ‰ATION ROUTE SIMPLE (1â†’1)
    // ========================================================================
    
    createRoute(channel, instrumentId) {
        // Validation simple
        if (!this.isValidChannel(channel)) {
            this.logDebug('routing', `Invalid channel: ${channel}`, 'error');
            return null;
        }
        
        if (!this.isValidInstrument(instrumentId)) {
            this.logDebug('routing', `Invalid instrument: ${instrumentId}`, 'error');
            return null;
        }
        
        // Supprimer route existante pour ce canal (1â†’1 strict)
        const existingRoute = this.getRouteForChannel(channel);
        if (existingRoute) {
            this.removeRoute(existingRoute.id);
            this.logDebug('routing', `Removed existing route for channel ${channel}`);
        }
        
        // CrÃ©er route simple 1â†’1
        const route = {
            id: this.generateRouteId(),
            type: this.ROUTE_TYPES.STANDARD,
            channel: channel,
            instrument: instrumentId,
            enabled: true,
            created: Date.now()
        };
        
        // Ajouter aux maps
        this.routes.set(route.id, route);
        this.channelToRoute.set(channel, route.id);
        
        // Index instrument
        if (!this.instrumentToRoutes.has(instrumentId)) {
            this.instrumentToRoutes.set(instrumentId, new Set());
        }
        this.instrumentToRoutes.get(instrumentId).add(route.id);
        
        this.updateStats();
        
        // Ã‰vÃ©nement
        this.eventBus.emit('routing:route-added', route);
        
        this.logDebug('routing', `Route created: CH${channel} â†’ ${instrumentId}`);
        
        return route;
    }
    
    // ========================================================================
    // SUPPRESSION ROUTE
    // ========================================================================
    
    removeRoute(routeId) {
        const route = this.routes.get(routeId);
        
        if (!route) {
            this.logDebug('routing', `Route not found: ${routeId}`, 'warn');
            return false;
        }
        
        // Retirer des maps
        this.routes.delete(routeId);
        this.channelToRoute.delete(route.channel);
        
        const instRoutes = this.instrumentToRoutes.get(route.instrument);
        if (instRoutes) {
            instRoutes.delete(routeId);
            if (instRoutes.size === 0) {
                this.instrumentToRoutes.delete(route.instrument);
            }
        }
        
        this.updateStats();
        
        // Ã‰vÃ©nement
        this.eventBus.emit('routing:route-removed', { routeId, route });
        
        this.logDebug('routing', `Route removed: ${routeId}`);
        
        return true;
    }
    
    clearAllRoutes() {
        const count = this.routes.size;
        
        this.routes.clear();
        this.channelToRoute.clear();
        this.instrumentToRoutes.clear();
        
        this.updateStats();
        
        this.eventBus.emit('routing:routes-cleared', { count });
        
        this.logDebug('routing', `All routes cleared (${count})`);
    }
    
    // ========================================================================
    // AUTO-ASSIGN SIMPLE (ROUND-ROBIN)
    // ========================================================================
    
    autoAssign(channels) {
        if (!this.config.enableAutoRouting) {
            this.logDebug('routing', 'Auto-routing disabled', 'warn');
            return [];
        }
        
        channels = channels || this.midiChannels;
        
        if (!channels || channels.length === 0) {
            this.logDebug('routing', 'No channels to assign', 'warn');
            return [];
        }
        
        // Filtrer instruments connectÃ©s uniquement
        const availableInstruments = this.instruments.filter(i => i.connected);
        
        if (availableInstruments.length === 0) {
            this.logDebug('routing', 'No instruments available', 'warn');
            return [];
        }
        
        const assignments = [];
        
        // Simple round-robin
        channels.forEach((channel, index) => {
            const channelNumber = typeof channel === 'object' ? channel.number : channel;
            const instrument = availableInstruments[index % availableInstruments.length];
            
            const route = this.createRoute(channelNumber, instrument.id);
            
            if (route) {
                assignments.push(route);
                this.stats.autoAssignments++;
            }
        });
        
        this.logDebug('routing', `Auto-assigned ${assignments.length} routes (round-robin)`);
        
        this.eventBus.emit('routing:auto-assigned', {
            assignments,
            count: assignments.length
        });
        
        return assignments;
    }
    
    // ========================================================================
    // VALIDATION (SIMPLIFIÃ‰)
    // ========================================================================
    
    isValidChannel(channel) {
        const channelNumber = typeof channel === 'object' ? channel.number : channel;
        return typeof channelNumber === 'number' && 
               channelNumber >= 0 && 
               channelNumber <= 15;
    }
    
    isValidInstrument(instrumentId) {
        if (!instrumentId) return false;
        
        const instrument = this.instruments.find(i => i.id === instrumentId);
        return instrument && instrument.connected;
    }
    
    validateRouting() {
        // Validation simple : vÃ©rifier que toutes les routes sont valides
        let valid = true;
        
        for (const route of this.routes.values()) {
            if (!this.isValidChannel(route.channel)) {
                this.logDebug('routing', `Invalid channel in route ${route.id}`, 'error');
                valid = false;
            }
            
            if (!this.isValidInstrument(route.instrument)) {
                this.logDebug('routing', `Invalid instrument in route ${route.id}`, 'error');
                valid = false;
            }
        }
        
        this.isValid = valid;
        return valid;
    }
    
    // ========================================================================
    // GETTERS
    // ========================================================================
    
    getRouteForChannel(channel) {
        const routeId = this.channelToRoute.get(channel);
        return routeId ? this.routes.get(routeId) : null;
    }
    
    getRoutesForInstrument(instrumentId) {
        const routeIds = this.instrumentToRoutes.get(instrumentId);
        if (!routeIds) return [];
        
        return Array.from(routeIds).map(id => this.routes.get(id)).filter(r => r);
    }
    
    getAllRoutes() {
        return Array.from(this.routes.values());
    }
    
    getActiveRoutes() {
        return this.getAllRoutes().filter(r => r.enabled);
    }
    
    getRouteById(routeId) {
        return this.routes.get(routeId);
    }
    
    // ========================================================================
    // ACTIVATION/DÃ‰SACTIVATION
    // ========================================================================
    
    enableRoute(routeId) {
        const route = this.routes.get(routeId);
        if (!route) return false;
        
        route.enabled = true;
        this.updateStats();
        
        this.eventBus.emit('routing:route-enabled', { routeId });
        
        return true;
    }
    
    disableRoute(routeId) {
        const route = this.routes.get(routeId);
        if (!route) return false;
        
        route.enabled = false;
        this.updateStats();
        
        this.eventBus.emit('routing:route-disabled', { routeId });
        
        return true;
    }
    
    // ========================================================================
    // PRESETS (SIMPLIFIÃ‰)
    // ========================================================================
    
    savePreset(name) {
        const preset = {
            id: `preset_${Date.now()}`,
            name: name,
            routes: this.getAllRoutes().map(r => ({
                channel: r.channel,
                instrument: r.instrument
            })),
            created: Date.now()
        };
        
        this.presets.push(preset);
        
        // Limiter nombre de presets
        if (this.presets.length > PerformanceConfig.routing.maxPresets) {
            this.presets.shift();
        }
        
        this.eventBus.emit('routing:preset-saved', { preset });
        
        this.logDebug('routing', `Preset saved: ${name}`);
        
        return preset;
    }
    
    loadPreset(presetId) {
        const preset = this.presets.find(p => p.id === presetId);
        
        if (!preset) {
            this.logDebug('routing', `Preset not found: ${presetId}`, 'warn');
            return false;
        }
        
        // Effacer routes existantes
        this.clearAllRoutes();
        
        // RecrÃ©er routes du preset
        preset.routes.forEach(r => {
            this.createRoute(r.channel, r.instrument);
        });
        
        this.eventBus.emit('routing:preset-loaded', { preset });
        
        this.logDebug('routing', `Preset loaded: ${preset.name}`);
        
        return true;
    }
    
    getPresets() {
        return this.presets;
    }
    
    // ========================================================================
    // STATISTIQUES
    // ========================================================================
    
    updateStats() {
        this.stats.totalRoutes = this.routes.size;
        this.stats.activeRoutes = this.getActiveRoutes().length;
        this.stats.assignedChannels = this.channelToRoute.size;
        this.stats.unassignedChannels = this.midiChannels.length - this.stats.assignedChannels;
    }
    
    getStats() {
        return { ...this.stats };
    }
    
    getState() {
        return {
            totalRoutes: this.routes.size,
            activeRoutes: this.getActiveRoutes().length,
            assignedChannels: this.channelToRoute.size,
            unassignedChannels: this.stats.unassignedChannels,
            isValid: this.isValid,
            mode: '1:1'  // Mode simple uniquement
        };
    }
    
    // ========================================================================
    // UTILITAIRES
    // ========================================================================
    
    generateRouteId() {
        return `route_${this.nextRouteId++}`;
    }
    
    logDebug(category, message, level = 'info') {
        if (this.debugConsole) {
            this.debugConsole.log(category, message, level);
        }
    }
    
    // ========================================================================
    // EXPORT/IMPORT
    // ========================================================================
    
    exportRouting() {
        return {
            version: '3.1.0',
            type: 'simple_1_to_1',
            routes: this.getAllRoutes(),
            stats: this.getStats(),
            exported: Date.now()
        };
    }
    
    importRouting(data) {
        if (!data || !data.routes) {
            this.logDebug('routing', 'Invalid routing data', 'error');
            return false;
        }
        
        this.clearAllRoutes();
        
        data.routes.forEach(route => {
            this.createRoute(route.channel, route.instrument);
        });
        
        this.logDebug('routing', `Imported ${data.routes.length} routes`);
        
        return true;
    }
    
    // ========================================================================
    // DESTRUCTION
    // ========================================================================
    
    destroy() {
        this.clearAllRoutes();
        this.midiChannels = [];
        this.instruments = [];
        this.presets = [];
        
        this.logDebug('routing', 'âœ“ RoutingManager destroyed');
    }
}

// ============================================================================
// EXPORT
// ============================================================================

if (typeof module !== 'undefined' && module.exports) {
    module.exports = RoutingManager;
}

if (typeof window !== 'undefined') {
    window.RoutingManager = RoutingManager;
}
window.RoutingManager = RoutingManager;