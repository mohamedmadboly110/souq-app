'use strict';

const orderService = require('../services/order.service');
const asyncHandler = require('../middlewares/asyncHandler');
const { success, created, paginated } = require('../utils/response');
const { buildPaginationMeta } = require('../utils/pagination');

const DEFAULTS = { page: 1, limit: 10 };

const orderController = {
  create: asyncHandler(async (req, res) => {
    const order = await orderService.createOrder(req.user, {
      shippingAddress: req.body.shippingAddress,
    });
    return created(res, order);
  }),

  listMine: asyncHandler(async (req, res) => {
    const page = req.query.page || DEFAULTS.page;
    const limit = req.query.limit || DEFAULTS.limit;
    const { items, total } = await orderService.listMyOrders(req.user, {
      page,
      limit,
      status: req.query.status,
    });
    return paginated(res, items, buildPaginationMeta({ page, limit, total }));
  }),

  getById: asyncHandler(async (req, res) => {
    const order = await orderService.getOrder(req.user, req.params.id);
    return success(res, order);
  }),

  adminList: asyncHandler(async (req, res) => {
    const page = req.query.page || DEFAULTS.page;
    const limit = req.query.limit || DEFAULTS.limit;
    const { items, total } = await orderService.listAllOrders({
      page,
      limit,
      status: req.query.status,
    });
    return paginated(res, items, buildPaginationMeta({ page, limit, total }));
  }),

  updateStatus: asyncHandler(async (req, res) => {
    const order = await orderService.updateStatus(req.params.id, req.body.status);
    return success(res, order);
  }),
};

module.exports = orderController;
