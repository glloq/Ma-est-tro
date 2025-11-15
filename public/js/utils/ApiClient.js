// ============================================================================
// Fichier: frontend/js/utils/ApiClient.js
// Projet: MidiMind v3.0 - Système d'Orchestration MIDI pour Raspberry Pi
// Version: 3.0.0
// Date: 2025-10-14
// ============================================================================
// Description:
//   Client HTTP pour communiquer avec l'API REST du backend C++.
//   Prépare le terrain pour le mode serveur réseau (multi-clients).
//
// Fonctionnalités:
//   - Requêtes HTTP (GET, POST, PUT, DELETE)
//   - Authentification (token, session)
//   - Retry automatique sur échec
//   - Timeout configurable
//   - Gestion erreurs HTTP
//   - Interceptors (before/after request)
//   - Cache réponses (optionnel)
//   - Mode offline (queue requests)
//
// Architecture:
//   ApiClient (classe)
//   - Fetch API avec wrappers
//   - Promise-based
//   - Error handling standardisé
//
// Auteur: MidiMind Team
// ============================================================================
// ============================================================================
// CLASSE APIERROR - Erreur API Personnalisée
// ============================================================================

class ApiError extends Error {
    /**
     * Crée une erreur API
     * @param {string} message - Message d'erreur
     * @param {number} status - Code HTTP
     * @param {Object} data - Données erreur supplémentaires
     */
    constructor(message, status, data = null) {
        super(message);
        this.name = 'ApiError';
        this.status = status;
        this.data = data;
        this.timestamp = Date.now();
    }
    
    /**
     * Sérialise l'erreur en JSON
     * @returns {Object}
     */
    toJSON() {
        return {
            name: this.name,
            message: this.message,
            status: this.status,
            data: this.data,
            timestamp: this.timestamp
        };
    }
    
    /**
     * Retourne une représentation string
     * @returns {string}
     */
    toString() {
        return `${this.name} [${this.status}]: ${this.message}`;
    }
}

// ============================================================================
// CLASSE APICLIENT - Client HTTP REST
// ============================================================================

class ApiClient {
    /**
     * Crée une instance ApiClient
     * @param {Object} config - Configuration
     */
    constructor(config = {}) {
        // Configuration par défaut
        this.config = {
            baseURL: config.baseURL || 'http://localhost:8080/api',
            timeout: config.timeout || 10000,
            retryAttempts: config.retryAttempts || 3,
            retryDelay: config.retryDelay || 1000,
            retryBackoff: config.retryBackoff || 2,
            headers: {
                'Content-Type': 'application/json',
                ...(config.headers || {})
            },
            credentials: config.credentials || 'same-origin',
            cache: {
                enabled: config.cache?.enabled !== false,
                ttl: config.cache?.ttl || 300000, // 5 minutes
                maxSize: config.cache?.maxSize || 100
            },
            debug: config.debug || false
        };
        
        // Cache LRU (Least Recently Used)
        this.cache = new Map();
        this.cacheOrder = []; // Pour LRU
        
        // Intercepteurs
        this.interceptors = {
            request: [],
            response: []
        };
        
        // Requêtes en cours (pour annulation)
        this.pendingRequests = new Map();
        
        // Statistiques
        this.stats = {
            requests: 0,
            successfulRequests: 0,
            failedRequests: 0,
            errors: 0,
            cacheHits: 0,
            cacheMisses: 0,
            totalLatency: 0,
            averageLatency: 0
        };
        
        this.initialize();
    }
    
    // ========================================================================
    // INITIALISATION
    // ========================================================================
    
    initialize() {
        this.log('ApiClient initialized', this.config.baseURL);
        
        // Nettoyer le cache périodiquement
        this.cacheCleanupInterval = setInterval(() => {
            this.cleanCache();
        }, 60000); // Chaque minute
    }
    
    // ========================================================================
    // MÉTHODES HTTP PRINCIPALES
    // ========================================================================
    
    /**
     * Requête GET
     * @param {string} endpoint - Endpoint relatif
     * @param {Object} options - Options
     * @returns {Promise<Object>}
     */
    async get(endpoint, options = {}) {
        return this.request('GET', endpoint, null, options);
    }
    
    /**
     * Requête POST
     * @param {string} endpoint - Endpoint relatif
     * @param {Object} data - Données Ã  envoyer
     * @param {Object} options - Options
     * @returns {Promise<Object>}
     */
    async post(endpoint, data = {}, options = {}) {
        return this.request('POST', endpoint, data, options);
    }
    
    /**
     * Requête PUT
     * @param {string} endpoint - Endpoint relatif
     * @param {Object} data - Données Ã  envoyer
     * @param {Object} options - Options
     * @returns {Promise<Object>}
     */
    async put(endpoint, data = {}, options = {}) {
        return this.request('PUT', endpoint, data, options);
    }
    
    /**
     * Requête DELETE
     * @param {string} endpoint - Endpoint relatif
     * @param {Object} options - Options
     * @returns {Promise<Object>}
     */
    async delete(endpoint, options = {}) {
        return this.request('DELETE', endpoint, null, options);
    }
    
    /**
     * Requête PATCH
     * @param {string} endpoint - Endpoint relatif
     * @param {Object} data - Données partielles
     * @param {Object} options - Options
     * @returns {Promise<Object>}
     */
    async patch(endpoint, data = {}, options = {}) {
        return this.request('PATCH', endpoint, data, options);
    }
    
    // ========================================================================
    // MÉTHODE REQUEST CORE
    // ========================================================================
    
    /**
     * Effectue une requête HTTP
     * @param {string} method - Méthode HTTP
     * @param {string} endpoint - Endpoint relatif
     * @param {Object|null} data - Données
     * @param {Object} options - Options
     * @returns {Promise<Object>}
     */
    async request(method, endpoint, data = null, options = {}) {
        // Générer clé cache pour GET
        const cacheKey = method === 'GET' 
            ? this.generateCacheKey(method, endpoint, options.params)
            : null;
        
        // Vérifier cache pour GET
        if (method === 'GET' && this.config.cache.enabled && !options.skipCache) {
            const cached = this.getCached(cacheKey);
            if (cached) {
                this.log('Cache hit', endpoint);
                return cached;
            }
        }
        
        // Préparer la requête
        let requestConfig = {
            method,
            endpoint,
            data,
            headers: { ...this.config.headers, ...(options.headers || {}) },
            params: options.params || {},
            timeout: options.timeout || this.config.timeout,
            abortSignal: options.abortSignal || null,
            skipRetry: options.skipRetry || false
        };
        
        // Appliquer intercepteurs request
        requestConfig = await this.applyRequestInterceptors(requestConfig);
        
        // Fonction de requête (pour retry)
        const executeRequest = async () => {
            const startTime = Date.now();
            this.stats.requests++;
            
            try {
                // Construire URL complète
                const url = this.buildUrl(
                    `${this.config.baseURL}${requestConfig.endpoint}`,
                    requestConfig.params
                );
                
                // Créer AbortController pour timeout
                const controller = new AbortController();
                const timeoutId = setTimeout(() => {
                    controller.abort();
                }, requestConfig.timeout);
                
                // Combiner avec signal externe si fourni
                let signal = controller.signal;
                if (requestConfig.abortSignal) {
                    signal = this.combineSignals([controller.signal, requestConfig.abortSignal]);
                }
                
                // Options fetch
                const fetchOptions = {
                    method: requestConfig.method,
                    headers: requestConfig.headers,
                    credentials: this.config.credentials,
                    signal
                };
                
                // Ajouter body si données
                if (data && ['POST', 'PUT', 'PATCH'].includes(method)) {
                    fetchOptions.body = JSON.stringify(data);
                }
                
                this.log(`${method} ${url}`, data ? `Data: ${JSON.stringify(data)}` : '');
                
                // Effectuer requête
                let response = await fetch(url, fetchOptions);
                
                clearTimeout(timeoutId);
                
                // Appliquer intercepteurs response
                response = await this.applyResponseInterceptors(response);
                
                // Gérer erreurs HTTP
                if (!response.ok) {
                    await this.handleError(response);
                }
                
                // Parser réponse
                const responseData = await this.parseResponse(response);
                
                // Calculer latence
                const latency = Date.now() - startTime;
                this.updateLatencyStats(latency);
                
                this.stats.successfulRequests++;
                
                // Mettre en cache si GET
                if (method === 'GET' && this.config.cache.enabled && !options.skipCache) {
                    this.setCache(cacheKey, responseData, options.cacheTtl);
                }
                
                // Invalider cache si modification
                if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
                    this.invalidateCache(new RegExp(endpoint.split('/')[0]));
                }
                
                this.log(`âœ“ ${method} ${url}`, `Latency: ${latency}ms`);
                
                return responseData;
                
            } catch (error) {
                this.stats.failedRequests++;
                this.stats.errors++;
                
                // Gérer erreurs spécifiques
                if (error.name === 'AbortError') {
                    throw new ApiError('Request timeout or cancelled', 0, { original: error });
                }
                
                throw error;
            }
        };
        
        // Exécuter avec retry si activé
        if (!requestConfig.skipRetry) {
            return this.retryRequest(executeRequest);
        }
        
        return executeRequest();
    }
    
    // ========================================================================
    // GESTION DU CACHE
    // ========================================================================
    
    /**
     * Récupère une réponse du cache
     * @param {string} key - Clé cache
     * @returns {Object|null}
     */
    getCached(key) {
        const cached = this.cache.get(key);
        
        if (!cached) {
            this.stats.cacheMisses++;
            return null;
        }
        
        // Vérifier expiration
        if (Date.now() > cached.expiresAt) {
            this.cache.delete(key);
            this.cacheOrder = this.cacheOrder.filter(k => k !== key);
            this.stats.cacheMisses++;
            return null;
        }
        
        this.stats.cacheHits++;
        
        // Mettre Ã  jour ordre LRU
        this.updateCacheOrder(key);
        
        return cached.data;
    }
    
    /**
     * Stocke une réponse en cache
     * @param {string} key - Clé cache
     * @param {Object} data - Données
     * @param {number|null} ttl - Time to live (optionnel)
     */
    setCache(key, data, ttl = null) {
        // Vérifier taille max
        if (this.cache.size >= this.config.cache.maxSize) {
            // Supprimer le plus ancien (LRU)
            const oldestKey = this.cacheOrder.shift();
            this.cache.delete(oldestKey);
        }
        
        this.cache.set(key, {
            data,
            expiresAt: Date.now() + (ttl || this.config.cache.ttl),
            createdAt: Date.now()
        });
        
        this.cacheOrder.push(key);
        
        this.log('Cached', `Key: ${key}, TTL: ${ttl || this.config.cache.ttl}ms`);
    }
    
    /**
     * Invalide le cache
     * @param {string|RegExp|null} pattern - Pattern Ã  invalider
     */
    invalidateCache(pattern = null) {
        if (!pattern) {
            // Tout nettoyer
            this.cache.clear();
            this.cacheOrder = [];
            this.log('Cache cleared', 'All entries');
            return;
        }
        
        if (typeof pattern === 'string') {
            this.cache.delete(pattern);
            this.cacheOrder = this.cacheOrder.filter(k => k !== pattern);
            this.log('Cache invalidated', `Key: ${pattern}`);
        } else if (pattern instanceof RegExp) {
            let count = 0;
            for (const key of this.cache.keys()) {
                if (pattern.test(key)) {
                    this.cache.delete(key);
                    count++;
                }
            }
            this.cacheOrder = this.cacheOrder.filter(k => !pattern.test(k));
            this.log('Cache invalidated', `Pattern: ${pattern}, Count: ${count}`);
        }
    }
    
    /**
     * Nettoie les entrées expirées
     */
    cleanCache() {
        const now = Date.now();
        let cleaned = 0;
        
        for (const [key, value] of this.cache.entries()) {
            if (now > value.expiresAt) {
                this.cache.delete(key);
                cleaned++;
            }
        }
        
        // Reconstruire ordre
        this.cacheOrder = this.cacheOrder.filter(k => this.cache.has(k));
        
        if (cleaned > 0) {
            this.log('Cache cleaned', `Removed ${cleaned} expired entries`);
        }
    }
    
    /**
     * Met Ã  jour l'ordre LRU
     * @param {string} key - Clé
     */
    updateCacheOrder(key) {
        this.cacheOrder = this.cacheOrder.filter(k => k !== key);
        this.cacheOrder.push(key);
    }
    
    /**
     * Génère une clé de cache
     * @param {string} method - Méthode HTTP
     * @param {string} endpoint - Endpoint
     * @param {Object} params - Paramètres query
     * @returns {string}
     */
    generateCacheKey(method, endpoint, params = {}) {
        const paramsStr = Object.keys(params).length > 0 
            ? JSON.stringify(params)
            : '';
        return `${method}:${endpoint}:${paramsStr}`;
    }
    
    // ========================================================================
    // RETRY LOGIC
    // ========================================================================
    
    /**
     * Exécute une requête avec retry automatique
     * @param {Function} requestFn - Fonction de requête
     * @param {number} attempt - Tentative actuelle
     * @returns {Promise<Object>}
     */
    async retryRequest(requestFn, attempt = 1) {
        try {
            return await requestFn();
        } catch (error) {
            // Ne pas retry les erreurs client (4xx)
            if (error.status >= 400 && error.status < 500) {
                throw error;
            }
            
            // Retry si tentatives restantes
            if (attempt < this.config.retryAttempts) {
                const delay = this.config.retryDelay * Math.pow(this.config.retryBackoff, attempt - 1);
                
                this.log(`Retry ${attempt}/${this.config.retryAttempts}`, `Delay: ${delay}ms`);
                
                await this.sleep(delay);
                return this.retryRequest(requestFn, attempt + 1);
            }
            
            // Plus de retries
            throw error;
        }
    }
    
    /**
     * Pause asynchrone
     * @param {number} ms - Millisecondes
     * @returns {Promise<void>}
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    // ========================================================================
    // INTERCEPTEURS
    // ========================================================================
    
    /**
     * Ajoute un intercepteur de requête
     * @param {Function} fn - Fonction intercepteur
     */
    addRequestInterceptor(fn) {
        this.interceptors.request.push(fn);
        this.log('Request interceptor added', `Total: ${this.interceptors.request.length}`);
    }
    
    /**
     * Ajoute un intercepteur de réponse
     * @param {Function} fn - Fonction intercepteur
     */
    addResponseInterceptor(fn) {
        this.interceptors.response.push(fn);
        this.log('Response interceptor added', `Total: ${this.interceptors.response.length}`);
    }
    
    /**
     * Applique les intercepteurs de requête
     * @param {Object} config - Configuration requête
     * @returns {Promise<Object>}
     */
    async applyRequestInterceptors(config) {
        let modifiedConfig = { ...config };
        
        for (const interceptor of this.interceptors.request) {
            modifiedConfig = await interceptor(modifiedConfig);
        }
        
        return modifiedConfig;
    }
    
    /**
     * Applique les intercepteurs de réponse
     * @param {Response} response - Réponse fetch
     * @returns {Promise<Response>}
     */
    async applyResponseInterceptors(response) {
        let modifiedResponse = response;
        
        for (const interceptor of this.interceptors.response) {
            modifiedResponse = await interceptor(modifiedResponse);
        }
        
        return modifiedResponse;
    }
    
    // ========================================================================
    // ANNULATION DE REQUÃŠTES
    // ========================================================================
    
    /**
     * Crée un contrôleur d'annulation
     * @param {string} requestId - ID unique
     * @returns {AbortController}
     */
    createAbortController(requestId) {
        const controller = new AbortController();
        this.pendingRequests.set(requestId, controller);
        this.log('AbortController created', `ID: ${requestId}`);
        return controller;
    }
    
    /**
     * Annule une requête
     * @param {string} requestId - ID requête
     */
    abortRequest(requestId) {
        const controller = this.pendingRequests.get(requestId);
        if (controller) {
            controller.abort();
            this.pendingRequests.delete(requestId);
            this.log('Request aborted', `ID: ${requestId}`);
        }
    }
    
    /**
     * Annule toutes les requêtes en cours
     */
    abortAllRequests() {
        const count = this.pendingRequests.size;
        
        for (const [requestId, controller] of this.pendingRequests.entries()) {
            controller.abort();
        }
        
        this.pendingRequests.clear();
        
        this.log('All requests aborted', `Count: ${count}`);
    }
    
    /**
     * Combine plusieurs signaux d'annulation
     * @param {Array<AbortSignal>} signals - Signaux
     * @returns {AbortSignal}
     */
    combineSignals(signals) {
        const controller = new AbortController();
        
        for (const signal of signals) {
            if (signal.aborted) {
                controller.abort();
                break;
            }
            signal.addEventListener('abort', () => controller.abort());
        }
        
        return controller.signal;
    }
    
    // ========================================================================
    // HELPERS & UTILS
    // ========================================================================
    
    /**
     * Construit une URL avec query params
     * @param {string} url - URL de base
     * @param {Object} params - Paramètres
     * @returns {string}
     */
    buildUrl(url, params = {}) {
        if (Object.keys(params).length === 0) {
            return url;
        }
        
        const queryString = Object.entries(params)
            .filter(([_, value]) => value !== null && value !== undefined)
            .map(([key, value]) => {
                if (Array.isArray(value)) {
                    return value.map(v => 
                        `${encodeURIComponent(key)}[]=${encodeURIComponent(v)}`
                    ).join('&');
                }
                return `${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
            })
            .join('&');
        
        return `${url}?${queryString}`;
    }
    
    /**
     * Parse une réponse
     * @param {Response} response - Réponse fetch
     * @returns {Promise<Object>}
     */
    async parseResponse(response) {
        const contentType = response.headers.get('content-type');
        
        if (contentType && contentType.includes('application/json')) {
            return await response.json();
        }
        
        if (contentType && contentType.includes('text/')) {
            return await response.text();
        }
        
        return await response.blob();
    }
    
    /**
     * Gère les erreurs HTTP
     * @param {Response} response - Réponse fetch
     * @throws {ApiError}
     */
    async handleError(response) {
        let errorData = null;
        
        try {
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                errorData = await response.json();
            } else {
                errorData = { message: await response.text() };
            }
        } catch (e) {
            errorData = { message: response.statusText || 'Unknown error' };
        }
        
        const message = errorData.error?.message || errorData.message || 'Request failed';
        
        this.log('Error', `${response.status}: ${message}`);
        
        throw new ApiError(message, response.status, errorData);
    }
    
    /**
     * Met Ã  jour les stats de latence
     * @param {number} latency - Latence en ms
     */
    updateLatencyStats(latency) {
        this.stats.totalLatency += latency;
        this.stats.averageLatency = Math.round(
            this.stats.totalLatency / this.stats.successfulRequests
        );
    }
    
    /**
     * Retourne les statistiques
     * @returns {Object}
     */
    getStats() {
        return {
            ...this.stats,
            cacheSize: this.cache.size,
            cacheHitRate: this.stats.requests > 0 
                ? ((this.stats.cacheHits / this.stats.requests) * 100).toFixed(2) + '%'
                : '0%',
            successRate: this.stats.requests > 0
                ? ((this.stats.successfulRequests / this.stats.requests) * 100).toFixed(2) + '%'
                : '0%'
        };
    }
    
    /**
     * Réinitialise les statistiques
     */
    resetStats() {
        this.stats = {
            requests: 0,
            successfulRequests: 0,
            failedRequests: 0,
            errors: 0,
            cacheHits: 0,
            cacheMisses: 0,
            totalLatency: 0,
            averageLatency: 0
        };
        
        this.log('Stats reset', 'All counters reset to 0');
    }
    
    /**
     * Log interne (si debug activé)
     * @param {string} action - Action
     * @param {string} details - Détails
     */
    log(action, details = '') {
        if (this.config.debug) {
            console.log(`[ApiClient] ${action}:`, details);
        }
    }
    
    // ========================================================================
    // NETTOYAGE
    // ========================================================================
    
    /**
     * Nettoie les ressources
     */
    destroy() {
        // Annuler toutes les requêtes
        this.abortAllRequests();
        
        // Nettoyer le cache
        this.cache.clear();
        this.cacheOrder = [];
        
        // Arrêter le nettoyage périodique
        if (this.cacheCleanupInterval) {
            clearInterval(this.cacheCleanupInterval);
        }
        
        // Nettoyer les intercepteurs
        this.interceptors.request = [];
        this.interceptors.response = [];
        
        this.log('ApiClient destroyed', 'All resources cleaned');
    }
}

// ============================================================================
// EXPORT
// ============================================================================

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ApiClient, ApiError };
}

if (typeof window !== 'undefined') {
    window.ApiClient = ApiClient;
    window.ApiError = ApiError;
}

window.ApiClient = ApiClient;