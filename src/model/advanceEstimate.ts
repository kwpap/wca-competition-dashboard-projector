import type { ResultsCache } from '../api/results';
import { roundCode } from './activityCode';
import { MAX_ADVANCING_FRACTION, roundStandings } from './advancement';
import type { CompetitionModel } from './competition';
import { personalBest } from './people';

/** Everyone is assumed to do 2% better than their recorded result. */
const IMPROVEMENT = 0.98;

export interface AdvanceEstimate {
  /** In WCA result units (centiseconds, or moves for fewest moves). */
  value: number;
  type: 'single' | 'average';
}

/**
 * Rough result needed to reach the next round.
 * Recorded results improve by 2%, newcomers are spread evenly among them,
 * and the estimate is the result of the last person who advances.
 * Round 1 uses personal bests. Later rounds use the first-round results of the people who reached them.
 */
export function estimateAdvanceResult(
  model: CompetitionModel,
  results: ResultsCache | null,
  eventId: string,
  roundNumber: number,
): AdvanceEstimate | null {
  if (eventId === '333mbf') return null;
  const round = model.rounds.get(roundCode(eventId, roundNumber));
  const condition = round?.advancementCondition;
  if (!round || !condition) return null;

  const type = round.format === 'a' || round.format === 'm' ? 'average' : 'single';
  if (condition.type === 'attemptResult') return { value: condition.level, type };

  const times: number[] = [];
  let newcomers = 0;
  if (roundNumber === 1) {
    for (const person of model.persons.values()) {
      const registration = person.registration;
      if (registration?.status !== 'accepted' || !registration.eventIds.includes(eventId)) continue;
      const best = personalBest(person, eventId, type);
      if (best !== null && best > 0) times.push(best);
      else newcomers++;
    }
  } else {
    const firstRound = results?.rounds.find((r) => r.roundCode === roundCode(eventId, 1));
    const firstResults = new Map((firstRound?.rows ?? []).map((row) => [row.registrantId, row]));
    for (const { row, status } of roundStandings(model, results, roundCode(eventId, roundNumber - 1), 0)) {
      if (status !== 'advanced') continue;
      const first = firstResults.get(row.registrantId);
      const result = first ? (type === 'average' ? first.average : first.best) : 0;
      if (result > 0) times.push(result);
      else newcomers++;
    }
  }
  if (times.length === 0) return null;

  const total = times.length + newcomers;
  const byRule = condition.type === 'ranking' ? condition.level : Math.floor((total * condition.level) / 100);
  const advancing = Math.min(byRule, Math.floor(total * MAX_ADVANCING_FRACTION));
  if (advancing < 1) return null;

  // With newcomers spread evenly, place number `advancing` falls on this recorded result.
  times.sort((a, b) => a - b);
  const index = Math.min(times.length, Math.ceil((advancing * times.length) / total)) - 1;
  return { value: Math.round(times[index] * IMPROVEMENT), type };
}
