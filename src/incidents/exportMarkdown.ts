import type { TFunction } from 'i18next';
import { formatClock } from '../format/time';
import type { CompetitionModel } from '../model/competition';
import type { Incident } from './types';

export function incidentsToMarkdown(t: TFunction, model: CompetitionModel, incidents: Incident[], locale: string): string {
  const sorted = [...incidents].sort((a, b) => a.createdAt - b.createdAt);
  const lines = [`# ${t('incidents.title')} - ${model.wcif.name}`, ''];

  for (const incident of sorted) {
    const date = new Date(incident.createdAt).toLocaleDateString(locale, { timeZone: model.timezone });
    const time = formatClock(incident.createdAt, model.timezone, locale);
    const heading = [`${date} ${time}`, incident.slotLabel].filter(Boolean).join(' - ');
    lines.push(`## ${heading}`, '', incident.text.trim(), '');
    if (incident.refs.length > 0) {
      lines.push(`**${t('incidents.references')}:** ${incident.refs.map((r) => r.label).join('; ')}`, '');
    }
  }
  return lines.join('\n');
}
