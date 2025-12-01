-- re-auto id
-- TRUNCATE TABLE categories RESTART IDENTITY;

-- sql seed roles
INSERT INTO roles (role_name, role_desc) VALUES
('buyer', 'Default role for all users who can purchase products'),
('seller', 'Role for users who can sell products'),
('admin', 'System administrator with full permissions')
ON CONFLICT (role_name) DO NOTHING; 

-- sql seed categories (main)
INSERT INTO categories (name, slug, parent_id, sort_order, is_active)
VALUES
  ('Food', 'food', NULL, 1, 'YES'),
  ('Clothing', 'clothing', NULL, 2, 'YES'),
  ('Handmade Products', 'handmade-products', NULL, 3, 'YES')
ON CONFLICT (slug) DO NOTHING;


-- sql seed subcategories
-- Food: Snacks & Bakery
INSERT INTO categories (name, slug, parent_id, sort_order, is_active)
SELECT 'Snacks & Bakery', 'snacks-bakery', c.category_id, 1, 'YES'
FROM categories c
WHERE c.slug = 'food'
ON CONFLICT (slug) DO NOTHING;

-- Food: Beverages & Drinks
INSERT INTO categories (name, slug, parent_id, sort_order, is_active)
SELECT 'Beverages & Drinks', 'beverages-drinks', c.category_id, 2, 'YES'
FROM categories c
WHERE c.slug = 'food'
ON CONFLICT (slug) DO NOTHING;

-- Clothing: T-Shirt 
INSERT INTO categories (name, slug, parent_id, sort_order, is_active)
SELECT 'T-Shirt', 't-shirt', c.category_id, 1, 'YES'
FROM categories c
WHERE c.slug = 'clothing'
ON CONFLICT (slug) DO NOTHING;

-- Clothing: Hoodies & Outerwear
INSERT INTO categories (name, slug, parent_id, sort_order, is_active)
SELECT 'Hoodies & Outerwear', 'hoodies-outerwear', c.category_id, 2, 'YES'
FROM categories c
WHERE c.slug = 'clothing'
ON CONFLICT (slug) DO NOTHING;

-- Handmade: Keychain
INSERT INTO categories (name, slug, parent_id, sort_order, is_active)
SELECT 'Keychain', 'keychain', c.category_id, 1, 'YES'
FROM categories c
WHERE c.slug = 'handmade-products'
ON CONFLICT (slug) DO NOTHING;

-- Handmade: Handmade Bags
INSERT INTO categories (name, slug, parent_id, sort_order, is_active)
SELECT 'Handmade Bags', 'handmade-bags', c.category_id, 2, 'YES'
FROM categories c
WHERE c.slug = 'handmade-products'
ON CONFLICT (slug) DO NOTHING;
