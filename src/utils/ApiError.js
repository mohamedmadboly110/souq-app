'use strict';

const ERROR_CODES = require('../constants/errorCodes');

/**
 * Application error with an HTTP status and a stable machine-readable code.
 * Thrown by services/repositories and translated into a JSON response by the
 * global error handler.
 */
class ApiError extends Error {
  /**
   * @param {number} statusCode HTTP status code
   * @param {string} message Human readable message
   * @param {string} [code] Stable machine readable code
   * @param {object} [details] Optional structured details (e.g. validation list)
   */
  constructor(statusCode, message, code = ERROR_CODES.INTERNAL_ERROR, details) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = code;
    if (details !== undefined) {
      this.details = details;
    }
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(message, code = ERROR_CODES.VALIDATION_ERROR, details) {
    return new ApiError(400, message, code, details);
  }

  static unauthorized(message = 'Authentication required', code = ERROR_CODES.UNAUTHORIZED) {
    return new ApiError(401, message, code);
  }

  static forbidden(message = 'You do not have permission to perform this action', code = ERROR_CODES.FORBIDDEN) {
    return new ApiError(403, message, code);
  }

  static notFound(message = 'Resource not found', code = ERROR_CODES.NOT_FOUND) {
    return new ApiError(404, message, code);
  }

  static conflict(message, code = ERROR_CODES.CONFLICT) {
    return new ApiError(409, message, code);
  }

  static internal(message = 'Internal server error', code = ERROR_CODES.INTERNAL_ERROR) {
    return new ApiError(500, message, code);
  }
}

module.exports = ApiError;
