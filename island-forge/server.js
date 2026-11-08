// Island Forge server: serves the web app and proxies map generation to the chosen AI.
// Run: npm install && npm start  ->  http://localhost:5173
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateMap, PROVIDERS, providerStatus } from './providers.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), 'public');
const PORT = Number(process.env.PORT) || 5173;
const HOST = process.env.HOST || '127.0.0.1';

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

function send(res, status, body, type = 'application/json; charset=utf-8') {
  res.writeHead(status, { 'content-type': type, 'cache-control': 'no-store' });
  res.end(typeof body === 'string' || body instanceof Buffer ? body : JSON.stringify(body));
}

async function readJson(req, limit = 1_000_000) {
  let size = 0;
  const chunks = [];
  for await (const c of req) {
    size += c.length;
    if (size > limit) throw Object.assign(new Error('Request too large'), { status: 413 });
    chunks.push(c);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
  } catch {
    throw Object.assign(new Error('Invalid JSON body'), { status: 400 });
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  try {
    if (url.pathname === '/api/providers' && req.method === 'GET') {
      return send(res, 200, { providers: PROVIDERS, status: providerStatus() });
    }
    if (url.pathname === '/api/generate' && req.method === 'POST') {
      const body = await readJson(req);
      const spec = await generateMap(body);
      return send(res, 200, { spec });
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, { error: 'Method not allowed' });

    const rel = normalize(decodeURIComponent(url.pathname)).replace(/^([/\\])+/, '');
    const file = join(ROOT, rel || 'index.html');
    if (!file.startsWith(ROOT)) return send(res, 403, { error: 'Forbidden' });
    const data = await readFile(file).catch(() => null);
    if (!data) return send(res, 404, { error: 'Not found' });
    return send(res, 200, data, TYPES[extname(file)] || 'application/octet-stream');
  } catch (err) {
    const status = err.status || 500;
    if (status >= 500) console.error(err);
    return send(res, status, { error: err.message || 'Something went wrong' });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Island Forge running at http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}`);
  const st = providerStatus();
  console.log(`AI keys from environment: ${Object.entries(st).filter(([, v]) => v.envKey).map(([k]) => k).join(', ') || 'none (enter one in the app, or use Offline)'}`);
});
