'use strict';

/**
 * Reusable migration runner logic, shared by the CLI (`database/migrate.js`)
 * and the automated tests.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

function checksum(content) {
  return crypto.createHash('sha256').update(content).digest('hex');
}

function listMigrationFiles() {
  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((file) => file.endsWith('.sql'))
    .sort((a, b) => a.localeCompare(b, 'en'));
}

async function ensureMigrationsTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
        id          SERIAL PRIMARY KEY,
        filename    VARCHAR(255) NOT NULL UNIQUE,
        checksum    VARCHAR(64) NOT NULL,
        applied_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
}

async function getApplied(client) {
  const { rows } = await client.query('SELECT filename, checksum FROM schema_migrations');
  return new Map(rows.map((row) => [row.filename, row.checksum]));
}

/**
 * Apply all pending migrations using the provided pool.
 * @param {{query: Function, connect: Function}} pool
 * @param {{log?: boolean}} [options]
 * @returns {Promise<number>} number of migrations applied
 */
async function applyMigrations(pool, { log = true } = {}) {
  const client = await pool.connect();
  let appliedCount = 0;
  try {
    await ensureMigrationsTable(client);
    const applied = await getApplied(client);

    for (const file of listMigrationFiles()) {
      const content = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
      const sum = checksum(content);

      if (applied.has(file)) {
        if (applied.get(file) !== sum && log) {
          // eslint-disable-next-line no-console
          console.warn(`! Warning: ${file} changed after being applied. Not re-running it.`);
        }
        continue;
      }

      if (log) process.stdout.write(`Applying ${file} ... `);
      try {
        await client.query('BEGIN');
        await client.query(content);
        await client.query('INSERT INTO schema_migrations (filename, checksum) VALUES ($1, $2)', [file, sum]);
        await client.query('COMMIT');
        if (log) console.log('ok');
        appliedCount += 1;
      } catch (error) {
        await client.query('ROLLBACK');
        if (log) console.log('FAILED');
        throw new Error(`Migration ${file} failed: ${error.message}`);
      }
    }
    return appliedCount;
  } finally {
    client.release();
  }
}

module.exports = { applyMigrations, listMigrationFiles, MIGRATIONS_DIR };
