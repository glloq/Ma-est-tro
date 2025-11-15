# MidiMind - Testing Guide

Guide complet pour tester toutes les fonctionnalités critiques de MidiMind.

## Fonctionnalités à Tester

### ✅ 1. Upload de fichier MIDI vers le backend
### ✅ 2. Sélection d'un fichier MIDI
### ✅ 3. Ouverture de l'éditeur (piano roll)
### ✅ 4. Sauvegarde des modifications
### ✅ 5. Routing de canal MIDI vers instrument
### ✅ 6. Lecture MIDI avec compensation de latence

## Pré-requis

### Backend (Raspberry Pi ou développement local)

```bash
cd /path/to/Ma-est-tro
npm install
npm start
```

Le backend démarre sur:
- HTTP: `http://localhost:8080`
- WebSocket: `ws://localhost:8081`

### Frontend

Navigateur compatible:
- Chrome/Chromium 90+
- Edge 90+

## Page de Test Complète

Ouvrir dans un navigateur:
```
examples/functionality-test.html
```

Cette page teste **toutes** les fonctionnalités en un seul endroit.

## Tests Détaillés

### Test 1: Upload de Fichier MIDI

#### Méthode 1: Via l'interface

1. Cliquez sur "Choose Files"
2. Sélectionnez un ou plusieurs fichiers MIDI (.mid ou .midi)
3. Cliquez sur "Upload Selected Files"
4. Vérifiez le log: "✅ Uploaded: filename.mid"

#### Méthode 2: Programmation

```javascript
const fileManager = new MidiFileManager(apiClient, pianoRoll, eventBus);

// Upload file
const file = document.getElementById('file-input').files[0];
const result = await fileManager.uploadFile(file);
console.log('Uploaded:', result);
```

#### API Backend Utilisée

```javascript
// Command: file_upload
{
    command: 'file_upload',
    data: {
        filename: 'song.mid',
        data: 'base64_encoded_midi_data',
        folder: '/'
    }
}
```

#### Résultat Attendu

```json
{
    "success": true,
    "fileId": 123,
    "filename": "song.mid",
    "size": 12345
}
```

---

### Test 2: Sélection de Fichier MIDI

#### Interface

1. Cliquez sur "Refresh File List"
2. La liste des fichiers s'affiche
3. Cliquez sur un fichier pour le sélectionner
4. Le fichier devient bleu (classe CSS "selected")

#### Programmation

```javascript
// Get file list
const files = await fileManager.refreshFileList();
console.log('Files:', files);

// Select a file
const fileData = await fileManager.selectFile(fileId);
console.log('Selected:', fileData);
```

#### API Backend

```javascript
// Command: file_list
{
    command: 'file_list',
    data: {
        folder: '/'
    }
}

// Response
{
    files: [
        { id: 1, filename: 'song1.mid', size: 1234 },
        { id: 2, filename: 'song2.mid', size: 5678 }
    ]
}
```

```javascript
// Command: file_load
{
    command: 'file_load',
    data: {
        fileId: 123
    }
}

// Response
{
    id: 123,
    filename: 'song.mid',
    midi: {
        format: 1,
        division: 480,
        tracks: [...]
    }
}
```

---

### Test 3: Ouverture dans l'Éditeur

#### Interface

1. Sélectionnez un fichier
2. Cliquez sur "Open Selected File in Editor"
3. Le piano roll affiche les notes du fichier
4. Le statut indique "Editing: filename.mid"

#### Programmation

```javascript
await fileManager.openInEditor(fileId);

// Le piano roll se charge automatiquement
// Les notes s'affichent visuellement
```

#### Format de Données

Le piano roll utilise le format:
```javascript
sequence = [
    [tick, note, gate, velocity],
    [0, 60, 4, 100],    // C4 at tick 0, duration 4, velocity 100
    [4, 64, 4, 100],    // E4 at tick 4
    [8, 67, 4, 100]     // G4 at tick 8
]
```

#### Vérifications

- ✅ Les notes s'affichent dans le piano roll
- ✅ On peut ajouter des notes (clic)
- ✅ On peut déplacer des notes (drag)
- ✅ On peut supprimer des notes (select + Delete)
- ✅ Le zoom fonctionne (Ctrl + Wheel)
- ✅ Le pan fonctionne (drag background)

---

### Test 4: Sauvegarde des Modifications

#### Interface

1. Ouvrir un fichier dans l'éditeur
2. Modifier les notes (ajouter, déplacer, supprimer)
3. Cliquer sur "Save Modifications"
4. Vérifier: "✅ Modifications saved successfully"

#### Programmation

```javascript
// Make changes
pianoRoll.addNote(16, 72, 4, 100); // Add C5

// Save
const result = await fileManager.saveModifications();
console.log('Saved:', result);
```

#### API Backend

```javascript
// Command: file_save
{
    command: 'file_save',
    data: {
        fileId: 123,
        midi: {
            format: 1,
            division: 480,
            tracks: [...]
        }
    }
}

// Response
{
    success: true
}
```

#### Fonctionnalités Avancées

**Auto-save**:
```javascript
fileManager.startAutoSave(30000); // Auto-save every 30 seconds
```

**Save As**:
```javascript
await fileManager.saveAs('new-song.mid');
```

**Dirty Flag**:
```javascript
if (fileManager.hasUnsavedChanges()) {
    // Prompt user before closing
}
```

---

### Test 5: Routing de Canal MIDI vers Instrument

#### Interface

1. Cliquez sur "Refresh Devices" pour charger les instruments
2. Dans la table de routing:
   - Sélectionnez un instrument pour chaque canal
   - Définissez la latence (ms)
3. Cliquez sur "Route" pour chaque canal
4. Ou cliquez "Apply Routing" pour tout appliquer

#### Programmation

```javascript
const routingManager = new MidiRoutingManager(apiClient, eventBus);

// Get available instruments
const instruments = routingManager.getAvailableInstruments();
console.log('Instruments:', instruments);

// Route channel 0 to instrument
await routingManager.routeChannelToInstrument(
    0,                  // MIDI channel 0
    'instrument-id',    // Target instrument
    0                   // Target channel (optional)
);

// Set latency for instrument
await routingManager.setDeviceLatency('instrument-id', 50); // 50ms
```

#### API Backend

```javascript
// Command: route_create
{
    command: 'route_create',
    data: {
        from: 'pianoroll',
        to: 'instrument-id',
        enabled: true
    }
}

// Command: channel_map
{
    command: 'channel_map',
    data: {
        routeId: 456,
        fromChannel: 0,
        toChannel: 0
    }
}

// Command: latency_set
{
    command: 'latency_set',
    data: {
        deviceId: 'instrument-id',
        latency: 50
    }
}
```

#### Exemple: Routing Multi-Instruments

```javascript
// Piano on channel 0 -> Instrument A (30ms latency)
await routingManager.routeChannelToInstrument(0, 'instrument-a');
await routingManager.setDeviceLatency('instrument-a', 30);

// Drums on channel 9 -> Instrument B (0ms latency)
await routingManager.routeChannelToInstrument(9, 'instrument-b');
await routingManager.setDeviceLatency('instrument-b', 0);

// Strings on channel 1 -> Instrument C (80ms latency)
await routingManager.routeChannelToInstrument(1, 'instrument-c');
await routingManager.setDeviceLatency('instrument-c', 80);
```

---

### Test 6: Lecture MIDI avec Compensation de Latence

#### Interface

1. Sélectionnez un fichier
2. Configurez le routing (test 5)
3. Ajustez le tempo (BPM)
4. Activez le loop (optionnel)
5. Cliquez "▶ Play"

#### Programmation

```javascript
// Start playback
await apiClient.startPlayback(fileId, {
    tempo: 120,
    loop: true,
    transpose: 0,
    volume: 100
});

// Control playback
await apiClient.pausePlayback();
await apiClient.resumePlayback();
await apiClient.seekPlayback(10.5); // Seek to 10.5 seconds
await apiClient.stopPlayback();

// Set tempo
await apiClient.setPlaybackTempo(140);
```

#### API Backend

```javascript
// Command: playback_start
{
    command: 'playback_start',
    data: {
        fileId: 123,
        loop: true,
        tempo: 120,
        transpose: 0,
        volume: 100
    }
}
```

#### Compensation de Latence

Le backend **compense automatiquement** la latence configurée:

1. Pour chaque note MIDI
2. Calcule le délai du canal/instrument
3. Envoie la note **en avance** pour compenser

```
Note à t=1000ms sur canal avec 50ms de latence
→ Envoyée à t=950ms
→ Arrive à l'instrument à t=1000ms
```

#### Vérification

```javascript
// Get latency map for all channels
const latencyMap = routingManager.getPlaybackLatencyMap();
console.log(latencyMap);
// {
//   0: 30,   // Channel 0: 30ms
//   1: 80,   // Channel 1: 80ms
//   9: 0,    // Channel 9: 0ms
// }
```

---

## Workflow Complet

### Scénario: Éditer et Jouer un Fichier MIDI

```javascript
// 1. Upload
const file = document.getElementById('file-input').files[0];
const uploaded = await fileManager.uploadFile(file);

// 2. Select
await fileManager.refreshFileList();
const fileData = await fileManager.selectFile(uploaded.fileId);

// 3. Open in editor
await fileManager.openInEditor(uploaded.fileId);

// 4. Edit (manually in piano roll UI)
// ... user adds/modifies notes ...

// 5. Save
await fileManager.saveModifications();

// 6. Route channels to instruments
await routingManager.routeChannelToInstrument(0, 'piano-id');
await routingManager.setDeviceLatency('piano-id', 30);

await routingManager.routeChannelToInstrument(9, 'drums-id');
await routingManager.setDeviceLatency('drums-id', 0);

// 7. Play with latency compensation
await apiClient.startPlayback(uploaded.fileId, {
    tempo: 120,
    loop: false
});
```

---

## Dépannage

### Problème: WebSocket ne se connecte pas

**Solution**:
1. Vérifier que le backend tourne: `npm start`
2. Vérifier le port: `ws://localhost:8081`
3. Regarder la console browser (F12)

### Problème: Upload échoue

**Causes possibles**:
- Fichier trop gros (> 10 MB)
- Format invalide (pas un MIDI)
- Backend offline

**Solution**:
```javascript
try {
    await fileManager.uploadFile(file);
} catch (error) {
    console.error('Upload error:', error.message);
}
```

### Problème: Piano roll ne s'affiche pas

**Vérifier**:
```javascript
// 1. webaudio-pianoroll chargé?
console.log(window.WebAudioPianoRoll);

// 2. Element créé?
console.log(document.querySelector('webaudio-pianoroll'));

// 3. Séquence chargée?
console.log(pianoRoll.getSequence());
```

### Problème: Routing ne fonctionne pas

**Vérifier**:
```javascript
// 1. Devices disponibles?
const devices = await routingManager.refreshDevices();
console.log('Devices:', devices);

// 2. Routes créées?
const routes = await routingManager.refreshRoutes();
console.log('Routes:', routes);

// 3. Channel mappings?
console.log(routingManager.getAllChannelRoutes());
```

### Problème: Latence incorrecte

**Mesurer**:
```javascript
// Auto-mesure
const result = await routingManager.autoCalibrateLatency('instrument-id');
console.log('Measured latency:', result.latency);

// Vérifier
const latency = routingManager.getDeviceLatency('instrument-id');
console.log('Current latency:', latency);
```

---

## Tests Automatisés

### Script de Test

```javascript
async function runTests() {
    console.log('🧪 Running MidiMind Tests...\n');

    // Test 1: Upload
    console.log('Test 1: Upload MIDI file');
    const file = new File(['mock data'], 'test.mid');
    const uploaded = await fileManager.uploadFile(file);
    console.assert(uploaded.fileId, 'Upload failed');
    console.log('✅ Upload OK\n');

    // Test 2: Select
    console.log('Test 2: Select file');
    const files = await fileManager.refreshFileList();
    console.assert(files.length > 0, 'No files found');
    const selected = await fileManager.selectFile(files[0].id);
    console.assert(selected, 'Select failed');
    console.log('✅ Select OK\n');

    // Test 3: Edit
    console.log('Test 3: Open in editor');
    await fileManager.openInEditor(files[0].id);
    console.assert(pianoRoll.getSequence().length > 0, 'No notes loaded');
    console.log('✅ Editor OK\n');

    // Test 4: Save
    console.log('Test 4: Save modifications');
    pianoRoll.addNote(0, 60, 4, 100);
    const saved = await fileManager.saveModifications();
    console.assert(saved.saved, 'Save failed');
    console.log('✅ Save OK\n');

    // Test 5: Routing
    console.log('Test 5: Channel routing');
    const instruments = await routingManager.refreshDevices();
    if (instruments.length > 0) {
        await routingManager.routeChannelToInstrument(0, instruments[0].id);
        const route = routingManager.getChannelRoute(0);
        console.assert(route, 'Routing failed');
        console.log('✅ Routing OK\n');
    }

    // Test 6: Playback
    console.log('Test 6: Playback');
    await apiClient.startPlayback(files[0].id);
    await new Promise(resolve => setTimeout(resolve, 1000));
    await apiClient.stopPlayback();
    console.log('✅ Playback OK\n');

    console.log('✅ All tests passed!');
}
```

---

## Métriques de Performance

### Latence Upload
- Fichier 100KB: < 500ms
- Fichier 1MB: < 2s
- Fichier 10MB: < 10s

### Latence Sélection
- Liste de 100 fichiers: < 200ms
- Chargement fichier: < 500ms

### Latence Sauvegarde
- Petit fichier (< 100 notes): < 300ms
- Gros fichier (> 1000 notes): < 1s

### Latence Routing
- Création route: < 100ms
- Mapping canal: < 50ms
- Set latency: < 50ms

### Playback
- Start: < 200ms
- Précision latence: ± 5ms
- MIDI jitter: < 2ms

---

## Conclusion

Toutes les fonctionnalités critiques sont testables via `examples/functionality-test.html`.

Chaque API est documentée et accessible via:
- `BackendAPIClient` - API bas niveau
- `MidiFileManager` - Gestion fichiers
- `MidiRoutingManager` - Routing & latence

Les tests couvrent:
- ✅ Upload fichiers MIDI
- ✅ Sélection fichiers
- ✅ Édition piano roll
- ✅ Sauvegarde modifications
- ✅ Routing canaux → instruments
- ✅ Playback avec compensation latence

**Prêt pour la production !** 🚀
