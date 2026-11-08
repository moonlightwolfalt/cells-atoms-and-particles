// AI providers. Claude is the recommended default; any of the others (or the offline
// generator) can be picked. Every provider's answer goes through the same normalizer.
import Anthropic from '@anthropic-ai/sdk';
import { timingSafeEqual, createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
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
  /** The app can load this provider's full, live model list with the user's key. */
  liveModels?: boolean;
}

export const PROVIDERS: ProviderInfo[] = [
  {
    id: 'anthropic',
    label: 'Claude (Anthropic) — recommended',
    defaultModel: 'claude-opus-5-5',
    models: ['claude-opus-5-5', 'claude-sonnet-5-5', 'claude-haiku-5-5', 'claude-fable-5-1', 'claude-fable-5', 'claude-opus-5', 'claude-sonnet-5', 'claude-opus-4-8', 'claude-opus-4-7', 'claude-opus-4-6', 'claude-sonnet-4-6', 'claude-haiku-4-5'],
    needsKey: true,
    env: 'ANTHROPIC_API_KEY',
    keyHint: 'sk-ant-...',
    liveModels: true,
  },
  {
    id: 'claude_code',
    label: 'Claude Code (Agent SDK, runs on this computer)',
    defaultModel: 'default',
    models: ['default', 'claude-opus-5-5', 'claude-sonnet-5-5', 'claude-haiku-5-5'],
    needsKey: true,
    env: 'ANTHROPIC_API_KEY',
    keyHint: 'sk-ant-... (Anthropic API key)',
    liveModels: true,
  },
  {
    id: 'openai',
    label: 'ChatGPT (OpenAI)',
    defaultModel: 'gpt-5',
    models: ['gpt-5', 'gpt-5-mini', 'gpt-5-nano', 'gpt-5-chat-latest', 'gpt-4.1', 'gpt-4.1-mini', 'gpt-4.1-nano', 'gpt-4o', 'gpt-4o-mini', 'chatgpt-4o-latest', 'o3', 'o3-mini', 'o4-mini', 'o1', 'gpt-4-turbo', 'gpt-3.5-turbo'],
    needsKey: true,
    env: 'OPENAI_API_KEY',
    keyHint: 'sk-...',
    baseUrl: 'https://api.openai.com/v1',
    liveModels: true,
  },
  {
    id: 'gemini',
    label: 'Google Gemini',
    defaultModel: 'gemini-2.5-flash',
    models: ['gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-flash-latest', 'gemini-flash-lite-latest', 'gemini-2.0-flash', 'gemini-2.0-flash-lite', 'gemma-3-27b-it', 'gemma-3-12b-it'],
    needsKey: true,
    env: 'GEMINI_API_KEY',
    keyHint: 'AIza...',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    liveModels: true,
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

// ---------------------------------------------------------------- Access policy
// ISLAND_FORGE_PUBLIC=1 (set in the Docker image) hardens the server for the internet:
//  - API keys set on the server are only used by visitors who send ISLAND_FORGE_PASSCODE
//    (or by everyone if ALLOW_SHARED_KEYS=1). With neither set, visitors bring their own key.
//  - Custom base URLs are refused unless listed in ALLOWED_BASE_URLS (comma-separated),
//    so visitors can't make the server call internal addresses.

export type ServerKeys = 'open' | 'passcode' | 'off';

export interface AccessPolicy {
  public: boolean;
  serverKeys: ServerKeys;
  allowedBaseUrls: string[] | null;
}

const trimUrl = (u: string) => u.trim().replace(/\/+$/, '');

export function accessPolicy(env: NodeJS.ProcessEnv = process.env): AccessPolicy {
  const isPublic = env.ISLAND_FORGE_PUBLIC === '1' || env.ISLAND_FORGE_PUBLIC === 'true';
  if (!isPublic) return { public: false, serverKeys: 'open', allowedBaseUrls: null };
  const serverKeys: ServerKeys = env.ALLOW_SHARED_KEYS === '1' ? 'open' : env.ISLAND_FORGE_PASSCODE ? 'passcode' : 'off';
  const allowedBaseUrls = (env.ALLOWED_BASE_URLS || '').split(',').map(trimUrl).filter(Boolean);
  return { public: true, serverKeys, allowedBaseUrls };
}

function passcodeMatches(given: string | undefined, env: NodeJS.ProcessEnv = process.env): boolean {
  const want = env.ISLAND_FORGE_PASSCODE || '';
  if (!want || !given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(want);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function providerStatus(): Record<string, { envKey: boolean; available: boolean }> {
  const policy = accessPolicy();
  const out: Record<string, { envKey: boolean; available: boolean }> = {};
  for (const p of PROVIDERS) {
    const envKey = Boolean(p.env && process.env[p.env]) && policy.serverKeys !== 'off';
    // On a public server Ollama (localhost) only works if its address is allow-listed, and
    // Claude Code (a local agent runtime) is off.
    const available = !policy.public || (p.id === 'ollama' ? Boolean(policy.allowedBaseUrls?.length) : p.id !== 'claude_code');
    out[p.id] = { envKey, available };
  }
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

/**
 * Rescue an answer that was cut off mid-JSON (the model hit its output limit): keep every
 * element that was finished, drop the one being written, and close the open brackets. The
 * normalizer fills in whatever is missing. Returns null when nothing usable is left.
 */
export function salvageJson(text: unknown): Record<string, unknown> | null {
  if (typeof text !== 'string') return null;
  const s = text.replace(/^[\s\S]*?```(?:json)?\s*/i, (m) => (m.includes('```') ? '' : m));
  const start = s.indexOf('{');
  if (start < 0) return null;
  const stack: string[] = [];
  const cuts: { at: number; closers: string }[] = [];
  let inString = false;
  let escaped = false;
  for (let i = start; i < s.length; i++) {
    const c = s[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (c === '\\') escaped = true;
      else if (c === '"') inString = false;
      continue;
    }
    if (c === '"') inString = true;
    else if (c === '{' || c === '[') stack.push(c === '{' ? '}' : ']');
    else if (c === '}' || c === ']') {
      stack.pop();
      if (stack.length === 0) {
        try {
          return JSON.parse(s.slice(start, i + 1));
        } catch {
          return null;
        }
      }
      cuts.push({ at: i + 1, closers: [...stack].reverse().join('') });
    } else if (c === ',') cuts.push({ at: i, closers: [...stack].reverse().join('') });
  }
  // Prefer cutting between list items or top-level fields, so a half-written location or feature
  // is dropped rather than kept without its position. Latest cut first; a few attempts is enough.
  const recent = cuts.slice(-60).reverse();
  const clean = recent.filter((c) => c.closers === '}' || c.closers.startsWith(']'));
  for (const cut of [...clean, ...recent]) {
    try {
      const value = JSON.parse(s.slice(start, cut.at) + cut.closers);
      if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>;
    } catch {
      /* try an earlier cut */
    }
  }
  return null;
}

/** For answers that hit the output limit: salvage them if enough of the island made it. */
function salvageOrThrow(text: unknown, label: string): Record<string, unknown> {
  const value = salvageJson(text);
  if (value && Array.isArray(value.pois) && value.pois.length > 0) return { ...value, __truncated: true };
  throw httpError(502, `${label} ran out of output tokens before finishing the island. Try a smaller island type or a model with a bigger output limit.`);
}

interface CallArgs {
  apiKey: string;
  /** Whether keys set on the server (environment variables) may be used for this request. */
  useEnvKeys: boolean;
  baseUrl: string;
  model: string;
  idea: string;
  mode: string;
}

// Models that accept the server-side refusal fallback ("default" form).
const FALLBACK_MODELS = new Set(['claude-opus-5-5', 'claude-opus-5', 'claude-fable-5-1', 'claude-sonnet-5-5']);
// Used only when the Models API can't be reached: older models without effort / structured outputs.
const NO_EFFORT_MODELS = /claude-(haiku-4-5|sonnet-4-5|opus-4-5|opus-4-1|opus-4-0|sonnet-4-0|3)/;
const NO_STRUCTURED_MODELS = /claude-(3|sonnet-4-0|opus-4-0|opus-4-1|sonnet-4-2)/;

function anthropicClient(key: string, baseUrl: string) {
  return new Anthropic({ apiKey: key, ...(baseUrl ? { baseURL: baseUrl } : {}) });
}

function anthropicError(err: any, model?: string): Error & { status: number } {
  if (err instanceof Anthropic.AuthenticationError) return httpError(401, 'Anthropic rejected the API key.');
  if (err instanceof Anthropic.PermissionDeniedError) return httpError(403, model ? `This API key can't use "${model}".` : 'This API key lacks permission.');
  if (err instanceof Anthropic.RateLimitError) return httpError(429, 'Anthropic rate limit hit — wait a moment and try again.');
  if (err instanceof Anthropic.NotFoundError) return httpError(400, model ? `Model "${model}" was not found for this API key.` : 'Not found.');
  if (err instanceof Anthropic.APIError) return httpError(err.status && err.status < 500 ? 400 : 502, `Anthropic API error: ${err.message}`);
  return httpError(502, `Could not reach Anthropic: ${err?.message}`);
}

interface ClaudeModelFacts {
  maxTokens: number | null;
  structured: boolean;
  effort: boolean;
}

const claudeFactsCache = new Map<string, { at: number; facts: ClaudeModelFacts }>();

/** What a Claude model supports, from the Models API (cached); falls back to known model families. */
async function claudeModelFacts(client: Anthropic, key: string, model: string): Promise<ClaudeModelFacts> {
  const cacheKey = `${createHash('sha256').update(key).digest('hex')}|${model}`;
  const hit = claudeFactsCache.get(cacheKey);
  if (hit && Date.now() - hit.at < 60 * 60 * 1000) return hit.facts;
  let facts: ClaudeModelFacts;
  try {
    const info: any = await client.models.retrieve(model);
    const caps = info?.capabilities;
    facts = {
      maxTokens: typeof info?.max_tokens === 'number' ? info.max_tokens : null,
      structured: caps ? Boolean(caps.structured_outputs?.supported) : !NO_STRUCTURED_MODELS.test(model),
      effort: caps ? Boolean(caps.effort?.supported && caps.effort?.medium?.supported) : !NO_EFFORT_MODELS.test(model),
    };
  } catch (err: any) {
    if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.NotFoundError || err instanceof Anthropic.PermissionDeniedError) throw anthropicError(err, model);
    facts = { maxTokens: null, structured: !NO_STRUCTURED_MODELS.test(model), effort: !NO_EFFORT_MODELS.test(model) };
  }
  if (claudeFactsCache.size > 500) claudeFactsCache.clear();
  claudeFactsCache.set(cacheKey, { at: Date.now(), facts });
  return facts;
}

async function callClaude({ apiKey, useEnvKeys, model, idea, mode, baseUrl }: CallArgs): Promise<unknown> {
  const key = apiKey || (useEnvKeys ? process.env.ANTHROPIC_API_KEY : '');
  if (!key) throw httpError(400, 'Add your Anthropic API key (or set ANTHROPIC_API_KEY before starting the server).');
  const client = anthropicClient(key, baseUrl);
  // Build the request from what this model supports: its output limit, structured outputs
  // (otherwise the schema goes in the prompt) and effort. A rejected option is dropped and retried.
  const facts = await claudeModelFacts(client, key, model);
  const use = { structured: facts.structured, effort: facts.effort, maxTokens: Math.min(32000, facts.maxTokens || 32000), fallback: FALLBACK_MODELS.has(model) };
  let message: { stop_reason: string | null; content: { type: string; text?: string }[] } | null = null;
  for (let attempt = 0; attempt < 4 && !message; attempt++) {
    const outputConfig: Record<string, unknown> = {};
    if (use.structured) outputConfig.format = { type: 'json_schema', schema: MAP_SCHEMA };
    if (use.effort) outputConfig.effort = 'medium';
    const params: Record<string, unknown> = {
      model,
      max_tokens: use.maxTokens,
      system: use.structured ? buildSystemPrompt() : `${buildSystemPrompt()}\n\n${schemaInstructions()}`,
      messages: [{ role: 'user', content: buildUserPrompt(idea, mode) }],
      ...(Object.keys(outputConfig).length ? { output_config: outputConfig } : {}),
    };
    try {
      const stream = use.fallback
        ? client.beta.messages.stream({ ...params, betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' } as any)
        : client.messages.stream(params as any);
      message = (await stream.finalMessage()) as any;
    } catch (err: any) {
      const text = String(err?.message || '');
      if (err instanceof Anthropic.BadRequestError) {
        if (use.fallback && /fallback/i.test(text)) use.fallback = false;
        else if (use.structured && /output_config\.format|structured output|json_schema|format/i.test(text)) use.structured = false;
        else if (use.effort && /effort/i.test(text)) use.effort = false;
        else if (use.maxTokens > 4096 && /max_tokens/i.test(text)) use.maxTokens = use.maxTokens > 8192 ? 8192 : 4096;
        else throw anthropicError(err, model);
        continue;
      }
      throw anthropicError(err, model);
    }
  }
  if (!message) throw httpError(502, `Claude kept rejecting the request for model "${model}". Try another model.`);
  if (message.stop_reason === 'refusal') throw httpError(422, 'Claude declined this prompt. Try rewording your island idea.');
  const text = message.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
  if (message.stop_reason === 'max_tokens') return salvageOrThrow(text, 'Claude');
  return extractJson(text);
}

// ---------------------------------------------------------------- Claude Code (Agent SDK)
// Runs Claude through Claude Code's agent runtime on this machine, with every tool turned off
// so it only writes the layout. Auth is an Anthropic API key (or Bedrock / Vertex / Foundry via
// Claude Code's CLAUDE_CODE_USE_* variables). Anthropic doesn't allow third-party apps to use a
// claude.ai / Claude subscription login, so subscription tokens are stripped from its environment.
const CLOUD_FLAGS = ['CLAUDE_CODE_USE_BEDROCK', 'CLAUDE_CODE_USE_VERTEX', 'CLAUDE_CODE_USE_FOUNDRY', 'CLAUDE_CODE_USE_ANTHROPIC_AWS'];

async function callClaudeCode({ apiKey, useEnvKeys, model, idea, mode }: CallArgs): Promise<unknown> {
  const key = apiKey || (useEnvKeys ? process.env.ANTHROPIC_API_KEY : '');
  const cloud = useEnvKeys && CLOUD_FLAGS.some((k) => process.env[k]);
  if (!key && !cloud) {
    throw httpError(400, 'Claude Code needs an Anthropic API key (or Bedrock/Vertex set up for Claude Code). Anthropic does not allow apps to use a Claude subscription login.');
  }
  let sdk: any;
  try {
    sdk = await import('@anthropic-ai/claude-agent-sdk');
  } catch {
    throw httpError(501, 'Claude Code is not installed here. Run "npm install" in island-forge (it is an optional dependency).');
  }
  const env = claudeCodeEnv(key || '', Boolean(cloud));
  const configDir = await mkdtemp(join(tmpdir(), 'island-forge-cc-'));
  env.CLAUDE_CONFIG_DIR = configDir;

  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), 10 * 60 * 1000);
  try {
    const run = sdk.query({
      prompt: buildUserPrompt(idea, mode),
      options: {
        systemPrompt: `${buildSystemPrompt()}\n\n${schemaInstructions()}`,
        tools: [],
        maxTurns: 1,
        ...(model && model !== 'default' ? { model } : {}),
        settingSources: [],
        persistSession: false,
        cwd: tmpdir(),
        env,
        abortController: abort,
      },
    });
    for await (const msg of run) {
      if (msg?.type !== 'result') continue;
      if (msg.subtype === 'success' && !msg.is_error) return extractJson(msg.result);
      const detail = String(msg.result || msg.errors?.join?.(' ') || msg.subtype || 'unknown error');
      const status = msg.api_error_status === 401 || /api key|authenticat|not logged in/i.test(detail) ? 401 : 502;
      throw httpError(status, `Claude Code error: ${detail.slice(0, 300)}`);
    }
    throw httpError(502, 'Claude Code finished without an answer.');
  } catch (err: any) {
    if (err?.status) throw err;
    if (abort.signal.aborted) throw httpError(504, 'Claude Code took too long.');
    throw httpError(502, `Claude Code failed: ${String(err?.message || err).slice(0, 300)}`);
  } finally {
    clearTimeout(timer);
    await rm(configDir, { recursive: true, force: true }).catch(() => {});
  }
}

/**
 * The Claude Code child process gets a minimal, allow-listed environment and an empty config
 * folder, so the only credential it can see is the one passed here. It never inherits a
 * claude.ai / subscription login, a parent Claude Code session, or a custom ANTHROPIC_BASE_URL.
 */
export function claudeCodeEnv(key: string, cloud: boolean, source: NodeJS.ProcessEnv = process.env): Record<string, string> {
  const pass = ['PATH', 'HOME', 'TMPDIR', 'TEMP', 'TMP', 'LANG', 'LC_ALL', 'SYSTEMROOT', 'USERPROFILE', 'APPDATA', 'LOCALAPPDATA',
    'HTTPS_PROXY', 'HTTP_PROXY', 'NO_PROXY', 'https_proxy', 'http_proxy', 'no_proxy', 'NODE_EXTRA_CA_CERTS', 'SSL_CERT_FILE', 'SSL_CERT_DIR'];
  // Cloud-provider setups (Bedrock / Vertex / Foundry) need their own credentials and settings.
  const cloudPrefixes = ['AWS_', 'GOOGLE_', 'GCLOUD_', 'CLOUDSDK_', 'AZURE_', 'ANTHROPIC_VERTEX_', 'ANTHROPIC_AWS_', 'ANTHROPIC_FOUNDRY_', 'VERTEX_', 'CLOUD_ML_REGION'];
  const env: Record<string, string> = { CLAUDE_AGENT_SDK_CLIENT_APP: 'island-forge/2.0' };
  for (const [k, v] of Object.entries(source)) {
    if (v === undefined) continue;
    if (pass.includes(k)) env[k] = v;
    else if (cloud && (CLOUD_FLAGS.includes(k) || cloudPrefixes.some((p) => k.startsWith(p)))) env[k] = v;
  }
  if (key) env.ANTHROPIC_API_KEY = key;
  return env;
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

/** True when a provider's 4xx message says the request used something this model doesn't accept. */
const says = (err: any, re: RegExp) => err?.status === 502 && re.test(String(err.message));

/**
 * Chat-completions call shared by ChatGPT, DeepSeek and any OpenAI-compatible service. Model
 * families differ (no system role, no JSON mode, max_completion_tokens, Responses-only models),
 * so a rejected request is adjusted and retried instead of failing.
 */
function openAICompatible(opts: {
  label: string;
  env: string;
  defaultBase: string;
  keyRequired: boolean;
  extraBody?: (model: string) => Record<string, unknown>;
  /** OpenAI: models that only work on /v1/responses are retried there. */
  responsesFallback?: boolean;
}) {
  return async ({ apiKey, useEnvKeys, model, idea, mode, baseUrl }: CallArgs): Promise<unknown> => {
    const key = apiKey || (useEnvKeys ? process.env[opts.env] : '');
    const base = (baseUrl || opts.defaultBase).replace(/\/+$/, '');
    if (!key && opts.keyRequired) throw httpError(400, `Add your ${opts.label} API key (or set ${opts.env}).`);
    if (!model) throw httpError(400, `Type a model name for ${opts.label}.`);
    const system = `${buildSystemPrompt()}\n\n${schemaInstructions()}`;
    const user = buildUserPrompt(idea, mode);
    const headers = { 'content-type': 'application/json', ...(key ? { authorization: `Bearer ${key}` } : {}) };
    const tried = { mergeSystem: false, noJson: false, completionTokens: false, noLimit: false };
    for (let attempt = 0; attempt < 5; attempt++) {
      const body: Record<string, any> = {
        model,
        messages: tried.mergeSystem
          ? [{ role: 'user', content: `${system}\n\n${user}` }]
          : [{ role: 'system', content: system }, { role: 'user', content: user }],
        ...(opts.extraBody ? opts.extraBody(model) : { response_format: { type: 'json_object' } }),
      };
      if (tried.noJson) delete body.response_format;
      if (tried.completionTokens && body.max_tokens) {
        body.max_completion_tokens = body.max_tokens;
        delete body.max_tokens;
      }
      if (tried.noLimit) {
        delete body.max_tokens;
        delete body.max_completion_tokens;
      }
      let data: any;
      try {
        data = await fetchJson(`${base}/chat/completions`, { method: 'POST', headers, body: JSON.stringify(body) }, opts.label);
      } catch (err: any) {
        if (opts.responsesFallback && says(err, /v1\/responses|only supported in|not supported (in|with) the v1\/chat\/completions|not a chat model|use the responses api/i)) {
          return callOpenAIResponses(base, headers, model, opts.label, system, user);
        }
        if (!tried.mergeSystem && says(err, /'system'|role.{0,20}system|system (message|role|prompt)s? (is|are) not|developer/i)) tried.mergeSystem = true;
        else if (!tried.noJson && says(err, /response_format|json_object|json mode|json output/i)) tried.noJson = true;
        else if (!tried.completionTokens && says(err, /max_completion_tokens/i)) tried.completionTokens = true;
        else if (!tried.noLimit && says(err, /max_tokens|max_completion_tokens|maximum.{0,20}tokens/i)) tried.noLimit = true;
        else throw err;
        continue;
      }
      const choice = data?.choices?.[0];
      if (choice?.finish_reason === 'length') return salvageOrThrow(choice?.message?.content, opts.label);
      return extractJson(choice?.message?.content);
    }
    throw httpError(502, `${opts.label} kept rejecting the request for model "${model}". Try another model.`);
  };
}

/** OpenAI Responses API, for models that aren't available on chat completions. */
async function callOpenAIResponses(base: string, headers: Record<string, string>, model: string, label: string, system: string, user: string): Promise<unknown> {
  let json = true;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const data = await fetchJson(
        `${base}/responses`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({ model, instructions: system, input: user, max_output_tokens: 32000, ...(json ? { text: { format: { type: 'json_object' } } } : {}) }),
        },
        label,
      );
      const text =
        (data?.output || [])
          .flatMap((o: any) => o?.content || [])
          .filter((c: any) => c?.type === 'output_text')
          .map((c: any) => c.text)
          .join('') || data?.output_text;
      if (data?.status === 'incomplete' && data?.incomplete_details?.reason === 'max_output_tokens') return salvageOrThrow(text, label);
      return extractJson(text);
    } catch (err: any) {
      if (json && says(err, /format|json/i)) {
        json = false;
        continue;
      }
      throw err;
    }
  }
  throw httpError(502, `${label} rejected model "${model}".`);
}

const callOpenAI = openAICompatible({ label: 'ChatGPT (OpenAI)', env: 'OPENAI_API_KEY', defaultBase: 'https://api.openai.com/v1', keyRequired: true, responsesFallback: true });

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

async function callGemini({ apiKey, useEnvKeys, model, idea, mode, baseUrl }: CallArgs): Promise<unknown> {
  const key = apiKey || (useEnvKeys ? process.env.GEMINI_API_KEY : '');
  if (!key) throw httpError(400, 'Add your Gemini API key (or set GEMINI_API_KEY).');
  const base = (baseUrl || 'https://generativelanguage.googleapis.com/v1beta').replace(/\/+$/, '');
  const system = `${buildSystemPrompt()}\n\n${schemaInstructions()}`;
  const user = buildUserPrompt(idea, mode);
  // Gemma and older models reject system instructions, JSON mode or big output limits: adjust and retry.
  const tried = { mergeSystem: /^gemma/i.test(model), noJson: false, limit: 32768 as number | null };
  for (let attempt = 0; attempt < 5; attempt++) {
    const generationConfig: Record<string, unknown> = {};
    if (!tried.noJson) generationConfig.responseMimeType = 'application/json';
    if (tried.limit) generationConfig.maxOutputTokens = tried.limit;
    const body = {
      ...(tried.mergeSystem ? {} : { systemInstruction: { parts: [{ text: system }] } }),
      contents: [{ role: 'user', parts: [{ text: tried.mergeSystem ? `${system}\n\n${user}` : user }] }],
      generationConfig,
    };
    let data: any;
    try {
      data = await fetchJson(`${base}/models/${encodeURIComponent(model)}:generateContent`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-goog-api-key': key }, body: JSON.stringify(body) }, 'Gemini');
    } catch (err: any) {
      if (!tried.mergeSystem && says(err, /system.?instruction|developer instruction/i)) tried.mergeSystem = true;
      else if (!tried.noJson && says(err, /response.?mime.?type|json mode|mime type/i)) tried.noJson = true;
      else if (tried.limit && says(err, /max.?output.?tokens/i)) tried.limit = tried.limit > 8192 ? 8192 : null;
      else throw err;
      continue;
    }
    const candidate = data?.candidates?.[0];
    const text = candidate?.content?.parts?.filter((p: any) => !p.thought).map((p: any) => p.text).join('');
    if (candidate?.finishReason === 'MAX_TOKENS') return salvageOrThrow(text, 'Gemini');
    if (candidate?.finishReason === 'SAFETY' || data?.promptFeedback?.blockReason) throw httpError(422, 'Gemini declined this prompt. Try rewording your island idea.');
    return extractJson(text);
  }
  throw httpError(502, `Gemini kept rejecting the request for model "${model}". Try another model.`);
}

// ---------------------------------------------------------------- Live model lists
// "All models" changes constantly, so ask the provider which text models this key can use.

export interface ModelInfo {
  id: string;
  label?: string;
}

const OPENAI_NOT_TEXT = /embedding|whisper|tts|dall-e|davinci|babbage|moderation|audio|realtime|transcribe|image|search|computer-use|sora|instruct/i;
const GEMINI_NOT_TEXT = /embedding|aqa|imagen|veo|tts|native-audio|live|image|robotics|computer-use|lyria/i;

async function listOpenAIModels(base: string, key: string): Promise<ModelInfo[]> {
  const data = await fetchJson(`${base}/models`, { headers: { authorization: `Bearer ${key}` } }, 'ChatGPT (OpenAI)');
  return (data?.data || [])
    .filter((m: any) => typeof m?.id === 'string' && /^(gpt|o\d|chatgpt)/i.test(m.id) && !OPENAI_NOT_TEXT.test(m.id))
    .sort((a: any, b: any) => (b.created || 0) - (a.created || 0) || String(a.id).localeCompare(String(b.id)))
    .map((m: any) => ({ id: m.id }));
}

async function listGeminiModels(base: string, key: string): Promise<ModelInfo[]> {
  const out: ModelInfo[] = [];
  let pageToken = '';
  for (let page = 0; page < 10; page++) {
    const data = await fetchJson(`${base}/models?pageSize=1000${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ''}`, { headers: { 'x-goog-api-key': key } }, 'Gemini');
    for (const m of data?.models || []) {
      const id = String(m?.name || '').replace(/^models\//, '');
      if (!id || !(m.supportedGenerationMethods || []).includes('generateContent') || GEMINI_NOT_TEXT.test(id)) continue;
      out.push({ id, label: m.displayName && m.displayName !== id ? `${m.displayName}` : undefined });
    }
    pageToken = data?.nextPageToken || '';
    if (!pageToken) break;
  }
  // Gemini before Gemma, newest version first.
  const rank = (id: string) => (id.startsWith('gemini') ? 0 : 1);
  return out.sort((a, b) => rank(a.id) - rank(b.id) || b.id.localeCompare(a.id, undefined, { numeric: true }));
}

async function listClaudeModels(base: string, key: string): Promise<ModelInfo[]> {
  const out: ModelInfo[] = [];
  try {
    for await (const m of anthropicClient(key, base).models.list({ limit: 100 } as any) as any) {
      if (m?.lifecycle === 'retired') continue;
      out.push({ id: m.id, label: `${m.display_name || m.id}${m.lifecycle === 'deprecated' ? ' (deprecated)' : ''}` });
      if (out.length >= 500) break;
    }
  } catch (err) {
    throw anthropicError(err);
  }
  return out;
}

async function listClaudeCodeModels(base: string, key: string): Promise<ModelInfo[]> {
  return [{ id: 'default', label: "Claude Code's default model" }, ...(await listClaudeModels(base, key))];
}

const LISTERS: Record<string, { list: (base: string, key: string) => Promise<ModelInfo[]>; base: string; env: string; label: string }> = {
  anthropic: { list: listClaudeModels, base: '', env: 'ANTHROPIC_API_KEY', label: 'Claude (Anthropic)' },
  claude_code: { list: listClaudeCodeModels, base: '', env: 'ANTHROPIC_API_KEY', label: 'Claude Code' },
  openai: { list: listOpenAIModels, base: 'https://api.openai.com/v1', env: 'OPENAI_API_KEY', label: 'ChatGPT (OpenAI)' },
  gemini: { list: listGeminiModels, base: 'https://generativelanguage.googleapis.com/v1beta', env: 'GEMINI_API_KEY', label: 'Gemini' },
};

const modelCache = new Map<string, { at: number; models: ModelInfo[] }>();

/** Every text model the given key can use, straight from the provider (cached 10 minutes). */
export async function listModels(body: Record<string, any> = {}, request: { passcode?: string } = {}): Promise<{ models: ModelInfo[]; source: 'live' }> {
  const lister = LISTERS[body.provider];
  if (!lister) throw httpError(400, 'Live model lists are available for Claude, Claude Code, ChatGPT (OpenAI) and Gemini.');
  const { apiKey, baseUrl, useEnvKeys } = resolveAccess(String(body.provider), body, request);
  const key = apiKey || (useEnvKeys ? process.env[lister.env] || '' : '');
  if (!key) throw httpError(400, `Add your ${lister.label} API key to load its models.`);
  const base = (baseUrl || lister.base).replace(/\/+$/, '');
  const cacheKey = `${body.provider}|${base}|${createHash('sha256').update(key).digest('hex')}`;
  const hit = modelCache.get(cacheKey);
  if (hit && Date.now() - hit.at < 10 * 60 * 1000) return { models: hit.models, source: 'live' };
  const models = await lister.list(base, key);
  if (modelCache.size > 200) modelCache.clear();
  modelCache.set(cacheKey, { at: Date.now(), models });
  return { models, source: 'live' };
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
const CALLERS: Record<string, Caller> = { anthropic: callClaude, claude_code: callClaudeCode, openai: callOpenAI, gemini: callGemini, deepseek: callDeepSeek, grok: callGrok, mistral: callMistral, llama: callLlama, qwen: callQwen, kimi: callKimi, compatible: callCompatible, ollama: callOllama };

/** Applies the access policy: which key and base URL a request may use. */
function resolveAccess(providerId: string, body: Record<string, any>, request: { passcode?: string }): { apiKey: string; baseUrl: string; useEnvKeys: boolean } {
  const policy = accessPolicy();
  const provider = PROVIDERS.find((p) => p.id === providerId) || PROVIDERS[0];
  const apiKey = typeof body.apiKey === 'string' ? body.apiKey.trim() : '';
  let baseUrl = typeof body.baseUrl === 'string' ? trimUrl(body.baseUrl) : '';
  if (policy.public) {
    const fallback = trimUrl(provider.baseUrl || '');
    const target = baseUrl || fallback;
    const allowed = policy.allowedBaseUrls || [];
    const isDefault = target === fallback && !/^http:\/\/(localhost|127\.)/.test(fallback);
    if (target && !isDefault && !allowed.includes(target)) {
      throw httpError(403, providerId === 'ollama'
        ? 'Ollama runs on your own computer, so it is turned off on this public server. Run Island Forge locally to use it.'
        : 'Custom base URLs are turned off on this server. Clear the Base URL field, or ask the owner to add it to ALLOWED_BASE_URLS.');
    }
    baseUrl = target === fallback ? '' : target;
    if (providerId === 'claude_code') throw httpError(403, 'Claude Code runs on your own computer, so it is turned off on this public server. Run Island Forge locally to use it.');
  }
  const useEnvKeys = policy.serverKeys === 'open' || (policy.serverKeys === 'passcode' && passcodeMatches(request.passcode));
  if (!apiKey && policy.serverKeys === 'passcode' && !useEnvKeys && provider.env && process.env[provider.env]) {
    throw httpError(401, request.passcode ? 'Wrong server passcode.' : 'This server has a shared key — enter the server passcode, or paste your own API key.');
  }

  return { apiKey, baseUrl, useEnvKeys };
}

export async function generateMap(body: Record<string, any> = {}, callers: Record<string, Caller> = CALLERS, request: { passcode?: string } = {}): Promise<MapSpec> {
  const mode = MODES[body.mode] ? body.mode : 'reload';
  const idea = String(body.prompt || '').slice(0, 2000);
  const providerId = PROVIDERS.some((p) => p.id === body.provider) ? body.provider : 'anthropic';
  const provider = PROVIDERS.find((p) => p.id === providerId)!;
  const model = String(body.model || provider.defaultModel).trim().slice(0, 120);

  if (providerId === 'offline') return generateProcedural(idea, mode, body.seed ? Number(body.seed) >>> 0 : undefined);

  const { apiKey, baseUrl, useEnvKeys } = resolveAccess(providerId, body, request);

  const raw = (await callers[providerId]({
    apiKey,
    useEnvKeys,
    baseUrl,
    model,
    idea,
    mode,
  })) as Record<string, unknown>;
  const truncated = Boolean(raw?.__truncated);
  if (raw) delete raw.__truncated;
  return normalizeSpec({ ...raw, mode }, mode, { prompt: idea, generator: `${providerId}/${model}${truncated ? ' (answer was cut short; the rest was filled in)' : ''}` });
}
