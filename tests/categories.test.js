'use strict';

const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const {
  app, request, registerUser, createAdmin, createCategory, createProduct,
} = require('./helpers/factories');
const db = require('./helpers/db');

let admin;
let seller;
let customer;
let category;

before(async () => {
  await db.setupDatabase();
});

beforeEach(async () => {
  await db.resetDatabase();
  admin = await createAdmin({});
  seller = await registerUser({ role: 'seller' });
  customer = await registerUser({ role: 'customer' });
  category = await createCategory({ name: 'Books' });
});

after(async () => {
  await db.closeAll();
});

describe('Categories', () => {
  it('lists categories publicly with product counts', async () => {
    await createProduct({ sellerId: seller.user.id, categoryId: category.id });
    const res = await request(app).get('/api/categories');

    assert.equal(res.status, 200);
    const found = res.body.data.find((item) => item.id === category.id);
    assert.ok(found);
    assert.equal(found.product_count, 1);
  });

  it('lets an admin create a category and generates a slug', async () => {
    const res = await request(app).post('/api/categories').set(admin.auth).send({
      name: 'Home & Kitchen', description: 'Home stuff',
    });

    assert.equal(res.status, 201);
    assert.equal(res.body.data.name, 'Home & Kitchen');
    assert.equal(res.body.data.slug, 'home-kitchen');
  });

  it('forbids non-admins from managing categories (403/401)', async () => {
    const asCustomer = await request(app).post('/api/categories').set(customer.auth).send({ name: 'X' });
    const asSeller = await request(app).post('/api/categories').set(seller.auth).send({ name: 'Y' });
    const anonymous = await request(app).post('/api/categories').send({ name: 'Z' });

    assert.equal(asCustomer.status, 403);
    assert.equal(asSeller.status, 403);
    assert.equal(anonymous.status, 401);
  });

  it('rejects duplicate category slugs with 409', async () => {
    await request(app).post('/api/categories').set(admin.auth).send({ name: 'Electronics', slug: 'electronics' });
    const dup = await request(app).post('/api/categories').set(admin.auth).send({ name: 'Electronics 2', slug: 'electronics' });

    assert.equal(dup.status, 409);
  });

  it('updates a category as admin', async () => {
    const res = await request(app)
      .patch(`/api/categories/${category.id}`)
      .set(admin.auth)
      .send({ name: 'Books & Media', slug: 'books-media' });

    assert.equal(res.status, 200);
    assert.equal(res.body.data.name, 'Books & Media');
    assert.equal(res.body.data.slug, 'books-media');
  });

  it('refuses to delete a category that still has products (409)', async () => {
    await createProduct({ sellerId: seller.user.id, categoryId: category.id });

    const res = await request(app).delete(`/api/categories/${category.id}`).set(admin.auth);
    assert.equal(res.status, 409);
    assert.equal(res.body.error.code, 'CATEGORY_IN_USE');
  });

  it('deletes an empty category (204)', async () => {
    const res = await request(app).delete(`/api/categories/${category.id}`).set(admin.auth);
    assert.equal(res.status, 204);

    const get = await request(app).get(`/api/categories/${category.id}`);
    assert.equal(get.status, 404);
  });

  it('returns 404 for a missing category', async () => {
    const res = await request(app).get('/api/categories/999999');
    assert.equal(res.status, 404);
  });
});

describe('Health and unknown routes', () => {
  it('exposes liveness and readiness endpoints', async () => {
    const live = await request(app).get('/health');
    assert.equal(live.status, 200);
    assert.equal(live.body.data.status, 'ok');

    const ready = await request(app).get('/health/ready');
    assert.equal(ready.status, 200);
    assert.equal(ready.body.data.database, 'up');
  });

  it('returns a consistent 404 for unknown routes', async () => {
    const res = await request(app).get('/api/does-not-exist');
    assert.equal(res.status, 404);
    assert.equal(res.body.success, false);
    assert.equal(res.body.error.code, 'NOT_FOUND');
  });
});
