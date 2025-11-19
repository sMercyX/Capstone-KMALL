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
