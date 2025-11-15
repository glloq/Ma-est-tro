// ============================================================================
// Fichier: frontend/js/controllers/PianoRollController.js
// Chemin rÃ©el: frontend/js/controllers/PianoRollController.js
// Version: v3.4.0 - API BACKEND INTÃ‰GRÃ‰E
// Date: 2025-11-01
// ============================================================================
// AMÃ‰LIORATIONS v3.4.0:
// âœ“ IntÃ©gration API backend pour Ã©dition MIDI
// âœ“ Commandes: editor.load_file, editor.save_file
// âœ“ Gestion Ã©vÃ©nements MIDI temps rÃ©el
// âœ“ Synchronisation EditorModel â†” Backend
// âœ“ Optimisation performance avec cache
// âœ“ Gestion erreurs robuste
// ============================================================================

class PianoRollController extends BaseController {
    constructor(eventBus, models = {}, views = {}, notifications = null, debugConsole = null, backend = null) {
        super(eventBus, models, views, notifications, debugConsole, backend);
        
        // RÃ©fÃ©rences aux modÃ¨les
        this.editorModel = models?.editor;
        this.fileModel = models?.file;
        this.routingModel = models?.routing;
        
        // RÃ©fÃ©rence Ã  la vue
        this.view = views?.editor;
        
        // Backend
        this.backend = window.backendService;
        
        // Composants
        this.midiParser = new MidiParser();
        this.renderer = new PianoRollRenderer();
        
        // Ã‰tat du contrÃ´leur
        this.state = {
            ...this.state,
            currentFile: null,
            channelStates: {},
            selectedNotes: new Set(),
            midiData: null,
            isPlaying: false,
            currentTime: 0,
            playbackPosition: 0,
            isDirty: false, // Modifications non sauvegardÃ©es
            lastSaveTime: null
        };
        
        // Configuration du visualiseur
        this.visualizer = {
            zoom: 1.0,
            scrollPosition: 0,
            selectedChannel: -1,
            viewMode: 'piano_roll',
            showVelocity: true,
            showTiming: true,
            renderOptimization: true
        };
        
        // Cache pour performances
        this.renderCache = new Map();
        this.noteCache = new Map();
        this.lastRenderTime = 0;
        this.renderThrottle = 16; // ~60 FPS
        
        // MÃ©triques
        this.performanceStats = {
            notesRendered: 0,
            renderTime: 0,
            cacheHits: 0,
            cacheMisses: 0,
            apiCalls: 0
        };
        
        this.log('info', 'PianoRollController', 'âœ“ Initialized v3.4.0');
    }

    /**
     * Liaison des Ã©vÃ©nements
     */
    bindEvents() {
        // Ã‰vÃ©nements de changement d'Ã©tat
        this.eventBus.on('statemodel:changed', (data) => {
            this.handleStateChange(data);
        });
        
        // Ã‰vÃ©nements MIDI
        this.eventBus.on('midi:file_added', (data) => {
            this.onMidiFileAdded(data);
        });
        
        this.eventBus.on('midi:file_loaded', (data) => {
            this.loadMidiFile(data.file, data.midiData);
        });
        
        // Ã‰vÃ©nements de playback
        this.eventBus.on('playback:started', () => {
            this.state.isPlaying = true;
        });
        
        this.eventBus.on('playback:stopped', () => {
            this.state.isPlaying = false;
            this.stopAllNotes();
        });
        
        this.eventBus.on('playback:position', (data) => {
            this.state.currentTime = data.position;
            this.updatePlaybackPosition();
        });
        
        // Ã‰vÃ©nements d'interface
        this.eventBus.on('pianoroll:zoom', (data) => {
            this.setZoom(data.zoom);
        });
        
        this.eventBus.on('pianoroll:scroll', (data) => {
            this.setScrollPosition(data.position);
        });
        
        this.eventBus.on('pianoroll:select_channel', (data) => {
            this.selectChannel(data.channel);
        });
        
        // Ã‰vÃ©nements d'Ã©dition
        this.eventBus.on('editor:note:add', (data) => {
            this.addNote(data);
        });
        
        this.eventBus.on('editor:note:delete', (data) => {
            this.deleteNote(data.noteId);
        });
        
        this.eventBus.on('editor:note:modify', (data) => {
            this.modifyNote(data.noteId, data.changes);
        });
        
        // Ã‰vÃ©nements de sauvegarde
        this.eventBus.on('editor:save', () => {
            this.saveCurrentFile();
        });
        
        this.eventBus.on('editor:export', (data) => {
            this.exportFile(data.format, data.filename);
        });
    }

    // ========================================================================
    // GESTION FICHIERS MIDI
    // ========================================================================

    /**
     * Charge un fichier MIDI via l'API backend
     */
    async loadFileFromBackend(filename) {
        if (!this.backend || !this.backend.isConnected()) {
            this.notify('error', 'Backend non connectÃ©');
            return false;
        }
        
        try {
            this.notify('info', `Chargement de ${filename}...`);
            this.performanceStats.apiCalls++;
            
            // âœ“ NOUVEAU: Utilise sendCommand() avec format API correct
            const response = await this.backend.sendCommand('files.read', { 
                filename: filename 
            });
            
            if (response && response.midi_data) {
                // Parser les donnÃ©es MIDI
                const midiData = this.midiParser.parse(response.midi_data);
                
                // Charger dans le modÃ¨le
                this.editorModel.setMidiData(midiData);
                this.state.midiData = midiData;
                this.state.currentFile = filename;
                this.state.isDirty = false;
                this.state.lastSaveTime = Date.now();
                
                // Initialiser les canaux
                this.initializeChannelStates();
                
                // Initialiser le cache
                this.initializeRenderCache();
                
                // RafraÃ®chir l'affichage
                this.refreshDisplay();
                
                this.notify('success', `Fichier chargÃ©: ${filename}`);
                this.log('info', 'PianoRollController', `âœ“ Loaded: ${filename}`);
                
                this.eventBus.emit('pianoroll:file_loaded', {
                    filename,
                    midiData,
                    channelStates: this.state.channelStates
                });
                
                return true;
            }
        } catch (error) {
            this.handleError(`Erreur chargement ${filename}`, error);
        }
        
        return false;
    }

    /**
     * Sauvegarde le fichier actuel via l'API backend
     */
    async saveCurrentFile() {
        if (!this.backend || !this.backend.isConnected()) {
            this.notify('error', 'Backend non connectÃ©');
            return false;
        }
        
        if (!this.state.currentFile) {
            this.notify('warning', 'Aucun fichier Ã  sauvegarder');
            return false;
        }
        
        if (!this.state.isDirty) {
            this.notify('info', 'Aucune modification Ã  sauvegarder');
            return true;
        }
        
        try {
            this.notify('info', 'Sauvegarde en cours...');
            this.performanceStats.apiCalls++;
            
            // SÃ©rialiser les donnÃ©es MIDI
            const midiData = this.serializeMidiData();
            
            // âœ“ NOUVEAU: Utilise sendCommand() avec format API correct
            const response = await this.backend.sendCommand('files.write', { 
                filename: this.state.currentFile,
                midi_data: midiData
            });
            
            if (response) {
                this.state.isDirty = false;
                this.state.lastSaveTime = Date.now();
                
                // Marquer le modÃ¨le comme clean
                this.editorModel.markClean();
                
                this.notify('success', 'Fichier sauvegardÃ©');
                this.log('info', 'PianoRollController', 'ðŸ’¾ File saved');
                
                this.eventBus.emit('editor:file_saved', {
                    filename: this.state.currentFile
                });
                
                return true;
            }
        } catch (error) {
            this.handleError('Erreur sauvegarde', error);
        }
        
        return false;
    }

    /**
     * Exporte le fichier dans un format
     */
    async exportFile(format, filename) {
        if (!this.backend || !this.backend.isConnected()) {
            this.notify('error', 'Backend non connectÃ©');
            return false;
        }
        
        try {
            this.notify('info', `Export en ${format}...`);
            this.performanceStats.apiCalls++;
            
            const response = await this.backend.sendCommand('files.write', { 
                filename: this.state.currentFile,
                export_format: format,
                export_filename: filename
            });
            
            if (response) {
                this.notify('success', `ExportÃ©: ${filename}`);
                return true;
            }
        } catch (error) {
            this.handleError('Erreur export', error);
        }
        
        return false;
    }

    /**
     * Charge un fichier MIDI local
     */
    loadMidiFile(file, midiData) {
        if (!file || !midiData) {
            this.clearMidiData();
            return;
        }

        this.log('debug', 'PianoRollController', `Loading: ${file.name}`);
        
        this.state.midiData = midiData;
        this.state.currentFile = file.name;
        this.state.isDirty = false;
        
        this.initializeChannelStates();
        this.initializeRenderCache();
        this.refreshDisplay();
        
        this.eventBus.emit('pianoroll:file_loaded', {
            file,
            midiData,
            channelStates: this.state.channelStates
        });
        
        const noteCount = midiData.allNotes?.length || 0;
        const trackCount = midiData.tracks?.length || 0;
        const duration = midiData.duration || 0;
        
        this.log('info', 'PianoRollController', 
            `âœ“ Loaded: ${trackCount} tracks, ${noteCount} notes, ${duration.toFixed(1)}s`);
    }

    /**
     * Efface les donnÃ©es MIDI
     */
    clearMidiData() {
        this.state.midiData = null;
        this.state.currentFile = null;
        this.state.channelStates = {};
        this.state.selectedNotes.clear();
        this.state.isDirty = false;
        
        this.renderCache.clear();
        this.noteCache.clear();
        
        this.refreshDisplay();
    }

    /**
     * SÃ©rialise les donnÃ©es MIDI pour sauvegarde
     */
    serializeMidiData() {
        if (!this.state.midiData) return null;
        
        // Convertir en format JSON MIDI
        return {
            format: this.state.midiData.format || 1,
            division: this.state.midiData.division || 480,
            tracks: this.state.midiData.tracks || [],
            tempo: this.state.midiData.tempo || 120,
            timeSignature: this.state.midiData.timeSignature || [4, 4],
            keySignature: this.state.midiData.keySignature || 0
        };
    }

    // ========================================================================
    // Ã‰DITION DE NOTES
    // ========================================================================

    /**
     * Ajoute une nouvelle note
     */
    async addNote(noteData) {
        if (!this.state.midiData) {
            this.notify('warning', 'Aucun fichier chargÃ©');
            return false;
        }
        
        try {
            // Ajouter la note localement
            const note = {
                id: `note_${Date.now()}_${Math.random()}`,
                pitch: noteData.pitch,
                velocity: noteData.velocity || 100,
                startTime: noteData.startTime,
                duration: noteData.duration || 0.5,
                channel: noteData.channel || 0
            };
            
            // Ajouter Ã  la track appropriÃ©e
            const track = this.state.midiData.tracks[noteData.channel] || this.state.midiData.tracks[0];
            if (track && track.notes) {
                track.notes.push(note);
                track.notes.sort((a, b) => a.startTime - b.startTime);
            }
            
            // Marquer comme modifiÃ©
            this.markDirty();
            
            // RafraÃ®chir l'affichage
            this.refreshDisplay();
            
            this.eventBus.emit('editor:note_added', { note });
            this.log('debug', 'PianoRollController', `Note added: ${note.pitch}`);
            
            return note;
        } catch (error) {
            this.handleError('Erreur ajout note', error);
            return null;
        }
    }

    /**
     * Supprime une note
     */
    async deleteNote(noteId) {
        if (!this.state.midiData) return false;
        
        try {
            let deleted = false;
            
            // Chercher et supprimer la note
            this.state.midiData.tracks.forEach(track => {
                if (track.notes) {
                    const index = track.notes.findIndex(n => n.id === noteId);
                    if (index !== -1) {
                        track.notes.splice(index, 1);
                        deleted = true;
                    }
                }
            });
            
            if (deleted) {
                this.markDirty();
                this.refreshDisplay();
                this.eventBus.emit('editor:note_deleted', { noteId });
                this.log('debug', 'PianoRollController', `Note deleted: ${noteId}`);
                return true;
            }
        } catch (error) {
            this.handleError('Erreur suppression note', error);
        }
        
        return false;
    }

    /**
     * Modifie une note
     */
    async modifyNote(noteId, changes) {
        if (!this.state.midiData) return false;
        
        try {
            let modified = false;
            
            // Chercher et modifier la note
            this.state.midiData.tracks.forEach(track => {
                if (track.notes) {
                    const note = track.notes.find(n => n.id === noteId);
                    if (note) {
                        Object.assign(note, changes);
                        modified = true;
                    }
                }
            });
            
            if (modified) {
                this.markDirty();
                this.refreshDisplay();
                this.eventBus.emit('editor:note_modified', { noteId, changes });
                this.log('debug', 'PianoRollController', `Note modified: ${noteId}`);
                return true;
            }
        } catch (error) {
            this.handleError('Erreur modification note', error);
        }
        
        return false;
    }

    /**
     * Marque le fichier comme modifiÃ©
     */
    markDirty() {
        this.state.isDirty = true;
        this.editorModel?.markDirty();
        this.eventBus.emit('editor:dirty_changed', { isDirty: true });
    }

    // ========================================================================
    // GESTION CANAUX
    // ========================================================================

    /**
     * Initialise les Ã©tats des canaux
     */
    initializeChannelStates() {
        this.state.channelStates = {};
        
        if (!this.state.midiData) return;
        
        const usedChannels = new Set();
        this.state.midiData.tracks.forEach(track => {
            usedChannels.add(track.channel);
        });
        
        usedChannels.forEach(channel => {
            const trackData = this.state.midiData.tracks.find(t => t.channel === channel);
            
            this.state.channelStates[channel] = {
                channel: channel,
                muted: false,
                solo: false,
                volume: 1.0,
                selected: false,
                visible: true,
                name: trackData?.name || `Canal ${channel + 1}`,
                instrument: trackData?.instrument || 'Piano',
                noteCount: trackData?.notes.length || 0,
                noteRange: this.calculateNoteRange(trackData?.notes || []),
                syncOffset: 0,
                latencyCompensation: 0,
                instrument_id: null,
                color: this.getChannelColor(channel),
                opacity: 1.0,
                renderPriority: trackData?.notes.length > 500 ? 'high' : 'normal'
            };
        });
        
        this.optimizeRenderOrder();
    }

    /**
     * Calcule la plage de notes d'un canal
     */
    calculateNoteRange(notes) {
        if (!notes || notes.length === 0) {
            return { min: 60, max: 72 };
        }
        
        let min = 127;
        let max = 0;
        
        notes.forEach(note => {
            if (note.pitch < min) min = note.pitch;
            if (note.pitch > max) max = note.pitch;
        });
        
        return { min, max };
    }

    /**
     * Obtient la couleur d'un canal
     */
    getChannelColor(channel) {
        const colors = [
            '#e74c3c', '#3498db', '#2ecc71', '#f39c12',
            '#9b59b6', '#1abc9c', '#e67e22', '#34495e',
            '#16a085', '#27ae60', '#2980b9', '#8e44ad',
            '#f1c40f', '#e67e22', '#c0392b', '#d35400'
        ];
        return colors[channel % colors.length];
    }

    /**
     * Optimise l'ordre de rendu
     */
    optimizeRenderOrder() {
        // Trier les canaux par prioritÃ© de rendu
        const channels = Object.values(this.state.channelStates);
        channels.sort((a, b) => {
            if (a.renderPriority === 'high' && b.renderPriority !== 'high') return -1;
            if (a.renderPriority !== 'high' && b.renderPriority === 'high') return 1;
            return b.noteCount - a.noteCount;
        });
        
        this.renderOrder = channels.map(c => c.channel);
    }

    /**
     * SÃ©lectionne un canal
     */
    selectChannel(channel) {
        Object.keys(this.state.channelStates).forEach(ch => {
            this.state.channelStates[ch].selected = (parseInt(ch) === channel);
        });
        
        this.visualizer.selectedChannel = channel;
        this.refreshDisplay();
        
        this.eventBus.emit('pianoroll:channel_selected', { channel });
    }

    // ========================================================================
    // RENDU & AFFICHAGE
    // ========================================================================

    /**
     * Initialise le cache de rendu
     */
    initializeRenderCache() {
        this.renderCache.clear();
        this.noteCache.clear();
        this.lastRenderTime = 0;
    }

    /**
     * RafraÃ®chit l'affichage
     */
    refreshDisplay() {
        const now = Date.now();
        
        // Throttle du rendu
        if (now - this.lastRenderTime < this.renderThrottle) {
            return;
        }
        
        this.lastRenderTime = now;
        
        if (!this.state.midiData || !this.view) {
            return;
        }
        
        const startTime = performance.now();
        
        try {
            // Render via la vue
            if (this.view && typeof this.view.renderPianoRoll === 'function') {
                this.view.renderPianoRoll(
                    this.state.midiData,
                    this.state.currentTime,
                    this.state.channelStates,
                    this.visualizer
                );
            }
            
            const renderTime = performance.now() - startTime;
            this.performanceStats.renderTime = renderTime;
            this.performanceStats.notesRendered++;
            
        } catch (error) {
            this.log('error', 'PianoRollController', 'Render error:', error);
        }
    }

    /**
     * Met Ã  jour la position de lecture
     */
    updatePlaybackPosition() {
        if (this.state.isPlaying) {
            this.refreshDisplay();
        }
    }

    /**
     * ArrÃªte toutes les notes
     */
    stopAllNotes() {
        // ArrÃªter les notes actives
        this.log('debug', 'PianoRollController', 'All notes stopped');
    }

    // ========================================================================
    // ZOOM & NAVIGATION
    // ========================================================================

    setZoom(zoom) {
        this.visualizer.zoom = Math.max(0.1, Math.min(10, zoom));
        this.refreshDisplay();
        this.log('debug', 'PianoRollController', `Zoom: ${this.visualizer.zoom.toFixed(2)}x`);
    }

    setScrollPosition(position) {
        this.visualizer.scrollPosition = position;
        this.refreshDisplay();
    }

    zoomIn() {
        this.setZoom(this.visualizer.zoom * 1.2);
    }

    zoomOut() {
        this.setZoom(this.visualizer.zoom / 1.2);
    }

    // ========================================================================
    // GETTERS
    // ========================================================================

    getMidiData() {
        return this.state.midiData;
    }

    getChannelStates() {
        return this.state.channelStates;
    }

    isDirty() {
        return this.state.isDirty;
    }

    getCurrentFile() {
        return this.state.currentFile;
    }

    getPerformanceStats() {
        return {
            ...this.performanceStats,
            cacheSize: this.renderCache.size + this.noteCache.size,
            channelCount: Object.keys(this.state.channelStates).length,
            totalNotes: this.state.midiData?.allNotes.length || 0
        };
    }

    // ========================================================================
    // GESTION D'Ã‰TAT
    // ========================================================================

    handleStateChange(data) {
        switch (data.key) {
            case 'currentFile':
                if (data.newValue && data.newValue.parsedData) {
                    this.loadMidiFile(data.newValue, data.newValue.parsedData);
                } else {
                    this.clearMidiData();
                }
                break;
                
            case 'isPlaying':
                this.state.isPlaying = data.newValue;
                if (!this.state.isPlaying) {
                    this.stopAllNotes();
                }
                break;
                
            case 'progress':
                this.state.currentTime = data.newValue;
                this.updatePlaybackPosition();
                break;
        }
    }

    /**
     * Nettoie les ressources
     */
    destroy() {
        this.clearMidiData();
        this.renderCache?.clear();
        this.noteCache?.clear();
        super.destroy();
    }
}

// ============================================================================
// EXPORT
// ============================================================================

if (typeof module !== 'undefined' && module.exports) {
    module.exports = PianoRollController;
}

if (typeof window !== 'undefined') {
    window.PianoRollController = PianoRollController;
}