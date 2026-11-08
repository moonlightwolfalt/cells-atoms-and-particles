// Turns any AI's (possibly sloppy) answer into a valid MapSpec, then plans the UEFN devices.
import type { MapSpec, Feature, Poi, Rules, StormPhase, Publish, PlacedDevice, Loot } from './types.ts';
import { MODES, MODE_IDS, BIOMES, POI_KINDS, FEATURE_TYPES, TIMES_OF_DAY, BUILD_MODES } from './modes.ts';
import { planDevices } from './devicePlan.ts';
import { CATALOG, suggestPrefab, suggestGalleries, type CatalogKind } from './catalog.ts';
import { defaultLoot } from './loot.ts';

const idsOf = (kind: CatalogKind, v: unknown, max: number): string[] => {
  const known = new Set(CATALOG[kind].map((e) => e.id));
  return [...new Set(arr(v).filter((x): x is string => typeof x === 'string' && known.has(x.trim())).map((x) => x.trim()))].slice(0, max);
};

type Raw = Record<string, any>;

export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const num = (v: unknown, d: number): number =>
  typeof v === 'number' && Number.isFinite(v) ? v : typeof v === 'string' && v.trim() !== '' && Number.isFinite(+v) ? +v : d;
const int = (v: unknown, d: number) => Math.round(num(v, d));
const str = (v: unknown, d = '') => (typeof v === 'string' && v.trim() ? v.trim() : d);
function oneOf<T extends string>(v: unknown, list: readonly T[], d: T): T {
  const s = typeof v === 'string' ? v.trim().toLowerCase().replace(/[\s-]+/g, '_') : '';
  return (list as readonly string[]).includes(s) ? (s as T) : d;
}
const arr = (v: unknown): any[] => (Array.isArray(v) ? v : []);
// AIs sometimes answer in 0..100 or 0..1000 instead of 0..1 — rescale those.
const coord = (v: unknown) => {
  let n = num(v, 0.5);
  if (n > 1.5 && n <= 100) n /= 100;
  else if (n > 100 && n <= 1000) n /= 1000;
  return clamp(n, 0.03, 0.97);
};
const pt = (p: any) => ({ x: coord(p?.x ?? (Array.isArray(p) ? p[0] : undefined)), y: coord(p?.y ?? (Array.isArray(p) ? p[1] : undefined)) });

export function hashString(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function normalizeLoot(raw: unknown, mode: (typeof MODES)[string]): Loot {
  if (!raw || typeof raw !== 'object') return defaultLoot(mode);
  const r = raw as Raw;
  return {
    starting_loadout: idsOf('items', r.starting_loadout, 8),
    pool: idsOf('items', r.pool, 40),
    chests: idsOf('chests', r.chests, 12),
    vehicles: idsOf('vehicles', r.vehicles, 8),
    creatures: idsOf('creatures', r.creatures, 8),
  };
}

export function normalizeSpec(raw: unknown, modeId = 'reload', extra: { prompt?: string; generator?: string } = {}): MapSpec {
  const src: Raw = raw && typeof raw === 'object' ? (raw as Raw) : {};
  const mode = MODES[oneOf(src.mode, MODE_IDS, '' as string) || modeId] || MODES.reload;
  const preset = mode.rules;

  const pois: Poi[] = arr(src.pois)
    .slice(0, mode.poiMax + 6)
    .map((p, i) => ({
      name: str(p?.name, `Location ${i + 1}`).slice(0, 40),
      kind: oneOf(p?.kind, POI_KINDS, 'town'),
      x: clamp(coord(p?.x), 0.06, 0.94),
      y: clamp(coord(p?.y), 0.06, 0.94),
      size: oneOf(p?.size, ['small', 'medium', 'large'] as const, 'medium'),
      loot_tier: clamp(int(p?.loot_tier, 2), 1, 3),
      elevation: clamp(num(p?.elevation, 0.2), 0, 1),
      description: str(p?.description).slice(0, 300),
      // filled in below once the theme is known
      prefab: typeof p?.prefab === 'string' ? p.prefab.trim() : (undefined as unknown as string),
      galleries: Array.isArray(p?.galleries) ? p.galleries : (undefined as unknown as string[]),
    }));
  if (pois.length === 0) {
    pois.push({ name: 'Center', kind: 'plaza', x: 0.5, y: 0.5, size: 'medium', loot_tier: 2, elevation: 0.2, description: 'Placeholder location.', prefab: undefined as unknown as string, galleries: undefined as unknown as string[] });
  }

  const r: Raw = src.rules || {};
  const rules: Rules = {
    max_players: clamp(int(r.max_players, preset.max_players), 1, 100),
    team_size: clamp(int(r.team_size, preset.team_size), 1, 16),
    team_count: clamp(int(r.team_count, preset.team_count), 0, 16),
    respawn_enabled: typeof r.respawn_enabled === 'boolean' ? r.respawn_enabled : preset.respawn_enabled,
    respawn_delay_s: clamp(int(r.respawn_delay_s, preset.respawn_delay_s), 0, 120),
    respawn_cutoff_phase: clamp(int(r.respawn_cutoff_phase, preset.respawn_cutoff_phase), 0, 20),
    rounds: clamp(int(r.rounds, preset.rounds), 1, 50),
    round_time_s: clamp(int(r.round_time_s, preset.round_time_s), 30, 7200),
    score_to_win: clamp(int(r.score_to_win, preset.score_to_win), 0, 100000),
    starting_materials: clamp(int(r.starting_materials, preset.starting_materials), 0, 999),
    build_mode: oneOf(r.build_mode, BUILD_MODES, preset.build_mode),
    loot_pool_notes: str(r.loot_pool_notes, preset.loot_pool_notes).slice(0, 400),
  };
  if (!rules.respawn_enabled) rules.respawn_cutoff_phase = 0;

  const radius = (p: Raw) => {
    const v = num(p?.end_radius_pct, 0.1);
    return clamp(v > 1 ? v / 100 : v, 0, 0.5);
  };
  let phases: StormPhase[] = arr(src.storm?.phases).slice(0, 14).map((p) => ({
    wait_s: clamp(int(p?.wait_s, 60), 0, 600),
    shrink_s: clamp(int(p?.shrink_s, 60), 5, 600),
    end_radius_pct: radius(p),
    damage_per_tick: clamp(int(p?.damage_per_tick, 5), 1, 100),
  }));
  if (mode.storm.length === 0) phases = [];
  else if (phases.length < 2) phases = mode.storm.map((p) => ({ ...p }));
  phases.sort((a, b) => b.end_radius_pct - a.end_radius_pct);

  const teamCount = rules.team_count || 0;
  const features: Feature[] = arr(src.features).slice(0, 96).map((f) => ({
    type: oneOf(f?.type, FEATURE_TYPES, 'item_spawner'),
    x: clamp(coord(f?.x), 0.04, 0.96),
    y: clamp(coord(f?.y), 0.04, 0.96),
    note: str(f?.note).slice(0, 160),
    team: clamp(int(f?.team, 0), 0, Math.max(teamCount, 0)),
    order: clamp(int(f?.order, 0), 0, 999),
  }));

  const name = str(src.name, 'Untitled Island').slice(0, 48);
  const tagline = str(src.tagline, mode.blurb).slice(0, 120);
  const description = str(src.description, mode.blurb).slice(0, 600);
  const pub: Raw = src.publish || {};
  const publish: Publish = {
    title: str(pub.title, name).slice(0, 40),
    description: str(pub.description, description).slice(0, 400),
    tags: arr(pub.tags).map((t) => str(t).toLowerCase().slice(0, 24)).filter(Boolean).slice(0, 4),
    release_notes: str(pub.release_notes, 'First release.').slice(0, 400),
  };
  if (publish.tags.length === 0) publish.tags = mode.tags.slice(0, 4);

  const spec: MapSpec = {
    format: 'island-forge/map@3',
    mode: mode.id,
    seed: int(src.seed, NaN) >>> 0 || hashString(JSON.stringify(src.name || '') + mode.id),
    prompt: str(src.prompt ?? extra.prompt).slice(0, 2000),
    generator: str(src.generator ?? extra.generator, 'unknown').slice(0, 80),
    map_size_m: clamp(int(src.map_size_m, mode.mapSizeM), 50, 4000),
    name,
    tagline,
    description,
    theme: str(src.theme, 'classic').slice(0, 80),
    time_of_day: oneOf(src.time_of_day, TIMES_OF_DAY, 'day'),
    base_biome: oneOf(src.base_biome, BIOMES, 'grassland'),
    biomes: arr(src.biomes).slice(0, 12).map((b) => ({ type: oneOf(b?.type, BIOMES, 'grassland'), x: coord(b?.x), y: coord(b?.y), radius: clamp(num(b?.radius, 0.2), 0.04, 0.6) })),
    pois,
    lakes: arr(src.lakes).slice(0, 6).map((l) => ({ x: coord(l?.x), y: coord(l?.y), radius: clamp(num(l?.radius, 0.05), 0.015, 0.12) })),
    rivers: arr(src.rivers).slice(0, 4).map((rv) => ({ points: arr(rv?.points).slice(0, 24).map(pt) })).filter((rv) => rv.points.length >= 2),
    roads: arr(src.roads).slice(0, 30).map((rd) => ({ points: arr(rd?.points).slice(0, 24).map(pt) })).filter((rd) => rd.points.length >= 2),
    features,
    bus_route: !mode.busRoute
      ? null
      : src.bus_route?.start && src.bus_route?.end
        ? { start: pt(src.bus_route.start), end: pt(src.bus_route.end) }
        : { start: { x: 0.05, y: 0.2 }, end: { x: 0.95, y: 0.8 } },
    storm: {
      final_x: clamp(coord(src.storm?.final_x ?? pois[0].x), 0.15, 0.85),
      final_y: clamp(coord(src.storm?.final_y ?? pois[0].y), 0.15, 0.85),
      phases,
    },
    rules,
    loot: normalizeLoot(src.loot, mode),
    publish,
    devices: [],
  };

  // Builds: keep valid prefab/gallery ids, suggest ones for locations that have none.
  const themeWords = [...spec.theme.toLowerCase().split(/[^a-z]+/), spec.base_biome, ...spec.biomes.map((b) => b.type)].filter(Boolean);
  const prefabIds = new Set(CATALOG.prefabs.map((e) => e.id));
  const usedPrefabs = new Set(spec.pois.map((p) => p.prefab).filter((id): id is string => typeof id === 'string' && prefabIds.has(id)));
  for (const p of spec.pois) {
    const key = `${spec.seed}|${p.name}`;
    if (p.prefab === undefined || (p.prefab !== '' && !prefabIds.has(p.prefab))) p.prefab = suggestPrefab(p.kind, themeWords, p.size, key, usedPrefabs);
    const gal = p.galleries === undefined ? [] : idsOf('galleries', p.galleries, 4);
    p.galleries = p.galleries === undefined || (gal.length === 0 && (p.galleries as unknown[]).length > 0) ? suggestGalleries(p.kind, themeWords, key) : gal;
  }

  const keptDevices: PlacedDevice[] = arr(src.devices)
    .filter((dv) => dv && typeof dv.device === 'string' && typeof dv.id === 'string')
    .slice(0, 400)
    .map((dv) => ({
      id: str(dv.id).slice(0, 60),
      device: str(dv.device).slice(0, 60),
      label: str(dv.label, dv.device).slice(0, 80),
      x: coord(dv.x),
      y: coord(dv.y),
      settings: dv.settings && typeof dv.settings === 'object' ? { ...dv.settings } : {},
      enabled: dv.enabled !== false,
    }));
  spec.devices = keptDevices.length ? keptDevices : planDevices(spec);
  return spec;
}
