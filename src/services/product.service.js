'use strict';

const productRepository = require('../repositories/product.repository');
const categoryRepository = require('../repositories/category.repository');
const ApiError = require('../utils/ApiError');
const ERROR_CODES = require('../constants/errorCodes');

const productService = {
  /**
   * Public listing: customers only ever see active products.
   * A seller may request `mine=true` to include their own inactive products.
   */
  async list(filters, user) {
    const query = {
      includeInactive: false,
      page: filters.page,
      limit: filters.limit,
      sortBy: filters.sortBy,
      order: filters.order,
      categoryId: filters.categoryId,
      categorySlug: filters.category,
      minPrice: filters.minPrice,
      maxPrice: filters.maxPrice,
      search: filters.search,
    };

    if (filters.mine) {
      if (!user || user.role !== 'seller') {
        throw ApiError.forbidden('Only sellers can list their own products');
      }
      query.sellerId = user.id;
      query.includeInactive = true;
    }

    return productRepository.list(query);
  },

  async getById(id, user) {
    const product = await productRepository.findById(id, { includeInactive: true });
    if (!product) {
      throw ApiError.notFound('Product not found');
    }

    // Inactive products are hidden from customers and other sellers.
    if (!product.is_active) {
      const isOwner = user && user.id === product.seller_id;
      const isAdmin = user && user.role === 'admin';
      if (!isOwner && !isAdmin) {
        throw ApiError.notFound('Product not found');
      }
    }

    return product;
  },

  async create(user, payload) {
    const category = await categoryRepository.findById(payload.categoryId);
    if (!category) {
      throw ApiError.badRequest('Category does not exist', ERROR_CODES.VALIDATION_ERROR);
    }

    // Ownership always comes from the authenticated user, never the client.
    return productRepository.create({
      sellerId: user.id,
      categoryId: payload.categoryId,
      name: String(payload.name).trim(),
      description: payload.description,
      price: payload.price,
      stock: payload.stock,
      imageUrl: payload.imageUrl,
      isActive: payload.isActive,
    });
  },

  async update(user, id, payload) {
    const product = await productRepository.findById(id, { includeInactive: true });
    if (!product) {
      throw ApiError.notFound('Product not found');
    }
    if (product.seller_id !== user.id) {
      throw ApiError.forbidden('You can only manage your own products');
    }

    const fields = {};
    if (payload.name !== undefined) fields.name = String(payload.name).trim();
    if (payload.description !== undefined) fields.description = payload.description;
    if (payload.price !== undefined) fields.price = payload.price;
    if (payload.stock !== undefined) fields.stock = payload.stock;
    if (payload.imageUrl !== undefined) fields.image_url = payload.imageUrl;
    if (payload.isActive !== undefined) fields.is_active = payload.isActive;
    if (payload.categoryId !== undefined) {
      const category = await categoryRepository.findById(payload.categoryId);
      if (!category) {
        throw ApiError.badRequest('Category does not exist', ERROR_CODES.VALIDATION_ERROR);
      }
      fields.category_id = payload.categoryId;
    }

    if (Object.keys(fields).length === 0) {
      return product;
    }

    return productRepository.update(id, fields);
  },

  /**
   * Deletion policy:
   *  - If the product has never been ordered, remove the row permanently.
   *  - Otherwise archive it (is_active = false) so order history keeps a valid
   *    product reference. `order_items` already stores a name/price snapshot.
   */
  async remove(user, id) {
    const product = await productRepository.findById(id, { includeInactive: true });
    if (!product) {
      throw ApiError.notFound('Product not found');
    }
    if (product.seller_id !== user.id) {
      throw ApiError.forbidden('You can only manage your own products');
    }

    const orderItemCount = await productRepository.countOrderItems(id);
    if (orderItemCount > 0) {
      await productRepository.update(id, { is_active: false, stock: 0 });
      return { id, deleted: false, archived: true };
    }

    await productRepository.remove(id);
    return { id, deleted: true, archived: false };
  },
};

module.exports = productService;
