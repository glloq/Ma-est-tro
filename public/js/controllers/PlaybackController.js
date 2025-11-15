// ============================================================================
// Fichier: frontend/js/controllers/PlaybackController.js
// Chemin réel: frontend/js/controllers/PlaybackController.js
// Version: v4.2.3 - FIXED BACKEND SIGNATURE - API CORRECTED
// Date: 2025-11-02
// ============================================================================
// CORRECTIONS v4.2.3:
// ✓ CRITIQUE: Ajout paramètre backend au constructeur (6ème paramètre)
// ✓ Fix: super() appelle BaseController avec backend
// ✓ this.backend initialisé automatiquement via BaseController
// ============================================================================
// ============================================================================
// CORRECTIONS v4.2.2:
// • filename (pas file_path) pour playback.load
// • Utiliser shortcuts BackendService
// ============================================================================

class PlaybackController extends BaseController {
    constructor(eventBus, models = {}, views = {}, notifications = null, debugConsole = null, backend = null) {
        super(eventBus, models, views, notifications, debugConsole, backend);
        
        this.logger = window.logger || console;
        this.playbackModel = models.playback;
        this.fileModel = models.file;
        this.view = views.playback;
        // ✓ this.backend initialisé automatiquement par BaseController
        
        this.state = {
            ...this.state,
            isPlaying: false,
            position: 0,
            duration: 0,
            tempo: 120,
            volume: 100,
            loop: { enabled: false, start: 0, end: 0 },
            loadedFile: null,
            backendReady: false
        };
        
        this.config = {
            ...this.config,
            positionUpdateInterval: 100,
            autoLoadOnSelect: true
        };
        
        this.positionTimer = null;
        this._fullyInitialized = true;
        this.bindEvents();
    }
    
    bindEvents() {
        this.eventBus.on('playback:play', () => this.play());
        this.eventBus.on('playback:pause', () => this.pause());
        this.eventBus.on('playback:stop', () => this.stop());
        this.eventBus.on('playback:seek', (data) => this.seek(data.position));
        this.eventBus.on('playback:set-tempo', (data) => this.setTempo(data.tempo));
        this.eventBus.on('playback:set-volume', (data) => this.setVolume(data.volume));
        this.eventBus.on('playback:toggle-loop', () => this.toggleLoop());
        this.eventBus.on('playback:load-file', (data) => this.loadFile(data.filename || data.fileId));
        
        this.eventBus.on('backend:event:playback_position', (data) => this.handlePositionUpdate(data));
        this.eventBus.on('backend:event:playback_finished', () => this.handlePlaybackFinished());
        this.eventBus.on('backend:event:playback_state', (data) => this.handleStateChange(data));
        
        this.eventBus.on('backend:connected', () => this.onBackendConnected());
        this.eventBus.on('backend:disconnected', () => this.onBackendDisconnected());
        
        this.eventBus.on('file:selected', (data) => {
            if (this.config.autoLoadOnSelect) {
                this.loadFile(data.filename || data.fileId);
            }
        });
        
        this.log('info', 'PlaybackController', '✓ Events bound v4.2.2');
    }
    
    async onBackendConnected() {
        this.state.backendReady = true;
        this.log('info', 'PlaybackController', '✓ Backend connected');
    }
    
    onBackendDisconnected() {
        this.state.backendReady = false;
        this.stopPositionUpdates();
        this.state.isPlaying = false;
        this.log('warn', 'PlaybackController', '⚠️ Backend disconnected');
    }
    
    /**
     * • CORRECTION: filename (pas file_path)
     */
    async loadFile(filename) {
        try {
            this.log('info', 'PlaybackController', `Loading: ${filename}`);
            
            // • Utiliser helper BackendService
            await this.backend.loadPlaybackFile(filename);
            
            this.state.loadedFile = filename;
            this.state.position = 0;
            
            const status = await this.backend.getStatus();
            this.state.duration = status.duration || 0;
            
            if (this.playbackModel) {
                this.playbackModel.set('currentFile', filename);
                this.playbackModel.set('duration', this.state.duration);
                this.playbackModel.set('position', 0);
            }
            
            this.log('info', 'PlaybackController', `✓ Loaded: ${filename}`);
            this.eventBus.emit('playback:file-loaded', { filename, duration: this.state.duration });
            
            if (this.notifications) {
                this.notifications.show('File Loaded', `${filename} ready`, 'success', 2000);
            }
            
            return true;
            
        } catch (error) {
            this.log('error', 'PlaybackController', 'loadFile failed:', error);
            if (this.notifications) {
                this.notifications.show('Error', `Load failed: ${error.message}`, 'error', 3000);
            }
            throw error;
        }
    }
    
    async play(filename = null) {
        try {
            this.log('info', 'PlaybackController', 'Starting playback...');
            
            await this.backend.play(filename ? filename : null);
            
            this.state.isPlaying = true;
            
            if (this.playbackModel) {
                this.playbackModel.set('isPlaying', true);
            }
            
            this.startPositionUpdates();
            
            this.log('info', 'PlaybackController', '✓ Playing');
            this.eventBus.emit('playback:started');
            
            return true;
            
        } catch (error) {
            this.log('error', 'PlaybackController', 'play failed:', error);
            if (this.notifications) {
                this.notifications.show('Error', `Play failed: ${error.message}`, 'error', 3000);
            }
            throw error;
        }
    }
    
    async pause() {
        try {
            await this.backend.pause();
            
            this.state.isPlaying = false;
            
            if (this.playbackModel) {
                this.playbackModel.set('isPlaying', false);
            }
            
            this.stopPositionUpdates();
            
            this.log('info', 'PlaybackController', '✓ Paused');
            this.eventBus.emit('playback:paused');
            
            return true;
            
        } catch (error) {
            this.log('error', 'PlaybackController', 'pause failed:', error);
            throw error;
        }
    }
    
    async stop() {
        try {
            await this.backend.stop();
            
            this.state.isPlaying = false;
            this.state.position = 0;
            
            if (this.playbackModel) {
                this.playbackModel.set('isPlaying', false);
                this.playbackModel.set('position', 0);
            }
            
            this.stopPositionUpdates();
            
            this.log('info', 'PlaybackController', '✓ Stopped');
            this.eventBus.emit('playback:stopped');
            
            return true;
            
        } catch (error) {
            this.log('error', 'PlaybackController', 'stop failed:', error);
            throw error;
        }
    }
    
    async seek(position) {
        try {
            await this.backend.seek(position);
            
            this.state.position = position;
            
            if (this.playbackModel) {
                this.playbackModel.set('position', position);
            }
            
            this.eventBus.emit('playback:seeked', { position });
            
            return true;
            
        } catch (error) {
            this.log('error', 'PlaybackController', 'seek failed:', error);
            throw error;
        }
    }
    
    async setTempo(tempo) {
        try {
            await this.backend.setTempo(tempo);
            
            this.state.tempo = tempo;
            
            if (this.playbackModel) {
                this.playbackModel.set('tempo', tempo);
            }
            
            this.eventBus.emit('playback:tempo-changed', { tempo });
            
            return true;
            
        } catch (error) {
            this.log('error', 'PlaybackController', 'setTempo failed:', error);
            throw error;
        }
    }
    
    async setLoop(enabled, start = 0, end = 0) {
        try {
            await this.backend.setLoop(enabled);
            
            this.state.loop = { enabled, start, end };
            
            if (this.playbackModel) {
                this.playbackModel.set('loop', this.state.loop);
            }
            
            this.eventBus.emit('playback:loop-changed', { enabled, start, end });
            
            return true;
            
        } catch (error) {
            this.log('error', 'PlaybackController', 'setLoop failed:', error);
            throw error;
        }
    }
    
    async toggleLoop() {
        const enabled = !this.state.loop.enabled;
        return await this.setLoop(enabled, this.state.loop.start, this.state.loop.end);
    }
    
    async getStatus() {
        try {
            const status = await this.backend.getStatus();
            
            this.state.position = status.position || 0;
            this.state.duration = status.duration || 0;
            this.state.isPlaying = status.state === 'playing';
            
            if (this.playbackModel) {
                this.playbackModel.set('position', this.state.position);
                this.playbackModel.set('duration', this.state.duration);
                this.playbackModel.set('isPlaying', this.state.isPlaying);
            }
            
            return status;
            
        } catch (error) {
            this.log('error', 'PlaybackController', 'getStatus failed:', error);
            return null;
        }
    }
    
    handlePositionUpdate(data) {
        this.state.position = data.position || 0;
        
        if (this.playbackModel) {
            this.playbackModel.set('position', this.state.position);
        }
        
        this.eventBus.emit('playback:position-updated', { position: this.state.position });
    }
    
    handlePlaybackFinished() {
        this.state.isPlaying = false;
        this.state.position = 0;
        
        if (this.playbackModel) {
            this.playbackModel.set('isPlaying', false);
            this.playbackModel.set('position', 0);
        }
        
        this.stopPositionUpdates();
        
        this.eventBus.emit('playback:finished');
    }
    
    handleStateChange(data) {
        this.state.isPlaying = data.state === 'playing';
        
        if (this.playbackModel) {
            this.playbackModel.set('isPlaying', this.state.isPlaying);
        }
        
        this.eventBus.emit('playback:state-changed', { state: data.state });
    }
    
    startPositionUpdates() {
        if (this.positionTimer) return;
        
        this.positionTimer = setInterval(async () => {
            await this.getStatus();
        }, this.config.positionUpdateInterval);
    }
    
    stopPositionUpdates() {
        if (this.positionTimer) {
            clearInterval(this.positionTimer);
            this.positionTimer = null;
        }
    }
    
    log(level, ...args) {
        if (this.logger && typeof this.logger[level] === 'function') {
            this.logger[level](...args);
        }
    }
}

if (typeof window !== 'undefined') {
    window.PlaybackController = PlaybackController;
}