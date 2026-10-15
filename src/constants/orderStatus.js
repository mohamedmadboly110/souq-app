'use strict';

const ORDER_STATUS = Object.freeze({
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  PROCESSING: 'processing',
  SHIPPED: 'shipped',
  DELIVERED: 'delivered',
  CANCELLED: 'cancelled',
});

const ALL_STATUSES = Object.freeze(Object.values(ORDER_STATUS));

/**
 * Explicit, documented order state machine.
 *
 * pending    -> confirmed | cancelled
 * confirmed  -> processing | cancelled
 * processing -> shipped    | cancelled
 * shipped    -> delivered
 * delivered  -> (terminal)
 * cancelled  -> (terminal)
 *
 * Stock is restored exactly once when an order transitions to `cancelled`,
 * which can only happen from pending/confirmed/processing.
 */
const TRANSITIONS = Object.freeze({
  [ORDER_STATUS.PENDING]: [ORDER_STATUS.CONFIRMED, ORDER_STATUS.CANCELLED],
  [ORDER_STATUS.CONFIRMED]: [ORDER_STATUS.PROCESSING, ORDER_STATUS.CANCELLED],
  [ORDER_STATUS.PROCESSING]: [ORDER_STATUS.SHIPPED, ORDER_STATUS.CANCELLED],
  [ORDER_STATUS.SHIPPED]: [ORDER_STATUS.DELIVERED],
  [ORDER_STATUS.DELIVERED]: [],
  [ORDER_STATUS.CANCELLED]: [],
});

function canTransition(from, to) {
  const allowed = TRANSITIONS[from];
  return Array.isArray(allowed) && allowed.includes(to);
}

/** Statuses from which a cancellation (and therefore a stock restore) is legal. */
const CANCELLABLE_STATUSES = Object.freeze([
  ORDER_STATUS.PENDING,
  ORDER_STATUS.CONFIRMED,
  ORDER_STATUS.PROCESSING,
]);

function isCancellableFrom(status) {
  return CANCELLABLE_STATUSES.includes(status);
}

module.exports = {
  ORDER_STATUS,
  ALL_STATUSES,
  TRANSITIONS,
  CANCELLABLE_STATUSES,
  canTransition,
  isCancellableFrom,
};
