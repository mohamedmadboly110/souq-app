-- 002_create_categories.sql
-- Product categories. Managed by administrators only.

CREATE TABLE IF NOT EXISTS categories (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(120) NOT NULL,
    slug        VARCHAR(140) NOT NULL,
    description TEXT,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),

    CONSTRAINT categories_name_not_blank CHECK (length(btrim(name)) > 0),
    CONSTRAINT categories_slug_not_blank CHECK (length(btrim(slug)) > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS categories_name_unique_idx ON categories (lower(name));
CREATE UNIQUE INDEX IF NOT EXISTS categories_slug_unique_idx ON categories (slug);

DROP TRIGGER IF EXISTS categories_set_updated_at ON categories;
CREATE TRIGGER categories_set_updated_at
    BEFORE UPDATE ON categories
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
