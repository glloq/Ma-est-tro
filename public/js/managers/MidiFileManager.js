/**
 * MidiFileManager - Manages MIDI file operations
 * Upload, select, edit, save with backend integration
 */

class MidiFileManager {
    constructor(apiClient, pianoRoll, eventBus) {
        this.api = apiClient;
        this.pianoRoll = pianoRoll;
        this.eventBus = eventBus;

        // Current state
        this.currentFile = null;
        this.fileList = [];
        this.isDirty = false;
        this.autoSave = false;
        this.autoSaveInterval = null;

        // Bind events
        this.bindEvents();
    }

    bindEvents() {
        // Listen to piano roll changes
        this.eventBus.on('pianoroll:changed', () => {
            this.markDirty();
        });

        // Auto-save every 30 seconds if enabled
        if (this.autoSave) {
            this.startAutoSave(30000);
        }
    }

    // ========================================================================
    // FILE UPLOAD
    // ========================================================================

    /**
     * Upload MIDI file to backend
     * @param {File} file - MIDI file from input[type="file"]
     * @param {string} folder - Target folder
     */
    async uploadFile(file, folder = '/') {
        if (!file.name.match(/\.mid$/i) && !file.name.match(/\.midi$/i)) {
            throw new Error('Invalid file type. Please upload a MIDI file (.mid or .midi)');
        }

        try {
            console.log(`Uploading file: ${file.name} (${file.size} bytes)`);

            const result = await this.api.uploadMidiFile(file, folder);

            console.log('Upload successful:', result);
            this.eventBus.emit('file:uploaded', result);

            // Refresh file list
            await this.refreshFileList();

            return result;

        } catch (error) {
            console.error('Upload failed:', error);
            this.eventBus.emit('file:upload_failed', { error });
            throw error;
        }
    }

    /**
     * Upload MIDI file from drag & drop
     */
    async uploadFromDrop(dataTransfer, folder = '/') {
        const files = Array.from(dataTransfer.files).filter(f =>
            f.name.match(/\.mid$/i) || f.name.match(/\.midi$/i)
        );

        if (files.length === 0) {
            throw new Error('No MIDI files found');
        }

        const results = [];
        for (const file of files) {
            try {
                const result = await this.uploadFile(file, folder);
                results.push(result);
            } catch (error) {
                console.error(`Failed to upload ${file.name}:`, error);
            }
        }

        return results;
    }

    // ========================================================================
    // FILE SELECTION
    // ========================================================================

    /**
     * Get list of MIDI files from backend
     * @param {string} folder - Folder to list
     */
    async refreshFileList(folder = '/') {
        try {
            this.fileList = await this.api.listMidiFiles(folder);
            this.eventBus.emit('file:list_updated', this.fileList);
            return this.fileList;
        } catch (error) {
            console.error('Failed to refresh file list:', error);
            throw error;
        }
    }

    /**
     * Select and load a MIDI file
     * @param {number} fileId - File ID to load
     */
    async selectFile(fileId) {
        // Check for unsaved changes
        if (this.isDirty) {
            const discard = confirm('You have unsaved changes. Discard them?');
            if (!discard) {
                return null;
            }
        }

        try {
            console.log(`Loading file ID: ${fileId}`);

            const fileData = await this.api.loadMidiFile(fileId);

            this.currentFile = {
                id: fileId,
                ...fileData
            };

            this.isDirty = false;
            this.eventBus.emit('file:selected', this.currentFile);

            return this.currentFile;

        } catch (error) {
            console.error('Failed to select file:', error);
            this.eventBus.emit('file:load_failed', { error });
            throw error;
        }
    }

    /**
     * Search MIDI files
     */
    async searchFiles(query) {
        try {
            const results = await this.api.searchMidiFiles(query);
            this.eventBus.emit('file:search_results', results);
            return results;
        } catch (error) {
            console.error('Search failed:', error);
            throw error;
        }
    }

    // ========================================================================
    // EDITOR INTEGRATION
    // ========================================================================

    /**
     * Open file in piano roll editor
     * @param {number} fileId - File ID
     */
    async openInEditor(fileId) {
        try {
            // Load file data
            const fileData = await this.selectFile(fileId);

            if (!fileData || !fileData.midi) {
                throw new Error('Invalid file data');
            }

            // Load into piano roll
            if (this.pianoRoll) {
                this.pianoRoll.loadMidiFile(fileData.midi);
                console.log('File loaded in piano roll');
            }

            this.eventBus.emit('editor:opened', {
                fileId,
                fileName: fileData.filename
            });

            return true;

        } catch (error) {
            console.error('Failed to open in editor:', error);
            this.eventBus.emit('editor:open_failed', { error });
            throw error;
        }
    }

    /**
     * Get current file data from piano roll
     */
    getCurrentFileData() {
        if (!this.pianoRoll) {
            throw new Error('Piano roll not initialized');
        }

        return this.pianoRoll.convertSequenceToMidi();
    }

    // ========================================================================
    // SAVE MODIFICATIONS
    // ========================================================================

    /**
     * Save current modifications to backend
     */
    async saveModifications() {
        if (!this.currentFile) {
            throw new Error('No file is currently open');
        }

        if (!this.isDirty) {
            console.log('No changes to save');
            return { saved: false, reason: 'no_changes' };
        }

        try {
            console.log('Saving modifications...');

            // Get current data from piano roll
            const midiData = this.getCurrentFileData();

            // Save to backend
            await this.api.saveMidiFile(this.currentFile.id, midiData);

            this.isDirty = false;
            this.eventBus.emit('file:saved', {
                fileId: this.currentFile.id,
                fileName: this.currentFile.filename
            });

            console.log('Modifications saved successfully');

            return { saved: true };

        } catch (error) {
            console.error('Failed to save modifications:', error);
            this.eventBus.emit('file:save_failed', { error });
            throw error;
        }
    }

    /**
     * Save as new file
     */
    async saveAs(newFilename) {
        try {
            // Get current data
            const midiData = this.getCurrentFileData();

            // Create new file by uploading
            const blob = new Blob([JSON.stringify(midiData)], { type: 'application/json' });
            const file = new File([blob], newFilename, { type: 'application/json' });

            const result = await this.uploadFile(file);

            // Open the new file
            await this.openInEditor(result.fileId);

            return result;

        } catch (error) {
            console.error('Save as failed:', error);
            throw error;
        }
    }

    /**
     * Mark file as modified
     */
    markDirty() {
        if (!this.isDirty) {
            this.isDirty = true;
            this.eventBus.emit('file:modified', {
                fileId: this.currentFile?.id
            });
        }
    }

    /**
     * Auto-save functionality
     */
    startAutoSave(interval = 30000) {
        this.stopAutoSave();

        this.autoSaveInterval = setInterval(async () => {
            if (this.isDirty && this.currentFile) {
                try {
                    await this.saveModifications();
                    console.log('Auto-saved');
                } catch (error) {
                    console.error('Auto-save failed:', error);
                }
            }
        }, interval);

        console.log(`Auto-save enabled (${interval / 1000}s interval)`);
    }

    /**
     * Stop auto-save
     */
    stopAutoSave() {
        if (this.autoSaveInterval) {
            clearInterval(this.autoSaveInterval);
            this.autoSaveInterval = null;
            console.log('Auto-save disabled');
        }
    }

    // ========================================================================
    // FILE MANAGEMENT
    // ========================================================================

    /**
     * Delete file
     */
    async deleteFile(fileId) {
        const confirm = window.confirm('Delete this file permanently?');
        if (!confirm) return false;

        try {
            await this.api.deleteMidiFile(fileId);

            // If it's the current file, clear it
            if (this.currentFile?.id === fileId) {
                this.currentFile = null;
                this.isDirty = false;
            }

            // Refresh list
            await this.refreshFileList();

            this.eventBus.emit('file:deleted', { fileId });

            return true;

        } catch (error) {
            console.error('Failed to delete file:', error);
            throw error;
        }
    }

    /**
     * Rename file
     */
    async renameFile(fileId, newFilename) {
        try {
            await this.api.renameMidiFile(fileId, newFilename);

            if (this.currentFile?.id === fileId) {
                this.currentFile.filename = newFilename;
            }

            await this.refreshFileList();

            this.eventBus.emit('file:renamed', { fileId, newFilename });

            return true;

        } catch (error) {
            console.error('Failed to rename file:', error);
            throw error;
        }
    }

    /**
     * Export file
     */
    async exportFile(fileId, format = 'mid') {
        try {
            const result = await this.api.sendCommand('file_export', {
                fileId,
                format
            });

            return result;

        } catch (error) {
            console.error('Failed to export file:', error);
            throw error;
        }
    }

    // ========================================================================
    // UTILITIES
    // ========================================================================

    /**
     * Get current file info
     */
    getCurrentFile() {
        return this.currentFile;
    }

    /**
     * Check if file has unsaved changes
     */
    hasUnsavedChanges() {
        return this.isDirty;
    }

    /**
     * Get file list
     */
    getFileList() {
        return this.fileList;
    }

    /**
     * Close current file
     */
    closeCurrentFile() {
        if (this.isDirty) {
            const discard = confirm('You have unsaved changes. Discard them?');
            if (!discard) {
                return false;
            }
        }

        this.currentFile = null;
        this.isDirty = false;

        if (this.pianoRoll) {
            this.pianoRoll.clear();
        }

        this.eventBus.emit('file:closed');

        return true;
    }

    /**
     * Destroy
     */
    destroy() {
        this.stopAutoSave();
    }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MidiFileManager;
}
if (typeof window !== 'undefined') {
    window.MidiFileManager = MidiFileManager;
}
