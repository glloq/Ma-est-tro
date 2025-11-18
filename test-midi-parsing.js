// Test script to verify MIDI parsing and channel preservation
import { parseMidi } from 'midi-file';
import fs from 'fs';
import path from 'path';

// Find any MIDI files in the project
const testFiles = [
  './test.mid',
  './test.midi',
  './examples/test.mid',
  './examples/test.midi'
];

console.log('🎵 Testing MIDI file parsing...\n');

// Helper function to analyze a MIDI file
function analyzeMidiFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }

  console.log(`\n📄 Analyzing: ${filePath}`);
  console.log('─'.repeat(60));

  const buffer = fs.readFileSync(filePath);
  const midi = parseMidi(buffer);

  console.log(`Header: format=${midi.header.format}, tracks=${midi.header.numTracks}, ticksPerBeat=${midi.header.ticksPerBeat}`);

  // Analyze each track
  midi.tracks.forEach((track, trackIndex) => {
    console.log(`\n  Track ${trackIndex}:`);

    let noteCount = 0;
    let ccCount = 0;
    let pitchBendCount = 0;
    let programChangeCount = 0;
    const channelsUsed = new Set();
    const programsUsed = new Map(); // channel -> program

    track.forEach((event, eventIndex) => {
      // Check if channel attribute exists
      if (event.channel !== undefined) {
        channelsUsed.add(event.channel);
      }

      // Count event types
      if (event.type === 'noteOn' && event.velocity > 0) {
        noteCount++;
        if (eventIndex < 3) { // Show first 3 notes
          console.log(`    [${eventIndex}] NoteOn: note=${event.noteNumber}, vel=${event.velocity}, channel=${event.channel}`);
        }
      } else if (event.type === 'noteOff' || (event.type === 'noteOn' && event.velocity === 0)) {
        // Don't count note offs separately
      } else if (event.type === 'controller') {
        ccCount++;
        if (ccCount <= 3) { // Show first 3 CC events
          console.log(`    [${eventIndex}] CC: controller=${event.controllerType}, value=${event.value}, channel=${event.channel}`);
        }
      } else if (event.type === 'pitchBend') {
        pitchBendCount++;
        if (pitchBendCount <= 3) { // Show first 3 pitchbend events
          console.log(`    [${eventIndex}] PitchBend: value=${event.value}, channel=${event.channel}`);
        }
      } else if (event.type === 'programChange') {
        programChangeCount++;
        programsUsed.set(event.channel, event.programNumber);
        console.log(`    [${eventIndex}] ProgramChange: program=${event.programNumber}, channel=${event.channel}`);
      } else if (event.type === 'trackName') {
        console.log(`    Name: "${event.text}"`);
      }
    });

    console.log(`    Summary: ${noteCount} notes, ${ccCount} CC, ${pitchBendCount} pitchbend, ${programChangeCount} program changes`);
    console.log(`    Channels used: [${Array.from(channelsUsed).sort((a,b) => a-b).join(', ')}]`);

    if (programsUsed.size > 0) {
      console.log(`    Programs:`);
      programsUsed.forEach((program, channel) => {
        console.log(`      Channel ${channel}: program ${program}`);
      });
    }
  });

  return midi;
}

// Test with available MIDI files
let found = false;
for (const file of testFiles) {
  const result = analyzeMidiFile(file);
  if (result) {
    found = true;
  }
}

if (!found) {
  console.log('\n❌ No MIDI files found to test');
  console.log('   Please provide a .mid or .midi file in one of these locations:');
  testFiles.forEach(f => console.log(`   - ${f}`));
}

console.log('\n✅ Test complete\n');
