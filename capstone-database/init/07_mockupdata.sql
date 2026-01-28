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
-- ROLES FOR ADMIN
INSERT INTO user_roles (user_id, role_id)
SELECT u.user_id, r.role_id
FROM users u, roles r
WHERE u.kms_id = 'dev-admin-1' AND r.role_name = 'admin'
ON CONFLICT DO NOTHING;

-- ROLES FOR SELLERS (3 stores)
INSERT INTO user_roles (user_id, role_id)
SELECT u.user_id, r.role_id
FROM users u, roles r
WHERE u.kms_id IN ('dev-seller-1', 'dev-seller-2', 'dev-seller-3')
  AND r.role_name = 'seller'
ON CONFLICT DO NOTHING;

-- ROLES FOR BUYER
INSERT INTO user_roles (user_id, role_id)
SELECT u.user_id, r.role_id
FROM users u, roles r
WHERE u.kms_id = 'dev-buyer-1' AND r.role_name = 'buyer'
ON CONFLICT DO NOTHING;

-- ========= DEV STORES (3 main demo stores) =========
-- Store 1: Food (Snacks & Desserts + Beverages)
INSERT INTO stores (
  store_name,
  store_desc,
  profile_url,
  delivery_round_university_enabled,
  campus_enabled,
  is_active,
  user_id
)
SELECT
  'BKK Snack & Drink Bar',
  'Demo store for snacks/desserts and beverages under Food subcategories.',
  NULL,
  TRUE,   -- delivery_round_university_enabled
  TRUE,   -- campus_enabled
  'YES',
  u.user_id
FROM users u
WHERE u.kms_id = 'dev-seller-1'
  AND NOT EXISTS (
    SELECT 1 FROM stores s WHERE s.store_name = 'BKK Snack & Drink Bar'
  );

-- Store 2: Clothing (Tops + Outerwear & Jackets)
INSERT INTO stores (
  store_name,
  store_desc,
  profile_url,
  delivery_round_university_enabled,
  campus_enabled,
  is_active,
  user_id
)
SELECT
  'Campus Clothing Studio',
  'Demo clothing store for tops and outerwear/jackets.',
  NULL,
  FALSE,  -- delivery_round_university_enabled
  TRUE,   -- campus_enabled
  'YES',
  u.user_id
FROM users u
WHERE u.kms_id = 'dev-seller-2'
  AND NOT EXISTS (
    SELECT 1 FROM stores s WHERE s.store_name = 'Campus Clothing Studio'
  );

-- Store 3: Handmade (Keychains + Textile & Knitting)
INSERT INTO stores (
  store_name,
  store_desc,
  profile_url,
  delivery_round_university_enabled,
  campus_enabled,
  is_active,
  user_id
)
SELECT
  'Local Craft Studio',
  'Demo handmade store for keychains and textile/knitting items.',
  NULL,
  TRUE,   -- delivery_round_university_enabled
  FALSE,  -- campus_enabled
  'YES',
  u.user_id
FROM users u
WHERE u.kms_id = 'dev-seller-3'
  AND NOT EXISTS (
    SELECT 1 FROM stores s WHERE s.store_name = 'Local Craft Studio'
  );


-- ========= STORE IMAGES =========
-- BKK Snack & Drink Bar
INSERT INTO store_images (store_id, image_url, sort_order, is_primary)
SELECT s.store_id,
       '/uploads/stores/' || s.store_id || '/profile-1.jpg',
       1,
       TRUE
FROM stores s
WHERE s.store_name = 'BKK Snack & Drink Bar'
ON CONFLICT (store_id, sort_order) DO NOTHING;

UPDATE stores s
SET profile_url = '/uploads/stores/' || s.store_id || '/profile-1.jpg'
WHERE s.store_name = 'BKK Snack & Drink Bar'
  AND s.profile_url IS NULL;

-- Campus Clothing Studio
INSERT INTO store_images (store_id, image_url, sort_order, is_primary)
SELECT s.store_id,
       '/uploads/stores/' || s.store_id || '/profile-1.jpg',
       1,
       TRUE
FROM stores s
WHERE s.store_name = 'Campus Clothing Studio'
ON CONFLICT (store_id, sort_order) DO NOTHING;

UPDATE stores s
SET profile_url = '/uploads/stores/' || s.store_id || '/profile-1.jpg'
WHERE s.store_name = 'Campus Clothing Studio'
  AND s.profile_url IS NULL;

-- Local Craft Studio
INSERT INTO store_images (store_id, image_url, sort_order, is_primary)
SELECT s.store_id,
       '/uploads/stores/' || s.store_id || '/profile-1.jpg',
       1,
       TRUE
FROM stores s
WHERE s.store_name = 'Local Craft Studio'
ON CONFLICT (store_id, sort_order) DO NOTHING;

UPDATE stores s
SET profile_url = '/uploads/stores/' || s.store_id || '/profile-1.jpg'
WHERE s.store_name = 'Local Craft Studio'
  AND s.profile_url IS NULL;

-- ========= FOOD PRODUCTS (BKK Snack & Drink Bar) =========
-- Snacks & Desserts
INSERT INTO products (name, product_desc, price, image_url, is_active, store_id, category_id)
SELECT
  'Chocolate Brownie',
  'Fudgy chocolate brownie, perfect for an afternoon snack.',
  35.00,
  NULL,
  'YES',
  s.store_id,
  c.category_id
FROM stores s
JOIN categories c ON c.slug = 'snacks-desserts'
WHERE s.store_name = 'BKK Snack & Drink Bar'
  AND c.parent_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM products p
    WHERE p.name = 'Chocolate Brownie'
      AND p.store_id = s.store_id
  );

INSERT INTO products (name, product_desc, price, image_url, is_active, store_id, category_id)
SELECT
  'Butter Croissant',
  'Flaky butter croissant, freshly baked every morning.',
  40.00,
  NULL,
  'YES',
  s.store_id,
  c.category_id
FROM stores s
JOIN categories c ON c.slug = 'snacks-desserts'
WHERE s.store_name = 'BKK Snack & Drink Bar'
  AND c.parent_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM products p
    WHERE p.name = 'Butter Croissant'
      AND p.store_id = s.store_id
  );

-- Beverages
INSERT INTO products (name, product_desc, price, image_url, is_active, store_id, category_id)
SELECT
  'Iced Latte',
  'Chilled coffee with milk, lightly sweetened.',
  55.00,
  NULL,
  'YES',
  s.store_id,
  c.category_id
FROM stores s
JOIN categories c ON c.slug = 'beverages'
WHERE s.store_name = 'BKK Snack & Drink Bar'
  AND c.parent_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM products p
    WHERE p.name = 'Iced Latte'
      AND p.store_id = s.store_id
  );

INSERT INTO products (name, product_desc, price, image_url, is_active, store_id, category_id)
SELECT
  'Mixed Berry Smoothie',
  'Smoothie made from mixed berries, no added sugar.',
  65.00,
  NULL,
  'YES',
  s.store_id,
  c.category_id
FROM stores s
JOIN categories c ON c.slug = 'beverages'
WHERE s.store_name = 'BKK Snack & Drink Bar'
  AND c.parent_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM products p
    WHERE p.name = 'Mixed Berry Smoothie'
      AND p.store_id = s.store_id
  );

-- ========= CLOTHING PRODUCTS (Campus Clothing Studio) =========
-- Tops
INSERT INTO products (name, product_desc, price, image_url, is_active, store_id, category_id)
SELECT
  'KMALL White T-Shirt',
  'Basic white T-shirt with KMALL logo, unisex.',
  199.00,
  NULL,
  'YES',
  s.store_id,
  c.category_id
FROM stores s
JOIN categories c ON c.slug = 'tops'
WHERE s.store_name = 'Campus Clothing Studio'
  AND c.parent_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM products p
    WHERE p.name = 'KMALL White T-Shirt'
      AND p.store_id = s.store_id
  );

INSERT INTO products (name, product_desc, price, image_url, is_active, store_id, category_id)
SELECT
  'Graphic Tee – Coding Life',
  'T-shirt with “Eat Sleep Code Repeat” graphic print.',
  220.00,
  NULL,
  'YES',
  s.store_id,
  c.category_id
FROM stores s
JOIN categories c ON c.slug = 'tops'
WHERE s.store_name = 'Campus Clothing Studio'
  AND c.parent_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM products p
    WHERE p.name = 'Graphic Tee – Coding Life'
      AND p.store_id = s.store_id
  );

-- Outerwear & Jackets
INSERT INTO products (name, product_desc, price, image_url, is_active, store_id, category_id)
SELECT
  'Black Zip Hoodie',
  'Comfortable black zip-up hoodie, minimal design.',
  399.00,
  NULL,
  'YES',
  s.store_id,
  c.category_id
FROM stores s
JOIN categories c ON c.slug = 'outerwear-jackets'
WHERE s.store_name = 'Campus Clothing Studio'
  AND c.parent_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM products p
    WHERE p.name = 'Black Zip Hoodie'
      AND p.store_id = s.store_id
  );

INSERT INTO products (name, product_desc, price, image_url, is_active, store_id, category_id)
SELECT
  'Lightweight Windbreaker',
  'Thin windbreaker jacket for everyday use.',
  450.00,
  NULL,
  'YES',
  s.store_id,
  c.category_id
FROM stores s
JOIN categories c ON c.slug = 'outerwear-jackets'
WHERE s.store_name = 'Campus Clothing Studio'
  AND c.parent_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM products p
    WHERE p.name = 'Lightweight Windbreaker'
      AND p.store_id = s.store_id
  );

-- ========= HANDMADE PRODUCTS (Local Craft Studio) =========
-- Keychains
INSERT INTO products (name, product_desc, price, image_url, is_active, store_id, category_id)
SELECT
  'Acrylic Keychain – KMALL Logo',
  'Clear acrylic keychain with KMALL logo, lightweight and durable.',
  49.00,
  NULL,
  'YES',
  s.store_id,
  c.category_id
FROM stores s
JOIN categories c ON c.slug = 'keychains'
WHERE s.store_name = 'Local Craft Studio'
  AND c.parent_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM products p
    WHERE p.name = 'Acrylic Keychain – KMALL Logo'
      AND p.store_id = s.store_id
  );

INSERT INTO products (name, product_desc, price, image_url, is_active, store_id, category_id)
SELECT
  'Character Keychain – Cute Cat',
  'Soft rubber keychain in cute cat character design.',
  39.00,
  NULL,
  'YES',
  s.store_id,
  c.category_id
FROM stores s
JOIN categories c ON c.slug = 'keychains'
WHERE s.store_name = 'Local Craft Studio'
  AND c.parent_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM products p
    WHERE p.name = 'Character Keychain – Cute Cat'
      AND p.store_id = s.store_id
  );

-- Textile & Knitting (แทน Handmade Bags เดิม)
INSERT INTO products (name, product_desc, price, image_url, is_active, store_id, category_id)
SELECT
  'Canvas Tote Bag – Local Pattern',
  'Canvas tote bag with local-inspired pattern.',
  189.00,
  NULL,
  'YES',
  s.store_id,
  c.category_id
FROM stores s
JOIN categories c ON c.slug = 'textile-knitting'
WHERE s.store_name = 'Local Craft Studio'
  AND c.parent_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM products p
    WHERE p.name = 'Canvas Tote Bag – Local Pattern'
      AND p.store_id = s.store_id
  );

INSERT INTO products (name, product_desc, price, image_url, is_active, store_id, category_id)
SELECT
  'Mini Woven Handbag',
  'Small woven handbag made from local materials.',
  220.00,
  NULL,
  'YES',
  s.store_id,
  c.category_id
FROM stores s
JOIN categories c ON c.slug = 'textile-knitting'
WHERE s.store_name = 'Local Craft Studio'
  AND c.parent_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM products p
    WHERE p.name = 'Mini Woven Handbag'
      AND p.store_id = s.store_id
  );

-- ========= PRODUCT IMAGES (Primary) =========
-- FOOD
INSERT INTO product_images (product_id, image_url, sort_order, is_primary)
SELECT p.product_id,
       '/uploads/products/' || p.product_id || '/chocolate-brownie-1.jpg',
       1,
       TRUE
FROM products p
JOIN stores s ON s.store_id = p.store_id
JOIN categories c ON c.category_id = p.category_id
WHERE s.store_name = 'BKK Snack & Drink Bar'
  AND c.slug = 'snacks-desserts'
  AND p.name = 'Chocolate Brownie'
ON CONFLICT (product_id, sort_order) DO NOTHING;

INSERT INTO product_images (product_id, image_url, sort_order, is_primary)
SELECT p.product_id,
       '/uploads/products/' || p.product_id || '/butter-croissant-1.jpg',
       1,
       TRUE
FROM products p
JOIN stores s ON s.store_id = p.store_id
JOIN categories c ON c.category_id = p.category_id
WHERE s.store_name = 'BKK Snack & Drink Bar'
  AND c.slug = 'snacks-desserts'
  AND p.name = 'Butter Croissant'
ON CONFLICT (product_id, sort_order) DO NOTHING;

INSERT INTO product_images (product_id, image_url, sort_order, is_primary)
SELECT p.product_id,
       '/uploads/products/' || p.product_id || '/iced-latte-1.jpg',
       1,
       TRUE
FROM products p
JOIN stores s ON s.store_id = p.store_id
JOIN categories c ON c.category_id = p.category_id
WHERE s.store_name = 'BKK Snack & Drink Bar'
  AND c.slug = 'beverages'
  AND p.name = 'Iced Latte'
ON CONFLICT (product_id, sort_order) DO NOTHING;

INSERT INTO product_images (product_id, image_url, sort_order, is_primary)
SELECT p.product_id,
       '/uploads/products/' || p.product_id || '/mixed-berry-smoothie-1.jpg',
       1,
       TRUE
FROM products p
JOIN stores s ON s.store_id = p.store_id
JOIN categories c ON c.category_id = p.category_id
WHERE s.store_name = 'BKK Snack & Drink Bar'
  AND c.slug = 'beverages'
  AND p.name = 'Mixed Berry Smoothie'
ON CONFLICT (product_id, sort_order) DO NOTHING;

-- CLOTHING
INSERT INTO product_images (product_id, image_url, sort_order, is_primary)
SELECT p.product_id,
       '/uploads/products/' || p.product_id || '/kmall-white-1.jpg',
       1,
       TRUE
FROM products p
JOIN stores s ON s.store_id = p.store_id
JOIN categories c ON c.category_id = p.category_id
WHERE s.store_name = 'Campus Clothing Studio'
  AND c.slug = 'tops'
  AND p.name = 'KMALL White T-Shirt'
ON CONFLICT (product_id, sort_order) DO NOTHING;

INSERT INTO product_images (product_id, image_url, sort_order, is_primary)
SELECT p.product_id,
       '/uploads/products/' || p.product_id || '/coding-life-1.jpg',
       1,
       TRUE
FROM products p
JOIN stores s ON s.store_id = p.store_id
JOIN categories c ON c.category_id = p.category_id
WHERE s.store_name = 'Campus Clothing Studio'
  AND c.slug = 'tops'
  AND p.name = 'Graphic Tee – Coding Life'
ON CONFLICT (product_id, sort_order) DO NOTHING;

INSERT INTO product_images (product_id, image_url, sort_order, is_primary)
SELECT p.product_id,
       '/uploads/products/' || p.product_id || '/black-zip-hoodie-1.jpg',
       1,
       TRUE
FROM products p
JOIN stores s ON s.store_id = p.store_id
JOIN categories c ON c.category_id = p.category_id
WHERE s.store_name = 'Campus Clothing Studio'
  AND c.slug = 'outerwear-jackets'
  AND p.name = 'Black Zip Hoodie'
ON CONFLICT (product_id, sort_order) DO NOTHING;

INSERT INTO product_images (product_id, image_url, sort_order, is_primary)
SELECT p.product_id,
       '/uploads/products/' || p.product_id || '/lightweight-windbreaker-1.jpg',
       1,
       TRUE
FROM products p
JOIN stores s ON s.store_id = p.store_id
JOIN categories c ON c.category_id = p.category_id
WHERE s.store_name = 'Campus Clothing Studio'
  AND c.slug = 'outerwear-jackets'
  AND p.name = 'Lightweight Windbreaker'
ON CONFLICT (product_id, sort_order) DO NOTHING;

-- HANDMADE
INSERT INTO product_images (product_id, image_url, sort_order, is_primary)
SELECT p.product_id,
       '/uploads/products/' || p.product_id || '/kmall-logo-1.jpg',
       1,
       TRUE
FROM products p
JOIN stores s ON s.store_id = p.store_id
JOIN categories c ON c.category_id = p.category_id
WHERE s.store_name = 'Local Craft Studio'
  AND c.slug = 'keychains'
  AND p.name = 'Acrylic Keychain – KMALL Logo'
ON CONFLICT (product_id, sort_order) DO NOTHING;

INSERT INTO product_images (product_id, image_url, sort_order, is_primary)
SELECT p.product_id,
       '/uploads/products/' || p.product_id || '/cute-cat-1.jpg',
       1,
       TRUE
FROM products p
JOIN stores s ON s.store_id = p.store_id
JOIN categories c ON c.category_id = p.category_id
WHERE s.store_name = 'Local Craft Studio'
  AND c.slug = 'keychains'
  AND p.name = 'Character Keychain – Cute Cat'
ON CONFLICT (product_id, sort_order) DO NOTHING;

INSERT INTO product_images (product_id, image_url, sort_order, is_primary)
SELECT p.product_id,
       '/uploads/products/' || p.product_id || '/canvas-tote-local-1.jpg',
       1,
       TRUE
FROM products p
JOIN stores s ON s.store_id = p.store_id
JOIN categories c ON c.category_id = p.category_id
WHERE s.store_name = 'Local Craft Studio'
  AND c.slug = 'textile-knitting'
  AND p.name = 'Canvas Tote Bag – Local Pattern'
ON CONFLICT (product_id, sort_order) DO NOTHING;

INSERT INTO product_images (product_id, image_url, sort_order, is_primary)
SELECT p.product_id,
       '/uploads/products/' || p.product_id || '/mini-woven-handbag-1.jpg',
       1,
       TRUE
FROM products p
JOIN stores s ON s.store_id = p.store_id
JOIN categories c ON c.category_id = p.category_id
WHERE s.store_name = 'Local Craft Studio'
  AND c.slug = 'textile-knitting'
  AND p.name = 'Mini Woven Handbag'
ON CONFLICT (product_id, sort_order) DO NOTHING;

-- ========= EXTRA PRODUCT IMAGES (2nd images) =========
-- FOOD
INSERT INTO product_images (product_id, image_url, sort_order, is_primary)
SELECT p.product_id,
       '/uploads/products/' || p.product_id || '/chocolate-brownie-2.jpg',
       2,
       FALSE
FROM products p
JOIN stores s ON s.store_id = p.store_id
JOIN categories c ON c.category_id = p.category_id
WHERE s.store_name = 'BKK Snack & Drink Bar'
  AND c.slug = 'snacks-desserts'
  AND p.name = 'Chocolate Brownie'
ON CONFLICT (product_id, sort_order) DO NOTHING;

INSERT INTO product_images (product_id, image_url, sort_order, is_primary)
SELECT p.product_id,
       '/uploads/products/' || p.product_id || '/butter-croissant-2.jpg',
       2,
       FALSE
FROM products p
JOIN stores s ON s.store_id = p.store_id
JOIN categories c ON c.category_id = p.category_id
WHERE s.store_name = 'BKK Snack & Drink Bar'
  AND c.slug = 'snacks-desserts'
  AND p.name = 'Butter Croissant'
ON CONFLICT (product_id, sort_order) DO NOTHING;

INSERT INTO product_images (product_id, image_url, sort_order, is_primary)
SELECT p.product_id,
       '/uploads/products/' || p.product_id || '/iced-latte-2.jpg',
       2,
       FALSE
FROM products p
JOIN stores s ON s.store_id = p.store_id
JOIN categories c ON c.category_id = p.category_id
WHERE s.store_name = 'BKK Snack & Drink Bar'
  AND c.slug = 'beverages'
  AND p.name = 'Iced Latte'
ON CONFLICT (product_id, sort_order) DO NOTHING;

INSERT INTO product_images (product_id, image_url, sort_order, is_primary)
SELECT p.product_id,
       '/uploads/products/' || p.product_id || '/mixed-berry-smoothie-2.jpg',
       2,
       FALSE
FROM products p
JOIN stores s ON s.store_id = p.store_id
JOIN categories c ON c.category_id = p.category_id
WHERE s.store_name = 'BKK Snack & Drink Bar'
  AND c.slug = 'beverages'
  AND p.name = 'Mixed Berry Smoothie'
ON CONFLICT (product_id, sort_order) DO NOTHING;

-- CLOTHING
INSERT INTO product_images (product_id, image_url, sort_order, is_primary)
SELECT p.product_id,
       '/uploads/products/' || p.product_id || '/kmall-white-2.jpg',
       2,
       FALSE
FROM products p
JOIN stores s ON s.store_id = p.store_id
JOIN categories c ON c.category_id = p.category_id
WHERE s.store_name = 'Campus Clothing Studio'
  AND c.slug = 'tops'
  AND p.name = 'KMALL White T-Shirt'
ON CONFLICT (product_id, sort_order) DO NOTHING;

INSERT INTO product_images (product_id, image_url, sort_order, is_primary)
SELECT p.product_id,
       '/uploads/products/' || p.product_id || '/coding-life-2.jpg',
       2,
       FALSE
FROM products p
JOIN stores s ON s.store_id = p.store_id
JOIN categories c ON c.category_id = p.category_id
WHERE s.store_name = 'Campus Clothing Studio'
  AND c.slug = 'tops'
  AND p.name = 'Graphic Tee – Coding Life'
ON CONFLICT (product_id, sort_order) DO NOTHING;

INSERT INTO product_images (product_id, image_url, sort_order, is_primary)
SELECT p.product_id,
       '/uploads/products/' || p.product_id || '/black-zip-hoodie-2.jpg',
       2,
       FALSE
FROM products p
JOIN stores s ON s.store_id = p.store_id
JOIN categories c ON c.category_id = p.category_id
WHERE s.store_name = 'Campus Clothing Studio'
  AND c.slug = 'outerwear-jackets'
  AND p.name = 'Black Zip Hoodie'
ON CONFLICT (product_id, sort_order) DO NOTHING;

INSERT INTO product_images (product_id, image_url, sort_order, is_primary)
SELECT p.product_id,
       '/uploads/products/' || p.product_id || '/lightweight-windbreaker-2.jpg',
       2,
       FALSE
FROM products p
JOIN stores s ON s.store_id = p.store_id
JOIN categories c ON c.category_id = p.category_id
WHERE s.store_name = 'Campus Clothing Studio'
  AND c.slug = 'outerwear-jackets'
  AND p.name = 'Lightweight Windbreaker'
ON CONFLICT (product_id, sort_order) DO NOTHING;

-- HANDMADE
INSERT INTO product_images (product_id, image_url, sort_order, is_primary)
SELECT p.product_id,
       '/uploads/products/' || p.product_id || '/kmall-logo-2.jpg',
       2,
       FALSE
FROM products p
JOIN stores s ON s.store_id = p.store_id
JOIN categories c ON c.category_id = p.category_id
WHERE s.store_name = 'Local Craft Studio'
  AND c.slug = 'keychains'
  AND p.name = 'Acrylic Keychain – KMALL Logo'
ON CONFLICT (product_id, sort_order) DO NOTHING;

INSERT INTO product_images (product_id, image_url, sort_order, is_primary)
SELECT p.product_id,
       '/uploads/products/' || p.product_id || '/cute-cat-2.jpg',
       2,
       FALSE
FROM products p
JOIN stores s ON s.store_id = p.store_id
JOIN categories c ON c.category_id = p.category_id
WHERE s.store_name = 'Local Craft Studio'
  AND c.slug = 'keychains'
  AND p.name = 'Character Keychain – Cute Cat'
ON CONFLICT (product_id, sort_order) DO NOTHING;

INSERT INTO product_images (product_id, image_url, sort_order, is_primary)
SELECT p.product_id,
       '/uploads/products/' || p.product_id || '/canvas-tote-local-2.jpg',
       2,
       FALSE
FROM products p
JOIN stores s ON s.store_id = p.store_id
JOIN categories c ON c.category_id = p.category_id
WHERE s.store_name = 'Local Craft Studio'
  AND c.slug = 'textile-knitting'
  AND p.name = 'Canvas Tote Bag – Local Pattern'
ON CONFLICT (product_id, sort_order) DO NOTHING;

INSERT INTO product_images (product_id, image_url, sort_order, is_primary)
SELECT p.product_id,
       '/uploads/products/' || p.product_id || '/mini-woven-handbag-2.jpg',
       2,
       FALSE
FROM products p
JOIN stores s ON s.store_id = p.store_id
JOIN categories c ON c.category_id = p.category_id
WHERE s.store_name = 'Local Craft Studio'
  AND c.slug = 'textile-knitting'
  AND p.name = 'Mini Woven Handbag'
ON CONFLICT (product_id, sort_order) DO NOTHING;

-- ========= DEV DEMO ORDERS / ORDER ITEMS (FIXED FOR YOUR SCHEMA) =========
TRUNCATE order_items, orders RESTART IDENTITY CASCADE;

-- ensure buyer has 1 address (for ROUND_UNIVERSITY)
INSERT INTO user_addresses (user_id, label, address_line1, district, province, postal_code, phone, is_default)
SELECT u.user_id, 'Dorm', 'KMUTT Dorm A', 'Thung Khru', 'Bangkok', '10140', '0800000000', TRUE
FROM users u
WHERE u.kms_id = 'dev-buyer-1'
  AND NOT EXISTS (
    SELECT 1 FROM user_addresses ua WHERE ua.user_id = u.user_id AND ua.is_default = TRUE
  );

-- ensure campus location exists (for CAMPUS + meeting_location)
INSERT INTO campus_locations (name, area, latitude, longitude, is_active)
SELECT 'KMUTT Main Gate', 'KMUTT', 13.6510000, 100.4960000, TRUE
WHERE NOT EXISTS (SELECT 1 FROM campus_locations WHERE name = 'KMUTT Main Gate');

DO $$
DECLARE
  buyer_uuid UUID;
  addr_id BIGINT;
  campus_id INT;

  r RECORD;
  oid INT;

  q INT;
  unit NUMERIC(10,2);
  sub NUMERIC(10,2);

  dm VARCHAR(20);

  t_start TIMESTAMPTZ;
BEGIN
  -- buyer
  SELECT user_id INTO buyer_uuid
  FROM users
  WHERE kms_id = 'dev-buyer-1'
  LIMIT 1;
  IF buyer_uuid IS NULL THEN
    RAISE EXCEPTION 'dev-buyer-1 not found';
  END IF;

  -- default address id (ROUND_UNIVERSITY)
  SELECT address_id INTO addr_id
  FROM user_addresses
  WHERE user_id = buyer_uuid AND is_default = TRUE
  ORDER BY address_id DESC
  LIMIT 1;
  IF addr_id IS NULL THEN
    RAISE EXCEPTION 'buyer default address not found';
  END IF;

  -- campus id
  SELECT campus_location_id INTO campus_id
  FROM campus_locations
  WHERE name = 'KMUTT Main Gate'
  LIMIT 1;
  IF campus_id IS NULL THEN
    RAISE EXCEPTION 'campus location not found';
  END IF;

  FOR r IN
    SELECT p.product_id, p.store_id, p.price
    FROM products p
    ORDER BY p.product_id
  LOOP
    unit := r.price;

    -- สลับ delivery_method เพื่อให้มีทั้ง ROUND_UNIVERSITY และ CAMPUS
    IF (r.product_id % 2) = 0 THEN
      dm := 'ROUND_UNIVERSITY';
    ELSE
      dm := 'CAMPUS';
    END IF;

    -- ตั้ง proposed_at แบบมั่ว ๆ
    t_start := NOW() + INTERVAL '1 day' + ((r.product_id % 5) * INTERVAL '1 hour');

    -- 1) Pending (ได้ทั้ง 2 method)
    q := 1; sub := unit*q;
    INSERT INTO orders (
      status, total_price, delivery_method,
      delivery_address_id, campus_location_id, campus_detail_note,
      user_id, store_id
    )
    VALUES (
      'Pending', sub, dm,
      CASE WHEN dm='ROUND_UNIVERSITY' THEN addr_id ELSE NULL END,
      CASE WHEN dm='CAMPUS' THEN campus_id ELSE NULL END,
      CASE WHEN dm='CAMPUS' THEN 'Meet at main gate (mock)' ELSE NULL END,
      buyer_uuid, r.store_id
    )
    RETURNING order_id INTO oid;

    INSERT INTO order_items (quantity, unit_price, fulfillment_type, subtotal, order_id, product_id)
    VALUES (q, unit, 'STANDARD', sub, oid, r.product_id);

    -- 2) Proposed (CAMPUS only) + ต้องมี proposed_at + meeting_location_id
    IF dm = 'CAMPUS' THEN
      q := 1; sub := unit*q;

      INSERT INTO orders (
        status, total_price, delivery_method,
        delivery_address_id, campus_location_id, campus_detail_note,
        proposed_at, meeting_location_id, meeting_note,
        user_id, store_id
      )
      VALUES (
        'Proposed', sub, dm,
        NULL, campus_id, 'Meet at main gate (mock)',
        t_start, campus_id, 'Mock proposal note',
        buyer_uuid, r.store_id
      )
      RETURNING order_id INTO oid;

      INSERT INTO order_items (quantity, unit_price, fulfillment_type, subtotal, order_id, product_id)
      VALUES (q, unit, 'STANDARD', sub, oid, r.product_id);
    END IF;

    -- 3) Accepted
    -- - CAMPUS: ต้องมี proposed_at + meeting_location_id ด้วย (ตาม chk_accepted_requires_data)
    -- - ROUND_UNIVERSITY: ห้ามมี proposal fields และต้องมี delivery_address_id (ตาม chk_destination_by_method + chk_round_uni_no_proposal)
    q := 1; sub := unit*q;

    IF dm = 'CAMPUS' THEN
      INSERT INTO orders (
        status, total_price, delivery_method,
        delivery_address_id, campus_location_id, campus_detail_note,
        proposed_at, meeting_location_id, meeting_note,
        user_id, store_id
      )
      VALUES (
        'Accepted', sub, dm,
        NULL, campus_id, 'Accepted meetup (mock)',
        t_start, campus_id, 'Accepted with proposal data',
        buyer_uuid, r.store_id
      )
      RETURNING order_id INTO oid;
    ELSE
      INSERT INTO orders (
        status, total_price, delivery_method,
        delivery_address_id, campus_location_id, campus_detail_note,
        user_id, store_id
      )
      VALUES (
        'Accepted', sub, dm,
        addr_id, NULL, NULL,
        buyer_uuid, r.store_id
      )
      RETURNING order_id INTO oid;
    END IF;

    INSERT INTO order_items (quantity, unit_price, fulfillment_type, subtotal, order_id, product_id)
    VALUES (q, unit, 'STANDARD', sub, oid, r.product_id);

    -- 4) Completed (ได้ทั้ง 2 method)
    q := 1; sub := unit*q;
    INSERT INTO orders (
      status, total_price, delivery_method,
      delivery_address_id, campus_location_id, campus_detail_note,
      user_id, store_id
    )
    VALUES (
      'Completed', sub, dm,
      CASE WHEN dm='ROUND_UNIVERSITY' THEN addr_id ELSE NULL END,
      CASE WHEN dm='CAMPUS' THEN campus_id ELSE NULL END,
      CASE WHEN dm='CAMPUS' THEN 'Completed meetup (mock)' ELSE NULL END,
      buyer_uuid, r.store_id
    )
    RETURNING order_id INTO oid;

    INSERT INTO order_items (quantity, unit_price, fulfillment_type, subtotal, order_id, product_id)
    VALUES (q, unit, 'STANDARD', sub, oid, r.product_id);

    -- 5) Cancelled (ได้ทั้ง 2 method) + ต้องมี cancelled_at/cancelled_by/cancelled_reason
    q := 1; sub := unit*q;
    INSERT INTO orders (
      status, total_price, delivery_method,
      delivery_address_id, campus_location_id, campus_detail_note,
      cancelled_at, cancelled_by, cancelled_reason,
      user_id, store_id
    )
    VALUES (
      'Cancelled', sub, dm,
      CASE WHEN dm='ROUND_UNIVERSITY' THEN addr_id ELSE NULL END,
      CASE WHEN dm='CAMPUS' THEN campus_id ELSE NULL END,
      CASE WHEN dm='CAMPUS' THEN 'Cancelled meetup (mock)' ELSE NULL END,
      NOW(), 'BUYER', 'Mock cancel for testing',
      buyer_uuid, r.store_id
    )
    RETURNING order_id INTO oid;

    INSERT INTO order_items (quantity, unit_price, fulfillment_type, subtotal, order_id, product_id)
    VALUES (q, unit, 'STANDARD', sub, oid, r.product_id);

    -- ===== Extra Completed (เพิ่ม qty ให้ต่างกัน) =====
    q := (r.product_id % 3) + 2; -- 2..4
    sub := unit*q;
    INSERT INTO orders (
      status, total_price, delivery_method,
      delivery_address_id, campus_location_id, campus_detail_note,
      user_id, store_id
    )
    VALUES (
      'Completed', sub, dm,
      CASE WHEN dm='ROUND_UNIVERSITY' THEN addr_id ELSE NULL END,
      CASE WHEN dm='CAMPUS' THEN campus_id ELSE NULL END,
      CASE WHEN dm='CAMPUS' THEN 'Extra completed meetup (mock)' ELSE NULL END,
      buyer_uuid, r.store_id
    )
    RETURNING order_id INTO oid;

    INSERT INTO order_items (quantity, unit_price, fulfillment_type, subtotal, order_id, product_id)
    VALUES (q, unit, 'STANDARD', sub, oid, r.product_id);

    -- ===== Extra Cancelled (seller) =====
    q := (r.product_id % 2) + 1; -- 1..2
    sub := unit*q;
    INSERT INTO orders (
      status, total_price, delivery_method,
      delivery_address_id, campus_location_id, campus_detail_note,
      cancelled_at, cancelled_by, cancelled_reason,
      user_id, store_id
    )
    VALUES (
      'Cancelled', sub, dm,
      CASE WHEN dm='ROUND_UNIVERSITY' THEN addr_id ELSE NULL END,
      CASE WHEN dm='CAMPUS' THEN campus_id ELSE NULL END,
      CASE WHEN dm='CAMPUS' THEN 'Seller cancelled meetup (mock)' ELSE NULL END,
      NOW(), 'SELLER', 'Mock seller cancel for testing',
      buyer_uuid, r.store_id
    )
    RETURNING order_id INTO oid;

    INSERT INTO order_items (quantity, unit_price, fulfillment_type, subtotal, order_id, product_id)
    VALUES (q, unit, 'STANDARD', sub, oid, r.product_id);

  END LOOP;
END $$;
