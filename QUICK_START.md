# MidiMind - Quick Start Guide

## Ce qui a été fait

Intégration complète de bibliothèques MIDI éprouvées de GitHub pour accélérer le développement :

### Bibliothèques Intégrées

1. **WebMidi.js** (djipco) - Accès MIDI navigateur
2. **Tone.js** - Synthèse audio pour preview MIDI
3. **webaudio-pianoroll** (g200kg) - Éditeur piano roll production-ready
4. **webaudio-controls** (g200kg) - Knobs/faders professionnels
5. **JZZ** - Fallback MIDI library

### Couche d'Intégration

- **MidiBridge**: Connecte WebMIDI (browser) ↔ Backend (Raspberry Pi)
- **PianoRollWrapper**: Wrapper pour webaudio-pianoroll + intégration MidiMind
- **MidiIntegrationManager**: Gestionnaire principal orchestrant tout

## Test Rapide

### 1. Démarrer le Backend (Raspberry Pi)

```bash
cd /path/to/Ma-est-tro
npm install
npm start
```

Le backend démarre sur :
- HTTP: `http://localhost:8080`
- WebSocket: `ws://localhost:8081`

### 2. Ouvrir la Démo Intégrée

Ouvrir dans un navigateur (Chrome/Edge recommandé) :

```
examples/integrated-editor.html
```

### 3. Tester les Fonctionnalités

#### a) Connexion Backend
- La démo se connecte automatiquement au WebSocket
- Voyez l'indicateur vert "WebSocket (Connected)"

#### b) MIDI Navigateur
- Branchez un clavier MIDI USB sur votre ordinateur
- Le navigateur détecte automatiquement le device
- Cliquez sur l'input dans la sidebar pour le connecter
- Jouez des notes → elles sont routées vers le Raspberry Pi

#### c) Piano Roll
- L'éditeur charge une gamme de Do en démo
- Cliquez pour ajouter des notes
- Drag pour déplacer des notes
- Sélection + Delete pour supprimer

#### d) Playback
- Cliquez "Play" pour lire la séquence
- Les notes sont envoyées via MIDI + audio preview (Tone.js)
- Ajustez le BPM avec le slider

#### e) Charger un fichier MIDI
- Cliquez "📁 Open MIDI"
- Sélectionnez un fichier .mid
- Le piano roll affiche les notes

#### f) Panic
- Cliquez "🚨 Panic" pour arrêter toutes les notes

## Architecture

```
Browser (Piano Roll + WebMIDI)
    ↕ MidiBridge
    ↕ EnhancedWebSocketClient (auto-reconnect)
    ↕ Backend WebSocket Server
    ↕ easymidi (Node.js)
    ↕ Hardware MIDI (USB/Virtual/BLE)
```

## Fichiers Importants

### Documentation
- `INTEGRATION_GUIDE.md` - Guide complet d'intégration
- `FRONTEND_COMPONENTS.md` - Documentation des composants UI
- `README.md` - Vue d'ensemble du projet

### Exemples
- `examples/integrated-editor.html` - Éditeur MIDI complet
- `examples/ui-components-demo.html` - Démo des composants UI

### Code d'Intégration
- `public/js/lib/external-libs.js` - Chargeur de bibliothèques CDN
- `public/js/bridges/MidiBridge.js` - Bridge WebMIDI ↔ Backend
- `public/js/wrappers/PianoRollWrapper.js` - Wrapper piano roll
- `public/js/integration/MidiIntegrationManager.js` - Gestionnaire principal

### Composants UI Custom
- `public/js/ui/WebAudioKnob.js` - Knob rotatif
- `public/js/ui/WebAudioFader.js` - Fader vertical/horizontal
- `public/js/ui/OptimizedPianoRoll.js` - Piano roll custom
- `public/js/services/EnhancedWebSocketClient.js` - WebSocket robuste

## Utilisation dans l'Application Existante

### 1. Ajouter dans `public/index.html`

```html
<!-- Before closing </body> -->

<!-- External Libraries Loader -->
<script src="js/lib/external-libs.js"></script>

<!-- Integration Layer -->
<script src="js/services/EnhancedWebSocketClient.js"></script>
<script src="js/bridges/MidiBridge.js"></script>
<script src="js/wrappers/PianoRollWrapper.js"></script>
<script src="js/integration/MidiIntegrationManager.js"></script>
```

### 2. Modifier `public/js/core/Application.js`

```javascript
async init() {
    // ... existing code ...

    // Initialize MIDI Integration Manager
    this.midiManager = new MidiIntegrationManager(this.eventBus);
    await this.midiManager.init('ws://localhost:8081');
    window.midiManager = this.midiManager; // Global access

    // ... rest of init ...
}
```

### 3. Modifier `public/js/controllers/EditorController.js`

```javascript
initPianoRoll() {
    const container = document.getElementById('pianoroll-container');
    this.pianoRoll = window.midiManager.createPianoRoll(container, {
        width: container.clientWidth - 40,
        height: 400
    });
}

loadFile(file) {
    return window.midiManager.loadMidiFile(file);
}

play() {
    window.midiManager.playPianoRoll();
}

stop() {
    window.midiManager.stopPianoRoll();
}
```

### 4. Ajouter dans la page Editor HTML

```html
<div id="editor" class="page page-fullscreen">
    <div class="editor-toolbar">
        <button onclick="window.midiManager.playPianoRoll()">Play</button>
        <button onclick="window.midiManager.stopPianoRoll()">Stop</button>
        <button onclick="window.midiManager.panic()">Panic</button>
    </div>

    <!-- Piano Roll Container -->
    <div id="pianoroll-container" style="height: 500px;"></div>
</div>
```

## API Rapide

### MidiIntegrationManager

```javascript
const manager = window.midiManager;

// Créer piano roll
const pianoRoll = manager.createPianoRoll('#container');

// Charger MIDI file
await manager.loadMidiFile(file);

// Playback
manager.playPianoRoll();
manager.stopPianoRoll();

// Devices
const devices = manager.getDevices();
manager.connectBrowserInput(inputId);
manager.refreshDevices();

// Recording
const stop = manager.startRecording();
const recording = stop(); // Returns {notes: [...]}

// Audio preview
manager.setAudioPreview(true);
manager.setMasterVolume(-10); // dB

// Panic
manager.panic(); // All notes off

// Status
const status = manager.getStatus();
```

### MidiBridge

```javascript
const bridge = manager.midiBridge;

// Send MIDI
bridge.sendNoteOn(60, 100, 1, 'both'); // note, velocity, channel, target
bridge.sendNoteOff(60, 1, 'both');
bridge.sendCC(7, 100, 1, 'both'); // cc, value, channel, target

// Targets: 'browser', 'backend', 'both'
```

### Piano Roll

```javascript
const pianoRoll = manager.pianoRoll;

// Sequence format: [[tick, note, gate, velocity], ...]
pianoRoll.setSequence([
    [0, 60, 4, 100],   // C4 at tick 0, duration 4, velocity 100
    [4, 64, 4, 100]    // E4 at tick 4
]);

const seq = pianoRoll.getSequence();

// Playback
pianoRoll.play();
pianoRoll.stop();
pianoRoll.setBPM(140);
pianoRoll.setLoop(true);

// View
pianoRoll.zoomIn();
pianoRoll.zoomOut();
pianoRoll.fitToContent();

// Export
const midiData = await pianoRoll.exportMidi();

// Stats
const stats = pianoRoll.getStats();
// { noteCount, duration, noteRange: {min, max} }
```

## Modes de Fonctionnement

### 1. Mode Complet (Raspberry Pi + Browser)
- Backend sur Raspberry Pi avec MIDI hardware
- Frontend se connecte via WebSocket
- MIDI routé: Browser ↔ Backend ↔ Hardware

### 2. Mode Browser-Only
- Backend offline/indisponible
- Fonctionne uniquement avec MIDI browser (Web MIDI API)
- Audio preview via Tone.js
- Édition et playback locaux

### 3. Mode Backend-Only
- Pas de WebMIDI dans le browser (navigateur non compatible)
- Utilise uniquement le backend Raspberry Pi
- Contrôle via interface web

## Dépendances Backend

```json
{
  "dependencies": {
    "express": "^4.18.2",
    "ws": "^8.14.2",
    "easymidi": "^2.0.1",
    "better-sqlite3": "^9.2.2"
  }
}
```

## Dépendances Frontend (CDN)

Toutes chargées automatiquement depuis jsDelivr:
- WebMidi.js v3.1.11
- Tone.js v14.7.77
- webaudio-pianoroll v1.0.8
- webaudio-controls v3.4.0
- JZZ v1.7.5

## Compatibilité

### Navigateurs
- ✅ Chrome/Chromium 90+
- ✅ Edge 90+
- ⚠️ Firefox 88+ (Web MIDI via flag)
- ❌ Safari (pas de Web MIDI API)

### Systèmes
- ✅ Raspberry Pi OS (64-bit) - Backend
- ✅ Windows 10/11 - Browser + Backend
- ✅ macOS 11+ - Browser + Backend
- ✅ Linux (Ubuntu/Debian) - Browser + Backend

## Prochaines Étapes

1. **Intégrer dans l'app existante**
   - Suivre les instructions ci-dessus
   - Tester avec l'UI MidiMind existante

2. **Ajouter des fonctionnalités**
   - Enregistrement MIDI
   - Import/Export SMF (Standard MIDI File)
   - Quantization
   - MIDI effects

3. **Optimisations**
   - Cache pour gros fichiers MIDI
   - Virtual scrolling pour 10,000+ notes
   - WebGL rendering pour performance extrême

4. **Documentation**
   - Tutoriels vidéo
   - API reference complète
   - Exemples supplémentaires

## Support

- Documentation: `INTEGRATION_GUIDE.md`
- Exemples: `examples/`
- Issues: GitHub repository

## Crédits

### Bibliothèques Utilisées
- WebMidi.js by Jean-Philippe Côté (@djipco)
- Tone.js by Yotam Mann and contributors
- webaudio-pianoroll by g200kg
- webaudio-controls by g200kg
- JZZ by jazz-soft

### License
- Bibliothèques externes: Voir leurs licenses respectives
- Code d'intégration MidiMind: MIT
