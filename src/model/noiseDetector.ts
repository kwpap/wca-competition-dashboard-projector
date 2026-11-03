import type { NoiseSensitivity } from '../state/storage';

/** dB above the room average that counts as "too loud". */
export const SENSITIVITY_DB: Record<NoiseSensitivity, number> = { low: 10, medium: 7, high: 5 };

/** Short average: smooths out a dropped cube or a single shout. */
const SHORT_WINDOW_MS = 5000;
/** The room average is the median of one short average every 5 s over the last 10 minutes. */
const BASELINE_STEP_MS = 5000;
const BASELINE_SAMPLES = 120;
/** No alert before the room average is known. */
const WARMUP_MS = 2 * 60_000;
/** Loud for this long before the alert shows. */
const TRIGGER_MS = 5000;
const MIN_SHOW_MS = 10_000;
/** Quiet for this long before the alert hides. */
const QUIET_MS = 10_000;
const COOLDOWN_MS = 30_000;
/** The alert hides only well below the trigger level, so it does not flicker at the edge. */
const HIDE_MARGIN_DB = 3;

export interface NoiseDetector {
  startedAt: number;
  short: { at: number; db: number }[];
  baseline: number[];
  lastBaselineAt: number;
  alert: boolean;
  alertSince: number;
  loudSince: number | null;
  quietSince: number | null;
  cooldownUntil: number;
}

export interface NoiseReading {
  /** Short average, in dB of full scale (negative numbers; higher is louder). */
  level: number;
  /** Room average, or null during the warm-up. */
  average: number | null;
  alert: boolean;
}

export function createNoiseDetector(now: number): NoiseDetector {
  return {
    startedAt: now,
    short: [],
    baseline: [],
    lastBaselineAt: 0,
    alert: false,
    alertSince: 0,
    loudSince: null,
    quietSince: null,
    cooldownUntil: 0,
  };
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

/** Adds one microphone reading and updates the alert. Changes `detector`. */
export function feedNoise(detector: NoiseDetector, db: number, now: number, sensitivity: NoiseSensitivity): NoiseReading {
  const d = detector;
  d.short.push({ at: now, db });
  while (d.short.length > 0 && now - d.short[0].at > SHORT_WINDOW_MS) d.short.shift();
  const level = d.short.reduce((sum, s) => sum + s.db, 0) / d.short.length;

  // The average is frozen during an alert, so the noise itself does not raise it.
  if (!d.alert && now - d.lastBaselineAt >= BASELINE_STEP_MS) {
    d.baseline.push(level);
    if (d.baseline.length > BASELINE_SAMPLES) d.baseline.shift();
    d.lastBaselineAt = now;
  }

  const warm = now - d.startedAt >= WARMUP_MS && d.baseline.length > 0;
  const average = warm ? median(d.baseline) : null;
  if (average === null) return { level, average, alert: false };

  const limit = average + SENSITIVITY_DB[sensitivity];
  if (!d.alert) {
    if (now < d.cooldownUntil || level <= limit) {
      d.loudSince = null;
    } else {
      d.loudSince ??= now;
      if (now - d.loudSince >= TRIGGER_MS) {
        d.alert = true;
        d.alertSince = now;
        d.quietSince = null;
      }
    }
  } else if (level < limit - HIDE_MARGIN_DB) {
    d.quietSince ??= now;
    if (now - d.quietSince >= QUIET_MS && now - d.alertSince >= MIN_SHOW_MS) {
      d.alert = false;
      d.loudSince = null;
      d.cooldownUntil = now + COOLDOWN_MS;
    }
  } else {
    d.quietSince = null;
  }
  return { level, average, alert: d.alert };
}
