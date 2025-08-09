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