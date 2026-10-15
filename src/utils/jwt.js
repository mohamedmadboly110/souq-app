'use strict';

const jwt = require('jsonwebtoken');
const config = require('../config/env');
const ApiError = require('./ApiError');

/**
 * Sign a JWT for an authenticated user.
 * Only non-sensitive claims are embedded (id + role).
 */
function signToken(user) {
  return jwt.sign(
    { sub: user.id, role: user.role },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn },
  );
}

/**
 * Verify a JWT and return its payload, or throw a 401 ApiError.
 */
function verifyToken(token) {
  try {
    return jwt.verify(token, config.jwt.secret);
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw ApiError.unauthorized('Token expired', 'TOKEN_EXPIRED');
    }
    throw ApiError.unauthorized('Invalid or malformed token', 'INVALID_TOKEN');
  }
}

/**
 * Extract a bearer token from an Authorization header.
 * @returns {string|null}
 */
function extractBearerToken(headerValue) {
  if (!headerValue || typeof headerValue !== 'string') return null;
  const [scheme, token] = headerValue.split(' ');
  if (!scheme || scheme.toLowerCase() !== 'bearer' || !token) return null;
  return token.trim() || null;
}

module.exports = { signToken, verifyToken, extractBearerToken };
