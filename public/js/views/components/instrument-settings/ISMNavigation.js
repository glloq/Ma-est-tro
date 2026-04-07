(function() {
    'use strict';
    const ISMNavigation = {};

    ISMNavigation._switchSection = function(sectionId) {
        this.activeSection = sectionId;
        // Update sidebar active state
        this.$$('.ism-nav-item').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.section === sectionId);
        });
        // Update content sections
        this.$$('.ism-section').forEach(sec => {
            sec.classList.toggle('active', sec.dataset.section === sectionId);
        });
        // Init piano when switching to notes section (needs visible viewport for size calc)
        if (sectionId === 'notes') {
            this._initPianoForActiveTab();
        }
    };

    ISMNavigation._switchTab = async function(channel) {
        this.activeChannel = channel;
        this.activeSection = 'identity';
        this._syncGlobalState();
        this._refreshContent();
        // Piano will init when user navigates to Notes section
    };

    ISMNavigation._refreshContent = function() {
        const body = this.$('.modal-body');
        if (body) body.innerHTML = this.renderBody();
        const footer = this.$('.modal-footer');
        if (footer) footer.innerHTML = this.renderFooter();
        this._attachListeners();
    };

    ISMNavigation._addTab = async function() {
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

        // Channel selection popup — show instrument names on used channels, highlight drums
        const colors = InstrumentSettingsModal.CHANNEL_COLORS;
        // Build a map of channel → instrument name for used channels
        const channelNames = {};
        for (const tab of this.instrumentTabs) {
            channelNames[tab.channel] = tab.settings.custom_name || tab.settings.name || `Instrument Ch${tab.channel + 1}`;
        }
        let gridHtml = '<div class="add-inst-channel-grid">';
        for (let ch = 0; ch < 16; ch++) {
            const isUsed = usedChannels.includes(ch);
            const isDrum = (ch === 9);
            const instName = channelNames[ch] || '';
            const tooltip = isUsed ? `${instName}` : (isDrum ? 'Canal percussion' : `Canal ${ch + 1} — libre`);
            // Used channels are selectable to allow adding a 2nd instrument (split mode)
            gridHtml += `<button type="button" class="add-inst-channel-btn ${isUsed ? 'used' : ''} ${isDrum ? 'drum' : ''}" data-channel="${ch}" style="border-color: ${colors[ch]};" title="${tooltip}">
                <span class="add-inst-ch-number">${ch + 1}${isDrum ? ' 🥁' : ''}</span>
                ${isUsed ? `<span class="add-inst-ch-name">${this.escape(instName)}</span>` : '<span class="add-inst-ch-free">' + (this.t('instrumentManagement.free') || 'libre') + '</span>'}
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
                <p class="ism-form-hint" style="margin: 0 0 16px 0;">
                    ${this.t('instrumentManagement.selectChannelHelp') || 'Sélectionnez un canal libre'}
                </p>
                ${gridHtml}
            </div>
        `;
        document.body.appendChild(overlay);

        overlay.querySelector('[data-close-add]').addEventListener('click', () => overlay.remove());
        overlay.querySelectorAll('.add-inst-channel-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const ch = parseInt(btn.dataset.channel);
                const isUsed = usedChannels.includes(ch);

                // If channel already has an instrument, confirm multi-instrument (split) mode
                if (isUsed) {
                    const existingName = channelNames[ch] || `Ch ${ch + 1}`;
                    const confirmed = typeof showConfirm === 'function' && await showConfirm(
                        (this.t('instrumentManagement.addSecondInstrument') || `Le canal ${ch + 1} a déjà "${existingName}". Ajouter un 2e instrument (mode split) ?`),
                        {
                            title: this.t('instrumentManagement.splitMode') || 'Mode multi-instrument',
                            icon: '🔀',
                            okText: this.t('common.add') || 'Ajouter'
                        }
                    );
                    if (!confirmed) return;
                }

                overlay.remove();
                try {
                    await this.api.sendCommand('instrument_add_to_device', {
                        deviceId: this.device.id,
                        channel: ch,
                        name: isUsed ? `Instrument 2 Ch${ch + 1}` : `Instrument Ch${ch + 1}`
                    });
                    const newTabData = await this._loadChannelData(this.device.id, ch, this.device.type);
                    if (!isUsed) {
                        this.instrumentTabs.push(newTabData);
                    } else {
                        // Multi-instrument: update existing tab data
                        const idx = this.instrumentTabs.findIndex(t => t.channel === ch);
                        if (idx >= 0) this.instrumentTabs[idx] = newTabData;
                    }
                    this.instrumentTabs.sort((a, b) => a.channel - b.channel);
                    await this._switchTab(ch);
                } catch (e) {
                    console.error('Failed to add instrument:', e);
                    if (typeof showAlert === 'function') {
                        await showAlert((this.t('instrumentManagement.addFailed') || 'Erreur') + ': ' + e.message, { title: this.t('common.error') || 'Erreur', icon: '❌' });
                    }
                }
            });
        });
    };

    ISMNavigation._deleteTab = async function() {
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
    };

    if (typeof window !== 'undefined') window.ISMNavigation = ISMNavigation;
})();
