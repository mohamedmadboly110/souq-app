'use strict';

const { param, body } = require('express-validator');

const idParam = (name = 'id') =>
  param(name)
    .isInt({ min: 1 }).withMessage(`${name} must be a positive integer`)
    .toInt();

const createRules = [
  body('name')
    .trim()
    .notEmpty().withMessage('name is required')
    .isLength({ max: 120 }).withMessage('name must be at most 120 characters'),
  body('slug')
    .optional({ nullable: true })
    .trim()
    .isLength({ max: 140 }).withMessage('slug must be at most 140 characters'),
  body('description')
    .optional({ nullable: true })
    .isString().withMessage('description must be a string')
    .isLength({ max: 2000 }).withMessage('description must be at most 2000 characters'),
];

const updateRules = [
  body('name')
    .optional()
    .trim()
    .notEmpty().withMessage('name cannot be empty')
    .isLength({ max: 120 }).withMessage('name must be at most 120 characters'),
  body('slug')
    .optional()
    .trim()
    .notEmpty().withMessage('slug cannot be empty')
    .isLength({ max: 140 }).withMessage('slug must be at most 140 characters'),
  body('description')
    .optional({ nullable: true })
    .isString().withMessage('description must be a string')
    .isLength({ max: 2000 }).withMessage('description must be at most 2000 characters'),
];

module.exports = { idParam, createRules, updateRules };
