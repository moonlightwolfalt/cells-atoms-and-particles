import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MODES, MODE_IDS, normalizeSpec } from '../public/lib/modes.js';
import { generateProcedural } from '../public/lib/procedural.js';
import { generateVerse, generateReadme, toWorld, collectMarkers, verseIdent } from '../public/lib/uefn.js';
import { createZip, readZip, crc32 } from '../public/lib/zip.js';
import { extractJson, generateMap } from '../providers.js';

test('offline generator makes a valid map for every mode', () => {
  for (const mode of MODE_IDS) {
    const spec = generateProcedural('frozen volcano with a neon city and pirate docks', mode);
    assert.equal(spec.mode, mode);
    assert.ok(spec.pois.length >= MODES[mode].poiMin, `${mode} has enough POIs`);
    assert.ok(spec.pois.length <= MODES[mode].poiMax);
    assert.equal(new Set(spec.pois.map((p) => p.name)).size, spec.pois.length, 'POI names are unique');
    for (const p of spec.pois) assert.ok(p.x >= 0.08 && p.x <= 0.92 && p.y >= 0.08 && p.y <= 0.92);
    const radii = spec.storm.phases.map((p) => p.end_radius_pct);
    assert.deepEqual(radii, [...radii].sort((a, b) => b - a), 'storm shrinks');
    // normalizing again is stable
    assert.deepEqual(normalizeSpec(spec, mode), spec);
  }
  assert.ok(generateProcedural('x', 'battle_royale').features.some((f) => f.type === 'reboot_van'));
  assert.ok(generateProcedural('x', 'blitz').features.some((f) => f.type === 'medallion'));
  assert.equal(generateProcedural('x', 'reload').rules.respawn_enabled, true);
});

test('offline generator is deterministic per prompt and seed', () => {
  assert.deepEqual(generateProcedural('desert canyon', 'reload'), generateProcedural('desert canyon', 'reload'));
  assert.notDeepEqual(generateProcedural('desert canyon', 'reload', 1), generateProcedural('desert canyon', 'reload', 2));
});

test('normalizer repairs sloppy AI output', () => {
  const spec = normalizeSpec(
    {
      name: '  Big Island ',
      time_of_day: 'Night',
      base_biome: 'SNOW',
      pois: [{ name: 'A', kind: 'Castle', x: 55, y: '40', size: 'huge', loot_tier: 9 }, { x: 2, y: -1 }],
      storm: { phases: [{ end_radius_pct: 5 }, { end_radius_pct: 40 }, { end_radius_pct: 20 }] },
      rules: { max_players: 500, respawn_enabled: false, respawn_cutoff_phase: 3 },
      features: [{ type: 'Reboot Van', x: 0.4, y: 0.4 }, { type: 'spaceship', x: 0.3, y: 0.3 }],
    },
    'reload',
  );
  assert.equal(spec.name, 'Big Island');
  assert.equal(spec.time_of_day, 'night');
  assert.equal(spec.base_biome, 'snow');
  assert.equal(spec.pois[0].kind, 'castle');
  assert.equal(spec.pois[0].x, 0.55);
  assert.equal(spec.pois[0].y, 0.4);
  assert.equal(spec.pois[0].size, 'medium');
  assert.equal(spec.pois[0].loot_tier, 3);
  assert.equal(spec.pois[1].name, 'Location 2');
  assert.deepEqual(spec.storm.phases.map((p) => p.end_radius_pct), [0.4, 0.2, 0.05]);
  assert.equal(spec.rules.max_players, 100);
  assert.equal(spec.rules.respawn_cutoff_phase, 0);
  assert.equal(spec.features[0].type, 'reboot_van');
  assert.equal(spec.features[1].type, 'supply_drop');
  assert.equal(normalizeSpec(null, 'blitz').pois.length, 1);
});

test('world coordinates: centre is 0,0, north is +X, east is +Y', () => {
  const spec = generateProcedural('x', 'reload');
  assert.deepEqual(toWorld(spec, 0.5, 0.5), { X: 0, Y: 0, Z: 0 });
  const ne = toWorld(spec, 1, 0);
  assert.equal(ne.X, spec.map_size_m * 50);
  assert.equal(ne.Y, spec.map_size_m * 50);
});

test('Verse and README include every marker', () => {
  const spec = generateProcedural('haunted swamp castle', 'battle_royale');
  spec.name = 'Spooky "Isle" {test}';
  const verse = generateVerse(spec);
  const markers = collectMarkers(spec);
  assert.equal((verse.match(/island_forge_marker\{/g) || []).length, markers.length);
  assert.match(verse, /spooky_isle_test_layout_device := class\(creative_device\):/);
  for (const line of verse.split('\n').filter((l) => l.includes('island_forge_marker{'))) {
    assert.match(line, /^ {8}island_forge_marker\{Label := "[^"{}]*", Category := "[a-z_]+", X := -?\d+\.0, Y := -?\d+\.0, Z := -?\d+\.0\},?$/);
  }
  assert.ok(!verse.includes('\t'), 'Verse uses spaces');
  const readme = generateReadme(spec);
  for (const p of spec.pois) assert.ok(readme.includes(p.name));
  assert.equal(verseIdent('123 Go!'), 'island_123_go');
});

test('zip round-trips', async () => {
  const png = new Uint8Array([137, 80, 78, 71, 0, 1, 2, 255]);
  const zip = createZip([
    { name: 'pkg/README.md', data: '# hello ✓' },
    { name: 'pkg/img.png', data: png },
  ]);
  const files = await readZip(zip);
  assert.deepEqual(files.map((f) => f.name), ['pkg/README.md', 'pkg/img.png']);
  assert.equal(new TextDecoder().decode(files[0].data), '# hello ✓');
  assert.deepEqual([...files[1].data], [...png]);
  assert.equal(crc32(new TextEncoder().encode('123456789')), 0xcbf43926);
});

test('extractJson handles fences and chatter', () => {
  assert.deepEqual(extractJson('Sure!\n```json\n{"a":1}\n```'), { a: 1 });
  assert.deepEqual(extractJson('here {"a":{"b":2}} done'), { a: { b: 2 } });
  assert.throws(() => extractJson('no json'), /did not return JSON/);
});

test('generateMap routes to the chosen provider and normalizes its answer', async () => {
  let seen;
  const fake = async (args) => {
    seen = args;
    return { name: 'Fake Isle', pois: [{ name: 'Spot', kind: 'town', x: 0.4, y: 0.6 }] };
  };
  const spec = await generateMap({ provider: 'gemini', model: 'm1', apiKey: ' k ', prompt: 'hi', mode: 'blitz' }, { gemini: fake });
  assert.equal(seen.apiKey, 'k');
  assert.equal(seen.mode, 'blitz');
  assert.equal(spec.name, 'Fake Isle');
  assert.equal(spec.mode, 'blitz');
  assert.equal(spec.generator, 'gemini/m1');
  assert.equal(spec.rules.max_players, MODES.blitz.rules.max_players);

  const offline = await generateMap({ provider: 'offline', prompt: 'snow', mode: 'reload' });
  assert.equal(offline.generator, 'offline-procedural');
  assert.equal(offline.base_biome, 'snow');

  await assert.rejects(generateMap({ provider: 'anthropic', prompt: 'x' }, { anthropic: async () => { throw Object.assign(new Error('nope'), { status: 401 }); } }), /nope/);
});
