# MidiMind SysEx Protocol - Instrument Developer Guide

## Overview

The MidiMind SysEx protocol enables custom identification and automatic configuration of DIY instruments via the SysEx 0x7D protocol. It supports both single-instrument devices and multi-instrument controllers.

**Protocol**: Custom SysEx (Educational/Development use)
**Manufacturer ID**: 0x00 (MidiMind)

### Block Summary

| Block | ID | Name | Purpose | Status |
|-------|----|------|---------|--------|
| 1 | `0x01` | Device Identity | Device identification (ID, name, firmware, features) | Implemented |
| 2 | `0x02` | Note Mapping | Note map configuration | Reserved |
| 3 | `0x03` | Velocity Curves | Velocity curve configuration | Reserved |
| 4 | `0x04` | CC Mapping | CC mapping configuration | Reserved |
| 5 | `0x05` | Instrument Descriptor | Multi-instrument discovery (channels, types) | New |
| 6 | `0x06` | Instrument Capabilities | Per-instrument detailed capabilities | New |
| 7 | `0x07` | String Instrument Config | String instrument physical config | New |

### Common Header Format

All MidiMind SysEx messages share this header structure:
```
F0 7D 00 <block_id> <direction> [<data>...] F7
```
- `F0` : SysEx start
- `7D` : Custom SysEx (Educational/Development)
- `00` : MidiMind Manufacturer ID
- `<block_id>` : Block number (01-07)
- `<direction>` : 00=request, 01=response

---

## 1. Identity Request

### Format expected by the instrument
```
F0 7D 00 01 00 F7
```

### Byte breakdown
| Byte | Value | Description |
|------|-------|-------------|
| 0 | `F0` | Start SysEx |
| 1 | `7D` | Custom SysEx (Educational/Development) |
| 2 | `00` | MidiMind Manufacturer ID |
| 3 | `01` | Block 1 (Identification) |
| 4 | `00` | Request flag (00=request, 01=response) |
| 5 | `F7` | End SysEx |

**Size**: 6 bytes

---

## 2. Instrument Response

### Full format (52 bytes)
```
F0 7D 00 01 01 <version> <deviceId[5]> <name[32]> <firmware[3]> <features[5]> F7
```

### Field table

| Offset | Size | Field | Type | Description |
|--------|------|-------|------|-------------|
| 0 | 1 | Start | `F0` | SysEx start |
| 1 | 1 | Protocol | `7D` | Custom SysEx |
| 2 | 1 | Manufacturer | `00` | MidiMind |
| 3 | 1 | Block ID | `01` | Identification |
| 4 | 1 | Reply Flag | `01` | Response (always 01) |
| 5 | 1 | Block Version | `uint8` | Format version (currently 01) |
| 6-10 | 5 | Device ID | `7bit[5]` | 32-bit unique ID (7-bit encoded) |
| 11-42 | 32 | Device Name | `string` | Instrument name (null-terminated, ASCII) |
| 43-45 | 3 | Firmware | `uint8[3]` | Firmware version [major, minor, patch] |
| 46-50 | 5 | Feature Flags | `7bit[5]` | 32-bit feature bitmask (7-bit encoded) |
| 51 | 1 | End | `F7` | SysEx end |

**Total size**: 52 bytes (fixed)

---

## 3. 7-bit Encoding (32-bit → 5 bytes)

### Principle
- MIDI SysEx requires MSB=0 (values 0-127)
- A uint32 requires 5 bytes in 7-bit encoding
- Only the lower 32 bits are used (bits 28-31 on the 5th byte)

### Encoding (instrument side)
```c
void encode32BitTo7Bit(uint32_t value, uint8_t* output) {
    output[0] = (value      ) & 0x7F;  // Bits 0-6
    output[1] = (value >>  7) & 0x7F;  // Bits 7-13
    output[2] = (value >> 14) & 0x7F;  // Bits 14-20
    output[3] = (value >> 21) & 0x7F;  // Bits 21-27
    output[4] = (value >> 28) & 0x07;  // Bits 28-31 (only 4 bits)
}
```

### Decoding (MidiMind side - reference)
```cpp
uint32_t value = 0;
value |= (data[0] & 0x7F);
value |= (data[1] & 0x7F) << 7;
value |= (data[2] & 0x7F) << 14;
value |= (data[3] & 0x7F) << 21;
value |= (data[4] & 0x07) << 28;  // Only 3 useful bits
```

---

## 4. Feature Flags (32-bit Bitmask)

### Defined bits
| Bit | Name | Hex | Description |
|-----|------|-----|-------------|
| 0 | `NOTE_MAP` | `0x01` | Supports Block 2 (Note Mapping) |
| 1 | `VELOCITY_CURVES` | `0x02` | Supports Block 3 (Velocity Curves) |
| 2 | `CC_MAPPING` | `0x04` | Supports Block 4 (CC Mapping) |
| 3 | `INSTRUMENT_DESCRIPTOR` | `0x08` | Supports Block 5 (Instrument Descriptor) |
| 4 | `INSTRUMENT_CAPABILITIES` | `0x10` | Supports Block 6 (Instrument Capabilities) |
| 5 | `STRING_CONFIG` | `0x20` | Supports Block 7 (String Instrument Config) |
| 6-31 | *Reserved* | — | Future use |

### Examples
```c
// No advanced features (Block 1 identity only)
uint32_t features = 0x00000000;

// Single instrument with auto-capabilities (Block 6 only)
uint32_t features = 0x00000010;

// Multi-instrument with auto-capabilities (Block 5 + Block 6)
uint32_t features = 0x00000018;

// Multi-instrument, full auto-config including strings (Block 5 + 6 + 7)
uint32_t features = 0x00000038;

// Everything supported (Block 2-7)
uint32_t features = 0x0000003F;
```

### Feature flag dependencies
- Block 5 (`INSTRUMENT_DESCRIPTOR`) : standalone, declares instrument list
- Block 6 (`INSTRUMENT_CAPABILITIES`) : standalone, works with or without Block 5
- Block 7 (`STRING_CONFIG`) : requires Block 6 (needs type info to know which instruments are strings)

---

## 5. Device Name (32 bytes)

### Rules
- **Maximum**: 32 characters
- **Encoding**: ASCII printable (32-126)
- **Termination**: NULL (`0x00`)
- **Padding**: Fill with `0x00` up to 32 bytes

### Arduino example
```c
void encodeDeviceName(const char* name, uint8_t* output) {
    int len = strlen(name);
    if (len > 32) len = 32;

    // Copy the name
    memcpy(output, name, len);

    // Padding with 0x00
    for (int i = len; i < 32; i++) {
        output[i] = 0x00;
    }
}
```

---

## 6. Complete Example - Arduino/Teensy

```c
// Instrument configuration
#define DEVICE_ID       0x12345678
#define DEVICE_NAME     "MyDrumKit"
#define FW_MAJOR        1
#define FW_MINOR        0
#define FW_PATCH        2
#define FEATURES        0x00000001  // Supports Note Map

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

    // Device ID (32-bit → 5 bytes 7-bit)
    encode32BitTo7Bit(DEVICE_ID, &response[pos]);
    pos += 5;

    // Device Name (32 bytes)
    encodeDeviceName(DEVICE_NAME, &response[pos]);
    pos += 32;

    // Firmware version
    response[pos++] = FW_MAJOR;
    response[pos++] = FW_MINOR;
    response[pos++] = FW_PATCH;

    // Feature flags (32-bit → 5 bytes 7-bit)
    encode32BitTo7Bit(FEATURES, &response[pos]);
    pos += 5;

    // End
    response[pos++] = 0xF7;

    // Send via MIDI
    usbMIDI.sendSysEx(52, response);
}

void checkSysExRequest() {
    if (usbMIDI.read() && usbMIDI.getType() == usbMIDI.SystemExclusive) {
        uint8_t* data = usbMIDI.getSysExArray();
        int length = usbMIDI.getSysExArrayLength();

        // Check if it's a Block 1 request
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

## 7. Minimal Test

### Valid minimal response
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

### Decoded values
```
Block Version: 1
Device ID: 0x00000001
Device Name: "Test"
Firmware: 1.0.0
Features: 0x00000001 (Note Map supported)
```

---

## 8. Block 1 Implementation Checklist

- [ ] Detect request `F0 7D 00 01 00 F7`
- [ ] Correct response header `F0 7D 00 01 01`
- [ ] Block version = `0x01`
- [ ] Device ID 7-bit encoded (5 bytes)
- [ ] Device Name padded to 32 bytes with NULL
- [ ] Firmware version (3 bytes)
- [ ] Feature flags 7-bit encoded (5 bytes)
- [ ] End with `F7`
- [ ] Total size = exactly 52 bytes

---

# Block 5 — Instrument Descriptor

## 9. Purpose

Block 5 allows a device to declare how many instruments it manages and on which MIDI channels. This is the **discovery mechanism** for multi-instrument devices.

- A device with **one instrument** does NOT need Block 5 (Ma-est-tro assumes channel 0)
- A device with **multiple instruments** SHOULD implement Block 5 so Ma-est-tro can discover them all

## 10. Instrument Descriptor Request

### Format
```
F0 7D 00 05 00 F7
```

### Byte breakdown
| Byte | Value | Description |
|------|-------|-------------|
| 0 | `F0` | Start SysEx |
| 1 | `7D` | Custom SysEx |
| 2 | `00` | MidiMind Manufacturer ID |
| 3 | `05` | Block 5 (Instrument Descriptor) |
| 4 | `00` | Request flag |
| 5 | `F7` | End SysEx |

**Size**: 6 bytes

## 11. Instrument Descriptor Response

### Format (variable length)
```
F0 7D 00 05 01 <version> <num_instruments> [<entry>...] F7
```

Each `<entry>` = 3 bytes: `<channel> <gm_program> <type_id>`

### Field table

| Offset | Size | Field | Type | Description |
|--------|------|-------|------|-------------|
| 0 | 1 | Start | `F0` | SysEx start |
| 1 | 1 | Protocol | `7D` | Custom SysEx |
| 2 | 1 | Manufacturer | `00` | MidiMind |
| 3 | 1 | Block ID | `05` | Instrument Descriptor |
| 4 | 1 | Reply Flag | `01` | Response |
| 5 | 1 | Block Version | `uint8` | Format version (currently 01) |
| 6 | 1 | Num Instruments | `uint8` | Number of instruments (1-16) |
| 7+ | 3×N | Entries | see below | One entry per instrument |
| last | 1 | End | `F7` | SysEx end |

### Entry format (3 bytes per instrument)

| Offset | Size | Field | Description |
|--------|------|-------|-------------|
| +0 | 1 | Channel | MIDI channel (0-15) |
| +1 | 1 | GM Program | General MIDI program (0-127, 0x7F = undefined) |
| +2 | 1 | Type ID | Instrument type (see table below) |

### Message size

| Instruments | Total size |
|-------------|------------|
| 1 | 11 bytes |
| 4 | 20 bytes |
| 8 | 32 bytes |
| 16 | 56 bytes |

## 12. Type ID Encoding

Aligned with `InstrumentTypeConfig.js` (`INSTRUMENT_TYPE_HIERARCHY`).

| ID | Type Key | Label | GM Programs |
|----|----------|-------|-------------|
| `0x00` | `unknown` | Unknown | — |
| `0x01` | `piano` | Piano | 0-7 |
| `0x02` | `chromatic_percussion` | Chromatic Percussion | 8-15 |
| `0x03` | `organ` | Organ | 16-23 |
| `0x04` | `guitar` | Guitar | 24-31 |
| `0x05` | `bass` | Bass | 32-39 |
| `0x06` | `strings` | Strings | 40-47 |
| `0x07` | `ensemble` | Ensemble | 48-55 |
| `0x08` | `brass` | Brass | 56-63 |
| `0x09` | `reed` | Reed | 64-71 |
| `0x0A` | `pipe` | Pipe / Flutes | 72-79 |
| `0x0B` | `synth_lead` | Synth Lead | 80-87 |
| `0x0C` | `synth_pad` | Synth Pad | 88-95 |
| `0x0D` | `synth_effects` | Synth Effects | 96-103 |
| `0x0E` | `ethnic` | Ethnic | 104-111 |
| `0x0F` | `drums` | Drums / Percussion | 112-119 |
| `0x10` | `sound_effects` | Sound Effects | 120-127 |

## 13. Block 5 Example — Arduino/Teensy

### Multi-instrument device (Piano ch0 + Guitar ch1 + Drums ch9)

```c
#define NUM_INSTRUMENTS 3

typedef struct {
    uint8_t channel;
    uint8_t gmProgram;
    uint8_t typeId;
} InstrumentEntry;

const InstrumentEntry instruments[NUM_INSTRUMENTS] = {
    { 0,  0,    0x01 },  // Piano, channel 0, GM program 0 (Acoustic Grand)
    { 1,  24,   0x04 },  // Guitar, channel 1, GM program 24 (Nylon)
    { 9,  0x7F, 0x0F }   // Drums, channel 9, no GM program (kit)
};

void handleDescriptorRequest() {
    uint8_t response[8 + (NUM_INSTRUMENTS * 3)];
    int pos = 0;

    // Header
    response[pos++] = 0xF0;
    response[pos++] = 0x7D;
    response[pos++] = 0x00;
    response[pos++] = 0x05;  // Block 5
    response[pos++] = 0x01;  // Reply

    // Block version
    response[pos++] = 0x01;

    // Number of instruments
    response[pos++] = NUM_INSTRUMENTS;

    // Instrument entries
    for (int i = 0; i < NUM_INSTRUMENTS; i++) {
        response[pos++] = instruments[i].channel;
        response[pos++] = instruments[i].gmProgram;
        response[pos++] = instruments[i].typeId;
    }

    // End
    response[pos++] = 0xF7;

    usbMIDI.sendSysEx(pos, response);
}
```

### Minimal test response (single instrument)

```
F0 7D 00 05 01  // Header + Reply
01              // Block version
01              // 1 instrument
00 00 01        // Channel 0, GM program 0 (Acoustic Grand), type=piano
F7              // End
```

Decoded: 1 instrument — Piano on channel 0, GM program 0.

## 14. Block 5 Implementation Checklist

- [ ] Detect request `F0 7D 00 05 00 F7`
- [ ] Correct response header `F0 7D 00 05 01`
- [ ] Block version = `0x01`
- [ ] Num instruments = 1-16
- [ ] Each entry: channel (0-15), GM program (0-127 or 0x7F), type_id (0x00-0x10)
- [ ] Total size = 8 + (3 × num_instruments) bytes
- [ ] Feature flag bit 3 (`INSTRUMENT_DESCRIPTOR`) set in Block 1 response

---

# Block 6 — Instrument Capabilities

## 15. Purpose

Block 6 provides detailed capabilities for a specific instrument identified by its MIDI channel. Ma-est-tro uses this to auto-configure instruments without user intervention.

- If the device supports Block 5, Ma-est-tro queries Block 6 for each declared channel
- If the device does NOT support Block 5, Ma-est-tro queries Block 6 for **channel 0** (default)

> **Note**: `octave_mode` (chromatic/diatonic/pentatonic) and `sync_delay` are Ma-est-tro-side settings, NOT transmitted via SysEx.

## 16. Instrument Capabilities Request

### Format
```
F0 7D 00 06 00 <channel> F7
```

### Byte breakdown
| Byte | Value | Description |
|------|-------|-------------|
| 0 | `F0` | Start SysEx |
| 1 | `7D` | Custom SysEx |
| 2 | `00` | MidiMind Manufacturer ID |
| 3 | `06` | Block 6 (Instrument Capabilities) |
| 4 | `00` | Request flag |
| 5 | `0x00-0x0F` | Target MIDI channel (0-15) |
| 6 | `F7` | End SysEx |

**Size**: 7 bytes

## 17. Instrument Capabilities Response

### Format (variable length)
```
F0 7D 00 06 01 <version> <channel>
  <gm_program> <type_id> <subtype_id>
  <note_selection_mode> <note_range_min> <note_range_max> <polyphony>
  <num_selected_notes> [<note>...]
  <num_supported_ccs> [<cc>...]
  <name_length> [<name_chars>...]
F7
```

### Field table

| Offset | Size | Field | Type | Description |
|--------|------|-------|------|-------------|
| 0 | 1 | Start | `F0` | SysEx start |
| 1 | 1 | Protocol | `7D` | Custom SysEx |
| 2 | 1 | Manufacturer | `00` | MidiMind |
| 3 | 1 | Block ID | `06` | Instrument Capabilities |
| 4 | 1 | Reply Flag | `01` | Response |
| 5 | 1 | Block Version | `uint8` | Format version (currently 01) |
| 6 | 1 | Channel | `uint8` | MIDI channel (0-15) |
| 7 | 1 | GM Program | `uint8` | General MIDI program (0-127, 0x7F = undefined) |
| 8 | 1 | Type ID | `uint8` | Instrument type (see Block 5 table) |
| 9 | 1 | Subtype ID | `uint8` | Subtype within type (0x00 = unspecified) |
| 10 | 1 | Note Selection Mode | `uint8` | 0 = range, 1 = discrete |
| 11 | 1 | Note Range Min | `uint8` | Lowest playable note (0-127) |
| 12 | 1 | Note Range Max | `uint8` | Highest playable note (0-127) |
| 13 | 1 | Polyphony | `uint8` | Max simultaneous notes (1-127) |
| 14 | 1 | Num Selected Notes | `uint8` | Count of discrete notes (0 if range mode) |
| 15..14+N | N | Selected Notes | `uint8[]` | Each note 0-127 (only if discrete mode) |
| 15+N | 1 | Num Supported CCs | `uint8` | Count of supported CC controllers |
| 16+N..15+N+M | M | Supported CCs | `uint8[]` | Each CC number 0-127 |
| 16+N+M | 1 | Name Length | `uint8` | Instrument name length (0-32) |
| 17+N+M..16+N+M+L | L | Name | `string` | ASCII printable characters |
| last | 1 | End | `F7` | SysEx end |

### Message size examples

| Use case | Selected Notes | CCs | Name | Total |
|----------|---------------|-----|------|-------|
| Piano (range mode, 10 CCs, 16-char name) | 0 | 10 | 16 | ~43 bytes |
| Drum kit (47 discrete notes, 5 CCs, 10-char name) | 47 | 5 | 10 | ~79 bytes |
| Minimal synth (range mode, no CCs, 8-char name) | 0 | 0 | 8 | ~26 bytes |

All well under the recommended ~256 byte SysEx limit.

## 18. Subtype ID Encoding

Subtype IDs are **relative to their parent type_id**. Index 0x00 always means "unspecified".

### piano (type_id = 0x01)

| ID | Subtype Key | Label | GM |
|----|-------------|-------|----|
| `0x00` | — | Unspecified | — |
| `0x01` | `acoustic_grand` | Acoustic Grand | 0 |
| `0x02` | `bright_acoustic` | Bright Acoustic | 1 |
| `0x03` | `electric_grand` | Electric Grand | 2 |
| `0x04` | `honky_tonk` | Honky-tonk | 3 |
| `0x05` | `electric_piano_1` | Electric Piano 1 | 4 |
| `0x06` | `electric_piano_2` | Electric Piano 2 | 5 |
| `0x07` | `harpsichord` | Harpsichord | 6 |
| `0x08` | `clavinet` | Clavinet | 7 |

### chromatic_percussion (type_id = 0x02)

| ID | Subtype Key | Label | GM |
|----|-------------|-------|----|
| `0x00` | — | Unspecified | — |
| `0x01` | `celesta` | Celesta | 8 |
| `0x02` | `glockenspiel` | Glockenspiel | 9 |
| `0x03` | `music_box` | Music Box | 10 |
| `0x04` | `vibraphone` | Vibraphone | 11 |
| `0x05` | `marimba` | Marimba | 12 |
| `0x06` | `xylophone` | Xylophone | 13 |
| `0x07` | `tubular_bells` | Tubular Bells | 14 |
| `0x08` | `dulcimer` | Dulcimer | 15 |

### organ (type_id = 0x03)

| ID | Subtype Key | Label | GM |
|----|-------------|-------|----|
| `0x00` | — | Unspecified | — |
| `0x01` | `drawbar` | Drawbar Organ | 16 |
| `0x02` | `percussive_organ` | Percussive Organ | 17 |
| `0x03` | `rock_organ` | Rock Organ | 18 |
| `0x04` | `church_organ` | Church Organ | 19 |
| `0x05` | `reed_organ` | Reed Organ | 20 |
| `0x06` | `accordion` | Accordion | 21 |
| `0x07` | `harmonica` | Harmonica | 22 |
| `0x08` | `tango_accordion` | Tango Accordion | 23 |

### guitar (type_id = 0x04)

| ID | Subtype Key | Label | GM |
|----|-------------|-------|----|
| `0x00` | — | Unspecified | — |
| `0x01` | `nylon` | Nylon Guitar | 24 |
| `0x02` | `steel` | Steel Guitar | 25 |
| `0x03` | `jazz` | Jazz Guitar | 26 |
| `0x04` | `clean` | Clean Guitar | 27 |
| `0x05` | `muted` | Muted Guitar | 28 |
| `0x06` | `overdrive` | Overdrive Guitar | 29 |
| `0x07` | `distortion` | Distortion Guitar | 30 |
| `0x08` | `harmonics` | Guitar Harmonics | 31 |

### bass (type_id = 0x05)

| ID | Subtype Key | Label | GM |
|----|-------------|-------|----|
| `0x00` | — | Unspecified | — |
| `0x01` | `acoustic` | Acoustic Bass | 32 |
| `0x02` | `finger` | Finger Bass | 33 |
| `0x03` | `pick` | Pick Bass | 34 |
| `0x04` | `fretless` | Fretless Bass | 35 |
| `0x05` | `slap_1` | Slap Bass 1 | 36 |
| `0x06` | `slap_2` | Slap Bass 2 | 37 |
| `0x07` | `synth_bass_1` | Synth Bass 1 | 38 |
| `0x08` | `synth_bass_2` | Synth Bass 2 | 39 |

### strings (type_id = 0x06)

| ID | Subtype Key | Label | GM |
|----|-------------|-------|----|
| `0x00` | — | Unspecified | — |
| `0x01` | `violin` | Violin | 40 |
| `0x02` | `viola` | Viola | 41 |
| `0x03` | `cello` | Cello | 42 |
| `0x04` | `contrabass` | Contrabass | 43 |
| `0x05` | `tremolo` | Tremolo Strings | 44 |
| `0x06` | `pizzicato` | Pizzicato Strings | 45 |
| `0x07` | `harp` | Harp | 46 |
| `0x08` | `timpani` | Timpani | 47 |

### ensemble (type_id = 0x07)

| ID | Subtype Key | Label | GM |
|----|-------------|-------|----|
| `0x00` | — | Unspecified | — |
| `0x01` | `string_ensemble_1` | String Ensemble 1 | 48 |
| `0x02` | `string_ensemble_2` | String Ensemble 2 | 49 |
| `0x03` | `synth_strings_1` | Synth Strings 1 | 50 |
| `0x04` | `synth_strings_2` | Synth Strings 2 | 51 |
| `0x05` | `choir_aahs` | Choir Aahs | 52 |
| `0x06` | `voice_oohs` | Voice Oohs | 53 |
| `0x07` | `synth_voice` | Synth Voice | 54 |
| `0x08` | `orchestra_hit` | Orchestra Hit | 55 |

### brass (type_id = 0x08)

| ID | Subtype Key | Label | GM |
|----|-------------|-------|----|
| `0x00` | — | Unspecified | — |
| `0x01` | `trumpet` | Trumpet | 56 |
| `0x02` | `trombone` | Trombone | 57 |
| `0x03` | `tuba` | Tuba | 58 |
| `0x04` | `muted_trumpet` | Muted Trumpet | 59 |
| `0x05` | `french_horn` | French Horn | 60 |
| `0x06` | `brass_section` | Brass Section | 61 |
| `0x07` | `synth_brass_1` | Synth Brass 1 | 62 |
| `0x08` | `synth_brass_2` | Synth Brass 2 | 63 |

### reed (type_id = 0x09)

| ID | Subtype Key | Label | GM |
|----|-------------|-------|----|
| `0x00` | — | Unspecified | — |
| `0x01` | `soprano_sax` | Soprano Sax | 64 |
| `0x02` | `alto_sax` | Alto Sax | 65 |
| `0x03` | `tenor_sax` | Tenor Sax | 66 |
| `0x04` | `baritone_sax` | Baritone Sax | 67 |
| `0x05` | `oboe` | Oboe | 68 |
| `0x06` | `english_horn` | English Horn | 69 |
| `0x07` | `bassoon` | Bassoon | 70 |
| `0x08` | `clarinet` | Clarinet | 71 |

### pipe (type_id = 0x0A)

| ID | Subtype Key | Label | GM |
|----|-------------|-------|----|
| `0x00` | — | Unspecified | — |
| `0x01` | `piccolo` | Piccolo | 72 |
| `0x02` | `flute` | Flute | 73 |
| `0x03` | `recorder` | Recorder | 74 |
| `0x04` | `pan_flute` | Pan Flute | 75 |
| `0x05` | `bottle` | Blown Bottle | 76 |
| `0x06` | `shakuhachi` | Shakuhachi | 77 |
| `0x07` | `whistle` | Whistle | 78 |
| `0x08` | `ocarina` | Ocarina | 79 |

### synth_lead (type_id = 0x0B)

| ID | Subtype Key | Label | GM |
|----|-------------|-------|----|
| `0x00` | — | Unspecified | — |
| `0x01` | `square` | Square Lead | 80 |
| `0x02` | `sawtooth` | Sawtooth Lead | 81 |
| `0x03` | `calliope` | Calliope Lead | 82 |
| `0x04` | `chiff` | Chiff Lead | 83 |
| `0x05` | `charang` | Charang Lead | 84 |
| `0x06` | `voice_lead` | Voice Lead | 85 |
| `0x07` | `fifths` | Fifths Lead | 86 |
| `0x08` | `bass_lead` | Bass + Lead | 87 |

### synth_pad (type_id = 0x0C)

| ID | Subtype Key | Label | GM |
|----|-------------|-------|----|
| `0x00` | — | Unspecified | — |
| `0x01` | `new_age` | New Age Pad | 88 |
| `0x02` | `warm` | Warm Pad | 89 |
| `0x03` | `polysynth` | Polysynth Pad | 90 |
| `0x04` | `choir` | Choir Pad | 91 |
| `0x05` | `bowed` | Bowed Pad | 92 |
| `0x06` | `metallic` | Metallic Pad | 93 |
| `0x07` | `halo` | Halo Pad | 94 |
| `0x08` | `sweep` | Sweep Pad | 95 |

### synth_effects (type_id = 0x0D)

| ID | Subtype Key | Label | GM |
|----|-------------|-------|----|
| `0x00` | — | Unspecified | — |
| `0x01` | `rain` | FX Rain | 96 |
| `0x02` | `soundtrack` | FX Soundtrack | 97 |
| `0x03` | `crystal` | FX Crystal | 98 |
| `0x04` | `atmosphere` | FX Atmosphere | 99 |
| `0x05` | `brightness` | FX Brightness | 100 |
| `0x06` | `goblins` | FX Goblins | 101 |
| `0x07` | `echoes` | FX Echoes | 102 |
| `0x08` | `sci_fi` | FX Sci-Fi | 103 |

### ethnic (type_id = 0x0E)

| ID | Subtype Key | Label | GM |
|----|-------------|-------|----|
| `0x00` | — | Unspecified | — |
| `0x01` | `sitar` | Sitar | 104 |
| `0x02` | `banjo` | Banjo | 105 |
| `0x03` | `shamisen` | Shamisen | 106 |
| `0x04` | `koto` | Koto | 107 |
| `0x05` | `kalimba` | Kalimba | 108 |
| `0x06` | `bagpipe` | Bagpipe | 109 |
| `0x07` | `fiddle` | Fiddle | 110 |
| `0x08` | `shanai` | Shanai | 111 |

### drums (type_id = 0x0F)

| ID | Subtype Key | Label | GM |
|----|-------------|-------|----|
| `0x00` | — | Unspecified | — |
| `0x01` | `tinkle_bell` | Tinkle Bell | 112 |
| `0x02` | `agogo` | Agogo | 113 |
| `0x03` | `steel_drums` | Steel Drums | 114 |
| `0x04` | `woodblock` | Woodblock | 115 |
| `0x05` | `taiko` | Taiko | 116 |
| `0x06` | `melodic_tom` | Melodic Tom | 117 |
| `0x07` | `synth_drum` | Synth Drum | 118 |
| `0x08` | `reverse_cymbal` | Reverse Cymbal | 119 |
| `0x09` | `standard_kit` | Standard Kit | — |
| `0x0A` | `jazz_kit` | Jazz Kit | — |
| `0x0B` | `electronic_kit` | Electronic Kit | — |
| `0x0C` | `brush_kit` | Brush Kit | — |
| `0x0D` | `orchestra_kit` | Orchestra Kit | — |

### sound_effects (type_id = 0x10)

| ID | Subtype Key | Label | GM |
|----|-------------|-------|----|
| `0x00` | — | Unspecified | — |
| `0x01` | `guitar_fret` | Fret Noise | 120 |
| `0x02` | `breath` | Breath Noise | 121 |
| `0x03` | `seashore` | Seashore | 122 |
| `0x04` | `bird` | Bird Tweet | 123 |
| `0x05` | `telephone` | Telephone Ring | 124 |
| `0x06` | `helicopter` | Helicopter | 125 |
| `0x07` | `applause` | Applause | 126 |
| `0x08` | `gunshot` | Gunshot | 127 |

## 19. Block 6 Example — Arduino/Teensy

### Piano instrument (range mode)

```c
void handleCapabilitiesRequest(uint8_t requestedChannel) {
    // Piano on channel 0
    if (requestedChannel != 0) return;  // No instrument on this channel

    const char* name = "Grand Piano";
    uint8_t nameLen = strlen(name);
    uint8_t supportedCCs[] = { 1, 7, 10, 11, 64, 67 };  // Mod, Vol, Pan, Expr, Sustain, Soft
    uint8_t numCCs = sizeof(supportedCCs);

    // Calculate total size
    int totalSize = 16 + 0 + numCCs + nameLen + 1;  // 0 selected notes (range mode)
    uint8_t response[totalSize];
    int pos = 0;

    // Header
    response[pos++] = 0xF0;
    response[pos++] = 0x7D;
    response[pos++] = 0x00;
    response[pos++] = 0x06;  // Block 6
    response[pos++] = 0x01;  // Reply

    // Block version + channel
    response[pos++] = 0x01;
    response[pos++] = 0;     // Channel 0

    // Identity
    response[pos++] = 0;     // GM program 0 (Acoustic Grand)
    response[pos++] = 0x01;  // Type: piano
    response[pos++] = 0x01;  // Subtype: acoustic_grand

    // Note capabilities
    response[pos++] = 0;     // Note selection mode: range
    response[pos++] = 21;    // Note range min: A0
    response[pos++] = 108;   // Note range max: C8
    response[pos++] = 88;    // Polyphony: 88

    // Selected notes (empty for range mode)
    response[pos++] = 0;     // Num selected notes: 0

    // Supported CCs
    response[pos++] = numCCs;
    for (int i = 0; i < numCCs; i++) {
        response[pos++] = supportedCCs[i];
    }

    // Name
    response[pos++] = nameLen;
    for (int i = 0; i < nameLen; i++) {
        response[pos++] = name[i];
    }

    // End
    response[pos++] = 0xF7;

    usbMIDI.sendSysEx(pos, response);
}
```

### Drum kit (discrete mode)

```c
void handleDrumCapabilities(uint8_t requestedChannel) {
    if (requestedChannel != 9) return;

    const char* name = "Rock Kit";
    uint8_t nameLen = strlen(name);

    // GM standard drum notes (subset)
    uint8_t drumNotes[] = {
        36, 38, 40, 41, 42, 43, 44, 45, 46,  // Kick, Snare, Toms, HH
        47, 48, 49, 50, 51, 55, 57            // Toms, Crash, Ride
    };
    uint8_t numNotes = sizeof(drumNotes);
    uint8_t supportedCCs[] = { 7, 10 };  // Volume, Pan
    uint8_t numCCs = sizeof(supportedCCs);

    int totalSize = 16 + numNotes + numCCs + nameLen + 1;
    uint8_t response[totalSize];
    int pos = 0;

    // Header
    response[pos++] = 0xF0;
    response[pos++] = 0x7D;
    response[pos++] = 0x00;
    response[pos++] = 0x06;
    response[pos++] = 0x01;

    response[pos++] = 0x01;  // Version
    response[pos++] = 9;     // Channel 9

    response[pos++] = 0x7F;  // GM program: undefined (drum kit)
    response[pos++] = 0x0F;  // Type: drums
    response[pos++] = 0x09;  // Subtype: standard_kit

    response[pos++] = 1;     // Note selection mode: discrete
    response[pos++] = 36;    // Note range min (informational)
    response[pos++] = 57;    // Note range max (informational)
    response[pos++] = 16;    // Polyphony

    // Selected notes (discrete list)
    response[pos++] = numNotes;
    for (int i = 0; i < numNotes; i++) {
        response[pos++] = drumNotes[i];
    }

    // Supported CCs
    response[pos++] = numCCs;
    for (int i = 0; i < numCCs; i++) {
        response[pos++] = supportedCCs[i];
    }

    // Name
    response[pos++] = nameLen;
    for (int i = 0; i < nameLen; i++) {
        response[pos++] = name[i];
    }

    response[pos++] = 0xF7;
    usbMIDI.sendSysEx(pos, response);
}
```

### Minimal test response

```
F0 7D 00 06 01  // Header + Reply
01              // Block version
00              // Channel 0
00 01 01        // GM=0, type=piano, subtype=acoustic_grand
00 15 6C 58     // range mode, min=21(A0), max=108(C8), polyphony=88
00              // 0 selected notes
02 01 40        // 2 CCs: Modulation(1), Sustain(64)
05 50 69 61 6E 6F  // Name: "Piano" (5 chars)
F7              // End
```

## 20. Block 6 Implementation Checklist

- [ ] Detect request `F0 7D 00 06 00 <channel> F7`
- [ ] Correct response header `F0 7D 00 06 01`
- [ ] Block version = `0x01`
- [ ] Channel matches requested channel (0-15)
- [ ] GM program (0-127 or 0x7F for undefined)
- [ ] Type ID and subtype ID consistent with Block 5 tables
- [ ] Note selection mode: 0=range, 1=discrete
- [ ] Note range min ≤ max (0-127)
- [ ] Polyphony (1-127)
- [ ] Selected notes array correct length (0 if range mode)
- [ ] Supported CCs array correct length
- [ ] Name: ASCII printable, length 0-32
- [ ] End with `F7`
- [ ] Feature flag bit 4 (`INSTRUMENT_CAPABILITIES`) set in Block 1 response
