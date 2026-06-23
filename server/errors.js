export class AppError extends Error {
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

export function errorHandler(error, req, reply) {
  req.log.error({ err: error }, 'Request error');

  if (error instanceof AppError) {
    return reply.status(error.statusCode).send({
      error: { code: error.code, message: error.message },
    });
  }

  if (error.statusCode === 429) {
    return reply.status(429).send({
      error: { code: 'RATE_LIMITED', message: error.message || 'Too many requests' },
    });
  }

  if (error.validation) {
    return reply.status(400).send({
      error: { code: 'VALIDATION_ERROR', message: error.message },
    });
  }

  // Don't leak stack traces in production
  const message = process.env.NODE_ENV === 'production'
    ? 'An unexpected error occurred'
    : error.message || 'Internal server error';

  reply.status(500).send({
    error: { code: 'INTERNAL_ERROR', message },
  });
}
