'use strict';

const productService = require('../services/product.service');
const asyncHandler = require('../middlewares/asyncHandler');
const { success, created, paginated } = require('../utils/response');
const { buildPaginationMeta } = require('../utils/pagination');

const DEFAULTS = { page: 1, limit: 10, sortBy: 'created_at', order: 'desc' };

const productController = {
  list: asyncHandler(async (req, res) => {
    const filters = {
      page: req.query.page || DEFAULTS.page,
      limit: req.query.limit || DEFAULTS.limit,
      sortBy: req.query.sortBy || DEFAULTS.sortBy,
      order: req.query.order || DEFAULTS.order,
      category: req.query.category,
      categoryId: req.query.categoryId,
      minPrice: req.query.minPrice,
      maxPrice: req.query.maxPrice,
      search: req.query.search,
      mine: req.query.mine,
    };

    const { items, total } = await productService.list(filters, req.user);
    return paginated(res, items, buildPaginationMeta({ page: filters.page, limit: filters.limit, total }));
  }),

  getById: asyncHandler(async (req, res) => {
    const product = await productService.getById(req.params.id, req.user);
    return success(res, product);
  }),

  create: asyncHandler(async (req, res) => {
    const product = await productService.create(req.user, {
      categoryId: req.body.categoryId,
      name: req.body.name,
      description: req.body.description,
      price: req.body.price,
      stock: req.body.stock,
      imageUrl: req.body.imageUrl,
      isActive: req.body.isActive,
    });
    return created(res, product);
  }),

  update: asyncHandler(async (req, res) => {
    const product = await productService.update(req.user, req.params.id, req.body);
    return success(res, product);
  }),

  remove: asyncHandler(async (req, res) => {
    const result = await productService.remove(req.user, req.params.id);
    return success(res, result);
  }),
};

module.exports = productController;
