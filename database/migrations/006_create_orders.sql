-- 006_create_orders.sql
-- Orders belong to the customer who created them.
-- `shipping_address` is a required snapshot taken at order time.
-- `total_amount` is computed by the server from NUMERIC line totals.

CREATE TABLE IF NOT EXISTS orders (
    id               SERIAL PRIMARY KEY,
    customer_id      INTEGER NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
    status           VARCHAR(20) NOT NULL DEFAULT 'pending',
    total_amount     NUMERIC(12, 2) NOT NULL,
    shipping_address TEXT NOT NULL,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT orders_status_check CHECK (
        status IN ('pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled')
    ),
    CONSTRAINT orders_total_non_negative CHECK (total_amount >= 0),
    CONSTRAINT orders_shipping_address_not_blank CHECK (length(btrim(shipping_address)) > 0)
);

CREATE INDEX IF NOT EXISTS orders_customer_id_idx ON orders (customer_id);
CREATE INDEX IF NOT EXISTS orders_status_idx      ON orders (status);
CREATE INDEX IF NOT EXISTS orders_created_at_idx  ON orders (created_at DESC);

DROP TRIGGER IF EXISTS orders_set_updated_at ON orders;
CREATE TRIGGER orders_set_updated_at
    BEFORE UPDATE ON orders
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
