// Canvas 2D renderer: top-down minimap and the 1920x1080 island thumbnail.
import { heightAt, inLake, noiseFor, stormCenters, LAND_THRESHOLD, MODES, featureStyle, TEAM_COLORS, type MapSpec } from '../../../core/src/index.ts';

export const BIOME_COLORS: Record<string, [number, number, number]> = {
  grassland: [111, 191, 74],
  forest: [56, 135, 58],
  desert: [227, 194, 122],
  snow: [236, 242, 247],
  swamp: [96, 112, 60],
  jungle: [42, 154, 82],
  volcanic: [78, 62, 60],
  beach: [240, 220, 154],
  mountain: [141, 138, 131],
  urban: [154, 163, 173],
  autumn: [214, 137, 58],
  candy: [245, 154, 200],
};
const SAND: [number, number, number] = [238, 216, 150];
const DEEP = [22, 78, 150];
const SHALLOW = [58, 164, 214];
const TINTS: Record<string, { mul: number[]; add: number[] }> = {
  day: { mul: [1, 1, 1], add: [0, 0, 0] },
  dawn: { mul: [1.02, 0.95, 0.95], add: [14, 4, 10] },
  dusk: { mul: [1.05, 0.85, 0.75], add: [18, 0, 8] },
  night: { mul: [0.68, 0.72, 0.86], add: [0, 4, 14] },
};

export interface Layers {
  grid: boolean;
  labels: boolean;
  features: boolean;
  storm: boolean;
  bus: boolean;
  devices: boolean;
}
export const DEFAULT_LAYERS: Layers = { grid: true, labels: true, features: true, storm: true, bus: true, devices: false };

type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

export function makeCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

/** Land colour for a point (also used by the 3D view). */
export function landColor(spec: MapSpec, x: number, y: number, h: number): [number, number, number] {
  const noise = noiseFor(spec.seed);
  const base = BIOME_COLORS[spec.base_biome] || BIOME_COLORS.grassland;
  let wsum = 0.35;
  let r = base[0] * 0.35;
  let g = base[1] * 0.35;
  let b = base[2] * 0.35;
  for (const bi of spec.biomes) {
    const t = 1 - Math.hypot(x - bi.x, y - bi.y) / bi.radius;
    if (t <= 0) continue;
    const w = t * t * 3;
    const c = BIOME_COLORS[bi.type] || base;
    r += c[0] * w;
    g += c[1] * w;
    b += c[2] * w;
    wsum += w;
  }
  r /= wsum;
  g /= wsum;
  b /= wsum;
  const coast = (h - LAND_THRESHOLD) / 0.06;
  if (coast < 1) {
    const s = 1 - Math.max(0, coast);
    r += (SAND[0] - r) * s;
    g += (SAND[1] - g) * s;
    b += (SAND[2] - b) * s;
  }
  const shade = 0.8 + Math.min(h - LAND_THRESHOLD, 0.8) * 0.3 + (noise.fbm(x * 40, y * 40, 2) - 0.5) * 0.16;
  return [r * shade, g * shade, b * shade];
}

const terrainCache = new Map<string, HTMLCanvasElement>();
export function terrainKey(spec: MapSpec): string {
  return JSON.stringify([spec.seed, spec.mode, spec.time_of_day, spec.base_biome, spec.biomes, spec.lakes, spec.pois.map((p) => [p.x, p.y, p.elevation]), spec.features.map((f) => [f.x, f.y])]);
}

/** Renders (and caches) the terrain bitmap. */
export function terrainImage(spec: MapSpec): HTMLCanvasElement {
  const key = terrainKey(spec);
  const hit = terrainCache.get(key);
  if (hit) return hit;
  const R = 384;
  const off = makeCanvas(R, R);
  const octx = off.getContext('2d')!;
  const img = octx.createImageData(R, R);
  const tint = TINTS[spec.time_of_day] || TINTS.day;
  const night = spec.time_of_day === 'night';
  for (let j = 0; j < R; j++) {
    for (let i = 0; i < R; i++) {
      const x = (i + 0.5) / R;
      const y = (j + 0.5) / R;
      const h = heightAt(spec, x, y);
      const lake = inLake(spec, x, y);
      let c: number[];
      if (h > LAND_THRESHOLD && !lake) c = landColor(spec, x, y, h);
      else {
        const t = lake ? 0.85 : Math.max(0, Math.min(1, (h - 0.05) / (LAND_THRESHOLD - 0.05)));
        c = [DEEP[0] + (SHALLOW[0] - DEEP[0]) * t, DEEP[1] + (SHALLOW[1] - DEEP[1]) * t, DEEP[2] + (SHALLOW[2] - DEEP[2]) * t];
        if (night) c = c.map((v) => v * 0.55);
      }
      const k = (j * R + i) * 4;
      img.data[k] = Math.max(0, Math.min(255, c[0] * tint.mul[0] + tint.add[0]));
      img.data[k + 1] = Math.max(0, Math.min(255, c[1] * tint.mul[1] + tint.add[1]));
      img.data[k + 2] = Math.max(0, Math.min(255, c[2] * tint.mul[2] + tint.add[2]));
      img.data[k + 3] = 255;
    }
  }
  octx.putImageData(img, 0, 0);
  if (terrainCache.size > 12) terrainCache.clear();
  terrainCache.set(key, off);
  return off;
}

function smoothLine(ctx: Ctx, pts: { x: number; y: number }[], size: number) {
  ctx.beginPath();
  ctx.moveTo(pts[0].x * size, pts[0].y * size);
  for (let i = 1; i < pts.length - 1; i++) {
    const mx = ((pts[i].x + pts[i + 1].x) / 2) * size;
    const my = ((pts[i].y + pts[i + 1].y) / 2) * size;
    ctx.quadraticCurveTo(pts[i].x * size, pts[i].y * size, mx, my);
  }
  const last = pts[pts.length - 1];
  ctx.lineTo(last.x * size, last.y * size);
  ctx.stroke();
}

function outlinedText(ctx: Ctx, text: string, x: number, y: number, px: number, fill = '#fff') {
  ctx.font = `900 ${px}px "Arial Black", "Helvetica Neue", Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(2, px * 0.28);
  ctx.strokeStyle = 'rgba(10, 12, 30, 0.92)';
  ctx.strokeText(text, x, y);
  ctx.fillStyle = fill;
  ctx.fillText(text, x, y);
}

const POI_RADIUS = { small: 18, medium: 26, large: 36 } as const;

export interface Selection {
  kind: 'poi' | 'feature' | 'device';
  index: number;
}

export function drawMap(ctx: Ctx, spec: MapSpec, size: number, layers: Layers = DEFAULT_LAYERS, selected: Selection | null = null, terrain?: CanvasImageSource) {
  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(terrain || terrainImage(spec), 0, 0, size, size);
  const s = size / 1000;
  const mode = MODES[spec.mode];

  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const rv of spec.rivers) {
    ctx.strokeStyle = 'rgba(58,164,214,0.95)';
    ctx.lineWidth = 9 * s;
    smoothLine(ctx, rv.points, size);
  }
  const courseLayout = mode?.layout === 'course';
  for (const rd of spec.roads) {
    ctx.strokeStyle = courseLayout ? 'rgba(40,20,60,0.6)' : 'rgba(60,50,40,0.55)';
    ctx.lineWidth = (courseLayout ? 22 : 6) * s;
    smoothLine(ctx, rd.points, size);
    ctx.strokeStyle = courseLayout ? 'rgba(255,214,10,0.9)' : 'rgba(245,235,210,0.9)';
    ctx.lineWidth = (courseLayout ? 14 : 3) * s;
    smoothLine(ctx, rd.points, size);
  }

  spec.pois.forEach((p, i) => {
    const rad = POI_RADIUS[p.size] * s;
    const sel = selected?.kind === 'poi' && selected.index === i;
    ctx.fillStyle = sel ? 'rgba(255,214,10,0.35)' : 'rgba(255,255,255,0.18)';
    ctx.strokeStyle = sel ? '#ffd60a' : 'rgba(255,255,255,0.55)';
    ctx.lineWidth = (sel ? 4 : 2) * s;
    ctx.beginPath();
    ctx.arc(p.x * size, p.y * size, rad, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    for (let k = 0; k < (p.size === 'large' ? 7 : p.size === 'medium' ? 5 : 3); k++) {
      const a = (k / 7) * Math.PI * 2 + p.x * 10;
      const d = rad * 0.55 * ((k % 2) + 0.5) * 0.8;
      ctx.fillStyle = 'rgba(70,60,70,0.75)';
      ctx.fillRect(p.x * size + Math.cos(a) * d - 3 * s, p.y * size + Math.sin(a) * d - 3 * s, 6 * s, 6 * s);
    }
  });

  if (layers.storm && spec.storm.phases.length) {
    const first = stormCenters(spec)[0];
    ctx.setLineDash([10 * s, 8 * s]);
    ctx.strokeStyle = 'rgba(255,255,255,0.75)';
    ctx.lineWidth = 3 * s;
    ctx.beginPath();
    ctx.arc(first.x * size, first.y * size, first.r * size, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    const fx = spec.storm.final_x * size;
    const fy = spec.storm.final_y * size;
    ctx.strokeStyle = 'rgba(190,120,255,0.95)';
    ctx.lineWidth = 4 * s;
    ctx.beginPath();
    ctx.arc(fx, fy, 14 * s, 0, Math.PI * 2);
    ctx.moveTo(fx - 8 * s, fy);
    ctx.lineTo(fx + 8 * s, fy);
    ctx.moveTo(fx, fy - 8 * s);
    ctx.lineTo(fx, fy + 8 * s);
    ctx.stroke();
  }

  if (layers.bus && spec.bus_route) {
    const a = spec.bus_route.start;
    const b = spec.bus_route.end;
    ctx.setLineDash([16 * s, 10 * s]);
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 4 * s;
    ctx.beginPath();
    ctx.moveTo(a.x * size, a.y * size);
    ctx.lineTo(b.x * size, b.y * size);
    ctx.stroke();
    ctx.setLineDash([]);
    const ang = Math.atan2((b.y - a.y) * size, (b.x - a.x) * size);
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.moveTo(b.x * size, b.y * size);
    ctx.lineTo(b.x * size - Math.cos(ang - 0.4) * 24 * s, b.y * size - Math.sin(ang - 0.4) * 24 * s);
    ctx.lineTo(b.x * size - Math.cos(ang + 0.4) * 24 * s, b.y * size - Math.sin(ang + 0.4) * 24 * s);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#2b7bff';
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 3 * s;
    ctx.beginPath();
    ctx.rect(a.x * size - 16 * s, a.y * size - 10 * s, 32 * s, 20 * s);
    ctx.fill();
    ctx.stroke();
  }

  if (layers.devices) {
    spec.devices.forEach((d, i) => {
      if (!d.enabled) return;
      const sel = selected?.kind === 'device' && selected.index === i;
      ctx.fillStyle = sel ? '#ffd60a' : 'rgba(20,20,40,0.85)';
      ctx.strokeStyle = '#9ef';
      ctx.lineWidth = 1.5 * s;
      ctx.beginPath();
      ctx.rect(d.x * size - 5 * s, d.y * size - 5 * s, 10 * s, 10 * s);
      ctx.fill();
      ctx.stroke();
    });
  }

  if (layers.features) {
    spec.features.forEach((f, i) => {
      const st = featureStyle(f.type);
      const sel = selected?.kind === 'feature' && selected.index === i;
      const r = (sel ? 14 : 11) * s;
      ctx.fillStyle = st.color;
      ctx.strokeStyle = f.team ? TEAM_COLORS[f.team] || '#fff' : sel ? '#ffd60a' : '#fff';
      ctx.lineWidth = (f.team || sel ? 4 : 2.5) * s;
      ctx.beginPath();
      ctx.arc(f.x * size, f.y * size, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.font = `900 ${13 * s}px Arial, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(f.order ? String(f.order) : st.glyph, f.x * size, f.y * size + 1 * s);
    });
  }

  if (layers.grid) {
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.lineWidth = 1;
    for (let k = 1; k < 10; k++) {
      ctx.beginPath();
      ctx.moveTo((k * size) / 10, 0);
      ctx.lineTo((k * size) / 10, size);
      ctx.moveTo(0, (k * size) / 10);
      ctx.lineTo(size, (k * size) / 10);
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.font = `700 ${14 * s}px Arial, sans-serif`;
    for (let k = 0; k < 10; k++) {
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText('ABCDEFGHIJ'[k], ((k + 0.5) * size) / 10, 6 * s);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(k + 1), 6 * s, ((k + 0.5) * size) / 10);
    }
  }

  if (layers.labels) {
    for (const p of spec.pois) {
      const px = { small: 15, medium: 17, large: 20 }[p.size] * s;
      const ly = p.y * size - POI_RADIUS[p.size] * s - px * 0.6;
      outlinedText(ctx, p.name.toUpperCase(), Math.min(size - 60 * s, Math.max(60 * s, p.x * size)), Math.max(px, ly), px);
    }
  }
  ctx.restore();
}

/** Hit-test in 0..1 map coordinates. */
export function hitTest(spec: MapSpec, x: number, y: number, layers: Layers): Selection | null {
  const best = (list: { x: number; y: number }[], kind: Selection['kind'], radius: number): Selection | null => {
    let found: Selection | null = null;
    let bd = radius;
    list.forEach((p, index) => {
      const d = Math.hypot(p.x - x, p.y - y);
      if (d < bd) {
        bd = d;
        found = { kind, index };
      }
    });
    return found;
  };
  return (
    (layers.features && best(spec.features, 'feature', 0.018)) ||
    (layers.devices && best(spec.devices, 'device', 0.012)) ||
    best(spec.pois, 'poi', 0.04) ||
    null
  );
}

export function renderMinimap(spec: MapSpec, size = 1024, layers: Layers = DEFAULT_LAYERS): HTMLCanvasElement {
  const c = makeCanvas(size, size);
  drawMap(c.getContext('2d')!, spec, size, layers);
  return c;
}

function wrapLines(ctx: Ctx, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const t = cur ? `${cur} ${w}` : w;
    if (ctx.measureText(t).width > maxWidth && cur) {
      lines.push(cur);
      cur = w;
    } else cur = t;
  }
  if (cur) lines.push(cur);
  return lines;
}

const SKY: Record<string, [string, string]> = {
  day: ['#3a86ff', '#7b2ff7'],
  dawn: ['#ff9e7a', '#7b2ff7'],
  dusk: ['#ff6b35', '#5a189a'],
  night: ['#0b1d51', '#3c096c'],
};

/** 1920x1080 island thumbnail. */
export function renderThumbnail(spec: MapSpec, hero?: CanvasImageSource): HTMLCanvasElement {
  const W = 1920;
  const H = 1080;
  const c = makeCanvas(W, H);
  const ctx = c.getContext('2d')!;
  const [c1, c2] = SKY[spec.time_of_day] || SKY.day;
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, c1);
  g.addColorStop(1, c2);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  ctx.save();
  ctx.globalAlpha = 0.08;
  ctx.fillStyle = '#fff';
  for (let k = 0; k < 9; k++) {
    ctx.beginPath();
    ctx.moveTo(1400, -200);
    ctx.lineTo(-200 + k * 260, H + 200);
    ctx.lineTo(-90 + k * 260, H + 200);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  const M = 900;
  ctx.save();
  ctx.translate(1390, 540);
  ctx.rotate(-0.05);
  ctx.shadowColor = 'rgba(0,0,0,0.45)';
  ctx.shadowBlur = 50;
  ctx.shadowOffsetY = 20;
  ctx.fillStyle = '#fff';
  ctx.fillRect(-M / 2 - 14, -M / 2 - 14, M + 28, M + 28);
  ctx.shadowColor = 'transparent';
  if (hero) ctx.drawImage(hero, -M / 2, -M / 2, M, M);
  else ctx.drawImage(renderMinimap(spec, M, { ...DEFAULT_LAYERS, grid: false }), -M / 2, -M / 2, M, M);
  ctx.restore();

  const mode = MODES[spec.mode];
  ctx.font = '900 44px "Arial Black", Arial, sans-serif';
  const badge = mode.label.toUpperCase();
  const bw = ctx.measureText(badge).width + 60;
  ctx.fillStyle = '#ffd60a';
  ctx.fillRect(90, 110, bw, 78);
  ctx.fillStyle = '#1b1b3a';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(badge, 120, 151);

  let px = 120;
  ctx.font = `900 ${px}px "Arial Black", Impact, Arial, sans-serif`;
  let lines = wrapLines(ctx, spec.name.toUpperCase(), 760);
  if (lines.length > 3) {
    px = 90;
    ctx.font = `900 ${px}px "Arial Black", Impact, Arial, sans-serif`;
    lines = wrapLines(ctx, spec.name.toUpperCase(), 760).slice(0, 4);
  }
  let y = 300;
  for (const line of lines) {
    ctx.lineJoin = 'round';
    ctx.lineWidth = 18;
    ctx.strokeStyle = '#14123a';
    ctx.strokeText(line, 90, y);
    ctx.fillStyle = '#fff';
    ctx.fillText(line, 90, y);
    y += px * 1.05;
  }
  ctx.font = '700 40px Arial, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  y += 10;
  for (const line of wrapLines(ctx, spec.tagline, 760).slice(0, 3)) {
    ctx.fillText(line, 92, y);
    y += 52;
  }
  const r = spec.rules;
  const chips = [
    `${r.max_players} PLAYERS`,
    r.team_count ? `${r.team_count} TEAMS` : r.team_size === 1 ? 'SOLOS' : r.team_size === 2 ? 'DUOS' : r.team_size === 3 ? 'TRIOS' : 'SQUADS',
    r.build_mode === 'build' ? 'BUILD' : 'ZERO BUILD',
    r.respawn_enabled ? 'RESPAWNS' : 'ONE LIFE',
  ];
  let cx = 90;
  ctx.font = '800 30px Arial, sans-serif';
  for (const chip of chips) {
    const w = ctx.measureText(chip).width + 40;
    ctx.fillStyle = 'rgba(15,12,50,0.55)';
    ctx.beginPath();
    ctx.roundRect(cx, 930, w, 60, 30);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.fillText(chip, cx + 20, 961);
    cx += w + 16;
  }
  return c;
}

export function canvasBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not encode image'))), type, quality));
}

/** Thumbnail as JPEG under 1 MB. */
export async function thumbnailJpeg(spec: MapSpec, hero?: CanvasImageSource): Promise<Blob> {
  const c = renderThumbnail(spec, hero);
  for (const q of [0.92, 0.85, 0.75, 0.65, 0.5]) {
    const b = await canvasBlob(c, 'image/jpeg', q);
    if (b.size < 1_000_000) return b;
  }
  return canvasBlob(c, 'image/jpeg', 0.4);
}
