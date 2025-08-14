CREATE TABLE IF NOT EXISTS users (
	id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
	ms_id TEXT UNIQUE NOT NULL,
	email TEXT UNIQUE NOT NULL,
	display_name TEXT NOT NULL,
	profile_url TEXT,
	created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
	last_login TIMESTAMPTZ,

	CONSTRAINT chk_email_kmutt CHECK (email ~* '^[A-Z0-9._%+\-]+@kmutt\.ac\.th$')
);

CREATE TABLE IF NOT EXISTS roles (
	id SERIAL PRIMARY KEY,
	role_name TEXT NOT NULL UNIQUE,
	description TEXT,
	created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT  EXISTS user_roles (
	user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
	role_id INT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
	created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
	PRIMARY KEY (user_id, role_id)
);
