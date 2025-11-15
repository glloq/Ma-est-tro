#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'midimind.db');
const MIGRATIONS_DIR = path.join(__dirname, '..', 'migrations');

console.log('🔧 MidiMind Database Migration Tool');
console.log('====================================\n');

// Ensure data directory exists
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
  console.log(`✓ Created data directory: ${dataDir}`);
}

// Open database connection
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
console.log(`✓ Connected to database: ${DB_PATH}\n`);

// Get migration files
const migrationFiles = fs.readdirSync(MIGRATIONS_DIR)
  .filter(file => file.endsWith('.sql'))
  .sort();

console.log(`Found ${migrationFiles.length} migration files:\n`);

// Apply migrations
let appliedCount = 0;
let skippedCount = 0;

for (const file of migrationFiles) {
  const migrationPath = path.join(MIGRATIONS_DIR, file);
  const migrationNumber = parseInt(file.match(/^(\d+)/)[1]);
  
  // Check if migration already applied
  const existing = db.prepare('SELECT version FROM schema_version WHERE version = ?').get(migrationNumber);
  
  if (existing) {
    console.log(`⊘ ${file} - Already applied`);
    skippedCount++;
    continue;
  }
  
  // Read and execute migration
  const sql = fs.readFileSync(migrationPath, 'utf8');
  
  try {
    db.exec(sql);
    console.log(`✓ ${file} - Applied successfully`);
    appliedCount++;
  } catch (error) {
    console.error(`✗ ${file} - Failed:`, error.message);
    process.exit(1);
  }
}

console.log('\n====================================');
console.log(`✓ Migrations applied: ${appliedCount}`);
console.log(`⊘ Migrations skipped: ${skippedCount}`);

// Show current schema version
const currentVersion = db.prepare('SELECT MAX(version) as version FROM schema_version').get();
console.log(`✓ Current schema version: ${currentVersion.version}`);

// Show table count
const tableCount = db.prepare("SELECT COUNT(*) as count FROM sqlite_master WHERE type='table'").get();
console.log(`✓ Total tables: ${tableCount.count}`);

db.close();
console.log('\n✓ Database migration complete!\n');