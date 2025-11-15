// ============================================================================
// Fichier: frontend/js/core/BaseCanvasView.js
// Version: v3.1.0
// Date: 2025-11-04
// ============================================================================
// Description:
//   Classe de base pour les vues utilisant un élément canvas.
//   Hérite de BaseView avec une résolution spécialisée pour les canvas.
//
// Signature:
//   constructor(canvas, eventBus)
//   - canvas: HTMLCanvasElement ou sélecteur CSS string
//   - eventBus: Instance EventBus
//
// Différences avec BaseView:
//   - Accepte un élément canvas directement (pas juste un containerId)
//   - Fournit un contexte 2D (this.ctx)
//   - Gestion automatique du resize
//   - Méthodes de rendu canvas spécialisées
// ============================================================================

class BaseCanvasView extends BaseView {
    /**
     * @param {HTMLCanvasElement|string} canvas - Élément canvas ou sélecteur CSS
     * @param {EventBus} eventBus - Instance EventBus
     */
    constructor(canvas, eventBus) {
        // Résoudre le canvas avant d'appeler super
        const resolvedCanvas = BaseCanvasView.resolveCanvas(canvas);
        
        // BaseView attend un containerId, on passe le canvas ou son parent
        const containerId = resolvedCanvas || canvas;
        super(containerId, eventBus);
        
        // Configuration canvas spécifique
        this.canvas = resolvedCanvas;
        this.ctx = this.canvas ? this.canvas.getContext('2d') : null;
        this.state = {};
        this.animationId = null;
        
        // Validation
        if (!this.canvas) {
            console.error(`[${this.constructor.name}] Canvas non disponible:`, canvas);
        }
        
        if (!this.ctx) {
            console.warn(`[${this.constructor.name}] Contexte 2D non disponible`);
        }
    }
    
    /**
     * Résout un canvas depuis différents formats
     * @param {HTMLCanvasElement|string} canvas - Canvas ou sélecteur
     * @returns {HTMLCanvasElement|null}
     */
    static resolveCanvas(canvas) {
        // Déjà un élément canvas
        if (canvas instanceof HTMLCanvasElement) {
            return canvas;
        }
        
        // Sélecteur CSS string
        if (typeof canvas === 'string') {
            const element = document.querySelector(canvas);
            if (element instanceof HTMLCanvasElement) {
                return element;
            }
            console.warn(`[BaseCanvasView] Sélecteur ne correspond pas à un canvas:`, canvas);
            return null;
        }
        
        // Type invalide
        console.error(`[BaseCanvasView] Type canvas invalide:`, typeof canvas);
        return null;
    }
    
    /**
     * Initialisation de la vue canvas
     */
    init() {
        if (!this.canvas) {
            console.warn(`[${this.constructor.name}] Canvas non disponible pour init()`);
            return;
        }
        
        this.resizeCanvas();
        
        // Écouter les redimensionnements
        window.addEventListener('resize', this.handleResize.bind(this));
    }
    
    /**
     * Gestionnaire de redimensionnement
     */
    handleResize() {
        this.resizeCanvas();
    }
    
    /**
     * Redimensionne le canvas selon son parent
     */
    resizeCanvas() {
        if (!this.canvas) return;
        
        const parent = this.canvas.parentElement;
        if (!parent) {
            console.warn(`[${this.constructor.name}] Canvas sans parent pour resize`);
            return;
        }
        
        // Sauvegarder les dimensions actuelles
        const oldWidth = this.canvas.width;
        const oldHeight = this.canvas.height;
        
        // Nouvelles dimensions depuis le parent
        const newWidth = parent.clientWidth;
        const newHeight = parent.clientHeight;
        
        // Ne redimensionner que si nécessaire
        if (oldWidth !== newWidth || oldHeight !== newHeight) {
            this.canvas.width = newWidth;
            this.canvas.height = newHeight;
            this.render();
        }
    }
    
    /**
     * Rendu de la vue (à surcharger)
     */
    render() {
        // À implémenter dans les sous-classes
        // Par défaut, efface le canvas
        this.clearCanvas();
    }
    
    /**
     * Efface le canvas
     */
    clearCanvas() {
        if (!this.ctx) return;
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
    
    /**
     * Dessine un rectangle
     */
    drawRect(x, y, width, height, fillStyle = '#000000') {
        if (!this.ctx) return;
        this.ctx.fillStyle = fillStyle;
        this.ctx.fillRect(x, y, width, height);
    }
    
    /**
     * Dessine du texte
     */
    drawText(text, x, y, font = '14px Arial', fillStyle = '#000000') {
        if (!this.ctx) return;
        this.ctx.font = font;
        this.ctx.fillStyle = fillStyle;
        this.ctx.fillText(text, x, y);
    }
    
    /**
     * Nettoyage et destruction
     */
    destroy() {
        // Annuler l'animation en cours
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
        
        // Nettoyer le listener resize
        window.removeEventListener('resize', this.handleResize);
        
        // Appeler le destroy parent
        if (super.destroy) {
            super.destroy();
        }
    }
}

// Export pour Node.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = BaseCanvasView;
}

// Export global pour le navigateur
if (typeof window !== 'undefined') {
    window.BaseCanvasView = BaseCanvasView;
}