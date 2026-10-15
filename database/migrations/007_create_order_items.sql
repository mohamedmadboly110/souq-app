-- 007_create_order_items.sql
-- Purchase-time snapshots. `product_name` and `unit_price` are copied from the
-- product when the order is created, so later changes to (or removal of) the
-- product never alter historical orders.
--
-- `product_id` uses ON DELETE SET NULL (nullable) so a product row can be
-- physically removed without deleting order history.

CREATE TABLE IF NOT EXISTS order_items (
    id           SERIAL PRIMARY KEY,
    order_id     INTEGER NOT NULL REFERENCES orders (id) ON DELETE CASCADE,
    product_id   INTEGER REFERENCES products (id) ON DELETE SET NULL,
    product_name VARCHAR(200) NOT NULL,
    unit_price   NUMERIC(12, 2) NOT NULL,
    quantity     INTEGER NOT NULL,
    line_total   NUMERIC(12, 2) NOT NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT order_items_quantity_positive CHECK (quantity > 0),
    CONSTRAINT order_items_unit_price_non_negative CHECK (unit_price >= 0),
    CONSTRAINT order_items_line_total_non_negative CHECK (line_total >= 0)
);

CREATE INDEX IF NOT EXISTS order_items_order_id_idx   ON order_items (order_id);
CREATE INDEX IF NOT EXISTS order_items_product_id_idx ON order_items (product_id);

DROP TRIGGER IF EXISTS order_items_set_updated_at ON order_items;
CREATE TRIGGER order_items_set_updated_at
    BEFORE UPDATE ON order_items
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
