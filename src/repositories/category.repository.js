'use strict';

const db = require('../config/database');

const COLUMNS = 'id, name, slug, description, created_at, updated_at';

const categoryRepository = {
  async list(client = db) {
    const { rows } = await client.query(
      `SELECT ${COLUMNS} FROM categories ORDER BY name ASC`,
    );
    return rows;
  },

  async listWithProductCount() {
    const { rows } = await db.query(
      `SELECT c.id, c.name, c.slug, c.description, c.created_at, c.updated_at,
              COUNT(p.id)::int AS product_count
         FROM categories c
         LEFT JOIN products p ON p.category_id = c.id
        GROUP BY c.id
        ORDER BY c.name ASC`,
    );
    return rows;
  },

  async findById(id, client = db) {
    const { rows } = await client.query(
      `SELECT ${COLUMNS} FROM categories WHERE id = $1`,
      [id],
    );
    return rows[0] || null;
  },

  async findBySlug(slug, client = db) {
    const { rows } = await client.query(
      `SELECT ${COLUMNS} FROM categories WHERE slug = $1`,
      [slug],
    );
    return rows[0] || null;
  },

  async create({ name, slug, description }, client = db) {
    const { rows } = await client.query(
      `INSERT INTO categories (name, slug, description)
       VALUES ($1, $2, $3)
       RETURNING ${COLUMNS}`,
      [name, slug, description || null],
    );
    return rows[0];
  },

  async update(id, fields, client = db) {
    const sets = [];
    const values = [];
    let index = 1;
    for (const [column, value] of Object.entries(fields)) {
      sets.push(`${column} = $${index}`);
      values.push(value);
      index += 1;
    }
    values.push(id);
    const { rows } = await client.query(
      `UPDATE categories SET ${sets.join(', ')} WHERE id = $${index} RETURNING ${COLUMNS}`,
      values,
    );
    return rows[0] || null;
  },

  async remove(id, client = db) {
    const { rowCount } = await client.query('DELETE FROM categories WHERE id = $1', [id]);
    return rowCount > 0;
  },

  async countProducts(id, client = db) {
    const { rows } = await client.query(
      'SELECT COUNT(*)::int AS count FROM products WHERE category_id = $1',
      [id],
    );
    return rows[0].count;
  },
};

module.exports = categoryRepository;
