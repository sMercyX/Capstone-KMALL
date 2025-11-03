-- สร้าง role ตัวอย่าง
INSERT INTO roles (role_name, role_desc) VALUES
('buyer', 'Default role for all users who can purchase products'),
('seller', 'Role for users who can sell products'),
('admin', 'System administrator with full permissions')
ON CONFLICT (role_name) DO NOTHING; 

-- ===== USERS =====
INSERT INTO users (ms_id, email, display_name, profile_url)
VALUES
  ('ms_0001', 'alice@kmutt.ac.th', 'Alice Wong', 'https://example.com/u/alice'),
  ('ms_0002', 'bob@kmutt.ac.th',   'Bob Chan',   'https://example.com/u/bob'),
  ('ms_0003', 'cindy@kmutt.ac.th', 'Cindy Lee',  'https://example.com/u/cindy')
ON CONFLICT DO NOTHING;

-- ===== USER ROLES (mapping) =====
-- Alice = admin + seller
INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id
FROM users u CROSS JOIN roles r
WHERE u.email='alice@kmutt.ac.th' AND r.role_name IN ('admin','seller')
ON CONFLICT DO NOTHING;

-- Bob = seller
INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id
FROM users u JOIN roles r ON r.role_name='seller'
WHERE u.email='bob@kmutt.ac.th'
ON CONFLICT DO NOTHING;

-- Cindy = buyer
INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id
FROM users u JOIN roles r ON r.role_name='buyer'
WHERE u.email='cindy@kmutt.ac.th'
ON CONFLICT DO NOTHING;

-- ===== STORES =====
INSERT INTO stores (store_name, store_desc, profile_url, user_id)
VALUES
  ('Alice Bakery', 'Homemade desserts & ice cream', 'https://example.com/s/alice-bakery',
    (SELECT id FROM users WHERE email='alice@kmutt.ac.th')),
  ('Bob Apparel',  'Basics and campus clothing',    'https://example.com/s/bob-apparel',
    (SELECT id FROM users WHERE email='bob@kmutt.ac.th'))
ON CONFLICT DO NOTHING;

-- ===== CATEGORIES (hierarchy) =====
-- Top level
INSERT INTO categories (name, slug, parent_id, sort_order)
VALUES
  ('Food',  'food',  NULL, 0),
  ('Cloth', 'cloth', NULL, 1)
ON CONFLICT DO NOTHING;

-- Second level under Food
INSERT INTO categories (name, slug, parent_id, sort_order)
SELECT 'Dessert', 'dessert', c.id, 0
FROM categories c WHERE c.slug='food'
ON CONFLICT DO NOTHING;

-- Third level under Dessert
INSERT INTO categories (name, slug, parent_id, sort_order)
SELECT 'Ice Cream', 'ice-cream', c.id, 0
FROM categories c WHERE c.slug='dessert'
ON CONFLICT DO NOTHING;

INSERT INTO categories (name, slug, parent_id, sort_order)
SELECT 'Mochi', 'mochi', c.id, 1
FROM categories c WHERE c.slug='dessert'
ON CONFLICT DO NOTHING;

-- ===== PRODUCTS =====
-- Alice Bakery products
INSERT INTO products (name, product_desc, price, stock, image_url, stores_id, categories_id)
VALUES
  (
    'Vanilla Ice Cream',
    'Classic vanilla, 473ml pint',
    59.00, 100, 'https://pics.example.com/ice-vanilla.jpg',
    (SELECT s.id FROM stores s WHERE s.store_name='Alice Bakery'),
    (SELECT c.id FROM categories c WHERE c.slug='ice-cream')
  ),
  (
    'Matcha Mochi',
    'Chewy mochi with matcha filling',
    45.00, 80, 'https://pics.example.com/mochi-matcha.jpg',
    (SELECT s.id FROM stores s WHERE s.store_name='Alice Bakery'),
    (SELECT c.id FROM categories c WHERE c.slug='mochi')
  )
ON CONFLICT DO NOTHING;

-- Bob Apparel products
INSERT INTO products (name, product_desc, price, stock, image_url, stores_id, categories_id)
VALUES
  (
    'Basic T-Shirt',
    'Unisex cotton tee, sizes S-XL',
    199.00, 50, 'https://pics.example.com/tee-basic.jpg',
    (SELECT s.id FROM stores s WHERE s.store_name='Bob Apparel'),
    (SELECT c.id FROM categories c WHERE c.slug='cloth')
  )
ON CONFLICT DO NOTHING;
