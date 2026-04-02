# Playlists et gestion des fichiers non-routés

## Architecture

### Backend

| Fichier | Rôle |
|---------|------|
| `src/storage/Database.js` | 6 méthodes playlist_items (get, add, remove, reorder, clear, updateLoop) |
| `src/api/commands/PlaylistCommands.js` | 14 commandes WebSocket (CRUD + start/next/prev/stop/status) |
| `src/midi/MidiPlayer.js` | Queue system (setQueue, playQueueItem, nextInQueue, previousInQueue, _handleFileEnd) + disconnect policy |
| `src/midi/PlaybackScheduler.js` | Callback onFileEnd, playback_channel_skipped event, disconnect policy branching |
| `src/api/commands/PlaybackCommands.js` | playback_validate_routing + playback_set_disconnect_policy |

### Frontend

| Fichier | Rôle |
|---------|------|
| `public/js/views/components/PlaylistPage.js` | Page modale pleine (3 colonnes: playlists, items, queue) |
| `public/js/views/components/PlaylistEditorModal.js` | Modal d'ajout de fichiers (2 colonnes: fichiers dispo, playlist) |
| `public/styles/playlist.css` | Styles PlaylistPage (872 lignes, pré-existant) |
| `public/styles/modal-playlist.css` | Styles PlaylistEditorModal (451 lignes, pré-existant) |
| `public/index.html` | Bouton header, boutons fichier/batch, mini-queue indicator, WebSocket handlers |

### Base de données

Tables `playlists` et `playlist_items` (migration 007, pré-existantes).

## Parcours utilisateur

### Accès
- Bouton `🎶` dans le header → ouvre PlaylistPage (modal pleine page)
- Mini-indicateur de queue dans le header pendant la lecture d'une playlist

### Création
1. Cliquer `🎶` → Page playlist → Bouton "+"
2. Nommer la playlist → créée et sélectionnée
3. Bouton "Add files" → PlaylistEditorModal (2 colonnes)
4. Chercher/ajouter des fichiers → fermer → items visibles

### Ajout rapide depuis la liste de fichiers
- Bouton `📋` par fichier → dropdown des playlists existantes
- Sélection batch + bouton "📋 Ajouter à playlist"

### Lecture
1. Bouton "▶ Play" dans PlaylistPage → démarre la playlist
2. Mini-queue visible dans le header : ⏮ Previous | ⏭ Next | 🔁 Loop | ✕ Stop
3. Transitions automatiques entre fichiers (stop-load-start)
4. Routings rechargés depuis la DB pour chaque fichier

## Gestion des instruments non-routés

### Validation pré-lecture
Commande `playback_validate_routing` : vérifie chaque canal actif pour routing + device en ligne.

### Feedback pendant la lecture
- `playback_channel_skipped` : émis une fois par canal non-routé
- `playback_device_error` / `playback_device_disconnected` : émis une fois par device

### Politique de déconnexion
Commande `playback_set_disconnect_policy` :

| Mode | Comportement |
|------|-------------|
| `skip` (défaut) | Continue, ignore les events |
| `pause` | Pause la lecture |
| `mute` | Auto-mute les canaux affectés |

## Commandes WebSocket

### Playlists
- `playlist_create`, `playlist_delete`, `playlist_list`, `playlist_get`
- `playlist_add_file`, `playlist_remove_file`, `playlist_reorder`, `playlist_clear`
- `playlist_set_loop`
- `playlist_start`, `playlist_next`, `playlist_previous`, `playlist_stop`, `playlist_status`

### Validation/Policy
- `playback_validate_routing`
- `playback_set_disconnect_policy`

### Events WebSocket émis
- `playlist_item_changed` : `{ playlistId, index, totalItems, fileId, filename }`
- `playlist_ended` : `{ playlistId }`
- `playback_channel_skipped` : `{ channel, channelDisplay, reason }`
- `playback_device_error` : `{ deviceId, channel, message }`
- `playback_device_disconnected` : `{ deviceId, channel, policy, mutedChannels?, message }`
