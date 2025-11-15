// ============================================================================
// Fichier: frontend/js/controllers/PlaylistController.js
// Chemin rÃ©el: frontend/js/controllers/PlaylistController.js
// Version: v4.2.3 - API v4.2.2 FULLY COMPLIANT
// Date: 2025-11-09
// ============================================================================
// CORRECTIONS v4.2.3:
// âœ“ CRITIQUE: Ajout paramÃ¨tre backend au constructeur (6Ã¨me paramÃ¨tre)
// âœ“ Fix: super() appelle BaseController avec backend
// âœ“ this.backend initialisÃ© automatiquement via BaseController
// ============================================================================
// ============================================================================
// CORRECTIONS v4.2.2:
// â€¢ playlist_id, item_id, new_order (snake_case)
// â€¢ Utiliser helpers BackendService
// ============================================================================

class PlaylistController extends BaseController {
    constructor(eventBus, models = {}, views = {}, notifications = null, debugConsole = null, backend = null) {
        super(eventBus, models, views, notifications, debugConsole, backend);
        
        this.name = 'PlaylistController';
        this.playlistModel = models?.playlist || null;
        this.fileModel = models?.file || null;
        this.view = views?.playlist || null;
        // âœ“ this.backend initialisÃ© automatiquement par BaseController
        this.logger = window.logger || console;
        
        this.state = {
            currentPlaylist: null,
            currentFile: null,
            currentIndex: 0,
            isPlaying: false,
            shuffleMode: false,
            repeatMode: 'none',
            autoAdvance: true,
            queue: [],
            queueIndex: 0,
            isPlayingQueue: false,
            history: [],
            lastAction: null,
            errors: []
        };
        
        this.config = {
            maxHistorySize: 50,
            autoSaveState: true,
            autoRefreshView: true,
            autoNotifications: true,
            enableQueue: true,
            enableShuffle: true,
            enableRepeat: true,
            enableAutoAdvance: true,
            enableImportExport: true,
            notifyOnChange: true,
            persistState: true,
            debugMode: false
        };
        
        this.cache = {
            playlists: new Map(),
            files: new Map(),
            lastUpdate: null,
            dirty: false
        };
        
        this.stats = {
            playlistsCreated: 0,
            playlistsDeleted: 0,
            filesPlayed: 0,
            totalPlaytime: 0,
            queueOperations: 0,
            shuffleToggles: 0,
            errors: 0
        };
        
        this.logDebug('playlist', 'ðŸŽµ PlaylistController v4.2.2 initialized');
    }
    
    initialize() {
        this.bindEvents();
        this.loadSavedState();
        this.state.isInitialized = true;
    }
    
    bindEvents() {
        this.eventBus.on('playlist:create', (data) => this.createPlaylist(data));
        this.eventBus.on('playlist:load', (data) => this.loadPlaylist(data.playlist_id));
        this.eventBus.on('playlist:update', (data) => this.updatePlaylist(data.playlist_id, data.updates));
        this.eventBus.on('playlist:delete', (data) => this.deletePlaylist(data.playlist_id));
        this.eventBus.on('playlist:add-file', (data) => this.addFileToPlaylist(data.playlist_id, data.filename));
        this.eventBus.on('playlist:remove-file', (data) => this.removeFileFromPlaylist(data.playlist_id, data.item_id));
        this.eventBus.on('playlist:reorder', (data) => this.reorderPlaylist(data.playlist_id, data.item_id, data.new_order));
        this.eventBus.on('playlist:play', (data) => this.play(data.index));
        this.eventBus.on('playlist:next', () => this.next());
        this.eventBus.on('playlist:previous', () => this.previous());
        this.eventBus.on('playlist:toggle-shuffle', () => this.toggleShuffle());
        this.eventBus.on('playlist:toggle-repeat', () => this.toggleRepeat());
    }
    
    async createPlaylist(data) {
        try {
            const { name, description = '' } = data;
            
            if (!this.backend?.isConnected()) {
                throw new Error('Backend not connected');
            }
            
            this.logDebug('playlist', `Creating playlist: ${name}`);
            
            const response = await this.backend.createPlaylist(name, description);
            
            this.stats.playlistsCreated++;
            
            if (this.playlistModel) {
                await this.playlistModel.loadPlaylists();
            }
            
            this.eventBus.emit('playlist:created', { playlist_id: response.playlist_id, name });
            
            if (this.notifications) {
                this.notifications.show('Playlist Created', name, 'success', 2000);
            }
            
            return response;
            
        } catch (error) {
            this.handleError(error, 'Failed to create playlist');
            throw error;
        }
    }
    
    /**
     * â€¢ CORRECTION: playlist_id
     */
    async loadPlaylist(playlist_id) {
        if (!playlist_id) {
            throw new Error('Playlist ID required');
        }
        
        try {
            this.logDebug('playlist', `Loading playlist: ${playlist_id}`);
            
            const playlist = await this.backend.getPlaylist(playlist_id);
            
            this.state.currentPlaylist = playlist;
            this.state.currentIndex = 0;
            
            if (this.playlistModel) {
                this.playlistModel.setCurrentPlaylist(playlist);
            }
            
            this.eventBus.emit('playlist:loaded', { playlist_id, playlist });
            
            this.refreshView();
            
            return playlist;
            
        } catch (error) {
            this.handleError(error, `Failed to load playlist ${playlist_id}`);
            throw error;
        }
    }
    
    async updatePlaylist(playlist_id, updates) {
        try {
            this.logDebug('playlist', `Updating playlist: ${playlist_id}`);
            
            const response = await this.backend.updatePlaylist(playlist_id, updates);
            
            if (this.state.currentPlaylist?.id === playlist_id) {
                this.state.currentPlaylist = { ...this.state.currentPlaylist, ...updates };
            }
            
            this.eventBus.emit('playlist:updated', { playlist_id, updates });
            
            this.refreshView();
            
            return response;
            
        } catch (error) {
            this.handleError(error, `Failed to update playlist ${playlist_id}`);
            throw error;
        }
    }
    
    async deletePlaylist(playlist_id) {
        try {
            this.logDebug('playlist', `Deleting playlist: ${playlist_id}`);
            
            await this.backend.deletePlaylist(playlist_id);
            
            this.stats.playlistsDeleted++;
            
            if (this.state.currentPlaylist?.id === playlist_id) {
                this.state.currentPlaylist = null;
            }
            
            this.eventBus.emit('playlist:deleted', { playlist_id });
            
            if (this.notifications) {
                this.notifications.show('Playlist Deleted', '', 'success', 2000);
            }
            
            this.refreshView();
            
        } catch (error) {
            this.handleError(error, `Failed to delete playlist ${playlist_id}`);
            throw error;
        }
    }
    
    /**
     * â€¢ CORRECTION: playlist_id, filename, order
     */
    async addFileToPlaylist(playlist_id, filename, order = null) {
        try {
            this.logDebug('playlist', `Adding file ${filename} to playlist ${playlist_id}`);
            
            await this.backend.addPlaylistItem(playlist_id, filename, order);
            
            await this.loadPlaylist(playlist_id);
            
            this.eventBus.emit('playlist:file-added', { playlist_id, filename });
            
            if (this.notifications) {
                this.notifications.show('File Added', filename, 'success', 2000);
            }
            
        } catch (error) {
            this.handleError(error, 'Failed to add file to playlist');
            throw error;
        }
    }
    
    async removeFileFromPlaylist(playlist_id, item_id) {
        try {
            this.logDebug('playlist', `Removing item ${item_id} from playlist ${playlist_id}`);
            
            await this.backend.removePlaylistItem(playlist_id, item_id);
            
            await this.loadPlaylist(playlist_id);
            
            this.eventBus.emit('playlist:file-removed', { playlist_id, item_id });
            
            if (this.notifications) {
                this.notifications.show('File Removed', '', 'success', 2000);
            }
            
        } catch (error) {
            this.handleError(error, 'Failed to remove file from playlist');
            throw error;
        }
    }
    
    /**
     * â€¢ CORRECTION: new_order (snake_case)
     */
    
    /**
     * ✅ CORRECTION API v4.2.2: playlist.reorder utilise item_ids (array)
     * Réorganise une playlist en déplaçant un item vers une nouvelle position
     * @param {string} playlist_id - ID de la playlist
     * @param {number} item_id - ID de l'item à déplacer
     * @param {number} new_order - Nouvelle position (index)
     */
    async reorderPlaylist(playlist_id, item_id, new_order) {
        try {
            this.logDebug('playlist', `Reordering playlist ${playlist_id}: item ${item_id} to position ${new_order}`);
            
            // Récupérer la playlist actuelle pour construire l'array item_ids
            const playlist = await this.backend.getPlaylist(playlist_id);
            
            if (!playlist || !playlist.items) {
                throw new Error('Playlist not found or has no items');
            }
            
            // Construire l'array item_ids actuel
            const currentOrder = playlist.items.map(item => item.id);
            
            // Trouver l'index actuel de l'item à déplacer
            const currentIndex = currentOrder.findIndex(id => id === item_id);
            
            if (currentIndex === -1) {
                throw new Error(`Item ${item_id} not found in playlist`);
            }
            
            // Valider new_order
            if (new_order < 0 || new_order >= currentOrder.length) {
                throw new Error(`Invalid new_order ${new_order} (playlist has ${currentOrder.length} items)`);
            }
            
            // Créer le nouvel ordre en déplaçant l'item
            const newOrder = [...currentOrder];
            newOrder.splice(currentIndex, 1); // Retirer l'item de sa position actuelle
            newOrder.splice(new_order, 0, item_id); // L'insérer à la nouvelle position
            
            // Appeler l'API avec le nouvel ordre complet
            await this.backend.reorderPlaylist(playlist_id, newOrder);
            
            // Recharger la playlist
            await this.loadPlaylist(playlist_id);
            
            this.eventBus.emit('playlist:reordered', { playlist_id, item_id, new_order });
            
        } catch (error) {
            this.handleError(error, 'Failed to reorder playlist');
            throw error;
        }
    }
    
    async play(index = 0) {
        if (!this.state.currentPlaylist) {
            throw new Error('No playlist loaded');
        }
        
        this.state.currentIndex = index;
        this.state.isPlaying = true;
        
        const file = this.state.currentPlaylist.items[index];
        if (file) {
            this.state.currentFile = file;
            this.eventBus.emit('playlist:play', { file, index });
        }
    }
    
    async next() {
        if (!this.state.currentPlaylist) return;
        
        let nextIndex = this.state.currentIndex + 1;
        
        if (nextIndex >= this.state.currentPlaylist.items.length) {
            if (this.state.repeatMode === 'all') {
                nextIndex = 0;
            } else {
                return;
            }
        }
        
        await this.play(nextIndex);
    }
    
    async previous() {
        if (!this.state.currentPlaylist) return;
        
        let prevIndex = this.state.currentIndex - 1;
        
        if (prevIndex < 0) {
            if (this.state.repeatMode === 'all') {
                prevIndex = this.state.currentPlaylist.items.length - 1;
            } else {
                return;
            }
        }
        
        await this.play(prevIndex);
    }
    
    toggleShuffle() {
        this.state.shuffleMode = !this.state.shuffleMode;
        this.stats.shuffleToggles++;
        this.eventBus.emit('playlist:shuffle-toggled', { enabled: this.state.shuffleMode });
    }
    
    toggleRepeat() {
        const modes = ['none', 'one', 'all'];
        const currentIndex = modes.indexOf(this.state.repeatMode);
        this.state.repeatMode = modes[(currentIndex + 1) % modes.length];
        this.eventBus.emit('playlist:repeat-toggled', { mode: this.state.repeatMode });
    }
    
    refreshView() {
        if (this.view && typeof this.view.render === 'function') {
            this.view.render(this.state);
        }
    }
    
    loadSavedState() {
        if (!this.config.persistState) return;
        
        try {
            const saved = localStorage.getItem('playlist_state');
            if (saved) {
                const state = JSON.parse(saved);
                this.state = { ...this.state, ...state };
            }
        } catch (error) {
            this.logDebug('playlist', 'Failed to load saved state', 'warn');
        }
    }
    
    saveState() {
        if (!this.config.persistState) return;
        
        try {
            localStorage.setItem('playlist_state', JSON.stringify(this.state));
        } catch (error) {
            this.logDebug('playlist', 'Failed to save state', 'warn');
        }
    }
    
    handleError(error, context) {
        this.stats.errors++;
        this.state.errors.push({ error, context, timestamp: Date.now() });
        this.logDebug('playlist', `${context}: ${error.message}`, 'error');
        
        if (this.notifications) {
            this.notifications.show('Error', error.message, 'error', 3000);
        }
    }
    
    logDebug(category, message, level = 'info') {
        if (this.logger && typeof this.logger[level] === 'function') {
            this.logger[level](category, message);
        } else {
            console.log(`[${category}] ${message}`);
        }
    }
}

if (typeof window !== 'undefined') {
    window.PlaylistController = PlaylistController;
}