'use strict';

const db = require('../config/database');

// Whitelisted sort columns. Anything else falls back to created_at.
const SORT_COLUMNS = {
  price: 'p.price',
  name: 'p.name',
  created_at: 'p.created_at',
  stock: 'p.stock',
};

const SORT_DIRECTIONS = ['asc', 'desc'];

const SELECT_COLUMNS = `
  p.id,
  p.seller_id,
  p.category_id,
  p.name,
  p.description,
  p.price,
  p.stock,
  p.image_url,
  p.is_active,
  p.created_at,
  p.updated_at,
  c.name AS category_name,
  c.slug AS category_slug,
  u.name AS seller_name
`;

const JOINS = `
  JOIN categories c ON c.id = p.category_id
  JOIN users u ON u.id = p.seller_id
`;

function buildFilters(filters) {
  const conditions = [];
  const values = [];

  if (!filters.includeInactive) {
    conditions.push('p.is_active = TRUE');
  }
  if (filters.sellerId) {
    values.push(filters.sellerId);
    conditions.push(`p.seller_id = $${values.length}`);
  }
  if (filters.categoryId) {
    values.push(filters.categoryId);
    conditions.push(`p.category_id = $${values.length}`);
  }
  if (filters.categorySlug) {
    values.push(filters.categorySlug);
    conditions.push(`c.slug = $${values.length}`);
  }
  if (filters.minPrice !== undefined) {
    values.push(filters.minPrice);
    conditions.push(`p.price >= $${values.length}`);
  }
  if (filters.maxPrice !== undefined) {
    values.push(filters.maxPrice);
    conditions.push(`p.price <= $${values.length}`);
  }
  if (filters.search) {
    values.push(`%${filters.search}%`);
    conditions.push(`(p.name ILIKE $${values.length} OR p.description ILIKE $${values.length})`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  return { where, values };
}

const productRepository = {
  async findById(id, { includeInactive = true, client = db } = {}) {
    const activeClause = includeInactive ? '' : 'AND p.is_active = TRUE';
    const { rows } = await client.query(
      `SELECT ${SELECT_COLUMNS} FROM products p ${JOINS}
        WHERE p.id = $1 ${activeClause}`,
      [id],
    );
    return rows[0] || null;
  },

  /**
   * Paginated, filtered product listing.
   * @returns {Promise<{ items: object[], total: number }>}
   */
  async list(filters) {
    const { where, values } = buildFilters(filters);
    const sortColumn = SORT_COLUMNS[filters.sortBy] || SORT_COLUMNS.created_at;
    const direction = SORT_DIRECTIONS.includes(String(filters.order).toLowerCase())
      ? String(filters.order).toLowerCase()
      : 'desc';

    const countResult = await db.query(
      `SELECT COUNT(*)::int AS total FROM products p ${JOINS} ${where}`,
      values,
    );

    const limit = filters.limit;
    const offset = (filters.page - 1) * limit;

    const { rows } = await db.query(
      `SELECT ${SELECT_COLUMNS}
         FROM products p ${JOINS}
         ${where}
        ORDER BY ${sortColumn} ${direction.toUpperCase()}, p.id ASC
        LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
      [...values, limit, offset],
    );

    return { items: rows, total: countResult.rows[0].total };
  },

  async create({ sellerId, categoryId, name, description, price, stock, imageUrl, isActive }, client = db) {
    const { rows } = await client.query(
      `INSERT INTO products (seller_id, category_id, name, description, price, stock, image_url, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, COALESCE($8, TRUE))
       RETURNING id`,
      [sellerId, categoryId, name, description || null, price, stock, imageUrl || null, isActive],
    );
    return this.findById(rows[0].id, { client });
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
    await client.query(
      `UPDATE products SET ${sets.join(', ')} WHERE id = $${index}`,
      values,
    );
    return this.findById(id, { client });
  },

  async remove(id, client = db) {
    const { rowCount } = await client.query('DELETE FROM products WHERE id = $1', [id]);
    return rowCount > 0;
  },

  async countOrderItems(id, client = db) {
    const { rows } = await client.query(
      'SELECT COUNT(*)::int AS count FROM order_items WHERE product_id = $1',
      [id],
    );
    return rows[0].count;
  },

  /**
   * Atomic conditional stock decrement. Returns null when the row does not
   * exist or does not have enough stock at the moment of the update.
   */
  async decrementStock(id, quantity, client) {
    const { rows } = await client.query(
      `UPDATE products
          SET stock = stock - $1
        WHERE id = $2 AND is_active = TRUE AND stock >= $1
        RETURNING id, stock`,
      [quantity, id],
    );
    return rows[0] || null;
  },

  /** Restore stock after an order cancellation. */
  async incrementStock(id, quantity, client) {
    const { rows } = await client.query(
      `UPDATE products SET stock = stock + $1 WHERE id = $2 RETURNING id, stock`,
      [quantity, id],
    );
    return rows[0] || null;
  },

  /** Lock the given product rows for the duration of the transaction. */
  async lockByIds(ids, client) {
    if (ids.length === 0) return [];
    const { rows } = await client.query(
      `SELECT id, name, price, stock, is_active
         FROM products
        WHERE id = ANY($1::int[])
        ORDER BY id ASC
          FOR UPDATE`,
      [ids],
    );
    return rows;
  },
};

module.exports = productRepository;
