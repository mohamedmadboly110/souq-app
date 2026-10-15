'use strict';

const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const {
  app, request, registerUser, createCategory, createProduct, uniqueEmail,
} = require('./helpers/factories');
const db = require('./helpers/db');

let seller;
let otherSeller;
let customer;
let category;

before(async () => {
  await db.setupDatabase();
});

beforeEach(async () => {
  await db.resetDatabase();
  seller = await registerUser({ role: 'seller', name: 'Seller One' });
  otherSeller = await registerUser({ role: 'seller', name: 'Seller Two' });
  customer = await registerUser({ role: 'customer' });
  category = await createCategory({ name: 'Electronics' });
});

after(async () => {
  await db.closeAll();
});

describe('Products - CRUD and ownership', () => {
  it('lets a seller create a product (201)', async () => {
    const res = await request(app).post('/api/products').set(seller.auth).send({
      name: 'Mechanical Keyboard',
      description: 'RGB keyboard',
      categoryId: category.id,
      price: '89.99',
      stock: 5,
    });

    assert.equal(res.status, 201);
    assert.equal(res.body.data.name, 'Mechanical Keyboard');
    assert.equal(res.body.data.price, '89.99');
    assert.equal(res.body.data.seller_id, seller.user.id);
    assert.equal(res.body.data.category_name, 'Electronics');
  });

  it('rejects product creation from customers (403) and anonymous users (401)', async () => {
    const asCustomer = await request(app).post('/api/products').set(customer.auth).send({
      name: 'Nope', categoryId: category.id, price: '1.00', stock: 1,
    });
    const anonymous = await request(app).post('/api/products').send({
      name: 'Nope', categoryId: category.id, price: '1.00', stock: 1,
    });

    assert.equal(asCustomer.status, 403);
    assert.equal(anonymous.status, 401);
  });

  it('ignores a client-supplied sellerId and uses the authenticated seller', async () => {
    const res = await request(app).post('/api/products').set(seller.auth).send({
      name: 'Spoofed', categoryId: category.id, price: '5.00', stock: 1,
      sellerId: otherSeller.user.id,
    });

    assert.equal(res.status, 201);
    assert.equal(res.body.data.seller_id, seller.user.id);
  });

  it('rejects invalid or unsafe product input (400)', async () => {
    const negativePrice = await request(app).post('/api/products').set(seller.auth).send({
      name: 'Bad', categoryId: category.id, price: '-1.00', stock: 1,
    });
    const negativeStock = await request(app).post('/api/products').set(seller.auth).send({
      name: 'Bad', categoryId: category.id, price: '1.00', stock: -5,
    });
    const badCategory = await request(app).post('/api/products').set(seller.auth).send({
      name: 'Bad', categoryId: 999999, price: '1.00', stock: 1,
    });

    assert.equal(negativePrice.status, 400);
    assert.equal(negativeStock.status, 400);
    assert.equal(badCategory.status, 400);
  });

  it('lets the owner update a product and forbids other sellers (403)', async () => {
    const product = await createProduct({ sellerId: seller.user.id, categoryId: category.id, price: '10.00' });

    const okUpdate = await request(app)
      .patch(`/api/products/${product.id}`)
      .set(seller.auth)
      .send({ price: '12.50', stock: 3 });
    assert.equal(okUpdate.status, 200);
    assert.equal(okUpdate.body.data.price, '12.50');

    const forbidden = await request(app)
      .patch(`/api/products/${product.id}`)
      .set(otherSeller.auth)
      .send({ price: '1.00' });
    assert.equal(forbidden.status, 403);
  });

  it('lets the owner delete a product and forbids other sellers (403)', async () => {
    const product = await createProduct({ sellerId: seller.user.id, categoryId: category.id });

    const forbidden = await request(app).delete(`/api/products/${product.id}`).set(otherSeller.auth);
    assert.equal(forbidden.status, 403);

    const ok = await request(app).delete(`/api/products/${product.id}`).set(seller.auth);
    assert.equal(ok.status, 200);
    assert.equal(ok.body.data.deleted, true);
  });

  it('hides inactive products from customers but shows them to the owner', async () => {
    const product = await createProduct({
      sellerId: seller.user.id, categoryId: category.id, isActive: false,
    });

    const asCustomer = await request(app).get(`/api/products/${product.id}`).set(customer.auth);
    assert.equal(asCustomer.status, 404);

    const asOwner = await request(app).get(`/api/products/${product.id}`).set(seller.auth);
    assert.equal(asOwner.status, 200);

    const anonymous = await request(app).get(`/api/products/${product.id}`);
    assert.equal(anonymous.status, 404);
  });
});

describe('Products - filtering, search, pagination and sorting', () => {
  beforeEach(async () => {
    await createProduct({ sellerId: seller.user.id, categoryId: category.id, name: 'Cheap Mouse', price: '9.99', stock: 5 });
    await createProduct({ sellerId: seller.user.id, categoryId: category.id, name: 'Mechanical Keyboard', price: '89.99', stock: 5 });
    await createProduct({ sellerId: seller.user.id, categoryId: category.id, name: 'Premium Monitor', price: '499.00', stock: 5 });
  });

  it('filters by price range and search term', async () => {
    const priceRange = await request(app).get('/api/products?minPrice=10&maxPrice=100');
    assert.equal(priceRange.status, 200);
    assert.equal(priceRange.body.data.length, 1);
    assert.equal(priceRange.body.data[0].name, 'Mechanical Keyboard');

    const search = await request(app).get('/api/products?search=keyboard');
    assert.equal(search.status, 200);
    assert.equal(search.body.data.length, 1);
    assert.equal(search.body.data[0].name, 'Mechanical Keyboard');
  });

  it('filters by category slug', async () => {
    const other = await createCategory({ name: 'Books' });
    await createProduct({ sellerId: seller.user.id, categoryId: other.id, name: 'Clean Code', price: '24.99' });

    const res = await request(app).get(`/api/products?category=${category.slug}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.data.length, 3);
  });

  it('paginates and returns metadata', async () => {
    const page1 = await request(app).get('/api/products?page=1&limit=2&sortBy=price&order=asc');
    assert.equal(page1.status, 200);
    assert.equal(page1.body.data.length, 2);
    assert.equal(page1.body.meta.total, 3);
    assert.equal(page1.body.meta.totalPages, 2);
    assert.equal(page1.body.meta.hasNextPage, true);
    assert.equal(page1.body.data[0].name, 'Cheap Mouse');

    const page2 = await request(app).get('/api/products?page=2&limit=2&sortBy=price&order=asc');
    assert.equal(page2.body.data.length, 1);
    assert.equal(page2.body.meta.hasPreviousPage, true);
  });

  it('rejects invalid query parameters (400)', async () => {
    const badSort = await request(app).get('/api/products?sortBy=password');
    const badOrder = await request(app).get('/api/products?order=sideways');
    const badLimit = await request(app).get('/api/products?limit=1000');

    assert.equal(badSort.status, 400);
    assert.equal(badOrder.status, 400);
    assert.equal(badLimit.status, 400);
  });

  it('does not expose inactive products in listings', async () => {
    await createProduct({
      sellerId: seller.user.id, categoryId: category.id, name: 'Hidden Item', price: '5.00', isActive: false,
    });
    const res = await request(app).get('/api/products?search=hidden');
    assert.equal(res.status, 200);
    assert.equal(res.body.data.length, 0);
  });
});
