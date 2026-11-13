// Portable app server: serves the built app from ../app and the local API.
// Run with: node server/server.mjs

import { appendFileSync, createReadStream, mkdirSync, writeFileSync } from 'node:fs';
import { stat } from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApi } from './api.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const APP_DIR = path.join(ROOT, 'app');
// Must match the redirect URI registered in the WCA OAuth app.
const PORT = Number(process.env.PORT) || 5173;
// Set WCA_STAGE_HOST=127.0.0.1 to keep the app on this computer only. By default TVs on the same Wi-Fi can connect.
// Not plain HOST: other software sets that variable on some PCs.
const LOCAL_ONLY = ['127.0.0.1', 'localhost'].includes(process.env.WCA_STAGE_HOST ?? '');
const LOG_FILE = path.join(ROOT, 'data', 'server.log');

/** False after the network listen failed and the server fell back to this computer only. */
let lanActive = !LOCAL_ONLY;

/** Prints a line. A missing or closed console must never stop the server. */
function print(message) {
  try {
    console.log(message);
  } catch {
    // Nothing to print to. data/server.log still has it.
  }
}

/** Prints a line and keeps it in data/server.log, so a failed start can be read after the window closed. */
function log(message) {
  print(message);
  try {
    mkdirSync(path.dirname(LOG_FILE), { recursive: true });
    appendFileSync(LOG_FILE, `${new Date().toISOString()} ${message}\n`);
  } catch {
    // A read-only folder must not stop the app.
  }
}

let stopping = false;

/** Keeps the window open with the error, instead of closing before anyone can read it. */
function stopWithError(message) {
  if (stopping) return;
  stopping = true;
  log(message);
  print('Press Enter to close this window.');
  process.stdin.resume();
  process.stdin.once('data', () => process.exit(1));
  process.stdin.once('end', () => process.exit(1));
}

// Writing to a closed console throws EBADF. Ignore it instead of crashing.
process.stdout.on('error', () => {});
process.stderr.on('error', () => {});

process.on('uncaughtException', (error) => {
  stopWithError(`WCA Stage stopped because of an error:\n${error?.stack ?? error}`);
});

try {
  mkdirSync(path.dirname(LOG_FILE), { recursive: true });
  writeFileSync(LOG_FILE, '');
} catch {
  // See log().
}
log(`Starting WCA Stage with Node.js ${process.version} on ${process.platform}`);

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
  lan: () => lanActive,
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
    log(`Port ${PORT} is busy: WCA Stage is probably running already at http://localhost:${PORT}.`);
    log('If the app looks old, close the other "WCA Stage server" window and start again.');
    process.exit(0);
  }
  if (lanActive) {
    // Some PCs refuse listening on the network (security software, policies). The app still works on this PC.
    log(`Could not listen on the network (${error.code}). TV screens are off. Starting for this computer only.`);
    lanActive = false;
    server.listen(PORT, '127.0.0.1');
    return;
  }
  stopWithError(`WCA Stage could not start: ${error.message}`);
});

server.on('listening', () => {
  log(`WCA Stage running at http://localhost:${PORT}`);
  if (lanActive) {
    try {
      for (const { address } of Object.values(os.networkInterfaces()).flat()) {
        if (address && /^\d+\.\d+\.\d+\.\d+$/.test(address) && !address.startsWith('127.')) {
          log(`TV screens: http://${address}:${PORT}`);
        }
      }
    } catch {
      // Only a hint. The app works without it.
    }
  }
  log(`Data:    ${path.join(ROOT, 'data')}`);
  log(`Reports: ${path.join(ROOT, 'reports')}`);
  print('Close this window (or press Ctrl+C) to stop.');
});

// No host: Node listens on IPv6 and IPv4 at once, so "localhost" works whichever one Windows picks.
if (lanActive) server.listen(PORT);
else server.listen(PORT, '127.0.0.1');
