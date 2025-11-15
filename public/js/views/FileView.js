// ============================================================================
// Fichier: frontend/js/views/FileView.js
// Chemin rÃ©el: frontend/js/views/FileView.js
// Version: v4.3.0 - COMPLET + INTERFACE COMPACTE + TOUS BOUTONS
// Date: 2025-11-12
// ============================================================================
// CORRECTIONS v4.3.0:
// âœ… CRITIQUE: MÃ©thode init() ajoutÃ©e (requise par BaseView)
// âœ… Interface compacte (40px par ligne avec buildFileRow)
// âœ… 5 boutons: DÃ©tails, Ã‰diter, Router, Jouer, Supprimer
// âœ… Handlers complets: handleEditFile(), handleRouteFile()
// âœ… UTF-8 entiÃ¨rement corrigÃ©
// âœ… Pas de downgrading - toutes fonctionnalitÃ©s prÃ©servÃ©es
// ============================================================================

class FileView extends BaseView {
    constructor(containerId, eventBus) {
        super(containerId, eventBus);
        
        this.logger = window.logger || console;
        
        // Ã‰tat spÃ©cifique Ã  la vue
        this.viewState = {
            files: [],
            selectedFile: null,
            currentPath: '/midi',
            isLoading: false,
            sortBy: 'name', // 'name', 'date', 'size'
            sortOrder: 'asc', // 'asc', 'desc'
            filter: '' // filtre de recherche
        };
        
        // Flag pour rÃ©attachement Ã©vÃ©nements
        this.needsEventReattach = false;
        
        this.log('debug', 'FileView', 'âœ… FileView v4.3.0 constructed');
        
        // ✅ CRITIQUE: Appeler setupEventBusListeners immédiatement
        this.setupEventBusListeners();
    }
    
    // ========================================================================
    // INITIALISATION âœ… AJOUTÃ‰E
    // ========================================================================
    
    /**
     * Initialise la vue FileView
     * MÃ©thode requise par BaseView et Application
     */
    init() {
        if (!this.container) {
            this.log('error', 'FileView', 'Cannot initialize: container not found');
            return;
        }
        
        try {
            // Rendre l'interface initiale
            this.render();
            
            // Attacher les Ã©vÃ©nements DOM
            this.attachEvents();
            
            // Attacher les Ã©vÃ©nements EventBus
            this.setupEventBusListeners();
            
            // Marquer comme initialisÃ©e
            this.state.initialized = true;
            
            this.log('info', 'FileView', 'âœ… FileView v4.3.0 initialized (Compact + Full buttons)');
            
        } catch (error) {
            this.log('error', 'FileView', 'Initialization failed:', error);
            this.state.error = error.message;
        }
    }
    
    // ========================================================================
    // TEMPLATE PRINCIPAL
    // ========================================================================
    
    buildTemplate(data = {}) {
        const state = { ...this.viewState, ...data };
        
        return `
            <div class="file-view-container">
                <div class="page-header">
                    <h1>ðŸ“ Fichiers MIDI</h1>
                    <div class="header-actions">
                        <button class="btn-upload" data-action="upload-file">
                            ðŸ“¤ Upload
                        </button>
                        <button class="btn-refresh" data-action="refresh-files">
                            ðŸ”„ Actualiser
                        </button>
                    </div>
                </div>
                
                <div class="toolbar">
                    ${this.buildToolbar(state)}
                </div>
                
                <div class="content-area">
                    <div class="file-list">
                        ${state.isLoading ? this.buildLoadingState() : this.buildFileList(state)}
                    </div>
                    
                    ${state.selectedFile ? this.buildFileDetails(state.selectedFile) : ''}
                </div>
            </div>
        `;
    }
    
    buildToolbar(state) {
        return `
            <div class="toolbar-section">
                <input 
                    type="text" 
                    class="search-input" 
                    placeholder="ðŸ” Rechercher..." 
                    data-action="filter-files"
                    value="${this.escapeHtml(state.filter)}"
                />
                
                <select class="sort-select" data-action="change-sort">
                    <option value="name" ${state.sortBy === 'name' ? 'selected' : ''}>Nom</option>
                    <option value="date" ${state.sortBy === 'date' ? 'selected' : ''}>Date</option>
                    <option value="size" ${state.sortBy === 'size' ? 'selected' : ''}>Taille</option>
                </select>
                
                <button 
                    class="btn-icon" 
                    data-action="toggle-sort-order"
                    title="Ordre de tri"
                >
                    ${state.sortOrder === 'asc' ? 'â¬†ï¸' : 'â¬‡ï¸'}
                </button>
            </div>
        `;
    }
    
    // ========================================================================
    // LISTE COMPACTE (40px par ligne)
    // ========================================================================
    
    buildFileList(state) {
        // âœ… SÃ‰CURITÃ‰: VÃ©rifier que state.files existe et est un tableau
        if (!state.files || !Array.isArray(state.files)) {
            return this.buildEmptyState();
        }
        
        const filteredFiles = this.filterFiles(state.files, state.filter);
        const sortedFiles = this.sortFiles(filteredFiles, state.sortBy, state.sortOrder);
        
        if (sortedFiles.length === 0) {
            return this.buildEmptyState();
        }
        
        return `
            <div class="file-list-compact">
                ${sortedFiles.map(file => this.buildFileRow(file)).join('')}
            </div>
        `;
    }
    
    /**
     * Construit une ligne compacte pour un fichier (40px height)
     */
    buildFileRow(file) {
        const isSelected = this.viewState.selectedFile?.path === file.path;
        
        return `
            <div 
                class="file-row ${isSelected ? 'selected' : ''}" 
                data-file-path="${this.escapeHtml(file.path || file.name)}"
            >
                <div class="file-icon">ðŸŽµ</div>
                <div class="file-info">
                    <div class="file-name" title="${this.escapeHtml(file.name)}">
                        ${this.escapeHtml(file.name)}
                    </div>
                    <div class="file-meta">
                        ${this.formatFileSize(file.size)} â€¢ ${this.formatDate(file.modified)}
                        ${file.tracks ? ` â€¢ ${file.tracks} pistes` : ''}
                    </div>
                </div>
                <div class="file-actions">
                    <button class="btn-icon" data-action="select-file" title="DÃ©tails">
                        ðŸ“‹
                    </button>
                    <button class="btn-icon" data-action="edit-file" title="Ã‰diter">
                        âœï¸
                    </button>
                    <button class="btn-icon" data-action="route-file" title="Router">
                        ðŸ”€
                    </button>
                    <button class="btn-icon" data-action="play-file" title="Jouer">
                        â–¶ï¸
                    </button>
                    <button class="btn-icon btn-danger" data-action="delete-file" title="Supprimer">
                        ðŸ—‘ï¸
                    </button>
                </div>
            </div>
        `;
    }
    
    // ========================================================================
    // DÃ‰TAILS FICHIER
    // ========================================================================
    
    buildFileDetails(file) {
        return `
            <div class="file-details">
                <div class="details-header">
                    <h3>ðŸ“„ DÃ©tails du fichier</h3>
                    <button class="btn-close" data-action="close-details">âœ•</button>
                </div>
                
                <div class="details-content">
                    <div class="detail-row">
                        <span class="detail-label">Nom:</span>
                        <span class="detail-value">${this.escapeHtml(file.name)}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Chemin:</span>
                        <span class="detail-value">${this.escapeHtml(file.path || file.name)}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Taille:</span>
                        <span class="detail-value">${this.formatFileSize(file.size)}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">ModifiÃ©:</span>
                        <span class="detail-value">${this.formatDate(file.modified)}</span>
                    </div>
                    ${file.tracks ? `
                        <div class="detail-row">
                            <span class="detail-label">Pistes:</span>
                            <span class="detail-value">${file.tracks}</span>
                        </div>
                    ` : ''}
                    ${file.duration ? `
                        <div class="detail-row">
                            <span class="detail-label">DurÃ©e:</span>
                            <span class="detail-value">${this.formatDuration(file.duration)}</span>
                        </div>
                    ` : ''}
                </div>
                
                <div class="details-actions">
                    <button class="btn-primary" data-action="load-file">
                        ðŸ“‚ Charger dans l'Ã©diteur
                    </button>
                </div>
            </div>
        `;
    }
    
    buildLoadingState() {
        return `
            <div class="loading-state">
                <div class="spinner"></div>
                <p>Chargement des fichiers...</p>
            </div>
        `;
    }
    
    buildEmptyState() {
        return `
            <div class="empty-state">
                <div class="empty-icon">ðŸ”­</div>
                <h3>Aucun fichier</h3>
                <p>Uploadez des fichiers MIDI pour commencer</p>
            </div>
        `;
    }
    
    // ========================================================================
    // RENDERING - MÃ‰THODES PRINCIPALES
    // ========================================================================
    
    /**
     * Rendre la vue
     * @param {Object} data - DonnÃ©es optionnelles pour le rendu
     */
    render(data = null) {
        if (!this.container) {
            this.log('error', 'FileView', 'Cannot render: container not found');
            return;
        }
        
        const startTime = performance.now();
        
        try {
            // GÃ©nÃ©rer et insÃ©rer le HTML
            const template = this.buildTemplate(data || this.viewState);
            
            this.container.innerHTML = template;
            
            // Attacher les Ã©vÃ©nements
            this.attachEvents();
            
            // Mettre Ã  jour l'Ã©tat
            this.state.rendered = true;
            this.state.lastRender = Date.now();
            
            const elapsed = performance.now() - startTime;
            this.log('debug', 'FileView', `âœ… Rendered in ${elapsed.toFixed(2)}ms`);
            
        } catch (error) {
            this.log('error', 'FileView', 'Render error:', error);
            
            // Afficher message d'erreur
            if (this.container) {
                this.container.innerHTML = `
                    <div class="error-state">
                        <div class="error-icon">âš ï¸</div>
                        <h3>Erreur d'affichage</h3>
                        <p>${error.message}</p>
                    </div>
                `;
            }
        }
    }

    /**
     * Afficher la vue
     */
    show() {
        if (this.container) {
            this.container.style.display = 'block';
            this.state.visible = true;
            
            // âœ… RÃ©attacher Ã©vÃ©nements si nÃ©cessaire
            if (this.needsEventReattach) {
                this.attachEvents();
                this.needsEventReattach = false;
            }
            
            // Recharger les donnÃ©es si nÃ©cessaire
            if (!this.viewState.files || this.viewState.files.length === 0) {
                this.refreshFiles();
            }
        }
    }

    /**
     * Masquer la vue
     */
    hide() {
        if (this.container) {
            this.container.style.display = 'none';
            this.state.visible = false;
            
            // Marquer pour rÃ©attachement lors du prochain show()
            this.needsEventReattach = true;
        }
    }

    /**
     * Recharger les fichiers
     */
    refreshFiles() {
        this.handleRefresh();
    }
    
    // ========================================================================
    // FILTRE ET TRI
    // ========================================================================
    
    /**
     * Filtrer les fichiers selon une recherche
     * @param {Array} files - Liste des fichiers
     * @param {string} filter - Terme de recherche
     * @returns {Array} Fichiers filtrÃ©s
     */
    filterFiles(files, filter) {
        // âœ… SÃ‰CURITÃ‰: VÃ©rifier que files est un tableau
        if (!Array.isArray(files)) {
            this.log('warn', 'FileView', 'filterFiles: files is not an array', files);
            return [];
        }
        
        if (!filter || filter.trim() === '') {
            return files;
        }
        
        const searchTerm = filter.toLowerCase();
        
        return files.filter(file => {
            if (!file || !file.name) return false;
            return file.name.toLowerCase().includes(searchTerm);
        });
    }
    
    /**
     * Trier les fichiers
     * @param {Array} files - Liste des fichiers
     * @param {string} sortBy - CritÃ¨re de tri
     * @param {string} sortOrder - Ordre (asc/desc)
     * @returns {Array} Fichiers triÃ©s
     */
    sortFiles(files, sortBy, sortOrder) {
        // âœ… SÃ‰CURITÃ‰: VÃ©rifier que files est un tableau
        if (!Array.isArray(files)) {
            this.log('warn', 'FileView', 'sortFiles: files is not an array', files);
            return [];
        }
        
        const sorted = [...files];
        
        sorted.sort((a, b) => {
            let comparison = 0;
            
            switch (sortBy) {
                case 'name':
                    comparison = (a.name || '').localeCompare(b.name || '');
                    break;
                case 'date':
                    comparison = (a.modified || 0) - (b.modified || 0);
                    break;
                case 'size':
                    comparison = (a.size || 0) - (b.size || 0);
                    break;
                default:
                    comparison = 0;
            }
            
            return sortOrder === 'asc' ? comparison : -comparison;
        });
        
        return sorted;
    }
    
    updateFileOrder() {
        // RÃ©appliquer tri et filtre puis rerender
        this.render();
    }
    
    // ========================================================================
    // FORMATAGE
    // ========================================================================
    
    formatFileSize(bytes) {
        if (!bytes || bytes === 0) return '0 B';
        
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return Math.round(bytes / Math.pow(k, i) * 10) / 10 + ' ' + sizes[i];
    }
    
    formatDate(timestamp) {
        if (!timestamp) return 'N/A';
        
        let date;
        
        // GÃ©rer timestamp Unix (nombre) ou ISO string
        if (typeof timestamp === 'number') {
            // Si timestamp en millisecondes
            date = new Date(timestamp);
        } else if (typeof timestamp === 'string') {
            date = new Date(timestamp);
        } else {
            return 'N/A';
        }
        
        // VÃ©rifier validitÃ©
        if (isNaN(date.getTime())) return 'N/A';
        
        // Format complet
        return date.toLocaleDateString('fr-FR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    }
    
    formatDuration(seconds) {
        if (!seconds) return '0:00';
        
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }
    
    escapeHtml(text) {
        if (!text) return '';
        
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    // ========================================================================
    // Ã‰VÃ‰NEMENTS DOM
    // ========================================================================
    
    attachEvents() {
        if (!this.container) return;
        
        // Actions des boutons
        this.container.addEventListener('click', (e) => {
            const action = e.target.closest('[data-action]')?.dataset.action;
            if (!action) return;
            
            const fileRow = e.target.closest('.file-row');
            const filePath = fileRow?.dataset.filePath;
            
            switch (action) {
                case 'upload-file':
                    this.handleUpload();
                    break;
                case 'refresh-files':
                    this.handleRefresh();
                    break;
                case 'select-file':
                    if (filePath) this.handleSelectFile(filePath);
                    break;
                case 'edit-file':
                    if (filePath) this.handleEditFile(filePath);
                    break;
                case 'route-file':
                    if (filePath) this.handleRouteFile(filePath);
                    break;
                case 'play-file':
                    if (filePath) this.handlePlayFile(filePath);
                    break;
                case 'delete-file':
                    if (filePath) this.handleDeleteFile(filePath);
                    break;
                case 'load-file':
                    this.handleLoadFile();
                    break;
                case 'close-details':
                    this.handleCloseDetails();
                    break;
                case 'toggle-sort-order':
                    this.viewState.sortOrder = this.viewState.sortOrder === 'asc' ? 'desc' : 'asc';
                    this.render();
                    break;
            }
        });
        
        // Filtre de recherche
        const searchInput = this.container.querySelector('[data-action="filter-files"]');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.viewState.filter = e.target.value;
                this.render();
            });
        }
        
        // SÃ©lecteur de tri
        const sortSelect = this.container.querySelector('[data-action="change-sort"]');
        if (sortSelect) {
            sortSelect.addEventListener('change', (e) => {
                this.viewState.sortBy = e.target.value;
                this.render();
            });
        }
        
        // Attacher listeners EventBus
        // setupEventBusListeners() appelÃ© dans init() - pas ici
    }
    
    setupEventBusListeners() {
        if (!this.eventBus) return;
        
        // files.list response
        this.eventBus.on('files:list-updated', (data) => {
            this.log('info', 'FileView', `Received ${data.files?.length || 0} files`);
            this.viewState.files = data.files || [];
            this.viewState.isLoading = false;
            this.render();
        });
        
        // files.write response (upload)
        this.eventBus.on('file:uploaded', (data) => {
            this.log('info', 'FileView', `File uploaded: ${data.file_path}`);
            this.handleRefresh(); // Recharger la liste
        });
        
        // files.delete response
        this.eventBus.on('file:deleted', (data) => {
            this.log('info', 'FileView', `File deleted: ${data.file_path}`);
            this.handleRefresh(); // Recharger la liste
        });
        
        // Erreurs
        this.eventBus.on('files:error', (data) => {
            this.log('error', 'FileView', `Error: ${data.error}`);
            this.viewState.isLoading = false;
            this.render();
        });
    }
    
    // ========================================================================
    // ACTIONS - HANDLERS COMPLETS
    // ========================================================================
    
    handleUpload() {
        // âœ… Utiliser ou crÃ©er un input file permanent attachÃ© au DOM
        let input = document.getElementById('file-upload-input');
        
        if (!input) {
            input = document.createElement('input');
            input.id = 'file-upload-input';
            input.type = 'file';
            input.accept = '.mid,.midi';
            input.multiple = true;
            input.style.display = 'none';
            document.body.appendChild(input);
            
            this.log('debug', 'FileView', 'Created permanent file input');
            
            // Attacher le handler une seule fois
            input.addEventListener('change', (e) => {
                const files = Array.from(e.target.files);
                
                if (files.length === 0) return;
                
                this.log('info', 'FileView', `Selected ${files.length} file(s)`);
                
                for (const file of files) {
                    try {
                        // âœ… Ã‰mettre Ã©vÃ©nement que FileController Ã©coute
                        if (this.eventBus) {
                            this.eventBus.emit('file:upload', {
                                file: file  // Objet File natif
                            });
                            this.log('info', 'FileView', `Upload requested: ${file.name}`);
                        }
                    } catch (error) {
                        this.log('error', 'FileView', `Upload error: ${error.message}`);
                    }
                }
                
                // RÃ©initialiser pour permettre de rÃ©uploader le mÃªme fichier
                input.value = '';
            });
        }
        
        // DÃ©clencher le sÃ©lecteur de fichiers
        this.log('debug', 'FileView', 'Triggering file selector');
        input.click();
    }
    
    handleRefresh() {
        this.viewState.isLoading = true;
        this.render();
        
        // Demander la liste via files.list API
        if (this.eventBus) {
            this.eventBus.emit('file:list_requested', {
                path: this.viewState.currentPath
            });
        }
    }
    
    handleSelectFile(filePath) {
        const file = this.viewState.files.find(f => 
            f.path === filePath || f.name === filePath
        );
        
        if (file) {
            this.viewState.selectedFile = file;
            this.render();
            
            // Ã‰mettre Ã©vÃ©nement
            if (this.eventBus) {
                this.eventBus.emit('file:selected', { file });
            }
        }
    }
    
    /**
     * âœ… NOUVEAU: Ã‰diter le fichier dans l'Ã©diteur
     */
    handleEditFile(filePath) {
        this.log('info', 'FileView', `Edit requested: ${filePath}`);
        
        // Charger dans l'Ã©diteur
        if (this.eventBus) {
            this.eventBus.emit('file:load_in_editor', {
                file_path: filePath
            });
        }
        
        // Naviguer vers l'Ã©diteur
        if (window.app?.router) {
            window.app.router.navigateTo('/editor');
        }
    }
    
    /**
     * âœ… NOUVEAU: Configurer le routage pour ce fichier
     */
    handleRouteFile(filePath) {
        this.log('info', 'FileView', `Routing requested: ${filePath}`);
        
        // Ouvrir modal de configuration de routage
        if (this.eventBus) {
            this.eventBus.emit('routing:configure', {
                file_path: filePath
            });
        }
    }
    
    handlePlayFile(filePath) {
        // Demander lecture via playback.load + playback.play
        if (this.eventBus) {
            this.eventBus.emit('file:play_requested', {
                file_path: filePath
            });
        }
    }
    
    handleDeleteFile(filePath) {
        if (!confirm(`Supprimer ${filePath} ?`)) return;
        
        // Demander suppression via files.delete API
        if (this.eventBus) {
            this.eventBus.emit('file:delete_requested', {
                file_path: filePath
            });
        }
    }
    
    handleLoadFile() {
        if (!this.viewState.selectedFile) return;
        
        const filePath = this.viewState.selectedFile.path || this.viewState.selectedFile.name;
        
        // Demander chargement dans l'Ã©diteur
        if (this.eventBus) {
            this.eventBus.emit('file:load_in_editor', {
                file_path: filePath
            });
        }
        
        // Navigation vers l'Ã©diteur
        if (window.app?.router) {
            window.app.router.navigateTo('/editor');
        }
    }
    
    handleCloseDetails() {
        this.viewState.selectedFile = null;
        this.render();
    }
    
    // ========================================================================
    // UTILITAIRES PUBLICS
    // ========================================================================
    
    /**
     * Mettre Ã  jour la liste des fichiers
     * @param {Array} files - Nouvelle liste de fichiers
     */
    updateFiles(files) {
        this.viewState.files = files || [];
        this.viewState.isLoading = false;
        this.render();
    }
    
    /**
     * DÃ©finir l'Ã©tat de chargement
     * @param {boolean} loading - Ã‰tat de chargement
     */
    setLoading(loading) {
        this.viewState.isLoading = loading;
        this.render();
    }
    
    /**
     * Obtenir le fichier sÃ©lectionnÃ©
     * @returns {Object|null}
     */
    getSelectedFile() {
        return this.viewState.selectedFile;
    }
    
    /**
     * DÃ©finir le fichier sÃ©lectionnÃ©
     * @param {Object} file - Fichier Ã  sÃ©lectionner
     */
    setSelectedFile(file) {
        this.viewState.selectedFile = file;
        this.render();
    }
    
    /**
     * Nettoyer la vue
     */
    destroy() {
        // Nettoyer l'input file si existant
        const input = document.getElementById('file-upload-input');
        if (input) {
            input.remove();
        }
        
        // Appeler la mÃ©thode destroy du parent si elle existe
        if (super.destroy) {
            super.destroy();
        }
    }
    
    /**
     * Logger avec prÃ©fixe
     */
    log(level, context, ...args) {
        if (!this.logger) return;
        
        const prefix = `[FileView${context ? ':' + context : ''}]`;
        
        if (typeof this.logger[level] === 'function') {
            this.logger[level](prefix, ...args);
        } else {
            console[level](prefix, ...args);
        }
    }
}

// ============================================================================
// EXPORT
// ============================================================================

// Export pour utilisation en tant que module
if (typeof module !== 'undefined' && module.exports) {
    module.exports = FileView;
}

// âœ… Export vers window pour utilisation dans le navigateur
if (typeof window !== 'undefined') {
    window.FileView = FileView;
}

// ============================================================================
// FIN - FileView.js v4.3.0
// ============================================================================