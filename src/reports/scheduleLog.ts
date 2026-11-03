import type { TFunction } from 'i18next';
import { csvCell } from '../format/download';
import { formatClock, toMinutes } from '../format/time';
import type { CompetitionModel } from '../model/competition';
import { activityLabel } from '../model/labels';
import type { LogEntry } from '../model/scheduleEngine';

/** Schedule log as CSV. Starts with a BOM so Excel reads Greek and other non-ASCII text correctly. */
export function scheduleLogCsv(t: TFunction, model: CompetitionModel, log: LogEntry[], locale: string): string {
  const header = [t('log.date'), t('log.room'), t('log.activity'), t('log.planned'), t('log.actual'), t('log.diffMinutes')];

  const rows = log.map((entry) => {
    const room = model.rooms.find((r) => r.id === entry.roomId);
    const timezone = room?.timezone ?? model.timezone;
    const slot = model.activities.get(entry.slotId);
    const date = new Date(entry.actualStart).toLocaleDateString(locale, { timeZone: timezone });
    const actual = formatClock(entry.actualStart, timezone, locale);
    if (!slot) return [date, room?.name ?? '', String(entry.slotId), '', actual, ''];
    return [
      date,
      room?.name ?? '',
      activityLabel(t, model, slot.activityCode, slot.name),
      formatClock(slot.plannedStart, timezone, locale),
      actual,
      toMinutes(entry.actualStart - slot.plannedStart),
    ];
  });

  return '\uFEFF' + [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n') + '\r\n';
}
