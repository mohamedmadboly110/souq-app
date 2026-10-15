'use strict';

const { body } = require('express-validator');

const PASSWORD_MIN = 8;
const PASSWORD_MAX = 72; // bcrypt only uses the first 72 bytes

const registerRules = [
  body('name')
    .trim()
    .notEmpty().withMessage('name is required')
    .isLength({ min: 2, max: 120 }).withMessage('name must be between 2 and 120 characters'),
  body('email')
    .trim()
    .notEmpty().withMessage('email is required')
    .isEmail().withMessage('email must be a valid email address')
    .normalizeEmail({ gmail_remove_dots: false }),
  body('password')
    .isString().withMessage('password must be a string')
    .isLength({ min: PASSWORD_MIN, max: PASSWORD_MAX })
    .withMessage(`password must be between ${PASSWORD_MIN} and ${PASSWORD_MAX} characters`),
  body('role')
    .optional()
    .isIn(['customer', 'seller'])
    .withMessage('role must be either customer or seller'),
];

const loginRules = [
  body('email')
    .trim()
    .notEmpty().withMessage('email is required')
    .isEmail().withMessage('email must be a valid email address')
    .normalizeEmail({ gmail_remove_dots: false }),
  body('password')
    .isString().withMessage('password is required')
    .notEmpty().withMessage('password is required'),
];

module.exports = { registerRules, loginRules };
