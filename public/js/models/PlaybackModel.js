// ============================================================================
// Fichier: frontend/js/models/PlaybackModel.js
// Chemin réel: frontend/js/models/PlaybackModel.js
// Version: v4.2.2 - API CORRECTED
// Date: 2025-11-02
// ============================================================================
// CORRECTIONS v4.2.2:
// ✅ playback.load avec param "filename" (pas "file_path")
// ✅ Extraction correcte response.data
// ✅ Gestion événements backend conformes
// ============================================================================

class PlaybackModel extends BaseModel {
    constructor(eventBus, backend, logger, initialData = {}, options = {}) {
        super(eventBus, backend, logger, initialData, {
            persistKey: 'playbackmodel',
            eventPrefix: 'playback',
            autoPersist: false,
            ...options
        });
        
        // État initial de la lecture
        this.data.state = initialData.state || 'stopped'; // 'stopped', 'playing', 'paused'
        this.data.currentFile = initialData.currentFile || null;
        this.data.currentTime = initialData.currentTime || 0;
        this.data.duration = initialData.duration || 0;
        this.data.tempo = initialData.tempo || 1.0;
        this.data.loop = initialData.loop || false;
        
        this.log('debug', 'PlaybackModel', '✓ Initialized v4.2.2');
    }
    
    /**
     * Charge un fichier MIDI pour la lecture
     * ✅ API v4.2.2: playback.load avec param "filename"
     */
    async load(filename) {
        if (!this.backend || !this.backend.isConnected()) {
            this.log('warn', 'PlaybackModel.load', 'Backend not connected');
            return false;
        }
        
        try {
            // ✅ CORRECTION: param "filename" selon doc v4.2.2
            const response = await this.backend.sendCommand('playback.load', { 
                filename: filename 
            });
            const data = response.data || response;
            
            if (data) {
                this.data.currentFile = filename;
                this.data.duration = data.duration || 0;
                this.emit('playback:loaded', { filename, duration: data.duration });
                return true;
            }
        } catch (error) {
            this.log('error', 'PlaybackModel.load', error.message);
        }
        
        return false;
    }
    
    /**
     * Démarre la lecture
     * ✅ API v4.2.2: playback.play
     */
    async play() {
        if (!this.backend || !this.backend.isConnected()) {
            this.log('warn', 'PlaybackModel.play', 'Backend not connected');
            return false;
        }
        
        try {
            const response = await this.backend.sendCommand('playback.play');
            const data = response.data || response;
            
            if (data) {
                this.data.state = 'playing';
                this.emit('playback:play');
                this.emit('state:changed', { state: 'playing' });
                return true;
            }
        } catch (error) {
            this.log('error', 'PlaybackModel.play', error.message);
        }
        
        return false;
    }
    
    /**
     * Met la lecture en pause
     * ✅ API v4.2.2: playback.pause
     */
    async pause() {
        if (!this.backend || !this.backend.isConnected()) {
            this.log('warn', 'PlaybackModel.pause', 'Backend not connected');
            return false;
        }
        
        try {
            const response = await this.backend.sendCommand('playback.pause');
            const data = response.data || response;
            
            if (data) {
                this.data.state = 'paused';
                this.emit('playback:pause');
                this.emit('state:changed', { state: 'paused' });
                return true;
            }
        } catch (error) {
            this.log('error', 'PlaybackModel.pause', error.message);
        }
        
        return false;
    }
    
    /**
     * Arrête la lecture
     * ✅ API v4.2.2: playback.stop
     */
    async stop() {
        if (!this.backend || !this.backend.isConnected()) {
            this.log('warn', 'PlaybackModel.stop', 'Backend not connected');
            return false;
        }
        
        try {
            const response = await this.backend.sendCommand('playback.stop');
            const data = response.data || response;
            
            if (data) {
                this.data.state = 'stopped';
                this.data.currentTime = 0;
                this.emit('playback:stop');
                this.emit('state:changed', { state: 'stopped' });
                return true;
            }
        } catch (error) {
            this.log('error', 'PlaybackModel.stop', error.message);
        }
        
        return false;
    }
    
    /**
     * Se déplace à une position spécifique
     * ✅ API v4.2.2: playback.seek avec param "position"
     */
    async seek(position) {
        if (!this.backend || !this.backend.isConnected()) {
            this.log('warn', 'PlaybackModel.seek', 'Backend not connected');
            return false;
        }
        
        try {
            const response = await this.backend.sendCommand('playback.seek', { 
                position: position 
            });
            const data = response.data || response;
            
            if (data) {
                this.data.currentTime = position;
                this.emit('playback:seek', { position });
                return true;
            }
        } catch (error) {
            this.log('error', 'PlaybackModel.seek', error.message);
        }
        
        return false;
    }
    
    /**
     * Récupère l'état actuel de la lecture
     * ✅ API v4.2.2: playback.getStatus
     */
    async getStatus() {
        if (!this.backend || !this.backend.isConnected()) {
            this.log('warn', 'PlaybackModel.getStatus', 'Backend not connected');
            return null;
        }
        
        try {
            const response = await this.backend.sendCommand('playback.getStatus');
            const data = response.data || response;
            
            if (data) {
                // Mettre à jour l'état local
                this.data.state = data.state || 'stopped';
                this.data.currentTime = data.current_time || data.position || 0;
                this.data.duration = data.duration || 0;
                this.data.currentFile = data.current_file || data.filename || null;
                
                return data;
            }
        } catch (error) {
            this.log('error', 'PlaybackModel.getStatus', error.message);
        }
        
        return null;
    }
    
    /**
     * Définit le mode de boucle
     * ✅ API v4.2.2: playback.setLoop avec params "enabled", "start_pos", "end_pos"
     */
    async setLoop(enabled, startPos = null, endPos = null) {
        if (!this.backend || !this.backend.isConnected()) {
            this.log('warn', 'PlaybackModel.setLoop', 'Backend not connected');
            return false;
        }
        
        try {
            const params = { enabled: enabled };
            if (startPos !== null) params.start_pos = startPos;
            if (endPos !== null) params.end_pos = endPos;
            
            const response = await this.backend.sendCommand('playback.setLoop', params);
            const data = response.data || response;
            
            if (data) {
                this.data.loop = enabled;
                this.emit('playback:loop_changed', { enabled, startPos, endPos });
                return true;
            }
        } catch (error) {
            this.log('error', 'PlaybackModel.setLoop', error.message);
        }
        
        return false;
    }
    
    /**
     * Définit le tempo de lecture
     * ✅ API v4.2.2: playback.setTempo avec param "tempo"
     */
    async setTempo(tempo) {
        if (!this.backend || !this.backend.isConnected()) {
            this.log('warn', 'PlaybackModel.setTempo', 'Backend not connected');
            return false;
        }
        
        try {
            const response = await this.backend.sendCommand('playback.setTempo', { 
                tempo: tempo 
            });
            const data = response.data || response;
            
            if (data) {
                this.data.tempo = tempo;
                this.emit('playback:tempo_changed', { tempo });
                return true;
            }
        } catch (error) {
            this.log('error', 'PlaybackModel.setTempo', error.message);
        }
        
        return false;
    }
    
    /**
     * Obtient les informations détaillées du fichier en cours
     * ✅ API v4.2.2: playback.getInfo
     */
    async getInfo() {
        if (!this.backend || !this.backend.isConnected()) {
            this.log('warn', 'PlaybackModel.getInfo', 'Backend not connected');
            return null;
        }
        
        try {
            const response = await this.backend.sendCommand('playback.getInfo');
            const data = response.data || response;
            return data;
        } catch (error) {
            this.log('error', 'PlaybackModel.getInfo', error.message);
        }
        
        return null;
    }
    
    /**
     * Liste les fichiers disponibles pour la lecture
     * ✅ API v4.2.2: playback.listFiles
     */
    async listFiles() {
        if (!this.backend || !this.backend.isConnected()) {
            this.log('warn', 'PlaybackModel.listFiles', 'Backend not connected');
            return [];
        }
        
        try {
            const response = await this.backend.sendCommand('playback.listFiles');
            const data = response.data || response;
            return data.files || [];
        } catch (error) {
            this.log('error', 'PlaybackModel.listFiles', error.message);
        }
        
        return [];
    }
    
    /**
     * Met à jour la position actuelle (appelé par les événements backend)
     */
    updateProgress(position, duration) {
        this.data.currentTime = position;
        this.data.duration = duration;
        this.emit('playback:progress', { position, duration });
    }
    
    /**
     * Getters pour l'état
     */
    isPlaying() {
        return this.data.state === 'playing';
    }
    
    isPaused() {
        return this.data.state === 'paused';
    }
    
    isStopped() {
        return this.data.state === 'stopped';
    }
    
    getCurrentFile() {
        return this.data.currentFile;
    }
    
    getCurrentTime() {
        return this.data.currentTime;
    }
    
    getDuration() {
        return this.data.duration;
    }
    
    getTempo() {
        return this.data.tempo;
    }
    
    isLooping() {
        return this.data.loop;
    }
}

// ============================================================================
// EXPORT
// ============================================================================

if (typeof module !== 'undefined' && module.exports) {
    module.exports = PlaybackModel;
}

if (typeof window !== 'undefined') {
    window.PlaybackModel = PlaybackModel;
}