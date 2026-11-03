// Talks to the local server (server/api.mjs) when the app runs from the portable folder or `npm run dev`.
// Without the server (e.g. a static web host) the app keeps working on localStorage alone.

const MIRROR_DELAY_MS = 500;
const CONNECT_TIMEOUT_MS = 2000;

let available = false;
const pending = new Map<string, { timer: number; json: string }>();

export function isServerAvailable(): boolean {
  return available;
}

function putState(key: string, json: string, keepalive = false): void {
  fetch(`/api/state/${encodeURIComponent(key)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: json,
    keepalive,
  }).catch((error) => console.warn(`Could not save "${key}" to the data folder`, error));
}

/**
 * Loads state saved in the data folder into localStorage.
 * Saved values only fill missing keys: localStorage may hold newer values written by another open window.
 * Keys that exist only in localStorage are sent to the server.
 */
export async function connectToServer(isAppKey: (key: string) => boolean): Promise<void> {
  try {
    const response = await fetch('/api/state', { signal: AbortSignal.timeout(CONNECT_TIMEOUT_MS) });
    if (!response.ok) return;
    const saved = (await response.json()) as Record<string, unknown>;
    available = true;

    for (const [key, value] of Object.entries(saved)) {
      if (localStorage.getItem(key) === null) localStorage.setItem(key, JSON.stringify(value));
    }
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && isAppKey(key) && !(key in saved)) putState(key, localStorage.getItem(key)!);
    }
  } catch {
    available = false;
  }
}

/** Saves a state value to the data folder shortly after it changes. */
export function mirrorToServer(key: string, json: string): void {
  if (!available) return;
  const existing = pending.get(key);
  if (existing) clearTimeout(existing.timer);
  const timer = window.setTimeout(() => {
    pending.delete(key);
    putState(key, json);
  }, MIRROR_DELAY_MS);
  pending.set(key, { timer, json });
}

// Send unsaved changes when the window closes.
window.addEventListener('pagehide', () => {
  for (const [key, { timer, json }] of pending) {
    clearTimeout(timer);
    putState(key, json, true);
  }
  pending.clear();
});

export async function saveReport(competitionId: string, filename: string, content: string | Blob): Promise<boolean> {
  if (!available) return false;
  const contentType = content instanceof Blob ? content.type : 'text/plain; charset=utf-8';
  const response = await fetch(`/api/reports/${encodeURIComponent(competitionId)}/${encodeURIComponent(filename)}`, {
    method: 'PUT',
    headers: { 'Content-Type': contentType },
    body: content,
  });
  return response.ok;
}
