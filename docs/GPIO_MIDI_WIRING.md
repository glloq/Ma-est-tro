# MIDI Serie via GPIO - Guide de cablage

Ce guide explique comment connecter des instruments MIDI aux broches GPIO du Raspberry Pi en utilisant le protocole MIDI serie standard (31250 baud, 8N1).

## Sommaire

1. [HATs MIDI commerciaux (Plug & Play)](#hats-midi-commerciaux-plug--play)
2. [Compatibilite Raspberry Pi](#compatibilite-raspberry-pi)
3. [Circuit MIDI OUT (DIY)](#circuit-midi-out-gpio-tx-vers-din-5-broches)
4. [Circuit MIDI IN (DIY)](#circuit-midi-in-din-5-broches-vers-gpio-rx)
5. [Configuration du Raspberry Pi](#configuration-du-raspberry-pi)
6. [Correspondance UARTs par modele](#correspondance-uarts-par-modele)
7. [Liste des composants (DIY)](#liste-des-composants)
8. [Depannage](#depannage)

---

## HATs MIDI commerciaux (Plug & Play)

Si vous ne souhaitez pas souder de composants, plusieurs HATs MIDI du commerce se branchent directement sur le connecteur GPIO 40 broches du Raspberry Pi. Ils integrent les circuits d'optoisolation et de mise en forme du signal MIDI.

### Blokas Pimidi (recommande pour multi-ports)

```
┌──────────────────────────────────────┐
│            Blokas Pimidi             │
│                                      │
│   MIDI IN 1  ○────┐                 │
│   MIDI OUT 1 ○────┤  Connecteur     │
│   MIDI IN 2  ○────┤  GPIO 40 pins   │
│   MIDI OUT 2 ○────┘  (I2C + 2 GPIO) │
│                                      │
│   Empilable : jusqu'a 4 HATs        │
│   = 8 IN + 8 OUT                    │
└──────────────────────────────────────┘
```

| Caracteristique | Detail |
|-----------------|--------|
| **Ports** | 2x MIDI IN + 2x MIDI OUT (DIN-5) par HAT |
| **Empilable** | Jusqu'a 4 HATs = 8 IN / 8 OUT |
| **Interface** | I2C + 2 GPIO (laisse les autres GPIO libres) |
| **Latence** | 1.28ms (loopback) |
| **Compatibilite** | Pi 3, Pi 4, Pi 5 |
| **Connecteurs** | DIN-5 standard |
| **API** | Python (pimidipy) |
| **Prix** | ~99 EUR |
| **Site** | [blokas.io/pimidi](https://blokas.io/pimidi/) |

**Avantages** : Duplicateur GPIO 40 broches integre (empilable avec d'autres HATs), latence tres faible, API Python, jusqu'a 8x8 ports.

**Installation** :
```bash
# Installer le driver Pimidi
curl https://blokas.io/pimidi/install.sh | sh

# Les ports apparaissent comme des ports ALSA MIDI standards
aconnect -l
```

> **Note** : Le Pimidi utilise I2C et non UART. Il n'utilise pas `/dev/ttyAMA*` mais apparait comme un peripherique MIDI ALSA. Ma-est-tro le detectera comme un port MIDI systeme standard (pas via le module Serial MIDI GPIO).

---

### Blokas Pisound (MIDI + Audio)

```
┌──────────────────────────────────────┐
│           Blokas Pisound             │
│                                      │
│   Audio IN  (jack 6.35mm stereo)     │
│   Audio OUT (jack 6.35mm stereo)     │
│   MIDI IN   (DIN-5)                 │
│   MIDI OUT  (DIN-5)                 │
│   Bouton programmable                │
│   Gain + Volume pots                 │
│                                      │
│   DAC/ADC Burr-Brown 192kHz 24-bit   │
└──────────────────────────────────────┘
```

| Caracteristique | Detail |
|-----------------|--------|
| **Ports MIDI** | 1x MIDI IN + 1x MIDI OUT (DIN-5) |
| **Audio** | Stereo IN/OUT, 192kHz 24-bit, Burr-Brown DAC/ADC |
| **Controles** | Gain, Volume, bouton programmable |
| **Compatibilite** | Pi 1B+, Pi 2, Pi 3, Pi 4, Pi Zero |
| **Prix** | ~89 USD |
| **Site** | [blokas.io/pisound](https://blokas.io/pisound/) |

**Avantages** : Solution tout-en-un MIDI + Audio haute qualite, ideal si vous avez aussi besoin de sorties audio.

> **Note** : Le Pisound n'est pas encore compatible Pi 5. Pour Pi 5, voir le **Pisound Micro** (~69 EUR) sur [blokas.io/pisound-micro](https://blokas.io/pisound-micro/).

---

### Domoshop Slim MIDI Hat

```
┌──────────────────────────────────────┐
│        Domoshop Slim MIDI Hat        │
│                                      │
│   MIDI IN  (mini-jack 3.5mm TRS)     │
│   MIDI OUT (mini-jack 3.5mm TRS)     │
│                                      │
│   Connecte sur UART0 (GPIO14/15)     │
│   Buffer 5V integre                  │
│                                      │
│   v1.2+ : 16 I/O via MCP23017       │
└──────────────────────────────────────┘
```

| Caracteristique | Detail |
|-----------------|--------|
| **Ports** | 1x MIDI IN + 1x MIDI OUT (mini-jack TRS 3.5mm, adaptateurs DIN-5 inclus) |
| **Interface** | UART0 direct (GPIO14 TX, GPIO15 RX) |
| **Buffer** | 5V MIDI standard (meilleure compatibilite) |
| **I/O (v1.2+)** | 16 GPIO supplementaires via MCP23017 (boutons, encodeurs, LEDs) |
| **Compatibilite** | Pi Zero, Pi 3, Pi 4, Pi 5 |
| **Prix** | ~25-36 EUR |
| **Site** | [domoshop.eu](https://domoshop.eu/collections/raspberry-pi-midi) |

**Avantages** : Compact, abordable, connecteurs mini-jack (gain de place), buffer 5V pour compatibilite maximale, GPIO supplementaires sur v1.2+.

> **Note** : Le Slim MIDI Hat utilise UART0 (`/dev/ttyAMA0`). Il est compatible avec le module Serial MIDI GPIO de Ma-est-tro. Activez-le dans les reglages et le port `/dev/ttyAMA0` sera detecte automatiquement.

**Installation** :
```bash
# /boot/config.txt (ou /boot/firmware/config.txt)
enable_uart=1
dtoverlay=disable-bt      # Libere UART0 pour le MIDI

# Permissions
sudo usermod -aG dialout $USER
sudo reboot
```

---

### OSA Electronics MIDI Board

| Caracteristique | Detail |
|-----------------|--------|
| **Ports** | 1x MIDI IN + 1x MIDI OUT (DIN-5) |
| **Interface** | UART0 direct (GPIO14/15) |
| **Compatibilite** | Pi A+, B+, Pi 2, Pi 3, Pi 4, Pi 5 |
| **Zynthian** | Compatible |
| **Site** | [osaelectronics.com](https://www.osaelectronics.com/product/midi-board-for-raspberry-pi/) |

**Avantages** : Simple, connecteurs DIN-5 standard, documentation complete avec guide de configuration.

> **Note** : Utilise UART0 comme le Domoshop. Compatible avec le module Serial MIDI de Ma-est-tro.

---

### Tableau comparatif

| HAT | Ports MIDI | Audio | Empilable | Interface | Pi 5 | Prix |
|-----|-----------|-------|-----------|-----------|------|------|
| **Pimidi** | 2 IN + 2 OUT | Non | Oui (x4 = 8x8) | I2C | Oui | ~99 EUR |
| **Pisound** | 1 IN + 1 OUT | Oui (192kHz) | Non | SPI | Non* | ~89 USD |
| **Slim MIDI Hat** | 1 IN + 1 OUT | Non | Non | UART | Oui | ~25-36 EUR |
| **OSA MIDI Board** | 1 IN + 1 OUT | Non | Non | UART | Oui | ~20-30 EUR |

\* Pisound Micro disponible pour Pi 5 (~69 EUR)

### Compatibilite avec Ma-est-tro

| HAT | Detection | Module utilise |
|-----|-----------|----------------|
| **Pimidi** | Automatique (ALSA MIDI) | Ports MIDI systeme (comme USB) |
| **Pisound** | Automatique (ALSA MIDI) | Ports MIDI systeme (comme USB) |
| **Slim MIDI Hat** | Via `/dev/ttyAMA0` | **Serial MIDI GPIO** (activer dans reglages) |
| **OSA MIDI Board** | Via `/dev/ttyAMA0` | **Serial MIDI GPIO** (activer dans reglages) |

> Les HATs bases sur I2C/SPI (Pimidi, Pisound) apparaissent comme des ports MIDI standards et sont detectes automatiquement par Ma-est-tro sans activer l'option Serial MIDI GPIO. Les HATs bases sur UART (Domoshop, OSA) necessitent l'activation de l'option Serial MIDI GPIO dans les reglages.

---

## Fabrication DIY (Do It Yourself)

Si vous preferez construire votre propre circuit MIDI, les sections suivantes detaillent le cablage composant par composant.

---

## Compatibilite Raspberry Pi

| Modele | UARTs disponibles | Notes |
|--------|-------------------|-------|
| **Pi 3B/3B+** | 1 (mini UART partage avec BT) | Il faut desactiver le Bluetooth pour liberer UART0 |
| **Pi 4B** | Jusqu'a 6 (UART0 + UART2-5 via overlays) | Recommande - meilleur support multi-UART |
| **Pi 5** | Jusqu'a 5 UARTs natifs | Meilleur DMA, timing MIDI precis |
| **Pi Zero 2W** | 1 (mini UART partage avec BT) | Comme le Pi 3, desactiver BT pour UART0 |

---

## Circuit MIDI OUT (GPIO TX vers DIN 5 broches)

Le circuit MIDI OUT envoie les donnees du Raspberry Pi vers un instrument MIDI.

### Schema

```
                    DIN-5 Female (vue de face, cote soudure)
                    ┌─────────────┐
                    │  5       4  │
                    │    2        │
                    │  1       3  │
                    └─────────────┘

Raspberry Pi                              DIN-5 Female
─────────────                             ────────────

GPIO TX ──── [220 ohm] ─────────────────── Pin 5 (Data)

3.3V ─────── [220 ohm] ─────────────────── Pin 4 (Source +5V via resistances)

GND ────────────────────────────────────── Pin 2 (Shield/GND)
```

### Explication

- La specification MIDI utilise une boucle de courant. Le TX du Pi commute le courant a travers les resistances.
- Les resistances de 220 ohm limitent le courant a environ 5mA (norme MIDI).
- **Important** : Le Pi fonctionne en 3.3V. La plupart des recepteurs MIDI modernes acceptent cette tension, mais certains instruments anciens (5V) peuvent necessiter un buffer de niveau (74HCT04 ou SN7407).

### Schema avec buffer de niveau (optionnel, pour instruments 5V)

```
GPIO TX ──── [220 ohm] ── 74HCT04 ── [220 ohm] ── DIN Pin 5
5V ───────── [220 ohm] ──────────────────────────── DIN Pin 4
GND ─────────────────────────────────────────────── DIN Pin 2
```

---

## Circuit MIDI IN (DIN 5 broches vers GPIO RX)

Le circuit MIDI IN recoit les donnees d'un instrument MIDI vers le Raspberry Pi. Un optocoupler (6N138) est **obligatoire** pour isoler electriquement les deux appareils.

### Schema

```
DIN-5 Female                  6N138 Optocoupler              Raspberry Pi
────────────                  ─────────────────              ─────────────

                              ┌────────┐
Pin 5 ── [220 ohm] ─────── 2 │ Anode  │
                              │        │
Pin 4 ───────────────────── 3 │Cathode │
                              │        │
                            5 │ GND    │──────────── GND
                              │        │
3.3V ─────── [470 ohm] ─── 8 │ Vcc    │
                              │        │
3.3V ─── [10k ohm] ──┬──── 6 │ Output │──────────── GPIO RX
                      │       │        │
                      │     7 │ Vb     │
                      │       └────────┘
                      │
                      └──── vers GPIO RX
```

### Brochage du 6N138

```
        ┌────────┐
    1 ──│ NC     │── 8  Vcc (3.3V via 470 ohm)
    2 ──│ Anode  │── 7  Vb (laisser flottant ou connecter a Vcc)
    3 ──│Cathode │── 6  Output (vers GPIO RX + pull-up 10k)
    4 ──│ NC     │── 5  GND
        └────────┘
```

### Explication

- L'optocoupler isole electriquement l'emetteur MIDI du Raspberry Pi (protection contre les boucles de masse).
- La resistance de 220 ohm sur l'anode (pin 2) limite le courant de la LED interne.
- Le pull-up de 10k ohm sur la sortie (pin 6) assure un signal propre pour le GPIO RX.
- La diode 1N4148 (optionnelle) en anti-parallele sur l'anode peut proteger contre les inversions de polarite.

### Version complete avec protection

```
DIN Pin 4 ──── ┐
               1N4148 (cathode vers pin 4)
DIN Pin 5 ── [220 ohm] ──┤
                          ├── 6N138 Pin 2 (Anode)
DIN Pin 4 ────────────────┘── 6N138 Pin 3 (Cathode)

3.3V ── [470 ohm] ── 6N138 Pin 8 (Vcc)
3.3V ── [10k ohm] ──┬── 6N138 Pin 6 (Output) ── GPIO RX
                     │
6N138 Pin 5 (GND) ── GND
```

---

## Configuration du Raspberry Pi

### Raspberry Pi 3B/3B+

```bash
# /boot/config.txt (ou /boot/firmware/config.txt sur les OS recents)

# Desactiver le Bluetooth pour liberer UART0 (PL011) sur GPIO14/15
dtoverlay=disable-bt

# Desactiver le service Bluetooth systemd
sudo systemctl disable hciuart
```

Apres modification, un seul UART est disponible : `/dev/ttyAMA0` (GPIO14 TX, GPIO15 RX).

### Raspberry Pi 4B (recommande)

```bash
# /boot/config.txt

# Option 1 : Desactiver le Bluetooth pour liberer UART0
dtoverlay=disable-bt

# Option 2 : Garder le Bluetooth et utiliser les UARTs supplementaires
# (UART0 reste utilise par BT, mais UART2-5 sont disponibles)

# Activer des UARTs supplementaires (choisir selon les GPIO disponibles) :
dtoverlay=uart2    # UART2 sur GPIO0 (TX) / GPIO1 (RX)
dtoverlay=uart3    # UART3 sur GPIO4 (TX) / GPIO5 (RX)
dtoverlay=uart4    # UART4 sur GPIO8 (TX) / GPIO9 (RX)
dtoverlay=uart5    # UART5 sur GPIO12 (TX) / GPIO13 (RX)
```

### Raspberry Pi 5

```bash
# /boot/firmware/config.txt

# Le Pi 5 utilise un chipset different (RP1)
# UART0 est sur GPIO14/15 par defaut
dtoverlay=uart0-pi5

# UARTs supplementaires
dtoverlay=uart2-pi5    # GPIO0/1
dtoverlay=uart3-pi5    # GPIO4/5
dtoverlay=uart4-pi5    # GPIO8/9
```

### Permissions utilisateur (tous modeles)

```bash
# Ajouter l'utilisateur au groupe dialout pour acceder aux ports serie
sudo usermod -aG dialout $USER

# Redemarrer pour appliquer
sudo reboot
```

### Verifier la configuration

```bash
# Lister les ports serie disponibles
ls -la /dev/ttyAMA*

# Tester la vitesse 31250 baud
stty -F /dev/ttyAMA0 31250

# Verifier les overlays actifs
dtoverlay -l
```

---

## Correspondance UARTs par modele

### Raspberry Pi 4B

| UART | Device | GPIO TX | GPIO RX | Overlay |
|------|--------|---------|---------|---------|
| 0 | /dev/ttyAMA0 | GPIO14 (pin 8) | GPIO15 (pin 10) | `disable-bt` ou par defaut |
| 2 | /dev/ttyAMA1 | GPIO0 (pin 27) | GPIO1 (pin 28) | `uart2` |
| 3 | /dev/ttyAMA2 | GPIO4 (pin 7) | GPIO5 (pin 29) | `uart3` |
| 4 | /dev/ttyAMA3 | GPIO8 (pin 24) | GPIO9 (pin 21) | `uart4` |
| 5 | /dev/ttyAMA4 | GPIO12 (pin 32) | GPIO13 (pin 33) | `uart5` |

### Raspberry Pi 3B/3B+

| UART | Device | GPIO TX | GPIO RX | Notes |
|------|--------|---------|---------|-------|
| 0 (PL011) | /dev/ttyAMA0 | GPIO14 (pin 8) | GPIO15 (pin 10) | Necessite `disable-bt` |
| 1 (mini) | /dev/ttyS0 | GPIO14 (pin 8) | GPIO15 (pin 10) | Par defaut (instable a 31250 baud) |

> **Attention** : Le mini UART du Pi 3 est lie a la frequence du CPU et peut etre instable a 31250 baud. Utilisez toujours le PL011 (UART0) avec `dtoverlay=disable-bt`.

### Raspberry Pi 5

| UART | Device | GPIO TX | GPIO RX | Overlay |
|------|--------|---------|---------|---------|
| 0 | /dev/ttyAMA0 | GPIO14 (pin 8) | GPIO15 (pin 10) | `uart0-pi5` |
| 2 | /dev/ttyAMA1 | GPIO0 (pin 27) | GPIO1 (pin 28) | `uart2-pi5` |
| 3 | /dev/ttyAMA2 | GPIO4 (pin 7) | GPIO5 (pin 29) | `uart3-pi5` |
| 4 | /dev/ttyAMA3 | GPIO8 (pin 24) | GPIO9 (pin 21) | `uart4-pi5` |

---

## Liste des composants

### Pour un port MIDI OUT :

| Composant | Quantite | Ref |
|-----------|----------|-----|
| Resistance 220 ohm 1/4W | 2 | - |
| Connecteur DIN-5 femelle | 1 | Chassis ou cable |

### Pour un port MIDI IN :

| Composant | Quantite | Ref |
|-----------|----------|-----|
| Optocoupler 6N138 | 1 | (ou 6N139, H11L1) |
| Resistance 220 ohm 1/4W | 1 | Protection LED |
| Resistance 470 ohm 1/4W | 1 | Alimentation Vcc |
| Resistance 10k ohm 1/4W | 1 | Pull-up sortie |
| Diode 1N4148 | 1 | Protection (optionnel) |
| Connecteur DIN-5 femelle | 1 | Chassis ou cable |

### Pour un port MIDI IN + OUT complet :

Combiner les deux listes ci-dessus. Les composants sont peu couteux (<2 EUR par port).

### Alternatives commerciales (plug & play)

Voir la section [HATs MIDI commerciaux](#hats-midi-commerciaux-plug--play) en debut de document pour un comparatif complet des solutions du commerce (Pimidi, Pisound, Slim MIDI Hat, OSA MIDI Board).

---

## Depannage

### Le port ne s'ouvre pas

```
Permission denied for /dev/ttyAMA0
```
Solution : `sudo usermod -aG dialout $USER && sudo reboot`

### Le port n'est pas detecte

```
Serial device not found: /dev/ttyAMA0
```
Solution : Verifier `/boot/config.txt` et les overlays UART. Redemarrer apres modification.

### Le 31250 baud n'est pas supporte

Le mini UART (`ttyS0`) du Pi 3 peut ne pas supporter 31250 baud de maniere fiable.
Solution : Utiliser le PL011 (`ttyAMA0`) avec `dtoverlay=disable-bt`.

### Les notes sont corrompues ou decalees

- Verifier le cablage (inversion TX/RX)
- Verifier la masse commune entre le Pi et l'instrument
- Verifier que le 6N138 est correctement alimente (pin 8 = Vcc)

### Le Bluetooth ne fonctionne plus

Normal si `dtoverlay=disable-bt` est active. Sur Pi 4, utiliser UART2-5 a la place pour garder le Bluetooth.
