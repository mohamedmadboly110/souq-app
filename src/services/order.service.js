'use strict';

const db = require('../config/database');
const cartRepository = require('../repositories/cart.repository');
const productRepository = require('../repositories/product.repository');
const orderRepository = require('../repositories/order.repository');
const ApiError = require('../utils/ApiError');
const ERROR_CODES = require('../constants/errorCodes');
const { ORDER_STATUS, canTransition, isCancellableFrom } = require('../constants/orderStatus');

const orderService = {
  /**
   * Create an order from the customer's current cart inside a single
   * transaction.
   *
   * Steps (all on ONE checked-out client):
   *   1. read the cart and its items
   *   2. reject an empty cart
   *   3. lock every product row in a consistent (id ascending) order
   *   4. verify each product exists, is active and has enough stock
   *   5. create the order and the item snapshots (server-side pricing)
   *   6. atomically decrement stock (conditional update, no negative stock)
   *   7. empty the cart
   *   8. commit and return the created order
   *
   * Any failure rolls back everything: no partial order, no partial stock
   * change and no cart mutation.
   */
  async createOrder(user, { shippingAddress }) {
    return db.withTransaction(async (client) => {
      const cart = await cartRepository.findByUserId(user.id, client);
      if (!cart) {
        throw new ApiError(400, 'Your cart is empty', ERROR_CODES.EMPTY_CART);
      }

      const items = await cartRepository.getItemsWithProducts(cart.id, client);
      if (items.length === 0) {
        throw new ApiError(400, 'Your cart is empty', ERROR_CODES.EMPTY_CART);
      }

      // Lock products in ascending id order to reduce deadlocks between
      // concurrent checkouts that touch overlapping products.
      const productIds = [...new Set(items.map((item) => item.product_id))].sort((a, b) => a - b);
      const lockedProducts = await productRepository.lockByIds(productIds, client);
      const productsById = new Map(lockedProducts.map((product) => [product.id, product]));

      // Validate every product before writing anything.
      for (const item of items) {
        const product = productsById.get(item.product_id);
        if (!product || !product.is_active) {
          throw new ApiError(
            400,
            `Product is no longer available (id: ${item.product_id})`,
            ERROR_CODES.PRODUCT_NOT_AVAILABLE,
          );
        }
        if (product.stock < item.quantity) {
          throw new ApiError(
            400,
            `Insufficient stock for "${product.name}": requested ${item.quantity}, available ${product.stock}`,
            ERROR_CODES.INSUFFICIENT_STOCK,
            { productId: product.id, requested: item.quantity, available: product.stock },
          );
        }
      }

      // Authoritative totals computed by PostgreSQL, not by JavaScript.
      const totalsResult = await client.query(
        `SELECT COALESCE(SUM(p.price * ci.quantity), 0)::numeric(12, 2) AS total
           FROM cart_items ci
           JOIN products p ON p.id = ci.product_id
          WHERE ci.cart_id = $1`,
        [cart.id],
      );
      const totalAmount = totalsResult.rows[0].total;

      const order = await orderRepository.create(
        {
          customerId: user.id,
          totalAmount,
          shippingAddress: String(shippingAddress).trim(),
          status: ORDER_STATUS.PENDING,
        },
        client,
      );

      // Snapshot product name/price and compute line totals in NUMERIC.
      await orderRepository.createItemsFromCart(order.id, cart.id, client);

      // Decrement stock with an atomic conditional update. Because the rows
      // are already locked and validated, a missing row here would indicate a
      // logic error; we still treat it as insufficient stock defensively.
      for (const item of items) {
        const updated = await productRepository.decrementStock(item.product_id, item.quantity, client);
        if (!updated) {
          throw new ApiError(
            400,
            `Insufficient stock for product id ${item.product_id}`,
            ERROR_CODES.INSUFFICIENT_STOCK,
          );
        }
      }

      // Only clear the cart after every order operation has succeeded.
      await cartRepository.clear(cart.id, client);

      return orderRepository.findById(order.id, { client });
    });
  },

  /**
   * Fetch a single order. Customers may only read their own orders; admins may
   * read any order. Non-owners receive 404 so order ids are not disclosed.
   */
  async getOrder(user, id) {
    const order = await orderRepository.findById(id);
    if (!order) {
      throw ApiError.notFound('Order not found');
    }
    if (user.role === 'admin') return order;
    if (order.customer_id !== user.id) {
      throw ApiError.notFound('Order not found');
    }
    return order;
  },

  async listMyOrders(user, { page, limit, status }) {
    const result = await orderRepository.listByCustomer(user.id, { page, limit, status });
    return { items: result.items, total: result.total, page, limit };
  },

  async listAllOrders({ page, limit, status }) {
    const result = await orderRepository.listAll({ page, limit, status });
    return { items: result.items, total: result.total, page, limit };
  },

  /**
   * Admin-only status transition with an explicit state machine.
   *
   * Cancellation restores stock exactly once: it is only reachable from
   * pending/confirmed/processing, and `cancelled` is terminal, so a repeated
   * cancel request fails the transition check and cannot restore stock twice.
   */
  async updateStatus(id, nextStatus) {
    return db.withTransaction(async (client) => {
      const order = await orderRepository.findByIdForUpdate(id, client);
      if (!order) {
        throw ApiError.notFound('Order not found');
      }

      if (!canTransition(order.status, nextStatus)) {
        throw new ApiError(
          400,
          `Invalid status transition from "${order.status}" to "${nextStatus}"`,
          ERROR_CODES.INVALID_STATUS_TRANSITION,
          { from: order.status, to: nextStatus },
        );
      }

      if (nextStatus === ORDER_STATUS.CANCELLED && isCancellableFrom(order.status)) {
        const items = await orderRepository.getItemsForRestock(id, client);
        // Restore in ascending product id order for a consistent lock order.
        for (const item of items) {
          await productRepository.incrementStock(item.product_id, item.quantity, client);
        }
      }

      await orderRepository.updateStatus(id, nextStatus, client);
      return orderRepository.findById(id, { client });
    });
  },
};

module.exports = orderService;
