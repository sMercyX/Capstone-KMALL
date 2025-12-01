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
-- Store 1: Food (Snacks & Bakery + Beverages & Drinks)
INSERT INTO stores (store_name, store_desc, profile_url, is_active, user_id)
SELECT
  'BKK Snack & Drink Bar',
  'Demo store for snacks and beverages under Food category.',
  NULL,
  'YES',
  u.user_id
FROM users u
WHERE u.kms_id = 'dev-seller-1'
  AND NOT EXISTS (
    SELECT 1 FROM stores s WHERE s.store_name = 'BKK Snack & Drink Bar'
  );

-- Store 2: Clothing (T-Shirt + Hoodies & Outerwear)
INSERT INTO stores (store_name, store_desc, profile_url, is_active, user_id)
SELECT
  'Campus Clothing Studio',
  'Demo clothing store for T-shirts and hoodies.',
  NULL,
  'YES',
  u.user_id
FROM users u
WHERE u.kms_id = 'dev-seller-2'
  AND NOT EXISTS (
    SELECT 1 FROM stores s WHERE s.store_name = 'Campus Clothing Studio'
  );

-- Store 3: Handmade (Keychain + Handmade Bags)
INSERT INTO stores (store_name, store_desc, profile_url, is_active, user_id)
SELECT
  'Local Craft Studio',
  'Demo handmade store for keychains and handmade bags.',
  NULL,
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
-- Snacks & Bakery
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
JOIN categories c ON c.slug = 'snacks-bakery'
WHERE s.store_name = 'BKK Snack & Drink Bar'
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
JOIN categories c ON c.slug = 'snacks-bakery'
WHERE s.store_name = 'BKK Snack & Drink Bar'
  AND NOT EXISTS (
    SELECT 1 FROM products p
    WHERE p.name = 'Butter Croissant'
      AND p.store_id = s.store_id
  );

-- Beverages & Drinks
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
JOIN categories c ON c.slug = 'beverages-drinks'
WHERE s.store_name = 'BKK Snack & Drink Bar'
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
JOIN categories c ON c.slug = 'beverages-drinks'
WHERE s.store_name = 'BKK Snack & Drink Bar'
  AND NOT EXISTS (
    SELECT 1 FROM products p
    WHERE p.name = 'Mixed Berry Smoothie'
      AND p.store_id = s.store_id
  );

-- ========= CLOTHING PRODUCTS (Campus Clothing Studio) =========
-- T-Shirt
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
JOIN categories c ON c.slug = 't-shirt'
WHERE s.store_name = 'Campus Clothing Studio'
  AND NOT EXISTS (
    SELECT 1 FROM products p
    WHERE p.name = 'KMALL White T-Shirt'
      AND p.store_id = s.store_id
  );

INSERT INTO products (name, product_desc, price, image_url, is_active, store_id, category_id)
SELECT
  'Graphic T-Shirt – Coding Life',
  'T-shirt with “Eat Sleep Code Repeat” graphic print.',
  220.00,
  NULL,
  'YES',
  s.store_id,
  c.category_id
FROM stores s
JOIN categories c ON c.slug = 't-shirt'
WHERE s.store_name = 'Campus Clothing Studio'
  AND NOT EXISTS (
    SELECT 1 FROM products p
    WHERE p.name = 'Graphic T-Shirt – Coding Life'
      AND p.store_id = s.store_id
  );

-- Hoodies & Outerwear
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
JOIN categories c ON c.slug = 'hoodies-outerwear'
WHERE s.store_name = 'Campus Clothing Studio'
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
JOIN categories c ON c.slug = 'hoodies-outerwear'
WHERE s.store_name = 'Campus Clothing Studio'
  AND NOT EXISTS (
    SELECT 1 FROM products p
    WHERE p.name = 'Lightweight Windbreaker'
      AND p.store_id = s.store_id
  );

-- ========= HANDMADE PRODUCTS (Local Craft Studio) =========
-- Keychain
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
JOIN categories c ON c.slug = 'keychain'
WHERE s.store_name = 'Local Craft Studio'
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
JOIN categories c ON c.slug = 'keychain'
WHERE s.store_name = 'Local Craft Studio'
  AND NOT EXISTS (
    SELECT 1 FROM products p
    WHERE p.name = 'Character Keychain – Cute Cat'
      AND p.store_id = s.store_id
  );

-- Handmade Bags
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
JOIN categories c ON c.slug = 'handmade-bags'
WHERE s.store_name = 'Local Craft Studio'
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
JOIN categories c ON c.slug = 'handmade-bags'
WHERE s.store_name = 'Local Craft Studio'
  AND NOT EXISTS (
    SELECT 1 FROM products p
    WHERE p.name = 'Mini Woven Handbag'
      AND p.store_id = s.store_id
  );

-- ========= FOOD PRODUCT IMAGES =========
INSERT INTO product_images (product_id, image_url, sort_order, is_primary)
SELECT p.product_id,
       '/uploads/products/' || p.product_id || '/chocolate-brownie-1.jpg',
       1,
       TRUE
FROM products p
JOIN stores s ON s.store_id = p.store_id
JOIN categories c ON c.category_id = p.category_id
WHERE s.store_name = 'BKK Snack & Drink Bar'
  AND c.slug = 'snacks-bakery'
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
  AND c.slug = 'snacks-bakery'
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
  AND c.slug = 'beverages-drinks'
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
  AND c.slug = 'beverages-drinks'
  AND p.name = 'Mixed Berry Smoothie'
ON CONFLICT (product_id, sort_order) DO NOTHING;

-- ========= CLOTHING PRODUCT IMAGES =========
INSERT INTO product_images (product_id, image_url, sort_order, is_primary)
SELECT p.product_id,
       '/uploads/products/' || p.product_id || '/kmall-white-1.jpg',
       1,
       TRUE
FROM products p
JOIN stores s ON s.store_id = p.store_id
JOIN categories c ON c.category_id = p.category_id
WHERE s.store_name = 'Campus Clothing Studio'
  AND c.slug = 't-shirt'
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
  AND c.slug = 't-shirt'
  AND p.name = 'Graphic T-Shirt – Coding Life'
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
  AND c.slug = 'hoodies-outerwear'
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
  AND c.slug = 'hoodies-outerwear'
  AND p.name = 'Lightweight Windbreaker'
ON CONFLICT (product_id, sort_order) DO NOTHING;

-- ========= HANDMADE PRODUCT IMAGES =========
INSERT INTO product_images (product_id, image_url, sort_order, is_primary)
SELECT p.product_id,
       '/uploads/products/' || p.product_id || '/kmall-logo-1.jpg',
       1,
       TRUE
FROM products p
JOIN stores s ON s.store_id = p.store_id
JOIN categories c ON c.category_id = p.category_id
WHERE s.store_name = 'Local Craft Studio'
  AND c.slug = 'keychain'
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
  AND c.slug = 'keychain'
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
  AND c.slug = 'handmade-bags'
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
  AND c.slug = 'handmade-bags'
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
  AND c.slug = 'snacks-bakery'
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
  AND c.slug = 'snacks-bakery'
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
  AND c.slug = 'beverages-drinks'
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
  AND c.slug = 'beverages-drinks'
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
  AND c.slug = 't-shirt'
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
  AND c.slug = 't-shirt'
  AND p.name = 'Graphic T-Shirt – Coding Life'
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
  AND c.slug = 'hoodies-outerwear'
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
  AND c.slug = 'hoodies-outerwear'
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
  AND c.slug = 'keychain'
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
  AND c.slug = 'keychain'
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
  AND c.slug = 'handmade-bags'
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
  AND c.slug = 'handmade-bags'
  AND p.name = 'Mini Woven Handbag'
ON CONFLICT (product_id, sort_order) DO NOTHING;
