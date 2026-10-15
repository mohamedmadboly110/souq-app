-- 003_create_products.sql
-- Products are owned by a seller (users.id) and belong to a category.
-- Prices use NUMERIC (exact decimal), never floating point.
--
-- Deletion policy: order_items references products with ON DELETE SET NULL so
-- order history is preserved even if a product row is physically removed
-- (order_items keeps its own name/price snapshot columns).

CREATE TABLE IF NOT EXISTS products (
    id          SERIAL PRIMARY KEY,
    seller_id   INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    category_id INTEGER NOT NULL REFERENCES categories (id) ON DELETE RESTRICT,
    name        VARCHAR(200) NOT NULL,
    description TEXT,
    price       NUMERIC(12, 2) NOT NULL,
    stock       INTEGER NOT NULL DEFAULT 0,
    image_url   TEXT,
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT products_price_non_negative CHECK (price >= 0),
    CONSTRAINT products_stock_non_negative CHECK (stock >= 0),
    CONSTRAINT products_name_not_blank CHECK (length(btrim(name)) > 0)
);

CREATE INDEX IF NOT EXISTS products_seller_id_idx   ON products (seller_id);
CREATE INDEX IF NOT EXISTS products_category_id_idx ON products (category_id);
CREATE INDEX IF NOT EXISTS products_is_active_idx   ON products (is_active);
-- Supports case-insensitive search by name.
CREATE INDEX IF NOT EXISTS products_name_lower_idx  ON products (lower(name));

DROP TRIGGER IF EXISTS products_set_updated_at ON products;
CREATE TRIGGER products_set_updated_at
    BEFORE UPDATE ON products
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
