import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MODES, MODE_IDS, MODE_LIST, DEVICES, DEVICE_MAP, FEATURE_DEVICE, FEATURE_TYPES, VERSE_MODULES,
  normalizeSpec, generateProcedural, generateVerseFiles, generateReadme, devicesCsv, publishKit,
  toWorld, collectMarkers, verseIdent, createZip, readZip, crc32, packageFiles, encodeGray16, heightmapPng, MAP_SCHEMA,
} from '../src/index.ts';

test('catalogs are consistent', () => {
  assert.ok(MODE_LIST.length >= 30);
  assert.ok(DEVICES.length >= 75);
  assert.equal(new Set(DEVICES.map((d) => d.id)).size, DEVICES.length, 'device ids unique');
  for (const m of MODE_LIST) {
    for (const d of m.devices) assert.ok(DEVICE_MAP[d], `${m.id} uses unknown device ${d}`);
    for (const v of m.verse) assert.ok(VERSE_MODULES[v], `${m.id} uses unknown verse module ${v}`);
    for (const f of Object.keys(m.features)) assert.ok(FEATURE_TYPES.includes(f), `${m.id} uses unknown feature ${f}`);
    if (m.storm.length) assert.ok(m.storm.at(-1)!.end_radius_pct === 0, `${m.id} storm ends at 0`);
  }
  for (const [f, d] of Object.entries(FEATURE_DEVICE)) assert.ok(DEVICE_MAP[d], `${f} maps to unknown device ${d}`);
  for (const f of FEATURE_TYPES) assert.ok(FEATURE_DEVICE[f], `feature ${f} has no device`);
});

test('offline generator makes a valid map for every mode', () => {
  for (const mode of MODE_IDS) {
    const spec = generateProcedural('frozen volcano with a neon city and pirate docks', mode);
    const def = MODES[mode];
    assert.equal(spec.mode, mode);
    assert.ok(spec.pois.length >= 1);
    assert.equal(new Set(spec.pois.map((p) => p.name)).size, spec.pois.length, `${mode}: POI names unique`);
    for (const p of [...spec.pois, ...spec.features]) assert.ok(p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1);
    assert.equal(spec.storm.phases.length, def.storm.length, `${mode}: storm phases`);
    assert.equal(spec.bus_route === null, !def.busRoute, `${mode}: bus route`);
    assert.ok(spec.devices.length > 5, `${mode}: devices planned`);
    assert.ok(spec.publish.title.length <= 40);
    if (def.rules.team_count >= 2 && def.features.team_spawn) {
      const teams = new Set(spec.features.filter((f) => f.type === 'team_spawn').map((f) => f.team));
      assert.equal(teams.size, def.rules.team_count, `${mode}: spawns for every team`);
    }
    const cps = spec.features.filter((f) => f.type === 'checkpoint' || f.type === 'race_checkpoint').map((f) => f.order);
    assert.deepEqual(cps, cps.map((_, i) => i + 1), `${mode}: checkpoints in order`);
    assert.deepEqual(normalizeSpec(spec, mode), spec, `${mode}: normalizing again is stable`);
  }
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
      rules: { max_players: 500, respawn_enabled: false, respawn_cutoff_phase: 3, build_mode: 'Zero Build' },
      features: [{ type: 'Reboot Van', x: 0.4, y: 0.4 }, { type: 'spaceship', x: 0.3, y: 0.3 }],
      publish: { title: 'x'.repeat(80), tags: ['A', 'b', 'c', 'd', 'e'] },
    },
    'reload',
  );
  assert.equal(spec.name, 'Big Island');
  assert.equal(spec.time_of_day, 'night');
  assert.equal(spec.base_biome, 'snow');
  assert.equal(spec.pois[0].kind, 'castle');
  assert.equal(spec.pois[0].x, 0.55);
  assert.equal(spec.pois[0].size, 'medium');
  assert.equal(spec.pois[0].loot_tier, 3);
  assert.equal(spec.pois[1].name, 'Location 2');
  assert.deepEqual(spec.storm.phases.map((p) => p.end_radius_pct), [0.4, 0.2, 0.05]);
  assert.equal(spec.rules.max_players, 100);
  assert.equal(spec.rules.respawn_cutoff_phase, 0);
  assert.equal(spec.rules.build_mode, 'zero_build');
  assert.equal(spec.features[0].type, 'reboot_van');
  assert.equal(spec.features[1].type, 'item_spawner');
  assert.equal(spec.publish.title.length, 40);
  assert.deepEqual(spec.publish.tags, ['a', 'b', 'c', 'd']);
  // storm-less modes drop the storm and the bus
  const arena = normalizeSpec({ storm: { phases: [{ end_radius_pct: 0.2 }, { end_radius_pct: 0 }] } }, 'box_fights');
  assert.equal(arena.storm.phases.length, 0);
  assert.equal(arena.bus_route, null);
});

test('world coordinates: centre is 0,0, north is +X, east is +Y', () => {
  const spec = generateProcedural('x', 'reload');
  assert.deepEqual(toWorld(spec, 0.5, 0.5), { X: 0, Y: 0, Z: 0 });
  const ne = toWorld(spec, 1, 0);
  assert.equal(ne.X, spec.map_size_m * 50);
  assert.equal(ne.Y, spec.map_size_m * 50);
});

test('Verse files are well-formed for every mode', () => {
  for (const mode of MODE_IDS) {
    const spec = generateProcedural('haunted swamp castle', mode);
    spec.name = 'Spooky "Isle" {test}';
    const files = generateVerseFiles(spec);
    assert.deepEqual(files.map((f) => f.module), MODES[mode].verse);
    const classNames = new Set<string>();
    for (const f of files) {
      assert.ok(!f.code.includes('\t'), 'spaces only');
      assert.ok(!f.code.includes('undefined') && !f.code.includes('NaN'), `${f.path} has no undefined/NaN`);
      assert.match(f.code, new RegExp(`^${f.device} := class\\(creative_device\\):$`, 'm'));
      // every top-level definition is unique across the project
      for (const m of f.code.matchAll(/^([A-Za-z_][A-Za-z0-9_]*)(?:<[a-z]+>)?(?:\(| :=)/gm)) {
        assert.ok(!classNames.has(m[1]), `${m[1]} defined twice`);
        classNames.add(m[1]);
      }
      // indentation is a multiple of 4
      for (const line of f.code.split('\n')) assert.equal((line.match(/^ */)![0].length) % 4, 0, `${f.path}: ${line}`);
      assert.ok(f.setup.length >= 1);
    }
  }
  const spec = generateProcedural('x', 'battle_royale');
  const layout = generateVerseFiles(spec)[0].code;
  assert.equal((layout.match(/_island_forge_marker\{/g) || []).length, collectMarkers(spec).length);
  assert.equal(verseIdent('123 Go!'), 'island_123_go');
});

test('README, devices.csv and publish kit cover the layout', () => {
  const spec = generateProcedural('pirate docks', 'capture_the_flag');
  const readme = generateReadme(spec);
  for (const p of spec.pois) assert.ok(readme.includes(p.name));
  for (const v of generateVerseFiles(spec)) assert.ok(readme.includes(v.path));
  const csv = devicesCsv(spec).trim().split('\n');
  assert.equal(csv.length, spec.devices.filter((d) => d.enabled).length + 1);
  assert.match(publishKit(spec), /TITLE \(max 40\)/);
});

test('zip and png encoders produce valid files', async () => {
  const png = new Uint8Array([137, 80, 78, 71, 0, 1, 2, 255]);
  const files = await readZip(createZip([{ name: 'pkg/README.md', data: '# hello ✓' }, { name: 'pkg/img.png', data: png }]));
  assert.deepEqual(files.map((f) => f.name), ['pkg/README.md', 'pkg/img.png']);
  assert.equal(new TextDecoder().decode(files[0].data), '# hello ✓');
  assert.equal(crc32(new TextEncoder().encode('123456789')), 0xcbf43926);

  const gray = await encodeGray16(3, 2, new Float32Array([0, 0.5, 1, 1, 0.5, 0]));
  assert.deepEqual([...gray.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  assert.equal(new TextDecoder().decode(gray.subarray(12, 16)), 'IHDR');
  assert.equal(new DataView(gray.buffer).getUint32(16), 3);
  assert.equal(gray[24], 16, '16-bit');

  const spec = generateProcedural('x', 'blitz');
  const hm = await heightmapPng(spec, 65);
  assert.equal(new DataView(hm.buffer).getUint32(16), 65);
  const pkg = await packageFiles(spec);
  assert.ok(pkg.some((f) => f.name.endsWith('heightmap-1009.png')));
  assert.ok(pkg.filter((f) => f.name.includes('/Verse/')).length === MODES.blitz.verse.length);
});

test('schema requires every property it defines', () => {
  const walk = (s: any) => {
    if (s?.type === 'object') {
      assert.deepEqual([...s.required].sort(), Object.keys(s.properties).sort());
      assert.equal(s.additionalProperties, false);
      Object.values(s.properties).forEach(walk);
    }
    if (s?.type === 'array') walk(s.items);
  };
  walk(MAP_SCHEMA);
});
