import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { server } from '../server.ts';
import { extractJson, generateMap } from '../providers.ts';
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
