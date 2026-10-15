'use strict';

/**
 * Migration runner CLI.
 *
 * - Reads `database/migrations/*.sql` in filename order (dependency order).
 * - Records applied files (with a SHA-256 checksum) in `schema_migrations`.
 * - Runs each pending migration inside its own transaction.
 * - Never drops existing data and never re-runs an applied migration.
 *
 * Usage:
 *   npm run migrate           # apply pending migrations
 *   npm run migrate:status    # list applied / pending migrations
 */

const { Pool } = require('pg');
const config = require('../src/config/env');
const { applyMigrations, listMigrationFiles } = require('./runner');

async function printStatus(pool) {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id SERIAL PRIMARY KEY,
        filename VARCHAR(255) NOT NULL UNIQUE,
        checksum VARCHAR(64) NOT NULL,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);
    const { rows } = await client.query('SELECT filename FROM schema_migrations');
    const applied = new Set(rows.map((row) => row.filename));
    const files = listMigrationFiles();

    console.log('\nMigration status:');
    console.log('-----------------------------------------------');
    for (const file of files) {
      console.log(`  [${applied.has(file) ? 'applied' : 'pending'}] ${file}`);
    }
    console.log('-----------------------------------------------');
    const pending = files.filter((file) => !applied.has(file)).length;
    console.log(`${applied.size} applied, ${pending} pending.\n`);
  } finally {
    client.release();
  }
}

async function run() {
  const pool = new Pool({ connectionString: config.database.url, ssl: config.database.ssl });
  try {
    if (process.argv.includes('--status')) {
      await printStatus(pool);
      return;
    }
    const count = await applyMigrations(pool, { log: true });
    console.log(
      count === 0
        ? 'No pending migrations. Database is up to date.'
        : `\nApplied ${count} migration(s) successfully.`,
    );
  } finally {
    await pool.end();
  }
}

run().catch((error) => {
  console.error(`\nMigration error: ${error.message}`);
  process.exitCode = 1;
});
