'use strict';

const bcrypt = require('bcryptjs');
const config = require('../config/env');

/** Hash a plaintext password with the configured bcrypt cost. */
function hashPassword(plainPassword) {
  return bcrypt.hash(plainPassword, config.bcryptSaltRounds);
}

/** Constant-time comparison of a plaintext password against a stored hash. */
function comparePassword(plainPassword, passwordHash) {
  return bcrypt.compare(plainPassword, passwordHash);
}

module.exports = { hashPassword, comparePassword };
