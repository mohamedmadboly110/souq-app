'use strict';

require('./testEnv');

const bcrypt = require('bcryptjs');
const request = require('supertest');
const app = require('../../src/app');
const { getPool } = require('./db');

let counter = 0;

function uniqueEmail(prefix = 'user') {
  counter += 1;
  return `${prefix}.${Date.now()}.${counter}.${Math.floor(Math.random() * 1e6)}@example.test`;
}

/** Register a user through the public API. Returns { user, token, email, password }. */
async function registerUser({ role = 'customer', name = 'Test User', email, password = 'Password123' } = {}) {
  const finalEmail = email || uniqueEmail(role);
  const response = await request(app)
    .post('/api/auth/register')
    .send({ name, email: finalEmail, password, role });

  if (response.status !== 201) {
    throw new Error(`registerUser failed (${response.status}): ${JSON.stringify(response.body)}`);
  }
  return {
    user: response.body.data.user,
    token: response.body.data.token,
    email: finalEmail,
    password,
    auth: { Authorization: `Bearer ${response.body.data.token}` },
  };
}

/** Log in through the API. Returns { user, token, auth }. */
async function login(email, password) {
  const response = await request(app).post('/api/auth/login').send({ email, password });
  if (response.status !== 200) {
    throw new Error(`login failed (${response.status}): ${JSON.stringify(response.body)}`);
  }
  return {
    user: response.body.data.user,
    token: response.body.data.token,
    auth: { Authorization: `Bearer ${response.body.data.token}` },
  };
}

/**
 * Create an admin directly in the database (there is no public admin
 * registration), then log in to obtain a token.
 */
async function createAdmin({ email, password = 'AdminPass123', name = 'Admin User' } = {}) {
  const finalEmail = email || uniqueEmail('admin');
  const passwordHash = await bcrypt.hash(password, 4);
  await getPool().query(
    `INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, 'admin')`,
    [name, finalEmail, passwordHash],
  );
  return login(finalEmail, password);
}

/** Insert a category directly and return the row. */
async function createCategory({ name = 'Test Category', slug, description = null } = {}) {
  const finalSlug = slug || `${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now()}-${(counter += 1)}`;
  const { rows } = await getPool().query(
    `INSERT INTO categories (name, slug, description) VALUES ($1, $2, $3) RETURNING *`,
    [name, finalSlug, description],
  );
  return rows[0];
}

/** Insert a product directly and return the row. */
async function createProduct({
  sellerId,
  categoryId,
  name = 'Test Product',
  description = 'A product used in tests',
  price = '10.00',
  stock = 10,
  isActive = true,
} = {}) {
  const { rows } = await getPool().query(
    `INSERT INTO products (seller_id, category_id, name, description, price, stock, is_active)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [sellerId, categoryId, name, description, price, stock, isActive],
  );
  return rows[0];
}

async function getProduct(id) {
  const { rows } = await getPool().query('SELECT * FROM products WHERE id = $1', [id]);
  return rows[0] || null;
}

async function countOrders() {
  const { rows } = await getPool().query('SELECT COUNT(*)::int AS count FROM orders');
  return rows[0].count;
}

module.exports = {
  app,
  request,
  uniqueEmail,
  registerUser,
  login,
  createAdmin,
  createCategory,
  createProduct,
  getProduct,
  countOrders,
};
