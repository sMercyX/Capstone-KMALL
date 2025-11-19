-- Function to convert email to lowercase
CREATE OR REPLACE FUNCTION user_email_to_lower()
RETURNS trigger LANGUAGE plpgsql AS $$ 
BEGIN
    IF NEW.email IS NOT NULL THEN
        NEW.email := lower(NEW.email);
    END IF;
    RETURN NEW;
END $$;

-- Trigger to convert email to lowercase before insert or update
DROP TRIGGER IF EXISTS trg_users_email_lower ON users;
CREATE TRIGGER trg_users_email_lower
BEFORE INSERT OR UPDATE OF email ON users
FOR EACH ROW
EXECUTE FUNCTION user_email_to_lower();

-- Function to update updated_at when email or display_name changes
CREATE OR REPLACE FUNCTION update_updated_at_on_change()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.email <> OLD.email OR NEW.display_name <> OLD.display_name THEN
        NEW.updated_at = CURRENT_TIMESTAMP;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update updated_at when email or display_name changes
DROP TRIGGER IF EXISTS trg_update_updated_at ON users;
CREATE TRIGGER trg_update_updated_at
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_on_change();

-- Function to retrieve user by email
CREATE OR REPLACE FUNCTION get_user_by_email(email_input VARCHAR)
RETURNS TABLE(user_id UUID, kms_id VARCHAR, email VARCHAR, display_name VARCHAR, created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ, last_login TIMESTAMPTZ) AS $$
BEGIN
    RETURN QUERY 
    SELECT user_id, kms_id, email, display_name, created_at, updated_at, last_login
    FROM users
    WHERE email = email_input;
END;
$$ LANGUAGE plpgsql;

-- Function to update updated_at when data changes
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update updated_at when data in stores table changes
DROP TRIGGER IF EXISTS trg_update_updated_at ON stores;
CREATE TRIGGER trg_update_updated_at
BEFORE UPDATE ON stores
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();

-- Trigger to update updated_at when data in categories table changes
DROP TRIGGER IF EXISTS trg_update_updated_at ON categories;
CREATE TRIGGER trg_update_updated_at
BEFORE UPDATE ON categories
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();

-- Trigger to update updated_at when data in products table changes
DROP TRIGGER IF EXISTS trg_update_updated_at ON products;
CREATE TRIGGER trg_update_updated_at
BEFORE UPDATE ON products
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();

-- Trigger to update updated_at when data in orders table changes
DROP TRIGGER IF EXISTS trg_update_updated_at ON orders;
CREATE TRIGGER trg_update_updated_at
BEFORE UPDATE ON orders
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();

-- Function to update update_order_updated_at when data in orders table changes related to order_items
CREATE OR REPLACE FUNCTION update_order_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE orders
  SET updated_at = CURRENT_TIMESTAMP
  WHERE order_id = NEW.order_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update update_order_updated_at when data in order_items table changes
DROP TRIGGER IF EXISTS trg_update_order_updated_at ON order_items;
CREATE TRIGGER trg_update_order_updated_at
AFTER UPDATE ON order_items
FOR EACH ROW
EXECUTE FUNCTION update_order_updated_at();

-- Trigger to update updated_at when data in carts table changes
DROP TRIGGER IF EXISTS trg_update_updated_at ON carts;
CREATE TRIGGER trg_update_updated_at
BEFORE UPDATE ON carts
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();

-- Function to update update_cart_updated_at when data in orders table changes related to cart_items
CREATE OR REPLACE FUNCTION update_cart_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE carts
  SET updated_at = CURRENT_TIMESTAMP
  WHERE cart_id = NEW.cart_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update update_cart_updated_at when data in cart_items table changes
DROP TRIGGER IF EXISTS trg_update_cart_updated_at ON cart_items;
CREATE TRIGGER trg_update_cart_updated_at
AFTER UPDATE ON cart_items
FOR EACH ROW
EXECUTE FUNCTION update_cart_updated_at();

DROP TRIGGER IF EXISTS trg_update_updated_at ON store_images;
CREATE TRIGGER trg_update_updated_at
BEFORE UPDATE ON store_images
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_update_updated_at ON product_images;
CREATE TRIGGER trg_update_updated_at
BEFORE UPDATE ON product_images
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();


-- Function: sync product primary image into products.image_url
CREATE OR REPLACE FUNCTION sync_product_primary_image()
RETURNS TRIGGER AS $$
DECLARE
    new_primary_url TEXT;
    pid INT;
BEGIN
    -- Determine product_id
    IF TG_OP = 'DELETE' THEN
        pid := OLD.product_id;
    ELSE
        pid := NEW.product_id;
    END IF;

    -- Find primary image for this product
    SELECT image_url
    INTO new_primary_url
    FROM product_images
    WHERE product_id = pid
      AND is_primary = TRUE
    ORDER BY sort_order ASC
    LIMIT 1;

    -- Update products.image_url (NULL if no primary found)
    UPDATE products
    SET image_url = new_primary_url,
        updated_at = NOW()
    WHERE product_id = pid;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- AFTER INSERT
DROP TRIGGER IF EXISTS trg_product_image_insert ON product_images;
CREATE TRIGGER trg_product_image_insert
AFTER INSERT ON product_images
FOR EACH ROW
EXECUTE FUNCTION sync_product_primary_image();

-- AFTER UPDATE
DROP TRIGGER IF EXISTS trg_product_image_update ON product_images;
CREATE TRIGGER trg_product_image_update
AFTER UPDATE OF is_primary, image_url, sort_order ON product_images
FOR EACH ROW
EXECUTE FUNCTION sync_product_primary_image();

-- AFTER DELETE
DROP TRIGGER IF EXISTS trg_product_image_delete ON product_images;
CREATE TRIGGER trg_product_image_delete
AFTER DELETE ON product_images
FOR EACH ROW
EXECUTE FUNCTION sync_product_primary_image();

-- Function: sync store primary image into stores.profile_url
CREATE OR REPLACE FUNCTION sync_store_primary_image()
RETURNS TRIGGER AS $$
DECLARE
    new_primary_url TEXT;
    sid INT;
BEGIN
    -- Determine store_id
    IF TG_OP = 'DELETE' THEN
        sid := OLD.store_id;
    ELSE
        sid := NEW.store_id;
    END IF;

    -- Find primary image for this store
    SELECT image_url
    INTO new_primary_url
    FROM store_images
    WHERE store_id = sid
      AND is_primary = TRUE
    ORDER BY sort_order ASC
    LIMIT 1;

    -- Update stores.profile_url
    UPDATE stores
    SET profile_url = new_primary_url,
        updated_at = NOW()
    WHERE store_id = sid;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- AFTER INSERT
DROP TRIGGER IF EXISTS trg_store_image_insert ON store_images;
CREATE TRIGGER trg_store_image_insert
AFTER INSERT ON store_images
FOR EACH ROW
EXECUTE FUNCTION sync_store_primary_image();

-- AFTER UPDATE
DROP TRIGGER IF EXISTS trg_store_image_update ON store_images;
CREATE TRIGGER trg_store_image_update
AFTER UPDATE OF is_primary, image_url, sort_order ON store_images
FOR EACH ROW
EXECUTE FUNCTION sync_store_primary_image();

-- AFTER DELETE
DROP TRIGGER IF EXISTS trg_store_image_delete ON store_images;
CREATE TRIGGER trg_store_image_delete
AFTER DELETE ON store_images
FOR EACH ROW
EXECUTE FUNCTION sync_store_primary_image();
