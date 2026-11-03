// Assembles the portable folder in release/WCA-Stage from dist/, server/ and portable/.
// Run after `vite build`:  node scripts/build-portable.mjs [--no-node]

import { execFileSync } from 'node:child_process';
import { chmod, cp, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'release', 'WCA-Stage');
const CACHE = path.join(ROOT, '.cache', 'node');
const NODE_VERSION = process.version;
const bundleNode = !process.argv.includes('--no-node');

async function exists(filePath) {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

async function download(url, target) {
  if (await exists(target)) return;
  console.log(`Downloading ${url}`);
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Download failed: ${response.status} ${url}`);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, Buffer.from(await response.arrayBuffer()));
}

/** Copies a text file with fixed line endings. Shell scripts break with Windows line endings. */
async function copyText(source, target, lineEnding) {
  const text = (await readFile(source, 'utf8')).replace(/\r?\n/g, lineEnding);
  await writeFile(target, text);
}

async function addWindowsNode() {
  const cached = path.join(CACHE, NODE_VERSION, 'node.exe');
  await download(`https://nodejs.org/dist/${NODE_VERSION}/win-x64/node.exe`, cached);
  await mkdir(path.join(OUT, 'node', 'win'), { recursive: true });
  await cp(cached, path.join(OUT, 'node', 'win', 'node.exe'));
}

async function addLinuxNode() {
  const name = `node-${NODE_VERSION}-linux-x64`;
  const archive = path.join(CACHE, NODE_VERSION, `${name}.tar.gz`);
  await download(`https://nodejs.org/dist/${NODE_VERSION}/${name}.tar.gz`, archive);

  const extractDir = path.join(CACHE, NODE_VERSION, 'linux');
  if (!(await exists(path.join(extractDir, name, 'bin', 'node')))) {
    await mkdir(extractDir, { recursive: true });
    // tar ships with Windows 10+ and every Linux distribution.
    execFileSync('tar', ['-xzf', archive, '-C', extractDir, `${name}/bin/node`], { stdio: 'inherit' });
  }
  await mkdir(path.join(OUT, 'node', 'linux', 'bin'), { recursive: true });
  const target = path.join(OUT, 'node', 'linux', 'bin', 'node');
  await cp(path.join(extractDir, name, 'bin', 'node'), target);
  await chmod(target, 0o755);
}

if (!(await exists(path.join(ROOT, 'dist', 'index.html')))) {
  throw new Error('dist/ is missing. Run `npm run build` first.');
}

// Keep data/ and reports/ of an existing release; replace everything else.
for (const entry of ['app', 'server', 'node', 'start.bat', 'start.sh', 'README.txt']) {
  await rm(path.join(OUT, entry), { recursive: true, force: true });
}
await mkdir(OUT, { recursive: true });

await cp(path.join(ROOT, 'dist'), path.join(OUT, 'app'), { recursive: true });
await mkdir(path.join(OUT, 'server'), { recursive: true });
await cp(path.join(ROOT, 'server', 'server.mjs'), path.join(OUT, 'server', 'server.mjs'));
await cp(path.join(ROOT, 'server', 'api.mjs'), path.join(OUT, 'server', 'api.mjs'));
await copyText(path.join(ROOT, 'portable', 'start.bat'), path.join(OUT, 'start.bat'), '\r\n');
await copyText(path.join(ROOT, 'portable', 'start.sh'), path.join(OUT, 'start.sh'), '\n');
await copyText(path.join(ROOT, 'portable', 'README.txt'), path.join(OUT, 'README.txt'), '\r\n');
await chmod(path.join(OUT, 'start.sh'), 0o755);
await mkdir(path.join(OUT, 'data'), { recursive: true });
await mkdir(path.join(OUT, 'reports'), { recursive: true });

if (bundleNode) {
  await addWindowsNode();
  await addLinuxNode();
}

console.log(`Portable app ready: ${OUT}`);
