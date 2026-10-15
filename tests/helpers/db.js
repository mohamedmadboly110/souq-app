'use strict';

require('./testEnv');

const { Pool } = require('pg');
const { applyMigrations } = require('../../database/runner');

let pool;

function getPool() {
  if (!pool) {
    pool = new Pool({ connectionString: process.env.TEST_DATABASE_URL, ssl: false });
  }
  return pool;
}

/** Ensure the test schema is present (idempotent). */
async function setupDatabase() {
  await applyMigrations(getPool(), { log: false });
}

/** Truncate every table and reset identity columns. */
async function resetDatabase() {
  await getPool().query(`
    TRUNCATE TABLE order_items, orders, cart_items, carts, products, categories, users
    RESTART IDENTITY CASCADE;
  `);
}

/** Close the helper pool and the application pool so the process can exit. */
async function closeAll() {
  if (pool) {
    await pool.end();
    pool = null;
  }
  // Close the application's own pool (lazily created when the app served a request).
  const appDb = require('../../src/config/database');
  await appDb.closePool();
}

module.exports = { getPool, setupDatabase, resetDatabase, closeAll };
