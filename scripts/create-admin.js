'use strict';

/**
 * Create (or promote) the initial administrator.
 *
 * There is intentionally NO public API that can create an admin. This script
 * is the documented, privileged mechanism: it must be run by someone with
 * access to the environment variables / server shell.
 *
 * Usage:
 *   node scripts/create-admin.js --email admin@example.com --name "Admin" --password "StrongPass123"
 * or with environment variables:
 *   ADMIN_EMAIL=... ADMIN_PASSWORD=... ADMIN_NAME=... npm run create-admin
 */

const bcrypt = require('bcryptjs');
const config = require('../src/config/env');
const { Pool } = require('pg');

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token.startsWith('--')) {
      const key = token.slice(2);
      const value = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : 'true';
      args[key] = value;
      if (value !== 'true') i += 1;
    }
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const email = (args.email || process.env.ADMIN_EMAIL || '').toLowerCase().trim();
  const password = args.password || process.env.ADMIN_PASSWORD || '';
  const name = (args.name || process.env.ADMIN_NAME || 'Souq Admin').trim();

  if (!email) {
    throw new Error('An admin email is required (--email or ADMIN_EMAIL).');
  }
  if (!password || password.length < 8) {
    throw new Error('A password of at least 8 characters is required (--password or ADMIN_PASSWORD).');
  }

  const pool = new Pool({ connectionString: config.database.url, ssl: config.database.ssl });
  const client = await pool.connect();

  try {
    const passwordHash = await bcrypt.hash(password, config.bcryptSaltRounds);

    const existing = await client.query('SELECT id, role FROM users WHERE email = $1', [email]);

    if (existing.rowCount > 0) {
      await client.query(
        'UPDATE users SET role = $1, password_hash = $2 WHERE id = $3',
        ['admin', passwordHash, existing.rows[0].id],
      );
      console.log(`Promoted existing user ${email} to admin and rotated the password.`);
    } else {
      await client.query(
        `INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, 'admin')`,
        [name, email, passwordHash],
      );
      console.log(`Created admin account ${email}.`);
    }
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(`\ncreate-admin error: ${error.message}`);
  process.exitCode = 1;
});
