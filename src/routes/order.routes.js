'use strict';

const express = require('express');
const orderController = require('../controllers/order.controller');
const { idParam } = require('../validators/category.validator');
const { createOrderRules, updateStatusRules, listQueryRules } = require('../validators/order.validator');
const validate = require('../middlewares/validate');
const { protect, authorize } = require('../middlewares/auth');

const router = express.Router();

router.use(protect);

// Customer endpoints
router.post('/', authorize('customer'), createOrderRules, validate, orderController.create);
router.get('/me', authorize('customer'), listQueryRules, validate, orderController.listMine);
router.get('/:id', authorize('customer', 'admin'), idParam(), validate, orderController.getById);
router.patch(
  '/:id/status',
  authorize('admin'),
  idParam(),
  updateStatusRules,
  validate,
  orderController.updateStatus,
);

module.exports = router;
