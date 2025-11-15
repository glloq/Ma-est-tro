// ============================================================================
// Fichier: frontend/js/models/RoutingModel.js
// Chemin réel: frontend/js/models/RoutingModel.js
// Version: v4.2.2 - API CONFORME v4.2.2
// Date: 2025-11-02
// ============================================================================
// CORRECTIONS v4.2.2:
// ✅ get_routing → routing.listRoutes
// ✅ add_route → routing.addRoute
// ✅ remove_route → routing.removeRoute
// ✅ clear_routes → routing.clearRoutes
// ✅ enable_route → routing.enableRoute
// ✅ disable_route → routing.disableRoute
// ✅ Format API v4.2.2 complet + response.data extraction
// ============================================================================

class RoutingModel extends BaseModel {
    constructor(eventBus, backend, logger, initialData = {}, options = {}) {
        super(eventBus, backend, logger, initialData, {
            persistKey: 'routingmodel',
            eventPrefix: 'routing',
            autoPersist: false,
            ...options
        });
        
        // Initialiser les routes
        this.data.routes = initialData.routes || [];
        
        this.log('debug', 'RoutingModel', '✓ RoutingModel v4.2.2 initialized (API v4.2.2)');
    }
    
    // ========================================================================
    // GESTION DES ROUTES - API v4.2.2
    // ========================================================================
    
    /**
     * Liste toutes les routes configurées
     * ✅ API v4.2.2: routing.listRoutes
     */
    async listRoutes() {
        if (!this.backend || !this.backend.isConnected()) {
            this.log('warn', 'RoutingModel.listRoutes', 'Backend not connected');
            return [];
        }
        
        try {
            // ✅ Nouvelle commande API v4.2.2
            const response = await this.backend.sendCommand('routing.listRoutes');
            const data = response.data || response;
            
            if (data && data.routes) {
                this.data.routes = data.routes;
                this.emit('routes:updated', { routes: this.data.routes });
                return this.data.routes;
            }
            
            return [];
        } catch (error) {
            this.log('error', 'RoutingModel.listRoutes', error.message);
            return [];
        }
    }
    
    /**
     * Ajoute une nouvelle route
     * ✅ API v4.2.2: routing.addRoute
     * @param {string} sourceId - ID du périphérique source
     * @param {string} destId - ID du périphérique destination
     * @param {number} channel - Canal MIDI (optionnel, null = tous les canaux)
     */
    async addRoute(sourceId, destId, channel = null) {
        if (!this.backend || !this.backend.isConnected()) {
            this.log('warn', 'RoutingModel.addRoute', 'Backend not connected');
            return false;
        }
        
        try {
            // ✅ Nouvelle commande API v4.2.2
            const params = { 
                source_id: sourceId, 
                dest_id: destId 
            };
            
            if (channel !== null) {
                params.channel = channel;
            }
            
            const response = await this.backend.sendCommand('routing.addRoute', params);
            const data = response.data || response;
            
            if (data && data.success) {
                // Recharger la liste des routes
                await this.listRoutes();
                this.emit('route:added', { sourceId, destId, channel });
                return true;
            }
            
            return false;
        } catch (error) {
            this.log('error', 'RoutingModel.addRoute', error.message);
            return false;
        }
    }
    
    /**
     * Supprime une route existante
     * ✅ API v4.2.2: routing.removeRoute
     * @param {string} sourceId - ID du périphérique source
     * @param {string} destId - ID du périphérique destination
     * @param {number} channel - Canal MIDI (optionnel)
     */
    async removeRoute(sourceId, destId, channel = null) {
        if (!this.backend || !this.backend.isConnected()) {
            this.log('warn', 'RoutingModel.removeRoute', 'Backend not connected');
            return false;
        }
        
        try {
            // ✅ Nouvelle commande API v4.2.2
            const params = { 
                source_id: sourceId, 
                dest_id: destId 
            };
            
            if (channel !== null) {
                params.channel = channel;
            }
            
            const response = await this.backend.sendCommand('routing.removeRoute', params);
            const data = response.data || response;
            
            if (data && data.success) {
                // Recharger la liste des routes
                await this.listRoutes();
                this.emit('route:removed', { sourceId, destId, channel });
                return true;
            }
            
            return false;
        } catch (error) {
            this.log('error', 'RoutingModel.removeRoute', error.message);
            return false;
        }
    }
    
    /**
     * Efface toutes les routes
     * ✅ API v4.2.2: routing.clearRoutes
     */
    async clearRoutes() {
        if (!this.backend || !this.backend.isConnected()) {
            this.log('warn', 'RoutingModel.clearRoutes', 'Backend not connected');
            return false;
        }
        
        try {
            // ✅ Nouvelle commande API v4.2.2
            const response = await this.backend.sendCommand('routing.clearRoutes');
            const data = response.data || response;
            
            if (data && data.success) {
                this.data.routes = [];
                this.emit('routes:cleared');
                return true;
            }
            
            return false;
        } catch (error) {
            this.log('error', 'RoutingModel.clearRoutes', error.message);
            return false;
        }
    }
    
    /**
     * Active une route
     * ✅ API v4.2.2: routing.enableRoute
     * @param {string} sourceId - ID du périphérique source
     * @param {string} destId - ID du périphérique destination
     */
    async enableRoute(sourceId, destId) {
        if (!this.backend || !this.backend.isConnected()) {
            this.log('warn', 'RoutingModel.enableRoute', 'Backend not connected');
            return false;
        }
        
        try {
            // ✅ Nouvelle commande API v4.2.2
            const response = await this.backend.sendCommand('routing.enableRoute', {
                source_id: sourceId,
                dest_id: destId
            });
            const data = response.data || response;
            
            if (data && data.success) {
                await this.listRoutes();
                this.emit('route:enabled', { sourceId, destId });
                return true;
            }
            
            return false;
        } catch (error) {
            this.log('error', 'RoutingModel.enableRoute', error.message);
            return false;
        }
    }
    
    /**
     * Désactive une route
     * ✅ API v4.2.2: routing.disableRoute
     * @param {string} sourceId - ID du périphérique source
     * @param {string} destId - ID du périphérique destination
     */
    async disableRoute(sourceId, destId) {
        if (!this.backend || !this.backend.isConnected()) {
            this.log('warn', 'RoutingModel.disableRoute', 'Backend not connected');
            return false;
        }
        
        try {
            // ✅ Nouvelle commande API v4.2.2
            const response = await this.backend.sendCommand('routing.disableRoute', {
                source_id: sourceId,
                dest_id: destId
            });
            const data = response.data || response;
            
            if (data && data.success) {
                await this.listRoutes();
                this.emit('route:disabled', { sourceId, destId });
                return true;
            }
            
            return false;
        } catch (error) {
            this.log('error', 'RoutingModel.disableRoute', error.message);
            return false;
        }
    }
    
    // ========================================================================
    // MÉTHODES LOCALES (GETTERS)
    // ========================================================================
    
    /**
     * Retourne toutes les routes
     */
    getRoutes() {
        return this.data.routes;
    }
    
    /**
     * Recherche une route spécifique
     */
    findRoute(sourceId, destId) {
        return this.data.routes.find(r => 
            r.source_id === sourceId && r.dest_id === destId
        );
    }
    
    /**
     * Retourne les routes pour une source donnée
     */
    getRoutesForSource(sourceId) {
        return this.data.routes.filter(r => r.source_id === sourceId);
    }
    
    /**
     * Retourne les routes pour une destination donnée
     */
    getRoutesForDestination(destId) {
        return this.data.routes.filter(r => r.dest_id === destId);
    }
    
    /**
     * Vérifie si une route existe
     */
    hasRoute(sourceId, destId) {
        return this.data.routes.some(r => 
            r.source_id === sourceId && r.dest_id === destId
        );
    }
    
    /**
     * Compte le nombre de routes
     */
    getRouteCount() {
        return this.data.routes.length;
    }
    
    /**
     * Vérifie si une route est active
     */
    isRouteEnabled(sourceId, destId) {
        const route = this.findRoute(sourceId, destId);
        return route ? route.enabled !== false : false;
    }
}

// ============================================================================
// EXPORT
// ============================================================================

if (typeof module !== 'undefined' && module.exports) {
    module.exports = RoutingModel;
}

if (typeof window !== 'undefined') {
    window.RoutingModel = RoutingModel;
}