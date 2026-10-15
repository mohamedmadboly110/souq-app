'use strict';

const { body } = require('express-validator');

const addItemRules = [
  body('productId')
    .exists().withMessage('productId is required')
    .isInt({ min: 1 }).withMessage('productId must be a positive integer')
    .toInt(),
  body('quantity')
    .exists().withMessage('quantity is required')
    .isInt({ min: 1, max: 1000 }).withMessage('quantity must be an integer between 1 and 1000')
    .toInt(),
];

const updateItemRules = [
  body('quantity')
    .exists().withMessage('quantity is required')
    .isInt({ min: 1, max: 1000 }).withMessage('quantity must be an integer between 1 and 1000')
    .toInt(),
];

module.exports = { addItemRules, updateItemRules };
