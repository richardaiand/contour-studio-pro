import Fastify from 'fastify';
import multipart from '@fastify/multipart';
import path from 'path';
import { existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { config, isProduction } from './config.js';
import { runMigrations } from './db.js';
import securityPlugin from './security.js';
import authPlugin from './plugins/auth.js';
import { errorHandler } from './errors.js';

import authRoutes from './routes/auth.js';
import projectRoutes from './routes/projects.js';
import geocodeRoutes from './routes/geocode.js';
import terrainRoutes from './routes/terrain.js';
import catalogRoutes from './routes/catalog.js';
import chatRoutes from './routes/chat.js';
import jobRoutes from './routes/jobs.js';
import mapRoutes from './routes/maps.js';
import providerRoutes from './routes/providers.js';
import { startWorker } from './services/jobs/worker.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function buildServer() {
  const fastify = Fastify({
    logger: !isProduction,
    trustProxy: true,
    connectionTimeout: config.requestTimeout,
    keepAliveTimeout: config.requestTimeout,
  });

  // Error handling
  fastify.setErrorHandler(errorHandler);

  // Security, CORS, cookies, rate limiting
  await fastify.register(securityPlugin);

  // Multipart file uploads
  await fastify.register(multipart, {
    limits: {
      fileSize: 10 * 1024 * 1024,
      files: 1,
    },
  });

  // Auth hook
  await fastify.register(authPlugin);

  // Run DB migrations
  runMigrations();

  // API routes
  await fastify.register(authRoutes, { prefix: '/api/auth' });
  await fastify.register(projectRoutes, { prefix: '/api/projects' });
  await fastify.register(geocodeRoutes, { prefix: '/api/geocode' });
  await fastify.register(terrainRoutes, { prefix: '/api/terrain' });
  await fastify.register(catalogRoutes, { prefix: '/api/catalog' });
  await fastify.register(chatRoutes, { prefix: '/api/chat' });
  await fastify.register(jobRoutes, { prefix: '/api/jobs' });
  await fastify.register(mapRoutes, { prefix: '/api/maps' });
  await fastify.register(providerRoutes, { prefix: '/api/providers' });

  // Health check
  fastify.get('/health', async () => ({ status: 'ok', version: '0.1.0' }));

  // Debug endpoint — tests DB and auth
  fastify.get('/api/debug', {
    onRequest: [fastify.authenticate],
  }, async (req) => {
    const { getDb } = await import('./db.js');
    const { config } = await import('./config.js');
    const { existsSync } = await import('fs');
    const info = {
      databaseUrl: config.databaseUrl,
      dbFileExists: false,
      dbWritable: false,
      tables: [],
      user: req.user,
      projectsQuery: null,
      exportsQuery: null,
      error: null,
    };
    try {
      info.dbFileExists = existsSync(config.databaseUrl);
      const db = getDb();
      info.tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(r => r.name);
      info.dbWritable = true;
      try {
        info.projectsQuery = db.prepare('SELECT * FROM projects WHERE user_id = ?').all(req.user.userId);
      } catch (e) {
        info.projectsQuery = { error: e.message };
      }
      try {
        info.exportsQuery = db.prepare('SELECT * FROM exports WHERE user_id = ?').all(req.user.userId);
      } catch (e) {
        info.exportsQuery = { error: e.message };
      }
    } catch (err) {
      info.error = err.message;
    }
    return info;
  });

  // Serve static client in production
  if (isProduction) {
    const { default: fastifyStatic } = await import('@fastify/static');
    const clientRoot = path.join(__dirname, '../dist/client');

    if (!existsSync(clientRoot)) {
      console.error(`Client build directory not found: ${clientRoot}. Run "npm run build" first.`);
    } else {
      console.log(`Serving static files from ${clientRoot}`);
    }

    await fastify.register(fastifyStatic, {
      root: clientRoot,
      prefix: '/',
      wildcard: false,
      decorateReply: true,
    });

    fastify.setNotFoundHandler((req, reply) => {
      // If the request looks like a static asset but wasn't found, return 404
      if (/\.[a-zA-Z0-9]+$/.test(req.raw.url) && !req.raw.url.endsWith('.html')) {
        reply.status(404).send({ error: 'Not found' });
        return;
      }
      try {
        reply.sendFile('index.html');
      } catch (err) {
        reply.type('text/html').send('<h1>Build Error</h1><p>Client files not found. The build may have failed.</p>');
      }
    });
  }

  return fastify;
}

async function start() {
  try {
    const fastify = await buildServer();
    const address = await fastify.listen({ port: config.port, host: '0.0.0.0' });
    fastify.log.info(`Server listening on ${address}`);
    startWorker();
  } catch (err) {
    console.error('Startup error:', err);
    process.exit(1);
  }
}

start();

export { buildServer };
