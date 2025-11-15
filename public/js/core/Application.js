// ============================================================================
// Fichier: frontend/js/core/Application.js
// Chemin rÃƒÂ©el: frontend/js/core/Application.js
// Version: v4.5.0 - FIX NAVIGATION INIT ORDER
// Date: 2025-11-11
// ============================================================================
// CORRECTIONS v4.1.0:
// Ã¢Å“â€œ CRITIQUE: Passer 5 paramÃƒÂ¨tres aux modÃƒÂ¨les (eventBus, backend, logger, initialData, options)
// Ã¢Å“â€œ Fix: StateModel, FileModel, PlaylistModel, InstrumentModel, SystemModel, PlaybackModel, EditorModel, RoutingModel
// Ã¢Å“â€œ Tous les modÃƒÂ¨les reÃƒÂ§oivent maintenant backend et logger correctement
//
// CORRECTIONS v4.0.0:
// Ã¢Å“Â¦ CRITIQUE: Initialisation correcte de NavigationController AVANT Router
// Ã¢Å“Â¦ CRITIQUE: Connexion Router <-> NavigationController simplifiÃƒÂ©e
// Ã¢Å“Â¦ CRITIQUE: StartRouting() appelÃƒÂ©e APRÃƒË†S l'enregistrement des routes
// Ã¢Å“Â¦ Fix: Toutes les pages fonctionnent correctement
// ============================================================================

class Application {
    constructor() {
        // Ãƒâ€°tat de l'application
        this.state = {
            initialized: false,
            ready: false,
            currentPage: 'home',
            backendConnected: false,
            offlineMode: false,
            reconnectAttempts: 0
        };
        
        // Composants de l'application
        this.eventBus = null;
        this.logger = null;
        this.debugConsole = null;
        this.notifications = null;
        this.router = null;
        
        // Services
        this.services = {
            backend: null,
            storage: null,
            midi: null,
            file: null,
            fileRouting: null  // âœ… NOUVEAU: Service de routage par fichier
        };
        
        // ModÃƒÂ¨les
        this.models = {
            state: null,
            file: null,
            playlist: null,
            instrument: null,
            system: null,
            playback: null,
            editor: null,
            routing: null
        };
        
        // Vues
        this.views = {
            home: null,
            file: null,
            instrument: null,
            keyboard: null,
            system: null,
            routing: null,
            editor: null,
            playlist: null,
            visualizer: null
        };
        
        // ContrÃƒÂ´leurs
        this.controllers = {
            navigation: null,
            file: null,
            playlist: null,
            instrument: null,
            keyboard: null,
            playback: null,
            globalPlayback: null,
            system: null,
            home: null,
            routing: null,
            editor: null,
            visualizer: null
        };
        
        // Configuration
        this.config = {
            backendUrl: (typeof AppConfig !== 'undefined' && AppConfig.backend) ? AppConfig.backend.url : 'ws://localhost:8080',
            autoReconnect: true,
            reconnectInterval: 5000,
            maxReconnectAttempts: 10,
            logLevel: 'info',
            enableDebugConsole: true,
            offlineMode: {
                enabled: true,
                showNotification: true,
                allowLocalOperations: true
            }
        };
        
        // RÃƒÂ©fÃƒÂ©rence globale
        window.app = this;
    }
    
    // ========================================================================
    // INITIALISATION
    // ========================================================================
    
    /**
     * Initialise l'application complÃƒÂ¨te
     */
    async init() {
        console.log('Ã°Å¸Å¡â‚¬ Initializing MidiMind v3.1...');
        
        try {
            // Ãƒâ€°tape 1: Fondations
            await this.initFoundations();
            
            // Ãƒâ€°tape 2: Services
            await this.initServices();
            
            // Ãƒâ€°tape 3: ModÃƒÂ¨les
            await this.initModels();
            
            // Ãƒâ€°tape 4: Vues
            await this.initViews();
            
            // Ãƒâ€°tape 5: ContrÃƒÂ´leurs
            await this.initControllers();
            
            // Ãƒâ€°tape 6: Navigation & Router
            await this.initNavigation();
            
            // Ãƒâ€°tape 7: Connexion backend (non-bloquant)
            this.connectBackend().catch(err => {
                this.log('warn', 'Backend connection failed, continuing in offline mode', err);
            });
            
            // Ãƒâ€°tape 8: Finalisation
            await this.finalize();
            
            this.state.initialized = true;
            this.state.ready = true;
            
            console.log('Ã¢Å“â€œ MidiMind v3.1 initialized successfully');
            this.log('info', 'Ã¢Å“â€œ Application ready');
            
            // Ãƒâ€°mettre ÃƒÂ©vÃƒÂ©nement ready
            if (this.eventBus) {
                this.eventBus.emit('app:ready');
            }
            
        } catch (error) {
            console.error('Ã¢Å“â€” Failed to initialize application:', error);
            this.log('error', 'Initialization failed', error);
            this.handleInitError(error);
        }
    }
    
    /**
     * Initialise les composants de base
     */
    async initFoundations() {
        console.log('Ã°Å¸â€Â§ Initializing foundations...');
        
        // EventBus
        this.eventBus = window.eventBus || new EventBus();
        window.eventBus = this.eventBus;
        
        // Logger avec fallback robuste
        this.logger = this.createLogger();
        window.logger = this.logger;
        
        // DebugConsole
        if (this.config.enableDebugConsole && window.DebugConsole) {
            try {
                this.debugConsole = new DebugConsole(this.eventBus, this.logger);
                window.debugConsole = this.debugConsole;
            } catch (e) {
                console.warn('DebugConsole initialization failed:', e);
            }
        }
        
        // NotificationManager
        if (window.NotificationManager) {
            try {
                this.notifications = new NotificationManager();
                window.notificationManager = this.notifications;
            } catch (e) {
                console.warn('NotificationManager initialization failed:', e);
            }
        } else if (window.Notifications) {
            try {
                this.notifications = new Notifications(this.eventBus);
                window.notifications = this.notifications;
            } catch (e) {
                console.warn('Notifications initialization failed:', e);
            }
        }
        
        this.log('info', 'Ã¢Å“â€œ Foundations initialized');
    }
    
    /**
     * CrÃƒÂ©e un logger robuste avec fallback
     */
    createLogger() {
        if (window.Logger) {
            try {
                return new Logger({
                    level: this.config.logLevel,
                    eventBus: this.eventBus,
                    enableConsole: true,
                    enableEventBus: true
                });
            } catch (e) {
                console.warn('Logger initialization failed, using fallback');
            }
        }
        
        // Fallback logger
        return {
            log: (...args) => console.log(...args),
            info: (...args) => console.info(...args),
            warn: (...args) => console.warn(...args),
            error: (...args) => console.error(...args),
            debug: (...args) => console.debug(...args)
        };
    }
    
    /**
     * Log helper
     */
    log(level, ...args) {
        if (this.logger) {
            this.logger[level](...args);
        } else {
            console[level](...args);
        }
    }
    
    /**
     * Initialise les services
     */
    async initServices() {
        console.log('Ã°Å¸â€Å’ Initializing services...');
        
        // BackendService
        if (window.BackendService) {
            this.services.backend = new BackendService(
                this.config.backendUrl,
                this.eventBus,
                this.logger
            );
            window.backendService = this.services.backend;
        }
        
        // StorageService
        if (window.StorageService) {
            this.services.storage = new StorageService(this.eventBus);
            window.storageService = this.services.storage;
        }
        
        // MidiService
        if (window.MidiService) {
            this.services.midi = new MidiService(this.eventBus, this.logger);
            window.midiService = this.services.midi;
        }
        
        // FileService
        if (window.FileService) {
            this.services.file = new FileService(this.services.backend, this.eventBus, this.logger);
            window.fileService = this.services.file;
        }

        // âœ… NOUVEAU: FileRoutingService
        if (window.FileRoutingService) {
            this.services.fileRouting = new FileRoutingService(this.eventBus);
            window.fileRoutingService = this.services.fileRouting;
            this.log('info', 'Ã¢Å"â€œ FileRoutingService initialized');
        }

        this.log('info', 'Ã¢Å"â€œ Services initialized');
    }
    
    /**
     * Initialise les modÃƒÂ¨les
     * Ã¢Å“â€œ v4.1.0: CORRECTION - Passer les 5 paramÃƒÂ¨tres requis par BaseModel
     */
    async initModels() {
        console.log('Ã°Å¸â€œÂ¦ Initializing models...');
        
        // StateModel
        // Ã¢Å“â€œ NOUVEAU: Passer 5 paramÃƒÂ¨tres (eventBus, backend, logger, initialData, options)
        if (window.StateModel) {
            this.models.state = new StateModel(
                this.eventBus,
                this.services.backend,
                this.logger,
                {},  // initialData
                {}   // options
            );
            window.stateModel = this.models.state;
        }
        
        // FileModel
        if (window.FileModel) {
            this.models.file = new FileModel(
                this.eventBus,
                this.services.backend,
                this.logger,
                {},
                {}
            );
            window.fileModel = this.models.file;
        }
        
        // PlaylistModel
        if (window.PlaylistModel) {
            this.models.playlist = new PlaylistModel(
                this.eventBus,
                this.services.backend,
                this.logger,
                {},
                {}
            );
            window.playlistModel = this.models.playlist;
        }
        
        // InstrumentModel
        if (window.InstrumentModel) {
            this.models.instrument = new InstrumentModel(
                this.eventBus,
                this.services.backend,
                this.logger,
                {},
                {}
            );
            window.instrumentModel = this.models.instrument;
        }
        
        // SystemModel
        if (window.SystemModel) {
            this.models.system = new SystemModel(
                this.eventBus,
                this.services.backend,
                this.logger,
                {},
                {}
            );
            window.systemModel = this.models.system;
        }
        
        // PlaybackModel
        if (window.PlaybackModel) {
            this.models.playback = new PlaybackModel(
                this.eventBus,
                this.services.backend,
                this.logger,
                {},
                {}
            );
            window.playbackModel = this.models.playback;
        }
        
        // EditorModel
        if (window.EditorModel) {
            this.models.editor = new EditorModel(
                this.eventBus,
                this.services.backend,
                this.logger,
                {},
                {}
            );
            window.editorModel = this.models.editor;
        }
        
        // RoutingModel
        if (window.RoutingModel) {
            this.models.routing = new RoutingModel(
                this.eventBus,
                this.services.backend,
                this.logger,
                {},
                {}
            );
            window.routingModel = this.models.routing;
        }
        
        this.log('info', 'Ã¢Å“â€œ Models initialized');
    }
    
    /**
     * Initialise les vues
     */
    async initViews() {
        console.log('Ã°Å¸Å½Â¨ Initializing views...');
        
        // HomeView
        if (window.HomeView) {
            this.views.home = new HomeView('home-view', this.eventBus);
            window.homeView = this.views.home;
        }
        
        // FileView
        if (window.FileView) {
            this.views.file = new FileView('file-view', this.eventBus);
            window.fileView = this.views.file;
        }
        
        // InstrumentView
        if (window.InstrumentView) {
            this.views.instrument = new InstrumentView('instrument-view', this.eventBus);
            window.instrumentView = this.views.instrument;
        }
        
        // KeyboardView
        if (window.KeyboardView) {
            this.views.keyboard = new KeyboardView('keyboard-view', this.eventBus);
            window.keyboardView = this.views.keyboard;
        }
        
        // SystemView
        if (window.SystemView) {
            this.views.system = new SystemView('system-view', this.eventBus);
            window.systemView = this.views.system;
        }
        
        // RoutingView
        if (window.RoutingView) {
            this.views.routing = new RoutingView('routing-view', this.eventBus);
            window.routingView = this.views.routing;
        }
        
        // EditorView
        if (window.EditorView) {
            this.views.editor = new EditorView('editor-view', this.eventBus);
            window.editorView = this.views.editor;
        }
        
        // PlaylistView
        if (window.PlaylistView) {
            this.views.playlist = new PlaylistView('playlist-view', this.eventBus);
            window.playlistView = this.views.playlist;
        }
        
        // VisualizerView
        if (window.VisualizerView) {
            this.views.visualizer = new VisualizerView('visualizer-view', this.eventBus);
            window.visualizerView = this.views.visualizer;
        }
        
        this.log('info', 'Ã¢Å“â€œ Views initialized');
    }
    
    /**
     * Initialise les contrÃƒÂ´leurs
     */
    async initControllers() {
        console.log('Ã°Å¸Å½Â® Initializing controllers...');
        
        // FileController
        if (window.FileController) {
            this.controllers.file = new FileController(
                this.eventBus,
                this.models,
                this.views,
                this.notifications,
                this.debugConsole,
                this.services.backend  // Ã¢Å“Â¦ BACKEND PASSED
            );
        }
        
        // PlaylistController
        if (window.PlaylistController) {
            this.controllers.playlist = new PlaylistController(
                this.eventBus,
                this.models,
                this.views,
                this.notifications,
                this.debugConsole,
                this.services.backend  // Ã¢Å“Â¦ BACKEND PASSED
            );
        }
        
        // InstrumentController
        if (window.InstrumentController) {
            this.controllers.instrument = new InstrumentController(
                this.eventBus,
                this.models,
                this.views,
                this.notifications,
                this.debugConsole,
                this.services.backend  // Ã¢Å“Â¦ BACKEND PASSED
            );
        }
        
        // KeyboardController
        if (window.KeyboardController) {
            this.controllers.keyboard = new KeyboardController(
                this.eventBus,
                this.models,
                this.views,
                this.notifications,
                this.debugConsole,
                this.services.backend  // Ã¢Å“Â¦ BACKEND PASSED
            );
        }
        
        // PlaybackController
        if (window.PlaybackController) {
            this.controllers.playback = new PlaybackController(
                this.eventBus,
                this.models,
                this.views,
                this.notifications,
                this.debugConsole,
                this.services.backend  // Ã¢Å“Â¦ BACKEND PASSED
            );
        }
        
        // GlobalPlaybackController
        if (window.GlobalPlaybackController) {
            this.controllers.globalPlayback = new GlobalPlaybackController(
                this.eventBus,
                this.models,
                this.services.backend,
                this.notifications
            );
        }
        
        // SystemController
        if (window.SystemController) {
            this.controllers.system = new SystemController(
                this.eventBus,
                this.models,
                this.views,
                this.notifications,
                this.debugConsole,
                this.services.backend  // Ã¢Å“Â¦ BACKEND PASSED
            );
        }
        
        // HomeController
        if (window.HomeController) {
            this.controllers.home = new HomeController(
                this.eventBus,
                this.models,
                this.views,
                this.notifications,
                this.debugConsole,
                this.services.backend  // Ã¢Å“Â¦ BACKEND PASSED
            );
        }
        
        // RoutingController
        if (window.RoutingController) {
            this.controllers.routing = new RoutingController(
                this.eventBus,
                this.models,
                this.views,
                this.notifications,
                this.debugConsole,
                this.services.backend  // Ã¢Å“Â¦ BACKEND PASSED
            );
        }
        
        // EditorController
        if (window.EditorController) {
            this.controllers.editor = new EditorController(
                this.eventBus,
                this.models,
                this.views,
                this.notifications,
                this.debugConsole,
                this.services.backend  // Ã¢Å“Â¦ BACKEND PASSED
            );
        }
        
        // VisualizerController
        if (window.VisualizerController) {
            this.controllers.visualizer = new VisualizerController(
                this.eventBus,
                this.models,
                this.views,
                this.notifications,
                this.debugConsole,
                this.services.backend  // Ã¢Å“Â¦ BACKEND PASSED
            );
        }
        
        this.log('info', 'Ã¢Å“â€œ Controllers initialized');
    }
    
    /**
     * Initialise la navigation
     */
    async initNavigation() {
        console.log('Ã°Å¸Â§Â­ Initializing navigation...');
        
        // NavigationController DOIT ÃƒÂªtre initialisÃƒÂ© en premier
        if (window.NavigationController) {
            this.controllers.navigation = new NavigationController(
                this.eventBus,
                this.models,
                this.views,
                this.notifications,
                this.debugConsole,
                this.services.backend  // Ã¢Å“Â¦ BACKEND PASSED
            );
            
            // âœ… FIX CRITIQUE v4.5.0: Initialiser explicitement AVANT Router
            if (typeof this.controllers.navigation.init === 'function') {
                this.controllers.navigation.init();
                this.log('info', 'âœ“ NavigationController initialized');
            } else if (typeof this.controllers.navigation.onInitialize === 'function') {
                this.controllers.navigation.onInitialize();
                this.log('info', 'âœ“ NavigationController.onInitialize() called');
            }
        }
        
        // Router ensuite
        if (window.Router) {
            this.router = new Router({
                mode: 'hash',
                useTransitions: false,  // DÃƒÂ©sactivÃƒÂ© car NavigationController gÃƒÂ¨re les transitions
                transitionDuration: 300
            });
            
            // Enregistrer les routes AVANT de dÃƒÂ©marrer le routing
            this.registerRoutes();
            
            // Connecter le Router au NavigationController
            if (this.controllers.navigation) {
                this.router.on('route-changed', (data) => {
                    // Extraire le nom de la page du path
                    let pageKey = data.path.replace(/^\//, '') || 'home';
                    // Mapper files -> files (le Router utilise /files, NavigationController utilise 'files')
                    this.controllers.navigation.showPage(pageKey);
                });
            }
            
            
            // FIX v4.2.0: Forcer le hash ÃƒÂ  home si vide ou invalide
            const currentHash = window.location.hash;
            if (!currentHash || currentHash === '#' || currentHash === '') {
                window.location.hash = '#home';
                this.log('info', 'Hash forced to #home');
            }
            
            // DÃƒÂ©marrer le routing maintenant
            this.router.startRouting();
            this.log('info', 'Ã¢Å“â€œ Routing started');
        }
        
        this.log('info', 'Ã¢Å“â€œ Navigation initialized');
    }
    
    /**
     * Enregistre les routes de l'application
     */
    registerRoutes() {
        if (!this.router) return;
        
        // Routes principales
        this.router.route('/home', {
            title: 'MidiMind - Accueil',
            view: 'home'
        });
        
        this.router.route('/files', {
            title: 'MidiMind - Fichiers',
            view: 'files'
        });
        
        this.router.route('/editor', {
            title: 'MidiMind - Ãƒâ€°diteur',
            view: 'editor'
        });
        
        this.router.route('/routing', {
            title: 'MidiMind - Routage',
            view: 'routing'
        });
        
        this.router.route('/instruments', {
            title: 'MidiMind - Instruments',
            view: 'instruments'
        });
        
        this.router.route('/keyboard', {
            title: 'MidiMind - Clavier',
            view: 'keyboard'
        });
        
        this.router.route('/system', {
            title: 'MidiMind - SystÃƒÂ¨me',
            view: 'system'
        });
        
        this.router.route('/visualizer', {
            title: 'MidiMind - Visualiseur',
            view: 'visualizer'
        });
        
        // Route par dÃƒÂ©faut
        this.router.route('/', {
            title: 'MidiMind',
            view: 'home'
        });
        
        this.log('info', 'Ã¢Å“â€œ Routes registered');
    }
    
    /**
     * Connexion au backend
     */
    async connectBackend() {
        if (!this.services.backend) {
            this.log('warn', 'BackendService not initialized');
            return false;
        }
        
        try {
            this.log('info', 'Connecting to backend...');
            
            const success = await this.services.backend.connect();
            
            if (success) {
                this.state.backendConnected = true;
                this.log('info', 'Ã¢Å“â€œ Backend connected');
                
                if (this.eventBus) {
                    this.eventBus.emit('app:backend-connected');
                }
                
                return true;
            } else {
                throw new Error('Connection failed');
            }
            
        } catch (error) {
            this.log('warn', 'Backend connection failed:', error.message);
            this.state.backendConnected = false;
            
            if (this.eventBus) {
                this.eventBus.emit('app:backend-connection-failed', { error });
            }
            
            return false;
        }
    }
    
    /**
     * Finalisation de l'initialisation
     */
    async finalize() {
        console.log('Ã°Å¸ÂÂ Finalizing initialization...');
        
        // Ãƒâ€°vÃƒÂ©nements d'erreur globaux
        this.setupErrorHandlers();
        
        // Ãƒâ€°vÃƒÂ©nements de connexion
        this.setupConnectionHandlers();
        
        // Raccourcis clavier
        if (window.KeyboardShortcuts) {
            this.keyboardShortcuts = new KeyboardShortcuts(this.eventBus, this.logger);
        }
        
        this.log('info', 'Ã¢Å“â€œ Finalization complete');
    }
    
    /**
     * Configure les gestionnaires d'erreurs
     */
    setupErrorHandlers() {
        window.addEventListener('error', (event) => {
            this.log('error', 'Global error:', event.error);
            
            if (this.eventBus) {
                this.eventBus.emit('app:error', { 
                    error: event.error,
                    message: event.message,
                    filename: event.filename,
                    lineno: event.lineno,
                    colno: event.colno
                });
            }
        });
        
        window.addEventListener('unhandledrejection', (event) => {
            this.log('error', 'Unhandled promise rejection:', event.reason);
            
            if (this.eventBus) {
                this.eventBus.emit('app:unhandled-rejection', { 
                    reason: event.reason 
                });
            }
        });
    }
    
    /**
     * Configure les gestionnaires de connexion
     */
    setupConnectionHandlers() {
        if (!this.eventBus) return;
        
        // Backend connectÃƒÂ©
        this.eventBus.on('backend:connected', (data) => {
            this.state.backendConnected = true;
            this.state.offlineMode = false;
            this.state.reconnectAttempts = 0;
            
            this.log('info', 'Ã¢Å“â€œ Backend connected');
            
            if (this.notifications) {
                this.notifications.show('Backend connected', 'success', 3000);
            }
        });
        
        // Backend dÃƒÂ©connectÃƒÂ©
        this.eventBus.on('backend:disconnected', (data) => {
            this.state.backendConnected = false;
            
            this.log('warn', 'Ã¢Å¡Â Ã¯Â¸Â Backend disconnected');
            
            if (this.notifications && !this.state.offlineMode) {
                this.notifications.show('Backend disconnected', 'warning', 5000);
            }
        });
        
        // Mode offline
        this.eventBus.on('backend:offline-mode', (data) => {
            this.state.offlineMode = true;
            this.state.backendConnected = false;
            
            this.log('warn', 'Ã¢Å¡Â Ã¯Â¸Â Offline mode activated');
            
            if (this.notifications && this.config.offlineMode.showNotification) {
                this.notifications.show(
                    'Offline mode - Backend unavailable',
                    'warning',
                    0
                );
            }
        });
        
        // Tentative de reconnexion
        this.eventBus.on('backend:reconnect-scheduled', (data) => {
            this.state.reconnectAttempts = data.attempt;
            
            this.log('info', `Reconnect attempt ${data.attempt}/${data.maxAttempts}`);
        });
    }
    
    /**
     * GÃƒÂ¨re les erreurs d'initialisation
     */
    handleInitError(error) {
        console.error('Ã¢Å“â€” Initialization error:', error);
        
        if (this.notifications) {
            this.notifications.show(
                'Application initialization failed: ' + error.message,
                'error',
                0
            );
        }
        
        // Afficher un message d'erreur dans l'interface
        const errorDiv = document.createElement('div');
        errorDiv.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: #dc3545;
            color: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.3);
            z-index: 10000;
            max-width: 500px;
        `;
        errorDiv.innerHTML = `
            <h3 style="margin: 0 0 10px 0;">Ã¢Å“â€” Initialization Failed</h3>
            <p style="margin: 0;">${error.message}</p>
            <button onclick="location.reload()" 
                    style="margin-top: 15px; padding: 8px 16px; border: none; background: white; color: #dc3545; cursor: pointer; border-radius: 4px;">
                Reload Application
            </button>
        `;
        document.body.appendChild(errorDiv);
    }
    
    // ========================================================================
    // MÃƒâ€°THODES PUBLIQUES
    // ========================================================================
    
    /**
     * Obtient l'ÃƒÂ©tat de l'application
     */
    getState() {
        return { ...this.state };
    }
    
    /**
     * Navigue vers une page
     */
    navigateTo(page) {
        if (this.controllers.navigation) {
            this.controllers.navigation.showPage(page);
        }
    }
    
    /**
     * Reconnexion manuelle au backend
     */
    async reconnectBackend() {
        if (this.services.backend) {
            this.state.offlineMode = false;
            this.state.reconnectAttempts = 0;
            
            if (typeof this.services.backend.enableReconnection === 'function') {
                this.services.backend.enableReconnection();
            }
            
            return await this.connectBackend();
        }
        return false;
    }
    
    /**
     * DÃƒÂ©truit l'application
     */
    destroy() {
        this.log('info', 'Destroying application...');
        
        // DÃƒÂ©truire les contrÃƒÂ´leurs
        Object.values(this.controllers).forEach(controller => {
            if (controller && typeof controller.destroy === 'function') {
                controller.destroy();
            }
        });
        
        // DÃƒÂ©truire les vues
        Object.values(this.views).forEach(view => {
            if (view && typeof view.destroy === 'function') {
                view.destroy();
            }
        });
        
        // DÃƒÂ©connecter le backend
        if (this.services.backend && typeof this.services.backend.disconnect === 'function') {
            this.services.backend.disconnect();
        }
        
        this.state.initialized = false;
        this.state.ready = false;
        
        this.log('info', 'Ã¢Å“â€œ Application destroyed');
    }
}

// ============================================================================
// EXPORT
// ============================================================================

if (typeof module !== 'undefined' && module.exports) {
    module.exports = Application;
}

window.Application = Application;