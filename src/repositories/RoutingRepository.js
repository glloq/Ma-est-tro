// src/repositories/RoutingRepository.js
// Repository wrapper over RoutingPersistenceDB via Database facade (P0-2.2, ADR-002).
// Exposes a business-named API for routing persistence.

export default class RoutingRepository {
  constructor(database) {
    this.database = database;
  }

  save(routing) {
    return this.database.insertRouting(routing);
  }

  saveSplit(fileId, channel, segments) {
    return this.database.insertSplitRoutings(fileId, channel, segments);
  }

  findByFileId(fileId, includeDisabled = false) {
    return this.database.getRoutingsByFile(fileId, includeDisabled);
  }

  countByFiles(fileIds, connectedDeviceIds) {
    return this.database.getRoutingCountsByFiles(fileIds, connectedDeviceIds);
  }

  deleteByFileId(fileId) {
    return this.database.deleteRoutingsByFile(fileId);
  }
}
