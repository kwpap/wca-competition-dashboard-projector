import type { TFunction } from 'i18next';
import { eventName, parseActivityCode } from './activityCode';
import { COUNTDOWN_CODE, FINALE_CODE, type CompetitionModel } from './competition';

export interface LabelParts {
  /** Event name, or the activity name for non-event activities (e.g. "Lunch"). */
  title: string;
  /** Translated round / group / attempt parts, e.g. ["Round 1", "Group 2"]. */
  parts: string[];
}

export function labelParts(
  t: TFunction,
  model: CompetitionModel,
  activityCode: string,
  fallbackName: string,
): LabelParts {
  if (activityCode === FINALE_CODE) return { title: t('finale.title'), parts: [] };
  if (activityCode === COUNTDOWN_CODE) return { title: t('countdown.title'), parts: [] };
  const code = parseActivityCode(activityCode);
  if (!code.eventId) return { title: fallbackName, parts: [] };

  const parts: string[] = [];
  if (code.roundNumber !== null) {
    const isFinal = model.roundCounts.get(code.eventId) === code.roundNumber;
    parts.push(isFinal ? t('activity.final') : t('activity.round', { number: code.roundNumber }));
  }
  if (code.groupNumber !== null) parts.push(t('activity.group', { number: code.groupNumber }));
  if (code.attemptNumber !== null) parts.push(t('activity.attempt', { number: code.attemptNumber }));
  return { title: eventName(t, code.eventId), parts };
}

/** Full one-line label, e.g. "3x3x3 Cube Round 1 Group 2". */
export function activityLabel(
  t: TFunction,
  model: CompetitionModel,
  activityCode: string,
  fallbackName = activityCode,
): string {
  const { title, parts } = labelParts(t, model, activityCode, fallbackName);
  return [title, ...parts].join(' ');
}
