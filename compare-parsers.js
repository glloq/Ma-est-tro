// Compare midi-file vs CustomMidiParser
import { parseMidi } from 'midi-file';
import CustomMidiParser from './src/utils/CustomMidiParser.js';
import fs from 'fs';

const file = process.argv[2];

if (!file || !fs.existsSync(file)) {
  console.log('Usage: node compare-parsers.js <midi-file>');
  process.exit(1);
}

console.log('\n⚖️  Parser Comparison: midi-file vs CustomMidiParser\n');
console.log('='.repeat(80));

const buffer = fs.readFileSync(file);

// Parse with midi-file
console.log('\n📦 Parser 1: midi-file (npm package)\n');

let midiFileChannels = new Set();
let midiFileResult;

try {
  midiFileResult = parseMidi(buffer);
  console.log(`   ✅ Success`);
  console.log(`   Tracks: ${midiFileResult.tracks.length}`);
  console.log(`   Format: ${midiFileResult.header.format}`);
  console.log(`   Ticks/beat: ${midiFileResult.header.ticksPerBeat}`);

  midiFileResult.tracks.forEach((track, idx) => {
    let noteCount = 0;
    track.forEach(event => {
      if (event.channel !== undefined) {
        midiFileChannels.add(event.channel);
      }
      if (event.type === 'noteOn' && event.velocity > 0) {
        noteCount++;
      }
    });
    console.log(`   Track ${idx}: ${track.length} events, ${noteCount} notes`);
  });

  console.log(`   Channels detected: [${Array.from(midiFileChannels).sort((a,b) => a-b).join(', ')}]`);

} catch (error) {
  console.log(`   ❌ Error: ${error.message}`);
}

// Parse with CustomMidiParser
console.log('\n🔧 Parser 2: CustomMidiParser (custom implementation)\n');

let customChannels = new Set();
let customResult;

try {
  const parser = new CustomMidiParser();
  customResult = parser.parse(buffer);

  console.log(`   ✅ Success`);
  console.log(`   Tracks: ${customResult.tracks.length}`);
  console.log(`   Format: ${customResult.header.format}`);
  console.log(`   Ticks/beat: ${customResult.header.ticksPerBeat}`);

  customResult.tracks.forEach((track, idx) => {
    let noteCount = 0;
    track.events.forEach(event => {
      if (event.channel !== undefined) {
        customChannels.add(event.channel);
      }
      if (event.type === 'noteOn' && event.velocity > 0) {
        noteCount++;
      }
    });
    console.log(`   Track ${idx}: ${track.events.length} events, ${noteCount} notes`);
  });

  console.log(`   Channels detected: [${Array.from(customChannels).sort((a,b) => a-b).join(', ')}]`);

} catch (error) {
  console.log(`   ❌ Error: ${error.message}`);
  console.log(error.stack);
}

// Compare results
console.log('\n' + '='.repeat(80));
console.log('📊 COMPARISON RESULTS:\n');

if (!midiFileResult || !customResult) {
  console.log('❌ One or both parsers failed. Cannot compare.\n');
  process.exit(1);
}

console.log(`Tracks:`);
console.log(`  midi-file:       ${midiFileResult.tracks.length}`);
console.log(`  CustomParser:    ${customResult.tracks.length}`);
console.log(`  Match: ${midiFileResult.tracks.length === customResult.tracks.length ? '✅' : '❌'}\n`);

console.log(`Channels:`);
console.log(`  midi-file:       ${midiFileChannels.size} channels - [${Array.from(midiFileChannels).sort((a,b) => a-b).join(', ')}]`);
console.log(`  CustomParser:    ${customChannels.size} channels - [${Array.from(customChannels).sort((a,b) => a-b).join(', ')}]`);
console.log(`  Match: ${midiFileChannels.size === customChannels.size ? '✅' : '❌'}\n`);

// Show sample events from both parsers
console.log('Sample events (first 5 with channel info):\n');

if (midiFileResult.tracks.length > 0) {
  console.log('  midi-file:');
  let count = 0;
  for (const event of midiFileResult.tracks[0]) {
    if (event.channel !== undefined && count < 5) {
      console.log(`    [${count}] type=${event.type}, ch=${event.channel}, ` +
                 `note=${event.noteNumber || 'N/A'}`);
      count++;
    }
  }
}

if (customResult.tracks.length > 0) {
  console.log('\n  CustomParser:');
  let count = 0;
  for (const event of customResult.tracks[0].events) {
    if (event.channel !== undefined && count < 5) {
      console.log(`    [${count}] type=${event.type}, ch=${event.channel}, ` +
                 `note=${event.noteNumber || 'N/A'}`);
      count++;
    }
  }
}

// Final verdict
console.log('\n' + '='.repeat(80));
console.log('💡 VERDICT:\n');

if (midiFileChannels.size > customChannels.size) {
  console.log('✅ midi-file detected MORE channels than CustomParser');
  console.log('   → midi-file is working correctly\n');
} else if (customChannels.size > midiFileChannels.size) {
  console.log('❌ CustomParser detected MORE channels than midi-file!');
  console.log('   → midi-file has a bug and is missing channel information');
  console.log('   → RECOMMENDATION: Use CustomMidiParser instead\n');
} else if (customChannels.size === midiFileChannels.size && customChannels.size > 1) {
  console.log('✅ Both parsers detected the same channels correctly\n');
} else {
  console.log('⚠️  Both parsers only detected', customChannels.size, 'channel(s)');
  console.log('   → The MIDI file itself may only have one channel');
  console.log('   → OR both parsers have the same bug (unlikely)\n');
}

console.log('='.repeat(80), '\n');
