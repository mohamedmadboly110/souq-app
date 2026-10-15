'use strict';

/**
 * Money handling.
 *
 * Design decision: all authoritative monetary arithmetic (line totals and
 * order totals) is performed by PostgreSQL using the NUMERIC type. The `pg`
 * driver returns NUMERIC values as strings, so no JavaScript floating point
 * maths is ever involved in the order pipeline.
 *
 * The helpers below are used to (a) validate monetary input before it reaches
 * the database and (b) format/aggregate amounts safely outside the database
 * when needed (for example, in tests). They use integer cents backed by
 * BigInt rather than floats.
 */

// Up to two decimal places, non-negative, no leading '+', no exponent.
const MONEY_REGEX = /^\d+(\.\d{1,2})?$/;

function isValidMoney(value) {
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value < 0) return false;
    // Reject values that cannot be represented with 2 decimals.
    return Number.isInteger(Math.round(value * 100)) && String(value).split('.').length <= 2;
  }
  if (typeof value === 'string') {
    return MONEY_REGEX.test(value.trim());
  }
  return false;
}

/**
 * Convert a money value to an integer number of cents (BigInt).
 * @param {string|number} value
 * @returns {bigint}
 */
function toCents(value) {
  if (!isValidMoney(value)) {
    throw new TypeError(`Invalid money value: ${value}`);
  }
  const [whole, fraction = ''] = String(value).trim().split('.');
  const paddedFraction = (fraction + '00').slice(0, 2);
  return BigInt(whole) * 100n + BigInt(paddedFraction);
}

/** Format an integer number of cents (BigInt|number) as a 2-decimal string. */
function formatCents(cents) {
  const value = BigInt(cents);
  const negative = value < 0n;
  const abs = negative ? -value : value;
  const whole = abs / 100n;
  const fraction = abs % 100n;
  return `${negative ? '-' : ''}${whole}.${fraction.toString().padStart(2, '0')}`;
}

/** Multiply a money value by an integer quantity without floating point error. */
function multiplyMoney(unitPrice, quantity) {
  return formatCents(toCents(unitPrice) * BigInt(quantity));
}

/** Sum a list of money values without floating point error. */
function sumMoney(values) {
  return formatCents(values.reduce((acc, value) => acc + toCents(value), 0n));
}

/** Sum the line totals of order line objects ({ unitPrice, quantity }). */
function sumLines(lines) {
  return sumMoney(
    lines.map((line) => multiplyMoney(line.unitPrice, line.quantity)),
  );
}

module.exports = {
  MONEY_REGEX,
  isValidMoney,
  toCents,
  formatCents,
  multiplyMoney,
  sumMoney,
  sumLines,
};
