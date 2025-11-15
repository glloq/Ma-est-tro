// ============================================================================
// Fichier: frontend/js/controllers/GlobalPlaybackController.js
// Chemin réel: frontend/js/controllers/GlobalPlaybackController.js
// Version: v3.3.0 - API BACKEND CORRIGÉE
// Date: 2025-11-01
// ============================================================================
// CORRECTIONS v3.3.0:
// ✓ CRITIQUE: Utilise sendCommand() au lieu de send()
// ✓ Format API cohérent avec documentation backend
// ✓ Gestion événements temps réel améliorée
// ✅ CORRECTIONS v4.0.0: Compatibilité API v4.0.0
// ✓ Synchronisation backend optimisée
// ✓ Gestion erreurs robuste
// ✓ Support événements playback_position, playback_finished
// ============================================================================

class GlobalPlaybackController {
    static instance = null;
    
    static getInstance(eventBus, backend, fileModel, logger) {
        if (!GlobalPlaybackController.instance) {
            GlobalPlaybackController.instance = new GlobalPlaybackController(
                eventBus, backend, fileModel, logger
            );
        }
        return GlobalPlaybackController.instance;
    }
    
    constructor(eventBus, models = {}, views = {}, notifications = null, debugConsole = null, backend = null) {
        if (GlobalPlaybackController.instance) {
            return GlobalPlaybackController.instance;
        }
        
        this.eventBus = eventBus || window.eventBus;
        this.backend = backend || window.backendService;
        this.fileModel = fileModel;
        this.logger = logger || this.createFallbackLogger();
        
        // Créer le modèle de playback
        this.playbackModel = new PlaybackModel(eventBus, backend, this.logger);
        this.playbackModel.config.interpolationEnabled = true;
        
        // Fichier actuel
        this.currentFile = {
            id: null,
            name: null,
            path: null,
            midiJson: null,
            metadata: {},
            duration: 0
        };
        
        // Playlist
        this.playlist = {
            files: [],
            currentIndex: -1,
            shuffle: false,
            repeat: 'none', // none, one, all
            autoAdvance: true
        };
        
        // Routing MIDI
        this.routing = new Map();
        
        // Métronome
        this.metronome = {
            enabled: false,
            volume: 80,
            accentFirst: true,
            soundType: 'beep'
        };
        
        // Cache de fichiers
        this.cache = {
            preloadedFiles: new Map(),
            maxCacheSize: 10,
            enabled: true
        };
        
        // Statistiques
        this.stats = {
            filesPlayed: 0,
            totalPlaytime: 0,
            seeks: 0,
            tempoChanges: 0,
            startTime: null,
            lastUpdateTime: 0
        };
        
        // Configuration
        this.config = {
            latencyCompensation: 0,
            velocityCurve: 'linear',
            autoPreload: true,
            syncInterval: 1000,
            enableBackendSync: true
        };
        
        // État interne
        this.state = {
            isPlaying: false,
            isPaused: false,
            currentPosition: 0,
            duration: 0,
            tempo: 120,
            volume: 100
        };
        
        this.log('info', 'GlobalPlaybackController', '✓ Initialized v3.3.0');
        
        this.connectPlaybackModelEvents();
        this.connectBackendEvents();
        this.setupBackendSync();
        
        GlobalPlaybackController.instance = this;
    }
    
    createFallbackLogger() {
        return {
            debug: (...args) => console.log('[DEBUG]', ...args),
            info: (...args) => console.log('[INFO]', ...args),
            warn: (...args) => console.warn('[WARN]', ...args),
            error: (...args) => console.error('[ERROR]', ...args),
            log: (...args) => console.log(...args)
        };
    }
    
    log(level, ...args) {
        if (this.logger && typeof this.logger[level] === 'function') {
            this.logger[level](...args);
        } else {
            console[level]?.(...args) || console.log(...args);
        }
    }
    
    // ========================================================================
    // ÉVÉNEMENTS
    // ========================================================================
    
    /**
     * Connecte les événements du modèle de playback
     */
    connectPlaybackModelEvents() {
        if (!this.eventBus) return;
        
        this.eventBus.on('playback:stateChanged', (data) => {
            this.state.isPlaying = data.newState === 'playing';
            this.state.isPaused = data.newState === 'paused';
            this.log('debug', 'GlobalPlayback', 'State changed:', data.newState);
            this.eventBus.emit('globalPlayback:stateChanged', data);
        });
        
        this.eventBus.on('playback:timeUpdate', (data) => {
            this.state.currentPosition = data.position;
            this.stats.lastUpdateTime = Date.now();
            this.eventBus.emit('globalPlayback:timeUpdate', data);
        });
        
        this.eventBus.on('playback:ended', () => {
            this.handlePlaybackEnded();
        });
        
        this.eventBus.on('playback:error', (data) => {
            this.log('error', 'GlobalPlayback', 'Playback error:', data);
            this.eventBus.emit('globalPlayback:error', data);
        });
    }
    
    /**
     * Connecte les événements du backend
     */
    connectBackendEvents() {
        if (!this.eventBus) return;
        
        // Événement playback_position du backend
        this.eventBus.on('backend:event:playback_position', (data) => {
            this.handleBackendPosition(data);
        });
        
        // Événement playback_finished du backend
        this.eventBus.on('backend:event:playback_finished', (data) => {
            this.handlePlaybackEnded();
        });
        
        // Événement playback_started du backend
        this.eventBus.on('backend:event:playback_started', (data) => {
            this.state.isPlaying = true;
            this.state.isPaused = false;
            this.stats.startTime = Date.now();
        });
        
        // Événement playback_paused du backend
        this.eventBus.on('backend:event:playback_paused', (data) => {
            this.state.isPlaying = false;
            this.state.isPaused = true;
        });
        
        // Événement playback_stopped du backend
        this.eventBus.on('backend:event:playback_stopped', (data) => {
            this.state.isPlaying = false;
            this.state.isPaused = false;
            this.state.currentPosition = 0;
        });
    }
    
    /**
     * Gère la mise à jour de position depuis le backend
     */
    handleBackendPosition(data) {
        if (data.position !== undefined) {
            this.state.currentPosition = data.position;
            this.playbackModel.set('currentTime', data.position);
        }
        
        if (data.duration !== undefined) {
            this.state.duration = data.duration;
            this.playbackModel.set('duration', data.duration);
        }
        
        this.eventBus.emit('globalPlayback:position', {
            position: this.state.currentPosition,
            duration: this.state.duration
        });
    }
    
    /**
     * Configure la synchronisation avec le backend
     */
    setupBackendSync() {
        if (!this.backend || typeof this.backend.isConnected !== 'function') {
            this.log('warn', 'GlobalPlayback', 'Backend not available for sync');
            return;
        }
        
        if (!this.backend.isConnected()) {
            this.log('warn', 'GlobalPlayback', 'Backend not connected, waiting...');
            this.eventBus.once('backend:connected', () => {
                this.setupBackendSync();
            });
            return;
        }
        
        // Synchronisation périodique
        if (this.config.enableBackendSync) {
            setInterval(() => {
                if (this.state.isPlaying && this.backend.isConnected()) {
                    this.syncWithBackend();
                }
            }, this.config.syncInterval);
        }
    }
    
    /**
     * Synchronise l'état avec le backend
     */
    async syncWithBackend() {
        if (!this.backend || !this.backend.isConnected()) {
            return;
        }
        
        try {
            // ✓ NOUVEAU: Utilise sendCommand() avec format API correct
            const response = await this.backend.sendCommand('playback.getStatus');
            
            if (response && response.status) {
                // Mettre à jour l'état local
                this.state.currentPosition = response.status.position || 0;
                this.state.duration = response.status.duration || 0;
                this.state.tempo = response.status.tempo || 120;
                
                // Mettre à jour le modèle
                this.playbackModel.updateFromBackend(response.status);
            }
        } catch (error) {
            this.log('error', 'GlobalPlayback', 'Sync error:', error.message);
        }
    }
    
    // ========================================================================
    // COMMANDES DE PLAYBACK
    // ========================================================================
    
    /**
     * Charge un fichier MIDI
     */
    async load(filename) {
        if (!this.backend || !this.backend.isConnected()) {
            this.log('error', 'GlobalPlayback', 'Backend not connected');
            return false;
        }
        
        try {
            // ✓ NOUVEAU: Utilise sendCommand() avec format API correct
            const response = await this.backend.sendCommand('playback.load', { 
                filename: filename 
            });
            
            if (response) {
                this.currentFile.name = filename;
                this.currentFile.path = filename;
                this.currentFile.id = response.file_id || null;
                this.currentFile.duration = response.duration || 0;
                this.state.duration = response.duration || 0;
                
                // Charger dans le modèle
                await this.playbackModel.load(filename);
                
                this.stats.filesPlayed++;
                this.log('info', 'GlobalPlayback', `✓ Loaded: ${filename}`);
                
                this.eventBus.emit('globalPlayback:fileLoaded', {
                    filename,
                    duration: this.currentFile.duration
                });
                
                return true;
            }
        } catch (error) {
            this.log('error', 'GlobalPlayback', 'Load error:', error.message);
            this.eventBus.emit('globalPlayback:error', { 
                action: 'load', 
                error: error.message 
            });
        }
        
        return false;
    }
    
    /**
     * Démarre la lecture
     */
    async play() {
        if (!this.backend || !this.backend.isConnected()) {
            this.log('warn', 'GlobalPlayback', 'Playing without backend connection');
            return await this.playbackModel.play();
        }
        
        try {
            // ✓ NOUVEAU: Utilise sendCommand()
            const response = await this.backend.sendCommand('playback.play');
            
            if (response) {
                this.state.isPlaying = true;
                this.state.isPaused = false;
                this.stats.startTime = Date.now();
                
                await this.playbackModel.play();
                
                this.log('info', 'GlobalPlayback', '▶️ Playing');
                return true;
            }
        } catch (error) {
            this.log('error', 'GlobalPlayback', 'Play error:', error.message);
        }
        
        return false;
    }
    
    /**
     * Met en pause
     */
    async pause() {
        if (!this.backend || !this.backend.isConnected()) {
            return await this.playbackModel.pause();
        }
        
        try {
            // ✓ NOUVEAU: Utilise sendCommand()
            const response = await this.backend.sendCommand('playback.pause');
            
            if (response) {
                this.state.isPlaying = false;
                this.state.isPaused = true;
                
                await this.playbackModel.pause();
                
                this.log('info', 'GlobalPlayback', '⏸️ Paused');
                return true;
            }
        } catch (error) {
            this.log('error', 'GlobalPlayback', 'Pause error:', error.message);
        }
        
        return false;
    }
    
    /**
     * Arrête la lecture
     */
    async stop() {
        if (!this.backend || !this.backend.isConnected()) {
            const result = await this.playbackModel.stop();
            this.state.isPlaying = false;
            this.state.isPaused = false;
            this.state.currentPosition = 0;
            this.stats.startTime = null;
            return result;
        }
        
        try {
            // ✓ NOUVEAU: Utilise sendCommand()
            const response = await this.backend.sendCommand('playback.stop');
            
            if (response) {
                this.state.isPlaying = false;
                this.state.isPaused = false;
                this.state.currentPosition = 0;
                this.stats.startTime = null;
                
                await this.playbackModel.stop();
                
                this.log('info', 'GlobalPlayback', '⏹️ Stopped');
                return true;
            }
        } catch (error) {
            this.log('error', 'GlobalPlayback', 'Stop error:', error.message);
        }
        
        return false;
    }
    
    /**
     * Se déplace à une position
     */
    async seek(position) {
        if (!this.backend || !this.backend.isConnected()) {
            return await this.playbackModel.seek(position);
        }
        
        try {
            // ✓ NOUVEAU: Utilise sendCommand()
            const response = await this.backend.sendCommand('playback.seek', { 
                position: position 
            });
            
            if (response) {
                this.state.currentPosition = position;
                this.stats.seeks++;
                
                await this.playbackModel.seek(position);
                
                this.log('debug', 'GlobalPlayback', `⏩ Seek to ${position.toFixed(2)}s`);
                return true;
            }
        } catch (error) {
            this.log('error', 'GlobalPlayback', 'Seek error:', error.message);
        }
        
        return false;
    }
    
    /**
     * Change le tempo
     */
    async setTempo(tempo) {
        if (!this.backend || !this.backend.isConnected()) {
            return await this.playbackModel.setTempo(tempo);
        }
        
        try {
            // ✓ NOUVEAU: Utilise sendCommand()
            const response = await this.backend.sendCommand('playback.setTempo', { 
                tempo: tempo 
            });
            
            if (response) {
                this.state.tempo = tempo;
                this.stats.tempoChanges++;
                
                await this.playbackModel.setTempo(tempo);
                
                this.log('debug', 'GlobalPlayback', `🎵 Tempo set to ${tempo} BPM`);
                return true;
            }
        } catch (error) {
            this.log('error', 'GlobalPlayback', 'SetTempo error:', error.message);
        }
        
        return false;
    }
    
    // ========================================================================
    // GESTION PLAYLIST
    // ========================================================================
    
    /**
     * Gère la fin de lecture
     */
    async handlePlaybackEnded() {
        this.log('debug', 'GlobalPlayback', 'Playback ended');
        
        this.state.isPlaying = false;
        this.state.currentPosition = 0;
        
        // Calculer temps de lecture
        if (this.stats.startTime) {
            this.stats.totalPlaytime += (Date.now() - this.stats.startTime);
            this.stats.startTime = null;
        }
        
        this.eventBus.emit('globalPlayback:ended');
        
        // Auto-advance dans la playlist
        if (this.playlist.autoAdvance) {
            if (this.playlist.repeat === 'one') {
                await this.play();
            } else {
                await this.nextTrack();
            }
        }
    }
    
    /**
     * Passe à la piste suivante
     */
    async nextTrack() {
        if (this.playlist.files.length === 0) return false;
        
        let nextIndex = this.playlist.currentIndex + 1;
        
        if (nextIndex >= this.playlist.files.length) {
            if (this.playlist.repeat === 'all') {
                nextIndex = 0;
            } else {
                this.log('info', 'GlobalPlayback', 'End of playlist');
                return false;
            }
        }
        
        this.playlist.currentIndex = nextIndex;
        const file = this.playlist.files[nextIndex];
        
        await this.load(file.name || file.path);
        await this.play();
        
        this.eventBus.emit('globalPlayback:trackChanged', {
            index: nextIndex,
            file: file
        });
        
        return true;
    }
    
    /**
     * Passe à la piste précédente
     */
    async previousTrack() {
        if (this.playlist.files.length === 0) return false;
        
        let prevIndex = this.playlist.currentIndex - 1;
        
        if (prevIndex < 0) {
            if (this.playlist.repeat === 'all') {
                prevIndex = this.playlist.files.length - 1;
            } else {
                this.log('info', 'GlobalPlayback', 'Start of playlist');
                return false;
            }
        }
        
        this.playlist.currentIndex = prevIndex;
        const file = this.playlist.files[prevIndex];
        
        await this.load(file.name || file.path);
        await this.play();
        
        this.eventBus.emit('globalPlayback:trackChanged', {
            index: prevIndex,
            file: file
        });
        
        return true;
    }
    
    /**
     * Définit la playlist
     */
    setPlaylist(files) {
        this.playlist.files = files;
        this.playlist.currentIndex = files.length > 0 ? 0 : -1;
        
        this.log('info', 'GlobalPlayback', `Playlist set: ${files.length} files`);
        this.eventBus.emit('globalPlayback:playlistChanged', {
            files: files,
            count: files.length
        });
    }
    
    // ========================================================================
    // GETTERS
    // ========================================================================
    
    getState() {
        return {
            ...this.state,
            file: this.currentFile,
            playlist: this.playlist
        };
    }
    
    getCurrentTime() {
        return this.state.currentPosition;
    }
    
    getDuration() {
        return this.state.duration;
    }
    
    isPlaying() {
        return this.state.isPlaying;
    }
    
    isPaused() {
        return this.state.isPaused;
    }
    
    getTempo() {
        return this.state.tempo;
    }
    
    getStats() {
        return { ...this.stats };
    }
    
    getCurrentFile() {
        return { ...this.currentFile };
    }
    
    getPlaylist() {
        return { ...this.playlist };
    }
    
    // ========================================================================
    // CLEANUP
    // ========================================================================
    
    destroy() {
        if (this.playbackModel) {
            this.playbackModel.destroy();
        }
        
        this.cache.preloadedFiles.clear();
        GlobalPlaybackController.instance = null;
        this.log('info', 'GlobalPlayback', 'Destroyed');
    }
}

// ============================================================================
// EXPORT
// ============================================================================

if (typeof module !== 'undefined' && module.exports) {
    module.exports = GlobalPlaybackController;
}

if (typeof window !== 'undefined') {
    window.GlobalPlaybackController = GlobalPlaybackController;
}