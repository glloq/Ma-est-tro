/**
 * PlaylistEditorModal
 *
 * Modal for adding/removing files from a playlist.
 * Extends BaseModal with 2-column layout matching modal-playlist.css.
 *
 * Left column: Available MIDI files with search
 * Right column: Current playlist items (numbered, removable)
 */

class PlaylistEditorModal extends BaseModal {
  constructor(apiClient, playlistId) {
    super({
      id: 'playlist-editor-modal',
      size: 'xl',
      title: 'playlist.editPlaylist',
      closeOnEscape: true,
      closeOnOverlay: true,
      customClass: 'playlist-editor'
    });
    this.apiClient = apiClient;
    this.playlistId = playlistId;
    this.availableFiles = [];
    this.playlistItems = [];
    this.searchQuery = '';
    this.onCloseCallback = null;
  }

  set onClose(fn) {
    this.onCloseCallback = fn;
  }

  _formatDuration(seconds) {
    if (!seconds || isNaN(seconds)) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  renderBody() {
    return `
      <div class="playlist-content" style="display:grid;grid-template-columns:1fr 1fr;gap:20px;height:60vh;">
        <!-- Available Files -->
        <div class="available-files" style="display:flex;flex-direction:column;overflow:hidden;">
          <div style="margin-bottom:10px;">
            <input type="text" class="file-search-box" id="playlistEditorSearch"
              placeholder="${this.t('playlist.searchFiles') || 'Search files...'}"
              style="width:100%;padding:8px 12px;border:1px solid #dee2e6;border-radius:6px;font-size:0.9rem;">
          </div>
          <div id="playlistEditorAvailableFiles" style="flex:1;overflow-y:auto;"></div>
        </div>
        <!-- Playlist Files -->
        <div class="playlist-files" style="display:flex;flex-direction:column;overflow:hidden;">
          <h4 style="margin:0 0 10px 0;font-size:1rem;">${this.t('playlist.playlistContent') || 'Playlist content'}</h4>
          <div id="playlistEditorPlaylistItems" style="flex:1;overflow-y:auto;"></div>
          <div class="playlist-editor-stats" id="playlistEditorStats" style="padding:8px 0;font-size:0.85rem;color:#6c757d;border-top:1px solid #dee2e6;margin-top:8px;"></div>
        </div>
      </div>`;
  }

  renderFooter() {
    return `
      <button class="btn btn-secondary" id="playlistEditorCloseBtn">${this.t('common.close') || 'Close'}</button>`;
  }

  async onOpen() {
    // Load data
    await Promise.all([
      this._loadAvailableFiles(),
      this._loadPlaylistItems()
    ]);

    this._renderAvailableFiles();
    this._renderPlaylistItems();

    // Search handler
    const searchInput = this.$('#playlistEditorSearch');
    if (searchInput) {
      searchInput.addEventListener('input', () => {
        this.searchQuery = searchInput.value.toLowerCase();
        this._renderAvailableFiles();
      });
    }

    // Close button
    const closeBtn = this.$('#playlistEditorCloseBtn');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.close());
    }
  }

  onClose() {
    if (this.onCloseCallback) {
      this.onCloseCallback();
    }
  }

  async _loadAvailableFiles() {
    try {
      this.availableFiles = await this.apiClient.listMidiFiles('/');
    } catch (error) {
      console.error('Failed to load files:', error);
      this.availableFiles = [];
    }
  }

  async _loadPlaylistItems() {
    try {
      const result = await this.apiClient.sendCommand('playlist_get', { playlistId: this.playlistId });
      this.playlistItems = result.items || [];
    } catch (error) {
      console.error('Failed to load playlist items:', error);
      this.playlistItems = [];
    }
  }

  _renderAvailableFiles() {
    const container = this.$('#playlistEditorAvailableFiles');
    if (!container) return;

    // Flatten files (handle folders)
    let files = [];
    const flatten = (items) => {
      for (const item of items) {
        if (item.files) {
          flatten(item.files);
        } else if (item.id) {
          files.push(item);
        }
      }
    };
    if (Array.isArray(this.availableFiles)) {
      flatten(this.availableFiles);
    }

    // Filter by search
    if (this.searchQuery) {
      files = files.filter(f => (f.filename || '').toLowerCase().includes(this.searchQuery));
    }

    // Already added IDs
    const addedIds = new Set(this.playlistItems.map(i => i.midi_id));

    if (files.length === 0) {
      container.innerHTML = '<p style="color:#6c757d;text-align:center;padding:20px;">No files found</p>';
      return;
    }

    container.innerHTML = files.map(f => {
      const isAdded = addedIds.has(f.id);
      return `
        <div class="modal-file-item" data-file-id="${f.id}" data-filename="${this.escape(f.filename || '')}"
             style="display:flex;align-items:center;gap:8px;padding:8px 10px;margin-bottom:3px;border-radius:6px;border:1px solid ${isAdded ? '#28a745' : '#dee2e6'};background:${isAdded ? 'rgba(40,167,69,0.05)' : 'white'};transition:all 0.15s;">
          <div style="flex:1;min-width:0;">
            <div style="font-size:0.9rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${this.escape(f.filename || '')}</div>
            <div style="font-size:0.75rem;color:#6c757d;">${this._formatDuration(f.duration)}</div>
          </div>
          <button class="btn-add-file" data-file-id="${f.id}" data-filename="${this.escape(f.filename || '')}"
                  ${isAdded ? 'disabled style="opacity:0.3;cursor:default;background:none;border:none;font-size:1rem;"' : 'style="background:none;border:none;cursor:pointer;font-size:1rem;"'}
                  title="${isAdded ? 'Already added' : 'Add to playlist'}">
            ${isAdded ? '✓' : '+'}
          </button>
        </div>`;
    }).join('');

    // Bind add buttons
    container.querySelectorAll('.btn-add-file:not([disabled])').forEach(btn => {
      btn.addEventListener('click', async () => {
        const fileId = parseInt(btn.dataset.fileId);
        await this._addFile(fileId);
      });
    });
  }

  _renderPlaylistItems() {
    const container = this.$('#playlistEditorPlaylistItems');
    if (!container) return;

    if (this.playlistItems.length === 0) {
      container.innerHTML = '<p style="color:#6c757d;text-align:center;padding:20px;">Empty playlist</p>';
      this._updateStats();
      return;
    }

    container.innerHTML = this.playlistItems.map((item, index) => `
      <div class="modal-file-item" data-item-id="${item.id}"
           style="display:flex;align-items:center;gap:8px;padding:8px 10px;margin-bottom:3px;border-radius:6px;border:1px solid #dee2e6;background:white;transition:all 0.15s;">
        <span class="file-item-number" style="background:#667eea;color:white;border-radius:50%;width:22px;height:22px;display:flex;align-items:center;justify-content:center;font-size:0.7rem;font-weight:600;flex-shrink:0;">${index + 1}</span>
        <div style="flex:1;min-width:0;">
          <div style="font-size:0.9rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${this.escape(item.filename || '')}</div>
          <div style="font-size:0.75rem;color:#6c757d;">${this._formatDuration(item.duration)}</div>
        </div>
        <button class="btn-remove-file" data-item-id="${item.id}"
                style="background:none;border:none;cursor:pointer;font-size:0.9rem;opacity:0.5;"
                title="Remove">✕</button>
      </div>
    `).join('');

    // Bind remove buttons
    container.querySelectorAll('.btn-remove-file').forEach(btn => {
      btn.addEventListener('click', async () => {
        const itemId = parseInt(btn.dataset.itemId);
        await this._removeFile(itemId);
      });
    });

    this._updateStats();
  }

  _updateStats() {
    const statsEl = this.$('#playlistEditorStats');
    if (!statsEl) return;

    const totalDuration = this.playlistItems.reduce((sum, item) => sum + (item.duration || 0), 0);
    statsEl.textContent = `${this.playlistItems.length} file(s) - ${this._formatDuration(totalDuration)} total`;
  }

  async _addFile(fileId) {
    try {
      await this.apiClient.sendCommand('playlist_add_file', {
        playlistId: this.playlistId,
        midiId: fileId
      });
      await this._loadPlaylistItems();
      this._renderPlaylistItems();
      this._renderAvailableFiles();
    } catch (error) {
      console.error('Failed to add file:', error);
    }
  }

  async _removeFile(itemId) {
    try {
      await this.apiClient.sendCommand('playlist_remove_file', { itemId });
      await this._loadPlaylistItems();
      this._renderPlaylistItems();
      this._renderAvailableFiles();
    } catch (error) {
      console.error('Failed to remove file:', error);
    }
  }
}

// Export for global access
window.PlaylistEditorModal = PlaylistEditorModal;
