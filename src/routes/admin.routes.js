'use strict';

const express = require('express');
const orderController = require('../controllers/order.controller');
const { listQueryRules } = require('../validators/order.validator');
const validate = require('../middlewares/validate');
const { protect, authorize } = require('../middlewares/auth');

const router = express.Router();

// Admin-only order management.
router.get('/orders', protect, authorize('admin'), listQueryRules, validate, orderController.adminList);

module.exports = router;
