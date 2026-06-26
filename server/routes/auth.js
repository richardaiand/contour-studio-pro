import { authenticateUser, createUser, getUserById, getUserSettings, isValidPassword, passwordRequirementsMessage, signToken } from '../auth.js';
import { decrypt, encrypt } from '../utils/index.js';
import { getDb } from '../db.js';
import { now } from '../utils/index.js';

export default async function (fastify) {
  fastify.post('/signup', {
    schema: {
      body: {
        type: 'object',
        required: ['username', 'password'],
        properties: {
          username: { type: 'string', minLength: 3, maxLength: 32 },
          password: { type: 'string', minLength: 12 },
        },
      },
    },
  }, async (req, reply) => {
    const { username, password } = req.body;
    if (!isValidPassword(password)) {
      return reply.status(400).send({
        error: { code: 'WEAK_PASSWORD', message: passwordRequirementsMessage() },
      });
    }

    const user = await createUser(username, password);
    const token = signToken({ userId: user.id, username: user.username });

    reply.setCookie('token', token, {
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
    });
    return { user, token, settings: getUserSettings(user.id) };
  });

  fastify.post('/signin', async (req, reply) => {
    const { username, password } = req.body;
    const user = await authenticateUser(username, password);
    const token = signToken({ userId: user.id, username: user.username });

    reply.setCookie('token', token, {
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
    });
    return { user, token, settings: getUserSettings(user.id) };
  });

  fastify.post('/signout', async (req, reply) => {
    reply.clearCookie('token', { path: '/' });
    return { ok: true };
  });

  fastify.get('/me', { onRequest: [fastify.authenticate] }, async (req) => {
    const user = getUserById(req.user.userId);
    const settings = getUserSettings(req.user.userId);
    return { user, settings };
  });

  fastify.patch('/settings', { onRequest: [fastify.authenticate] }, async (req, reply) => {
    const userId = req.user.userId;
    const { providerEndpoint, providerModel, apiKey, theme, defaultDetail } = req.body;

    const db = getDb();
    const updates = [];
    const values = [];

    if (providerEndpoint !== undefined) {
      updates.push('provider_endpoint = ?');
      values.push(providerEndpoint);
    }
    if (providerModel !== undefined) {
      updates.push('provider_model = ?');
      values.push(providerModel);
    }
    if (apiKey !== undefined) {
      let encrypted;
      try {
        encrypted = apiKey ? encrypt(apiKey) : null;
      } catch (err) {
        return reply.status(500).send({
          error: {
            code: 'ENCRYPTION_ERROR',
            message: err.message || 'Failed to encrypt API key. Check server ENCRYPTION_KEY config.',
          },
        });
      }
      updates.push('encrypted_api_key = ?');
      values.push(encrypted);
    }
    if (theme !== undefined) {
      updates.push('theme = ?');
      values.push(theme);
    }
    if (defaultDetail !== undefined) {
      updates.push('default_detail = ?');
      values.push(defaultDetail);
    }

    if (updates.length === 0) {
      return reply.status(400).send({ error: { code: 'NO_CHANGES', message: 'No settings provided.' } });
    }

    updates.push('updated_at = ?');
    values.push(now());
    values.push(userId);

    db.prepare(`UPDATE user_settings SET ${updates.join(', ')} WHERE user_id = ?`).run(...values);
    return { settings: getUserSettings(userId) };
  });

  fastify.get('/settings/key', { onRequest: [fastify.authenticate] }, async (req) => {
    const row = getDb()
      .prepare('SELECT encrypted_api_key FROM user_settings WHERE user_id = ?')
      .get(req.user.userId);
    if (!row?.encrypted_api_key) return { hasKey: false };
    return { hasKey: true, apiKey: decrypt(row.encrypted_api_key) };
  });
}
