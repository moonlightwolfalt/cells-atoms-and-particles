// Prompt text sent to whichever AI provider is chosen.
import { MODES, MAP_SCHEMA } from './modes.js';

export function buildSystemPrompt() {
  return [
    'You are a level designer for Fortnite Creative / UEFN islands.',
    'You turn a short idea into a complete top-down island layout that a creator can rebuild in UEFN.',
    'Coordinates: x and y are fractions from 0 to 1 across the square island map; (0,0) is the north-west corner, x grows east, y grows south.',
    'The island is roughly circular with ocean around it, so keep POIs between about 0.12 and 0.88 and spread them out evenly; do not stack them.',
    'Give every POI a memorable, original name that fits the theme (no real Fortnite location names).',
    'Roads should connect nearby POIs (each road is a short polyline). Rivers should run from inland to the coast.',
    'Place features (reboot vans, vaults, bosses, medallions, vending machines, launch pads, etc.) where they make gameplay sense; vaults, bosses and medallions belong inside POIs.',
    'The storm phases must shrink: each end_radius_pct smaller than the last, ending at 0. Put final_x/final_y on land.',
    'Respect the game-mode rules you are given, adjusting them only when the idea clearly asks for it.',
    'Reply with JSON only, matching the provided schema exactly.',
  ].join('\n');
}

export function buildUserPrompt(idea, modeId) {
  const mode = MODES[modeId] || MODES.reload;
  const featureHints = Object.entries(mode.features)
    .filter(([, n]) => n > 0)
    .map(([k, n]) => `${k} x${n}`)
    .join(', ');
  return [
    `Game mode: ${mode.label} — ${mode.blurb}`,
    `Island size: about ${mode.mapSizeM} m across. POI count: ${mode.poiMin}-${mode.poiMax}.`,
    `Suggested features: ${featureHints}.`,
    `Default rules for this mode: ${JSON.stringify(mode.rules)}`,
    `Default storm for this mode (${mode.storm.length} phases): ${JSON.stringify(mode.storm)}`,
    '',
    `Island idea from the creator: """${idea || 'Surprise me with a fun, original island.'}"""`,
  ].join('\n');
}

// For providers without schema-constrained output we paste the schema into the prompt.
export function schemaInstructions() {
  return `Return a single JSON object that matches this JSON Schema (no markdown fences, no commentary):\n${JSON.stringify(MAP_SCHEMA)}`;
}
