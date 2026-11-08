// AI providers. Claude is the recommended default; any of the others (or the offline
// generator) can be picked in the app. Every provider's answer goes through the same normalizer.
import Anthropic from '@anthropic-ai/sdk';
import { MAP_SCHEMA, MODES, normalizeSpec } from './public/lib/modes.js';
import { buildSystemPrompt, buildUserPrompt, schemaInstructions } from './public/lib/prompt.js';
import { generateProcedural } from './public/lib/procedural.js';

export const PROVIDERS = [
  {
    id: 'anthropic',
    label: 'Claude (Anthropic) — recommended',
    defaultModel: 'claude-opus-5-5',
    models: ['claude-opus-5-5', 'claude-sonnet-5-5', 'claude-haiku-5-5', 'claude-fable-5-1'],
    needsKey: true,
    env: 'ANTHROPIC_API_KEY',
    keyHint: 'sk-ant-...',
  },
  {
    id: 'openai',
    label: 'OpenAI or any OpenAI-compatible API',
    defaultModel: 'gpt-5',
    models: [],
    needsKey: true,
    env: 'OPENAI_API_KEY',
    keyHint: 'sk-...',
    baseUrl: 'https://api.openai.com/v1',
  },
  {
    id: 'gemini',
    label: 'Google Gemini',
    defaultModel: 'gemini-2.5-flash',
    models: [],
    needsKey: true,
    env: 'GEMINI_API_KEY',
    keyHint: 'AIza...',
  },
  {
    id: 'ollama',
    label: 'Ollama (local models)',
    defaultModel: 'llama3.1',
    models: [],
    needsKey: false,
    baseUrl: 'http://localhost:11434',
  },
  {
    id: 'offline',
    label: 'Offline generator (no AI, instant)',
    defaultModel: 'procedural',
    models: [],
    needsKey: false,
  },
];

export function providerStatus() {
  const out = {};
  for (const p of PROVIDERS) out[p.id] = { envKey: Boolean(p.env && process.env[p.env]) };
  return out;
}

function httpError(status, message) {
  return Object.assign(new Error(message), { status });
}

/** Pull a JSON object out of model text (handles code fences and chatter around it). */
export function extractJson(text) {
  if (!text || typeof text !== 'string') throw httpError(502, 'The AI returned an empty answer.');
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fenced ? fenced[1] : text;
  const start = body.indexOf('{');
  const end = body.lastIndexOf('}');
  if (start < 0 || end <= start) throw httpError(502, 'The AI did not return JSON. Try again or pick another model.');
  try {
    return JSON.parse(body.slice(start, end + 1));
  } catch {
    throw httpError(502, 'The AI returned malformed JSON. Try again or pick another model.');
  }
}

// Models that accept the server-side refusal fallback ("default" form).
const FALLBACK_MODELS = new Set(['claude-opus-5-5', 'claude-opus-5', 'claude-fable-5-1', 'claude-sonnet-5-5']);
const NO_EFFORT_MODELS = /claude-(haiku-4-5|sonnet-4-5|3)/;

async function callClaude({ apiKey, model, idea, mode }) {
  const key = apiKey || process.env.ANTHROPIC_API_KEY;
  if (!key) throw httpError(400, 'Add your Anthropic API key (or set ANTHROPIC_API_KEY before starting the server).');
  const client = new Anthropic({ apiKey: key });
  const params = {
    model,
    max_tokens: 32000,
    system: buildSystemPrompt(),
    messages: [{ role: 'user', content: buildUserPrompt(idea, mode) }],
    output_config: {
      format: { type: 'json_schema', schema: MAP_SCHEMA },
      ...(NO_EFFORT_MODELS.test(model) ? {} : { effort: 'medium' }),
    },
  };
  let message;
  try {
    const stream = FALLBACK_MODELS.has(model)
      ? client.beta.messages.stream({ ...params, betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' })
      : client.messages.stream(params);
    message = await stream.finalMessage();
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) throw httpError(401, 'Anthropic rejected the API key.');
    if (err instanceof Anthropic.RateLimitError) throw httpError(429, 'Anthropic rate limit hit — wait a moment and try again.');
    if (err instanceof Anthropic.NotFoundError) throw httpError(400, `Model "${model}" was not found for this API key.`);
    if (err instanceof Anthropic.APIError) throw httpError(err.status && err.status < 500 ? 400 : 502, `Anthropic API error: ${err.message}`);
    throw httpError(502, `Could not reach Anthropic: ${err.message}`);
  }
  if (message.stop_reason === 'refusal') throw httpError(422, 'Claude declined this prompt. Try rewording your island idea.');
  if (message.stop_reason === 'max_tokens') throw httpError(502, 'The answer was cut off. Try a shorter idea or another model.');
  const text = message.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
  return extractJson(text);
}

async function fetchJson(url, init, label) {
  let res;
  try {
    res = await fetch(url, { ...init, signal: AbortSignal.timeout(10 * 60 * 1000) });
  } catch (err) {
    throw httpError(502, `Could not reach ${label}: ${err.message}`);
  }
  const text = await res.text();
  let data = null;
  try {
    data = JSON.parse(text);
  } catch {
    /* not JSON */
  }
  if (!res.ok) {
    const msg = data?.error?.message || data?.error || text.slice(0, 300);
    throw httpError(res.status === 401 || res.status === 403 ? 401 : res.status === 429 ? 429 : 502, `${label} error (${res.status}): ${msg}`);
  }
  return data;
}

async function callOpenAI({ apiKey, model, idea, mode, baseUrl }) {
  const key = apiKey || process.env.OPENAI_API_KEY;
  const base = (baseUrl || 'https://api.openai.com/v1').replace(/\/+$/, '');
  if (!key && base.includes('api.openai.com')) throw httpError(400, 'Add your OpenAI API key (or set OPENAI_API_KEY).');
  const data = await fetchJson(
    `${base}/chat/completions`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(key ? { authorization: `Bearer ${key}` } : {}) },
      body: JSON.stringify({
        model,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: `${buildSystemPrompt()}\n\n${schemaInstructions()}` },
          { role: 'user', content: buildUserPrompt(idea, mode) },
        ],
      }),
    },
    'OpenAI-compatible API',
  );
  return extractJson(data?.choices?.[0]?.message?.content);
}

async function callGemini({ apiKey, model, idea, mode }) {
  const key = apiKey || process.env.GEMINI_API_KEY;
  if (!key) throw httpError(400, 'Add your Gemini API key (or set GEMINI_API_KEY).');
  const data = await fetchJson(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: `${buildSystemPrompt()}\n\n${schemaInstructions()}` }] },
        contents: [{ role: 'user', parts: [{ text: buildUserPrompt(idea, mode) }] }],
        generationConfig: { responseMimeType: 'application/json' },
      }),
    },
    'Gemini',
  );
  return extractJson(data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join(''));
}

async function callOllama({ model, idea, mode, baseUrl }) {
  const base = (baseUrl || 'http://localhost:11434').replace(/\/+$/, '');
  const data = await fetchJson(
    `${base}/api/chat`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        model,
        stream: false,
        format: MAP_SCHEMA,
        messages: [
          { role: 'system', content: `${buildSystemPrompt()}\n\n${schemaInstructions()}` },
          { role: 'user', content: buildUserPrompt(idea, mode) },
        ],
      }),
    },
    'Ollama',
  );
  return extractJson(data?.message?.content);
}

const CALLERS = { anthropic: callClaude, openai: callOpenAI, gemini: callGemini, ollama: callOllama };

export async function generateMap(body = {}, callers = CALLERS) {
  const mode = MODES[body.mode] ? body.mode : 'reload';
  const idea = String(body.prompt || '').slice(0, 2000);
  const providerId = PROVIDERS.some((p) => p.id === body.provider) ? body.provider : 'anthropic';
  const provider = PROVIDERS.find((p) => p.id === providerId);
  const model = String(body.model || provider.defaultModel).trim().slice(0, 120);

  if (providerId === 'offline') return generateProcedural(idea, mode, body.seed ? Number(body.seed) >>> 0 : undefined);

  const raw = await callers[providerId]({
    apiKey: typeof body.apiKey === 'string' ? body.apiKey.trim() : '',
    baseUrl: typeof body.baseUrl === 'string' ? body.baseUrl.trim() : '',
    model,
    idea,
    mode,
  });
  return normalizeSpec({ ...raw, mode }, mode, { prompt: idea, generator: `${providerId}/${model}` });
}
