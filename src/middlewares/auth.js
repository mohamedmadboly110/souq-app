'use strict';

const { verifyToken, extractBearerToken } = require('../utils/jwt');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('./asyncHandler');
const userRepository = require('../repositories/user.repository');

/**
 * `protect` — requires a valid `Authorization: Bearer <token>` header.
 *
 * The token signature and expiry are verified, then the user is loaded from
 * the database so that a deleted user or a changed role cannot keep acting on
 * a stale token. Attaches `{ id, role, name, email }` to `req.user`.
 */
const protect = asyncHandler(async (req, res, next) => {
  const token = extractBearerToken(req.headers.authorization);
  if (!token) {
    throw ApiError.unauthorized('Authentication required');
  }

  const payload = verifyToken(token);
  const userId = payload.sub;
  if (userId === undefined || userId === null) {
    throw ApiError.unauthorized('Invalid token payload', 'INVALID_TOKEN');
  }

  const user = await userRepository.findById(userId);
  if (!user) {
    throw ApiError.unauthorized('User no longer exists', 'INVALID_TOKEN');
  }

  req.user = {
    id: user.id,
    role: user.role,
    name: user.name,
    email: user.email,
  };
  return next();
});

/**
 * `optionalAuth` — attaches `req.user` when a valid bearer token is present,
 * but never rejects the request. Used by public product endpoints that behave
 * slightly differently for the owning seller.
 */
const optionalAuth = async (req, res, next) => {
  const token = extractBearerToken(req.headers.authorization);
  if (!token) return next();

  try {
    const payload = verifyToken(token);
    const user = await userRepository.findById(payload.sub);
    if (user) {
      req.user = { id: user.id, role: user.role, name: user.name, email: user.email };
    }
  } catch (error) {
    // Ignore invalid/expired tokens for optional authentication.
  }
  return next();
};

/**
 * `authorize(...roles)` — must be used after `protect`.
 * Returns 403 when the authenticated user's role is not permitted.
 */
function authorize(...roles) {
  return function authorizeMiddleware(req, res, next) {
    if (!req.user) {
      return next(ApiError.unauthorized('Authentication required'));
    }
    if (roles.length > 0 && !roles.includes(req.user.role)) {
      return next(ApiError.forbidden('You do not have permission to perform this action'));
    }
    return next();
  };
}

module.exports = { protect, optionalAuth, authorize };
