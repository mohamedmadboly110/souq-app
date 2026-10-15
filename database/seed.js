'use strict';

/**
 * Development seed script.
 *
 * Creates safe sample data for local development:
 *   - one admin, one seller, one customer
 *   - categories
 *   - a handful of products owned by the seller
 *
 * Safe to run more than once (idempotent). Credentials can be overridden with
 * SEED_ADMIN_*, SEED_SELLER_*, SEED_CUSTOMER_* environment variables. The
 * defaults are for LOCAL DEVELOPMENT ONLY and must never be used in production.
 */

const bcrypt = require('bcryptjs');
const config = require('../src/config/env');
const { Pool } = require('pg');
const { slugify } = require('../src/utils/slug');

const SEED = {
  admin: {
    name: process.env.SEED_ADMIN_NAME || 'Souq Admin',
    email: (process.env.SEED_ADMIN_EMAIL || 'admin@souq.local').toLowerCase(),
    password: process.env.SEED_ADMIN_PASSWORD || 'Admin@12345',
  },
  seller: {
    name: process.env.SEED_SELLER_NAME || 'Sample Seller',
    email: (process.env.SEED_SELLER_EMAIL || 'seller@souq.local').toLowerCase(),
    password: process.env.SEED_SELLER_PASSWORD || 'Seller@12345',
  },
  customer: {
    name: process.env.SEED_CUSTOMER_NAME || 'Sample Customer',
    email: (process.env.SEED_CUSTOMER_EMAIL || 'customer@souq.local').toLowerCase(),
    password: process.env.SEED_CUSTOMER_PASSWORD || 'Customer@12345',
  },
};

const CATEGORIES = [
  { name: 'Electronics', description: 'Phones, computers and accessories' },
  { name: 'Home & Kitchen', description: 'Everything for your home' },
  { name: 'Books', description: 'Books and stationery' },
];

const PRODUCTS = [
  { name: 'Mechanical Keyboard', category: 'Electronics', price: '89.99', stock: 25, description: 'RGB mechanical keyboard' },
  { name: 'Wireless Mouse', category: 'Electronics', price: '29.50', stock: 60, description: 'Ergonomic wireless mouse' },
  { name: '27 inch 4K Monitor', category: 'Electronics', price: '399.00', stock: 10, description: 'UHD IPS monitor' },
  { name: 'Stainless Steel Kettle', category: 'Home & Kitchen', price: '34.75', stock: 40, description: '1.7L electric kettle' },
  { name: 'Ceramic Dinner Set', category: 'Home & Kitchen', price: '59.99', stock: 15, description: '16-piece dinner set' },
  { name: 'Clean Code', category: 'Books', price: '24.99', stock: 30, description: 'A Handbook of Agile Software Craftsmanship' },
  { name: 'The Pragmatic Programmer', category: 'Books', price: '27.50', stock: 20, description: 'Your Journey to Mastery' },
];

async function upsertUser(client, { name, email, password }, role) {
  const existing = await client.query('SELECT id FROM users WHERE email = $1', [email]);
  if (existing.rowCount > 0) {
    return { id: existing.rows[0].id, created: false };
  }
  const passwordHash = await bcrypt.hash(password, config.bcryptSaltRounds);
  const { rows } = await client.query(
    `INSERT INTO users (name, email, password_hash, role)
     VALUES ($1, $2, $3, $4)
     RETURNING id`,
    [name, email, passwordHash, role],
  );
  return { id: rows[0].id, created: true };
}

async function upsertCategory(client, { name, description }) {
  const slug = slugify(name);
  const { rows } = await client.query(
    `INSERT INTO categories (name, slug, description)
     VALUES ($1, $2, $3)
     ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
     RETURNING id, name, slug`,
    [name, slug, description],
  );
  return rows[0];
}

async function main() {
  const pool = new Pool({ connectionString: config.database.url, ssl: config.database.ssl });
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const admin = await upsertUser(client, SEED.admin, 'admin');
    const seller = await upsertUser(client, SEED.seller, 'seller');
    await upsertUser(client, SEED.customer, 'customer');

    const categoryIds = new Map();
    for (const category of CATEGORIES) {
      const row = await upsertCategory(client, category);
      categoryIds.set(row.name, row.id);
    }

    let productsCreated = 0;
    for (const product of PRODUCTS) {
      const exists = await client.query(
        'SELECT id FROM products WHERE seller_id = $1 AND lower(name) = lower($2)',
        [seller.id, product.name],
      );
      if (exists.rowCount > 0) continue;

      await client.query(
        `INSERT INTO products (seller_id, category_id, name, description, price, stock)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          seller.id,
          categoryIds.get(product.category),
          product.name,
          product.description,
          product.price,
          product.stock,
        ],
      );
      productsCreated += 1;
    }

    await client.query('COMMIT');

    console.log('\nSeed completed.');
    console.log('-----------------------------------------------');
    console.log(`Admin    : ${SEED.admin.email}    / ${SEED.admin.password}`);
    console.log(`Seller   : ${SEED.seller.email}   / ${SEED.seller.password}`);
    console.log(`Customer : ${SEED.customer.email} / ${SEED.customer.password}`);
    console.log(`Categories: ${CATEGORIES.length}, Products created: ${productsCreated}`);
    console.log('-----------------------------------------------');
    console.log('These accounts are for LOCAL DEVELOPMENT ONLY.\n');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(`\nSeed error: ${error.message}`);
  process.exitCode = 1;
});
