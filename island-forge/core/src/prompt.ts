// Prompt text sent to whichever AI provider is chosen.
import { MODES } from './modes.ts';
import { MAP_SCHEMA } from './schema.ts';

export function buildSystemPrompt(): string {
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
    'Fill publish with a Discover-ready title (max 40 characters), a short description, up to 4 tags and release notes.',
    'Reply with JSON only, matching the provided schema exactly.',
  ].join('\n');
}

export function buildUserPrompt(idea: string, modeId: string): string {
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
    '',
    `Island idea from the creator: """${idea || 'Surprise me with a fun, original island.'}"""`,
  ].join('\n');
}

export function schemaInstructions(): string {
  return `Return a single JSON object that matches this JSON Schema (no markdown fences, no commentary):\n${JSON.stringify(MAP_SCHEMA)}`;
}
