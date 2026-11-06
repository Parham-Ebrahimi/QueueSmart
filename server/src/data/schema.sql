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

-- One queue per service. The triggers below create it with the service, keep its status in step
-- with services.is_open, and the foreign key removes it when the service is deleted.
CREATE TABLE IF NOT EXISTS queues (
  queue_id TEXT PRIMARY KEY,
  service_id TEXT NOT NULL UNIQUE REFERENCES services(service_id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
) STRICT;

CREATE TRIGGER IF NOT EXISTS services_create_queue
AFTER INSERT ON services
BEGIN
  INSERT INTO queues (queue_id, service_id, status, created_at, updated_at)
  VALUES ('q_' || NEW.service_id, NEW.service_id, CASE NEW.is_open WHEN 1 THEN 'open' ELSE 'closed' END, NEW.created_at, NEW.created_at);
END;

CREATE TRIGGER IF NOT EXISTS services_sync_queue_status
AFTER UPDATE OF is_open ON services
BEGIN
  UPDATE queues SET status = CASE NEW.is_open WHEN 1 THEN 'open' ELSE 'closed' END, updated_at = NEW.updated_at
  WHERE service_id = NEW.service_id;
END;

-- Services saved before the queues table existed still get a queue.
INSERT OR IGNORE INTO queues (queue_id, service_id, status, created_at, updated_at)
SELECT 'q_' || service_id, service_id, CASE is_open WHEN 1 THEN 'open' ELSE 'closed' END, created_at, updated_at FROM services;

-- A user's place in a queue. Waiting entries have positions 1..n within their queue;
-- finished entries (served, left, removed) keep their row with position NULL.
CREATE TABLE IF NOT EXISTS queue_entries (
  entry_id TEXT PRIMARY KEY,
  queue_id TEXT NOT NULL REFERENCES queues(queue_id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES user_credentials(id) ON DELETE CASCADE,
  visitor_name TEXT NOT NULL CHECK (length(trim(visitor_name)) BETWEEN 1 AND 80),
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('normal', 'high')),
  status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'served', 'left', 'removed')),
  position INTEGER CHECK (position IS NULL OR position >= 1),
  initial_position INTEGER NOT NULL CHECK (initial_position >= 1),
  joined_at TEXT NOT NULL,
  ended_at TEXT,
  CHECK ((status = 'waiting') = (position IS NOT NULL)),
  CHECK ((status = 'waiting') = (ended_at IS NULL))
) STRICT;

CREATE INDEX IF NOT EXISTS queue_entries_by_queue ON queue_entries (queue_id, status, position);
-- A user can wait in only one queue at a time.
CREATE UNIQUE INDEX IF NOT EXISTS queue_entries_one_waiting_per_user ON queue_entries (user_id) WHERE status = 'waiting';

-- Participation history. Service details are copied so a visit stays readable after its service is deleted.
CREATE TABLE IF NOT EXISTS queue_history (
  history_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES user_credentials(id) ON DELETE CASCADE,
  entry_id TEXT NOT NULL,
  service_id TEXT NOT NULL,
  service_name TEXT NOT NULL,
  joined_at TEXT NOT NULL,
  ended_at TEXT NOT NULL,
  outcome TEXT NOT NULL CHECK (outcome IN ('served', 'left', 'removed')),
  position INTEGER NOT NULL CHECK (position >= 1)
) STRICT;

CREATE INDEX IF NOT EXISTS queue_history_by_user ON queue_history (user_id, ended_at);
