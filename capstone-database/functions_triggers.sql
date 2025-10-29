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
