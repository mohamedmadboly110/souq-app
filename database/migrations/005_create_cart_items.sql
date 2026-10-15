-- 005_create_cart_items.sql
-- Items inside a cart. `(cart_id, product_id)` is unique so adding the same
-- product twice updates the existing row's quantity instead of duplicating.

CREATE TABLE IF NOT EXISTS cart_items (
    id         SERIAL PRIMARY KEY,
    cart_id    INTEGER NOT NULL REFERENCES carts (id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES products (id) ON DELETE CASCADE,
    quantity   INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT cart_items_quantity_positive CHECK (quantity > 0),
    CONSTRAINT cart_items_cart_product_unique UNIQUE (cart_id, product_id)
);

CREATE INDEX IF NOT EXISTS cart_items_cart_id_idx    ON cart_items (cart_id);
CREATE INDEX IF NOT EXISTS cart_items_product_id_idx ON cart_items (product_id);

DROP TRIGGER IF EXISTS cart_items_set_updated_at ON cart_items;
CREATE TRIGGER cart_items_set_updated_at
    BEFORE UPDATE ON cart_items
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
