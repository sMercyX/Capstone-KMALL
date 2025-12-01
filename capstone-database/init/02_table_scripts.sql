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
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  user_id UUID NOT NULL,
  CONSTRAINT fk_stores_users1 FOREIGN KEY (user_id)
    REFERENCES users (user_id)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION,
  CONSTRAINT uq_stores_store_name UNIQUE (store_name)
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
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_categories_slug UNIQUE (slug),
  CONSTRAINT fk_categories_parent FOREIGN KEY (parent_id)
    REFERENCES categories (category_id)
    ON DELETE SET NULL
    ON UPDATE CASCADE
);

-- ========= PRODUCTS =========
CREATE TABLE IF NOT EXISTS products (
  product_id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  product_desc VARCHAR(255) NULL,
  price DECIMAL(10,2) NOT NULL,
  image_url VARCHAR(255) NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  is_active VARCHAR(3) NOT NULL CHECK (is_active IN ('YES', 'NO')),
  store_id INT NOT NULL,
  category_id INT NOT NULL,
  CONSTRAINT fk_products_stores1 FOREIGN KEY (store_id)
    REFERENCES stores (store_id)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION,
  CONSTRAINT fk_products_categories1 FOREIGN KEY (category_id)
    REFERENCES categories (category_id)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION,
  CONSTRAINT uq_products_name UNIQUE (name)
);

-- ========= ORDERS =========
CREATE TABLE IF NOT EXISTS orders (
  order_id SERIAL PRIMARY KEY,
  status VARCHAR(45) NOT NULL CHECK (status IN ('Pending Seller Confirmation', 'Awaiting Buyer Confirmation', 'Ready for Pickup', 'Ready for Delivery', 'Completed', 'Cancelled')), 
  total_price DECIMAL(10,2) NOT NULL,
  order_date TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  cancelled_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  user_id UUID NOT NULL,
  store_id INT NOT NULL,
  CONSTRAINT fk_orders_users1 FOREIGN KEY (user_id)
    REFERENCES users (user_id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT fk_orders_stores1 FOREIGN KEY (store_id)
    REFERENCES stores (store_id)
    ON DELETE CASCADE
    ON UPDATE CASCADE
);

-- ========= ORDER_ITEMS =========
CREATE TABLE IF NOT EXISTS order_items (
  order_item_id SERIAL PRIMARY KEY,
  quantity INT NOT NULL,
  unit_price DECIMAL(10,2) NOT NULL,
  fulfillment_type VARCHAR(8) NOT NULL CHECK (fulfillment_type IN ('STANDARD', 'EXPRESS')),
  subtotal DECIMAL(10,2) NOT NULL,
  deposit_amount DECIMAL(10,2) NULL,
  promised_ship_date TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  order_id INT NOT NULL,
  product_id INT NOT NULL,
  CONSTRAINT fk_order_items_orders1 FOREIGN KEY (order_id)
    REFERENCES orders (order_id)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION,
  CONSTRAINT fk_order_items_products1 FOREIGN KEY (product_id)
    REFERENCES products (product_id)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION
);

-- ========= CARTS =========
CREATE TABLE IF NOT EXISTS carts (
  cart_id SERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  user_id UUID NOT NULL,
  CONSTRAINT fk_carts_users1 FOREIGN KEY (user_id)
    REFERENCES users (user_id)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION
);

-- ========= CART_ITEMS =========
CREATE TABLE IF NOT EXISTS cart_items (
  cart_item_id SERIAL PRIMARY KEY,
  quantity INT NULL,
  cart_id INT NOT NULL,
  product_id INT NOT NULL,
  CONSTRAINT fk_cart_items_carts1 FOREIGN KEY (cart_id)
    REFERENCES carts (cart_id)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION,
  CONSTRAINT fk_cart_items_products1 FOREIGN KEY (product_id)
    REFERENCES products (product_id)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION,
    CONSTRAINT uq_cart_items_cart_product UNIQUE (cart_id, product_id)
);

-- ========= STORE_IMAGES =========
CREATE TABLE IF NOT EXISTS store_images (
  store_image_id SERIAL PRIMARY KEY,
  store_id INT NOT NULL,
  image_url VARCHAR(255) NOT NULL,
  sort_order INT NOT NULL DEFAULT 1,
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_store_images_store FOREIGN KEY (store_id)
    REFERENCES stores (store_id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT uq_store_images_store_sort UNIQUE (store_id, sort_order)
);

-- ========= PRODUCT_IMAGES =========
CREATE TABLE IF NOT EXISTS product_images (
  product_image_id SERIAL PRIMARY KEY,
  product_id INT NOT NULL,
  image_url VARCHAR(255) NOT NULL,
  sort_order INT NOT NULL DEFAULT 1,
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_product_images_product FOREIGN KEY (product_id)
    REFERENCES products (product_id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT uq_product_images_product_sort UNIQUE (product_id, sort_order)
);