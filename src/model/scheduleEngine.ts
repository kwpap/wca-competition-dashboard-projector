import { dayKey } from '../format/time';
import { isCountdown, type CompetitionModel, type RoomInfo, type Slot } from './competition';

/** Records that a slot actually started. The latest entry of a room is its current slot. */
export interface LogEntry {
  roomId: number;
  slotId: number;
  actualStart: number;
}

export interface RoomStatus {
  /** Index of the running slot, or -1 before the first "Proceed now". */
  currentIndex: number;
  /** Positive when behind schedule. */
  delayMs: number;
}

export type TimeKind = 'actual' | 'projected' | 'planned';

export interface SlotTime {
  start: number;
  kind: TimeKind;
}

function lastEntryIndex(log: LogEntry[], roomId: number): number {
  for (let i = log.length - 1; i >= 0; i--) {
    if (log[i].roomId === roomId) return i;
  }
  return -1;
}

export function roomStatus(room: RoomInfo, log: LogEntry[]): RoomStatus {
  const entryIndex = lastEntryIndex(log, room.id);
  if (entryIndex === -1) return { currentIndex: -1, delayMs: 0 };

  const entry = log[entryIndex];
  const currentIndex = room.slots.findIndex((s) => s.id === entry.slotId);
  if (currentIndex === -1) return { currentIndex: -1, delayMs: 0 };

  // Starting the countdown early or late says nothing about the day's schedule.
  const current = room.slots[currentIndex];
  if (isCountdown(current)) return { currentIndex, delayMs: 0 };
  return { currentIndex, delayMs: entry.actualStart - current.plannedStart };
}

/**
 * Start time of every slot in the room.
 * Past slots show their recorded start. Upcoming slots of the same day shift by the current delay.
 * Later days keep their planned times, since a delay does not carry over to the next day.
 */
export function slotTimes(room: RoomInfo, log: LogEntry[]): SlotTime[] {
  const status = roomStatus(room, log);
  const actualById = new Map<number, number>();
  for (const entry of log) {
    if (entry.roomId === room.id) actualById.set(entry.slotId, entry.actualStart);
  }

  const current = room.slots[status.currentIndex];
  const currentDay = current ? dayKey(current.plannedStart, room.timezone) : null;

  return room.slots.map((slot, index) => {
    if (index <= status.currentIndex) {
      const actual = actualById.get(slot.id);
      if (actual !== undefined) return { start: actual, kind: 'actual' };
      return { start: slot.plannedStart, kind: 'planned' };
    }
    if (dayKey(slot.plannedStart, room.timezone) !== currentDay) return { start: slot.plannedStart, kind: 'planned' };
    return { start: slot.plannedStart + status.delayMs, kind: 'projected' };
  });
}

/** Time of any activity, including parent rounds (which use their first group). */
export function activityTime(model: CompetitionModel, log: LogEntry[], activity: Slot): SlotTime {
  const room = model.rooms.find((r) => r.id === activity.roomId);
  if (!room) return { start: activity.plannedStart, kind: 'planned' };

  let index = room.slots.findIndex((s) => s.id === activity.id);
  if (index === -1) index = room.slots.findIndex((s) => s.parentId === activity.id);
  if (index === -1) return { start: activity.plannedStart, kind: 'planned' };

  return slotTimes(room, log)[index];
}

/** Index of the first slot on a later day than the given slot, or -1 on the last day. */
export function firstSlotOfNextDay(room: RoomInfo, index: number): number {
  const day = dayKey(room.slots[index].plannedStart, room.timezone);
  return room.slots.findIndex((slot, i) => i > index && dayKey(slot.plannedStart, room.timezone) !== day);
}

export function startSlot(log: LogEntry[], roomId: number, slotId: number, now: number): LogEntry[] {
  return [...log, { roomId, slotId, actualStart: now }];
}

export function undoLast(log: LogEntry[], roomId: number): LogEntry[] {
  const index = lastEntryIndex(log, roomId);
  if (index === -1) return log;
  return log.filter((_, i) => i !== index);
}

/** Moves the recorded start of the current slot. Used when "Proceed now" was pressed late. */
export function shiftCurrentStart(log: LogEntry[], roomId: number, deltaMs: number): LogEntry[] {
  const index = lastEntryIndex(log, roomId);
  if (index === -1) return log;
  return log.map((entry, i) => (i === index ? { ...entry, actualStart: entry.actualStart + deltaMs } : entry));
}
