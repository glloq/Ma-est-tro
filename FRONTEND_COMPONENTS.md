# MidiMind Frontend Components

Documentation des composants UI modernes ajoutés pour accélérer le développement du frontend.

## Vue d'ensemble

Les nouveaux composants sont inspirés de bibliothèques populaires comme:
- [webaudio-controls](https://github.com/g200kg/webaudio-controls) - Pour les knobs et faders
- [webaudio-pianoroll](https://github.com/g200kg/webaudio-pianoroll) - Pour le piano roll optimisé

## Composants disponibles

### 1. WebAudioKnob
**Fichier:** `public/js/ui/WebAudioKnob.js`

Bouton rotatif (knob) optimisé pour les contrôles MIDI et Web Audio.

#### Caractéristiques
- Rendu Canvas haute performance
- Support souris et tactile
- Scroll wheel support
- Double-click pour reset
- Personnalisable (couleurs, taille, plage)

#### Utilisation

```javascript
// Création simple
const knob = new WebAudioKnob('#container', {
    min: 0,
    max: 127,
    value: 64,
    size: 64,
    label: 'Volume',
    showValue: true,
    onChange: (value) => {
        console.log('New value:', value);
    }
});

// Personnalisation des couleurs
const knob = new WebAudioKnob('#container', {
    min: 0,
    max: 100,
    value: 50,
    bgColor: '#2c3e50',
    trackColor: '#34495e',
    fillColor: '#3498db',
    pointerColor: '#ecf0f1',
    labelColor: '#ffffff'
});

// Méthodes
knob.setValue(80);          // Définir la valeur
const val = knob.getValue(); // Obtenir la valeur
knob.destroy();             // Détruire le composant
```

### 2. WebAudioFader
**Fichier:** `public/js/ui/WebAudioFader.js`

Fader vertical ou horizontal pour contrôles de volume, pan, etc.

#### Caractéristiques
- Orientation vertical/horizontal
- Drag & drop fluide
- Click pour jump to value
- Double-click pour reset
- Support tactile

#### Utilisation

```javascript
// Fader vertical
const fader = new WebAudioFader('#container', {
    min: 0,
    max: 127,
    value: 100,
    height: 150,
    width: 40,
    orientation: 'vertical',
    label: 'Ch 1',
    onChange: (value) => {
        console.log('Fader value:', value);
    }
});

// Fader horizontal
const panFader = new WebAudioFader('#container', {
    min: -64,
    max: 64,
    value: 0,
    height: 40,
    width: 150,
    orientation: 'horizontal',
    label: 'Pan'
});

// Méthodes
fader.setValue(75);
const val = fader.getValue();
fader.destroy();
```

### 3. OptimizedPianoRoll
**Fichier:** `public/js/ui/OptimizedPianoRoll.js`

Piano roll haute performance avec édition MIDI complète.

#### Caractéristiques
- RequestAnimationFrame rendering (60 FPS)
- Virtual scrolling pour gros fichiers
- Édition de notes (ajouter, supprimer, déplacer, redimensionner)
- Zoom et pan
- Grid snapping
- Sélection multiple
- Support tactile et souris
- Clavier visuel (piano keys)

#### Utilisation

```javascript
// Création
const pianoRoll = new OptimizedPianoRoll('#container', {
    width: 1200,
    height: 600,
    noteHeight: 12,
    timeScale: 100,  // pixels per beat
    snapToGrid: true,
    gridDivision: 16,  // 16th notes

    // Callbacks
    onNoteAdd: (note) => {
        console.log('Note added:', note);
    },
    onNoteDelete: (note) => {
        console.log('Note deleted:', note);
    },
    onNoteChange: (note) => {
        console.log('Note changed:', note);
    }
});

// Charger des notes
pianoRoll.setNotes([
    { id: 1, time: 0, pitch: 60, duration: 1, velocity: 100 },
    { id: 2, time: 1, pitch: 64, duration: 1, velocity: 90 },
    { id: 3, time: 2, pitch: 67, duration: 1, velocity: 85 }
]);

// Contrôle de playback
pianoRoll.setPlayhead(2.5);  // Position en beats

// Zoom & scroll
pianoRoll.setZoom(1.5);
pianoRoll.scrollTo(100, 50);

// Ajouter une note
pianoRoll.addNote({
    time: 4,
    pitch: 72,
    duration: 0.5,
    velocity: 100
});

// Méthodes
pianoRoll.updateNote(noteId, { pitch: 64, velocity: 90 });
pianoRoll.deleteNote(noteId);
pianoRoll.destroy();
```

### 4. EnhancedWebSocketClient
**Fichier:** `public/js/services/EnhancedWebSocketClient.js`

Client WebSocket robuste avec auto-reconnexion et file d'attente.

#### Caractéristiques
- Reconnexion automatique avec exponential backoff
- File d'attente de messages (offline support)
- Heartbeat/ping-pong
- API basée sur Promises pour request/response
- Système d'événements
- Timeout configurable

#### Utilisation

```javascript
// Connexion
const ws = new EnhancedWebSocketClient('ws://localhost:8081', {
    reconnectInterval: 1000,
    maxReconnectInterval: 30000,
    heartbeatInterval: 30000,
    debug: true
});

// Écouter les événements
ws.on('connect', () => {
    console.log('Connected to server');
});

ws.on('disconnect', (event) => {
    console.log('Disconnected:', event.code);
});

ws.on('message', (data) => {
    console.log('Received:', data);
});

// Envoyer des messages
ws.send({ type: 'hello', data: 'world' });

// Request/Response pattern (Promise-based)
try {
    const response = await ws.request('get_devices', {});
    console.log('Devices:', response);
} catch (error) {
    console.error('Request failed:', error);
}

// Envoyer MIDI
ws.send({
    type: 'midi_out',
    data: [0x90, 60, 100],  // Note On, C4, velocity 100
    timestamp: Date.now()
});

// État
const state = ws.getState();
console.log('Connected:', state.connected);
console.log('Queue size:', state.queueSize);

// Déconnexion
ws.disconnect();
```

### 5. UIComponentAdapter
**Fichier:** `public/js/adapters/UIComponentAdapter.js`

Adaptateur pour faciliter l'intégration des composants dans l'application MidiMind.

#### Caractéristiques
- Création simplifiée de composants
- Intégration avec EventBus
- Gestion automatique du cycle de vie
- Helpers MIDI
- Gestion de presets

#### Utilisation

```javascript
// Initialisation
const adapter = new UIComponentAdapter(window.eventBus);

// Initialiser WebSocket
const ws = adapter.initWebSocket('ws://localhost:8081');

// Créer un knob
const volumeKnob = adapter.createKnob('#controls', {
    id: 'volume',
    label: 'Volume',
    min: 0,
    max: 127,
    value: 100,
    midiCC: 7,
    channel: 0,
    onChange: (value) => {
        console.log('Volume:', value);
    }
});

// Créer un panel de knobs
const { panel, knobs } = adapter.createKnobPanel('#controls', [
    { id: 'cutoff', label: 'Cutoff', midiCC: 74, value: 64 },
    { id: 'resonance', label: 'Reso', midiCC: 71, value: 0 },
    { id: 'attack', label: 'Attack', midiCC: 73, value: 32 }
]);

// Créer un mixer
const { mixer, faders } = adapter.createMixer('#mixer', 8, {
    height: 200
});

// Créer un piano roll
const pianoRoll = adapter.createPianoRoll('#editor', {
    width: 1200,
    height: 600
});

// Envoyer du MIDI
adapter.sendMidiCC(0, 7, 100);  // Channel 0, CC 7 (volume), value 100
adapter.sendMidiNote(0, 60, 100, true);  // Note On C4

// Gestion de presets
const presetManager = adapter.createPresetManager(knobs);
presetManager.save('my_preset');
presetManager.load('my_preset');
const list = presetManager.list();
presetManager.delete('my_preset');

// Récupérer un composant
const knob = adapter.getComponent('volume');

// Détruire un composant
adapter.destroyComponent('volume');

// Détruire tous les composants
adapter.destroyAll();
```

## Intégration dans MidiMind

### Ajouter les scripts dans index.html

```html
<!-- Nouveaux composants UI -->
<script src="js/ui/WebAudioKnob.js"></script>
<script src="js/ui/WebAudioFader.js"></script>
<script src="js/ui/OptimizedPianoRoll.js"></script>
<script src="js/services/EnhancedWebSocketClient.js"></script>
<script src="js/adapters/UIComponentAdapter.js"></script>
```

### Exemple d'utilisation dans Application.js

```javascript
// Dans Application.init()
this.uiAdapter = new UIComponentAdapter(this.eventBus);

// Initialiser WebSocket
this.ws = this.uiAdapter.initWebSocket('ws://localhost:8081');

// Créer des contrôles dans HomeController
const controls = this.uiAdapter.createKnobPanel('#controls-panel', [
    { id: 'master_volume', label: 'Master', midiCC: 7, channel: 0 },
    { id: 'tempo', label: 'Tempo', min: 60, max: 200, value: 120 }
]);

// Créer piano roll dans EditorController
const pianoRoll = this.uiAdapter.createPianoRoll('#pianoroll-container', {
    width: this.containerWidth,
    height: 600
});
```

## Styles CSS

Ajouter dans `public/styles/components.css`:

```css
/* Knob Panel */
.knob-panel {
    display: flex;
    gap: 16px;
    flex-wrap: wrap;
    padding: 16px;
    background: #2c3e50;
    border-radius: 8px;
}

.knob-container {
    display: flex;
    flex-direction: column;
    align-items: center;
}

/* Mixer */
.mixer-panel {
    display: flex;
    gap: 8px;
    padding: 16px;
    background: #34495e;
    border-radius: 8px;
}

.mixer-channel {
    display: flex;
    flex-direction: column;
    align-items: center;
}

/* Piano Roll */
.pianoroll-canvas {
    display: block;
    border: 1px solid #34495e;
    border-radius: 4px;
}
```

## Performance

- **WebAudioKnob/Fader**: Rendu Canvas optimisé, ~60 FPS
- **OptimizedPianoRoll**: RequestAnimationFrame, virtual scrolling, peut gérer 10,000+ notes
- **EnhancedWebSocketClient**: Message queuing, automatic reconnect, minimal overhead

## Compatibilité

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Support tactile: iOS Safari, Android Chrome

## Exemples complets

Voir le dossier `examples/` pour des démos complètes:
- `examples/knobs-demo.html` - Démo des knobs
- `examples/faders-demo.html` - Démo des faders
- `examples/pianoroll-demo.html` - Démo du piano roll
- `examples/websocket-demo.html` - Démo WebSocket

## Roadmap

- [ ] Support WebGL pour piano roll (> 50,000 notes)
- [ ] Waveform display component
- [ ] Spectrum analyzer component
- [ ] XY Pad component
- [ ] Keyboard component
- [ ] Sequencer step component

## Crédits

Inspiré par:
- [webaudio-controls](https://github.com/g200kg/webaudio-controls) by g200kg
- [webaudio-pianoroll](https://github.com/g200kg/webaudio-pianoroll) by g200kg
- [Tone.js](https://tonejs.github.io/) - Web Audio framework
- [NexusUI](https://nexus-js.github.io/ui/) - Web Audio UI components

## License

MIT
