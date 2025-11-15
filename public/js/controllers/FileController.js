// ============================================================================
// Fichier: frontend/js/controllers/FileController.js
// Chemin rÃƒÆ’Ã‚Â©el: frontend/js/controllers/FileController.js
// Version: v4.4.0 - FIX COMPLET PAGE FICHIERS
// Date: 2025-11-11
// ============================================================================
// CORRECTIONS v4.4.0:
// ÃƒÂ¢Ã…â€œÃ¢â‚¬Â¦ CRITIQUE: Fix syntaxe ligne 80 (accolade supplÃƒÆ’Ã‚Â©mentaire supprimÃƒÆ’Ã‚Â©e)
// ÃƒÂ¢Ã…â€œÃ¢â‚¬Â¦ CRITIQUE: Ajout ÃƒÆ’Ã‚Â©vÃƒÆ’Ã‚Â©nements manquants (list_requested, delete_requested, etc.)
// ÃƒÂ¢Ã…â€œÃ¢â‚¬Â¦ Encodage UTF-8 propre
// ÃƒÂ¢Ã…â€œÃ¢â‚¬Â¦ Gestion complÃƒÆ’Ã‚Â¨te upload/delete/play/load
// ============================================================================

class FileController extends BaseController {
    constructor(eventBus, models = {}, views = {}, notifications = null, debugConsole = null, backend = null) {
        super(eventBus, models, views, notifications, debugConsole, backend);
        
        this.logger = window.logger || console;
        this.fileModel = models.file;
        this.view = views.file;
        // ÃƒÂ¢Ã…â€œÃ¢â‚¬Â¦ this.backend initialisÃƒÆ’Ã‚Â© automatiquement par BaseController
        this.fileService = window.app?.services?.file;
        
        this.state = {
            ...this.state,
            currentPath: '/midi',
            selectedFile: null,
            isLoading: false,
            lastRefresh: null
        };
        
        this.config = {
            ...this.config,
            maxFileSize: 10 * 1024 * 1024,
            allowedExtensions: ['.mid', '.midi'],
            autoRefresh: true,
            confirmDelete: true,
            refreshInterval: 30000
        };
        
        this.refreshTimer = null;
        this._fullyInitialized = true;
        this.bindEvents();
    }
    
    bindEvents() {
        // ÃƒÆ’Ã¢â‚¬Â°vÃƒÆ’Ã‚Â©nements standards
        this.eventBus.on('file:select', (data) => this.selectFile(data.fileId));
        this.eventBus.on('file:load', (data) => this.loadFile(data.fileId));
        this.eventBus.on('file:save', (data) => this.saveFile(data.fileId, data.content));
        this.eventBus.on('file:delete', (data) => this.deleteFile(data.fileId));
        this.eventBus.on('file:refresh', () => this.refreshFileList());
        this.eventBus.on('file:upload', (data) => this.handleFileUpload(data.file));
        
        // ÃƒÂ¢Ã…â€œÃ¢â‚¬Â¦ NOUVEAUX ÃƒÆ’Ã¢â‚¬Â°VÃƒÆ’Ã¢â‚¬Â°NEMENTS depuis FileView
        this.eventBus.on('file:list_requested', (data) => this.handleListRequest(data));
        this.eventBus.on('file:delete_requested', (data) => this.handleDeleteRequest(data));
        this.eventBus.on('file:play_requested', (data) => this.handlePlayRequest(data));
        this.eventBus.on('file:load_in_editor', (data) => this.handleLoadInEditor(data));
        this.eventBus.on('file:load_for_routing', (data) => this.handleLoadForRouting(data));
        
        // ÃƒÂ¢Ã…â€œÃ¢â‚¬Â¦ NOUVEAUX ÃƒÆ’Ã¢â‚¬Â°VÃƒÆ’Ã¢â‚¬Â°NEMENTS depuis FileView
        
        // Backend
        this.eventBus.on('backend:connected', () => this.onBackendConnected());
        this.eventBus.on('backend:disconnected', () => this.onBackendDisconnected());
        
        // Navigation
        this.eventBus.on('navigation:page_changed', (data) => {
            if (data.page === 'files') {
                this.onFilesPageActive();
            } else {
                this.onFilesPageInactive();
            }
        });
        
        this.log('info', 'FileController', 'ÃƒÂ¢Ã…â€œÃ¢â‚¬Â¦ Events bound (v4.4.0)');
    }
    
    // ========================================================================
    // NOUVEAUX HANDLERS POUR ÃƒÆ’Ã¢â‚¬Â°VÃƒÆ’Ã¢â‚¬Â°NEMENTS FILEVIEW
    // ========================================================================
    
    /**
     * ÃƒÂ¢Ã…â€œÃ¢â‚¬Â¦ Handler: Demande liste fichiers
     */
    async handleListRequest(data) {
        const path = data?.path || this.state.currentPath;
        
        try {
            const files = await this.listFiles(path);
            
            // ÃƒÆ’Ã¢â‚¬Â°mettre vers FileView
            this.eventBus.emit('files:listUpdated', { 
                files,
                path 
            });
            
            return files;
        } catch (error) {
            this.log('error', 'FileController', 'handleListRequest failed:', error);
            this.eventBus.emit('files:error', { error: error.message });
            throw error;
        }
    }
    
    /**
     * ÃƒÂ¢Ã…â€œÃ¢â‚¬Â¦ Handler: Demande suppression fichier
     */
    async handleDeleteRequest(data) {
        const filePath = data?.file_path;
        
        if (!filePath) {
            this.log('error', 'FileController', 'handleDeleteRequest: missing file_path');
            return;
        }
        
        try {
            await this.deleteFile(filePath);
            
            // ÃƒÆ’Ã¢â‚¬Â°mettre succÃƒÆ’Ã‚Â¨s
            this.eventBus.emit('file:deleted', { 
                file_path: filePath 
            });
            
            if (this.notifications) {
                this.notifications.show('SupprimÃƒÆ’Ã‚Â©', `${filePath} supprimÃƒÆ’Ã‚Â©`, 'success', 2000);
            }
        } catch (error) {
            this.log('error', 'FileController', 'handleDeleteRequest failed:', error);
            this.eventBus.emit('files:error', { error: error.message });
            
            if (this.notifications) {
                this.notifications.show('Erreur', `ÃƒÆ’Ã¢â‚¬Â°chec suppression: ${error.message}`, 'error', 3000);
            }
        }
    }
    
    /**
     * ÃƒÂ¢Ã…â€œÃ¢â‚¬Â¦ Handler: Demande lecture fichier
     */
    async handlePlayRequest(data) {
        const filePath = data?.file_path;
        
        if (!filePath) {
            this.log('error', 'FileController', 'handlePlayRequest: missing file_path');
            return;
        }
        
        try {
            // Charger le fichier dans le lecteur
            this.eventBus.emit('playback:load', { 
                file_path: filePath 
            });
            
            // DÃƒÆ’Ã‚Â©marrer la lecture
            setTimeout(() => {
                this.eventBus.emit('playback:play');
            }, 100);
            
            this.log('info', 'FileController', `Playing: ${filePath}`);
            
            if (this.notifications) {
                this.notifications.show('Lecture', `Lecture de ${filePath}`, 'info', 2000);
            }
        } catch (error) {
            this.log('error', 'FileController', 'handlePlayRequest failed:', error);
            
            if (this.notifications) {
                this.notifications.show('Erreur', `ÃƒÆ’Ã¢â‚¬Â°chec lecture: ${error.message}`, 'error', 3000);
            }
        }
    }
    
    /**
    
    // ========================================================================
    // BACKEND EVENTS
    // ========================================================================
    
    async onBackendConnected() {
        this.log('info', 'FileController', 'ÃƒÂ¢Ã…â€œÃ¢â‚¬Å“ Backend connected');
        
        // NE PAS charger automatiquement les fichiers au dÃƒÆ’Ã‚Â©marrage
        // Les fichiers seront chargÃƒÆ’Ã‚Â©s uniquement quand la page Files devient active
        this.log('info', 'FileController', 'Waiting for files page activation...');
    }
    
    onBackendDisconnected() {
        this.stopAutoRefresh();
        this.log('warn', 'FileController', 'ÃƒÂ¢Ã…Â¡Ã‚Â ÃƒÂ¯Ã‚Â¸Ã‚Â Backend disconnected');
    }
    
    onFilesPageActive() {
        this.refreshFileList().catch(error => {
            // Silencieux si backend non disponible
            if (!error.offline) {
                this.log('error', 'FileController', 'Failed to refresh on page active:', error);
            }
        });
        
        if (this.config.autoRefresh && this.isBackendReady()) {
            this.startAutoRefresh();
        }
    }
    
    onFilesPageInactive() {
        this.stopAutoRefresh();
    }
    
    // ========================================================================
    // API FILES
    // ========================================================================
    
    /**
     * ÃƒÂ¢Ã…â€œÃ¢â‚¬Â¦ Liste fichiers - files.list
     */
    async listFiles(path = null) {
        return this.withBackend(
            async () => {
                const targetPath = path || this.state.currentPath;
                
                this.log('info', 'FileController', `Listing files in: ${targetPath}`);
                this.state.isLoading = true;
                
                const response = await this.backend.listFiles(targetPath);
                
                this.state.isLoading = false;
                
                // ÃƒÂ¢Ã…â€œÃ¢â‚¬Â¦ Extraction via response (BackendService fait dÃƒÆ’Ã‚Â©jÃƒÆ’Ã‚Â )
                const files = response.files || [];
                
                if (this.fileModel) {
                    this.fileModel.set('files', files);
                    this.fileModel.set('currentPath', targetPath);
                }
                
                this.state.currentPath = targetPath;
                this.state.lastRefresh = Date.now();
                
                this.log('info', 'FileController', `ÃƒÂ¢Ã…â€œÃ¢â‚¬Â¦ Found ${files.length} files`);
                
                return files;
            },
            'list files',
            [] // Retourner liste vide si offline
        ).catch(error => {
            this.state.isLoading = false;
            if (!error.offline) {
                this.log('error', 'FileController', 'listFiles failed:', error);
            }
            throw error;
        });
    }
    
    /**
     * ÃƒÂ¢Ã…â€œÃ¢â‚¬Â¦ Lit fichier - files.read
     */
    async readFile(filename) {
        return this.withBackend(
            async () => {
                this.log('info', 'FileController', `Reading file: ${filename}`);
                
                const content = await this.backend.readFile(filename);
                
                this.log('info', 'FileController', `ÃƒÂ¢Ã…â€œÃ¢â‚¬Â¦ File read: ${filename}`);
                this.eventBus.emit('file:read-complete', { filename, content });
                
                return content;
            },
            'read file',
            null
        );
    }
    
    /**
     * ÃƒÂ¢Ã…â€œÃ¢â‚¬Â¦ ÃƒÆ’Ã¢â‚¬Â°crit fichier - files.write
     */
    async writeFile(filename, content) {
        return this.withBackend(
            async () => {
                this.log('info', 'FileController', `Writing file: ${filename}`);
                
                await this.backend.writeFile(filename, content);
                
                this.log('info', 'FileController', `ÃƒÂ¢Ã…â€œÃ¢â‚¬Â¦ File written: ${filename}`);
                this.eventBus.emit('file:write-complete', { filename });
                
                await this.refreshFileList();
                
                return true;
            },
            'write file',
            false
        );
    }
    
    /**
     * ÃƒÂ¢Ã…â€œÃ¢â‚¬Â¦ Supprime fichier - files.delete
     */
    async deleteFile(filename) {
        return this.withBackend(
            async () => {
                if (this.config.confirmDelete) {
                    const confirmed = confirm(`Supprimer le fichier "${filename}" ?`);
                    if (!confirmed) {
                        return false;
                    }
                }
                
                this.log('info', 'FileController', `Deleting file: ${filename}`);
                
                await this.backend.deleteFile(filename);
                
                if (this.fileModel) {
                    const files = this.fileModel.get('files') || [];
                    const filtered = files.filter(f => f.name !== filename && f.id !== filename);
                    this.fileModel.set('files', filtered);
                }
                
                this.log('info', 'FileController', `ÃƒÂ¢Ã…â€œÃ¢â‚¬Â¦ File deleted: ${filename}`);
                this.eventBus.emit('file:delete-complete', { filename });
                
                await this.refreshFileList();
                
                return true;
            },
            'delete file',
            false
        );
    }
    
    async fileExists(filename) {
        return this.withBackend(
            async () => {
                const response = await this.backend.fileExists(filename);
                return response.exists || false;
            },
            'check file exists',
            false
        );
    }
    
    async getFileInfo(filename) {
        return this.withBackend(
            async () => {
                return await this.backend.getFileInfo(filename);
            },
            'get file info',
            null
        );
    }
    
    /**
     * ÃƒÂ¢Ã…â€œÃ¢â‚¬Â¦ CORRECTION: Upload via FileService (midi.import)
     */
    async handleFileUpload(file) {
        return this.withBackend(
            async () => {
                if (!file) {
                    throw new Error('No file provided');
                }
                
                this.log('info', 'FileController', `Uploading file: ${file.name}`);
                
                if (this.notifications) {
                    this.notifications.show('Upload', `Upload de ${file.name}...`, 'info', 2000);
                }
                
                // ÃƒÂ¢Ã…â€œÃ¢â‚¬Â¦ Utiliser FileService qui gÃƒÆ’Ã‚Â¨re midi.import
                let result;
                if (this.fileService) {
                    result = await this.fileService.uploadFile(file);
                } else {
                    // Fallback direct via backend
                    result = await this.backend.uploadFile(file);
                }
                
                this.log('info', 'FileController', `ÃƒÂ¢Ã…â€œÃ¢â‚¬Â¦ File uploaded: ${file.name}`);
                
                if (this.notifications) {
                    this.notifications.show('Upload TerminÃƒÆ’Ã‚Â©', `${file.name} uploadÃƒÆ’Ã‚Â©`, 'success', 3000);
                }
                
                this.eventBus.emit('file:upload-complete', { file, result });
                this.eventBus.emit('file:uploaded', { 
                    file_path: result.filepath || `/midi/${file.name}` 
                });
                
                await this.refreshFileList();
                
                return result;
            },
            'upload file',
            null
        ).catch(error => {
            this.log('error', 'FileController', 'Upload failed:', error);
            
            if (this.notifications && !error.offline) {
                this.notifications.show('ÃƒÆ’Ã¢â‚¬Â°chec Upload', error.message, 'error', 5000);
            }
            
            throw error;
        });
    }
    

    // ========================================================================
    // NOUVEAUX HANDLERS POUR ÃƒÆ’Ã¢â‚¬Â°VÃƒÆ’Ã¢â‚¬Â°NEMENTS FILEVIEW
    // ========================================================================
    
    /**
     * ÃƒÂ¢Ã…â€œÃ¢â‚¬Â¦ Handler: Demande liste fichiers
     */
    async handleListRequest(data) {
        const path = data?.path || this.state.currentPath;
        
        try {
            const files = await this.listFiles(path);
            
            // ÃƒÆ’Ã¢â‚¬Â°mettre vers FileView
            this.eventBus.emit('files:listUpdated', { 
                files,
                path 
            });
            
            return files;
        } catch (error) {
            this.log('error', 'FileController', 'handleListRequest failed:', error);
            this.eventBus.emit('files:error', { error: error.message });
            throw error;
        }
    }
    
    /**
     * ÃƒÂ¢Ã…â€œÃ¢â‚¬Â¦ Handler: Demande suppression fichier
     */
    async handleDeleteRequest(data) {
        const filePath = data?.file_path;
        
        if (!filePath) {
            this.log('error', 'FileController', 'handleDeleteRequest: missing file_path');
            return;
        }
        
        try {
            await this.deleteFile(filePath);
            
            // ÃƒÆ’Ã¢â‚¬Â°mettre succÃƒÆ’Ã‚Â¨s
            this.eventBus.emit('file:deleted', { 
                file_path: filePath 
            });
            
            if (this.notifications) {
                this.notifications.show('SupprimÃƒÆ’Ã‚Â©', `${filePath} supprimÃƒÆ’Ã‚Â©`, 'success', 2000);
            }
        } catch (error) {
            this.log('error', 'FileController', 'handleDeleteRequest failed:', error);
            this.eventBus.emit('files:error', { error: error.message });
            
            if (this.notifications) {
                this.notifications.show('Erreur', `ÃƒÆ’Ã¢â‚¬Â°chec suppression: ${error.message}`, 'error', 3000);
            }
        }
    }
    
    /**
     * ÃƒÂ¢Ã…â€œÃ¢â‚¬Â¦ Handler: Demande lecture fichier
     */
    async handlePlayRequest(data) {
        const filePath = data?.file_path;
        
        if (!filePath) {
            this.log('error', 'FileController', 'handlePlayRequest: missing file_path');
            return;
        }
        
        try {
            // Charger le fichier dans le lecteur
            this.eventBus.emit('playback:load', { 
                file_path: filePath 
            });
            
            // DÃƒÆ’Ã‚Â©marrer la lecture
            setTimeout(() => {
                this.eventBus.emit('playback:play');
            }, 100);
            
            this.log('info', 'FileController', `Playing: ${filePath}`);
            
            if (this.notifications) {
                this.notifications.show('Lecture', `Lecture de ${filePath}`, 'info', 2000);
            }
        } catch (error) {
            this.log('error', 'FileController', 'handlePlayRequest failed:', error);
            
            if (this.notifications) {
                this.notifications.show('Erreur', `ÃƒÆ’Ã¢â‚¬Â°chec lecture: ${error.message}`, 'error', 3000);
            }
        }
    }
    
    /**
     * ÃƒÂ¢Ã…â€œÃ¢â‚¬Â¦ Handler: Charger dans l'ÃƒÆ’Ã‚Â©diteur
     */
    async handleLoadInEditor(data) {
        const filePath = data?.file_path;
        
        if (!filePath) {
            this.log('error', 'FileController', 'handleLoadInEditor: missing file_path');
            return;
        }
        
        try {
            // Charger le fichier MIDI
            const response = await this.backend.loadMidi(filePath);
            
            // ÃƒÆ’Ã¢â‚¬Â°mettre vers EditorController
            this.eventBus.emit('editor:fileLoaded', { 
                file_path: filePath,
                midi_json: response.midi_json || response.data
            });
            
            this.log('info', 'FileController', `Loading in editor: ${filePath}`);
            
            if (this.notifications) {
                this.notifications.show('ÃƒÆ’Ã¢â‚¬Â°diteur', `Chargement de ${filePath}`, 'info', 2000);
            }
        } catch (error) {
            const errorDetails = {
                message: error?.message || error?.error || 'Unknown error',
                code: error?.code,
                details: error?.details,
                filepath: filePath
            };
            this.log('error', 'FileController', 'handleLoadInEditor failed:', errorDetails);
            
            if (this.notifications) {
                this.notifications.show('Erreur', `ÃƒÆ’Ã¢â‚¬Â°chec chargement: ${error.message}`, 'error', 3000);
            }
        }
    }
    
    /**
     * ÃƒÂ¢Ã…â€œÃ¢â‚¬Â¦ NOUVEAU: Handler: Charger pour routage
     */
    async handleLoadForRouting(data) {
        const filePath = data?.file_path;
        
        if (!filePath) {
            this.log('error', 'FileController', 'handleLoadForRouting: missing file_path');
            return;
        }
        
        try {
            // Charger le fichier MIDI
            const response = await this.backend.loadMidi(filePath);
            
            // ÃƒÆ’Ã¢â‚¬Â°mettre vers RoutingController
            this.eventBus.emit('routing:fileLoaded', { 
                file_path: filePath,
                midi_json: response.midi_json || response.data
            });
            
            this.log('info', 'FileController', `Loading for routing: ${filePath}`);
            
            if (this.notifications) {
                this.notifications.show('Routage', `Configuration du routage pour ${filePath}`, 'info', 2000);
            }
        } catch (error) {
            this.log('error', 'FileController', 'handleLoadForRouting failed:', error);
            
            if (this.notifications) {
                this.notifications.show('Erreur', `ÃƒÆ’Ã¢â‚¬Â°chec chargement: ${error.message}`, 'error', 3000);
            }
        }
    }
    
        async refreshFileList() {
        try {
            return await this.listFiles();
        } catch (error) {
            // Ne pas afficher d'erreur si mode offline
            if (!error.offline) {
                this.log('error', 'FileController', 'refreshFileList failed:', error);
                if (this.notifications) {
                    this.notifications.show('Erreur', 'ÃƒÆ’Ã¢â‚¬Â°chec actualisation liste', 'error', 3000);
                }
            }
            throw error;
        }
    }
    
    async loadFile(fileId) {
        try {
            this.log('info', 'FileController', `Loading file: ${fileId}`);
            
            const content = await this.readFile(fileId);
            
            this.state.selectedFile = fileId;
            if (this.fileModel) {
                this.fileModel.set('selectedFile', { id: fileId, content });
            }
            
            this.eventBus.emit('file:loaded', { fileId, content });
            
            if (this.notifications) {
                this.notifications.show('Fichier ChargÃƒÆ’Ã‚Â©', `${fileId} chargÃƒÆ’Ã‚Â©`, 'success', 2000);
            }
            
            return content;
        } catch (error) {
            if (!error.offline) {
                this.log('error', 'FileController', 'loadFile failed:', error);
                if (this.notifications) {
                    this.notifications.show('Erreur', `ÃƒÆ’Ã¢â‚¬Â°chec chargement: ${error.message}`, 'error', 3000);
                }
            }
            throw error;
        }
    }
    
    async saveFile(fileId, content) {
        try {
            this.log('info', 'FileController', `Saving file: ${fileId}`);
            
            await this.writeFile(fileId, content);
            
            if (this.notifications) {
                this.notifications.show('Fichier SauvegardÃƒÆ’Ã‚Â©', `${fileId} sauvegardÃƒÆ’Ã‚Â©`, 'success', 2000);
            }
            
            return true;
        } catch (error) {
            if (!error.offline) {
                this.log('error', 'FileController', 'saveFile failed:', error);
                if (this.notifications) {
                    this.notifications.show('Erreur', `ÃƒÆ’Ã¢â‚¬Â°chec sauvegarde: ${error.message}`, 'error', 3000);
                }
            }
            throw error;
        }
    }
    
    selectFile(fileId) {
        this.state.selectedFile = fileId;
        
        if (this.fileModel) {
            const files = this.fileModel.get('files') || [];
            const file = files.find(f => f.id === fileId || f.name === fileId);
            if (file) {
                this.fileModel.setSelected(file);
            }
        }
        
        this.eventBus.emit('file:selected', { fileId });
    }
    
    startAutoRefresh() {
        if (this.refreshTimer) return;
        
        // Ne dÃƒÆ’Ã‚Â©marrer l'auto-refresh que si backend disponible
        if (!this.isBackendReady()) {
            this.log('info', 'FileController', 'Auto-refresh skipped - backend not ready');
            return;
        }
        
        this.log('info', 'FileController', 'Starting auto-refresh...');
        
        this.refreshTimer = setInterval(() => {
            // VÃƒÆ’Ã‚Â©rifier backend avant chaque refresh
            if (!this.isBackendReady()) {
                this.stopAutoRefresh();
                return;
            }
            
            this.refreshFileList().catch(err => {
                // Silencieux si offline
                if (!err.offline) {
                    this.log('error', 'FileController', 'Auto-refresh failed:', err);
                }
            });
        }, this.config.refreshInterval);
    }
    
    stopAutoRefresh() {
        if (this.refreshTimer) {
            clearInterval(this.refreshTimer);
            this.refreshTimer = null;
            this.log('info', 'FileController', 'Auto-refresh stopped');
        }
    }
    
    log(level, ...args) {
        if (this.logger && typeof this.logger[level] === 'function') {
            this.logger[level](...args);
        }
    }
}

if (typeof window !== 'undefined') {
    window.FileController = FileController;
}