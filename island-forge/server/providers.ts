// AI providers. Claude is the recommended default; any of the others (or the offline
// generator) can be picked. Every provider's answer goes through the same normalizer.
import Anthropic from '@anthropic-ai/sdk';
import { MAP_SCHEMA, MODES, normalizeSpec, generateProcedural, buildSystemPrompt, buildUserPrompt, schemaInstructions, type MapSpec } from '../core/src/index.ts';

export interface ProviderInfo {
  id: string;
  label: string;
  defaultModel: string;
  models: string[];
  needsKey: boolean;
  env?: string;
  keyHint?: string;
  baseUrl?: string;
}

export const PROVIDERS: ProviderInfo[] = [
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
    label: 'ChatGPT (OpenAI)',
    defaultModel: 'gpt-5',
    models: ['gpt-5', 'gpt-5-mini', 'gpt-5-nano', 'gpt-4.1', 'gpt-4o'],
    needsKey: true,
    env: 'OPENAI_API_KEY',
    keyHint: 'sk-...',
    baseUrl: 'https://api.openai.com/v1',
  },
  {
    id: 'gemini',
    label: 'Google Gemini',
    defaultModel: 'gemini-2.5-flash',
    models: ['gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.5-flash-lite'],
    needsKey: true,
    env: 'GEMINI_API_KEY',
    keyHint: 'AIza...',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
  },
  {
    id: 'deepseek',
    label: 'DeepSeek',
    defaultModel: 'deepseek-chat',
    models: ['deepseek-chat', 'deepseek-reasoner'],
    needsKey: true,
    env: 'DEEPSEEK_API_KEY',
    keyHint: 'sk-...',
    baseUrl: 'https://api.deepseek.com',
  },
  {
    id: 'grok',
    label: 'Grok (xAI)',
    defaultModel: 'grok-4',
    models: ['grok-4', 'grok-4-fast', 'grok-3', 'grok-3-mini'],
    needsKey: true,
    env: 'XAI_API_KEY',
    keyHint: 'xai-...',
    baseUrl: 'https://api.x.ai/v1',
  },
  {
    id: 'mistral',
    label: 'Mistral',
    defaultModel: 'mistral-large-latest',
    models: ['mistral-large-latest', 'mistral-medium-latest', 'mistral-small-latest', 'magistral-medium-latest', 'codestral-latest'],
    needsKey: true,
    env: 'MISTRAL_API_KEY',
    keyHint: 'Mistral API key',
    baseUrl: 'https://api.mistral.ai/v1',
  },
  {
    id: 'llama',
    label: 'Llama (Meta Llama API)',
    defaultModel: 'Llama-4-Maverick-17B-128E-Instruct-FP8',
    models: ['Llama-4-Maverick-17B-128E-Instruct-FP8', 'Llama-4-Scout-17B-16E-Instruct-FP8', 'Llama-3.3-70B-Instruct', 'Llama-3.3-8B-Instruct'],
    needsKey: true,
    env: 'LLAMA_API_KEY',
    keyHint: 'LLM|...',
    baseUrl: 'https://api.llama.com/compat/v1',
  },
  {
    id: 'qwen',
    label: 'Qwen (Alibaba Cloud)',
    defaultModel: 'qwen-plus',
    models: ['qwen-max', 'qwen-plus', 'qwen-turbo', 'qwen3-max', 'qwen3-coder-plus'],
    needsKey: true,
    env: 'DASHSCOPE_API_KEY',
    keyHint: 'sk-... (Model Studio / DashScope key)',
    baseUrl: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1',
  },
  {
    id: 'kimi',
    label: 'Kimi (Moonshot AI)',
    defaultModel: 'kimi-k2-turbo-preview',
    models: ['kimi-k2-turbo-preview', 'kimi-k2-0905-preview', 'kimi-latest', 'moonshot-v1-128k'],
    needsKey: true,
    env: 'MOONSHOT_API_KEY',
    keyHint: 'sk-... (Moonshot key)',
    baseUrl: 'https://api.moonshot.ai/v1',
  },
  {
    id: 'compatible',
    label: 'Other OpenAI-compatible (OpenRouter, Groq, LM Studio…)',
    defaultModel: '',
    models: [],
    needsKey: false,
    env: 'OPENAI_COMPATIBLE_API_KEY',
    keyHint: 'API key if the service needs one',
    baseUrl: 'https://openrouter.ai/api/v1',
  },
  { id: 'ollama', label: 'Ollama (local models)', defaultModel: 'llama3.1', models: [], needsKey: false, baseUrl: 'http://localhost:11434' },
  { id: 'offline', label: 'Offline generator (no AI, instant)', defaultModel: 'procedural', models: [], needsKey: false },
];

export function providerStatus(): Record<string, { envKey: boolean }> {
  const out: Record<string, { envKey: boolean }> = {};
  for (const p of PROVIDERS) out[p.id] = { envKey: Boolean(p.env && process.env[p.env]) };
  return out;
}

export function httpError(status: number, message: string): Error & { status: number } {
  return Object.assign(new Error(message), { status });
}

/** Pull a JSON object out of model text (handles code fences and chatter around it). */
export function extractJson(text: unknown): unknown {
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

interface CallArgs {
  apiKey: string;
  baseUrl: string;
  model: string;
  idea: string;
  mode: string;
}

// Models that accept the server-side refusal fallback ("default" form).
const FALLBACK_MODELS = new Set(['claude-opus-5-5', 'claude-opus-5', 'claude-fable-5-1', 'claude-sonnet-5-5']);
const NO_EFFORT_MODELS = /claude-(haiku-4-5|sonnet-4-5|3)/;

async function callClaude({ apiKey, model, idea, mode }: CallArgs): Promise<unknown> {
  const key = apiKey || process.env.ANTHROPIC_API_KEY;
  if (!key) throw httpError(400, 'Add your Anthropic API key (or set ANTHROPIC_API_KEY before starting the server).');
  const client = new Anthropic({ apiKey: key });
  const params = {
    model,
    max_tokens: 32000,
    system: buildSystemPrompt(),
    messages: [{ role: 'user' as const, content: buildUserPrompt(idea, mode) }],
    output_config: {
      format: { type: 'json_schema' as const, schema: MAP_SCHEMA },
      ...(NO_EFFORT_MODELS.test(model) ? {} : { effort: 'medium' as const }),
    },
  };
  let message: { stop_reason: string | null; content: { type: string; text?: string }[] };
  try {
    const stream = FALLBACK_MODELS.has(model)
      ? client.beta.messages.stream({ ...params, betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' } as any)
      : client.messages.stream(params as any);
    message = (await stream.finalMessage()) as any;
  } catch (err: any) {
    if (err instanceof Anthropic.AuthenticationError) throw httpError(401, 'Anthropic rejected the API key.');
    if (err instanceof Anthropic.RateLimitError) throw httpError(429, 'Anthropic rate limit hit — wait a moment and try again.');
    if (err instanceof Anthropic.NotFoundError) throw httpError(400, `Model "${model}" was not found for this API key.`);
    if (err instanceof Anthropic.APIError) throw httpError(err.status && err.status < 500 ? 400 : 502, `Anthropic API error: ${err.message}`);
    throw httpError(502, `Could not reach Anthropic: ${err?.message}`);
  }
  if (message.stop_reason === 'refusal') throw httpError(422, 'Claude declined this prompt. Try rewording your island idea.');
  if (message.stop_reason === 'max_tokens') throw httpError(502, 'The answer was cut off. Try a shorter idea or another model.');
  return extractJson(message.content.filter((b) => b.type === 'text').map((b) => b.text).join(''));
}

async function fetchJson(url: string, init: RequestInit, label: string): Promise<any> {
  let res: Response;
  try {
    res = await fetch(url, { ...init, signal: AbortSignal.timeout(10 * 60 * 1000) });
  } catch (err: any) {
    throw httpError(502, `Could not reach ${label}: ${err.message}`);
  }
  const text = await res.text();
  let data: any = null;
  try {
    data = JSON.parse(text);
  } catch {
    /* not JSON */
  }
  if (!res.ok) {
    const msg = data?.error?.message || data?.error || data?.detail || data?.message || text.slice(0, 300);
    const authFailed = res.status === 401 || res.status === 403 || /api key|authenticat/i.test(String(msg));
    throw httpError(authFailed ? 401 : res.status === 429 ? 429 : 502, `${label} error (${res.status}): ${msg}`);
  }
  return data;
}

/** Chat-completions call shared by ChatGPT, DeepSeek and any OpenAI-compatible service. */
function openAICompatible(opts: { label: string; env: string; defaultBase: string; keyRequired: boolean; extraBody?: (model: string) => Record<string, unknown> }) {
  return async ({ apiKey, model, idea, mode, baseUrl }: CallArgs): Promise<unknown> => {
    const key = apiKey || process.env[opts.env];
    const base = (baseUrl || opts.defaultBase).replace(/\/+$/, '');
    if (!key && opts.keyRequired) throw httpError(400, `Add your ${opts.label} API key (or set ${opts.env}).`);
    if (!model) throw httpError(400, `Type a model name for ${opts.label}.`);
    const data = await fetchJson(
      `${base}/chat/completions`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...(key ? { authorization: `Bearer ${key}` } : {}) },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: `${buildSystemPrompt()}\n\n${schemaInstructions()}` },
            { role: 'user', content: buildUserPrompt(idea, mode) },
          ],
          ...(opts.extraBody ? opts.extraBody(model) : { response_format: { type: 'json_object' } }),
        }),
      },
      opts.label,
    );
    const choice = data?.choices?.[0];
    if (choice?.finish_reason === 'length') throw httpError(502, `${opts.label} ran out of output tokens. Try a shorter idea or another model.`);
    return extractJson(choice?.message?.content);
  };
}

const callOpenAI = openAICompatible({ label: 'ChatGPT (OpenAI)', env: 'OPENAI_API_KEY', defaultBase: 'https://api.openai.com/v1', keyRequired: true });

// DeepSeek: OpenAI-compatible. deepseek-chat supports JSON mode; deepseek-reasoner answers in plain text.
const callDeepSeek = openAICompatible({
  label: 'DeepSeek',
  env: 'DEEPSEEK_API_KEY',
  defaultBase: 'https://api.deepseek.com',
  keyRequired: true,
  extraBody: (model) => (model.includes('reasoner') ? { max_tokens: 32000 } : { response_format: { type: 'json_object' }, max_tokens: 8192 }),
});

const callGrok = openAICompatible({ label: 'Grok (xAI)', env: 'XAI_API_KEY', defaultBase: 'https://api.x.ai/v1', keyRequired: true });

const callMistral = openAICompatible({
  label: 'Mistral',
  env: 'MISTRAL_API_KEY',
  defaultBase: 'https://api.mistral.ai/v1',
  keyRequired: true,
  extraBody: () => ({ response_format: { type: 'json_object' }, max_tokens: 32000 }),
});

// Meta's Llama API is OpenAI-compatible under /compat/v1. JSON is read from the reply text,
// so this also works when the model ignores JSON mode. Running Llama locally? Use Ollama.
const callLlama = openAICompatible({
  label: 'Llama (Meta Llama API)',
  env: 'LLAMA_API_KEY',
  defaultBase: 'https://api.llama.com/compat/v1',
  keyRequired: true,
  extraBody: () => ({ max_tokens: 16000 }),
});

// Qwen through Alibaba Cloud Model Studio (DashScope) compatible mode. Mainland China accounts:
// set the base URL to https://dashscope.aliyuncs.com/compatible-mode/v1.
const callQwen = openAICompatible({
  label: 'Qwen (Alibaba Cloud)',
  env: 'DASHSCOPE_API_KEY',
  defaultBase: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1',
  keyRequired: true,
  extraBody: () => ({ response_format: { type: 'json_object' }, max_tokens: 8192 }),
});

// Kimi through Moonshot AI. Mainland China accounts: base URL https://api.moonshot.cn/v1.
const callKimi = openAICompatible({
  label: 'Kimi (Moonshot AI)',
  env: 'MOONSHOT_API_KEY',
  defaultBase: 'https://api.moonshot.ai/v1',
  keyRequired: true,
  extraBody: () => ({ response_format: { type: 'json_object' }, max_tokens: 16000 }),
});

const callCompatible = openAICompatible({ label: 'OpenAI-compatible API', env: 'OPENAI_COMPATIBLE_API_KEY', defaultBase: 'https://openrouter.ai/api/v1', keyRequired: false });

async function callGemini({ apiKey, model, idea, mode, baseUrl }: CallArgs): Promise<unknown> {
  const key = apiKey || process.env.GEMINI_API_KEY;
  if (!key) throw httpError(400, 'Add your Gemini API key (or set GEMINI_API_KEY).');
  const base = (baseUrl || 'https://generativelanguage.googleapis.com/v1beta').replace(/\/+$/, '');
  const data = await fetchJson(
    `${base}/models/${encodeURIComponent(model)}:generateContent`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: `${buildSystemPrompt()}\n\n${schemaInstructions()}` }] },
        contents: [{ role: 'user', parts: [{ text: buildUserPrompt(idea, mode) }] }],
        generationConfig: { responseMimeType: 'application/json', maxOutputTokens: 32768 },
      }),
    },
    'Gemini',
  );
  const candidate = data?.candidates?.[0];
  if (candidate?.finishReason === 'MAX_TOKENS') throw httpError(502, 'Gemini ran out of output tokens. Try a shorter idea or another model.');
  if (candidate?.finishReason === 'SAFETY') throw httpError(422, 'Gemini declined this prompt. Try rewording your island idea.');
  return extractJson(candidate?.content?.parts?.map((p: any) => p.text).join(''));
}

async function callOllama({ model, idea, mode, baseUrl }: CallArgs): Promise<unknown> {
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

export type Caller = (args: CallArgs) => Promise<unknown>;
const CALLERS: Record<string, Caller> = { anthropic: callClaude, openai: callOpenAI, gemini: callGemini, deepseek: callDeepSeek, grok: callGrok, mistral: callMistral, llama: callLlama, qwen: callQwen, kimi: callKimi, compatible: callCompatible, ollama: callOllama };

export async function generateMap(body: Record<string, any> = {}, callers: Record<string, Caller> = CALLERS): Promise<MapSpec> {
  const mode = MODES[body.mode] ? body.mode : 'reload';
  const idea = String(body.prompt || '').slice(0, 2000);
  const providerId = PROVIDERS.some((p) => p.id === body.provider) ? body.provider : 'anthropic';
  const provider = PROVIDERS.find((p) => p.id === providerId)!;
  const model = String(body.model || provider.defaultModel).trim().slice(0, 120);

  if (providerId === 'offline') return generateProcedural(idea, mode, body.seed ? Number(body.seed) >>> 0 : undefined);

  const raw = (await callers[providerId]({
    apiKey: typeof body.apiKey === 'string' ? body.apiKey.trim() : '',
    baseUrl: typeof body.baseUrl === 'string' ? body.baseUrl.trim() : '',
    model,
    idea,
    mode,
  })) as Record<string, unknown>;
  return normalizeSpec({ ...raw, mode }, mode, { prompt: idea, generator: `${providerId}/${model}` });
}
