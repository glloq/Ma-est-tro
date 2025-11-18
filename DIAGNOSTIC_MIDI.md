# 🔍 Diagnostic du problème de canaux MIDI

Ce document explique comment diagnostiquer pourquoi les fichiers `.midi` n'affichent qu'un seul canal dans l'éditeur.

## 📋 Prérequis

Vous devez être **sur le Raspberry Pi** où tourne le serveur MidiMind.

## 🚀 Procédure de diagnostic

### Étape 1 : Vérifier que le serveur fonctionne

```bash
# Sur le Raspberry Pi
cd ~/Ma-est-tro  # ou le chemin où est installé MidiMind

# Vérifier si le serveur est en cours
pm2 list
# OU
ps aux | grep "node.*server"
```

### Étape 2 : Trouver la base de données

La base de données devrait être dans `./data/midimind.db`. Vérifiez :

```bash
ls -lh ./data/midimind.db
```

Si le fichier n'existe pas, cherchez-le :

```bash
find ~ -name "midimind.db" 2>/dev/null
```

### Étape 3 : Lister les fichiers MIDI dans la base

```bash
# Avec Python (recommandé - aucune dépendance)
python3 extract-midi.py list
```

Vous devriez voir votre fichier "AnyConv.com__Under The Sea.midi" (ID 19).

### Étape 4 : Extraire le fichier MIDI

```bash
# Extraire le fichier ID 19
python3 extract-midi.py 19
```

Cela va créer le fichier `AnyConv.com__Under The Sea.midi` dans le répertoire courant.

### Étape 5 : Tester le parsing

```bash
# Comparer les deux parsers MIDI
node compare-parsers.js "AnyConv.com__Under The Sea.midi"
```

## 📊 Interpréter les résultats

Le script `compare-parsers.js` va afficher quelque chose comme :

### Scénario A : CustomParser détecte PLUS de canaux ✅

```
📦 Parser 1: midi-file (npm package)
   Channels detected: [0]

🔧 Parser 2: CustomMidiParser (custom implementation)
   Channels detected: [0, 1, 2, 3, 4, 9]

💡 VERDICT:
❌ CustomParser detected MORE channels than midi-file!
   → midi-file has a bug and is missing channel information
   → RECOMMENDATION: Use CustomMidiParser instead
```

**Action** : Le bug est confirmé dans `midi-file`. Je vais intégrer `CustomMidiParser` dans le système.

### Scénario B : Les deux détectent le même nombre (1 canal) ⚠️

```
📦 Parser 1: midi-file (npm package)
   Channels detected: [0]

🔧 Parser 2: CustomMidiParser (custom implementation)
   Channels detected: [0]

💡 VERDICT:
⚠️  Both parsers only detected 1 channel(s)
   → The MIDI file itself may only have one channel
```

**Action** : Le fichier MIDI lui-même n'a vraiment qu'un seul canal. Ce n'est pas un bug de parsing.

### Scénario C : midi-file détecte PLUS de canaux ⚠️

**Action** : Notre CustomParser a un bug (peu probable). Je devrai l'ajuster.

## 🛠️ Solutions possibles

### Si CustomParser fonctionne mieux

Je vais modifier `FileManager.js` pour utiliser `CustomMidiParser` au lieu de `midi-file` :

```javascript
// Remplacer
import { parseMidi } from 'midi-file';
const midi = parseMidi(buffer);

// Par
import CustomMidiParser from '../utils/CustomMidiParser.js';
const parser = new CustomMidiParser();
const midi = parser.parse(buffer);
```

### Si le fichier n'a vraiment qu'un canal

Le fichier `.midi` a peut-être été mal exporté ou converti. Il faudrait vérifier avec un autre logiciel MIDI (MuseScore, GarageBand, etc.) pour confirmer.

## 📝 Rapport à partager

Une fois le diagnostic terminé, partagez-moi la sortie complète de :

```bash
node compare-parsers.js "AnyConv.com__Under The Sea.midi"
```

Cela me permettra d'appliquer la correction appropriée immédiatement.

## ❓ Problèmes courants

### "Database not found"

La base de données n'est pas au bon endroit. Modifiez `DB_PATH` dans `extract-midi.py` :

```python
DB_PATH = '/chemin/vers/votre/midimind.db'
```

### "better-sqlite3 not found" (script Node.js)

Utilisez le script Python à la place :

```bash
python3 extract-midi.py 19
```

### "node: command not found" (compare-parsers.js)

Node.js n'est pas installé. Installez-le :

```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
```

Puis installez les dépendances du projet :

```bash
cd ~/Ma-est-tro
npm install --force  # Ignorera les erreurs de compilation de 'midi'
```
