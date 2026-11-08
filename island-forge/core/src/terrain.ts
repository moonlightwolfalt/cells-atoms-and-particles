// Terrain shared by the 2D map, the WebGL 3D view, the heightmap export and the Verse coordinates.
import type { MapSpec } from './types.ts';
import { makeNoise, type Noise } from './rng.ts';
import { MODES } from './modes.ts';

export const LAND_THRESHOLD = 0.3;
export const CM_PER_M = 100;
/** Elevation 1.0 in the spec = 60 m above sea level in UEFN. */
export const MAX_ELEVATION_CM = 6000;

const noiseCache = new Map<number, Noise>();
export function noiseFor(seed: number): Noise {
  let n = noiseCache.get(seed);
  if (!n) {
    n = makeNoise(seed >>> 0);
    if (noiseCache.size > 16) noiseCache.clear();
    noiseCache.set(seed, n);
  }
  return n;
}

/** Height in 0..~2; values above LAND_THRESHOLD are land. */
export function heightAt(spec: MapSpec, x: number, y: number, noise = noiseFor(spec.seed)): number {
  const layout = MODES[spec.mode]?.layout || 'island';
  const dx = x - 0.5;
  const dy = y - 0.5;
  let h: number;
  if (layout === 'island' || layout === 'hub') {
    const d = Math.sqrt(dx * dx + dy * dy) / 0.5;
    const fill = layout === 'hub' ? 1.25 : 1.05;
    h = fill - Math.pow(d, 1.7) * 1.05 + (noise.fbm(x * 4.2, y * 4.2, 5) - 0.5) * 0.75;
  } else {
    // Arenas, courses and plots: a flat-ish built platform with a thin shoreline.
    const edge = Math.max(Math.abs(dx), Math.abs(dy)) / 0.5;
    h = 0.75 - Math.max(0, edge - 0.86) * 4 + (noise.fbm(x * 3, y * 3, 3) - 0.5) * 0.18;
  }
  for (const p of spec.pois) {
    const q = Math.hypot(x - p.x, y - p.y) / 0.09;
    if (q < 2.5) h += Math.exp(-q * q) * (0.35 + p.elevation * 0.4);
  }
  for (const f of spec.features) {
    const q = Math.hypot(x - f.x, y - f.y) / 0.04;
    if (q < 2.5) h += Math.exp(-q * q) * 0.2;
  }
  for (const b of spec.biomes) {
    if (b.type !== 'mountain' && b.type !== 'volcanic') continue;
    const q = Math.hypot(x - b.x, y - b.y) / b.radius;
    if (q < 1.5) h += Math.exp(-q * q * 2) * 0.35;
  }
  return h;
}

export function inLake(spec: MapSpec, x: number, y: number, noise = noiseFor(spec.seed)): boolean {
  for (const l of spec.lakes) {
    const q = Math.hypot(x - l.x, y - l.y) / l.radius;
    if (q + (noise.noise(x * 60, y * 60) - 0.5) * 0.35 < 1) return true;
  }
  return false;
}

/** N×N field of land heights in 0..1 (0 = sea floor, LAND_THRESHOLD-normalised coast ≈ 0.12). */
export function heightField(spec: MapSpec, n: number): Float32Array {
  const out = new Float32Array(n * n);
  const noise = noiseFor(spec.seed);
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const x = (i + 0.5) / n;
      const y = (j + 0.5) / n;
      let h = heightAt(spec, x, y, noise);
      if (inLake(spec, x, y, noise)) h = Math.min(h, LAND_THRESHOLD - 0.05);
      out[j * n + i] = Math.max(0, Math.min(1, h / 1.6));
    }
  }
  return out;
}

export function stormCenters(spec: MapSpec): { x: number; y: number; r: number }[] {
  const n = spec.storm.phases.length;
  return spec.storm.phases.map((p, i) => {
    const t = n > 1 ? (i + 1) / n : 1;
    return { x: 0.5 + (spec.storm.final_x - 0.5) * t, y: 0.5 + (spec.storm.final_y - 0.5) * t, r: p.end_radius_pct };
  });
}

/**
 * Map 0..1 coordinates to UEFN world units (cm) relative to the island centre.
 * Unreal top-down: +X = north (map up), +Y = east (map right).
 */
export function toWorld(spec: MapSpec, x: number, y: number, elevation = 0): { X: number; Y: number; Z: number } {
  const sizeCm = spec.map_size_m * CM_PER_M;
  return {
    X: Math.round(-(y - 0.5) * sizeCm) + 0,
    Y: Math.round((x - 0.5) * sizeCm) + 0,
    Z: Math.round(elevation * MAX_ELEVATION_CM) + 0,
  };
}

export function gridRef(x: number, y: number): string {
  const col = 'ABCDEFGHIJ'[Math.min(9, Math.max(0, Math.floor(x * 10)))];
  const row = Math.min(10, Math.max(1, Math.floor(y * 10) + 1));
  return `${col}${row}`;
}
