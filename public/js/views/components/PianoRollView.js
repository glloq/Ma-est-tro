// ============================================================================
// Fichier: public/js/views/components/PianoRollView.js
// Version: v3.0.0 - Synchronisation par ticks (pas de conversion temps)
// ============================================================================

class PianoRollView {
    constructor(eventBus, logger) {
        this.eventBus = eventBus;
        this.logger = logger;

        // État
        this.isVisible = false;
        this.isEnabled = false;
        this.isPlaying = false;

        // Données MIDI - stockées en TICKS (pas en ms)
        this.notes = [];
        this.channels = [];
        this.mutedChannels = new Set();

        // Timing - reçu de la source externe
        this.currentTick = 0;
        this.tempo = 120;
        this.ticksPerBeat = 480;

        // Fenêtre d'affichage en secondes (converti en ticks à l'usage)
        this.displayWindowSeconds = 5;

        // Plage de notes
        this.noteMin = 21;
        this.noteMax = 108;

        // Canvas
        this.canvas = null;
        this.ctx = null;
        this.container = null;

        // Couleurs
        this.channelColors = [
            '#FF0066', '#00FFFF', '#FF00FF', '#FFFF00',
            '#00FF00', '#FF6600', '#9D00FF', '#00FF99',
            '#FF0000', '#00BFFF', '#FFD700', '#FF1493',
            '#00FFAA', '#FF4500', '#7FFF00', '#FF69B4'
        ];
        this.mutedColor = '#444';
        this.bgColor = '#111';

        this.init();
    }

    log(level, msg) {
        const text = `[PianoRoll] ${msg}`;
        if (this.logger && this.logger[level]) {
            this.logger[level](text);
        } else {
            console.log(text);
        }
    }

    init() {
        this.createDOM();
        this.setupEvents();
        this.loadSettings();
        this.log('info', 'v3 initialized');
    }

    loadSettings() {
        try {
            const saved = localStorage.getItem('maestro_settings');
            if (saved) {
                const s = JSON.parse(saved);
                this.isEnabled = s.showPianoRoll || false;
                this.displayWindowSeconds = s.noteDisplayTime || 5;
            }
        } catch (e) {}
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
                <div class="piano-roll-view-channels" id="pianoRollChannelBtns"></div>
            </div>
            <div class="piano-roll-view-content">
                <canvas id="pianoRollCanvas"></canvas>
            </div>
        `;

        const main = document.querySelector('.container');
        if (main) main.appendChild(this.container);
        else document.body.appendChild(this.container);

        this.canvas = document.getElementById('pianoRollCanvas');
        this.ctx = this.canvas.getContext('2d');
    }

    setupEvents() {
        if (!this.eventBus) return;

        // Settings
        this.eventBus.on('settings:piano_roll_changed', (d) => {
            this.isEnabled = d.enabled;
            if (!this.isEnabled && this.isVisible) this.hide();
        });

        // Fichier chargé - UTILISER tempo et ticksPerBeat de la source
        this.eventBus.on('file:selected', (data) => {
            if (data.tempo) this.tempo = data.tempo;
            if (data.ticksPerBeat) this.ticksPerBeat = data.ticksPerBeat;
            this.log('info', `Tempo from source: ${this.tempo} BPM, PPQ: ${this.ticksPerBeat}`);
            if (data.midiData) {
                this.loadMidiData(data.midiData);
            }
        });

        // Play
        this.eventBus.on('playback:play', () => {
            this.isPlaying = true;
            if (this.isEnabled && this.notes.length > 0) {
                this.show();
            }
        });

        // Pause - arrêt immédiat
        this.eventBus.on('playback:pause', () => {
            this.isPlaying = false;
        });

        // Stop
        this.eventBus.on('playback:stop', () => {
            this.isPlaying = false;
            this.currentTick = 0;
            this.hide();
        });

        // Temps - UTILISER tick directement, pas de conversion
        this.eventBus.on('playback:time', (data) => {
            if (data.tick !== undefined) {
                this.currentTick = data.tick;
            } else if (data.time !== undefined) {
                // Fallback: convertir temps en ticks avec le tempo de la source
                const ticksPerSecond = (this.ticksPerBeat * this.tempo) / 60;
                this.currentTick = data.time * ticksPerSecond;
            }

            // Redessiner si visible
            if (this.isVisible) {
                this.draw();
            }
        });
    }

    loadMidiData(midiData) {
        if (!midiData || !midiData.tracks) {
            this.notes = [];
            this.channels = [];
            return;
        }

        // Parser les notes - stocker en TICKS
        this.notes = [];
        const channelSet = new Set();
        const noteOns = {};

        midiData.tracks.forEach(track => {
            const events = track.events || track;
            if (!Array.isArray(events)) return;

            let tick = 0;
            events.forEach(event => {
                if (event.deltaTime !== undefined) {
                    tick += event.deltaTime;
                }
                const t = event.time !== undefined ? event.time : tick;
                const ch = event.channel || 0;
                const note = event.noteNumber ?? event.note ?? event.data1;
                const vel = event.velocity ?? event.data2 ?? 0;

                if ((event.type === 'noteOn' || event.subtype === 'noteOn') && vel > 0 && note !== undefined) {
                    noteOns[`${ch}_${note}`] = { t, ch, note, vel };
                    channelSet.add(ch);
                } else if ((event.type === 'noteOff' || event.subtype === 'noteOff' ||
                           (event.type === 'noteOn' && vel === 0)) && note !== undefined) {
                    const key = `${ch}_${note}`;
                    if (noteOns[key]) {
                        const on = noteOns[key];
                        this.notes.push({
                            startTick: on.t,
                            endTick: t,
                            note: on.note,
                            channel: on.ch
                        });
                        delete noteOns[key];
                    }
                }
            });
        });

        this.notes.sort((a, b) => a.startTick - b.startTick);

        // Plage de notes
        if (this.notes.length > 0) {
            let minN = 127, maxN = 0;
            this.notes.forEach(n => {
                if (n.note < minN) minN = n.note;
                if (n.note > maxN) maxN = n.note;
            });
            this.noteMin = Math.max(0, minN - 2);
            this.noteMax = Math.min(127, maxN + 2);
        }

        this.channels = Array.from(channelSet).sort((a, b) => a - b).map(ch => ({ channel: ch }));
        this.renderButtons();
        this.log('info', `Loaded ${this.notes.length} notes`);
    }

    renderButtons() {
        const c = document.getElementById('pianoRollChannelBtns');
        if (!c) return;

        if (this.channels.length === 0) {
            c.innerHTML = '<span style="color:#666">Aucun canal</span>';
            return;
        }

        c.innerHTML = this.channels.map(ch => {
            const muted = this.mutedChannels.has(ch.channel);
            const color = this.channelColors[ch.channel % 16];
            return `<button class="channel-btn" data-ch="${ch.channel}"
                style="background:${muted ? '#333' : color};border-color:${muted ? '#555' : color};color:${muted ? '#888' : '#000'}">
                Ch ${ch.channel + 1}</button>`;
        }).join('');

        c.querySelectorAll('.channel-btn').forEach(btn => {
            btn.onclick = () => this.toggleMute(parseInt(btn.dataset.ch));
        });
    }

    toggleMute(ch) {
        if (this.mutedChannels.has(ch)) this.mutedChannels.delete(ch);
        else this.mutedChannels.add(ch);
        this.renderButtons();
        if (this.eventBus) {
            this.eventBus.emit('pianoroll:channel_toggled', { channel: ch, muted: this.mutedChannels.has(ch) });
        }
        if (this.isVisible) this.draw();
    }

    show() {
        if (this.isVisible) return;
        this.isVisible = true;
        this.container.classList.remove('hidden');
        this.container.classList.add('fullscreen');

        const mainGrid = document.querySelector('.main-grid');
        if (mainGrid) mainGrid.classList.add('hidden-for-pianoroll');

        requestAnimationFrame(() => {
            const header = document.querySelector('header');
            if (header) this.container.style.top = `${header.getBoundingClientRect().bottom + 8}px`;
            this.resizeCanvas();
            this.draw();
        });
    }

    hide() {
        this.isVisible = false;
        this.container.classList.add('hidden');
        this.container.classList.remove('fullscreen');
        const mainGrid = document.querySelector('.main-grid');
        if (mainGrid) mainGrid.classList.remove('hidden-for-pianoroll');
    }

    resizeCanvas() {
        if (!this.canvas) return;
        const parent = this.canvas.parentElement;
        if (!parent) return;

        const rect = parent.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;

        this.canvas.width = rect.width * dpr;
        this.canvas.height = rect.height * dpr;
        this.canvas.style.width = `${rect.width}px`;
        this.canvas.style.height = `${rect.height}px`;

        this.ctx.setTransform(1, 0, 0, 1, 0, 0);
        this.ctx.scale(dpr, dpr);
    }

    draw() {
        if (!this.ctx || !this.canvas) return;

        const w = this.canvas.width / (window.devicePixelRatio || 1);
        const h = this.canvas.height / (window.devicePixelRatio || 1);

        // Fond
        this.ctx.fillStyle = this.bgColor;
        this.ctx.fillRect(0, 0, w, h);

        if (this.notes.length === 0) {
            this.ctx.fillStyle = '#666';
            this.ctx.font = '14px sans-serif';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('Aucune note', w / 2, h / 2);
            return;
        }

        // Calcul fenêtre en ticks
        const ticksPerSecond = (this.ticksPerBeat * this.tempo) / 60;
        const windowTicks = this.displayWindowSeconds * ticksPerSecond;

        const startTick = this.currentTick;
        const endTick = startTick + windowTicks;

        // Dimensions
        const noteRange = this.noteMax - this.noteMin;
        const noteH = Math.max(3, h / noteRange);
        const playheadX = 50;

        // Dessiner notes visibles
        for (const n of this.notes) {
            if (n.endTick < startTick || n.startTick > endTick) continue;

            const muted = this.mutedChannels.has(n.channel);

            // X position
            const x1 = playheadX + ((n.startTick - startTick) / windowTicks) * (w - playheadX);
            const x2 = playheadX + ((n.endTick - startTick) / windowTicks) * (w - playheadX);

            // Y position (inversé)
            const y = h - ((n.note - this.noteMin) / noteRange) * h;

            // Couleur
            this.ctx.fillStyle = muted ? this.mutedColor : this.channelColors[n.channel % 16];
            this.ctx.fillRect(x1, y - noteH / 2, Math.max(2, x2 - x1), noteH);
        }

        // Playhead
        this.ctx.strokeStyle = '#fff';
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.moveTo(playheadX, 0);
        this.ctx.lineTo(playheadX, h);
        this.ctx.stroke();

        // Temps
        const seconds = this.currentTick / ticksPerSecond;
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        this.ctx.fillStyle = '#fff';
        this.ctx.font = '12px monospace';
        this.ctx.textAlign = 'left';
        this.ctx.fillText(`${m}:${s.toString().padStart(2, '0')}`, 5, 15);
    }

    destroy() {
        if (this.container && this.container.parentNode) {
            this.container.parentNode.removeChild(this.container);
        }
    }
}

if (typeof window !== 'undefined') {
    window.PianoRollView = PianoRollView;
    console.log('✓ PianoRollView v3 loaded');
}
