// ============================================================================
// Fichier: frontend/js/views/HomeView.js
// Chemin réel: frontend/js/views/HomeView.js
// Version: v4.2.0 - CORRIGÉ COMPLET (ENCODAGE + MÉTHODES)
// Date: 2025-11-06
// ============================================================================
// CORRECTIONS v4.2.0:
// ✅ CRITIQUE: Encodage UTF-8 propre (tous les caractères corrompus corrigés)
// ✅ Ajout de toutes les méthodes appelées par HomeController
// ✅ Harmonisation des noms d'événements
// ✅ Cohérence complète avec BaseView et HomeController
// ============================================================================

class HomeView extends BaseView {
    constructor(containerId, eventBus) {
        // ✅ Appel super() pour hériter de BaseView
        super(containerId, eventBus);
        
        // ✅ this.container et this.eventBus déjà initialisés par BaseView
        this.logger = window.logger || console;
        
        // État
        this.state = {
            mode: 'files', // 'files' ou 'playlists'
            currentFile: null,
            currentPlaylist: null,
            files: [],
            playlists: [],
            devices: [],
            playbackStatus: {
                state: 'stopped',
                position: 0,
                duration: 0,
                file: null
            },
            allMuted: false,
            stats: {
                totalFiles: 0,
                totalDuration: 0,
                totalSize: 0
            }
        };
        
        // Visualizer
        this.visualizerCanvas = null;
        this.visualizerContext = null;
        this.visualizerAnimationId = null;
        this.activeNotes = new Map(); // note -> {channel, velocity, time}
        
        // Éléments DOM
        this.elements = {};
    }

    // ========================================================================
    // INITIALISATION
    // ========================================================================

    init() {
        if (!this.container) {
            this.logger.error('[HomeView] Cannot initialize: container not found');
            return;
        }
        
        this.render();
        this.cacheElements();
        this.attachEvents();
        this.initVisualizer();
        
        // Charger les données initiales via API
        this.loadFiles();
        this.loadPlaylists();
        this.loadDevices();
        
        this.logger.info('[HomeView] Initialized v4.2.0');
    }

    render() {
        if (!this.container) return;
        
        this.container.innerHTML = `
            <div class="home-layout">
                
                <!-- Sélection fichiers/playlists -->
                <div class="home-selector">
                    <div class="selector-tabs">
                        <button class="selector-tab active" data-mode="files">Fichiers MIDI</button>
                        <button class="selector-tab" data-mode="playlists">Playlists</button>
                    </div>
                    
                    <div class="selector-content">
                        <!-- Liste des fichiers -->
                        <div class="files-list" id="homeFilesList">
                            ${this.renderEmptyState('files')}
                        </div>
                        
                        <!-- Liste des playlists -->
                        <div class="playlists-list" id="homePlaylistsList" style="display: none;">
                            ${this.renderEmptyState('playlists')}
                        </div>
                    </div>
                </div>
                
                <!-- Visualizer avec barre instruments -->
                <div class="home-visualizer">
                    <!-- Barre instruments -->
                    <div class="instruments-bar">
                        <div class="instruments-title">
                            <span class="icon">🎸</span>
                            <span class="label">Devices connectés</span>
                        </div>
                        <div class="instruments-list" id="homeActiveDevices">
                            <!-- Généré dynamiquement -->
                        </div>
                        <div class="instruments-actions">
                            <button class="btn-mute-all" id="homeBtnMuteAll" title="Mute/Unmute tous les canaux">
                                <span class="mute-icon">🔇</span>
                                <span class="mute-label">Mute All</span>
                            </button>
                        </div>
                    </div>
                    
                    <!-- Canvas visualizer -->
                    <div class="visualizer-container">
                        <canvas id="homeVisualizerCanvas" class="visualizer-canvas"></canvas>
                        <div class="visualizer-info" id="homeVisualizerInfo">
                            <span class="note-count">0 notes actives</span>
                            <span class="active-channels">0 canaux</span>
                        </div>
                    </div>
                    
                    <!-- Statistiques -->
                    <div class="home-stats" id="homeStats">
                        <div class="stat-item">
                            <span class="stat-label">Fichiers</span>
                            <span class="stat-value" data-stat="files">0</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">Durée totale</span>
                            <span class="stat-value" data-stat="duration">0:00</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">Taille</span>
                            <span class="stat-value" data-stat="size">0 MB</span>
                        </div>
                    </div>
                    
                    <!-- Barre de progression -->
                    <div class="home-progress-bar" id="homeProgressBar" style="display: none;">
                        <div class="progress-fill" id="homeProgressFill"></div>
                        <div class="progress-time" id="homeProgressTime">0:00 / 0:00</div>
                    </div>
                    
                    <!-- Aperçu des notes à venir -->
                    <div class="home-note-preview" id="homeNotePreview" style="display: none;">
                        <!-- Généré dynamiquement -->
                    </div>
                </div>
            </div>
        `;
    }

    cacheElements() {
        this.elements = {
            // Tabs
            tabFiles: this.container.querySelector('[data-mode="files"]'),
            tabPlaylists: this.container.querySelector('[data-mode="playlists"]'),
            
            // Listes
            filesList: document.getElementById('homeFilesList'),
            playlistsList: document.getElementById('homePlaylistsList'),
            
            // Devices
            devicesList: document.getElementById('homeActiveDevices'),
            btnMuteAll: document.getElementById('homeBtnMuteAll'),
            
            // Visualizer
            visualizerCanvas: document.getElementById('homeVisualizerCanvas'),
            visualizerInfo: document.getElementById('homeVisualizerInfo'),
            
            // Stats
            stats: document.getElementById('homeStats'),
            statFiles: document.querySelector('[data-stat="files"]'),
            statDuration: document.querySelector('[data-stat="duration"]'),
            statSize: document.querySelector('[data-stat="size"]'),
            
            // Progress
            progressBar: document.getElementById('homeProgressBar'),
            progressFill: document.getElementById('homeProgressFill'),
            progressTime: document.getElementById('homeProgressTime'),
            
            // Note preview
            notePreview: document.getElementById('homeNotePreview')
        };
    }

    attachEvents() {
        // Tabs
        if (this.elements.tabFiles) {
            this.elements.tabFiles.addEventListener('click', () => this.switchMode('files'));
        }
        if (this.elements.tabPlaylists) {
            this.elements.tabPlaylists.addEventListener('click', () => this.switchMode('playlists'));
        }
        
        // Mute global
        if (this.elements.btnMuteAll) {
            this.elements.btnMuteAll.addEventListener('click', () => this.toggleMuteAll());
        }
        
        // Délégation d'événements pour les listes
        if (this.elements.filesList) {
            this.elements.filesList.addEventListener('click', (e) => this.handleFileClick(e));
        }
        if (this.elements.playlistsList) {
            this.elements.playlistsList.addEventListener('click', (e) => this.handlePlaylistClick(e));
        }
        
        // EventBus
        this.setupEventBusListeners();
    }

    setupEventBusListeners() {
        if (!this.eventBus) return;
        
        // Fichiers
        this.eventBus.on('file:list:updated', (data) => {
            this.state.files = data.files || [];
            this.renderFilesList();
        });
        
        this.eventBus.on('files:loaded', (data) => {
            this.state.files = data.files || [];
            this.renderFilesList();
        });
        
        this.eventBus.on('file:selected', (data) => {
            this.state.currentFile = data.file;
            this.updateFileSelection();
        });
        
        // Playlists
        this.eventBus.on('playlist:list:updated', (data) => {
            this.state.playlists = data.playlists || [];
            this.renderPlaylistsList();
        });
        
        this.eventBus.on('playlists:loaded', (data) => {
            this.state.playlists = data.playlists || [];
            this.renderPlaylistsList();
        });
        
        this.eventBus.on('playlist:selected', (data) => {
            this.state.currentPlaylist = data.playlist;
            this.updatePlaylistSelection();
        });
        
        // Devices
        this.eventBus.on('devices:updated', (data) => {
            this.state.devices = data.devices || [];
            this.renderDevicesList();
        });
        
        this.eventBus.on('devices:loaded', (data) => {
            this.state.devices = data.devices || [];
            this.renderDevicesList();
        });
        
        this.eventBus.on('device:connected', (data) => {
            this.handleDeviceConnected(data);
        });
        
        this.eventBus.on('device:disconnected', (data) => {
            this.handleDeviceDisconnected(data);
        });
        
        // Playback
        this.eventBus.on('playback:state', (data) => {
            this.state.playbackStatus.state = data.state;
            this.updatePlaybackState();
        });
        
        this.eventBus.on('playback:progress', (data) => {
            this.state.playbackStatus.position = data.position;
            this.state.playbackStatus.duration = data.duration;
        });
        
        // MIDI events pour visualizer
        this.eventBus.on('midi:note_on', (data) => {
            this.visualizeNoteOn(data);
        });
        
        this.eventBus.on('midi:note_off', (data) => {
            this.visualizeNoteOff(data);
        });
        
        this.eventBus.on('midi:cc', (data) => {
            // Gérer les contrôles si nécessaire
        });
    }

    // ========================================================================
    // NAVIGATION TABS
    // ========================================================================

    switchMode(mode) {
        if (this.state.mode === mode) return;
        
        this.state.mode = mode;
        
        // Update tabs
        const tabs = this.container.querySelectorAll('.selector-tab');
        tabs.forEach(tab => {
            const isActive = tab.dataset.mode === mode;
            tab.classList.toggle('active', isActive);
        });
        
        // Toggle lists
        if (this.elements.filesList) {
            this.elements.filesList.style.display = mode === 'files' ? 'block' : 'none';
        }
        if (this.elements.playlistsList) {
            this.elements.playlistsList.style.display = mode === 'playlists' ? 'block' : 'none';
        }
        
        // Emit event
        if (this.eventBus) {
            this.eventBus.emit('home:mode_changed', { mode });
        }
    }

    // ========================================================================
    // RENDERING - STATES
    // ========================================================================

    renderEmptyState(type) {
        const messages = {
            files: {
                icon: '📁',
                title: 'Aucun fichier MIDI',
                subtitle: 'Chargez des fichiers MIDI pour commencer'
            },
            playlists: {
                icon: '🎵',
                title: 'Aucune playlist',
                subtitle: 'Créez une playlist pour organiser vos fichiers'
            }
        };
        
        const msg = messages[type] || messages.files;
        
        return `
            <div class="empty-state">
                <div class="empty-icon">${msg.icon}</div>
                <p class="empty-title">${msg.title}</p>
                <p class="empty-subtitle">${msg.subtitle}</p>
            </div>
        `;
    }

    // ========================================================================
    // RENDERING - FICHIERS
    // ========================================================================

    renderFilesList() {
        if (!this.elements.filesList) return;
        
        const files = this.state.files;
        
        if (files.length === 0) {
            this.elements.filesList.innerHTML = this.renderEmptyState('files');
            return;
        }
        
        const html = files.map(file => this.renderFileItem(file)).join('');
        this.elements.filesList.innerHTML = `<div class="files-grid">${html}</div>`;
    }

    renderFileItem(file) {
        const isActive = this.state.currentFile && 
                        (this.state.currentFile.path === file.path || 
                         this.state.currentFile.name === file.name);
        
        const duration = file.duration ? this.formatDuration(file.duration) : '—';
        const size = file.size ? this.formatFileSize(file.size) : '—';
        
        return `
            <div class="file-item ${isActive ? 'active' : ''}" 
                 data-file-path="${file.path || file.name}">
                <div class="file-icon">🎵</div>
                <div class="file-info">
                    <div class="file-name">${file.name}</div>
                    <div class="file-meta">
                        <span>${duration}</span>
                        <span>•</span>
                        <span>${size}</span>
                    </div>
                </div>
                <div class="file-actions">
                    <button class="btn-play" data-action="play-file" title="Lire">▶</button>
                    <button class="btn-load" data-action="load-file" title="Charger">📂</button>
                </div>
            </div>
        `;
    }

    // ✅ NOUVEAU: Méthode appelée par HomeController
    updateFileList(files) {
        this.state.files = files || [];
        this.renderFilesList();
    }

    // ========================================================================
    // RENDERING - PLAYLISTS
    // ========================================================================

    renderPlaylistsList() {
        if (!this.elements.playlistsList) return;
        
        const playlists = this.state.playlists;
        
        if (playlists.length === 0) {
            this.elements.playlistsList.innerHTML = this.renderEmptyState('playlists');
            return;
        }
        
        const html = playlists.map(playlist => this.renderPlaylistItem(playlist)).join('');
        this.elements.playlistsList.innerHTML = `<div class="playlists-grid">${html}</div>`;
    }

    renderPlaylistItem(playlist) {
        const isActive = this.state.currentPlaylist && 
                        this.state.currentPlaylist.id === playlist.id;
        
        const itemCount = playlist.items ? playlist.items.length : 0;
        const duration = playlist.total_duration ? this.formatDuration(playlist.total_duration) : '—';
        
        return `
            <div class="playlist-item ${isActive ? 'active' : ''}" 
                 data-playlist-id="${playlist.id}">
                <div class="playlist-icon">📋</div>
                <div class="playlist-info">
                    <div class="playlist-name">${playlist.name}</div>
                    <div class="playlist-meta">
                        <span>${itemCount} morceaux</span>
                        <span>•</span>
                        <span>${duration}</span>
                    </div>
                </div>
                <div class="playlist-actions">
                    <button class="btn-play" data-action="play-playlist" title="Lire">▶</button>
                    <button class="btn-load" data-action="load-playlist" title="Charger">📂</button>
                </div>
            </div>
        `;
    }

    // ✅ NOUVEAU: Méthode appelée par HomeController
    updatePlaylistList(playlists) {
        this.state.playlists = playlists || [];
        this.renderPlaylistsList();
    }

    // ========================================================================
    // RENDERING - DEVICES
    // ========================================================================

    renderDevicesList() {
        if (!this.elements.devicesList) return;
        
        const devices = this.state.devices.filter(d => d.status === 2); // Connected only
        
        if (devices.length === 0) {
            this.elements.devicesList.innerHTML = `
                <div class="devices-empty">Aucun device connecté</div>
            `;
            return;
        }
        
        const html = devices.map(device => this.renderDeviceItem(device)).join('');
        this.elements.devicesList.innerHTML = html;
    }

    renderDeviceItem(device) {
        const typeIcons = {
            0: '❓', // Unknown
            1: '🔌', // USB
            2: '📡', // BLE
            3: '💻'  // Virtual
        };
        
        const icon = typeIcons[device.type] || '🎸';
        
        return `
            <div class="device-chip" data-device-id="${device.id}">
                <span class="device-icon">${icon}</span>
                <span class="device-name">${device.name}</span>
                <span class="device-status connected"></span>
            </div>
        `;
    }

    // ✅ NOUVEAU: Méthode appelée par HomeController
    updateDevicesList(devices) {
        this.state.devices = devices || [];
        this.renderDevicesList();
    }

    // ========================================================================
    // STATISTIQUES
    // ========================================================================

    // ✅ NOUVEAU: Méthode appelée par HomeController
    updateStats(stats) {
        if (!stats) return;
        
        this.state.stats = {
            ...this.state.stats,
            ...stats
        };
        
        // Mettre à jour l'affichage
        if (this.elements.statFiles) {
            this.elements.statFiles.textContent = stats.totalFiles || 0;
        }
        
        if (this.elements.statDuration && stats.totalDuration) {
            this.elements.statDuration.textContent = this.formatDuration(stats.totalDuration);
        }
        
        if (this.elements.statSize && stats.totalSize) {
            this.elements.statSize.textContent = this.formatFileSize(stats.totalSize);
        }
    }

    // ========================================================================
    // PROGRESSION
    // ========================================================================

    // ✅ NOUVEAU: Méthode appelée par HomeController
    updateProgress(currentTime, duration) {
        if (!this.elements.progressBar || !this.elements.progressFill || !this.elements.progressTime) {
            return;
        }
        
        // Afficher la barre
        this.elements.progressBar.style.display = 'block';
        
        // Calculer le pourcentage
        const percent = duration > 0 ? (currentTime / duration) * 100 : 0;
        this.elements.progressFill.style.width = `${percent}%`;
        
        // Mettre à jour le temps
        const current = this.formatDuration(currentTime / 1000);
        const total = this.formatDuration(duration / 1000);
        this.elements.progressTime.textContent = `${current} / ${total}`;
    }

    // ✅ NOUVEAU: Méthode appelée par HomeController
    hideProgress() {
        if (this.elements.progressBar) {
            this.elements.progressBar.style.display = 'none';
        }
    }

    // ========================================================================
    // APERÇU DES NOTES
    // ========================================================================

    // ✅ NOUVEAU: Méthode appelée par HomeController
    updateNotePreview(notes) {
        if (!this.elements.notePreview || !notes || notes.length === 0) {
            if (this.elements.notePreview) {
                this.elements.notePreview.style.display = 'none';
            }
            return;
        }
        
        this.elements.notePreview.style.display = 'block';
        
        const html = notes.slice(0, 5).map(note => `
            <div class="note-preview-item">
                <span class="note-name">${this.getMidiNoteName(note.note)}</span>
                <span class="note-time">+${(note.time / 1000).toFixed(1)}s</span>
            </div>
        `).join('');
        
        this.elements.notePreview.innerHTML = `
            <div class="note-preview-title">Notes à venir</div>
            <div class="note-preview-list">${html}</div>
        `;
    }

    getMidiNoteName(noteNumber) {
        const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        const octave = Math.floor(noteNumber / 12) - 1;
        const noteName = notes[noteNumber % 12];
        return `${noteName}${octave}`;
    }

    // ========================================================================
    // ROUTING DISPLAY
    // ========================================================================

    // ✅ NOUVEAU: Méthode appelée par HomeController
    updateRoutingDisplay(routes) {
        // Cette vue Home ne montre pas les détails du routing
        // Mais on peut logger ou afficher un indicateur
        if (routes && routes.length > 0) {
            this.logger.info(`[HomeView] ${routes.length} routes actives`);
        }
    }

    // ========================================================================
    // INTERACTION - FICHIERS
    // ========================================================================

    handleFileClick(e) {
        const fileItem = e.target.closest('.file-item');
        if (!fileItem) return;
        
        const action = e.target.closest('[data-action]')?.dataset.action;
        const filePath = fileItem.dataset.filePath;
        const file = this.state.files.find(f => f.path === filePath || f.name === filePath);
        
        if (!file) return;
        
        switch (action) {
            case 'play-file':
                this.playFile(file);
                break;
            case 'load-file':
                this.loadFile(file);
                break;
            default:
                this.selectFile(file);
                break;
        }
    }

    selectFile(file) {
        this.state.currentFile = file;
        this.state.currentPlaylist = null;
        this.updateFileSelection();
        
        if (this.eventBus) {
            this.eventBus.emit('home:file_selected', { file });
        }
    }

    async playFile(file) {
        if (!this.eventBus) return;
        
        try {
            this.eventBus.emit('home:play_file_requested', { 
                file_path: file.path || file.name 
            });
        } catch (error) {
            this.logger.error('[HomeView] Play file error:', error);
        }
    }

    async loadFile(file) {
        if (!this.eventBus) return;
        
        try {
            this.eventBus.emit('home:load_file_requested', { 
                file_path: file.path || file.name 
            });
        } catch (error) {
            this.logger.error('[HomeView] Load file error:', error);
        }
    }

    updateFileSelection() {
        const items = this.elements.filesList?.querySelectorAll('.file-item');
        if (!items) return;
        
        items.forEach(item => {
            const filePath = item.dataset.filePath;
            const isActive = this.state.currentFile && 
                           (this.state.currentFile.path === filePath || 
                            this.state.currentFile.name === filePath);
            item.classList.toggle('active', isActive);
        });
    }

    // ========================================================================
    // INTERACTION - PLAYLISTS
    // ========================================================================

    handlePlaylistClick(e) {
        const playlistItem = e.target.closest('.playlist-item');
        if (!playlistItem) return;
        
        const action = e.target.closest('[data-action]')?.dataset.action;
        const playlistId = playlistItem.dataset.playlistId;
        const playlist = this.state.playlists.find(p => p.id === playlistId);
        
        if (!playlist) return;
        
        switch (action) {
            case 'play-playlist':
                this.playPlaylist(playlist);
                break;
            case 'load-playlist':
                this.loadPlaylist(playlist);
                break;
            default:
                this.selectPlaylist(playlist);
                break;
        }
    }

    selectPlaylist(playlist) {
        this.state.currentPlaylist = playlist;
        this.state.currentFile = null;
        this.updatePlaylistSelection();
        
        if (this.eventBus) {
            this.eventBus.emit('home:playlist_selected', { playlist });
        }
    }

    async playPlaylist(playlist) {
        if (!this.eventBus) return;
        
        try {
            this.eventBus.emit('home:play_playlist_requested', { 
                playlist_id: playlist.id 
            });
        } catch (error) {
            this.logger.error('[HomeView] Play playlist error:', error);
        }
    }

    async loadPlaylist(playlist) {
        if (!this.eventBus) return;
        
        try {
            this.eventBus.emit('home:load_playlist_requested', { 
                playlist_id: playlist.id 
            });
        } catch (error) {
            this.logger.error('[HomeView] Load playlist error:', error);
        }
    }

    updatePlaylistSelection() {
        const items = this.elements.playlistsList?.querySelectorAll('.playlist-item');
        if (!items) return;
        
        items.forEach(item => {
            const isActive = this.state.currentPlaylist && 
                           item.dataset.playlistId === this.state.currentPlaylist.id;
            item.classList.toggle('active', isActive);
        });
    }

    // ========================================================================
    // DEVICES - HANDLERS
    // ========================================================================

    handleDeviceConnected(data) {
        // Mise à jour de la liste des devices
        this.loadDevices();
        
        if (this.logger) {
            this.logger.info(`[HomeView] Device connected: ${data.device_id}`);
        }
    }

    handleDeviceDisconnected(data) {
        // Mise à jour de la liste des devices
        this.loadDevices();
        
        if (this.logger) {
            this.logger.info(`[HomeView] Device disconnected: ${data.device_id}`);
        }
    }

    // ========================================================================
    // MUTE GLOBAL
    // ========================================================================

    toggleMuteAll() {
        this.state.allMuted = !this.state.allMuted;
        
        // Update button appearance
        if (this.elements.btnMuteAll) {
            this.elements.btnMuteAll.classList.toggle('muted', this.state.allMuted);
            const icon = this.elements.btnMuteAll.querySelector('.mute-icon');
            const label = this.elements.btnMuteAll.querySelector('.mute-label');
            if (icon) icon.textContent = this.state.allMuted ? '🔊' : '🔇';
            if (label) label.textContent = this.state.allMuted ? 'Unmute All' : 'Mute All';
        }
        
        // Émettre événement
        if (this.eventBus) {
            this.eventBus.emit('home:mute_all_toggled', { muted: this.state.allMuted });
        }
    }

    // ========================================================================
    // VISUALIZER
    // ========================================================================

    initVisualizer() {
        this.visualizerCanvas = this.elements.visualizerCanvas;
        if (!this.visualizerCanvas) return;
        
        this.visualizerContext = this.visualizerCanvas.getContext('2d');
        
        // Resize canvas
        this.resizeVisualizer();
        window.addEventListener('resize', () => this.resizeVisualizer());
        
        // Start animation loop
        this.startVisualizerLoop();
    }

    resizeVisualizer() {
        if (!this.visualizerCanvas) return;
        
        const container = this.visualizerCanvas.parentElement;
        if (!container) return;
        
        this.visualizerCanvas.width = container.clientWidth;
        this.visualizerCanvas.height = container.clientHeight;
    }

    startVisualizerLoop() {
        const animate = () => {
            this.renderVisualizer();
            this.visualizerAnimationId = requestAnimationFrame(animate);
        };
        animate();
    }

    renderVisualizer() {
        if (!this.visualizerContext || !this.visualizerCanvas) return;
        
        const ctx = this.visualizerContext;
        const width = this.visualizerCanvas.width;
        const height = this.visualizerCanvas.height;
        
        // Clear with gradient
        const gradient = ctx.createLinearGradient(0, 0, width, height);
        gradient.addColorStop(0, 'rgba(26, 26, 46, 0.9)');
        gradient.addColorStop(1, 'rgba(22, 33, 62, 0.9)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);
        
        // Dessiner les notes actives
        this.drawActiveNotes(ctx, width, height);
        
        // Mise à jour des infos
        this.updateVisualizerInfo();
    }

    drawActiveNotes(ctx, width, height) {
        if (this.activeNotes.size === 0) return;
        
        const now = Date.now();
        const noteHeight = height / 128; // 128 notes MIDI
        
        this.activeNotes.forEach((noteData, note) => {
            const age = now - noteData.time;
            const alpha = Math.max(0, 1 - age / 2000); // Fade over 2 seconds
            
            if (alpha <= 0) {
                this.activeNotes.delete(note);
                return;
            }
            
            // Couleur par canal
            const hue = (noteData.channel * 30) % 360;
            ctx.fillStyle = `hsla(${hue}, 70%, 60%, ${alpha})`;
            
            // Dessiner la note
            const y = (127 - note) * noteHeight;
            const barWidth = (noteData.velocity / 127) * (width * 0.8);
            ctx.fillRect(width * 0.1, y, barWidth, noteHeight);
        });
    }

    visualizeNoteOn(data) {
        // data: {note, velocity, channel, timestamp}
        this.activeNotes.set(data.note, {
            channel: data.channel || 0,
            velocity: data.velocity || 64,
            time: Date.now()
        });
    }

    visualizeNoteOff(data) {
        // Laisser la note fade out naturellement
        // ou supprimer immédiatement si souhaité
        // this.activeNotes.delete(data.note);
    }

    updateVisualizerInfo() {
        if (!this.elements.visualizerInfo) return;
        
        const noteCount = this.activeNotes.size;
        const channels = new Set(
            Array.from(this.activeNotes.values()).map(n => n.channel)
        );
        
        const noteCountSpan = this.elements.visualizerInfo.querySelector('.note-count');
        const channelCountSpan = this.elements.visualizerInfo.querySelector('.active-channels');
        
        if (noteCountSpan) {
            noteCountSpan.textContent = `${noteCount} notes actives`;
        }
        if (channelCountSpan) {
            channelCountSpan.textContent = `${channels.size} canaux`;
        }
    }

    // ========================================================================
    // PLAYBACK STATE
    // ========================================================================

    updatePlaybackState() {
        // Mise à jour visuelle de l'état de lecture si nécessaire
        const state = this.state.playbackStatus.state;
        
        if (state === 'stopped') {
            this.hideProgress();
        }
    }

    // ========================================================================
    // CHARGEMENT DES DONNÉES (API CALLS VIA EVENTBUS)
    // ========================================================================

    loadFiles() {
        if (this.eventBus) {
            // Le controller devra appeler files.list via API
            this.eventBus.emit('home:request_files', { path: '/midi' });
        }
    }

    loadPlaylists() {
        if (this.eventBus) {
            // Le controller devra appeler playlist.list via API
            this.eventBus.emit('home:request_playlists');
        }
    }

    loadDevices() {
        if (this.eventBus) {
            // Le controller devra appeler devices.list via API
            this.eventBus.emit('home:request_devices');
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

    formatFileSize(bytes) {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    }

    // ========================================================================
    // CLEANUP
    // ========================================================================

    destroy() {
        // Stop visualizer animation
        if (this.visualizerAnimationId) {
            cancelAnimationFrame(this.visualizerAnimationId);
            this.visualizerAnimationId = null;
        }
        
        // Clear active notes
        this.activeNotes.clear();
        
        // Remove event listeners
        if (this.eventBus) {
            this.eventBus.off('file:list:updated');
            this.eventBus.off('files:loaded');
            this.eventBus.off('file:selected');
            this.eventBus.off('playlist:list:updated');
            this.eventBus.off('playlists:loaded');
            this.eventBus.off('playlist:selected');
            this.eventBus.off('devices:updated');
            this.eventBus.off('devices:loaded');
            this.eventBus.off('device:connected');
            this.eventBus.off('device:disconnected');
            this.eventBus.off('playback:state');
            this.eventBus.off('playback:progress');
            this.eventBus.off('midi:note_on');
            this.eventBus.off('midi:note_off');
        }
        
        this.logger.info('[HomeView] Destroyed');
    }
}

// ============================================================================
// EXPORT
// ============================================================================

if (typeof module !== 'undefined' && module.exports) {
    module.exports = HomeView;
}

if (typeof window !== 'undefined') {
    window.HomeView = HomeView;
}

// ============================================================================
// FIN - HomeView.js v4.2.0
// ============================================================================