'use strict';

const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const {
  app, request, registerUser, createAdmin, createCategory, createProduct, getProduct, countOrders,
} = require('./helpers/factories');
const db = require('./helpers/db');

let seller;
let customer;
let otherCustomer;
let admin;
let category;
const SHIPPING = '221B Baker Street, London, NW1 6XE';

async function addToCart(auth, productId, quantity) {
  const res = await request(app).post('/api/cart/items').set(auth).send({ productId, quantity });
  assert.equal(res.status, 201, `addToCart failed: ${JSON.stringify(res.body)}`);
  return res.body.data;
}

async function placeOrder(auth, shippingAddress = SHIPPING) {
  return request(app).post('/api/orders').set(auth).send({ shippingAddress });
}

before(async () => {
  await db.setupDatabase();
});

beforeEach(async () => {
  await db.resetDatabase();
  seller = await registerUser({ role: 'seller' });
  customer = await registerUser({ role: 'customer' });
  otherCustomer = await registerUser({ role: 'customer' });
  admin = await createAdmin({});
  category = await createCategory({ name: 'Electronics' });
});

after(async () => {
  await db.closeAll();
});

describe('Order creation', () => {
  it('rejects an empty cart (400)', async () => {
    const res = await placeOrder(customer.auth);
    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, 'EMPTY_CART');
  });

  it('creates an order, calculates totals server-side, decrements stock and clears the cart', async () => {
    const product = await createProduct({ sellerId: seller.user.id, categoryId: category.id, price: '25.50', stock: 10 });
    await addToCart(customer.auth, product.id, 3);

    const res = await placeOrder(customer.auth);

    assert.equal(res.status, 201);
    assert.equal(res.body.data.status, 'pending');
    assert.equal(res.body.data.total_amount, '76.50');
    assert.equal(res.body.data.shipping_address, SHIPPING);
    assert.equal(res.body.data.items.length, 1);
    assert.equal(res.body.data.items[0].unit_price, '25.50');
    assert.equal(res.body.data.items[0].line_total, '76.50');
    assert.equal(res.body.data.items[0].product_name, product.name);

    const after = await getProduct(product.id);
    assert.equal(after.stock, 7, 'stock should decrease by the ordered quantity');

    const cart = await request(app).get('/api/cart').set(customer.auth);
    assert.equal(cart.body.data.items.length, 0, 'cart should be cleared after a successful order');
  });

  it('preserves the product name and price snapshot even if the product later changes', async () => {
    const product = await createProduct({ sellerId: seller.user.id, categoryId: category.id, price: '30.00', stock: 5 });
    await addToCart(customer.auth, product.id, 1);
    const order = await placeOrder(customer.auth);
    assert.equal(order.body.data.items[0].unit_price, '30.00');

    // Seller changes the price afterwards.
    await request(app).patch(`/api/products/${product.id}`).set(seller.auth).send({ price: '99.00' });

    const fetched = await request(app).get(`/api/orders/${order.body.data.id}`).set(customer.auth);
    assert.equal(fetched.body.data.items[0].unit_price, '30.00', 'historical price must not change');
  });

  it('ignores client-supplied totals: the server computes the amount', async () => {
    const product = await createProduct({ sellerId: seller.user.id, categoryId: category.id, price: '15.00', stock: 10 });
    await addToCart(customer.auth, product.id, 2);

    const res = await request(app).post('/api/orders').set(customer.auth).send({
      shippingAddress: SHIPPING,
      totalAmount: '0.01',
      status: 'delivered',
    });

    assert.equal(res.status, 201);
    assert.equal(res.body.data.total_amount, '30.00');
    assert.equal(res.body.data.status, 'pending');
  });

  it('rejects an order when stock dropped after the item was added to the cart (400)', async () => {
    const product = await createProduct({ sellerId: seller.user.id, categoryId: category.id, price: '10.00', stock: 5 });
    await addToCart(customer.auth, product.id, 4);

    // Seller reduces stock below the requested quantity.
    await request(app).patch(`/api/products/${product.id}`).set(seller.auth).send({ stock: 1 });

    const res = await placeOrder(customer.auth);
    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, 'INSUFFICIENT_STOCK');
  });

  it('rejects ordering an inactive product', async () => {
    const product = await createProduct({ sellerId: seller.user.id, categoryId: category.id, stock: 5 });
    await addToCart(customer.auth, product.id, 1);
    await request(app).patch(`/api/products/${product.id}`).set(seller.auth).send({ isActive: false });

    const res = await placeOrder(customer.auth);
    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, 'PRODUCT_NOT_AVAILABLE');
  });

  it('only customers can create orders (sellers get 403)', async () => {
    const res = await placeOrder(seller.auth);
    assert.equal(res.status, 403);
  });
});

describe('Order transactions and rollback', () => {
  it('rolls back completely when order creation fails mid-transaction', async () => {
    // A price * quantity that overflows NUMERIC(12,2) forces a database error
    // AFTER the order row and item rows have started to be written.
    const product = await createProduct({
      sellerId: seller.user.id, categoryId: category.id, price: '99999999.99', stock: 1000,
    });
    await addToCart(customer.auth, product.id, 1000);

    const before = await getProduct(product.id);
    const res = await placeOrder(customer.auth);

    assert.equal(res.status, 400, `expected failure, got ${res.status}`);
    assert.equal(await countOrders(), 0, 'no partial order should exist');

    const after = await getProduct(product.id);
    assert.equal(after.stock, before.stock, 'stock must be unchanged after a rolled-back order');

    const cart = await request(app).get('/api/cart').set(customer.auth);
    assert.equal(cart.body.data.items.length, 1, 'cart must not be cleared when the order fails');
  });

  it('prevents overselling when two customers buy the last unit concurrently', async () => {
    const product = await createProduct({ sellerId: seller.user.id, categoryId: category.id, price: '10.00', stock: 1 });
    await addToCart(customer.auth, product.id, 1);
    await addToCart(otherCustomer.auth, product.id, 1);

    const [first, second] = await Promise.all([
      placeOrder(customer.auth),
      placeOrder(otherCustomer.auth),
    ]);

    const statuses = [first.status, second.status].sort((a, b) => a - b);
    assert.deepEqual(statuses, [201, 400], 'exactly one order should succeed');

    const failed = first.status === 400 ? first : second;
    assert.equal(failed.body.error.code, 'INSUFFICIENT_STOCK');

    const after = await getProduct(product.id);
    assert.equal(after.stock, 0, 'stock must never go negative');
  });
});

describe('Order access control', () => {
  it('lets a customer read only their own orders', async () => {
    const product = await createProduct({ sellerId: seller.user.id, categoryId: category.id, stock: 5 });
    await addToCart(customer.auth, product.id, 1);
    const order = await placeOrder(customer.auth);
    const orderId = order.body.data.id;

    const owner = await request(app).get(`/api/orders/${orderId}`).set(customer.auth);
    assert.equal(owner.status, 200);

    const stranger = await request(app).get(`/api/orders/${orderId}`).set(otherCustomer.auth);
    assert.equal(stranger.status, 404, 'must not disclose another customer order');

    const asAdmin = await request(app).get(`/api/orders/${orderId}`).set(admin.auth);
    assert.equal(asAdmin.status, 200);
  });

  it('lists only the current customer orders via /api/orders/me', async () => {
    const product = await createProduct({ sellerId: seller.user.id, categoryId: category.id, stock: 10 });
    await addToCart(customer.auth, product.id, 1);
    await placeOrder(customer.auth);

    const mine = await request(app).get('/api/orders/me').set(customer.auth);
    const others = await request(app).get('/api/orders/me').set(otherCustomer.auth);

    assert.equal(mine.status, 200);
    assert.equal(mine.body.data.length, 1);
    assert.equal(others.body.data.length, 0);
  });

  it('lets admins list all orders and restricts the endpoint to admins', async () => {
    const product = await createProduct({ sellerId: seller.user.id, categoryId: category.id, stock: 10 });
    await addToCart(customer.auth, product.id, 1);
    await placeOrder(customer.auth);

    const asAdmin = await request(app).get('/api/admin/orders').set(admin.auth);
    assert.equal(asAdmin.status, 200);
    assert.equal(asAdmin.body.data.length, 1);

    const asCustomer = await request(app).get('/api/admin/orders').set(customer.auth);
    const asSeller = await request(app).get('/api/admin/orders').set(seller.auth);
    assert.equal(asCustomer.status, 403);
    assert.equal(asSeller.status, 403);
  });
});

describe('Order status transitions and inventory', () => {
  async function createOrderWithStock(stock = 5, quantity = 2) {
    const product = await createProduct({ sellerId: seller.user.id, categoryId: category.id, price: '10.00', stock });
    await addToCart(customer.auth, product.id, quantity);
    const order = await placeOrder(customer.auth);
    return { product, orderId: order.body.data.id };
  }

  it('rejects arbitrary status changes (400)', async () => {
    const { orderId } = await createOrderWithStock();

    const res = await request(app)
      .patch(`/api/orders/${orderId}/status`)
      .set(admin.auth)
      .send({ status: 'delivered' });

    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, 'INVALID_STATUS_TRANSITION');
  });

  it('only admins can change status', async () => {
    const { orderId } = await createOrderWithStock();
    const res = await request(app)
      .patch(`/api/orders/${orderId}/status`)
      .set(customer.auth)
      .send({ status: 'confirmed' });
    assert.equal(res.status, 403);
  });

  it('follows the documented happy path and rules out transitions from delivered', async () => {
    const { orderId } = await createOrderWithStock();

    for (const status of ['confirmed', 'processing', 'shipped', 'delivered']) {
      const res = await request(app).patch(`/api/orders/${orderId}/status`).set(admin.auth).send({ status });
      assert.equal(res.status, 200, `transition to ${status} failed`);
      assert.equal(res.body.data.status, status);
    }

    const afterDelivered = await request(app)
      .patch(`/api/orders/${orderId}/status`)
      .set(admin.auth)
      .send({ status: 'cancelled' });
    assert.equal(afterDelivered.status, 400);
  });

  it('restores stock exactly once when an order is cancelled', async () => {
    const { product, orderId } = await createOrderWithStock(5, 2);
    const afterOrder = await getProduct(product.id);
    assert.equal(afterOrder.stock, 3);

    const cancel = await request(app).patch(`/api/orders/${orderId}/status`).set(admin.auth).send({ status: 'cancelled' });
    assert.equal(cancel.status, 200);
    assert.equal(cancel.body.data.status, 'cancelled');

    const afterCancel = await getProduct(product.id);
    assert.equal(afterCancel.stock, 5, 'stock should be restored once');

    // A repeated cancellation must not restore stock a second time.
    const repeat = await request(app).patch(`/api/orders/${orderId}/status`).set(admin.auth).send({ status: 'cancelled' });
    assert.equal(repeat.status, 400);

    const afterRepeat = await getProduct(product.id);
    assert.equal(afterRepeat.stock, 5, 'stock must not be restored twice');
  });
});
