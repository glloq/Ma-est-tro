// ============================================================================
// Fichier: frontend/js/editor/utils/EditorRoutingManager.js
// Version: v3.1.1 - FIXED
// Projet: midiMind v3.0 - SystÃ¨me d'Orchestration MIDI
// ============================================================================
// CORRECTIONS v3.1.1:
// âœ“ Fixed: Removed duplicate "let" declaration
// âœ“ Using assignment instead to avoid redeclaration error
// ============================================================================

// âœ… FIX: Use assignment instead of let declaration if already declared
RoutingManager = class RoutingManager {
    constructor(eventBus, debugConsole) {
        this.eventBus = eventBus || window.eventBus || null;
        this.debugConsole = debugConsole;
        
        // Configuration du routage
        this.routing = {
            assignments: new Map(),  // channel -> instrument
            mode: 'manual',          // 'manual', 'auto', 'preset'
            currentPreset: null,
            routes: new Map(),       // âœ… ADDED: for Phase 3
            channelToRoutes: new Map(),
            instrumentToRoutes: new Map()
        };
        
        // DonnÃ©es
        this.midiChannels = [];      // Canaux du fichier MIDI
        this.instruments = [];        // Instruments disponibles
        this.presets = [];           // Presets de routage
        
        // Ã‰tat
        this.isValid = false;
        this.conflicts = [];
        
        // Statistiques
        this.stats = {
            totalChannels: 0,
            assignedChannels: 0,
            unassignedChannels: 0,
            compatibilityScore: 0
        };
    }

    // ========================================================================
    // INITIALISATION
    // ========================================================================

    initialize(midiData, instruments) {
        console.log('[RoutingManager] Initializing routing...');
        
        this.midiChannels = this.extractChannels(midiData);
        this.instruments = instruments || [];
        
        // Charger les presets
        this.loadPresets();
        
        // Tentative de routage automatique
        if (this.routing.mode === 'auto') {
            this.autoRoute();
        }
        
        // Valider
        this.validate();
        
        // Calculer les stats
        this.updateStats();
        
        console.log('[RoutingManager] Routing initialized:', this.stats);
        
        this.eventBus.emit('routing:initialized', {
            channels: this.midiChannels.length,
            instruments: this.instruments.length
        });
    }

    extractChannels(midiData) {
        if (!midiData || !midiData.timeline) return [];
        
        const channelMap = new Map();
        
        midiData.timeline.forEach(event => {
            if (event.type === 'noteOn') {
                const channel = event.channel;
                
                if (!channelMap.has(channel)) {
                    channelMap.set(channel, {
                        number: channel,
                        name: `Channel ${channel + 1}`,
                        instrument: event.instrument || 'Unknown',
                        program: event.program || 0,
                        noteCount: 0,
                        notes: [],  // âœ… ADDED: Store notes for analysis
                        noteRange: { min: 127, max: 0 },
                        velocity: { min: 127, max: 0, avg: 0 }
                    });
                }
                
                const info = channelMap.get(channel);
                info.noteCount++;
                info.notes.push({
                    pitch: event.note,
                    velocity: event.velocity,
                    duration: event.duration || 0,
                    time: event.time || 0
                });
                info.noteRange.min = Math.min(info.noteRange.min, event.note);
                info.noteRange.max = Math.max(info.noteRange.max, event.note);
                info.velocity.min = Math.min(info.velocity.min, event.velocity);
                info.velocity.max = Math.max(info.velocity.max, event.velocity);
            }
        });
        
        // Calculer moyennes
        channelMap.forEach(info => {
            info.velocity.avg = Math.round((info.velocity.min + info.velocity.max) / 2);
        });
        
        return Array.from(channelMap.values()).sort((a, b) => a.number - b.number);
    }

    // ========================================================================
    // ASSIGNATION
    // ========================================================================

    assign(channelNumber, instrument_id) {
        const channel = this.midiChannels.find(c => c.number === channelNumber);
        if (!channel) {
            console.warn('[RoutingManager] Invalid channel:', channelNumber);
            return false;
        }
        
        const instrument = this.instruments.find(i => i.id === instrument_id);
        if (!instrument) {
            console.warn('[RoutingManager] Invalid instrument:', instrument_id);
            return false;
        }
        
        const compatibility = this.checkCompatibility(channel, instrument);
        if (compatibility.score < 0.3) {
            console.warn('[RoutingManager] Low compatibility:', compatibility);
        }
        
        this.routing.assignments.set(channelNumber, {instrument_id: instrument_id,
            instrument: instrument,
            channel: channel,
            compatibility: compatibility,
            timestamp: Date.now()
        });
        
        console.log(`[RoutingManager] Assigned CH${channelNumber + 1} â†’ ${instrument.name}`);
        
        this.validate();
        this.updateStats();
        
        this.eventBus.emit('routing:assigned', {
            channel: channelNumber,
            instrument: instrument_id,
            compatibility: compatibility.score
        });
        
        return true;
    }

    unassign(channelNumber) {
        if (!this.routing.assignments.has(channelNumber)) {
            return false;
        }
        
        this.routing.assignments.delete(channelNumber);
        
        this.validate();
        this.updateStats();
        
        this.eventBus.emit('routing:unassigned', { channel: channelNumber });
        
        return true;
    }

    clearAll() {
        this.routing.assignments.clear();
        this.routing.routes.clear();
        this.routing.channelToRoutes.clear();
        this.routing.instrumentToRoutes.clear();
        
        this.validate();
        this.updateStats();
        
        this.eventBus.emit('routing:cleared');
        
        console.log('[RoutingManager] All assignments cleared');
    }

    // ========================================================================
    // ROUTAGE AUTOMATIQUE
    // ========================================================================

    autoRoute() {
        console.log('[RoutingManager] Auto-routing...');
        
        this.clearAll();
        
        const assignments = this.calculateBestRouting();
        
        assignments.forEach(({ channel, instrument }) => {
            this.assign(channel, instrument.id);
        });
        
        this.routing.mode = 'auto';
        
        console.log('[RoutingManager] Auto-routing completed');
        
        this.eventBus.emit('routing:auto-routed', {
            assignments: assignments.length
        });
    }

    calculateBestRouting() {
        const assignments = [];
        const usedInstruments = new Set();
        
        const sortedChannels = [...this.midiChannels].sort(
            (a, b) => b.noteCount - a.noteCount
        );
        
        sortedChannels.forEach(channel => {
            let bestInstrument = null;
            let bestScore = 0;
            
            this.instruments.forEach(instrument => {
                if (usedInstruments.has(instrument.id)) return;
                
                const compatibility = this.checkCompatibility(channel, instrument);
                
                if (compatibility.score > bestScore) {
                    bestScore = compatibility.score;
                    bestInstrument = instrument;
                }
            });
            
            if (bestInstrument && bestScore > 0.3) {
                assignments.push({
                    channel: channel.number,
                    instrument: bestInstrument
                });
                usedInstruments.add(bestInstrument.id);
            }
        });
        
        return assignments;
    }

    checkCompatibility(channel, instrument) {
        let score = 0;
        const reasons = [];
        
        if (this.matchInstrumentType(channel.instrument, instrument.type)) {
            score += 0.4;
            reasons.push('Type matches');
        }
        
        const noteRangeScore = this.calculateNoteRangeScore(
            channel.noteRange,
            instrument.noteRange
        );
        score += noteRangeScore * 0.3;
        if (noteRangeScore > 0.8) {
            reasons.push('Note range compatible');
        }
        
        if (instrument.supportsVelocity) {
            score += 0.2;
            reasons.push('Velocity supported');
        }
        
        if (instrument.state === 'ready') {
            score += 0.1;
            reasons.push('Instrument ready');
        }
        
        return {
            score: score,
            reasons: reasons,
            details: {
                typeMatch: this.matchInstrumentType(channel.instrument, instrument.type),
                noteRangeScore: noteRangeScore,
                velocitySupport: instrument.supportsVelocity,
                availability: instrument.state === 'ready'
            }
        };
    }

    matchInstrumentType(midiInstrument, deviceType) {
        const typeMapping = {
            'Piano': ['keyboard', 'piano', 'synth'],
            'Organ': ['organ', 'keyboard'],
            'Guitar': ['guitar', 'string'],
            'Bass': ['bass', 'string'],
            'Strings': ['string', 'orchestral'],
            'Ensemble': ['orchestral', 'synth'],
            'Brass': ['brass', 'wind'],
            'Reed': ['reed', 'wind'],
            'Pipe': ['wind', 'orchestral'],
            'Lead': ['synth', 'lead'],
            'Pad': ['synth', 'pad'],
            'Synth': ['synth'],
            'Drum': ['percussion', 'drum'],
            'Percussion': ['percussion']
        };
        
        const expectedTypes = typeMapping[midiInstrument] || [];
        return expectedTypes.includes(deviceType?.toLowerCase());
    }

    calculateNoteRangeScore(channelRange, instrumentRange) {
        if (!instrumentRange) return 0.5;
        
        const channelSpan = channelRange.max - channelRange.min;
        const instrumentSpan = instrumentRange.max - instrumentRange.min;
        
        const notesInRange = 
            channelRange.min >= instrumentRange.min &&
            channelRange.max <= instrumentRange.max;
        
        if (notesInRange) {
            return 1.0;
        }
        
        const overlapMin = Math.max(channelRange.min, instrumentRange.min);
        const overlapMax = Math.min(channelRange.max, instrumentRange.max);
        const overlap = Math.max(0, overlapMax - overlapMin);
        
        return overlap / channelSpan;
    }

    // ========================================================================
    // PRESETS
    // ========================================================================

    loadPresets() {
        try {
            const saved = localStorage.getItem('midiMind_routingPresets');
            if (saved) {
                this.presets = JSON.parse(saved);
                console.log('[RoutingManager] Loaded', this.presets.length, 'presets');
            }
        } catch (error) {
            console.error('[RoutingManager] Failed to load presets:', error);
        }
    }

    savePresets() {
        try {
            localStorage.setItem('midiMind_routingPresets', 
                JSON.stringify(this.presets));
            console.log('[RoutingManager] Presets saved');
        } catch (error) {
            console.error('[RoutingManager] Failed to save presets:', error);
        }
    }

    createPreset(name) {
        const preset = {
            id: `preset_${Date.now()}`,
            name: name,
            assignments: Array.from(this.routing.assignments.entries()).map(
                ([channel, assignment]) => ({channel: channel,
                    instrument_id: assignment.instrument_id,
                    instrumentName: assignment.instrument.name
                })
            ),
            metadata: {
                created: Date.now(),
                channelCount: this.midiChannels.length,
                assignmentCount: this.routing.assignments.size
            }
        };
        
        this.presets.push(preset);
        this.savePresets();
        
        console.log('[RoutingManager] Preset created:', name);
        
        this.eventBus.emit('routing:preset-created', { preset });
        
        return preset;
    }

    applyPreset(presetId) {
        const preset = this.presets.find(p => p.id === presetId);
        if (!preset) {
            console.warn('[RoutingManager] Preset not found:', presetId);
            return false;
        }
        
        this.clearAll();
        
        preset.assignments.forEach(({ channel, instrument_id }) => {
            const instrument = this.instruments.find(i => i.id === instrument_id);
            if (instrument) {
                this.assign(channel, instrument_id);
            } else {
                console.warn('[RoutingManager] Instrument not found:', instrument_id);
            }
        });
        
        this.routing.mode = 'preset';
        this.routing.currentPreset = presetId;
        
        console.log('[RoutingManager] Preset applied:', preset.name);
        
        this.eventBus.emit('routing:preset-applied', { preset });
        
        return true;
    }

    deletePreset(presetId) {
        const index = this.presets.findIndex(p => p.id === presetId);
        if (index === -1) return false;
        
        this.presets.splice(index, 1);
        this.savePresets();
        
        if (this.routing.currentPreset === presetId) {
            this.routing.currentPreset = null;
        }
        
        console.log('[RoutingManager] Preset deleted');
        
        this.eventBus.emit('routing:preset-deleted', { presetId });
        
        return true;
    }

    // ========================================================================
    // VALIDATION
    // ========================================================================

    validate() {
        this.conflicts = [];
        this.isValid = true;
        
        this.midiChannels.forEach(channel => {
            if (!this.routing.assignments.has(channel.number)) {
                this.conflicts.push({
                    type: 'unassigned',
                    channel: channel.number,
                    message: `Channel ${channel.number + 1} is not assigned`
                });
                this.isValid = false;
            }
        });
        
        const usedInstruments = new Map();
        this.routing.assignments.forEach((assignment, channel) => {const instId = assignment.instrument_id;
            if (usedInstruments.has(instId)) {
                this.conflicts.push({
                    type: 'duplicate',
                    channel: channel,
                    otherChannel: usedInstruments.get(instId),
                    instrument_id: instId,
                    message: `Instrument ${assignment.instrument.name} assigned multiple times`
                });
            } else {
                usedInstruments.set(instId, channel);
            }
        });
        
        this.routing.assignments.forEach((assignment, channel) => {if (assignment.compatibility.score < 0.3) {
                this.conflicts.push({
                    type: 'low-compatibility',
                    channel: channel,
                    instrument_id: assignment.instrument_id,
                    score: assignment.compatibility.score,
                    message: `Low compatibility (${Math.round(assignment.compatibility.score * 100)}%)`
                });
            }
        });
        
        return this.isValid;
    }

    // ========================================================================
    // STATISTIQUES
    // ========================================================================

    updateStats() {
        this.stats.totalChannels = this.midiChannels.length;
        this.stats.assignedChannels = this.routing.assignments.size;
        this.stats.unassignedChannels = this.stats.totalChannels - this.stats.assignedChannels;
        
        let totalScore = 0;
        let count = 0;
        
        this.routing.assignments.forEach(assignment => {
            totalScore += assignment.compatibility.score;
            count++;
        });
        
        this.stats.compatibilityScore = count > 0 ? totalScore / count : 0;
    }

    getStats() {
        return { ...this.stats };
    }

    // ========================================================================
    // EXPORT / IMPORT
    // ========================================================================

    export() {return {
            mode: this.routing.mode,
            currentPreset: this.routing.currentPreset,
            assignments: Array.from(this.routing.assignments.entries()).map(
                ([channel, assignment]) => ({
                    channel: channel,
                    instrument_id: assignment.instrument_id,
                    instrumentName: assignment.instrument.name,
                    compatibility: assignment.compatibility.score
                })
            ),
            stats: this.stats,
            timestamp: Date.now()
        };
    }

    import(config) {
        if (!config || !config.assignments) return false;
        
        this.clearAll();
        
        config.assignments.forEach(({ channel, instrument_id }) => {
            const instrument = this.instruments.find(i => i.id === instrument_id);
            if (instrument) {
                this.assign(channel, instrument_id);
            }
        });
        
        this.routing.mode = config.mode || 'manual';
        this.routing.currentPreset = config.currentPreset || null;
        
        console.log('[RoutingManager] Configuration imported');
        
        return true;
    }

    // ========================================================================
    // GETTERS
    // ========================================================================

    getAssignment(channelNumber) {
        return this.routing.assignments.get(channelNumber);
    }

    getAssignments() {
        return Array.from(this.routing.assignments.entries());
    }

    getUnassignedChannels() {
        return this.midiChannels.filter(
            channel => !this.routing.assignments.has(channel.number)
        );
    }

    getConflicts() {
        return [...this.conflicts];
    }

    isChannelAssigned(channelNumber) {
        return this.routing.assignments.has(channelNumber);
    }

    // ========================================================================
    // PHASE 3 METHODS - PLACEHOLDER
    // (Full implementation would be added here)
    // ========================================================================

    autoRouteByInstrumentType() {
        console.log('[RoutingManager] ðŸ¤– Auto-routing by instrument type...');
        return this.autoRoute();
    }

    analyzeChannelContent(channelNumber) {
        const channel = this.midiChannels.find(c => c.number === channelNumber);
        if (!channel) return { type: 'unknown', confidence: 0 };
        
        // Simplified analysis
        if (channelNumber === 9) return { type: 'percussion', confidence: 1.0 };
        
        const avgPitch = channel.notes?.reduce((sum, n) => sum + n.pitch, 0) / (channel.notes?.length || 1);
        
        if (avgPitch < 48) return { type: 'bass', confidence: 0.8 };
        if (avgPitch > 60) return { type: 'lead', confidence: 0.7 };
        
        return { type: 'melodic', confidence: 0.5 };
    }

    getNotesForChannel(channelNumber) {
        const channel = this.midiChannels.find(c => c.number === channelNumber);
        return channel?.notes || [];
    }

    getMIDIDuration() {
        return 10000; // Fallback
    }
};

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = RoutingManager;
}

if (typeof window !== 'undefined') {
    window.RoutingManager = RoutingManager;
}
 window.RoutingManager = RoutingManager;