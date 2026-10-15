'use strict';

const cartRepository = require('../repositories/cart.repository');
const productRepository = require('../repositories/product.repository');
const ApiError = require('../utils/ApiError');
const ERROR_CODES = require('../constants/errorCodes');
const { multiplyMoney, sumMoney } = require('../utils/money');

function mapItem(row) {
  const unitPrice = String(row.unit_price);
  const quantity = row.quantity;
  return {
    id: row.id,
    productId: row.product_id,
    productName: row.product_name,
    unitPrice,
    quantity,
    lineTotal: multiplyMoney(unitPrice, quantity),
    productStock: row.product_stock,
    productIsActive: row.product_is_active,
    imageUrl: row.product_image_url,
  };
}

function buildCart(cart, itemRows) {
  const items = itemRows.map(mapItem);
  return {
    id: cart ? cart.id : null,
    items,
    totalItems: items.reduce((total, item) => total + item.quantity, 0),
    subtotal: sumMoney(items.map((item) => item.lineTotal)),
    updatedAt: cart ? cart.updated_at : null,
  };
}

const cartService = {
  /** Return the customer's cart, creating an empty one on first access. */
  async getCart(userId) {
    const cart = await cartRepository.getOrCreate(userId);
    const items = await cartRepository.listItems(cart.id);
    return buildCart(cart, items);
  },

  async addItem(userId, { productId, quantity }) {
    const product = await productRepository.findById(productId, { includeInactive: true });
    if (!product || !product.is_active) {
      throw ApiError.notFound('Product not found');
    }

    const cart = await cartRepository.getOrCreate(userId);
    const existing = await cartRepository.findItemByProduct(cart.id, productId);
    const desiredQuantity = (existing ? existing.quantity : 0) + quantity;

    // Adding to the cart does NOT reserve stock, but we still surface an
    // obvious availability problem early. Stock is re-checked at order time.
    if (desiredQuantity > product.stock) {
      throw new ApiError(
        400,
        `Insufficient stock: only ${product.stock} unit(s) available`,
        ERROR_CODES.INSUFFICIENT_STOCK,
      );
    }

    const item = await cartRepository.upsertItem(cart.id, productId, quantity);
    return mapItem(item);
  },

  async updateItem(userId, itemId, quantity) {
    const item = await this.getOwnedItem(userId, itemId);
    const product = await productRepository.findById(item.product_id, { includeInactive: true });

    if (!product || !product.is_active) {
      throw ApiError.badRequest('Product is no longer available', ERROR_CODES.PRODUCT_NOT_AVAILABLE);
    }
    if (quantity > product.stock) {
      throw new ApiError(
        400,
        `Insufficient stock: only ${product.stock} unit(s) available`,
        ERROR_CODES.INSUFFICIENT_STOCK,
      );
    }

    await cartRepository.setItemQuantity(itemId, quantity);
    const updated = await cartRepository.findItemById(itemId);
    return mapItem(updated);
  },

  async removeItem(userId, itemId) {
    await this.getOwnedItem(userId, itemId);
    await cartRepository.removeItem(itemId);
    return true;
  },

  async clearCart(userId) {
    const cart = await cartRepository.findByUserId(userId);
    if (cart) {
      await cartRepository.clear(cart.id);
    } else {
      // Ensure a cart exists so subsequent GETs are consistent.
      await cartRepository.getOrCreate(userId);
    }
    return true;
  },

  /**
   * Resolve a cart item and confirm it belongs to the requesting user.
   * Returns 404 (not 403) so other users' item ids are not exposed.
   */
  async getOwnedItem(userId, itemId) {
    const item = await cartRepository.findItemById(itemId);
    if (!item) {
      throw ApiError.notFound('Cart item not found');
    }
    const cart = await cartRepository.findByUserId(userId);
    if (!cart || cart.id !== item.cart_id) {
      throw ApiError.notFound('Cart item not found');
    }
    return item;
  },
};

module.exports = cartService;
