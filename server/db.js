import Database from 'better-sqlite3';
import { readFileSync, mkdirSync } from 'fs';
import { dirname, resolve } from 'path';
import { config } from './config.js';
import { randomUUID } from 'crypto';

const dbPath = config.databaseUrl.startsWith('./') || config.databaseUrl.startsWith('/')
  ? resolve(config.databaseUrl)
  : config.databaseUrl;

// Ensure directory exists for SQLite file
if (dbPath.startsWith('/')) {
  mkdirSync(dirname(dbPath), { recursive: true });
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
  database.exec(`
    CREATE TABLE IF NOT EXISTS migrations (
      id TEXT PRIMARY KEY,
      applied_at INTEGER NOT NULL
    );
  `);

  const applied = new Set(
    database.prepare('SELECT id FROM migrations').pluck().all()
  );

  const migrations = [
    { id: '001_init', file: resolve('migrations/001_init.sql') },
  ];

  for (const migration of migrations) {
    if (applied.has(migration.id)) continue;
    const sql = readFileSync(migration.file, 'utf8');
    database.exec(sql);
    database.prepare('INSERT INTO migrations (id, applied_at) VALUES (?, ?)').run(
      migration.id,
      Date.now()
    );
    console.log(`Applied migration ${migration.id}`);
  }
}

export function generateId() {
  return randomUUID();
}

// Run migrations if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runMigrations();
  console.log('Migrations complete');
  process.exit(0);
}
