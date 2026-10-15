'use strict';

const ERROR_CODES = require('../constants/errorCodes');

/** Catch-all for unknown routes. */
function notFound(req, res) {
  return res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
    error: { code: ERROR_CODES.NOT_FOUND },
  });
}

module.exports = notFound;
