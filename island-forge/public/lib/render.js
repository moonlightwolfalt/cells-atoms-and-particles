// Canvas renderer: turns a map spec into a top-down minimap and a 1920x1080 island thumbnail.
import { makeNoise } from './rng.js';
import { MODES } from './modes.js';

const BIOME_COLORS = {
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
const SAND = [238, 216, 150];
const DEEP = [22, 78, 150];
const SHALLOW = [58, 164, 214];
const LAND_THRESHOLD = 0.3;

export const FEATURE_STYLE = {
  reboot_van: { color: '#2f7bff', glyph: 'R', label: 'Reboot Van' },
  vault: { color: '#f5c518', glyph: 'V', label: 'Vault' },
  boss: { color: '#e5383b', glyph: 'B', label: 'Boss' },
  medallion: { color: '#9b5de5', glyph: 'M', label: 'Medallion' },
  vending_machine: { color: '#00bbf9', glyph: '$', label: 'Vending Machine' },
  launch_pad: { color: '#ff8c00', glyph: '▲', label: 'Launch Pad' },
  supply_drop: { color: '#4361ee', glyph: 'S', label: 'Supply Drop' },
  campfire: { color: '#f3722c', glyph: 'F', label: 'Campfire' },
  zipline: { color: '#adb5bd', glyph: 'Z', label: 'Zipline' },
  rift: { color: '#c77dff', glyph: '◎', label: 'Rift' },
};

const TINTS = {
  day: { mul: [1, 1, 1], add: [0, 0, 0] },
  dawn: { mul: [1.02, 0.95, 0.95], add: [14, 4, 10] },
  dusk: { mul: [1.05, 0.85, 0.75], add: [18, 0, 8] },
  night: { mul: [0.68, 0.72, 0.86], add: [0, 4, 14] },
};

function makeCanvas(w, h) {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

// Height field in 0..1; > LAND_THRESHOLD is land. POIs/features push the land up so they never end up in the sea.
export function heightAt(spec, noise, x, y) {
  const dx = x - 0.5;
  const dy = y - 0.5;
  const d = Math.sqrt(dx * dx + dy * dy) / 0.5;
  let h = 1.05 - Math.pow(d, 1.7) * 1.05 + (noise.fbm(x * 4.2, y * 4.2, 5) - 0.5) * 0.75;
  for (const p of spec.pois) {
    const q = Math.hypot(x - p.x, y - p.y) / 0.09;
    if (q < 2.5) h += Math.exp(-q * q) * (0.35 + p.elevation * 0.4);
  }
  for (const f of spec.features) {
    const q = Math.hypot(x - f.x, y - f.y) / 0.04;
    if (q < 2.5) h += Math.exp(-q * q) * 0.25;
  }
  for (const b of spec.biomes) {
    if (b.type !== 'mountain' && b.type !== 'volcanic') continue;
    const q = Math.hypot(x - b.x, y - b.y) / b.radius;
    if (q < 1.5) h += Math.exp(-q * q * 2) * 0.35;
  }
  return h;
}

function landColor(spec, noise, x, y, h) {
  let r = 0;
  let g = 0;
  let b = 0;
  let wsum = 0.35;
  const base = BIOME_COLORS[spec.base_biome] || BIOME_COLORS.grassland;
  r = base[0] * 0.35;
  g = base[1] * 0.35;
  b = base[2] * 0.35;
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
  // Beach band near the coastline.
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

function drawTerrain(ctx, spec, size) {
  const R = Math.min(420, size);
  const noise = makeNoise(spec.seed >>> 0);
  const off = makeCanvas(R, R);
  const octx = off.getContext('2d');
  const img = octx.createImageData(R, R);
  const tint = TINTS[spec.time_of_day] || TINTS.day;
  for (let j = 0; j < R; j++) {
    for (let i = 0; i < R; i++) {
      const x = (i + 0.5) / R;
      const y = (j + 0.5) / R;
      let h = heightAt(spec, noise, x, y);
      let inLake = false;
      for (const l of spec.lakes) {
        const q = Math.hypot(x - l.x, y - l.y) / l.radius;
        const wobble = (noise.noise(x * 60, y * 60) - 0.5) * 0.35;
        if (q + wobble < 1) inLake = true;
      }
      let c;
      if (h > LAND_THRESHOLD && !inLake) {
        c = landColor(spec, noise, x, y, h);
      } else {
        const t = inLake ? 0.85 : Math.max(0, Math.min(1, (h - 0.05) / (LAND_THRESHOLD - 0.05)));
        c = [DEEP[0] + (SHALLOW[0] - DEEP[0]) * t, DEEP[1] + (SHALLOW[1] - DEEP[1]) * t, DEEP[2] + (SHALLOW[2] - DEEP[2]) * t];
        if (spec.time_of_day === 'night') c = c.map((v) => v * 0.55);
      }
      const k = (j * R + i) * 4;
      img.data[k] = Math.max(0, Math.min(255, c[0] * tint.mul[0] + tint.add[0]));
      img.data[k + 1] = Math.max(0, Math.min(255, c[1] * tint.mul[1] + tint.add[1]));
      img.data[k + 2] = Math.max(0, Math.min(255, c[2] * tint.mul[2] + tint.add[2]));
      img.data[k + 3] = 255;
    }
  }
  octx.putImageData(img, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(off, 0, 0, size, size);
}

function polyline(ctx, pts, size) {
  ctx.beginPath();
  pts.forEach((p, i) => (i ? ctx.lineTo(p.x * size, p.y * size) : ctx.moveTo(p.x * size, p.y * size)));
  ctx.stroke();
}

function smoothLine(ctx, pts, size) {
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

function outlinedText(ctx, text, x, y, px, fill = '#fff') {
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

export function stormCenters(spec) {
  const n = spec.storm.phases.length;
  return spec.storm.phases.map((p, i) => {
    const t = n > 1 ? (i + 1) / n : 1;
    return {
      x: 0.5 + (spec.storm.final_x - 0.5) * t,
      y: 0.5 + (spec.storm.final_y - 0.5) * t,
      r: p.end_radius_pct,
    };
  });
}

/**
 * Draw the minimap into ctx at (0,0) with the given pixel size.
 * opts: { grid, labels, features, storm, bus, legend }
 */
export function drawMinimap(ctx, spec, size, opts = {}) {
  const o = { grid: true, labels: true, features: true, storm: true, bus: true, ...opts };
  ctx.save();
  drawTerrain(ctx, spec, size);
  const s = size / 1000;

  // Rivers
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const rv of spec.rivers) {
    ctx.strokeStyle = 'rgba(58,164,214,0.95)';
    ctx.lineWidth = 9 * s;
    smoothLine(ctx, rv.points, size);
  }
  // Roads
  for (const rd of spec.roads) {
    ctx.strokeStyle = 'rgba(60,50,40,0.55)';
    ctx.lineWidth = 6 * s;
    smoothLine(ctx, rd.points, size);
    ctx.strokeStyle = 'rgba(245,235,210,0.9)';
    ctx.lineWidth = 3 * s;
    smoothLine(ctx, rd.points, size);
  }

  // POI footprints
  for (const p of spec.pois) {
    const rad = { small: 18, medium: 26, large: 36 }[p.size] * s;
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 2 * s;
    ctx.beginPath();
    ctx.arc(p.x * size, p.y * size, rad, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // little building blocks
    for (let k = 0; k < (p.size === 'large' ? 7 : p.size === 'medium' ? 5 : 3); k++) {
      const a = (k / 7) * Math.PI * 2 + p.x * 10;
      const d = rad * 0.55 * ((k % 2) + 0.5) * 0.8;
      ctx.fillStyle = 'rgba(70,60,70,0.75)';
      ctx.fillRect(p.x * size + Math.cos(a) * d - 3 * s, p.y * size + Math.sin(a) * d - 3 * s, 6 * s, 6 * s);
    }
  }

  // Storm circles
  if (o.storm && spec.storm.phases.length) {
    const centers = stormCenters(spec);
    const first = centers[0];
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
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(fx - 8 * s, fy);
    ctx.lineTo(fx + 8 * s, fy);
    ctx.moveTo(fx, fy - 8 * s);
    ctx.lineTo(fx, fy + 8 * s);
    ctx.stroke();
  }

  // Battle bus path
  if (o.bus && spec.bus_route) {
    const a = spec.bus_route.start;
    const b = spec.bus_route.end;
    ctx.setLineDash([16 * s, 10 * s]);
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 4 * s;
    polyline(ctx, [a, b], size);
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
    ctx.roundRect?.(a.x * size - 16 * s, a.y * size - 10 * s, 32 * s, 20 * s, 5 * s);
    if (!ctx.roundRect) ctx.rect(a.x * size - 16 * s, a.y * size - 10 * s, 32 * s, 20 * s);
    ctx.fill();
    ctx.stroke();
  }

  // Features
  if (o.features) {
    for (const f of spec.features) {
      const st = FEATURE_STYLE[f.type] || FEATURE_STYLE.supply_drop;
      const r = 11 * s;
      ctx.fillStyle = st.color;
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2.5 * s;
      ctx.beginPath();
      ctx.arc(f.x * size, f.y * size, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.font = `900 ${13 * s}px Arial, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(st.glyph, f.x * size, f.y * size + 1 * s);
    }
  }

  // Grid A-J / 1-10
  if (o.grid) {
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
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    for (let k = 0; k < 10; k++) {
      ctx.fillText('ABCDEFGHIJ'[k], ((k + 0.5) * size) / 10, 6 * s);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(k + 1), 6 * s, ((k + 0.5) * size) / 10);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
    }
  }

  // POI labels last so they sit on top
  if (o.labels) {
    for (const p of spec.pois) {
      const px = { small: 15, medium: 17, large: 20 }[p.size] * s;
      const rad = { small: 18, medium: 26, large: 36 }[p.size] * s;
      const ly = p.y * size - rad - px * 0.6;
      outlinedText(ctx, p.name.toUpperCase(), Math.min(size - 60 * s, Math.max(60 * s, p.x * size)), Math.max(px, ly), px);
    }
  }
  ctx.restore();
}

export function renderMinimapCanvas(spec, size = 1024, opts) {
  const c = makeCanvas(size, size);
  drawMinimap(c.getContext('2d'), spec, size, opts);
  return c;
}

function wrapLines(ctx, text, maxWidth) {
  const words = text.split(/\s+/);
  const lines = [];
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

const SKY = {
  day: ['#3a86ff', '#7b2ff7'],
  dawn: ['#ff9e7a', '#7b2ff7'],
  dusk: ['#ff6b35', '#5a189a'],
  night: ['#0b1d51', '#3c096c'],
};

/** 1920x1080 island thumbnail (the image UEFN / Creator Portal uses for an island). */
export function renderThumbnailCanvas(spec) {
  const W = 1920;
  const H = 1080;
  const c = makeCanvas(W, H);
  const ctx = c.getContext('2d');
  const [c1, c2] = SKY[spec.time_of_day] || SKY.day;
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, c1);
  g.addColorStop(1, c2);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // light rays
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

  // Map tile, tilted a little
  const M = 900;
  const map = renderMinimapCanvas(spec, M, { grid: false });
  ctx.save();
  ctx.translate(1390, 540);
  ctx.rotate(-0.05);
  ctx.shadowColor = 'rgba(0,0,0,0.45)';
  ctx.shadowBlur = 50;
  ctx.shadowOffsetY = 20;
  ctx.fillStyle = '#fff';
  ctx.fillRect(-M / 2 - 14, -M / 2 - 14, M + 28, M + 28);
  ctx.shadowColor = 'transparent';
  ctx.drawImage(map, -M / 2, -M / 2, M, M);
  ctx.restore();

  const mode = MODES[spec.mode] || MODES.reload;
  // Mode badge
  ctx.font = '900 44px "Arial Black", Arial, sans-serif';
  const badge = mode.label.toUpperCase();
  const bw = ctx.measureText(badge).width + 60;
  ctx.fillStyle = '#ffd60a';
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(90, 110, bw, 78, 16);
  else ctx.rect(90, 110, bw, 78);
  ctx.fill();
  ctx.fillStyle = '#1b1b3a';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(badge, 120, 151);

  // Title
  ctx.font = '900 120px "Arial Black", Impact, Arial, sans-serif';
  let lines = wrapLines(ctx, spec.name.toUpperCase(), 760);
  let px = 120;
  if (lines.length > 3) {
    px = 90;
    ctx.font = `900 ${px}px "Arial Black", Impact, Arial, sans-serif`;
    lines = wrapLines(ctx, spec.name.toUpperCase(), 760).slice(0, 4);
  }
  let y = 300;
  for (const line of lines) {
    ctx.textAlign = 'left';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 18;
    ctx.strokeStyle = '#14123a';
    ctx.strokeText(line, 90, y);
    ctx.fillStyle = '#fff';
    ctx.fillText(line, 90, y);
    y += px * 1.05;
  }

  // Tagline
  ctx.font = '700 40px Arial, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  y += 10;
  for (const line of wrapLines(ctx, spec.tagline, 760).slice(0, 3)) {
    ctx.fillText(line, 92, y);
    y += 52;
  }

  // Stats chips
  const r = spec.rules;
  const chips = [
    `${r.max_players} PLAYERS`,
    r.team_size === 1 ? 'SOLOS' : r.team_size === 2 ? 'DUOS' : r.team_size === 3 ? 'TRIOS' : 'SQUADS',
    `${spec.pois.length} POIs`,
    r.respawn_enabled ? 'RESPAWNS ON' : 'ONE LIFE',
  ];
  let cx = 90;
  const cy = 960;
  ctx.font = '800 30px Arial, sans-serif';
  for (const chip of chips) {
    const w = ctx.measureText(chip).width + 40;
    ctx.fillStyle = 'rgba(15,12,50,0.55)';
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(cx, cy - 30, w, 60, 30);
    else ctx.rect(cx, cy - 30, w, 60);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.fillText(chip, cx + 20, cy + 1);
    cx += w + 16;
  }
  return c;
}
