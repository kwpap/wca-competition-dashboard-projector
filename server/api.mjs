// Local API for the portable app. Plain Node.js (18+), no dependencies.
// Stores app state in data/state/*.json and reports in reports/<competition>/.

import { mkdir, readFile, readdir, rename, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const KEY_PATTERN = /^[A-Za-z0-9:_-]{1,200}$/;
const COMPETITION_PATTERN = /^[A-Za-z0-9_-]{1,100}$/;
const REPORT_FILE_PATTERN = /^[A-Za-z0-9_-]{1,100}\.(csv|md|pdf)$/;
const MAX_BODY_BYTES = 20 * 1024 * 1024;
/** Requests from this computer. Everything else comes from a TV or phone on the network. */
const LOOPBACK_ADDRESSES = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);
/** A TV that has not asked for data for this long no longer counts as connected. */
const SCREEN_SEEN_MS = 15000;
/** State a TV screen needs to show the projector. Incidents and control settings stay private. */
const SCREEN_KEY_PREFIXES = ['wcif', 'stage', 'results', 'announcements', 'projector', 'calls'];
const SCREEN_SHARED_KEYS = ['wca-records'];
/** Network adapters of virtual machines, WSL and Docker. TVs cannot reach them, so they go last. */
const VIRTUAL_ADAPTER = /vethernet|virtualbox|vmware|hyper-v|docker|wsl|^veth|^br-|^virbr|^lo/i;

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

function isLocalRequest(req) {
  return LOOPBACK_ADDRESSES.has(req.socket.remoteAddress ?? '');
}

/** The IPv4 addresses of this computer on its networks, likely Wi-Fi or Ethernet first. */
function networkAddresses() {
  const list = [];
  for (const [name, infos] of Object.entries(os.networkInterfaces())) {
    for (const info of infos ?? []) {
      const isIpv4 = info.family === 'IPv4' || info.family === 4;
      // 169.254.x.x means the adapter got no address from a router.
      if (!isIpv4 || info.internal || info.address.startsWith('169.254.')) continue;
      list.push({ name, address: info.address, virtual: VIRTUAL_ADAPTER.test(name) });
    }
  }
  return list.sort((a, b) => Number(a.virtual) - Number(b.virtual));
}

/** The IPv4 form of an address, so "::ffff:192.168.1.5" shows as "192.168.1.5". */
function plainAddress(address) {
  return address.startsWith('::ffff:') ? address.slice('::ffff:'.length) : address;
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

/** Saved competitions as [{ id, name }], for the TV start page. */
async function savedCompetitions(stateDir) {
  let files = [];
  try {
    files = await readdir(stateDir);
  } catch {
    return [];
  }
  const list = [];
  for (const file of files) {
    if (!file.startsWith('wcif~') || !file.endsWith('.json')) continue;
    try {
      const wcif = JSON.parse(await readFile(path.join(stateDir, file), 'utf8'));
      list.push({ id: wcif.id, name: wcif.name });
    } catch {
      // Skip unreadable files.
    }
  }
  return list.sort((a, b) => a.name.localeCompare(b.name));
}

async function readJsonFile(filePath, fallback) {
  try {
    return JSON.parse(await readFile(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}

/**
 * The projector state of one competition.
 * `have` holds the versions the TV already has. Only changed values are sent, because the WCIF can be large.
 */
async function screenState(stateDir, competitionId, have) {
  const keys = [...SCREEN_KEY_PREFIXES.map((prefix) => `${prefix}:${competitionId}`), ...SCREEN_SHARED_KEYS];
  const versions = {};
  const values = {};
  for (const key of keys) {
    const filePath = path.join(stateDir, keyToFile(key));
    let version;
    try {
      version = (await stat(filePath)).mtimeMs;
    } catch {
      continue;
    }
    versions[key] = version;
    if (have[key] === version) continue;
    const value = await readJsonFile(filePath, undefined);
    if (value !== undefined) values[key] = value;
  }
  return { versions, values };
}

/**
 * Returns a request handler. It resolves to true when the request was an /api/ request.
 * Routes:
 *   GET /api/state                      all saved state as { key: value }
 *   PUT /api/state/:key                 save one state value (JSON body)
 *   PUT /api/reports/:competition/:file save a report (.csv, .md or .pdf)
 *   GET /api/network                    addresses for TV screens and the screens connected now
 * Routes for TV screens on the network (read only):
 *   GET /api/screens                    saved competitions and the control screen language
 *   GET /api/screen/:competition?have=  projector state of one competition
 * Requests from other devices get only the TV routes. They can never change anything.
 * `lan` says whether the server listens on the network at all.
 */
export function createApi({ dataDir, reportsDir, lan }) {
  const stateDir = path.join(dataDir, 'state');
  /** TV screens by address: { competitionId, seenAt }. */
  const screens = new Map();

  return async function handleApi(req, res) {
    const url = new URL(req.url ?? '/', 'http://localhost');
    if (!url.pathname.startsWith('/api/')) return false;

    const parts = url.pathname.split('/').slice(2).map(decodeURIComponent);
    try {
      if (req.method === 'GET' && parts.length === 1 && parts[0] === 'screens') {
        const ui = await readJsonFile(path.join(stateDir, keyToFile('ui-settings')), {});
        sendJson(res, 200, { competitions: await savedCompetitions(stateDir), language: ui.language ?? null });
        return true;
      }

      if (req.method === 'GET' && parts.length === 2 && parts[0] === 'screen') {
        const competitionId = parts[1];
        if (!COMPETITION_PATTERN.test(competitionId)) {
          sendJson(res, 400, { error: 'Invalid competition' });
          return true;
        }
        if (!isLocalRequest(req)) {
          screens.set(plainAddress(req.socket.remoteAddress ?? '?'), { competitionId, seenAt: Date.now() });
        }
        let have = {};
        try {
          have = JSON.parse(url.searchParams.get('have') ?? '{}');
        } catch {
          // A bad "have" only means everything is sent again.
        }
        sendJson(res, 200, await screenState(stateDir, competitionId, have));
        return true;
      }

      if (!isLocalRequest(req)) {
        sendJson(res, 403, { error: 'Only the computer that runs WCA Stage can do this' });
        return true;
      }

      if (req.method === 'GET' && parts.length === 1 && parts[0] === 'network') {
        const now = Date.now();
        const connected = [];
        for (const [address, screen] of screens) {
          if (now - screen.seenAt > SCREEN_SEEN_MS) screens.delete(address);
          else connected.push({ address, competitionId: screen.competitionId, seenAt: screen.seenAt });
        }
        sendJson(res, 200, {
          lan: Boolean(lan),
          port: req.socket.localPort,
          addresses: networkAddresses(),
          screens: connected,
          platform: process.platform,
        });
        return true;
      }

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
