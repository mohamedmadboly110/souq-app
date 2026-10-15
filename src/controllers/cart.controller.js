'use strict';

const cartService = require('../services/cart.service');
const asyncHandler = require('../middlewares/asyncHandler');
const { success, created, noContent } = require('../utils/response');

const cartController = {
  getCart: asyncHandler(async (req, res) => {
    const cart = await cartService.getCart(req.user.id);
    return success(res, cart);
  }),

  addItem: asyncHandler(async (req, res) => {
    const item = await cartService.addItem(req.user.id, {
      productId: req.body.productId,
      quantity: req.body.quantity,
    });
    return created(res, item);
  }),

  updateItem: asyncHandler(async (req, res) => {
    const item = await cartService.updateItem(req.user.id, req.params.id, req.body.quantity);
    return success(res, item);
  }),

  removeItem: asyncHandler(async (req, res) => {
    await cartService.removeItem(req.user.id, req.params.id);
    return noContent(res);
  }),

  clearCart: asyncHandler(async (req, res) => {
    await cartService.clearCart(req.user.id);
    return noContent(res);
  }),
};

module.exports = cartController;
