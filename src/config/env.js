'use strict';

const path = require('path');

require('dotenv').config({ path: path.resolve(process.cwd(), '.env') });

/**
 * Centralised, validated environment configuration.
 *
 * The process fails fast (throws before the server starts) when a required
 * value is missing or malformed. This prevents the application from booting
 * with an undefined database URL or JWT secret.
 */

const REQUIRED = ['DATABASE_URL', 'JWT_SECRET'];

function fail(message) {
  // Never print the value of a secret, only the variable name.
  throw new Error(`[config] ${message}`);
}

function requireString(name) {
  const value = process.env[name];
  if (typeof value !== 'string' || value.trim() === '') {
    fail(`Missing required environment variable: ${name}`);
  }
  return value.trim();
}

function optionalString(name, fallback) {
  const value = process.env[name];
  if (value === undefined || value === null || String(value).trim() === '') {
    return fallback;
  }
  return String(value).trim();
}

function requireInt(name, fallback, { min, max } = {}) {
  const raw = process.env[name];
  if (raw === undefined || raw === null || String(raw).trim() === '') {
    if (fallback === undefined) {
      fail(`Missing required environment variable: ${name}`);
    }
    return fallback;
  }
  const parsed = Number(raw);
  if (!Number.isInteger(parsed)) {
    fail(`Environment variable ${name} must be an integer`);
  }
  if (min !== undefined && parsed < min) {
    fail(`Environment variable ${name} must be >= ${min}`);
  }
  if (max !== undefined && parsed > max) {
    fail(`Environment variable ${name} must be <= ${max}`);
  }
  return parsed;
}

function requireEnum(name, allowed, fallback) {
  const raw = optionalString(name, fallback);
  if (!allowed.includes(raw)) {
    fail(`Environment variable ${name} must be one of: ${allowed.join(', ')}`);
  }
  return raw;
}

// NODE_ENV defaults to development for local work.
const nodeEnv = requireEnum('NODE_ENV', ['development', 'test', 'production'], 'development');
const isProduction = nodeEnv === 'production';
const isTest = nodeEnv === 'test';

// When loaded by the test runner before .env exists, allow env vars to be
// injected directly (the test harness sets them).
const databaseUrl = requireString('DATABASE_URL');
const jwtSecret = requireString('JWT_SECRET');

if (isProduction && jwtSecret.length < 32) {
  fail('JWT_SECRET must be at least 32 characters long in production');
}

const sslMode = requireEnum('PGSSL', ['disable', 'require'], isProduction ? 'require' : 'disable');

const config = {
  nodeEnv,
  isProduction,
  isTest,
  port: requireInt('PORT', 4000, { min: 1, max: 65535 }),
  database: {
    url: databaseUrl,
    ssl: sslMode === 'require' ? { rejectUnauthorized: false } : false,
    // Connection pool tuning (kept modest for the MVP and hosted free tiers).
    poolMax: requireInt('PG_POOL_MAX', 10, { min: 1, max: 100 }),
    idleTimeoutMillis: requireInt('PG_IDLE_TIMEOUT_MS', 30000, { min: 1000 }),
    connectionTimeoutMillis: requireInt('PG_CONNECT_TIMEOUT_MS', 10000, { min: 1000 }),
  },
  jwt: {
    secret: jwtSecret,
    expiresIn: optionalString('JWT_EXPIRES_IN', '1d'),
  },
  bcryptSaltRounds: requireInt('BCRYPT_SALT_ROUNDS', 12, { min: 4, max: 15 }),
  logLevel: requireEnum('LOG_LEVEL', ['dev', 'combined', 'common', 'short', 'tiny'], isProduction ? 'combined' : 'dev'),
};

module.exports = config;
