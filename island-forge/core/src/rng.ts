// Small deterministic random + noise helpers (no dependencies).

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function rand() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface Rng {
  next: () => number;
  range: (lo: number, hi: number) => number;
  int: (lo: number, hi: number) => number;
  pick: <T>(list: readonly T[]) => T;
  chance: (p: number) => boolean;
}

export function makeRng(seed: number): Rng {
  const r = mulberry32(seed);
  return {
    next: r,
    range: (lo: number, hi: number) => lo + (hi - lo) * r(),
    int: (lo: number, hi: number) => Math.floor(lo + (hi - lo + 1) * r()),
    pick: <T,>(list: readonly T[]): T => list[Math.floor(r() * list.length)],
    chance: (p: number) => r() < p,
  };
}

// 2D value noise with smooth interpolation, seeded.
export interface Noise {
  noise: (x: number, y: number) => number;
  fbm: (x: number, y: number, octaves?: number) => number;
}

export function makeNoise(seed: number): Noise {
  const rand = mulberry32(seed ^ 0x9e3779b9);
  const perm = new Uint8Array(512);
  const vals = new Float32Array(256);
  for (let i = 0; i < 256; i++) {
    perm[i] = i;
    vals[i] = rand();
  }
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const tmp = perm[i];
    perm[i] = perm[j];
    perm[j] = tmp;
  }
  for (let i = 0; i < 256; i++) perm[i + 256] = perm[i];

  const lattice = (ix: number, iy: number): number => vals[perm[(perm[ix & 255] + iy) & 511]];
  const smooth = (t: number) => t * t * (3 - 2 * t);

  function noise(x: number, y: number): number {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    const fx = smooth(x - ix);
    const fy = smooth(y - iy);
    const a = lattice(ix, iy);
    const b = lattice(ix + 1, iy);
    const c = lattice(ix, iy + 1);
    const d = lattice(ix + 1, iy + 1);
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
  }

  function fbm(x: number, y: number, octaves = 4): number {
    let sum = 0;
    let amp = 0.5;
    let freq = 1;
    let norm = 0;
    for (let o = 0; o < octaves; o++) {
      sum += amp * noise(x * freq, y * freq);
      norm += amp;
      amp *= 0.5;
      freq *= 2;
    }
    return sum / norm;
  }

  return { noise, fbm };
}
