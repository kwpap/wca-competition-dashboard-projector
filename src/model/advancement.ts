import type { ResultRow, ResultsCache, RoundResults } from '../api/results';
import type { Round } from '../types/wcif';
import { roundCode } from './activityCode';
import type { CompetitionModel } from './competition';

export type StandingStatus = 'advanced' | 'justMissed' | 'out';

export interface Standing {
  row: ResultRow;
  status: StandingStatus;
}

/** WCA rule 9p1: at most 75% of competitors advance. */
export const MAX_ADVANCING_FRACTION = 0.75;

function hasValidResult(row: ResultRow): boolean {
  return row.best > 0;
}

/** The result used for ranking: the average for "average of 5" and "mean of 3" rounds, else the best single. */
function rankingResult(row: ResultRow, round: Round | undefined): number {
  const usesAverage = round?.format === 'a' || round?.format === 'm';
  return usesAverage ? row.average : row.best;
}

/** Works out who advances from the round's rule, for results that do not come from WCA Live. */
function advancedByRule(rows: ResultRow[], round: Round | undefined): Set<number> {
  const condition = round?.advancementCondition;
  const advanced = new Set<number>();
  if (!condition) return advanced;

  const maxCount = Math.floor(rows.length * MAX_ADVANCING_FRACTION);
  for (const row of rows) {
    if (!hasValidResult(row) || row.ranking === null || row.ranking > maxCount) continue;
    const result = rankingResult(row, round);
    let advances = false;
    if (condition.type === 'ranking') advances = row.ranking <= condition.level;
    if (condition.type === 'percent') advances = row.ranking <= Math.floor((rows.length * condition.level) / 100);
    if (condition.type === 'attemptResult') advances = result > 0 && result < condition.level;
    if (advances) advanced.add(row.registrantId);
  }
  return advanced;
}

function advancedIds(model: CompetitionModel, round: RoundResults, rows: ResultRow[]): Set<number> {
  const fromLive = rows.filter((row) => row.advancing).map((row) => row.registrantId);
  if (fromLive.length > 0) return new Set(fromLive);
  return advancedByRule(rows, model.rounds.get(round.roundCode));
}

/** The round before this one, or null for first rounds. */
export function previousRoundCode(eventId: string, roundNumber: number): string | null {
  return roundNumber > 1 ? roundCode(eventId, roundNumber - 1) : null;
}

/**
 * Ranked results of a round with who advanced.
 * The first `justMissedCount` people with a valid result who did not advance are marked "just missed".
 */
export function roundStandings(
  model: CompetitionModel,
  results: ResultsCache | null,
  code: string,
  justMissedCount: number,
): Standing[] {
  const round = results?.rounds.find((r) => r.roundCode === code);
  if (!round) return [];

  const rows = [...round.rows].sort((a, b) => (a.ranking ?? Infinity) - (b.ranking ?? Infinity));
  const advanced = advancedIds(model, round, rows);
  let missed = 0;
  return rows.map((row) => {
    if (advanced.has(row.registrantId)) return { row, status: 'advanced' };
    if (hasValidResult(row) && missed < justMissedCount) {
      missed++;
      return { row, status: 'justMissed' };
    }
    return { row, status: 'out' };
  });
}

/** The people who just missed advancing from a round. */
export function justMissed(
  model: CompetitionModel,
  results: ResultsCache | null,
  code: string,
  count: number,
): Standing[] {
  return roundStandings(model, results, code, count).filter((s) => s.status === 'justMissed');
}

/** The latest round of an event that has results and a following round. Used to find who just missed. */
export function latestAdvancingRound(model: CompetitionModel, results: ResultsCache | null, eventId: string): string | null {
  const roundCount = model.roundCounts.get(eventId) ?? 0;
  for (let number = roundCount - 1; number >= 1; number--) {
    const code = roundCode(eventId, number);
    if (results?.rounds.some((r) => r.roundCode === code && r.rows.length > 0)) return code;
  }
  return null;
}
