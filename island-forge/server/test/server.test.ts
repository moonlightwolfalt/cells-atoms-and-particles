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
