import { analyzeMap } from '../services/ai/analyzer.js';
import { AppError } from '../errors.js';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'];
const MAX_SIZE = 10 * 1024 * 1024; // 10MB

export default async function (fastify) {
  fastify.post('/analyze', {
    onRequest: [fastify.authenticate],
  }, async (req) => {
    const data = await req.file();
    if (!data) {
      throw new AppError('No file uploaded', 400, 'BAD_REQUEST');
    }

    if (!ALLOWED_TYPES.includes(data.mimetype)) {
      throw new AppError(`Unsupported file type: ${data.mimetype}`, 400, 'BAD_REQUEST');
    }

    const chunks = [];
    let size = 0;

    for await (const chunk of data.file) {
      size += chunk.length;
      if (size > MAX_SIZE) {
        throw new AppError('File too large. Maximum is 10MB.', 413, 'PAYLOAD_TOO_LARGE');
      }
      chunks.push(chunk);
    }

    const buffer = Buffer.concat(chunks);

    // For MVP, we do not convert PDF to image here. PDFs will fail at the AI provider
    // unless the provider supports PDF vision. We still accept the upload so the user
    // can try their provider.
    const result = await analyzeMap({
      imageBuffer: buffer,
      mimeType: data.mimetype,
      userId: req.user.userId,
    });

    return {
      filename: data.filename,
      mimetype: data.mimetype,
      size,
      analysis: result,
    };
  });
}
