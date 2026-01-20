// public/js/views/components/AutoAssignModal.js

/**
 * AutoAssignModal - Modal for auto-assigning MIDI channels to instruments
 *
 * Displays suggestions for each channel with compatibility scores
 * and allows the user to select the instrument for each channel.
 */
class AutoAssignModal {
  constructor(apiClient) {
    this.apiClient = apiClient;
    this.fileId = null;
    this.suggestions = {};
    this.autoSelection = {};
    this.selectedAssignments = {}; // User's selections
    this.modal = null;
  }

  /**
   * Show the modal with auto-assignment suggestions
   * @param {number} fileId - MIDI file ID
   */
  async show(fileId) {
    this.fileId = fileId;

    // Show loading modal
    this.showLoading();

    try {
      // Generate suggestions
      const response = await this.apiClient.sendCommand('generate_assignment_suggestions', {
        fileId: fileId,
        topN: 5,
        minScore: 30
      });

      if (!response.success) {
        this.showError(response.error || 'Failed to generate suggestions');
        return;
      }

      this.suggestions = response.suggestions;
      this.autoSelection = response.autoSelection;
      this.confidenceScore = response.confidenceScore;

      // Initialize selected assignments with auto-selection
      this.selectedAssignments = JSON.parse(JSON.stringify(this.autoSelection));

      // Show suggestions modal
      this.showSuggestions();
    } catch (error) {
      this.showError(error.message || 'Failed to generate suggestions');
    }
  }

  /**
   * Show loading state
   */
  showLoading() {
    const html = `
      <div class="modal-overlay" id="autoAssignModal">
        <div class="modal-container" style="max-width: 600px;">
          <div class="modal-header">
            <h2>Auto-Assign Instruments</h2>
          </div>
          <div class="modal-body" style="text-align: center; padding: 40px;">
            <div class="spinner"></div>
            <p style="margin-top: 20px;">Analyzing channels and instruments...</p>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', html);
    this.modal = document.getElementById('autoAssignModal');
  }

  /**
   * Show error message
   */
  showError(message) {
    if (this.modal) {
      this.modal.remove();
    }

    const html = `
      <div class="modal-overlay" id="autoAssignModal">
        <div class="modal-container" style="max-width: 600px;">
          <div class="modal-header">
            <h2>Auto-Assign Error</h2>
            <button class="modal-close" onclick="document.getElementById('autoAssignModal').remove()">×</button>
          </div>
          <div class="modal-body" style="padding: 40px; text-align: center;">
            <p style="color: #ff4444; font-size: 16px;">${message}</p>
            <button class="button button-secondary" onclick="document.getElementById('autoAssignModal').remove()" style="margin-top: 20px;">
              Close
            </button>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', html);
    this.modal = document.getElementById('autoAssignModal');
  }

  /**
   * Show suggestions interface
   */
  showSuggestions() {
    if (this.modal) {
      this.modal.remove();
    }

    const channels = Object.keys(this.suggestions).sort((a, b) => parseInt(a) - parseInt(b));

    if (channels.length === 0) {
      this.showError('No active channels found in this MIDI file');
      return;
    }

    const channelsHTML = channels.map(channel => this.renderChannelSuggestions(parseInt(channel))).join('');

    const html = `
      <div class="modal-overlay" id="autoAssignModal">
        <div class="modal-container" style="max-width: 900px; max-height: 90vh; overflow-y: auto;">
          <div class="modal-header">
            <h2>Auto-Assign Instruments</h2>
            <button class="modal-close" onclick="autoAssignModalInstance.close()">×</button>
          </div>
          <div class="modal-body" style="padding: 0;">
            <div style="padding: 20px; background: #f5f5f5; border-bottom: 1px solid #ddd;">
              <div style="display: flex; align-items: center; justify-content: space-between;">
                <div>
                  <strong>Confidence Score:</strong>
                  <span style="font-size: 20px; font-weight: bold; color: ${this.getScoreColor(this.confidenceScore)};">
                    ${this.confidenceScore}/100
                  </span>
                  ${this.getScoreStars(this.confidenceScore)}
                </div>
                <div style="color: #666; font-size: 14px;">
                  ${channels.length} channel(s) detected
                </div>
              </div>
            </div>

            <div style="padding: 20px;">
              ${channelsHTML}
            </div>
          </div>
          <div class="modal-footer" style="display: flex; justify-content: space-between; padding: 20px; border-top: 1px solid #ddd;">
            <button class="button button-secondary" onclick="autoAssignModalInstance.close()">
              Cancel
            </button>
            <div style="display: flex; gap: 10px;">
              <button class="button button-info" onclick="autoAssignModalInstance.quickAssign()" title="Auto-assign and apply in one click">
                ⚡ Quick Assign & Apply
              </button>
              <button class="button button-primary" onclick="autoAssignModalInstance.apply()">
                Apply Assignments
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', html);
    this.modal = document.getElementById('autoAssignModal');

    // Make instance globally accessible for event handlers
    window.autoAssignModalInstance = this;
  }

  /**
   * Render channel statistics
   */
  renderChannelStats(channel) {
    const analysis = this.selectedAssignments[channel]?.channelAnalysis;
    if (!analysis) return '';

    return `
      <div style="background: #f0f8ff; padding: 10px; border-radius: 4px; margin-bottom: 10px; font-size: 12px;">
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px;">
          <div>
            <strong>📝 Note Range:</strong><br>
            ${analysis.noteRange.min} - ${analysis.noteRange.max} (${analysis.noteRange.max - analysis.noteRange.min} semitones)
          </div>
          <div>
            <strong>🎵 Polyphony:</strong><br>
            Max: ${analysis.polyphony.max} | Avg: ${analysis.polyphony.avg.toFixed(1)}
          </div>
          <div>
            <strong>🎹 Type:</strong><br>
            ${analysis.estimatedType} ${this.typeConfidences && this.typeConfidences[channel] ? `(${this.typeConfidences[channel]}% confidence)` : ''}
          </div>
        </div>
        ${this.renderMiniPiano(analysis.noteRange)}
      </div>
    `;
  }

  /**
   * Render mini piano visualization
   */
  renderMiniPiano(noteRange) {
    const startOctave = Math.floor(noteRange.min / 12);
    const endOctave = Math.ceil(noteRange.max / 12);
    const octaves = [];

    for (let oct = startOctave; oct <= endOctave; oct++) {
      octaves.push(oct);
    }

    // Simplified piano viz (just showing range)
    return `
      <div style="margin-top: 8px;">
        <div style="display: flex; align-items: center; gap: 4px; font-size: 10px;">
          <span>Range:</span>
          <div style="flex: 1; height: 20px; background: linear-gradient(to right, #ddd, #4CAF50, #ddd); border-radius: 3px; position: relative;">
            <div style="position: absolute; left: 10%; width: 80%; height: 100%; background: #4CAF50; opacity: 0.5; border-radius: 3px;"></div>
          </div>
          <span>${noteRange.min} → ${noteRange.max}</span>
        </div>
      </div>
    `;
  }

  /**
   * Render suggestions for a single channel
   */
  renderChannelSuggestions(channel) {
    const options = this.suggestions[channel] || [];
    const selectedDeviceId = this.selectedAssignments[channel]?.deviceId;

    if (options.length === 0) {
      return `
        <div class="channel-suggestions" style="margin-bottom: 30px; padding: 20px; background: #fff; border: 1px solid #ddd; border-radius: 8px;">
          <h3 style="margin: 0 0 15px 0; color: #333;">
            Channel ${channel + 1}
            ${channel === 9 ? '<span style="color: #888; font-size: 14px;">(Drums)</span>' : ''}
          </h3>
          <p style="color: #999;">No compatible instruments found</p>
        </div>
      `;
    }

    const optionsHTML = options.map((option, index) => {
      const instrument = option.instrument;
      const compat = option.compatibility;
      const isSelected = instrument.device_id === selectedDeviceId;

      return `
        <div class="instrument-option ${isSelected ? 'selected' : ''}"
             data-channel="${channel}"
             data-device-id="${instrument.device_id}"
             onclick="autoAssignModalInstance.selectInstrument(${channel}, '${instrument.device_id}')"
             style="padding: 15px; margin-bottom: 10px; border: 2px solid ${isSelected ? '#4CAF50' : '#ddd'};
                    border-radius: 8px; cursor: pointer; background: ${isSelected ? '#f0fff0' : '#fff'};
                    transition: all 0.2s;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div style="flex: 1;">
              <div style="font-weight: bold; font-size: 16px; margin-bottom: 5px;">
                ${instrument.custom_name || instrument.name}
              </div>
              <div style="color: #666; font-size: 13px; margin-bottom: 8px;">
                ${this.formatInstrumentInfo(instrument, compat)}
              </div>
              ${compat.info && compat.info.length > 0 ? `
                <div style="color: #4CAF50; font-size: 12px;">
                  ✓ ${compat.info.join(' • ')}
                </div>
              ` : ''}
              ${compat.issues && compat.issues.length > 0 ? `
                <div style="color: #ff9800; font-size: 12px; margin-top: 4px;">
                  ⚠ ${compat.issues.map(i => i.message).join(' • ')}
                </div>
              ` : ''}
            </div>
            <div style="text-align: right; margin-left: 20px;">
              <div style="font-size: 24px; font-weight: bold; color: ${this.getScoreColor(compat.score)};">
                ${compat.score}
              </div>
              <div style="font-size: 11px; color: #666;">
                ${this.getScoreStars(compat.score)}
              </div>
              ${index === 0 ? '<div style="font-size: 11px; color: #4CAF50; margin-top: 4px;">RECOMMENDED</div>' : ''}
            </div>
          </div>
        </div>
      `;
    }).join('');

    return `
      <div class="channel-suggestions" style="margin-bottom: 30px; padding: 20px; background: #fafafa; border: 1px solid #ddd; border-radius: 8px;">
        <h3 style="margin: 0 0 15px 0; color: #333;">
          Channel ${channel + 1}
          ${channel === 9 ? '<span style="color: #888; font-size: 14px;">(MIDI 10 - Drums)</span>' : ''}
        </h3>
        ${this.renderChannelStats(channel)}
        ${optionsHTML}
      </div>
    `;
  }

  /**
   * Format instrument info line
   */
  formatInstrumentInfo(instrument, compat) {
    const parts = [];

    if (instrument.gm_program !== null && instrument.gm_program !== undefined) {
      parts.push(`GM Program ${instrument.gm_program}`);
    }

    if (compat.transposition && compat.transposition.octaves !== 0) {
      const direction = compat.transposition.octaves > 0 ? '↑' : '↓';
      parts.push(`${direction} ${Math.abs(compat.transposition.octaves)} octave(s)`);
    } else {
      parts.push('No transposition');
    }

    if (instrument.note_range_min !== null && instrument.note_range_max !== null) {
      parts.push(`Range: ${instrument.note_range_min}-${instrument.note_range_max}`);
    }

    return parts.join(' • ');
  }

  /**
   * Get color based on score
   */
  getScoreColor(score) {
    if (score >= 80) return '#4CAF50'; // Green
    if (score >= 60) return '#8BC34A'; // Light green
    if (score >= 40) return '#FF9800'; // Orange
    return '#F44336'; // Red
  }

  /**
   * Get star rating based on score
   */
  getScoreStars(score) {
    if (score >= 90) return '⭐⭐⭐⭐⭐';
    if (score >= 75) return '⭐⭐⭐⭐';
    if (score >= 60) return '⭐⭐⭐';
    if (score >= 40) return '⭐⭐';
    return '⭐';
  }

  /**
   * Select an instrument for a channel
   */
  selectInstrument(channel, deviceId) {
    // Find the selected option
    const options = this.suggestions[channel] || [];
    const selectedOption = options.find(opt => opt.instrument.device_id === deviceId);

    if (!selectedOption) {
      console.error(`Instrument not found: ${deviceId}`);
      return;
    }

    // Update selected assignments
    this.selectedAssignments[channel] = {
      deviceId: deviceId,
      instrumentId: selectedOption.instrument.id,
      instrumentName: selectedOption.instrument.name,
      customName: selectedOption.instrument.custom_name,
      score: selectedOption.compatibility.score,
      transposition: selectedOption.compatibility.transposition,
      noteRemapping: selectedOption.compatibility.noteRemapping,
      issues: selectedOption.compatibility.issues,
      info: selectedOption.compatibility.info
    };

    // Re-render suggestions to update selection
    this.showSuggestions();
  }

  /**
   * Apply the selected assignments
   */
  async apply() {
    if (Object.keys(this.selectedAssignments).length === 0) {
      alert('No assignments selected');
      return;
    }

    // Show applying state
    if (this.modal) {
      const footer = this.modal.querySelector('.modal-footer');
      footer.innerHTML = `
        <div style="width: 100%; text-align: center;">
          <div class="spinner" style="display: inline-block;"></div>
          <p style="margin-top: 10px;">Creating adapted file and applying assignments...</p>
        </div>
      `;
    }

    try {
      // Apply assignments
      const response = await this.apiClient.sendCommand('apply_assignments', {
        originalFileId: this.fileId,
        assignments: this.selectedAssignments,
        createAdaptedFile: true
      });

      if (!response.success) {
        alert('Failed to apply assignments: ' + (response.error || 'Unknown error'));
        this.close();
        return;
      }

      // Success!
      alert(`Assignments applied successfully!\n\nAdapted file created: ${response.filename}\n${response.stats.notesChanged} notes transposed`);

      this.close();

      // Reload file list or notify parent
      if (window.midiFileManager) {
        window.midiFileManager.refreshFileList();
      }

      // Dispatch event for other components
      window.dispatchEvent(new CustomEvent('auto-assignment-applied', {
        detail: {
          adaptedFileId: response.adaptedFileId,
          filename: response.filename,
          routings: response.routings
        }
      }));
    } catch (error) {
      alert('Error applying assignments: ' + error.message);
      this.close();
    }
  }

  /**
   * Quick assign: apply auto-selection immediately without manual review
   */
  async quickAssign() {
    if (!confirm('This will automatically assign all channels to the recommended instruments and apply immediately. Continue?')) {
      return;
    }

    // Use auto-selection (already set in this.selectedAssignments)
    await this.apply();
  }

  /**
   * Close the modal
   */
  close() {
    if (this.modal) {
      this.modal.remove();
      this.modal = null;
    }

    // Clean up global reference
    if (window.autoAssignModalInstance === this) {
      delete window.autoAssignModalInstance;
    }
  }
}

// Make available globally
window.AutoAssignModal = AutoAssignModal;
