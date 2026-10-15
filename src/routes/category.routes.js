'use strict';

const express = require('express');
const categoryController = require('../controllers/category.controller');
const { idParam, createRules, updateRules } = require('../validators/category.validator');
const validate = require('../middlewares/validate');
const { protect, authorize } = require('../middlewares/auth');

const router = express.Router();

router.get('/', categoryController.list);
router.get('/:id', idParam(), validate, categoryController.getById);

// Admin-only mutations
router.post('/', protect, authorize('admin'), createRules, validate, categoryController.create);
router.patch('/:id', protect, authorize('admin'), idParam(), updateRules, validate, categoryController.update);
router.delete('/:id', protect, authorize('admin'), idParam(), validate, categoryController.remove);

module.exports = router;
