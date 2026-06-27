import Database from 'better-sqlite3';
import { mkdirSync } from 'fs';
import { dirname, resolve } from 'path';
import { config } from './config.js';
import { randomUUID } from 'crypto';

const dbPath = config.databaseUrl.startsWith('./') || config.databaseUrl.startsWith('/')
  ? resolve(config.databaseUrl)
  : config.databaseUrl;

// Ensure directory exists for SQLite file
try {
  if (dbPath.startsWith('/')) {
    mkdirSync(dirname(dbPath), { recursive: true });
  }
} catch (err) {
  console.error('Failed to create DB directory:', err.message);
}

let db = null;

export function getDb() {
  if (!db) {
    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
  }
  return db;
}

export function runMigrations() {
  const database = getDb();

  // Create all tables inline — no external migration files needed
  database.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

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

    CREATE TABLE IF NOT EXISTS jobs (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      type TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      progress INTEGER DEFAULT 0,
      payload_json TEXT,
      result_json TEXT,
      error TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_jobs_user ON jobs(user_id, created_at DESC);

    CREATE TABLE IF NOT EXISTS exports (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      project_id TEXT,
      format TEXT NOT NULL,
      filename TEXT NOT NULL,
      size_bytes INTEGER,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_exports_user ON exports(user_id, created_at DESC);

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
   `);

  // Add terrain_data_json column to projects if it doesn't exist
  const columns = database.prepare("PRAGMA table_info(projects)").all();
  if (!columns.find((c) => c.name === 'terrain_data_json')) {
    database.exec('ALTER TABLE projects ADD COLUMN terrain_data_json TEXT');
    console.log('Added terrain_data_json column to projects');
  }
  if (!columns.find((c) => c.name === 'thumbnail')) {
    database.exec('ALTER TABLE projects ADD COLUMN thumbnail TEXT');
    console.log('Added thumbnail column to projects');
  }
  if (!columns.find((c) => c.name === 'terrain_versions_json')) {
    database.exec('ALTER TABLE projects ADD COLUMN terrain_versions_json TEXT DEFAULT "[]"');
    console.log('Added terrain_versions_json column to projects');
  }

  console.log('Database tables created/verified');
}

export function generateId() {
  return randomUUID();
}
