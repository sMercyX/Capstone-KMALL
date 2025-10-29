-- ========= USERS =========
CREATE TABLE IF NOT EXISTS users (
  user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kms_id VARCHAR(45) NOT NULL,
  email VARCHAR(100) NOT NULL,
  display_name VARCHAR(100) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_login TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (kms_id),
  UNIQUE (email)
);

-- ========= ROLES =========
CREATE TABLE IF NOT EXISTS roles (
  role_id SERIAL PRIMARY KEY,
  role_name VARCHAR(45) NOT NULL,
  role_desc VARCHAR(255) NULL,
  UNIQUE (role_name)
);

-- ========= USER_ROLES =========
CREATE TABLE IF NOT EXISTS user_roles (
  user_id UUID NOT NULL,
  role_id INT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, role_id),
  CONSTRAINT fk_users_has_roles_users FOREIGN KEY (user_id)
    REFERENCES users (user_id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT fk_users_has_roles_roles1 FOREIGN KEY (role_id)
    REFERENCES roles (role_id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE
);

-- ========= STORES =========
CREATE TABLE IF NOT EXISTS stores (
  store_id SERIAL PRIMARY KEY,
  store_name VARCHAR(100) NOT NULL,
  store_desc VARCHAR(255) NULL,
  profile_url VARCHAR(255) NULL,
  is_active VARCHAR(3) NOT NULL CHECK (is_active IN ('YES', 'NO')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, 
  updated_at TIMESTAMPTZ NOT NULL,
  user_id UUID NOT NULL,
  CONSTRAINT fk_stores_users1 FOREIGN KEY (user_id)
    REFERENCES users (user_id)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION
);

-- ========= CATEGORIES =========
CREATE TABLE IF NOT EXISTS categories (
  category_id SERIAL PRIMARY KEY,
  name VARCHAR(45) NOT NULL,
  slug VARCHAR(100) NOT NULL,
  parent_id INT NULL,
  sort_order INT NOT NULL,
  is_active VARCHAR(3) NOT NULL CHECK (is_active IN ('YES', 'NO')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT fk_categories_parent FOREIGN KEY (parent_id)
    REFERENCES categories (category_id)
    ON DELETE SET NULL
    ON UPDATE CASCADE
);