'use strict';

const db = require('../config/database');

const SAFE_COLUMNS = 'id, name, email, role, created_at, updated_at';

const userRepository = {
  /** Find a user by id without exposing the password hash. */
  async findById(id, client = db) {
    const { rows } = await client.query(
      `SELECT ${SAFE_COLUMNS} FROM users WHERE id = $1`,
      [id],
    );
    return rows[0] || null;
  },

  /** Find a user by email including the password hash (login only). */
  async findByEmailWithPassword(email) {
    const { rows } = await db.query(
      `SELECT ${SAFE_COLUMNS}, password_hash FROM users WHERE email = $1`,
      [String(email).toLowerCase().trim()],
    );
    return rows[0] || null;
  },

  async emailExists(email) {
    const { rows } = await db.query('SELECT 1 FROM users WHERE email = $1', [
      String(email).toLowerCase().trim(),
    ]);
    return rows.length > 0;
  },

  /** Create a user. The caller must supply an already-hashed password. */
  async create({ name, email, passwordHash, role }) {
    const { rows } = await db.query(
      `INSERT INTO users (name, email, password_hash, role)
       VALUES ($1, $2, $3, $4)
       RETURNING ${SAFE_COLUMNS}`,
      [name, String(email).toLowerCase().trim(), passwordHash, role],
    );
    return rows[0];
  },
};

module.exports = userRepository;
