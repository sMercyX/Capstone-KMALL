-- NOTE: This is mockup dev data for testing and demo only. Not for production use.
TRUNCATE product_images, products, store_images, stores RESTART IDENTITY CASCADE;

-- ========= DEV DEMO USERS =========
INSERT INTO users (user_id, kms_id, email, display_name)
VALUES
  ('00000000-0000-0000-0000-000000000001', 'dev-admin-1',  'admin1@example.com',  'Dev Admin 1'),
  ('00000000-0000-0000-0000-000000000002', 'dev-seller-1', 'seller1@example.com', 'Dev Seller 1'),
  ('00000000-0000-0000-0000-000000000004', 'dev-seller-2', 'seller2@example.com', 'Dev Seller 2'),
  ('00000000-0000-0000-0000-000000000005', 'dev-seller-3', 'seller3@example.com', 'Dev Seller 3'),
  ('00000000-0000-0000-0000-000000000003', 'dev-buyer-1',  'buyer1@example.com',  'Dev Buyer 1')
ON CONFLICT (kms_id) DO NOTHING;

-- ========= DEV USER ROLES =========
INSERT INTO user_roles (user_id, role_id)
SELECT u.user_id, r.role_id
FROM users u, roles r
WHERE u.kms_id = 'dev-admin-1' AND r.role_name = 'admin'
ON CONFLICT DO NOTHING;

INSERT INTO user_roles (user_id, role_id)
SELECT u.user_id, r.role_id
FROM users u, roles r
WHERE u.kms_id IN ('dev-seller-1', 'dev-seller-2', 'dev-seller-3')
  AND r.role_name = 'seller'
ON CONFLICT DO NOTHING;

INSERT INTO user_roles (user_id, role_id)
SELECT u.user_id, r.role_id
FROM users u, roles r
WHERE u.kms_id = 'dev-buyer-1' AND r.role_name = 'buyer'
ON CONFLICT DO NOTHING;

-- ========= DEV STORES =========
INSERT INTO stores (
  store_name, store_desc, profile_url,
  delivery_round_university_enabled, round_uni_base_fee,
  campus_enabled, is_active, user_id
)
SELECT
  'BKK Snack & Drink Bar',
  'Demo store for snacks/desserts and beverages under Food subcategories.',
  NULL, TRUE, 10.00, TRUE, 'YES',
  u.user_id
FROM users u
WHERE u.kms_id = 'dev-seller-1'
  AND NOT EXISTS (SELECT 1 FROM stores s WHERE s.store_name = 'BKK Snack & Drink Bar');

INSERT INTO stores (
  store_name, store_desc, profile_url,
  delivery_round_university_enabled,
  campus_enabled, is_active, user_id
)
SELECT
  'Campus Clothing Studio',
  'Demo clothing store for tops and outerwear/jackets.',
  NULL, FALSE, TRUE, 'YES',
  u.user_id
FROM users u
WHERE u.kms_id = 'dev-seller-2'
  AND NOT EXISTS (SELECT 1 FROM stores s WHERE s.store_name = 'Campus Clothing Studio');

INSERT INTO stores (
  store_name, store_desc, profile_url,
  delivery_round_university_enabled, round_uni_base_fee,
  campus_enabled, is_active, user_id
)
SELECT
  'Local Craft Studio',
  'Demo handmade store for keychains and textile/knitting items.',
  NULL, TRUE, 15.00, FALSE, 'YES',
  u.user_id
FROM users u
WHERE u.kms_id = 'dev-seller-3'
  AND NOT EXISTS (SELECT 1 FROM stores s WHERE s.store_name = 'Local Craft Studio');

-- ========= STORE IMAGES =========
INSERT INTO store_images (store_id, image_url, sort_order, is_primary)
SELECT s.store_id, '/uploads/stores/' || s.store_id || '/profile-1.jpg', 1, TRUE
FROM stores s WHERE s.store_name = 'BKK Snack & Drink Bar'
ON CONFLICT (store_id, sort_order) DO NOTHING;

UPDATE stores s SET profile_url = '/uploads/stores/' || s.store_id || '/profile-1.jpg'
WHERE s.store_name = 'BKK Snack & Drink Bar' AND s.profile_url IS NULL;

INSERT INTO store_images (store_id, image_url, sort_order, is_primary)
SELECT s.store_id, '/uploads/stores/' || s.store_id || '/profile-1.jpg', 1, TRUE
FROM stores s WHERE s.store_name = 'Campus Clothing Studio'
ON CONFLICT (store_id, sort_order) DO NOTHING;

UPDATE stores s SET profile_url = '/uploads/stores/' || s.store_id || '/profile-1.jpg'
WHERE s.store_name = 'Campus Clothing Studio' AND s.profile_url IS NULL;

INSERT INTO store_images (store_id, image_url, sort_order, is_primary)
SELECT s.store_id, '/uploads/stores/' || s.store_id || '/profile-1.jpg', 1, TRUE
FROM stores s WHERE s.store_name = 'Local Craft Studio'
ON CONFLICT (store_id, sort_order) DO NOTHING;

UPDATE stores s SET profile_url = '/uploads/stores/' || s.store_id || '/profile-1.jpg'
WHERE s.store_name = 'Local Craft Studio' AND s.profile_url IS NULL;

-- ========= FOOD PRODUCTS — PREORDER (BKK Snack & Drink Bar) =========
INSERT INTO products (name, product_desc, price, image_url, is_active, product_type, store_id, category_id)
SELECT
  'Chocolate Brownie',
  'Fudgy chocolate brownie, perfect for an afternoon snack.',
  35.00, NULL, 'YES', 'PREORDER',
  s.store_id, c.category_id
FROM stores s JOIN categories c ON c.slug = 'snacks-desserts'
WHERE s.store_name = 'BKK Snack & Drink Bar' AND c.parent_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM products p WHERE p.name = 'Chocolate Brownie' AND p.store_id = s.store_id);

INSERT INTO products (name, product_desc, price, image_url, is_active, product_type, store_id, category_id)
SELECT
  'Butter Croissant',
  'Flaky butter croissant, freshly baked every morning.',
  40.00, NULL, 'YES', 'PREORDER',
  s.store_id, c.category_id
FROM stores s JOIN categories c ON c.slug = 'snacks-desserts'
WHERE s.store_name = 'BKK Snack & Drink Bar' AND c.parent_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM products p WHERE p.name = 'Butter Croissant' AND p.store_id = s.store_id);

INSERT INTO products (name, product_desc, price, image_url, is_active, product_type, store_id, category_id)
SELECT
  'Iced Latte',
  'Chilled coffee with milk, lightly sweetened.',
  55.00, NULL, 'YES', 'PREORDER',
  s.store_id, c.category_id
FROM stores s JOIN categories c ON c.slug = 'beverages'
WHERE s.store_name = 'BKK Snack & Drink Bar' AND c.parent_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM products p WHERE p.name = 'Iced Latte' AND p.store_id = s.store_id);

INSERT INTO products (name, product_desc, price, image_url, is_active, product_type, store_id, category_id)
SELECT
  'Mixed Berry Smoothie',
  'Smoothie made from mixed berries, no added sugar.',
  65.00, NULL, 'YES', 'PREORDER',
  s.store_id, c.category_id
FROM stores s JOIN categories c ON c.slug = 'beverages'
WHERE s.store_name = 'BKK Snack & Drink Bar' AND c.parent_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM products p WHERE p.name = 'Mixed Berry Smoothie' AND p.store_id = s.store_id);

-- ========= CLOTHING PRODUCTS — PREORDER (Campus Clothing Studio) =========
INSERT INTO products (name, product_desc, price, image_url, is_active, product_type, store_id, category_id)
SELECT
  'KMALL White T-Shirt',
  'Basic white T-shirt with KMALL logo, unisex.',
  199.00, NULL, 'YES', 'PREORDER',
  s.store_id, c.category_id
FROM stores s JOIN categories c ON c.slug = 'tops'
WHERE s.store_name = 'Campus Clothing Studio' AND c.parent_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM products p WHERE p.name = 'KMALL White T-Shirt' AND p.store_id = s.store_id);

INSERT INTO products (name, product_desc, price, image_url, is_active, product_type, store_id, category_id)
SELECT
  'Graphic Tee – Coding Life',
  'T-shirt with "Eat Sleep Code Repeat" graphic print.',
  220.00, NULL, 'YES', 'PREORDER',
  s.store_id, c.category_id
FROM stores s JOIN categories c ON c.slug = 'tops'
WHERE s.store_name = 'Campus Clothing Studio' AND c.parent_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM products p WHERE p.name = 'Graphic Tee – Coding Life' AND p.store_id = s.store_id);

INSERT INTO products (name, product_desc, price, image_url, is_active, product_type, store_id, category_id)
SELECT
  'Black Zip Hoodie',
  'Comfortable black zip-up hoodie, minimal design.',
  399.00, NULL, 'YES', 'PREORDER',
  s.store_id, c.category_id
FROM stores s JOIN categories c ON c.slug = 'outerwear-jackets'
WHERE s.store_name = 'Campus Clothing Studio' AND c.parent_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM products p WHERE p.name = 'Black Zip Hoodie' AND p.store_id = s.store_id);

INSERT INTO products (name, product_desc, price, image_url, is_active, product_type, store_id, category_id)
SELECT
  'Lightweight Windbreaker',
  'Thin windbreaker jacket for everyday use.',
  450.00, NULL, 'YES', 'PREORDER',
  s.store_id, c.category_id
FROM stores s JOIN categories c ON c.slug = 'outerwear-jackets'
WHERE s.store_name = 'Campus Clothing Studio' AND c.parent_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM products p WHERE p.name = 'Lightweight Windbreaker' AND p.store_id = s.store_id);

-- ========= HANDMADE PRODUCTS — PREORDER (Local Craft Studio) =========
INSERT INTO products (name, product_desc, price, image_url, is_active, product_type, store_id, category_id)
SELECT
  'Acrylic Keychain – KMALL Logo',
  'Clear acrylic keychain with KMALL logo, lightweight and durable.',
  49.00, NULL, 'YES', 'PREORDER',
  s.store_id, c.category_id
FROM stores s JOIN categories c ON c.slug = 'keychains'
WHERE s.store_name = 'Local Craft Studio' AND c.parent_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM products p WHERE p.name = 'Acrylic Keychain – KMALL Logo' AND p.store_id = s.store_id);

INSERT INTO products (name, product_desc, price, image_url, is_active, product_type, store_id, category_id)
SELECT
  'Character Keychain – Cute Cat',
  'Soft rubber keychain in cute cat character design.',
  39.00, NULL, 'YES', 'PREORDER',
  s.store_id, c.category_id
FROM stores s JOIN categories c ON c.slug = 'keychains'
WHERE s.store_name = 'Local Craft Studio' AND c.parent_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM products p WHERE p.name = 'Character Keychain – Cute Cat' AND p.store_id = s.store_id);

INSERT INTO products (name, product_desc, price, image_url, is_active, product_type, store_id, category_id)
SELECT
  'Canvas Tote Bag – Local Pattern',
  'Canvas tote bag with local-inspired pattern.',
  189.00, NULL, 'YES', 'PREORDER',
  s.store_id, c.category_id
FROM stores s JOIN categories c ON c.slug = 'textile-knitting'
WHERE s.store_name = 'Local Craft Studio' AND c.parent_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM products p WHERE p.name = 'Canvas Tote Bag – Local Pattern' AND p.store_id = s.store_id);

INSERT INTO products (name, product_desc, price, image_url, is_active, product_type, store_id, category_id)
SELECT
  'Mini Woven Handbag',
  'Small woven handbag made from local materials.',
  220.00, NULL, 'YES', 'PREORDER',
  s.store_id, c.category_id
FROM stores s JOIN categories c ON c.slug = 'textile-knitting'
WHERE s.store_name = 'Local Craft Studio' AND c.parent_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM products p WHERE p.name = 'Mini Woven Handbag' AND p.store_id = s.store_id);

-- ========= STOCK PRODUCTS (Campus Clothing Studio) =========
-- Demo Hoodie: สี (ดำ, ขาว) x ขนาด (M, L) = 4 variants
INSERT INTO products (name, product_desc, price, image_url, is_active, product_type, store_id, category_id)
SELECT
  'Demo Hoodie – STOCK',
  'Demo STOCK product with color/size variants for testing.',
  390.00, NULL,
  'NO',      -- ยังไม่ active จนกว่าจะมี variant
  'STOCK',
  s.store_id, c.category_id
FROM stores s JOIN categories c ON c.slug = 'tops'
WHERE s.store_name = 'Campus Clothing Studio' AND c.parent_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM products p WHERE p.name = 'Demo Hoodie – STOCK');

-- Demo Jacket: สี (แดง, น้ำเงิน) x ขนาด (S, M, L) = 6 variants, ราคา delta ต่างกัน
INSERT INTO products (name, product_desc, price, image_url, is_active, product_type, store_id, category_id)
SELECT
  'Demo Jacket – STOCK',
  'Demo STOCK jacket with price delta per size.',
  550.00, NULL,
  'NO',
  'STOCK',
  s.store_id, c.category_id
FROM stores s JOIN categories c ON c.slug = 'outerwear-jackets'
WHERE s.store_name = 'Campus Clothing Studio' AND c.parent_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM products p WHERE p.name = 'Demo Jacket – STOCK');

-- ===== Setup STOCK variants via DO block =====
DO $$
DECLARE
  -- Demo Hoodie
  h_pid    INT;
  h_key_si INT; h_key_sz INT;
  h_blk    INT; h_wht    INT;
  h_m      INT; h_l      INT;
  h_v1 INT; h_v2 INT; h_v3 INT; h_v4 INT;

  -- Demo Jacket
  j_pid    INT;
  j_key_si INT; j_key_sz INT;
  j_red    INT; j_blu    INT;
  j_s      INT; j_m      INT; j_l INT;
  j_v1 INT; j_v2 INT; j_v3 INT;
  j_v4 INT; j_v5 INT; j_v6 INT;
BEGIN

  -- ===== Demo Hoodie =====
  SELECT product_id INTO h_pid FROM products WHERE name = 'Demo Hoodie – STOCK';
  IF h_pid IS NULL THEN RAISE NOTICE 'Demo Hoodie not found, skip'; RETURN; END IF;

  INSERT INTO product_option_keys (product_id, key_name, sort_order)
  VALUES (h_pid, 'สี', 1), (h_pid, 'ขนาด', 2)
  ON CONFLICT (product_id, key_name) DO NOTHING;

  SELECT option_key_id INTO h_key_si FROM product_option_keys WHERE product_id = h_pid AND key_name = 'สี';
  SELECT option_key_id INTO h_key_sz FROM product_option_keys WHERE product_id = h_pid AND key_name = 'ขนาด';

  INSERT INTO product_option_values (option_key_id, value_label, sort_order)
  VALUES
    (h_key_si, 'ดำ',  1),
    (h_key_si, 'ขาว', 2),
    (h_key_sz, 'M',   1),
    (h_key_sz, 'L',   2)
  ON CONFLICT (option_key_id, value_label) DO NOTHING;

  SELECT option_value_id INTO h_blk FROM product_option_values WHERE option_key_id = h_key_si AND value_label = 'ดำ';
  SELECT option_value_id INTO h_wht FROM product_option_values WHERE option_key_id = h_key_si AND value_label = 'ขาว';
  SELECT option_value_id INTO h_m   FROM product_option_values WHERE option_key_id = h_key_sz AND value_label = 'M';
  SELECT option_value_id INTO h_l   FROM product_option_values WHERE option_key_id = h_key_sz AND value_label = 'L';

  -- ดำ + M (stock 10)
  INSERT INTO product_variants (product_id, price_delta, stock_qty)
  VALUES (h_pid, 0, 10) RETURNING variant_id INTO h_v1;
  INSERT INTO variant_option_selections VALUES (h_v1, h_blk), (h_v1, h_m);

  -- ดำ + L (stock 8)
  INSERT INTO product_variants (product_id, price_delta, stock_qty)
  VALUES (h_pid, 0, 8) RETURNING variant_id INTO h_v2;
  INSERT INTO variant_option_selections VALUES (h_v2, h_blk), (h_v2, h_l);

  -- ขาว + M (stock 5, +20)
  INSERT INTO product_variants (product_id, price_delta, stock_qty)
  VALUES (h_pid, 20, 5) RETURNING variant_id INTO h_v3;
  INSERT INTO variant_option_selections VALUES (h_v3, h_wht), (h_v3, h_m);

  -- ขาว + L (stock 3, +20)
  INSERT INTO product_variants (product_id, price_delta, stock_qty)
  VALUES (h_pid, 20, 3) RETURNING variant_id INTO h_v4;
  INSERT INTO variant_option_selections VALUES (h_v4, h_wht), (h_v4, h_l);

  -- activate
  UPDATE products SET is_active = 'YES' WHERE product_id = h_pid;
  RAISE NOTICE 'Demo Hoodie ready: product_id=%, variants=%, %, %, %', h_pid, h_v1, h_v2, h_v3, h_v4;

  -- ===== Demo Jacket =====
  SELECT product_id INTO j_pid FROM products WHERE name = 'Demo Jacket – STOCK';
  IF j_pid IS NULL THEN RAISE NOTICE 'Demo Jacket not found, skip'; RETURN; END IF;

  INSERT INTO product_option_keys (product_id, key_name, sort_order)
  VALUES (j_pid, 'สี', 1), (j_pid, 'ขนาด', 2)
  ON CONFLICT (product_id, key_name) DO NOTHING;

  SELECT option_key_id INTO j_key_si FROM product_option_keys WHERE product_id = j_pid AND key_name = 'สี';
  SELECT option_key_id INTO j_key_sz FROM product_option_keys WHERE product_id = j_pid AND key_name = 'ขนาด';

  INSERT INTO product_option_values (option_key_id, value_label, sort_order)
  VALUES
    (j_key_si, 'แดง',    1),
    (j_key_si, 'น้ำเงิน', 2),
    (j_key_sz, 'S',       1),
    (j_key_sz, 'M',       2),
    (j_key_sz, 'L',       3)
  ON CONFLICT (option_key_id, value_label) DO NOTHING;

  SELECT option_value_id INTO j_red FROM product_option_values WHERE option_key_id = j_key_si AND value_label = 'แดง';
  SELECT option_value_id INTO j_blu FROM product_option_values WHERE option_key_id = j_key_si AND value_label = 'น้ำเงิน';
  SELECT option_value_id INTO j_s   FROM product_option_values WHERE option_key_id = j_key_sz AND value_label = 'S';
  SELECT option_value_id INTO j_m   FROM product_option_values WHERE option_key_id = j_key_sz AND value_label = 'M';
  SELECT option_value_id INTO j_l   FROM product_option_values WHERE option_key_id = j_key_sz AND value_label = 'L';

  -- แดง + S (stock 6, -30)
  INSERT INTO product_variants (product_id, price_delta, stock_qty)
  VALUES (j_pid, -30, 6) RETURNING variant_id INTO j_v1;
  INSERT INTO variant_option_selections VALUES (j_v1, j_red), (j_v1, j_s);

  -- แดง + M (stock 4, 0)
  INSERT INTO product_variants (product_id, price_delta, stock_qty)
  VALUES (j_pid, 0, 4) RETURNING variant_id INTO j_v2;
  INSERT INTO variant_option_selections VALUES (j_v2, j_red), (j_v2, j_m);

  -- แดง + L (stock 2, +50)
  INSERT INTO product_variants (product_id, price_delta, stock_qty)
  VALUES (j_pid, 50, 2) RETURNING variant_id INTO j_v3;
  INSERT INTO variant_option_selections VALUES (j_v3, j_red), (j_v3, j_l);

  -- น้ำเงิน + S (stock 7, -30)
  INSERT INTO product_variants (product_id, price_delta, stock_qty)
  VALUES (j_pid, -30, 7) RETURNING variant_id INTO j_v4;
  INSERT INTO variant_option_selections VALUES (j_v4, j_blu), (j_v4, j_s);

  -- น้ำเงิน + M (stock 5, 0)
  INSERT INTO product_variants (product_id, price_delta, stock_qty)
  VALUES (j_pid, 0, 5) RETURNING variant_id INTO j_v5;
  INSERT INTO variant_option_selections VALUES (j_v5, j_blu), (j_v5, j_m);

  -- น้ำเงิน + L (stock 1, +50) — stock ต่ำสำหรับเทส insufficient stock
  INSERT INTO product_variants (product_id, price_delta, stock_qty)
  VALUES (j_pid, 50, 1) RETURNING variant_id INTO j_v6;
  INSERT INTO variant_option_selections VALUES (j_v6, j_blu), (j_v6, j_l);

  -- activate
  UPDATE products SET is_active = 'YES' WHERE product_id = j_pid;
  RAISE NOTICE 'Demo Jacket ready: product_id=%, variants=%, %, %, %, %, %', j_pid, j_v1, j_v2, j_v3, j_v4, j_v5, j_v6;

END $$;

-- ========= PRODUCT IMAGES =========
-- FOOD
INSERT INTO product_images (product_id, image_url, sort_order, is_primary)
SELECT p.product_id, '/uploads/products/' || p.product_id || '/chocolate-brownie-1.jpg', 1, TRUE
FROM products p JOIN stores s ON s.store_id = p.store_id JOIN categories c ON c.category_id = p.category_id
WHERE s.store_name = 'BKK Snack & Drink Bar' AND c.slug = 'snacks-desserts' AND p.name = 'Chocolate Brownie'
ON CONFLICT (product_id, sort_order) DO NOTHING;

INSERT INTO product_images (product_id, image_url, sort_order, is_primary)
SELECT p.product_id, '/uploads/products/' || p.product_id || '/butter-croissant-1.jpg', 1, TRUE
FROM products p JOIN stores s ON s.store_id = p.store_id JOIN categories c ON c.category_id = p.category_id
WHERE s.store_name = 'BKK Snack & Drink Bar' AND c.slug = 'snacks-desserts' AND p.name = 'Butter Croissant'
ON CONFLICT (product_id, sort_order) DO NOTHING;

INSERT INTO product_images (product_id, image_url, sort_order, is_primary)
SELECT p.product_id, '/uploads/products/' || p.product_id || '/iced-latte-1.jpg', 1, TRUE
FROM products p JOIN stores s ON s.store_id = p.store_id JOIN categories c ON c.category_id = p.category_id
WHERE s.store_name = 'BKK Snack & Drink Bar' AND c.slug = 'beverages' AND p.name = 'Iced Latte'
ON CONFLICT (product_id, sort_order) DO NOTHING;

INSERT INTO product_images (product_id, image_url, sort_order, is_primary)
SELECT p.product_id, '/uploads/products/' || p.product_id || '/mixed-berry-smoothie-1.jpg', 1, TRUE
FROM products p JOIN stores s ON s.store_id = p.store_id JOIN categories c ON c.category_id = p.category_id
WHERE s.store_name = 'BKK Snack & Drink Bar' AND c.slug = 'beverages' AND p.name = 'Mixed Berry Smoothie'
ON CONFLICT (product_id, sort_order) DO NOTHING;

-- CLOTHING
INSERT INTO product_images (product_id, image_url, sort_order, is_primary)
SELECT p.product_id, '/uploads/products/' || p.product_id || '/kmall-white-1.jpg', 1, TRUE
FROM products p JOIN stores s ON s.store_id = p.store_id JOIN categories c ON c.category_id = p.category_id
WHERE s.store_name = 'Campus Clothing Studio' AND c.slug = 'tops' AND p.name = 'KMALL White T-Shirt'
ON CONFLICT (product_id, sort_order) DO NOTHING;

INSERT INTO product_images (product_id, image_url, sort_order, is_primary)
SELECT p.product_id, '/uploads/products/' || p.product_id || '/coding-life-1.jpg', 1, TRUE
FROM products p JOIN stores s ON s.store_id = p.store_id JOIN categories c ON c.category_id = p.category_id
WHERE s.store_name = 'Campus Clothing Studio' AND c.slug = 'tops' AND p.name = 'Graphic Tee – Coding Life'
ON CONFLICT (product_id, sort_order) DO NOTHING;

INSERT INTO product_images (product_id, image_url, sort_order, is_primary)
SELECT p.product_id, '/uploads/products/' || p.product_id || '/black-zip-hoodie-1.jpg', 1, TRUE
FROM products p JOIN stores s ON s.store_id = p.store_id JOIN categories c ON c.category_id = p.category_id
WHERE s.store_name = 'Campus Clothing Studio' AND c.slug = 'outerwear-jackets' AND p.name = 'Black Zip Hoodie'
ON CONFLICT (product_id, sort_order) DO NOTHING;

INSERT INTO product_images (product_id, image_url, sort_order, is_primary)
SELECT p.product_id, '/uploads/products/' || p.product_id || '/lightweight-windbreaker-1.jpg', 1, TRUE
FROM products p JOIN stores s ON s.store_id = p.store_id JOIN categories c ON c.category_id = p.category_id
WHERE s.store_name = 'Campus Clothing Studio' AND c.slug = 'outerwear-jackets' AND p.name = 'Lightweight Windbreaker'
ON CONFLICT (product_id, sort_order) DO NOTHING;

-- HANDMADE
INSERT INTO product_images (product_id, image_url, sort_order, is_primary)
SELECT p.product_id, '/uploads/products/' || p.product_id || '/kmall-logo-1.jpg', 1, TRUE
FROM products p JOIN stores s ON s.store_id = p.store_id JOIN categories c ON c.category_id = p.category_id
WHERE s.store_name = 'Local Craft Studio' AND c.slug = 'keychains' AND p.name = 'Acrylic Keychain – KMALL Logo'
ON CONFLICT (product_id, sort_order) DO NOTHING;

INSERT INTO product_images (product_id, image_url, sort_order, is_primary)
SELECT p.product_id, '/uploads/products/' || p.product_id || '/cute-cat-1.jpg', 1, TRUE
FROM products p JOIN stores s ON s.store_id = p.store_id JOIN categories c ON c.category_id = p.category_id
WHERE s.store_name = 'Local Craft Studio' AND c.slug = 'keychains' AND p.name = 'Character Keychain – Cute Cat'
ON CONFLICT (product_id, sort_order) DO NOTHING;

INSERT INTO product_images (product_id, image_url, sort_order, is_primary)
SELECT p.product_id, '/uploads/products/' || p.product_id || '/canvas-tote-local-1.jpg', 1, TRUE
FROM products p JOIN stores s ON s.store_id = p.store_id JOIN categories c ON c.category_id = p.category_id
WHERE s.store_name = 'Local Craft Studio' AND c.slug = 'textile-knitting' AND p.name = 'Canvas Tote Bag – Local Pattern'
ON CONFLICT (product_id, sort_order) DO NOTHING;

INSERT INTO product_images (product_id, image_url, sort_order, is_primary)
SELECT p.product_id, '/uploads/products/' || p.product_id || '/mini-woven-handbag-1.jpg', 1, TRUE
FROM products p JOIN stores s ON s.store_id = p.store_id JOIN categories c ON c.category_id = p.category_id
WHERE s.store_name = 'Local Craft Studio' AND c.slug = 'textile-knitting' AND p.name = 'Mini Woven Handbag'
ON CONFLICT (product_id, sort_order) DO NOTHING;

-- second images
INSERT INTO product_images (product_id, image_url, sort_order, is_primary)
SELECT p.product_id, '/uploads/products/' || p.product_id || '/chocolate-brownie-2.jpg', 2, FALSE
FROM products p JOIN stores s ON s.store_id = p.store_id JOIN categories c ON c.category_id = p.category_id
WHERE s.store_name = 'BKK Snack & Drink Bar' AND c.slug = 'snacks-desserts' AND p.name = 'Chocolate Brownie'
ON CONFLICT (product_id, sort_order) DO NOTHING;

INSERT INTO product_images (product_id, image_url, sort_order, is_primary)
SELECT p.product_id, '/uploads/products/' || p.product_id || '/butter-croissant-2.jpg', 2, FALSE
FROM products p JOIN stores s ON s.store_id = p.store_id JOIN categories c ON c.category_id = p.category_id
WHERE s.store_name = 'BKK Snack & Drink Bar' AND c.slug = 'snacks-desserts' AND p.name = 'Butter Croissant'
ON CONFLICT (product_id, sort_order) DO NOTHING;

INSERT INTO product_images (product_id, image_url, sort_order, is_primary)
SELECT p.product_id, '/uploads/products/' || p.product_id || '/iced-latte-2.jpg', 2, FALSE
FROM products p JOIN stores s ON s.store_id = p.store_id JOIN categories c ON c.category_id = p.category_id
WHERE s.store_name = 'BKK Snack & Drink Bar' AND c.slug = 'beverages' AND p.name = 'Iced Latte'
ON CONFLICT (product_id, sort_order) DO NOTHING;

INSERT INTO product_images (product_id, image_url, sort_order, is_primary)
SELECT p.product_id, '/uploads/products/' || p.product_id || '/mixed-berry-smoothie-2.jpg', 2, FALSE
FROM products p JOIN stores s ON s.store_id = p.store_id JOIN categories c ON c.category_id = p.category_id
WHERE s.store_name = 'BKK Snack & Drink Bar' AND c.slug = 'beverages' AND p.name = 'Mixed Berry Smoothie'
ON CONFLICT (product_id, sort_order) DO NOTHING;

INSERT INTO product_images (product_id, image_url, sort_order, is_primary)
SELECT p.product_id, '/uploads/products/' || p.product_id || '/kmall-white-2.jpg', 2, FALSE
FROM products p JOIN stores s ON s.store_id = p.store_id JOIN categories c ON c.category_id = p.category_id
WHERE s.store_name = 'Campus Clothing Studio' AND c.slug = 'tops' AND p.name = 'KMALL White T-Shirt'
ON CONFLICT (product_id, sort_order) DO NOTHING;

INSERT INTO product_images (product_id, image_url, sort_order, is_primary)
SELECT p.product_id, '/uploads/products/' || p.product_id || '/coding-life-2.jpg', 2, FALSE
FROM products p JOIN stores s ON s.store_id = p.store_id JOIN categories c ON c.category_id = p.category_id
WHERE s.store_name = 'Campus Clothing Studio' AND c.slug = 'tops' AND p.name = 'Graphic Tee – Coding Life'
ON CONFLICT (product_id, sort_order) DO NOTHING;

INSERT INTO product_images (product_id, image_url, sort_order, is_primary)
SELECT p.product_id, '/uploads/products/' || p.product_id || '/black-zip-hoodie-2.jpg', 2, FALSE
FROM products p JOIN stores s ON s.store_id = p.store_id JOIN categories c ON c.category_id = p.category_id
WHERE s.store_name = 'Campus Clothing Studio' AND c.slug = 'outerwear-jackets' AND p.name = 'Black Zip Hoodie'
ON CONFLICT (product_id, sort_order) DO NOTHING;

INSERT INTO product_images (product_id, image_url, sort_order, is_primary)
SELECT p.product_id, '/uploads/products/' || p.product_id || '/lightweight-windbreaker-2.jpg', 2, FALSE
FROM products p JOIN stores s ON s.store_id = p.store_id JOIN categories c ON c.category_id = p.category_id
WHERE s.store_name = 'Campus Clothing Studio' AND c.slug = 'outerwear-jackets' AND p.name = 'Lightweight Windbreaker'
ON CONFLICT (product_id, sort_order) DO NOTHING;

INSERT INTO product_images (product_id, image_url, sort_order, is_primary)
SELECT p.product_id, '/uploads/products/' || p.product_id || '/kmall-logo-2.jpg', 2, FALSE
FROM products p JOIN stores s ON s.store_id = p.store_id JOIN categories c ON c.category_id = p.category_id
WHERE s.store_name = 'Local Craft Studio' AND c.slug = 'keychains' AND p.name = 'Acrylic Keychain – KMALL Logo'
ON CONFLICT (product_id, sort_order) DO NOTHING;

INSERT INTO product_images (product_id, image_url, sort_order, is_primary)
SELECT p.product_id, '/uploads/products/' || p.product_id || '/cute-cat-2.jpg', 2, FALSE
FROM products p JOIN stores s ON s.store_id = p.store_id JOIN categories c ON c.category_id = p.category_id
WHERE s.store_name = 'Local Craft Studio' AND c.slug = 'keychains' AND p.name = 'Character Keychain – Cute Cat'
ON CONFLICT (product_id, sort_order) DO NOTHING;

INSERT INTO product_images (product_id, image_url, sort_order, is_primary)
SELECT p.product_id, '/uploads/products/' || p.product_id || '/canvas-tote-local-2.jpg', 2, FALSE
FROM products p JOIN stores s ON s.store_id = p.store_id JOIN categories c ON c.category_id = p.category_id
WHERE s.store_name = 'Local Craft Studio' AND c.slug = 'textile-knitting' AND p.name = 'Canvas Tote Bag – Local Pattern'
ON CONFLICT (product_id, sort_order) DO NOTHING;

INSERT INTO product_images (product_id, image_url, sort_order, is_primary)
SELECT p.product_id, '/uploads/products/' || p.product_id || '/mini-woven-handbag-2.jpg', 2, FALSE
FROM products p JOIN stores s ON s.store_id = p.store_id JOIN categories c ON c.category_id = p.category_id
WHERE s.store_name = 'Local Craft Studio' AND c.slug = 'textile-knitting' AND p.name = 'Mini Woven Handbag'
ON CONFLICT (product_id, sort_order) DO NOTHING;

-- ========= DEV DEMO ORDERS / ORDER ITEMS =========
TRUNCATE order_items, orders RESTART IDENTITY CASCADE;

INSERT INTO user_addresses (user_id, label, address_line1, district, province, postal_code, phone, is_default)
SELECT u.user_id, 'Dorm', 'KMUTT Dorm A', 'Thung Khru', 'Bangkok', '10140', '0800000000', TRUE
FROM users u
WHERE u.kms_id = 'dev-buyer-1'
  AND NOT EXISTS (
    SELECT 1 FROM user_addresses ua WHERE ua.user_id = u.user_id AND ua.is_default = TRUE
  );

DO $$
DECLARE
  buyer_uuid UUID;
  addr_id    BIGINT;
  campus_id  INT;

  r          RECORD;
  oid        INT;
  q          INT;
  unit       NUMERIC(10,2);
  sub        NUMERIC(10,2);
  dm         VARCHAR(20);
  t_start    TIMESTAMPTZ;
BEGIN
  SELECT user_id INTO buyer_uuid FROM users WHERE kms_id = 'dev-buyer-1' LIMIT 1;
  IF buyer_uuid IS NULL THEN RAISE EXCEPTION 'dev-buyer-1 not found'; END IF;

  SELECT address_id INTO addr_id
  FROM user_addresses
  WHERE user_id = buyer_uuid AND is_default = TRUE
  ORDER BY address_id DESC LIMIT 1;
  IF addr_id IS NULL THEN RAISE EXCEPTION 'buyer default address not found'; END IF;

  SELECT campus_location_id INTO campus_id
  FROM campus_locations WHERE zone = 'North'
  ORDER BY campus_location_id LIMIT 1;
  IF campus_id IS NULL THEN RAISE EXCEPTION 'no campus_locations found in Zone North'; END IF;

  -- loop เฉพาะ PREORDER products เท่านั้น (STOCK products ไม่สร้าง demo order เพราะต้องระบุ variant)
  FOR r IN
    SELECT p.product_id, p.store_id, p.price
    FROM products p
    WHERE p.product_type = 'PREORDER'
    ORDER BY p.product_id
  LOOP
    unit    := r.price;
    dm      := CASE WHEN (r.product_id % 2) = 0 THEN 'ROUND_UNIVERSITY' ELSE 'CAMPUS' END;
    t_start := NOW() + INTERVAL '1 day' + ((r.product_id % 5) * INTERVAL '1 hour');

    -- 1) Pending
    q := 1; sub := unit * q;
    INSERT INTO orders (
      status, total_price, delivery_method,
      delivery_address_id, campus_location_id, campus_detail_note,
      user_id, store_id
    ) VALUES (
      'Pending', sub, dm,
      CASE WHEN dm = 'ROUND_UNIVERSITY' THEN addr_id ELSE NULL END,
      CASE WHEN dm = 'CAMPUS' THEN campus_id ELSE NULL END,
      CASE WHEN dm = 'CAMPUS' THEN 'Meet at Zone North (mock)' ELSE NULL END,
      buyer_uuid, r.store_id
    ) RETURNING order_id INTO oid;
    INSERT INTO order_items (quantity, unit_price, fulfillment_type, subtotal, order_id, product_id)
    VALUES (q, unit, 'STANDARD', sub, oid, r.product_id);

    -- 2) Proposed (CAMPUS only)
    IF dm = 'CAMPUS' THEN
      q := 1; sub := unit * q;
      INSERT INTO orders (
        status, total_price, delivery_method,
        delivery_address_id, campus_location_id, campus_detail_note,
        proposed_at, meeting_location_id, meeting_note,
        user_id, store_id
      ) VALUES (
        'Proposed', sub, dm,
        NULL, campus_id, 'Meet at Zone North (mock)',
        t_start, campus_id, 'Mock proposal note',
        buyer_uuid, r.store_id
      ) RETURNING order_id INTO oid;
      INSERT INTO order_items (quantity, unit_price, fulfillment_type, subtotal, order_id, product_id)
      VALUES (q, unit, 'STANDARD', sub, oid, r.product_id);
    END IF;

    -- 3) Accepted
    q := 1; sub := unit * q;
    IF dm = 'CAMPUS' THEN
      INSERT INTO orders (
        status, total_price, delivery_method,
        delivery_address_id, campus_location_id, campus_detail_note,
        proposed_at, meeting_location_id, meeting_note,
        user_id, store_id
      ) VALUES (
        'Accepted', sub, dm,
        NULL, campus_id, 'Accepted meetup (mock)',
        t_start, campus_id, 'Accepted with proposal data',
        buyer_uuid, r.store_id
      ) RETURNING order_id INTO oid;
    ELSE
      INSERT INTO orders (
        status, total_price, delivery_method,
        delivery_address_id, campus_location_id, campus_detail_note,
        user_id, store_id
      ) VALUES (
        'Accepted', sub, dm,
        addr_id, NULL, NULL,
        buyer_uuid, r.store_id
      ) RETURNING order_id INTO oid;
    END IF;
    INSERT INTO order_items (quantity, unit_price, fulfillment_type, subtotal, order_id, product_id)
    VALUES (q, unit, 'STANDARD', sub, oid, r.product_id);

    -- 4) Completed
    q := 1; sub := unit * q;
    INSERT INTO orders (
      status, total_price, delivery_method,
      delivery_address_id, campus_location_id, campus_detail_note,
      user_id, store_id
    ) VALUES (
      'Completed', sub, dm,
      CASE WHEN dm = 'ROUND_UNIVERSITY' THEN addr_id ELSE NULL END,
      CASE WHEN dm = 'CAMPUS' THEN campus_id ELSE NULL END,
      CASE WHEN dm = 'CAMPUS' THEN 'Meet at Zone North (mock)' ELSE NULL END,
      buyer_uuid, r.store_id
    ) RETURNING order_id INTO oid;
    INSERT INTO order_items (quantity, unit_price, fulfillment_type, subtotal, order_id, product_id)
    VALUES (q, unit, 'STANDARD', sub, oid, r.product_id);

    -- 5) Cancelled (buyer)
    q := 1; sub := unit * q;
    INSERT INTO orders (
      status, total_price, delivery_method,
      delivery_address_id, campus_location_id, campus_detail_note,
      cancelled_at, cancelled_by, cancelled_reason,
      user_id, store_id
    ) VALUES (
      'Cancelled', sub, dm,
      CASE WHEN dm = 'ROUND_UNIVERSITY' THEN addr_id ELSE NULL END,
      CASE WHEN dm = 'CAMPUS' THEN campus_id ELSE NULL END,
      CASE WHEN dm = 'CAMPUS' THEN 'Cancelled meetup (mock)' ELSE NULL END,
      NOW(), 'BUYER', 'Mock cancel for testing',
      buyer_uuid, r.store_id
    ) RETURNING order_id INTO oid;
    INSERT INTO order_items (quantity, unit_price, fulfillment_type, subtotal, order_id, product_id)
    VALUES (q, unit, 'STANDARD', sub, oid, r.product_id);

    -- Extra Completed (qty ต่างกัน สำหรับ sold_count)
    q := (r.product_id % 3) + 2; sub := unit * q;
    INSERT INTO orders (
      status, total_price, delivery_method,
      delivery_address_id, campus_location_id, campus_detail_note,
      user_id, store_id
    ) VALUES (
      'Completed', sub, dm,
      CASE WHEN dm = 'ROUND_UNIVERSITY' THEN addr_id ELSE NULL END,
      CASE WHEN dm = 'CAMPUS' THEN campus_id ELSE NULL END,
      CASE WHEN dm = 'CAMPUS' THEN 'Extra completed meetup (mock)' ELSE NULL END,
      buyer_uuid, r.store_id
    ) RETURNING order_id INTO oid;
    INSERT INTO order_items (quantity, unit_price, fulfillment_type, subtotal, order_id, product_id)
    VALUES (q, unit, 'STANDARD', sub, oid, r.product_id);

    -- Extra Cancelled (seller)
    q := (r.product_id % 2) + 1; sub := unit * q;
    INSERT INTO orders (
      status, total_price, delivery_method,
      delivery_address_id, campus_location_id, campus_detail_note,
      cancelled_at, cancelled_by, cancelled_reason,
      user_id, store_id
    ) VALUES (
      'Cancelled', sub, dm,
      CASE WHEN dm = 'ROUND_UNIVERSITY' THEN addr_id ELSE NULL END,
      CASE WHEN dm = 'CAMPUS' THEN campus_id ELSE NULL END,
      CASE WHEN dm = 'CAMPUS' THEN 'Seller cancelled meetup (mock)' ELSE NULL END,
      NOW(), 'SELLER', 'Mock seller cancel for testing',
      buyer_uuid, r.store_id
    ) RETURNING order_id INTO oid;
    INSERT INTO order_items (quantity, unit_price, fulfillment_type, subtotal, order_id, product_id)
    VALUES (q, unit, 'STANDARD', sub, oid, r.product_id);

  END LOOP;
END $$;