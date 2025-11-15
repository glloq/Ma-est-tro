// ============================================================================
// Fichier: frontend/js/models/SystemModel.js
// Chemin réel: frontend/js/models/SystemModel.js
// Version: v4.2.3 - SIGNATURE CORRIGÉE
// Date: 2025-11-11
// ============================================================================
// CORRECTIONS v4.2.3:
// ✅ CRITIQUE: Correction signature super() - passe initialData au lieu de {}
// ✅ Compatible avec BackendService v4.0.0
// ✅ Extraction response.data correcte
// 
// CORRECTIONS v4.2.2:
// ✅ Remplacé backend.send() par backend.sendCommand()
// ============================================================================

class SystemModel extends BaseModel {
    constructor(eventBus, backend, logger, initialData = {}, options = {}) {
        // ✅ CORRECTION v4.2.3: Passe initialData au lieu de {}
        super(eventBus, backend, logger, initialData, {
            persistKey: 'systemmodel',
            eventPrefix: 'system',
            autoPersist: false,
            ...options  // Permet override des options par défaut
        });
        
        // Initialisation des données système avec valeurs par défaut
        this.data.info = this.data.info || null;
        this.data.version = this.data.version || null;
        this.data.uptime = this.data.uptime || 0;
        this.data.memory = this.data.memory || null;
        this.data.disk = this.data.disk || null;
        this.data.cpu = this.data.cpu || null;
        
        this.log('debug', 'SystemModel', 'Initialized (v4.2.3)');
    }
    
    /**
     * Ping le backend pour vérifier la connexion
     * ✅ API v4.2.2: system.ping
     */
    async ping() {
        if (!this.backend || !this.backend.isConnected()) {
            this.log('warn', 'SystemModel.ping', 'Backend not connected');
            return false;
        }
        
        try {
            const response = await this.backend.sendCommand('system.ping', {});
            const data = response.data || response;
            return data.pong || false;
        } catch (error) {
            this.log('error', 'SystemModel.ping', error.message);
            return false;
        }
    }
    
    /**
     * Récupère la version du backend
     * ✅ API v4.2.2: system.version
     */
    async getVersion() {
        if (!this.backend || !this.backend.isConnected()) {
            this.log('warn', 'SystemModel.getVersion', 'Backend not connected');
            return null;
        }
        
        try {
            const response = await this.backend.sendCommand('system.version', {});
            const data = response.data || response;
            
            this.data.version = data;
            this.emit('version:updated', { version: data });
            
            return data;
        } catch (error) {
            this.log('error', 'SystemModel.getVersion', error.message);
            return null;
        }
    }
    
    /**
     * Récupère les informations système
     * ✅ API v4.2.2: system.info
     */
    async getInfo() {
        if (!this.backend || !this.backend.isConnected()) {
            this.log('warn', 'SystemModel.getInfo', 'Backend not connected');
            return null;
        }
        
        try {
            const response = await this.backend.sendCommand('system.info', {});
            const data = response.data || response;
            
            this.data.info = data;
            this.emit('info:updated', { info: data });
            
            return data;
        } catch (error) {
            this.log('error', 'SystemModel.getInfo', error.message);
            return null;
        }
    }
    
    /**
     * Récupère le temps de fonctionnement (uptime)
     * ✅ API v4.2.2: system.uptime
     */
    async getUptime() {
        if (!this.backend || !this.backend.isConnected()) {
            this.log('warn', 'SystemModel.getUptime', 'Backend not connected');
            return 0;
        }
        
        try {
            const response = await this.backend.sendCommand('system.uptime', {});
            const data = response.data || response;
            
            this.data.uptime = data.uptime || data || 0;
            this.emit('uptime:updated', { uptime: this.data.uptime });
            
            return this.data.uptime;
        } catch (error) {
            this.log('error', 'SystemModel.getUptime', error.message);
            return 0;
        }
    }
    
    /**
     * Récupère les statistiques mémoire
     * ✅ API v4.2.2: system.memory
     */
    async getMemory() {
        if (!this.backend || !this.backend.isConnected()) {
            this.log('warn', 'SystemModel.getMemory', 'Backend not connected');
            return null;
        }
        
        try {
            const response = await this.backend.sendCommand('system.memory', {});
            const data = response.data || response;
            
            this.data.memory = data;
            this.emit('memory:updated', { memory: data });
            
            return data;
        } catch (error) {
            this.log('error', 'SystemModel.getMemory', error.message);
            return null;
        }
    }
    
    /**
     * Récupère les statistiques disque
     * ✅ API v4.2.2: system.disk
     */
    async getDisk() {
        if (!this.backend || !this.backend.isConnected()) {
            this.log('warn', 'SystemModel.getDisk', 'Backend not connected');
            return null;
        }
        
        try {
            const response = await this.backend.sendCommand('system.disk', {});
            const data = response.data || response;
            
            this.data.disk = data;
            this.emit('disk:updated', { disk: data });
            
            return data;
        } catch (error) {
            this.log('error', 'SystemModel.getDisk', error.message);
            return null;
        }
    }
    
    /**
     * Récupère les statistiques CPU
     * ✅ API v4.2.2: system.cpu
     */
    async getCpu() {
        if (!this.backend || !this.backend.isConnected()) {
            this.log('warn', 'SystemModel.getCpu', 'Backend not connected');
            return null;
        }
        
        try {
            const response = await this.backend.sendCommand('system.cpu', {});
            const data = response.data || response;
            
            this.data.cpu = data;
            this.emit('cpu:updated', { cpu: data });
            
            return data;
        } catch (error) {
            this.log('error', 'SystemModel.getCpu', error.message);
            return null;
        }
    }
    
    /**
     * Récupère toutes les statistiques système en une fois
     */
    async getAllStats() {
        if (!this.backend || !this.backend.isConnected()) {
            this.log('warn', 'SystemModel.getAllStats', 'Backend not connected');
            return null;
        }
        
        try {
            const [info, version, uptime, memory, disk, cpu] = await Promise.all([
                this.getInfo(),
                this.getVersion(),
                this.getUptime(),
                this.getMemory(),
                this.getDisk(),
                this.getCpu()
            ]);
            
            const stats = {
                info,
                version,
                uptime,
                memory,
                disk,
                cpu,
                timestamp: Date.now()
            };
            
            this.emit('stats:updated', { stats });
            
            return stats;
        } catch (error) {
            this.log('error', 'SystemModel.getAllStats', error.message);
            return null;
        }
    }
    
    // ========================================================================
    // GETTERS
    // ========================================================================
    
    getSystemInfo() {
        return this.data.info;
    }
    
    getSystemVersion() {
        return this.data.version;
    }
    
    getSystemUptime() {
        return this.data.uptime;
    }
    
    getMemoryStats() {
        return this.data.memory;
    }
    
    getDiskStats() {
        return this.data.disk;
    }
    
    getCpuStats() {
        return this.data.cpu;
    }
}

// ============================================================================
// EXPORT
// ============================================================================

if (typeof module !== 'undefined' && module.exports) {
    module.exports = SystemModel;
}

if (typeof window !== 'undefined') {
    window.SystemModel = SystemModel;
}