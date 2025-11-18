// Deep inspection of MIDI file binary structure
import { parseMidi } from 'midi-file';
import fs from 'fs';

const file = process.argv[2];

if (!file || !fs.existsSync(file)) {
  console.log('Usage: node inspect-midi-binary.js <midi-file>');
  process.exit(1);
}

console.log('\n🔬 MIDI Binary Inspector\n');
console.log('='.repeat(80));

const buffer = fs.readFileSync(file);

// Show file info
console.log(`\n📄 File: ${file}`);
console.log(`   Size: ${buffer.length} bytes`);
console.log(`   Extension: ${file.split('.').pop()}`);

// Read header manually
console.log('\n📋 Header (manual read):');
const headerChunk = buffer.toString('ascii', 0, 4);
const headerLength = buffer.readUInt32BE(4);
const format = buffer.readUInt16BE(8);
const numTracks = buffer.readUInt16BE(10);
const division = buffer.readUInt16BE(12);

console.log(`   Chunk ID: "${headerChunk}" (should be "MThd")`);
console.log(`   Header length: ${headerLength} (should be 6)`);
console.log(`   Format: ${format} (0=single track, 1=multiple tracks, 2=multiple sequences)`);
console.log(`   Number of tracks: ${numTracks}`);
console.log(`   Division: ${division} (ticks per quarter note)`);

if (headerChunk !== 'MThd') {
  console.log('\n❌ INVALID MIDI FILE: Header chunk ID is not "MThd"!');
  console.log('   This file may be corrupted or not a valid MIDI file.');
  process.exit(1);
}

// Parse with midi-file library
console.log('\n📦 Parsing with midi-file library:');
try {
  const midi = parseMidi(buffer);
  console.log(`   Format: ${midi.header.format}`);
  console.log(`   Tracks parsed: ${midi.tracks.length}`);
  console.log(`   Ticks per beat: ${midi.header.ticksPerBeat}`);

  // Analyze each track
  console.log('\n📊 Track Analysis:');
  midi.tracks.forEach((track, trackIdx) => {
    console.log(`\n   Track ${trackIdx}: ${track.length} events`);

    const eventTypes = new Map();
    const channels = new Set();
    let firstNoteEvent = null;

    track.forEach((event, idx) => {
      // Count event types
      eventTypes.set(event.type, (eventTypes.get(event.type) || 0) + 1);

      // Track channels
      if (event.channel !== undefined) {
        channels.add(event.channel);

        // Capture first note event for inspection
        if (!firstNoteEvent && (event.type === 'noteOn' || event.type === 'noteOff')) {
          firstNoteEvent = { idx, ...event };
        }
      }
    });

    // Show event type distribution
    console.log('   Event types:');
    eventTypes.forEach((count, type) => {
      console.log(`     - ${type}: ${count}`);
    });

    // Show channels
    if (channels.size > 0) {
      console.log(`   Channels detected: [${Array.from(channels).sort((a,b) => a-b).join(', ')}]`);
    } else {
      console.log('   ⚠️  NO CHANNELS DETECTED!');
    }

    // Show first note event for inspection
    if (firstNoteEvent) {
      console.log(`   First note event (idx ${firstNoteEvent.idx}):`);
      console.log(`     ${JSON.stringify(firstNoteEvent, null, 4)}`);
    }

    // Sample first 5 events with channel info
    console.log('   First 5 channel events:');
    let count = 0;
    for (const event of track) {
      if (event.channel !== undefined && count < 5) {
        console.log(`     [${count}] type=${event.type}, channel=${event.channel}, ` +
                   `note=${event.noteNumber || 'N/A'}, vel=${event.velocity || 'N/A'}`);
        count++;
      }
    }
  });

  // Deep dive into channel distribution
  console.log('\n🎯 Overall Channel Distribution:');
  const globalChannels = new Map();
  midi.tracks.forEach(track => {
    track.forEach(event => {
      if (event.channel !== undefined) {
        if (!globalChannels.has(event.channel)) {
          globalChannels.set(event.channel, { notes: 0, cc: 0, program: null });
        }
        const stats = globalChannels.get(event.channel);

        if (event.type === 'noteOn' && event.velocity > 0) {
          stats.notes++;
        } else if (event.type === 'controller') {
          stats.cc++;
        } else if (event.type === 'programChange') {
          stats.program = event.programNumber;
        }
      }
    });
  });

  if (globalChannels.size === 0) {
    console.log('   ❌ NO CHANNELS FOUND IN ENTIRE FILE!');
    console.log('   This indicates a serious parsing issue.');
  } else {
    globalChannels.forEach((stats, channel) => {
      console.log(`   Channel ${channel} (display: ${channel + 1}):`);
      console.log(`     - Notes: ${stats.notes}`);
      console.log(`     - CC events: ${stats.cc}`);
      console.log(`     - Program: ${stats.program !== null ? stats.program : 'none'}`);
    });
  }

} catch (error) {
  console.log(`\n❌ ERROR parsing with midi-file: ${error.message}`);
  console.log(error.stack);
}

// Manual track inspection
console.log('\n🔍 Manual Track Inspection:');
let offset = 14; // After header

for (let trackNum = 0; trackNum < numTracks; trackNum++) {
  if (offset >= buffer.length) {
    console.log(`   ⚠️  Reached end of file before track ${trackNum}`);
    break;
  }

  const trackChunk = buffer.toString('ascii', offset, offset + 4);
  const trackLength = buffer.readUInt32BE(offset + 4);

  console.log(`\n   Track ${trackNum}:`);
  console.log(`     Chunk ID: "${trackChunk}" (should be "MTrk")`);
  console.log(`     Length: ${trackLength} bytes`);

  if (trackChunk !== 'MTrk') {
    console.log(`     ❌ INVALID: Expected "MTrk", got "${trackChunk}"`);
    break;
  }

  // Sample first few bytes of track data
  const sampleSize = Math.min(32, trackLength);
  const trackData = buffer.slice(offset + 8, offset + 8 + sampleSize);
  console.log(`     First ${sampleSize} bytes: ${trackData.toString('hex').match(/.{1,2}/g).join(' ')}`);

  offset += 8 + trackLength;
}

console.log('\n' + '='.repeat(80));

// Final diagnosis
console.log('\n💡 DIAGNOSIS:\n');

const midi = parseMidi(buffer);
const channelCount = new Set();
midi.tracks.forEach(track => {
  track.forEach(event => {
    if (event.channel !== undefined) channelCount.add(event.channel);
  });
});

if (numTracks > 1 && midi.tracks.length === 1) {
  console.log('❌ PROBLEM: File header says it has', numTracks, 'tracks,');
  console.log('   but midi-file only parsed', midi.tracks.length, 'track!');
  console.log('   → This is a parsing bug in the midi-file library.\n');
} else if (channelCount.size <= 1 && numTracks > 1) {
  console.log('❌ PROBLEM: File has', numTracks, 'tracks but only', channelCount.size, 'channel(s) detected.');
  console.log('   → The channel information may not be encoded correctly in this file,');
  console.log('   → OR the midi-file library is not reading channel info correctly.\n');
} else if (channelCount.size <= 1) {
  console.log('⚠️  This file genuinely contains only', channelCount.size, 'MIDI channel(s).');
  console.log('   This may be intentional, or the file may have been created incorrectly.\n');
} else {
  console.log('✅ File appears to be parsed correctly.');
  console.log('   Tracks:', midi.tracks.length);
  console.log('   Channels:', channelCount.size, '-', Array.from(channelCount).sort((a,b) => a-b).join(', '), '\n');
}

console.log('='.repeat(80), '\n');
