import type { TFunction } from 'i18next';
import { eventName, parseActivityCode } from '../model/activityCode';
import type { CompetitionModel } from '../model/competition';
import { activityLabel } from '../model/labels';
import type { IncidentRef } from './types';

export interface MentionCandidate {
  ref: IncidentRef;
  /** Lowercase words without accents, used for matching. */
  words: string[];
}

const MAX_MATCHES = 8;

/** Lowercases and strips accents, so "Παπαδόπουλος" matches "παπαδοπουλος" and "Józef" matches "jozef". */
export function fold(text: string): string {
  return text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
}

function toWords(text: string): string[] {
  return fold(text)
    .split(/[\s|()#]+/)
    .filter(Boolean);
}

export function personLabel(name: string, wcaId: string | null, registrantId: number): string {
  return `${name} | ${wcaId ?? `#${registrantId}`}`;
}

export function buildCandidates(t: TFunction, model: CompetitionModel): MentionCandidate[] {
  const candidates: MentionCandidate[] = [];

  for (const person of model.persons.values()) {
    const registrantId = person.registrantId!;
    candidates.push({
      ref: { type: 'person', registrantId, label: personLabel(person.name, person.wcaId, registrantId) },
      words: toWords(`${person.name} ${person.wcaId ?? ''} ${registrantId}`),
    });
  }

  const seenCodes = new Set<string>();
  function addActivity(activityCode: string, label: string) {
    if (seenCodes.has(activityCode)) return;
    seenCodes.add(activityCode);
    // The English event name is searchable too, so "@3x3 cube" also works in Greek.
    const eventId = parseActivityCode(activityCode).eventId;
    const englishName = eventId ? eventName(t, eventId, 'en') : '';
    candidates.push({
      ref: { type: 'activity', activityCode, label },
      words: toWords(`${label} ${activityCode} ${englishName}`),
    });
  }

  for (const event of model.wcif.events) {
    addActivity(event.id, eventName(t, event.id));
    for (const round of event.rounds) addActivity(round.id, activityLabel(t, model, round.id));
  }
  for (const room of model.rooms) {
    for (const slot of room.slots) {
      if (slot.groupNumber !== null) addActivity(slot.activityCode, activityLabel(t, model, slot.activityCode));
    }
  }

  return candidates;
}

/** Every query word must start one of the candidate's words. An exact registration ID match comes first. */
export function searchCandidates(
  candidates: MentionCandidate[],
  query: string,
  limit = MAX_MATCHES,
): MentionCandidate[] {
  const tokens = toWords(query);
  if (tokens.length === 0) return [];

  const exactId = tokens.length === 1 && /^\d+$/.test(tokens[0]) ? Number(tokens[0]) : null;

  const matches = candidates.filter((c) => tokens.every((token) => c.words.some((word) => word.startsWith(token))));
  matches.sort((a, b) => {
    const aExact = a.ref.type === 'person' && a.ref.registrantId === exactId ? 0 : 1;
    const bExact = b.ref.type === 'person' && b.ref.registrantId === exactId ? 0 : 1;
    return aExact - bExact;
  });
  return matches.slice(0, limit);
}
