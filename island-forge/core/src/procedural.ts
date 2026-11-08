// Offline generator: builds a full map for any mode from a prompt with no AI at all.
// Prompt keywords steer the theme; the mode's layout style decides the shape.
import type { MapSpec, Point } from './types.ts';
import { MODES } from './modes.ts';
import { makeRng, type Rng } from './rng.ts';
import { normalizeSpec, hashString } from './normalize.ts';

interface Theme {
  words: string[];
  base: string;
  extra: string[];
  kinds: string[];
  names: string[];
}

const THEMES: Theme[] = [
  { words: ['snow', 'ice', 'winter', 'frozen', 'arctic', 'christmas', 'holiday'], base: 'snow', extra: ['mountain', 'forest'], kinds: ['town', 'cave', 'lab', 'fort'], names: ['Frost', 'Glacier', 'Icicle', 'Snowdrift', 'Polar', 'Chilly', 'Blizzard'] },
  { words: ['desert', 'sand', 'dune', 'western', 'canyon', 'mesa', 'cowboy'], base: 'desert', extra: ['mountain', 'beach'], kinds: ['town', 'ruins', 'temple', 'farm'], names: ['Dusty', 'Sandy', 'Cactus', 'Mirage', 'Sunbaked', 'Canyon', 'Tumble'] },
  { words: ['jungle', 'tropical', 'rainforest', 'temple', 'aztec', 'dino'], base: 'jungle', extra: ['beach', 'swamp'], kinds: ['temple', 'ruins', 'resort', 'cave'], names: ['Vine', 'Canopy', 'Monkey', 'Lost', 'Emerald', 'Mossy', 'Tiki'] },
  { words: ['volcano', 'lava', 'fire', 'magma', 'inferno'], base: 'volcanic', extra: ['mountain', 'desert'], kinds: ['lab', 'fort', 'cave', 'industrial'], names: ['Ember', 'Ashen', 'Magma', 'Scorched', 'Cinder', 'Blaze', 'Molten'] },
  { words: ['city', 'urban', 'neon', 'cyber', 'futur', 'metro', 'downtown', 'tech', 'space', 'sci-fi'], base: 'urban', extra: ['grassland', 'beach'], kinds: ['city', 'industrial', 'lab', 'docks'], names: ['Neon', 'Chrome', 'Metro', 'Circuit', 'Pixel', 'Skyline', 'Volt'] },
  { words: ['swamp', 'bog', 'marsh', 'spooky', 'halloween', 'haunted', 'zombie', 'horror', 'scary', 'ghost'], base: 'swamp', extra: ['forest', 'autumn'], kinds: ['ruins', 'farm', 'castle', 'town'], names: ['Murky', 'Gloom', 'Haunted', 'Croaky', 'Mire', 'Shadow', 'Creepy'] },
  { words: ['medieval', 'castle', 'knight', 'fantasy', 'dragon', 'kingdom', 'magic'], base: 'forest', extra: ['mountain', 'grassland'], kinds: ['castle', 'town', 'ruins', 'fort'], names: ['Crown', 'Dragon', 'Knight', 'Moat', 'Rune', 'Royal', 'Wizard'] },
  { words: ['beach', 'island', 'ocean', 'pirate', 'tropic', 'summer', 'surf'], base: 'beach', extra: ['jungle', 'grassland'], kinds: ['docks', 'resort', 'town', 'fort'], names: ['Coral', 'Salty', 'Pirate', 'Sunny', 'Shell', 'Tidal', 'Lagoon'] },
  { words: ['autumn', 'fall', 'harvest', 'farm', 'cozy', 'pumpkin'], base: 'autumn', extra: ['grassland', 'forest'], kinds: ['farm', 'town', 'landmark', 'ruins'], names: ['Maple', 'Harvest', 'Acorn', 'Rusty', 'Cozy', 'Golden', 'Hay'] },
  { words: ['candy', 'sweet', 'toy', 'cute', 'rainbow', 'party', 'cake'], base: 'candy', extra: ['grassland', 'candy', 'forest'], kinds: ['landmark', 'resort', 'town', 'castle'], names: ['Sugar', 'Gumdrop', 'Sprinkle', 'Lolli', 'Fizzy', 'Jelly', 'Bubble'] },
  { words: ['military', 'army', 'war', 'bunker', 'spy', 'agent', 'base'], base: 'grassland', extra: ['forest', 'mountain'], kinds: ['military', 'fort', 'lab', 'industrial'], names: ['Bunker', 'Outpost', 'Agent', 'Recon', 'Steel', 'Command', 'Ironclad'] },
];

const DEFAULT_THEME: Theme = { words: [], base: 'grassland', extra: ['forest', 'mountain', 'beach', 'desert', 'snow'], kinds: ['town', 'farm', 'industrial', 'landmark', 'city', 'fort'], names: ['Pleasant', 'Lazy', 'Salty', 'Misty', 'Rocky', 'Sunny', 'Windy', 'Shifty', 'Lucky'] };

const SUFFIX: Record<string, string[]> = {
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
  arena: ['Arena', 'Pit', 'Ring'],
  base: ['Base', 'HQ', 'Camp'],
  plaza: ['Plaza', 'Square', 'Hub'],
  course: ['Run', 'Climb', 'Gauntlet', 'Drop', 'Leap'],
};

const TEAM_WORDS = ['', 'Red', 'Blue', 'Green', 'Gold'];

function detectThemes(prompt: string): Theme[] {
  const p = prompt.toLowerCase();
  return THEMES.filter((t) => t.words.some((w) => p.includes(w)));
}

function spread(rng: Rng, count: number, minDist: number, inCircle: boolean, margin: number, existing: Point[] = []): Point[] {
  const out: Point[] = [];
  for (let attempt = 0; out.length < count && attempt < count * 400; attempt++) {
    let p: Point;
    if (inCircle) {
      const a = rng.range(0, Math.PI * 2);
      const d = Math.sqrt(rng.next()) * (0.5 - margin);
      p = { x: 0.5 + Math.cos(a) * d, y: 0.5 + Math.sin(a) * d };
    } else {
      p = { x: rng.range(margin, 1 - margin), y: rng.range(margin, 1 - margin) };
    }
    const md = attempt > count * 300 ? minDist * 0.5 : minDist;
    if ([...existing, ...out].every((q) => Math.hypot(q.x - p.x, q.y - p.y) >= md)) out.push(p);
  }
  return out;
}

const near = (rng: Rng, p: Point, r: number): Point => {
  const a = rng.range(0, Math.PI * 2);
  const d = rng.range(r * 0.3, r);
  return { x: Math.min(0.95, Math.max(0.05, p.x + Math.cos(a) * d)), y: Math.min(0.95, Math.max(0.05, p.y + Math.sin(a) * d)) };
};

function mstRoads(pts: Point[], rng: Rng) {
  if (pts.length < 2) return [];
  const inTree = [0];
  const edges: [number, number][] = [];
  while (inTree.length < pts.length) {
    let best: { i: number; j: number; d: number } | null = null;
    for (const i of inTree) {
      for (let j = 0; j < pts.length; j++) {
        if (inTree.includes(j)) continue;
        const d = Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y);
        if (!best || d < best.d) best = { i, j, d };
      }
    }
    inTree.push(best!.j);
    edges.push([best!.i, best!.j]);
  }
  return edges.map(([i, j]) => {
    const a = pts[i];
    const b = pts[j];
    const mid = { x: (a.x + b.x) / 2 + rng.range(-0.03, 0.03), y: (a.y + b.y) / 2 + rng.range(-0.03, 0.03) };
    return { points: [a, mid, b].map((p) => ({ x: p.x, y: p.y })) };
  });
}

/** A winding path across the map for courses (or a loop for racing). */
function coursePath(rng: Rng, loop: boolean): Point[] {
  if (loop) {
    const n = 14;
    const pts: Point[] = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const r = 0.33 + rng.range(-0.06, 0.06);
      pts.push({ x: 0.5 + Math.cos(a) * r, y: 0.5 + Math.sin(a) * r * 0.85 });
    }
    pts.push({ ...pts[0] });
    return pts;
  }
  const rows = 4;
  const pts: Point[] = [];
  for (let r = 0; r < rows; r++) {
    const y = 0.15 + (r / (rows - 1)) * 0.7;
    const left = { x: 0.15 + rng.range(-0.03, 0.03), y: y + rng.range(-0.02, 0.02) };
    const right = { x: 0.85 + rng.range(-0.03, 0.03), y: y + rng.range(-0.02, 0.02) };
    const mid = { x: 0.5 + rng.range(-0.1, 0.1), y: y + rng.range(-0.04, 0.04) };
    pts.push(...(r % 2 === 0 ? [left, mid, right] : [right, mid, left]));
  }
  return pts;
}

function alongPath(path: Point[], t: number): Point {
  const lens = path.slice(1).map((p, i) => Math.hypot(p.x - path[i].x, p.y - path[i].y));
  const total = lens.reduce((a, b) => a + b, 0);
  let d = t * total;
  for (let i = 0; i < lens.length; i++) {
    if (d <= lens[i] || i === lens.length - 1) {
      const k = lens[i] ? Math.min(1, d / lens[i]) : 0;
      return { x: path[i].x + (path[i + 1].x - path[i].x) * k, y: path[i].y + (path[i + 1].y - path[i].y) * k };
    }
    d -= lens[i];
  }
  return path[path.length - 1];
}

export function generateProcedural(prompt = '', modeId = 'reload', seedOverride?: number): MapSpec {
  const mode = MODES[modeId] || MODES.reload;
  const seed = seedOverride ?? hashString(`${prompt}|${mode.id}`);
  const rng = makeRng(seed);
  const themes = detectThemes(prompt);
  const main = themes[0] || DEFAULT_THEME;
  const kinds = [...new Set(themes.flatMap((t) => t.kinds).concat(main.kinds))];
  const nameBank = [...new Set(themes.flatMap((t) => t.names).concat(main.names, DEFAULT_THEME.names))];
  const teamCount = mode.rules.team_count;
  const usedNames = new Set<string>();
  const nameFor = (kind: string) => {
    let name = '';
    for (let k = 0; k < 20; k++) {
      name = `${rng.pick(nameBank)} ${rng.pick(SUFFIX[kind] || SUFFIX.town)}`;
      if (!usedNames.has(name)) break;
    }
    usedNames.add(name);
    return name;
  };

  const pois: any[] = [];
  const features: any[] = [];
  let roads: { points: Point[] }[] = [];
  let path: Point[] = [];
  const poiCount = rng.int(mode.poiMin, mode.poiMax);

  // ---- Locations by layout ----
  if (mode.layout === 'island' || mode.layout === 'hub') {
    const circle = true;
    const spots = spread(rng, poiCount, 0.62 / Math.sqrt(poiCount + 1), circle, mode.layout === 'hub' ? 0.1 : 0.14);
    spots.forEach((p, i) => {
      const kind = i === 0 && themes.length ? main.kinds[0] : rng.pick(kinds);
      const centre = Math.hypot(p.x - 0.5, p.y - 0.5) < 0.12;
      const size = centre ? 'large' : rng.pick(['small', 'medium', 'medium', 'large'] as const);
      pois.push({ name: nameFor(kind), kind, x: p.x, y: p.y, size, loot_tier: size === 'large' ? 3 : size === 'medium' ? 2 : rng.int(1, 2), elevation: kind === 'landmark' || kind === 'castle' ? rng.range(0.5, 0.9) : rng.range(0.05, 0.4), description: `A ${size} ${kind}${themes.length ? ` with a ${main.base} vibe` : ''}.` });
    });
    roads = mstRoads(pois, rng);
  } else if (mode.layout === 'arena') {
    if (teamCount >= 2) {
      for (let t = 1; t <= teamCount; t++) {
        const a = Math.PI + ((t - 1) / teamCount) * Math.PI * 2;
        pois.push({ name: `${TEAM_WORDS[t] || `Team ${t}`} Base`, kind: 'base', x: 0.5 + Math.cos(a) * 0.36, y: 0.5 + Math.sin(a) * 0.36, size: 'medium', loot_tier: 2, elevation: 0.15, description: `Spawn base for team ${t}.` });
      }
    }
    pois.push({ name: nameFor('arena'), kind: 'arena', x: 0.5, y: 0.5, size: 'large', loot_tier: 3, elevation: 0.25, description: 'The contested middle.' });
    const extra = spread(rng, Math.max(0, poiCount - pois.length), 0.2, false, 0.18, pois);
    for (const p of extra) {
      const kind = rng.pick(kinds);
      pois.push({ name: nameFor(kind), kind, x: p.x, y: p.y, size: 'small', loot_tier: 2, elevation: rng.range(0.05, 0.35), description: `Side area themed as a ${kind}.` });
    }
    roads = mstRoads(pois, rng);
  } else if (mode.layout === 'course') {
    path = coursePath(rng, mode.id === 'racing');
    roads = [{ points: path }];
    const sections = Math.max(poiCount, 2);
    for (let i = 0; i < sections; i++) {
      const p = alongPath(path, (i + 0.5) / sections);
      pois.push({ name: nameFor('course'), kind: i === 0 ? 'plaza' : 'course', x: p.x, y: p.y, size: 'small', loot_tier: 1, elevation: 0.1 + (i / sections) * 0.6, description: `Course section ${i + 1}.` });
    }
  } else if (mode.layout === 'plots') {
    pois.push({ name: nameFor('plaza'), kind: 'plaza', x: 0.5, y: 0.5, size: 'large', loot_tier: 1, elevation: 0.2, description: 'Central hub with shops.' });
    roads = [];
  }

  // ---- Features ----
  const occupied: Point[] = [...pois];
  const counts = mode.features;
  const plotCount = counts.tycoon_plot || 0;
  const plots: Point[] = [];
  for (let i = 0; i < plotCount; i++) {
    const a = (i / plotCount) * Math.PI * 2;
    const p = { x: 0.5 + Math.cos(a) * 0.3, y: 0.5 + Math.sin(a) * 0.3 };
    plots.push(p);
    features.push({ type: 'tycoon_plot', x: p.x, y: p.y, note: `Plot ${i + 1}`, team: 0, order: i + 1 });
    if (mode.layout === 'plots') roads.push({ points: [{ x: 0.5, y: 0.5 }, p] });
  }

  const ordered = ['checkpoint', 'race_checkpoint'];
  for (const [type, count] of Object.entries(counts)) {
    if (type === 'tycoon_plot') continue;
    for (let n = 0; n < count; n++) {
      let p: Point | undefined;
      let team = 0;
      let order = 0;
      let note = '';
      if (ordered.includes(type) && path.length) {
        order = n + 1;
        p = alongPath(path, (n + 1) / (count + 1));
      } else if (type === 'finish_line' && path.length) {
        p = path[path.length - 1];
      } else if ((type === 'trap' || type === 'bouncer' || type === 'moving_platform' || type === 'speed_boost') && path.length) {
        const q = alongPath(path, rng.range(0.05, 0.95));
        p = { x: q.x + rng.range(-0.02, 0.02), y: q.y + rng.range(-0.02, 0.02) };
      } else if ((type === 'spawn_pad' || type === 'vehicle_spawner') && path.length) {
        const s = path[0];
        p = { x: s.x + ((n % 4) - 1.5) * 0.02, y: s.y + Math.floor(n / 4) * 0.02 };
      } else if (type === 'team_spawn' && teamCount >= 1) {
        team = (n % teamCount) + 1;
        const base = pois[team - 1];
        p = near(rng, base, 0.05);
      } else if (type === 'flag' && teamCount >= 2) {
        team = (n % teamCount) + 1;
        p = { ...pois[team - 1] };
        note = `${TEAM_WORDS[team] || `Team ${team}`} flag`;
      } else if (type === 'capture_zone') {
        if (count === 1) p = { x: 0.5, y: 0.5 };
        else p = { x: 0.5 + (n - (count - 1) / 2) * 0.12, y: 0.5 + (n % 2 ? 0.18 : -0.18) };
        note = `Zone ${'ABCDEFG'[n]}`;
      } else if (type === 'bomb_site') {
        p = { x: 0.72, y: 0.5 + (n ? 0.2 : -0.2) };
        note = `Site ${'AB'[n] || n + 1}`;
      } else if (type === 'upgrade_button' && plots.length) {
        const plot = plots[n % plots.length];
        p = near(rng, plot, 0.06);
        order = Math.floor(n / plots.length) + 1;
        note = `Plot ${(n % plots.length) + 1} upgrade`;
      } else if (type === 'spawn_pad' && plots.length) {
        p = near(rng, plots[n % plots.length], 0.04);
      } else if (['vault', 'boss', 'medallion'].includes(type)) {
        const host = pois[(n * 3 + features.length) % pois.length];
        p = { x: host.x + rng.range(-0.015, 0.015), y: host.y + rng.range(-0.015, 0.015) };
        note = `Inside ${host.name}`;
      }
      if (!p) {
        const inCircle = mode.layout === 'island' || mode.layout === 'hub';
        [p] = spread(rng, 1, 0.05, inCircle, inCircle ? 0.12 : 0.08, occupied);
      }
      if (!p) continue;
      occupied.push(p);
      features.push({ type, x: p.x, y: p.y, note, team, order });
    }
  }

  // ---- Terrain dressing ----
  const biomeTypes = [main.base, ...main.extra, ...themes.slice(1).map((t) => t.base)];
  const biomes = spread(rng, Math.min(5, 2 + themes.length + rng.int(0, 2)), 0.22, false, 0.1).map((p, i) => ({ type: biomeTypes[i % biomeTypes.length], x: p.x, y: p.y, radius: rng.range(0.14, 0.26) }));
  const islandish = mode.layout === 'island' || mode.layout === 'hub';
  const lakes = islandish ? spread(rng, rng.int(0, mode.id === 'battle_royale' ? 3 : 1), 0.12, true, 0.18, occupied).map((p) => ({ ...p, radius: rng.range(0.025, 0.05) })) : [];
  const rivers: { points: Point[] }[] = [];
  if (islandish && mode.mapSizeM >= 900) {
    for (let r = 0; r < rng.int(1, 2); r++) {
      const ang = rng.range(0, Math.PI * 2);
      const pts = [{ x: rng.range(0.38, 0.62), y: rng.range(0.38, 0.62) }];
      for (let k = 1; k <= 7; k++) {
        const prev = pts[k - 1];
        const a = ang + rng.range(-0.5, 0.5);
        pts.push({ x: prev.x + Math.cos(a) * 0.075, y: prev.y + Math.sin(a) * 0.075 });
      }
      rivers.push({ points: pts });
    }
  }

  const busA = rng.range(0, Math.PI * 2);
  const final = rng.pick(pois);
  const themedNames = themes.length ? themes.flatMap((t) => t.names) : nameBank;
  const islandName = `${rng.pick(themedNames)} ${rng.pick(mode.layout === 'island' ? ['Isle', 'Island', 'Atoll', 'Key', 'Reach'] : mode.layout === 'course' ? ['Run', 'Rush', 'Dash', 'Circuit'] : mode.layout === 'plots' ? ['Tycoon', 'Empire', 'Inc.'] : mode.layout === 'hub' ? ['Town', 'Hangout', 'Village', 'Manor'] : ['Arena', 'Showdown', 'Grounds', 'Zone'])}`;

  return normalizeSpec(
    {
      seed,
      name: islandName,
      tagline: `${mode.label}: ${prompt ? prompt.slice(0, 70) : mode.blurb}`,
      description: `${prompt || 'A fresh island'} — ${mode.blurb}`,
      theme: themes.map((t) => t.base).join(', ') || 'classic',
      time_of_day: /night|neon|spooky|haunted|horror|scary/i.test(prompt) || mode.id === 'horror' ? 'night' : /sunset|dusk/i.test(prompt) ? 'dusk' : 'day',
      base_biome: main.base,
      biomes,
      pois,
      lakes,
      rivers,
      roads,
      features,
      bus_route: { start: { x: 0.5 + Math.cos(busA) * 0.46, y: 0.5 + Math.sin(busA) * 0.46 }, end: { x: 0.5 - Math.cos(busA + 0.3) * 0.46, y: 0.5 - Math.sin(busA + 0.3) * 0.46 } },
      storm: { final_x: final.x, final_y: final.y, phases: mode.storm },
      rules: mode.rules,
      publish: { title: islandName, description: `${mode.blurb} ${prompt ? `Theme: ${prompt.slice(0, 120)}` : ''}`.trim(), tags: mode.tags, release_notes: 'First release.' },
    },
    mode.id,
    { prompt, generator: 'offline-procedural' },
  );
}
