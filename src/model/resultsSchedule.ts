import { LOW_PRIORITY_EVERY, RESULTS_PRIORITY_MS } from '../config';

/** What the results carousel knows about one round. */
export interface RoundSummary {
  roundCode: string;
  pageCount: number;
  /** When a result of this round last changed while the screen was running. */
  lastChange: number | null;
  /** Page (from 0) holding the most recently changed row. */
  newestPage: number;
  /** Planned on the venue's current day. */
  today: boolean;
}

export interface PagePosition {
  roundCode: string;
  /** From 0. */
  page: number;
}

/** What the schedule remembers between page changes. */
export interface ScheduleMemory {
  lastWasHigh: boolean;
  normalPicks: number;
  /** When each round was last picked, so rounds of the same priority take turns. */
  shownAt: Map<string, number>;
  /** The latest change of each round that was already jumped to. */
  seenChange: Map<string, number>;
}

export function newScheduleMemory(): ScheduleMemory {
  return { lastWasHigh: false, normalPicks: 0, shownAt: new Map(), seenChange: new Map() };
}

function leastRecentlyShown(rounds: RoundSummary[], memory: ScheduleMemory): RoundSummary {
  let best = rounds[0];
  for (const round of rounds) {
    if ((memory.shownAt.get(round.roundCode) ?? 0) < (memory.shownAt.get(best.roundCode) ?? 0)) best = round;
  }
  return best;
}

/**
 * Picks the page after `current` and updates `memory`.
 * Priorities: new results (high), rounds of today (normal), rounds of other days (low).
 * `rounds` must be in schedule order.
 */
export function nextPage(
  rounds: RoundSummary[],
  current: PagePosition | null,
  memory: ScheduleMemory,
  now: number,
): PagePosition | null {
  if (rounds.length === 0) return null;

  function show(round: RoundSummary, page: number): PagePosition {
    memory.shownAt.set(round.roundCode, now);
    return { roundCode: round.roundCode, page };
  }

  // The first page of the carousel was not picked here, so record it as shown.
  if (current && !memory.shownAt.has(current.roundCode)) memory.shownAt.set(current.roundCode, now - 1);

  // New results that were not shown yet come first, opened at the page with the newest rows.
  let unseen: RoundSummary | null = null;
  for (const round of rounds) {
    if (round.lastChange === null || round.lastChange <= (memory.seenChange.get(round.roundCode) ?? 0)) continue;
    if (!unseen || round.lastChange > unseen.lastChange!) unseen = round;
  }
  if (unseen) {
    memory.seenChange.set(unseen.roundCode, unseen.lastChange!);
    // Counts as the high turn, so a normal round comes next.
    memory.lastWasHigh = true;
    return show(unseen, unseen.newestPage);
  }

  // Otherwise finish the round on screen.
  const currentRound = current ? rounds.find((r) => r.roundCode === current.roundCode) : undefined;
  if (current && currentRound && current.page + 1 < currentRound.pageCount) {
    return { roundCode: current.roundCode, page: current.page + 1 };
  }

  // Then the next round: high and normal take turns, and every few normal turns a low one.
  const high = rounds.filter((r) => r.lastChange !== null && now - r.lastChange < RESULTS_PRIORITY_MS);
  const normal = rounds.filter((r) => r.today && !high.includes(r));
  const low = rounds.filter((r) => !r.today && !high.includes(r));

  let pool: RoundSummary[];
  if (high.length > 0 && !memory.lastWasHigh) {
    memory.lastWasHigh = true;
    pool = high;
  } else {
    memory.lastWasHigh = false;
    memory.normalPicks++;
    const lowTurn = memory.normalPicks % LOW_PRIORITY_EVERY === 0;
    if (low.length > 0 && (lowTurn || normal.length === 0)) pool = low;
    else if (normal.length > 0) pool = normal;
    else pool = high;
  }
  return show(leastRecentlyShown(pool, memory), 0);
}
