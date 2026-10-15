'use strict';

const db = require('../config/database');

const ITEM_COLUMNS = `
  ci.id,
  ci.cart_id,
  ci.product_id,
  ci.quantity,
  ci.created_at,
  ci.updated_at,
  p.name AS product_name,
  p.price AS unit_price,
  p.stock AS product_stock,
  p.is_active AS product_is_active,
  p.image_url AS product_image_url
`;

const ITEM_JOINS = 'JOIN products p ON p.id = ci.product_id';

const cartRepository = {
  async findByUserId(userId, client = db) {
    const { rows } = await client.query(
      'SELECT id, user_id, created_at, updated_at FROM carts WHERE user_id = $1',
      [userId],
    );
    return rows[0] || null;
  },

  /**
   * Return the cart for a user, creating it if necessary. Safe against
   * concurrent inserts thanks to `ON CONFLICT (user_id)`.
   */
  async getOrCreate(userId, client = db) {
    const { rows } = await client.query(
      `INSERT INTO carts (user_id) VALUES ($1)
       ON CONFLICT (user_id) DO UPDATE SET user_id = EXCLUDED.user_id
       RETURNING id, user_id, created_at, updated_at`,
      [userId],
    );
    return rows[0];
  },

  async listItems(cartId, client = db) {
    const { rows } = await client.query(
      `SELECT ${ITEM_COLUMNS}
         FROM cart_items ci ${ITEM_JOINS}
        WHERE ci.cart_id = $1
        ORDER BY ci.created_at ASC, ci.id ASC`,
      [cartId],
    );
    return rows;
  },

  async findItemById(itemId, client = db) {
    const { rows } = await client.query(
      `SELECT ${ITEM_COLUMNS}
         FROM cart_items ci ${ITEM_JOINS}
        WHERE ci.id = $1`,
      [itemId],
    );
    return rows[0] || null;
  },

  async findItemByProduct(cartId, productId, client = db) {
    const { rows } = await client.query(
      `SELECT ${ITEM_COLUMNS}
         FROM cart_items ci ${ITEM_JOINS}
        WHERE ci.cart_id = $1 AND ci.product_id = $2`,
      [cartId, productId],
    );
    return rows[0] || null;
  },

  /** Add a product or increase its quantity if already present. */
  async upsertItem(cartId, productId, quantity, client = db) {
    await client.query(
      `INSERT INTO cart_items (cart_id, product_id, quantity)
       VALUES ($1, $2, $3)
       ON CONFLICT (cart_id, product_id)
       DO UPDATE SET quantity = cart_items.quantity + EXCLUDED.quantity`,
      [cartId, productId, quantity],
    );
    return this.findItemByProduct(cartId, productId, client);
  },

  async setItemQuantity(itemId, quantity, client = db) {
    const { rows } = await client.query(
      'UPDATE cart_items SET quantity = $1 WHERE id = $2 RETURNING id',
      [quantity, itemId],
    );
    return rows[0] || null;
  },

  async removeItem(itemId, client = db) {
    const { rowCount } = await client.query('DELETE FROM cart_items WHERE id = $1', [itemId]);
    return rowCount > 0;
  },

  async clear(cartId, client = db) {
    await client.query('DELETE FROM cart_items WHERE cart_id = $1', [cartId]);
  },

  /**
   * Cart items together with their product rows, used by the order pipeline.
   * Product rows are locked separately (and in a consistent order) before this.
   */
  async getItemsWithProducts(cartId, client = db) {
    const { rows } = await client.query(
      `SELECT ci.id AS cart_item_id,
              ci.product_id,
              ci.quantity,
              p.name AS product_name,
              p.price,
              p.stock,
              p.is_active
         FROM cart_items ci
         JOIN products p ON p.id = ci.product_id
        WHERE ci.cart_id = $1
        ORDER BY ci.product_id ASC`,
      [cartId],
    );
    return rows;
  },
};

module.exports = cartRepository;
