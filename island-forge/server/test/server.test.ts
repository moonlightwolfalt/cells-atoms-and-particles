import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { server } from '../server.ts';
import { extractJson, generateMap, claudeCodeEnv } from '../providers.ts';
import { MODES, readZip } from '../../core/src/index.ts';

let base = '';
before(async () => {
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
after(() => server.close());

test('extractJson handles fences and chatter', () => {
  assert.deepEqual(extractJson('Sure!\n```json\n{"a":1}\n```'), { a: 1 });
  assert.deepEqual(extractJson('here {"a":{"b":2}} done'), { a: { b: 2 } });
  assert.throws(() => extractJson('no json'), /did not return JSON/);
});

test('generateMap routes to the chosen provider and normalizes its answer', async () => {
  let seen: any;
  const fake = async (args: any) => {
    seen = args;
    return { name: 'Fake Isle', pois: [{ name: 'Spot', kind: 'town', x: 0.4, y: 0.6 }] };
  };
  const spec = await generateMap({ provider: 'gemini', model: 'm1', apiKey: ' k ', prompt: 'hi', mode: 'tycoon' }, { gemini: fake });
  assert.equal(seen.apiKey, 'k');
  assert.equal(seen.mode, 'tycoon');
  assert.equal(spec.name, 'Fake Isle');
  assert.equal(spec.generator, 'gemini/m1');
  assert.equal(spec.rules.max_players, MODES.tycoon.rules.max_players);
  assert.ok(spec.devices.length > 0);
  await assert.rejects(generateMap({ provider: 'anthropic', prompt: 'x' }, { anthropic: async () => { throw Object.assign(new Error('nope'), { status: 401 }); } }), /nope/);
});

test('API: catalog, offline generate, verse, readme, package', async () => {
  const cat = await (await fetch(`${base}/api/catalog`)).json();
  assert.ok(cat.modes.length >= 30 && cat.devices.length >= 75 && cat.verseModules.length >= 13);

  const gen = await fetch(`${base}/api/generate`, { method: 'POST', body: JSON.stringify({ provider: 'offline', prompt: 'candy', mode: 'deathrun' }) });
  assert.equal(gen.status, 200);
  const { spec } = await gen.json();
  assert.equal(spec.mode, 'deathrun');

  const verse = await (await fetch(`${base}/api/verse`, { method: 'POST', body: JSON.stringify({ spec }) })).json();
  assert.deepEqual(verse.files.map((f: any) => f.module), MODES.deathrun.verse);

  const readme = await (await fetch(`${base}/api/readme`, { method: 'POST', body: JSON.stringify({ spec }) })).text();
  assert.match(readme, /Import into a new UEFN island/);

  const pkg = await fetch(`${base}/api/package`, { method: 'POST', body: JSON.stringify({ spec }) });
  assert.equal(pkg.headers.get('content-type'), 'application/zip');
  const files = await readZip(new Uint8Array(await pkg.arrayBuffer()));
  assert.ok(files.some((f) => f.name.endsWith('README.md')));
  assert.ok(files.some((f) => f.name.endsWith('heightmap-1009.png')));

  const bad = await fetch(`${base}/api/verse`, { method: 'POST', body: '{}' });
  assert.equal(bad.status, 400);
  const traversal = await fetch(`${base}/..%2F..%2Fpackage.json`);
  assert.ok([403, 404].includes(traversal.status));
});

test('ChatGPT, DeepSeek, Gemini and compatible callers send the right requests', async () => {
  const http = await import('node:http');
  const seen: { url: string; auth?: string; goog?: string; body: any }[] = [];
  const layout = { name: 'Wire Isle', pois: [{ name: 'Dock', kind: 'docks', x: 0.4, y: 0.5, prefab: 'br_dirty_docks', galleries: ['gb_docks_gallery'] }], loot: { starting_loadout: [], pool: ['it_pump_shotgun'], chests: ['treasure_chest'], vehicles: [], creatures: [] } };
  const fake = http.createServer(async (req, res) => {
    let raw = '';
    for await (const c of req) raw += c;
    seen.push({ url: req.url || '', auth: req.headers.authorization, goog: req.headers['x-goog-api-key'] as string, body: JSON.parse(raw) });
    res.setHeader('content-type', 'application/json');
    if (req.url?.includes(':generateContent')) {
      res.end(JSON.stringify({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify(layout) }] } }] }));
    } else if (req.headers.authorization === 'Bearer bad') {
      res.statusCode = 401;
      res.end(JSON.stringify({ error: { message: 'Invalid key' } }));
    } else {
      res.end(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: '```json\n' + JSON.stringify(layout) + '\n```' } }] }));
    }
  });
  await new Promise<void>((r) => fake.listen(0, '127.0.0.1', r));
  const url = `http://127.0.0.1:${(fake.address() as AddressInfo).port}`;
  try {
    const gpt = await generateMap({ provider: 'openai', apiKey: 'sk-gpt', baseUrl: url, prompt: 'docks', mode: 'reload' });
    assert.equal(gpt.generator, 'openai/gpt-5');
    assert.equal(gpt.pois[0].prefab, 'br_dirty_docks');
    assert.equal(seen[0].url, '/chat/completions');
    assert.equal(seen[0].auth, 'Bearer sk-gpt');
    assert.equal(seen[0].body.model, 'gpt-5');
    assert.deepEqual(seen[0].body.response_format, { type: 'json_object' });
    assert.match(seen[0].body.messages[1].content, /Prefab ids:/);

    const ds = await generateMap({ provider: 'deepseek', apiKey: 'sk-ds', baseUrl: url, prompt: 'docks', mode: 'blitz' });
    assert.equal(ds.generator, 'deepseek/deepseek-chat');
    assert.equal(seen[1].body.model, 'deepseek-chat');
    assert.equal(seen[1].body.max_tokens, 8192);
    await generateMap({ provider: 'deepseek', model: 'deepseek-reasoner', apiKey: 'sk-ds', baseUrl: url, prompt: 'docks' });
    assert.equal(seen[2].body.response_format, undefined, 'reasoner gets no JSON mode');

    const gem = await generateMap({ provider: 'gemini', apiKey: 'AIza-test', baseUrl: url, prompt: 'docks', mode: 'racing' });
    assert.equal(gem.mode, 'racing');
    assert.equal(seen[3].url, '/models/gemini-2.5-flash:generateContent');
    assert.equal(seen[3].goog, 'AIza-test');
    assert.equal(seen[3].body.generationConfig.responseMimeType, 'application/json');

    const other = await generateMap({ provider: 'compatible', model: 'meta/llama', baseUrl: url, prompt: 'docks' });
    assert.equal(other.generator, 'compatible/meta/llama');
    assert.equal(seen[4].auth, undefined, 'no key sent when none given');

    const grok = await generateMap({ provider: 'grok', apiKey: 'xai-test', baseUrl: url, prompt: 'docks', mode: 'box_fights' });
    assert.equal(grok.generator, 'grok/grok-4');
    assert.equal(seen[5].auth, 'Bearer xai-test');
    assert.deepEqual(seen[5].body.response_format, { type: 'json_object' });

    const mis = await generateMap({ provider: 'mistral', apiKey: 'mis-test', baseUrl: url, prompt: 'docks' });
    assert.equal(mis.generator, 'mistral/mistral-large-latest');
    assert.deepEqual(seen[6].body.response_format, { type: 'json_object' });
    assert.equal(seen[6].body.max_tokens, 32000);

    const llama = await generateMap({ provider: 'llama', apiKey: 'LLM|test', baseUrl: url, prompt: 'docks', mode: 'deathrun' });
    assert.equal(llama.generator, 'llama/Llama-4-Maverick-17B-128E-Instruct-FP8');
    assert.equal(seen[7].url, '/chat/completions');
    assert.equal(seen[7].body.response_format, undefined);
    assert.equal(seen[7].body.max_tokens, 16000);

    const qwen = await generateMap({ provider: 'qwen', apiKey: 'sk-qwen', baseUrl: url, prompt: 'docks', mode: 'tycoon' });
    assert.equal(qwen.generator, 'qwen/qwen-plus');
    assert.equal(seen[8].auth, 'Bearer sk-qwen');
    assert.deepEqual(seen[8].body.response_format, { type: 'json_object' });
    assert.equal(seen[8].body.max_tokens, 8192);

    const kimi = await generateMap({ provider: 'kimi', apiKey: 'sk-kimi', baseUrl: url, prompt: 'docks', mode: 'horror' });
    assert.equal(kimi.generator, 'kimi/kimi-k2-turbo-preview');
    assert.equal(seen[9].body.model, 'kimi-k2-turbo-preview');
    assert.deepEqual(seen[9].body.response_format, { type: 'json_object' });

    await assert.rejects(generateMap({ provider: 'openai', apiKey: 'bad', baseUrl: url, prompt: 'x' }), /ChatGPT \(OpenAI\) error \(401\): Invalid key/);
    await assert.rejects(generateMap({ provider: 'compatible', baseUrl: url, prompt: 'x' }), /Type a model name/);
    const saved = process.env.DEEPSEEK_API_KEY;
    delete process.env.DEEPSEEK_API_KEY;
    await assert.rejects(generateMap({ provider: 'deepseek', baseUrl: url, prompt: 'x' }), /Add your DeepSeek API key/);
    if (saved) process.env.DEEPSEEK_API_KEY = saved;
  } finally {
    fake.close();
  }
});

test('public mode: server keys need the passcode, custom base URLs are blocked, AI calls are rate limited', async () => {
  const saved = { ...process.env };
  const restore = () => {
    for (const k of ['ISLAND_FORGE_PUBLIC', 'ISLAND_FORGE_PASSCODE', 'ALLOW_SHARED_KEYS', 'ALLOWED_BASE_URLS', 'ANTHROPIC_API_KEY', 'RATE_LIMIT_PER_HOUR']) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  };
  let seen: any;
  const fake = { anthropic: async (a: any) => ((seen = a), { name: 'P' }), compatible: async (a: any) => ((seen = a), { name: 'C' }), ollama: async () => ({ name: 'O' }) };
  try {
    process.env.ISLAND_FORGE_PUBLIC = '1';
    process.env.ANTHROPIC_API_KEY = 'sk-owner';

    // No passcode configured: the owner's key is never used; visitors bring their own.
    await generateMap({ provider: 'anthropic', apiKey: 'sk-visitor', prompt: 'x' }, fake);
    assert.equal(seen.useEnvKeys, false);
    assert.equal(seen.apiKey, 'sk-visitor');

    // Passcode configured.
    process.env.ISLAND_FORGE_PASSCODE = 'open-sesame';
    await assert.rejects(generateMap({ provider: 'anthropic', prompt: 'x' }, fake), /enter the server passcode/);
    await assert.rejects(generateMap({ provider: 'anthropic', prompt: 'x' }, fake, { passcode: 'nope' }), /Wrong server passcode/);
    await generateMap({ provider: 'anthropic', prompt: 'x' }, fake, { passcode: 'open-sesame' });
    assert.equal(seen.useEnvKeys, true);

    // Base URLs: defaults fine, custom blocked unless allow-listed, Ollama off.
    await assert.rejects(generateMap({ provider: 'compatible', model: 'm', baseUrl: 'http://169.254.169.254/latest', prompt: 'x' }, fake), /Custom base URLs are turned off/);
    await assert.rejects(generateMap({ provider: 'ollama', prompt: 'x' }, fake), /turned off on this public server/);
    await generateMap({ provider: 'compatible', model: 'm', prompt: 'x' }, fake);
    assert.equal(seen.baseUrl, '');
    process.env.ALLOWED_BASE_URLS = 'https://api.groq.com/openai/v1, https://example.org/v1/';
    await generateMap({ provider: 'compatible', model: 'm', baseUrl: 'https://example.org/v1', prompt: 'x' }, fake);
    assert.equal(seen.baseUrl, 'https://example.org/v1');

    // API reports the policy; generation is rate limited per visitor.
    const prov = await (await fetch(`${base}/api/providers`)).json();
    assert.deepEqual(prov.access, { public: true, serverKeys: 'passcode', customBaseUrls: 'allowlist' });
    assert.equal(prov.status.anthropic.envKey, true);
    process.env.RATE_LIMIT_PER_HOUR = '2';
    const ask = () => fetch(`${base}/api/generate`, { method: 'POST', headers: { 'x-forwarded-for': '203.0.113.9' }, body: JSON.stringify({ provider: 'anthropic', prompt: 'x' }) });
    assert.equal((await ask()).status, 401);
    assert.equal((await ask()).status, 401);
    assert.equal((await ask()).status, 429);
    const offline = await fetch(`${base}/api/generate`, { method: 'POST', headers: { 'x-forwarded-for': '203.0.113.9' }, body: JSON.stringify({ provider: 'offline', prompt: 'x' }) });
    assert.equal(offline.status, 200, 'offline generation is never rate limited');
  } finally {
    restore();
  }
});

test('Claude Code gets an isolated environment: only the given key, never a login or parent session', async () => {
  const parent = {
    PATH: '/usr/bin', HOME: '/home/me', HTTPS_PROXY: 'http://proxy:8080', NODE_EXTRA_CA_CERTS: '/ca.pem',
    ANTHROPIC_API_KEY: 'sk-ant-owner', ANTHROPIC_BASE_URL: 'https://somewhere-else', ANTHROPIC_AUTH_TOKEN: 'bearer',
    CLAUDE_CODE_OAUTH_TOKEN: 'subscription-token', CLAUDECODE: '1', CLAUDE_CODE_SESSION_ID: 'abc', CLAUDE_CODE_PROVIDER_MANAGED_BY_HOST: '1',
    CLAUDE_CODE_USE_BEDROCK: '1', AWS_REGION: 'us-east-1', AWS_ACCESS_KEY_ID: 'AKIA', OPENAI_API_KEY: 'sk-other',
  };
  const env = claudeCodeEnv('sk-ant-visitor', false, parent);
  assert.equal(env.ANTHROPIC_API_KEY, 'sk-ant-visitor');
  assert.equal(env.PATH, '/usr/bin');
  assert.equal(env.HTTPS_PROXY, 'http://proxy:8080');
  for (const k of ['ANTHROPIC_BASE_URL', 'ANTHROPIC_AUTH_TOKEN', 'CLAUDE_CODE_OAUTH_TOKEN', 'CLAUDECODE', 'CLAUDE_CODE_SESSION_ID', 'CLAUDE_CODE_PROVIDER_MANAGED_BY_HOST', 'CLAUDE_CODE_USE_BEDROCK', 'AWS_ACCESS_KEY_ID', 'OPENAI_API_KEY']) {
    assert.equal(env[k], undefined, `${k} must not reach Claude Code`);
  }
  const cloudEnv = claudeCodeEnv('', true, parent);
  assert.equal(cloudEnv.CLAUDE_CODE_USE_BEDROCK, '1');
  assert.equal(cloudEnv.AWS_REGION, 'us-east-1');
  assert.equal(cloudEnv.ANTHROPIC_API_KEY, undefined);
  assert.equal(cloudEnv.CLAUDE_CODE_OAUTH_TOKEN, undefined);

  // No key and no cloud setup: refused before anything starts.
  const saved = process.env.ANTHROPIC_API_KEY;
  delete process.env.ANTHROPIC_API_KEY;
  await assert.rejects(generateMap({ provider: 'claude_code', prompt: 'x' }), /needs an Anthropic API key/);
  // Off on public servers.
  process.env.ISLAND_FORGE_PUBLIC = '1';
  await assert.rejects(generateMap({ provider: 'claude_code', apiKey: 'sk-ant-x', prompt: 'x' }), /turned off on this public server/);
  delete process.env.ISLAND_FORGE_PUBLIC;
  if (saved) process.env.ANTHROPIC_API_KEY = saved;
});

test('keep-alive generation starts the response at once and still returns the spec or a readable error', async () => {
  const res = await fetch(`${base}/api/generate`, { method: 'POST', headers: { 'x-island-forge-keepalive': '1' }, body: JSON.stringify({ provider: 'offline', prompt: 'x', mode: 'blitz' }) });
  assert.equal(res.status, 200);
  const text = await res.text();
  assert.match(text, /^ +\{/, 'body starts with keep-alive spaces');
  assert.equal(JSON.parse(text).spec.mode, 'blitz');

  const bad = await fetch(`${base}/api/generate`, { method: 'POST', headers: { 'x-island-forge-keepalive': '1' }, body: JSON.stringify({ provider: 'compatible', prompt: 'x' }) });
  const err = JSON.parse(await bad.text());
  assert.match(err.error, /Type a model name/);
  assert.equal(err.status, 400);
});

test('salvageJson rescues answers cut off mid-JSON', async () => {
  const { salvageJson } = await import('../providers.ts');
  const full = { name: 'Cut Isle', pois: [{ name: 'A', x: 0.3, y: 0.3 }, { name: 'B', x: 0.6, y: 0.6 }], roads: [{ points: [{ x: 0.1, y: 0.2 }] }] };
  const text = JSON.stringify(full);
  assert.deepEqual(salvageJson(text), full);
  assert.deepEqual(salvageJson('```json\n' + text + '\n```'), full);
  const cut = salvageJson(text.slice(0, text.indexOf('"B"') + 6)) as any;
  assert.equal(cut.name, 'Cut Isle');
  assert.deepEqual(cut.pois.map((p: any) => p.name), ['A'], 'the half-written location is dropped');
  const cutInString = salvageJson('{"name":"Long \\"quoted\\" na') as any;
  assert.equal(cutInString, null);
  const deep = salvageJson('```json\n{"name":"X","pois":[{"name":"A","x":0.1,"y":0.2}],"features":[{"type":"vault","x":0.') as any;
  assert.equal(deep.pois.length, 1);
  assert.ok(!deep.features?.length, 'the half-written feature list is dropped');
  assert.equal(salvageJson('no json here'), null);
});

test('a DeepSeek answer that hits the output limit is salvaged, not a 502', async () => {
  const http = await import('node:http');
  const layout = JSON.stringify({ name: 'Long Isle', pois: [{ name: 'One', kind: 'town', x: 0.3, y: 0.4 }, { name: 'Two', kind: 'city', x: 0.6, y: 0.5 }], features: [{ type: 'vault', x: 0.3, y: 0.4, note: '', team: 0, order: 0 }] });
  const fake = http.createServer((req, res) => {
    req.resume();
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ choices: [{ finish_reason: 'length', message: { content: layout.slice(0, layout.indexOf('"features"') + 40) } }] }));
  });
  await new Promise<void>((r) => fake.listen(0, '127.0.0.1', r));
  const url = `http://127.0.0.1:${(fake.address() as AddressInfo).port}`;
  try {
    const spec = await generateMap({ provider: 'deepseek', apiKey: 'sk', baseUrl: url, prompt: 'x', mode: 'battle_royale' });
    assert.equal(spec.name, 'Long Isle');
    assert.deepEqual(spec.pois.map((p) => p.name), ['One', 'Two']);
    assert.match(spec.generator, /cut short/);
    assert.ok(spec.storm.phases.length > 0, 'missing parts are filled from the mode defaults');
  } finally {
    fake.close();
  }
});

test('background jobs: start, poll to completion, report errors, refuse unknown ids', async () => {
  const start = async (body: unknown, ip = '198.51.100.7') =>
    fetch(`${base}/api/jobs`, { method: 'POST', headers: { 'x-forwarded-for': ip }, body: JSON.stringify(body) });
  const poll = async (id: string) => {
    for (let i = 0; i < 50; i++) {
      const job = await (await fetch(`${base}/api/jobs/${id}`)).json();
      if (job.status !== 'running') return job;
      await new Promise((r) => setTimeout(r, 50));
    }
    throw new Error('job never finished');
  };
  const ok = await start({ provider: 'offline', prompt: 'x', mode: 'racing' });
  assert.equal(ok.status, 202);
  const done = await poll((await ok.json()).id);
  assert.equal(done.status, 'done');
  assert.equal(done.spec.mode, 'racing');
  assert.ok(done.elapsed_ms >= 0);

  const bad = await start({ provider: 'compatible', prompt: 'x' });
  const failed = await poll((await bad.json()).id);
  assert.equal(failed.status, 'error');
  assert.match(failed.error, /Type a model name/);
  assert.equal(failed.http_status, 400);

  const missing = await fetch(`${base}/api/jobs/00000000-0000-0000-0000-000000000000`);
  assert.equal(missing.status, 404);
  assert.match((await missing.json()).error, /not found/);
});

test('all OpenAI and Gemini models: live lists are filtered, and quirky model families are retried until they work', async () => {
  const http = await import('node:http');
  const { listModels } = await import('../providers.ts');
  const layout = JSON.stringify({ name: 'Any Model Isle', pois: [{ name: 'Port', kind: 'docks', x: 0.4, y: 0.5 }] });
  const calls: { url: string; body: any }[] = [];
  const err = (res: any, msg: string) => { res.statusCode = 400; res.end(JSON.stringify({ error: { message: msg } })); };
  const ok = (res: any) => res.end(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: layout } }] }));
  const fake = http.createServer(async (req, res) => {
    let raw = '';
    for await (const c of req) raw += c;
    const body = raw ? JSON.parse(raw) : null;
    calls.push({ url: req.url || '', body });
    res.setHeader('content-type', 'application/json');
    const url = req.url || '';
    if (url === '/models') {
      return res.end(JSON.stringify({ data: [
        { id: 'gpt-5', created: 300 }, { id: 'text-embedding-3-large', created: 400 }, { id: 'o4-mini', created: 250 },
        { id: 'whisper-1', created: 100 }, { id: 'gpt-4o-realtime-preview', created: 350 }, { id: 'dall-e-3', created: 90 },
        { id: 'gpt-image-1', created: 380 }, { id: 'chatgpt-4o-latest', created: 200 }, { id: 'tts-1', created: 80 },
      ] }));
    }
    if (url.startsWith('/models?')) {
      const page2 = url.includes('pageToken=p2');
      return res.end(JSON.stringify(page2
        ? { models: [{ name: 'models/gemma-3-27b-it', supportedGenerationMethods: ['generateContent'] }, { name: 'models/imagen-4.0-generate', supportedGenerationMethods: ['predict'] }] }
        : { nextPageToken: 'p2', models: [
            { name: 'models/gemini-2.5-flash', displayName: 'Gemini 2.5 Flash', supportedGenerationMethods: ['generateContent', 'countTokens'] },
            { name: 'models/text-embedding-004', supportedGenerationMethods: ['embedContent'] },
            { name: 'models/gemini-2.5-flash-preview-tts', supportedGenerationMethods: ['generateContent'] },
            { name: 'models/gemini-2.5-pro', displayName: 'Gemini 2.5 Pro', supportedGenerationMethods: ['generateContent'] },
          ] }));
    }
    if (url === '/chat/completions') {
      if (body.model === 'o1-pro') return err(res, 'This model is only supported in v1/responses and not in v1/chat/completions.');
      if (body.model === 'o1-mini' && body.messages[0].role === 'system') return err(res, "Unsupported value: 'messages[0].role' does not support 'system' with this model.");
      if (body.model === 'o1-preview' && body.response_format) return err(res, "Invalid parameter: 'response_format' of type 'json_object' is not supported with this model.");
      return ok(res);
    }
    if (url === '/responses') {
      return res.end(JSON.stringify({ status: 'completed', output: [{ type: 'reasoning' }, { type: 'message', content: [{ type: 'output_text', text: layout }] }] }));
    }
    if (url.includes(':generateContent')) {
      if (url.includes('gemini-old') && body.generationConfig.responseMimeType) return err(res, 'JSON mode is not enabled for models/gemini-old');
      if (url.includes('gemini-small') && body.generationConfig.maxOutputTokens > 8192) return err(res, 'The requested maxOutputTokens exceeds the model limit');
      if (url.includes('gemma') && body.systemInstruction) return err(res, 'Developer instruction is not enabled for models/gemma-3-27b-it');
      return res.end(JSON.stringify({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: 'thinking…', thought: true }, { text: layout }] } }] }));
    }
    res.statusCode = 404;
    res.end('{}');
  });
  await new Promise<void>((r) => fake.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${(fake.address() as AddressInfo).port}`;
  const gen = (provider: string, model: string) => generateMap({ provider, model, apiKey: 'k', baseUrl: base, prompt: 'x', mode: 'blitz' });
  try {
    const openai = await listModels({ provider: 'openai', apiKey: 'k', baseUrl: base });
    assert.deepEqual(openai.models.map((m) => m.id), ['gpt-5', 'o4-mini', 'chatgpt-4o-latest'], 'only text models, newest first');
    const gemini = await listModels({ provider: 'gemini', apiKey: 'k', baseUrl: base });
    assert.deepEqual(gemini.models.map((m) => m.id), ['gemini-2.5-pro', 'gemini-2.5-flash', 'gemma-3-27b-it'], 'both pages, text models only, Gemini before Gemma');
    assert.equal(gemini.models[0].label, 'Gemini 2.5 Pro');
    await assert.rejects(listModels({ provider: 'deepseek', apiKey: 'k' }), /Live model lists are available for/);
    await assert.rejects(listModels({ provider: 'openai', baseUrl: base }), /Add your ChatGPT \(OpenAI\) API key/);

    assert.equal((await gen('openai', 'o1-pro')).name, 'Any Model Isle');
    assert.ok(calls.some((c) => c.url === '/responses' && c.body.model === 'o1-pro'), 'Responses-only model retried on /responses');
    calls.length = 0;
    await gen('openai', 'o1-mini');
    assert.equal(calls.at(-1)!.body.messages.length, 1, 'system prompt merged into the user message');
    calls.length = 0;
    await gen('openai', 'o1-preview');
    assert.equal(calls.at(-1)!.body.response_format, undefined, 'JSON mode dropped for models without it');

    calls.length = 0;
    assert.equal((await gen('gemini', 'gemma-3-27b-it')).name, 'Any Model Isle');
    assert.equal(calls.length, 1, 'Gemma gets the merged prompt on the first try');
    assert.equal(calls[0].body.systemInstruction, undefined);
    calls.length = 0;
    await gen('gemini', 'gemini-old');
    assert.equal(calls.at(-1)!.body.generationConfig.responseMimeType, undefined);
    calls.length = 0;
    await gen('gemini', 'gemini-small');
    assert.equal(calls.at(-1)!.body.generationConfig.maxOutputTokens, 8192);
  } finally {
    fake.close();
  }
});

test('all Claude models: live list from the Models API, and each request fits what the model supports', async () => {
  const http = await import('node:http');
  const { listModels } = await import('../providers.ts');
  const layout = JSON.stringify({ name: 'Claude Isle', pois: [{ name: 'Cove', kind: 'docks', x: 0.4, y: 0.5 }] });
  const messages: any[] = [];
  const caps = (structured: boolean, effort: boolean) => ({ structured_outputs: { supported: structured }, effort: { supported: effort, medium: { supported: effort } } });
  const INFO: Record<string, any> = {
    'claude-opus-5-5': { max_tokens: 128000, capabilities: caps(true, true) },
    'claude-old': { max_tokens: 4096, capabilities: caps(false, false) },
  };
  const fail = (res: any, status: number, type: string, message: string) => { res.statusCode = status; res.setHeader('content-type', 'application/json'); res.end(JSON.stringify({ type: 'error', error: { type, message } })); };
  const fake = http.createServer(async (req, res) => {
    let raw = '';
    for await (const c of req) raw += c;
    const url = new URL(req.url || '/', 'http://x');
    if (url.pathname === '/v1/models') {
      res.setHeader('content-type', 'application/json');
      const page2 = url.searchParams.get('after_id') === 'claude-3-opus';
      return res.end(JSON.stringify(page2
        ? { data: [{ type: 'model', id: 'claude-sonnet-4-6', display_name: 'Claude Sonnet 4.6', lifecycle: 'active' }], has_more: false, first_id: 'claude-sonnet-4-6', last_id: 'claude-sonnet-4-6' }
        : { data: [
            { type: 'model', id: 'claude-opus-5-5', display_name: 'Claude Opus 5.5', lifecycle: 'active' },
            { type: 'model', id: 'claude-3-7-sonnet', display_name: 'Claude Sonnet 3.7', lifecycle: 'deprecated' },
            { type: 'model', id: 'claude-3-opus', display_name: 'Claude Opus 3', lifecycle: 'retired' },
          ], has_more: true, first_id: 'claude-opus-5-5', last_id: 'claude-3-opus' }));
    }
    if (url.pathname.startsWith('/v1/models/')) {
      const id = decodeURIComponent(url.pathname.slice('/v1/models/'.length));
      if (id === 'claude-missing') return fail(res, 404, 'not_found_error', `model: ${id}`);
      if (!INFO[id]) return fail(res, 500, 'api_error', 'Internal error');
      res.setHeader('content-type', 'application/json');
      return res.end(JSON.stringify({ type: 'model', id, display_name: id, lifecycle: 'active', ...INFO[id] }));
    }
    if (url.pathname === '/v1/messages') {
      const body = JSON.parse(raw);
      messages.push(body);
      if (body.model === 'claude-noinfo' && body.output_config?.effort) return fail(res, 400, 'invalid_request_error', 'output_config.effort: Extra inputs are not permitted');
      res.setHeader('content-type', 'text/event-stream');
      const ev = (type: string, data: unknown) => res.write(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`);
      ev('message_start', { type: 'message_start', message: { id: 'msg_1', type: 'message', role: 'assistant', model: body.model, content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 10, output_tokens: 1 } } });
      ev('content_block_start', { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } });
      ev('content_block_delta', { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: layout } });
      ev('content_block_stop', { type: 'content_block_stop', index: 0 });
      ev('message_delta', { type: 'message_delta', delta: { stop_reason: 'end_turn', stop_sequence: null }, usage: { output_tokens: 50 } });
      ev('message_stop', { type: 'message_stop' });
      return res.end();
    }
    fail(res, 404, 'not_found_error', 'nope');
  });
  await new Promise<void>((r) => fake.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${(fake.address() as AddressInfo).port}`;
  const gen = (model: string) => generateMap({ provider: 'anthropic', model, apiKey: 'sk-ant-test', baseUrl: base, prompt: 'x', mode: 'blitz' });
  try {
    const list = await listModels({ provider: 'anthropic', apiKey: 'sk-ant-test', baseUrl: base });
    assert.deepEqual(list.models.map((m) => m.id), ['claude-opus-5-5', 'claude-3-7-sonnet', 'claude-sonnet-4-6'], 'both pages, retired models dropped');
    assert.equal(list.models[1].label, 'Claude Sonnet 3.7 (deprecated)');
    const cc = await listModels({ provider: 'claude_code', apiKey: 'sk-ant-test-2', baseUrl: base });
    assert.equal(cc.models[0].id, 'default');

    assert.equal((await gen('claude-opus-5-5')).name, 'Claude Isle');
    const modern = messages.at(-1);
    assert.equal(modern.output_config.format.type, 'json_schema');
    assert.equal(modern.output_config.effort, 'medium');
    assert.equal(modern.max_tokens, 32000);
    assert.equal(modern.fallbacks, 'default');

    await gen('claude-old');
    const old = messages.at(-1);
    assert.equal(old.output_config, undefined, 'no structured outputs or effort for a model without them');
    assert.equal(old.max_tokens, 4096, "capped at the model's own output limit");
    assert.match(old.system, /JSON Schema/, 'schema moves into the prompt instead');

    messages.length = 0;
    await gen('claude-noinfo');
    assert.equal(messages.length, 2, 'rejected effort is dropped and the request retried');
    assert.equal(messages[1].output_config?.effort, undefined);

    await assert.rejects(gen('claude-missing'), /Model "claude-missing" was not found/);
  } finally {
    fake.close();
  }
});

test('free options: Groq and OpenRouter get the compact prompt, OpenRouter lists only free models without a key, retired models get a clear hint', async () => {
  const http = await import('node:http');
  const { listModels, PROVIDERS } = await import('../providers.ts');
  const layout = JSON.stringify({ name: 'Free Isle', pois: [{ name: 'Camp', kind: 'town', x: 0.4, y: 0.5, prefab: null, galleries: null }], loot: null });
  const seen: any[] = [];
  const fake = http.createServer(async (req, res) => {
    let raw = '';
    for await (const c of req) raw += c;
    res.setHeader('content-type', 'application/json');
    if (req.url === '/models') {
      return res.end(JSON.stringify({ data: [
        { id: 'openrouter/free', pricing: { prompt: '0', completion: '0' }, architecture: { output_modalities: ['text'] } },
        { id: 'big/paid-model', pricing: { prompt: '0.000003', completion: '0.000015' }, architecture: { output_modalities: ['text'] } },
        { id: 'some/model:free', name: 'Some Model (free)', pricing: { prompt: '0', completion: '0' }, architecture: { output_modalities: ['text'] } },
        { id: 'google/lyria-3-clip-preview', pricing: { prompt: '0', completion: '0' }, architecture: { output_modalities: ['audio'] } },
      ] }));
    }
    const body = JSON.parse(raw);
    seen.push({ auth: req.headers.authorization, body });
    if (body.model === 'old-model') {
      res.statusCode = 404;
      return res.end(JSON.stringify({ error: { message: 'The model `old-model` has been decommissioned and is no longer supported.' } }));
    }
    res.end(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: layout } }] }));
  });
  await new Promise<void>((r) => fake.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${(fake.address() as AddressInfo).port}`;
  try {
    const free = PROVIDERS.filter((p) => p.free).map((p) => p.id);
    assert.deepEqual(free.sort(), ['gemini', 'groq', 'offline', 'ollama', 'openrouter']);

    const list = await listModels({ provider: 'openrouter', baseUrl: base });
    assert.deepEqual(list.models.map((m) => m.id), ['openrouter/free', 'some/model:free'], 'free text models only, router first, no key needed');

    const spec = await generateMap({ provider: 'groq', apiKey: 'gsk_test', baseUrl: base, prompt: 'x', mode: 'battle_royale' });
    assert.equal(spec.name, 'Free Isle');
    const req = seen.at(-1).body;
    const promptText = req.messages.map((m: any) => m.content).join('\n');
    assert.ok(promptText.length < 6000, `compact prompt (${promptText.length} chars)`);
    assert.doesNotMatch(promptText, /Prefab ids:/);
    assert.equal(req.max_tokens, 6000);
    assert.ok(spec.pois[0].prefab, 'Island Forge picked the prefab itself');
    assert.ok(spec.pois[0].galleries.length > 0);
    assert.ok(spec.loot.chests.length > 0, 'default loot filled in');

    await generateMap({ provider: 'openrouter', apiKey: 'sk-or-test', baseUrl: base, prompt: 'x' });
    assert.equal(seen.at(-1).body.model, 'openrouter/free');

    await assert.rejects(
      generateMap({ provider: 'groq', model: 'old-model', apiKey: 'gsk_test', baseUrl: base, prompt: 'x' }),
      /doesn't offer the model "old-model".*Load all models/,
    );
  } finally {
    fake.close();
  }
});
