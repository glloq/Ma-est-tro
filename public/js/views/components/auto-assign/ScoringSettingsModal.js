// public/js/views/components/auto-assign/ScoringSettingsModal.js
// Standalone modal for auto-assignment scoring settings with sidebar navigation
(function() {
'use strict';

class ScoringSettingsModal extends BaseModal {
  constructor(currentOverrides, onApply) {
    super({
      id: 'scoring-settings-modal',
      size: 'lg',
      title: 'scoringSettings.title',
      customClass: 'ss-modal'
    });
    this.overrides = JSON.parse(JSON.stringify(currentOverrides));
    this.onApplyCallback = onApply;
    this.activeSection = 'routing';
    this.activePreset = currentOverrides._preset || null;
    this.presetSnapshot = null;
  }

  // ============================================================================
  // Constants
  // ============================================================================

  static SECTIONS = [
    { id: 'routing', icon: '🔀', labelKey: 'scoringSettings.tabRouting', fallback: 'Routage' },
    { id: 'drums',   icon: '🥁', labelKey: 'scoringSettings.tabDrums',   fallback: 'Percussions' },
    { id: 'scoring', icon: '⚖️', labelKey: 'scoringSettings.tabScoring', fallback: 'Scoring' }
  ];

  static DRUM_CATEGORIES = [
    { key: 'kicks',   icon: '🥁', labelKey: 'scoringSettings.catKicks',   fallback: 'Kicks',   notes: '35, 36' },
    { key: 'snares',  icon: '🪘', labelKey: 'scoringSettings.catSnares',  fallback: 'Snares',  notes: '37, 38, 40' },
    { key: 'hiHats',  icon: '🎩', labelKey: 'scoringSettings.catHiHats',  fallback: 'Hi-Hats', notes: '42, 44, 46' },
    { key: 'toms',    icon: '🥁', labelKey: 'scoringSettings.catToms',    fallback: 'Toms',    notes: '41, 43, 45, 47, 48, 50' },
    { key: 'crashes', icon: '💥', labelKey: 'scoringSettings.catCrashes', fallback: 'Crashes', notes: '49, 55, 57' },
    { key: 'rides',   icon: '🔔', labelKey: 'scoringSettings.catRides',   fallback: 'Rides',   notes: '51, 53, 59' },
    { key: 'latin',   icon: '🪇', labelKey: 'scoringSettings.catLatin',   fallback: 'Latin',   notes: '60-68' },
    { key: 'misc',    icon: '🎵', labelKey: 'scoringSettings.catMisc',    fallback: 'Divers',  notes: '69-81' }
  ];

  // ============================================================================
  // Defaults
  // ============================================================================

  static getDefaults() {
    return {
      weights: { noteRange: 40, programMatch: 22, instrumentType: 20, polyphony: 13, ccSupport: 5 },
      scoreThresholds: { acceptable: 60, minimum: 30 },
      penalties: { transpositionPerOctave: 3, maxTranspositionOctaves: 3 },
      bonuses: { sameCategoryMatch: 15, sameFamilyMatch: 12, exactTypeMatch: 20 },
      percussion: {
        drumChannelDrumBonus: 15,
        drumChannelNonDrumPenalty: -100,
        nonDrumChannelDrumPenalty: -100,
        drumChannelWeights: { noteRange: 50, instrumentType: 30, polyphony: 10, programMatch: 5, ccSupport: 5 }
      },
      splitting: { triggerBelowScore: 60, minQuality: 50, maxInstruments: 4 }
    };
  }

  // ============================================================================
  // Presets
  // ============================================================================

  static getPresets() {
    return [
      { key: 'minimal', icon: '🎵', label: 'scoringSettings.presetMinimal', desc: 'scoringSettings.presetMinimalDesc',
        weights: { noteRange: 55, programMatch: 10, instrumentType: 15, polyphony: 15, ccSupport: 5 },
        scoreThresholds: { acceptable: 45, minimum: 20 },
        penalties: { transpositionPerOctave: 2, maxTranspositionOctaves: 4 },
        bonuses: { sameCategoryMatch: 8, sameFamilyMatch: 6, exactTypeMatch: 10 },
        percussion: { drumChannelDrumBonus: 15, drumChannelNonDrumPenalty: -100, nonDrumChannelDrumPenalty: -100,
          drumChannelWeights: { noteRange: 55, instrumentType: 25, polyphony: 10, programMatch: 5, ccSupport: 5 } },
        splitting: { triggerBelowScore: 40, minQuality: 35, maxInstruments: 2 } },

      { key: 'balanced', icon: '⚖️', label: 'scoringSettings.presetBalanced', desc: 'scoringSettings.presetBalancedDesc',
        weights: { noteRange: 40, programMatch: 22, instrumentType: 20, polyphony: 13, ccSupport: 5 },
        scoreThresholds: { acceptable: 60, minimum: 30 },
        penalties: { transpositionPerOctave: 3, maxTranspositionOctaves: 3 },
        bonuses: { sameCategoryMatch: 15, sameFamilyMatch: 12, exactTypeMatch: 20 },
        percussion: { drumChannelDrumBonus: 15, drumChannelNonDrumPenalty: -100, nonDrumChannelDrumPenalty: -100,
          drumChannelWeights: { noteRange: 50, instrumentType: 30, polyphony: 10, programMatch: 5, ccSupport: 5 } },
        splitting: { triggerBelowScore: 60, minQuality: 50, maxInstruments: 4 } },

      { key: 'orchestral', icon: '🎻', label: 'scoringSettings.presetOrchestral', desc: 'scoringSettings.presetOrchestralDesc',
        weights: { noteRange: 30, programMatch: 28, instrumentType: 28, polyphony: 8, ccSupport: 6 },
        scoreThresholds: { acceptable: 65, minimum: 35 },
        penalties: { transpositionPerOctave: 2, maxTranspositionOctaves: 2 },
        bonuses: { sameCategoryMatch: 20, sameFamilyMatch: 16, exactTypeMatch: 28 },
        percussion: { drumChannelDrumBonus: 10, drumChannelNonDrumPenalty: -100, nonDrumChannelDrumPenalty: -100,
          drumChannelWeights: { noteRange: 40, instrumentType: 40, polyphony: 10, programMatch: 5, ccSupport: 5 } },
        splitting: { triggerBelowScore: 55, minQuality: 55, maxInstruments: 3 } }
    ];
  }

  // ============================================================================
  // Ensure overrides have all required fields
  // ============================================================================

  _ensureDefaults() {
    const d = ScoringSettingsModal.getDefaults();
    if (!this.overrides.bonuses) this.overrides.bonuses = { ...d.bonuses };
    if (!this.overrides.percussion) this.overrides.percussion = { ...d.percussion };
    if (!this.overrides.percussion.drumChannelWeights) {
      this.overrides.percussion.drumChannelWeights = { ...d.percussion.drumChannelWeights };
    }
    if (this.overrides.percussion.drumChannelNonDrumPenalty === undefined) {
      this.overrides.percussion.drumChannelNonDrumPenalty = d.percussion.drumChannelNonDrumPenalty;
    }
    if (this.overrides.percussion.nonDrumChannelDrumPenalty === undefined) {
      this.overrides.percussion.nonDrumChannelDrumPenalty = d.percussion.nonDrumChannelDrumPenalty;
    }
  }

  // ============================================================================
  // Body / Footer rendering
  // ============================================================================

  renderBody() {
    this._ensureDefaults();
    if (!this.overrides.routing) this.overrides.routing = {};
    this._detectActivePreset();

    const presets = ScoringSettingsModal.getPresets();
    const activeP = presets.find(p => p.key === this.activePreset);

    return `
      <div class="ss-preset-bar">
        ${presets.map(p => `
          <button class="ss-preset-chip ${this.activePreset === p.key ? 'active' : ''}" data-preset="${p.key}" title="${this.t(p.desc)}">
            <span class="ss-preset-icon">${p.icon}</span>
            <span class="ss-preset-name">${this.t(p.label)}</span>
          </button>
        `).join('')}
      </div>
      <div class="ss-preset-desc" id="ssPresetDesc">${activeP ? this.t(activeP.desc) : ''}</div>
      <div class="ss-layout">
        ${this._renderSidebar()}
        <div class="ss-content">
          <div class="ss-section ${this.activeSection === 'routing' ? 'active' : ''}" data-section="routing">
            ${this._renderRoutingSection()}
          </div>
          <div class="ss-section ${this.activeSection === 'drums' ? 'active' : ''}" data-section="drums">
            ${this._renderDrumsSection()}
          </div>
          <div class="ss-section ${this.activeSection === 'scoring' ? 'active' : ''}" data-section="scoring">
            ${this._renderScoringSection()}
          </div>
        </div>
      </div>
    `;
  }

  renderFooter() {
    return `
      <button class="btn" id="ssReset">${this.t('scoringSettings.reset')}</button>
      <div style="flex:1"></div>
      <button class="btn" id="ssCancel">${this.t('common.cancel')}</button>
      <button class="btn btn-primary" id="ssApply">${this.t('scoringSettings.apply')}</button>
    `;
  }

  // ============================================================================
  // Sidebar
  // ============================================================================

  _renderSidebar() {
    let html = '<nav class="ss-sidebar">';
    for (const sec of ScoringSettingsModal.SECTIONS) {
      const active = this.activeSection === sec.id ? 'active' : '';
      html += `<button type="button" class="ss-nav-item ${active}" data-section="${sec.id}">
        <span class="ss-nav-icon">${sec.icon}</span>
        <span class="ss-nav-label">${this.t(sec.labelKey) || sec.fallback}</span>
      </button>`;
    }
    html += '</nav>';
    return html;
  }

  _switchSection(sectionId) {
    this.activeSection = sectionId;
    const dialog = this.dialog;
    if (!dialog) return;
    dialog.querySelectorAll('.ss-nav-item').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.section === sectionId);
    });
    dialog.querySelectorAll('.ss-section').forEach(sec => {
      sec.classList.toggle('active', sec.dataset.section === sectionId);
    });
  }

  // ============================================================================
  // Section: Routing
  // ============================================================================

  _renderRoutingSection() {
    const routing = this.overrides.routing;
    return `
      <h4 class="ss-section-title">🔀 ${this.t('scoringSettings.globalRouting') || 'Réglages routage'}</h4>
      <p class="ss-section-desc">${this.t('scoringSettings.globalRoutingDesc') || 'Options globales pour le routage automatique des canaux MIDI.'}</p>

      <div class="ss-toggle-group">
        <label class="ss-toggle-card">
          <input type="checkbox" class="ss-routing-toggle" data-key="autoSplitAvoidTransposition" ${routing.autoSplitAvoidTransposition ? 'checked' : ''}>
          <div class="ss-toggle-content">
            <span class="ss-toggle-title">${this.t('scoringSettings.autoSplitAvoidTransposition') || 'Découpe automatique si évite une transposition'}</span>
            <span class="ss-toggle-desc">${this.t('scoringSettings.autoSplitAvoidTranspositionDesc') || 'Divise un canal entre plusieurs instruments pour éviter la transposition'}</span>
          </div>
        </label>

        <label class="ss-toggle-card">
          <input type="checkbox" class="ss-routing-toggle" data-key="preferSingleInstrument" ${routing.preferSingleInstrument !== false ? 'checked' : ''}>
          <div class="ss-toggle-content">
            <span class="ss-toggle-title">${this.t('scoringSettings.preferSingleInstrument') || 'Préférer un seul instrument'}</span>
            <span class="ss-toggle-desc">${this.t('scoringSettings.preferSingleInstrumentDesc') || 'Évite de diviser un canal entre plusieurs instruments quand possible'}</span>
          </div>
        </label>

        <label class="ss-toggle-card">
          <input type="checkbox" class="ss-routing-toggle" data-key="preferSimilarGMType" ${routing.preferSimilarGMType !== false ? 'checked' : ''}>
          <div class="ss-toggle-content">
            <span class="ss-toggle-title">${this.t('scoringSettings.preferSimilarGMType') || 'Privilégier type GM similaire'}</span>
            <span class="ss-toggle-desc">${this.t('scoringSettings.preferSimilarGMTypeDesc') || 'Favorise les instruments dont le type GM correspond au canal'}</span>
          </div>
        </label>
      </div>
    `;
  }

  // ============================================================================
  // Section: Drums
  // ============================================================================

  _renderDrumsSection() {
    const routing = this.overrides.routing || {};
    const drumFallback = routing.drumFallback || {};
    const drumManualMap = routing.drumManualMap || {};
    const categories = ScoringSettingsModal.DRUM_CATEGORIES;

    // Summary counts
    let countSub = 0, countIgn = 0, countMan = 0;
    for (const cat of categories) {
      const val = drumFallback[cat.key] || 'substitute';
      if (val === 'substitute') countSub++;
      else if (val === 'ignore') countIgn++;
      else if (val === 'manual') countMan++;
    }

    let catsHtml = '';
    for (const cat of categories) {
      const val = drumFallback[cat.key] || 'substitute';
      const manualNote = drumManualMap[cat.key] != null ? drumManualMap[cat.key] : '';
      catsHtml += `
        <div class="ss-drum-cat-row">
          <div class="ss-drum-cat-info">
            <span class="ss-drum-cat-icon">${cat.icon}</span>
            <div class="ss-drum-cat-text">
              <span class="ss-drum-cat-name">${this.t(cat.labelKey) || cat.fallback}</span>
              <span class="ss-drum-cat-notes">${cat.notes}</span>
            </div>
          </div>
          <div class="ss-drum-options">
            <label class="ss-drum-option ${val === 'substitute' ? 'selected' : ''}" title="${this.t('scoringSettings.drumSubstituteDesc') || 'Remplacer par la note disponible la plus proche'}">
              <input type="radio" name="drumFallback_${cat.key}" value="substitute" ${val === 'substitute' ? 'checked' : ''} data-cat="${cat.key}">
              <span class="ss-drum-option-icon">🔄</span>
              <span class="ss-drum-option-label">${this.t('scoringSettings.drumSubstitute') || 'Substituer'}</span>
            </label>
            <label class="ss-drum-option ${val === 'ignore' ? 'selected' : ''}" title="${this.t('scoringSettings.drumIgnoreDesc') || 'Ne pas jouer cette note'}">
              <input type="radio" name="drumFallback_${cat.key}" value="ignore" ${val === 'ignore' ? 'checked' : ''} data-cat="${cat.key}">
              <span class="ss-drum-option-icon">⏭️</span>
              <span class="ss-drum-option-label">${this.t('scoringSettings.drumIgnore') || 'Ignorer'}</span>
            </label>
            <label class="ss-drum-option ${val === 'manual' ? 'selected' : ''}" title="${this.t('scoringSettings.drumManualDesc') || 'Mapper vers une note spécifique'}">
              <input type="radio" name="drumFallback_${cat.key}" value="manual" ${val === 'manual' ? 'checked' : ''} data-cat="${cat.key}">
              <span class="ss-drum-option-icon">✏️</span>
              <span class="ss-drum-option-label">${this.t('scoringSettings.drumManual') || 'Manuel'}</span>
            </label>
          </div>
          <div class="ss-drum-manual-input" data-cat="${cat.key}" style="${val === 'manual' ? '' : 'display:none'}">
            <label class="ss-drum-manual-label">${this.t('scoringSettings.drumMapTo') || 'Note cible'}</label>
            <input type="number" class="ss-drum-manual-note" data-cat="${cat.key}" value="${manualNote}" min="0" max="127" placeholder="0-127">
          </div>
        </div>
      `;
    }

    return `
      <h4 class="ss-section-title">🥁 ${this.t('scoringSettings.drumSettings') || 'Réglages Drums'}</h4>
      <p class="ss-section-desc">${this.t('scoringSettings.drumFallbackDesc') || 'Action quand une note est manquante par catégorie de percussion.'}</p>

      <div class="ss-drum-summary" id="ssDrumSummary">
        <span class="ss-drum-summary-item ss-sub">🔄 ${countSub}</span>
        <span class="ss-drum-summary-item ss-ign">⏭️ ${countIgn}</span>
        <span class="ss-drum-summary-item ss-man">✏️ ${countMan}</span>
      </div>

      <div class="ss-drum-categories">
        ${catsHtml}
      </div>
    `;
  }

  // ============================================================================
  // Section: Scoring (advanced)
  // ============================================================================

  _renderScoringSection() {
    return `
      <h4 class="ss-section-title">⚖️ ${this.t('scoringSettings.tabScoring') || 'Scoring'}</h4>
      <p class="ss-section-desc">${this.t('scoringSettings.scoringDesc') || 'Paramètres avancés de scoring pour l\'auto-assignation.'}</p>
      ${this._renderGeneralTab()}
      ${this._renderTranspositionTab()}
      ${this._renderPercussionTab()}
      ${this._renderSplittingTab()}
    `;
  }

  // ============================================================================
  // Scoring sub-sections
  // ============================================================================

  _renderGeneralTab() {
    const w = this.overrides.weights;
    const t = this.overrides.scoreThresholds;
    const sum = w.noteRange + w.programMatch + w.instrumentType + w.polyphony + w.ccSupport;

    return `
      <div class="ss-group">
        <h4>${this.t('scoringSettings.sectionWeights')}</h4>
        <p class="ss-group-desc">${this.t('scoringSettings.weightsDesc')}</p>
        ${this._linkedSlider('noteRange', 'scoringSettings.weightNoteRange', w.noteRange, 0, 80)}
        ${this._linkedSlider('programMatch', 'scoringSettings.weightProgramMatch', w.programMatch, 0, 60)}
        ${this._linkedSlider('instrumentType', 'scoringSettings.weightInstrumentType', w.instrumentType, 0, 60)}
        ${this._linkedSlider('polyphony', 'scoringSettings.weightPolyphony', w.polyphony, 0, 40)}
        ${this._linkedSlider('ccSupport', 'scoringSettings.weightCCSupport', w.ccSupport, 0, 30)}
        <div class="ss-weight-total ${sum !== 100 ? 'error' : ''}" id="ssWeightTotal">
          ${this.t('scoringSettings.total')}: <strong>${sum}</strong>/100
        </div>
      </div>
      <div class="ss-group">
        <h4>${this.t('scoringSettings.sectionThresholds')}</h4>
        ${this._slider('acceptable', 'scoringSettings.thresholdAcceptable', t.acceptable, 20, 95, 'scoreThresholds')}
        ${this._slider('minimum', 'scoringSettings.thresholdMinimum', t.minimum, 0, 60, 'scoreThresholds')}
      </div>
    `;
  }

  _renderTranspositionTab() {
    const p = this.overrides.penalties;
    const b = this.overrides.bonuses;

    return `
      <div class="ss-group">
        <h4>${this.t('scoringSettings.tabTransposition')}</h4>
        ${this._slider('maxTranspositionOctaves', 'scoringSettings.transMaxOctaves', p.maxTranspositionOctaves, 1, 6, 'penalties')}
        ${this._slider('transpositionPerOctave', 'scoringSettings.transPenalty', p.transpositionPerOctave, 0, 15, 'penalties')}
      </div>
      <div class="ss-group">
        <h4>${this.t('scoringSettings.sectionBonuses')}</h4>
        ${this._slider('sameCategoryMatch', 'scoringSettings.bonusSameCategory', b.sameCategoryMatch, 0, 25, 'bonuses')}
        ${this._slider('sameFamilyMatch', 'scoringSettings.bonusSameFamily', b.sameFamilyMatch, 0, 20, 'bonuses')}
        ${this._slider('exactTypeMatch', 'scoringSettings.bonusExactType', b.exactTypeMatch !== undefined ? b.exactTypeMatch : 20, 0, 30, 'bonuses')}
      </div>
    `;
  }

  _renderPercussionTab() {
    const perc = this.overrides.percussion;
    const dw = perc.drumChannelWeights;
    const dwSum = dw.noteRange + dw.instrumentType + dw.polyphony + dw.programMatch + dw.ccSupport;

    return `
      <div class="ss-group">
        <h4>${this.t('scoringSettings.sectionDrumWeights')}</h4>
        <p class="ss-group-desc">${this.t('scoringSettings.drumWeightsDesc')}</p>
        ${this._drumSlider('noteRange', 'scoringSettings.weightNoteRange', dw.noteRange, 0, 80)}
        ${this._drumSlider('instrumentType', 'scoringSettings.weightInstrumentType', dw.instrumentType, 0, 60)}
        ${this._drumSlider('polyphony', 'scoringSettings.weightPolyphony', dw.polyphony, 0, 30)}
        ${this._drumSlider('programMatch', 'scoringSettings.weightProgramMatch', dw.programMatch, 0, 20)}
        ${this._drumSlider('ccSupport', 'scoringSettings.weightCCSupport', dw.ccSupport, 0, 20)}
        <div class="ss-weight-total ${dwSum !== 100 ? 'error' : ''}" id="ssDrumWeightTotal">
          ${this.t('scoringSettings.total')}: <strong>${dwSum}</strong>/100
        </div>
      </div>
      <div class="ss-group">
        <h4>${this.t('scoringSettings.sectionDrumPenalties')}</h4>
        ${this._slider('drumChannelDrumBonus', 'scoringSettings.drumBonus', perc.drumChannelDrumBonus, 0, 30, 'percussion')}
        ${this._slider('drumChannelNonDrumPenalty', 'scoringSettings.drumNonDrumPenalty', perc.drumChannelNonDrumPenalty, -100, 0, 'percussion')}
        ${this._slider('nonDrumChannelDrumPenalty', 'scoringSettings.drumOnMelodicPenalty', perc.nonDrumChannelDrumPenalty, -100, 0, 'percussion')}
      </div>
    `;
  }

  _renderSplittingTab() {
    const s = this.overrides.splitting;

    return `
      <div class="ss-group">
        <h4>${this.t('scoringSettings.tabSplitting')}</h4>
        ${this._slider('triggerBelowScore', 'scoringSettings.splitTrigger', s.triggerBelowScore, 20, 90, 'splitting')}
        ${this._slider('minQuality', 'scoringSettings.splitMinQuality', s.minQuality, 10, 90, 'splitting')}
        ${this._slider('maxInstruments', 'scoringSettings.splitMaxInstruments', s.maxInstruments, 2, 8, 'splitting')}
      </div>
    `;
  }

  // ============================================================================
  // Slider helpers
  // ============================================================================

  _linkedSlider(key, labelKey, value, min, max) {
    return `
      <div class="ss-slider-row">
        <label class="ss-slider-label">${this.t(labelKey)}</label>
        <input type="range" class="ss-slider ss-linked" data-key="${key}" min="${min}" max="${max}" value="${value}">
        <span class="ss-slider-value" id="ssW_${key}">${value}</span>
      </div>
    `;
  }

  _drumSlider(key, labelKey, value, min, max) {
    return `
      <div class="ss-slider-row">
        <label class="ss-slider-label">${this.t(labelKey)}</label>
        <input type="range" class="ss-slider ss-drum-linked" data-key="${key}" min="${min}" max="${max}" value="${value}">
        <span class="ss-slider-value" id="ssDW_${key}">${value}</span>
      </div>
    `;
  }

  _slider(key, labelKey, value, min, max, group) {
    return `
      <div class="ss-slider-row">
        <label class="ss-slider-label">${this.t(labelKey)}</label>
        <input type="range" class="ss-slider ss-simple" data-key="${key}" data-group="${group}" min="${min}" max="${max}" value="${value}">
        <span class="ss-slider-value">${value}</span>
      </div>
    `;
  }

  // ============================================================================
  // Event binding
  // ============================================================================

  onOpen() {
    const dialog = this.dialog;
    if (!dialog) return;

    // Sidebar navigation
    dialog.querySelectorAll('.ss-nav-item').forEach(btn => {
      btn.addEventListener('click', () => this._switchSection(btn.dataset.section));
    });

    // Preset chip clicks
    dialog.querySelectorAll('.ss-preset-chip').forEach(chip => {
      chip.addEventListener('click', () => this._applyPreset(chip.dataset.preset));
    });

    // Global routing toggles
    dialog.querySelectorAll('.ss-routing-toggle').forEach(toggle => {
      toggle.addEventListener('change', () => {
        if (!this.overrides.routing) this.overrides.routing = {};
        this.overrides.routing[toggle.dataset.key] = toggle.checked;
      });
    });

    // Drum fallback radios
    dialog.querySelectorAll('.ss-drum-options input[type="radio"]').forEach(radio => {
      radio.addEventListener('change', () => {
        const cat = radio.dataset.cat;
        const val = radio.value;
        if (!this.overrides.routing) this.overrides.routing = {};
        if (!this.overrides.routing.drumFallback) this.overrides.routing.drumFallback = {};
        this.overrides.routing.drumFallback[cat] = val;

        // Update visual selection
        const row = radio.closest('.ss-drum-cat-row');
        if (row) {
          row.querySelectorAll('.ss-drum-option').forEach(opt => {
            opt.classList.toggle('selected', opt.querySelector('input').checked);
          });
          // Show/hide manual input
          const manualInput = row.querySelector('.ss-drum-manual-input');
          if (manualInput) {
            manualInput.style.display = val === 'manual' ? '' : 'none';
          }
        }

        this._updateDrumSummary();
      });
    });

    // Drum manual note inputs
    dialog.querySelectorAll('.ss-drum-manual-note').forEach(input => {
      input.addEventListener('change', () => {
        const cat = input.dataset.cat;
        const val = parseInt(input.value);
        if (!this.overrides.routing) this.overrides.routing = {};
        if (!this.overrides.routing.drumManualMap) this.overrides.routing.drumManualMap = {};
        this.overrides.routing.drumManualMap[cat] = isNaN(val) ? null : Math.max(0, Math.min(127, val));
      });
    });

    // Linked weight sliders (general)
    dialog.querySelectorAll('.ss-linked').forEach(slider => {
      slider.addEventListener('input', () => {
        this._onLinkedWeightChange(slider.dataset.key, parseInt(slider.value), 'weights', 'ssW_', 'ssWeightTotal');
        this._updatePresetIndicator();
      });
    });

    // Linked drum weight sliders
    dialog.querySelectorAll('.ss-drum-linked').forEach(slider => {
      slider.addEventListener('input', () => {
        this._onLinkedWeightChange(slider.dataset.key, parseInt(slider.value), 'drumWeights', 'ssDW_', 'ssDrumWeightTotal');
        this._updatePresetIndicator();
      });
    });

    // Simple sliders
    dialog.querySelectorAll('.ss-simple').forEach(slider => {
      slider.addEventListener('input', () => {
        const key = slider.dataset.key;
        const group = slider.dataset.group;
        const val = parseInt(slider.value);
        if (this.overrides[group]) {
          this.overrides[group][key] = val;
        }
        slider.nextElementSibling.textContent = val;
        this._updatePresetIndicator();
      });
    });

    // Footer buttons
    dialog.querySelector('#ssReset')?.addEventListener('click', () => this._reset());
    dialog.querySelector('#ssCancel')?.addEventListener('click', () => this.close());
    dialog.querySelector('#ssApply')?.addEventListener('click', () => this._apply());
  }

  // ============================================================================
  // Drum summary update
  // ============================================================================

  _updateDrumSummary() {
    const summary = this.dialog?.querySelector('#ssDrumSummary');
    if (!summary) return;
    const routing = this.overrides.routing || {};
    const drumFallback = routing.drumFallback || {};
    const categories = ScoringSettingsModal.DRUM_CATEGORIES;
    let countSub = 0, countIgn = 0, countMan = 0;
    for (const cat of categories) {
      const val = drumFallback[cat.key] || 'substitute';
      if (val === 'substitute') countSub++;
      else if (val === 'ignore') countIgn++;
      else if (val === 'manual') countMan++;
    }
    summary.innerHTML = `
      <span class="ss-drum-summary-item ss-sub">🔄 ${countSub}</span>
      <span class="ss-drum-summary-item ss-ign">⏭️ ${countIgn}</span>
      <span class="ss-drum-summary-item ss-man">✏️ ${countMan}</span>
    `;
  }

  // ============================================================================
  // Linked weight logic
  // ============================================================================

  _onLinkedWeightChange(changedKey, newValue, weightGroup, idPrefix, totalId) {
    const keys = ['noteRange', 'programMatch', 'instrumentType', 'polyphony', 'ccSupport'];
    let w;

    if (weightGroup === 'drumWeights') {
      w = this.overrides.percussion.drumChannelWeights;
    } else {
      w = this.overrides.weights;
    }

    const oldValue = w[changedKey];
    const delta = newValue - oldValue;
    if (delta === 0) return;

    const otherKeys = keys.filter(k => k !== changedKey);
    const otherTotal = otherKeys.reduce((s, k) => s + w[k], 0);

    if (otherTotal === 0 && delta > 0) return;

    let remaining = -delta;
    for (let i = 0; i < otherKeys.length; i++) {
      const k = otherKeys[i];
      if (i === otherKeys.length - 1) {
        w[k] = Math.max(0, w[k] + remaining);
      } else {
        const share = otherTotal > 0 ? w[k] / otherTotal : 1 / otherKeys.length;
        const adj = Math.round(remaining * share);
        const nv = Math.max(0, w[k] + adj);
        remaining -= (nv - w[k]);
        w[k] = nv;
      }
    }
    w[changedKey] = newValue;

    // Update all displays
    const dialog = this.dialog;
    for (const k of keys) {
      const sl = dialog.querySelector(`.ss-slider[data-key="${k}"]${weightGroup === 'drumWeights' ? '.ss-drum-linked' : '.ss-linked'}`);
      const ve = dialog.querySelector(`#${idPrefix}${k}`);
      if (sl) sl.value = w[k];
      if (ve) ve.textContent = w[k];
    }

    const sum = keys.reduce((s, k) => s + w[k], 0);
    const totalEl = dialog.querySelector(`#${totalId}`);
    if (totalEl) {
      totalEl.innerHTML = `${this.t('scoringSettings.total')}: <strong>${sum}</strong>/100`;
      totalEl.classList.toggle('error', sum !== 100);
    }
  }

  // ============================================================================
  // Preset management
  // ============================================================================

  _applyPreset(key) {
    const preset = ScoringSettingsModal.getPresets().find(p => p.key === key);
    if (!preset) return;

    // Preserve routing settings across preset changes
    const savedRouting = this.overrides.routing;

    // Deep copy preset values into overrides
    this.overrides.weights = { ...preset.weights };
    this.overrides.scoreThresholds = { ...preset.scoreThresholds };
    this.overrides.penalties = { ...preset.penalties };
    this.overrides.bonuses = { ...preset.bonuses };
    this.overrides.percussion = {
      ...preset.percussion,
      drumChannelWeights: { ...preset.percussion.drumChannelWeights }
    };
    this.overrides.splitting = { ...preset.splitting };
    if (savedRouting) this.overrides.routing = savedRouting;
    this.activePreset = key;
    this.presetSnapshot = JSON.stringify(this.overrides);

    // Re-render body and re-attach events
    const bodyEl = this.dialog?.querySelector('.modal-body');
    if (bodyEl) {
      bodyEl.innerHTML = this.renderBody();
      this.onOpen();
    }
  }

  _detectActivePreset() {
    const presets = ScoringSettingsModal.getPresets();
    const compareKeys = ['weights', 'scoreThresholds', 'penalties', 'bonuses', 'splitting'];

    for (const preset of presets) {
      let matches = true;
      for (const group of compareKeys) {
        if (!this.overrides[group]) { matches = false; break; }
        for (const [k, v] of Object.entries(preset[group])) {
          if (this.overrides[group][k] !== v) { matches = false; break; }
        }
        if (!matches) break;
      }
      // Also check percussion
      if (matches && this.overrides.percussion) {
        if (this.overrides.percussion.drumChannelDrumBonus !== preset.percussion.drumChannelDrumBonus) matches = false;
        if (matches && this.overrides.percussion.drumChannelNonDrumPenalty !== preset.percussion.drumChannelNonDrumPenalty) matches = false;
        if (matches && this.overrides.percussion.nonDrumChannelDrumPenalty !== preset.percussion.nonDrumChannelDrumPenalty) matches = false;
        if (matches && this.overrides.percussion.drumChannelWeights) {
          for (const [k, v] of Object.entries(preset.percussion.drumChannelWeights)) {
            if (this.overrides.percussion.drumChannelWeights[k] !== v) { matches = false; break; }
          }
        }
      }
      if (matches) {
        this.activePreset = preset.key;
        this.presetSnapshot = JSON.stringify(this.overrides);
        return;
      }
    }
    this.activePreset = null;
    this.presetSnapshot = null;
  }

  _updatePresetIndicator() {
    const dialog = this.dialog;
    if (!dialog) return;

    const isModified = this.presetSnapshot && JSON.stringify(this.overrides) !== this.presetSnapshot;

    dialog.querySelectorAll('.ss-preset-chip').forEach(chip => {
      const isActive = chip.dataset.preset === this.activePreset;
      chip.classList.toggle('active', isActive);
      chip.classList.toggle('modified', isActive && isModified);
    });

    const descEl = dialog.querySelector('#ssPresetDesc');
    if (descEl) {
      if (this.activePreset) {
        const preset = ScoringSettingsModal.getPresets().find(p => p.key === this.activePreset);
        descEl.textContent = preset ? this.t(preset.desc) : '';
      } else {
        descEl.textContent = '';
      }
    }
  }

  // ============================================================================
  // Actions
  // ============================================================================

  _reset() {
    this._applyPreset('balanced');
  }

  _apply() {
    this.overrides._preset = this.activePreset;
    if (typeof this.onApplyCallback === 'function') {
      this.onApplyCallback(this.overrides);
    }
    this.close();
  }
}

window.ScoringSettingsModal = ScoringSettingsModal;
})();
