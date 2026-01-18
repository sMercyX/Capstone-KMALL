DROP INDEX IF EXISTS idx_email;
CREATE INDEX idx_email ON users(email);

DROP INDEX IF EXISTS idx_ms_id;
CREATE INDEX idx_ms_id ON users(kms_id);

DROP INDEX IF EXISTS fk_users_has_roles_roles1_idx;
CREATE INDEX fk_users_has_roles_roles1_idx ON user_roles(role_id);

DROP INDEX IF EXISTS fk_users_has_roles_users_idx;
CREATE INDEX fk_users_has_roles_users_idx ON user_roles(user_id);

DROP INDEX IF EXISTS fk_stores_users1_idx;
CREATE INDEX fk_stores_users1_idx ON stores(user_id);

DROP INDEX IF EXISTS idx_categories_slug;
CREATE INDEX idx_categories_slug ON categories(slug);

DROP INDEX IF EXISTS fk_products_stores1_idx;
CREATE INDEX fk_products_stores1_idx ON products(store_id);

DROP INDEX IF EXISTS fk_products_categories1_idx;
CREATE INDEX fk_products_categories1_idx ON products(category_id);

DROP INDEX IF EXISTS fk_orders_users1_idx;
CREATE INDEX fk_orders_users1_idx ON orders(user_id);

DROP INDEX IF EXISTS fk_orders_stores1_idx;
CREATE INDEX fk_orders_stores1_idx ON orders(store_id);

DROP INDEX IF EXISTS fk_order_items_orders1_idx;
CREATE INDEX fk_order_items_orders1_idx ON order_items(order_id);

DROP INDEX IF EXISTS fk_order_items_products1_idx;
CREATE INDEX fk_order_items_products1_idx ON order_items(product_id);

DROP INDEX IF EXISTS fk_carts_users1_idx;
CREATE INDEX fk_carts_users1_idx ON carts(user_id);

DROP INDEX IF EXISTS fk_cart_items_carts1_idx;
CREATE INDEX fk_cart_items_carts1_idx ON cart_items(cart_id);

DROP INDEX IF EXISTS fk_cart_items_products1_idx;
CREATE INDEX fk_cart_items_products1_idx ON cart_items(product_id);

DROP INDEX IF EXISTS idx_products_category_active;
CREATE INDEX IF NOT EXISTS idx_products_category_active
  ON products(category_id, is_active);

DROP INDEX IF EXISTS idx_products_store_active;
CREATE INDEX IF NOT EXISTS idx_products_store_active
  ON products(store_id, is_active);

DROP INDEX IF EXISTS idx_products_category_active_created_at;
CREATE INDEX IF NOT EXISTS idx_products_category_active_created_at
  ON products(category_id, is_active, created_at DESC);

DROP INDEX IF EXISTS idx_product_images_product;
CREATE INDEX IF NOT EXISTS idx_product_images_product
  ON product_images(product_id);

DROP INDEX IF EXISTS idx_store_images_store;
CREATE INDEX IF NOT EXISTS idx_store_images_store
  ON store_images(store_id);

DROP INDEX IF EXISTS idx_categories_parent;
CREATE INDEX IF NOT EXISTS idx_categories_parent
  ON categories(parent_id);

DROP INDEX IF EXISTS idx_chat_messages_thread_time;
CREATE INDEX IF NOT EXISTS idx_chat_messages_thread_time
  ON order_chat_messages(thread_id, created_at ASC);

DROP INDEX IF EXISTS idx_chat_messages_thread_id;
CREATE INDEX IF NOT EXISTS idx_chat_messages_thread_id
  ON order_chat_messages(thread_id);



DROP INDEX IF EXISTS idx_attr_values_key_value;
CREATE INDEX IF NOT EXISTS idx_attr_values_key_value
  ON product_attribute_values(attr_key_id, value_text);

DROP INDEX IF EXISTS idx_attr_values_product;
CREATE INDEX IF NOT EXISTS idx_attr_values_product
  ON product_attribute_values(product_id);

-- Full-text search
DROP INDEX IF EXISTS idx_products_search_tsv;
CREATE INDEX IF NOT EXISTS idx_products_search_tsv
  ON products USING GIN (search_tsv);

DROP INDEX IF EXISTS idx_products_name_trgm;
CREATE INDEX IF NOT EXISTS idx_products_name_trgm
  ON products USING GIN (name gin_trgm_ops);

DROP INDEX IF EXISTS idx_products_desc_trgm;
CREATE INDEX IF NOT EXISTS idx_products_desc_trgm
  ON products USING GIN (product_desc gin_trgm_ops);

DROP INDEX IF EXISTS idx_rec_events_user_time;
CREATE INDEX IF NOT EXISTS idx_rec_events_user_time
  ON recommendation_events(user_id, created_at DESC);

DROP INDEX IF EXISTS idx_rec_items_event_rank;
CREATE INDEX IF NOT EXISTS idx_rec_items_event_rank
  ON recommendation_event_items(event_id, rank_no);

DROP INDEX IF EXISTS idx_products_embedding_cosine;
CREATE INDEX idx_products_embedding_cosine
  ON products USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

DROP INDEX IF EXISTS idx_order_status_history_order_time;
CREATE INDEX IF NOT EXISTS idx_order_status_history_order_time
  ON order_status_history(order_id, created_at DESC);

DROP INDEX IF EXISTS idx_products_active;
CREATE INDEX IF NOT EXISTS idx_products_active
  ON products(is_active);

DROP INDEX IF EXISTS idx_products_active_created_at;
CREATE INDEX IF NOT EXISTS idx_products_active_created_at
  ON products(is_active, created_at DESC);

DROP INDEX IF EXISTS idx_products_active_price;
CREATE INDEX IF NOT EXISTS idx_products_active_price
  ON products(is_active, price ASC);

DROP INDEX IF EXISTS uq_homepage_banners_sort_active;
CREATE UNIQUE INDEX IF NOT EXISTS uq_homepage_banners_sort_active
  ON homepage_banners(sort_order)
  WHERE is_active = TRUE;

DROP INDEX IF EXISTS idx_homepage_banners_active_sort;
CREATE INDEX IF NOT EXISTS idx_homepage_banners_active_sort
  ON homepage_banners(is_active, sort_order);

DROP INDEX IF EXISTS idx_homepage_banners_active_time;
CREATE INDEX IF NOT EXISTS idx_homepage_banners_active_time
  ON homepage_banners(is_active, start_at, end_at);

DROP INDEX IF EXISTS idx_reports_status_time;
CREATE INDEX IF NOT EXISTS idx_reports_status_time
  ON reports(status, created_at DESC);

DROP INDEX IF EXISTS idx_reports_order;
CREATE INDEX IF NOT EXISTS idx_reports_order
  ON reports(order_id);

DROP INDEX IF EXISTS idx_reports_reported_user_time;
CREATE INDEX IF NOT EXISTS idx_reports_reported_user_time
  ON reports(reported_user_id, created_at DESC);

DROP INDEX IF EXISTS idx_report_chat_snapshots_report_time;
CREATE INDEX IF NOT EXISTS idx_report_chat_snapshots_report_time
  ON report_chat_snapshots(report_id, message_created_at ASC);

DROP INDEX IF EXISTS idx_report_admin_actions_report_time;
CREATE INDEX IF NOT EXISTS idx_report_admin_actions_report_time
  ON report_admin_actions(report_id, created_at DESC);

DROP INDEX IF EXISTS idx_user_blacklists_user_active_until;
CREATE INDEX IF NOT EXISTS idx_user_blacklists_user_active_until
  ON user_blacklists(user_id, is_active, banned_until);

DROP INDEX IF EXISTS idx_store_restrictions_store_active_until;
CREATE INDEX IF NOT EXISTS idx_store_restrictions_store_active_until
  ON store_restrictions(store_id, is_active, restricted_until);

DROP INDEX IF EXISTS uq_user_blacklists_one_active;
CREATE UNIQUE INDEX IF NOT EXISTS uq_user_blacklists_one_active
  ON user_blacklists(user_id)
  WHERE is_active = TRUE;

DROP INDEX IF EXISTS uq_store_restrictions_one_active;
CREATE UNIQUE INDEX IF NOT EXISTS uq_store_restrictions_one_active
  ON store_restrictions(store_id)
  WHERE is_active = TRUE;

DROP INDEX IF EXISTS idx_search_history_user_time;
CREATE INDEX IF NOT EXISTS idx_search_history_user_time
  ON search_history(user_id, searched_at DESC);