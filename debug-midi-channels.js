// Debug script to trace MIDI channel preservation through the entire pipeline
import { parseMidi } from 'midi-file';
import fs from 'fs';
import FileManager from './src/storage/FileManager.js';

// Mock logger
const mockLogger = {
  info: (...args) => console.log('[INFO]', ...args),
  error: (...args) => console.error('[ERROR]', ...args),
  warn: (...args) => console.warn('[WARN]', ...args),
  debug: (...args) => console.log('[DEBUG]', ...args)
};

// Mock app with minimal structure
const mockApp = {
  logger: mockLogger
};

console.log('🔍 MIDI Channel Preservation Debug\n');
console.log('=' .repeat(80));

// Test with a sample MIDI file
const testFile = process.argv[2] || './test.mid';

if (!fs.existsSync(testFile)) {
  console.log(`\n❌ File not found: ${testFile}`);
  console.log('\nUsage: node debug-midi-channels.js <path-to-midi-file>');
  console.log('\nExample: node debug-midi-channels.js ./myfile.midi');
  process.exit(1);
}

console.log(`\n📂 Testing file: ${testFile}\n`);

// Step 1: Parse with midi-file directly
console.log('\n' + '─'.repeat(80));
console.log('STEP 1: Direct parsing with midi-file library');
console.log('─'.repeat(80));

const buffer = fs.readFileSync(testFile);
const midi = parseMidi(buffer);

console.log(`\nHeader: format=${midi.header.format}, tracks=${midi.header.numTracks}, ticksPerBeat=${midi.header.ticksPerBeat}`);

const channelStats = new Map();
const channelPrograms = new Map();

midi.tracks.forEach((track, trackIndex) => {
  console.log(`\n  Track ${trackIndex}: ${track.length} events`);

  let noteCount = 0;
  let ccCount = 0;
  let programCount = 0;
  let pitchBendCount = 0;
  const trackChannels = new Set();

  track.forEach((event, idx) => {
    // Log first few events with channel info
    if (idx < 5 && event.channel !== undefined) {
      console.log(`    Event ${idx}: type=${event.type}, channel=${event.channel}`);
    }

    if (event.channel !== undefined) {
      trackChannels.add(event.channel);

      if (!channelStats.has(event.channel)) {
        channelStats.set(event.channel, { notes: 0, cc: 0, pitchBend: 0, program: null });
      }

      const stats = channelStats.get(event.channel);

      if (event.type === 'noteOn' && event.velocity > 0) {
        noteCount++;
        stats.notes++;
      } else if (event.type === 'controller') {
        ccCount++;
        stats.cc++;
      } else if (event.type === 'pitchBend') {
        pitchBendCount++;
        stats.pitchBend++;
      } else if (event.type === 'programChange') {
        programCount++;
        stats.program = event.programNumber;
        channelPrograms.set(event.channel, event.programNumber);
      }
    }
  });

  console.log(`    Summary: ${noteCount} notes, ${ccCount} CC, ${pitchBendCount} pitchBend, ${programCount} programs`);
  console.log(`    Channels in track: [${Array.from(trackChannels).sort((a,b) => a-b).join(', ')}]`);
});

console.log('\n📊 Overall Channel Statistics:');
channelStats.forEach((stats, channel) => {
  const program = channelPrograms.get(channel);
  console.log(`  Channel ${channel} (${channel + 1}): ${stats.notes} notes, ${stats.cc} CC, ${stats.pitchBend} pitchBend, program=${program}`);
});

// Step 2: Test FileManager.convertMidiToJSON
console.log('\n' + '─'.repeat(80));
console.log('STEP 2: FileManager.convertMidiToJSON()');
console.log('─'.repeat(80));

const fileManager = new FileManager(mockApp);
const jsonData = fileManager.convertMidiToJSON(midi);

console.log(`\nConverted to JSON: ${jsonData.tracks.length} tracks`);

const jsonChannelStats = new Map();

jsonData.tracks.forEach((track, trackIndex) => {
  console.log(`\n  Track ${trackIndex} (${track.name}): ${track.events.length} events`);

  let notesWithChannel = 0;
  let notesWithoutChannel = 0;
  let eventsWithChannel = 0;
  let eventsWithoutChannel = 0;
  const trackChannels = new Set();

  track.events.forEach((event, idx) => {
    // Check if channel is preserved
    if (event.channel !== undefined) {
      eventsWithChannel++;
      trackChannels.add(event.channel);

      if (event.type === 'noteOn' && event.velocity > 0) {
        notesWithChannel++;
      }

      if (!jsonChannelStats.has(event.channel)) {
        jsonChannelStats.set(event.channel, { notes: 0, events: 0 });
      }
      jsonChannelStats.get(event.channel).events++;
      if (event.type === 'noteOn' && event.velocity > 0) {
        jsonChannelStats.get(event.channel).notes++;
      }
    } else {
      eventsWithoutChannel++;
      if (event.type === 'noteOn' && event.velocity > 0) {
        notesWithoutChannel++;
      }
    }

    // Log first event with missing channel
    if (idx < 10 && event.channel === undefined && (event.type === 'noteOn' || event.type === 'noteOff' || event.type === 'controller')) {
      console.log(`    ⚠️  Event ${idx}: type=${event.type}, channel=UNDEFINED ❌`);
      console.log(`         Raw event:`, JSON.stringify(event));
    }
  });

  console.log(`    Events WITH channel: ${eventsWithChannel}`);
  console.log(`    Events WITHOUT channel: ${eventsWithoutChannel}`);
  console.log(`    Notes WITH channel: ${notesWithChannel}`);
  console.log(`    Notes WITHOUT channel: ${notesWithoutChannel}`);
  console.log(`    Channels detected: [${Array.from(trackChannels).sort((a,b) => a-b).join(', ')}]`);
});

console.log('\n📊 JSON Channel Statistics:');
if (jsonChannelStats.size === 0) {
  console.log('  ❌ NO CHANNELS FOUND IN JSON! This is the problem!');
} else {
  jsonChannelStats.forEach((stats, channel) => {
    console.log(`  Channel ${channel} (${channel + 1}): ${stats.notes} notes, ${stats.events} total events`);
  });
}

// Step 3: Simulate what the editor would do
console.log('\n' + '─'.repeat(80));
console.log('STEP 3: Simulating MidiEditorModal.convertMidiToSequence()');
console.log('─'.repeat(80));

const channelInstruments = new Map();
const channelNoteCount = new Map();
const allNotes = [];

jsonData.tracks.forEach((track, trackIndex) => {
  if (!track.events) return;

  const activeNotes = new Map();
  let currentTick = 0;

  track.events.forEach((event) => {
    currentTick += event.deltaTime || 0;

    // Program Change
    if (event.type === 'programChange') {
      const channel = event.channel !== undefined ? event.channel : 0;
      channelInstruments.set(channel, event.programNumber);
      console.log(`  Found programChange: channel=${channel}, program=${event.programNumber}`);
    }

    // Note On
    if (event.type === 'noteOn' && event.velocity > 0) {
      const channel = event.channel !== undefined ? event.channel : 0;
      const key = `${channel}_${event.noteNumber}`;
      activeNotes.set(key, {
        tick: currentTick,
        note: event.noteNumber,
        velocity: event.velocity,
        channel: channel
      });
    }
    // Note Off
    else if (event.type === 'noteOff' || (event.type === 'noteOn' && event.velocity === 0)) {
      const channel = event.channel !== undefined ? event.channel : 0;
      const key = `${channel}_${event.noteNumber}`;
      const noteOn = activeNotes.get(key);

      if (noteOn) {
        const gate = currentTick - noteOn.tick;
        allNotes.push({
          tick: noteOn.tick,
          note: noteOn.note,
          gate: gate,
          velocity: noteOn.velocity,
          channel: channel
        });

        channelNoteCount.set(channel, (channelNoteCount.get(channel) || 0) + 1);
        activeNotes.delete(key);
      }
    }
  });
});

console.log(`\nExtracted ${allNotes.length} complete notes`);
console.log('\n📊 Editor would detect these channels:');

if (channelNoteCount.size === 0) {
  console.log('  ❌ NO CHANNELS DETECTED! All notes would appear on channel 0 by default!');
} else {
  channelNoteCount.forEach((count, channel) => {
    const program = channelInstruments.get(channel) || 0;
    console.log(`  Channel ${channel} (${channel + 1}): ${count} notes, program=${program}`);
  });
}

// Final verdict
console.log('\n' + '='.repeat(80));
console.log('DIAGNOSIS:');
console.log('='.repeat(80));

if (channelStats.size > 1 && jsonChannelStats.size <= 1) {
  console.log('\n❌ PROBLEM IDENTIFIED: Channels are lost during JSON conversion!');
  console.log('   - Original file has', channelStats.size, 'channels');
  console.log('   - After JSON conversion, only', jsonChannelStats.size, 'channel(s) remain');
  console.log('\n   → The issue is in FileManager.convertMidiToJSON()');
} else if (channelStats.size > 1 && jsonChannelStats.size > 1 && channelNoteCount.size <= 1) {
  console.log('\n❌ PROBLEM IDENTIFIED: Channels are lost during editor sequence conversion!');
  console.log('   - JSON has', jsonChannelStats.size, 'channels');
  console.log('   - Editor sequence has only', channelNoteCount.size, 'channel(s)');
  console.log('\n   → The issue is in MidiEditorModal.convertMidiToSequence()');
} else if (channelStats.size <= 1) {
  console.log('\n✅ The MIDI file itself only contains', channelStats.size, 'channel(s)');
  console.log('   → This is not a parsing bug, the file genuinely has only one channel');
} else {
  console.log('\n✅ Channel preservation looks good!');
  console.log('   - Original:', channelStats.size, 'channels');
  console.log('   - After JSON:', jsonChannelStats.size, 'channels');
  console.log('   - In editor:', channelNoteCount.size, 'channels');
}

console.log('\n' + '='.repeat(80));
