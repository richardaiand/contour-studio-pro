import { config } from '../../config.js';
import { decrypt } from '../../utils/index.js';
import { getDb } from '../../db.js';
import { AppError } from '../../errors.js';

const PRESETS = {
  aiand: { endpoint: config.providers.aiand.endpoint, model: config.providers.aiand.model },
  openai: { endpoint: config.providers.openai.endpoint, model: config.providers.openai.model },
  anthropic: { endpoint: config.providers.anthropic.endpoint, model: config.providers.anthropic.model },
  openrouter: { endpoint: config.providers.openrouter.endpoint, model: config.providers.openrouter.model },
  ollama: { endpoint: config.providers.ollama.endpoint, model: config.providers.ollama.model },
};

/**
 * Analyze a topographic map image with a vision-capable AI model.
 * @param {Object} options
 * @param {Buffer} options.imageBuffer
 * @param {string} options.mimeType
 * @param {string} [options.userId]
 * @param {string} [options.preset]
 * @param {string} [options.endpoint]
 * @param {string} [options.model]
 * @returns {Promise<Object>}
 */
export async function analyzeMap({ imageBuffer, mimeType, userId, preset, endpoint, model }) {
  const apiKey = getApiKey(userId);
  if (!apiKey) {
    throw new AppError('No AI provider API key configured. Add one in Settings.', 400, 'NO_API_KEY');
  }

  const resolved = resolveProvider({ preset, endpoint, model, userId });
  const base64 = imageBuffer.toString('base64');
  const dataUrl = `data:${mimeType};base64,${base64}`;

  const messages = [
    {
      role: 'system',
      content:
        'You are a topographic map analyst. Extract structured information from the uploaded map image. Return only valid JSON matching the requested schema.',
    },
    {
      role: 'user',
      content: [
        {
          type: 'text',
          text: `Analyze this topographic map image and return JSON with this exact shape:
{
  "title": "short map title or location if visible",
  "contourIntervalMeters": number | null,
  "scale": "scale text if visible, e.g. 1:24000",
  "coordinateSystem": "e.g. UTM Zone 33N, WGS84",
  "contours": [
    {"elevationMeters": number, "color": "#hex"}
  ],
  "features": [
    {"type": "peak|valley|ridge|river|road|building|trail|water", "label": "name if visible", "elevationMeters": number|null}
  ],
  "boundsGuess": {"minLat": number|null, "maxLat": number|null, "minLon": number|null, "maxLon": number|null},
  "notes": "any caveats or important details"
}
If information is not visible, use null.`,
        },
        {
          type: 'image_url',
          image_url: { url: dataUrl, detail: 'high' },
        },
      ],
    },
  ];

  const upstreamUrl = resolved.endpoint.replace(/\/+$/, '') + '/chat/completions';

  const res = await fetch(upstreamUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: resolved.model,
      messages,
      temperature: 0.2,
      max_tokens: 2048,
    }),
    signal: AbortSignal.timeout(90000),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new AppError(`AI provider error ${res.status}: ${text.slice(0, 300)}`, 502, 'AI_ERROR');
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new AppError('AI returned empty content', 502, 'AI_ERROR');
  }

  return parseJsonResponse(content);
}

function resolveProvider({ preset, endpoint, model, userId }) {
  const settings = userId
    ? getDb().prepare('SELECT * FROM user_settings WHERE user_id = ?').get(userId)
    : null;

  let resolvedEndpoint = endpoint || settings?.provider_endpoint || PRESETS.aiand.endpoint;
  let resolvedModel = model || settings?.provider_model || PRESETS.aiand.model;

  if (preset && PRESETS[preset]) {
    resolvedEndpoint = PRESETS[preset].endpoint;
    resolvedModel = PRESETS[preset].model;
  }

  return { endpoint: resolvedEndpoint, model: resolvedModel };
}

function getApiKey(userId) {
  if (!userId) return null;
  const settings = getDb().prepare('SELECT * FROM user_settings WHERE user_id = ?').get(userId);
  if (settings?.encrypted_api_key) {
    return decrypt(settings.encrypted_api_key);
  }
  return null;
}

function parseJsonResponse(content) {
  // Try to extract JSON if wrapped in markdown code block
  const codeBlock = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  const jsonText = codeBlock ? codeBlock[1].trim() : content.trim();

  try {
    return JSON.parse(jsonText);
  } catch (err) {
    throw new AppError(`AI returned invalid JSON: ${err.message}`, 502, 'AI_ERROR');
  }
}
