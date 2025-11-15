// ============================================================================
// Fichier: frontend/scripts/editor/components/RoutingMatrixEditor.js
// Version: v3.2
// Projet: midiMind v3.0 - SystÃ¨me d'Orchestration MIDI
// ============================================================================
// Description:
//   Composant matrice interactive pour configurer le routage MIDI dans l'Ã©diteur
//   Support des topologies 1â†’1, 1â†’N, Nâ†’1, Nâ†’M avec interface visuelle
// ============================================================================

class RoutingMatrixEditor {
    constructor(container, routingManager, eventBus) {
        this.container = typeof container === 'string' ?
            document.getElementById(container) : container;
        this.routingManager = routingManager;
        this.eventBus = eventBus || window.eventBus || null;
        
        // Ã‰tat
        this.state = {
            viewMode: 'matrix',    // 'matrix', 'list', 'graph'
            selectedChannels: new Set(),
            selectedInstruments: new Set(),
            isMultiSelect: false,
            hoveredCell: null,
            dragStart: null
        };
        
        // Configuration
        this.config = {
            cellSize: 60,
            showCompatibility: true,
            showTooltips: true,
            enableDragSelect: true,
            animateChanges: true
        };
        
        // Couleurs des canaux
        this.channelColors = [
            '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A',
            '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E2',
            '#F8B739', '#52C7B8', '#FF8C94', '#A8E6CF',
            '#FFD93D', '#BCB3E5', '#FAB1A0', '#81C784'
        ];
        
        this.initialize();
    }
    
    // ========================================================================
    // INITIALISATION
    // ========================================================================
    
    initialize() {
        this.render();
        this.attachEvents();
        this.updateStats();
    }
    
    // ========================================================================
    // RENDU
    // ========================================================================
    
    render() {
        this.container.innerHTML = `
            <div class="routing-matrix-editor">
                <!-- Toolbar -->
                <div class="matrix-toolbar">
                    ${this.renderToolbar()}
                </div>
                
                <!-- Stats rapides -->
                <div class="matrix-quick-stats">
                    ${this.renderQuickStats()}
                </div>
                
                <!-- Matrice principale -->
                <div class="matrix-wrapper">
                    ${this.state.viewMode === 'matrix' ? this.renderMatrix() : 
                      this.state.viewMode === 'list' ? this.renderList() :
                      this.renderGraph()}
                </div>
                
                <!-- Actions rapides -->
                <div class="matrix-quick-actions">
                    ${this.renderQuickActions()}
                </div>
                
                <!-- Tooltip -->
                <div class="matrix-tooltip" id="matrixTooltip" style="display: none;"></div>
            </div>
        `;
        
        this.cacheElements();
    }
    
    /**
     * Toolbar avec contrÃ´les
     */
    renderToolbar() {
        return `
            <div class="toolbar-left">
                <button class="tool-btn ${this.state.viewMode === 'matrix' ? 'active' : ''}" 
                        onclick="window.routingMatrixEditor.setViewMode('matrix')"
                        title="Matrix View">
                    <span class="icon">âŠž</span> Matrix
                </button>
                <button class="tool-btn ${this.state.viewMode === 'list' ? 'active' : ''}"
                        onclick="window.routingMatrixEditor.setViewMode('list')"
                        title="List View">
                    <span class="icon">â‰¡</span> List
                </button>
                <button class="tool-btn ${this.state.viewMode === 'graph' ? 'active' : ''}"
                        onclick="window.routingMatrixEditor.setViewMode('graph')"
                        title="Graph View">
                    <span class="icon">â—ˆ</span> Graph
                </button>
            </div>
            
            <div class="toolbar-center">
                <label class="toolbar-option">
                    <input type="checkbox" ${this.config.showCompatibility ? 'checked' : ''}
                           onchange="window.routingMatrixEditor.toggleCompatibility(this.checked)">
                    <span>Show Compatibility</span>
                </label>
                <label class="toolbar-option">
                    <input type="checkbox" ${this.state.isMultiSelect ? 'checked' : ''}
                           onchange="window.routingMatrixEditor.toggleMultiSelect(this.checked)">
                    <span>Multi-Select Mode</span>
                </label>
            </div>
            
            <div class="toolbar-right">
                <button class="tool-btn" onclick="window.routingMatrixEditor.autoRoute()"
                        title="Auto Route">
                    <span class="icon">âš¡</span> Auto
                </button>
                <button class="tool-btn" onclick="window.routingMatrixEditor.clearAll()"
                        title="Clear All">
                    <span class="icon">âœ•</span> Clear
                </button>
            </div>
        `;
    }
    
    /**
     * Stats rapides
     */
    renderQuickStats() {
        const stats = this.routingManager.getStats();
        
        return `
            <div class="quick-stat">
                <span class="stat-label">Channels</span>
                <span class="stat-value">${stats.assignedChannels}/${stats.totalChannels}</span>
            </div>
            <div class="quick-stat">
                <span class="stat-label">Routes</span>
                <span class="stat-value">${stats.totalRoutes}</span>
            </div>
            <div class="quick-stat">
                <span class="stat-label">1â†’1</span>
                <span class="stat-value">${stats.oneToOne}</span>
            </div>
            <div class="quick-stat">
                <span class="stat-label">1â†’N</span>
                <span class="stat-value">${stats.oneToMany}</span>
            </div>
            <div class="quick-stat">
                <span class="stat-label">Nâ†’1</span>
                <span class="stat-value">${stats.manyToOne}</span>
            </div>
            <div class="quick-stat">
                <span class="stat-label">Compatibility</span>
                <span class="stat-value ${this.getCompatClass(stats.compatibilityScore)}">
                    ${Math.round(stats.compatibilityScore * 100)}%
                </span>
            </div>
        `;
    }
    
    /**
     * Vue Matrix
     */
    renderMatrix() {
        const channels = this.routingManager.midiChannels;
        const instruments = this.routingManager.instruments;
        
        if (channels.length === 0) {
            return '<div class="matrix-empty">No MIDI channels detected</div>';
        }
        
        if (instruments.length === 0) {
            return '<div class="matrix-empty">No instruments available</div>';
        }
        
        let html = '<div class="matrix-grid">';
        
        // En-tÃªte avec instruments
        html += '<div class="matrix-row header-row">';
        html += '<div class="matrix-cell corner-cell"><span>CH/Inst</span></div>';
        
        instruments.forEach(inst => {
            const routes = this.routingManager.getRoutesForInstrument(inst.id);
            const isUsed = routes.length > 0;
            
            html += `
                <div class="matrix-cell inst-header ${isUsed ? 'used' : ''} 
                            ${this.state.selectedInstruments.has(inst.id) ? 'selected' : ''}"
                     data-instrument="${inst.id}"
                     onclick="window.routingMatrixEditor.selectInstrument('${inst.id}')">
                    <div class="inst-icon">${this.getInstrumentIcon(inst.type)}</div>
                    <div class="inst-name">${inst.name}</div>
                    ${isUsed ? `<div class="inst-badge">${routes.length}</div>` : ''}
                </div>
            `;
        });
        
        html += '</div>';
        
        // Lignes pour chaque canal
        channels.forEach(channel => {
            const routes = this.routingManager.getRoutesForChannel(channel.number);
            const color = this.channelColors[channel.number % 16];
            
            html += '<div class="matrix-row">';
            
            // En-tÃªte du canal
            html += `
                <div class="matrix-cell ch-header ${this.state.selectedChannels.has(channel.number) ? 'selected' : ''}"
                     data-channel="${channel.number}"
                     onclick="window.routingMatrixEditor.selectChannel(${channel.number})"
                     style="border-left: 4px solid ${color};">
                    <div class="ch-number">CH${channel.number + 1}</div>
                    <div class="ch-name">${channel.instrument}</div>
                    <div class="ch-notes">${channel.noteCount} notes</div>
                </div>
            `;
            
            // Cellules pour chaque instrument
            instruments.forEach(inst => {
                const route = routes.find(r => r.destinations.includes(inst.id));
                const isAssigned = !!route;
                
                let cellClass = 'matrix-cell routing-cell';
                if (isAssigned) cellClass += ' assigned';
                if (this.state.hoveredCell === `${channel.number}-${inst.id}`) {
                    cellClass += ' hovered';
                }
                
                // CompatibilitÃ©
                const compat = this.routingManager.checkCompatibility(
                    channel, inst
                );
                const compatScore = Math.round(compat.score * 100);
                
                html += `
                    <div class="${cellClass}"
                         data-channel="${channel.number}"
                         data-instrument="${inst.id}"
                         data-compat="${compatScore}"
                         onclick="window.routingMatrixEditor.toggleCell(${channel.number}, '${inst.id}')"
                         onmouseenter="window.routingMatrixEditor.showTooltip(event, ${channel.number}, '${inst.id}')"
                         onmouseleave="window.routingMatrixEditor.hideTooltip()"
                         style="${isAssigned ? `background: ${color}30; border-color: ${color};` : ''}">
                        
                        ${isAssigned ? `
                            <div class="cell-indicator" style="background: ${color};">
                                ${route.type === '1â†’1' ? 'â—' :
                                  route.type === '1â†’N' ? 'â–¶' :
                                  route.type === 'Nâ†’1' ? 'â—€' : 'â—†'}
                            </div>
                        ` : this.config.showCompatibility ? `
                            <div class="cell-compat ${this.getCompatClass(compat.score)}">
                                ${compatScore}%
                            </div>
                        ` : ''}
                    </div>
                `;
            });
            
            html += '</div>';
        });
        
        html += '</div>';
        
        return html;
    }
    
    /**
     * Vue List
     */
    renderList() {
        const channels = this.routingManager.midiChannels;
        
        let html = '<div class="matrix-list">';
        
        channels.forEach(channel => {
            const routes = this.routingManager.getRoutesForChannel(channel.number);
            const color = this.channelColors[channel.number % 16];
            
            html += `
                <div class="list-item" style="border-left: 4px solid ${color};">
                    <div class="list-channel">
                        <div class="ch-badge" style="background: ${color};">CH${channel.number + 1}</div>
                        <div class="ch-info">
                            <div class="ch-title">${channel.instrument}</div>
                            <div class="ch-meta">${channel.noteCount} notes â€¢ ${channel.noteRange.min}-${channel.noteRange.max}</div>
                        </div>
                    </div>
                    
                    <div class="list-arrow">â†’</div>
                    
                    <div class="list-destinations">
                        ${routes.length === 0 ? `
                            <select class="inst-select" 
                                    onchange="window.routingMatrixEditor.assignFromSelect(${channel.number}, this.value)">
                                <option value="">Assign instrument...</option>
                                ${this.routingManager.instruments.map(inst => `
                                    <option value="${inst.id}">${inst.name}</option>
                                `).join('')}
                            </select>
                        ` : routes.map(route => `
                            <div class="dest-badge" onclick="window.routingMatrixEditor.showRouteDetails('${route.id}')">
                                <span class="type-badge">${route.type}</span>
                                ${route.destinations.map(destId => {
                                    const inst = this.routingManager.instruments.find(i => i.id === destId);
                                    return inst ? inst.name : destId;
                                }).join(', ')}
                                <button class="remove-btn" onclick="event.stopPropagation(); window.routingMatrixEditor.removeRoute('${route.id}')">âœ•</button>
                            </div>
                        `).join('')}
                        
                        ${routes.length > 0 ? `
                            <button class="add-dest-btn" 
                                    onclick="window.routingMatrixEditor.addDestination(${channel.number})">
                                + Add
                            </button>
                        ` : ''}
                    </div>
                </div>
            `;
        });
        
        html += '</div>';
        
        return html;
    }
    
    /**
     * Vue Graph (simplifiÃ©)
     */
    renderGraph() {
        return `
            <div class="matrix-graph">
                <svg id="routingGraph" width="100%" height="500">
                    ${this.renderGraphSVG()}
                </svg>
            </div>
        `;
    }
    
    /**
     * GÃ©nÃ¨re le SVG du graphe
     */
    renderGraphSVG() {
        const channels = this.routingManager.midiChannels;
        const instruments = this.routingManager.instruments;
        const routes = this.routingManager.getAllRoutes();
        
        let svg = '';
        
        // Canaux Ã  gauche
        channels.forEach((ch, i) => {
            const y = 50 + i * 40;
            const color = this.channelColors[ch.number % 16];
            svg += `
                <circle cx="50" cy="${y}" r="20" fill="${color}" />
                <text x="80" y="${y + 5}" fill="white" font-size="12">CH${ch.number + 1}</text>
            `;
        });
        
        // Instruments Ã  droite
        instruments.forEach((inst, i) => {
            const y = 50 + i * 40;
            svg += `
                <circle cx="350" cy="${y}" r="20" fill="#4ECDC4" />
                <text x="380" y="${y + 5}" fill="white" font-size="12">${inst.name}</text>
            `;
        });
        
        // Routes (lignes)
        routes.forEach(route => {
            route.sources.forEach(chNum => {
                const chIndex = channels.findIndex(c => c.number === chNum);
                const y1 = 50 + chIndex * 40;
                
                route.destinations.forEach(instId => {
                    const instIndex = instruments.findIndex(i => i.id === instId);
                    const y2 = 50 + instIndex * 40;
                    const color = this.channelColors[chNum % 16];
                    
                    svg += `
                        <line x1="70" y1="${y1}" x2="330" y2="${y2}" 
                              stroke="${color}" stroke-width="2" opacity="0.5" />
                    `;
                });
            });
        });
        
        return svg;
    }
    
    /**
     * Actions rapides
     */
    renderQuickActions() {
        const hasSelection = this.state.selectedChannels.size > 0 || 
                           this.state.selectedInstruments.size > 0;
        
        return `
            <button class="quick-action-btn" 
                    ${!hasSelection ? 'disabled' : ''}
                    onclick="window.routingMatrixEditor.createRouteFromSelection()">
                <span class="icon">âž•</span> Create Route
            </button>
            
            <button class="quick-action-btn"
                    ${this.state.selectedChannels.size < 2 ? 'disabled' : ''}
                    onclick="window.routingMatrixEditor.mergeSelected()">
                <span class="icon">â‡¶</span> Merge (Nâ†’1)
            </button>
            
            <button class="quick-action-btn"
                    ${this.state.selectedChannels.size !== 1 ? 'disabled' : ''}
                    onclick="window.routingMatrixEditor.splitSelected()">
                <span class="icon">â‡‰</span> Split (1â†’N)
            </button>
            
            <button class="quick-action-btn"
                    onclick="window.routingMatrixEditor.clearSelection()">
                <span class="icon">âœ“</span> Clear Selection
            </button>
        `;
    }
    
    // ========================================================================
    // INTERACTIONS
    // ========================================================================
    
    /**
     * Toggle une cellule (assignation)
     */
    toggleCell(channel, instrumentId) {
        const routes = this.routingManager.getRoutesForChannel(channel);
        const existingRoute = routes.find(r => r.destinations.includes(instrumentId));
        
        if (existingRoute) {
            // DÃ©jÃ  assignÃ© - retirer
            this.routingManager.removeDestination(channel, instrumentId);
        } else {
            // Pas assignÃ© - ajouter
            if (routes.length > 0) {
                // Ajouter destination (1â†’N)
                this.routingManager.addDestination(channel, instrumentId);
            } else {
                // CrÃ©er nouvelle route (1â†’1)
                this.routingManager.assign(channel, instrumentId);
            }
        }
        
        this.render();
        this.updateStats();
    }
    
    /**
     * SÃ©lection de canal
     */
    selectChannel(channel) {
        if (this.state.isMultiSelect) {
            if (this.state.selectedChannels.has(channel)) {
                this.state.selectedChannels.delete(channel);
            } else {
                this.state.selectedChannels.add(channel);
            }
        } else {
            this.state.selectedChannels.clear();
            this.state.selectedChannels.add(channel);
        }
        
        this.render();
    }
    
    /**
     * SÃ©lection d'instrument
     */
    selectInstrument(instrumentId) {
        if (this.state.isMultiSelect) {
            if (this.state.selectedInstruments.has(instrumentId)) {
                this.state.selectedInstruments.delete(instrumentId);
            } else {
                this.state.selectedInstruments.add(instrumentId);
            }
        } else {
            this.state.selectedInstruments.clear();
            this.state.selectedInstruments.add(instrumentId);
        }
        
        this.render();
    }
    
    /**
     * CrÃ©er route depuis sÃ©lection
     */
    createRouteFromSelection() {
        if (this.state.selectedChannels.size === 0 || 
            this.state.selectedInstruments.size === 0) {
            return;
        }
        
        const channels = Array.from(this.state.selectedChannels);
        const instruments = Array.from(this.state.selectedInstruments);
        
        this.routingManager.createRoute(channels, instruments);
        
        this.clearSelection();
        this.render();
        this.updateStats();
    }
    
    /**
     * Merge canaux sÃ©lectionnÃ©s
     */
    mergeSelected() {
        if (this.state.selectedChannels.size < 2 || 
            this.state.selectedInstruments.size !== 1) {
            alert('Select multiple channels and ONE instrument for merge (Nâ†’1)');
            return;
        }
        
        const channels = Array.from(this.state.selectedChannels);
        const instrument = Array.from(this.state.selectedInstruments)[0];
        
        this.routingManager.mergeChannels(channels, instrument);
        
        this.clearSelection();
        this.render();
        this.updateStats();
    }
    
    /**
     * Split canal sÃ©lectionnÃ©
     */
    splitSelected() {
        if (this.state.selectedChannels.size !== 1 || 
            this.state.selectedInstruments.size < 2) {
            alert('Select ONE channel and multiple instruments for split (1â†’N)');
            return;
        }
        
        const channel = Array.from(this.state.selectedChannels)[0];
        const instruments = Array.from(this.state.selectedInstruments);
        
        this.routingManager.splitChannel(channel, instruments);
        
        this.clearSelection();
        this.render();
        this.updateStats();
    }
    
    /**
     * Clear sÃ©lection
     */
    clearSelection() {
        this.state.selectedChannels.clear();
        this.state.selectedInstruments.clear();
        this.render();
    }
    
    // ========================================================================
    // TOOLTIPS
    // ========================================================================
    
    showTooltip(event, channel, instrumentId) {
        if (!this.config.showTooltips) return;
        
        const tooltip = document.getElementById('matrixTooltip');
        if (!tooltip) return;
        
        const channelInfo = this.routingManager.midiChannels.find(c => c.number === channel);
        const instrument = this.routingManager.instruments.find(i => i.id === instrumentId);
        const routes = this.routingManager.getRoutesForChannel(channel);
        const route = routes.find(r => r.destinations.includes(instrumentId));
        
        const compat = this.routingManager.checkCompatibility(channelInfo, instrument);
        
        tooltip.innerHTML = `
            <div class="tooltip-header">
                <strong>CH${channel + 1}</strong> â†’ <strong>${instrument.name}</strong>
            </div>
            <div class="tooltip-body">
                ${route ? `
                    <div class="tooltip-row">
                        <span>Type:</span> <span>${route.type}</span>
                    </div>
                    <div class="tooltip-row">
                        <span>Status:</span> <span class="badge ${route.enabled ? 'success' : 'disabled'}">
                            ${route.enabled ? 'Enabled' : 'Disabled'}
                        </span>
                    </div>
                ` : ''}
                <div class="tooltip-row">
                    <span>Compatibility:</span> 
                    <span class="${this.getCompatClass(compat.score)}">
                        ${Math.round(compat.score * 100)}%
                    </span>
                </div>
                <div class="tooltip-row">
                    <span>Notes:</span> <span>${channelInfo.noteCount}</span>
                </div>
                <div class="tooltip-action">
                    ${route ? 'Click to remove' : 'Click to assign'}
                </div>
            </div>
        `;
        
        tooltip.style.display = 'block';
        tooltip.style.left = event.pageX + 10 + 'px';
        tooltip.style.top = event.pageY + 10 + 'px';
    }
    
    hideTooltip() {
        const tooltip = document.getElementById('matrixTooltip');
        if (tooltip) {
            tooltip.style.display = 'none';
        }
    }
    
    // ========================================================================
    // ACTIONS
    // ========================================================================
    
    setViewMode(mode) {
        this.state.viewMode = mode;
        this.render();
    }
    
    toggleCompatibility(show) {
        this.config.showCompatibility = show;
        this.render();
    }
    
    toggleMultiSelect(enabled) {
        this.state.isMultiSelect = enabled;
        if (!enabled) {
            this.clearSelection();
        }
    }
    
    autoRoute() {
        if (confirm('Auto-route all channels?')) {
            this.routingManager.autoRoute();
            this.render();
            this.updateStats();
        }
    }
    
    clearAll() {
        if (confirm('Clear all routes?')) {
            this.routingManager.clearAll();
            this.render();
            this.updateStats();
        }
    }
    
    assignFromSelect(channel, instrumentId) {
        if (instrumentId) {
            this.routingManager.assign(channel, instrumentId);
            this.render();
            this.updateStats();
        }
    }
    
    removeRoute(routeId) {
        this.routingManager.removeRoute(routeId);
        this.render();
        this.updateStats();
    }
    
    addDestination(channel) {
        // TODO: Ouvrir modal pour choisir instrument
        alert('Add destination - TODO: implement modal');
    }
    
    showRouteDetails(routeId) {
        // TODO: Afficher dÃ©tails de la route
        console.log('Show details for route:', routeId);
    }
    
    // ========================================================================
    // UTILS
    // ========================================================================
    
    getInstrumentIcon(type) {
        const icons = {
            'piano': 'ðŸŽ¹',
            'synth': 'ðŸŽ›ï¸',
            'drums': 'ðŸ¥',
            'bass': 'ðŸŽ¸',
            'strings': 'ðŸŽ»',
            'guitar': 'ðŸŽ¸',
            'brass': 'ðŸŽº',
            'woodwinds': 'ðŸŽ·'
        };
        return icons[type?.toLowerCase()] || 'ðŸŽµ';
    }
    
    getCompatClass(score) {
        if (score >= 0.8) return 'compat-high';
        if (score >= 0.5) return 'compat-medium';
        return 'compat-low';
    }
    
    updateStats() {
        this.eventBus?.emit('routing:stats-updated', this.routingManager.getStats());
    }
    
    cacheElements() {
        // Cache des Ã©lÃ©ments DOM si nÃ©cessaire
    }
    
    attachEvents() {
        // Exposer l'instance globalement pour les onclick
        window.routingMatrixEditor = this;
        
        // Ã‰couter les Ã©vÃ©nements du routing manager
        this.eventBus?.on('routing:route-created', () => this.render());
        this.eventBus?.on('routing:route-removed', () => this.render());
        this.eventBus?.on('routing:assigned', () => this.render());
    }
    
    destroy() {
        delete window.routingMatrixEditor;
    }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = RoutingMatrixEditor;
}