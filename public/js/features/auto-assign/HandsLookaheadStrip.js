/**
 * @file HandsLookaheadStrip.js
 * @description Vertical "Synthesia-style" piano-roll showing the
 * next `windowSeconds` of upcoming notes during a HandsPreviewPanel
 * simulation. Keyboard families only — string instruments use the
 * fretboard (Feature E spec), so this component isn't mounted for
 * them.
 *
 * Visual:
 *   - x = pitch, aligned with the KeyboardPreview underneath. Each
 *     note renders directly ABOVE the key it will play.
 *   - y = time. Bottom of canvas = NOW (the moment the note hits
 *     the key); top of canvas = `windowSeconds` ahead.
 *   - As the simulation advances, notes fall toward the keyboard.
 *
 * The strip MUST share the same `rangeMin`/`rangeMax` as the
 * KeyboardPreview below it; HandsPreviewPanel passes them through
 * so both widgets agree on the white-key-index → x mapping.
 *
 * Public API:
 *   const strip = new HandsLookaheadStrip(canvas, {
 *     notes,            // [{tick, note, duration?, channel?}]
 *     ticksPerSecond,   // (ticksPerBeat * bpm) / 60
 *     rangeMin, rangeMax,
 *     windowSeconds: 4
 *   });
 *   strip.setCurrentTime(currentSec);
 *   strip.setRange(min, max);
 *   strip.setUnplayableNotes([{note} | midi]);
 *   strip.destroy();
 */
(function() {
    'use strict';

    const DEFAULT_WINDOW_SECONDS = 4;
    const BLACK_OFFSETS = new Set([1, 3, 6, 8, 10]);

    function isBlackKey(midi) {
        return BLACK_OFFSETS.has(((midi % 12) + 12) % 12);
    }

    function whiteKeyCount(rangeMin, rangeMax) {
        let n = 0;
        for (let m = rangeMin; m <= rangeMax; m++) if (!isBlackKey(m)) n++;
        return n;
    }

    class HandsLookaheadStrip {
        constructor(canvas, opts = {}) {
            this.canvas = canvas;
            this.ctx = canvas && typeof canvas.getContext === 'function'
                ? canvas.getContext('2d') : null;

            this.notes = Array.isArray(opts.notes) ? opts.notes.slice().sort((a, b) => a.tick - b.tick) : [];
            this.ticksPerSecond = Number.isFinite(opts.ticksPerSecond) && opts.ticksPerSecond > 0
                ? opts.ticksPerSecond : 480;
            this.rangeMin = Number.isFinite(opts.rangeMin) ? opts.rangeMin : 36;
            this.rangeMax = Number.isFinite(opts.rangeMax) ? opts.rangeMax : 96;
            this.windowSeconds = Math.max(1, Math.min(10,
                Number.isFinite(opts.windowSeconds) ? opts.windowSeconds : DEFAULT_WINDOW_SECONDS));

            this.currentSec = 0;
            this.unplayableNotes = new Set();

            // Pre-compute tick→sec for each note so we can binary-search by sec.
            this._noteTimes = this.notes.map(n => ({
                start: n.tick / this.ticksPerSecond,
                duration: (n.duration || 0) / this.ticksPerSecond,
                note: n.note,
                channel: n.channel
            }));
        }

        setCurrentTime(currentSec) {
            this.currentSec = Math.max(0, Number.isFinite(currentSec) ? currentSec : 0);
            this.draw();
        }

        setRange(min, max) {
            const lo = Math.max(0, Math.min(127, Number.isFinite(min) ? min : this.rangeMin));
            const hi = Math.max(0, Math.min(127, Number.isFinite(max) ? max : this.rangeMax));
            this.rangeMin = Math.min(lo, hi);
            this.rangeMax = Math.max(lo, hi);
            this.draw();
        }

        setWindowSeconds(seconds) {
            const s = Number.isFinite(seconds) ? seconds : DEFAULT_WINDOW_SECONDS;
            this.windowSeconds = Math.max(1, Math.min(10, s));
            this.draw();
        }

        setUnplayableNotes(notes) {
            this.unplayableNotes = new Set();
            if (Array.isArray(notes)) {
                for (const e of notes) {
                    const n = Number.isFinite(e?.note) ? e.note : (Number.isFinite(e) ? e : null);
                    if (n != null) this.unplayableNotes.add(n);
                }
            }
            this.draw();
        }

        // -----------------------------------------------------------------
        //  Geometry helpers (same formulas as KeyboardPreview so the
        //  vertical alignment with the keys below is exact).
        // -----------------------------------------------------------------

        _whiteKeyWidth() {
            const w = (this.canvas?.clientWidth || this.canvas?.width) || 0;
            const count = Math.max(1, whiteKeyCount(this.rangeMin, this.rangeMax));
            return w / count;
        }

        /** White-key index relative to rangeMin (0-based) for `midi`. */
        _whiteIndexForMidi(midi) {
            let idx = 0;
            for (let m = this.rangeMin; m < midi; m++) if (!isBlackKey(m)) idx++;
            return idx;
        }

        /**
         * Return the [x, width] of the column above the given key.
         * White keys span a full white-width; black keys span 60%
         * of a white-width and sit on the boundary between adjacent
         * white keys — same offset as KeyboardPreview.
         */
        _columnFor(midi) {
            const ww = this._whiteKeyWidth();
            if (ww <= 0) return { x: 0, width: 0 };
            if (!isBlackKey(midi)) {
                return { x: this._whiteIndexForMidi(midi) * ww, width: ww };
            }
            return { x: this._whiteIndexForMidi(midi - 1) * ww + ww * 0.65, width: ww * 0.6 };
        }

        /** Index of the first note whose end is at or after `sec`. */
        _firstVisibleIndex(sec) {
            let lo = 0, hi = this._noteTimes.length;
            while (lo < hi) {
                const mid = (lo + hi) >> 1;
                const t = this._noteTimes[mid];
                if ((t.start + t.duration) < sec) lo = mid + 1;
                else hi = mid;
            }
            return lo;
        }

        // -----------------------------------------------------------------
        //  Rendering
        // -----------------------------------------------------------------

        draw() {
            if (!this.ctx || !this.canvas) return;
            const w = (this.canvas.clientWidth || this.canvas.width) || 0;
            const h = (this.canvas.clientHeight || this.canvas.height) || 0;
            if (w <= 0 || h <= 0) return;

            const dpr = (typeof window !== 'undefined' && window.devicePixelRatio) || 1;
            if (this.canvas.width !== Math.round(w * dpr) || this.canvas.height !== Math.round(h * dpr)) {
                this.canvas.width = Math.round(w * dpr);
                this.canvas.height = Math.round(h * dpr);
            }
            const ctx = this.ctx;
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

            // Background.
            ctx.fillStyle = '#f9fafb';
            ctx.fillRect(0, 0, w, h);

            // Now line — bottom edge of the canvas (where notes meet
            // the keyboard below).
            ctx.strokeStyle = '#1d4ed8';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(0,     h - 0.5);
            ctx.lineTo(w,     h - 0.5);
            ctx.stroke();

            const start = this.currentSec;
            const end = start + this.windowSeconds;
            const i0 = this._firstVisibleIndex(start);

            for (let i = i0; i < this._noteTimes.length; i++) {
                const t = this._noteTimes[i];
                if (t.start > end) break; // sorted; nothing further is visible
                if (t.note < this.rangeMin || t.note > this.rangeMax) continue;

                const dtStart = t.start - start;
                const dtEnd = (t.start + t.duration) - start;
                // y axis: bottom = now (dt = 0), top = window end (dt = windowSeconds).
                const yStart = h * (1 - dtStart / this.windowSeconds);
                const yEnd   = h * (1 - dtEnd   / this.windowSeconds);
                const yTop    = Math.max(0, Math.min(h, yEnd));
                const yBottom = Math.max(0, Math.min(h, yStart));
                const noteH = Math.max(2, yBottom - yTop);

                const col = this._columnFor(t.note);
                const isUnplayable = this.unplayableNotes.has(t.note);
                const fill = isUnplayable ? 'rgba(220, 38, 38, 0.85)' : 'rgba(59, 130, 246, 0.75)';
                const stroke = isUnplayable ? '#b91c1c' : '#1e40af';

                ctx.fillStyle = fill;
                ctx.fillRect(col.x, yTop, Math.max(2, col.width - 1), noteH);
                ctx.strokeStyle = stroke;
                ctx.lineWidth = 0.5;
                ctx.strokeRect(col.x + 0.5, yTop + 0.5, Math.max(1, col.width - 1.5), Math.max(1, noteH - 1));
            }
        }

        destroy() {
            this.notes = [];
            this._noteTimes = [];
            this.unplayableNotes.clear();
        }
    }

    if (typeof window !== 'undefined') {
        window.HandsLookaheadStrip = HandsLookaheadStrip;
    }
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = HandsLookaheadStrip;
    }
})();
