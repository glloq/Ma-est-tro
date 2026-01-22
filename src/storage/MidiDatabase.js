// src/storage/MidiDatabase.js

class MidiDatabase {
  constructor(db, logger) {
    this.db = db;
    this.logger = logger;
  }

  insertFile(file) {
    try {
      const stmt = this.db.prepare(`
        INSERT INTO midi_files (
          filename, data, size, tracks, duration, tempo, ppq, uploaded_at, folder,
          is_original, parent_file_id, adaptation_metadata,
          instrument_types, channel_count, note_range_min, note_range_max,
          has_drums, has_melody, has_bass
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const result = stmt.run(
        file.filename,
        file.data,
        file.size,
        file.tracks,
        file.duration || 0,
        file.tempo || 120,
        file.ppq || 480,
        file.uploaded_at,
        file.folder || '/',
        file.is_original !== undefined ? file.is_original : true,
        file.parent_file_id || null,
        file.adaptation_metadata || null,
        file.instrument_types || '[]',
        file.channel_count || 0,
        file.note_range_min || null,
        file.note_range_max || null,
        file.has_drums || false,
        file.has_melody || false,
        file.has_bass || false
      );

      return result.lastInsertRowid;
    } catch (error) {
      this.logger.error(`Failed to insert file: ${error.message}`);
      throw error;
    }
  }

  getFile(fileId) {
    try {
      const stmt = this.db.prepare('SELECT * FROM midi_files WHERE id = ?');
      return stmt.get(fileId);
    } catch (error) {
      this.logger.error(`Failed to get file: ${error.message}`);
      throw error;
    }
  }

  getFiles(folder = '/') {
    try {
      const stmt = this.db.prepare('SELECT * FROM midi_files WHERE folder = ? ORDER BY uploaded_at DESC');
      return stmt.all(folder);
    } catch (error) {
      this.logger.error(`Failed to get files: ${error.message}`);
      throw error;
    }
  }

  getAllFiles() {
    try {
      const stmt = this.db.prepare('SELECT * FROM midi_files ORDER BY uploaded_at DESC');
      return stmt.all();
    } catch (error) {
      this.logger.error(`Failed to get all files: ${error.message}`);
      throw error;
    }
  }

  updateFile(fileId, updates) {
    try {
      const fields = [];
      const values = [];

      if (updates.filename !== undefined) {
        fields.push('filename = ?');
        values.push(updates.filename);
      }
      if (updates.data !== undefined) {
        fields.push('data = ?');
        values.push(updates.data);
      }
      if (updates.size !== undefined) {
        fields.push('size = ?');
        values.push(updates.size);
      }
      if (updates.tracks !== undefined) {
        fields.push('tracks = ?');
        values.push(updates.tracks);
      }
      if (updates.duration !== undefined) {
        fields.push('duration = ?');
        values.push(updates.duration);
      }
      if (updates.tempo !== undefined) {
        fields.push('tempo = ?');
        values.push(updates.tempo);
      }
      if (updates.ppq !== undefined) {
        fields.push('ppq = ?');
        values.push(updates.ppq);
      }
      if (updates.folder !== undefined) {
        fields.push('folder = ?');
        values.push(updates.folder);
      }
      if (updates.is_original !== undefined) {
        fields.push('is_original = ?');
        values.push(updates.is_original);
      }
      if (updates.parent_file_id !== undefined) {
        fields.push('parent_file_id = ?');
        values.push(updates.parent_file_id);
      }
      if (updates.adaptation_metadata !== undefined) {
        fields.push('adaptation_metadata = ?');
        values.push(updates.adaptation_metadata);
      }

      if (fields.length === 0) {
        return;
      }

      values.push(fileId);

      const stmt = this.db.prepare(`
        UPDATE midi_files SET ${fields.join(', ')} WHERE id = ?
      `);

      stmt.run(...values);
    } catch (error) {
      this.logger.error(`Failed to update file: ${error.message}`);
      throw error;
    }
  }

  deleteFile(fileId) {
    try {
      const stmt = this.db.prepare('DELETE FROM midi_files WHERE id = ?');
      stmt.run(fileId);
    } catch (error) {
      this.logger.error(`Failed to delete file: ${error.message}`);
      throw error;
    }
  }

  getFolders() {
    try {
      const stmt = this.db.prepare('SELECT DISTINCT folder FROM midi_files ORDER BY folder');
      return stmt.all().map(row => row.folder);
    } catch (error) {
      this.logger.error(`Failed to get folders: ${error.message}`);
      throw error;
    }
  }

  searchFiles(query) {
    try {
      const stmt = this.db.prepare(`
        SELECT * FROM midi_files 
        WHERE filename LIKE ? 
        ORDER BY uploaded_at DESC
      `);
      return stmt.all(`%${query}%`);
    } catch (error) {
      this.logger.error(`Failed to search files: ${error.message}`);
      throw error;
    }
  }

  getFilesByDateRange(startDate, endDate) {
    try {
      const stmt = this.db.prepare(`
        SELECT * FROM midi_files 
        WHERE uploaded_at >= ? AND uploaded_at <= ? 
        ORDER BY uploaded_at DESC
      `);
      return stmt.all(startDate, endDate);
    } catch (error) {
      this.logger.error(`Failed to get files by date range: ${error.message}`);
      throw error;
    }
  }

  getRecentFiles(limit = 10) {
    try {
      const stmt = this.db.prepare(`
        SELECT * FROM midi_files 
        ORDER BY uploaded_at DESC 
        LIMIT ?
      `);
      return stmt.all(limit);
    } catch (error) {
      this.logger.error(`Failed to get recent files: ${error.message}`);
      throw error;
    }
  }

  getStorageStats() {
    try {
      const stmt = this.db.prepare(`
        SELECT
          COUNT(*) as totalFiles,
          SUM(size) as totalSize,
          AVG(duration) as avgDuration,
          MAX(duration) as maxDuration
        FROM midi_files
      `);
      return stmt.get();
    } catch (error) {
      this.logger.error(`Failed to get storage stats: ${error.message}`);
      throw error;
    }
  }

  /**
   * Filter MIDI files with advanced criteria
   * @param {Object} filters - Filter criteria
   * @returns {Array} - Filtered files
   */
  filterFiles(filters = {}) {
    try {
      let query = 'SELECT mf.* FROM midi_files mf';
      const joins = [];
      const wheres = [];
      const params = [];

      // JOIN with routings if needed
      if (filters.hasRouting !== undefined || filters.minCompatibilityScore !== undefined) {
        joins.push('LEFT JOIN midi_instrument_routings mir ON mf.id = mir.midi_file_id');
      }

      // Filename filter
      if (filters.filename) {
        wheres.push('mf.filename LIKE ?');
        params.push(`%${filters.filename}%`);
      }

      // Folder filter
      if (filters.folder) {
        if (filters.includeSubfolders) {
          wheres.push('mf.folder LIKE ?');
          params.push(`${filters.folder}%`);
        } else {
          wheres.push('mf.folder = ?');
          params.push(filters.folder);
        }
      }

      // Duration filter
      if (filters.durationMin !== undefined) {
        wheres.push('mf.duration >= ?');
        params.push(filters.durationMin);
      }
      if (filters.durationMax !== undefined) {
        wheres.push('mf.duration <= ?');
        params.push(filters.durationMax);
      }

      // Tempo filter
      if (filters.tempoMin !== undefined) {
        wheres.push('mf.tempo >= ?');
        params.push(filters.tempoMin);
      }
      if (filters.tempoMax !== undefined) {
        wheres.push('mf.tempo <= ?');
        params.push(filters.tempoMax);
      }

      // Track count filter
      if (filters.tracksMin !== undefined) {
        wheres.push('mf.tracks >= ?');
        params.push(filters.tracksMin);
      }
      if (filters.tracksMax !== undefined) {
        wheres.push('mf.tracks <= ?');
        params.push(filters.tracksMax);
      }

      // Channel count filter
      if (filters.channelCountMin !== undefined) {
        wheres.push('mf.channel_count >= ?');
        params.push(filters.channelCountMin);
      }
      if (filters.channelCountMax !== undefined) {
        wheres.push('mf.channel_count <= ?');
        params.push(filters.channelCountMax);
      }

      // Upload date filter
      if (filters.uploadedAfter) {
        wheres.push('mf.uploaded_at >= ?');
        params.push(filters.uploadedAfter);
      }
      if (filters.uploadedBefore) {
        wheres.push('mf.uploaded_at <= ?');
        params.push(filters.uploadedBefore);
      }

      // Is original filter
      if (filters.isOriginal !== undefined) {
        wheres.push('mf.is_original = ?');
        params.push(filters.isOriginal ? 1 : 0);
      }

      // Boolean quick filters
      if (filters.hasDrums !== undefined) {
        wheres.push('mf.has_drums = ?');
        params.push(filters.hasDrums ? 1 : 0);
      }
      if (filters.hasMelody !== undefined) {
        wheres.push('mf.has_melody = ?');
        params.push(filters.hasMelody ? 1 : 0);
      }
      if (filters.hasBass !== undefined) {
        wheres.push('mf.has_bass = ?');
        params.push(filters.hasBass ? 1 : 0);
      }

      // Instrument types filter
      if (filters.instrumentTypes && filters.instrumentTypes.length > 0) {
        const mode = filters.instrumentMode || 'ANY';

        if (mode === 'ANY') {
          // File contains at least one of the specified instruments
          const orClauses = filters.instrumentTypes.map(() => 'mf.instrument_types LIKE ?');
          wheres.push(`(${orClauses.join(' OR ')})`);
          filters.instrumentTypes.forEach(type => {
            params.push(`%"${type}"%`);
          });
        } else if (mode === 'ALL') {
          // File contains all of the specified instruments
          filters.instrumentTypes.forEach(type => {
            wheres.push('mf.instrument_types LIKE ?');
            params.push(`%"${type}"%`);
          });
        } else if (mode === 'EXACT') {
          // File contains exactly these instruments (no more, no less)
          // This is complex - we need to parse JSON and count
          // For now, use a simpler approach: all must be present
          filters.instrumentTypes.forEach(type => {
            wheres.push('mf.instrument_types LIKE ?');
            params.push(`%"${type}"%`);
          });
          // Also check that array length matches (approximate)
          // This is a limitation of SQLite JSON support
        }
      }

      // Routing status filter
      if (filters.hasRouting === true) {
        wheres.push('mir.id IS NOT NULL');
      } else if (filters.hasRouting === false) {
        wheres.push('mir.id IS NULL');
      }

      // Assemble query
      if (joins.length > 0) {
        query += ' ' + joins.join(' ');
      }

      if (wheres.length > 0) {
        query += ' WHERE ' + wheres.join(' AND ');
      }

      // GROUP BY if we joined with routings (to avoid duplicates)
      if (joins.length > 0) {
        query += ' GROUP BY mf.id';
      }

      // Compatibility score filter (needs to be in HAVING after GROUP BY)
      if (filters.minCompatibilityScore !== undefined && joins.length > 0) {
        query += ' HAVING AVG(mir.compatibility_score) >= ?';
        params.push(filters.minCompatibilityScore);
      }

      // ORDER BY
      const sortBy = filters.sortBy || 'uploaded_at';
      const sortOrder = filters.sortOrder || 'DESC';

      // Validate sortBy to prevent SQL injection
      const validSortFields = ['filename', 'uploaded_at', 'duration', 'tempo', 'tracks', 'size', 'channel_count'];
      if (validSortFields.includes(sortBy)) {
        query += ` ORDER BY mf.${sortBy} ${sortOrder.toUpperCase()}`;
      } else {
        query += ' ORDER BY mf.uploaded_at DESC';
      }

      // LIMIT and OFFSET for pagination
      if (filters.limit) {
        query += ' LIMIT ?';
        params.push(filters.limit);

        if (filters.offset) {
          query += ' OFFSET ?';
          params.push(filters.offset);
        }
      }

      this.logger.info(`Filter query: ${query}`);
      this.logger.info(`Filter params: ${JSON.stringify(params)}`);

      // Execute query
      const stmt = this.db.prepare(query);
      const results = stmt.all(...params);

      return results;
    } catch (error) {
      this.logger.error(`Failed to filter files: ${error.message}`);
      throw error;
    }
  }
}

export default MidiDatabase;