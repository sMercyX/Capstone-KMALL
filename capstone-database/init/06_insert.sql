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
  ('Clothing', 'clothing', NULL, 1, 'YES'),
  ('Handmade Products', 'handmade-products', NULL, 1, 'YES')
ON CONFLICT (slug) DO NOTHING;


-- sql seed subcategories
-- Food: Single Dish Meals
INSERT INTO categories (name, slug, parent_id, sort_order, is_active)
SELECT 'Single Dish Meals', 'single-dish-meals', c.category_id, 2, 'YES'
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
SELECT 'Beverages', 'beverages', c.category_id, 2, 'YES'
FROM categories c
WHERE c.slug = 'food'
ON CONFLICT (slug) DO NOTHING;

-- Food: Healthy Food
INSERT INTO categories (name, slug, parent_id, sort_order, is_active)
SELECT 'Healthy Food', 'healthy-food', c.category_id, 2, 'YES'
FROM categories c
WHERE c.slug = 'food'
ON CONFLICT (slug) DO NOTHING;

-- Food: Fruits & Fresh Produce
INSERT INTO categories (name, slug, parent_id, sort_order, is_active)
SELECT 'Fruits & Fresh Produce', 'fruits-fresh-produce', c.category_id, 2, 'YES'
FROM categories c
WHERE c.slug = 'food'
ON CONFLICT (slug) DO NOTHING;

-- Clothing: Tops
INSERT INTO categories (name, slug, parent_id, sort_order, is_active)
SELECT 'Tops', 'tops', c.category_id, 2, 'YES'
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
SELECT 'Skirts & Dresses', 'skirts-dresses', c.category_id, 2, 'YES'
FROM categories c
WHERE c.slug = 'clothing'
ON CONFLICT (slug) DO NOTHING;

-- Clothing: Outerwear & Jackets
INSERT INTO categories (name, slug, parent_id, sort_order, is_active)
SELECT 'Outerwear & Jackets', 'outerwear-jackets', c.category_id, 2, 'YES'
FROM categories c
WHERE c.slug = 'clothing'
ON CONFLICT (slug) DO NOTHING;

-- Clothing: Unisex Clothing
INSERT INTO categories (name, slug, parent_id, sort_order, is_active)
SELECT 'Unisex Clothing', 'unisex-clothing', c.category_id, 2, 'YES'
FROM categories c
WHERE c.slug = 'clothing'
ON CONFLICT (slug) DO NOTHING;

-- Clothing: Second-hand & Vintage
INSERT INTO categories (name, slug, parent_id, sort_order, is_active)
SELECT 'Second-hand & Vintage', 'secondhand-vintage', c.category_id, 2, 'YES'
FROM categories c
WHERE c.slug = 'clothing'
ON CONFLICT (slug) DO NOTHING;

-- Clothing: University Uniforms
INSERT INTO categories (name, slug, parent_id, sort_order, is_active)
SELECT 'University Uniforms', 'university-uniforms', c.category_id, 2, 'YES'
FROM categories c
WHERE c.slug = 'clothing'
ON CONFLICT (slug) DO NOTHING;

-- Handmade: Accessories
INSERT INTO categories (name, slug, parent_id, sort_order, is_active)
SELECT 'Accessories', 'accessories', c.category_id, 2, 'YES'
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
SELECT 'Home & Decor', 'home-decor', c.category_id, 2, 'YES'
FROM categories c
WHERE c.slug = 'handmade-products'
ON CONFLICT (slug) DO NOTHING;

-- Handmade: Textile & Knitting
INSERT INTO categories (name, slug, parent_id, sort_order, is_active)
SELECT 'Textile & Knitting', 'textile-knitting', c.category_id, 2, 'YES'
FROM categories c
WHERE c.slug = 'handmade-products'
ON CONFLICT (slug) DO NOTHING;

-- Handmade: Keychains
INSERT INTO categories (name, slug, parent_id, sort_order, is_active)
SELECT 'Keychains', 'keychains', c.category_id, 2, 'YES'
FROM categories c
WHERE c.slug = 'handmade-products'
ON CONFLICT (slug) DO NOTHING;

-- Handmade: Gifts & Custom Orders
INSERT INTO categories (name, slug, parent_id, sort_order, is_active)
SELECT 'Gifts & Custom Orders', 'gifts-custom-orders', c.category_id, 2, 'YES'
FROM categories c
WHERE c.slug = 'handmade-products'
ON CONFLICT (slug) DO NOTHING;

-- ========= SEED CAMPUS LOCATIONS (KMUTT Bangmod) =========
INSERT INTO campus_locations (name, zone, latitude, longitude)
VALUES

-- ===== Zone North : (N) =====
('Fundamental Science Laboratory Building (N7)', 'North', 13.65368, 100.4944344),
('KMUTT Library Building (N10)', 'North', 13.652958, 100.4940106),
('Learning Exchange Building (N16)', 'North', 13.6519389, 100.4936271),
('Classroom Building 2 (N17)', 'North', 13.6514984, 100.4934976),
('Classroom Building 1 (N20)', 'North', 13.6515062, 100.4933401),

-- ===== Zone South : (S) =====
('Car Parking Building (S2)', 'South', 13.6503766, 100.4957025),
('Engineering Building : Wissava Wattana Building (S4)', 'South', 13.650462, 100.4932134),
('Dhammaraksa Residence Hall 1 : Female Dormitory (S6)', 'South', 13.6490206, 100.4948737),
('Classroom Building 4 (S12)', 'South', 13.6496957, 100.4925187),
('King Mongkut’s 190th Anniversary Memorial Building (S14)', 'South', 13.6508164, 100.4917476)

-- -- ===== Central / Common (Green area, landmark) =====
-- ('KMUTT Main Gate', 'Central', 13.6518000, 100.4949000),
-- ('King Mongkut Memorial Building', 'Central', 13.6522000, 100.4954000),
-- ('Central Canteen', 'Central', 13.6526000, 100.4959000),
-- ('University Library (N10)', 'Central', 13.6530000, 100.4963000),

-- -- ===== Zone A : Engineering / Production (ORANGE) =====
-- ('Mechanical Engineering Building (S1)', 'Zone A', 13.6527000, 100.4973000),
-- ('Engineering Building (S4)', 'Zone A', 13.6522000, 100.4969000),
-- ('Production Engineering Lab 4 (N18)', 'Zone A', 13.6531000, 100.4976000),
-- ('Chemical Engineering Building (S15)', 'Zone A', 13.6523000, 100.4971000),
-- ('Foundry Engineering Laboratory', 'Zone A', 13.6519000, 100.4968000),

-- -- ===== Zone B : Science / IT / Classroom (YELLOW) =====
-- ('School of Information Technology (N11)', 'Zone B', 13.6539000, 100.4984000),
-- ('Department of Mathematics (N3)', 'Zone B', 13.6537000, 100.4979000),
-- ('Department of Physics (N4)', 'Zone B', 13.6533000, 100.4975000),
-- ('Science Laboratory Building (N7)', 'Zone B', 13.6535000, 100.4981000),
-- ('Classroom Building 1 (N20)', 'Zone B', 13.6532000, 100.4972000),

-- -- ===== Facilities / Sports (GREEN) =====
-- ('Sports Complex', 'Facilities', 13.6529000, 100.4969000),
-- ('Football Field', 'Facilities', 13.6532000, 100.4966000),
-- ('Commemoration Park', 'Facilities', 13.6530000, 100.4960000),

-- -- ===== Residence =====
-- ('Dormitory (Male)', 'Residence', 13.6514000, 100.4953000),
-- ('Dormitory (Female)', 'Residence', 13.6512000, 100.4957000),

-- -- ===== Services / Shops =====
-- ('Cooperative Store (U Store)', 'Services', 13.6524000, 100.4962000),
-- ('7-Eleven KMUTT', 'Services', 13.6525000, 100.4965000),
-- ('Health Care Center', 'Services', 13.6528000, 100.4961000)

ON CONFLICT (name) DO NOTHING;

