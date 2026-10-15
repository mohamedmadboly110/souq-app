'use strict';

/**
 * Consistent API response helpers.
 *
 * Success: { success: true, data }
 * Error:   { success: false, message, error: { code, details? } }
 */

function success(res, data, statusCode = 200) {
  return res.status(statusCode).json({ success: true, data });
}

function created(res, data) {
  return success(res, data, 201);
}

function noContent(res) {
  return res.status(204).send();
}

function paginated(res, items, meta) {
  return res.status(200).json({
    success: true,
    data: items,
    meta,
  });
}

module.exports = { success, created, noContent, paginated };
