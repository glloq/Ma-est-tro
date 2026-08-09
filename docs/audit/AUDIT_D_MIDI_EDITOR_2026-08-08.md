# Audit D — Éditeur de fichiers MIDI (backend + frontend) (2026-08-08)

Audit adversarial (4 relecteurs parallèles) de l'éditeur MIDI : **D1** chemin
backend d'écriture/sérialisation (`file_write`/`file_save_as` → `writeMidi` →
BlobStore), **D2** cœur frontend séquence/conversion/clamp, **D3** interaction/
état/playback, **D4** sous-éditeurs/rendu/piano-roll canvas + XSS.

**Frontière non fiable clé :** la sauvegarde envoie un `midiData` JSON **construit
côté client** qui est sérialisé en `.mid` sur disque. L'auth HTTP/WS est levée sur
le LAN (RFC1918/loopback), donc ce payload est **non fiable** — le clamp frontend
ne protège rien côté serveur. `file_write`/`file_save_as` sont appelés uniquement
par l'éditeur, et son sérialiseur n'émet aucun méta texte/sysEx.

**Statut :** 15 items corrigés (couverts par tests Jest+Vitest), dont **3
CRITIQUES** (2 DoS backend + 1 sauvegarde cassée) et **4 MAJEURS**. Suites :
backend **136 / 1490**, frontend **74 / 1309** vertes ; build Vite OK.

---

## ✅ Corrigés

### Backend — chemin d'écriture non fiable (D1)

Cause racine : `FileManager.saveFile`/`saveFileAs` appellent `writeMidi(midiData)`
**directement**, sans borner ni valider le *contenu* des événements. Correctif
principal : une **validation par-événement au bord** (`file.schemas.js`,
pré-handler) qui rejette proprement tout payload dangereux avant `writeMidi`.

- **CRITIQUE-1 — `deltaTime` non borné ⇒ boucle infinie (gel event-loop + OOM).**
  `writeVarInt(deltaTime ≥ 2³¹)` : le `>> 7` bascule en Int32 négatif, la boucle
  ne termine jamais et fait croître un tableau vers 2³² entrées. Un **seul**
  événement OOM-kill le Pi (`saveFile` est synchrone → tout le thread gèle).
  Corrigé : rejet de tout `deltaTime` hors `[0, 0x0FFFFFFF]` (max VLQ 28-bit).
- **CRITIQUE-2 — flot de métas texte/sysEx ⇒ stall O(n²).** Le writer sérialise
  ces types via `Buffer.concat` par événement (O(long. courante) chacun) : 50 000
  `marker` gèlent le thread ~85 s (mesuré). Corrigé : cap dédié
  `MAX_WRITE_META_EVENTS=5000` (l'éditeur n'en émet aucun → défense DoS pure).
- **MOYEN-3 — `writeMidi` throw une STRING nue** (type inconnu / `deltaTime` négatif)
  → masqué en « Internal server error » + `Command failed: undefined`. Corrigé :
  rejet des types hors de l'ensemble reconnu, en `ValidationError` propre.
- **MOYEN-5 — aucune validation de plage serveur ⇒ `.mid` corrompu stocké tel quel.**
  `writeMidi` masque `& 0xFF` / `0x90 | channel` : `noteNumber:300 → 44` (note
  fausse), `channel:112 → 0x90|112 = 0xF0` (**octet de statut sysEx injecté**,
  désync structurelle). Corrigé : validation `channel 0-15`, `note/velocity/cc/
  value/program/amount 0-127`, `pitchBend −8192..8191`, `setTempo µs∈[1,0xFFFFFF]`,
  entiers requis.
- **MOYEN-4 — `saveFile` écrit le blob AVANT le re-parse, sans nettoyage** ⇒ blob
  orphelin si `parseMidi`/persist throw (contrairement à `handleUpload`). Corrigé :
  `try/catch` autour de parse→persist avec `_safeBlobDelete` (blob non-dédupliqué)
  puis re-throw. `saveFileAs` délègue déjà à `handleUpload` (nettoyé).

Tests : `tests/file-write-schema-validation.test.js` (14 cas, dont les 2 DoS).

### Frontend (D2/D3/D4)

- **C1 (CRITIQUE) — tout fichier avec aftertouch polyphonique était INSAUVEGARDABLE.**
  `MidiEditorMidiWriter` émettait `type:'polyAftertouch'` (+ champ `pressure`),
  inconnus de `midi-file` → `writeMidi` throw → sauvegarde échoue, même sans édition.
  Corrigé : émettre `noteAftertouch` `{noteNumber, amount}` (type/champs valides).
- **M1 (MAJEUR) — aftertouch canal écrit à 0 en silence.** L'étape delta ne
  transférait pas `amount` → `writeUInt8(undefined)=0`. Corrigé : transfert de
  `amount` (canal) et `noteNumber`+`amount` (poly) dans le `events.map`.
- **M1-XSS (MAJEUR) — XSS stocké/partagé via noms d'appareils/routage** dans les
  chips de canal (`MidiEditorRenderer.js:93/95`, seul sink d'éditeur non échappé —
  le popover frère échappe les mêmes noms). Origine : descripteurs matériels +
  DB de routage. Corrigé : `window.escapeHtml(...)`.
- **M1-close (MAJEUR) — `doClose()` non isolé** : un throw dans un `.destroy()`
  précoce sautait le teardown audio (`disposeSynthesizer`), laissant des notes qui
  sonnent, la boucle de tick orpheline, `beforeunload` fuité et `isPlaying=true`
  sur le singleton réutilisé (bouton transport faux à la réouverture). Corrigé :
  chaque étape isolée en try/catch + reset des flags de playback garanti en
  `finally` (même classe que le fix `Application.stop()` B3).
- **M2-kbd (MOYEN) — raccourcis clavier tirent derrière un dialogue / sur un
  `<select>` focus** : Delete supprimait des notes derrière la modale, Espace
  togglait le playback ET bloquait le bouton du dialogue. Corrigé : garde overlay
  appliquée à TOUS les raccourcis + garde de focus élargie (`SELECT`/contentEditable).
- **M3-idempotence (MOYEN) — `setupKeyboardShortcuts`/`setupBeforeUnloadHandler`
  non idempotents** : un `show()` échoué (clavier) ou un `doClose()` throw
  (beforeunload) empilait un 2ᵉ listener sur le singleton. Corrigé : retrait du
  handler existant avant ré-attachement.
- **M2-buckets (MOYEN) — index spatial du piano-roll non borné** : une note à
  `gate` énorme (VLQ 28-bit) s'enregistre dans ~140k buckets → gel du thread à
  l'ouverture (`setSequence`). Corrigé : cap `MAX_BUCKETS_PER_NOTE=4096` par note.
- **MD1 (MOYEN) — tempo quantifié en BPM entier à chaque sauvegarde** : un fichier
  à 100,5 BPM dérivait à 100,0 à **chaque** save (même en éditant un autre canal).
  Corrigé : conserver le `microsecondsPerBeat` source exact à l'extraction et le
  réécrire verbatim pour un tempo non modifié (recompute depuis le BPM sinon).
- **MN1 / L1 (mineurs)** — `clamp` arrondit désormais à l'entier (garantit un `.mid`
  valide, aligné sur le rejet non-entier serveur) ; `esc()` de `MidiEditorInfoModal`
  inclut l'apostrophe (aligné sur le sink frère).

Tests : `tests/frontend/midi-editor-clamp.test.js` (+5 : aftertouch C1/M1, tempo
MD1 préservé/recalculé, arrondi MN1).

---

## 🟠 Ouverts — documentés

- **MD2 (D2)** — ✅ **Corrigé** (suivi 2026-08-09, « combo multi-programme »
  Parts 1-3) : les `programChange` en cours de morceau sont désormais **conservés**
  au round-trip.
  - **Part 2 (fidélité)** — `MidiEditorSequence.convertMidiToSequence` retient
    tous les `programChange` avec leur tick dans `modal.programChangeEvents` ;
    `MidiEditorMidiWriter` les réémet verbatim pour un canal encore multi-programme
    (sinon un seul PC à tick 0). Un changement d'instrument manuel
    (`applyInstrumentToChannel`) purge les PC obsolètes du canal. Canal 9 (batterie)
    n'émet jamais de PC (inchangé).
  - **Part 1 (détection/avertissement)** — `ChannelAnalyzer.analyzeChannel` expose
    `distinctPrograms` / `isMultiProgram` / `crossesFamily` ; `AutoAssigner` remonte
    un `channelWarnings[ch]` (+ log) quand un canal change de **famille GM** en cours
    de morceau (routé vers le programme dominant, timbres secondaires non reproduits
    sur matériel mono-timbral). Badge « PC » sur la puce de canal côté éditeur.
  - **Part 3 (résolution)** — action « Scinder par instrument » dans le popover ⚙
    d'un canal multi-programme : scinde le canal en canaux mono-programme (dominant
    conservé, les autres déplacés vers des canaux libres), que l'auto-routage statique
    existant route ensuite séparément. Limite v1 : les CC/pitch-bend restent sur le
    canal d'origine (seuls notes + programmes sont répartis).
  - Tests : `tests/frontend/midi-editor-program-change.test.js` (19),
    `tests/midi-adaptation.test.js` (+9 : détection + avertissements).
  - **Suivi audit adversarial (2026-08-09)** — deux revues parallèles du combo :
    - **Cohérence `programChangeEvents`** — la clé est le **numéro de canal**, or
      les numéros sont recyclés (déplacement/suppression/scission) et seules 2 des
      ~5 opérations synchronisaient le tableau → des PC obsolètes ressuscitaient
      sur un canal réutilisé (mauvais badge **et** faux `programChange` sauvegardés).
      Corrigé : purge des PC orphelins dans `syncFullSequenceFromPianoRoll` (chokepoint
      universel d'édition de notes), dans `deleteChannel` (seul contournement), et
      filtrage des canaux destination dans `splitChannelByProgram` ; reset ajouté
      dans `doClose`. Tests de non-régression ajoutés.
    - **UI/UX** — le badge et le bouton n'avaient **aucun CSS** (commit `638cb8f`) ;
      la scission ne **confirmait pas** (réorganisation multi-canaux non couverte par
      l'undo du piano-roll) → dialogue de confirmation ajouté ; le libellé « PC »
      (jargon, illisible au toucher) remplacé par « multi » (28 langues) ; sync des
      mutes + reset des instruments de feedback ajoutés après scission.
    - Limites v1 documentées : les CC/pitch-bend restent sur le canal d'origine ;
      la scission n'est pas annulable via Ctrl+Z (mitigée par la confirmation).
- **N1 (D3)** — ✅ **Corrigé** (suivi 2026-08-08) : `disposeSynthesizer` ne
  draine plus le compteur GLOBAL `SoundBankLoadingIndicator` (masquait le spinner
  d'une autre feature) ; un compteur de refs propre à l'éditeur (`editorIndicatorRefs`,
  tenu par `withLoadingIndicator`) est le seul défait au teardown.
- **N2 (D3)** — ✅ **Corrigé** (suivi 2026-08-08) : `setTempo(newTempo, { silent })`
  ; le handler `input` (temps réel) applique le tempo sans toast/log, seul le
  `change` (commit) notifie une fois. Tests : `tests/frontend/midi-editor-tempo-silent.test.js`.
- **N3 (D3)** — ✅ **Corrigé** (suivi 2026-08-08) : le diff de feedback de notes
  est désormais clé par identité musicale (`tick_canal_hauteur`) au lieu de
  l'index de tableau, donc insert/delete ne déclenche plus de feedback audio
  erroné. Tests : `tests/frontend/midi-editor-note-feedback.test.js`.
  **N4** reste ouvert : refresh du bouton undo/redo sauté après paste/delete
  spécialisé (choix historique).
- **MN2/MN3 (D2)** — `programNumber` non clampé côté frontend (le serveur valide
  désormais) ; code mort `defaultGate>0?…:480` et asymétrie note de longueur 0.
- **L2/L3 (D4)** — ✅ **Corrigé** (suivi 2026-08-08) : libellés d'enum fallback
  (`ROUTING_LABELS`/`TYPE_LABELS` → `routingStatus`/`estimated_type`) échappés à
  la construction ; `showConfirmModal` échappe `title`/`message`/`confirmText`/
  `cancelText`/`btn.text`/`btn.value` (`details` reste du HTML intentionnel).
  **L4** reste ouvert : `NaN`/`Infinity` de coordonnées à tailles pathologiques
  (gardé/cosmétique).
- **Smell de câblage** — ✅ **Investigué + corrigé** (suivi 2026-08-08). Confirmé :
  l'éditeur est instancié 2× (singleton autonome + panneau de l'éditeur de boucle
  via `new window.MidiEditorModal`). Le mode boucle **omet délibérément** tous les
  ids de contrôle transport (`headerHtml=''`, `playbackSectionHtml=''`,
  `settingsPopoverHtml=''` — commentés), et les lectures étaient déjà null-safe :
  donc pas de crash ni de doublon d'id. Résiduel fermé : les 6 lectures
  `getElementById` de ces contrôles (play/pause/stop, tempo-input, save-btn,
  preview-source-toggle) sont désormais **scopées au conteneur de l'instance**
  (`this.modal.container?.querySelector`), donc le panneau ne peut plus câbler
  ni piloter les boutons du singleton même si les deux sont ouverts.

---

## Vérifié CORRECT (pour éviter la re-revue)

- **Clamps frontend** tous corrects (note/canal/vélocité/CC/pitchbend/ticks/gate),
  NaN/undefined/∞ → min ; pitch bend signé 14-bit **cohérent de bout en bout**
  (parser centre, éditeur signé, writer clampe signé, `writeMidi` ré-ajoute 0x2000).
- **`syncCCEventsFromEditor`** sûr picker ouvert ou non (l'éditeur CC détient la
  liste complète tous canaux/types) ; **sauvegarde préserve les canaux masqués/mutés**
  (sérialise `fullSequence`, merge invisibles+visibles) ; **appairage note on/off**
  robuste (notes chevauchantes fermées, orphelines récupérées avec warning).
- **Backend** : shape du fil correcte (`tracks:[[…]]`) ; caps count/size + `maxPayload`
  16 Mo appliqués pré-handler ; **BlobStore atomique** (tmp→fsync→rename), refus de
  collision de hash, suppression de l'ancien blob après commit ; **sûreté des
  chemins** (dérivés du hash, jamais du filename) ; `saveFile` sans `await` interne
  (pas de course intra-appel) ; `setTempo=0` gardé (pas de div/0).
- **Cycle de vie** : teardown du renderer canvas complet (rAF annulé, listeners +
  menu contextuel retirés) ; rAF du curseur transport one-shot et annulé partout ;
  ResizeObserver déconnecté ; warm-up synth re-checké/annulé ; clipboard sans
  référence partagée ; paste préserve les notes de canaux hors-vue et n'injecte pas
  de tick négatif / note hors plage.
- **Rendu/XSS** : DPR correct (backing store ×dpr, `setTransform`) ; `drawOne`
  clampe largeur/plage ; sinks méta/lyrics/filename/instrument échappés
  (`escapeHtml`) ; chips events en délégation `dataset`+`parseInt` ; `ch.instrument`
  = nom GM statique (title attr sûr).
