'use strict';

/**
 * Wrap an async route handler so rejected promises are forwarded to the
 * Express error handler instead of producing an unhandled rejection.
 *
 * @param {(req, res, next) => Promise<any>} fn
 */
function asyncHandler(fn) {
  return function wrapped(req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = asyncHandler;
