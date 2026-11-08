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
