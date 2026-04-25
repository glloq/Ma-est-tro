/**
 * @file HandsLookaheadStrip.js
 * @description Compact horizontal piano-roll showing the next
 * `windowSeconds` of upcoming notes during a HandsPreviewPanel
 * simulation. Keyboard families only — string instruments use the
 * fretboard (Feature E spec), so this component isn't mounted for
 * them.
 *
 * Visual: x = time (left = now, right = `windowSeconds` ahead);
 * y = pitch within the configured note range. Each upcoming note is
 * a coloured rectangle whose width equals its duration in the same
 * pixels-per-second scale. The "now" line stays anchored at x = 0.
 *
 * Data flow:
 *   - At construction, the caller provides the channel's notes
 *     `[{tick, note, duration?, channel?}]` (sorted by tick) plus
 *     a tempo helper (ticksPerSecond).
 *   - `setCurrentTime(currentSec)` from the engine drives the auto-
 *     scroll. Drawing uses a binary-search to find the slice in
 *     [now, now + windowSeconds] without re-walking the whole list.
 *
 * Public API:
 *   const strip = new HandsLookaheadStrip(canvas, {
 *     notes,            // array as above
 *     ticksPerSecond,   // (ticksPerBeat * bpm) / 60
 *     rangeMin, rangeMax,
 *     windowSeconds: 4
 *   });
 *   strip.setCurrentTime(currentSec);
 *   strip.setRange(min, max);
 *   strip.setUnplayableNotes([{note}]); // tinted red in upcoming view
 *   strip.destroy();
 */
(function() {
    'use strict';

    const DEFAULT_WINDOW_SECONDS = 4;

    class HandsLookaheadStrip {
        constructor(canvas, opts = {}) {
            this.canvas = canvas;
            this.ctx = canvas && typeof canvas.getContext === 'function'
                ? canvas.getContext('2d') : null;

            this.notes = Array.isArray(opts.notes) ? opts.notes.slice().sort((a, b) => a.tick - b.tick) : [];
            this.ticksPerSecond = Number.isFinite(opts.ticksPerSecond) && opts.ticksPerSecond > 0
                ? opts.ticksPerSecond : 480; // 120 bpm @ 480 ppq → 960 actually; sane default fallback
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
        //  Helpers
        // -----------------------------------------------------------------

        /** Index of the first note that ends at or after `sec`. */
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

            // Vertical "now" line at x=0 (left edge).
            ctx.strokeStyle = '#1d4ed8';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(0.5, 0);
            ctx.lineTo(0.5, h);
            ctx.stroke();

            const pixelsPerSec = w / this.windowSeconds;
            const pitchSpan = Math.max(1, this.rangeMax - this.rangeMin);
            const pixelsPerSemitone = h / pitchSpan;

            const start = this.currentSec;
            const end = start + this.windowSeconds;
            const i0 = this._firstVisibleIndex(start);

            for (let i = i0; i < this._noteTimes.length; i++) {
                const t = this._noteTimes[i];
                if (t.start > end) break; // sorted; nothing further is visible
                const x1 = (Math.max(t.start, start) - start) * pixelsPerSec;
                const x2 = (Math.min(t.start + t.duration, end) - start) * pixelsPerSec;
                const y = h - ((t.note - this.rangeMin + 0.5) * pixelsPerSemitone);
                const noteH = Math.max(2, pixelsPerSemitone * 0.9);
                const noteW = Math.max(2, x2 - x1);
                const isUnplayable = this.unplayableNotes.has(t.note);
                ctx.fillStyle = isUnplayable ? 'rgba(220, 38, 38, 0.85)' : 'rgba(59, 130, 246, 0.75)';
                ctx.fillRect(x1, y - noteH / 2, noteW, noteH);
                ctx.strokeStyle = isUnplayable ? '#b91c1c' : '#1e40af';
                ctx.lineWidth = 0.5;
                ctx.strokeRect(x1, y - noteH / 2, noteW, noteH);
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
