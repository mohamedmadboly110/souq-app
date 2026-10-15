'use strict';

const ApiError = require('../utils/ApiError');
const ERROR_CODES = require('../constants/errorCodes');
const config = require('../config/env');

/**
 * Translate a raw PostgreSQL error into an operational ApiError where the
 * failure maps to a known constraint. Anything unmapped becomes a 500.
 */
function mapDatabaseError(err) {
  switch (err.code) {
    case '23505': // unique_violation
      return ApiError.conflict('A resource with these details already exists', ERROR_CODES.DUPLICATE_RESOURCE);
    case '23503': // foreign_key_violation
      return ApiError.badRequest('Referenced resource does not exist', ERROR_CODES.VALIDATION_ERROR);
    case '23514': // check_violation
      return ApiError.badRequest('Value violates a database constraint', ERROR_CODES.VALIDATION_ERROR);
    case '23502': // not_null_violation
      return ApiError.badRequest('A required field is missing', ERROR_CODES.VALIDATION_ERROR);
    case '22P02': // invalid_text_representation (e.g. non-numeric id)
      return ApiError.badRequest('Malformed input value', ERROR_CODES.VALIDATION_ERROR);
    case '22003': // numeric_value_out_of_range
      return ApiError.badRequest('Numeric value out of range', ERROR_CODES.VALIDATION_ERROR);
    default:
      return null;
  }
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  let error = err;

  // Malformed JSON body produced by express.json()
  if (error && error.type === 'entity.parse.failed') {
    error = ApiError.badRequest('Malformed JSON body', ERROR_CODES.VALIDATION_ERROR);
  }

  if (!(error instanceof ApiError) && error && error.code) {
    error = mapDatabaseError(error) || error;
  }

  if (!(error instanceof ApiError)) {
    // Unknown/unexpected error: log it, never leak it to the client.
    // eslint-disable-next-line no-console
    console.error('[error] Unhandled error:', error);
    error = ApiError.internal(config.isProduction ? 'Internal server error' : (err && err.message) || 'Internal server error');
  }

  const body = {
    success: false,
    message: error.message,
    error: { code: error.code },
  };
  if (error.details !== undefined) {
    body.error.details = error.details;
  }

  if (!config.isProduction && !error.isOperational) {
    body.error.stack = err.stack;
  }

  return res.status(error.statusCode).json(body);
}

module.exports = errorHandler;
