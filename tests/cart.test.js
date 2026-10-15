'use strict';

const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const {
  app, request, registerUser, createCategory, createProduct,
} = require('./helpers/factories');
const db = require('./helpers/db');

let seller;
let customer;
let otherCustomer;
let category;
let product;

before(async () => {
  await db.setupDatabase();
});

beforeEach(async () => {
  await db.resetDatabase();
  seller = await registerUser({ role: 'seller' });
  customer = await registerUser({ role: 'customer' });
  otherCustomer = await registerUser({ role: 'customer' });
  category = await createCategory({ name: 'Electronics' });
  product = await createProduct({ sellerId: seller.user.id, categoryId: category.id, price: '20.00', stock: 10 });
});

after(async () => {
  await db.closeAll();
});

describe('Cart', () => {
  it('starts empty and is created on first access', async () => {
    const res = await request(app).get('/api/cart').set(customer.auth);
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.data.items, []);
    assert.equal(res.body.data.subtotal, '0.00');
  });

  it('adds an item and calculates the line total server-side', async () => {
    const res = await request(app)
      .post('/api/cart/items')
      .set(customer.auth)
      .send({ productId: product.id, quantity: 2 });

    assert.equal(res.status, 201);
    assert.equal(res.body.data.quantity, 2);
    assert.equal(res.body.data.unitPrice, '20.00');
    assert.equal(res.body.data.lineTotal, '40.00');

    const cart = await request(app).get('/api/cart').set(customer.auth);
    assert.equal(cart.body.data.totalItems, 2);
    assert.equal(cart.body.data.subtotal, '40.00');
  });

  it('updates quantity when adding the same product again', async () => {
    await request(app).post('/api/cart/items').set(customer.auth).send({ productId: product.id, quantity: 2 });
    const again = await request(app).post('/api/cart/items').set(customer.auth).send({ productId: product.id, quantity: 3 });

    assert.equal(again.status, 201);
    assert.equal(again.body.data.quantity, 5);

    const cart = await request(app).get('/api/cart').set(customer.auth);
    assert.equal(cart.body.data.items.length, 1, 'should not duplicate the cart item');
  });

  it('rejects quantities beyond available stock (400)', async () => {
    const res = await request(app)
      .post('/api/cart/items')
      .set(customer.auth)
      .send({ productId: product.id, quantity: 999 });

    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, 'INSUFFICIENT_STOCK');
  });

  it('rejects invalid quantities and missing products', async () => {
    const zero = await request(app).post('/api/cart/items').set(customer.auth).send({ productId: product.id, quantity: 0 });
    const missing = await request(app).post('/api/cart/items').set(customer.auth).send({ productId: 999999, quantity: 1 });

    assert.equal(zero.status, 400);
    assert.equal(missing.status, 404);
  });

  it('updates and removes a cart item', async () => {
    const added = await request(app).post('/api/cart/items').set(customer.auth).send({ productId: product.id, quantity: 1 });

    const updated = await request(app)
      .patch(`/api/cart/items/${added.body.data.id}`)
      .set(customer.auth)
      .send({ quantity: 4 });
    assert.equal(updated.status, 200);
    assert.equal(updated.body.data.quantity, 4);
    assert.equal(updated.body.data.lineTotal, '80.00');

    const removed = await request(app).delete(`/api/cart/items/${added.body.data.id}`).set(customer.auth);
    assert.equal(removed.status, 204);

    const cart = await request(app).get('/api/cart').set(customer.auth);
    assert.equal(cart.body.data.items.length, 0);
  });

  it('keeps carts private: another customer cannot touch the item (404)', async () => {
    const added = await request(app).post('/api/cart/items').set(customer.auth).send({ productId: product.id, quantity: 1 });
    const itemId = added.body.data.id;

    const otherPatch = await request(app).patch(`/api/cart/items/${itemId}`).set(otherCustomer.auth).send({ quantity: 2 });
    const otherDelete = await request(app).delete(`/api/cart/items/${itemId}`).set(otherCustomer.auth);
    const otherCart = await request(app).get('/api/cart').set(otherCustomer.auth);

    assert.equal(otherPatch.status, 404);
    assert.equal(otherDelete.status, 404);
    assert.equal(otherCart.body.data.items.length, 0);
  });

  it('only allows customers to access the cart (sellers/admins get 403)', async () => {
    const asSeller = await request(app).get('/api/cart').set(seller.auth);
    assert.equal(asSeller.status, 403);
  });

  it('clears the cart', async () => {
    await request(app).post('/api/cart/items').set(customer.auth).send({ productId: product.id, quantity: 2 });
    const cleared = await request(app).delete('/api/cart').set(customer.auth);
    assert.equal(cleared.status, 204);

    const cart = await request(app).get('/api/cart').set(customer.auth);
    assert.equal(cart.body.data.items.length, 0);
  });
});
