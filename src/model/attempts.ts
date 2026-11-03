import type { RoundFormat } from '../types/wcif';
import { roundCode } from './activityCode';
import type { CompetitionModel, Slot } from './competition';

const ATTEMPTS: Record<RoundFormat, number> = { '1': 1, '2': 2, '3': 3, '5': 5, m: 3, a: 5 };

/** Number of attempts in a round of this format. */
export function attemptCount(format: RoundFormat): number {
  return ATTEMPTS[format];
}

/** Events where a group is one long attempt, so splitting the time bar makes no sense. */
const NO_SEGMENTS = new Set(['333fm', '333mbf']);

/** Time bar parts for a group: one per attempt plus one. Undefined for non-solving activities. */
export function attemptSegments(model: CompetitionModel, slot: Slot): number | undefined {
  if (!slot.eventId || !slot.roundNumber || NO_SEGMENTS.has(slot.eventId)) return undefined;
  const round = model.rounds.get(roundCode(slot.eventId, slot.roundNumber));
  return round ? ATTEMPTS[round.format] + 1 : undefined;
}
