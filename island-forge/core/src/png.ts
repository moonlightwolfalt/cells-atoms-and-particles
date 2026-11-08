// Tiny PNG encoder (grayscale 16-bit for heightmaps, RGBA 8-bit for paint maps).
// Uses CompressionStream('deflate'), available in browsers and Node 18+.
import { crc32 } from './zip.ts';
import type { MapSpec } from './types.ts';
import { heightField, LAND_THRESHOLD } from './terrain.ts';

async function deflate(data: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([data as BlobPart]).stream().pipeThrough(new CompressionStream('deflate'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

function chunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length);
  const v = new DataView(out.buffer);
  v.setUint32(0, data.length);
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
  out.set(data, 8);
  v.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
  return out;
}

async function encode(width: number, height: number, bitDepth: number, colorType: number, rows: Uint8Array): Promise<Uint8Array> {
  const ihdr = new Uint8Array(13);
  const v = new DataView(ihdr.buffer);
  v.setUint32(0, width);
  v.setUint32(4, height);
  ihdr[8] = bitDepth;
  ihdr[9] = colorType;
  const parts = [new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', await deflate(rows)), chunk('IEND', new Uint8Array())];
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

/** 16-bit grayscale PNG from values in 0..1. */
export async function encodeGray16(width: number, height: number, values: Float32Array): Promise<Uint8Array> {
  const stride = 1 + width * 2;
  const rows = new Uint8Array(stride * height);
  for (let y = 0; y < height; y++) {
    rows[y * stride] = 0;
    for (let x = 0; x < width; x++) {
      const v = Math.round(Math.max(0, Math.min(1, values[y * width + x])) * 65535);
      rows[y * stride + 1 + x * 2] = v >> 8;
      rows[y * stride + 2 + x * 2] = v & 255;
    }
  }
  return encode(width, height, 16, 0, rows);
}

/** 8-bit RGBA PNG. */
export async function encodeRGBA(width: number, height: number, rgba: Uint8Array): Promise<Uint8Array> {
  const stride = 1 + width * 4;
  const rows = new Uint8Array(stride * height);
  for (let y = 0; y < height; y++) {
    rows[y * stride] = 0;
    rows.set(rgba.subarray(y * width * 4, (y + 1) * width * 4), y * stride + 1);
  }
  return encode(width, height, 8, 6, rows);
}

/**
 * Heightmap for UEFN Landscape mode (Import from file). 1009 or 2017 are standard Unreal landscape sizes.
 * Sea level sits at ~12% so the landscape can be lowered under a water plane.
 */
export async function heightmapPng(spec: MapSpec, size = 1009): Promise<Uint8Array> {
  const field = heightField(spec, size);
  const coast = LAND_THRESHOLD / 1.6;
  const out = new Float32Array(field.length);
  for (let i = 0; i < field.length; i++) {
    const h = field[i];
    out[i] = h < coast ? (h / coast) * 0.12 : 0.12 + ((h - coast) / (1 - coast)) * 0.88;
  }
  return encodeGray16(size, size, out);
}

const BIOME_RGB: Record<string, [number, number, number]> = {
  grassland: [111, 191, 74], forest: [56, 135, 58], desert: [227, 194, 122], snow: [236, 242, 247], swamp: [96, 112, 60],
  jungle: [42, 154, 82], volcanic: [78, 62, 60], beach: [240, 220, 154], mountain: [141, 138, 131], urban: [154, 163, 173],
  autumn: [214, 137, 58], candy: [245, 154, 200],
};

/** Colour map of which biome goes where — a painting guide for Landscape layers. */
export async function biomePaintPng(spec: MapSpec, size = 512): Promise<Uint8Array> {
  const field = heightField(spec, size);
  const coast = LAND_THRESHOLD / 1.6;
  const rgba = new Uint8Array(size * size * 4);
  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      const x = (i + 0.5) / size;
      const y = (j + 0.5) / size;
      const k = j * size + i;
      let c: [number, number, number] = [30, 90, 170];
      if (field[k] >= coast) {
        let best = spec.base_biome;
        let bestW = 0.35;
        for (const b of spec.biomes) {
          const w = 1 - Math.hypot(x - b.x, y - b.y) / b.radius;
          if (w > bestW) {
            best = b.type;
            bestW = w;
          }
        }
        c = field[k] < coast + 0.03 ? BIOME_RGB.beach : BIOME_RGB[best] || BIOME_RGB.grassland;
      }
      rgba.set([c[0], c[1], c[2], 255], k * 4);
    }
  }
  return encodeRGBA(size, size, rgba);
}
