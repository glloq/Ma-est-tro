// scripts/migrate-db.js
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DB_PATH = process.env.DB_PATH || './data/midimind.db';
const MIGRATIONS_DIR = path.join(__dirname, '../migrations');

function ensureDataDir() {
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`✓ Created data directory: ${dir}`);
  }
}

function connect() {
  try {
    const db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    console.log(`✓ Connected to database: ${DB_PATH}`);
    return db;
  } catch (error) {
    console.error(`✗ Failed to connect to database: ${error.message}`);
    process.exit(1);
  }
}

function initMigrationsTable(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      version INTEGER UNIQUE NOT NULL,
      name TEXT NOT NULL,
      executed_at TEXT NOT NULL
    )
  `);
  console.log('✓ Migrations table initialized');
}

function getCurrentVersion(db) {
  try {
    const result = db.prepare('SELECT MAX(version) as version FROM migrations').get();
    return result.version || 0;
  } catch (error) {
    return 0;
  }
}

function getMigrationFiles() {
  if (!fs.existsSync(MIGRATIONS_DIR)) {
    console.error(`✗ Migrations directory not found: ${MIGRATIONS_DIR}`);
    process.exit(1);
  }

  return fs.readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith('.sql'))
    .sort();
}

function runMigration(db, version, filename) {
  const filePath = path.join(MIGRATIONS_DIR, filename);
  const sql = fs.readFileSync(filePath, 'utf8');

  try {
    console.log(`→ Running migration ${version}: ${filename}`);
    
    // Run migration in transaction
    db.exec('BEGIN TRANSACTION');
    db.exec(sql);
    
    // Record migration
    const stmt = db.prepare(`
      INSERT INTO migrations (version, name, executed_at) 
      VALUES (?, ?, ?)
    `);
    stmt.run(version, filename, new Date().toISOString());
    
    db.exec('COMMIT');
    
    console.log(`✓ Migration ${version} completed`);
    return true;
  } catch (error) {
    db.exec('ROLLBACK');
    console.error(`✗ Migration ${version} failed: ${error.message}`);
    return false;
  }
}

function main() {
  console.log('=== MidiMind Database Migration ===\n');

  // Ensure data directory exists
  ensureDataDir();

  // Connect to database
  const db = connect();

  // Initialize migrations table
  initMigrationsTable(db);

  // Get current version
  const currentVersion = getCurrentVersion(db);
  console.log(`Current database version: ${currentVersion}\n`);

  // Get migration files
  const migrationFiles = getMigrationFiles();
  console.log(`Found ${migrationFiles.length} migration files\n`);

  // Run migrations
  let migrationsRun = 0;
  let failed = false;

  for (const file of migrationFiles) {
    const version = parseInt(file.split('_')[0]);
    
    if (version > currentVersion) {
      const success = runMigration(db, version, file);
      if (!success) {
        failed = true;
        break;
      }
      migrationsRun++;
    }
  }

  // Close database
  db.close();

  // Summary
  console.log('\n=== Migration Summary ===');
  if (failed) {
    console.log('✗ Migration failed');
    process.exit(1);
  } else if (migrationsRun === 0) {
    console.log('✓ Database is up to date');
  } else {
    console.log(`✓ Successfully ran ${migrationsRun} migration(s)`);
  }
  console.log(`Final version: ${getCurrentVersion(Database(DB_PATH))}`);
  process.exit(0);
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export default main;