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

const LEGEND_ANALYSIS_PROMPT = `You are analyzing a topographic map image. Extract the following structured data:

1. **Legend Symbols**: List all symbols shown in the legend with their meanings
2. **Scale Bar**: Measure the scale bar ratio (e.g., 1:24000, 1:50000)
3. **Contour Interval**: The elevation difference between contour lines (in feet or meters)
4. **North Arrow**: Direction of true north or magnetic north
5. **Datum**: The geographic datum used (e.g., NAD27, NAD83, WGS84)
6. **Coordinate System**: Any grid system shown (e.g., UTM zone)
7. **Map Title**: The title of the map
8. **Publisher/Agency**: Who published the map (e.g., USGS)
9. **Edition/Date**: Publication date or edition number

Return as JSON with this exact structure:
{
  "legendSymbols": [{ "symbol": "description", "meaning": "description" }],
  "scaleRatio": "1:24000",
  "contourIntervalMeters": 10,
  "contourIntervalFeet": 40,
  "northArrow": "true north",
  "datum": "NAD83",
  "coordinateSystem": "UTM Zone 10N",
  "title": "Map title",
  "publisher": "USGS",
  "edition": "2024",
  "notes": "any additional observations"
}

If a field is not visible on the map, use null for that field.`;

export async function analyzeMapLegend({ imageBuffer, mimeType, userId }) {
  const apiKey = getApiKey(userId);
  if (!apiKey) {
    throw new AppError('No AI provider API key configured. Add one in Settings.', 400, 'NO_API_KEY');
  }

  const { endpoint, model } = resolveProvider({ userId });
  const base64 = imageBuffer.toString('base64');
  const dataUrl = `data:${mimeType};base64,${base64}`;

  const messages = [
    {
      role: 'system',
      content: 'You are a cartographic analyst specializing in topographic map interpretation. Return only valid JSON.',
    },
    {
      role: 'user',
      content: [
        {
          type: 'text',
          text: LEGEND_ANALYSIS_PROMPT,
        },
        {
          type: 'image_url',
          image_url: { url: dataUrl, detail: 'high' },
        },
      ],
    },
  ];

  const upstreamUrl = endpoint.replace(/\/+$/, '') + '/chat/completions';

  const res = await fetch(upstreamUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.2,
      max_tokens: 4096,
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

function resolveProvider({ userId }) {
  const settings = userId
    ? getDb().prepare('SELECT * FROM user_settings WHERE user_id = ?').get(userId)
    : null;

  const endpoint = settings?.provider_endpoint || PRESETS.aiand.endpoint;
  const model = settings?.provider_model || PRESETS.aiand.model;

  return { endpoint, model };
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
  const codeBlock = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  const jsonText = codeBlock ? codeBlock[1].trim() : content.trim();

  try {
    return JSON.parse(jsonText);
  } catch (err) {
    throw new AppError(`AI returned invalid JSON: ${err.message}`, 502, 'AI_ERROR');
  }
}
