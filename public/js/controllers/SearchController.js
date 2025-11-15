// ============================================================================
// Fichier: frontend/js/controllers/SearchController.js
// Projet: MidiMind v3.1.0 - Système d'Orchestration MIDI pour Raspberry Pi
// Version: 3.1.0 - OPTIMISÉ
// Date: 2025-11-01
// ============================================================================
// Description:
//   Contrôleur de recherche pour fichiers MIDI, playlists, et instruments.
//   Fournit indexation, recherche floue, et résultats triés par pertinence.
//
// Fonctionnalités:
//   - Indexation automatique des fichiers et playlists
//   - Recherche par nom, description, tags
//   - Recherche floue (fuzzy matching)
//   - Tri par score de pertinence
//   - Cache des résultats
//   - Réindexation incrémentale
//   - Statistiques d'utilisation
//
// Architecture:
//   SearchController extends BaseController
//   - Index Map pour performance
//   - Scoring personnalisable
//   - Événements temps réel
//
// MODIFICATIONS v3.1.0:
//   ✓ Constructeur conforme à BaseController
//   Ã¢Å“â€¦ Utilisation cohérente de subscribe() pour événements
//   Ã¢Å“â€¦ Gestion robuste de l'indexation
//   Ã¢Å“â€¦ Optimisation des algorithmes de recherche
//   Ã¢Å“â€¦ Méthodes helper de BaseController
//
// Auteur: MidiMind Team
// ============================================================================

class SearchController extends BaseController {
    constructor(eventBus, models = {}, views = {}, notifications = null, debugConsole = null, backend = null) {
        super(eventBus, models, views, notifications, debugConsole, backend);
        
        // Index de recherche
        this.searchIndex = new Map();
        this.fileIndex = new Map();
        this.playlistIndex = new Map();
        this.instrumentIndex = new Map();
        
        // Résultats et cache
        this.lastQuery = '';
        this.lastResults = [];
        this.resultCache = new Map();
        
        // Configuration
        this.config = {
            ...this.config,  // Hériter de BaseController
            minQueryLength: 2,
            maxResults: 50,
            fuzzySearch: true,
            caseSensitive: false,
            cacheEnabled: true,
            cacheMaxSize: 100,
            cacheExpiryMs: 300000  // 5 minutes
        };
        
        // Statistiques
        this.stats = {
            totalSearches: 0,
            cacheHits: 0,
            cacheMisses: 0,
            avgSearchTime: 0
        };
    }
    
    /**
     * Initialisation du contrôleur
     */
    onInitialize() {
        this.logDebug('info', 'Initializing search controller...');
        
        // Charger les données initiales si disponibles
        this.loadInitialData();
        
        this.logDebug('info', 'Search controller initialized');
    }
    
    /**
     * Charger les données initiales
     */
    loadInitialData() {
        try {
            // Indexer les fichiers existants
            const fileModel = this.getModel('file');
            if (fileModel) {
                const files = fileModel.get('files') || [];
                files.forEach(file => this.indexFile(file));
                this.logDebug('debug', `Indexed ${files.length} files`);
            }
            
            // Indexer les playlists existantes
            const playlistModel = this.getModel('playlist');
            if (playlistModel) {
                const playlists = playlistModel.get('playlists') || [];
                playlists.forEach(playlist => this.indexPlaylist(playlist));
                this.logDebug('debug', `Indexed ${playlists.length} playlists`);
            }
            
            // Indexer les instruments existants
            const instrumentModel = this.getModel('instrument');
            if (instrumentModel) {
                const instruments = instrumentModel.get('instruments') || [];
                instruments.forEach(instrument => this.indexInstrument(instrument));
                this.logDebug('debug', `Indexed ${instruments.length} instruments`);
            }
        } catch (error) {
            this.logDebug('error', 'Error loading initial data:', error);
        }
    }
    
    /**
     * Bind des événements
     */
    bindEvents() {
        // Événements de fichiers
        this.subscribe('file:loaded', (data) => this.indexFile(data.file || data));
        this.subscribe('file:updated', (data) => this.updateFileIndex(data.file || data));
        this.subscribe('file:deleted', (data) => this.removeFromIndex(data.fileId || data.id || data));
        this.subscribe('file:list:updated', (data) => {
            if (Array.isArray(data.files)) {
                data.files.forEach(file => this.indexFile(file));
            }
        });
        
        // Événements de playlists
        this.subscribe('playlist:created', (data) => this.indexPlaylist(data.playlist || data));
        this.subscribe('playlist:updated', (data) => this.indexPlaylist(data.playlist || data));
        this.subscribe('playlist:deleted', (data) => this.removePlaylistFromIndex(data.playlistId || data.id || data));
        
        // Événements d'instruments
        this.subscribe('instrument:connected', (data) => this.indexInstrument(data.instrument || data));
        this.subscribe('instrument:updated', (data) => this.indexInstrument(data.instrument || data));
        this.subscribe('instrument:disconnected', (data) => this.removeInstrumentFromIndex(data.instrumentId || data.id || data));
        
        // Événements de recherche
        this.subscribe('search:query', (data) => {
            if (data.query) {
                this.search(data.query, data.options);
            }
        });
        
        this.subscribe('search:clear', () => this.clearCache());
        this.subscribe('search:reindex', () => this.reindexAll());
    }
    
    /**
     * Recherche principale
     */
    search(query, options = {}) {
        const startTime = Date.now();
        
        // Validation
        if (!query || query.length < this.config.minQueryLength) {
            this.logDebug('debug', 'Query too short or empty');
            return [];
        }
        
        // Configuration
        const opts = { ...this.config, ...options };
        const normalizedQuery = opts.caseSensitive ? query : query.toLowerCase();
        
        // Vérifier le cache
        if (this.config.cacheEnabled) {
            const cached = this.getCachedResults(normalizedQuery);
            if (cached) {
                this.stats.cacheHits++;
                this.logDebug('debug', `Cache hit for query: ${query}`);
                return cached;
            }
            this.stats.cacheMisses++;
        }
        
        // Recherche
        this.lastQuery = query;
        this.lastResults = [];
        
        // Recherche dans les différents index
        const fileResults = this.searchFiles(normalizedQuery, opts);
        const playlistResults = this.searchPlaylists(normalizedQuery, opts);
        const instrumentResults = this.searchInstruments(normalizedQuery, opts);
        
        // Combiner et trier les résultats
        this.lastResults = [
            ...fileResults,
            ...playlistResults,
            ...instrumentResults
        ]
        .sort((a, b) => b.score - a.score)
        .slice(0, opts.maxResults);
        
        // Mettre en cache
        if (this.config.cacheEnabled) {
            this.cacheResults(normalizedQuery, this.lastResults);
        }
        
        // Statistiques
        const searchTime = Date.now() - startTime;
        this.updateSearchStats(searchTime);
        
        // Émettre événement
        this.emitEvent('search:results', {
            query,
            results: this.lastResults,
            count: this.lastResults.length,
            searchTime
        });
        
        this.logDebug('debug', `Search completed: ${this.lastResults.length} results in ${searchTime}ms`);
        
        return this.lastResults;
    }
    
    /**
     * Recherche dans les fichiers
     */
    searchFiles(query, options) {
        const results = [];
        
        for (const [fileId, file] of this.fileIndex) {
            const score = this.calculateScore(query, file, options);
            if (score > 0) {
                results.push({
                    type: 'file',
                    id: fileId,
                    data: file,
                    score
                });
            }
        }
        
        return results;
    }
    
    /**
     * Recherche dans les playlists
     */
    searchPlaylists(query, options) {
        const results = [];
        
        for (const [playlistId, playlist] of this.playlistIndex) {
            const score = this.calculateScore(query, playlist, options);
            if (score > 0) {
                results.push({
                    type: 'playlist',
                    id: playlistId,
                    data: playlist,
                    score
                });
            }
        }
        
        return results;
    }
    
    /**
     * Recherche dans les instruments
     */
    searchInstruments(query, options) {
        const results = [];
        
        for (const [instrumentId, instrument] of this.instrumentIndex) {
            const score = this.calculateScore(query, instrument, options);
            if (score > 0) {
                results.push({
                    type: 'instrument',
                    id: instrumentId,
                    data: instrument,
                    score
                });
            }
        }
        
        return results;
    }
    
    /**
     * Calcul du score de pertinence
     */
    calculateScore(query, item, options) {
        let score = 0;
        const fields = ['name', 'title', 'filename', 'path', 'description', 'tags', 'type'];
        
        for (const field of fields) {
            if (item[field]) {
                const fieldValue = options.caseSensitive ? 
                    String(item[field]) : 
                    String(item[field]).toLowerCase();
                
                // Match exact - score le plus élevé
                if (fieldValue === query) {
                    score += 100;
                }
                // Commence par - très pertinent
                else if (fieldValue.startsWith(query)) {
                    score += 50;
                }
                // Contient - moyennement pertinent
                else if (fieldValue.includes(query)) {
                    score += 25;
                }
                // Recherche floue si activée - peu pertinent
                else if (options.fuzzySearch && this.fuzzyMatch(query, fieldValue)) {
                    score += 10;
                }
            }
        }
        
        // Bonus pour le texte recherchable complet
        if (item.searchableText && item.searchableText.includes(query)) {
            score += 5;
        }
        
        return score;
    }
    
    /**
     * Recherche floue simple
     */
    fuzzyMatch(query, text) {
        let queryIndex = 0;
        for (let i = 0; i < text.length && queryIndex < query.length; i++) {
            if (text[i] === query[queryIndex]) {
                queryIndex++;
            }
        }
        return queryIndex === query.length;
    }
    
    /**
     * Indexation d'un fichier
     */
    indexFile(file) {
        if (!file || !file.id) {
            this.logDebug('warn', 'Cannot index file without id');
            return;
        }
        
        const indexed = {
            id: file.id,
            name: file.name || '',
            filename: file.filename || '',
            path: file.path || '',
            type: file.type || 'midi',
            size: file.size || 0,
            duration: file.duration || 0,
            tracks: file.tracks || 0,
            bpm: file.bpm || 0,
            tags: Array.isArray(file.tags) ? file.tags.join(' ') : '',
            searchableText: this.buildSearchableText(file)
        };
        
        this.fileIndex.set(file.id, indexed);
        this.clearCache(); // Invalider le cache
        this.logDebug('debug', `Indexed file: ${file.name}`);
    }
    
    /**
     * Indexation d'une playlist
     */
    indexPlaylist(playlist) {
        if (!playlist || !playlist.id) {
            this.logDebug('warn', 'Cannot index playlist without id');
            return;
        }
        
        const indexed = {
            id: playlist.id,
            name: playlist.name || '',
            description: playlist.description || '',
            fileCount: playlist.files ? playlist.files.length : 0,
            tags: Array.isArray(playlist.tags) ? playlist.tags.join(' ') : '',
            searchableText: this.buildSearchableText(playlist)
        };
        
        this.playlistIndex.set(playlist.id, indexed);
        this.clearCache(); // Invalider le cache
        this.logDebug('debug', `Indexed playlist: ${playlist.name}`);
    }
    
    /**
     * Indexation d'un instrument
     */
    indexInstrument(instrument) {
        if (!instrument || !instrument.id) {
            this.logDebug('warn', 'Cannot index instrument without id');
            return;
        }
        
        const indexed = {
            id: instrument.id,
            name: instrument.name || '',
            type: instrument.type || '',
            connection: instrument.connection || '',
            tags: Array.isArray(instrument.tags) ? instrument.tags.join(' ') : '',
            searchableText: this.buildSearchableText(instrument)
        };
        
        this.instrumentIndex.set(instrument.id, indexed);
        this.clearCache(); // Invalider le cache
        this.logDebug('debug', `Indexed instrument: ${instrument.name}`);
    }
    
    /**
     * Construction du texte recherchable
     */
    buildSearchableText(item) {
        const parts = [];
        
        if (item.name) parts.push(item.name);
        if (item.filename) parts.push(item.filename);
        if (item.description) parts.push(item.description);
        if (item.path) parts.push(item.path);
        if (item.type) parts.push(item.type);
        if (item.tags) {
            const tags = Array.isArray(item.tags) ? item.tags.join(' ') : item.tags;
            parts.push(tags);
        }
        
        return parts.join(' ').toLowerCase();
    }
    
    /**
     * Mise à jour de l'index d'un fichier
     */
    updateFileIndex(file) {
        this.indexFile(file);
    }
    
    /**
     * Suppression d'un fichier de l'index
     */
    removeFromIndex(fileId) {
        if (this.fileIndex.delete(fileId)) {
            this.clearCache();
            this.logDebug('debug', `Removed file from index: ${fileId}`);
        }
    }
    
    /**
     * Suppression d'une playlist de l'index
     */
    removePlaylistFromIndex(playlistId) {
        if (this.playlistIndex.delete(playlistId)) {
            this.clearCache();
            this.logDebug('debug', `Removed playlist from index: ${playlistId}`);
        }
    }
    
    /**
     * Suppression d'un instrument de l'index
     */
    removeInstrumentFromIndex(instrumentId) {
        if (this.instrumentIndex.delete(instrumentId)) {
            this.clearCache();
            this.logDebug('debug', `Removed instrument from index: ${instrumentId}`);
        }
    }
    
    /**
     * Réindexation complète
     */
    reindexAll(files = [], playlists = [], instruments = []) {
        this.logDebug('info', 'Reindexing all content...');
        
        // Vider les index
        this.fileIndex.clear();
        this.playlistIndex.clear();
        this.instrumentIndex.clear();
        this.clearCache();
        
        // Réindexer
        files.forEach(file => this.indexFile(file));
        playlists.forEach(playlist => this.indexPlaylist(playlist));
        instruments.forEach(instrument => this.indexInstrument(instrument));
        
        this.logDebug('info', `Reindexed ${files.length} files, ${playlists.length} playlists, ${instruments.length} instruments`);
        
        // Émettre événement
        this.emitEvent('search:reindexed', {
            fileCount: files.length,
            playlistCount: playlists.length,
            instrumentCount: instruments.length
        });
    }
    
    /**
     * Gestion du cache
     */
    getCachedResults(query) {
        const cached = this.resultCache.get(query);
        if (!cached) return null;
        
        const now = Date.now();
        if (now - cached.timestamp > this.config.cacheExpiryMs) {
            this.resultCache.delete(query);
            return null;
        }
        
        return cached.results;
    }
    
    cacheResults(query, results) {
        // Limiter la taille du cache
        if (this.resultCache.size >= this.config.cacheMaxSize) {
            // Supprimer l'entrée la plus ancienne
            const firstKey = this.resultCache.keys().next().value;
            this.resultCache.delete(firstKey);
        }
        
        this.resultCache.set(query, {
            results,
            timestamp: Date.now()
        });
    }
    
    clearCache() {
        this.resultCache.clear();
        this.logDebug('debug', 'Search cache cleared');
    }
    
    /**
     * Mise à jour des statistiques
     */
    updateSearchStats(searchTime) {
        this.stats.totalSearches++;
        
        // Moyenne mobile
        const alpha = 0.3; // Facteur de lissage
        this.stats.avgSearchTime = this.stats.avgSearchTime * (1 - alpha) + searchTime * alpha;
    }
    
    /**
     * Effacer l'index
     */
    clearIndex() {
        this.fileIndex.clear();
        this.playlistIndex.clear();
        this.instrumentIndex.clear();
        this.lastQuery = '';
        this.lastResults = [];
        this.clearCache();
        this.logDebug('info', 'Search index cleared');
    }
    
    /**
     * Obtenir les derniers résultats
     */
    getLastResults() {
        return {
            query: this.lastQuery,
            results: this.lastResults,
            count: this.lastResults.length
        };
    }
    
    /**
     * Statistiques de l'index
     */
    getIndexStats() {
        return {
            totalFiles: this.fileIndex.size,
            totalPlaylists: this.playlistIndex.size,
            totalInstruments: this.instrumentIndex.size,
            totalIndexed: this.fileIndex.size + this.playlistIndex.size + this.instrumentIndex.size,
            lastQuery: this.lastQuery,
            lastResultCount: this.lastResults.length,
            cacheSize: this.resultCache.size,
            stats: { ...this.stats }
        };
    }
    
    /**
     * Configuration
     */
    setConfig(config) {
        Object.assign(this.config, config);
        this.logDebug('debug', 'Configuration updated', config);
    }
    
    getConfig() {
        return { ...this.config };
    }
}

// ============================================================================
// EXPORT
// ============================================================================

if (typeof module !== 'undefined' && module.exports) {
    module.exports = SearchController;
}

if (typeof window !== 'undefined') {
    window.SearchController = SearchController;
}