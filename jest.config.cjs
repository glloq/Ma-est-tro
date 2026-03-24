/** @type {import('jest').Config} */

// Check if better-sqlite3 native bindings are available
let hasBetterSqlite = false;
try {
  const Database = require('better-sqlite3');
  // Actually try to create an in-memory database
  const db = new Database(':memory:');
  db.close();
  hasBetterSqlite = true;
} catch {
  // Native bindings not compiled
}

const ignorePatterns = ['/node_modules/', '/tests/frontend/', '/tests/audit-i18n.test.js'];

if (!hasBetterSqlite) {
  ignorePatterns.push('/tests/midi-filter.test.js');
}

module.exports = {
  testMatch: ['**/tests/**/*.test.js', '!**/tests/frontend/**'],
  testPathIgnorePatterns: ignorePatterns,
  transform: {},
};
