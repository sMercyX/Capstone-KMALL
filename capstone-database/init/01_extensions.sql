-- use gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS pgcrypto;
-- Fuzzy search (LIKE / ILIKE)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE EXTENSION IF NOT EXISTS vector;