'use strict';

const express = require('express');
const cartController = require('../controllers/cart.controller');
const { addItemRules, updateItemRules } = require('../validators/cart.validator');
const { idParam } = require('../validators/category.validator');
const validate = require('../middlewares/validate');
const { protect, authorize } = require('../middlewares/auth');

const router = express.Router();

// Every cart endpoint requires an authenticated customer.
router.use(protect, authorize('customer'));

router.get('/', cartController.getCart);
router.post('/items', addItemRules, validate, cartController.addItem);
router.patch('/items/:id', idParam(), updateItemRules, validate, cartController.updateItem);
router.delete('/items/:id', idParam(), validate, cartController.removeItem);
router.delete('/', cartController.clearCart);

module.exports = router;
