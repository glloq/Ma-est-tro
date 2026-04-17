// src/repositories/FileRepository.js
// Repository wrapper over MidiDatabase (P0-2.1, ADR-002 option B).
// Exposes a business-named API; delegates to the existing sub-DB.

export default class FileRepository {
  constructor(database) {
    this.database = database;
  }

  findById(fileId) {
    return this.database.getFile(fileId);
  }

  findInfoById(fileId) {
    return this.database.getFileInfo(fileId);
  }

  findByFolder(folder = '/') {
    return this.database.getFiles(folder);
  }

  save(file) {
    return this.database.insertFile(file);
  }

  update(fileId, updates) {
    return this.database.updateFile(fileId, updates);
  }

  delete(fileId) {
    return this.database.deleteFile(fileId);
  }

  getChannels(fileId) {
    return this.database.getFileChannels(fileId);
  }
}
