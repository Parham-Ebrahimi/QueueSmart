CREATE TABLE IF NOT EXISTS user_credentials (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE CHECK (length(email) BETWEEN 3 AND 254),
  password_hash TEXT NOT NULL CHECK (length(password_hash) BETWEEN 1 AND 255),
  role TEXT NOT NULL CHECK (role IN ('user', 'admin')),
  created_at TEXT NOT NULL
) STRICT;

CREATE TABLE IF NOT EXISTS user_profiles (
  user_id TEXT PRIMARY KEY REFERENCES user_credentials(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL CHECK (length(trim(full_name)) BETWEEN 1 AND 100),
  contact TEXT CHECK (contact IS NULL OR length(contact) <= 100)
) STRICT;
