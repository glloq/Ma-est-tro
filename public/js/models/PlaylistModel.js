// ============================================================================
// Fichier: frontend/js/models/PlaylistModel.js
// Chemin réel: frontend/js/models/PlaylistModel.js
// Version: v4.2.2 - API CONFORME v4.2.2
// Date: 2025-11-02
// ============================================================================
// API v4.2.2 - PLAYLISTS (9 commandes):
// ✅ playlist.create
// ✅ playlist.delete
// ✅ playlist.update
// ✅ playlist.list
// ✅ playlist.get
// ✅ playlist.addItem
// ✅ playlist.removeItem
// ✅ playlist.reorder
// ✅ playlist.setLoop
// ✅ Extraction response.data corrigée
// ============================================================================

class PlaylistModel extends BaseModel {
    constructor(eventBus, backend, logger, initialData = {}, options = {}) {
        super(eventBus, backend, logger, {
            playlists: [],
            currentPlaylist: null,
            currentPlaylistId: null,
            ...initialData
        }, {
            persistKey: 'playlistmodel',
            eventPrefix: 'playlist',
            autoPersist: true,
            ...options
        });
        
        if (!this.data) {
            this.data = {};
        }
        
        this.data.playlists = this.data.playlists || [];
        this.data.currentPlaylist = this.data.currentPlaylist || null;
        this.data.currentPlaylistId = this.data.currentPlaylistId || null;
        
        this.log('debug', 'PlaylistModel', '✓ PlaylistModel v4.2.2 initialized (API v4.2.2)');
    }
    
    // ========================================================================
    // GESTION DES PLAYLISTS - API v4.2.2
    // ========================================================================
    
    /**
     * Crée une nouvelle playlist
     * ✅ API v4.2.2: playlist.create
     * @param {string} name - Nom de la playlist
     * @param {Array} items - Items initiaux (optionnel)
     */
    async createPlaylist(name, items = []) {
        if (!this.backend || !this.backend.isConnected()) {
            this.log('warn', 'PlaylistModel.createPlaylist', 'Backend not connected');
            return null;
        }
        
        try {
            this.log('info', 'PlaylistModel', `Creating playlist: ${name}`);
            
            const response = await this.backend.sendCommand('playlist.create', {
                name,
                items
            });
            const data = response.data || response;
            
            if (data && data.playlist_id) {
                // Recharger la liste des playlists
                await this.refreshPlaylists();
                
                this.emit('playlist:created', {
                    playlist_id: data.playlist_id,
                    name
                });
                
                return data.playlist_id;
            }
            
            return null;
        } catch (error) {
            this.log('error', 'PlaylistModel.createPlaylist', error.message);
            throw error;
        }
    }
    
    /**
     * Supprime une playlist
     * ✅ API v4.2.2: playlist.delete
     * @param {string} playlist_id - ID de la playlist
     */
    async deletePlaylist(playlist_id) {
        if (!this.backend || !this.backend.isConnected()) {
            this.log('warn', 'PlaylistModel.deletePlaylist', 'Backend not connected');
            return false;
        }
        
        try {
            this.log('info', 'PlaylistModel', `Deleting playlist: ${playlist_id}`);
            
            const response = await this.backend.sendCommand('playlist.delete', {
                playlist_id: playlist_id
            });
            const data = response.data || response;
            
            // Si c'était la playlist actuelle, la déselectionner
            if (this.data.currentPlaylistId === playlist_id) {
                this.data.currentPlaylist = null;
                this.data.currentPlaylistId = null;
            }
            
            // Recharger la liste
            await this.refreshPlaylists();
            
            this.emit('playlist:deleted', { playlist_id });
            
            return true;
        } catch (error) {
            this.log('error', 'PlaylistModel.deletePlaylist', error.message);
            throw error;
        }
    }
    
    /**
     * Met à jour une playlist
     * ✅ API v4.2.2: playlist.update
     * @param {string} playlist_id - ID de la playlist
     * @param {Object} config - Configuration à mettre à jour
     */
    async updatePlaylist(playlist_id, config) {
        if (!this.backend || !this.backend.isConnected()) {
            this.log('warn', 'PlaylistModel.updatePlaylist', 'Backend not connected');
            return false;
        }
        
        try {
            this.log('info', 'PlaylistModel', `Updating playlist: ${playlist_id}`);
            
            const response = await this.backend.sendCommand('playlist.update', {
                playlist_id: playlist_id,
                config
            });
            const data = response.data || response;
            
            // Recharger la liste
            await this.refreshPlaylists();
            
            this.emit('playlist:updated', { playlist_id, config });
            
            return true;
        } catch (error) {
            this.log('error', 'PlaylistModel.updatePlaylist', error.message);
            throw error;
        }
    }
    
    /**
     * Liste toutes les playlists
     * ✅ API v4.2.2: playlist.list
     */
    async refreshPlaylists() {
        if (!this.backend || !this.backend.isConnected()) {
            this.log('warn', 'PlaylistModel.refreshPlaylists', 'Backend not connected');
            return [];
        }
        
        try {
            this.log('info', 'PlaylistModel', 'Refreshing playlists');
            
            const response = await this.backend.sendCommand('playlist.list');
            const data = response.data || response;
            
            const playlists = data.playlists || [];
            this.set('playlists', playlists);
            
            this.emit('playlists:refreshed', { playlists });
            
            return playlists;
        } catch (error) {
            this.log('error', 'PlaylistModel.refreshPlaylists', error.message);
            return [];
        }
    }
    
    /**
     * Récupère une playlist spécifique
     * ✅ API v4.2.2: playlist.get
     * @param {string} playlist_id - ID de la playlist
     */
    async getPlaylist(playlist_id) {
        if (!this.backend || !this.backend.isConnected()) {
            this.log('warn', 'PlaylistModel.getPlaylist', 'Backend not connected');
            return null;
        }
        
        try {
            this.log('info', 'PlaylistModel', `Getting playlist: ${playlist_id}`);
            
            const response = await this.backend.sendCommand('playlist.get', {
                playlist_id: playlist_id
            });
            const data = response.data || response;
            
            if (data) {
                // Mettre à jour la playlist actuelle
                this.set('currentPlaylist', data);
                this.set('currentPlaylistId', playlist_id);
                
                this.emit('playlist:loaded', { 
                    playlist_id, 
                    playlist: data 
                });
                
                return data;
            }
            
            return null;
        } catch (error) {
            this.log('error', 'PlaylistModel.getPlaylist', error.message);
            return null;
        }
    }
    
    /**
     * Ajoute un item à une playlist
     * ✅ API v4.2.2: playlist.addItem
     * @param {string} playlist_id - ID de la playlist
     * @param {Object} item - Item à ajouter
     */
    async addItem(playlist_id, item) {
        if (!this.backend || !this.backend.isConnected()) {
            this.log('warn', 'PlaylistModel.addItem', 'Backend not connected');
            return false;
        }
        
        try {
            this.log('info', 'PlaylistModel', `Adding item to playlist: ${playlist_id}`);
            
            const response = await this.backend.sendCommand('playlist.addItem', {
                playlist_id: playlist_id,
                item
            });
            const data = response.data || response;
            
            // Recharger la playlist actuelle si c'est celle-ci
            if (this.data.currentPlaylistId === playlist_id) {
                await this.getPlaylist(playlist_id);
            }
            
            this.emit('playlist:item-added', { playlist_id, item });
            
            return true;
        } catch (error) {
            this.log('error', 'PlaylistModel.addItem', error.message);
            throw error;
        }
    }
    
    /**
     * Retire un item d'une playlist
     * ✅ API v4.2.2: playlist.removeItem
     * @param {string} playlist_id - ID de la playlist
     * @param {string} item_id - ID de l'item
     */
    async removeItem(playlist_id, item_id) {
        if (!this.backend || !this.backend.isConnected()) {
            this.log('warn', 'PlaylistModel.removeItem', 'Backend not connected');
            return false;
        }
        
        try {
            this.log('info', 'PlaylistModel', `Removing item from playlist: ${playlist_id}`);
            
            const response = await this.backend.sendCommand('playlist.removeItem', {
                playlist_id: playlist_id,
                item_id: item_id
            });
            const data = response.data || response;
            
            // Recharger la playlist actuelle si c'est celle-ci
            if (this.data.currentPlaylistId === playlist_id) {
                await this.getPlaylist(playlist_id);
            }
            
            this.emit('playlist:item-removed', { playlist_id, item_id });
            
            return true;
        } catch (error) {
            this.log('error', 'PlaylistModel.removeItem', error.message);
            throw error;
        }
    }
    
    /**
     * Réordonne les items d'une playlist
     * ✅ API v4.2.2: playlist.reorder
     * @param {string} playlist_id - ID de la playlist
     * @param {Array} order - Nouvel ordre des items
     */
    async reorderItems(playlist_id, order) {
        if (!this.backend || !this.backend.isConnected()) {
            this.log('warn', 'PlaylistModel.reorderItems', 'Backend not connected');
            return false;
        }
        
        try {
            this.log('info', 'PlaylistModel', `Reordering playlist: ${playlist_id}`);
            
            const response = await this.backend.sendCommand('playlist.reorder', {
                playlist_id: playlist_id,
                order
            });
            const data = response.data || response;
            
            // Recharger la playlist actuelle si c'est celle-ci
            if (this.data.currentPlaylistId === playlist_id) {
                await this.getPlaylist(playlist_id);
            }
            
            this.emit('playlist:reordered', { playlist_id, order });
            
            return true;
        } catch (error) {
            this.log('error', 'PlaylistModel.reorderItems', error.message);
            throw error;
        }
    }
    
    /**
     * Active/désactive la boucle sur une playlist
     * ✅ API v4.2.2: playlist.setLoop
     * @param {string} playlist_id - ID de la playlist
     * @param {boolean} enabled - État de la boucle
     */
    async setLoop(playlist_id, enabled) {
        if (!this.backend || !this.backend.isConnected()) {
            this.log('warn', 'PlaylistModel.setLoop', 'Backend not connected');
            return false;
        }
        
        try {
            this.log('info', 'PlaylistModel', `Setting loop for playlist: ${playlist_id} = ${enabled}`);
            
            const response = await this.backend.sendCommand('playlist.setLoop', {
                playlist_id: playlist_id,
                enabled
            });
            const data = response.data || response;
            
            // Recharger la playlist actuelle si c'est celle-ci
            if (this.data.currentPlaylistId === playlist_id) {
                await this.getPlaylist(playlist_id);
            }
            
            this.emit('playlist:loop-changed', { playlist_id, enabled });
            
            return true;
        } catch (error) {
            this.log('error', 'PlaylistModel.setLoop', error.message);
            throw error;
        }
    }
    
    // ========================================================================
    // MÉTHODES LOCALES (GETTERS)
    // ========================================================================
    
    /**
     * Retourne toutes les playlists
     */
    getPlaylists() {
        return this.get('playlists') || [];
    }
    
    /**
     * Retourne la playlist actuelle
     */
    getCurrentPlaylist() {
        return this.get('currentPlaylist');
    }
    
    /**
     * Retourne l'ID de la playlist actuelle
     */
    getCurrentPlaylistId() {
        return this.get('currentPlaylistId');
    }
    
    /**
     * Recherche une playlist par nom
     */
    findPlaylistByName(name) {
        const playlists = this.getPlaylists();
        return playlists.find(p => p.name === name);
    }
    
    /**
     * Recherche une playlist par ID
     */
    findPlaylistById(id) {
        const playlists = this.getPlaylists();
        return playlists.find(p => p.id === id);
    }
    
    /**
     * Vérifie si une playlist existe
     */
    hasPlaylist(playlist_id) {
        return this.findPlaylistById(playlist_id) !== undefined;
    }
    
    /**
     * Compte le nombre de playlists
     */
    getPlaylistCount() {
        return this.getPlaylists().length;
    }
}

// ============================================================================
// EXPORT
// ============================================================================

if (typeof module !== 'undefined' && module.exports) {
    module.exports = PlaylistModel;
}

if (typeof window !== 'undefined') {
    window.PlaylistModel = PlaylistModel;
}