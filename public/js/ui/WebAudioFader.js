/**
 * WebAudioFader - Vertical/Horizontal fader component
 * Inspired by webaudio-controls
 * Optimized for MIDI CC and audio parameters
 */

class WebAudioFader {
    constructor(container, options = {}) {
        this.container = typeof container === 'string' ? document.querySelector(container) : container;

        // Configuration
        this.options = {
            min: options.min ?? 0,
            max: options.max ?? 127,
            value: options.value ?? 64,
            step: options.step ?? 1,
            width: options.width ?? 40,
            height: options.height ?? 150,
            orientation: options.orientation || 'vertical', // 'vertical' or 'horizontal'
            colors: {
                bg: options.bgColor || '#34495e',
                track: options.trackColor || '#2c3e50',
                fill: options.fillColor || '#3498db',
                thumb: options.thumbColor || '#ecf0f1',
                label: options.labelColor || '#ecf0f1'
            },
            label: options.label || '',
            showValue: options.showValue !== false,
            sensitivity: options.sensitivity || 1,
            onChange: options.onChange || null,
            onInput: options.onInput || null
        };

        this.value = this.options.value;
        this.isDragging = false;
        this.startPos = 0;
        this.startValue = 0;

        this.init();
    }

    init() {
        const isVertical = this.options.orientation === 'vertical';

        // Create canvas
        this.canvas = document.createElement('canvas');
        this.canvas.width = isVertical ? this.options.width : this.options.height;
        this.canvas.height = isVertical ? this.options.height : this.options.width;

        // Add space for label and value
        if (this.options.label) {
            this.canvas.height += 20;
        }
        if (this.options.showValue) {
            this.canvas.height += 20;
        }

        this.canvas.className = 'webaudio-fader';
        this.canvas.style.cursor = isVertical ? 'ns-resize' : 'ew-resize';
        this.canvas.style.touchAction = 'none';

        this.ctx = this.canvas.getContext('2d');
        this.container.appendChild(this.canvas);

        // Bind events
        this.canvas.addEventListener('mousedown', this.onMouseDown.bind(this));
        this.canvas.addEventListener('touchstart', this.onTouchStart.bind(this), { passive: false });
        this.canvas.addEventListener('wheel', this.onWheel.bind(this), { passive: false });

        document.addEventListener('mousemove', this.onMouseMove.bind(this));
        document.addEventListener('mouseup', this.onMouseUp.bind(this));
        document.addEventListener('touchmove', this.onTouchMove.bind(this), { passive: false });
        document.addEventListener('touchend', this.onTouchEnd.bind(this));

        // Double-click to reset
        this.canvas.addEventListener('dblclick', () => {
            this.setValue((this.options.min + this.options.max) / 2);
        });

        this.render();
    }

    render() {
        const ctx = this.ctx;
        const isVertical = this.options.orientation === 'vertical';

        // Clear
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        const trackWidth = isVertical ? this.options.width - 16 : this.options.height - 16;
        const trackHeight = isVertical ? this.options.height - 40 : this.options.width - 16;
        const trackX = isVertical ? 8 : 8;
        const trackY = 8;

        // Background track
        ctx.fillStyle = this.options.colors.track;
        if (isVertical) {
            ctx.fillRect(trackX, trackY, trackWidth, trackHeight);
        } else {
            ctx.fillRect(trackX, trackY, trackHeight, trackWidth);
        }

        // Value fill
        const normalized = (this.value - this.options.min) / (this.options.max - this.options.min);

        ctx.fillStyle = this.options.colors.fill;
        if (isVertical) {
            const fillHeight = trackHeight * normalized;
            ctx.fillRect(trackX, trackY + trackHeight - fillHeight, trackWidth, fillHeight);
        } else {
            const fillWidth = trackHeight * normalized;
            ctx.fillRect(trackX, trackY, fillWidth, trackWidth);
        }

        // Thumb
        const thumbSize = isVertical ? trackWidth + 4 : trackWidth + 4;
        const thumbThickness = isVertical ? 8 : 8;

        ctx.fillStyle = this.options.colors.thumb;
        ctx.strokeStyle = this.options.colors.bg;
        ctx.lineWidth = 2;

        if (isVertical) {
            const thumbY = trackY + trackHeight - (trackHeight * normalized) - thumbThickness / 2;
            ctx.fillRect(trackX - 2, thumbY, thumbSize, thumbThickness);
            ctx.strokeRect(trackX - 2, thumbY, thumbSize, thumbThickness);
        } else {
            const thumbX = trackX + (trackHeight * normalized) - thumbThickness / 2;
            ctx.fillRect(thumbX, trackY - 2, thumbThickness, thumbSize);
            ctx.strokeRect(thumbX, trackY - 2, thumbThickness, thumbSize);
        }

        // Label
        if (this.options.label) {
            ctx.fillStyle = this.options.colors.label;
            ctx.font = '11px Arial';
            ctx.textAlign = 'center';
            const labelY = isVertical ? this.options.height - 15 : this.options.width + 15;
            ctx.fillText(this.options.label, this.canvas.width / 2, labelY);
        }

        // Value
        if (this.options.showValue) {
            ctx.fillStyle = this.options.colors.label;
            ctx.font = 'bold 10px monospace';
            ctx.textAlign = 'center';
            const valueY = isVertical ? this.options.height + 5 : this.options.width + 30;
            ctx.fillText(Math.round(this.value).toString(), this.canvas.width / 2, valueY);
        }
    }

    setValue(value, triggerEvent = true) {
        const oldValue = this.value;
        this.value = Math.max(this.options.min, Math.min(this.options.max, value));

        // Snap to step
        if (this.options.step) {
            this.value = Math.round(this.value / this.options.step) * this.options.step;
        }

        this.render();

        if (triggerEvent && this.value !== oldValue) {
            if (this.options.onChange) {
                this.options.onChange(this.value);
            }
        }
    }

    getValue() {
        return this.value;
    }

    onMouseDown(e) {
        const rect = this.canvas.getBoundingClientRect();
        const isVertical = this.options.orientation === 'vertical';

        this.isDragging = true;
        this.startPos = isVertical ? e.clientY : e.clientX;
        this.startValue = this.value;

        // Jump to clicked position
        const clickPos = isVertical ? e.clientY - rect.top : e.clientX - rect.left;
        const trackSize = isVertical ? this.options.height - 40 : this.options.height - 16;
        const normalized = isVertical ?
            1 - ((clickPos - 8) / trackSize) :
            (clickPos - 8) / trackSize;

        const newValue = this.options.min + (normalized * (this.options.max - this.options.min));
        this.setValue(Math.max(this.options.min, Math.min(this.options.max, newValue)));

        e.preventDefault();
    }

    onMouseMove(e) {
        if (!this.isDragging) return;

        const isVertical = this.options.orientation === 'vertical';
        const currentPos = isVertical ? e.clientY : e.clientX;
        const delta = isVertical ? (this.startPos - currentPos) : (currentPos - this.startPos);

        const range = this.options.max - this.options.min;
        const trackSize = isVertical ? this.options.height - 40 : this.options.height - 16;
        const newValue = this.startValue + (delta / trackSize) * range * this.options.sensitivity;

        this.setValue(newValue);

        if (this.options.onInput) {
            this.options.onInput(this.value);
        }

        this.startPos = currentPos;
        this.startValue = this.value;
    }

    onMouseUp() {
        this.isDragging = false;
    }

    onTouchStart(e) {
        const isVertical = this.options.orientation === 'vertical';
        this.isDragging = true;
        this.startPos = isVertical ? e.touches[0].clientY : e.touches[0].clientX;
        this.startValue = this.value;
        e.preventDefault();
    }

    onTouchMove(e) {
        if (!this.isDragging) return;

        const isVertical = this.options.orientation === 'vertical';
        const currentPos = isVertical ? e.touches[0].clientY : e.touches[0].clientX;
        const delta = isVertical ? (this.startPos - currentPos) : (currentPos - this.startPos);

        const range = this.options.max - this.options.min;
        const trackSize = isVertical ? this.options.height - 40 : this.options.height - 16;
        const newValue = this.startValue + (delta / trackSize) * range * this.options.sensitivity;

        this.setValue(newValue);

        if (this.options.onInput) {
            this.options.onInput(this.value);
        }

        this.startPos = currentPos;
        this.startValue = this.value;

        e.preventDefault();
    }

    onTouchEnd() {
        this.isDragging = false;
    }

    onWheel(e) {
        e.preventDefault();
        const delta = -e.deltaY * 0.01 * this.options.sensitivity;
        this.setValue(this.value + delta * this.options.step);
    }

    destroy() {
        this.canvas.remove();
    }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = WebAudioFader;
}
if (typeof window !== 'undefined') {
    window.WebAudioFader = WebAudioFader;
}
