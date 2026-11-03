import type { TFunction } from 'i18next';
import type { ResultsCache } from '../api/results';
import { formatResult } from '../format/result';
import type { Announcement, RecordInfo } from '../state/storage';
import { eventName } from './activityCode';
import type { CompetitionModel } from './competition';

/** Built-in messages, added once and hidden until switched on. */
const TEMPLATE_KEYS = ['templates.quiet', 'templates.phones', 'templates.quietArea'];

export function isTemplate(announcement: Announcement): boolean {
  return announcement.kind === 'template' || announcement.kind === 'record';
}

/** Adds missing built-in templates. Returns the same list when nothing is missing. */
export function withTemplates(list: Announcement[]): Announcement[] {
  const missing = TEMPLATE_KEYS.filter((key) => !list.some((a) => a.templateKey === key));
  if (missing.length === 0) return list;
  const added: Announcement[] = missing.map((key) => ({
    id: `template:${key}`,
    text: '',
    active: false,
    kind: 'template',
    templateKey: key,
  }));
  return [...added, ...list];
}

export interface FoundRecord {
  id: string;
  record: RecordInfo;
}

/** Every WR, continental or national record in the results. PRs are skipped. */
export function collectRecords(model: CompetitionModel, results: ResultsCache | null): FoundRecord[] {
  const found: FoundRecord[] = [];
  for (const round of results?.rounds ?? []) {
    for (const row of round.rows) {
      const tags = [
        { type: 'single' as const, tag: row.singleTag, result: row.best },
        { type: 'average' as const, tag: row.averageTag, result: row.average },
      ];
      for (const { type, tag, result } of tags) {
        if (!tag || tag === 'PR') continue;
        found.push({
          id: `record:${round.roundCode}:${row.registrantId}:${type}`,
          record: {
            tag,
            name: row.name,
            countryIso2: model.persons.get(row.registrantId)?.countryIso2 ?? null,
            eventId: round.eventId,
            type,
            result,
          },
        });
      }
    }
  }
  return found;
}

/**
 * Adds a shown announcement for every new WR, continental or national record in the results.
 * Each record is added once, so switching it off keeps it off. Returns the same list when nothing is new.
 */
export function withRecords(list: Announcement[], model: CompetitionModel, results: ResultsCache | null): Announcement[] {
  const ids = new Set(list.map((a) => a.id));
  const added: Announcement[] = [];
  for (const { id, record } of collectRecords(model, results)) {
    if (ids.has(id)) continue;
    added.push({ id, text: '', active: true, kind: 'record', record });
    ids.add(id);
  }
  return added.length === 0 ? list : [...list, ...added];
}

export function countryName(iso2: string | null, language: string): string {
  if (!iso2) return '';
  try {
    return new Intl.DisplayNames([language], { type: 'region' }).of(iso2) ?? iso2;
  } catch {
    return iso2;
  }
}

/** Text of an announcement in the current language of `t`. */
export function announcementText(t: TFunction, announcement: Announcement, language: string): string {
  if (announcement.kind === 'template' && announcement.templateKey) return t(announcement.templateKey);
  const record = announcement.record;
  if (announcement.kind === 'record' && record) {
    const kind = record.tag === 'WR' || record.tag === 'NR' ? record.tag : 'CR';
    return t(`record.${kind}`, {
      name: record.name,
      event: eventName(t, record.eventId),
      type: t(`records.${record.type}`),
      result: formatResult(record.result, record.eventId, record.type),
      country: countryName(record.countryIso2, language),
    });
  }
  return announcement.text;
}
