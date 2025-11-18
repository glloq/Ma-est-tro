// src/storage/FileManager.js
import { parseMidi } from 'midi-file';
import { writeMidi } from 'midi-file';

class FileManager {
  constructor(app) {
    this.app = app;
    this.uploadDir = './uploads';
    
    this.app.logger.info('FileManager initialized');
  }

  async handleUpload(filename, base64Data) {
    try {
      // Decode base64
      const buffer = Buffer.from(base64Data, 'base64');
      
      // Validate MIDI file
      let midi;
      try {
        midi = parseMidi(buffer);
      } catch (error) {
        throw new Error(`Invalid MIDI file: ${error.message}`);
      }

      // Extract metadata
      const metadata = this.extractMetadata(midi);

      // Store in database
      const fileId = this.app.database.insertFile({
        filename: filename,
        data: base64Data,
        size: buffer.length,
        tracks: midi.tracks.length,
        duration: metadata.duration,
        tempo: metadata.tempo,
        ppq: midi.header.ticksPerBeat || 480,
        uploaded_at: new Date().toISOString(),
        folder: '/'
      });

      this.app.logger.info(`File uploaded: ${filename} (${fileId})`);

      // Broadcast file list update
      this.broadcastFileList();

      return {
        fileId: fileId,
        filename: filename,
        size: buffer.length,
        tracks: midi.tracks.length,
        duration: metadata.duration,
        tempo: metadata.tempo,
        midi: this.convertMidiToJSON(midi)
      };
    } catch (error) {
      this.app.logger.error(`Upload failed: ${error.message}`);
      throw error;
    }
  }

  extractMetadata(midi) {
    const ppq = midi.header.ticksPerBeat || 480;
    let tempo = 120; // Default BPM
    let totalTicks = 0;

    // Find tempo
    for (const track of midi.tracks) {
      const tempoEvent = track.find(e => e.type === 'setTempo');
      if (tempoEvent) {
        tempo = 60000000 / tempoEvent.microsecondsPerBeat;
        break;
      }
    }

    // Calculate duration
    midi.tracks.forEach(track => {
      let trackTicks = 0;
      track.forEach(event => {
        trackTicks += event.deltaTime;
      });
      totalTicks = Math.max(totalTicks, trackTicks);
    });

    const beatsPerSecond = tempo / 60;
    const ticksPerSecond = beatsPerSecond * ppq;
    const duration = totalTicks / ticksPerSecond;

    return {
      tempo: tempo,
      duration: duration,
      totalTicks: totalTicks
    };
  }

  convertMidiToJSON(midi) {
    return {
      header: {
        format: midi.header.format,
        numTracks: midi.header.numTracks,
        ticksPerBeat: midi.header.ticksPerBeat
      },
      tracks: midi.tracks.map((track, index) => {
        return {
          index: index,
          name: this.extractTrackName(track),
          events: track.map(event => {
            // Create a clean event object with all important MIDI attributes
            const cleanEvent = {
              deltaTime: event.deltaTime || 0,
              type: event.type
            };

            // Preserve channel for all channel messages
            if (event.channel !== undefined) {
              cleanEvent.channel = event.channel;
            }

            // Note events
            if (event.noteNumber !== undefined) {
              cleanEvent.noteNumber = event.noteNumber;
            }
            if (event.velocity !== undefined) {
              cleanEvent.velocity = event.velocity;
            }

            // Control Change events
            if (event.controllerType !== undefined) {
              cleanEvent.controllerType = event.controllerType;
            }
            if (event.value !== undefined) {
              cleanEvent.value = event.value;
            }

            // Program Change events
            if (event.programNumber !== undefined) {
              cleanEvent.programNumber = event.programNumber;
            }

            // Pitch Bend events
            // midi-file stores pitch bend as a value from -8192 to 8191
            // We need to preserve this

            // Channel Aftertouch
            if (event.amount !== undefined) {
              cleanEvent.amount = event.amount;
            }

            // Polyphonic Aftertouch
            if (event.pressure !== undefined) {
              cleanEvent.pressure = event.pressure;
            }

            // Meta events
            if (event.text !== undefined) {
              cleanEvent.text = event.text;
            }
            if (event.microsecondsPerBeat !== undefined) {
              cleanEvent.microsecondsPerBeat = event.microsecondsPerBeat;
            }
            if (event.numerator !== undefined) {
              cleanEvent.numerator = event.numerator;
            }
            if (event.denominator !== undefined) {
              cleanEvent.denominator = event.denominator;
            }
            if (event.metronome !== undefined) {
              cleanEvent.metronome = event.metronome;
            }
            if (event.thirtyseconds !== undefined) {
              cleanEvent.thirtyseconds = event.thirtyseconds;
            }
            if (event.key !== undefined) {
              cleanEvent.key = event.key;
            }
            if (event.scale !== undefined) {
              cleanEvent.scale = event.scale;
            }

            // Copy any remaining properties (for compatibility)
            // but exclude internal properties that might cause issues
            const excludeProps = ['deltaTime', 'type', 'channel', 'noteNumber', 'velocity',
                                  'controllerType', 'value', 'programNumber', 'amount',
                                  'pressure', 'text', 'microsecondsPerBeat', 'numerator',
                                  'denominator', 'metronome', 'thirtyseconds', 'key', 'scale'];

            Object.keys(event).forEach(key => {
              if (!excludeProps.includes(key) && event[key] !== undefined) {
                cleanEvent[key] = event[key];
              }
            });

            return cleanEvent;
          })
        };
      })
    };
  }

  extractTrackName(track) {
    const nameEvent = track.find(e => e.type === 'trackName');
    return nameEvent ? nameEvent.text : 'Unnamed Track';
  }

  async exportFile(fileId) {
    try {
      const file = this.app.database.getFile(fileId);
      if (!file) {
        throw new Error(`File not found: ${fileId}`);
      }

      return {
        filename: file.filename,
        data: file.data, // Already Base64
        size: file.size,
        tracks: file.tracks
      };
    } catch (error) {
      this.app.logger.error(`Export failed: ${error.message}`);
      throw error;
    }
  }

  listFiles(folder = '/') {
    try {
      const files = this.app.database.getFiles(folder);
      
      return files.map(file => ({
        id: file.id,
        filename: file.filename,
        size: file.size,
        tracks: file.tracks,
        duration: file.duration,
        tempo: file.tempo,
        uploadedAt: file.uploaded_at,
        folder: file.folder
      }));
    } catch (error) {
      this.app.logger.error(`List files failed: ${error.message}`);
      throw error;
    }
  }

  getFile(fileId) {
    try {
      const file = this.app.database.getFile(fileId);
      if (!file) {
        throw new Error(`File not found: ${fileId}`);
      }

      return {
        id: file.id,
        filename: file.filename,
        size: file.size,
        tracks: file.tracks,
        duration: file.duration,
        tempo: file.tempo,
        ppq: file.ppq,
        uploadedAt: file.uploaded_at,
        folder: file.folder
      };
    } catch (error) {
      this.app.logger.error(`Get file failed: ${error.message}`);
      throw error;
    }
  }

  async loadFile(fileId) {
    try {
      const file = this.app.database.getFile(fileId);
      if (!file) {
        throw new Error(`File not found: ${fileId}`);
      }

      const buffer = Buffer.from(file.data, 'base64');
      const midi = parseMidi(buffer);

      return {
        id: file.id,
        filename: file.filename,
        midi: this.convertMidiToJSON(midi),
        size: file.size,
        tracks: file.tracks,
        duration: file.duration,
        tempo: file.tempo
      };
    } catch (error) {
      this.app.logger.error(`Load file failed: ${error.message}`);
      throw error;
    }
  }

  async deleteFile(fileId) {
    try {
      const file = this.app.database.getFile(fileId);
      if (!file) {
        throw new Error(`File not found: ${fileId}`);
      }

      this.app.database.deleteFile(fileId);
      this.app.logger.info(`File deleted: ${file.filename} (${fileId})`);

      // Broadcast file list update
      this.broadcastFileList();

      return { success: true };
    } catch (error) {
      this.app.logger.error(`Delete file failed: ${error.message}`);
      throw error;
    }
  }

  async saveFile(fileId, midiData) {
    try {
      // Convert JSON back to MIDI buffer
      const midiBytes = writeMidi(midiData);
      const buffer = Buffer.from(midiBytes);
      const base64Data = buffer.toString('base64');

      // Update metadata
      const metadata = this.extractMetadata(midiData);

      this.app.database.updateFile(fileId, {
        data: base64Data,
        size: buffer.length,
        tracks: midiData.tracks.length,
        duration: metadata.duration,
        tempo: metadata.tempo,
        ppq: midiData.header.ticksPerBeat || 480
      });

      this.app.logger.info(`File saved: ${fileId}`);

      // Broadcast file list update
      this.broadcastFileList();

      return { success: true };
    } catch (error) {
      this.app.logger.error(`Save file failed: ${error.message}`);
      throw error;
    }
  }

  async renameFile(fileId, newFilename) {
    try {
      const file = this.app.database.getFile(fileId);
      if (!file) {
        throw new Error(`File not found: ${fileId}`);
      }

      this.app.database.updateFile(fileId, {
        filename: newFilename
      });

      this.app.logger.info(`File renamed: ${file.filename} → ${newFilename}`);

      // Broadcast file list update
      this.broadcastFileList();

      return { success: true };
    } catch (error) {
      this.app.logger.error(`Rename file failed: ${error.message}`);
      throw error;
    }
  }

  async moveFile(fileId, newFolder) {
    try {
      const file = this.app.database.getFile(fileId);
      if (!file) {
        throw new Error(`File not found: ${fileId}`);
      }

      this.app.database.updateFile(fileId, {
        folder: newFolder
      });

      this.app.logger.info(`File moved: ${file.filename} → ${newFolder}`);

      // Broadcast file list update
      this.broadcastFileList();

      return { success: true };
    } catch (error) {
      this.app.logger.error(`Move file failed: ${error.message}`);
      throw error;
    }
  }

  async duplicateFile(fileId) {
    try {
      const file = this.app.database.getFile(fileId);
      if (!file) {
        throw new Error(`File not found: ${fileId}`);
      }

      // Generate new filename
      const nameParts = file.filename.split('.');
      const ext = nameParts.pop();
      const baseName = nameParts.join('.');
      const newFilename = `${baseName} (copy).${ext}`;

      // Insert duplicate
      const newFileId = this.app.database.insertFile({
        filename: newFilename,
        data: file.data,
        size: file.size,
        tracks: file.tracks,
        duration: file.duration,
        tempo: file.tempo,
        ppq: file.ppq,
        uploaded_at: new Date().toISOString(),
        folder: file.folder
      });

      this.app.logger.info(`File duplicated: ${file.filename} → ${newFilename}`);

      // Broadcast file list update
      this.broadcastFileList();

      return {
        fileId: newFileId,
        filename: newFilename
      };
    } catch (error) {
      this.app.logger.error(`Duplicate file failed: ${error.message}`);
      throw error;
    }
  }

  getFolders() {
    try {
      return this.app.database.getFolders();
    } catch (error) {
      this.app.logger.error(`Get folders failed: ${error.message}`);
      throw error;
    }
  }

  createFolder(folderPath) {
    try {
      // Folders are implicitly created when files are moved to them
      // Just validate the path
      if (!folderPath || !folderPath.startsWith('/')) {
        throw new Error('Invalid folder path');
      }

      this.app.logger.info(`Folder created: ${folderPath}`);
      return { success: true };
    } catch (error) {
      this.app.logger.error(`Create folder failed: ${error.message}`);
      throw error;
    }
  }

  broadcastFileList() {
    if (this.app.wsServer) {
      this.app.wsServer.broadcast('file_list_updated', {
        files: this.listFiles()
      });
    }
  }

  getStorageStats() {
    try {
      const files = this.app.database.getFiles('/');
      const totalSize = files.reduce((sum, file) => sum + (file.size || 0), 0);
      const totalFiles = files.length;

      return {
        totalFiles: totalFiles,
        totalSize: totalSize,
        totalSizeMB: (totalSize / (1024 * 1024)).toFixed(2)
      };
    } catch (error) {
      this.app.logger.error(`Get storage stats failed: ${error.message}`);
      throw error;
    }
  }
}

export default FileManager;