-- use gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Fuzzy search (LIKE / ILIKE)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- pgvector
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_available_extensions
    WHERE name = 'vector'
  ) THEN
    EXECUTE 'CREATE EXTENSION IF NOT EXISTS vector';
  END IF;
END$$;
