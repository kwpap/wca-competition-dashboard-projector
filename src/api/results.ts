import { WCA_LIVE_API } from '../config';
import type { Wcif } from '../types/wcif';

export interface ResultRow {
  registrantId: number;
  name: string;
  ranking: number | null;
  best: number;
  average: number;
  singleTag: string | null;
  averageTag: string | null;
  attempts: number[];
  /** Set by WCA Live. Missing for WCIF results, where advancement is worked out from the round rule. */
  advancing?: boolean;
}

export interface RoundResults {
  roundCode: string;
  eventId: string;
  roundNumber: number;
  entered: number;
  rows: ResultRow[];
}

export interface ResultsCache {
  source: 'live' | 'wcif';
  liveCompetitionId: string | null;
  rounds: RoundResults[];
  fetchedAt: number;
}

async function liveQuery<T>(query: string, variables: Record<string, unknown>): Promise<T> {
  const response = await fetch(WCA_LIVE_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  });
  if (!response.ok) throw new Error(`WCA Live ${response.status}`);
  const body = (await response.json()) as { data?: T; errors?: { message: string }[] };
  if (body.errors?.length) throw new Error(body.errors[0].message);
  return body.data as T;
}

/** WCA Live uses its own ids. Its search matches names, not WCA ids. */
async function findLiveCompetitionId(wcif: Wcif): Promise<string | null> {
  const query = `query ($filter: String) { competitions(filter: $filter, limit: 20) { id wcaId } }`;
  for (const filter of [wcif.name, wcif.shortName]) {
    const data = await liveQuery<{ competitions: { id: string; wcaId: string }[] }>(query, { filter });
    const match = data.competitions.find((c) => c.wcaId === wcif.id);
    if (match) return match.id;
  }
  return null;
}

interface LiveStructure {
  competition: {
    competitionEvents: {
      event: { id: string };
      rounds: { id: string; number: number; numEnteredResults: number; active: boolean }[];
    }[];
  };
}

interface LiveRound {
  round: {
    results: {
      ranking: number | null;
      best: number;
      average: number;
      singleRecordTag: string | null;
      averageRecordTag: string | null;
      advancing: boolean;
      attempts: { result: number }[];
      person: { name: string; registrantId: number };
    }[];
  };
}

const STRUCTURE_QUERY = `query ($id: ID!) {
  competition(id: $id) {
    competitionEvents { event { id } rounds { id number numEnteredResults active } }
  }
}`;

const ROUND_QUERY = `query ($id: ID!) {
  round(id: $id) {
    results {
      ranking best average singleRecordTag averageRecordTag advancing
      attempts { result }
      person { name registrantId }
    }
  }
}`;

function resultsFromWcif(wcif: Wcif): RoundResults[] {
  const names = new Map(wcif.persons.map((p) => [p.registrantId, p.name]));
  const rounds: RoundResults[] = [];
  for (const event of wcif.events) {
    event.rounds.forEach((round, index) => {
      if (round.results.length === 0) return;
      rounds.push({
        roundCode: round.id,
        eventId: event.id,
        roundNumber: index + 1,
        entered: round.results.length,
        rows: round.results.map((r) => ({
          registrantId: r.personId,
          name: names.get(r.personId) ?? `#${r.personId}`,
          ranking: r.ranking,
          best: r.best,
          average: r.average,
          singleTag: null,
          averageTag: null,
          attempts: r.attempts.map((a) => a.result),
        })),
      });
    });
  }
  return rounds;
}

/**
 * Loads results from WCA Live, falling back to WCIF results.
 * WCA Live rejects large queries, so each round is fetched separately.
 * Rounds are refetched only when their entered count changes or they are still active.
 */
export async function fetchResults(wcif: Wcif, previous: ResultsCache | null): Promise<ResultsCache> {
  const liveId = previous?.liveCompetitionId ?? (await findLiveCompetitionId(wcif));
  if (!liveId) {
    return { source: 'wcif', liveCompetitionId: null, rounds: resultsFromWcif(wcif), fetchedAt: Date.now() };
  }

  const structure = await liveQuery<LiveStructure>(STRUCTURE_QUERY, { id: liveId });
  const rounds: RoundResults[] = [];

  for (const competitionEvent of structure.competition.competitionEvents) {
    const eventId = competitionEvent.event.id;
    for (const round of competitionEvent.rounds) {
      if (round.numEnteredResults === 0) continue;

      const roundCode = `${eventId}-r${round.number}`;
      const old = previous?.rounds.find((r) => r.roundCode === roundCode);
      // Rounds cached by older versions lack "advancing", so fetch those again once.
      const oldIsComplete = old?.rows.every((r) => r.advancing !== undefined);
      if (old && oldIsComplete && old.entered === round.numEnteredResults && !round.active) {
        rounds.push(old);
        continue;
      }

      const data = await liveQuery<LiveRound>(ROUND_QUERY, { id: round.id });
      rounds.push({
        roundCode,
        eventId,
        roundNumber: round.number,
        entered: round.numEnteredResults,
        rows: data.round.results
          .filter((r) => r.attempts.length > 0)
          .map((r) => ({
            registrantId: r.person.registrantId,
            name: r.person.name,
            ranking: r.ranking,
            best: r.best,
            average: r.average,
            singleTag: r.singleRecordTag,
            averageTag: r.averageRecordTag,
            attempts: r.attempts.map((a) => a.result),
            advancing: r.advancing,
          })),
      });
    }
  }

  return { source: 'live', liveCompetitionId: liveId, rounds, fetchedAt: Date.now() };
}
