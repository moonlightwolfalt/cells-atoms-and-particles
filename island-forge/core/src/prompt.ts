// Prompt text sent to whichever AI provider is chosen.
import { MODES, BIOMES, POI_KINDS, FEATURE_TYPES } from './modes.ts';
import { MAP_SCHEMA } from './schema.ts';
import { CATALOG } from './catalog.ts';
import { defaultLoot } from './loot.ts';

/** Compact id list of the Creative catalog so the AI can pick real prefabs, galleries and loot. */
export function catalogHints(): string {
  const list = (k: keyof typeof CATALOG) => CATALOG[k].map((e) => e.id).join(', ');
  return [
    `Prefab ids: ${list('prefabs')}`,
    `Gallery ids: ${list('galleries')}`,
    `Item ids: ${list('items')}`,
    `Chest ids: ${list('chests')}`,
    `Vehicle ids: ${list('vehicles')}`,
    `Creature ids: ${list('creatures')}`,
  ].join('\n');
}

/**
 * compact: for free tiers with small per-minute token limits. The Creative catalog lists are left
 * out and the AI leaves prefabs, galleries and loot to Island Forge, which picks them itself.
 */
export interface PromptOptions {
  compact?: boolean;
}

export function buildSystemPrompt(opts: PromptOptions = {}): string {
  return [
    'You are a level designer for Fortnite Creative / UEFN islands of every genre: battle royale, arenas, objective modes, party games, parkour and racing courses, horror, survival, tycoons and hangouts.',
    'You turn a short idea into a complete top-down layout that a creator can rebuild in UEFN.',
    'Coordinates: x and y are fractions from 0 to 1 across the square map; (0,0) is the north-west corner, x grows east, y grows south.',
    'Island-style maps are roughly circular with ocean around them: keep POIs between about 0.12 and 0.88. Arena, course and tycoon maps fill the square.',
    'Give every location a memorable, original name that fits the theme. Never use real Fortnite location names, characters or brands.',
    'Roads connect nearby locations (short polylines). For courses, make the road the course path and put checkpoints along it in order (order = 1, 2, 3...).',
    'Use team = 1, 2, ... for team spawns, flags and bases; team = 0 otherwise. Put features where they make gameplay sense.',
    'If the mode has a storm, phases must shrink to 0 and final_x/final_y must be on land. If the mode has no storm, return an empty phases array.',
    'Respect the mode rules you are given, adjusting them only when the idea clearly asks for it.',
    opts.compact
      ? 'Set every location\'s prefab, extra_prefabs and galleries to null, and set loot to null: Island Forge picks those itself.'
      : 'For every location pick a main prefab id that fits (or "" if none fits), 1-3 smaller extra_prefabs to place around it, and 1-3 gallery ids from the catalog lists. Fill loot with item, chest, vehicle and creature ids from the catalog lists only.',
    'Fill publish with a Discover-ready title (max 40 characters), a short description, up to 4 tags and release notes.',
    'Keep the answer compact so it finishes quickly: descriptions under 15 words, notes under 6 words, 2-4 points per road and at most 6 per river, and roughly the suggested number of features.',
    'Reply with JSON only, matching the provided schema exactly.',
  ].join('\n');
}

export function buildUserPrompt(idea: string, modeId: string, opts: PromptOptions = {}): string {
  const mode = MODES[modeId] || MODES.reload;
  const featureHints = Object.entries(mode.features)
    .filter(([, n]) => n > 0)
    .map(([k, n]) => `${k} x${n}`)
    .join(', ');
  return [
    `Game mode: ${mode.label} (${mode.category}) — ${mode.blurb}`,
    `Layout style: ${mode.layout}. Map size: about ${mode.mapSizeM} m across. Locations: ${mode.poiMin}-${mode.poiMax}.`,
    `Suggested features: ${featureHints || 'none required'}.`,
    `Default rules: ${JSON.stringify(mode.rules)}`,
    mode.storm.length ? `Default storm (${mode.storm.length} phases): ${JSON.stringify(mode.storm)}` : 'This mode has no storm.',
    `Suggested tags: ${mode.tags.join(', ')}`,
    ...(opts.compact
      ? ['']
      : [`Default loot: ${JSON.stringify(defaultLoot(mode))}`, '', 'Fortnite Creative catalog (use these ids):', catalogHints(), '']),
    `Island idea from the creator: """${idea || 'Surprise me with a fun, original island.'}"""`,
  ].join('\n');
}

/** A short description of the answer format, for free tiers with small token limits. */
export function compactSchemaInstructions(): string {
  return [
    'Return ONE JSON object (no markdown) with these keys:',
    'name, tagline, description, theme, time_of_day (day|dawn|dusk|night),',
    `base_biome (${BIOMES.join('|')}), biomes [{type, x, y, radius}],`,
    `pois [{name, kind (${POI_KINDS.join('|')}), x, y, size (small|medium|large), loot_tier (1-3), elevation (0-1), description, prefab: null, extra_prefabs: null, galleries: null}],`,
    'lakes [{x, y, radius}], rivers [{points: [{x, y}]}], roads [{points: [{x, y}]}],',
    `features [{type (${FEATURE_TYPES.join('|')}), x, y, note, team, order}],`,
    'bus_route {start: {x, y}, end: {x, y}}, storm {final_x, final_y, phases: [{wait_s, shrink_s, end_radius_pct, damage_per_tick}]},',
    'rules (same keys as the default rules), loot: null, publish {title, description, tags: [], release_notes}.',
  ].join('\n');
}

export function schemaInstructions(): string {
  return `Return a single JSON object that matches this JSON Schema (no markdown fences, no commentary):\n${JSON.stringify(MAP_SCHEMA)}`;
}
