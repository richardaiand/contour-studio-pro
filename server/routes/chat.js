import { config } from '../config.js';
import { decrypt } from '../utils/index.js';
import { getDb } from '../db.js';
import { AppError } from '../errors.js';

const PRESETS = {
  aiand: { endpoint: config.providers.aiand.endpoint, model: config.providers.aiand.model },
  openai: { endpoint: config.providers.openai.endpoint, model: config.providers.openai.model },
  anthropic: { endpoint: config.providers.anthropic.endpoint, model: config.providers.anthropic.model },
  openrouter: { endpoint: config.providers.openrouter.endpoint, model: config.providers.openrouter.model },
  ollama: { endpoint: config.providers.ollama.endpoint, model: config.providers.ollama.model },
};

export default async function (fastify) {
  fastify.get('/providers', async () => {
    return {
      presets: PRESETS,
      default: 'aiand',
    };
  });

  fastify.post('/', {
    onRequest: [fastify.authenticate],
    schema: {
      body: {
        type: 'object',
        required: ['messages'],
        properties: {
          messages: { type: 'array' },
          temperature: { type: 'number', default: 0.7 },
          stream: { type: 'boolean', default: true },
          preset: { type: 'string' },
          endpoint: { type: 'string' },
          model: { type: 'string' },
        },
      },
    },
  }, async (req, reply) => {
    const settings = getDb()
      .prepare('SELECT * FROM user_settings WHERE user_id = ?')
      .get(req.user.userId);

    let endpoint = req.body.endpoint || settings?.provider_endpoint || PRESETS.aiand.endpoint;
    let model = req.body.model || settings?.provider_model || PRESETS.aiand.model;

    if (req.body.preset && PRESETS[req.body.preset]) {
      endpoint = PRESETS[req.body.preset].endpoint;
      model = PRESETS[req.body.preset].model;
    }

    let apiKey = '';
    if (settings?.encrypted_api_key) {
      apiKey = decrypt(settings.encrypted_api_key);
    }

    if (!apiKey) {
      throw new AppError('No AI provider API key configured. Add one in Settings.', 400, 'NO_API_KEY');
    }

    const base = endpoint.replace(/\/+$/, '');
    const upstreamUrl = base + '/chat/completions';

    const abortController = new AbortController();
    const closeHandler = () => abortController.abort();
    req.raw.on('close', closeHandler);

    const upstreamRes = await fetch(upstreamUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: req.body.messages,
        temperature: req.body.temperature ?? 0.7,
        stream: req.body.stream ?? true,
      }),
      signal: abortController.signal,
    });

    if (!upstreamRes.ok) {
      req.raw.removeListener('close', closeHandler);
      const text = await upstreamRes.text().catch(() => '');
      throw new AppError(`AI provider error ${upstreamRes.status}: ${text.slice(0, 300)}`, 502, 'AI_ERROR');
    }

    if (!req.body.stream) {
      req.raw.removeListener('close', closeHandler);
      const data = await upstreamRes.json();
      return data;
    }

    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'X-Accel-Buffering': 'no',
      Connection: 'keep-alive',
    });

    const reader = upstreamRes.body.getReader();

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        reply.raw.write(value);
      }
    } catch (err) {
      if (err.name !== 'AbortError') req.log.error(err);
    } finally {
      req.raw.removeListener('close', closeHandler);
      try { await reader.cancel(); } catch {}
      reply.raw.end();
    }
  });
}
