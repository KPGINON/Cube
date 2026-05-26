import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { networkInterfaces } from 'node:os';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const distDir = join(root, 'dist');
const port = Number(process.env.PORT || 3000);
const clients = new Set();
let latestGesture = null;

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.wasm': 'application/wasm',
};

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === 'OPTIONS') {
    writeCors(res);
    res.writeHead(204);
    res.end();
    return;
  }

  if (url.pathname === '/api/gesture' && req.method === 'POST') {
    await receiveGesture(req, res);
    return;
  }

  if (url.pathname === '/api/gesture/stream' && req.method === 'GET') {
    openGestureStream(req, res);
    return;
  }

  if (url.pathname === '/api/status' && req.method === 'GET') {
    writeJson(res, {
      ok: true,
      hasGesture: Boolean(latestGesture),
      clients: clients.size,
      updatedAt: latestGesture?.updatedAt ?? null,
    });
    return;
  }

  await serveStatic(url.pathname, res);
});

server.listen(port, '0.0.0.0', () => {
  const addresses = getLocalAddresses();
  console.log(`Gesture relay running on http://localhost:${port}`);
  addresses.forEach((address) => {
    console.log(`Display:    http://${address}:${port}/`);
    console.log(`Controller: http://${address}:${port}/controller`);
  });
});

async function receiveGesture(req, res) {
  try {
    const body = await readBody(req);
    const data = JSON.parse(body);
    latestGesture = sanitizeGesture(data);
    broadcast(latestGesture);
    writeJson(res, { ok: true });
  } catch {
    writeJson(res, { ok: false, error: 'Invalid gesture payload' }, 400);
  }
}

function openGestureStream(req, res) {
  writeCors(res);
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.write('\n');

  const client = { res };
  clients.add(client);

  if (latestGesture) {
    sendEvent(res, latestGesture);
  }

  const heartbeat = setInterval(() => {
    res.write(': heartbeat\n\n');
  }, 15000);

  req.on('close', () => {
    clearInterval(heartbeat);
    clients.delete(client);
  });
}

async function serveStatic(pathname, res) {
  const safePath = normalize(decodeURIComponent(pathname)).replace(/^(\.\.[/\\])+/, '');
  let filePath = join(distDir, safePath === '/' ? 'index.html' : safePath);

  if (!filePath.startsWith(distDir) || !existsSync(filePath) || statSync(filePath).isDirectory()) {
    filePath = join(distDir, 'index.html');
  }

  if (!existsSync(filePath)) {
    writeJson(res, { ok: false, error: 'Run npm run build before npm run relay' }, 404);
    return;
  }

  const ext = extname(filePath);
  res.writeHead(200, {
    'Content-Type': mimeTypes[ext] ?? 'application/octet-stream',
    'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=31536000, immutable',
  });
  createReadStream(filePath).pipe(res);
}

function broadcast(payload) {
  for (const client of clients) {
    sendEvent(client.res, payload);
  }
}

function sendEvent(res, payload) {
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

function sanitizeGesture(data) {
  const metrics = data.metrics ?? {};

  return {
    gesture: typeof data.gesture === 'string' ? data.gesture : 'unknown',
    metrics: {
      openness: clamp(metrics.openness),
      pinch: clamp(metrics.pinch),
      palmX: clamp(metrics.palmX, -1, 1),
      palmY: clamp(metrics.palmY, -1, 1),
      confidence: clamp(metrics.confidence),
    },
    updatedAt: Date.now(),
  };
}

function clamp(value, min = 0, max = 1) {
  const next = Number(value);
  if (!Number.isFinite(next)) return min;
  return Math.max(min, Math.min(max, next));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.setEncoding('utf8');
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 64 * 1024) {
        req.destroy();
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

function writeJson(res, data, status = 200) {
  writeCors(res);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}

function writeCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function getLocalAddresses() {
  return Object.values(networkInterfaces())
    .flat()
    .filter((item) => item && item.family === 'IPv4' && !item.internal)
    .map((item) => item.address);
}
