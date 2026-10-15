# Souq — Mini E-Commerce REST API

Souq is a production-oriented **MVP e-commerce REST API** built with **Node.js, Express and PostgreSQL**.
It implements the complete core commerce flow: role-based authentication, seller-owned products,
categories, a customer cart, and **transactional order creation with safe inventory management**.

The database is accessed through the `pg` driver with **explicit, parameterized SQL** — no ORM — so the
schema and every query remain readable and auditable.

> Status: functional MVP, verified locally with an automated test suite (57 tests). It has **not** been
> deployed to Railway; deployment steps are documented below.

---

## Table of contents

1. [Features](#features)
2. [Technology stack](#technology-stack)
3. [Project structure](#project-structure)
4. [Prerequisites](#prerequisites)
5. [Installation](#installation)
6. [Environment variables](#environment-variables)
7. [Local PostgreSQL setup](#local-postgresql-setup)
8. [Database migrations and seeding](#database-migrations-and-seeding)
9. [Creating the initial administrator](#creating-the-initial-administrator)
10. [Running the application](#running-the-application)
11. [API reference](#api-reference)
12. [Authentication](#authentication)
13. [Order creation and inventory transactions](#order-creation-and-inventory-transactions)
14. [Order status state machine](#order-status-state-machine)
15. [Postman](#postman)
16. [Database schema overview](#database-schema-overview)
17. [Testing](#testing)
18. [Docker](#docker)
19. [GitHub setup](#github-setup)
20. [Railway deployment](#railway-deployment)
21. [Connecting a hosted PostgreSQL database](#connecting-a-hosted-postgresql-database)
22. [Troubleshooting](#troubleshooting)
23. [Limitations and manual steps](#limitations-and-manual-steps)

---

## Features

- **Authentication**: register / login with `bcryptjs` password hashing and `jsonwebtoken` JWTs.
  `GET /api/auth/me` returns the current profile. Passwords and hashes are never returned.
- **Roles & authorization**: `customer`, `seller`, `admin`. Reusable `protect` and `authorize(...roles)`
  middleware plus per-resource ownership checks.
- **No public admin registration**: admins are created only through a privileged CLI script.
- **Products**: CRUD owned by sellers, filtering by category, price range and full-text-ish search,
  pagination, whitelisted sorting. Inactive products are hidden from customers.
- **Categories**: read-only for the public, admin-only mutations, deletion blocked while products reference them.
- **Cart**: one cart per customer, add/update/remove/clear, duplicate-safe via a `(cart_id, product_id)` unique
  constraint. Carts are private to their owner.
- **Orders**: server-side pricing and totals (**never** trusting client prices/totals), purchase-time
  name/price snapshots, transactional stock decrement, and cart clearing only after success.
- **Concurrency safe**: row locking in a consistent order plus atomic conditional stock updates prevent overselling.
- **Status state machine**: explicit allowed order transitions; cancellation restores stock exactly once.
- **Robust errors**: global error handler, consistent JSON envelope, PostgreSQL error mapping, no stack leaks in production.
- **Health checks**: liveness (`/health`) and readiness (`/health/ready`).
- **Versioned SQL migrations** with a checksum-tracking runner, plus an idempotent development seed.
- **Automated tests** (`node:test` + `supertest`) against an isolated test database.
- **Postman collection**, **Dockerfile** and **docker-compose** for local reproducibility.

---

## Technology stack

| Concern            | Choice                                    |
| ------------------ | ----------------------------------------- |
| Runtime            | Node.js (LTS; developed on Node 24, works on 18+) |
| Framework          | Express.js 4                              |
| Database           | PostgreSQL 16                             |
| Driver             | `pg` (node-postgres), explicit SQL        |
| Migrations         | Versioned `.sql` files + custom runner    |
| Auth               | `jsonwebtoken` + `bcryptjs`               |
| Validation         | `express-validator`                       |
| Logging            | `morgan`                                  |
| Config             | `dotenv` + fail-fast validation           |
| Testing            | Node's built-in test runner + `supertest` |
| Deployment target  | Railway (Docker optional)                 |

No MongoDB, Mongoose, Prisma or other ORM is used.

---

## Project structure

```text
souq_app/
├── src/
│   ├── config/
│   │   ├── env.js                 # dotenv + validation (fails fast)
│   │   └── database.js            # pg pool + withTransaction helper
│   ├── constants/
│   │   ├── errorCodes.js
│   │   └── orderStatus.js         # state machine
│   ├── controllers/               # HTTP in/out only
│   ├── services/                  # business rules
│   ├── repositories/              # SQL only
│   ├── routes/                    # endpoint definitions
│   ├── middlewares/               # auth, validation, errors, 404, async
│   ├── validators/                # express-validator chains
│   ├── utils/                     # ApiError, jwt, password, money, slug, response, pagination
│   ├── app.js                     # express app (no listen)
│   └── server.js                  # bootstrap + graceful shutdown
├── database/
│   ├── migrations/                # 000..007 versioned SQL
│   ├── runner.js                  # reusable migration logic
│   ├── migrate.js                 # `npm run migrate`
│   └── seed.js                    # `npm run seed`
├── scripts/
│   └── create-admin.js            # privileged admin creation
├── tests/
│   ├── helpers/
│   ├── auth.test.js
│   ├── categories.test.js
│   ├── products.test.js
│   ├── cart.test.js
│   └── orders.test.js
├── postman/
│   └── Souq.postman_collection.json
├── .env.example
├── .gitignore
├── .dockerignore
├── Dockerfile
├── docker-compose.yml
├── package.json
└── README.md
```

---

## Prerequisites

- **Node.js 18+** (LTS recommended) and npm.
- **PostgreSQL 13+** (locally installed, in Docker, or hosted).
- **Postman** (for manual testing).
- **Git** and a GitHub account (for pushing).
- Optional: **Docker Desktop** for containerized local runs.

---

## Installation

```bash
# 1. Install dependencies
npm install

# 2. Create your local environment file
cp .env.example .env        # Windows PowerShell: Copy-Item .env.example .env

# 3. Edit .env and fill in DATABASE_URL and JWT_SECRET (see below)

# 4. Create the database (see "Local PostgreSQL setup"), then:
npm run migrate             # create tables
npm run seed                # load safe sample data (development only)

# 5. Start the API
npm run dev                 # nodemon, auto-reload
# or
npm start                   # plain node
```

The API listens on `http://localhost:4000` by default.

---

## Environment variables

All variables are validated at startup; the process **fails fast** if required values are missing.

| Variable                 | Required | Default       | Notes |
| ------------------------ | -------- | ------------- | ----- |
| `NODE_ENV`               | no       | `development` | `development` \| `test` \| `production` |
| `PORT`                   | no       | `4000`        | Railway injects this automatically |
| `DATABASE_URL`           | **yes**  | —             | PostgreSQL connection string |
| `PGSSL`                  | no       | `disable` / `require` in production | `disable` \| `require` |
| `JWT_SECRET`             | **yes**  | —             | Minimum 32 chars in production |
| `JWT_EXPIRES_IN`         | no       | `1d`          | e.g. `1h`, `7d` |
| `BCRYPT_SALT_ROUNDS`     | no       | `12`          | 4–15 |
| `LOG_LEVEL`              | no       | `dev` / `combined` in production | morgan format |
| `PG_POOL_MAX`            | no       | `10`          | connection pool size |
| `PG_IDLE_TIMEOUT_MS`     | no       | `30000`       | |
| `PG_CONNECT_TIMEOUT_MS`  | no       | `10000`       | |
| `SEED_*`                 | no       | dev defaults  | only used by `npm run seed` |

**Local development vs production.** Locally you typically set `PGSSL=disable` and a throwaway
`JWT_SECRET`. In production (Railway) you set `PGSSL=require` (the default in production) and a long random
secret. `.env` is git-ignored; only `.env.example` (placeholders) is committed.

Generate a strong secret:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

---

## Local PostgreSQL setup

### Option A — native PostgreSQL

```bash
# create a role and database (adjust names to taste)
psql -U postgres -c "CREATE USER souq WITH PASSWORD 'souq_pass';"
psql -U postgres -c "CREATE DATABASE souq_dev OWNER souq;"
# a separate database for the automated tests
psql -U postgres -c "CREATE DATABASE souq_dev_test OWNER souq;"
```

Then set:

```env
DATABASE_URL=
PGSSL=disable
```

### Option B — Docker (quickest)

```bash
docker run -d --name souq-postgres \
  -e POSTGRES_USER=souq -e POSTGRES_PASSWORD=souq_pass -e POSTGRES_DB=souq_dev \
  -p 5432:5432 postgres:16
```

Create the test database as well:

```bash
docker exec souq-postgres psql -U souq -d souq_dev -c "CREATE DATABASE souq_dev_test;"
```

---

## Database migrations and seeding

Migrations live in `database/migrations/` and run in filename order. The runner records each applied
file (with a SHA-256 checksum) in the `schema_migrations` table and **never re-runs** an applied migration
and **never drops data**.

```bash
npm run migrate           # apply all pending migrations
npm run migrate:status    # show applied / pending migrations
npm run seed              # idempotent sample data (development only)
```

Initialize a **fresh** database: create an empty database, then run `npm run migrate`. To re-run migrations
from scratch, drop and recreate the database (destructive — never do this against production).

Seed accounts (development only — override with `SEED_*` variables):

| Role     | Email                 | Password        |
| -------- | --------------------- | --------------- |
| Admin    | `admin@souq.local`    | `Admin@12345`   |
| Seller   | `seller@souq.local`   | `Seller@12345`  |
| Customer | `customer@souq.local` | `Customer@12345`|

### Applying migrations to a hosted database

1. Put the hosted connection string in `.env` (`DATABASE_URL=...`).
2. Run `npm run migrate`.
   SSL is used automatically when `PGSSL=require` (the default in `NODE_ENV=production`).

---

## Creating the initial administrator

There is **no public endpoint** that can create an administrator. Use the privileged CLI script with
database access:

```bash
# via flags
node scripts/create-admin.js --email admin@example.com --name "Ops Admin" --password "StrongPass123"

# or via environment variables
ADMIN_EMAIL=admin@example.com ADMIN_PASSWORD=StrongPass123 ADMIN_NAME="Ops Admin" npm run create-admin
```

If the email already exists, the script promotes it to admin and rotates its password.

---

## Running the application

| Command                  | Purpose |
| ------------------------ | ------- |
| `npm run dev`            | Start with `nodemon` (auto-reload) |
| `npm start`              | Start with plain `node` (production) |
| `npm run migrate`        | Apply pending migrations |
| `npm run migrate:status` | Show migration status |
| `npm run seed`           | Insert development sample data |
| `npm run create-admin`   | Create/promote an administrator |
| `npm test`               | Run the automated test suite |

The server binds to `0.0.0.0` and uses `process.env.PORT` (Railway requirement).

---

## API reference

Base URL: `http://localhost:4000`. API routes are prefixed with `/api`.

### Authentication

| Method | Path                 | Access            | Purpose |
| ------ | -------------------- | ----------------- | ------- |
| POST   | `/api/auth/register` | Public            | Register a customer or seller (never admin) |
| POST   | `/api/auth/login`    | Public            | Authenticate and receive a JWT |
| GET    | `/api/auth/me`       | Authenticated     | Current user's profile |

### Products

| Method | Path                 | Access            | Purpose |
| ------ | -------------------- | ----------------- | ------- |
| GET    | `/api/products`      | Public            | List/filter/search/paginate active products |
| GET    | `/api/products/:id`  | Public            | Product details (inactive hidden from non-owners) |
| POST   | `/api/products`      | Seller            | Create a product owned by the caller |
| PATCH  | `/api/products/:id`  | Owning seller     | Update own product |
| DELETE | `/api/products/:id`  | Owning seller     | Delete own product (archives if it has order history) |

Supported query parameters for `GET /api/products`:

```text
?category=<slug>&categoryId=<id>&minPrice=10&maxPrice=500&search=keyboard
 &page=1&limit=10&sortBy=price&order=asc
```

`sortBy` is whitelisted to `price | name | created_at | stock`; `order` to `asc | desc`.
Sellers may add `&mine=true` to include their own inactive products.

### Categories

| Method | Path                    | Access | Purpose |
| ------ | ----------------------- | ------ | ------- |
| GET    | `/api/categories`       | Public | List categories (with product counts) |
| GET    | `/api/categories/:id`   | Public | Category details |
| POST   | `/api/categories`       | Admin  | Create a category |
| PATCH  | `/api/categories/:id`   | Admin  | Update a category |
| DELETE | `/api/categories/:id`   | Admin  | Delete a category (blocked while in use) |

### Cart

All cart endpoints require **customer** authentication and operate on the caller's own cart.

| Method | Path                    | Access   | Purpose |
| ------ | ----------------------- | -------- | ------- |
| GET    | `/api/cart`             | Customer | Get the current cart with server-calculated totals |
| POST   | `/api/cart/items`       | Customer | Add a product (or increase its quantity) |
| PATCH  | `/api/cart/items/:id`   | Customer | Set an item's quantity |
| DELETE | `/api/cart/items/:id`   | Customer | Remove an item |
| DELETE | `/api/cart`             | Customer | Clear the cart |

```json
POST /api/cart/items
{ "productId": 12, "quantity": 2 }
```

### Orders

| Method | Path                        | Access            | Purpose |
| ------ | --------------------------- | ----------------- | ------- |
| POST   | `/api/orders`               | Customer          | Create an order from the current cart |
| GET    | `/api/orders/me`            | Customer          | List own orders |
| GET    | `/api/orders/:id`           | Customer (own) / Admin | Order details |
| GET    | `/api/admin/orders`         | Admin             | List all orders |
| PATCH  | `/api/orders/:id/status`    | Admin             | Change order status (validated) |

```json
POST /api/orders
{ "shippingAddress": "221B Baker Street, London, NW1 6XE" }
```

### Health

| Method | Path             | Access | Purpose |
| ------ | ---------------- | ------ | ------- |
| GET    | `/health`        | Public | Liveness (process up) |
| GET    | `/health/ready`  | Public | Readiness (database reachable) |

### Response format

Success:

```json
{ "success": true, "data": {} }
```

Lists also include pagination metadata:

```json
{ "success": true, "data": [], "meta": { "page": 1, "limit": 10, "total": 0, "totalPages": 0, "hasNextPage": false, "hasPreviousPage": false } }
```

Error:

```json
{ "success": false, "message": "Insufficient stock", "error": { "code": "INSUFFICIENT_STOCK" } }
```

Status codes used: `200`, `201`, `204`, `400`, `401`, `403`, `404`, `409`, `500`.

---

## Authentication

1. `POST /api/auth/register` with `{ name, email, password, role }` where `role` is `customer` or `seller`.
2. `POST /api/auth/login` with `{ email, password }` returns `{ user, token }`.
3. Send the token on subsequent requests:

```http
Authorization: Bearer <token>
```

The JWT contains only `sub` (user id) and `role`. On every protected request the user is re-loaded from the
database, so deleted users and stale roles stop working immediately.

**Ownership rules**

- Sellers may only read/update/delete **their own** products (`403` otherwise).
- Customers may only access **their own** cart and orders. Another user's order returns `404` (not `403`)
  so the existence of the resource is not disclosed.
- Admins manage categories and all orders. Sellers have no order access.
- `sellerId`, `customerId`, prices and order totals supplied by the client are always ignored.

---

## Order creation and inventory transactions

`POST /api/orders` is the core of Souq. It runs inside **one PostgreSQL transaction** on a single
checked-out client (`withTransaction`). Steps:

1. Authenticate the customer (middleware).
2. `BEGIN`.
3. Read the customer's cart and its items.
4. Reject an **empty cart** (`400 EMPTY_CART`).
5. Lock every product row **in ascending `id` order** (`SELECT ... ORDER BY id FOR UPDATE`) to reduce deadlocks.
6. Verify each product exists, is active, and has enough stock.
7. Read the **current price from the database** (client prices are ignored).
8. Create the order and copy `order_items` with **name/price snapshots** and `line_total` computed by
   PostgreSQL (`p.price * ci.quantity`) using `NUMERIC`.
9. Decrement stock with an **atomic conditional update**:
   `UPDATE products SET stock = stock - $1 WHERE id = $2 AND is_active = TRUE AND stock >= $1`
   — no row returned means insufficient stock.
10. Empty the cart.
11. `COMMIT` and return the created order.

**On any failure** the transaction is rolled back: no partial order, no partial stock change, no cart
mutation. On success, the cart is cleared only after every order operation succeeded.

**No floating point.** `price`, `total_amount`, `unit_price` and `line_total` are `NUMERIC(12,2)`. All
arithmetic happens in PostgreSQL; `pg` returns these as strings. The small `src/utils/money.js` helper uses
integer cents backed by `BigInt` for the few non-database calculations (cart display and tests).

**Preventing overselling.** Because product rows are locked in a consistent order and the stock update is
conditional (`stock >= quantity`), two customers racing for the last unit serialize: the second sees the
reduced stock and receives `400 INSUFFICIENT_STOCK`. A test fires two concurrent orders at a one-unit
product and asserts exactly one succeeds and stock never goes negative.

---

## Order status state machine

```text
pending ──▶ confirmed ──▶ processing ──▶ shipped ──▶ delivered
   │            │              │
   └────────────┴──────────────┴──▶ cancelled
```

- Only admins can change status (`PATCH /api/orders/:id/status`).
- Invalid transitions return `400 INVALID_STATUS_TRANSITION`.
- `delivered` and `cancelled` are terminal.
- **Cancellation policy**: cancelling from `pending`, `confirmed` or `processing` restores stock for every
  order item. Because `cancelled` is terminal and transitions are validated, a repeated cancellation
  request fails and **cannot restore stock twice**.

---

## Postman

1. Start the API (`npm run dev` or `npm start`) and make sure the database is migrated/seeded.
2. In Postman: **Import** → `postman/Souq.postman_collection.json`.
3. Confirm the collection variable `baseUrl` (default `http://localhost:4000`).
4. Run the folders in order: **Health → Auth → Categories → Products → Cart → Orders**.
   Tokens and ids are saved automatically into collection variables (`customerToken`, `sellerToken`,
   `adminToken`, `categoryId`, `productId`, `cartItemId`, `orderId`).

Admin login uses the collection variables `adminEmail` / `adminPassword`
(defaults match the seed script: `admin@souq.local` / `Admin@12345`).

Documented workflow:

1. Start the API; run `npm run migrate` and `npm run seed`.
2. Register a customer and a seller (supported public flow), then log in as each role.
3. Log in as admin (created via `create-admin` or the seed).
4. Create a category as admin.
5. Create products as the seller.
6. Browse and filter products.
7. Add products to the cart.
8. Create an order.
9. Verify inventory decrement and cart clearing.
10. Test forbidden operations (folder "NEGATIVE - …").
11. Update order status as admin (including cancellation and an invalid transition).

Administrators are intentionally **never** creatable through public registration.

---

## Database schema overview

Seven application tables plus the migration tracker:

- **users** — `id`, `name`, `email` (unique), `password_hash`, `role` (`customer|seller|admin`), timestamps.
- **categories** — `id`, `name`, `slug` (unique), `description`, timestamps.
- **products** — `id`, `seller_id → users`, `category_id → categories`, `name`, `description`,
  `price NUMERIC(12,2)`, `stock INT >= 0`, `image_url`, `is_active`, timestamps.
- **carts** — `id`, `user_id → users` (unique — one cart per customer), timestamps.
- **cart_items** — `id`, `cart_id → carts`, `product_id → products`, `quantity INT > 0`,
  unique `(cart_id, product_id)`, timestamps.
- **orders** — `id`, `customer_id → users`, `status`, `total_amount NUMERIC(12,2)`,
  `shipping_address` (order-time snapshot), timestamps.
- **order_items** — `id`, `order_id → orders`, `product_id → products` (nullable),
  `product_name`, `unit_price`, `quantity`, `line_total`, timestamps.

Constraints, indexes and trigger-maintained `updated_at` columns are defined in the migrations.

**Deletion policies**

- `products.category_id → categories ON DELETE RESTRICT` and the service blocks category deletion while
  products reference it (`409 CATEGORY_IN_USE`).
- `order_items.order_id → orders ON DELETE CASCADE`.
- `order_items.product_id → products ON DELETE SET NULL` (nullable) so order history survives product removal;
  the snapshot columns preserve the purchased name and price regardless.
- Sellers deleting a product with order history archive it (`is_active = false`) instead of removing the row.
- `carts.user_id` and `cart_items.cart_id` cascade on delete.

---

## Testing

Tests use Node's built-in test runner with `supertest` and run against an **isolated test database** —
never against development or production data.

```bash
npm test           # run everything
node --test "tests/orders.test.js"   # run one file
```

**Test database resolution** (`tests/helpers/testEnv.js`):

1. `TEST_DATABASE_URL` if set, else
2. `DATABASE_URL` with the database name suffixed by `_test` (e.g. `souq_dev` → `souq_dev_test`).

So create the test database once:

```bash
createdb souq_dev_test       # or: psql -U postgres -c "CREATE DATABASE souq_dev_test;"
```

The suite applies migrations automatically and truncates tables between tests. It covers:

- registration, login, duplicate email, validation errors, and the admin-registration block;
- missing/invalid JWTs and protected routes;
- role restrictions and seller product ownership;
- cart privacy and customer ownership;
- product filtering, search, pagination and sorting;
- empty-cart rejection;
- server-side price/total calculation, including ignoring client-supplied totals;
- successful order creation, inventory decrement and cart clearing;
- insufficient-stock rejection (before and after stock changes);
- full rollback when order creation fails mid-transaction;
- concurrent purchase of the last unit (no overselling);
- order access restrictions;
- status transition validation and one-time stock restoration on cancellation.

`BCRYPT_SALT_ROUNDS` is reduced to `4` in the test environment for speed.

---

## Docker

```bash
# build and start API + PostgreSQL together
docker compose up --build

# the API runs migrations and seeds on start
# API:        http://localhost:4000
# PostgreSQL: localhost:5432  (souq / souq_pass / souq_dev)
```

Standalone image:

```bash
docker build -t souq-api .
docker run --rm -p 4000:4000 \
  -e DATABASE_URL="postgres://souq:souq_pass@host.docker.internal:5432/souq_dev" \
  -e JWT_SECRET="change-me-to-a-long-random-value-1234567890" \
  -e PGSSL=disable \
  souq-api
```

The image installs production dependencies, exposes port `4000`, includes a container `HEALTHCHECK`, runs
as the non-root `node` user, and runs `npm run migrate` before starting the server.

---

## GitHub setup

```bash
git init
git add .
git commit -m "feat: complete Souq e-commerce REST API MVP"
git branch -M main
git remote add origin https://github.com/<your-username>/souq-api.git
git push -u origin main
```

`.env` is git-ignored; only `.env.example` is committed. Double-check with `git status` that no secrets are staged.

---

## Railway deployment

1. Push the repository to GitHub (above).
2. In Railway: **New Project → Deploy from GitHub repo** and select the repository.
3. Add a database: **New → Database → PostgreSQL**. Railway provides `DATABASE_URL` to your service.
4. On the API service → **Variables**, add:
   - `DATABASE_URL` — reference the PostgreSQL service (`${{Postgres.DATABASE_URL}}`).
   - `JWT_SECRET` — a long random string.
   - `JWT_EXPIRES_IN` — e.g. `1d`.
   - `BCRYPT_SALT_ROUNDS` — `12`.
   - `PGSSL` — `require`.
   - `NODE_ENV` — `production`.
   `PORT` is injected by Railway automatically.
5. Deploy. The `Dockerfile` runs `npm run migrate && npm start`, so the schema is created on first boot.
   (If you deploy without Docker, set the start command to `npm run migrate && npm start`.)
6. Create the first admin from the Railway shell:
   `ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='StrongPass123' npm run create-admin`
7. Verify `https://<your-app>.up.railway.app/health` returns `200`.

> The project is **prepared** for Railway but has **not** been deployed or tested against Railway here.

---

## Connecting a hosted PostgreSQL database

1. Copy `.env.example` to `.env`.
2. Paste the provider's connection string into `DATABASE_URL`, e.g.
   `postgres://USER:PASSWORD@HOST:PORT/DBNAME?sslmode=require`.
3. Set `PGSSL=require` (hosted providers normally require SSL).
4. Set a strong `JWT_SECRET`.
5. Apply the schema: `npm run migrate`.
6. Optionally seed development data (`npm run seed`) — **do not** run the seed against production.
7. Create the first admin: `npm run create-admin`.
8. Start the app: `npm start`.

No code changes are required — only environment variables.

---

## Troubleshooting

| Symptom | Cause / fix |
| ------- | ----------- |
| `Missing required environment variable: DATABASE_URL` | `.env` is missing or the variable is empty. Copy `.env.example` → `.env`. |
| `ECONNREFUSED` when starting | PostgreSQL is not running, wrong host/port, or wrong credentials. Check `DATABASE_URL`. |
| `password authentication failed` | Wrong user/password in `DATABASE_URL` (remember to URL-encode special characters). |
| `database "souq_dev" does not exist` | Create it (`createdb souq_dev`) or point `DATABASE_URL` at an existing database. |
| `self signed certificate` / SSL errors | Use `PGSSL=require` for hosted providers; `PGSSL=disable` locally. |
| `Cannot find module 'tests'` style errors | Use the provided scripts (`npm test`), not `node --test tests/`. |
| Tests fail connecting | The `_test` database does not exist — create it (see [Testing](#testing)). |
| `401` on a request that used to work | Token expired or `JWT_SECRET` changed. Log in again. |
| `409 CATEGORY_IN_USE` | Reassign/remove the category's products before deleting it. |
| `400 INSUFFICIENT_STOCK` | Requested quantity exceeds available stock at checkout time. |

---

## Limitations and manual steps

- **No payment gateway** — orders model status only, as permitted by the MVP scope.
- **Single cart per customer** — enforced by a unique `user_id` on `carts`.
- **No refresh tokens / rate limiting / password reset** — out of MVP scope.
- **Search** uses `ILIKE` over name/description (no fuzzy/trigram ranking).
- **Concurrency** relies on row locking + conditional updates; verified by tests, not by production load.
- **Deployment is documented but not executed** — you must create the Railway project, add the PostgreSQL
  service and set the environment variables yourself.
- **Migrations are forward-only** — there are no down-migrations (never auto-drop production data).
