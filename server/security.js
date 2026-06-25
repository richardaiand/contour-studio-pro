import fp from 'fastify-plugin';
import helmet from '@fastify/helmet';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import cookie from '@fastify/cookie';
import { config, isProduction } from './config.js';

export default fp(async function (fastify) {
  // CORS
  await fastify.register(cors, {
    origin: isProduction ? [config.appUrl] : true,
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // Cookies
  await fastify.register(cookie, {
    secret: config.cookieSecret,
    parseOptions: {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'strict' : 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 7 days
    },
  });

  // Helmet / CSP
  await fastify.register(helmet, {
    global: true,
    contentSecurityPolicy: {
      useDefaults: false,
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'blob:', 'https://tile.openstreetmap.org', 'https://*.openfreemap.org', 'https://*.cartocdn.com', 'https://server.arcgisonline.com', 'https://*.opentopomap.org'],
        connectSrc: ["'self'", 'https://api.openai.com', 'https://api.aiand.com', 'https://api.anthropic.com', 'https://openrouter.ai', 'https://nominatim.openstreetmap.org', 'https://photon.komoot.io', 'https://portal.opentopography.org', 'https://*.nationalmap.gov', 'https://api.open-meteo.com'],
        workerSrc: ["'self'", 'blob:'],
        frameSrc: ["'self'", 'blob:'],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        upgradeInsecureRequests: isProduction ? [] : null,
      },
    },
    hsts: isProduction
      ? { maxAge: 63072000, includeSubDomains: true, preload: true }
      : false,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  });

  // Rate limiting
  await fastify.register(rateLimit, {
    max: config.rateLimit.max,
    timeWindow: config.rateLimit.windowMs,
    keyGenerator: (req) => req.ip,
    errorResponseBuilder: (req, context) => ({
      error: {
        code: 'RATE_LIMITED',
        message: `Rate limit exceeded. Retry after ${context.after}`,
      },
    }),
  });

  // HTTPS redirect in production
  if (isProduction) {
    fastify.addHook('onRequest', async (req, reply) => {
      const proto = req.headers['x-forwarded-proto'];
      if (proto && proto !== 'https') {
        reply.redirect(`https://${req.hostname}${req.url}`, 301);
      }
    });
  }
});
