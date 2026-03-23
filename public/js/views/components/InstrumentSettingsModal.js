/**
 * InstrumentSettingsModal
 * Modal XL avec sidebar pour gérer les réglages d'un instrument MIDI.
 * Remplace les fonctions showInstrumentSettings / _renderInstrumentFormContent / saveInstrumentSettings de index.html.
 */
class InstrumentSettingsModal extends BaseModal {

    static CHANNEL_COLORS = [
        '#3b82f6','#ef4444','#10b981','#f59e0b',
        '#8b5cf6','#ec4899','#06b6d4','#84cc16',
        '#f97316','#6366f1','#14b8a6','#e11d48',
        '#a855f7','#0ea5e9','#22c55e','#eab308'
    ];

    static SECTIONS = [
        { id: 'identity', icon: '🎵', labelKey: 'instrumentSettings.sectionIdentity', fallback: 'Identité' },
        { id: 'notes',    icon: '🎹', labelKey: 'instrumentSettings.sectionNotes',    fallback: 'Notes' },
        { id: 'strings',  icon: '🎸', labelKey: 'instrumentSettings.sectionStrings',  fallback: 'Cordes', conditional: true },
        { id: 'drums',    icon: '🥁', labelKey: 'instrumentSettings.sectionDrums',    fallback: 'Percussions', conditional: true },
        { id: 'advanced', icon: '⚙️', labelKey: 'instrumentSettings.sectionAdvanced', fallback: 'Avancé' }
    ];

    constructor(api) {
        super({
            id: 'instrument-settings-modal',
            size: 'xl',
            title: 'instrumentSettings.title',
            customClass: 'ism-modal'
        });
        this.api = api;
        this.device = null;
        this.instrumentTabs = [];
        this.activeChannel = 0;
        this.tuningPresets = {};
        this.activeSection = 'identity';
        this.isCreationMode = false;
    }

    // ========== PUBLIC API ==========

    async show(device) {
        this.device = device;
        this.isCreationMode = false;
        try {
            // Load tuning presets
            this.tuningPresets = {};
            try {
                const resp = await this.api.sendCommand('string_instrument_get_presets', {});
                if (resp && resp.presets) this.tuningPresets = resp.presets;
            } catch (e) { /* no presets */ }

            // Load all instruments on device
            this.instrumentTabs = [];
            const instrumentChannel = device.channel !== undefined ? device.channel : 0;
            try {
                const listResp = await this.api.sendCommand('instrument_list_by_device', { deviceId: device.id });
                if (listResp && listResp.instruments && listResp.instruments.length > 0) {
                    for (const inst of listResp.instruments) {
                        const tabData = await this._loadChannelData(device.id, inst.channel, device.type);
                        this.instrumentTabs.push(tabData);
                    }
                }
            } catch (e) {
                console.warn('Failed to load device instruments:', e);
            }

            if (this.instrumentTabs.length === 0) {
                const tabData = await this._loadChannelData(device.id, instrumentChannel, device.type);
                this.instrumentTabs.push(tabData);
            }

            this.instrumentTabs.sort((a, b) => a.channel - b.channel);
            const requestedTab = this.instrumentTabs.find(t => t.channel === instrumentChannel);
            this.activeChannel = requestedTab ? instrumentChannel : this.instrumentTabs[0].channel;
            this.activeSection = 'identity';

            // Update title
            this.options.title = '';
            this.open();

            // Set custom header after open
            const headerEl = this.$('.modal-header h2');
            if (headerEl) {
                headerEl.innerHTML = `⚙️ ${this.t('instrumentSettings.title')} — ${this.escape(device.displayName || device.name)}`;
            }

            // Init piano after DOM is ready
            this._initPianoForActiveTab();

        } catch (error) {
            console.error('Error opening instrument settings:', error);
            if (typeof showAlert === 'function') {
                await showAlert(`Impossible de charger les réglages: ${error.message}`, { title: 'Erreur', icon: '❌' });
            }
        }
    }

    async showCreate(deviceId) {
        // TODO: Mode création virtuel
        this.isCreationMode = true;
    }

    // ========== BaseModal OVERRIDES ==========

    renderBody() {
        return `
            ${this._renderTabsBar()}
            <div class="ism-layout">
                ${this._renderSidebar()}
                <div class="ism-content">
                    ${this._renderAllSections()}
                </div>
            </div>
        `;
    }

    renderFooter() {
        const showDelete = this.instrumentTabs.length > 1;
        return `
            <div class="ism-footer-left">
                ${showDelete ? `<button type="button" class="btn btn-danger ism-delete-btn" title="${this.t('instrumentManagement.deleteChannelBtn') || 'Supprimer cet instrument'}">🗑️ Ch ${this.activeChannel + 1}</button>` : ''}
            </div>
            <button type="button" class="btn btn-secondary ism-cancel-btn">${this.t('common.cancel') || 'Annuler'}</button>
            <button type="button" class="btn ism-save-btn">💾 ${this.t('common.save') || 'Sauvegarder'}</button>
        `;
    }

    onOpen() {
        this._attachListeners();
    }

    onClose() {
        // Cleanup
    }

    // ========== TABS BAR ==========

    _renderTabsBar() {
        let html = '<div class="ism-tabs-bar">';
        for (const tab of this.instrumentTabs) {
            const ch = tab.channel;
            const isActive = ch === this.activeChannel;
            const color = InstrumentSettingsModal.CHANNEL_COLORS[ch % 16];
            const name = tab.settings.custom_name || tab.settings.name || `Ch ${ch + 1}`;
            const isDrum = (ch === 9);
            html += `<button type="button" class="ism-tab ${isActive ? 'active' : ''}" data-channel="${ch}" style="${isActive ? `border-bottom-color: ${color}; color: ${color};` : ''}">
                <span class="ism-tab-ch" style="background: ${color};">Ch ${ch + 1}${isDrum ? ' DR' : ''}</span>
                <span class="ism-tab-name">${this.escape(name)}</span>
            </button>`;
        }
        html += `<button type="button" class="ism-tab ism-tab-add" title="${this.t('instrumentManagement.addInstrument') || 'Ajouter un instrument'}">
            <span style="font-size: 18px; font-weight: bold;">+</span>
        </button>`;
        html += '</div>';
        return html;
    }

    // ========== SIDEBAR ==========

    _renderSidebar() {
        const tab = this._getActiveTab();
        const settings = tab ? tab.settings : {};
        const gmProgram = settings.gm_program;
        const isString = typeof isGmStringInstrument === 'function' && isGmStringInstrument(gmProgram);
        const isDrum = this.activeChannel === 9 || (gmProgram !== null && gmProgram !== undefined && gmProgram >= 128);

        let html = '<nav class="ism-sidebar">';
        for (const sec of InstrumentSettingsModal.SECTIONS) {
            if (sec.id === 'strings' && !isString) continue;
            if (sec.id === 'drums' && !isDrum) continue;
            const active = this.activeSection === sec.id ? 'active' : '';
            html += `<button type="button" class="ism-nav-item ${active}" data-section="${sec.id}">
                <span class="ism-nav-icon">${sec.icon}</span>
                <span class="ism-nav-label">${this.t(sec.labelKey) || sec.fallback}</span>
            </button>`;
        }
        html += '</nav>';
        return html;
    }

    // ========== SECTIONS ==========

    _renderAllSections() {
        return `
            <div class="ism-section ${this.activeSection === 'identity' ? 'active' : ''}" data-section="identity">
                ${this._renderIdentitySection()}
            </div>
            <div class="ism-section ${this.activeSection === 'notes' ? 'active' : ''}" data-section="notes">
                ${this._renderNotesSection()}
            </div>
            <div class="ism-section ${this.activeSection === 'strings' ? 'active' : ''}" data-section="strings">
                ${this._renderStringsSection()}
            </div>
            <div class="ism-section ${this.activeSection === 'drums' ? 'active' : ''}" data-section="drums">
                ${this._renderDrumsSection()}
            </div>
            <div class="ism-section ${this.activeSection === 'advanced' ? 'active' : ''}" data-section="advanced">
                ${this._renderAdvancedSection()}
            </div>
        `;
    }

    _renderIdentitySection() {
        // Placeholder — sera rempli à l'étape 2
        return '<p>Section Identité (à implémenter)</p>';
    }

    _renderNotesSection() {
        // Placeholder — sera rempli à l'étape 3
        return '<p>Section Notes (à implémenter)</p>';
    }

    _renderStringsSection() {
        // Placeholder — sera rempli à l'étape 4
        return '<p>Section Cordes (à implémenter)</p>';
    }

    _renderDrumsSection() {
        // Placeholder — sera rempli à l'étape 5
        return '<p>Section Drums (à implémenter)</p>';
    }

    _renderAdvancedSection() {
        // Placeholder — sera rempli à l'étape 6
        return '<p>Section Avancé (à implémenter)</p>';
    }

    // ========== NAVIGATION ==========

    _switchSection(sectionId) {
        this.activeSection = sectionId;
        // Update sidebar active state
        this.$$('.ism-nav-item').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.section === sectionId);
        });
        // Update content sections
        this.$$('.ism-section').forEach(sec => {
            sec.classList.toggle('active', sec.dataset.section === sectionId);
        });
    }

    async _switchTab(channel) {
        this.activeChannel = channel;
        this.activeSection = 'identity';
        this._refreshContent();
        this._initPianoForActiveTab();
    }

    _refreshContent() {
        const body = this.$('.modal-body');
        if (body) body.innerHTML = this.renderBody();
        const footer = this.$('.modal-footer');
        if (footer) footer.innerHTML = this.renderFooter();
        this._attachListeners();
    }

    async _addTab() {
        const usedChannels = this.instrumentTabs.map(t => t.channel);
        const freeChannels = [];
        for (let ch = 0; ch < 16; ch++) {
            if (!usedChannels.includes(ch)) freeChannels.push(ch);
        }
        if (freeChannels.length === 0) {
            if (typeof showAlert === 'function') {
                await showAlert(this.t('instrumentManagement.allChannelsUsed') || 'Tous les canaux MIDI sont déjà utilisés.', {
                    title: this.t('instrumentManagement.addInstrumentTitle') || 'Ajouter',
                    icon: '⚠️'
                });
            }
            return;
        }

        // Channel selection popup
        const colors = InstrumentSettingsModal.CHANNEL_COLORS;
        let gridHtml = '<div class="add-inst-channel-grid">';
        for (let ch = 0; ch < 16; ch++) {
            const isUsed = usedChannels.includes(ch);
            const isDrum = (ch === 9);
            gridHtml += `<button type="button" class="add-inst-channel-btn ${isUsed ? 'used' : ''}" data-channel="${ch}" ${isUsed ? 'disabled' : ''} style="${!isUsed ? `border-color: ${colors[ch]};` : ''}">
                ${ch + 1}${isDrum ? ' DR' : ''}
            </button>`;
        }
        gridHtml += '</div>';

        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.style.zIndex = '10002';
        overlay.innerHTML = `
            <div class="modal-content" style="max-width: 420px;">
                <div class="modal-header">
                    <h2>${this.t('instrumentManagement.selectChannel') || 'Choisir un canal MIDI'}</h2>
                    <button class="modal-close" data-close-add>×</button>
                </div>
                <p style="margin: 0 0 16px 0; font-size: 13px; color: #6b7280;">
                    ${this.t('instrumentManagement.selectChannelHelp') || 'Sélectionnez un canal libre'}
                </p>
                ${gridHtml}
            </div>
        `;
        document.body.appendChild(overlay);

        overlay.querySelector('[data-close-add]').addEventListener('click', () => overlay.remove());
        overlay.querySelectorAll('.add-inst-channel-btn:not([disabled])').forEach(btn => {
            btn.addEventListener('click', async () => {
                const ch = parseInt(btn.dataset.channel);
                overlay.remove();
                try {
                    await this.api.sendCommand('instrument_add_to_device', {
                        deviceId: this.device.id,
                        channel: ch,
                        name: `Instrument Ch${ch + 1}`
                    });
                    const newTabData = await this._loadChannelData(this.device.id, ch, this.device.type);
                    this.instrumentTabs.push(newTabData);
                    this.instrumentTabs.sort((a, b) => a.channel - b.channel);
                    await this._switchTab(ch);
                } catch (e) {
                    console.error('Failed to add instrument:', e);
                    if (typeof showAlert === 'function') {
                        await showAlert((this.t('instrumentManagement.addFailed') || 'Erreur') + ': ' + e.message, { title: 'Erreur', icon: '❌' });
                    }
                }
            });
        });
    }

    async _deleteTab() {
        if (this.instrumentTabs.length <= 1) return;

        const confirmed = typeof showConfirm === 'function' && await showConfirm(
            this.t('instrumentManagement.deleteChannelConfirm') || `Supprimer l'instrument du canal ${this.activeChannel + 1} ?`,
            {
                title: this.t('instrumentManagement.deleteTitle') || 'Supprimer',
                icon: '🗑️',
                okText: this.t('common.delete') || 'Supprimer',
                danger: true
            }
        );
        if (!confirmed) return;

        try {
            await this.api.sendCommand('instrument_delete', {
                deviceId: this.device.id,
                channel: this.activeChannel
            });
            this.instrumentTabs = this.instrumentTabs.filter(t => t.channel !== this.activeChannel);
            await this._switchTab(this.instrumentTabs[0].channel);
        } catch (e) {
            console.error('Failed to delete instrument:', e);
        }
    }

    // ========== SAVE ==========

    async _save() {
        // Placeholder — sera rempli à l'étape 6
        console.log('Save not yet implemented');
    }

    // ========== DATA LOADING ==========

    async _loadChannelData(deviceId, channel, deviceType) {
        let settings = {};
        try {
            const response = await this.api.sendCommand('instrument_get_settings', { deviceId, channel });
            const rawSettings = response && response.settings ? response.settings : {};
            let capabilities = {};
            try {
                const capResponse = await this.api.sendCommand('instrument_get_capabilities', { deviceId, channel });
                capabilities = capResponse.capabilities || {};
            } catch (e) { /* ignore */ }
            settings = { ...rawSettings, ...capabilities };
        } catch (e) { /* ignore */ }

        const isBleDevice = !!(deviceType && (deviceType.toLowerCase().includes('ble') || deviceType.toLowerCase().includes('bluetooth'))) ||
                            !!(settings.mac_address);

        let stringInstrumentConfig = null;
        try {
            const siResp = await this.api.sendCommand('string_instrument_get', { device_id: deviceId, channel });
            if (siResp && siResp.instrument) stringInstrumentConfig = siResp.instrument;
        } catch (e) { /* no config */ }

        return { channel, settings, stringInstrumentConfig, isBleDevice };
    }

    // ========== HELPERS ==========

    _getActiveTab() {
        return this.instrumentTabs.find(t => t.channel === this.activeChannel) || null;
    }

    _initPianoForActiveTab() {
        const tab = this._getActiveTab();
        if (!tab) return;
        const s = tab.settings;
        if (typeof initPianoKeyboard === 'function') {
            setTimeout(() => {
                initPianoKeyboard(
                    s.note_range_min, s.note_range_max,
                    s.note_selection_mode || 'range',
                    s.selected_notes || []
                );
                if (typeof onGmProgramChanged === 'function') {
                    const gmSelect = document.getElementById('gmProgramSelect');
                    if (gmSelect) onGmProgramChanged(gmSelect);
                }
            }, 50);
        }
    }

    // ========== EVENT LISTENERS ==========

    _attachListeners() {
        // Sidebar nav
        this.$$('.ism-nav-item').forEach(btn => {
            btn.addEventListener('click', () => this._switchSection(btn.dataset.section));
        });

        // Tabs
        this.$$('.ism-tab[data-channel]').forEach(btn => {
            btn.addEventListener('click', () => this._switchTab(parseInt(btn.dataset.channel)));
        });
        const addBtn = this.$('.ism-tab-add');
        if (addBtn) addBtn.addEventListener('click', () => this._addTab());

        // Footer buttons
        const saveBtn = this.$('.ism-save-btn');
        if (saveBtn) saveBtn.addEventListener('click', () => this._save());
        const cancelBtn = this.$('.ism-cancel-btn');
        if (cancelBtn) cancelBtn.addEventListener('click', () => this.close());
        const deleteBtn = this.$('.ism-delete-btn');
        if (deleteBtn) deleteBtn.addEventListener('click', () => this._deleteTab());
    }
}

// Expose globally
if (typeof window !== 'undefined') {
    window.InstrumentSettingsModal = InstrumentSettingsModal;
}
