'use strict';

const { Pool } = require('pg');
const config = require('./env');

/**
 * Single shared connection pool for the whole application.
 *
 * All queries use parameterized placeholders ($1, $2, ...) so user input is
 * never interpolated into SQL text.
 *
 * Transactions must NOT run through the pool directly: use `withTransaction`
 * which checks out a single client for the duration of the transaction.
 */
const pool = new Pool({
  connectionString: config.database.url,
  ssl: config.database.ssl,
  max: config.database.poolMax,
  idleTimeoutMillis: config.database.idleTimeoutMillis,
  connectionTimeoutMillis: config.database.connectionTimeoutMillis,
});

pool.on('error', (err) => {
  // An idle client in the pool errored. Log it so it is not swallowed.
  // eslint-disable-next-line no-console
  console.error('[db] Unexpected error on idle client', err.message);
});

/**
 * Run a parameterized query using the shared pool.
 * @param {string} text
 * @param {Array} [params]
 */
function query(text, params) {
  return pool.query(text, params);
}

/**
 * Execute a callback inside a database transaction.
 *
 * The callback receives a dedicated client. If it throws, the transaction is
 * rolled back and the error is re-thrown. `BEGIN`, `COMMIT` and `ROLLBACK` are
 * always issued on the SAME checked-out client.
 *
 * @template T
 * @param {(client: import('pg').PoolClient) => Promise<T>} callback
 * @returns {Promise<T>}
 */
async function withTransaction(callback) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackError) {
      // Surface the original error; log the rollback failure separately.
      // eslint-disable-next-line no-console
      console.error('[db] Rollback failed:', rollbackError.message);
    }
    throw error;
  } finally {
    client.release();
  }
}

/** Lightweight database readiness probe. */
async function checkConnection() {
  const result = await pool.query('SELECT 1 AS ok');
  return result.rows[0].ok === 1;
}

async function closePool() {
  await pool.end();
}

module.exports = {
  pool,
  query,
  withTransaction,
  checkConnection,
  closePool,
};
