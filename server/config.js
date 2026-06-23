import dotenv from 'dotenv';
import { existsSync } from 'fs';
import { resolve } from 'path';

dotenv.config({ path: resolve('.env') });

function getEnv(key, fallback) {
  const value = process.env[key];
  if (value === undefined || value === '') return fallback;
  return value;
}

function requireEnv(key) {
  const value = process.env[key];
  if (!value) throw new Error(`Missing required environment variable: ${key}`);
  return value;
}

export const config = {
  env: getEnv('NODE_ENV', 'development'),
  port: parseInt(getEnv('PORT', '3000'), 10),
  appUrl: getEnv('APP_URL', 'http://localhost:3000'),
  databaseUrl: getEnv('DATABASE_URL', './data/contour-studio.db'),
  jwtSecret: requireEnv('JWT_SECRET'),
  cookieSecret: requireEnv('COOKIE_SECRET'),
  encryptionKey: requireEnv('ENCRYPTION_KEY'),
  requestTimeout: parseInt(getEnv('REQUEST_TIMEOUT_MS', '120000'), 10),
  rateLimit: {
    max: parseInt(getEnv('RATE_LIMIT_MAX', '100'), 10),
    windowMs: parseInt(getEnv('RATE_LIMIT_WINDOW_MS', '60000'), 10),
  },
  geocoding: {
    userAgent: getEnv('NOMINATIM_USER_AGENT', 'contour-studio/0.1.0'),
    openCageKey: getEnv('OPENCAGE_API_KEY', ''),
  },
  dem: {
    openTopographyKey: getEnv('OPEN_TOPOGRAPHY_API_KEY', ''),
    copernicusUsername: getEnv('COPERNICUS_USERNAME', ''),
    copernicusPassword: getEnv('COPERNICUS_PASSWORD', ''),
  },
  providers: {
    aiand: {
      endpoint: getEnv('AIAND_ENDPOINT', 'https://api.aiand.com/v1'),
      model: getEnv('AIAND_MODEL', 'deepseek-ai/deepseek-v4-pro'),
      apiKey: getEnv('AIAND_API_KEY', ''),
    },
    openai: {
      endpoint: getEnv('OPENAI_ENDPOINT', 'https://api.openai.com/v1'),
      model: getEnv('OPENAI_MODEL', 'gpt-4o'),
      apiKey: getEnv('OPENAI_API_KEY', ''),
    },
    anthropic: {
      endpoint: getEnv('ANTHROPIC_ENDPOINT', 'https://api.anthropic.com/v1'),
      model: getEnv('ANTHROPIC_MODEL', 'claude-3-5-sonnet-20241022'),
      apiKey: getEnv('ANTHROPIC_API_KEY', ''),
    },
    openrouter: {
      endpoint: getEnv('OPENROUTER_ENDPOINT', 'https://openrouter.ai/api/v1'),
      model: getEnv('OPENROUTER_MODEL', 'openai/gpt-4o-mini'),
      apiKey: getEnv('OPENROUTER_API_KEY', ''),
    },
    ollama: {
      endpoint: getEnv('OLLAMA_ENDPOINT', 'http://localhost:11434/v1'),
      model: getEnv('OLLAMA_MODEL', 'llama3.1'),
      apiKey: '',
    },
  },
};

export const isProduction = config.env === 'production';
