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

  -- Semantic Search (legacy / overall)
  -- embedding vector(768) NULL,

  -- Semantic Search (split fields for weighted scoring)
  embedding_name     vector(768) NULL,
  embedding_desc     vector(768) NULL,
  embedding_category vector(768) NULL,
  -- embedding_price    vector(768) NULL,

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
  zone VARCHAR(80) NULL,          
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

-- ========= ORDERS (Round University + Campus only) =========
CREATE TABLE IF NOT EXISTS orders (
  order_id SERIAL PRIMARY KEY,

  status VARCHAR(45) NOT NULL
    CHECK (status IN (
      'Pending','Proposed','Accepted',
      'Out For Delivery','Arrived',
      'Completed','Cancelled'
    )),

  total_price DECIMAL(10,2) NOT NULL,

  order_date TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

  delivery_method VARCHAR(20) NOT NULL
    CHECK (delivery_method IN ('ROUND_UNIVERSITY','CAMPUS')),

  -- ROUND_UNIVERSITY
  delivery_address_id BIGINT NULL,

  -- CAMPUS (optional note only)
  campus_location_id INT NULL,
  campus_detail_note VARCHAR(255) NULL,

  -- Proposal (CAMPUS only)
  proposed_at TIMESTAMPTZ NULL,
  meeting_location_id INT NULL,
  meeting_note VARCHAR(255) NULL,

  cancelled_at TIMESTAMPTZ NULL,
  cancelled_by VARCHAR(10)
    CHECK (cancelled_by IN ('BUYER','SELLER','SYSTEM')),
  cancelled_reason VARCHAR(255) NULL,

  user_id UUID NOT NULL,
  store_id INT NOT NULL,

  -- ===== FK =====
  CONSTRAINT fk_orders_users
    FOREIGN KEY (user_id) REFERENCES users(user_id),

  CONSTRAINT fk_orders_stores
    FOREIGN KEY (store_id) REFERENCES stores(store_id),

  CONSTRAINT fk_orders_delivery_address
    FOREIGN KEY (delivery_address_id) REFERENCES user_addresses(address_id),

  CONSTRAINT fk_orders_meeting_location
    FOREIGN KEY (meeting_location_id) REFERENCES campus_locations(campus_location_id),

  -- ===== destination rules =====
  CONSTRAINT chk_destination_by_method CHECK (
    (delivery_method = 'ROUND_UNIVERSITY' AND delivery_address_id IS NOT NULL)
    OR
    (delivery_method = 'CAMPUS' AND delivery_address_id IS NULL)
  ),

  -- ===== Proposed: CAMPUS only =====
  CONSTRAINT chk_proposed_requires_meeting CHECK (
    status <> 'Proposed'
    OR (
      delivery_method = 'CAMPUS'
      AND proposed_at IS NOT NULL
      AND meeting_location_id IS NOT NULL
    )
  ),

  -- ===== Accepted =====
  CONSTRAINT chk_accepted_requires_data CHECK (
    status <> 'Accepted'
    OR (
      (delivery_method = 'CAMPUS'
        AND proposed_at IS NOT NULL
        AND meeting_location_id IS NOT NULL)
      OR
      (delivery_method = 'ROUND_UNIVERSITY')
    )
  ),

  -- ===== ROUND_UNIVERSITY must not have proposal =====
  CONSTRAINT chk_round_uni_no_proposal CHECK (
    delivery_method <> 'ROUND_UNIVERSITY'
    OR (
      proposed_at IS NULL
      AND meeting_location_id IS NULL
      AND meeting_note IS NULL
    )
  ),

  -- ===== Cancel (บังคับ reason แบบข้อความ ไม่ใช้ dropdown) =====
  CONSTRAINT chk_cancel_meta CHECK (
    status <> 'Cancelled'
    OR (
      cancelled_at IS NOT NULL
      AND cancelled_by IS NOT NULL
      AND cancelled_reason IS NOT NULL
      AND btrim(cancelled_reason) <> ''
    )
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


-- ========= ORDER CHAT: THREAD (1 order = 1 room) =========
CREATE TABLE IF NOT EXISTS order_chat_threads (
  thread_id BIGSERIAL PRIMARY KEY,

  -- 1 order ต่อ 1 thread
  order_id INT NOT NULL UNIQUE
    REFERENCES orders(order_id) ON DELETE CASCADE,

  -- เก็บ store_id เพื่อ enforce seller = owner ของ store ใน order
  store_id INT NOT NULL
    REFERENCES stores(store_id) ON DELETE CASCADE,

  -- participants
  buyer_id UUID NOT NULL
    REFERENCES users(user_id) ON DELETE CASCADE,

  seller_id UUID NOT NULL
    REFERENCES users(user_id) ON DELETE CASCADE,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ========= ORDER CHAT: MESSAGES =========
CREATE TABLE IF NOT EXISTS order_chat_messages (
  message_id BIGSERIAL PRIMARY KEY,

  thread_id BIGINT NOT NULL
    REFERENCES order_chat_threads(thread_id) ON DELETE CASCADE,

  sender_id UUID NULL
    REFERENCES users(user_id) ON DELETE SET NULL,

  -- ข้อความ (อนุญาตให้ NULL ได้ เผื่อลบข้อความแล้วเหลือแต่ไฟล์)
  message_text TEXT NULL,

  -- ประเภทข้อความ
  message_type VARCHAR(20) NOT NULL DEFAULT 'TEXT'
    CHECK (message_type IN ('TEXT','IMAGE','FILE','SYSTEM')),

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- ===== Edit =====
  edited_at TIMESTAMPTZ NULL,
  edited_by UUID NULL REFERENCES users(user_id) ON DELETE SET NULL,

  -- ===== Soft delete by user/system =====
  deleted_at TIMESTAMPTZ NULL,
  deleted_by UUID NULL REFERENCES users(user_id) ON DELETE SET NULL,
  delete_reason VARCHAR(255) NULL,

  -- ===== Moderation (admin) =====
  moderation_status VARCHAR(10) NOT NULL DEFAULT 'VISIBLE'
    CHECK (moderation_status IN ('VISIBLE','HIDDEN','REMOVED')),
  moderated_at TIMESTAMPTZ NULL,
  moderated_by UUID NULL REFERENCES users(user_id) ON DELETE SET NULL,
  moderation_reason VARCHAR(255) NULL,

  -- ===== sanity checks =====
  CONSTRAINT chk_message_edit_meta CHECK (
    edited_at IS NULL OR edited_by IS NOT NULL
  ),

  CONSTRAINT chk_message_delete_meta CHECK (
    deleted_at IS NULL OR deleted_by IS NOT NULL
  ),

  CONSTRAINT chk_message_moderation_meta CHECK (
    moderated_at IS NULL OR moderated_by IS NOT NULL
  )
);

-- ========= READ STATE =========
CREATE TABLE IF NOT EXISTS order_chat_read_state (
  thread_id BIGINT NOT NULL
    REFERENCES order_chat_threads(thread_id) ON DELETE CASCADE,

  user_id UUID NOT NULL
    REFERENCES users(user_id) ON DELETE CASCADE,

  last_read_message_id BIGINT NULL
    REFERENCES order_chat_messages(message_id) ON DELETE SET NULL,

  last_read_at TIMESTAMPTZ NULL,

  PRIMARY KEY (thread_id, user_id)
);

-- ========= ORDER CHAT: ATTACHMENTS =========
CREATE TABLE IF NOT EXISTS order_chat_attachments (
  attachment_id BIGSERIAL PRIMARY KEY,

  message_id BIGINT NOT NULL
    REFERENCES order_chat_messages(message_id) ON DELETE CASCADE,

  file_url VARCHAR(255) NOT NULL,

  file_name VARCHAR(120) NULL,
  mime_type VARCHAR(80) NULL,
  file_size_bytes BIGINT NULL,

  sha256 CHAR(64) NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- soft delete (user/admin)
  deleted_at TIMESTAMPTZ NULL,
  deleted_by UUID NULL REFERENCES users(user_id) ON DELETE SET NULL,
  delete_reason VARCHAR(255) NULL,

  CONSTRAINT chk_attachment_url_nonempty CHECK (btrim(file_url) <> ''),
  CONSTRAINT chk_attachment_size_positive CHECK (file_size_bytes IS NULL OR file_size_bytes >= 0),
  CONSTRAINT chk_attachment_delete_meta CHECK (
    deleted_at IS NULL OR deleted_by IS NOT NULL
  )
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

-- ========= REPORTS =========
CREATE TABLE IF NOT EXISTS reports (
  report_id BIGSERIAL PRIMARY KEY,

  -- what happened
  order_id INT NOT NULL REFERENCES orders(order_id) ON DELETE CASCADE,

  -- who reported
  reporter_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,

  -- who got reported (buyer or seller)
  reported_user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,

  reported_party_type VARCHAR(10) NOT NULL
    CHECK (reported_party_type IN ('BUYER','SELLER')),

  reason_code VARCHAR(50) NOT NULL,
  description TEXT NULL,

  status VARCHAR(15) NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING','NEEDS_INFO','REVIEWED','RESOLVED','REJECTED','CLOSED')),

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- prevent spam/duplicate for the same target in same order
  CONSTRAINT uq_report_once UNIQUE (order_id, reporter_id, reported_party_type, reported_user_id),

  CONSTRAINT chk_not_self_report CHECK (reporter_id <> reported_user_id)
);

-- ========= REPORT_ORDER_SNAPSHOTS =========
CREATE TABLE IF NOT EXISTS report_order_snapshots (
  report_id BIGINT PRIMARY KEY REFERENCES reports(report_id) ON DELETE CASCADE,

  order_status VARCHAR(45) NOT NULL,
  delivery_method VARCHAR(20) NOT NULL,

  total_price DECIMAL(10,2) NOT NULL,

  -- snapshot payloads (so admin can see what it was at report time)
  delivery_address JSONB NULL,
  campus_location  JSONB NULL,
  delivery_time    JSONB NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ========= REPORT_CHAT_SNAPSHOTS =========
CREATE TABLE IF NOT EXISTS report_chat_snapshots (
  snapshot_id BIGSERIAL PRIMARY KEY,

  report_id BIGINT NOT NULL REFERENCES reports(report_id) ON DELETE CASCADE,

  -- allow SYSTEM snapshot rows (sender_id can be NULL)
  sender_id UUID NULL REFERENCES users(user_id) ON DELETE SET NULL,

  sender_role VARCHAR(10) NOT NULL
    CHECK (sender_role IN ('BUYER','SELLER','SYSTEM')),

  message_text TEXT NOT NULL,
  message_type VARCHAR(20),

  message_created_at TIMESTAMPTZ NOT NULL
);

-- ========= REPORT_ADMIN_ACTIONS =========
-- keep log of admin workflow actions on a report (review, needs info, close, etc.)
CREATE TABLE IF NOT EXISTS report_admin_actions (
  action_id BIGSERIAL PRIMARY KEY,

  report_id BIGINT NOT NULL REFERENCES reports(report_id) ON DELETE CASCADE,

  admin_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,

  action_type VARCHAR(25) NOT NULL
    CHECK (action_type IN (
      'REVIEWED',
      'REQUEST_MORE_INFO',
      'NO_ACTION',
      'RESOLVED',
      'REJECTED',
      'CLOSED',
      'WARN_USER',
      'SUSPEND_USER',
      'BAN_USER',
      'HIDE_STORE',
      'SUSPEND_STORE',
      'DELETE_STORE'
    )),

  note TEXT NULL,

  -- optional action params (ex. suspend 3 days, which store was affected)
  target_user_id UUID NULL REFERENCES users(user_id) ON DELETE SET NULL,
  target_store_id INT NULL REFERENCES stores(store_id) ON DELETE SET NULL,

  suspend_days INT NULL,
  is_permanent BOOLEAN NOT NULL DEFAULT FALSE,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_suspend_days_positive CHECK (suspend_days IS NULL OR suspend_days > 0),

  CONSTRAINT chk_user_action_requires_target CHECK (
    action_type NOT IN ('WARN_USER','SUSPEND_USER','BAN_USER')
    OR target_user_id IS NOT NULL
  ),

  CONSTRAINT chk_store_action_requires_target CHECK (
    action_type NOT IN ('HIDE_STORE','SUSPEND_STORE','DELETE_STORE')
    OR target_store_id IS NOT NULL
  )
);

-- ========= USER_BLACKLISTS (User restrictions) =========
-- Warn / Suspend (Temp) / Ban (Permanent)
CREATE TABLE IF NOT EXISTS user_blacklists (
  blacklist_id BIGSERIAL PRIMARY KEY,

  user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,

  user_role VARCHAR(10) NOT NULL
    CHECK (user_role IN ('BUYER','SELLER')),

  report_id BIGINT NULL REFERENCES reports(report_id) ON DELETE SET NULL,

  reason VARCHAR(255) NOT NULL,

  ban_type VARCHAR(10) NOT NULL
    CHECK (ban_type IN ('WARNING','TEMPORARY','PERMANENT')),

  banned_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  banned_until TIMESTAMPTZ NULL,

  is_active BOOLEAN NOT NULL DEFAULT TRUE,

  created_by UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_temp_ban_requires_until CHECK (
    ban_type <> 'TEMPORARY' OR banned_until IS NOT NULL
  ),

  CONSTRAINT chk_perm_ban_until_null CHECK (
    ban_type <> 'PERMANENT' OR banned_until IS NULL
  )
);

-- ========= STORE_RESTRICTIONS (Store restrictions) =========
-- Hide / Suspend / Delete store
CREATE TABLE IF NOT EXISTS store_restrictions (
  restriction_id BIGSERIAL PRIMARY KEY,

  store_id INT NOT NULL REFERENCES stores(store_id) ON DELETE CASCADE,

  report_id BIGINT NULL REFERENCES reports(report_id) ON DELETE SET NULL,

  reason VARCHAR(255) NOT NULL,

  restriction_type VARCHAR(12) NOT NULL
    CHECK (restriction_type IN ('HIDE','SUSPEND','DELETE')),

  restricted_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  restricted_until TIMESTAMPTZ NULL,

  is_active BOOLEAN NOT NULL DEFAULT TRUE,

  created_by UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_hide_suspend_requires_until CHECK (
    restriction_type IN ('DELETE') OR restricted_until IS NOT NULL
  ),

  CONSTRAINT chk_delete_until_null CHECK (
    restriction_type <> 'DELETE' OR restricted_until IS NULL
  )
);

-- ========= SEARCH HISTORY (Recent Search) =========
CREATE TABLE IF NOT EXISTS search_history (
  search_id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  query_text VARCHAR(200) NOT NULL,
  searched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_search_history_user_query UNIQUE (user_id, query_text)
);

-- ========= NOTIFICATION (Recent Search) =========
CREATE TABLE IF NOT EXISTS notifications (
  notification_id BIGSERIAL PRIMARY KEY,

  user_id UUID NOT NULL
    REFERENCES users(user_id) ON DELETE CASCADE,

  type VARCHAR(30) NOT NULL
    CHECK (type IN (
      'ORDER_STATUS_CHANGED',
      'CHAT_NEW_MESSAGE'
    )),

  order_id INT NULL
    REFERENCES orders(order_id) ON DELETE CASCADE,

  thread_id BIGINT NULL
    REFERENCES order_chat_threads(thread_id) ON DELETE CASCADE,

  message_id BIGINT NULL
    REFERENCES order_chat_messages(message_id) ON DELETE CASCADE,

  store_id INT NULL
    REFERENCES stores(store_id) ON DELETE SET NULL,

  actor_user_id UUID NULL
    REFERENCES users(user_id) ON DELETE SET NULL,

  title VARCHAR(120) NULL,
  body  VARCHAR(255) NULL,

  data JSONB NULL,

  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  read_at TIMESTAMPTZ NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_notification_reference CHECK (
    order_id IS NOT NULL
    OR thread_id IS NOT NULL
  ),

  CONSTRAINT chk_notification_read_meta CHECK (
    is_read = FALSE OR read_at IS NOT NULL
  )
);