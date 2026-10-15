'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { app, request, registerUser, login, createAdmin, uniqueEmail } = require('./helpers/factories');
const db = require('./helpers/db');

before(async () => {
  await db.setupDatabase();
});

after(async () => {
  await db.closeAll();
});

describe('Authentication', () => {
  it('registers a customer and returns a token without exposing the password hash', async () => {
    const email = uniqueEmail('register');
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Jane Doe', email, password: 'Password123', role: 'customer' });

    assert.equal(res.status, 201);
    assert.equal(res.body.success, true);
    assert.ok(res.body.data.token, 'token should be present');
    assert.equal(res.body.data.user.email, email);
    assert.equal(res.body.data.user.role, 'customer');
    assert.equal(res.body.data.user.password_hash, undefined);
    assert.equal(res.body.data.user.password, undefined);
  });

  it('rejects a duplicate email with 409', async () => {
    const { email, password } = await registerUser({});
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Dup', email, password });

    assert.equal(res.status, 409);
    assert.equal(res.body.success, false);
  });

  it('rejects validation errors with 400', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: '', email: 'not-an-email', password: '123' });

    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, 'VALIDATION_ERROR');
    assert.ok(Array.isArray(res.body.error.details));
  });

  it('never allows public registration as an admin', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Sneaky', email: uniqueEmail('sneaky'), password: 'Password123', role: 'admin' });

    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, 'VALIDATION_ERROR');
  });

  it('logs in with valid credentials', async () => {
    const { email, password } = await registerUser({});
    const session = await login(email, password);
    assert.ok(session.token);
    assert.equal(session.user.email, email);
  });

  it('rejects an unknown email or wrong password with 401', async () => {
    const { email } = await registerUser({});
    const wrongPassword = await request(app)
      .post('/api/auth/login')
      .send({ email, password: 'WrongPassword1' });
    const unknown = await request(app)
      .post('/api/auth/login')
      .send({ email: uniqueEmail('nobody'), password: 'Password123' });

    assert.equal(wrongPassword.status, 401);
    assert.equal(unknown.status, 401);
    assert.equal(wrongPassword.body.error.code, 'INVALID_CREDENTIALS');
  });

  it('returns the profile for a valid token', async () => {
    const { auth, user } = await registerUser({});
    const res = await request(app).get('/api/auth/me').set(auth);

    assert.equal(res.status, 200);
    assert.equal(res.body.data.user.id, user.id);
    assert.equal(res.body.data.user.password_hash, undefined);
  });

  it('rejects protected routes without a token (401)', async () => {
    const res = await request(app).get('/api/auth/me');
    assert.equal(res.status, 401);
    assert.equal(res.body.error.code, 'UNAUTHORIZED');
  });

  it('rejects invalid or malformed JWTs (401)', async () => {
    const invalid = await request(app).get('/api/auth/me').set('Authorization', 'Bearer not.a.real.token');
    const wrongScheme = await request(app).get('/api/auth/me').set('Authorization', 'Token abc');
    const empty = await request(app).get('/api/auth/me').set('Authorization', 'Bearer ');

    assert.equal(invalid.status, 401);
    assert.equal(wrongScheme.status, 401);
    assert.equal(empty.status, 401);
  });

  it('supports admin accounts created out of band (create-admin mechanism)', async () => {
    const admin = await createAdmin({});
    assert.equal(admin.user.role, 'admin');
  });
});
