-- 001_create_users.sql
-- Application users. A single table holds customers, sellers and admins,
-- distinguished by the `role` column.

-- Shared trigger function: keeps `updated_at` accurate on every UPDATE.
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE IF NOT EXISTS users (
    id            SERIAL PRIMARY KEY,
    name          VARCHAR(120) NOT NULL,
    email         VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role          VARCHAR(20)  NOT NULL DEFAULT 'customer',
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),

    CONSTRAINT users_role_check CHECK (role IN ('customer', 'seller', 'admin')),
    -- Emails are stored lower-cased; enforce it at the database level too.
    CONSTRAINT users_email_lowercase_check CHECK (email = lower(email)),
    CONSTRAINT users_name_not_blank CHECK (length(btrim(name)) > 0),
    CONSTRAINT users_email_not_blank CHECK (length(btrim(email)) > 0)
);

-- Case-insensitive uniqueness is guaranteed because emails are lower-cased,
-- but the plain unique index keeps lookups fast and gives a clean 23505 error.
CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique_idx ON users (email);

DROP TRIGGER IF EXISTS users_set_updated_at ON users;
CREATE TRIGGER users_set_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
