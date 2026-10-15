-- 000_create_schema_migrations.sql
-- Tracks which migrations have already been applied. Created first so the
-- migration runner can record its own progress.

CREATE TABLE IF NOT EXISTS schema_migrations (
    id          SERIAL PRIMARY KEY,
    filename    VARCHAR(255) NOT NULL UNIQUE,
    checksum    VARCHAR(64) NOT NULL,
    applied_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
