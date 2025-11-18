-- DEV USERS
INSERT INTO users (user_id, kms_id, email, display_name)
VALUES
  ('00000000-0000-0000-0000-000000000001', 'dev-admin-1',  'admin1@example.com',  'Dev Admin 1'),
  ('00000000-0000-0000-0000-000000000002', 'dev-seller-1', 'seller1@example.com', 'Dev Seller 1'),
  ('00000000-0000-0000-0000-000000000003', 'dev-buyer-1',  'buyer1@example.com',  'Dev Buyer 1')
ON CONFLICT (kms_id) DO NOTHING;

-- DEV USER ROLES
INSERT INTO user_roles (user_id, role_id)
SELECT u.user_id, r.role_id
FROM users u, roles r
WHERE u.kms_id = 'dev-admin-1' AND r.role_name = 'admin'
ON CONFLICT DO NOTHING;

INSERT INTO user_roles (user_id, role_id)
SELECT u.user_id, r.role_id
FROM users u, roles r
WHERE u.kms_id = 'dev-seller-1' AND r.role_name = 'seller'
ON CONFLICT DO NOTHING;

INSERT INTO user_roles (user_id, role_id)
SELECT u.user_id, r.role_id
FROM users u, roles r
WHERE u.kms_id = 'dev-buyer-1' AND r.role_name = 'buyer'
ON CONFLICT DO NOTHING;


-- DEV STORE for dev-seller-1
INSERT INTO stores (store_name, store_desc, profile_url, is_active, user_id)
SELECT
  'Dev Seller Store',
  'Sample store for seeded demo products',
  NULL,
  'YES',
  u.user_id
FROM users u
WHERE u.kms_id = 'dev-seller-1'
  AND NOT EXISTS (
    SELECT 1 FROM stores s WHERE s.store_name = 'Dev Seller Store'
  );


-- ========= DEV PRODUCTS (Snacks & Bakery) =========
INSERT INTO products (name, product_desc, price, image_url, is_active, store_id, category_id)
SELECT
  'Chocolate Brownie',
  'Fudgy chocolate brownie, perfect for an afternoon snack.',
  35.00,
  NULL,
  'YES',
  (SELECT store_id FROM stores WHERE store_name = 'Dev Seller Store' LIMIT 1),
  (SELECT category_id FROM categories WHERE slug = 'snacks-bakery' LIMIT 1)
UNION ALL
SELECT
  'Butter Croissant',
  'Flaky butter croissant, freshly baked every morning.',
  40.00,
  NULL,
  'YES',
  (SELECT store_id FROM stores WHERE store_name = 'Dev Seller Store' LIMIT 1),
  (SELECT category_id FROM categories WHERE slug = 'snacks-bakery' LIMIT 1)
UNION ALL
SELECT
  'Chocolate Chip Cookies',
  'Crispy outside, chewy inside, full of chocolate chips.',
  25.00,
  NULL,
  'YES',
  (SELECT store_id FROM stores WHERE store_name = 'Dev Seller Store' LIMIT 1),
  (SELECT category_id FROM categories WHERE slug = 'snacks-bakery' LIMIT 1)
UNION ALL
SELECT
  'Mini Cupcakes Set',
  'Set of 6 mini cupcakes with assorted flavors.',
  65.00,
  NULL,
  'YES',
  (SELECT store_id FROM stores WHERE store_name = 'Dev Seller Store' LIMIT 1),
  (SELECT category_id FROM categories WHERE slug = 'snacks-bakery' LIMIT 1);


-- ========= DEV PRODUCTS (T-Shirt) =========
INSERT INTO products (name, product_desc, price, image_url, is_active, store_id, category_id)
SELECT
  'KMALL White T-Shirt',
  'Basic white T-shirt with KMALL logo, unisex.',
  199.00,
  NULL,
  'YES',
  (SELECT store_id FROM stores WHERE store_name = 'Dev Seller Store' LIMIT 1),
  (SELECT category_id FROM categories WHERE slug = 't-shirt' LIMIT 1)
UNION ALL
SELECT
  'Black Oversized T-Shirt',
  'Oversized black tee, soft cotton, casual style.',
  249.00,
  NULL,
  'YES',
  (SELECT store_id FROM stores WHERE store_name = 'Dev Seller Store' LIMIT 1),
  (SELECT category_id FROM categories WHERE slug = 't-shirt' LIMIT 1)
UNION ALL
SELECT
  'Graphic T-Shirt – Coding Life',
  'T-shirt with “Eat Sleep Code Repeat” graphic print.',
  220.00,
  NULL,
  'YES',
  (SELECT store_id FROM stores WHERE store_name = 'Dev Seller Store' LIMIT 1),
  (SELECT category_id FROM categories WHERE slug = 't-shirt' LIMIT 1)
UNION ALL
SELECT
  'KMUTT Orange T-Shirt',
  'University-themed T-shirt in KMUTT orange tone.',
  230.00,
  NULL,
  'YES',
  (SELECT store_id FROM stores WHERE store_name = 'Dev Seller Store' LIMIT 1),
  (SELECT category_id FROM categories WHERE slug = 't-shirt' LIMIT 1);


-- ========= DEV PRODUCTS (Keychain) =========
INSERT INTO products (name, product_desc, price, image_url, is_active, store_id, category_id)
SELECT
  'Acrylic Keychain – KMALL Logo',
  'Clear acrylic keychain with KMALL logo, lightweight and durable.',
  49.00,
  NULL,
  'YES',
  (SELECT store_id FROM stores WHERE store_name = 'Dev Seller Store' LIMIT 1),
  (SELECT category_id FROM categories WHERE slug = 'keychain' LIMIT 1)
UNION ALL
SELECT
  'Wooden Keychain – Local Craft',
  'Handmade wooden keychain inspired by local Thai craft.',
  59.00,
  NULL,
  'YES',
  (SELECT store_id FROM stores WHERE store_name = 'Dev Seller Store' LIMIT 1),
  (SELECT category_id FROM categories WHERE slug = 'keychain' LIMIT 1)
UNION ALL
SELECT
  'Character Keychain – Cute Cat',
  'Soft rubber keychain in cute cat character design.',
  39.00,
  NULL,
  'YES',
  (SELECT store_id FROM stores WHERE store_name = 'Dev Seller Store' LIMIT 1),
  (SELECT category_id FROM categories WHERE slug = 'keychain' LIMIT 1)
UNION ALL
SELECT
  'Name Tag Keychain – Custom Text',
  'Customizable keychain with engraved name tag.',
  79.00,
  NULL,
  'YES',
  (SELECT store_id FROM stores WHERE store_name = 'Dev Seller Store' LIMIT 1),
  (SELECT category_id FROM categories WHERE slug = 'keychain' LIMIT 1);
