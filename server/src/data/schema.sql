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

CREATE TABLE IF NOT EXISTS services (
  service_id TEXT PRIMARY KEY CHECK (
    length(service_id) BETWEEN 1 AND 100
    AND substr(service_id, 1, 1) GLOB '[A-Za-z0-9]'
    AND service_id NOT GLOB '*[^A-Za-z0-9_-]*'
  ),
  name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 100),
  description TEXT NOT NULL CHECK (length(trim(description)) BETWEEN 1 AND 500),
  expected_duration INTEGER NOT NULL CHECK (expected_duration BETWEEN 1 AND 480),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  category TEXT NOT NULL DEFAULT '' CHECK (length(category) <= 40),
  location TEXT NOT NULL DEFAULT '' CHECK (length(location) <= 120),
  open_until TEXT NOT NULL DEFAULT '5:00 PM' CHECK (
    open_until GLOB '[1-9]:[0-5][0-9] [APap][Mm]'
    OR open_until GLOB '[1-9]:[0-5][0-9][APap][Mm]'
    OR open_until GLOB '1[0-2]:[0-5][0-9] [APap][Mm]'
    OR open_until GLOB '1[0-2]:[0-5][0-9][APap][Mm]'
  ),
  is_open INTEGER NOT NULL DEFAULT 1 CHECK (is_open IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
) STRICT;

CREATE TRIGGER IF NOT EXISTS services_validate_insert
BEFORE INSERT ON services
WHEN length(NEW.service_id) NOT BETWEEN 1 AND 100
  OR substr(NEW.service_id, 1, 1) NOT GLOB '[A-Za-z0-9]'
  OR NEW.service_id GLOB '*[^A-Za-z0-9_-]*'
  OR length(trim(NEW.name)) NOT BETWEEN 1 AND 100
  OR NEW.description IS NULL
  OR length(trim(NEW.description)) NOT BETWEEN 1 AND 500
  OR typeof(NEW.expected_duration) != 'integer'
  OR NEW.expected_duration NOT BETWEEN 1 AND 480
  OR NEW.priority NOT IN ('low', 'medium', 'high')
  OR length(NEW.category) > 40
  OR length(NEW.location) > 120
  OR NOT (
    NEW.open_until GLOB '[1-9]:[0-5][0-9] [APap][Mm]'
    OR NEW.open_until GLOB '[1-9]:[0-5][0-9][APap][Mm]'
    OR NEW.open_until GLOB '1[0-2]:[0-5][0-9] [APap][Mm]'
    OR NEW.open_until GLOB '1[0-2]:[0-5][0-9][APap][Mm]'
  )
  OR NEW.is_open NOT IN (0, 1)
BEGIN
  SELECT RAISE(ABORT, 'Service data does not satisfy its required constraints.');
END;

CREATE TRIGGER IF NOT EXISTS services_validate_update
BEFORE UPDATE ON services
WHEN length(NEW.service_id) NOT BETWEEN 1 AND 100
  OR substr(NEW.service_id, 1, 1) NOT GLOB '[A-Za-z0-9]'
  OR NEW.service_id GLOB '*[^A-Za-z0-9_-]*'
  OR length(trim(NEW.name)) NOT BETWEEN 1 AND 100
  OR NEW.description IS NULL
  OR length(trim(NEW.description)) NOT BETWEEN 1 AND 500
  OR typeof(NEW.expected_duration) != 'integer'
  OR NEW.expected_duration NOT BETWEEN 1 AND 480
  OR NEW.priority NOT IN ('low', 'medium', 'high')
  OR length(NEW.category) > 40
  OR length(NEW.location) > 120
  OR NOT (
    NEW.open_until GLOB '[1-9]:[0-5][0-9] [APap][Mm]'
    OR NEW.open_until GLOB '[1-9]:[0-5][0-9][APap][Mm]'
    OR NEW.open_until GLOB '1[0-2]:[0-5][0-9] [APap][Mm]'
    OR NEW.open_until GLOB '1[0-2]:[0-5][0-9][APap][Mm]'
  )
  OR NEW.is_open NOT IN (0, 1)
BEGIN
  SELECT RAISE(ABORT, 'Service data does not satisfy its required constraints.');
END;
