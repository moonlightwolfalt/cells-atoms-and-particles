// JSON schema the AI must answer in. Claude receives it as a structured-output format; other
// providers get it pasted into the prompt. `npm run schema` writes it to /schema for Python/Ruby.
import { BIOMES, POI_KINDS, FEATURE_TYPES, TIMES_OF_DAY, BUILD_MODES } from './modes.ts';

const point = {
  type: 'object',
  properties: { x: { type: 'number' }, y: { type: 'number' } },
  required: ['x', 'y'],
  additionalProperties: false,
};

const obj = (properties: Record<string, unknown>, extra: Record<string, unknown> = {}) => ({
  type: 'object',
  properties,
  required: Object.keys(properties),
  additionalProperties: false,
  ...extra,
});

export const MAP_SCHEMA = obj({
  name: { type: 'string', description: 'Island name, 1-4 words.' },
  tagline: { type: 'string', description: 'One punchy line for the island thumbnail.' },
  description: { type: 'string', description: '2-3 sentences for the island description.' },
  theme: { type: 'string' },
  time_of_day: { type: 'string', enum: [...TIMES_OF_DAY] },
  base_biome: { type: 'string', enum: BIOMES },
  biomes: {
    type: 'array',
    description: 'Biome regions. x,y are 0..1 across the map (0,0 = north-west corner). radius is 0..1.',
    items: obj({ type: { type: 'string', enum: BIOMES }, x: { type: 'number' }, y: { type: 'number' }, radius: { type: 'number' } }),
  },
  pois: {
    type: 'array',
    description: 'Named locations / areas. Spread them out and keep them on land (about 0.12..0.88).',
    items: obj({
      name: { type: 'string' },
      kind: { type: 'string', enum: POI_KINDS },
      x: { type: 'number' },
      y: { type: 'number' },
      size: { type: 'string', enum: ['small', 'medium', 'large'] },
      loot_tier: { type: 'integer', description: '1 = light, 3 = hot drop.' },
      elevation: { type: 'number', description: '0 = sea level, 1 = mountain top.' },
      description: { type: 'string' },
    }),
  },
  lakes: { type: 'array', items: obj({ x: { type: 'number' }, y: { type: 'number' }, radius: { type: 'number' } }) },
  rivers: { type: 'array', items: obj({ points: { type: 'array', items: point } }) },
  roads: { type: 'array', items: obj({ points: { type: 'array', items: point } }) },
  features: {
    type: 'array',
    description: 'Gameplay objects. team: 0 none, 1 red, 2 blue, 3+ more teams. order: sequence for checkpoints/race gates/upgrades, else 0.',
    items: obj({
      type: { type: 'string', enum: FEATURE_TYPES },
      x: { type: 'number' },
      y: { type: 'number' },
      note: { type: 'string' },
      team: { type: 'integer' },
      order: { type: 'integer' },
    }),
  },
  bus_route: obj({ start: point, end: point }, { description: 'Only used by modes with a Battle Bus.' }),
  storm: obj({
    final_x: { type: 'number' },
    final_y: { type: 'number' },
    phases: {
      type: 'array',
      description: 'Empty for modes without a storm.',
      items: obj({
        wait_s: { type: 'integer' },
        shrink_s: { type: 'integer' },
        end_radius_pct: { type: 'number', description: 'Radius after this phase as a fraction of map width.' },
        damage_per_tick: { type: 'integer' },
      }),
    },
  }),
  rules: obj({
    max_players: { type: 'integer' },
    team_size: { type: 'integer' },
    team_count: { type: 'integer', description: '0 = free for all / squads decided by team_size.' },
    respawn_enabled: { type: 'boolean' },
    respawn_delay_s: { type: 'integer' },
    respawn_cutoff_phase: { type: 'integer', description: 'Storm phase when respawns stop. 0 = never.' },
    rounds: { type: 'integer' },
    round_time_s: { type: 'integer' },
    score_to_win: { type: 'integer', description: '0 = no score limit.' },
    starting_materials: { type: 'integer' },
    build_mode: { type: 'string', enum: [...BUILD_MODES] },
    loot_pool_notes: { type: 'string' },
  }),
  publish: obj({
    title: { type: 'string', description: 'Island title for Discover, max 40 characters.' },
    description: { type: 'string', description: 'Island description, max 3 short lines.' },
    tags: { type: 'array', items: { type: 'string' }, description: 'Up to 4 short genre tags.' },
    release_notes: { type: 'string' },
  }),
});
