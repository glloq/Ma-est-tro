# MidiMind SysEx Block 1 - Guide Développeur Instrument

## Vue d'ensemble
Le Block 1 permet l'identification custom d'un instrument DIY via le protocole SysEx 0x7D.

**Protocole**: Custom SysEx (Educational/Development use)  
**Manufacturer ID**: 0x00 (MidiMind)  
**Block ID**: 0x01 (Identification)

---

## 1. Requête d'Identification

### Format attendu par l'instrument
```
F0 7D 00 01 00 F7
```

### Détail des octets
| Octet | Valeur | Description |
|-------|--------|-------------|
| 0 | `F0` | Start SysEx |
| 1 | `7D` | Custom SysEx (Educational/Development) |
| 2 | `00` | MidiMind Manufacturer ID |
| 3 | `01` | Block 1 (Identification) |
| 4 | `00` | Request flag (00=requête, 01=réponse) |
| 5 | `F7` | End SysEx |

**Taille**: 6 octets

---

## 2. Réponse de l'Instrument

### Format complet (52 octets)
```
F0 7D 00 01 01 <version> <deviceId[5]> <name[32]> <firmware[3]> <features[5]> F7
```

### Table des champs

| Offset | Taille | Champ | Type | Description |
|--------|--------|-------|------|-------------|
| 0 | 1 | Start | `F0` | Début SysEx |
| 1 | 1 | Protocol | `7D` | Custom SysEx |
| 2 | 1 | Manufacturer | `00` | MidiMind |
| 3 | 1 | Block ID | `01` | Identification |
| 4 | 1 | Reply Flag | `01` | Réponse (toujours 01) |
| 5 | 1 | Block Version | `uint8` | Version du format (01 actuellement) |
| 6-10 | 5 | Device ID | `7bit[5]` | ID unique 32-bit (encodé 7-bit) |
| 11-42 | 32 | Device Name | `string` | Nom de l'instrument (null-terminated, ASCII) |
| 43-45 | 3 | Firmware | `uint8[3]` | Version firmware [major, minor, patch] |
| 46-50 | 5 | Feature Flags | `7bit[5]` | Bitmask 32-bit features (encodé 7-bit) |
| 51 | 1 | End | `F7` | Fin SysEx |

**Taille totale**: 52 octets (fixe)

---

## 3. Encodage 7-bit (32-bit → 5 octets)

### Principe
- MIDI SysEx requiert MSB=0 (valeurs 0-127)
- Un uint32 nécessite 5 octets en encodage 7-bit
- Seuls les 32 bits de poids faible sont utilisés (bits 28-31 sur le 5ème octet)

### Encodage côté instrument
```c
void encode32BitTo7Bit(uint32_t value, uint8_t* output) {
    output[0] = (value      ) & 0x7F;  // Bits 0-6
    output[1] = (value >>  7) & 0x7F;  // Bits 7-13
    output[2] = (value >> 14) & 0x7F;  // Bits 14-20
    output[3] = (value >> 21) & 0x7F;  // Bits 21-27
    output[4] = (value >> 28) & 0x07;  // Bits 28-31 (seulement 4 bits)
}
```

### Décodage côté MidiMind (référence)
```cpp
uint32_t value = 0;
value |= (data[0] & 0x7F);
value |= (data[1] & 0x7F) << 7;
value |= (data[2] & 0x7F) << 14;
value |= (data[3] & 0x7F) << 21;
value |= (data[4] & 0x07) << 28;  // Seulement 3 bits utiles
```

---

## 4. Feature Flags (Bitmask 32-bit)

### Bits définis
| Bit | Nom | Description |
|-----|-----|-------------|
| 0 | `NOTE_MAP` | Supporte Block 2 (Note Mapping) |
| 1 | `VELOCITY_CURVES` | Supporte Block 3 (futur) |
| 2 | `CC_MAPPING` | Supporte Block 4 (futur) |
| 3-31 | *Réservés* | Usage futur |

### Exemples
```c
// Instrument supportant seulement Note Map
uint32_t features = 0x00000001;

// Instrument supportant Note Map + Velocity Curves
uint32_t features = 0x00000003;

// Pas de features avancées
uint32_t features = 0x00000000;
```

---

## 5. Device Name (32 octets)

### Règles
- **Maximum**: 32 caractères
- **Encodage**: ASCII printable (32-126)
- **Terminaison**: NULL (`0x00`)
- **Padding**: Remplir avec `0x00` jusqu'à 32 octets

### Exemple Arduino
```c
void encodeDeviceName(const char* name, uint8_t* output) {
    int len = strlen(name);
    if (len > 32) len = 32;
    
    // Copier le nom
    memcpy(output, name, len);
    
    // Padding avec 0x00
    for (int i = len; i < 32; i++) {
        output[i] = 0x00;
    }
}
```

---

## 6. Exemple Complet - Arduino/Teensy

```c
// Configuration de l'instrument
#define DEVICE_ID       0x12345678
#define DEVICE_NAME     "MyDrumKit"
#define FW_MAJOR        1
#define FW_MINOR        0
#define FW_PATCH        2
#define FEATURES        0x00000001  // Supporte Note Map

void handleIdentityRequest() {
    uint8_t response[52];
    int pos = 0;
    
    // Header
    response[pos++] = 0xF0;  // Start
    response[pos++] = 0x7D;  // Custom SysEx
    response[pos++] = 0x00;  // MidiMind Manufacturer
    response[pos++] = 0x01;  // Block 1
    response[pos++] = 0x01;  // Reply flag
    
    // Block Version
    response[pos++] = 0x01;
    
    // Device ID (32-bit → 5 octets 7-bit)
    encode32BitTo7Bit(DEVICE_ID, &response[pos]);
    pos += 5;
    
    // Device Name (32 octets)
    encodeDeviceName(DEVICE_NAME, &response[pos]);
    pos += 32;
    
    // Firmware version
    response[pos++] = FW_MAJOR;
    response[pos++] = FW_MINOR;
    response[pos++] = FW_PATCH;
    
    // Feature flags (32-bit → 5 octets 7-bit)
    encode32BitTo7Bit(FEATURES, &response[pos]);
    pos += 5;
    
    // End
    response[pos++] = 0xF7;
    
    // Envoyer via MIDI
    usbMIDI.sendSysEx(52, response);
}

void checkSysExRequest() {
    if (usbMIDI.read() && usbMIDI.getType() == usbMIDI.SystemExclusive) {
        uint8_t* data = usbMIDI.getSysExArray();
        int length = usbMIDI.getSysExArrayLength();
        
        // Vérifier si c'est une requête Block 1
        if (length == 6 &&
            data[0] == 0xF0 &&
            data[1] == 0x7D &&
            data[2] == 0x00 &&
            data[3] == 0x01 &&
            data[4] == 0x00 &&
            data[5] == 0xF7) {
            
            handleIdentityRequest();
        }
    }
}
```

---

## 7. Test Minimal

### Réponse valide minimale
```
F0 7D 00 01 01  // Header + Reply
01              // Block version
01 00 00 00 00  // Device ID = 1
54 65 73 74 00  // "Test" + padding (28 x 0x00)
00 00 00 00 00 00 00 00 00 00 00 00 00 00
00 00 00 00 00 00 00 00 00 00 00 00 00
01 00 00        // Firmware 1.0.0
01 00 00 00 00  // Features = 0x01
F7              // End
```

### Valeurs décodées
```
Block Version: 1
Device ID: 0x00000001
Device Name: "Test"
Firmware: 1.0.0
Features: 0x00000001 (Note Map supporté)
```

---

## 8. Checklist Implémentation

- [ ] Détection requête `F0 7D 00 01 00 F7`
- [ ] Header réponse correct `F0 7D 00 01 01`
- [ ] Block version = `0x01`
- [ ] Device ID encodé 7-bit (5 octets)
- [ ] Device Name padded à 32 octets avec NULL
- [ ] Firmware version (3 octets)
- [ ] Feature flags encodé 7-bit (5 octets)
- [ ] Fin avec `F7`
- [ ] Taille totale = 52 octets exactement
