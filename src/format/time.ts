/** Formats a timestamp as HH:MM in the venue timezone. */
export function formatClock(ms: number, timeZone: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone,
  }).format(ms);
}

export function formatClockWithSeconds(ms: number, timeZone: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
    timeZone,
  }).format(ms);
}

/** Formats as "Sat 13:05" in the venue timezone. Used where activities span several days. */
export function formatDayClock(ms: number, timeZone: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone,
  }).format(ms);
}

/** Calendar day key (YYYY-MM-DD) in the venue timezone. */
export function formatWeekday(ms: number, timeZone: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { weekday: 'long', timeZone }).format(ms);
}

export function dayKey(ms: number, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone }).format(ms);
}

/** Formats the competition dates, e.g. "24–26 October 2026", from a WCIF start date ("YYYY-MM-DD"). */
export function formatDateRange(startDate: string, numberOfDays: number, locale: string): string {
  // Noon UTC keeps the calendar day the same in every timezone.
  const start = new Date(`${startDate}T12:00:00Z`);
  const end = new Date(start.getTime() + Math.max(0, numberOfDays - 1) * 86_400_000);
  const format = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
  return numberOfDays > 1 ? format.formatRange(start, end) : format.format(start);
}

export function toMinutes(ms: number): number {
  return Math.round(ms / 60_000);
}
