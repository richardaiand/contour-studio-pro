import fp from 'fastify-plugin';
import { verifyToken } from '../auth.js';
import { AppError } from '../errors.js';

export default fp(async function (fastify) {
  fastify.decorate('authenticate', async function (req, reply) {
    const authHeader = req.headers.authorization;
    const cookieToken = req.cookies?.token;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : cookieToken;

    if (!token) {
      throw new AppError('Authentication required', 401, 'UNAUTHORIZED');
    }

    try {
      const decoded = verifyToken(token);
      req.user = decoded;
    } catch (err) {
      throw new AppError('Invalid or expired token', 401, 'UNAUTHORIZED');
    }
  });
});
