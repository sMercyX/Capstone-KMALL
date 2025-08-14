-- สมมติว่ามีตาราง roles และ user_roles ตามที่คุยกัน
-- เพิ่ม trigger: ผู้ใช้ใหม่จะถูกผูก role 'buyer' อัตโนมัติ

CREATE OR REPLACE FUNCTION add_default_buyer_role()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_buyer_id INT;
BEGIN
  SELECT id INTO v_buyer_id FROM roles WHERE role_name = 'buyer';
  IF v_buyer_id IS NULL THEN
    RAISE EXCEPTION 'Role "buyer" not found in roles table';
  END IF;

  INSERT INTO user_roles(user_id, role_id)
  VALUES (NEW.id, v_buyer_id)
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_users_default_buyer ON users;
CREATE TRIGGER trg_users_default_buyer
AFTER INSERT ON users
FOR EACH ROW EXECUTE FUNCTION add_default_buyer_role();







