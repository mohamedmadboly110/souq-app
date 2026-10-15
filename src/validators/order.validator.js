'use strict';

const { body, query } = require('express-validator');
const { ALL_STATUSES } = require('../constants/orderStatus');

const createOrderRules = [
  body('shippingAddress')
    .trim()
    .notEmpty().withMessage('shippingAddress is required')
    .isLength({ min: 10, max: 500 })
    .withMessage('shippingAddress must be between 10 and 500 characters'),
];

const updateStatusRules = [
  body('status')
    .exists().withMessage('status is required')
    .isIn(ALL_STATUSES).withMessage(`status must be one of: ${ALL_STATUSES.join(', ')}`),
];

const listQueryRules = [
  query('status')
    .optional()
    .isIn(ALL_STATUSES).withMessage(`status must be one of: ${ALL_STATUSES.join(', ')}`),
  query('page')
    .optional()
    .isInt({ min: 1 }).withMessage('page must be a positive integer')
    .toInt(),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 }).withMessage('limit must be between 1 and 100')
    .toInt(),
];

module.exports = { createOrderRules, updateStatusRules, listQueryRules };
