import { config } from '../config.js';

const AIAND_FALLBACK_MODELS = [
  { id: 'zai-org/glm-5.2', name: 'GLM 5.2' },
  { id: 'moonshot/kimi-2.7', name: 'Kimi 2.7' },
  { id: 'deepseek-ai/deepseek-v4-pro', name: 'DeepSeek V4 Pro' },
  { id: 'deepseek-ai/deepseek-v4-flash', name: 'DeepSeek V4 Flash' },
  { id: 'Qwen/qwen-3.6', name: 'Qwen 3.6' },
  { id: 'google/gemma-4-31b', name: 'Gemma 4 31B' },
  { id: 'zai-org/glm-5.1', name: 'GLM 5.1' },
  { id: 'openai/gpt-oss-120b', name: 'GPT OSS 120B' },
  { id: 'moonshot/kimi-2.6', name: 'Kimi 2.6' },
];

export default async function (fastify) {
  fastify.get('/aiand/models', async (req, reply) => {
    const key = config.providers.aiand.apiKey;
    if (!key) {
      return { models: AIAND_FALLBACK_MODELS };
    }

    try {
      const res = await fetch(`${config.providers.aiand.endpoint}/models`, {
        headers: {
          Authorization: `Bearer ${key}`,
          Accept: 'application/json',
        },
        signal: AbortSignal.timeout(15000),
      });

      if (!res.ok) {
        return { models: AIAND_FALLBACK_MODELS };
      }

      const data = await res.json();
      const models = (data.data || []).map((m) => ({
        id: m.id,
        name: m.name || m.id,
      }));

      return { models: models.length ? models : AIAND_FALLBACK_MODELS };
    } catch (err) {
      req.log.warn({ err }, 'Failed to fetch AIand models');
      return { models: AIAND_FALLBACK_MODELS };
    }
  });
}
