import { createJob, getJob, listJobsForUser } from '../services/jobs/db.js';
import { AppError } from '../errors.js';

export default async function (fastify) {
  // Create a terrain generation job
  fastify.post('/terrain', {
    onRequest: [fastify.authenticate],
    schema: {
      body: {
        type: 'object',
        required: ['bounds'],
        properties: {
          bounds: {
            type: 'object',
            required: ['minLat', 'maxLat', 'minLon', 'maxLon'],
            properties: {
              minLat: { type: 'number' },
              maxLat: { type: 'number' },
              minLon: { type: 'number' },
              maxLon: { type: 'number' },
            },
          },
          detailLevel: { type: 'string', enum: ['draft', 'standard', 'survey'], default: 'standard' },
          verticalExaggeration: { type: 'number', default: 1.5 },
        },
      },
    },
  }, async (req) => {
    const { bounds, detailLevel = 'standard', verticalExaggeration = 1.5 } = req.body;

    if (bounds.minLat >= bounds.maxLat || bounds.minLon >= bounds.maxLon) {
      throw new AppError('Invalid bounds', 400, 'BAD_REQUEST');
    }

    const job = createJob({
      userId: req.user.userId,
      type: 'terrain:generate',
      payload: { bounds, detailLevel, verticalExaggeration },
    });

    return { jobId: job.id, status: job.status };
  });

  // Get job status and result
  fastify.get('/:id', {
    onRequest: [fastify.authenticate],
  }, async (req) => {
    const job = getJob(req.params.id);
    if (!job || job.userId !== req.user.userId) {
      throw new AppError('Job not found', 404, 'NOT_FOUND');
    }
    return job;
  });

  // List user's jobs
  fastify.get('/', {
    onRequest: [fastify.authenticate],
  }, async (req) => {
    return listJobsForUser(req.user.userId);
  });
}
