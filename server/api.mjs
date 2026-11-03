// Local API for the portable app. Plain Node.js (18+), no dependencies.
// Stores app state in data/state/*.json and reports in reports/<competition>/.

import { mkdir, readFile, readdir, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

const KEY_PATTERN = /^[A-Za-z0-9:_-]{1,200}$/;
const COMPETITION_PATTERN = /^[A-Za-z0-9_-]{1,100}$/;
const REPORT_FILE_PATTERN = /^[A-Za-z0-9_-]{1,100}\.(csv|md|pdf)$/;
const MAX_BODY_BYTES = 20 * 1024 * 1024;

// ":" is not allowed in Windows file names, so state keys use "~" on disk.
function keyToFile(key) {
  return `${key.replaceAll(':', '~')}.json`;
}

function fileToKey(file) {
  return file.slice(0, -'.json'.length).replaceAll('~', ':');
}

/** Writes to a temporary file first, so an interrupted write never leaves a broken file. */
async function writeAtomic(filePath, content) {
  await mkdir(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(tempPath, content);
  await rename(tempPath, filePath);
}

/** Resolves to the raw bytes, so binary reports (PDF) stay intact. */
function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error('Body too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function sendJson(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

async function readAllState(stateDir) {
  const state = {};
  let files = [];
  try {
    files = await readdir(stateDir);
  } catch {
    return state;
  }
  for (const file of files) {
    if (!file.endsWith('.json')) continue;
    try {
      state[fileToKey(file)] = JSON.parse(await readFile(path.join(stateDir, file), 'utf8'));
    } catch {
      // Skip unreadable files instead of failing the whole load.
    }
  }
  return state;
}

/**
 * Returns a request handler. It resolves to true when the request was an /api/ request.
 * Routes:
 *   GET /api/state                      all saved state as { key: value }
 *   PUT /api/state/:key                 save one state value (JSON body)
 *   PUT /api/reports/:competition/:file save a report (.csv, .md or .pdf)
 */
export function createApi({ dataDir, reportsDir }) {
  const stateDir = path.join(dataDir, 'state');

  return async function handleApi(req, res) {
    const url = new URL(req.url ?? '/', 'http://localhost');
    if (!url.pathname.startsWith('/api/')) return false;

    const parts = url.pathname.split('/').slice(2).map(decodeURIComponent);
    try {
      if (req.method === 'GET' && parts.length === 1 && parts[0] === 'state') {
        sendJson(res, 200, await readAllState(stateDir));
        return true;
      }

      if (req.method === 'PUT' && parts.length === 2 && parts[0] === 'state') {
        const key = parts[1];
        if (!KEY_PATTERN.test(key)) {
          sendJson(res, 400, { error: 'Invalid key' });
          return true;
        }
        const body = (await readBody(req)).toString('utf8');
        JSON.parse(body);
        await writeAtomic(path.join(stateDir, keyToFile(key)), body);
        sendJson(res, 200, { ok: true });
        return true;
      }

      if (req.method === 'PUT' && parts.length === 3 && parts[0] === 'reports') {
        const [, competitionId, file] = parts;
        if (!COMPETITION_PATTERN.test(competitionId) || !REPORT_FILE_PATTERN.test(file)) {
          sendJson(res, 400, { error: 'Invalid report name' });
          return true;
        }
        await writeAtomic(path.join(reportsDir, competitionId, file), await readBody(req));
        sendJson(res, 200, { ok: true });
        return true;
      }

      sendJson(res, 404, { error: 'Not found' });
    } catch (error) {
      sendJson(res, 500, { error: String(error) });
    }
    return true;
  };
}
