import type { Activity, Person, Round, Wcif } from '../types/wcif';
import { dayKey } from '../format/time';
import { parseActivityCode } from './activityCode';

/** One step of a room's schedule: a group, or a top-level activity without groups (e.g. lunch). */
export interface Slot {
  id: number;
  /** Top-level schedule activity (the round). Equals id for activities without groups. */
  parentId: number;
  roomId: number;
  activityCode: string;
  name: string;
  eventId: string | null;
  roundNumber: number | null;
  groupNumber: number | null;
  plannedStart: number;
  plannedEnd: number;
  timezone: string;
}

export interface RoomInfo {
  id: number;
  name: string;
  venueName: string;
  timezone: string;
  slots: Slot[];
}

export interface CompetitionModel {
  wcif: Wcif;
  rooms: RoomInfo[];
  /** Every schedule activity by id: groups and their parent rounds. */
  activities: Map<number, Slot>;
  persons: Map<number, Person>;
  /** Rounds by round code, e.g. "333-r1". */
  rounds: Map<string, Round>;
  roundCounts: Map<string, number>;
  /** Planned start of the first activity of each round, by round code. */
  roundStarts: Map<string, number>;
  countryIso2: string;
  timezone: string;
}

function toSlot(activity: Activity, parentId: number, roomId: number, timezone: string): Slot {
  const code = parseActivityCode(activity.activityCode);
  return {
    id: activity.id,
    parentId,
    roomId,
    activityCode: activity.activityCode,
    name: activity.name,
    eventId: code.eventId,
    roundNumber: code.roundNumber,
    groupNumber: code.groupNumber,
    plannedStart: Date.parse(activity.startTime),
    plannedEnd: Date.parse(activity.endTime),
    timezone,
  };
}

/** Activity code of the celebration slot that the app adds after the last activity of every room. */
export const FINALE_CODE = 'other-wca-stage-finale';
const FINALE_MS = 30 * 60_000;

export function isFinale(slot: Slot | null | undefined): boolean {
  return slot?.activityCode === FINALE_CODE;
}

/** Negative id, so it never clashes with WCIF activity ids. */
function finaleSlot(roomId: number, slots: Slot[], timezone: string): Slot {
  const start = Math.max(...slots.map((s) => s.plannedEnd));
  return {
    id: -roomId,
    parentId: -roomId,
    roomId,
    activityCode: FINALE_CODE,
    name: 'Finale',
    eventId: null,
    roundNumber: null,
    groupNumber: null,
    plannedStart: start,
    plannedEnd: start + FINALE_MS,
    timezone,
  };
}

/** Activity code of the countdown slot that the app adds before the first activity of every day. */
export const COUNTDOWN_CODE = 'other-wca-stage-countdown';
export const DEFAULT_COUNTDOWN_MINUTES = 15;
/** Keeps countdown ids apart from finale ids (-roomId). */
const COUNTDOWN_ID_BASE = 1_000_000;

export function isCountdown(slot: Slot | null | undefined): boolean {
  return slot?.activityCode === COUNTDOWN_CODE;
}

/** True for the slots the app adds, which are not in the WCIF. */
export function isAppSlot(slot: Slot | null | undefined): boolean {
  return isFinale(slot) || isCountdown(slot);
}

/** The id depends on room and day only, so a saved log still matches after the countdown length changes. */
function countdownSlot(roomId: number, dayIndex: number, first: Slot, minutes: number): Slot {
  const id = -(COUNTDOWN_ID_BASE + roomId * 100 + dayIndex);
  return {
    id,
    parentId: id,
    roomId,
    activityCode: COUNTDOWN_CODE,
    name: 'Countdown',
    eventId: null,
    roundNumber: null,
    groupNumber: null,
    plannedStart: first.plannedStart - minutes * 60_000,
    plannedEnd: first.plannedStart,
    timezone: first.timezone,
  };
}

/** Adds a countdown before the first slot of each day. */
function withCountdowns(roomId: number, slots: Slot[], minutes: number): Slot[] {
  const result: Slot[] = [];
  let day: string | null = null;
  let dayIndex = 0;
  for (const slot of slots) {
    const key = dayKey(slot.plannedStart, slot.timezone);
    if (key !== day) {
      result.push(countdownSlot(roomId, dayIndex, slot, minutes));
      day = key;
      dayIndex++;
    }
    result.push(slot);
  }
  return result;
}

function compareSlots(a: Slot, b: Slot): number {
  return a.plannedStart - b.plannedStart || (a.groupNumber ?? 0) - (b.groupNumber ?? 0) || a.id - b.id;
}

/** `countdownMinutes` sets how long the countdown before each day runs. */
export function buildModel(wcif: Wcif, countdownMinutes = DEFAULT_COUNTDOWN_MINUTES): CompetitionModel {
  const rooms: RoomInfo[] = [];
  const activities = new Map<number, Slot>();
  const roundStarts = new Map<string, number>();

  for (const venue of wcif.schedule.venues) {
    for (const room of venue.rooms) {
      const slots: Slot[] = [];
      for (const activity of room.activities) {
        const parent = toSlot(activity, activity.id, room.id, venue.timezone);
        activities.set(parent.id, parent);

        if (parent.eventId && parent.roundNumber) {
          const code = `${parent.eventId}-r${parent.roundNumber}`;
          const known = roundStarts.get(code);
          if (known === undefined || parent.plannedStart < known) roundStarts.set(code, parent.plannedStart);
        }

        const children = activity.childActivities ?? [];
        if (children.length === 0) {
          slots.push(parent);
          continue;
        }
        for (const child of children) {
          const slot = toSlot(child, activity.id, room.id, venue.timezone);
          activities.set(slot.id, slot);
          slots.push(slot);
        }
      }
      slots.sort(compareSlots);
      if (slots.length === 0) {
        rooms.push({ id: room.id, name: room.name, venueName: venue.name, timezone: venue.timezone, slots });
        continue;
      }
      const finale = finaleSlot(room.id, slots, venue.timezone);
      const allSlots = [...withCountdowns(room.id, slots, countdownMinutes), finale];
      for (const slot of allSlots) {
        if (isAppSlot(slot)) activities.set(slot.id, slot);
      }
      rooms.push({ id: room.id, name: room.name, venueName: venue.name, timezone: venue.timezone, slots: allSlots });
    }
  }

  const persons = new Map<number, Person>();
  for (const person of wcif.persons) {
    if (person.registrantId !== null) persons.set(person.registrantId, person);
  }

  const rounds = new Map<string, Round>();
  const roundCounts = new Map<string, number>();
  for (const event of wcif.events) {
    roundCounts.set(event.id, event.rounds.length);
    for (const round of event.rounds) rounds.set(round.id, round);
  }

  const firstVenue = wcif.schedule.venues[0];
  return {
    wcif,
    rooms,
    activities,
    persons,
    rounds,
    roundCounts,
    roundStarts,
    countryIso2: firstVenue?.countryIso2 ?? '',
    timezone: firstVenue?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
  };
}
