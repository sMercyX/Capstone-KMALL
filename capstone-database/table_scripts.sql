-- ========= USERS =========
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ms_id TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    display_name TEXT NOT NULL,
    profile_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_login TIMESTAMPTZ,
    CONSTRAINT chk_email_kmutt CHECK (email ~* '^[A-Z0-9._%+\-]+@kmutt\.ac\.th$') 
);

-- ========= ROLES =========
CREATE TABLE IF NOT EXISTS roles (
	id SERIAL PRIMARY KEY,
	role_name TEXT NOT NULL UNIQUE,
	description TEXT,
	created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ========= USER_ROLE =========
CREATE TABLE IF NOT  EXISTS user_roles (
	user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
	role_id INT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
	created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
	PRIMARY KEY (user_id, role_id)
);

-- ========= STORES =========
CREATE TABLE IF NOT EXISTS stores (
    id SERIAL PRIMARY KEY,
    store_name TEXT NOT NULL,
    store_desc TEXT,
    profile_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE
);

-- ===== CATEGORIES =====
CREATE TABLE IF NOT EXISTS categories (
  id          SERIAL PRIMARY KEY,
  name        TEXT        NOT NULL,
  slug        TEXT        NOT NULL,
  parent_id   INT         REFERENCES categories(id) ON DELETE SET NULL,
  sort_order  INT         NOT NULL DEFAULT 0,
  is_active   BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ========= PRODUCTS =========
CREATE TABLE IF NOT EXISTS products (
  id            SERIAL PRIMARY KEY,
  name          TEXT NOT NULL,
  product_desc  TEXT,
  price         NUMERIC(10,2) NOT NULL,
  stock         INT NOT NULL DEFAULT 0,
  image_url     TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

  stores_id     INT  NOT NULL REFERENCES stores(id)     ON DELETE CASCADE,
  categories_id INT       REFERENCES categories(id)      ON DELETE SET NULL
);



