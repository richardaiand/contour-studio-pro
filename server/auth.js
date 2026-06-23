import argon2 from 'argon2';
import jwt from 'jsonwebtoken';
import { config } from './config.js';
import { getDb, generateId } from './db.js';
import { now } from './utils/index.js';

const PASSWORD_MIN_LENGTH = 12;

export function isValidPassword(password) {
  if (!password || password.length < PASSWORD_MIN_LENGTH) return false;
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSymbol = /[^A-Za-z0-9]/.test(password);
  return hasUpper && hasLower && hasNumber && hasSymbol;
}

export function passwordRequirementsMessage() {
  return `Password must be at least ${PASSWORD_MIN_LENGTH} characters and include uppercase, lowercase, number, and symbol.`;
}

export async function hashPassword(password) {
  return argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 4,
  });
}

export async function verifyPassword(password, hash) {
  return argon2.verify(hash, password);
}

export function signToken(payload) {
  return jwt.sign(payload, config.jwtSecret, { expiresIn: '7d' });
}

export function verifyToken(token) {
  return jwt.verify(token, config.jwtSecret);
}

export async function createUser(username, password) {
  const db = getDb();
  const normalized = username.trim().toLowerCase();
  if (!/^[a-z0-9_-]{3,32}$/.test(normalized)) {
    throw new Error('Username must be 3-32 characters, lowercase letters, numbers, underscores, or hyphens.');
  }

  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(normalized);
  if (existing) throw new Error('Username already exists.');

  const id = generateId();
  const passwordHash = await hashPassword(password);
  const createdAt = now();

  db.prepare(
    'INSERT INTO users (id, username, password_hash, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'
  ).run(id, normalized, passwordHash, createdAt, createdAt);

  // Create default settings
  db.prepare(
    `INSERT INTO user_settings (user_id, provider_endpoint, provider_model, theme, default_detail, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    config.providers.aiand.endpoint,
    config.providers.aiand.model,
    'dark',
    'standard',
    createdAt
  );

  return { id, username: normalized };
}

export async function authenticateUser(username, password) {
  const db = getDb();
  const normalized = username.trim().toLowerCase();
  const user = db.prepare('SELECT id, username, password_hash FROM users WHERE username = ?').get(normalized);
  if (!user) throw new Error('Invalid username or password.');

  const valid = await verifyPassword(password, user.password_hash);
  if (!valid) throw new Error('Invalid username or password.');

  return { id: user.id, username: user.username };
}

export function getUserSettings(userId) {
  const db = getDb();
  const row = db.prepare('SELECT * FROM user_settings WHERE user_id = ?').get(userId);
  if (!row) return null;
  return {
    userId: row.user_id,
    providerEndpoint: row.provider_endpoint,
    providerModel: row.provider_model,
    hasApiKey: Boolean(row.encrypted_api_key),
    theme: row.theme,
    defaultDetail: row.default_detail,
    updatedAt: row.updated_at,
  };
}

export function getUserById(userId) {
  const db = getDb();
  const user = db.prepare('SELECT id, username, created_at FROM users WHERE id = ?').get(userId);
  return user || null;
}
