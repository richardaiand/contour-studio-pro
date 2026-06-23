-- Users / accounts
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

-- User settings (AI provider, theme, default detail)
CREATE TABLE IF NOT EXISTS user_settings (
  user_id TEXT PRIMARY KEY,
  provider_endpoint TEXT,
  provider_model TEXT,
  encrypted_api_key TEXT,
  theme TEXT DEFAULT 'dark',
  default_detail TEXT DEFAULT 'standard',
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Projects
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  detail_level TEXT DEFAULT 'standard',
  bounds_json TEXT,
  center_json TEXT,
  source_info_json TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_projects_user ON projects(user_id, updated_at DESC);

-- Messages / generations within a project
CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  metadata_json TEXT,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_messages_project ON messages(project_id, created_at ASC);

-- Async jobs (for future use)
CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  progress INTEGER DEFAULT 0,
  result_json TEXT,
  error TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_jobs_user ON jobs(user_id, created_at DESC);

-- Local topographic map catalog sources
CREATE TABLE IF NOT EXISTS map_sources (
  id TEXT PRIMARY KEY,
  country_code TEXT NOT NULL,
  region TEXT,
  agency TEXT NOT NULL,
  source_type TEXT NOT NULL,
  base_url TEXT NOT NULL,
  coverage_json TEXT NOT NULL,
  min_scale INTEGER,
  max_scale INTEGER,
  formats_json TEXT,
  license TEXT,
  access_notes TEXT,
  is_direct_download INTEGER DEFAULT 1,
  is_active INTEGER DEFAULT 1,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_map_sources_country ON map_sources(country_code, is_active);
