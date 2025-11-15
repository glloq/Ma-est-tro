// ============================================================================
// Fichier: frontend/js/views/components/ToggleSwitch.js
// Projet: midiMind v3.0 - Système d'Orchestration MIDI pour Raspberry Pi
// ============================================================================
// Description:
//   Composant switch on/off réutilisable avec animations.
//   Supporte différents styles, tailles et états.
//
// Auteur: midiMind Team
// Date: 2025-10-04
// Version: 3.0.0
// ============================================================================

class ToggleSwitch {
    constructor(container, config = {}) {
        this.container = typeof container === 'string' ? 
            document.getElementById(container) : container;
        
        // Configuration
        this.config = {
            checked: config.checked || false,
            disabled: config.disabled || false,
            size: config.size || 'medium',          // small, medium, large
            style: config.style || 'default',       // default, ios, material, rounded
            color: config.color || '#667eea',       // Couleur quand activé
            label: config.label || '',
            labelPosition: config.labelPosition || 'right', // left, right
            showStatus: config.showStatus || false, // Afficher ON/OFF
            animated: config.animated !== false,
            onChange: config.onChange || null,
            ...config
        };
        
        // État
        this.state = {
            checked: this.config.checked,
            disabled: this.config.disabled,
            focused: false
        };
        
        // ID unique
        this.id = `toggle-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        
        this.init();
    }
    
    // ========================================================================
    // INITIALISATION
    // ========================================================================
    
    init() {
        if (!this.container) {
            console.error('ToggleSwitch: Container not found');
            return;
        }
        
        this.render();
        this.attachEvents();
        
        // Appliquer l'état initial
        this.updateState();
    }
    
    // ========================================================================
    // RENDU
    // ========================================================================
    
    render() {
        const html = this.buildTemplate();
        this.container.innerHTML = html;
        this.applyStyles();
    }
    
    /**
     * Construire le template HTML
     */
    buildTemplate() {
        const sizeClass = `toggle-${this.config.size}`;
        const styleClass = `toggle-${this.config.style}`;
        const checkedClass = this.state.checked ? 'checked' : '';
        const disabledClass = this.state.disabled ? 'disabled' : '';
        
        const labelLeft = this.config.labelPosition === 'left' ? this.buildLabel() : '';
        const labelRight = this.config.labelPosition === 'right' ? this.buildLabel() : '';
        
        return `
            <div class="toggle-switch-container ${sizeClass}" id="${this.id}-container">
                ${labelLeft}
                
                <div class="toggle-switch ${styleClass} ${checkedClass} ${disabledClass}"
                     id="${this.id}"
                     role="switch"
                     aria-checked="${this.state.checked}"
                     aria-disabled="${this.state.disabled}"
                     tabindex="${this.state.disabled ? -1 : 0}">
                    
                    <input type="checkbox" 
                           class="toggle-input"
                           id="${this.id}-input"
                           ${this.state.checked ? 'checked' : ''}
                           ${this.state.disabled ? 'disabled' : ''}>
                    
                    <div class="toggle-track">
                        ${this.config.showStatus ? this.buildStatusLabels() : ''}
                    </div>
                    
                    <div class="toggle-thumb">
                        ${this.config.style === 'material' ? '<div class="toggle-ripple"></div>' : ''}
                    </div>
                </div>
                
                ${labelRight}
            </div>
        `;
    }
    
    /**
     * Construire le label
     */
    buildLabel() {
        if (!this.config.label) return '';
        
        return `
            <label class="toggle-label" for="${this.id}-input">
                ${this.config.label}
            </label>
        `;
    }
    
    /**
     * Construire les labels ON/OFF
     */
    buildStatusLabels() {
        return `
            <span class="toggle-status-on">ON</span>
            <span class="toggle-status-off">OFF</span>
        `;
    }
    
    /**
     * Appliquer les styles CSS
     */
    applyStyles() {
        if (document.getElementById('toggle-switch-styles')) return;
        
        const style = document.createElement('style');
        style.id = 'toggle-switch-styles';
        style.textContent = `
            /* Container */
            .toggle-switch-container {
                display: inline-flex;
                align-items: center;
                gap: 12px;
                user-select: none;
            }
            
            /* Switch principal */
            .toggle-switch {
                position: relative;
                display: inline-block;
                cursor: pointer;
                outline: none;
                transition: opacity 0.3s ease;
            }
            
            .toggle-switch.disabled {
                opacity: 0.5;
                cursor: not-allowed;
            }
            
            /* Input caché */
            .toggle-input {
                position: absolute;
                opacity: 0;
                width: 0;
                height: 0;
            }
            
            /* Track (fond) */
            .toggle-track {
                position: relative;
                background: #4b5563;
                border-radius: 100px;
                transition: background-color 0.3s ease;
                overflow: hidden;
            }
            
            .toggle-switch.checked .toggle-track {
                background: ${this.config.color};
            }
            
            /* Thumb (bouton) */
            .toggle-thumb {
                position: absolute;
                background: white;
                border-radius: 50%;
                transition: transform 0.3s ease;
                box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
            }
            
            .toggle-switch.checked .toggle-thumb {
                transform: translateX(100%);
            }
            
            /* Focus */
            .toggle-switch:focus {
                outline: 2px solid ${this.config.color};
                outline-offset: 2px;
            }
            
            /* Hover */
            .toggle-switch:not(.disabled):hover .toggle-thumb {
                box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
            }
            
            /* Active */
            .toggle-switch:not(.disabled):active .toggle-thumb {
                width: 28px;
            }
            
            .toggle-switch.checked:not(.disabled):active .toggle-thumb {
                transform: translateX(calc(100% - 8px));
            }
            
            /* Label */
            .toggle-label {
                font-size: 14px;
                color: rgba(255, 255, 255, 0.9);
                cursor: pointer;
            }
            
            .toggle-switch.disabled + .toggle-label {
                cursor: not-allowed;
                opacity: 0.5;
            }
            
            /* Status labels */
            .toggle-status-on,
            .toggle-status-off {
                position: absolute;
                font-size: 10px;
                font-weight: 600;
                color: white;
                top: 50%;
                transform: translateY(-50%);
                transition: opacity 0.3s ease;
            }
            
            .toggle-status-on {
                left: 8px;
                opacity: 0;
            }
            
            .toggle-status-off {
                right: 8px;
                opacity: 1;
            }
            
            .toggle-switch.checked .toggle-status-on {
                opacity: 1;
            }
            
            .toggle-switch.checked .toggle-status-off {
                opacity: 0;
            }
            
            /* === TAILLES === */
            
            /* Small */
            .toggle-small .toggle-track {
                width: 36px;
                height: 20px;
            }
            
            .toggle-small .toggle-thumb {
                width: 16px;
                height: 16px;
                top: 2px;
                left: 2px;
            }
            
            .toggle-small.toggle-switch.checked .toggle-thumb {
                transform: translateX(16px);
            }
            
            /* Medium (défaut) */
            .toggle-medium .toggle-track {
                width: 48px;
                height: 24px;
            }
            
            .toggle-medium .toggle-thumb {
                width: 20px;
                height: 20px;
                top: 2px;
                left: 2px;
            }
            
            .toggle-medium.toggle-switch.checked .toggle-thumb {
                transform: translateX(24px);
            }
            
            /* Large */
            .toggle-large .toggle-track {
                width: 60px;
                height: 30px;
            }
            
            .toggle-large .toggle-thumb {
                width: 26px;
                height: 26px;
                top: 2px;
                left: 2px;
            }
            
            .toggle-large.toggle-switch.checked .toggle-thumb {
                transform: translateX(30px);
            }
            
            /* === STYLES === */
            
            /* iOS Style */
            .toggle-ios .toggle-track {
                background: #e5e7eb;
                border: 2px solid #d1d5db;
            }
            
            .toggle-ios.checked .toggle-track {
                background: #34c759;
                border-color: #34c759;
            }
            
            /* Material Style */
            .toggle-material .toggle-thumb {
                box-shadow: 0 1px 5px rgba(0, 0, 0, 0.2);
            }
            
            .toggle-material.checked .toggle-track {
                background: ${this.config.color}88;
            }
            
            .toggle-material.checked .toggle-thumb {
                background: ${this.config.color};
            }
            
            .toggle-ripple {
                position: absolute;
                top: 50%;
                left: 50%;
                width: 0;
                height: 0;
                border-radius: 50%;
                background: rgba(255, 255, 255, 0.5);
                transform: translate(-50%, -50%);
                transition: width 0.3s ease, height 0.3s ease;
            }
            
            .toggle-material:active .toggle-ripple {
                width: 40px;
                height: 40px;
            }
            
            /* Rounded Style */
            .toggle-rounded .toggle-track {
                border-radius: 4px;
            }
            
            .toggle-rounded .toggle-thumb {
                border-radius: 4px;
            }
            
            /* Animations */
            @keyframes toggle-pulse {
                0% { box-shadow: 0 0 0 0 ${this.config.color}66; }
                50% { box-shadow: 0 0 0 8px ${this.config.color}00; }
                100% { box-shadow: 0 0 0 0 ${this.config.color}00; }
            }
            
            .toggle-switch.checked:not(.disabled) .toggle-thumb {
                animation: toggle-pulse 0.5s ease-out;
            }
        `;
        
        document.head.appendChild(style);
    }
    
    // ========================================================================
    // ÉVÉNEMENTS
    // ========================================================================
    
    attachEvents() {
        const element = document.getElementById(this.id);
        const input = document.getElementById(`${this.id}-input`);
        
        if (!element || !input) return;
        
        // Click sur le switch
        element.addEventListener('click', (e) => {
            if (!this.state.disabled) {
                this.toggle();
            }
        });
        
        // Click sur le label
        const label = this.container.querySelector('.toggle-label');
        if (label) {
            label.addEventListener('click', (e) => {
                e.preventDefault();
                if (!this.state.disabled) {
                    this.toggle();
                }
            });
        }
        
        // Keyboard events
        element.addEventListener('keydown', (e) => {
            if (this.state.disabled) return;
            
            if (e.key === ' ' || e.key === 'Enter') {
                e.preventDefault();
                this.toggle();
            } else if (e.key === 'ArrowRight' && !this.state.checked) {
                this.check();
            } else if (e.key === 'ArrowLeft' && this.state.checked) {
                this.uncheck();
            }
        });
        
        // Focus/Blur
        element.addEventListener('focus', () => {
            this.state.focused = true;
        });
        
        element.addEventListener('blur', () => {
            this.state.focused = false;
        });
        
        // Prevent form submission on Enter
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
            }
        });
    }
    
    // ========================================================================
    // ACTIONS
    // ========================================================================
    
    /**
     * Basculer l'état
     */
    toggle() {
        this.state.checked = !this.state.checked;
        this.updateState();
        this.triggerChange();
    }
    
    /**
     * Activer
     */
    check() {
        if (!this.state.checked) {
            this.state.checked = true;
            this.updateState();
            this.triggerChange();
        }
    }
    
    /**
     * Désactiver
     */
    uncheck() {
        if (this.state.checked) {
            this.state.checked = false;
            this.updateState();
            this.triggerChange();
        }
    }
    
    /**
     * Activer/Désactiver le switch
     */
    setDisabled(disabled) {
        this.state.disabled = disabled;
        this.updateState();
    }
    
    /**
     * Définir l'état
     */
    setChecked(checked, silent = false) {
        if (this.state.checked !== checked) {
            this.state.checked = checked;
            this.updateState();
            
            if (!silent) {
                this.triggerChange();
            }
        }
    }
    
    // ========================================================================
    // MISE À JOUR
    // ========================================================================
    
    /**
     * Mettre à jour l'état visuel
     */
    updateState() {
        const element = document.getElementById(this.id);
        const input = document.getElementById(`${this.id}-input`);
        
        if (!element || !input) return;
        
        // Mettre à jour les classes
        element.classList.toggle('checked', this.state.checked);
        element.classList.toggle('disabled', this.state.disabled);
        
        // Mettre à jour les attributs
        element.setAttribute('aria-checked', this.state.checked);
        element.setAttribute('aria-disabled', this.state.disabled);
        element.tabIndex = this.state.disabled ? -1 : 0;
        
        // Mettre à jour l'input
        input.checked = this.state.checked;
        input.disabled = this.state.disabled;
        
        // Animation si configurée
        if (this.config.animated && this.state.checked) {
            this.animateToggle();
        }
    }
    
    /**
     * Animation du toggle
     */
    animateToggle() {
        const thumb = document.querySelector(`#${this.id} .toggle-thumb`);
        if (!thumb) return;
        
        // Animation de rebond
        thumb.style.transition = 'transform 0.3s cubic-bezier(0.68, -0.55, 0.265, 1.55)';
        
        setTimeout(() => {
            thumb.style.transition = '';
        }, 300);
    }
    
    /**
     * Déclencher l'événement onChange
     */
    triggerChange() {
        if (this.config.onChange) {
            this.config.onChange(this.state.checked, this);
        }
        
        // Émettre un événement custom
        const event = new CustomEvent('toggle-change', {
            detail: {
                checked: this.state.checked,
                toggle: this
            },
            bubbles: true
        });
        
        this.container.dispatchEvent(event);
    }
    
    // ========================================================================
    // GETTERS/SETTERS
    // ========================================================================
    
    /**
     * Obtenir l'état checked
     */
    get checked() {
        return this.state.checked;
    }
    
    /**
     * Définir l'état checked
     */
    set checked(value) {
        this.setChecked(value);
    }
    
    /**
     * Obtenir l'état disabled
     */
    get disabled() {
        return this.state.disabled;
    }
    
    /**
     * Définir l'état disabled
     */
    set disabled(value) {
        this.setDisabled(value);
    }
    
    /**
     * Obtenir la valeur
     */
    getValue() {
        return this.state.checked;
    }
    
    /**
     * Définir la valeur
     */
    setValue(value, silent = false) {
        this.setChecked(value, silent);
    }
    
    // ========================================================================
    // MÉTHODES STATIQUES
    // ========================================================================
    
    /**
     * Créer un groupe de toggles liés (radio-like)
     */
    static createGroup(containers, config = {}) {
        const toggles = [];
        const groupConfig = {
            ...config,
            onChange: (checked, toggle) => {
                if (checked && config.exclusive) {
                    // Désactiver les autres toggles du groupe
                    toggles.forEach(t => {
                        if (t !== toggle) {
                            t.uncheck();
                        }
                    });
                }
                
                // Appeler le callback original si défini
                if (config.onChange) {
                    config.onChange(checked, toggle);
                }
            }
        };
        
        containers.forEach(container => {
            const toggle = new ToggleSwitch(container, groupConfig);
            toggles.push(toggle);
        });
        
        return toggles;
    }
    
    // ========================================================================
    // DESTRUCTION
    // ========================================================================
    
    /**
     * Détruire le toggle
     */
    destroy() {
        if (this.container) {
            this.container.innerHTML = '';
        }
    }
}
window.ToggleSwitch = ToggleSwitch;