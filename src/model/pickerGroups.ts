import type { ResultsCache } from '../api/results';
import type { Person } from '../types/wcif';
import { justMissed, latestAdvancingRound } from './advancement';
import type { CompetitionModel } from './competition';

export interface PickerGroups {
  justMissed: Person[];
  fast: Person[];
  rest: Person[];
}

/** Events ranked by single. All others are ranked by average. */
const SINGLE_RANKED_EVENTS = new Set(['333bf', '444bf', '555bf', '333mbf', '333mbo']);

/** Share of an event's competitors shown as "fast". */
const FAST_FRACTION = 1 / 3;

/** Sort key by personal best: people with the main ranking first, then single-only, then no result. */
function rankKey(person: Person, eventId: string): [number, number] {
  const primary = SINGLE_RANKED_EVENTS.has(eventId) ? 'single' : 'average';
  const bests = person.personalBests ?? [];
  const main = bests.find((pb) => pb.eventId === eventId && pb.type === primary);
  if (main) return [0, main.worldRanking];
  const single = bests.find((pb) => pb.eventId === eventId && pb.type === 'single');
  if (single) return [1, single.worldRanking];
  return [2, 0];
}

function byRank(eventId: string) {
  return (a: Person, b: Person) => {
    const [groupA, rankA] = rankKey(a, eventId);
    const [groupB, rankB] = rankKey(b, eventId);
    return groupA - groupB || rankA - rankB || a.name.localeCompare(b.name);
  };
}

/**
 * Splits people for one event into three columns:
 * those who just missed the latest round, the fastest third of the event's competitors, and everyone else.
 */
export function pickerGroups(
  model: CompetitionModel,
  results: ResultsCache | null,
  people: Person[],
  eventId: string,
  justMissedCount: number,
): PickerGroups {
  const round = latestAdvancingRound(model, results, eventId);
  const missedIds = round ? justMissed(model, results, round, justMissedCount).map((s) => s.row.registrantId) : [];
  const byId = new Map(people.map((p) => [p.registrantId, p]));
  const missed = missedIds.map((id) => byId.get(id)).filter((p): p is Person => p !== undefined);

  const others = people.filter((p) => !missedIds.includes(p.registrantId!));
  const isCompetitor = (p: Person) => p.registration?.eventIds.includes(eventId) ?? false;
  const competitors = others.filter(isCompetitor).sort(byRank(eventId));
  const nonCompetitors = others.filter((p) => !isCompetitor(p)).sort((a, b) => a.name.localeCompare(b.name));

  const fastCount = Math.ceil(competitors.length * FAST_FRACTION);
  return {
    justMissed: missed,
    fast: competitors.slice(0, fastCount),
    rest: [...competitors.slice(fastCount), ...nonCompetitors],
  };
}
