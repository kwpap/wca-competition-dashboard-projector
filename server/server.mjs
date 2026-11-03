// Portable app server: serves the built app from ../app and the local API.
// Run with: node server/server.mjs

import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApi } from './api.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const APP_DIR = path.join(ROOT, 'app');
// Must match the redirect URI registered in the WCA OAuth app.
const PORT = Number(process.env.PORT) || 5173;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

const handleApi = createApi({
  dataDir: path.join(ROOT, 'data'),
  reportsDir: path.join(ROOT, 'reports'),
});

async function isFile(filePath) {
  try {
    return (await stat(filePath)).isFile();
  } catch {
    return false;
  }
}

/** Serves files from app/. Unknown paths get index.html, so app routes like /control/X work. */
async function serveApp(req, res) {
  const url = new URL(req.url ?? '/', 'http://localhost');
  let filePath = path.join(APP_DIR, decodeURIComponent(url.pathname));
  if (filePath !== APP_DIR && !filePath.startsWith(APP_DIR + path.sep)) {
    res.writeHead(403).end();
    return;
  }
  if (!(await isFile(filePath))) filePath = path.join(APP_DIR, 'index.html');

  const isIndex = filePath.endsWith('index.html');
  res.writeHead(200, {
    'Content-Type': MIME_TYPES[path.extname(filePath)] ?? 'application/octet-stream',
    'Cache-Control': isIndex ? 'no-cache' : 'public, max-age=31536000, immutable',
  });
  if (req.method === 'HEAD') {
    res.end();
    return;
  }
  createReadStream(filePath).pipe(res);
}

const server = http.createServer(async (req, res) => {
  if (await handleApi(req, res)) return;
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405).end();
    return;
  }
  await serveApp(req, res);
});

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.log(`WCA Stage is already running at http://localhost:${PORT}`);
    process.exit(0);
  }
  throw error;
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`WCA Stage running at http://localhost:${PORT}`);
  console.log(`Data:    ${path.join(ROOT, 'data')}`);
  console.log(`Reports: ${path.join(ROOT, 'reports')}`);
  console.log('Close this window (or press Ctrl+C) to stop.');
});
