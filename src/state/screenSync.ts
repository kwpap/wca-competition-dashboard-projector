// TV screens: a TV or phone on the same Wi-Fi opens the projector from the computer that runs WCA Stage.
// It cannot share localStorage with the control window, so it fetches the saved state from the local server.
// A TV screen only reads. The server refuses writes from other devices anyway.

import { isAppKey, SCREEN_SYNC_EVENT } from './storage';

/** How often a TV screen asks for changes. The control window saves 500 ms after a change. */
export const SCREEN_POLL_MS = 1500;

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);

export interface ScreenCompetition {
  id: string;
  name: string;
}

export interface ScreenList {
  competitions: ScreenCompetition[];
  language: string | null;
}

let screenMode = false;

/** True when this browser runs on another device and shows the projector over the network. */
export function isScreenMode(): boolean {
  return screenMode;
}

/**
 * Decides at startup whether this browser is a TV screen.
 * Only a page opened by network address, served by the WCA Stage server, is one.
 * A static web host has no /api/screens, so it keeps the normal app.
 */
export async function detectScreenMode(): Promise<boolean> {
  if (LOCAL_HOSTS.has(location.hostname)) return false;
  try {
    const response = await fetch('/api/screens');
    screenMode = response.ok;
  } catch {
    screenMode = false;
  }
  if (screenMode) clearAppKeys();
  return screenMode;
}

/** A TV keeps no state of its own. Old copies of other competitions would only fill its storage. */
function clearAppKeys(): void {
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && isAppKey(key)) keys.push(key);
  }
  for (const key of keys) localStorage.removeItem(key);
}

export async function fetchScreenList(): Promise<ScreenList> {
  const response = await fetch('/api/screens');
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return (await response.json()) as ScreenList;
}

interface ScreenState {
  versions: Record<string, number>;
  values: Record<string, unknown>;
}

/**
 * Keeps localStorage of this TV in step with the server, for one competition.
 * Calls `onStatus(true)` after each good fetch and `onStatus(false)` after a failed one.
 * Returns a function that stops it.
 */
export function startScreenSync(competitionId: string, onStatus: (ok: boolean) => void): () => void {
  let stopped = false;
  let timer: number | undefined;
  let versions: Record<string, number> = {};

  async function poll() {
    try {
      const have = encodeURIComponent(JSON.stringify(versions));
      const response = await fetch(`/api/screen/${encodeURIComponent(competitionId)}?have=${have}`, {
        cache: 'no-store',
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const state = (await response.json()) as ScreenState;
      if (stopped) return;
      for (const [key, value] of Object.entries(state.values)) {
        try {
          localStorage.setItem(key, JSON.stringify(value));
        } catch (error) {
          console.error(`Could not keep "${key}" on this screen`, error);
        }
        window.dispatchEvent(new CustomEvent(SCREEN_SYNC_EVENT, { detail: key }));
      }
      versions = state.versions;
      onStatus(true);
    } catch {
      if (!stopped) onStatus(false);
    }
    if (!stopped) timer = window.setTimeout(poll, SCREEN_POLL_MS);
  }

  void poll();
  return () => {
    stopped = true;
    clearTimeout(timer);
  };
}
