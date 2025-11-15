// ============================================================================
// Fichier: frontend/js/controllers/EditorController.js
// Chemin réel: frontend/js/controllers/EditorController.js
// Version: v4.3.0 - PLAYBACK ADVANCED CONTROLS
// Date: 2025-11-06
// ============================================================================
// NOUVEAUTÉS v4.3.0:
// ✅ seekToPosition() - Navigation temporelle dans le fichier
// ✅ setPlaybackTempo() - Changement de vitesse de lecture (0.1x - 4.0x)
// ✅ setPlaybackLoop() - Activation/désactivation de la boucle
// ✅ Raccourcis: seekForward, seekBackward, seekToStart, seekToEnd, toggleLoop
// ✅ Gestion événements timeline: onTimelineClick, onPlayheadDrag
// ✅ Événements playback étendus dans bindEvents()
// ============================================================================
// CORRECTIONS v4.2.3:
// ✅ CRITIQUE: Ajout paramètre backend au constructeur (6ème paramètre)
// ✅ Fix: super() appelle BaseController avec backend
// ✅ this.backend initialisé automatiquement via BaseController
// ============================================================================
// CORRECTIONS v4.2.2:
// ✓ routing_id, device_id, midi_file_id, track_id (snake_case)
// ✓ Utiliser helpers BackendService pour routing MIDI
// ============================================================================

class EditorController extends BaseController {
    constructor(eventBus, models = {}, views = {}, notifications = null, debugConsole = null, backend = null) {
        super(eventBus, models, views, notifications, debugConsole, backend);
        
        this.editorModel = models.editor;
        this.fileModel = models.file;
        this.routingModel = models.routing;
        this.view = views.editor;
        this.visualizer = null;
        this.currentFile = null;
        // ✅ this.backend initialisé automatiquement par BaseController
        this.routingManager = null;
        
        this.editorState = {
            isLoading: false,
            hasUnsavedChanges: false,
            currentTool: 'select',
            currentMode: 'edit',
            isPlaying: false,
            currentTime: 0,
            // ✅ NOUVEAUX états playback
            playbackTempo: 1.0,
            playbackLoop: false,
            duration: 0
        };
        
        this._fullyInitialized = true;
    }
    
    initialize() {
        super.initialize();
        this.bindEvents();
        this.setupBeforeUnloadHandler();
        
        if (typeof RoutingManager !== 'undefined') {
            this.routingManager = new RoutingManager(
                this.eventBus,
                this.routingModel,
                this.backend
            );
        }
    }
    
    init() {
        if (this.view && typeof this.view.init === 'function') {
            this.view.init();
        }
        
        if (this.view && typeof this.view.render === 'function') {
            this.view.render();
        }
        
        setTimeout(() => {
            this.initVisualizer();
        }, 100);
    }
    
    bindEvents() {
        // Événements éditeur existants
        this.eventBus.on('editor:action:undo', () => this.undo());
        this.eventBus.on('editor:action:redo', () => this.redo());
        this.eventBus.on('editor:action:copy', () => this.copy());
        this.eventBus.on('editor:action:cut', () => this.cut());
        this.eventBus.on('editor:action:paste', () => this.paste());
        this.eventBus.on('editor:action:save', () => this.saveChanges());
        this.eventBus.on('editor:action:delete', () => this.deleteSelected());
        
        this.eventBus.on('editor:action:quantize', (data) => this.quantize(data.division));
        this.eventBus.on('editor:action:transpose', (data) => this.transpose(data.semitones));
        this.eventBus.on('editor:action:velocity', (data) => this.scaleVelocity(data.factor));
        
        // ✅ NOUVEAUX événements playback
        this.eventBus.on('editor:timeline:click', (data) => {
            this.onTimelineClick(data.clickX, data.timelineWidth);
        });
        
        this.eventBus.on('editor:action:seek-start', () => {
            this.seekToStart();
        });
        
        this.eventBus.on('editor:action:seek-backward', (data) => {
            const seconds = data?.seconds || 5;
            this.seekBackward(seconds);
        });
        
        this.eventBus.on('editor:action:seek-forward', (data) => {
            const seconds = data?.seconds || 5;
            this.seekForward(seconds);
        });
        
        this.eventBus.on('editor:action:seek-end', () => {
            this.seekToEnd();
        });
        
        this.eventBus.on('editor:action:set-tempo', (data) => {
            this.setPlaybackTempo(data.tempo);
        });
        
        this.eventBus.on('editor:action:toggle-loop', () => {
            this.toggleLoop();
        });
        
        this.eventBus.on('editor:playhead:drag', (data) => {
            this.onPlayheadDrag(data.normalizedPosition);
        });
        
        // Événements routing
        this.eventBus.on('routing:assigned', (data) => this.onRoutingAssigned(data));
        this.eventBus.on('routing:unassigned', (data) => this.onRoutingUnassigned(data));
        this.eventBus.on('routing:changed', () => this.onRoutingChanged());
        
        // Événements modèle
        if (this.editorModel) {
            this.eventBus.on('editor:modified', (data) => {
                this.editorState.hasUnsavedChanges = data.isModified;
                this.updateModifiedState();
            });
            
            this.eventBus.on('editor:file-saved', () => {
                this.editorState.hasUnsavedChanges = false;
                this.updateModifiedState();
                this.showSuccess('File saved');
            });
        }
    }
    
    initVisualizer() {
        const container = document.getElementById('midi-visualizer');
        if (!container) {
            this.logDebug('error', 'Visualizer container not found');
            return;
        }
        
        if (typeof MidiVisualizer !== 'undefined') {
            this.visualizer = new MidiVisualizer(container, this.eventBus);
            this.logDebug('editor', '✓ MidiVisualizer initialized');
            
            this.visualizer.on('noteSelected', (notes) => this.onNotesSelected(notes));
            this.visualizer.on('notesMoved', (notes) => this.onNotesMoved(notes));
            this.visualizer.on('notesDeleted', (noteIds) => this.onNotesDeleted(noteIds));
        }
    }
    
    // ========================================================================
    // CONTRÔLES PLAYBACK AVANCÉS (NOUVEAUX v4.3.0)
    // ========================================================================
    
    /**
     * Navigue à une position temporelle dans le fichier
     * @param {number} seconds - Position en secondes
     */
    async seekToPosition(seconds) {
        if (!this.backend?.isConnected()) {
            this.showError('Backend not connected');
            return;
        }
        
        try {
            this.logDebug('info', `Seeking to ${seconds}s`);
            
            // Envoyer commande backend
            await this.backend.sendCommand('playback.seek', {
                position: seconds
            });
            
            // Mettre à jour l'état local
            this.editorState.currentTime = seconds;
            if (this.editorModel) {
                this.editorModel.set('currentTime', seconds);
            }
            
            // Notifier les vues
            this.eventBus.emit('editor:playback:seeked', {
                position: seconds,
                timestamp: Date.now()
            });
            
            this.logDebug('info', `Seeked to ${seconds}s`);
            
        } catch (error) {
            this.logDebug('error', `Seek failed: ${error.message}`);
            this.showError('Failed to seek position');
            throw error;
        }
    }
    
    /**
     * Change la vitesse de lecture
     * @param {number} tempo - Multiplicateur de tempo (0.1 = 10%, 2.0 = 200%)
     */
    async setPlaybackTempo(tempo) {
        if (!this.backend?.isConnected()) {
            this.showError('Backend not connected');
            return;
        }
        
        // Valider le tempo
        if (tempo < 0.1 || tempo > 4.0) {
            this.showError('Tempo must be between 0.1 and 4.0');
            return;
        }
        
        try {
            this.logDebug('info', `Setting tempo to ${tempo}x`);
            
            await this.backend.sendCommand('playback.setTempo', {
                tempo: tempo
            });
            
            // Mettre à jour l'état
            this.editorState.playbackTempo = tempo;
            if (this.editorModel) {
                this.editorModel.set('playbackTempo', tempo);
            }
            
            // Notifier
            this.eventBus.emit('editor:playback:tempo-changed', {
                tempo: tempo
            });
            
            this.showSuccess(`Tempo: ${Math.round(tempo * 100)}%`);
            
        } catch (error) {
            this.logDebug('error', `Set tempo failed: ${error.message}`);
            this.showError('Failed to set tempo');
            throw error;
        }
    }
    
    /**
     * Active/désactive la boucle de lecture
     * @param {boolean} enabled - True pour activer
     */
    async setPlaybackLoop(enabled) {
        if (!this.backend?.isConnected()) {
            this.showError('Backend not connected');
            return;
        }
        
        try {
            this.logDebug('info', `Setting loop: ${enabled}`);
            
            await this.backend.sendCommand('playback.setLoop', {
                enabled: enabled
            });
            
            // Mettre à jour l'état
            this.editorState.playbackLoop = enabled;
            if (this.editorModel) {
                this.editorModel.set('playbackLoop', enabled);
            }
            
            // Notifier
            this.eventBus.emit('editor:playback:loop-changed', {
                enabled: enabled
            });
            
            this.showSuccess(enabled ? 'Loop enabled' : 'Loop disabled');
            
        } catch (error) {
            this.logDebug('error', `Set loop failed: ${error.message}`);
            this.showError('Failed to set loop');
            throw error;
        }
    }
    
    // ========================================================================
    // RACCOURCIS PLAYBACK (NOUVEAUX v4.3.0)
    // ========================================================================
    
    /**
     * Avance de X secondes
     * @param {number} seconds - Nombre de secondes (par défaut 5)
     */
    async seekForward(seconds = 5) {
        const currentTime = this.editorState.currentTime || 0;
        const duration = this.editorState.duration || 0;
        const newTime = Math.min(duration, currentTime + seconds);
        await this.seekToPosition(newTime);
    }
    
    /**
     * Recule de X secondes
     * @param {number} seconds - Nombre de secondes (par défaut 5)
     */
    async seekBackward(seconds = 5) {
        const currentTime = this.editorState.currentTime || 0;
        const newTime = Math.max(0, currentTime - seconds);
        await this.seekToPosition(newTime);
    }
    
    /**
     * Retourne au début
     */
    async seekToStart() {
        await this.seekToPosition(0);
    }
    
    /**
     * Va à la fin
     */
    async seekToEnd() {
        const duration = this.editorState.duration || 0;
        if (duration > 0) {
            await this.seekToPosition(duration);
        }
    }
    
    /**
     * Toggle loop
     */
    async toggleLoop() {
        const currentLoop = this.editorState.playbackLoop;
        await this.setPlaybackLoop(!currentLoop);
    }
    
    // ========================================================================
    // GESTION ÉVÉNEMENTS TIMELINE (NOUVEAUX v4.3.0)
    // ========================================================================
    
    /**
     * Gère le clic sur la timeline
     * @param {number} clickX - Position X du clic
     * @param {number} timelineWidth - Largeur totale de la timeline
     */
    async onTimelineClick(clickX, timelineWidth) {
        const duration = this.editorState.duration || 0;
        
        if (duration > 0 && timelineWidth > 0) {
            const ratio = Math.max(0, Math.min(1, clickX / timelineWidth));
            const targetTime = ratio * duration;
            
            await this.seekToPosition(targetTime);
        }
    }
    
    /**
     * Gère le drag de la tête de lecture
     * @param {number} normalizedPosition - Position normalisée (0-1)
     */
    async onPlayheadDrag(normalizedPosition) {
        const duration = this.editorState.duration || 0;
        const position = Math.max(0, Math.min(1, normalizedPosition));
        const targetTime = position * duration;
        
        await this.seekToPosition(targetTime);
    }
    
    // ========================================================================
    // ROUTING MIDI (snake_case)
    // ========================================================================
    
    /**
     * ✓ CORRECTION: Routing MIDI avec snake_case
     */
    async assignMidiRouting(midi_file_id, track_id, device_id, instrument_name = null) {
        if (!this.backend?.isConnected()) {
            throw new Error('Backend not connected');
        }
        
        try {
            // ✓ Utiliser helper BackendService
            const result = await this.backend.addMidiRouting(
                midi_file_id,
                track_id,
                device_id,
                instrument_name
            );
            
            this.eventBus.emit('routing:assigned', {
                midi_file_id,
                track_id,
                device_id,
                routing_id: result.routing_id
            });
            
            return result;
            
        } catch (error) {
            this.logDebug('error', 'assignMidiRouting failed:', error);
            throw error;
        }
    }
    
    async removeMidiRouting(routing_id) {
        if (!this.backend?.isConnected()) {
            throw new Error('Backend not connected');
        }
        
        try {
            await this.backend.removeMidiRouting(routing_id);
            
            this.eventBus.emit('routing:unassigned', { routing_id });
            
        } catch (error) {
            this.logDebug('error', 'removeMidiRouting failed:', error);
            throw error;
        }
    }
    
    async updateMidiRouting(routing_id, updates) {
        if (!this.backend?.isConnected()) {
            throw new Error('Backend not connected');
        }
        
        try {
            await this.backend.updateMidiRouting(routing_id, updates);
            
            this.eventBus.emit('routing:updated', { routing_id, updates });
            
        } catch (error) {
            this.logDebug('error', 'updateMidiRouting failed:', error);
            throw error;
        }
    }
    
    async loadMidiRoutings(midi_file_id) {
        if (!this.backend?.isConnected()) {
            return [];
        }
        
        try {
            const response = await this.backend.listMidiRouting(midi_file_id);
            return response.routings || [];
        } catch (error) {
            this.logDebug('error', 'loadMidiRoutings failed:', error);
            return [];
        }
    }
    
    // ========================================================================
    // ÉDITION NOTES
    // ========================================================================
    
    undo() {
        if (this.editorModel) {
            this.editorModel.undo();
        }
    }
    
    redo() {
        if (this.editorModel) {
            this.editorModel.redo();
        }
    }
    
    copy() {
        if (this.editorModel) {
            this.editorModel.copy();
            this.showInfo('Notes copied');
        }
    }
    
    cut() {
        if (this.editorModel) {
            this.editorModel.cut();
            this.showInfo('Notes cut');
        }
    }
    
    paste() {
        if (this.editorModel) {
            const pasteTime = this.getCurrentPasteTime();
            this.editorModel.paste(pasteTime);
            this.showInfo('Notes pasted');
        }
    }
    
    deleteSelected() {
        if (this.editorModel) {
            const count = this.editorModel.deleteSelected();
            this.showSuccess(`Deleted ${count} notes`);
        }
    }
    
    // ========================================================================
    // TRANSFORMATIONS MIDI
    // ========================================================================
    
    quantize(grid = 16) {
        if (!this.editorModel) return;
        
        const selectedNotes = this.editorModel.getSelectedNotes();
        if (selectedNotes.length === 0) {
            this.showError('No notes selected');
            return;
        }
        
        const transformedNotes = selectedNotes.map(note => {
            const ticks = note.time;
            const division = 480;
            const gridTicks = division / grid;
            const quantizedTicks = Math.round(ticks / gridTicks) * gridTicks;
            
            return { ...note, time: quantizedTicks };
        });
        
        this.editorModel.updateNotes(transformedNotes);
        this.showSuccess(`Quantized ${selectedNotes.length} notes to 1/${grid}`);
    }
    
    transpose(semitones) {
        if (semitones === 0 || !this.editorModel) return;
        
        const selectedNotes = this.editorModel.getSelectedNotes();
        if (selectedNotes.length === 0) {
            this.showError('No notes selected');
            return;
        }
        
        const transformedNotes = selectedNotes.map(note => {
            const newPitch = Math.max(0, Math.min(127, note.pitch + semitones));
            return { ...note, pitch: newPitch };
        });
        
        this.editorModel.updateNotes(transformedNotes);
        
        const direction = semitones > 0 ? 'up' : 'down';
        this.showSuccess(`Transposed ${selectedNotes.length} notes ${Math.abs(semitones)} semitones ${direction}`);
    }
    
    scaleVelocity(factor) {
        if (factor === 1.0 || !this.editorModel) return;
        
        const selectedNotes = this.editorModel.getSelectedNotes();
        if (selectedNotes.length === 0) {
            this.showError('No notes selected');
            return;
        }
        
        const transformedNotes = selectedNotes.map(note => {
            const newVelocity = Math.max(1, Math.min(127, Math.round(note.velocity * factor)));
            return { ...note, velocity: newVelocity };
        });
        
        this.editorModel.updateNotes(transformedNotes);
        this.showSuccess(`Scaled velocity of ${selectedNotes.length} notes by ${factor.toFixed(2)}x`);
    }
    
    // ========================================================================
    // UTILITAIRES
    // ========================================================================
    
    getCurrentPasteTime() {
        if (this.visualizer && this.visualizer.getCursorPosition) {
            const cursorPos = this.visualizer.getCursorPosition();
            if (cursorPos !== null) return cursorPos;
        }
        
        if (this.editorState.currentTime > 0) {
            return this.editorState.currentTime;
        }
        
        return 0;
    }
    
    reloadVisualizer() {
        if (!this.visualizer || !this.editorModel) return;
        
        const data = this.editorModel.getData();
        if (data && data.midiJson) {
            this.visualizer.loadMidiData(data.midiJson);
        }
    }
    
    // ========================================================================
    // SAUVEGARDE & CHARGEMENT
    // ========================================================================
    
    async saveChanges() {
        if (!this.editorModel) return;
        
        if (!this.editorState.hasUnsavedChanges) {
            this.showInfo('No changes to save');
            return;
        }
        
        try {
            await this.editorModel.save();
            
            this.editorState.hasUnsavedChanges = false;
            this.updateModifiedState();
            
            this.showSuccess('Changes saved');
        } catch (error) {
            this.logDebug('error', `Failed to save: ${error.message}`);
            this.showError('Save failed');
        }
    }
    
    async loadFile(file_id) {
        if (!this.backend?.isConnected()) {
            throw new Error('Backend not connected');
        }
        
        try {
            const response = await this.backend.loadMidi(file_id);
            
            if (this.editorModel) {
                this.editorModel.loadMidiData(response);
            }
            
            if (this.visualizer) {
                this.visualizer.loadMidiData(response);
            }
            
            // ✅ Mettre à jour la durée du fichier
            if (response.duration) {
                this.editorState.duration = response.duration;
            }
            
            this.currentFile = file_id;
            this.editorState.hasUnsavedChanges = false;
            
            this.eventBus.emit('editor:file-loaded', { file_id });
            
        } catch (error) {
            this.logDebug('error', 'loadFile failed:', error);
            throw error;
        }
    }
    
    // ========================================================================
    // CALLBACKS VISUALIZER
    // ========================================================================
    
    onNotesSelected(notes) {
        if (this.editorModel) {
            this.editorModel.selectNotes(notes);
        }
    }
    
    onNotesMoved(notes) {
        if (this.editorModel) {
            this.editorModel.updateNotes(notes);
        }
    }
    
    onNotesDeleted(noteIds) {
        if (this.editorModel) {
            this.editorModel.deleteNotes(noteIds);
        }
    }
    
    // ========================================================================
    // CALLBACKS ROUTING
    // ========================================================================
    
    onRoutingAssigned(data) {
        this.logDebug('editor', 'Routing assigned:', data);
        this.reloadVisualizer();
    }
    
    onRoutingUnassigned(data) {
        this.logDebug('editor', 'Routing unassigned:', data);
        this.reloadVisualizer();
    }
    
    onRoutingChanged() {
        this.reloadVisualizer();
    }
    
    // ========================================================================
    // UI & HELPERS
    // ========================================================================
    
    updateModifiedState() {
        if (this.view && typeof this.view.updateModifiedState === 'function') {
            this.view.updateModifiedState(this.editorState.hasUnsavedChanges);
        }
    }
    
    setupBeforeUnloadHandler() {
        window.addEventListener('beforeunload', (e) => {
            if (this.editorState.hasUnsavedChanges) {
                e.preventDefault();
                e.returnValue = '';
            }
        });
    }
    
    showSuccess(message) {
        if (this.notifications) {
            this.notifications.show('Success', message, 'success', 2000);
        }
    }
    
    showError(message) {
        if (this.notifications) {
            this.notifications.show('Error', message, 'error', 3000);
        }
    }
    
    showInfo(message) {
        if (this.notifications) {
            this.notifications.show('Info', message, 'info', 2000);
        }
    }
    
    logDebug(category, ...args) {
        if (this.logger && typeof this.logger.debug === 'function') {
            this.logger.debug(category, ...args);
        } else {
            console.log(`[${category}]`, ...args);
        }
    }
}

if (typeof window !== 'undefined') {
    window.EditorController = EditorController;
}

// ============================================================================
// DOCUMENTATION RAPIDE
// ============================================================================
/*
NOUVEAUTÉS v4.3.0 - PLAYBACK CONTROLS:

1. NAVIGATION TEMPORELLE:
   - seekToPosition(seconds) - Aller à une position spécifique
   - seekForward(seconds) - Avancer de X secondes (défaut: 5s)
   - seekBackward(seconds) - Reculer de X secondes (défaut: 5s)
   - seekToStart() - Retour au début
   - seekToEnd() - Aller à la fin

2. CONTRÔLE TEMPO:
   - setPlaybackTempo(tempo) - Changer la vitesse (0.1 à 4.0)
   - Exemple: setPlaybackTempo(0.5) = 50% de la vitesse normale

3. BOUCLE:
   - setPlaybackLoop(enabled) - Activer/désactiver la boucle
   - toggleLoop() - Basculer l'état de la boucle

4. ÉVÉNEMENTS TIMELINE:
   - onTimelineClick(clickX, timelineWidth) - Gestion clic timeline
   - onPlayheadDrag(normalizedPosition) - Gestion drag playhead (0-1)

5. ÉVÉNEMENTS À ÉMETTRE DEPUIS LA VUE:
   - 'editor:timeline:click' - Clic sur timeline
   - 'editor:action:seek-start' - Bouton début
   - 'editor:action:seek-backward' - Bouton reculer
   - 'editor:action:seek-forward' - Bouton avancer
   - 'editor:action:seek-end' - Bouton fin
   - 'editor:action:set-tempo' - Changement tempo
   - 'editor:action:toggle-loop' - Toggle boucle
   - 'editor:playhead:drag' - Drag tête de lecture

6. ÉVÉNEMENTS ÉMIS PAR LE CONTROLLER:
   - 'editor:playback:seeked' - Position changée
   - 'editor:playback:tempo-changed' - Tempo changé
   - 'editor:playback:loop-changed' - Boucle changée

EXEMPLE D'UTILISATION:
```javascript
// Dans la console ou depuis une vue:
const editor = app.controllers.editor;

// Navigation
await editor.seekToPosition(30);     // Va à 30 secondes
await editor.seekForward(5);         // Avance de 5s
await editor.seekToStart();          // Retour au début

// Tempo
await editor.setPlaybackTempo(0.5);  // Ralentir à 50%
await editor.setPlaybackTempo(1.5);  // Accélérer à 150%

// Loop
await editor.setPlaybackLoop(true);  // Activer boucle
await editor.toggleLoop();           // Toggle boucle
```

COMMANDES BACKEND UTILISÉES:
- playback.seek { position: seconds }
- playback.setTempo { tempo: 0.1-4.0 }
- playback.setLoop { enabled: boolean }
*/