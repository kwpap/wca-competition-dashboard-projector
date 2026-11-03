import type { ResultRow, ResultsCache, RoundResults } from '../api/results';
import type { RecordInfo } from '../state/storage';
import { roundCode } from './activityCode';
import { collectRecords } from './announcements';
import type { CompetitionModel } from './competition';

export interface PodiumPerson {
  registrantId: number;
  name: string;
  countryIso2: string | null;
  result: number;
  /** WR, NR, a continental tag or PR, when the podium result set one. */
  tag: string | null;
}

export interface PodiumPlace {
  place: 1 | 2 | 3;
  /** More than one person on ties. */
  people: PodiumPerson[];
}

export interface Podium {
  eventId: string;
  type: 'single' | 'average';
  places: PodiumPlace[];
}

export interface FinaleStats {
  competitors: number;
  countries: number;
  newcomers: number;
  events: number;
  rounds: number;
  solves: number;
  dnfs: number;
  solvingHours: number;
  personalRecords: number;
  records: number;
}

export interface Highlight {
  kind: 'fastestSingle' | 'bestAverage' | 'bestNewcomer' | 'mostPersonalRecords';
  name: string;
  eventId: string;
  type: 'single' | 'average';
  /** A result, or a count for "most personal records". */
  value: number;
}

export interface Thanks {
  organizers: string[];
  delegates: string[];
  volunteers: number;
}

export interface Finale {
  podiums: Podium[];
  /** World records first, then continental, then national. */
  records: RecordInfo[];
  stats: FinaleStats;
  highlights: Highlight[];
  thanks: Thanks;
}

/** Events whose attempts are not times, so they do not count as solving time. */
const UNTIMED_EVENTS = new Set(['333fm', '333mbf', '333mbo']);
const HIGHLIGHT_EVENT = '333';
const MIN_PERSONAL_RECORDS = 2;
const CENTISECONDS_PER_HOUR = 360_000;

function recordRank(tag: string): number {
  if (tag === 'WR') return 0;
  if (tag === 'NR') return 2;
  return 1;
}

function usesAverage(model: CompetitionModel, round: RoundResults): boolean {
  const format = model.rounds.get(round.roundCode)?.format;
  return format === 'a' || format === 'm';
}

function podiumFor(model: CompetitionModel, round: RoundResults): Podium | null {
  const type = usesAverage(model, round) ? 'average' : 'single';
  const places: PodiumPlace[] = [];
  for (const place of [1, 2, 3] as const) {
    const people = round.rows
      .filter((row) => row.ranking === place && row.best > 0)
      .map((row) => ({
        registrantId: row.registrantId,
        name: row.name,
        countryIso2: model.persons.get(row.registrantId)?.countryIso2 ?? null,
        result: type === 'average' ? row.average : row.best,
        tag: type === 'average' ? row.averageTag : row.singleTag,
      }));
    if (people.length > 0) places.push({ place, people });
  }
  if (places.length === 0) return null;
  return { eventId: round.eventId, type, places };
}

/** Podiums of finished finals, in schedule order. */
function podiums(model: CompetitionModel, results: ResultsCache | null): Podium[] {
  const finals: RoundResults[] = [];
  for (const event of model.wcif.events) {
    const code = roundCode(event.id, event.rounds.length);
    const final = results?.rounds.find((r) => r.roundCode === code);
    if (final && final.rows.length > 0) finals.push(final);
  }
  finals.sort((a, b) => (model.roundStarts.get(a.roundCode) ?? 0) - (model.roundStarts.get(b.roundCode) ?? 0));
  return finals.map((round) => podiumFor(model, round)).filter((p): p is Podium => p !== null);
}

function countPersonalRecords(row: ResultRow): number {
  return (row.singleTag === 'PR' ? 1 : 0) + (row.averageTag === 'PR' ? 1 : 0);
}

function stats(model: CompetitionModel, results: ResultsCache | null, recordCount: number): FinaleStats {
  const rounds = (results?.rounds ?? []).filter((r) => r.rows.length > 0);
  const competitorIds = new Set<number>();
  const eventIds = new Set<string>();
  let solves = 0;
  let dnfs = 0;
  let centiseconds = 0;
  let personalRecords = 0;

  for (const round of rounds) {
    eventIds.add(round.eventId);
    const timed = !UNTIMED_EVENTS.has(round.eventId);
    for (const row of round.rows) {
      competitorIds.add(row.registrantId);
      personalRecords += countPersonalRecords(row);
      for (const attempt of row.attempts) {
        if (attempt > 0) solves++;
        if (attempt === -1) dnfs++;
        if (attempt > 0 && timed) centiseconds += attempt;
      }
    }
  }

  // Before any results exist, count the accepted registrations instead.
  if (competitorIds.size === 0) {
    for (const person of model.persons.values()) {
      if (person.registration?.status === 'accepted') competitorIds.add(person.registrantId!);
    }
  }

  const competitors = [...competitorIds].map((id) => model.persons.get(id)).filter((p) => p !== undefined);
  return {
    competitors: competitorIds.size,
    countries: new Set(competitors.map((p) => p.countryIso2)).size,
    newcomers: competitors.filter((p) => !p.wcaId).length,
    events: eventIds.size || model.wcif.events.length,
    rounds: rounds.length,
    solves,
    dnfs,
    solvingHours: centiseconds / CENTISECONDS_PER_HOUR,
    personalRecords,
    records: recordCount,
  };
}

/** The row with the lowest valid value, or null. */
function bestRow(rows: ResultRow[], value: (row: ResultRow) => number): ResultRow | null {
  let best: ResultRow | null = null;
  for (const row of rows) {
    if (value(row) <= 0) continue;
    if (!best || value(row) < value(best)) best = row;
  }
  return best;
}

function highlights(model: CompetitionModel, results: ResultsCache | null): Highlight[] {
  const list: Highlight[] = [];
  const rows = (results?.rounds ?? []).filter((r) => r.eventId === HIGHLIGHT_EVENT).flatMap((r) => r.rows);

  const single = bestRow(rows, (r) => r.best);
  if (single) {
    list.push({ kind: 'fastestSingle', name: single.name, eventId: HIGHLIGHT_EVENT, type: 'single', value: single.best });
  }
  const average = bestRow(rows, (r) => r.average);
  if (average) {
    list.push({ kind: 'bestAverage', name: average.name, eventId: HIGHLIGHT_EVENT, type: 'average', value: average.average });
  }

  const newcomerRows = rows.filter((r) => !model.persons.get(r.registrantId)?.wcaId);
  const newcomerAverage = bestRow(newcomerRows, (r) => r.average);
  const newcomerSingle = bestRow(newcomerRows, (r) => r.best);
  if (newcomerAverage) {
    list.push({
      kind: 'bestNewcomer',
      name: newcomerAverage.name,
      eventId: HIGHLIGHT_EVENT,
      type: 'average',
      value: newcomerAverage.average,
    });
  } else if (newcomerSingle) {
    list.push({ kind: 'bestNewcomer', name: newcomerSingle.name, eventId: HIGHLIGHT_EVENT, type: 'single', value: newcomerSingle.best });
  }

  const counts = new Map<number, { name: string; count: number }>();
  for (const round of results?.rounds ?? []) {
    for (const row of round.rows) {
      const count = countPersonalRecords(row);
      if (count === 0) continue;
      const entry = counts.get(row.registrantId) ?? { name: row.name, count: 0 };
      entry.count += count;
      counts.set(row.registrantId, entry);
    }
  }
  let top: { name: string; count: number } | null = null;
  for (const entry of counts.values()) {
    if (!top || entry.count > top.count) top = entry;
  }
  if (top && top.count >= MIN_PERSONAL_RECORDS) {
    list.push({ kind: 'mostPersonalRecords', name: top.name, eventId: '', type: 'single', value: top.count });
  }
  return list;
}

function thanks(model: CompetitionModel): Thanks {
  const people = [...model.persons.values()];
  const withRole = (roles: string[]) =>
    people
      .filter((p) => p.roles?.some((role) => roles.includes(role)))
      .map((p) => p.name)
      .sort((a, b) => a.localeCompare(b));
  const volunteers = people.filter((p) => p.assignments.some((a) => a.assignmentCode.startsWith('staff-'))).length;
  return {
    organizers: withRole(['organizer']),
    delegates: withRole(['delegate', 'trainee-delegate']),
    volunteers,
  };
}

/** A person who broke the same record twice is celebrated once, with the higher record and then the better result. */
function bestRecords(records: RecordInfo[]): RecordInfo[] {
  const best = new Map<string, RecordInfo>();
  for (const record of records) {
    const key = `${record.name}|${record.eventId}|${record.type}`;
    const kept = best.get(key);
    const higher = kept && recordRank(record.tag) < recordRank(kept.tag);
    const better = kept && recordRank(record.tag) === recordRank(kept.tag) && record.result < kept.result;
    if (!kept || higher || better) best.set(key, record);
  }
  return [...best.values()];
}

/** Everything the closing screen celebrates. */
export function buildFinale(model: CompetitionModel, results: ResultsCache | null): Finale {
  const allRecords = collectRecords(model, results).map(({ record }) => record);
  const records = bestRecords(allRecords).sort((a, b) => recordRank(a.tag) - recordRank(b.tag));
  return {
    podiums: podiums(model, results),
    records,
    stats: stats(model, results, allRecords.length),
    highlights: highlights(model, results),
    thanks: thanks(model),
  };
}
