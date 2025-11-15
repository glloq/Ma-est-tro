// ============================================================================
// Fichier: frontend/js/core/Router.js
// Projet: midiMind v3.0 - SystÃƒÂ¨me d'Orchestration MIDI pour Raspberry Pi
// Version: 3.1.1 - FIX INITIALIZATION
// Date: 2025-11-02
// ============================================================================
// CORRECTIONS v3.1.1:
// Ã¢Å“â€¦ CRITIQUE: Initialisation diffÃƒÂ©rÃƒÂ©e (ne charge pas de route avant enregistrement)
// Ã¢Å“â€¦ CRITIQUE: Ãƒâ€°mission d'ÃƒÂ©vÃƒÂ©nements 'route-changed'
// Ã¢Å“â€¦ Fix: Meilleure gestion des routes non trouvÃƒÂ©es
// Ã¢Å“â€¦ MÃƒÂ©thode startRouting() pour dÃƒÂ©marrer aprÃƒÂ¨s enregistrement des routes
// ============================================================================

class Router {
    constructor(config = {}) {
        // Configuration
        this.config = {
            mode: config.mode || 'hash',           // 'hash' ou 'history'
            root: config.root || '/',              // URL de base
            useTransitions: config.useTransitions !== false,
            transitionDuration: config.transitionDuration || 300,
            ...config
        };
        
        // Routes enregistrÃƒÂ©es
        this.routes = new Map();
        
        // Route actuelle
        this.currentRoute = null;
        this.previousRoute = null;
        
        // Middlewares
        this.middlewares = [];
        
        // Guards (before/after hooks)
        this.beforeHooks = [];
        this.afterHooks = [];
        
        // Cache des vues
        this.viewCache = new Map();
        
        // Ãƒâ€°tat
        this.state = {
            isNavigating: false,
            history: [],
            params: {},
            query: {},
            started: false  // Nouveau: indique si le routing a dÃƒÂ©marrÃƒÂ©
        };
        
        // Event listeners
        this.listeners = new Map();
        
        // Initialisation (sans charger de route)
        this.init();
    }
    
    // ========================================================================
    // INITIALISATION
    // ========================================================================
    
    init() {
        // Ãƒâ€°couter les changements d'URL
        if (this.config.mode === 'history') {
            // Mode History API
            window.addEventListener('popstate', (e) => this.handlePopState(e));
            
            // Intercepter les clics sur les liens
            document.addEventListener('click', (e) => this.handleLinkClick(e));
        } else {
            // Mode Hash
            window.addEventListener('hashchange', () => this.handleHashChange());
        }
        
        // NE PAS charger la route initiale automatiquement
        // Elle sera chargÃƒÂ©e aprÃƒÂ¨s l'enregistrement des routes via startRouting()
    }
    
    /**
     * DÃƒÂ©marre le routing (aprÃƒÂ¨s enregistrement des routes)
     * Ãƒâ‚¬ appeler explicitement aprÃƒÂ¨s avoir enregistrÃƒÂ© toutes les routes
     */
    startRouting() {
        if (this.state.started) {
            console.warn('Router: Routing already started');
            return;
        }
        
        this.state.started = true;
        this.loadInitialRoute();
    }
    
    /**
     * Charger la route initiale
     */
    loadInitialRoute() {
        const path = this.getCurrentPath();
        this.navigateTo(path, { skipPushState: true });
    }
    
    // ========================================================================
    // ENREGISTREMENT DES ROUTES
    // ========================================================================
    
    /**
     * Enregistrer une route
     * @param {string} path - Chemin de la route (peut contenir des paramÃƒÂ¨tres)
     * @param {Object} config - Configuration de la route
     */
    route(path, config) {
        const route = {
            path: path,
            pattern: this.pathToRegex(path),
            component: config.component || null,
            controller: config.controller || null,
            view: config.view || null,
            title: config.title || '',
            meta: config.meta || {},
            beforeEnter: config.beforeEnter || null,
            beforeLeave: config.beforeLeave || null,
            cache: config.cache !== false,
            ...config
        };
        
        this.routes.set(path, route);
        
        return this;
    }
    
    /**
     * Enregistrer plusieurs routes
     * @param {Array} routes - Tableau de routes
     */
    addRoutes(routes) {
        routes.forEach(route => {
            this.route(route.path, route);
        });
        
        return this;
    }
    
    /**
     * Route 404 (not found)
     * @param {Object} config - Configuration de la route 404
     */
    notFound(config) {
        this.route('*', {
            ...config,
            is404: true
        });
        
        return this;
    }
    
    /**
     * Configuration rapide des routes API
     * Configure les routes pour les nouvelles fonctionnalitÃƒÂ©s
     * @param {Object} controllers - Objet contenant les contrÃƒÂ´leurs
     * @param {Object} views - Objet contenant les vues
     */
    configureApiRoutes(controllers = {}, views = {}) {
        const apiRoutes = [
            {
                path: '/bluetooth',
                controller: controllers.bluetooth,
                view: views.bluetooth,
                title: 'Bluetooth - MidiMind',
                meta: { requiresFeature: 'bluetooth' }
            },
            {
                path: '/latency',
                controller: controllers.latency,
                view: views.latency,
                title: 'Latence - MidiMind',
                meta: { requiresFeature: 'latency' }
            },
            {
                path: '/presets',
                controller: controllers.preset,
                view: views.preset,
                title: 'Presets - MidiMind',
                meta: { requiresFeature: 'presets' }
            },
            {
                path: '/network',
                controller: controllers.network,
                view: views.network,
                title: 'RÃƒÂ©seau - MidiMind',
                meta: { requiresFeature: 'network' }
            },
            {
                path: '/logger',
                controller: controllers.logger,
                view: views.logger,
                title: 'Logs - MidiMind',
                meta: { requiresFeature: 'logger' }
            }
        ];
        
        this.addRoutes(apiRoutes);
        
        return this;
    }
    
    // ========================================================================
    // NAVIGATION
    // ========================================================================
    
    /**
     * Naviguer vers une route
     * @param {string} path - Chemin de destination
     * @param {Object} options - Options de navigation
     */
    async navigateTo(path, options = {}) {
        // VÃƒÂ©rifier si dÃƒÂ©jÃƒÂ  en navigation
        if (this.state.isNavigating && !options.force) {
            return false;
        }
        
        this.state.isNavigating = true;
        
        try {
            // Normaliser le chemin
            const normalizedPath = this.normalizePath(path);
            
            // Trouver la route correspondante
            const matchedRoute = this.matchRoute(normalizedPath);
            
            if (!matchedRoute) {
                // Route 404
                const notFoundRoute = this.find404Route();
                if (notFoundRoute) {
                    await this.loadRoute(notFoundRoute, normalizedPath, options);
                } else {
                    console.warn(`Router: Route not found: ${normalizedPath}`);
                    // Si pas de route 404 dÃƒÂ©finie, ne pas ÃƒÂ©chouer silencieusement
                    // Ãƒâ€°mettre un ÃƒÂ©vÃƒÂ©nement pour que NavigationController puisse gÃƒÂ©rer
                    this.emit('route-not-found', { path: normalizedPath });
                }
                return false;
            }
            
            // Extraire les paramÃƒÂ¨tres
            const params = this.extractParams(matchedRoute, normalizedPath);
            const query = this.extractQuery(normalizedPath);
            
            // Mettre ÃƒÂ  jour l'ÃƒÂ©tat
            this.state.params = params;
            this.state.query = query;
            
            // Charger la route
            await this.loadRoute(matchedRoute.route, normalizedPath, options);
            
            // Mettre ÃƒÂ  jour l'URL si nÃƒÂ©cessaire
            if (!options.skipPushState) {
                this.updateURL(normalizedPath, options.replace);
            }
            
            // Ãƒâ€°mettre ÃƒÂ©vÃƒÂ©nement de changement de route
            this.emit('route-changed', {
                path: normalizedPath,
                route: matchedRoute.route,
                params: params,
                query: query,
                previous: this.previousRoute
            });
            
            return true;
            
        } finally {
            this.state.isNavigating = false;
        }
    }
    
    /**
     * Charger une route
     */
    async loadRoute(route, path, options = {}) {
        // Sauvegarder la route prÃƒÂ©cÃƒÂ©dente
        this.previousRoute = this.currentRoute;
        
        // ExÃƒÂ©cuter les hooks beforeLeave de la route prÃƒÂ©cÃƒÂ©dente
        if (this.previousRoute && this.previousRoute.beforeLeave) {
            const canLeave = await this.executeHook(this.previousRoute.beforeLeave, this.previousRoute);
            if (canLeave === false) {
                return false;
            }
        }
        
        // ExÃƒÂ©cuter les middlewares
        for (const middleware of this.middlewares) {
            const result = await middleware(route, this.previousRoute);
            if (result === false) {
                return false;
            }
        }
        
        // ExÃƒÂ©cuter les beforeHooks globaux
        for (const hook of this.beforeHooks) {
            const result = await hook(route, this.previousRoute);
            if (result === false) {
                return false;
            }
        }
        
        // ExÃƒÂ©cuter le beforeEnter de la nouvelle route
        if (route.beforeEnter) {
            const canEnter = await this.executeHook(route.beforeEnter, route);
            if (canEnter === false) {
                return false;
            }
        }
        
        // Transition si activÃƒÂ©e
        if (this.config.useTransitions && !options.skipTransition) {
            await this.transitionOut();
        }
        
        // Charger le composant/vue
        await this.loadComponent(route);
        
        // Mettre ÃƒÂ  jour le titre
        if (route.title) {
            document.title = typeof route.title === 'function' 
                ? route.title(this.state.params, this.state.query)
                : route.title;
        }
        
        // Sauvegarder dans l'historique
        if (!options.skipHistory) {
            this.state.history.push({
                path: path,
                route: route,
                params: this.state.params,
                query: this.state.query,
                timestamp: Date.now()
            });
        }
        
        // Transition d'entrÃƒÂ©e
        if (this.config.useTransitions && !options.skipTransition) {
            await this.transitionIn();
        }
        
        // Route actuelle
        this.currentRoute = route;
        
        // ExÃƒÂ©cuter les afterHooks
        for (const hook of this.afterHooks) {
            await hook(route, this.previousRoute);
        }
        
        // Ãƒâ€°mettre l'ÃƒÂ©vÃƒÂ©nement de changement
        this.emit('after-route-change', {
            current: route,
            previous: this.previousRoute
        });
        
        return true;
    }
    
    /**
     * Charger un composant
     */
    async loadComponent(route) {
        // Rien ÃƒÂ  faire ici dans notre cas
        // La navigation est gÃƒÂ©rÃƒÂ©e par NavigationController via les ÃƒÂ©vÃƒÂ©nements
    }
    
    /**
     * ExÃƒÂ©cuter un hook
     */
    async executeHook(hook, context) {
        try {
            const result = await hook(context, this);
            return result;
        } catch (error) {
            console.error('Router: Hook execution error', error);
            return false;
        }
    }
    
    // ========================================================================
    // GESTIONNAIRES D'Ãƒâ€°VÃƒâ€°NEMENTS
    // ========================================================================
    
    /**
     * GÃƒÂ©rer les changements de hash
     */
    handleHashChange() {
        if (!this.state.started) return; // Ne rien faire si pas encore dÃƒÂ©marrÃƒÂ©
        
        const path = this.getCurrentPath();
        this.navigateTo(path, { skipPushState: true });
    }
    
    /**
     * GÃƒÂ©rer popstate
     */
    handlePopState(event) {
        if (!this.state.started) return; // Ne rien faire si pas encore dÃƒÂ©marrÃƒÂ©
        
        const path = this.getCurrentPath();
        this.navigateTo(path, { skipPushState: true });
    }
    
    /**
     * GÃƒÂ©rer les clics sur les liens
     */
    handleLinkClick(event) {
        if (!this.state.started) return; // Ne rien faire si pas encore dÃƒÂ©marrÃƒÂ©
        
        // Trouver le lien le plus proche
        const link = event.target.closest('a');
        
        if (!link) return;
        
        // VÃƒÂ©rifier si c'est un lien interne
        if (link.host !== window.location.host) return;
        
        // VÃƒÂ©rifier si c'est un lien vers une route
        const href = link.getAttribute('href');
        if (!href || href.startsWith('http') || href.startsWith('//')) return;
        
        // EmpÃƒÂªcher le comportement par dÃƒÂ©faut
        event.preventDefault();
        
        // Naviguer vers la route
        const path = this.config.mode === 'history' 
            ? href 
            : href.replace('#', '');
        
        this.navigateTo(path);
    }
    
    // ========================================================================
    // NAVIGATION HELPERS
    // ========================================================================
    
    /**
     * Aller ÃƒÂ  la page prÃƒÂ©cÃƒÂ©dente
     */
    back() {
        if (this.config.mode === 'history') {
            window.history.back();
        } else {
            if (this.state.history.length > 1) {
                const previous = this.state.history[this.state.history.length - 2];
                this.navigateTo(previous.path, { skipHistory: true });
            }
        }
    }
    
    /**
     * Aller ÃƒÂ  la page suivante
     */
    forward() {
        if (this.config.mode === 'history') {
            window.history.forward();
        }
    }
    
    /**
     * Recharger la route actuelle
     */
    reload() {
        if (this.currentRoute) {
            const path = this.getCurrentPath();
            this.navigateTo(path, { force: true, replace: true });
        }
    }
    
    // ========================================================================
    // TRANSITIONS
    // ========================================================================
    
    /**
     * Transition de sortie
     */
    async transitionOut() {
        const container = this.getContainer();
        
        if (container) {
            container.style.opacity = '1';
            container.style.transition = `opacity ${this.config.transitionDuration}ms ease`;
            container.style.opacity = '0';
            
            await this.wait(this.config.transitionDuration);
        }
    }
    
    /**
     * Transition d'entrÃƒÂ©e
     */
    async transitionIn() {
        const container = this.getContainer();
        
        if (container) {
            container.style.opacity = '0';
            container.style.transition = `opacity ${this.config.transitionDuration}ms ease`;
            
            // Force reflow
            container.offsetHeight;
            
            container.style.opacity = '1';
            
            await this.wait(this.config.transitionDuration);
        }
    }
    
    /**
     * Attendre un dÃƒÂ©lai
     */
    wait(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    /**
     * Obtenir le conteneur de rendu
     */
    getContainer() {
        return this.config.container || 
               document.getElementById('router-view') ||
               document.querySelector('.main-content') ||
               document.body;
    }
    
    // ========================================================================
    // UTILITAIRES
    // ========================================================================
    
    /**
     * Obtenir le chemin actuel
     */
    getCurrentPath() {
        if (this.config.mode === 'history') {
            let path = window.location.pathname;
            
            // Retirer le root si nÃƒÂ©cessaire
            if (this.config.root !== '/') {
                path = path.replace(this.config.root, '');
            }
            
            return path || '/';
        } else {
            return window.location.hash.slice(1) || '/';
        }
    }
    
    /**
     * Mettre ÃƒÂ  jour l'URL
     */
    updateURL(path, replace = false) {
        if (this.config.mode === 'history') {
            const url = this.config.root + path;
            
            if (replace) {
                window.history.replaceState(null, '', url);
            } else {
                window.history.pushState(null, '', url);
            }
        } else {
            if (replace) {
                window.location.replace('#' + path);
            } else {
                window.location.hash = path;
            }
        }
    }
    
    /**
     * Normaliser un chemin
     */
    normalizePath(path) {
        // Retirer les slashes multiples
        path = path.replace(/\/+/g, '/');
        
        // Retirer le slash final sauf pour root
        if (path !== '/' && path.endsWith('/')) {
            path = path.slice(0, -1);
        }
        
        // Assurer que ÃƒÂ§a commence par /
        if (!path.startsWith('/')) {
            path = '/' + path;
        }
        
        return path;
    }
    
    /**
     * Convertir un path pattern en regex
     */
    pathToRegex(path) {
        // Remplacer les paramÃƒÂ¨tres :param par des groupes de capture
        const pattern = path
            .replace(/\//g, '\\/')
            .replace(/:(\w+)/g, '(?<$1>[^/]+)')
            .replace(/\*/g, '.*');
        
        return new RegExp('^' + pattern + '$');
    }
    
    /**
     * Trouver la route correspondante
     */
    matchRoute(path) {
        for (const [routePath, route] of this.routes) {
            if (routePath === '*') continue; // Skip 404 route
            
            const match = path.match(route.pattern);
            if (match) {
                return {
                    route: route,
                    params: match.groups || {}
                };
            }
        }
        
        return null;
    }
    
    /**
     * Trouver la route 404
     */
    find404Route() {
        return this.routes.get('*') || null;
    }
    
    /**
     * Extraire les paramÃƒÂ¨tres
     */
    extractParams(matchedRoute, path) {
        const match = path.match(matchedRoute.route.pattern);
        return match ? (match.groups || {}) : {};
    }
    
    /**
     * Extraire les query params
     */
    extractQuery(path) {
        const queryStart = path.indexOf('?');
        if (queryStart === -1) return {};
        
        const queryString = path.slice(queryStart + 1);
        const params = new URLSearchParams(queryString);
        const query = {};
        
        for (const [key, value] of params) {
            query[key] = value;
        }
        
        return query;
    }
    
    // ========================================================================
    // EVENT EMITTER
    // ========================================================================
    
    /**
     * Ãƒâ€°couter un ÃƒÂ©vÃƒÂ©nement
     */
    on(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        this.listeners.get(event).push(callback);
        
        return this;
    }
    
    /**
     * Retirer un ÃƒÂ©couteur
     */
    off(event, callback) {
        if (!this.listeners.has(event)) return this;
        
        const callbacks = this.listeners.get(event);
        const index = callbacks.indexOf(callback);
        
        if (index !== -1) {
            callbacks.splice(index, 1);
        }
        
        return this;
    }
    
    /**
     * Ãƒâ€°mettre un ÃƒÂ©vÃƒÂ©nement
     */
    emit(event, data) {
        if (!this.listeners.has(event)) return;
        
        const callbacks = this.listeners.get(event);
        callbacks.forEach(callback => callback(data));
    }
    
    // ========================================================================
    // GETTERS
    // ========================================================================
    
    /**
     * Obtenir la route actuelle
     */
    getCurrentRoute() {
        return this.currentRoute;
    }
    
    /**
     * Obtenir les paramÃƒÂ¨tres
     */
    getParams() {
        return this.state.params;
    }
    
    /**
     * Obtenir les query params
     */
    getQuery() {
        return this.state.query;
    }
    
    /**
     * Obtenir l'historique
     */
    getHistory() {
        return [...this.state.history];
    }
}

window.Router = Router;

// ============================================================================
// FIN DU FICHIER Router.js v3.1.1
// ============================================================================