CREATE TABLE groups (
  id TEXT PRIMARY KEY CHECK (id IN ('musik-1', 'musik-2')),
  name TEXT NOT NULL,
  kol TEXT NOT NULL DEFAULT ''
);
INSERT INTO groups (id, name) VALUES ('musik-1', 'Himti Musik 1'), ('musik-2', 'Himti Musik 2');

CREATE TABLE admins (
  id UUID PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  failed_logins INTEGER NOT NULL DEFAULT 0,
  locked_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE members (
  id UUID PRIMARY KEY,
  sequence BIGINT GENERATED ALWAYS AS IDENTITY UNIQUE,
  group_id TEXT NOT NULL REFERENCES groups(id),
  name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 100),
  phone TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL CHECK (status IN ('Calon','Aktif','Nonaktif')),
  process TEXT NOT NULL CHECK (process IN ('Selesai','Incoming','Outgoing','Transfer')),
  updated_date DATE NOT NULL,
  notes TEXT NOT NULL DEFAULT '' CHECK (length(notes) <= 2000),
  revision INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT valid_process_status CHECK (
    (process = 'Selesai') OR
    (process = 'Incoming' AND status = 'Calon') OR
    (process IN ('Outgoing','Transfer') AND status = 'Aktif')
  )
);
CREATE UNIQUE INDEX members_phone_unique ON members(phone) WHERE phone <> '';
CREATE INDEX members_group ON members(group_id, sequence);

CREATE TABLE events (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  admin_id UUID REFERENCES admins(id),
  text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX events_latest ON events(created_at DESC, id DESC);

-- Struktur sesi sesuai connect-pg-simple; isinya hanya disimpan di server.
CREATE TABLE sessions (
  sid VARCHAR NOT NULL PRIMARY KEY,
  sess JSON NOT NULL,
  expire TIMESTAMP(6) NOT NULL
);
CREATE INDEX sessions_expire ON sessions(expire);
