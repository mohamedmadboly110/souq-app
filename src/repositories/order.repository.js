'use strict';

const db = require('../config/database');

const ORDER_COLUMNS = `
  o.id,
  o.customer_id,
  o.status,
  o.total_amount,
  o.shipping_address,
  o.created_at,
  o.updated_at,
  u.name AS customer_name,
  u.email AS customer_email
`;

const ITEM_COLUMNS = `
  oi.id,
  oi.order_id,
  oi.product_id,
  oi.product_name,
  oi.unit_price,
  oi.quantity,
  oi.line_total
`;

const orderRepository = {
  async create({ customerId, totalAmount, shippingAddress, status }, client) {
    const { rows } = await client.query(
      `INSERT INTO orders (customer_id, status, total_amount, shipping_address)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [customerId, status || 'pending', totalAmount, shippingAddress],
    );
    return rows[0];
  },

  /**
   * Copy cart items into order_items as purchase-time snapshots.
   *
   * The product name and price are taken from the products table at this exact
   * moment, and `line_total` is computed by PostgreSQL using NUMERIC
   * arithmetic so no JavaScript floating point is involved.
   */
  async createItemsFromCart(orderId, cartId, client) {
    await client.query(
      `INSERT INTO order_items (order_id, product_id, product_name, unit_price, quantity, line_total)
       SELECT $1, p.id, p.name, p.price, ci.quantity, (p.price * ci.quantity)
         FROM cart_items ci
         JOIN products p ON p.id = ci.product_id
        WHERE ci.cart_id = $2`,
      [orderId, cartId],
    );
  },

  async findById(id, { includeItems = true, client = db } = {}) {
    const { rows } = await client.query(
      `SELECT ${ORDER_COLUMNS}
         FROM orders o
         JOIN users u ON u.id = o.customer_id
        WHERE o.id = $1`,
      [id],
    );
    const order = rows[0];
    if (!order) return null;

    if (includeItems) {
      const items = await client.query(
        `SELECT ${ITEM_COLUMNS} FROM order_items oi WHERE oi.order_id = $1 ORDER BY oi.id ASC`,
        [id],
      );
      order.items = items.rows;
    }
    return order;
  },

  /** Lock an order row for a status transition inside a transaction. */
  async findByIdForUpdate(id, client) {
    const { rows } = await client.query(
      `SELECT id, customer_id, status, total_amount, shipping_address
         FROM orders WHERE id = $1 FOR UPDATE`,
      [id],
    );
    return rows[0] || null;
  },

  async updateStatus(id, status, client) {
    const { rows } = await client.query(
      `UPDATE orders SET status = $1 WHERE id = $2
       RETURNING id, customer_id, status, total_amount, shipping_address, created_at, updated_at`,
      [status, id],
    );
    return rows[0] || null;
  },

  async listByCustomer(customerId, { page, limit, status }) {
    const values = [customerId];
    let where = 'WHERE o.customer_id = $1';
    if (status) {
      values.push(status);
      where += ` AND o.status = $${values.length}`;
    }
    return this.paginate(where, values, { page, limit });
  },

  async listAll({ status, page, limit }) {
    const values = [];
    let where = '';
    if (status) {
      values.push(status);
      where = `WHERE o.status = $${values.length}`;
    }
    return this.paginate(where, values, { page, limit });
  },

  async paginate(where, values, { page, limit }) {
    const countResult = await db.query(
      `SELECT COUNT(*)::int AS total FROM orders o ${where}`,
      values,
    );
    const offset = (page - 1) * limit;
    const { rows } = await db.query(
      `SELECT ${ORDER_COLUMNS}
         FROM orders o
         JOIN users u ON u.id = o.customer_id
         ${where}
        ORDER BY o.created_at DESC, o.id DESC
        LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
      [...values, limit, offset],
    );
    return { items: rows, total: countResult.rows[0].total };
  },

  /** Items to restock when an order is cancelled. */
  async getItemsForRestock(orderId, client) {
    const { rows } = await client.query(
      `SELECT product_id, quantity
         FROM order_items
        WHERE order_id = $1 AND product_id IS NOT NULL
        ORDER BY product_id ASC`,
      [orderId],
    );
    return rows;
  },
};

module.exports = orderRepository;
