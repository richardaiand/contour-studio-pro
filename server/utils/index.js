import crypto from 'crypto';
import { config } from '../config.js';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

function getKeyBuffer() {
  const key = config.encryptionKey.replace(/\s/g, '');
  if (key.length !== 64) {
    throw new Error('ENCRYPTION_KEY must be a 64-character hex string (32 bytes)');
  }
  return Buffer.from(key, 'hex');
}

export function encrypt(text) {
  if (!text) return '';
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, getKeyBuffer(), iv);
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

export function decrypt(encryptedText) {
  if (!encryptedText) return '';
  const [ivHex, authTagHex, encryptedHex] = encryptedText.split(':');
  if (!ivHex || !authTagHex || !encryptedHex) throw new Error('Invalid encrypted value format');
  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    getKeyBuffer(),
    Buffer.from(ivHex, 'hex')
  );
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedHex, 'hex')),
    decipher.final(),
  ]);
  return decrypted.toString('utf8');
}

export function sanitizeFilename(name) {
  return String(name).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 80);
}

export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function now() {
  return Date.now();
}

export function parseJson(json, fallback = null) {
  if (!json) return fallback;
  try {
    return JSON.parse(json);
  } catch {
    return fallback;
  }
}
