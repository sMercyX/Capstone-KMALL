DROP INDEX IF EXISTS idx_email;
CREATE INDEX idx_email ON users(email);

DROP INDEX IF EXISTS idx_ms_id;
CREATE INDEX idx_ms_id ON users(kms_id);

DROP INDEX IF EXISTS fk_users_has_roles_roles1_idx;
CREATE INDEX fk_users_has_roles_roles1_idx ON user_roles(role_id);

DROP INDEX IF EXISTS fk_users_has_roles_users_idx;
CREATE INDEX fk_users_has_roles_users_idx ON user_roles(user_id);