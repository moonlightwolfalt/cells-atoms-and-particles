// Offline generator: builds a full map spec from a prompt with no AI at all.
// Keywords in the prompt steer biomes, POI types and names; the rest is seeded randomness.

import { MODES, normalizeSpec, hashString } from './modes.js';
import { makeRng } from './rng.js';

const THEMES = [
  { words: ['snow', 'ice', 'winter', 'frozen', 'arctic', 'christmas', 'holiday'], base: 'snow', extra: ['mountain', 'forest'], kinds: ['town', 'cave', 'lab', 'fort'], names: ['Frost', 'Glacier', 'Icicle', 'Snowdrift', 'Polar', 'Chilly', 'Blizzard'] },
  { words: ['desert', 'sand', 'dune', 'western', 'canyon', 'mesa', 'cowboy'], base: 'desert', extra: ['mountain', 'beach'], kinds: ['town', 'ruins', 'temple', 'farm'], names: ['Dusty', 'Sandy', 'Cactus', 'Mirage', 'Sunbaked', 'Canyon', 'Tumble'] },
  { words: ['jungle', 'tropical', 'rainforest', 'temple', 'aztec', 'dino'], base: 'jungle', extra: ['beach', 'swamp'], kinds: ['temple', 'ruins', 'resort', 'cave'], names: ['Vine', 'Canopy', 'Monkey', 'Lost', 'Emerald', 'Mossy', 'Tiki'] },
  { words: ['volcano', 'lava', 'fire', 'magma', 'inferno', 'hell'], base: 'volcanic', extra: ['mountain', 'desert'], kinds: ['lab', 'fort', 'cave', 'industrial'], names: ['Ember', 'Ashen', 'Magma', 'Scorched', 'Cinder', 'Blaze', 'Molten'] },
  { words: ['city', 'urban', 'neon', 'cyber', 'futur', 'metro', 'downtown', 'tech'], base: 'urban', extra: ['grassland', 'beach'], kinds: ['city', 'industrial', 'lab', 'docks'], names: ['Neon', 'Chrome', 'Metro', 'Circuit', 'Pixel', 'Skyline', 'Volt'] },
  { words: ['swamp', 'bog', 'marsh', 'spooky', 'halloween', 'haunted', 'zombie'], base: 'swamp', extra: ['forest', 'autumn'], kinds: ['ruins', 'farm', 'castle', 'town'], names: ['Murky', 'Gloom', 'Haunted', 'Croaky', 'Mire', 'Shadow', 'Creepy'] },
  { words: ['medieval', 'castle', 'knight', 'fantasy', 'dragon', 'kingdom', 'magic'], base: 'forest', extra: ['mountain', 'grassland'], kinds: ['castle', 'town', 'ruins', 'fort'], names: ['Crown', 'Dragon', 'Knight', 'Moat', 'Rune', 'Royal', 'Wizard'] },
  { words: ['beach', 'island', 'ocean', 'pirate', 'tropic', 'summer', 'surf'], base: 'beach', extra: ['jungle', 'grassland'], kinds: ['docks', 'resort', 'town', 'fort'], names: ['Coral', 'Salty', 'Pirate', 'Sunny', 'Shell', 'Tidal', 'Lagoon'] },
  { words: ['autumn', 'fall', 'harvest', 'farm', 'cozy', 'pumpkin'], base: 'autumn', extra: ['grassland', 'forest'], kinds: ['farm', 'town', 'landmark', 'ruins'], names: ['Maple', 'Harvest', 'Acorn', 'Rusty', 'Cozy', 'Golden', 'Hay'] },
  { words: ['candy', 'sweet', 'toy', 'cute', 'rainbow', 'party'], base: 'candy', extra: ['grassland', 'candy', 'forest'], kinds: ['landmark', 'resort', 'town', 'castle'], names: ['Sugar', 'Gumdrop', 'Sprinkle', 'Lolli', 'Fizzy', 'Jelly', 'Bubble'] },
  { words: ['military', 'army', 'war', 'bunker', 'base', 'spy', 'agent'], base: 'grassland', extra: ['forest', 'mountain'], kinds: ['military', 'fort', 'lab', 'industrial'], names: ['Bunker', 'Outpost', 'Agent', 'Recon', 'Steel', 'Command', 'Ironclad'] },
];

const DEFAULT_THEME = { base: 'grassland', extra: ['forest', 'mountain', 'beach', 'desert', 'snow'], kinds: ['town', 'farm', 'industrial', 'landmark', 'city', 'fort'], names: ['Pleasant', 'Lazy', 'Salty', 'Misty', 'Rocky', 'Sunny', 'Windy', 'Shifty', 'Lucky'] };

const SUFFIX = {
  town: ['Park', 'Village', 'Hamlet', 'Heights', 'Grove'],
  city: ['City', 'Towers', 'Plaza', 'Downtown', 'Avenue'],
  industrial: ['Factory', 'Yard', 'Works', 'Refinery', 'Depot'],
  landmark: ['Peak', 'Point', 'Monument', 'Arch', 'Rock'],
  fort: ['Fort', 'Stronghold', 'Keep', 'Bastion'],
  ruins: ['Ruins', 'Remains', 'Relic'],
  farm: ['Farm', 'Fields', 'Orchard', 'Ranch'],
  resort: ['Resort', 'Retreat', 'Springs', 'Lodge'],
  military: ['Base', 'Outpost', 'Barracks', 'Silo'],
  cave: ['Caverns', 'Hollow', 'Grotto', 'Mines'],
  castle: ['Castle', 'Citadel', 'Palace'],
  lab: ['Lab', 'Facility', 'Station', 'Reactor'],
  docks: ['Docks', 'Harbor', 'Pier', 'Wharf'],
  temple: ['Temple', 'Shrine', 'Sanctum'],
};

function detectThemes(prompt) {
  const p = prompt.toLowerCase();
  return THEMES.filter((t) => t.words.some((w) => p.includes(w)));
}

function placeSpread(rng, count, minDist, margin = 0.14, existing = []) {
  const out = [];
  for (let attempt = 0; out.length < count && attempt < count * 400; attempt++) {
    // Keep things roughly inside a circle so they land on the island.
    const a = rng.range(0, Math.PI * 2);
    const d = Math.sqrt(rng.next()) * (0.5 - margin);
    const p = { x: 0.5 + Math.cos(a) * d, y: 0.5 + Math.sin(a) * d };
    const md = attempt > count * 300 ? minDist * 0.6 : minDist;
    if ([...existing, ...out].every((q) => Math.hypot(q.x - p.x, q.y - p.y) >= md)) out.push(p);
  }
  return out;
}

// Minimum spanning tree over POIs -> road network.
function mstRoads(pts, rng) {
  if (pts.length < 2) return [];
  const inTree = [0];
  const edges = [];
  while (inTree.length < pts.length) {
    let best = null;
    for (const i of inTree) {
      for (let j = 0; j < pts.length; j++) {
        if (inTree.includes(j)) continue;
        const d = Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y);
        if (!best || d < best.d) best = { i, j, d };
      }
    }
    inTree.push(best.j);
    edges.push([best.i, best.j]);
  }
  return edges.map(([i, j]) => {
    const a = pts[i];
    const b = pts[j];
    const mid = { x: (a.x + b.x) / 2 + rng.range(-0.03, 0.03), y: (a.y + b.y) / 2 + rng.range(-0.03, 0.03) };
    return { points: [a, mid, b].map((p) => ({ x: p.x, y: p.y })) };
  });
}

export function generateProcedural(prompt = '', modeId = 'reload', seedOverride) {
  const mode = MODES[modeId] || MODES.reload;
  const seed = seedOverride ?? hashString(`${prompt}|${modeId}`);
  const rng = makeRng(seed);
  const themes = detectThemes(prompt);
  const main = themes[0] || DEFAULT_THEME;
  const kinds = [...new Set(themes.flatMap((t) => t.kinds).concat(main.kinds))];
  const nameBank = [...new Set(themes.flatMap((t) => t.names).concat(main.names, DEFAULT_THEME.names))];

  const poiCount = rng.int(mode.poiMin, mode.poiMax);
  const minDist = 0.62 / Math.sqrt(poiCount + 1);
  const spots = placeSpread(rng, poiCount, minDist);
  const usedNames = new Set();

  const pois = spots.map((p, i) => {
    const kind = i === 0 && themes.length ? main.kinds[0] : rng.pick(kinds);
    let name;
    for (let k = 0; k < 20; k++) {
      name = `${rng.pick(nameBank)} ${rng.pick(SUFFIX[kind])}`;
      if (!usedNames.has(name)) break;
    }
    usedNames.add(name);
    const center = Math.hypot(p.x - 0.5, p.y - 0.5);
    const size = center < 0.12 ? 'large' : rng.pick(['small', 'medium', 'medium', 'large']);
    return {
      name,
      kind,
      x: p.x,
      y: p.y,
      size,
      loot_tier: size === 'large' ? 3 : size === 'medium' ? 2 : rng.int(1, 2),
      elevation: kind === 'landmark' || kind === 'castle' ? rng.range(0.5, 0.9) : rng.range(0.05, 0.4),
      description: `A ${size} ${kind} ${themes.length ? `with a ${main.base} vibe` : 'on the island'}.`,
    };
  });

  const biomeTypes = [main.base, ...main.extra, ...themes.slice(1).map((t) => t.base)];
  const biomes = placeSpread(rng, Math.min(5, 2 + themes.length + rng.int(0, 2)), 0.22, 0.1).map((p, i) => ({
    type: biomeTypes[i % biomeTypes.length],
    x: p.x,
    y: p.y,
    radius: rng.range(0.14, 0.26),
  }));

  const lakes = placeSpread(rng, rng.int(0, mode.id === 'battle_royale' ? 3 : 1), 0.12, 0.18, pois).map((p) => ({ ...p, radius: rng.range(0.025, 0.055) }));

  const rivers = [];
  const riverCount = mode.id === 'battle_royale' ? rng.int(1, 2) : rng.int(0, 1);
  for (let r = 0; r < riverCount; r++) {
    const start = { x: rng.range(0.35, 0.65), y: rng.range(0.35, 0.65) };
    const ang = rng.range(0, Math.PI * 2);
    const points = [start];
    for (let k = 1; k <= 7; k++) {
      const prev = points[k - 1];
      const a = ang + rng.range(-0.5, 0.5);
      points.push({ x: prev.x + Math.cos(a) * 0.075, y: prev.y + Math.sin(a) * 0.075 });
    }
    rivers.push({ points });
  }

  const roads = mstRoads(pois, rng);

  const features = [];
  const occupied = [...pois];
  for (const [type, count] of Object.entries(mode.features)) {
    for (let n = 0; n < count; n++) {
      // Vaults, bosses and medallions sit inside POIs; the rest spread around.
      if (['vault', 'boss', 'medallion'].includes(type)) {
        const host = pois[(n * 3 + features.length) % pois.length];
        features.push({ type, x: host.x + rng.range(-0.015, 0.015), y: host.y + rng.range(-0.015, 0.015), note: `Inside ${host.name}` });
      } else {
        const [p] = placeSpread(rng, 1, 0.06, 0.12, occupied);
        if (!p) continue;
        occupied.push(p);
        features.push({ type, x: p.x, y: p.y, note: '' });
      }
    }
  }

  const busA = rng.range(0, Math.PI * 2);
  const final = rng.pick(pois);

  return normalizeSpec(
    {
      seed,
      name: `${rng.pick(themes.length ? themes.flatMap((t) => t.names) : nameBank)} ${rng.pick(['Isle', 'Island', 'Atoll', 'Key', 'Reach', 'Cove'])}`,
      tagline: `${mode.label}: ${prompt ? prompt.slice(0, 70) : mode.blurb}`,
      description: `${prompt || 'A fresh island'} — generated offline for ${mode.label}. ${mode.blurb}`,
      theme: themes.map((t) => t.base).join(', ') || 'classic',
      time_of_day: /night|neon|spooky|haunted/i.test(prompt) ? 'night' : /sunset|dusk/i.test(prompt) ? 'dusk' : 'day',
      base_biome: main.base,
      biomes,
      pois,
      lakes,
      rivers,
      roads,
      features,
      bus_route: {
        start: { x: 0.5 + Math.cos(busA) * 0.46, y: 0.5 + Math.sin(busA) * 0.46 },
        end: { x: 0.5 - Math.cos(busA + 0.3) * 0.46, y: 0.5 - Math.sin(busA + 0.3) * 0.46 },
      },
      storm: { final_x: final.x, final_y: final.y, phases: mode.storm },
      rules: mode.rules,
    },
    mode.id,
    { prompt, generator: 'offline-procedural' },
  );
}
