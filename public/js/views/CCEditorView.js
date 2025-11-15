// ============================================================================
// Fichier: frontend/js/views/CCEditorView.js
// Version: v4.0.0 - CONFORMITÃƒâ€° API
// Date: 2025-11-02
// ============================================================================

class CCEditorView extends BaseCanvasView {
    constructor(canvas, eventBus) {
        super(canvas, eventBus);
        
        this.state = {
            ccType: 1, // Modulation Wheel
            points: [],
            selectedPoint: null,
            draggedPoint: null
        };
        
        this.ccTypes = {
            1: 'Modulation',
            7: 'Volume',
            10: 'Pan',
            11: 'Expression',
            64: 'Sustain',
            74: 'Brightness'
        };
    }
    
    init() {
        if (!this.canvas) return;
        
        this.ctx = this.canvas.getContext('2d');
        this.attachEvents();
        this.render();
    }
    
    attachEvents() {
        this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        this.canvas.addEventListener('mouseup', (e) => this.handleMouseUp(e));
        
        if (!this.eventBus) return;
        
        this.eventBus.on('editor:cc_loaded', (data) => {
            this.state.points = data.points || [];
            this.render();
        });
    }
    
    render() {
        if (!this.ctx) return;
        
        const ctx = this.ctx;
        const width = this.canvas.width;
        const height = this.canvas.height;
        
        ctx.fillStyle = '#1a1a2e';
        ctx.fillRect(0, 0, width, height);
        
        // Draw grid
        this.drawGrid(ctx, width, height);
        
        // Draw CC curve
        this.drawCurve(ctx, width, height);
        
        // Draw points
        this.drawPoints(ctx, width, height);
    }
    
    drawGrid(ctx, width, height) {
        ctx.strokeStyle = '#2a2a3e';
        ctx.lineWidth = 1;
        
        for (let y = 0; y < height; y += height / 8) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
            ctx.stroke();
        }
        
        for (let x = 0; x < width; x += width / 16) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
            ctx.stroke();
        }
    }
    
    drawCurve(ctx, width, height) {
        if (this.state.points.length < 2) return;
        
        ctx.strokeStyle = '#4a9eff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        
        this.state.points.forEach((point, i) => {
            const x = (point.time / 100) * width;
            const y = height - (point.value / 127) * height;
            
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        });
        
        ctx.stroke();
    }
    
    drawPoints(ctx, width, height) {
        this.state.points.forEach((point, i) => {
            const x = (point.time / 100) * width;
            const y = height - (point.value / 127) * height;
            
            ctx.fillStyle = this.state.selectedPoint === i ? '#fff' : '#4a9eff';
            ctx.beginPath();
            ctx.arc(x, y, 6, 0, Math.PI * 2);
            ctx.fill();
        });
    }
    
    handleMouseDown(e) {
        const point = this.getCanvasPoint(e);
        const index = this.findPointAt(point);
        
        if (index >= 0) {
            this.state.selectedPoint = index;
            this.state.draggedPoint = index;
        } else {
            this.addPoint(point);
        }
        
        this.render();
    }
    
    handleMouseMove(e) {
        if (this.state.draggedPoint === null) return;
        
        const point = this.getCanvasPoint(e);
        const time = (point.x / this.canvas.width) * 100;
        const value = Math.round((1 - point.y / this.canvas.height) * 127);
        
        this.state.points[this.state.draggedPoint] = {
            time: Math.max(0, Math.min(100, time)),
            value: Math.max(0, Math.min(127, value))
        };
        
        this.render();
    }
    
    handleMouseUp(e) {
        if (this.state.draggedPoint !== null && this.eventBus) {
            this.eventBus.emit('editor:cc_changed', {
                ccType: this.state.ccType,
                points: this.state.points
            });
        }
        
        this.state.draggedPoint = null;
    }
    
    addPoint(point) {
        const time = (point.x / this.canvas.width) * 100;
        const value = Math.round((1 - point.y / this.canvas.height) * 127);
        
        this.state.points.push({ time, value });
        this.state.points.sort((a, b) => a.time - b.time);
        
        if (this.eventBus) {
            this.eventBus.emit('editor:cc_changed', {
                ccType: this.state.ccType,
                points: this.state.points
            });
        }
    }
    
    findPointAt(point) {
        const threshold = 10;
        
        return this.state.points.findIndex(p => {
            const x = (p.time / 100) * this.canvas.width;
            const y = this.canvas.height - (p.value / 127) * this.canvas.height;
            const dx = point.x - x;
            const dy = point.y - y;
            return Math.sqrt(dx * dx + dy * dy) < threshold;
        });
    }
    
    getCanvasPoint(e) {
        const rect = this.canvas.getBoundingClientRect();
        return {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
    }
    
    setCCType(ccType) {
        this.state.ccType = ccType;
        
        if (this.eventBus) {
            this.eventBus.emit('editor:cc_type_changed', { ccType });
        }
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = CCEditorView;
}
if (typeof window !== 'undefined') {
    window.CCEditorView = CCEditorView;
}