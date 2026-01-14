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

-- ========= STORE IMAGES: PRIMARY & SORT LOGIC =========
CREATE OR REPLACE FUNCTION store_image_primary_before()
RETURNS TRIGGER AS $$
DECLARE
    cnt INT;
BEGIN
    -- ถ้าเป็น INSERT รูปใหม่ และยังไม่เคยมีรูปใน store นี้เลย
    -- → ให้รูปแรกเป็น primary + sort_order = 1
    IF TG_OP = 'INSERT' THEN
        SELECT COUNT(*) INTO cnt
        FROM store_images
        WHERE store_id = NEW.store_id;

        IF cnt = 0 THEN
            NEW.is_primary := TRUE;
            NEW.sort_order := 1;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_store_image_primary_before ON store_images;
CREATE TRIGGER trg_store_image_primary_before
BEFORE INSERT ON store_images
FOR EACH ROW
EXECUTE FUNCTION store_image_primary_before();


-- ========= PRODUCT IMAGES: PRIMARY & SORT LOGIC =========
CREATE OR REPLACE FUNCTION product_image_primary_before()
RETURNS TRIGGER AS $$
DECLARE
    cnt INT;
BEGIN
    -- รูปแรกของ product → primary + sort_order = 1
    IF TG_OP = 'INSERT' THEN
        SELECT COUNT(*) INTO cnt
        FROM product_images
        WHERE product_id = NEW.product_id;

        IF cnt = 0 THEN
            NEW.is_primary := TRUE;
            NEW.sort_order := 1;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_product_image_primary_before ON product_images;
CREATE TRIGGER trg_product_image_primary_before
BEFORE INSERT ON product_images
FOR EACH ROW
EXECUTE FUNCTION product_image_primary_before();

-- touch thread.updated_at
CREATE OR REPLACE FUNCTION touch_chat_thread_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE order_chat_threads SET updated_at = NOW()
  WHERE thread_id = NEW.thread_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_touch_chat_thread ON order_chat_messages;
CREATE TRIGGER trg_touch_chat_thread
AFTER INSERT ON order_chat_messages
FOR EACH ROW
EXECUTE FUNCTION touch_chat_thread_updated_at();

-- ========= PRODUCT SEARCH TSV TRIGGER =========
CREATE OR REPLACE FUNCTION products_tsv_update()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_tsv :=
    setweight(to_tsvector('simple', COALESCE(NEW.name,'')), 'A')
    || setweight(to_tsvector('simple', COALESCE(NEW.product_desc,'')), 'B');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_products_tsv ON products;
CREATE TRIGGER trg_products_tsv
BEFORE INSERT OR UPDATE OF name, product_desc
ON products
FOR EACH ROW
EXECUTE FUNCTION products_tsv_update();

-- ========= TRIGGER: log เมื่อ status เปลี่ยน =========
CREATE OR REPLACE FUNCTION log_order_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO order_status_history(order_id, old_status, new_status, changed_by, note)
    VALUES (NEW.order_id, OLD.status, NEW.status, NULL, NULL);

    IF NEW.status = 'Cancelled' THEN
      NEW.cancelled_at := NOW();
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_log_order_status_change ON orders;
CREATE TRIGGER trg_log_order_status_change
BEFORE UPDATE OF status ON orders
FOR EACH ROW
EXECUTE FUNCTION log_order_status_change();