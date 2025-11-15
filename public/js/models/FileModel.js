// ============================================================================
// Fichier: frontend/js/models/FileModel.js
// Chemin rÃƒÂ©el: frontend/js/models/FileModel.js
// Version: v4.2.2 - API COMPATIBLE v4.2.2
// Date: 2025-11-02
// ============================================================================
// CORRECTIONS v4.2.2:
// Ã¢Å“â€¦ list_files Ã¢â€ â€™ files.list
// Ã¢Å“â€¦ load_file Ã¢â€ â€™ playback.load
// Ã¢Å“â€¦ unload_file Ã¢â€ â€™ playback.stop
// Ã¢Å“â€¦ get_file_info Ã¢â€ â€™ files.getInfo
// Ã¢Å“â€¦ delete_file Ã¢â€ â€™ files.delete
// Ã¢Å“â€¦ import_file Ã¢â€ â€™ files.write
// Ã¢Å“â€¦ export_file Ã¢â€ â€™ files.read
// Ã¢Å“â€¦ Extraction response.data corrigÃƒÂ©e
// ============================================================================

class FileModel extends BaseModel {
    constructor(eventBus, backend, logger, initialData = {}, options = {}) {
        super(eventBus, backend, logger, {
            files: [],
            currentPath: '/midi',
            selectedFile: null,
            recentFiles: [],
            ...initialData
        }, {
            persistKey: 'filemodel',
            eventPrefix: 'file',
            autoPersist: true,
            ...options
        });
        
        if (!this.data) {
            this.data = {};
        }
        this.data.files = this.data.files || [];
        this.data.currentPath = this.data.currentPath || '/midi';
        this.data.selectedFile = this.data.selectedFile || null;
        this.data.recentFiles = this.data.recentFiles || [];
        
        this.log('debug', 'FileModel', 'Ã¢Å“â€œ FileModel v4.2.2 initialized (API v4.2.2)');
    }
    
    // ========================================================================
    // GESTION FICHIERS - BASE
    // ========================================================================
    
    /**
     * RafraÃƒÂ®chit la liste des fichiers
     * Ã¢Å“â€¦ API v4.2.2: files.list
     */
    async refreshFileList(path = null) {
        const targetPath = path || this.getCurrentPath();
        
        if (!this.backend) {
            const error = 'Backend service not available';
            this.log('error', 'FileModel', error);
            throw new Error(error);
        }
        
        try {
            this.log('info', 'FileModel', `Refreshing file list: ${targetPath}`);
            
            // Ã¢Å“â€¦ Nouvelle commande API v4.2.2
            const response = await this.backend.sendCommand('files.list', {
                path: targetPath
            });
            const data = response.data || response;
            
            const files = data.files || [];
            
            this.set('files', files);
            this.set('currentPath', targetPath);
            
            if (this.eventBus) {
                this.eventBus.emit('file:list-refreshed', {
                    files,
                    path: targetPath
                });
            }
            
            return files;
            
        } catch (error) {
            this.log('error', 'FileModel', `Refresh failed: ${error.message}`);
            throw error;
        }
    }
    
    /**
     * Charge un fichier MIDI pour lecture
     * Ã¢Å“â€¦ API v4.2.2: playback.load
     */
    async loadFile(filePath) {
        if (!this.backend) {
            throw new Error('Backend service not available');
        }
        
        try {
            this.log('info', 'FileModel', `Loading file: ${filePath}`);
            
            // Ã¢Å“â€¦ Nouvelle commande API v4.2.2 - charge pour lecture
            const response = await this.backend.sendCommand('playback.load', {
                filename: filePath
            });
            const data = response.data || response;
            
            this.set('selectedFile', data);
            this.addToRecent(filePath);
            
            if (this.eventBus) {
                this.eventBus.emit('file:loaded', {
                    filePath,
                    data: data
                });
            }
            
            return data;
            
        } catch (error) {
            this.log('error', 'FileModel', `Load failed: ${error.message}`);
            throw error;
        }
    }
    
    /**
     * Lit le contenu d'un fichier
     * Ã¢Å“â€¦ API v4.2.2: files.read
     */
    async readFile(filePath) {
        if (!this.backend) {
            throw new Error('Backend service not available');
        }
        
        try {
            this.log('info', 'FileModel', `Reading file: ${filePath}`);
            
            // Ã¢Å“â€¦ Nouvelle commande API v4.2.2
            const response = await this.backend.sendCommand('files.read', {
                filename: filePath
            });
            const data = response.data || response;
            
            return data;
            
        } catch (error) {
            this.log('error', 'FileModel', `Read failed: ${error.message}`);
            throw error;
        }
    }
    
    /**
     * DÃƒÂ©charge le fichier actuel
     * Ã¢Å“â€¦ API v4.2.2: playback.stop
     */
    async unloadFile() {
        if (!this.backend) {
            throw new Error('Backend service not available');
        }
        
        try {
            this.log('info', 'FileModel', 'Unloading current file');
            
            // Ã¢Å“â€¦ Nouvelle commande API v4.2.2
            const response = await this.backend.sendCommand('playback.stop');
            const data = response.data || response;
            
            this.set('selectedFile', null);
            
            if (this.eventBus) {
                this.eventBus.emit('file:unloaded', {
                    timestamp: Date.now()
                });
            }
            
            return true;
            
        } catch (error) {
            this.log('error', 'FileModel', `Unload failed: ${error.message}`);
            throw error;
        }
    }
    
    /**
     * Obtient les informations d'un fichier
     * Ã¢Å“â€¦ API v4.2.2: files.getInfo
     */
    async getFileInfo(filePath) {
        if (!this.backend) {
            throw new Error('Backend service not available');
        }
        
        try {
            this.log('info', 'FileModel', `Getting file info: ${filePath}`);
            
            // Ã¢Å“â€¦ Nouvelle commande API v4.2.2
            const response = await this.backend.sendCommand('files.getInfo', {
                filename: filePath
            });
            const data = response.data || response;
            
            return data;
            
        } catch (error) {
            this.log('error', 'FileModel', `Get file info failed: ${error.message}`);
            throw error;
        }
    }
    
    /**
     * Supprime un fichier
     * Ã¢Å“â€¦ API v4.2.2: files.delete
     */
    async deleteFile(filePath) {
        if (!this.backend) {
            throw new Error('Backend service not available');
        }
        
        try {
            this.log('info', 'FileModel', `Deleting file: ${filePath}`);
            
            // Ã¢Å“â€¦ Nouvelle commande API v4.2.2
            const response = await this.backend.sendCommand('files.delete', {
                filename: filePath
            });
            const data = response.data || response;
            
            const files = this.get('files');
            const updatedFiles = files.filter(f => f.path !== filePath);
            this.set('files', updatedFiles);
            
            this.removeFromRecent(filePath);
            
            if (this.eventBus) {
                this.eventBus.emit('file:deleted', {
                    filePath,
                    timestamp: Date.now()
                });
            }
            
            return true;
            
        } catch (error) {
            this.log('error', 'FileModel', `Delete failed: ${error.message}`);
            throw error;
        }
    }
    
    /**
     * Importe/Upload un fichier
     * Ã¢Å“â€¦ API v4.2.2: files.write
     */
    async importFile(fileName, fileData, size, type = 'audio/midi') {
        if (!this.backend) {
            throw new Error('Backend service not available');
        }
        
        try {
            this.log('info', 'FileModel', `Importing file: ${fileName}`);
            
            // Ã¢Å“â€¦ Nouvelle commande API v4.2.2
            const response = await this.backend.sendCommand('files.write', {
                filename: `/midi/${fileName}`,
                content: fileData,
                base64: true
            });
            const data = response.data || response;
            
            await this.refreshFileList();
            
            if (this.eventBus) {
                this.eventBus.emit('file:imported', {
                    fileName,
                    timestamp: Date.now()
                });
            }
            
            return data;
            
        } catch (error) {
            this.log('error', 'FileModel', `Import failed: ${error.message}`);
            throw error;
        }
    }
    
    /**
     * Exporte/TÃƒÂ©lÃƒÂ©charge un fichier
     * Ã¢Å“â€¦ API v4.2.2: files.read
     */
    async exportFile(filePath, format = 'midi') {
        if (!this.backend) {
            throw new Error('Backend service not available');
        }
        
        try {
            this.log('info', 'FileModel', `Exporting file: ${filePath}`);
            
            // Ã¢Å“â€¦ Nouvelle commande API v4.2.2
            const response = await this.backend.sendCommand('files.read', {
                filename: filePath
            });
            const data = response.data || response;
            
            if (this.eventBus) {
                this.eventBus.emit('file:exported', {
                    filePath,
                    format,
                    timestamp: Date.now()
                });
            }
            
            return data;
            
        } catch (error) {
            this.log('error', 'FileModel', `Export failed: ${error.message}`);
            throw error;
        }
    }
    
    // ========================================================================
    // GESTION FICHIERS RÃƒâ€°CENTS
    // ========================================================================
    
    /**
     * Ajoute un fichier aux rÃƒÂ©cents
     */
    addToRecent(filePath) {
        let recentFiles = this.get('recentFiles');
        
        // Retirer le fichier s'il existe dÃƒÂ©jÃƒÂ 
        recentFiles = recentFiles.filter(f => f !== filePath);
        
        // Ajouter en tÃƒÂªte
        recentFiles.unshift(filePath);
        
        // Limiter ÃƒÂ  10 fichiers
        if (recentFiles.length > 10) {
            recentFiles = recentFiles.slice(0, 10);
        }
        
        this.set('recentFiles', recentFiles);
    }
    
    /**
     * Retire un fichier des rÃƒÂ©cents
     */
    removeFromRecent(filePath) {
        let recentFiles = this.get('recentFiles');
        recentFiles = recentFiles.filter(f => f !== filePath);
        this.set('recentFiles', recentFiles);
    }
    
    /**
     * Obtient les fichiers rÃƒÂ©cents
     */
    getRecentFiles() {
        return this.get('recentFiles');
    }
    
    /**
     * Efface les fichiers rÃƒÂ©cents
     */
    clearRecentFiles() {
        this.set('recentFiles', []);
    }
    
    // ========================================================================
    // GETTERS / SETTERS
    // ========================================================================
    
    /**
     * Obtient la liste des fichiers
     */
    getFiles() {
        return this.get('files');
    }
    
    /**
     * Obtient le chemin actuel
     */
    getCurrentPath() {
        return this.get('currentPath');
    }
    
    /**
     * DÃƒÂ©finit le chemin actuel
     */
    setCurrentPath(path) {
        this.set('currentPath', path);
    }
    
    /**
     * Obtient le fichier sÃƒÂ©lectionnÃƒÂ©
     */
    getSelectedFile() {
        return this.get('selectedFile');
    }
    
    /**
     * DÃƒÂ©finit le fichier sÃƒÂ©lectionnÃƒÂ©
     */
    setSelectedFile(file) {
        this.set('selectedFile', file);
    }
    
    /**
     * Recherche des fichiers par nom
     */
    searchFiles(query) {
        const files = this.getFiles();
        const lowerQuery = query.toLowerCase();
        
        return files.filter(file => 
            file.name.toLowerCase().includes(lowerQuery) ||
            (file.path && file.path.toLowerCase().includes(lowerQuery))
        );
    }
    
    /**
     * Filtre les fichiers par extension
     */
    filterByExtension(extension) {
        const files = this.getFiles();
        return files.filter(file => 
            file.name.toLowerCase().endsWith(extension.toLowerCase())
        );
    }
    
    /**
     * Trie les fichiers
     */
    sortFiles(sortBy = 'name', order = 'asc') {
        const files = [...this.getFiles()];
        
        files.sort((a, b) => {
            let valueA = a[sortBy];
            let valueB = b[sortBy];
            
            if (typeof valueA === 'string') {
                valueA = valueA.toLowerCase();
                valueB = valueB.toLowerCase();
            }
            
            if (order === 'asc') {
                return valueA > valueB ? 1 : -1;
            } else {
                return valueA < valueB ? 1 : -1;
            }
        });
        
        this.set('files', files);
        return files;
    }
}

// ============================================================================
// EXPORT GLOBAL
// ============================================================================
if (typeof window !== 'undefined') {
    window.FileModel = FileModel;
}