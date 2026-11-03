import type { Slot } from './competition';

export function nextGroup(slots: Slot[], index: number): number {
  return Math.min(index + 1, slots.length - 1);
}

export function previousGroup(index: number): number {
  return Math.max(index - 1, 0);
}

/** First group of the next schedule item (round or other activity). */
export function nextEvent(slots: Slot[], index: number): number {
  const parentId = slots[index]?.parentId;
  for (let i = index + 1; i < slots.length; i++) {
    if (slots[i].parentId !== parentId) return i;
  }
  return index;
}

/** First group of the previous schedule item. */
export function previousEvent(slots: Slot[], index: number): number {
  let i = index - 1;
  while (i >= 0 && slots[i].parentId === slots[index].parentId) i--;
  if (i < 0) return 0;

  const parentId = slots[i].parentId;
  while (i > 0 && slots[i - 1].parentId === parentId) i--;
  return i;
}
