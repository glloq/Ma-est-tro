// ============================================================================
// Fichier: frontend/js/views/PlaylistView.js
// Version: v4.0.1 - CONFORMITÉ API + MÉTHODES RENDER
// Date: 2025-11-08
// ============================================================================
// AMÉLIORATIONS v4.0.1:
// ✅ Ajout méthode render() pour insertion DOM
// ✅ Ajout méthode show() pour affichage et rechargement playlists
// ✅ Ajout méthode hide() pour masquage
// ✅ API v4.2.2: playlist.* (create, delete, update, list, get, addItem, removeItem, reorder, setLoop)
// ✅ Drag & drop pour réorganiser
// ✅ Gestion loop
// ============================================================================

class PlaylistView extends BaseView {
    constructor(containerId, eventBus) {
        super(containerId, eventBus);
        
        this.logger = window.logger || console;
        
        // État
        this.viewState = {
            playlists: [],
            selectedPlaylist: null,
            playlistItems: [],
            isEditing: false,
            draggedItem: null
        };
        
        this.log('info', 'PlaylistView', '✅ PlaylistView v4.0.1 initialized');
    }
    
    // ========================================================================
    // TEMPLATE
    // ========================================================================
    
    buildTemplate(data = {}) {
        const state = { ...this.viewState, ...data };
        
        return `
            <div class="playlist-view-container">
                <div class="page-header">
                    <h1>🎵 Playlists</h1>
                    <div class="header-actions">
                        <button class="btn-create" data-action="create-playlist">
                            ➕ Nouvelle Playlist
                        </button>
                    </div>
                </div>
                
                <div class="playlist-layout">
                    <!-- Liste des playlists -->
                    <div class="playlists-sidebar">
                        <h2>Mes playlists</h2>
                        <div id="playlistsList">
                            ${this.renderPlaylistsList(state)}
                        </div>
                    </div>
                    
                    <!-- Contenu playlist -->
                    <div class="playlist-content">
                        ${state.selectedPlaylist ? 
                            this.renderPlaylistContent(state) : 
                            this.renderNoSelection()}
                    </div>
                </div>
            </div>
        `;
    }
    
    // ========================================================================
    // RENDERING - MÉTHODES PRINCIPALES
    // ========================================================================
    
    /**
     * Rendre la vue playlist
     * @param {Object} data - Données optionnelles pour le rendu
     */
    render(data = null) {
        if (!this.container) {
            this.log('error', 'PlaylistView', 'Cannot render: container not found');
            return;
        }
        
        const startTime = performance.now();
        
        try {
            // Générer et insérer le HTML
            this.container.innerHTML = this.buildTemplate(data || this.viewState);
            
            // Attacher les événements
            this.attachEvents();
            
            // Mettre à jour l'état
            this.state.rendered = true;
            this.state.lastUpdate = Date.now();
            
            // Émettre événement
            if (this.eventBus) {
                this.eventBus.emit('playlist-view:rendered', {
                    playlistsCount: this.viewState.playlists.length
                });
            }
            
            const renderTime = performance.now() - startTime;
            this.log('debug', 'PlaylistView', `✓ Rendered in ${renderTime.toFixed(2)}ms`);
            
        } catch (error) {
            this.log('error', 'PlaylistView', 'Render failed:', error);
            this.handleError('Render failed', error);
        }
    }

    /**
     * Afficher la vue playlist
     */
    show() {
        if (this.container) {
            this.container.style.display = 'block';
            this.state.visible = true;
            
            // Recharger les playlists si nécessaire
            if (this.viewState.playlists.length === 0) {
                this.loadPlaylists();
            }
        }
    }

    /**
     * Masquer la vue playlist
     */
    hide() {
        if (this.container) {
            this.container.style.display = 'none';
            this.state.visible = false;
        }
    }
    
    // ========================================================================
    // RENDERING - SOUS-COMPOSANTS
    // ========================================================================
    
    renderPlaylistsList(state) {
        const playlists = state.playlists;
        
        if (playlists.length === 0) {
            return `
                <div class="playlists-empty">
                    <p>Aucune playlist</p>
                    <button class="btn-create-first" data-action="create-playlist">
                        ➕ Créer
                    </button>
                </div>
            `;
        }
        
        return `
            <div class="playlists-list">
                ${playlists.map(pl => this.renderPlaylistItem(pl, state.selectedPlaylist)).join('')}
            </div>
        `;
    }
    
    renderPlaylistItem(playlist, selectedPlaylist) {
        const isSelected = selectedPlaylist && selectedPlaylist.id === playlist.id;
        const itemCount = playlist.item_count || (playlist.items ? playlist.items.length : 0);
        
        return `
            <div class="playlist-item ${isSelected ? 'selected' : ''}" 
                 data-playlist-id="${playlist.id}">
                <div class="playlist-icon">📋</div>
                <div class="playlist-info">
                    <div class="playlist-name">${playlist.name}</div>
                    <div class="playlist-count">${itemCount} morceaux</div>
                </div>
                <div class="playlist-actions">
                    <button class="btn-icon" data-action="select-playlist" title="Voir">👁️</button>
                    <button class="btn-icon" data-action="delete-playlist" title="Supprimer">🗑️</button>
                </div>
            </div>
        `;
    }
    
    renderPlaylistContent(state) {
        const pl = state.selectedPlaylist;
        const items = state.playlistItems;
        
        return `
            <div class="playlist-header">
                <div class="playlist-title">
                    <input type="text" class="playlist-name-input" 
                           value="${pl.name}" data-action="rename-playlist" />
                    <span class="playlist-loop ${pl.loop ? 'active' : ''}" 
                          data-action="toggle-loop">
                        🔁 Loop ${pl.loop ? 'ON' : 'OFF'}
                    </span>
                </div>
                <div class="playlist-actions">
                    <button class="btn-play-all" data-action="play-playlist">
                        ▶ Lire tout
                    </button>
                    <button class="btn-add-files" data-action="add-files">
                        ➕ Ajouter des fichiers
                    </button>
                </div>
            </div>
            
            <div class="playlist-items" id="playlistItems">
                ${items.length > 0 ? 
                    this.renderPlaylistItems(items) : 
                    this.renderEmptyPlaylist()}
            </div>
        `;
    }
    
    renderPlaylistItems(items) {
        return `
            <div class="items-list">
                ${items.map((item, index) => this.renderPlaylistItemEntry(item, index)).join('')}
            </div>
        `;
    }
    
    renderPlaylistItemEntry(item, index) {
        return `
            <div class="item-entry" 
                 data-item-id="${item.id}" 
                 data-index="${index}"
                 draggable="true">
                <div class="item-drag">☰</div>
                <div class="item-order">${index + 1}</div>
                <div class="item-info">
                    <div class="item-name">${item.file_path || item.name || '—'}</div>
                    <div class="item-duration">${item.duration ? this.formatDuration(item.duration) : '—'}</div>
                </div>
                <div class="item-actions">
                    <button class="btn-icon" data-action="play-item" title="Lire">▶</button>
                    <button class="btn-icon" data-action="remove-item" title="Retirer">✕</button>
                </div>
            </div>
        `;
    }
    
    renderEmptyPlaylist() {
        return `
            <div class="playlist-empty">
                <div class="empty-icon">🎵</div>
                <p>Playlist vide</p>
                <button class="btn-add-files" data-action="add-files">
                    ➕ Ajouter des fichiers
                </button>
            </div>
        `;
    }
    
    renderNoSelection() {
        return `
            <div class="no-selection">
                <div class="empty-icon">📋</div>
                <p>Sélectionnez une playlist</p>
            </div>
        `;
    }
    
    // ========================================================================
    // EVENTS
    // ========================================================================
    
    attachEvents() {
        super.attachEvents();
        
        if (!this.container) return;
        
        this.container.addEventListener('click', (e) => {
            const action = e.target.closest('[data-action]')?.dataset.action;
            if (!action) return;
            
            const playlistItem = e.target.closest('.playlist-item');
            const itemEntry = e.target.closest('.item-entry');
            
            switch (action) {
                case 'create-playlist':
                    this.createPlaylist();
                    break;
                case 'select-playlist':
                    if (playlistItem) this.selectPlaylist(playlistItem.dataset.playlistId);
                    break;
                case 'delete-playlist':
                    if (playlistItem) this.deletePlaylist(playlistItem.dataset.playlistId);
                    break;
                case 'play-playlist':
                    this.playPlaylist();
                    break;
                case 'add-files':
                    this.addFiles();
                    break;
                case 'toggle-loop':
                    this.toggleLoop();
                    break;
                case 'play-item':
                    if (itemEntry) this.playItem(itemEntry.dataset.itemId);
                    break;
                case 'remove-item':
                    if (itemEntry) this.removeItem(itemEntry.dataset.itemId);
                    break;
            }
        });
        
        // Drag & drop
        this.container.addEventListener('dragstart', (e) => {
            const itemEntry = e.target.closest('.item-entry');
            if (itemEntry) {
                this.viewState.draggedItem = itemEntry.dataset.itemId;
                itemEntry.classList.add('dragging');
            }
        });
        
        this.container.addEventListener('dragend', (e) => {
            const itemEntry = e.target.closest('.item-entry');
            if (itemEntry) {
                itemEntry.classList.remove('dragging');
                this.viewState.draggedItem = null;
            }
        });
        
        this.container.addEventListener('dragover', (e) => {
            e.preventDefault();
            const itemEntry = e.target.closest('.item-entry');
            if (itemEntry) {
                itemEntry.classList.add('drag-over');
            }
        });
        
        this.container.addEventListener('dragleave', (e) => {
            const itemEntry = e.target.closest('.item-entry');
            if (itemEntry) {
                itemEntry.classList.remove('drag-over');
            }
        });
        
        this.container.addEventListener('drop', (e) => {
            e.preventDefault();
            const itemEntry = e.target.closest('.item-entry');
            if (itemEntry && this.viewState.draggedItem) {
                this.reorderItem(this.viewState.draggedItem, itemEntry.dataset.index);
                itemEntry.classList.remove('drag-over');
            }
        });
        
        // Rename
        this.container.addEventListener('blur', (e) => {
            if (e.target.dataset.action === 'rename-playlist') {
                this.renamePlaylist(e.target.value);
            }
        }, true);
        
        this.setupEventBusListeners();
    }
    
    setupEventBusListeners() {
        if (!this.eventBus) return;
        
        // playlist.list response
        this.eventBus.on('playlists:listed', (data) => {
            this.viewState.playlists = data.playlists || [];
            this.render();
        });
        
        // playlist.get response
        this.eventBus.on('playlist:loaded', (data) => {
            this.viewState.selectedPlaylist = data.playlist;
            this.viewState.playlistItems = data.playlist.items || [];
            this.render();
        });
        
        // playlist.create response
        this.eventBus.on('playlist:created', (data) => {
            this.loadPlaylists();
        });
        
        // playlist.delete response
        this.eventBus.on('playlist:deleted', (data) => {
            if (this.viewState.selectedPlaylist && 
                this.viewState.selectedPlaylist.id === data.playlist_id) {
                this.viewState.selectedPlaylist = null;
                this.viewState.playlistItems = [];
            }
            this.loadPlaylists();
        });
        
        // playlist.update response
        this.eventBus.on('playlist:updated', (data) => {
            this.loadPlaylist(this.viewState.selectedPlaylist.id);
        });
    }
    
    // ========================================================================
    // ACTIONS
    // ========================================================================
    
    async createPlaylist() {
        const name = prompt('Nom de la playlist:');
        if (!name) return;
        
        // API: playlist.create
        if (this.eventBus) {
            this.eventBus.emit('playlist:create_requested', {
                name,
                description: ''
            });
        }
    }
    
    async selectPlaylist(playlistId) {
        // API: playlist.get
        if (this.eventBus) {
            this.eventBus.emit('playlist:get_requested', {
                playlist_id: playlistId
            });
        }
    }
    
    async deletePlaylist(playlistId) {
        if (!confirm('Supprimer cette playlist ?')) return;
        
        // API: playlist.delete
        if (this.eventBus) {
            this.eventBus.emit('playlist:delete_requested', {
                playlist_id: playlistId
            });
        }
    }
    
    async renamePlaylist(newName) {
        if (!this.viewState.selectedPlaylist || !newName) return;
        
        // API: playlist.update
        if (this.eventBus) {
            this.eventBus.emit('playlist:update_requested', {
                playlist_id: this.viewState.selectedPlaylist.id,
                name: newName
            });
        }
    }
    
    async toggleLoop() {
        if (!this.viewState.selectedPlaylist) return;
        
        const newLoop = !this.viewState.selectedPlaylist.loop;
        
        // API: playlist.setLoop
        if (this.eventBus) {
            this.eventBus.emit('playlist:set_loop_requested', {
                playlist_id: this.viewState.selectedPlaylist.id,
                loop: newLoop
            });
        }
    }
    
    async addFiles() {
        // Montrer modal de sélection de fichiers
        if (this.eventBus) {
            this.eventBus.emit('playlist:add_files_modal_requested', {
                playlist_id: this.viewState.selectedPlaylist.id
            });
        }
    }
    
    async removeItem(itemId) {
        if (!this.viewState.selectedPlaylist) return;
        
        // API: playlist.removeItem
        if (this.eventBus) {
            this.eventBus.emit('playlist:remove_item_requested', {
                playlist_id: this.viewState.selectedPlaylist.id,
                item_id: itemId
            });
        }
    }
    
    async reorderItem(itemId, newIndex) {
        if (!this.viewState.selectedPlaylist) return;
        
        // API: playlist.reorder
        if (this.eventBus) {
            this.eventBus.emit('playlist:reorder_requested', {
                playlist_id: this.viewState.selectedPlaylist.id,
                item_id: itemId,
                new_index: parseInt(newIndex)
            });
        }
    }
    
    async playPlaylist() {
        if (!this.viewState.selectedPlaylist) return;
        
        // Émettre event pour lire la playlist
        if (this.eventBus) {
            this.eventBus.emit('playlist:play_requested', {
                playlist_id: this.viewState.selectedPlaylist.id
            });
        }
    }
    
    async playItem(itemId) {
        // Émettre event pour lire un item spécifique
        if (this.eventBus) {
            this.eventBus.emit('playlist:play_item_requested', {
                item_id: itemId
            });
        }
    }
    
    // ========================================================================
    // LOADING
    // ========================================================================
    
    async loadPlaylists() {
        // API: playlist.list
        if (this.eventBus) {
            this.eventBus.emit('playlist:list_requested');
        }
    }
    
    async loadPlaylist(playlistId) {
        // API: playlist.get
        if (this.eventBus) {
            this.eventBus.emit('playlist:get_requested', {
                playlist_id: playlistId
            });
        }
    }
    
    // ========================================================================
    // UTILITAIRES
    // ========================================================================
    
    formatDuration(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }
    
    // ========================================================================
    // INIT
    // ========================================================================
    
    init() {
        super.init();
        this.loadPlaylists();
    }
}

// ============================================================================
// EXPORT
// ============================================================================

if (typeof module !== 'undefined' && module.exports) {
    module.exports = PlaylistView;
}

if (typeof window !== 'undefined') {
    window.PlaylistView = PlaylistView;
}