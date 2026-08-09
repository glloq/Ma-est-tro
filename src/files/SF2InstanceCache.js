/**
 * @file src/files/SF2InstanceCache.js
 * @description Tiny LRU of parsed `SoundFont2` instances keyed by file path
 * and mtime. Each cache hit skips ~475 ms of disk-read + RIFF parsing for a
 * 30 MB soundfont — that's the dominant cost on a Pi 3B+ cold load now that
 * the serialisation step is binary.
 *
 * Memory envelope: a SoundFont2 instance holds a reference to its source
 * Uint8Array (the full file bytes), so the bookkeeping size is roughly the
 * SF2 file size + a small parse tree. The cache is bounded on BOTH axes: at most
 * 2 entries (a melodic + drum pair without re-parse thrash) AND a total byte
 * budget (default 256 MB). The byte budget is what actually keeps two near-max
 * (~160 MB) soundfonts from co-residing and OOM-ing a 1 GB Pi — the entry count
 * alone would allow ~320 MB. At least one entry is always retained so a single
 * legitimate large soundfont still caches.
 *
 * Invalidation: the `mtimeMs` component of the key makes a stale instance
 * disappear automatically when the underlying SF2 file is re-installed or
 * replaced, without needing an explicit invalidate() call from the boot
 * sequence.
 */

import fs from 'fs';
import { parseSoundFont } from './SF2Converter.js';

const DEFAULT_CAPACITY = 2;
// Also bound retained BYTES, not just entry count: two near-max SF2 files
// (~160 MB each) fit the 2-entry cap yet total ~320 MB and risk OOM on a 1 GB
// Pi (audit B2/B3). At least one entry is always kept — even if it alone exceeds
// the budget — so a single legitimate large soundfont still caches.
const DEFAULT_MAX_BYTES = 256 * 1024 * 1024;

export class SF2InstanceCache {
  /**
   * @param {Object} [opts]
   * @param {number} [opts.capacity=2]
   * @param {number} [opts.maxBytes=256MiB] Total source-bytes budget across
   *   cached instances (each holds a reference to its full file buffer).
   */
  constructor({ capacity = DEFAULT_CAPACITY, maxBytes = DEFAULT_MAX_BYTES } = {}) {
    this.capacity = capacity;
    this.maxBytes = maxBytes;
    /** @type {Map<string, { sf2: any, mtimeMs: number, bytes: number }>} */
    this._map = new Map();
    this._parseCount = 0;
    this._bytes = 0;
  }

  /** Delete an entry and keep the byte accounting in sync. @private */
  _delete(key) {
    const entry = this._map.get(key);
    if (entry) {
      this._bytes -= entry.bytes || 0;
      this._map.delete(key);
    }
  }

  /**
   * Return a parsed SoundFont2 for the given file path, parsing it (and
   * caching the result) on miss. `mtimeMs` is part of the cache key so a
   * file replacement invalidates the entry transparently.
   *
   * @param {string} absPath
   * @returns {any} SoundFont2 instance
   */
  getForPath(absPath) {
    const stat = fs.statSync(absPath);
    const key = `${absPath}:${stat.mtimeMs}`;

    const hit = this._map.get(key);
    if (hit) {
      // Touch for LRU ordering
      this._map.delete(key);
      this._map.set(key, hit);
      return hit.sf2;
    }

    // Miss — parse and store. Drop any older entry for the same path (mtime
    // changed) so we don't retain the obsolete instance forever.
    for (const k of [...this._map.keys()]) {
      if (k.startsWith(absPath + ':')) this._delete(k);
    }
    const buf = fs.readFileSync(absPath);
    const sf2 = parseSoundFont(buf);
    this._parseCount++;
    this._map.set(key, { sf2, mtimeMs: stat.mtimeMs, bytes: buf.length });
    this._bytes += buf.length;

    // Evict LRU until BOTH the entry-count and byte budgets are satisfied, but
    // never below a single entry (a lone oversized file must still cache).
    while (this._map.size > this.capacity || (this._bytes > this.maxBytes && this._map.size > 1)) {
      const oldest = this._map.keys().next().value;
      this._delete(oldest);
    }
    return sf2;
  }

  /**
   * Drop every cached entry whose path matches the given prefix. Used when
   * a custom SF2 is deleted by the user.
   *
   * @param {string} absPathPrefix
   */
  invalidate(absPathPrefix) {
    for (const k of [...this._map.keys()]) {
      if (k.startsWith(absPathPrefix + ':') || k === absPathPrefix) {
        this._delete(k);
      }
    }
  }

  /** Drop everything (used by tests and on shutdown). */
  clear() {
    this._map.clear();
    this._parseCount = 0;
    this._bytes = 0;
  }

  /** @returns {{ size: number, parses: number, bytes: number }} */
  getStats() {
    return { size: this._map.size, parses: this._parseCount, bytes: this._bytes };
  }
}
