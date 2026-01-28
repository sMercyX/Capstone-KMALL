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
-- Food: Single Dish Meals
INSERT INTO categories (name, slug, parent_id, sort_order, is_active)
SELECT 'Single Dish Meals', 'single-dish-meals', c.category_id, 1, 'YES'
FROM categories c
WHERE c.slug = 'food'
ON CONFLICT (slug) DO NOTHING;

-- Food: Snacks & Desserts
INSERT INTO categories (name, slug, parent_id, sort_order, is_active)
SELECT 'Snacks & Desserts', 'snacks-desserts', c.category_id, 2, 'YES'
FROM categories c
WHERE c.slug = 'food'
ON CONFLICT (slug) DO NOTHING;

-- Food: Beverages
INSERT INTO categories (name, slug, parent_id, sort_order, is_active)
SELECT 'Beverages', 'beverages', c.category_id, 3, 'YES'
FROM categories c
WHERE c.slug = 'food'
ON CONFLICT (slug) DO NOTHING;

-- Food: Healthy Food
INSERT INTO categories (name, slug, parent_id, sort_order, is_active)
SELECT 'Healthy Food', 'healthy-food', c.category_id, 4, 'YES'
FROM categories c
WHERE c.slug = 'food'
ON CONFLICT (slug) DO NOTHING;

-- Food: Fruits & Fresh Produce
INSERT INTO categories (name, slug, parent_id, sort_order, is_active)
SELECT 'Fruits & Fresh Produce', 'fruits-fresh-produce', c.category_id, 5, 'YES'
FROM categories c
WHERE c.slug = 'food'
ON CONFLICT (slug) DO NOTHING;

-- Clothing: Tops
INSERT INTO categories (name, slug, parent_id, sort_order, is_active)
SELECT 'Tops', 'tops', c.category_id, 1, 'YES'
FROM categories c
WHERE c.slug = 'clothing'
ON CONFLICT (slug) DO NOTHING;

-- Clothing: Pants
INSERT INTO categories (name, slug, parent_id, sort_order, is_active)
SELECT 'Pants', 'pants', c.category_id, 2, 'YES'
FROM categories c
WHERE c.slug = 'clothing'
ON CONFLICT (slug) DO NOTHING;

-- Clothing: Skirts & Dresses
INSERT INTO categories (name, slug, parent_id, sort_order, is_active)
SELECT 'Skirts & Dresses', 'skirts-dresses', c.category_id, 3, 'YES'
FROM categories c
WHERE c.slug = 'clothing'
ON CONFLICT (slug) DO NOTHING;

-- Clothing: Outerwear & Jackets
INSERT INTO categories (name, slug, parent_id, sort_order, is_active)
SELECT 'Outerwear & Jackets', 'outerwear-jackets', c.category_id, 4, 'YES'
FROM categories c
WHERE c.slug = 'clothing'
ON CONFLICT (slug) DO NOTHING;

-- Clothing: Unisex Clothing
INSERT INTO categories (name, slug, parent_id, sort_order, is_active)
SELECT 'Unisex Clothing', 'unisex-clothing', c.category_id, 5, 'YES'
FROM categories c
WHERE c.slug = 'clothing'
ON CONFLICT (slug) DO NOTHING;

-- Clothing: Second-hand & Vintage
INSERT INTO categories (name, slug, parent_id, sort_order, is_active)
SELECT 'Second-hand & Vintage', 'secondhand-vintage', c.category_id, 6, 'YES'
FROM categories c
WHERE c.slug = 'clothing'
ON CONFLICT (slug) DO NOTHING;

-- Clothing: University Uniforms
INSERT INTO categories (name, slug, parent_id, sort_order, is_active)
SELECT 'University Uniforms', 'university-uniforms', c.category_id, 7, 'YES'
FROM categories c
WHERE c.slug = 'clothing'
ON CONFLICT (slug) DO NOTHING;

-- Handmade: Accessories
INSERT INTO categories (name, slug, parent_id, sort_order, is_active)
SELECT 'Accessories', 'accessories', c.category_id, 1, 'YES'
FROM categories c
WHERE c.slug = 'handmade-products'
ON CONFLICT (slug) DO NOTHING;

-- Handmade: Art & Artwork
INSERT INTO categories (name, slug, parent_id, sort_order, is_active)
SELECT 'Art & Artwork', 'art-artwork', c.category_id, 2, 'YES'
FROM categories c
WHERE c.slug = 'handmade-products'
ON CONFLICT (slug) DO NOTHING;

-- Handmade: Home & Decor
INSERT INTO categories (name, slug, parent_id, sort_order, is_active)
SELECT 'Home & Decor', 'home-decor', c.category_id, 3, 'YES'
FROM categories c
WHERE c.slug = 'handmade-products'
ON CONFLICT (slug) DO NOTHING;

-- Handmade: Textile & Knitting
INSERT INTO categories (name, slug, parent_id, sort_order, is_active)
SELECT 'Textile & Knitting', 'textile-knitting', c.category_id, 4, 'YES'
FROM categories c
WHERE c.slug = 'handmade-products'
ON CONFLICT (slug) DO NOTHING;

-- Handmade: Keychains
INSERT INTO categories (name, slug, parent_id, sort_order, is_active)
SELECT 'Keychains', 'keychains', c.category_id, 5, 'YES'
FROM categories c
WHERE c.slug = 'handmade-products'
ON CONFLICT (slug) DO NOTHING;

-- Handmade: Gifts & Custom Orders
INSERT INTO categories (name, slug, parent_id, sort_order, is_active)
SELECT 'Gifts & Custom Orders', 'gifts-custom-orders', c.category_id, 6, 'YES'
FROM categories c
WHERE c.slug = 'handmade-products'
ON CONFLICT (slug) DO NOTHING;


-- ========= SEED CAMPUS LOCATIONS (KMUTT) =========

INSERT INTO campus_locations (name, area, latitude, longitude)
VALUES
-- ===== Central / Common Places =====
('KMUTT Main Gate', 'Central', 13.6518000, 100.4949000),
('King Mongkut Memorial Building', 'Central', 13.6522000, 100.4954000),
('Central Canteen', 'Central', 13.6526000, 100.4959000),
('University Library', 'Central', 13.6530000, 100.4963000),

-- ===== Academic Buildings (Zone A / Blue) =====
('Engineering Building', 'Zone A', 13.6519000, 100.4968000),
('Chemical Engineering Building', 'Zone A', 13.6523000, 100.4971000),
('Mechanical Engineering Building', 'Zone A', 13.6527000, 100.4973000),
('Production Engineering Building', 'Zone A', 13.6531000, 100.4976000),

-- ===== Science & IT (Zone C / Green) =====
('Science Laboratory Building', 'Zone C', 13.6535000, 100.4981000),
('School of Information Technology', 'Zone C', 13.6539000, 100.4984000),
('Department of Mathematics', 'Zone C', 13.6537000, 100.4979000),
('Department of Physics', 'Zone C', 13.6533000, 100.4975000),

-- ===== Student Facilities =====
('Dormitory (Male)', 'Residence', 13.6514000, 100.4953000),
('Dormitory (Female)', 'Residence', 13.6512000, 100.4957000),
('Sports Complex', 'Facilities', 13.6529000, 100.4969000),
('Football Field', 'Facilities', 13.6532000, 100.4966000),

-- ===== Shops & Services =====
('Cooperative Store', 'Services', 13.6524000, 100.4962000),
('7-Eleven KMUTT', 'Services', 13.6525000, 100.4965000),
('Health Care Center', 'Services', 13.6528000, 100.4961000)

ON CONFLICT (name) DO NOTHING;

