import type { TFunction } from 'i18next';

/** Translated WCA event name (from "events" in the language files). Unknown events show their id. */
export function eventName(t: TFunction, eventId: string, language?: string): string {
  return t(`events.${eventId}`, { defaultValue: eventId, lng: language });
}

export interface ParsedActivityCode {
  eventId: string | null;
  roundNumber: number | null;
  groupNumber: number | null;
  attemptNumber: number | null;
}

/** Parses codes like "333-r1-g2" or "333fm-r1-a1". "other-lunch" has no event. */
export function parseActivityCode(code: string): ParsedActivityCode {
  const parsed: ParsedActivityCode = {
    eventId: null,
    roundNumber: null,
    groupNumber: null,
    attemptNumber: null,
  };
  if (code.startsWith('other-')) return parsed;

  const [eventId, ...parts] = code.split('-');
  parsed.eventId = eventId;
  for (const part of parts) {
    const value = Number(part.slice(1));
    if (part.startsWith('r')) parsed.roundNumber = value;
    if (part.startsWith('g')) parsed.groupNumber = value;
    if (part.startsWith('a')) parsed.attemptNumber = value;
  }
  return parsed;
}

export function roundCode(eventId: string, roundNumber: number): string {
  return `${eventId}-r${roundNumber}`;
}
