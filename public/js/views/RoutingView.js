// ============================================================================
// Fichier: frontend/js/views/RoutingView.js
// Version: v4.1.0 - SIGNATURE CORRIGÉE (HÉRITE DE BASEVIEW)
// Date: 2025-11-04
// ============================================================================
// CORRECTIONS v4.1.0:
// ✅ CRITIQUE: RoutingView hérite maintenant de BaseView
// ✅ Appel super(containerId, eventBus) au début du constructeur
// ✅ Suppression réimplémentation manuelle de resolveContainer
// ✅ Accès aux méthodes BaseView (render, update, show, hide, emit, etc.)
// ============================================================================
// AMÉLIORATIONS v4.0.0:
// ✦ API v4.2.2: routing.* (addRoute, removeRoute, clearRoutes, listRoutes, enableRoute, disableRoute)
// ✦ Matrice de routage interactive
// ✦ Gestion enable/disable routes
// ============================================================================

class RoutingView extends BaseView {
    constructor(containerId, eventBus) {
        // ✅ NOUVEAU: Appel super() pour hériter de BaseView
        super(containerId, eventBus);
        
        // ✅ this.container et this.eventBus déjà initialisés par BaseView
        this.logger = window.logger || console;
        
// État
        this.state = {
            routes: [],
            sources: [], // devices sources
            destinations: [], // devices destinations
            selectedSource: null,
            selectedDestination: null
        };
        
        this.elements = {};
    }

    // ========================================================================
    // INITIALISATION
    // ========================================================================

    init() {
        if (!this.container) {
            this.logger.error('[RoutingView] Cannot initialize');
            return;
        }
        
        this.render();
        this.cacheElements();
        this.attachEvents();
        this.loadRoutes();
        this.loadDevices();
        
        this.logger.info('[RoutingView] Initialized v4.0.1');
    }

    render() {
        if (!this.container) return;
        
        this.container.innerHTML = `
            <div class="page-header">
                <h1>🔀 Routage MIDI</h1>
                <div class="header-actions">
                    <button class="btn-clear-all" data-action="clear-all">
                        🗑️ Tout effacer
                    </button>
                    <button class="btn-refresh" data-action="refresh">
                        🔄 Actualiser
                    </button>
                </div>
            </div>
            
            <div class="routing-layout">
                <!-- Matrice de routage -->
                <div class="routing-matrix-container">
                    <h2>Matrice de routage</h2>
                    <div id="routingMatrix">
                        ${this.renderMatrix()}
                    </div>
                </div>
                
                <!-- Nouvelle route -->
                <div class="routing-create">
                    <h2>Créer une route</h2>
                    <div class="create-form">
                        <div class="form-group">
                            <label>Source:</label>
                            <select id="sourceSelect" data-action="select-source">
                                <option value="">-- Sélectionner --</option>
                                ${this.state.sources.map(src => `
                                    <option value="${src.id}">${src.name}</option>
                                `).join('')}
                            </select>
                        </div>
                        
                        <div class="form-group">
                            <label>Destination:</label>
                            <select id="destinationSelect" data-action="select-destination">
                                <option value="">-- Sélectionner --</option>
                                ${this.state.destinations.map(dst => `
                                    <option value="${dst.id}">${dst.name}</option>
                                `).join('')}
                            </select>
                        </div>
                        
                        <button class="btn-create-route" data-action="create-route">
                            ➕ Créer la route
                        </button>
                    </div>
                </div>
                
                <!-- Liste des routes -->
                <div class="routing-list">
                    <h2>Routes actives</h2>
                    <div id="routesList">
                        ${this.renderRoutesList()}
                    </div>
                </div>
            </div>
        `;
    }

    cacheElements() {
        this.elements = {
            routingMatrix: document.getElementById('routingMatrix'),
            routesList: document.getElementById('routesList'),
            sourceSelect: document.getElementById('sourceSelect'),
            destinationSelect: document.getElementById('destinationSelect')
        };
    }

    attachEvents() {
        if (!this.container) return;
        
        this.container.addEventListener('click', (e) => {
            const action = e.target.closest('[data-action]')?.dataset.action;
            if (!action) return;
            
            const routeItem = e.target.closest('.route-item');
            
            switch (action) {
                case 'refresh':
                    this.loadRoutes();
                    break;
                case 'clear-all':
                    this.clearAllRoutes();
                    break;
                case 'create-route':
                    this.createRoute();
                    break;
                case 'delete-route':
                    if (routeItem) this.deleteRoute(routeItem.dataset.routeId);
                    break;
                case 'toggle-route':
                    if (routeItem) this.toggleRoute(routeItem.dataset.routeId, routeItem.dataset.enabled === 'true');
                    break;
            }
        });
        
        this.container.addEventListener('change', (e) => {
            const action = e.target.dataset.action;
            
            if (action === 'select-source') {
                this.state.selectedSource = e.target.value;
            } else if (action === 'select-destination') {
                this.state.selectedDestination = e.target.value;
            }
        });
        
        this.setupEventBusListeners();
    }

    setupEventBusListeners() {
        if (!this.eventBus) return;
        
        // routing.listRoutes response
        this.eventBus.on('routes:listed', (data) => {
            this.state.routes = data.routes || [];
            this.renderRoutesSection();
            this.renderMatrixSection();
        });
        
        // routing.addRoute response
        this.eventBus.on('route:added', (data) => {
            this.logger.info('[RoutingView] Route added');
            this.loadRoutes();
        });
        
        // routing.removeRoute response
        this.eventBus.on('route:removed', (data) => {
            this.logger.info('[RoutingView] Route removed');
            this.loadRoutes();
        });
        
        // routing.clearRoutes response
        this.eventBus.on('routes:cleared', (data) => {
            this.logger.info('[RoutingView] All routes cleared');
            this.loadRoutes();
        });
        
        // routing.enableRoute / disableRoute response
        this.eventBus.on('route:toggled', (data) => {
            this.logger.info('[RoutingView] Route toggled');
            this.loadRoutes();
        });
        
        // devices.list response pour sources/destinations
        this.eventBus.on('devices:listed', (data) => {
            const devices = data.devices || [];
            this.state.sources = devices.filter(d => d.status === 2); // Connected
            this.state.destinations = devices.filter(d => d.status === 2);
            this.render();
        });
    }

    // ========================================================================
    // RENDERING - MATRIX
    // ========================================================================

    renderMatrix() {
        const sources = this.state.sources;
        const destinations = this.state.destinations;
        const routes = this.state.routes;
        
        if (sources.length === 0 || destinations.length === 0) {
            return `
                <div class="matrix-empty">
                    <p>Connectez des devices pour voir la matrice</p>
                </div>
            `;
        }
        
        return `
            <div class="matrix-grid">
                <div class="matrix-header">
                    <div class="matrix-corner"></div>
                    ${destinations.map(dst => `
                        <div class="matrix-col-header">${dst.name}</div>
                    `).join('')}
                </div>
                ${sources.map(src => `
                    <div class="matrix-row">
                        <div class="matrix-row-header">${src.name}</div>
                        ${destinations.map(dst => {
                            const route = routes.find(r => 
                                r.source_id === src.id && r.destination_id === dst.id
                            );
                            const isConnected = !!route;
                            const isEnabled = route && route.enabled !== false;
                            
                            return `
                                <div class="matrix-cell ${isConnected ? 'connected' : ''} ${!isEnabled ? 'disabled' : ''}"
                                     data-source="${src.id}" 
                                     data-destination="${dst.id}">
                                    ${isConnected ? (isEnabled ? '✓' : '●') : ''}
                                </div>
                            `;
                        }).join('')}
                    </div>
                `).join('')}
            </div>
        `;
    }

    renderMatrixSection() {
        if (this.elements.routingMatrix) {
            this.elements.routingMatrix.innerHTML = this.renderMatrix();
        }
    }

    // ========================================================================
    // RENDERING - ROUTES LIST
    // ========================================================================

    renderRoutesList() {
        const routes = this.state.routes;
        
        if (routes.length === 0) {
            return `
                <div class="routes-empty">
                    <p>Aucune route configurée</p>
                </div>
            `;
        }
        
        return `
            <div class="routes-list">
                ${routes.map(route => this.renderRouteItem(route)).join('')}
            </div>
        `;
    }

    renderRouteItem(route) {
        const isEnabled = route.enabled !== false;
        const routeId = `${route.source_id}_${route.destination_id}`;
        
        return `
            <div class="route-item ${!isEnabled ? 'disabled' : ''}" 
                 data-route-id="${routeId}"
                 data-enabled="${isEnabled}">
                <div class="route-info">
                    <div class="route-source">${this.getDeviceName(route.source_id)}</div>
                    <div class="route-arrow">→</div>
                    <div class="route-destination">${this.getDeviceName(route.destination_id)}</div>
                </div>
                <div class="route-actions">
                    <button class="btn-toggle" data-action="toggle-route" 
                            title="${isEnabled ? 'Désactiver' : 'Activer'}">
                        ${isEnabled ? '⏸️' : '▶️'}
                    </button>
                    <button class="btn-delete" data-action="delete-route" title="Supprimer">
                        🗑️
                    </button>
                </div>
            </div>
        `;
    }

    renderRoutesSection() {
        if (this.elements.routesList) {
            this.elements.routesList.innerHTML = this.renderRoutesList();
        }
    }

    // ========================================================================
    // ACTIONS
    // ========================================================================

    async createRoute() {
        const sourceId = this.state.selectedSource;
        const destinationId = this.state.selectedDestination;
        
        if (!sourceId || !destinationId) {
            alert('Sélectionnez une source et une destination');
            return;
        }
        
        // API: routing.addRoute
        if (this.eventBus) {
            this.eventBus.emit('routing:add_route_requested', {
                source_id: sourceId,
                destination_id: destinationId
            });
        }
    }

    async deleteRoute(routeId) {
        // Parser routeId qui peut être "source_destination"
        const [sourceId, destinationId] = routeId.split('_');
        
        // API: routing.removeRoute
        if (this.eventBus) {
            this.eventBus.emit('routing:remove_route_requested', {
                source_id: sourceId,
                destination_id: destinationId
            });
        }
    }

    async toggleRoute(routeId, currentlyEnabled) {
        const [sourceId, destinationId] = routeId.split('_');
        
        // API: routing.enableRoute ou routing.disableRoute
        if (this.eventBus) {
            if (currentlyEnabled) {
                this.eventBus.emit('routing:disable_route_requested', {
                    source_id: sourceId,
                    destination_id: destinationId
                });
            } else {
                this.eventBus.emit('routing:enable_route_requested', {
                    source_id: sourceId,
                    destination_id: destinationId
                });
            }
        }
    }

    async clearAllRoutes() {
        if (!confirm('Supprimer toutes les routes ?')) return;
        
        // API: routing.clearRoutes
        if (this.eventBus) {
            this.eventBus.emit('routing:clear_routes_requested');
        }
    }

    // ========================================================================
    // LOADING
    // ========================================================================

    async loadRoutes() {
        // API: routing.listRoutes
        if (this.eventBus) {
            this.eventBus.emit('routing:list_routes_requested');
        }
    }

    async loadDevices() {
        // API: devices.list pour obtenir sources/destinations
        if (this.eventBus) {
            this.eventBus.emit('devices:list_requested');
        }
    }

    // ========================================================================
    // UTILITAIRES
    // ========================================================================

    getDeviceName(deviceId) {
        const allDevices = [...this.state.sources, ...this.state.destinations];
        const device = allDevices.find(d => d.id === deviceId);
        return device ? device.name : deviceId;
    }

    // ========================================================================
    // CLEANUP
    // ========================================================================

    destroy() {
        if (this.eventBus) {
            this.eventBus.off('routes:listed');
            this.eventBus.off('route:added');
            this.eventBus.off('route:removed');
            this.eventBus.off('routes:cleared');
            this.eventBus.off('route:toggled');
            this.eventBus.off('devices:listed');
        }
        
        this.logger.info('[RoutingView] Destroyed');
    }
}

// ============================================================================
// EXPORT
// ============================================================================

if (typeof module !== 'undefined' && module.exports) {
    module.exports = RoutingView;
}

if (typeof window !== 'undefined') {
    window.RoutingView = RoutingView;
}