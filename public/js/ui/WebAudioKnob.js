/**
 * WebAudioKnob - Rotary knob component for Web Audio controls
 * Inspired by webaudio-controls (https://github.com/g200kg/webaudio-controls)
 * Lightweight, performant, touch-friendly
 */

class WebAudioKnob {
    constructor(container, options = {}) {
        this.container = typeof container === 'string' ? document.querySelector(container) : container;

        // Configuration
        this.options = {
            min: options.min ?? 0,
            max: options.max ?? 127,
            value: options.value ?? 64,
            step: options.step ?? 1,
            size: options.size ?? 64,
            colors: {
                bg: options.bgColor || '#2c3e50',
                track: options.trackColor || '#34495e',
                fill: options.fillColor || '#3498db',
                pointer: options.pointerColor || '#ecf0f1',
                label: options.labelColor || '#ecf0f1'
            },
            label: options.label || '',
            showValue: options.showValue !== false,
            sensitivity: options.sensitivity || 1,
            sprites: options.sprites || null, // For sprite-based knobs
            onChange: options.onChange || null,
            onInput: options.onInput || null
        };

        this.value = this.options.value;
        this.isDragging = false;
        this.startY = 0;
        this.startValue = 0;

        this.init();
    }

    init() {
        // Create canvas element
        this.canvas = document.createElement('canvas');
        this.canvas.width = this.options.size;
        this.canvas.height = this.options.size + (this.options.label ? 20 : 0) + (this.options.showValue ? 20 : 0);
        this.canvas.className = 'webaudio-knob';
        this.canvas.style.cursor = 'ns-resize';
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
        const size = this.options.size;
        const centerX = size / 2;
        const centerY = size / 2;
        const radius = size / 2 - 4;

        // Clear canvas
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Background circle
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        ctx.fillStyle = this.options.colors.bg;
        ctx.fill();

        // Track
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius - 4, 0.75 * Math.PI, 2.25 * Math.PI);
        ctx.strokeStyle = this.options.colors.track;
        ctx.lineWidth = 6;
        ctx.lineCap = 'round';
        ctx.stroke();

        // Value arc
        const normalized = (this.value - this.options.min) / (this.options.max - this.options.min);
        const angle = 0.75 * Math.PI + (normalized * 1.5 * Math.PI);

        ctx.beginPath();
        ctx.arc(centerX, centerY, radius - 4, 0.75 * Math.PI, angle);
        ctx.strokeStyle = this.options.colors.fill;
        ctx.lineWidth = 6;
        ctx.lineCap = 'round';
        ctx.stroke();

        // Pointer
        const pointerAngle = angle - Math.PI / 2;
        const pointerLength = radius - 10;
        const pointerX = centerX + Math.cos(pointerAngle) * pointerLength;
        const pointerY = centerY + Math.sin(pointerAngle) * pointerLength;

        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.lineTo(pointerX, pointerY);
        ctx.strokeStyle = this.options.colors.pointer;
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.stroke();

        // Center dot
        ctx.beginPath();
        ctx.arc(centerX, centerY, 4, 0, Math.PI * 2);
        ctx.fillStyle = this.options.colors.pointer;
        ctx.fill();

        // Label
        if (this.options.label) {
            ctx.fillStyle = this.options.colors.label;
            ctx.font = '12px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(this.options.label, centerX, size + 15);
        }

        // Value display
        if (this.options.showValue) {
            ctx.fillStyle = this.options.colors.label;
            ctx.font = 'bold 11px monospace';
            ctx.textAlign = 'center';
            const valueY = this.options.label ? size + 35 : size + 15;
            ctx.fillText(Math.round(this.value).toString(), centerX, valueY);
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
        this.isDragging = true;
        this.startY = e.clientY;
        this.startValue = this.value;
        e.preventDefault();
    }

    onMouseMove(e) {
        if (!this.isDragging) return;

        const delta = (this.startY - e.clientY) * this.options.sensitivity;
        const range = this.options.max - this.options.min;
        const newValue = this.startValue + (delta / 100) * range;

        this.setValue(newValue);

        if (this.options.onInput) {
            this.options.onInput(this.value);
        }
    }

    onMouseUp() {
        this.isDragging = false;
    }

    onTouchStart(e) {
        this.isDragging = true;
        this.startY = e.touches[0].clientY;
        this.startValue = this.value;
        e.preventDefault();
    }

    onTouchMove(e) {
        if (!this.isDragging) return;

        const delta = (this.startY - e.touches[0].clientY) * this.options.sensitivity;
        const range = this.options.max - this.options.min;
        const newValue = this.startValue + (delta / 100) * range;

        this.setValue(newValue);

        if (this.options.onInput) {
            this.options.onInput(this.value);
        }

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
    module.exports = WebAudioKnob;
}
if (typeof window !== 'undefined') {
    window.WebAudioKnob = WebAudioKnob;
}
