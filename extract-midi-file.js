#!/usr/bin/env node
// Extract MIDI file from database for testing
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

const dbPath = process.argv[2] || './data/midimind.db';
const fileIdOrName = process.argv[3];

if (!fileIdOrName) {
  console.log('Usage: node extract-midi-file.js [db-path] <file-id-or-name>');
  console.log('');
  console.log('Examples:');
  console.log('  node extract-midi-file.js 1');
  console.log('  node extract-midi-file.js mysong.midi');
  console.log('  node extract-midi-file.js ./data/midimind.db 1');
  console.log('');
  console.log('To list all files:');
  console.log('  node extract-midi-file.js list');
  process.exit(1);
}

if (!fs.existsSync(dbPath)) {
  console.error(`❌ Database not found: ${dbPath}`);
  process.exit(1);
}

const db = new Database(dbPath, { readonly: true });

// List all files
if (fileIdOrName === 'list') {
  console.log('\n📂 MIDI Files in database:\n');
  const files = db.prepare('SELECT id, filename, size, tracks, uploaded_at FROM midi_files ORDER BY id').all();

  if (files.length === 0) {
    console.log('  No files found in database.\n');
  } else {
    files.forEach(file => {
      console.log(`  [${file.id}] ${file.filename}`);
      console.log(`      Size: ${file.size} bytes, Tracks: ${file.tracks}, Uploaded: ${file.uploaded_at}`);
    });
    console.log('');
  }

  db.close();
  process.exit(0);
}

// Extract specific file
let file;

// Try as ID first
if (!isNaN(fileIdOrName)) {
  const fileId = parseInt(fileIdOrName);
  file = db.prepare('SELECT id, filename, data, size, tracks FROM midi_files WHERE id = ?').get(fileId);
} else {
  // Try as filename
  file = db.prepare('SELECT id, filename, data, size, tracks FROM midi_files WHERE filename = ?').get(fileIdOrName);
}

if (!file) {
  console.error(`❌ File not found: ${fileIdOrName}`);
  console.log('\nAvailable files:');
  const files = db.prepare('SELECT id, filename FROM midi_files').all();
  files.forEach(f => console.log(`  [${f.id}] ${f.filename}`));
  db.close();
  process.exit(1);
}

// Extract file
const buffer = Buffer.from(file.data, 'base64');
const outputPath = `./${file.filename}`;

fs.writeFileSync(outputPath, buffer);

console.log(`\n✅ File extracted successfully!`);
console.log(`   ID: ${file.id}`);
console.log(`   Name: ${file.filename}`);
console.log(`   Size: ${file.size} bytes`);
console.log(`   Tracks: ${file.tracks}`);
console.log(`   Output: ${outputPath}`);
console.log('');
console.log('Now you can test it with:');
console.log(`   node compare-parsers.js ${file.filename}`);
console.log('');

db.close();
