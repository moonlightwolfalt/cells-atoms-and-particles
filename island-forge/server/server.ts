// Island Forge API + static host for the built web app.
//   npm start            -> http://localhost:5173 (serves web/dist)
//   npm run dev          -> API on :5174, Vite dev server on :5173 with hot reload
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, dirname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateMap, PROVIDERS, providerStatus, httpError, accessPolicy } from './providers.ts';
import {
  MODE_LIST, MODE_CATEGORIES, DEVICES, DEVICE_CATEGORIES, VERSE_MODULES, MAP_SCHEMA,
  normalizeSpec, generateVerseFiles, generateReadme, buildPackageZip, slug,
} from '../core/src/index.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', 'web', 'dist');
const PORT = Number(process.env.PORT) || 5173;
const KEEPALIVE_MS = Number(process.env.KEEPALIVE_MS) || 5000;
const HOST = process.env.HOST || '127.0.0.1';

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

function send(res: http.ServerResponse, status: number, body: unknown, type = 'application/json; charset=utf-8', extra: Record<string, string> = {}) {
  res.writeHead(status, { 'content-type': type, 'cache-control': 'no-store', 'access-control-allow-origin': '*', ...extra });
  res.end(typeof body === 'string' || body instanceof Uint8Array ? body : JSON.stringify(body));
}

async function readJson(req: http.IncomingMessage, limit = 4_000_000): Promise<any> {
  let size = 0;
  const chunks: Buffer[] = [];
  for await (const c of req) {
    size += c.length;
    if (size > limit) throw httpError(413, 'Request too large');
    chunks.push(c as Buffer);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
  } catch {
    throw httpError(400, 'Invalid JSON body');
  }
}

// Simple per-visitor rate limit for AI generation on public servers (RATE_LIMIT_PER_HOUR, 0 = off).
const hits = new Map<string, number[]>();
function rateLimited(req: http.IncomingMessage): boolean {
  const policy = accessPolicy();
  const limit = Number(process.env.RATE_LIMIT_PER_HOUR ?? (policy.public ? 30 : 0));
  if (!limit) return false;
  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((t) => now - t < 3_600_000);
  if (recent.length >= limit) return true;
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 10_000) hits.clear();
  return false;
}

const specFrom = (body: any) => {
  if (!body?.spec || typeof body.spec !== 'object') throw httpError(400, 'Send { "spec": <map spec> }');
  return normalizeSpec(body.spec, body.spec.mode);
};

export const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  try {
    if (req.method === 'OPTIONS') {
      return send(res, 204, '', 'text/plain', { 'access-control-allow-methods': 'GET, POST', 'access-control-allow-headers': 'content-type, x-island-forge-passcode, x-island-forge-keepalive' });
    }
    if (url.pathname === '/api/health') return send(res, 200, { ok: true });
    if (url.pathname === '/api/providers') {
      const policy = accessPolicy();
      return send(res, 200, {
        providers: PROVIDERS,
        status: providerStatus(),
        access: { public: policy.public, serverKeys: policy.serverKeys, customBaseUrls: policy.public ? policy.allowedBaseUrls?.length ? 'allowlist' : 'off' : 'any' },
      });
    }
    if (url.pathname === '/api/catalog') {
      return send(res, 200, {
        modes: MODE_LIST,
        modeCategories: MODE_CATEGORIES,
        devices: DEVICES,
        deviceCategories: DEVICE_CATEGORIES,
        verseModules: Object.values(VERSE_MODULES).map((m) => ({ id: m.id, title: m.title, description: m.description })),
      });
    }
    if (url.pathname === '/api/schema') return send(res, 200, MAP_SCHEMA);
    if (req.method === 'POST' && url.pathname === '/api/generate') {
      const body = await readJson(req);
      if (body?.provider !== 'offline' && rateLimited(req)) throw httpError(429, 'Too many AI requests from you this hour. Try again later, or use the offline generator.');
      const passcode = req.headers['x-island-forge-passcode'];
      const run = () => generateMap(body, undefined, { passcode: typeof passcode === 'string' ? passcode : undefined });
      const started = Date.now();
      const tag = `[generate] ${String(body?.provider || 'anthropic')}/${String(body?.model || 'default').slice(0, 60)} ${String(body?.mode || '')}`;
      // Keep-alive mode (the web app asks for it): start the response now and send a space every
      // few seconds while the AI works, so gateways and load balancers with idle/first-byte
      // timeouts don't cut a slow model off with a bare 502. Leading whitespace is valid JSON.
      if (req.headers['x-island-forge-keepalive'] === '1') {
        res.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-accel-buffering': 'no', 'access-control-allow-origin': '*' });
        res.write(' ');
        const beat = setInterval(() => res.write(' '), KEEPALIVE_MS);
        let closed = false;
        res.on('close', () => (closed = true));
        try {
          const spec = await run();
          console.log(`${tag} ok in ${Date.now() - started}ms`);
          if (!closed) res.end(JSON.stringify({ spec }));
        } catch (err: any) {
          const status = err.status || 500;
          console.error(`${tag} failed in ${Date.now() - started}ms: ${status} ${err.message}`);
          if (status >= 500 && !err.status) console.error(err);
          if (!closed) res.end(JSON.stringify({ error: err.message || 'Something went wrong', status }));
        } finally {
          clearInterval(beat);
        }
        return;
      }
      try {
        const spec = await run();
        console.log(`${tag} ok in ${Date.now() - started}ms`);
        return send(res, 200, { spec });
      } catch (err: any) {
        console.error(`${tag} failed in ${Date.now() - started}ms: ${err.status || 500} ${err.message}`);
        throw err;
      }
    }
    if (req.method === 'POST' && url.pathname === '/api/verse') {
      const spec = specFrom(await readJson(req));
      return send(res, 200, { files: generateVerseFiles(spec) });
    }
    if (req.method === 'POST' && url.pathname === '/api/readme') {
      return send(res, 200, generateReadme(specFrom(await readJson(req))), 'text/markdown; charset=utf-8');
    }
    if (req.method === 'POST' && url.pathname === '/api/package') {
      const spec = specFrom(await readJson(req));
      const zip = await buildPackageZip(spec);
      return send(res, 200, zip, 'application/zip', { 'content-disposition': `attachment; filename="${slug(spec)}-uefn.zip"` });
    }
    if (url.pathname.startsWith('/api/')) return send(res, 404, { error: 'Unknown API route' });
    if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, { error: 'Method not allowed' });

    const rel = normalize(decodeURIComponent(url.pathname)).replace(/^([/\\])+/, '');
    let file = join(ROOT, rel || 'index.html');
    if (!file.startsWith(ROOT + sep) && file !== ROOT) return send(res, 403, { error: 'Forbidden' });
    let data = await readFile(file).catch(() => null);
    if (!data && !extname(file)) {
      file = join(ROOT, 'index.html');
      data = await readFile(file).catch(() => null);
    }
    if (!data) return send(res, 404, { error: rel ? 'Not found' : 'Web app not built yet — run "npm run build" first.' });
    return send(res, 200, data, TYPES[extname(file)] || 'application/octet-stream');
  } catch (err: any) {
    const status = err.status || 500;
    if (status >= 500) console.error(err);
    return send(res, status, { error: err.message || 'Something went wrong' });
  }
});

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  server.listen(PORT, HOST, () => {
    console.log(`Island Forge running at http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}`);
    const st = providerStatus();
    const keys = Object.entries(st).filter(([, v]) => v.envKey).map(([k]) => k);
    console.log(`AI keys from environment: ${keys.join(', ') || 'none (enter one in the app, or use Offline)'}`);
  });
}
