import { useCallback, useEffect, useRef, useState } from 'react';
import type { RecordsResponse } from '../api/wca';
import type { Language } from '../i18n';
import { DEFAULT_COUNTDOWN_MINUTES } from '../model/competition';
import type { LogEntry } from '../model/scheduleEngine';
import type { Wcif } from '../types/wcif';
import { mirrorToServer } from './server';

export const storageKeys = {
  wcif: (competitionId: string) => `wcif:${competitionId}`,
  stage: (competitionId: string) => `stage:${competitionId}`,
  results: (competitionId: string) => `results:${competitionId}`,
  incidents: (competitionId: string) => `incidents:${competitionId}`,
  announcements: (competitionId: string) => `announcements:${competitionId}`,
  projector: (competitionId: string) => `projector:${competitionId}`,
  calls: (competitionId: string) => `calls:${competitionId}`,
  noise: (competitionId: string) => `noise:${competitionId}`,
  records: 'wca-records',
  uiSettings: 'ui-settings',
};

/** Options of this device's control screen. */
export interface UiSettings {
  language: Language;
  /** How many people to show as "just missed" the next round. */
  justMissedCount: number;
}

export const DEFAULT_UI_SETTINGS: UiSettings = { language: 'en', justMissedCount: 5 };

export type TimeBarLabel = 'left' | 'elapsed' | 'none';
export type NoiseSensitivity = 'low' | 'medium' | 'high';

/** Projector options set from the control screen. */
export interface ProjectorSettings {
  timeBar: boolean;
  timeBarLabel: TimeBarLabel;
  language: Language;
  bannerSeconds: number;
  resultsPageSeconds: number;
  /** A call shows for this long, then the normal screen shows for this long. */
  callSeconds: number;
  /** Listens to the projector PC microphone and asks for quiet when the room gets loud. */
  noiseMeter: boolean;
  noiseSensitivity: NoiseSensitivity;
  /** Length of the countdown slot before the first activity of each day. */
  countdownMinutes: number;
  /** Dark background, confetti and fireworks on the countdown and the finale. Off gives a plain look. */
  festive: boolean;
}

export const DEFAULT_PROJECTOR_SETTINGS: ProjectorSettings = {
  timeBar: true,
  timeBarLabel: 'left',
  language: 'en',
  bannerSeconds: 8,
  resultsPageSeconds: 10,
  callSeconds: 4,
  noiseMeter: false,
  noiseSensitivity: 'medium',
  countdownMinutes: DEFAULT_COUNTDOWN_MINUTES,
  festive: false,
};

/** Live noise level written by the projector, shown in Options. Not saved to the data folder. */
export interface NoiseStatus {
  level: number;
  average: number | null;
  alert: boolean;
  /** The browser holds the audio until someone clicks the projector window. */
  blocked: boolean;
  updatedAt: number;
}

export type CallRole = 'judges' | 'scramblers' | 'runners';
/** "delegates" is the Specify call: people asked to contact the Delegates. */
export type NamedCallRole = CallRole | 'delegates';

/** Calls for help shown on the projector. */
export interface CallState {
  general: CallRole[];
  named: Partial<Record<NamedCallRole, number[]>>;
}

export const EMPTY_CALLS: CallState = { general: [], named: {} };

export function hasActiveCall(calls: CallState): boolean {
  return calls.general.length > 0 || Object.values(calls.named).some((ids) => ids && ids.length > 0);
}

export interface RecordInfo {
  /** WCA Live tag: WR, NR, or a continental tag such as ER. */
  tag: string;
  name: string;
  countryIso2: string | null;
  eventId: string;
  type: 'single' | 'average';
  result: number;
}

/**
 * Message for the projector banner.
 * Templates and records have no fixed text: they are translated to the projector language when shown.
 */
export interface Announcement {
  id: string;
  text: string;
  active: boolean;
  /** Missing means "custom". */
  kind?: 'custom' | 'template' | 'record';
  /** i18n key of a template, e.g. "templates.quiet". */
  templateKey?: string;
  record?: RecordInfo;
}

/** Shared between the control and projector windows. */
export interface StageState {
  roomId: number | null;
  log: LogEntry[];
  /** Set by "Stop for today". Cleared by the next "Proceed now". Missing in older saved state. */
  stoppedAt?: number | null;
}

export const EMPTY_STAGE: StageState = { roomId: null, log: [], stoppedAt: null };

export function readJson<T>(key: string, fallback: T): T {
  const raw = localStorage.getItem(key);
  if (raw === null) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/** Keys saved to the data folder. The WCA login token is deliberately not one of them. */
export function isAppKey(key: string): boolean {
  return (
    /^(wcif|stage|results|incidents|announcements|projector|calls):/.test(key) ||
    key === storageKeys.records ||
    key === storageKeys.uiSettings
  );
}

export function writeJson(key: string, value: unknown): void {
  const json = JSON.stringify(value);
  try {
    localStorage.setItem(key, json);
  } catch (error) {
    console.error(`Could not save "${key}" to localStorage`, error);
  }
  if (isAppKey(key)) mirrorToServer(key, json);
}

/**
 * State persisted in localStorage.
 * Other windows of the app receive changes through the "storage" event,
 * which keeps the control and projector windows in sync.
 */
export function useSyncedStorage<T>(key: string, fallback: T): [T, (update: T | ((prev: T) => T)) => void] {
  const fallbackRef = useRef(fallback);
  const [value, setValue] = useState<T>(() => readJson(key, fallback));

  useEffect(() => {
    setValue(readJson(key, fallbackRef.current));

    function onStorage(event: StorageEvent) {
      if (event.key === key) setValue(readJson(key, fallbackRef.current));
    }
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [key]);

  const update = useCallback(
    (next: T | ((prev: T) => T)) => {
      setValue((prev) => {
        const resolved = typeof next === 'function' ? (next as (prev: T) => T)(prev) : next;
        writeJson(key, resolved);
        return resolved;
      });
    },
    [key],
  );

  return [value, update];
}

export interface CachedCompetition {
  id: string;
  name: string;
}

/** Competitions whose WCIF is already saved, for offline use. */
export function cachedCompetitions(): CachedCompetition[] {
  const list: CachedCompetition[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key?.startsWith('wcif:')) continue;
    const wcif = readJson<Wcif | null>(key, null);
    if (wcif) list.push({ id: wcif.id, name: wcif.name });
  }
  return list.sort((a, b) => a.name.localeCompare(b.name));
}

export function saveCompetition(wcif: Wcif, records: RecordsResponse): void {
  writeJson(storageKeys.wcif(wcif.id), wcif);
  writeJson(storageKeys.records, records);
}
