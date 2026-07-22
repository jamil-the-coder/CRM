-- Enables trigram similarity matching (used for fuzzy contact dedupe on
-- name/company) via the pg_trgm extension bundled with standard Postgres.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Speeds up similarity() lookups on the columns fuzzy dedupe actually queries.
CREATE INDEX IF NOT EXISTS contacts_full_name_trgm_idx ON contacts USING gin ((first_name || ' ' || coalesce(last_name, '')) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS contacts_company_trgm_idx ON contacts USING gin (company gin_trgm_ops);
