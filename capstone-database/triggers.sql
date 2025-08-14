-- email auto lower case 
CREATE OR REPLACE FUNCTION user_email_to_lower()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
	IF NEW.email IS NOT NULL THEN
		NEW.email := lower(NEW.email);
	END IF;
	RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_users_email_lower ON users;
CREATE TRIGGER trg_users_email_lower
BEFORE INSERT OR UPDATE OF email ON users
FOR EACH ROW
EXECUTE FUNCTION user_email_to_lower();

-- TRIGGER FOR AUTO UPDATED
DROP TRIGGER IF EXISTS trg_products_updated ON products;
CREATE TRIGGER trg_products_updated
BEFORE UPDATE ON products
FOR EACH ROW
EXECUTE FUNCTION set_updated_at_if_changed();

-- USERS
DROP TRIGGER IF EXISTS trg_users_updated ON users;
CREATE TRIGGER trg_users_updated
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION set_updated_at_if_changed();

-- STORES
DROP TRIGGER IF EXISTS trg_stores_updated ON stores;
CREATE TRIGGER trg_stores_updated
BEFORE UPDATE ON stores
FOR EACH ROW
EXECUTE FUNCTION set_updated_at_if_changed();

-- PRODUCTS
DROP TRIGGER IF EXISTS trg_products_updated ON products;
CREATE TRIGGER trg_products_updated
BEFORE UPDATE ON products
FOR EACH ROW
EXECUTE FUNCTION set_updated_at_if_changed();

-- CATEGORIES
DROP TRIGGER IF EXISTS trg_categories_updated ON categories;
CREATE TRIGGER trg_categories_updated
BEFORE UPDATE ON categories
FOR EACH ROW
EXECUTE FUNCTION set_updated_at_if_changed();