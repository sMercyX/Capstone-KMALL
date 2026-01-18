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

  delivery_round_university_enabled BOOLEAN NOT NULL DEFAULT FALSE,

  campus_enabled BOOLEAN NOT NULL DEFAULT FALSE,

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

  -- สำหรับ search (Full-text)
  search_tsv tsvector,

  -- Semantic Search (AI / Ollama / pgvector)
  embedding vector(768) NULL,

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

-- ========= CAMPUS LOCATIONS =========
CREATE TABLE IF NOT EXISTS campus_locations (
  campus_location_id SERIAL PRIMARY KEY,
  name VARCHAR(120) NOT NULL,    
  area VARCHAR(80) NULL,          
  latitude NUMERIC(10,7) NULL,
  longitude NUMERIC(10,7) NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_campus_locations_name UNIQUE (name)
);

CREATE TABLE IF NOT EXISTS user_addresses (
  address_id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,

  label VARCHAR(50) NULL,            
  address_line1 VARCHAR(150) NOT NULL,
  address_line2 VARCHAR(150) NULL,
  district VARCHAR(80) NULL,
  province VARCHAR(80) NULL,
  postal_code VARCHAR(10) NULL,
  phone VARCHAR(30) NULL,

  latitude NUMERIC(10,7) NULL,
  longitude NUMERIC(10,7) NULL,

  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ========= ORDERS =========
CREATE TABLE IF NOT EXISTS orders (
  order_id SERIAL PRIMARY KEY,

  status VARCHAR(45) NOT NULL
    CHECK (
      status IN (
        'Pending Seller Confirmation',
        'Awaiting Buyer Confirmation',
        'Ready for Pickup',
        'Ready for Delivery',
        'Completed',
        'Cancelled'
      )
    ),

  total_price DECIMAL(10,2) NOT NULL,

  order_date TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

  delivery_method VARCHAR(10) NOT NULL DEFAULT 'DELIVERY'
    CHECK (delivery_method IN ('DELIVERY','CAMPUS')),

  delivery_address_id BIGINT NULL,       
  campus_location_id INT NULL,           
  campus_detail_note VARCHAR(255) NULL,   

  delivery_agreement_status VARCHAR(12) NOT NULL DEFAULT 'NONE'
    CHECK (delivery_agreement_status IN ('NONE','PROPOSED','CONFIRMED')),

  deliver_at_start TIMESTAMPTZ NULL,
  deliver_at_end   TIMESTAMPTZ NULL,

  delivery_confirmed_at TIMESTAMPTZ NULL,

  -- ========= Cancel =========
  cancelled_at TIMESTAMPTZ NULL,
  cancelled_by VARCHAR(10)
    CHECK (cancelled_by IN ('BUYER','SELLER','SYSTEM')),
  cancelled_reason VARCHAR(255),

  user_id UUID NOT NULL,
  store_id INT NOT NULL,

  CONSTRAINT fk_orders_users1 FOREIGN KEY (user_id)
    REFERENCES users (user_id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,

  CONSTRAINT fk_orders_stores1 FOREIGN KEY (store_id)
    REFERENCES stores (store_id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,

  CONSTRAINT fk_orders_delivery_address FOREIGN KEY (delivery_address_id)
    REFERENCES user_addresses (address_id)
    ON DELETE RESTRICT,

  CONSTRAINT fk_orders_campus_location FOREIGN KEY (campus_location_id)
    REFERENCES campus_locations (campus_location_id)
    ON DELETE RESTRICT,

  CONSTRAINT chk_delivery_destination_required CHECK (
    (delivery_method = 'DELIVERY'
      AND delivery_address_id IS NOT NULL
      AND campus_location_id IS NULL)
    OR
    (delivery_method = 'CAMPUS'
      AND delivery_address_id IS NULL
      AND campus_location_id IS NOT NULL)
  ),

  CONSTRAINT chk_delivery_time_range CHECK (
    deliver_at_start IS NULL
    OR deliver_at_end IS NULL
    OR deliver_at_start <= deliver_at_end
  ),

  CONSTRAINT chk_confirm_requires_data CHECK (
    delivery_agreement_status <> 'CONFIRMED'
    OR (
      delivery_confirmed_at IS NOT NULL
      AND deliver_at_start IS NOT NULL
      AND deliver_at_end IS NOT NULL
    )
  ),

  CONSTRAINT chk_cancel_meta_required CHECK (
    status <> 'Cancelled'
    OR (cancelled_at IS NOT NULL AND cancelled_by IS NOT NULL)
  )
);


-- ========= ORDER_ITEMS =========
CREATE TABLE IF NOT EXISTS order_items (
  order_item_id SERIAL PRIMARY KEY,
  quantity INT NOT NULL,
  unit_price DECIMAL(10,2) NOT NULL,
  fulfillment_type VARCHAR(8) NOT NULL
    CHECK (fulfillment_type IN ('STANDARD', 'EXPRESS')),
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


-- ========= ORDER CHAT: THREAD =========
CREATE TABLE IF NOT EXISTS order_chat_threads (
  thread_id BIGSERIAL PRIMARY KEY,
  order_id INT NOT NULL UNIQUE REFERENCES orders(order_id) ON DELETE CASCADE,
  buyer_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  seller_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ========= ORDER CHAT: MESSAGES =========
CREATE TABLE IF NOT EXISTS order_chat_messages (
  message_id BIGSERIAL PRIMARY KEY,
  thread_id BIGINT NOT NULL REFERENCES order_chat_threads(thread_id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  message_text TEXT NOT NULL,
  message_type VARCHAR(20) NOT NULL DEFAULT 'TEXT' CHECK (message_type IN ('TEXT','SYSTEM')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ========= READ STATE =========
CREATE TABLE IF NOT EXISTS order_chat_read_state (
  thread_id BIGINT NOT NULL REFERENCES order_chat_threads(thread_id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  last_read_message_id BIGINT NULL,
  last_read_at TIMESTAMPTZ NULL,
  PRIMARY KEY (thread_id, user_id)
);


-- ========= ATTRIBUTE KEYS  =========
CREATE TABLE IF NOT EXISTS product_attribute_keys (
  attr_key_id SERIAL PRIMARY KEY,
  key_name VARCHAR(50) NOT NULL UNIQUE
);

-- ========= ATTRIBUTE VALUES =========
CREATE TABLE IF NOT EXISTS product_attribute_values (
  product_id INT NOT NULL REFERENCES products(product_id) ON DELETE CASCADE,
  attr_key_id INT NOT NULL REFERENCES product_attribute_keys(attr_key_id) ON DELETE CASCADE,
  value_text VARCHAR(100) NOT NULL,
  PRIMARY KEY (product_id, attr_key_id, value_text)
);


-- ========= RECOMMENDATION EVENTS =========
CREATE TABLE IF NOT EXISTS recommendation_events (
  event_id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  order_id INT NULL REFERENCES orders(order_id) ON DELETE SET NULL,
  trigger_type VARCHAR(30) NOT NULL CHECK (trigger_type IN ('ORDER_CANCELLED','SEARCH','PRODUCT_VIEW')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ========= RECOMMENDED ITEMS =========
CREATE TABLE IF NOT EXISTS recommendation_event_items (
  event_id BIGINT NOT NULL REFERENCES recommendation_events(event_id) ON DELETE CASCADE,
  product_id INT NOT NULL REFERENCES products(product_id) ON DELETE CASCADE,
  score DOUBLE PRECISION NULL,
  rank_no INT NOT NULL,
  reason VARCHAR(50) NULL,
  PRIMARY KEY (event_id, product_id)
);


-- ========= ORDER STATUS HISTORY =========
CREATE TABLE IF NOT EXISTS order_status_history (
  history_id BIGSERIAL PRIMARY KEY,
  order_id INT NOT NULL REFERENCES orders(order_id) ON DELETE CASCADE,
  old_status VARCHAR(45) NULL,
  new_status VARCHAR(45) NOT NULL,
  changed_by UUID NULL REFERENCES users(user_id) ON DELETE SET NULL,
  note VARCHAR(255) NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ========= HOMEPAGE BANNERS (Admin-managed) =========
CREATE TABLE IF NOT EXISTS homepage_banners (
  banner_id BIGSERIAL PRIMARY KEY,

  image_url VARCHAR(255) NOT NULL,
  link_url  VARCHAR(255) NULL,    

  title    VARCHAR(120) NULL,
  alt_text VARCHAR(255) NULL,

  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INT NOT NULL DEFAULT 1,

  start_at TIMESTAMPTZ NULL,
  end_at   TIMESTAMPTZ NULL,

  created_by UUID NULL REFERENCES users(user_id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_banner_time CHECK (
    start_at IS NULL OR end_at IS NULL OR start_at <= end_at
  )
);

-- ========= CAMPUS DELIVERY PROPOSALS (Round University Delivery) =========
CREATE TABLE IF NOT EXISTS order_campus_delivery_proposals (
  proposal_id BIGSERIAL PRIMARY KEY,

  order_id INT NOT NULL REFERENCES orders(order_id) ON DELETE CASCADE,

  delivery_address_id BIGINT NOT NULL REFERENCES user_addresses(address_id) ON DELETE RESTRICT,

  proposed_start_at TIMESTAMPTZ NOT NULL,
  proposed_end_at   TIMESTAMPTZ NOT NULL,

  status VARCHAR(12) NOT NULL DEFAULT 'PROPOSED'
    CHECK (status IN ('DRAFT','PROPOSED','CONFIRMED','CANCELLED')),

  proposed_by UUID NULL REFERENCES users(user_id) ON DELETE SET NULL,  
  confirmed_by UUID NULL REFERENCES users(user_id) ON DELETE SET NULL,

  note VARCHAR(255) NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_proposal_time CHECK (proposed_start_at <= proposed_end_at)
);

-- ========= CAMPUS DELIVERY AGREEMENT (Locked source of truth) =========
CREATE TABLE IF NOT EXISTS order_campus_delivery_agreements (
  order_id INT PRIMARY KEY REFERENCES orders(order_id) ON DELETE CASCADE,

  delivery_address_id BIGINT NOT NULL REFERENCES user_addresses(address_id) ON DELETE RESTRICT,

  confirmed_start_at TIMESTAMPTZ NOT NULL,
  confirmed_end_at   TIMESTAMPTZ NOT NULL,

  confirmed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  confirmed_by UUID NULL REFERENCES users(user_id) ON DELETE SET NULL,

  CONSTRAINT chk_agreement_time CHECK (confirmed_start_at <= confirmed_end_at)
);
