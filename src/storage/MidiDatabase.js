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
          filename, data, size, tracks, duration, tempo, ppq, uploaded_at, folder
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
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
        file.folder || '/'
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
}

export default MidiDatabase;