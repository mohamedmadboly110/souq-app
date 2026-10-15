'use strict';

/**
 * Test environment bootstrap.
 *
 * MUST be required before `src/config/env` (and therefore before `src/app`)
 * so the process runs against an isolated test database and never touches
 * development or production data.
 *
 * Resolution order for the test database URL:
 *   1. TEST_DATABASE_URL          (explicit override, recommended in CI)
 *   2. DATABASE_URL with the database name suffixed with `_test`
 *      e.g. .../souq_dev  ->  .../souq_dev_test
 *   3. a local fallback (postgres://postgres:postgres@localhost:5432/souq_test)
 */

require('dotenv').config();

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.TEST_JWT_SECRET
  || process.env.JWT_SECRET
  || 'test-only-secret-test-only-secret-0123456789';
process.env.BCRYPT_SALT_ROUNDS = '4'; // keep tests fast
process.env.LOG_LEVEL = 'tiny';

function deriveTestUrl(baseUrl) {
  try {
    const url = new URL(baseUrl);
    const dbName = url.pathname.replace(/^\//, '');
    if (!dbName.endsWith('_test')) {
      url.pathname = `/${dbName}_test`;
    }
    return url.toString();
  } catch (error) {
    return baseUrl;
  }
}

if (!process.env.TEST_DATABASE_URL) {
  process.env.TEST_DATABASE_URL = process.env.DATABASE_URL
    ? deriveTestUrl(process.env.DATABASE_URL)
    : 'postgres://postgres:postgres@localhost:5432/souq_test';
}

process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
process.env.PGSSL = 'disable';

module.exports = { testDatabaseUrl: process.env.TEST_DATABASE_URL };
