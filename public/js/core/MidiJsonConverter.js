// ============================================================================
// Fichier: frontend/js/core/MidiJsonConverter.js
// Projet: MidiMind v3.0 - Système d'Orchestration MIDI pour Raspberry Pi
// Version: 3.1.0 - 2025-10-14
// ============================================================================
// Description:
//   Convertisseur bidirectionnel MIDI binaire ↔ JSON
//   Implémente le format JsonMidi pour édition dans l'interface
//
// Fonctionnalités:
//   - Parsing fichiers MIDI standard (Format 0, 1, 2)
//   - Conversion vers format JSON éditable
//   - Génération MIDI binaire depuis JSON
//   - Validation et vérification intégrité
// ============================================================================

class MidiJsonConverter {

    constructor() {
        this.format = 'JsonMidi-v1.0';
        this.logger = window.logger || console;
    }

    // ========================================================================
    // MIDI → JSON
    // ========================================================================

    /**
     * Convertit un fichier MIDI binaire en JSON
     * @param {ArrayBuffer} midiData - Données MIDI binaires
     * @returns {Object} JsonMidi
     */
    async midiToJson(midiData) {
        this.logger.info('MidiJsonConverter', 'Converting MIDI to JSON...');
        
        const dataView = new DataView(midiData);
        let offset = 0;
        
        // Parser le header
        const header = this.parseMidiHeader(dataView, offset);
        offset += 14;
        
        this.logger.debug('MidiJsonConverter', `Format: ${header.format}, Tracks: ${header.numTracks}`);
        
        // Parser les tracks
        const tracks = [];
        const allEvents = [];
        
        for (let i = 0; i < header.numTracks; i++) {
            const track = this.parseMidiTrack(dataView, offset, i);
            tracks.push(track.info);
            allEvents.push(...track.events);
            offset = track.nextOffset;
        }
        
        // Trier tous les événements par temps absolu
        allEvents.sort((a, b) => a.time - b.time);
        
        // Calculer métadonnées
        const metadata = this.extractMetadata(allEvents, header);
        
        const jsonMidi = {
            format: this.format,
            version: '1.0',
            
            // Header MIDI
            midiFormat: header.format,
            division: header.division,
            
            // Tracks
            tracks: tracks,
            
            // Timeline unifiée (tous les événements)
            timeline: allEvents,
            
            // Métadonnées
            metadata: metadata
        };
        
        this.logger.info('MidiJsonConverter', `✓ Converted ${allEvents.length} events`);
        
        return jsonMidi;
    }

    /**
     * Parse le header MIDI
     * @private
     */
    parseMidiHeader(dataView, offset) {
        // Vérifier "MThd"
        const magic = String.fromCharCode(
            dataView.getUint8(offset),
            dataView.getUint8(offset + 1),
            dataView.getUint8(offset + 2),
            dataView.getUint8(offset + 3)
        );
        
        if (magic !== 'MThd') {
            throw new Error('Invalid MIDI file: missing MThd header');
        }
        
        const headerLength = dataView.getUint32(offset + 4);
        
        if (headerLength !== 6) {
            throw new Error(`Invalid header length: ${headerLength}`);
        }
        
        const format = dataView.getUint16(offset + 8);
        const numTracks = dataView.getUint16(offset + 10);
        const division = dataView.getUint16(offset + 12);
        
        return { format, numTracks, division };
    }

    /**
     * Parse un track MIDI
     * @private
     */
    parseMidiTrack(dataView, offset, trackIndex) {
        // Vérifier "MTrk"
        const magic = String.fromCharCode(
            dataView.getUint8(offset),
            dataView.getUint8(offset + 1),
            dataView.getUint8(offset + 2),
            dataView.getUint8(offset + 3)
        );
        
        if (magic !== 'MTrk') {
            throw new Error(`Invalid track header at offset ${offset}`);
        }
        
        const trackLength = dataView.getUint32(offset + 4);
        offset += 8;
        
        const trackEnd = offset + trackLength;
        
        const events = [];
        let currentTime = 0;
        let runningStatus = 0;
        
        let trackName = `Track ${trackIndex + 1}`;
        let channel = 0;
        
        // Parser les événements
        while (offset < trackEnd) {
            // Lire delta time
            const deltaTime = this.readVariableLength(dataView, offset);
            offset = deltaTime.nextOffset;
            currentTime += deltaTime.value;
            
            // Lire status byte
            let status = dataView.getUint8(offset);
            
            // Running status
            if (status < 0x80) {
                status = runningStatus;
            } else {
                offset++;
                runningStatus = status;
            }
            
            const eventType = status & 0xF0;
            const eventChannel = status & 0x0F;
            
            let event = null;
            
            // Meta events
            if (status === 0xFF) {
                const metaType = dataView.getUint8(offset++);
                const length = this.readVariableLength(dataView, offset);
                offset = length.nextOffset;
                
                const metaData = new Uint8Array(
                    dataView.buffer.slice(offset, offset + length.value)
                );
                offset += length.value;
                
                // Parse meta events
                if (metaType === 0x03) { // Track Name
                    trackName = new TextDecoder().decode(metaData);
                }
                
                event = this.parseMetaEvent(metaType, metaData, currentTime);
            }
            // SysEx events
            else if (status === 0xF0 || status === 0xF7) {
                const length = this.readVariableLength(dataView, offset);
                offset = length.nextOffset;
                
                const sysexData = new Uint8Array(
                    dataView.buffer.slice(offset, offset + length.value)
                );
                offset += length.value;
                
                event = {
                    id: this.generateEventId(),
                    type: 'sysex',
                    time: currentTime,
                    data: Array.from(sysexData)
                };
            }
            // Channel events
            else if (eventType >= 0x80 && eventType <= 0xE0) {
                event = this.parseChannelEvent(
                    eventType, 
                    eventChannel, 
                    dataView, 
                    offset, 
                    currentTime
                );
                offset = event.nextOffset;
                channel = eventChannel;
            }
            
            if (event && event.type !== 'unknown') {
                delete event.nextOffset;
                events.push(event);
            }
        }
        
        return {
            info: {
                index: trackIndex,
                name: trackName,
                channel: channel,
                eventCount: events.length
            },
            events: events,
            nextOffset: trackEnd
        };
    }

    /**
     * Parse un événement de canal
     * @private
     */
    parseChannelEvent(eventType, channel, dataView, offset, time) {
        const byte1 = dataView.getUint8(offset++);
        let byte2 = 0;
        let nextOffset = offset;
        
        // La plupart des événements ont 2 data bytes
        if (eventType !== 0xC0 && eventType !== 0xD0) {
            byte2 = dataView.getUint8(offset++);
            nextOffset = offset;
        }
        
        const event = {
            id: this.generateEventId(),
            time: time,
            channel: channel,
            nextOffset: nextOffset
        };
        
        switch (eventType) {
            case 0x80: // Note Off
                event.type = 'noteOff';
                event.note = byte1;
                event.velocity = byte2;
                break;
                
            case 0x90: // Note On
                // Note On avec velocity 0 = Note Off
                if (byte2 === 0) {
                    event.type = 'noteOff';
                    event.note = byte1;
                    event.velocity = 0;
                } else {
                    event.type = 'noteOn';
                    event.note = byte1;
                    event.velocity = byte2;
                    event.duration = 0; // À calculer plus tard
                }
                break;
                
            case 0xA0: // Polyphonic Aftertouch
                event.type = 'polyAftertouch';
                event.note = byte1;
                event.pressure = byte2;
                break;
                
            case 0xB0: // Control Change
                event.type = 'cc';
                event.controller = byte1;
                event.value = byte2;
                break;
                
            case 0xC0: // Program Change
                event.type = 'programChange';
                event.program = byte1;
                break;
                
            case 0xD0: // Channel Aftertouch
                event.type = 'channelAftertouch';
                event.pressure = byte1;
                break;
                
            case 0xE0: // Pitch Bend
                event.type = 'pitchBend';
                event.value = (byte2 << 7) | byte1;
                break;
                
            default:
                event.type = 'unknown';
                break;
        }
        
        return event;
    }

    /**
     * Parse un meta event
     * @private
     */
    parseMetaEvent(metaType, data, time) {
        const event = {
            id: this.generateEventId(),
            time: time,
            type: 'meta'
        };
        
        switch (metaType) {
            case 0x00: // Sequence Number
                event.metaType = 'sequenceNumber';
                event.number = (data[0] << 8) | data[1];
                break;
                
            case 0x01: // Text
            case 0x02: // Copyright
            case 0x03: // Track Name
            case 0x04: // Instrument Name
            case 0x05: // Lyric
            case 0x06: // Marker
            case 0x07: // Cue Point
                event.metaType = ['text', 'copyright', 'trackName', 'instrumentName', 
                                 'lyric', 'marker', 'cuePoint'][metaType - 1];
                event.text = new TextDecoder().decode(data);
                break;
                
            case 0x20: // MIDI Channel Prefix
                event.metaType = 'channelPrefix';
                event.channel = data[0];
                break;
                
            case 0x2F: // End of Track
                event.metaType = 'endOfTrack';
                break;
                
            case 0x51: // Set Tempo
                event.metaType = 'setTempo';
                event.tempo = (data[0] << 16) | (data[1] << 8) | data[2];
                event.bpm = Math.round(60000000 / event.tempo);
                break;
                
            case 0x54: // SMPTE Offset
                event.metaType = 'smpteOffset';
                event.hours = data[0];
                event.minutes = data[1];
                event.seconds = data[2];
                event.frames = data[3];
                event.subframes = data[4];
                break;
                
            case 0x58: // Time Signature
                event.metaType = 'timeSignature';
                event.numerator = data[0];
                event.denominator = Math.pow(2, data[1]);
                event.clocksPerClick = data[2];
                event.thirtySecondsPer24Clocks = data[3];
                break;
                
            case 0x59: // Key Signature
                event.metaType = 'keySignature';
                event.key = data[0]; // -7 Ã  +7
                event.scale = data[1]; // 0=major, 1=minor
                break;
                
            case 0x7F: // Sequencer Specific
                event.metaType = 'sequencerSpecific';
                event.data = Array.from(data);
                break;
                
            default:
                event.metaType = 'unknown';
                event.data = Array.from(data);
                break;
        }
        
        return event;
    }

    /**
     * Lit un nombre de longueur variable
     * @private
     */
    readVariableLength(dataView, offset) {
        let value = 0;
        let byte;
        
        do {
            byte = dataView.getUint8(offset++);
            value = (value << 7) | (byte & 0x7F);
        } while (byte & 0x80);
        
        return { value, nextOffset: offset };
    }

    /**
     * Extrait les métadonnées
     * @private
     */
    extractMetadata(events, header) {
        const metadata = {
            title: '',
            composer: '',
            copyright: '',
            tempo: 120,
            timeSignature: { numerator: 4, denominator: 4 },
            keySignature: { key: 0, scale: 0 },
            duration: 0,
            totalTicks: 0
        };
        
        // Chercher dans les meta events
        for (const event of events) {
            if (event.type === 'meta') {
                switch (event.metaType) {
                    case 'trackName':
                    case 'text':
                        if (!metadata.title) metadata.title = event.text;
                        break;
                    case 'copyright':
                        metadata.copyright = event.text;
                        break;
                    case 'setTempo':
                        metadata.tempo = event.bpm;
                        break;
                    case 'timeSignature':
                        metadata.timeSignature = {
                            numerator: event.numerator,
                            denominator: event.denominator
                        };
                        break;
                    case 'keySignature':
                        metadata.keySignature = {
                            key: event.key,
                            scale: event.scale
                        };
                        break;
                }
            }
        }
        
        // Calculer durée
        if (events.length > 0) {
            metadata.totalTicks = events[events.length - 1].time;
            
            // Convertir ticks en millisecondes
            const ticksPerBeat = header.division;
            const beatsPerSecond = metadata.tempo / 60;
            const secondsPerTick = 1 / (ticksPerBeat * beatsPerSecond);
            metadata.duration = Math.round(metadata.totalTicks * secondsPerTick * 1000);
        }
        
        return metadata;
    }

    // ========================================================================
    // JSON → MIDI
    // ========================================================================

    /**
     * Convertit JSON en fichier MIDI binaire
     * @param {Object} jsonMidi - JsonMidi
     * @returns {ArrayBuffer} Données MIDI binaires
     */
    async jsonToMidi(jsonMidi) {
        this.logger.info('MidiJsonConverter', 'Converting JSON to MIDI...');
        
        // Valider
        if (!this.validate(jsonMidi).valid) {
            throw new Error('Invalid JsonMidi structure');
        }
        
        // Construire le fichier MIDI
        const chunks = [];
        
        // Header chunk
        chunks.push(this.createMidiHeader(jsonMidi));
        
        // Track chunks
        const tracks = this.organizeEventsIntoTracks(jsonMidi);
        
        for (const track of tracks) {
            chunks.push(this.createMidiTrack(track, jsonMidi.division));
        }
        
        // Fusionner tous les chunks
        const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
        const midiData = new Uint8Array(totalLength);
        
        let offset = 0;
        for (const chunk of chunks) {
            midiData.set(chunk, offset);
            offset += chunk.length;
        }
        
        this.logger.info('MidiJsonConverter', `✓ Generated ${midiData.length} bytes`);
        
        return midiData.buffer;
    }

    /**
     * Crée le header MIDI
     * @private
     */
    createMidiHeader(jsonMidi) {
        const header = new Uint8Array(14);
        const view = new DataView(header.buffer);
        
        // "MThd"
        header[0] = 0x4D; // M
        header[1] = 0x54; // T
        header[2] = 0x68; // h
        header[3] = 0x64; // d
        
        // Length (always 6)
        view.setUint32(4, 6);
        
        // Format
        view.setUint16(8, jsonMidi.midiFormat || 1);
        
        // Number of tracks
        view.setUint16(10, jsonMidi.tracks.length);
        
        // Division (ticks per quarter note)
        view.setUint16(12, jsonMidi.division || 480);
        
        return header;
    }

    /**
     * Organise les événements en tracks
     * @private
     */
    organizeEventsIntoTracks(jsonMidi) {
        const tracks = [];
        
        // Si format 0, tous les événements dans un track
        if (jsonMidi.midiFormat === 0) {
            tracks.push(jsonMidi.timeline);
            return tracks;
        }
        
        // Sinon, organiser par canal/track
        const trackMap = new Map();
        
        for (const event of jsonMidi.timeline) {
            const trackIndex = event.track || event.channel || 0;
            
            if (!trackMap.has(trackIndex)) {
                trackMap.set(trackIndex, []);
            }
            
            trackMap.get(trackIndex).push(event);
        }
        
        // Convertir en array
        for (const [, events] of trackMap) {
            events.sort((a, b) => a.time - b.time);
            tracks.push(events);
        }
        
        return tracks;
    }

    /**
     * Crée un track MIDI
     * @private
     */
    createMidiTrack(events, division) {
        const trackData = [];
        
        let currentTime = 0;
        
        for (const event of events) {
            // Delta time
            const deltaTime = event.time - currentTime;
            trackData.push(...this.writeVariableLength(deltaTime));
            currentTime = event.time;
            
            // Event data
            trackData.push(...this.encodeEvent(event));
        }
        
        // End of track
        trackData.push(...this.writeVariableLength(0)); // Delta time = 0
        trackData.push(0xFF, 0x2F, 0x00); // Meta event: End of Track
        
        // Créer le chunk
        const track = new Uint8Array(8 + trackData.length);
        const view = new DataView(track.buffer);
        
        // "MTrk"
        track[0] = 0x4D; // M
        track[1] = 0x54; // T
        track[2] = 0x72; // r
        track[3] = 0x6B; // k
        
        // Length
        view.setUint32(4, trackData.length);
        
        // Data
        track.set(trackData, 8);
        
        return track;
    }

    /**
     * Encode un événement
     * @private
     */
    encodeEvent(event) {
        const data = [];
        
        switch (event.type) {
            case 'noteOn':
                data.push(0x90 | (event.channel || 0));
                data.push(event.note);
                data.push(event.velocity);
                break;
                
            case 'noteOff':
                data.push(0x80 | (event.channel || 0));
                data.push(event.note);
                data.push(event.velocity || 64);
                break;
                
            case 'cc':
                data.push(0xB0 | (event.channel || 0));
                data.push(event.controller);
                data.push(event.value);
                break;
                
            case 'programChange':
                data.push(0xC0 | (event.channel || 0));
                data.push(event.program);
                break;
                
            case 'pitchBend':
                data.push(0xE0 | (event.channel || 0));
                data.push(event.value & 0x7F);
                data.push((event.value >> 7) & 0x7F);
                break;
                
            case 'meta':
                data.push(0xFF);
                data.push(...this.encodeMetaEvent(event));
                break;
        }
        
        return data;
    }

    /**
     * Encode un meta event
     * @private
     */
    encodeMetaEvent(event) {
        const data = [];
        
        switch (event.metaType) {
            case 'setTempo':
                data.push(0x51, 0x03);
                const tempo = event.tempo || Math.round(60000000 / event.bpm);
                data.push((tempo >> 16) & 0xFF);
                data.push((tempo >> 8) & 0xFF);
                data.push(tempo & 0xFF);
                break;
                
            case 'timeSignature':
                data.push(0x58, 0x04);
                data.push(event.numerator);
                data.push(Math.log2(event.denominator));
                data.push(event.clocksPerClick || 24);
                data.push(event.thirtySecondsPer24Clocks || 8);
                break;
                
            case 'trackName':
                data.push(0x03);
                const nameBytes = new TextEncoder().encode(event.text);
                data.push(...this.writeVariableLength(nameBytes.length));
                data.push(...nameBytes);
                break;
        }
        
        return data;
    }

    /**
     * Ã‰crit un nombre de longueur variable
     * @private
     */
    writeVariableLength(value) {
        const bytes = [];
        
        if (value === 0) {
            return [0];
        }
        
        while (value > 0) {
            bytes.unshift(value & 0x7F);
            value >>= 7;
        }
        
        for (let i = 0; i < bytes.length - 1; i++) {
            bytes[i] |= 0x80;
        }
        
        return bytes;
    }

    // ========================================================================
    // VALIDATION
    // ========================================================================

    /**
     * Valide une structure JsonMidi
     * @param {Object} jsonMidi - JsonMidi Ã  valider
     * @returns {Object} {valid: boolean, errors: string[]}
     */
    validate(jsonMidi) {
        const errors = [];

        if (!jsonMidi.format || jsonMidi.format !== this.format) {
            errors.push('Invalid or missing format field');
        }

        if (!Array.isArray(jsonMidi.timeline)) {
            errors.push('Timeline must be an array');
        }

        if (!jsonMidi.metadata || typeof jsonMidi.metadata.tempo !== 'number') {
            errors.push('Missing or invalid metadata.tempo');
        }

        // Vérifier événements
        const ids = new Set();
        
        if (jsonMidi.timeline) {
            jsonMidi.timeline.forEach((event, index) => {
                if (!event.type) {
                    errors.push(`Event ${index}: missing type`);
                }
                if (event.time === undefined || typeof event.time !== 'number') {
                    errors.push(`Event ${index}: missing or invalid time`);
                }
                if (event.id && ids.has(event.id)) {
                    errors.push(`Event ${index}: duplicate ID ${event.id}`);
                }
                if (event.id) ids.add(event.id);
            });
        }

        return {
            valid: errors.length === 0,
            errors: errors
        };
    }

    // ========================================================================
    // HELPERS
    // ========================================================================

    /**
     * Génère un ID unique pour un événement
     * @private
     */
    generateEventId() {
        return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
}

// ============================================================================
// EXPORT
// ============================================================================

if (typeof module !== 'undefined' && module.exports) {
    module.exports = MidiJsonConverter;
}

if (typeof window !== 'undefined') {
    window.MidiJsonConverter = MidiJsonConverter;
}
window.MidiJsonConverter = MidiJsonConverter;
// ============================================================================
// FIN DU FICHIER MidiJsonConverter.js
// ============================================================================