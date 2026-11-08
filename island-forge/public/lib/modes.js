// Game-mode presets, the map-spec JSON schema, and the normalizer that turns
// any AI's (possibly sloppy) output into a valid, renderable map spec.
// Shared by the browser and the Node server.

export const MODES = {
  reload: {
    id: 'reload',
    label: 'Reload',
    blurb: 'Small island, squads, respawn while a teammate is still alive — until the late storm.',
    mapSizeM: 1000,
    poiMin: 5,
    poiMax: 8,
    rules: {
      max_players: 40,
      team_size: 4,
      respawn_enabled: true,
      respawn_delay_s: 15,
      respawn_cutoff_phase: 4,
      starting_materials: 300,
      loot_pool_notes: 'Classic-style loot pool, floor loot heavy, chests in every named location.',
    },
    storm: [
      { wait_s: 60, shrink_s: 90, end_radius_pct: 0.42, damage_per_tick: 1 },
      { wait_s: 60, shrink_s: 75, end_radius_pct: 0.3, damage_per_tick: 2 },
      { wait_s: 50, shrink_s: 60, end_radius_pct: 0.2, damage_per_tick: 5 },
      { wait_s: 45, shrink_s: 50, end_radius_pct: 0.12, damage_per_tick: 8 },
      { wait_s: 40, shrink_s: 45, end_radius_pct: 0.06, damage_per_tick: 10 },
      { wait_s: 30, shrink_s: 40, end_radius_pct: 0.0, damage_per_tick: 10 },
    ],
    features: { reboot_van: 0, vault: 1, boss: 0, medallion: 0, vending_machine: 3, launch_pad: 2, supply_drop: 2, campfire: 2, zipline: 1, rift: 1 },
  },
  battle_royale: {
    id: 'battle_royale',
    label: 'Battle Royale',
    blurb: 'Full-size island, 100 players, one life — reboot vans bring squadmates back.',
    mapSizeM: 2500,
    poiMin: 12,
    poiMax: 18,
    rules: {
      max_players: 100,
      team_size: 4,
      respawn_enabled: false,
      respawn_delay_s: 0,
      respawn_cutoff_phase: 0,
      starting_materials: 0,
      loot_pool_notes: 'Full loot pool across all rarities; vaults and bosses hold mythics.',
    },
    storm: [
      { wait_s: 150, shrink_s: 180, end_radius_pct: 0.45, damage_per_tick: 1 },
      { wait_s: 120, shrink_s: 120, end_radius_pct: 0.33, damage_per_tick: 1 },
      { wait_s: 90, shrink_s: 90, end_radius_pct: 0.24, damage_per_tick: 2 },
      { wait_s: 80, shrink_s: 80, end_radius_pct: 0.16, damage_per_tick: 5 },
      { wait_s: 70, shrink_s: 70, end_radius_pct: 0.1, damage_per_tick: 8 },
      { wait_s: 60, shrink_s: 60, end_radius_pct: 0.06, damage_per_tick: 10 },
      { wait_s: 45, shrink_s: 60, end_radius_pct: 0.035, damage_per_tick: 10 },
      { wait_s: 30, shrink_s: 45, end_radius_pct: 0.015, damage_per_tick: 10 },
      { wait_s: 0, shrink_s: 60, end_radius_pct: 0.0, damage_per_tick: 10 },
    ],
    features: { reboot_van: 8, vault: 2, boss: 2, medallion: 0, vending_machine: 6, launch_pad: 4, supply_drop: 4, campfire: 4, zipline: 3, rift: 2 },
  },
  blitz: {
    id: 'blitz',
    label: 'Blitz',
    blurb: 'Tiny, fast and chaotic — short matches, a quick storm and medallion bosses.',
    mapSizeM: 750,
    poiMin: 4,
    poiMax: 6,
    rules: {
      max_players: 36,
      team_size: 1,
      respawn_enabled: false,
      respawn_delay_s: 0,
      respawn_cutoff_phase: 0,
      starting_materials: 100,
      loot_pool_notes: 'Boosted rarity, faster chests, medallions grant mobility or healing perks.',
    },
    storm: [
      { wait_s: 30, shrink_s: 45, end_radius_pct: 0.35, damage_per_tick: 2 },
      { wait_s: 30, shrink_s: 40, end_radius_pct: 0.22, damage_per_tick: 4 },
      { wait_s: 25, shrink_s: 35, end_radius_pct: 0.12, damage_per_tick: 8 },
      { wait_s: 20, shrink_s: 30, end_radius_pct: 0.05, damage_per_tick: 10 },
      { wait_s: 15, shrink_s: 30, end_radius_pct: 0.0, damage_per_tick: 10 },
    ],
    features: { reboot_van: 0, vault: 0, boss: 2, medallion: 2, vending_machine: 2, launch_pad: 1, supply_drop: 1, campfire: 1, zipline: 0, rift: 1 },
  },
};

export const MODE_IDS = Object.keys(MODES);

export const BIOMES = ['grassland', 'forest', 'desert', 'snow', 'swamp', 'jungle', 'volcanic', 'beach', 'mountain', 'urban', 'autumn', 'candy'];
export const POI_KINDS = ['town', 'city', 'industrial', 'landmark', 'fort', 'ruins', 'farm', 'resort', 'military', 'cave', 'castle', 'lab', 'docks', 'temple'];
export const FEATURE_TYPES = ['reboot_van', 'vault', 'boss', 'medallion', 'vending_machine', 'launch_pad', 'supply_drop', 'campfire', 'zipline', 'rift'];
export const TIMES_OF_DAY = ['day', 'dawn', 'dusk', 'night'];

// --- JSON schema handed to the AI (Claude uses it as a structured-output format) ---

const point = {
  type: 'object',
  properties: { x: { type: 'number' }, y: { type: 'number' } },
  required: ['x', 'y'],
  additionalProperties: false,
};

export const MAP_SCHEMA = {
  type: 'object',
  properties: {
    name: { type: 'string', description: 'Island name, 1-4 words.' },
    tagline: { type: 'string', description: 'One punchy line for the island thumbnail.' },
    description: { type: 'string', description: '2-3 sentences for the island description in the Creator Portal.' },
    theme: { type: 'string' },
    time_of_day: { type: 'string', enum: TIMES_OF_DAY },
    base_biome: { type: 'string', enum: BIOMES },
    biomes: {
      type: 'array',
      description: 'Biome regions. x,y are 0..1 across the island (0,0 = north-west corner). radius is 0..1.',
      items: {
        type: 'object',
        properties: { type: { type: 'string', enum: BIOMES }, x: { type: 'number' }, y: { type: 'number' }, radius: { type: 'number' } },
        required: ['type', 'x', 'y', 'radius'],
        additionalProperties: false,
      },
    },
    pois: {
      type: 'array',
      description: 'Named locations and landmarks. Keep them on land (roughly 0.12..0.88) and spread apart.',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          kind: { type: 'string', enum: POI_KINDS },
          x: { type: 'number' },
          y: { type: 'number' },
          size: { type: 'string', enum: ['small', 'medium', 'large'] },
          loot_tier: { type: 'integer', description: '1 = light loot, 3 = hot drop.' },
          elevation: { type: 'number', description: '0 = sea level, 1 = mountain top.' },
          description: { type: 'string' },
        },
        required: ['name', 'kind', 'x', 'y', 'size', 'loot_tier', 'elevation', 'description'],
        additionalProperties: false,
      },
    },
    lakes: {
      type: 'array',
      items: {
        type: 'object',
        properties: { x: { type: 'number' }, y: { type: 'number' }, radius: { type: 'number' } },
        required: ['x', 'y', 'radius'],
        additionalProperties: false,
      },
    },
    rivers: { type: 'array', items: { type: 'object', properties: { points: { type: 'array', items: point } }, required: ['points'], additionalProperties: false } },
    roads: { type: 'array', items: { type: 'object', properties: { points: { type: 'array', items: point } }, required: ['points'], additionalProperties: false } },
    features: {
      type: 'array',
      items: {
        type: 'object',
        properties: { type: { type: 'string', enum: FEATURE_TYPES }, x: { type: 'number' }, y: { type: 'number' }, note: { type: 'string' } },
        required: ['type', 'x', 'y', 'note'],
        additionalProperties: false,
      },
    },
    bus_route: { type: 'object', properties: { start: point, end: point }, required: ['start', 'end'], additionalProperties: false },
    storm: {
      type: 'object',
      properties: {
        final_x: { type: 'number' },
        final_y: { type: 'number' },
        phases: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              wait_s: { type: 'integer' },
              shrink_s: { type: 'integer' },
              end_radius_pct: { type: 'number', description: 'Circle radius after this phase, as a fraction of map width.' },
              damage_per_tick: { type: 'integer' },
            },
            required: ['wait_s', 'shrink_s', 'end_radius_pct', 'damage_per_tick'],
            additionalProperties: false,
          },
        },
      },
      required: ['final_x', 'final_y', 'phases'],
      additionalProperties: false,
    },
    rules: {
      type: 'object',
      properties: {
        max_players: { type: 'integer' },
        team_size: { type: 'integer' },
        respawn_enabled: { type: 'boolean' },
        respawn_delay_s: { type: 'integer' },
        respawn_cutoff_phase: { type: 'integer', description: 'Respawns stop when this storm phase starts. 0 = never respawn.' },
        starting_materials: { type: 'integer' },
        loot_pool_notes: { type: 'string' },
      },
      required: ['max_players', 'team_size', 'respawn_enabled', 'respawn_delay_s', 'respawn_cutoff_phase', 'starting_materials', 'loot_pool_notes'],
      additionalProperties: false,
    },
  },
  required: ['name', 'tagline', 'description', 'theme', 'time_of_day', 'base_biome', 'biomes', 'pois', 'lakes', 'rivers', 'roads', 'features', 'bus_route', 'storm', 'rules'],
  additionalProperties: false,
};

// --- Normalizer ---

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const num = (v, d) => (typeof v === 'number' && Number.isFinite(v) ? v : typeof v === 'string' && v.trim() !== '' && Number.isFinite(+v) ? +v : d);
const int = (v, d) => Math.round(num(v, d));
const str = (v, d = '') => (typeof v === 'string' && v.trim() ? v.trim() : d);
const oneOf = (v, list, d) => {
  const s = typeof v === 'string' ? v.trim().toLowerCase().replace(/[\s-]+/g, '_') : '';
  return list.includes(s) ? s : d;
};
const arr = (v) => (Array.isArray(v) ? v : []);
// AIs sometimes answer in 0..100 or 0..1000 instead of 0..1 — rescale those.
const coord = (v) => {
  let n = num(v, 0.5);
  if (n > 1.5 && n <= 100) n /= 100;
  else if (n > 100 && n <= 1000) n /= 1000;
  return clamp(n, 0.03, 0.97);
};
const pt = (p) => ({ x: coord(p?.x ?? (Array.isArray(p) ? p[0] : undefined)), y: coord(p?.y ?? (Array.isArray(p) ? p[1] : undefined)) });

export function normalizeSpec(raw, modeId = 'reload', extra = {}) {
  const src = raw && typeof raw === 'object' ? raw : {};
  const mode = MODES[oneOf(src.mode, MODE_IDS, '') || modeId] || MODES.reload;
  const preset = mode.rules;

  const pois = arr(src.pois)
    .slice(0, mode.poiMax + 4)
    .map((p, i) => ({
      name: str(p?.name, `Location ${i + 1}`).slice(0, 40),
      kind: oneOf(p?.kind, POI_KINDS, 'town'),
      x: clamp(coord(p?.x), 0.08, 0.92),
      y: clamp(coord(p?.y), 0.08, 0.92),
      size: oneOf(p?.size, ['small', 'medium', 'large'], 'medium'),
      loot_tier: clamp(int(p?.loot_tier, 2), 1, 3),
      elevation: clamp(num(p?.elevation, 0.2), 0, 1),
      description: str(p?.description).slice(0, 300),
    }));

  const r = src.rules || {};
  const rules = {
    max_players: clamp(int(r.max_players, preset.max_players), 2, 100),
    team_size: clamp(int(r.team_size, preset.team_size), 1, 4),
    respawn_enabled: typeof r.respawn_enabled === 'boolean' ? r.respawn_enabled : preset.respawn_enabled,
    respawn_delay_s: clamp(int(r.respawn_delay_s, preset.respawn_delay_s), 0, 120),
    respawn_cutoff_phase: clamp(int(r.respawn_cutoff_phase, preset.respawn_cutoff_phase), 0, 20),
    starting_materials: clamp(int(r.starting_materials, preset.starting_materials), 0, 999),
    loot_pool_notes: str(r.loot_pool_notes, preset.loot_pool_notes).slice(0, 400),
  };
  if (!rules.respawn_enabled) rules.respawn_cutoff_phase = 0;

  let phases = arr(src.storm?.phases).slice(0, 14).map((p) => ({
    wait_s: clamp(int(p?.wait_s, 60), 0, 600),
    shrink_s: clamp(int(p?.shrink_s, 60), 5, 600),
    end_radius_pct: clamp(num(p?.end_radius_pct, 0.1) > 1 ? num(p?.end_radius_pct, 10) / 100 : num(p?.end_radius_pct, 0.1), 0, 0.5),
    damage_per_tick: clamp(int(p?.damage_per_tick, 5), 1, 100),
  }));
  if (phases.length < 2) phases = mode.storm.map((p) => ({ ...p }));
  phases.sort((a, b) => b.end_radius_pct - a.end_radius_pct);

  const spec = {
    format: 'island-forge/map@1',
    mode: mode.id,
    seed: (int(src.seed, NaN) >>> 0) || hashString(JSON.stringify(src.name || '') + mode.id),
    prompt: str(src.prompt ?? extra.prompt).slice(0, 2000),
    generator: str(src.generator ?? extra.generator, 'unknown').slice(0, 80),
    map_size_m: clamp(int(src.map_size_m, mode.mapSizeM), 200, 4000),
    name: str(src.name, 'Untitled Island').slice(0, 48),
    tagline: str(src.tagline, mode.blurb).slice(0, 120),
    description: str(src.description, mode.blurb).slice(0, 600),
    theme: str(src.theme, 'classic').slice(0, 80),
    time_of_day: oneOf(src.time_of_day, TIMES_OF_DAY, 'day'),
    base_biome: oneOf(src.base_biome, BIOMES, 'grassland'),
    biomes: arr(src.biomes).slice(0, 12).map((b) => ({
      type: oneOf(b?.type, BIOMES, 'grassland'),
      x: coord(b?.x),
      y: coord(b?.y),
      radius: clamp(num(b?.radius, 0.2), 0.04, 0.6),
    })),
    pois,
    lakes: arr(src.lakes).slice(0, 6).map((l) => ({ x: coord(l?.x), y: coord(l?.y), radius: clamp(num(l?.radius, 0.05), 0.015, 0.12) })),
    rivers: arr(src.rivers).slice(0, 4).map((rv) => ({ points: arr(rv?.points).slice(0, 24).map(pt) })).filter((rv) => rv.points.length >= 2),
    roads: arr(src.roads).slice(0, 24).map((rd) => ({ points: arr(rd?.points).slice(0, 24).map(pt) })).filter((rd) => rd.points.length >= 2),
    features: arr(src.features).slice(0, 48).map((f) => ({
      type: oneOf(f?.type, FEATURE_TYPES, 'supply_drop'),
      x: clamp(coord(f?.x), 0.06, 0.94),
      y: clamp(coord(f?.y), 0.06, 0.94),
      note: str(f?.note).slice(0, 160),
    })),
    bus_route: src.bus_route?.start && src.bus_route?.end
      ? { start: pt(src.bus_route.start), end: pt(src.bus_route.end) }
      : { start: { x: 0.05, y: 0.2 }, end: { x: 0.95, y: 0.8 } },
    storm: {
      final_x: clamp(coord(src.storm?.final_x ?? pois[0]?.x ?? 0.5), 0.15, 0.85),
      final_y: clamp(coord(src.storm?.final_y ?? pois[0]?.y ?? 0.5), 0.15, 0.85),
      phases,
    },
    rules,
  };

  if (spec.pois.length === 0) {
    spec.pois.push({ name: 'Center Square', kind: 'town', x: 0.5, y: 0.5, size: 'medium', loot_tier: 2, elevation: 0.2, description: 'Placeholder POI.' });
  }
  return spec;
}

export function hashString(s) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
