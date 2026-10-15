'use strict';

const { validationResult } = require('express-validator');
const ApiError = require('../utils/ApiError');
const ERROR_CODES = require('../constants/errorCodes');

/**
 * Run after express-validator chains. Aggregates validation failures into a
 * single 400 response with a stable code and a list of field errors.
 */
function validate(req, res, next) {
  const result = validationResult(req);
  if (result.isEmpty()) {
    return next();
  }
  const details = result.array().map((error) => ({
    field: error.path || error.param,
    message: error.msg,
    location: error.location,
  }));
  return next(ApiError.badRequest('Validation failed', ERROR_CODES.VALIDATION_ERROR, details));
}

module.exports = validate;
