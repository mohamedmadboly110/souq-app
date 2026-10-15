'use strict';

const express = require('express');
const productController = require('../controllers/product.controller');
const { idParam } = require('../validators/category.validator');
const { createRules, updateRules, listQueryRules } = require('../validators/product.validator');
const validate = require('../middlewares/validate');
const { protect, optionalAuth, authorize } = require('../middlewares/auth');

const router = express.Router();

// Public browsing (optionalAuth lets a seller request `mine=true`).
router.get('/', optionalAuth, listQueryRules, validate, productController.list);
router.get('/:id', optionalAuth, idParam(), validate, productController.getById);

// Seller-owned mutations.
router.post('/', protect, authorize('seller'), createRules, validate, productController.create);
router.patch('/:id', protect, authorize('seller'), idParam(), updateRules, validate, productController.update);
router.delete('/:id', protect, authorize('seller'), idParam(), validate, productController.remove);

module.exports = router;
