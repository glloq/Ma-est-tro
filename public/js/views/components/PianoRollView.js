// ============================================================================
// Fichier: public/js/views/components/PianoRollView.js
// Version: v2.0.0 - Réécriture complète avec Canvas simple
// Description: Affiche les notes à venir pendant la lecture (sans grille)
// ============================================================================

class PianoRollView {
    constructor(eventBus, logger) {
        this.eventBus = eventBus;
        this.logger = logger;

        // État
        this.isVisible = false;
        this.isEnabled = false;
        this.isPlaying = false;

        // Données MIDI
        this.notes = [];           // Notes formatées pour l'affichage
        this.channels = [];        // Infos des canaux
        this.mutedChannels = new Set();

        // Timing - valeurs reçues de l'extérieur uniquement
        this.currentTimeMs = 0;    // Temps actuel en ms (de la source externe)
        this.durationMs = 0;       // Durée totale en ms

        // Paramètres d'affichage
        this.displayWindowMs = 5000;  // Fenêtre d'affichage: 5 secondes
        this.noteMinY = 21;           // Note MIDI min (A0)
        this.noteMaxY = 108;          // Note MIDI max (C8)

        // Canvas
        this.canvas = null;
        this.ctx = null;
        this.container = null;

        // Animation - flag simple
        this.animationId = null;

        // Couleurs des canaux
        this.channelColors = [
            '#FF0066', '#00FFFF', '#FF00FF', '#FFFF00',
            '#00FF00', '#FF6600', '#9D00FF', '#00FF99',
            '#FF0000', '#00BFFF', '#FFD700', '#FF1493',
            '#00FFAA', '#FF4500', '#7FFF00', '#FF69B4'
        ];
        this.mutedColor = '#444444';
        this.bgColor = '#1a1a1a';
        this.playheadColor = '#ffffff';

        this.init();
    }

    log(level, ...args) {
        const msg = `[PianoRollView] ${args.join(' ')}`;
        if (this.logger && this.logger[level]) {
            this.logger[level](msg);
        } else {
            console.log(msg);
        }
    }

    init() {
        this.createDOM();
        this.setupEvents();
        this.loadSettings();
        this.log('info', 'Initialized');
    }

    loadSettings() {
        try {
            const saved = localStorage.getItem('maestro_settings');
            if (saved) {
                const settings = JSON.parse(saved);
                this.isEnabled = settings.showPianoRoll || false;
                this.displayWindowMs = (settings.noteDisplayTime || 5) * 1000;
            }
        } catch (e) {
            this.log('error', 'Failed to load settings');
        }
    }

    createDOM() {
        this.container = document.createElement('div');
        this.container.id = 'piano-roll-view';
        this.container.className = 'piano-roll-view hidden';
        this.container.innerHTML = `
            <div class="piano-roll-view-header">
                <div class="piano-roll-view-title">
                    <span class="piano-roll-icon">🎹</span>
                    <span class="piano-roll-title-text">Piano Roll</span>
                </div>
                <div class="piano-roll-view-channels" id="pianoRollChannelButtons"></div>
            </div>
            <div class="piano-roll-view-content">
                <canvas id="pianoRollCanvas"></canvas>
            </div>
        `;

        const mainContainer = document.querySelector('.container');
        if (mainContainer) {
            mainContainer.appendChild(this.container);
        } else {
            document.body.appendChild(this.container);
        }

        this.canvas = document.getElementById('pianoRollCanvas');
        this.ctx = this.canvas.getContext('2d');
    }

    setupEvents() {
        if (!this.eventBus) return;

        // Activation/désactivation
        this.eventBus.on('settings:piano_roll_changed', (data) => {
            this.isEnabled = data.enabled;
            if (!this.isEnabled && this.isVisible) this.hide();
        });

        // Fichier MIDI chargé
        this.eventBus.on('file:selected', (data) => {
            if (data.midiData) {
                this.loadMidiData(data.midiData);
            }
        });

        // LECTURE - source externe de vérité
        this.eventBus.on('playback:play', () => {
            this.log('info', 'playback:play');
            this.isPlaying = true;
            if (this.isEnabled && this.notes.length > 0) {
                this.show();
            }
        });

        this.eventBus.on('playback:pause', () => {
            this.log('info', 'playback:pause');
            this.isPlaying = false;
            // Arrêt immédiat - pas d'animation
            this.stopAnimation();
        });

        this.eventBus.on('playback:stop', () => {
            this.log('info', 'playback:stop');
            this.isPlaying = false;
            this.currentTimeMs = 0;
            this.stopAnimation();
            this.hide();
        });

        // TEMPS - source externe uniquement
        this.eventBus.on('playback:time', (data) => {
            if (data.time !== undefined) {
                this.currentTimeMs = data.time * 1000; // Convertir s en ms
            }
            if (data.duration !== undefined) {
                this.durationMs = data.duration * 1000;
            }
            // Redessiner si visible et en lecture
            if (this.isVisible && this.isPlaying) {
                this.draw();
            }
        });

        // Mute canal
        this.eventBus.on('pianoroll:channel_toggled', (data) => {
            // Géré par les boutons locaux
        });
    }

    loadMidiData(midiData) {
        if (!midiData || !midiData.tracks) {
            this.notes = [];
            this.channels = [];
            return;
        }

        // Extraire tempo et PPQ
        const ticksPerBeat = midiData.ticksPerQuarter ||
                            midiData.header?.ticksPerBeat ||
                            midiData.ticksPerBeat || 480;
        let tempo = 120;

        // Chercher tempo
        for (const track of midiData.tracks) {
            const events = track.events || track;
            if (!Array.isArray(events)) continue;
            const tempoEvent = events.find(e =>
                e.type === 'setTempo' && e.microsecondsPerBeat
            );
            if (tempoEvent) {
                tempo = Math.round(60000000 / tempoEvent.microsecondsPerBeat);
                break;
            }
        }

        const msPerTick = 60000 / (tempo * ticksPerBeat);
        this.log('info', `Tempo: ${tempo} BPM, PPQ: ${ticksPerBeat}, msPerTick: ${msPerTick.toFixed(4)}`);

        // Extraire les notes
        this.notes = [];
        const channelSet = new Set();
        const channelPrograms = new Map();

        midiData.tracks.forEach(track => {
            const events = track.events || track;
            if (!Array.isArray(events)) return;

            const noteOns = {};
            let currentTick = 0;

            events.forEach(event => {
                if (event.deltaTime !== undefined) {
                    currentTick += event.deltaTime;
                }
                const tick = event.time !== undefined ? event.time : currentTick;
                const channel = event.channel || 0;

                // Program change
                if (event.type === 'programChange') {
                    channelPrograms.set(channel, event.programNumber || 0);
                }

                // Note on
                const noteNum = event.noteNumber ?? event.note ?? event.data1;
                const velocity = event.velocity ?? event.data2 ?? 0;

                if ((event.type === 'noteOn' || event.subtype === 'noteOn') && velocity > 0 && noteNum !== undefined) {
                    const key = `${channel}_${noteNum}`;
                    noteOns[key] = { tick, channel, note: noteNum, velocity };
                    channelSet.add(channel);
                }
                // Note off
                else if ((event.type === 'noteOff' || event.subtype === 'noteOff' ||
                         (event.type === 'noteOn' && velocity === 0)) && noteNum !== undefined) {
                    const key = `${channel}_${noteNum}`;
                    if (noteOns[key]) {
                        const on = noteOns[key];
                        this.notes.push({
                            startMs: on.tick * msPerTick,
                            endMs: tick * msPerTick,
                            note: on.note,
                            channel: on.channel,
                            velocity: on.velocity
                        });
                        delete noteOns[key];
                    }
                }
            });
        });

        // Trier par temps de début
        this.notes.sort((a, b) => a.startMs - b.startMs);

        // Calculer la plage de notes
        if (this.notes.length > 0) {
            let minNote = 127, maxNote = 0;
            this.notes.forEach(n => {
                if (n.note < minNote) minNote = n.note;
                if (n.note > maxNote) maxNote = n.note;
            });
            this.noteMinY = Math.max(0, minNote - 2);
            this.noteMaxY = Math.min(127, maxNote + 2);
        }

        // Construire infos canaux
        this.channels = Array.from(channelSet).sort((a, b) => a - b).map(ch => ({
            channel: ch,
            program: channelPrograms.get(ch) || 0
        }));

        this.renderChannelButtons();
        this.log('info', `Loaded ${this.notes.length} notes, ${this.channels.length} channels`);
    }

    renderChannelButtons() {
        const container = document.getElementById('pianoRollChannelButtons');
        if (!container) return;

        if (this.channels.length === 0) {
            container.innerHTML = '<span style="color:#666;font-style:italic">Aucun canal</span>';
            return;
        }

        container.innerHTML = this.channels.map(ch => {
            const isMuted = this.mutedChannels.has(ch.channel);
            const color = this.channelColors[ch.channel % 16];
            const style = isMuted
                ? 'background:#333;border-color:#555;color:#888;'
                : `background:${color};border-color:${color};color:#000;`;
            return `
                <button class="channel-btn ${isMuted ? 'muted' : ''}"
                        data-channel="${ch.channel}"
                        style="${style}">
                    Ch ${ch.channel + 1}
                </button>
            `;
        }).join('');

        container.querySelectorAll('.channel-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const ch = parseInt(btn.dataset.channel);
                this.toggleMute(ch);
            });
        });
    }

    toggleMute(channel) {
        if (this.mutedChannels.has(channel)) {
            this.mutedChannels.delete(channel);
        } else {
            this.mutedChannels.add(channel);
        }
        this.renderChannelButtons();

        // Émettre événement
        if (this.eventBus) {
            this.eventBus.emit('pianoroll:channel_toggled', {
                channel,
                muted: this.mutedChannels.has(channel)
            });
        }

        // Redessiner
        if (this.isVisible) this.draw();
    }

    show() {
        if (this.isVisible) return;
        this.isVisible = true;
        this.container.classList.remove('hidden');
        this.container.classList.add('fullscreen');

        // Cacher autres éléments
        const mainGrid = document.querySelector('.main-grid');
        if (mainGrid) mainGrid.classList.add('hidden-for-pianoroll');

        // Position sous le header
        requestAnimationFrame(() => {
            this.updatePosition();
            this.resizeCanvas();
            this.draw();
        });
    }

    hide() {
        this.isVisible = false;
        this.stopAnimation();
        this.container.classList.add('hidden');
        this.container.classList.remove('fullscreen');

        const mainGrid = document.querySelector('.main-grid');
        if (mainGrid) mainGrid.classList.remove('hidden-for-pianoroll');
    }

    updatePosition() {
        const header = document.querySelector('header');
        if (header && this.container) {
            const rect = header.getBoundingClientRect();
            this.container.style.top = `${rect.bottom + 8}px`;
        }
    }

    resizeCanvas() {
        if (!this.canvas) return;
        const content = this.canvas.parentElement;
        if (!content) return;

        const rect = content.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;

        this.canvas.width = rect.width * dpr;
        this.canvas.height = rect.height * dpr;
        this.canvas.style.width = `${rect.width}px`;
        this.canvas.style.height = `${rect.height}px`;

        this.ctx.scale(dpr, dpr);
    }

    stopAnimation() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
    }

    draw() {
        if (!this.ctx || !this.canvas) return;

        const width = this.canvas.width / (window.devicePixelRatio || 1);
        const height = this.canvas.height / (window.devicePixelRatio || 1);

        // Fond
        this.ctx.fillStyle = this.bgColor;
        this.ctx.fillRect(0, 0, width, height);

        if (this.notes.length === 0) {
            this.ctx.fillStyle = '#666';
            this.ctx.font = '14px sans-serif';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('Aucune note', width / 2, height / 2);
            return;
        }

        // Paramètres de rendu
        const currentMs = this.currentTimeMs;
        const windowMs = this.displayWindowMs;
        const startMs = currentMs;
        const endMs = currentMs + windowMs;

        const noteRange = this.noteMaxY - this.noteMinY;
        const noteHeight = Math.max(4, height / noteRange);

        // Position du playhead (bord gauche)
        const playheadX = 50; // Marge gauche pour le playhead

        // Dessiner les notes dans la fenêtre
        for (const note of this.notes) {
            // Hors fenêtre?
            if (note.endMs < startMs || note.startMs > endMs) continue;

            // Canal muté?
            const isMuted = this.mutedChannels.has(note.channel);

            // Position X (temps -> position)
            const relativeStartMs = note.startMs - currentMs;
            const relativeEndMs = note.endMs - currentMs;

            const x1 = playheadX + (relativeStartMs / windowMs) * (width - playheadX);
            const x2 = playheadX + (relativeEndMs / windowMs) * (width - playheadX);

            // Position Y (note -> position, inversé car Y=0 est en haut)
            const y = height - ((note.note - this.noteMinY) / noteRange) * height;

            // Couleur
            this.ctx.fillStyle = isMuted ? this.mutedColor : this.channelColors[note.channel % 16];

            // Dessiner la note
            const noteWidth = Math.max(2, x2 - x1);
            this.ctx.fillRect(x1, y - noteHeight / 2, noteWidth, noteHeight);
        }

        // Ligne du playhead
        this.ctx.strokeStyle = this.playheadColor;
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.moveTo(playheadX, 0);
        this.ctx.lineTo(playheadX, height);
        this.ctx.stroke();

        // Afficher le temps
        this.ctx.fillStyle = '#fff';
        this.ctx.font = '12px monospace';
        this.ctx.textAlign = 'left';
        const timeStr = this.formatTime(currentMs);
        this.ctx.fillText(timeStr, 5, 15);
    }

    formatTime(ms) {
        const s = Math.floor(ms / 1000);
        const m = Math.floor(s / 60);
        const sec = s % 60;
        return `${m}:${sec.toString().padStart(2, '0')}`;
    }

    destroy() {
        this.stopAnimation();
        if (this.container && this.container.parentNode) {
            this.container.parentNode.removeChild(this.container);
        }
    }
}

// Export
if (typeof window !== 'undefined') {
    window.PianoRollView = PianoRollView;
    console.log('✓ PianoRollView v2 loaded');
}
