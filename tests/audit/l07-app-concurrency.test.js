// tests/audit/l07-app-concurrency.test.js
//
// Audit 2026-09-07 — lot L07, section §W (concurrence applicative).
// §W était intégralement « NOT TESTED ». Scénario réel : DEUX ONGLETS OUVERTS
// sur la même box, qui modifient le même fichier / le même instrument au même
// instant.
//
// Node est mono-thread et better-sqlite3 est synchrone : l'entrelacement n'est
// possible qu'aux points `await`. `apply_assignments` en possède un
// (`await fileManager.replaceFileBytes / createDerivedFile`) — et c'est
// exactement là que ça casse.
//
// Les handlers sont obtenus via le vrai `register()` du module, contre une
// vraie base SQLite, un vrai BlobStore et un vrai FileManager.

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { writeMidi, parseMidi } from 'midi-file';
import { mkdtempSync, mkdirSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import DatabaseManager from '../../src/persistence/Database.js';
import BlobStore from '../../src/files/BlobStore.js';
import FileManager from '../../src/files/FileManager.js';
import AutoAssigner from '../../src/midi/adaptation/AutoAssigner.js';
import MidiAdaptationService from '../../src/midi/adaptation/MidiAdaptationService.js';
import FileRepository from '../../src/repositories/FileRepository.js';
import RoutingRepository from '../../src/repositories/RoutingRepository.js';
import InstrumentRepository from '../../src/repositories/InstrumentRepository.js';
import PlaylistRepository from '../../src/repositories/PlaylistRepository.js';
import { register as registerAssignmentCommands } from '../../src/midi/playback/commands/PlaybackAssignmentCommands.js';

const SANDBOX = process.env.GMBOOP_TEST_TMP || join(tmpdir(), 'gmboop-l07');
mkdirSync(SANDBOX, { recursive: true });
const silentLogger = { info: () => {}, warn: () => {}, error: () => {}, debug: () => {} };

function midiBuffer(baseNote, n = 6) {
  const ev = [];
  for (let i = 0; i < n; i++) {
    ev.push({
      deltaTime: i ? 120 : 0,
      type: 'noteOn',
      channel: 0,
      noteNumber: baseNote + i,
      velocity: 100
    });
    ev.push({ deltaTime: 60, type: 'noteOff', channel: 0, noteNumber: baseNote + i, velocity: 0 });
  }
  ev.push({ deltaTime: 0, meta: true, type: 'endOfTrack' });
  return Buffer.from(
    writeMidi({ header: { format: 1, numTracks: 1, ticksPerBeat: 480 }, tracks: [ev] })
  );
}

describe('L07 §W — concurrence applicative (« deux onglets ouverts »)', () => {
  let tempDir;
  let database;
  let blobStore;
  let fileManager;
  let app;
  let apply;

  beforeEach(() => {
    tempDir = mkdtempSync(join(SANDBOX, 'appconc-'));
    database = new DatabaseManager({
      logger: silentLogger,
      config: { database: { path: join(tempDir, 'gmboop.db') } }
    });
    blobStore = new BlobStore({ baseDir: tempDir, logger: silentLogger });
    fileManager = new FileManager({
      logger: silentLogger,
      database,
      blobStore,
      eventBus: { emit: () => {} }
    });
    const autoAssigner = new AutoAssigner(database, silentLogger, { emit: () => {}, on: () => {} });
    app = {
      logger: silentLogger,
      database,
      blobStore,
      fileManager,
      eventBus: { emit: () => {} },
      adaptationService: new MidiAdaptationService(silentLogger, autoAssigner),
      fileRepository: new FileRepository(database),
      routingRepository: new RoutingRepository(database),
      instrumentRepository: new InstrumentRepository(database),
      playlistRepository: new PlaylistRepository(database)
    };
    const handlers = {};
    registerAssignmentCommands({ register: (n, fn) => (handlers[n] = fn) }, app);
    apply = (data) => handlers['apply_assignments'](data);

    database.ensureDevice('dev-a', 'Device A', 'output');
    database.ensureDevice('dev-b', 'Device B', 'output');
  });

  afterEach(() => {
    try {
      database.close();
    } catch {
      /* ignore */
    }
    rmSync(tempDir, { recursive: true, force: true });
  });

  const notesOf = (fileId) =>
    parseMidi(blobStore.read(database.getFile(fileId).blob_path))
      .tracks[0].filter((e) => e.type === 'noteOn')
      .map((e) => e.noteNumber);

  const assignment = (deviceId, semitones) => ({
    0: {
      deviceId,
      instrumentName: deviceId,
      score: 0.9,
      transposition: { semitones }
    }
  });

  test('W-1 — DÉFAUT F-76 : deux apply concurrents avec `overwriteOriginal` CUMULENT leurs transpositions', async () => {
    const up = await fileManager.handleUpload('song.mid', midiBuffer(70));
    expect(notesOf(up.fileId)[0]).toBe(70);

    const [a, b] = await Promise.all([
      apply({
        originalFileId: up.fileId,
        createAdaptedFile: true,
        overwriteOriginal: true,
        assignments: assignment('dev-a', 5)
      }),
      apply({
        originalFileId: up.fileId,
        createAdaptedFile: true,
        overwriteOriginal: true,
        assignments: assignment('dev-b', 7)
      })
    ]);

    // Les deux clients reçoivent un ACQUITTEMENT POSITIF…
    expect(a.success).toBe(true);
    expect(b.success).toBe(true);

    // …et le fichier ne porte NI +5 NI +7 : le second a lu la SORTIE du premier
    // comme entrée, donc +12. Une octave d'écart, silencieusement.
    const notes = notesOf(up.fileId);
    expect(notes[0]).not.toBe(75); // ni le résultat de A
    expect(notes[0]).not.toBe(77); // ni celui de B
    expect(notes[0]).toBe(82); // 70 + 5 + 7 : cumul
  });

  test('W-2 — DÉFAUT F-77 : sans overwrite, dernier arrivé gagne mais les DEUX reçoivent success + le même adaptedFileId', async () => {
    const up = await fileManager.handleUpload('song.mid', midiBuffer(60));

    const [a, b] = await Promise.all([
      apply({
        originalFileId: up.fileId,
        createAdaptedFile: true,
        assignments: assignment('dev-a', 12)
      }),
      apply({
        originalFileId: up.fileId,
        createAdaptedFile: true,
        assignments: assignment('dev-b', -12)
      })
    ]);

    expect(a.success).toBe(true);
    expect(b.success).toBe(true);
    // Un SEUL fichier adapté existe, et les deux clients pointent dessus.
    expect(a.adaptedFileId).toBe(b.adaptedFileId);
    expect(database.getAllFiles().filter((f) => f.parent_file_id === up.fileId).length).toBe(1);

    // Son contenu est celui de B. A croit pourtant avoir persisté +12.
    expect(notesOf(a.adaptedFileId)[0]).toBe(48);

    // Idem pour le routage : une seule ligne, celle de B.
    const routings = app.routingRepository.findByFileId(a.adaptedFileId);
    expect(routings.length).toBe(1);
    expect(routings[0].device_id).toBe('dev-b');
  });

  test('W-3 — deux apply IDENTIQUES en parallèle : dédoublonnage propre, aucune ligne en double', async () => {
    const up = await fileManager.handleUpload('song.mid', midiBuffer(60));
    const [a, b] = await Promise.all([
      apply({
        originalFileId: up.fileId,
        createAdaptedFile: true,
        assignments: assignment('dev-a', 12)
      }),
      apply({
        originalFileId: up.fileId,
        createAdaptedFile: true,
        assignments: assignment('dev-b', 12)
      })
    ]);
    expect(a.adaptedFileId).toBe(b.adaptedFileId);
    expect(database.getAllFiles().length).toBe(2); // original + 1 adapté
    expect(database.pragmaIntegrity?.() ?? database.db.pragma('integrity_check', { simple: true })).toBe(
      'ok'
    );
  });

  test('W-4 — DÉFAUT F-85 : apply concurrent d’une suppression du même fichier → blob orphelin sur disque', async () => {
    const up = await fileManager.handleUpload('song.mid', midiBuffer(80));

    const applying = apply({
      originalFileId: up.fileId,
      createAdaptedFile: true,
      assignments: assignment('dev-a', 3)
    });
    const deleting = fileManager.deleteFile(up.fileId);
    const results = await Promise.allSettled([applying, deleting]);

    // Les deux opérations « réussissent ».
    expect(results.every((r) => r.status === 'fulfilled')).toBe(true);
    // La base est cohérente : le fichier adapté a bien été cascadé avec son parent.
    expect(database.getAllFiles().length).toBe(0);

    // Mais l'octet du fichier adapté reste sur disque, sans aucune ligne qui le
    // référence. Il ne sera réclamé qu'au prochain BACKUP RÉUSSI (gcOrphans).
    const referenced = new Set(database.midiDB.listBlobsForManifest().map((r) => r.blob_path));
    const onDisk = [];
    const { readdirSync, existsSync } = await import('fs');
    const midiDir = join(tempDir, 'midi');
    if (existsSync(midiDir)) {
      for (const shard of readdirSync(midiDir)) {
        for (const name of readdirSync(join(midiDir, shard))) onDisk.push(`midi/${shard}/${name}`);
      }
    }
    const orphans = onDisk.filter((b) => !referenced.has(b));
    expect(orphans.length).toBe(1);
  });

  test('W-5 — deux enregistrements concurrents du MÊME instrument : dernier arrivé gagne, sans jeton de version', () => {
    // Pas d'`await` dans le chemin d'écriture des réglages : la base ne peut pas
    // être laissée à moitié écrite. Le risque est la MISE À JOUR PERDUE :
    // rien (ni ETag, ni updated_at comparé) ne détecte l'écrasement.
    database.updateInstrumentSettings('dev-a', 0, { custom_name: 'Onglet A', sync_delay: 10 });
    const snapshotVuParB = database.getInstrumentSettings('dev-a', 0);

    // L'onglet A enregistre.
    database.updateInstrumentSettings('dev-a', 0, { custom_name: 'Piano du salon' });
    // L'onglet B enregistre sur la base de sa vue périmée.
    database.updateInstrumentSettings('dev-a', 0, { custom_name: snapshotVuParB.custom_name });

    expect(database.getInstrumentSettings('dev-a', 0).custom_name).toBe('Onglet A');
    // Aucune API ne permet à A de savoir qu'il a été écrasé.
    expect(Object.keys(snapshotVuParB)).not.toContain('version');
    expect(Object.keys(snapshotVuParB)).not.toContain('etag');
  });

  test('W-6 — playlist : deux ajouts concurrents ne peuvent pas produire de position en double (écriture synchrone)', () => {
    const fileA = (() => {
      database.db
        .prepare(
          "INSERT INTO midi_files (content_hash, filename, folder, blob_path, size, tracks, uploaded_at) VALUES ('ha','a.mid','/','midi/aa/ha.mid',10,1,datetime('now'))"
        )
        .run();
      return database.db.prepare("SELECT id FROM midi_files WHERE content_hash='ha'").get().id;
    })();
    const pid = database.insertPlaylist({ name: 'P' });

    // `addPlaylistItem` fait MAX(position)+1 PUIS INSERT, hors transaction —
    // sûr uniquement parce que le driver est synchrone et mono-connexion.
    for (let i = 0; i < 5; i++) database.addPlaylistItem(pid, fileA, undefined);
    const positions = database
      .getPlaylistItems(pid)
      .map((i) => i.position)
      .sort((a, b) => a - b);
    expect(positions).toEqual([0, 1, 2, 3, 4]);

    // En revanche rien n'INTERDIT structurellement la collision : aucune
    // contrainte UNIQUE(playlist_id, position) n'existe.
    const idx = database.db
      .pragma('index_list(playlist_items)')
      .filter((i) => i.unique === 1);
    expect(idx).toEqual([]);
  });
});
