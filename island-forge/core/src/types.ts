// Shared types for every Island Forge client (web, server, mobile). Python and Ruby use
// the generated JSON schema in /schema instead.

export type LayoutStyle = 'island' | 'arena' | 'course' | 'plots' | 'hub';
export type BuildMode = 'build' | 'zero_build' | 'edit_only';
export type TimeOfDay = 'day' | 'dawn' | 'dusk' | 'night';

export interface Point {
  x: number;
  y: number;
}

export interface Biome extends Point {
  type: string;
  radius: number;
}

export interface Poi extends Point {
  name: string;
  kind: string;
  size: 'small' | 'medium' | 'large';
  loot_tier: number;
  elevation: number;
  description: string;
  /** Main prefab id from the catalog ('' = build by hand). */
  prefab: string;
  /** Smaller prefabs placed around the main one (extra buildings, props, set pieces). */
  extra_prefabs: string[];
  /** Gallery ids to dress this location. */
  galleries: string[];
}

export interface Lake extends Point {
  radius: number;
}

export interface Path {
  points: Point[];
}

export interface Feature extends Point {
  type: string;
  note: string;
  /** 0 = no team, 1..n = team index (red = 1, blue = 2, ...). */
  team: number;
  /** Order along a course (checkpoints, race gates, tycoon upgrades). 0 when unordered. */
  order: number;
}

export interface StormPhase {
  wait_s: number;
  shrink_s: number;
  end_radius_pct: number;
  damage_per_tick: number;
}

export interface Rules {
  max_players: number;
  team_size: number;
  team_count: number;
  respawn_enabled: boolean;
  respawn_delay_s: number;
  respawn_cutoff_phase: number;
  rounds: number;
  round_time_s: number;
  score_to_win: number;
  starting_materials: number;
  build_mode: BuildMode;
  loot_pool_notes: string;
}

/** Catalog ids (see catalog.ts). */
export interface Loot {
  starting_loadout: string[];
  pool: string[];
  chests: string[];
  vehicles: string[];
  creatures: string[];
}

export interface Publish {
  title: string;
  description: string;
  tags: string[];
  release_notes: string;
}

export interface PlacedDevice extends Point {
  id: string;
  device: string;
  label: string;
  settings: Record<string, string | number | boolean>;
  enabled: boolean;
}

export interface MapSpec {
  format: 'island-forge/map@3';
  mode: string;
  seed: number;
  prompt: string;
  generator: string;
  map_size_m: number;
  name: string;
  tagline: string;
  description: string;
  theme: string;
  time_of_day: TimeOfDay;
  base_biome: string;
  biomes: Biome[];
  pois: Poi[];
  lakes: Lake[];
  rivers: Path[];
  roads: Path[];
  features: Feature[];
  bus_route: { start: Point; end: Point } | null;
  storm: { final_x: number; final_y: number; phases: StormPhase[] };
  rules: Rules;
  loot: Loot;
  publish: Publish;
  devices: PlacedDevice[];
}

export interface ModeDef {
  id: string;
  label: string;
  category: string;
  blurb: string;
  layout: LayoutStyle;
  mapSizeM: number;
  poiMin: number;
  poiMax: number;
  rules: Rules;
  storm: StormPhase[];
  features: Record<string, number>;
  /** Device ids (see devices.ts) every island of this mode needs. */
  devices: string[];
  /** Verse module ids (see verse/index.ts) generated for this mode. */
  verse: string[];
  tags: string[];
  busRoute: boolean;
}

export interface DeviceSetting {
  key: string;
  value: string | number | boolean;
}

export interface DeviceDef {
  id: string;
  name: string;
  category: string;
  description: string;
  /** Verse class name when the device can be referenced from Verse. */
  verse?: string;
  settings: Record<string, string | number | boolean>;
}
