// ============================================================================
// Fichier: frontend/js/views/components/RoutingMatrixView.js
// Version: v3.1.0
// Date: 2025-11-04
// ============================================================================
// Description:
//   Vue de matrice de routage MIDI.
//   Affiche et gère les connexions entre sources et destinations MIDI.
//
// Signature corrigée:
//   constructor(containerId, eventBus) - Standard BaseView
//   (Avant: constructor(container, eventBus))
// ============================================================================

class RoutingMatrixView extends BaseView {
    constructor(containerId, eventBus) {
        super(containerId, eventBus);
        
        // État de la matrice
        this.state = {
            sources: [],
            destinations: [],
            routes: []
        };
        
        // Validation du container
        if (!this.container) {
            console.error(`[RoutingMatrixView] Container introuvable:`, containerId);
        }
    }
    
    /**
     * Initialisation de la vue
     */
    init() {
        super.init();
        this.render();
    }
    
    /**
     * Rendu de la matrice de routage
     */
    render() {
        if (!this.container) {
            console.warn('[RoutingMatrixView] Container non disponible pour render()');
            return;
        }
        
        const { sources, destinations, routes } = this.state;
        
        // Cas: aucun device connecté
        if (sources.length === 0 || destinations.length === 0) {
            this.container.innerHTML = '<div class="matrix-empty">Aucun device connecté</div>';
            return;
        }
        
        // Construire le HTML de la table
        let html = '<table class="routing-matrix"><thead><tr><th></th>';
        
        // En-têtes des destinations (colonnes)
        destinations.forEach(d => {
            html += `<th>${this.escapeHtml(d.name)}</th>`;
        });
        html += '</tr></thead><tbody>';
        
        // Lignes des sources
        sources.forEach(src => {
            html += `<tr><th>${this.escapeHtml(src.name)}</th>`;
            
            // Cellules de connexion
            destinations.forEach(dst => {
                const route = routes.find(r => 
                    r.source_id === src.id && r.destination_id === dst.id
                );
                const active = route && route.enabled !== false;
                
                html += `<td class="matrix-cell ${route ? 'connected' : ''} ${!active ? 'disabled' : ''}"
                            data-source="${src.id}" 
                            data-dest="${dst.id}"
                            title="${src.name} → ${dst.name}">
                            ${route ? (active ? '✓' : '✕') : ''}
                         </td>`;
            });
            
            html += '</tr>';
        });
        
        html += '</tbody></table>';
        this.container.innerHTML = html;
        
        // Attacher les événements après le rendu
        this.attachEvents();
    }
    
    /**
     * Attache les événements de clic sur les cellules
     */
    attachEvents() {
        if (!this.container) return;
        
        this.container.querySelectorAll('.matrix-cell').forEach(cell => {
            cell.addEventListener('click', (e) => this.handleCellClick(e, cell));
        });
    }
    
    /**
     * Gestion du clic sur une cellule
     */
    handleCellClick(event, cell) {
        const src = cell.dataset.source;
        const dst = cell.dataset.dest;
        const hasRoute = cell.classList.contains('connected');
        
        if (!this.eventBus) {
            console.warn('[RoutingMatrixView] EventBus non disponible');
            return;
        }
        
        // Émettre l'événement approprié
        if (hasRoute) {
            this.eventBus.emit('routing:remove_route_requested', {
                source_id: src,
                destination_id: dst
            });
        } else {
            this.eventBus.emit('routing:add_route_requested', {
                source_id: src,
                destination_id: dst
            });
        }
    }
    
    /**
     * Met à jour les données et re-rend la matrice
     */
    update(sources, destinations, routes) {
        this.state.sources = sources || [];
        this.state.destinations = destinations || [];
        this.state.routes = routes || [];
        
        this.render();
    }
    
    /**
     * Échappe le HTML pour éviter les injections
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    /**
     * Nettoyage
     */
    destroy() {
        // Nettoyer les événements
        if (this.container) {
            this.container.innerHTML = '';
        }
        
        // Appeler le destroy parent
        if (super.destroy) {
            super.destroy();
        }
    }
}

// Export pour Node.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = RoutingMatrixView;
}

// Export global pour le navigateur
if (typeof window !== 'undefined') {
    window.RoutingMatrixView = RoutingMatrixView;
}