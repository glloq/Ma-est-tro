// ============================================================================
// Fichier: frontend/js/models/EditorModel.js
// Chemin rÃ©el: frontend/js/models/EditorModel.js
// Version: v3.3.0 - SIGNATURE CORRIGÃ‰E (5 PARAMÃˆTRES)
// Date: 2025-11-01
// ============================================================================
// CORRECTIONS v3.3.0:
// âœ… CRITIQUE: Ajout paramÃ¨tres initialData et options manquants
// âœ… Signature cohÃ©rente: (eventBus, backend, logger, initialData = {}, options = {})
// âœ… Merge intelligente des options par dÃ©faut
// âœ… Ajout mÃ©thodes utilitaires pour l'Ã©dition
// ============================================================================

class EditorModel extends BaseModel {
    constructor(eventBus, backend, logger, initialData = {}, options = {}) {
        // âœ… NOUVEAU: Appel super() avec les 5 paramÃ¨tres
        super(eventBus, backend, logger, initialData, {
            persistKey: 'editormodel',
            eventPrefix: 'editor',
            autoPersist: false,  // Ne pas persister automatiquement les donnÃ©es d'Ã©dition
            ...options
        });
        
        // Initialisation des donnÃ©es de l'Ã©diteur avec valeurs par dÃ©faut
        this.data.midiData = this.data.midiData || null;
        this.data.selectedNotes = this.data.selectedNotes || [];
        this.data.zoom = this.data.zoom || 1.0;
        this.data.snapToGrid = this.data.snapToGrid !== undefined ? this.data.snapToGrid : true;
        this.data.gridSize = this.data.gridSize || 16;  // 16Ã¨me de note par dÃ©faut
        
        // Ã‰tat de l'Ã©diteur
        this.data.viewportOffset = this.data.viewportOffset || { x: 0, y: 0 };
        this.data.currentTool = this.data.currentTool || 'select';  // select, draw, erase
        this.data.isDirty = false;  // Modifications non sauvegardÃ©es
        
        this.log('debug', 'EditorModel', 'Initialized v3.3.0');
    }
    
    /**
     * DÃ©finit les donnÃ©es MIDI Ã  Ã©diter
     * @param {Object} midiData - DonnÃ©es MIDI
     */
    setMidiData(midiData) {
        this.data.midiData = midiData;
        this.data.isDirty = false;
        this.emit('editor:midiData:changed', { midiData });
    }
    
    /**
     * RÃ©cupÃ¨re les donnÃ©es MIDI
     * @returns {Object|null}
     */
    getMidiData() {
        return this.data.midiData;
    }
    
    /**
     * SÃ©lectionne des notes
     * @param {Array} notes - Tableau de notes sÃ©lectionnÃ©es
     */
    selectNotes(notes) {
        this.data.selectedNotes = notes;
        this.emit('editor:selection:changed', { notes });
    }
    
    /**
     * RÃ©cupÃ¨re les notes sÃ©lectionnÃ©es
     * @returns {Array}
     */
    getSelectedNotes() {
        return this.data.selectedNotes;
    }
    
    /**
     * Ajoute une note Ã  la sÃ©lection
     * @param {Object} note
     */
    addToSelection(note) {
        if (!this.data.selectedNotes.includes(note)) {
            this.data.selectedNotes.push(note);
            this.emit('editor:selection:changed', { notes: this.data.selectedNotes });
        }
    }
    
    /**
     * Retire une note de la sÃ©lection
     * @param {Object} note
     */
    removeFromSelection(note) {
        const index = this.data.selectedNotes.indexOf(note);
        if (index !== -1) {
            this.data.selectedNotes.splice(index, 1);
            this.emit('editor:selection:changed', { notes: this.data.selectedNotes });
        }
    }
    
    /**
     * Vide la sÃ©lection
     */
    clearSelection() {
        this.data.selectedNotes = [];
        this.emit('editor:selection:changed', { notes: [] });
    }
    
    /**
     * DÃ©finit le niveau de zoom
     * @param {number} zoom - Niveau de zoom (0.1 Ã  10)
     */
    setZoom(zoom) {
        this.data.zoom = Math.max(0.1, Math.min(10, zoom));
        this.emit('editor:zoom:changed', { zoom: this.data.zoom });
    }
    
    /**
     * RÃ©cupÃ¨re le niveau de zoom
     * @returns {number}
     */
    getZoom() {
        return this.data.zoom;
    }
    
    /**
     * Active/dÃ©sactive la magnÃ©tisation Ã  la grille
     * @param {boolean} enabled
     */
    setSnapToGrid(enabled) {
        this.data.snapToGrid = enabled;
        this.emit('editor:snap:changed', { enabled });
    }
    
    /**
     * VÃ©rifie si la magnÃ©tisation est active
     * @returns {boolean}
     */
    isSnapToGridEnabled() {
        return this.data.snapToGrid;
    }
    
    /**
     * DÃ©finit la taille de la grille
     * @param {number} size - Taille en ticks MIDI
     */
    setGridSize(size) {
        this.data.gridSize = size;
        this.emit('editor:grid:changed', { size });
    }
    
    /**
     * RÃ©cupÃ¨re la taille de la grille
     * @returns {number}
     */
    getGridSize() {
        return this.data.gridSize;
    }
    
    /**
     * DÃ©finit l'outil actuel
     * @param {string} tool - 'select', 'draw', 'erase'
     */
    setCurrentTool(tool) {
        this.data.currentTool = tool;
        this.emit('editor:tool:changed', { tool });
    }
    
    /**
     * RÃ©cupÃ¨re l'outil actuel
     * @returns {string}
     */
    getCurrentTool() {
        return this.data.currentTool;
    }
    
    /**
     * DÃ©finit l'offset du viewport
     * @param {Object} offset - {x, y}
     */
    setViewportOffset(offset) {
        this.data.viewportOffset = offset;
        this.emit('editor:viewport:changed', { offset });
    }
    
    /**
     * RÃ©cupÃ¨re l'offset du viewport
     * @returns {Object}
     */
    getViewportOffset() {
        return this.data.viewportOffset;
    }
    
    /**
     * Marque l'Ã©diteur comme modifiÃ©
     */
    markDirty() {
        this.data.isDirty = true;
        this.emit('editor:dirty:changed', { isDirty: true });
    }
    
    /**
     * Marque l'Ã©diteur comme sauvegardÃ©
     */
    markClean() {
        this.data.isDirty = false;
        this.emit('editor:dirty:changed', { isDirty: false });
    }
    
    /**
     * VÃ©rifie si l'Ã©diteur a des modifications non sauvegardÃ©es
     * @returns {boolean}
     */
    isDirty() {
        return this.data.isDirty;
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = EditorModel;
}

if (typeof window !== 'undefined') {
    window.EditorModel = EditorModel;
}