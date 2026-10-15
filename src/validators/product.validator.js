'use strict';

const { body, query } = require('express-validator');
const money = require('../utils/money');

const SORT_COLUMNS = ['price', 'name', 'created_at', 'stock'];
const SORT_ORDERS = ['asc', 'desc'];

// Normalise a valid money value to an exact decimal string. Invalid values are
// passed through untouched so the (already failed) validation message is used.
const normalizeMoney = (value) => (money.isValidMoney(value) ? money.formatCents(money.toCents(value)) : value);

const priceRule = (field, { required = false } = {}) => {
  let rule = body(field);
  if (required) {
    rule = rule.exists().withMessage(`${field} is required`);
  } else {
    rule = rule.optional();
  }
  return rule
    .custom((value) => money.isValidMoney(value))
    .withMessage(`${field} must be a non-negative number with up to 2 decimal places`)
    // Normalise to an exact decimal string so no float ever reaches the DB.
    .customSanitizer(normalizeMoney);
};

const createRules = [
  body('name')
    .trim()
    .notEmpty().withMessage('name is required')
    .isLength({ max: 200 }).withMessage('name must be at most 200 characters'),
  body('description')
    .optional({ nullable: true })
    .isString().withMessage('description must be a string')
    .isLength({ max: 5000 }).withMessage('description must be at most 5000 characters'),
  body('categoryId')
    .exists().withMessage('categoryId is required')
    .isInt({ min: 1 }).withMessage('categoryId must be a positive integer')
    .toInt(),
  priceRule('price', { required: true }),
  body('stock')
    .exists().withMessage('stock is required')
    .isInt({ min: 0 }).withMessage('stock must be a non-negative integer')
    .toInt(),
  body('imageUrl')
    .optional({ nullable: true })
    .isString().withMessage('imageUrl must be a string')
    .isLength({ max: 2048 }).withMessage('imageUrl must be at most 2048 characters'),
  body('isActive')
    .optional()
    .isBoolean().withMessage('isActive must be a boolean')
    .toBoolean(),
];

const updateRules = [
  body('name')
    .optional()
    .trim()
    .notEmpty().withMessage('name cannot be empty')
    .isLength({ max: 200 }).withMessage('name must be at most 200 characters'),
  body('description')
    .optional({ nullable: true })
    .isString().withMessage('description must be a string')
    .isLength({ max: 5000 }).withMessage('description must be at most 5000 characters'),
  body('categoryId')
    .optional()
    .isInt({ min: 1 }).withMessage('categoryId must be a positive integer')
    .toInt(),
  priceRule('price'),
  body('stock')
    .optional()
    .isInt({ min: 0 }).withMessage('stock must be a non-negative integer')
    .toInt(),
  body('imageUrl')
    .optional({ nullable: true })
    .isString().withMessage('imageUrl must be a string')
    .isLength({ max: 2048 }).withMessage('imageUrl must be at most 2048 characters'),
  body('isActive')
    .optional()
    .isBoolean().withMessage('isActive must be a boolean')
    .toBoolean(),
];

const listQueryRules = [
  query('category').optional().trim().isLength({ max: 140 }).withMessage('category is invalid'),
  query('categoryId')
    .optional()
    .isInt({ min: 1 }).withMessage('categoryId must be a positive integer')
    .toInt(),
  query('minPrice')
    .optional()
    .custom((value) => money.isValidMoney(value))
    .withMessage('minPrice must be a non-negative number with up to 2 decimal places')
    .customSanitizer(normalizeMoney),
  query('maxPrice')
    .optional()
    .custom((value) => money.isValidMoney(value))
    .withMessage('maxPrice must be a non-negative number with up to 2 decimal places')
    .customSanitizer(normalizeMoney),
  query('search').optional().trim().isLength({ max: 200 }).withMessage('search is too long'),
  query('mine')
    .optional()
    .isIn(['true', 'false', '1', '0']).withMessage('mine must be a boolean')
    .customSanitizer((value) => value === 'true' || value === '1'),
  query('page')
    .optional()
    .isInt({ min: 1 }).withMessage('page must be a positive integer')
    .toInt(),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 }).withMessage('limit must be between 1 and 100')
    .toInt(),
  query('sortBy')
    .optional()
    .isIn(SORT_COLUMNS).withMessage(`sortBy must be one of: ${SORT_COLUMNS.join(', ')}`),
  query('order')
    .optional()
    .isIn(SORT_ORDERS).withMessage(`order must be one of: ${SORT_ORDERS.join(', ')}`),
];

module.exports = { createRules, updateRules, listQueryRules };
