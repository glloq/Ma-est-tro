// ============================================================================
// Fichier: frontend/js/views/components/Modal.js
// Version: v4.0.0
// ============================================================================

class Modal {
    constructor(eventBus) {
        this.eventBus = eventBus || window.eventBus || null;
        this.container = null;
        this.isOpen = false;
    }
    
    show(title, content, buttons = []) {
        this.close();
        
        this.container = document.createElement('div');
        this.container.className = 'modal-overlay';
        this.container.innerHTML = `
            <div class="modal-dialog">
                <div class="modal-header">
                    <h3>${title}</h3>
                    <button class="modal-close">&times;</button>
                </div>
                <div class="modal-body">${content}</div>
                <div class="modal-footer">
                    ${buttons.map(btn => `
                        <button class="btn ${btn.class || ''}" data-action="${btn.action}">
                            ${btn.label}
                        </button>
                    `).join('')}
                </div>
            </div>
        `;
        
        document.body.appendChild(this.container);
        this.isOpen = true;
        
        this.container.querySelector('.modal-close').addEventListener('click', () => this.close());
        this.container.addEventListener('click', (e) => {
            if (e.target === this.container) this.close();
        });
        
        buttons.forEach(btn => {
            const el = this.container.querySelector(`[data-action="${btn.action}"]`);
            if (el && btn.handler) {
                el.addEventListener('click', () => {
                    btn.handler();
                    if (btn.closeOnClick !== false) this.close();
                });
            }
        });
    }
    
    close() {
        if (this.container) {
            this.container.remove();
            this.container = null;
        }
        this.isOpen = false;
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = Modal;
}
if (typeof window !== 'undefined') {
    window.Modal = Modal;
}